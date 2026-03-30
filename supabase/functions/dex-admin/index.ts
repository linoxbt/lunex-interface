import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const prefix = "lnx_";
  let key = "";
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return prefix + key;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401, headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Verify user with their JWT
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS_HEADERS });
  }

  // Check admin role using service role client
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: roleData } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleData) {
    return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), { status: 403, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // LIST keys
    if (req.method === "GET" && action === "list") {
      const { data, error } = await adminClient
        .from("dex_api_keys")
        .select("id, key_value, label, is_active, created_at, revoked_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify({ keys: data }), { headers: CORS_HEADERS });
    }

    // USAGE analytics
    if (req.method === "GET" && action === "usage") {
      const keyId = url.searchParams.get("key_id");
      const days = parseInt(url.searchParams.get("days") || "7");
      const since = new Date(Date.now() - days * 86400000).toISOString();

      let query = adminClient
        .from("dex_api_usage")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false });

      if (keyId) query = query.eq("api_key_id", keyId);

      const { data, error } = await query.limit(1000);
      if (error) throw error;

      // Aggregate stats
      const total = data?.length || 0;
      const rateLimited = data?.filter((r: any) => r.rate_limited).length || 0;
      const byEndpoint: Record<string, number> = {};
      const byStatus: Record<number, number> = {};
      for (const row of data || []) {
        byEndpoint[row.endpoint] = (byEndpoint[row.endpoint] || 0) + 1;
        byStatus[row.status_code] = (byStatus[row.status_code] || 0) + 1;
      }

      return new Response(JSON.stringify({
        total_requests: total,
        rate_limited: rateLimited,
        by_endpoint: byEndpoint,
        by_status: byStatus,
        recent: (data || []).slice(0, 50),
      }), { headers: CORS_HEADERS });
    }

    // CREATE key
    if (req.method === "POST" && action === "create") {
      const body = await req.json();
      const label = body.label || "Unnamed Key";
      const keyValue = generateApiKey();

      const { data, error } = await adminClient
        .from("dex_api_keys")
        .insert({ key_value: keyValue, label, created_by: user.id })
        .select()
        .single();

      if (error) throw error;

      // Sync active keys to DEX_API_KEYS secret is not possible from edge function
      // Keys are validated directly from the database now

      return new Response(JSON.stringify({ key: data }), { status: 201, headers: CORS_HEADERS });
    }

    // REVOKE key
    if (req.method === "PUT" && action === "revoke") {
      const body = await req.json();
      const { id } = body;

      const { error } = await adminClient
        .from("dex_api_keys")
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: CORS_HEADERS });
    }

    // REACTIVATE key
    if (req.method === "PUT" && action === "reactivate") {
      const body = await req.json();
      const { id } = body;

      const { error } = await adminClient
        .from("dex_api_keys")
        .update({ is_active: true, revoked_at: null })
        .eq("id", id);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: CORS_HEADERS });
    }

    // DELETE key permanently
    if (req.method === "DELETE") {
      const id = url.searchParams.get("id");
      const { error } = await adminClient
        .from("dex_api_keys")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: CORS_HEADERS });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: CORS_HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: CORS_HEADERS });
  }
});
