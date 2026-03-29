import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, x-client-info, apikey",
  "Content-Type": "application/json",
};

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(key: string) {
  const now = Date.now();
  let entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateLimitMap.set(key, entry);
  }
  entry.count++;
  return { allowed: entry.count <= RATE_LIMIT, remaining: Math.max(0, RATE_LIMIT - entry.count), resetAt: entry.resetAt };
}

function validateApiKey(req: Request) {
  const apiKey = req.headers.get("x-api-key") || "";
  const validKeys = (Deno.env.get("DEX_API_KEYS") || "").split(",").map(k => k.trim()).filter(Boolean);
  if (validKeys.length === 0) return { valid: true, key: "anonymous" };
  return { valid: validKeys.includes(apiKey), key: apiKey };
}

const RPC_URL = "https://rpc.testnet.arc.network";
const POOL_ADDRESS = "0xC24BFc8e4b10500a72A63Bec98CCC989CbDA41d8";

const GET_DY_SELECTOR = "0x556d6e9f";
const FEE_SELECTOR = "0xddca3f43";
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

const priceHistory: { timestamp: number; rate: number }[] = [];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const auth = validateApiKey(req);
  if (!auth.valid) {
    return new Response(JSON.stringify({ error: "Invalid or missing API key" }), { status: 401, headers: CORS_HEADERS });
  }

  const rl = checkRateLimit(auth.key);
  const rlHeaders = { ...CORS_HEADERS, "X-RateLimit-Limit": String(RATE_LIMIT), "X-RateLimit-Remaining": String(rl.remaining), "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)) };
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: rlHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: rlHeaders });
  }

  try {
    const oneUnit = BigInt(1e6);

    const usdcToEurcData = GET_DY_SELECTOR + encodeBigInt(0n) + encodeBigInt(1n) + encodeBigInt(oneUnit);
    const usdcToEurcResult = await ethCall(POOL_ADDRESS, usdcToEurcData);
    const usdcToEurcRaw = decodeBigInt(usdcToEurcResult);
    const usdcToEurc = Number(usdcToEurcRaw) / 1e6;

    const eurcToUsdcData = GET_DY_SELECTOR + encodeBigInt(1n) + encodeBigInt(0n) + encodeBigInt(oneUnit);
    const eurcToUsdcResult = await ethCall(POOL_ADDRESS, eurcToUsdcData);
    const eurcToUsdcRaw = decodeBigInt(eurcToUsdcResult);
    const eurcToUsdc = Number(eurcToUsdcRaw) / 1e6;

    const feeResult = await ethCall(POOL_ADDRESS, FEE_SELECTOR);
    const feeRaw = decodeBigInt(feeResult);
    const feePercent = Number(feeRaw) / 1e8 * 100;

    const usdcReserveResult = await ethCall(POOL_ADDRESS, BALANCES_SELECTOR + encodeBigInt(0n));
    const eurcReserveResult = await ethCall(POOL_ADDRESS, BALANCES_SELECTOR + encodeBigInt(1n));
    const usdcReserve = Number(decodeBigInt(usdcReserveResult)) / 1e6;
    const eurcReserve = Number(decodeBigInt(eurcReserveResult)) / 1e6;

    const now = Date.now();
    priceHistory.push({ timestamp: now, rate: usdcToEurc });
    const cutoff = now - 24 * 60 * 60 * 1000;
    while (priceHistory.length > 0 && priceHistory[0].timestamp < cutoff) {
      priceHistory.shift();
    }

    const oldestInWindow = priceHistory.length > 1 ? priceHistory[0].rate : usdcToEurc;
    const change24h = oldestInWindow > 0 ? ((usdcToEurc - oldestInWindow) / oldestInWindow) * 100 : 0;

    const rates = priceHistory.map(p => p.rate);
    const high24h = rates.length > 0 ? Math.max(...rates) : usdcToEurc;
    const low24h = rates.length > 0 ? Math.min(...rates) : usdcToEurc;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          pair: "USDC/EURC",
          prices: {
            usdcToEurc: { rate: usdcToEurc.toFixed(6), inverseRate: (1 / usdcToEurc).toFixed(6) },
            eurcToUsdc: { rate: eurcToUsdc.toFixed(6), inverseRate: (1 / eurcToUsdc).toFixed(6) },
          },
          change24h: {
            percent: change24h.toFixed(4),
            direction: change24h >= 0 ? "up" : "down",
            dataPoints: priceHistory.length,
          },
          range24h: { high: high24h.toFixed(6), low: low24h.toFixed(6) },
          pool: {
            fee: feePercent.toFixed(4) + "%",
            usdcReserve: usdcReserve.toFixed(2),
            eurcReserve: eurcReserve.toFixed(2),
            tvl: (usdcReserve + eurcReserve).toFixed(2),
          },
        },
        meta: { protocol: "Lunex", chainId: 5042002, chainName: "Arc Testnet", timestamp: new Date().toISOString() },
      }),
      { status: 200, headers: rlHeaders }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ success: false, error: message }), { status: 500, headers: rlHeaders });
  }
});
