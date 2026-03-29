import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, x-client-info, apikey",
  "Content-Type": "application/json",
};

function validateApiKey(req: Request) {
  const apiKey = req.headers.get("x-api-key") || "";
  const validKeys = (Deno.env.get("DEX_API_KEYS") || "").split(",").map(k => k.trim()).filter(Boolean);
  if (validKeys.length === 0) return { valid: true, key: "anonymous" };
  return { valid: validKeys.includes(apiKey), key: apiKey };
}

// In-memory webhook registry (resets on isolate restart; production would use a database)
interface WebhookEntry {
  id: string;
  url: string;
  apiKey: string;
  events: string[];
  thresholdPercent: number;
  createdAt: string;
}

const webhooks: WebhookEntry[] = [];
let lastReserves: { usdc: number; eurc: number } | null = null;

const RPC_URL = "https://rpc.testnet.arc.network";
const POOL_ADDRESS = "0xC24BFc8e4b10500a72A63Bec98CCC989CbDA41d8";
const BALANCES_SELECTOR = "0x4903b0d1";

function encodeBigInt(val: bigint): string { return val.toString(16).padStart(64, "0"); }
function decodeBigInt(hex: string): bigint { return BigInt("0x" + (hex.startsWith("0x") ? hex.slice(2) : hex)); }

async function ethCall(to: string, data: string): Promise<string> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "RPC error");
  return json.result;
}

async function getCurrentReserves() {
  const usdcResult = await ethCall(POOL_ADDRESS, BALANCES_SELECTOR + encodeBigInt(0n));
  const eurcResult = await ethCall(POOL_ADDRESS, BALANCES_SELECTOR + encodeBigInt(1n));
  return {
    usdc: Number(decodeBigInt(usdcResult)) / 1e6,
    eurc: Number(decodeBigInt(eurcResult)) / 1e6,
  };
}

async function checkAndNotify() {
  const current = await getCurrentReserves();
  if (!lastReserves) {
    lastReserves = current;
    return;
  }

  const usdcChange = lastReserves.usdc > 0 ? Math.abs((current.usdc - lastReserves.usdc) / lastReserves.usdc) * 100 : 0;
  const eurcChange = lastReserves.eurc > 0 ? Math.abs((current.eurc - lastReserves.eurc) / lastReserves.eurc) * 100 : 0;
  const maxChange = Math.max(usdcChange, eurcChange);

  for (const wh of webhooks) {
    if (maxChange >= wh.thresholdPercent && wh.events.includes("reserve_change")) {
      try {
        await fetch(wh.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "reserve_change",
            protocol: "Lunex",
            pool: POOL_ADDRESS,
            previous: lastReserves,
            current,
            changePercent: { usdc: usdcChange.toFixed(4), eurc: eurcChange.toFixed(4) },
            timestamp: new Date().toISOString(),
          }),
        });
      } catch { /* webhook delivery failure, silently continue */ }
    }
  }

  lastReserves = current;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const auth = validateApiKey(req);
  if (!auth.valid) {
    return new Response(JSON.stringify({ error: "Invalid or missing API key" }), { status: 401, headers: CORS_HEADERS });
  }

  // POST: Register a webhook
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { url, events = ["reserve_change"], thresholdPercent = 5 } = body;

      if (!url || typeof url !== "string" || !url.startsWith("http")) {
        return new Response(JSON.stringify({ error: "Valid webhook URL required" }), { status: 400, headers: CORS_HEADERS });
      }

      const id = crypto.randomUUID();
      webhooks.push({ id, url, apiKey: auth.key, events, thresholdPercent, createdAt: new Date().toISOString() });

      return new Response(
        JSON.stringify({
          success: true,
          data: { id, url, events, thresholdPercent, message: "Webhook registered. You will receive POST notifications when pool reserves change beyond threshold." },
        }),
        { status: 201, headers: CORS_HEADERS }
      );
    } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400, headers: CORS_HEADERS });
    }
  }

  // DELETE: Remove a webhook
  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return new Response(JSON.stringify({ error: "Webhook id required" }), { status: 400, headers: CORS_HEADERS });
    }
    const idx = webhooks.findIndex(w => w.id === id && w.apiKey === auth.key);
    if (idx === -1) {
      return new Response(JSON.stringify({ error: "Webhook not found" }), { status: 404, headers: CORS_HEADERS });
    }
    webhooks.splice(idx, 1);
    return new Response(JSON.stringify({ success: true, message: "Webhook removed" }), { status: 200, headers: CORS_HEADERS });
  }

  // GET: List webhooks + trigger check
  if (req.method === "GET") {
    // Trigger a check on each GET (can also be called by cron)
    await checkAndNotify();

    const myWebhooks = webhooks.filter(w => w.apiKey === auth.key);
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          webhooks: myWebhooks.map(w => ({ id: w.id, url: w.url, events: w.events, thresholdPercent: w.thresholdPercent, createdAt: w.createdAt })),
          currentReserves: lastReserves,
          supportedEvents: ["reserve_change"],
        },
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS_HEADERS });
});
