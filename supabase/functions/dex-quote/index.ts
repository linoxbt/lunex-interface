import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─── Lunex Finance DEX Adapter — Quote Endpoint ───
// GET /quote?tokenIn=0x...&tokenOut=0x...&amountIn=1000000&slippage=0.5
//
// Returns expected output amount, price impact, route, estimated gas, and fees.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

// ─── Contract Config ───
const RPC_URL = "https://rpc.testnet.arc.network";
const POOL_ADDRESS = "0xC24BFc8e4b10500a72A63Bec98CCC989CbDA41d8";

const SUPPORTED_TOKENS: Record<string, { symbol: string; decimals: number; index: bigint }> = {
  "0x3600000000000000000000000000000000000000": { symbol: "USDC", decimals: 6, index: 0n },
  "0x89b50855aa3be2f677cd6303cec089b5f319d72a": { symbol: "EURC", decimals: 6, index: 1n },
};

// ─── Minimal ABI encoding helpers (no ethers dependency) ───
function encodeFunctionCall(selector: string, params: bigint[]): string {
  let data = selector;
  for (const p of params) {
    data += p.toString(16).padStart(64, "0");
  }
  return data;
}

function decodeBigInt(hex: string): bigint {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return BigInt("0x" + clean);
}

// get_dy(uint256,uint256,uint256) selector: 0x5e0d443f
const GET_DY_SELECTOR = "0x5e0d443f";
// fee() selector: 0xddca3f43
const FEE_SELECTOR = "0xddca3f43";

async function ethCall(to: string, data: string): Promise<string> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to, data }, "latest"],
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "RPC error");
  return json.result;
}

interface QuoteResult {
  amountOut: string;
  priceImpact: number;
  route: { protocol: string; pool: string; tokenIn: string; tokenOut: string }[];
  estimatedGas: string;
  fees: { swapFeePercent: string; protocolFee: string };
}

async function getQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  _slippage: number
): Promise<QuoteResult> {
  const inToken = SUPPORTED_TOKENS[tokenIn.toLowerCase()];
  const outToken = SUPPORTED_TOKENS[tokenOut.toLowerCase()];

  if (!inToken || !outToken) {
    throw new Error(`Unsupported token pair. Supported: ${Object.keys(SUPPORTED_TOKENS).join(", ")}`);
  }
  if (inToken.index === outToken.index) {
    throw new Error("tokenIn and tokenOut must be different");
  }

  const amountInBigInt = BigInt(amountIn);
  if (amountInBigInt <= 0n) {
    throw new Error("amountIn must be positive");
  }

  // Fetch amountOut from pool
  const dyData = encodeFunctionCall(GET_DY_SELECTOR, [inToken.index, outToken.index, amountInBigInt]);
  const dyResult = await ethCall(POOL_ADDRESS, dyData);
  const amountOut = decodeBigInt(dyResult);

  // Fetch spot rate (1 unit)
  const oneUnit = BigInt(10 ** inToken.decimals);
  const spotData = encodeFunctionCall(GET_DY_SELECTOR, [inToken.index, outToken.index, oneUnit]);
  const spotResult = await ethCall(POOL_ADDRESS, spotData);
  const spotOut = decodeBigInt(spotResult);

  // Fetch fee
  const feeResult = await ethCall(POOL_ADDRESS, FEE_SELECTOR);
  const feeRaw = decodeBigInt(feeResult);
  // Fee is stored as fee / 1e8 (e.g., 4000000 = 0.04 = 4%)
  const feePercent = Number(feeRaw) / 1e8 * 100;

  // Calculate price impact
  const spotRate = Number(spotOut) / (10 ** outToken.decimals);
  const effectiveRate = Number(amountOut) / (Number(amountInBigInt) / (10 ** inToken.decimals)) / (10 ** outToken.decimals) * (10 ** inToken.decimals);
  const normalizedEffective = Number(amountOut) * (10 ** inToken.decimals) / (Number(amountInBigInt) * (10 ** outToken.decimals));
  const normalizedSpot = Number(spotOut) / (10 ** outToken.decimals);
  const priceImpact = normalizedSpot > 0 ? ((normalizedSpot - normalizedEffective) / normalizedSpot) * 100 : 0;

  return {
    amountOut: amountOut.toString(),
    priceImpact: Math.max(0, Math.round(priceImpact * 10000) / 10000),
    route: [
      {
        protocol: "Lunex Finance",
        pool: POOL_ADDRESS,
        tokenIn: tokenIn,
        tokenOut: tokenOut,
      },
    ],
    estimatedGas: "150000",
    fees: {
      swapFeePercent: feePercent.toFixed(4),
      protocolFee: "0",
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  try {
    const url = new URL(req.url);
    const tokenIn = url.searchParams.get("tokenIn");
    const tokenOut = url.searchParams.get("tokenOut");
    const amountIn = url.searchParams.get("amountIn");
    const slippage = parseFloat(url.searchParams.get("slippage") || "0.5");

    if (!tokenIn || !tokenOut || !amountIn) {
      return new Response(
        JSON.stringify({
          error: "Missing required parameters",
          required: ["tokenIn", "tokenOut", "amountIn"],
          optional: ["slippage (default: 0.5)"],
          example: "/dex-quote?tokenIn=0x3600000000000000000000000000000000000000&tokenOut=0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a&amountIn=1000000",
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const quote = await getQuote(tokenIn, tokenOut, amountIn, slippage);

    return new Response(
      JSON.stringify({
        success: true,
        data: quote,
        meta: {
          protocol: "Lunex Finance",
          chainId: 5042002,
          chainName: "Arc Testnet",
          timestamp: new Date().toISOString(),
        },
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("Unsupported") || message.includes("must be") ? 400 : 500;
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status, headers: CORS_HEADERS }
    );
  }
});
