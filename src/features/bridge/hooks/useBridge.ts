import { useState, useCallback } from "react";
import { useAccount, useWalletClient, useSwitchChain, useConfig } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { parseUnits, keccak256, decodeEventLog } from "viem";
import {
  BRIDGE_CHAINS,
  TOKEN_MESSENGER_ABI,
  MESSAGE_TRANSMITTER_ABI,
  ERC20_APPROVE_ABI,
  MESSAGE_SENT_EVENT_ABI,
  type BridgeChainKey,
} from "../config/bridgeConfig";
import { addressToBytes32 } from "../utils/addressUtils";
import {
  type BridgeTransaction,
  type BridgeStatus,
  saveBridgeTransaction,
} from "../state/bridgeState";
import { useAttestation } from "./useAttestation";

export function useBridge() {
  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const config = useConfig();
  const { switchChainAsync } = useSwitchChain();

  const [bridgeTx, setBridgeTx] = useState<BridgeTransaction | null>(null);
  const [status, setStatus] = useState<BridgeStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const attestation = useAttestation(
    status === "waiting_attestation" ? bridgeTx?.messageHash : null
  );

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
        await switchChainAsync({ chainId: targetChainId });
      }
    },
    [chainId, switchChainAsync]
  );

  const getClient = useCallback(
    (targetChainId: number) => {
      return getPublicClient(config, { chainId: targetChainId });
    },
    [config]
  );

  const startBridge = useCallback(
    async (amount: string, fromChain: BridgeChainKey, toChain: BridgeChainKey) => {
      if (!address || !walletClient) {
        setError("Wallet not connected");
        return;
      }

      const from = BRIDGE_CHAINS[fromChain];
      const to = BRIDGE_CHAINS[toChain];
      const parsedAmount = parseUnits(amount, 6); // USDC = 6 decimals

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

        // Get chain-specific public client AFTER chain switch
        const sourceClient = getClient(from.chainId);
        if (!sourceClient) {
          throw new Error(`No public client available for chain ${from.chainId}`);
        }

        // Step 1: Approve USDC
        setStatus("approving");
        updateTx({ status: "approving" });

        const approveHash = await walletClient.writeContract({
          address: from.usdc,
          abi: ERC20_APPROVE_ABI,
          functionName: "approve",
          args: [from.tokenMessenger, parsedAmount],
          chain: walletClient.chain,
          account: address,
        });
        await sourceClient.waitForTransactionReceipt({ hash: approveHash });

        // Step 2: Burn via depositForBurn
        setStatus("burning");
        updateTx({ status: "burning" });

        const mintRecipient = addressToBytes32(address);
        const burnHash = await walletClient.writeContract({
          address: from.tokenMessenger,
          abi: TOKEN_MESSENGER_ABI,
          functionName: "depositForBurn",
          args: [parsedAmount, to.domain, mintRecipient, from.usdc],
          chain: walletClient.chain,
          account: address,
        });

        const burnReceipt = await sourceClient.waitForTransactionReceipt({ hash: burnHash });

        // Extract MessageSent event
        let messageBytes: `0x${string}` | undefined;
        for (const log of burnReceipt.logs) {
          try {
            const decoded: any = decodeEventLog({
              abi: MESSAGE_SENT_EVENT_ABI,
              data: log.data,
              topics: (log as any).topics ?? [],
            });
            if (decoded.eventName === "MessageSent") {
              messageBytes = decoded.args.message as `0x${string}`;
              break;
            }
          } catch {
            // Not this event, skip
          }
        }

        // Fallback: if decodeEventLog didn't match, try to find the MessageSent
        // event by its topic signature and extract the raw data
        if (!messageBytes) {
          const MESSAGE_SENT_TOPIC = keccak256(
            new TextEncoder().encode("MessageSent(bytes)") as unknown as Uint8Array
          );
          for (const log of burnReceipt.logs) {
            const topics = (log as any).topics ?? [];
            if (topics[0]?.toLowerCase() === MESSAGE_SENT_TOPIC.toLowerCase()) {
              // The message is ABI-encoded as bytes in log.data
              // bytes is encoded as: offset (32 bytes) + length (32 bytes) + data
              const data = log.data as `0x${string}`;
              if (data && data.length > 2) {
                try {
                  // Skip the offset (first 32 bytes = 64 hex chars) and length (next 32 bytes)
                  const offsetHex = data.slice(2, 66);
                  const offset = parseInt(offsetHex, 16) * 2; // convert to hex char offset
                  const lengthHex = data.slice(2 + offset, 2 + offset + 64);
                  const length = parseInt(lengthHex, 16) * 2; // bytes to hex chars
                  const messageHex = data.slice(2 + offset + 64, 2 + offset + 64 + length);
                  messageBytes = `0x${messageHex}` as `0x${string}`;
                } catch {
                  // manual parsing failed
                }
              }
              break;
            }
          }
        }

        if (!messageBytes) {
          // Log details for debugging
          console.error("Burn receipt logs:", JSON.stringify(burnReceipt.logs, null, 2));
          throw new Error("Failed to extract message from burn transaction");
        }

        const msgHash = keccak256(messageBytes);

        setStatus("waiting_attestation");
        updateTx({
          status: "waiting_attestation",
          burnTxHash: burnHash,
          messageBytes: messageBytes,
          messageHash: msgHash,
        });
      } catch (err: any) {
        const msg = err?.shortMessage || err?.message || "Bridge failed";
        setStatus("failed");
        setError(msg);
        updateTx({ status: "failed", error: msg });
      }
    },
    [address, walletClient, ensureChain, updateTx, getClient]
  );

  const completeMint = useCallback(async () => {
    if (!bridgeTx || !walletClient || !attestation.attestation || !bridgeTx.messageBytes) {
      return;
    }

    const to = BRIDGE_CHAINS[bridgeTx.toChain];

    try {
      await ensureChain(to.chainId);

      const destClient = getClient(to.chainId);
      if (!destClient) {
        throw new Error(`No public client available for chain ${to.chainId}`);
      }

      setStatus("minting");
      updateTx({ status: "minting" });

      const mintHash = await walletClient.writeContract({
        address: to.messageTransmitter,
        abi: MESSAGE_TRANSMITTER_ABI,
        functionName: "receiveMessage",
        args: [bridgeTx.messageBytes as `0x${string}`, attestation.attestation as `0x${string}`],
        chain: walletClient.chain,
        account: address!,
      });

      await destClient.waitForTransactionReceipt({ hash: mintHash });

      setStatus("complete");
      updateTx({ status: "complete", mintTxHash: mintHash, attestation: attestation.attestation });
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || "Mint failed";
      setStatus("failed");
      setError(msg);
      updateTx({ status: "failed", error: msg });
    }
  }, [bridgeTx, walletClient, attestation.attestation, ensureChain, updateTx, getClient, address]);

  const reset = useCallback(() => {
    setBridgeTx(null);
    setStatus("idle");
    setError(null);
  }, []);

  // Resume a pending transaction
  const resumeBridge = useCallback((tx: BridgeTransaction) => {
    setBridgeTx(tx);
    setStatus(tx.status);
    setError(tx.error || null);
  }, []);

  return {
    status,
    error,
    bridgeTx,
    attestation,
    startBridge,
    completeMint,
    reset,
    resumeBridge,
  };
}