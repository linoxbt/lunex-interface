import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, x-client-info, apikey",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  return new Response(
    JSON.stringify({
      protocol: "Lunex Finance",
      version: "1.1.0",
      description: "StableSwap AMM on Arc Testnet — USDC/EURC pool",
      chain: { id: 5042002, name: "Arc Testnet", rpc: "https://rpc.testnet.arc.network" },
      authentication: {
        method: "API Key",
        header: "x-api-key",
        note: "Required on /dex-quote, /dex-swap, /dex-liquidity. Not required on this info endpoint.",
      },
      rateLimits: {
        quote: "60 requests/minute per API key",
        swap: "30 requests/minute per API key",
        liquidity: "120 requests/minute per API key",
        headers: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
      },
      pool: {
        address: "0xC24BFc8e4b10500a72A63Bec98CCC989CbDA41d8",
        type: "StableSwap (Curve-style)",
        tokens: [
          { symbol: "USDC", address: "0x3600000000000000000000000000000000000000", decimals: 6, index: 0 },
          { symbol: "EURC", address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", decimals: 6, index: 1 },
        ],
      },
      endpoints: {
        quote: {
          method: "GET", path: "/dex-quote",
          params: { tokenIn: "Token address (required)", tokenOut: "Token address (required)", amountIn: "Amount in smallest unit (required)", slippage: "% (optional, default 0.5)" },
          rateLimit: "60/min",
        },
        swap: {
          method: "POST", path: "/dex-swap",
          body: { walletAddress: "required", tokenIn: "required", tokenOut: "required", amountIn: "required", slippage: "optional (0.5)" },
          rateLimit: "30/min",
        },
        liquidity: {
          method: "GET", path: "/dex-liquidity",
          description: "Pool reserves, TVL, LP token supply",
          rateLimit: "120/min",
        },
        info: { method: "GET", path: "/dex-adapter-info", description: "This endpoint (no auth required)" },
      },
      integration: {
        steps: [
          "1. Obtain an API key (set DEX_API_KEYS secret on the backend)",
          "2. Call /dex-adapter-info to discover supported tokens",
          "3. Call /dex-liquidity to check pool TVL and reserves",
          "4. Call /dex-quote with x-api-key header for pricing",
          "5. Call /dex-swap to get unsigned approve + swap tx data",
          "6. Submit approve tx, then swap tx via user's wallet",
        ],
      },
    }),
    { status: 200, headers: CORS_HEADERS }
  );
});
