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

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS_HEADERS });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Check user's role
  const { data: roles } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const userRoles = (roles || []).map((r: any) => r.role);
  const isAdmin = userRoles.includes("admin");
  const isDeveloper = userRoles.includes("developer");

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // === DEVELOPER ENDPOINTS (developer or admin) ===

    // MY KEYS - developers see their own keys
    if (req.method === "GET" && action === "my-keys") {
      if (!isAdmin && !isDeveloper) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: CORS_HEADERS });
      }
      const { data, error } = await adminClient
        .from("dex_api_keys")
        .select("id, key_value, label, is_active, created_at, revoked_at")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ keys: data }), { headers: CORS_HEADERS });
    }

    // MY USAGE - developers see usage for their own keys
    if (req.method === "GET" && action === "my-usage") {
      if (!isAdmin && !isDeveloper) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: CORS_HEADERS });
      }
      const days = parseInt(url.searchParams.get("days") || "7");
      const since = new Date(Date.now() - days * 86400000).toISOString();

      // Get this user's key IDs
      const { data: myKeys } = await adminClient
        .from("dex_api_keys")
        .select("id")
        .eq("created_by", user.id);
      const keyIds = (myKeys || []).map((k: any) => k.id);

      if (keyIds.length === 0) {
        return new Response(JSON.stringify({ total_requests: 0, rate_limited: 0, by_endpoint: {}, by_status: {}, recent: [] }), { headers: CORS_HEADERS });
      }

      const { data, error } = await adminClient
        .from("dex_api_usage")
        .select("*")
        .in("api_key_id", keyIds)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;

      const total = data?.length || 0;
      const rateLimited = data?.filter((r: any) => r.rate_limited).length || 0;
      const byEndpoint: Record<string, number> = {};
      const byStatus: Record<number, number> = {};
      for (const row of data || []) {
        byEndpoint[row.endpoint] = (byEndpoint[row.endpoint] || 0) + 1;
        byStatus[row.status_code] = (byStatus[row.status_code] || 0) + 1;
      }

      return new Response(JSON.stringify({ total_requests: total, rate_limited: rateLimited, by_endpoint: byEndpoint, by_status: byStatus, recent: (data || []).slice(0, 50) }), { headers: CORS_HEADERS });
    }

    // === ADMIN-ONLY ENDPOINTS ===
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), { status: 403, headers: CORS_HEADERS });
    }

    // LIST all keys (admin)
    if (req.method === "GET" && action === "list") {
      const { data, error } = await adminClient
        .from("dex_api_keys")
        .select("id, key_value, label, is_active, created_at, revoked_at, created_by")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ keys: data }), { headers: CORS_HEADERS });
    }

    // USAGE analytics (admin)
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

    // LIST all users with profiles and roles (admin)
    if (req.method === "GET" && action === "users") {
      const { data: profiles, error } = await adminClient
        .from("profiles")
        .select("id, email, display_name, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: allRoles } = await adminClient
        .from("user_roles")
        .select("user_id, role");

      const roleMap: Record<string, string[]> = {};
      for (const r of allRoles || []) {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
        roleMap[r.user_id].push(r.role);
      }

      const users = (profiles || []).map((p: any) => ({
        ...p,
        roles: roleMap[p.id] || [],
      }));

      return new Response(JSON.stringify({ users }), { headers: CORS_HEADERS });
    }

    // ASSIGN role (admin)
    if (req.method === "POST" && action === "assign-role") {
      const body = await req.json();
      const { user_id, role } = body;
      if (!user_id || !role) {
        return new Response(JSON.stringify({ error: "user_id and role required" }), { status: 400, headers: CORS_HEADERS });
      }
      const validRoles = ["admin", "developer", "user"];
      if (!validRoles.includes(role)) {
        return new Response(JSON.stringify({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` }), { status: 400, headers: CORS_HEADERS });
      }
      const { error } = await adminClient
        .from("user_roles")
        .insert({ user_id, role })
        .select();
      if (error) {
        if (error.code === "23505") {
          return new Response(JSON.stringify({ error: "User already has this role" }), { status: 409, headers: CORS_HEADERS });
        }
        throw error;
      }
      return new Response(JSON.stringify({ success: true }), { status: 201, headers: CORS_HEADERS });
    }

    // REMOVE role (admin)
    if (req.method === "DELETE" && action === "remove-role") {
      const userId = url.searchParams.get("user_id");
      const role = url.searchParams.get("role");
      if (!userId || !role) {
        return new Response(JSON.stringify({ error: "user_id and role required" }), { status: 400, headers: CORS_HEADERS });
      }
      // Prevent removing your own admin role
      if (userId === user.id && role === "admin") {
        return new Response(JSON.stringify({ error: "Cannot remove your own admin role" }), { status: 400, headers: CORS_HEADERS });
      }
      const { error } = await adminClient
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: CORS_HEADERS });
    }

    // CREATE key
    if (req.method === "POST" && action === "create") {
      const body = await req.json();
      const label = body.label || "Unnamed Key";
      const createdBy = body.created_by || user.id;
      const keyValue = generateApiKey();

      const { data, error } = await adminClient
        .from("dex_api_keys")
        .insert({ key_value: keyValue, label, created_by: createdBy })
        .select()
        .single();

      if (error) throw error;
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
    if (req.method === "DELETE" && action === "delete-key") {
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
