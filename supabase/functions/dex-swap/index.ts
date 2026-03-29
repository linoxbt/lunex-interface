import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─── Lunex Finance DEX Adapter — Swap Endpoint ───
// POST /swap
// Body: { walletAddress, tokenIn, tokenOut, amountIn, slippage? }
//
// Returns unsigned transaction data that the aggregator can forward to the user's wallet.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

const RPC_URL = "https://rpc.testnet.arc.network";
const POOL_ADDRESS = "0xC24BFc8e4b10500a72A63Bec98CCC989CbDA41d8";
const CHAIN_ID = 5042002;

const SUPPORTED_TOKENS: Record<string, { symbol: string; decimals: number; index: bigint }> = {
  "0x3600000000000000000000000000000000000000": { symbol: "USDC", decimals: 6, index: 0n },
  "0x89b50855aa3be2f677cd6303cec089b5f319d72a": { symbol: "EURC", decimals: 6, index: 1n },
};

// ─── ABI encoding helpers ───
function encodeBigInt(val: bigint): string {
  return val.toString(16).padStart(64, "0");
}

function encodeFunctionCall(selector: string, params: bigint[]): string {
  let data = selector;
  for (const p of params) data += encodeBigInt(p);
  return data;
}

function decodeBigInt(hex: string): bigint {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return BigInt("0x" + clean);
}

// Function selectors
const GET_DY_SELECTOR = "0x556d6e9f"; // get_dy(uint256,uint256,uint256)
const EXCHANGE_SELECTOR = "0x5b41b908"; // exchange(uint256,uint256,uint256,uint256)
const APPROVE_SELECTOR = "0x095ea7b3"; // approve(address,uint256)

function encodeAddress(addr: string): string {
  return addr.toLowerCase().replace("0x", "").padStart(64, "0");
}

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

interface SwapRequest {
  walletAddress: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippage?: number;
}

interface TransactionData {
  to: string;
  data: string;
  value: string;
  chainId: number;
  gasLimit: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  try {
    const body: SwapRequest = await req.json();
    const { walletAddress, tokenIn, tokenOut, amountIn, slippage = 0.5 } = body;

    // ─── Validation ───
    if (!walletAddress || !tokenIn || !tokenOut || !amountIn) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields",
          required: ["walletAddress", "tokenIn", "tokenOut", "amountIn"],
          optional: ["slippage (default: 0.5)"],
          example: {
            walletAddress: "0xYourWallet",
            tokenIn: "0x3600000000000000000000000000000000000000",
            tokenOut: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
            amountIn: "1000000",
            slippage: 0.5,
          },
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return new Response(
        JSON.stringify({ error: "Invalid walletAddress format" }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const inToken = SUPPORTED_TOKENS[tokenIn.toLowerCase()];
    const outToken = SUPPORTED_TOKENS[tokenOut.toLowerCase()];

    if (!inToken || !outToken) {
      return new Response(
        JSON.stringify({
          error: "Unsupported token",
          supportedTokens: Object.entries(SUPPORTED_TOKENS).map(([addr, t]) => ({
            address: addr,
            symbol: t.symbol,
          })),
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (inToken.index === outToken.index) {
      return new Response(
        JSON.stringify({ error: "tokenIn and tokenOut must be different" }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const amountInBigInt = BigInt(amountIn);
    if (amountInBigInt <= 0n) {
      return new Response(
        JSON.stringify({ error: "amountIn must be positive" }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // ─── Get expected output ───
    const dyData = encodeFunctionCall(GET_DY_SELECTOR, [inToken.index, outToken.index, amountInBigInt]);
    const dyResult = await ethCall(POOL_ADDRESS, dyData);
    const expectedOut = decodeBigInt(dyResult);

    if (expectedOut === 0n) {
      return new Response(
        JSON.stringify({ error: "Insufficient liquidity for this trade" }),
        { status: 422, headers: CORS_HEADERS }
      );
    }

    // ─── Calculate minDy with slippage ───
    const slippageBps = BigInt(Math.floor((1 - slippage / 100) * 10000));
    const minDy = (expectedOut * slippageBps) / 10000n;

    // ─── Build approval tx ───
    const maxApproval = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    const approveData = APPROVE_SELECTOR + encodeAddress(POOL_ADDRESS) + encodeBigInt(maxApproval);

    const approveTx: TransactionData = {
      to: tokenIn,
      data: approveData,
      value: "0x0",
      chainId: CHAIN_ID,
      gasLimit: "60000",
    };

    // ─── Build swap tx ───
    const swapData = encodeFunctionCall(EXCHANGE_SELECTOR, [
      inToken.index,
      outToken.index,
      amountInBigInt,
      minDy,
    ]);

    const swapTx: TransactionData = {
      to: POOL_ADDRESS,
      data: swapData,
      value: "0x0",
      chainId: CHAIN_ID,
      gasLimit: "250000",
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          approveTransaction: approveTx,
          swapTransaction: swapTx,
          expectedOutput: expectedOut.toString(),
          minimumOutput: minDy.toString(),
          slippagePercent: slippage,
          tokenIn: { address: tokenIn, symbol: inToken.symbol, decimals: inToken.decimals },
          tokenOut: { address: tokenOut, symbol: outToken.symbol, decimals: outToken.decimals },
        },
        meta: {
          protocol: "Lunex Finance",
          chainId: CHAIN_ID,
          chainName: "Arc Testnet",
          pool: POOL_ADDRESS,
          timestamp: new Date().toISOString(),
        },
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
});
