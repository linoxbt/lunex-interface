import { useState, useCallback } from "react";
import { useAccount, useWalletClient, useSwitchChain } from "wagmi";
import { parseUnits, pad, zeroHash, encodeFunctionData, decodeFunctionResult, createPublicClient, http } from "viem";
import {
  BRIDGE_CHAINS,
  TOKEN_MESSENGER_ABI,
  MESSAGE_TRANSMITTER_ABI,
  ERC20_APPROVE_ABI,
  IRIS_API_URL,
  type BridgeChainKey,
} from "../config/bridgeConfig";
import {
  type BridgeTransaction,
  type BridgeStatus,
  saveBridgeTransaction,
} from "../state/bridgeState";

/** Poll CCTP V2 attestation API using domain + txHash */
function useAttestationV2() {
  const [attestation, setAttestation] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<"pending" | "complete" | "error">("pending");
  const [error, setError] = useState<string | null>(null);

  const startPolling = useCallback(async (domain: number, txHash: string) => {
    setStatus("pending");
    setAttestation(null);
    setMessage(null);
    setError(null);

    const url = `${IRIS_API_URL}/v2/messages/${domain}?transactionHash=${txHash}`;
    const maxAttempts = 120;
    const delayMs = 5000;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10_000);
        let res: Response;
        try {
          res = await fetch(url, { signal: controller.signal });
        } finally {
          clearTimeout(timer);
        }

        if (res.ok) {
          const data = await res.json();
          if (data?.messages?.[0]?.status === "complete" && data.messages[0].attestation) {
            setAttestation(data.messages[0].attestation);
            setMessage(data.messages[0].message);
            setStatus("complete");
            return { message: data.messages[0].message, attestation: data.messages[0].attestation };
          }
        }
      } catch {
        // transient error, keep polling
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }

    setStatus("error");
    setError("Attestation timeout — you can retry minting later");
    return null;
  }, []);

  return { attestation, message, status, error, startPolling };
}

