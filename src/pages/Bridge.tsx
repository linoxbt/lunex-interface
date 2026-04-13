import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Wallet, ArrowRight } from "lucide-react";
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
import { hasInsufficientRawBalance, parseTokenAmount } from "@/lib/tokenAmounts";

const Bridge = () => {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const bridge = useBridge();

  const [fromChain, setFromChain] = useState<BridgeChainKey>("base");
  const [toChain, setToChain] = useState<BridgeChainKey>("arc");
  const [amount, setAmount] = useState("");
  const [activeTab, setActiveTab] = useState("bridge");

  const { balance: sourceBalanceRaw, formatted: sourceBalance, decimals: sourceDecimals, isLoading: balanceLoading } =
    useBridgeBalance(fromChain);

  // Auto-resume pending transactions on mount
  useEffect(() => {
    const pending = getPendingBridgeTransactions();
    if (pending.length > 0 && bridge.status === "idle") {
      bridge.resumeBridge(pending[0]);
    }
  }, []);

  const handleSwapChains = () => {
    setFromChain(toChain);
    setToChain(fromChain);
  };

  const handleFromChange = (chain: BridgeChainKey) => {
    setFromChain(chain);
    if (chain === toChain) setToChain(fromChain);
  };

  const handleToChange = (chain: BridgeChainKey) => {
    setToChain(chain);
    if (chain === fromChain) setFromChain(toChain);
  };

  const parsedAmount = parseTokenAmount(amount, sourceDecimals);
  const insufficientBalance = hasInsufficientRawBalance(amount, sourceBalanceRaw, sourceDecimals);
  const sameChain = fromChain === toChain;

  const handleBridge = () => {
    if (!amount || parsedAmount <= 0n || insufficientBalance || sameChain) return;
    bridge.startBridge(amount, fromChain, toChain);
  };

  const isActive = bridge.status !== "idle";
  const isProcessing =
    bridge.status === "approving" ||
    bridge.status === "burning" ||
    bridge.status === "minting";

  // CCTP is 1:1 for USDC, no fee
  const receiveAmount = amount && parseFloat(amount) > 0 ? parseFloat(amount).toFixed(2) : "";


  return (
    <div className="container max-w-lg mx-auto py-16 px-4">
      <div className="mb-8">
        <BackButton />
        <h1 className="text-3xl font-bold tracking-tight mt-6 uppercase">Cross-Chain Bridge</h1>
        <p className="text-muted-foreground text-sm font-mono mt-1">Native USDC liquidity routing via Circle CCTP</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
        <TabsList className="grid w-full grid-cols-2 mb-8 bg-muted/20 border border-border p-1 rounded-sm">
          <TabsTrigger value="bridge" className="text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-sm transition-all h-10">Transfer Assets</TabsTrigger>
          <TabsTrigger value="history" className="text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-sm transition-all h-10">History & Recovery</TabsTrigger>
        </TabsList>

        <TabsContent value="bridge" className="mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="border border-border bg-card rounded-sm shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border bg-muted/20">
               <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Standardized Protocol Swap</p>
            </div>
            
            <div className="p-8 space-y-8">
              <ChainSelector
                fromChain={fromChain}
                toChain={toChain}
                onFromChange={handleFromChange}
                onToChange={handleToChange}
                onSwap={handleSwapChains}
              />

              {isConnected && (
                <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border border-primary/20 rounded-sm">
                  <div className="flex items-center gap-3">
                     <Wallet className="h-4 w-4 text-primary" />
                     <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Source Balance</span>
                  </div>
                  {balanceLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  ) : (
                    <span className="font-mono text-xs font-bold text-primary">
                      {sourceBalance} USDC
                    </span>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Asset Quantity
                  </label>
                  {isConnected && (
                    <button
                      onClick={() => setAmount(sourceBalance)}
                      className="text-[10px] text-primary font-bold uppercase tracking-widest hover:underline"
                    >
                      Use Maximum
                    </button>
                  )}
                </div>
                <div className="relative group">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-muted/10 border-border text-2xl font-bold font-mono h-16 rounded-sm focus-visible:ring-primary pl-4"
                    min="0"
                    step="0.01"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold font-mono text-muted-foreground">USDC</div>
                </div>
              </div>

              {receiveAmount && (
                <div className="flex items-center gap-4 p-5 border border-border bg-muted/10 rounded-sm">
                  <ArrowRight className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Destination Receipt</p>
                    <p className="text-xl font-bold font-mono text-foreground mt-1">{receiveAmount} USDC</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 pt-4 border-t border-border">
                {[
                   { label: "Bridge Fee", val: "0.00 (Standard)", color: "text-foreground" },
                   { label: "Execution Model", val: "Circle CCTP Native", color: "text-foreground" },
                   { label: "Estimated Settlement", val: "5-15 Minutes", color: "text-foreground" },
                ].map((item, i) => (
                   <div key={i} className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className={item.color}>{item.val}</span>
                   </div>
                ))}
              </div>

              {!isConnected ? (
                <Button
                  className="w-full h-14 bg-primary text-primary-foreground font-bold uppercase tracking-[0.2em] text-sm shadow-sm active:scale-[0.98] transition-all"
                  onClick={openConnectModal}
                >
                  Connect Wallet
                </Button>
              ) : (
                <Button
                  className="w-full h-14 bg-primary text-primary-foreground font-bold uppercase tracking-[0.2em] text-sm shadow-sm active:scale-[0.98] transition-all"
                  onClick={handleBridge}
                  disabled={!amount || parsedAmount <= 0n || insufficientBalance || isProcessing || sameChain}
                >
                  {isProcessing ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-3" /> Processing Protocol Flow...</>
                  ) : sameChain ? (
                    "Select Target Chain"
                  ) : insufficientBalance ? (
                    "Insufficient Liquidity"
                  ) : (
                    "Initialize Bridge transfer"
                  )}
                </Button>
              )}
            </div>
          </div>

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
        </TabsContent>

        <TabsContent value="history" className="mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-card border border-border rounded-sm shadow-sm overflow-hidden">
             <BridgeHistory
               onResume={(tx) => {
                 bridge.resumeBridge(tx);
                 setActiveTab("bridge");
                 if (tx.status === "waiting_attestation" || tx.status === "burning" || tx.status === "failed") {
                   bridge.completeMint();
                 }
               }}
             />
          </div>
        </TabsContent>
      </Tabs>
      </div>
    );
};

export default Bridge;
