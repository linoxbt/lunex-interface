import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─── Lunex Finance DEX Adapter — Info / Discovery Endpoint ───
// GET /dex-adapter-info
//
// Returns protocol metadata, supported tokens, and endpoint documentation
// for DEX aggregator integration.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  return new Response(
    JSON.stringify({
      protocol: "Lunex Finance",
      version: "1.0.0",
      description: "StableSwap AMM on Arc Testnet — USDC/EURC pool",
      chain: {
        id: 5042002,
        name: "Arc Testnet",
        rpc: "https://rpc.testnet.arc.network",
      },
      pool: {
        address: "0xC24BFc8e4b10500a72A63Bec98CCC989CbDA41d8",
        type: "StableSwap (Curve-style)",
        tokens: [
          {
            symbol: "USDC",
            address: "0x3600000000000000000000000000000000000000",
            decimals: 6,
            index: 0,
          },
          {
            symbol: "EURC",
            address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
            decimals: 6,
            index: 1,
          },
        ],
      },
      endpoints: {
        quote: {
          method: "GET",
          path: "/dex-quote",
          params: {
            tokenIn: "Token address (required)",
            tokenOut: "Token address (required)",
            amountIn: "Amount in smallest unit (required)",
            slippage: "Slippage tolerance % (optional, default 0.5)",
          },
          example:
            "/dex-quote?tokenIn=0x3600000000000000000000000000000000000000&tokenOut=0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a&amountIn=1000000",
        },
        swap: {
          method: "POST",
          path: "/dex-swap",
          body: {
            walletAddress: "User wallet address (required)",
            tokenIn: "Token address (required)",
            tokenOut: "Token address (required)",
            amountIn: "Amount in smallest unit (required)",
            slippage: "Slippage tolerance % (optional, default 0.5)",
          },
        },
        info: {
          method: "GET",
          path: "/dex-adapter-info",
          description: "This endpoint — protocol metadata and integration docs",
        },
      },
      integration: {
        steps: [
          "1. Call /dex-adapter-info to discover supported tokens and pool",
          "2. Call /dex-quote to get expected output for a token pair",
          "3. Call /dex-swap to get unsigned transaction data",
          "4. Submit the approve tx first, then the swap tx via user's wallet",
        ],
        notes: [
          "All amounts are in the token's smallest unit (6 decimals for both USDC and EURC)",
          "The swap endpoint returns unsigned transaction data — the aggregator must submit via the user's wallet",
          "Approval is returned as a separate tx; check allowance first to skip if already approved",
        ],
      },
    }),
    { status: 200, headers: CORS_HEADERS }
  );
});
