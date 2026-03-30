import { useState, useEffect } from "react";
import { Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useBridge } from "@/features/bridge/hooks/useBridge";
import { useBridgeBalance } from "@/features/bridge/hooks/useBridgeBalance";
import { ChainSelector } from "@/features/bridge/components/ChainSelector";
import { BridgeProgress } from "@/features/bridge/components/BridgeProgress";
import { BridgeHistory } from "@/features/bridge/components/BridgeHistory";
import { getPendingBridgeTransactions } from "@/features/bridge/state/bridgeState";
import type { BridgeChainKey } from "@/features/bridge/config/bridgeConfig";
import BackButton from "@/components/BackButton";

const Bridge = () => {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const bridge = useBridge();

  const [fromChain, setFromChain] = useState<BridgeChainKey>("base");
  const [toChain, setToChain] = useState<BridgeChainKey>("arc");
  const [amount, setAmount] = useState("");

  const { formatted: sourceBalance, isLoading: balanceLoading } =
    useBridgeBalance(fromChain);

  // Check for resumable transactions on mount
  useEffect(() => {
    const pending = getPendingBridgeTransactions();
    if (pending.length > 0) {
      bridge.resumeBridge(pending[0]);
    }
  }, []);

  const handleSwapChains = () => {
    setFromChain(toChain);
    setToChain(fromChain);
  };

  const handleFromChange = (chain: BridgeChainKey) => {
    setFromChain(chain);
    if (chain === toChain) {
      setToChain(fromChain);
    }
  };

  const handleToChange = (chain: BridgeChainKey) => {
    setToChain(chain);
    if (chain === fromChain) {
      setFromChain(toChain);
    }
  };

  const handleBridge = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    bridge.startBridge(amount, fromChain, toChain);
  };

  const isActive = bridge.status !== "idle";
  const isProcessing =
    bridge.status === "approving" ||
    bridge.status === "burning" ||
    bridge.status === "minting";

  return (
    <div className="container max-w-lg mx-auto py-16 px-4">
      <BackButton />
      <h1 className="text-3xl font-bold uppercase tracking-tight mb-1">Bridge</h1>
      <p className="text-xs text-muted-foreground mb-8 tracking-wider">
        Bridge USDC across chains via Circle CCTP
      </p>

      {/* Bridge form */}
      {!isActive && (
        <div className="border border-border bg-card p-6 space-y-6">
          <ChainSelector
            fromChain={fromChain}
            toChain={toChain}
            onFromChange={handleFromChange}
            onToChange={handleToChange}
            onSwap={handleSwapChains}
          />

          {/* Balance display */}
          {isConnected && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 border border-border">
              <Wallet className="h-3.5 w-3.5" />
              <span>Balance:</span>
              {balanceLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <span className="font-mono text-foreground font-semibold">
                  {sourceBalance} USDC
                </span>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Amount (USDC)
            </label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-background border-border text-lg font-mono h-12"
              min="0"
              step="0.01"
            />
          </div>

          <div className="border-t border-border pt-4 space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Bridge Fee</span>
              <span className="text-foreground">Free (CCTP)</span>
            </div>
            <div className="flex justify-between">
              <span>Estimated Time</span>
              <span className="text-foreground">5-20 min</span>
            </div>
          </div>

          {!isConnected ? (
            <Button
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold uppercase tracking-wider h-11"
              onClick={openConnectModal}
            >
              Connect Wallet
            </Button>
          ) : (
            <Button
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold uppercase tracking-wider h-11"
              onClick={handleBridge}
              disabled={!amount || parseFloat(amount) <= 0}
            >
              Bridge USDC
            </Button>
          )}
        </div>
      )}

      {/* Progress UI */}
      {isActive && bridge.bridgeTx && (
        <BridgeProgress
          status={bridge.status}
          burnTxHash={bridge.bridgeTx.burnTxHash}
          mintTxHash={bridge.bridgeTx.mintTxHash}
          fromChain={bridge.bridgeTx.fromChain}
          toChain={bridge.bridgeTx.toChain}
          error={bridge.error}
          onRetry={() => bridge.startBridge(amount, fromChain, toChain)}
          onReset={bridge.reset}
          onMint={bridge.completeMint}
          attestationReady={bridge.attestation.status === "complete"}
        />
      )}

      {/* Processing overlay */}
      {isProcessing && (
        <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>
            {bridge.status === "approving" && "Approving USDC..."}
            {bridge.status === "burning" && "Burning USDC on source chain..."}
            {bridge.status === "minting" && "Minting USDC on destination..."}
          </span>
        </div>
      )}

      {/* Bridge History */}
      {!isActive && (
        <BridgeHistory onResume={(tx) => bridge.resumeBridge(tx)} />
      )}
    </div>
  );
};

export default Bridge;