export function useBridge() {
  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();

  const [bridgeTx, setBridgeTx] = useState<BridgeTransaction | null>(null);
  const [status, setStatus] = useState<BridgeStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const attestationV2 = useAttestationV2();

  const getChainClient = useCallback((chain: BridgeChainKey) => {
    const config = BRIDGE_CHAINS[chain];
    return createPublicClient({ transport: http(config.rpcUrl) });
  }, []);

  const updateTx = useCallback((updates: Partial<BridgeTransaction>) => {
    setBridgeTx((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates, updatedAt: Date.now() };
      saveBridgeTransaction(updated);
      return updated;
    });
  }, []);

  const ensureChain = useCallback(
    async (targetChainId: number) => {
      if (chainId !== targetChainId) {
        try {
          await switchChainAsync({ chainId: targetChainId });
        } catch (switchError: any) {
          // If the chain isn't added to wallet, the switch will fail
          // Prompt user to switch manually
          throw new Error(
            `Please switch your wallet to the correct network (chain ID: ${targetChainId}) and try again.`
          );
        }
        // Wait a moment for the wallet to settle after chain switch
        await new Promise((r) => setTimeout(r, 1500));
      }
    },
    [chainId, switchChainAsync]
  );

  const startBridge = useCallback(
    async (amount: string, fromChain: BridgeChainKey, toChain: BridgeChainKey) => {
      if (!address || !walletClient) {
        setError("Wallet not connected");
        return;
      }

      if (fromChain === toChain) {
        setError("Source and destination chains must be different");
        return;
      }

      const from = BRIDGE_CHAINS[fromChain];
      const to = BRIDGE_CHAINS[toChain];
      const fromPublicClient = getChainClient(fromChain);
      const toPublicClient = getChainClient(toChain);
      const parsedAmount = parseUnits(amount, from.usdcDecimals);

      const tx: BridgeTransaction = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        fromChain,
        toChain,
        amount,
        status: "approving",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      setBridgeTx(tx);
      setStatus("approving");
      setError(null);
      saveBridgeTransaction(tx);

      try {
        // Ensure correct chain
        await ensureChain(from.chainId);

        // Pre-flight: check USDC balance
        const balanceOfAbi = [{
          name: "balanceOf" as const,
          type: "function" as const,
          stateMutability: "view" as const,
          inputs: [{ name: "account", type: "address" as const }],
          outputs: [{ name: "", type: "uint256" as const }],
        }] as const;

        const callData = encodeFunctionData({
          abi: balanceOfAbi,
          functionName: "balanceOf",
          args: [address],
        });
        const raw = await fromPublicClient.call({ to: from.usdc, data: callData });
        const balance = decodeFunctionResult({ abi: balanceOfAbi, functionName: "balanceOf", data: raw.data! }) as bigint;

        if (balance < parsedAmount) {
          throw new Error(
            `Insufficient USDC balance. You have ${(Number(balance) / 10 ** from.usdcDecimals).toFixed(2)} USDC but tried to bridge ${amount} USDC.`
          );
        }

        // Step 1: Approve USDC
        setStatus("approving");
        updateTx({ status: "approving" });

        const approveHash = await walletClient.writeContract({
          address: from.usdc,
          abi: ERC20_APPROVE_ABI,
          functionName: "approve",
          args: [from.tokenMessenger, parsedAmount],
          chain: undefined,
          account: address,
        });
        await fromPublicClient.waitForTransactionReceipt({ hash: approveHash });

        // Step 2: Burn via depositForBurn (CCTP V2 — 7 params)
        setStatus("burning");
        updateTx({ status: "burning" });

        const mintRecipient = pad(address, { size: 32 });
        // destinationCaller = bytes32(0) means anyone can relay
        const destinationCaller = zeroHash as `0x${string}`;
        // maxFee = 0 for standard transfer (no fast transfer fee)
        const maxFee = 0n;
        // minFinalityThreshold: 0 = default finality, 1000 = fast
        const minFinalityThreshold = 2000;

        const burnHash = await walletClient.writeContract({
          address: from.tokenMessenger,
          abi: TOKEN_MESSENGER_ABI,
          functionName: "depositForBurn",
          args: [parsedAmount, to.domain, mintRecipient, from.usdc, destinationCaller, maxFee, minFinalityThreshold],
          chain: undefined,
          account: address,
        });

        await fromPublicClient.waitForTransactionReceipt({ hash: burnHash });

        // Step 3: Poll V2 attestation API using domain + txHash (no manual log parsing needed)
        setStatus("waiting_attestation");
        updateTx({
          status: "waiting_attestation",
          burnTxHash: burnHash,
        });

        const attResult = await attestationV2.startPolling(from.domain, burnHash);
        if (!attResult) {
          throw new Error("Attestation timeout — you can retry minting later from bridge history");
        }

        // Step 4: Mint on destination
        await ensureChain(to.chainId);
        setStatus("minting");
        updateTx({ status: "minting" });

        const mintHash = await walletClient.writeContract({
          address: to.messageTransmitter,
          abi: MESSAGE_TRANSMITTER_ABI,
          functionName: "receiveMessage",
          args: [attResult.message as `0x${string}`, attResult.attestation as `0x${string}`],
          chain: undefined,
          account: address,
        });

        await toPublicClient.waitForTransactionReceipt({ hash: mintHash });

        setStatus("complete");
        updateTx({ status: "complete", mintTxHash: mintHash, attestation: attResult.attestation });
      } catch (err: any) {
        const msg = err?.shortMessage || err?.message || "Bridge failed";
        setStatus("failed");
        setError(msg);
        updateTx({ status: "failed", error: msg });
      }
    },
    [address, walletClient, ensureChain, updateTx, attestationV2, getChainClient]
  );

  const completeMint = useCallback(async () => {
    if (!bridgeTx || !walletClient || !bridgeTx.burnTxHash || !address) return;

    const from = BRIDGE_CHAINS[bridgeTx.fromChain];
    const to = BRIDGE_CHAINS[bridgeTx.toChain];
    const toPublicClient = getChainClient(bridgeTx.toChain);

    try {
      // Re-poll attestation if needed
      setStatus("waiting_attestation");
      const attResult = await attestationV2.startPolling(from.domain, bridgeTx.burnTxHash);
      if (!attResult) {
        throw new Error("Attestation not ready yet");
      }

      await ensureChain(to.chainId);
      setStatus("minting");
      updateTx({ status: "minting" });

      const mintHash = await walletClient.writeContract({
        address: to.messageTransmitter,
        abi: MESSAGE_TRANSMITTER_ABI,
        functionName: "receiveMessage",
        args: [attResult.message as `0x${string}`, attResult.attestation as `0x${string}`],
        chain: undefined,
        account: address,
      });

      await toPublicClient.waitForTransactionReceipt({ hash: mintHash });

      setStatus("complete");
      updateTx({ status: "complete", mintTxHash: mintHash, attestation: attResult.attestation });
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || "Mint failed";
      setStatus("failed");
      setError(msg);
      updateTx({ status: "failed", error: msg });
    }
  }, [bridgeTx, walletClient, attestationV2, ensureChain, updateTx, address, getChainClient]);

  const reset = useCallback(() => {
    setBridgeTx(null);
    setStatus("idle");
    setError(null);
  }, []);

  const resumeBridge = useCallback((tx: BridgeTransaction) => {
    setBridgeTx(tx);
    setStatus(tx.status);
    setError(tx.error || null);
  }, []);

  return {
    status,
    error,
    bridgeTx,
    attestation: attestationV2,
    startBridge,
    completeMint,
    reset,
    resumeBridge,
  };
}
