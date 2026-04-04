import { useState, useEffect } from "react";
import { ArrowDownUp, Settings, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { TOKENS } from "@/config/wagmi";
import { useTokenBalances } from "@/hooks/useTokenBalance";
import { useSwap } from "@/hooks/useSwap";
import { TokenSelector } from "@/components/TokenSelector";
import { TransactionModal, computeTxStage } from "@/components/TransactionModal";
import { SectionHistory } from "@/components/SectionHistory";
import { useSectionHistory } from "@/hooks/useSectionHistory";
import BackButton from "@/components/BackButton";
import { hasInsufficientTokenBalance, parseTokenAmount } from "@/lib/tokenAmounts";

const tokenList = Object.values(TOKENS);
const slippageOptions = ["0.1", "0.5", "1.0"];
const SWAP_COLUMNS = [
  { key: "sold", label: "Sold" },
  { key: "bought", label: "Bought" },
  { key: "amountIn", label: "Amount In" },
  { key: "amountOut", label: "Amount Out" },
];

const Swap = () => {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const balances = useTokenBalances();
  const history = useSectionHistory("swap");

  const [fromToken, setFromToken] = useState(tokenList[0]);
  const [toToken, setToToken] = useState(tokenList[1]);
  const [fromAmount, setFromAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [showSlippage, setShowSlippage] = useState(false);

  const swap = useSwap({ fromSymbol: fromToken.symbol, toSymbol: toToken.symbol, amount: fromAmount, slippage });

  useEffect(() => {
    if (swap.isConfirmed && swap.swapTxHash) {
      history.addTx({
        txHash: swap.swapTxHash,
        type: "swap",
        data: { sold: fromToken.symbol, bought: toToken.symbol, amountIn: fromAmount, amountOut: swap.outputAmount.toFixed(2) },
      });
    }
  }, [swap.isConfirmed, swap.swapTxHash]);

  const txStage = computeTxStage({
    approveError: swap.approveError, actionError: swap.swapError, isConfirmed: swap.isConfirmed,
    isActionPending: swap.isSwapPending, actionTxHash: swap.swapTxHash, isActionConfirming: swap.isSwapConfirming,
    isApprovePending: swap.isApprovePending, approveTxHash: swap.approveTxHash, isApproveConfirming: swap.isApproveConfirming,
  });

  const handleModalClose = () => {
    const wasSuccess = swap.isConfirmed;
    swap.resetAll();
    if (wasSuccess) { setFromAmount(""); balances.USDC.refetch(); balances.EURC.refetch(); }
  };

  const toAmountFormatted = swap.outputAmount > 0 ? swap.outputAmount.toFixed(2) : "";
  const minReceived = swap.outputAmount > 0 ? (swap.outputAmount * (1 - parseFloat(slippage) / 100)).toFixed(2) : "0.00";

  const flipTokens = () => { setFromToken(toToken); setToToken(fromToken); setFromAmount(""); };

  const bal = balances[fromToken.symbol as keyof typeof balances];
  const parsedFromAmount = parseTokenAmount(fromAmount, fromToken.decimals);
  const hasInsufficientBalance = hasInsufficientTokenBalance(fromAmount, bal?.balance);

  const getButtonText = () => {
    if (!isConnected) return "CONNECT WALLET";
    if (!fromAmount || parsedFromAmount <= 0n) return "ENTER AN AMOUNT";
    if (hasInsufficientBalance) return "INSUFFICIENT BALANCE";
    if (swap.isApproving) return "APPROVING...";
    if (swap.isBusy) return "SWAPPING...";
    if (swap.needsApproval) return `APPROVE ${fromToken.symbol}`;
    return "SWAP";
  };

  const handleClick = () => {
    if (!isConnected && openConnectModal) { openConnectModal(); return; }
    if (fromAmount && parsedFromAmount > 0n && !hasInsufficientBalance) swap.executeSwap();
  };

  const impactColor = swap.priceImpact < 0.1 ? "text-green" : swap.priceImpact < 1 ? "text-yellow-400" : "text-destructive";

  return (
    <div className="container max-w-lg mx-auto py-16">
      <BackButton />
      {isConnected && (
        <div className="grid grid-cols-2 gap-px bg-border mb-6">
          <div className="p-4 bg-card">
            <p className="text-xs text-muted-foreground tracking-wider">USDC BALANCE</p>
            <p className="text-sm font-bold font-mono">{balances.USDC.formatted}</p>
          </div>
          <div className="p-4 bg-card">
            <p className="text-xs text-muted-foreground tracking-wider">EURC BALANCE</p>
            <p className="text-sm font-bold font-mono">{balances.EURC.formatted}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold uppercase tracking-tight">Swap</h1>
        <button onClick={() => setShowSlippage(!showSlippage)} className="text-muted-foreground hover:text-foreground transition-colors">
          <Settings className="h-5 w-5" />
        </button>
      </div>

      {showSlippage && (
        <div className="mb-4 p-4 border border-border bg-card">
          <p className="text-xs text-muted-foreground mb-2 tracking-wider uppercase">Slippage Tolerance</p>
          <div className="flex gap-2">
            {slippageOptions.map((opt) => (
              <button key={opt} onClick={() => setSlippage(opt)} className={`px-3 py-1.5 text-sm border transition-colors ${slippage === opt ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>{opt}%</button>
            ))}
            <input type="text" placeholder="Custom" className="w-20 px-3 py-1.5 text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground" onChange={(e) => setSlippage(e.target.value)} />
          </div>
        </div>
      )}

      <div className="border border-border bg-card overflow-visible">
        <div className="p-5">
          <p className="text-xs text-muted-foreground mb-3 tracking-wider uppercase">You Pay</p>
          <div className="flex items-center gap-3">
            <input type="number" placeholder="0.00" value={fromAmount} onChange={(e) => setFromAmount(e.target.value)} disabled={!isConnected}
              className="flex-1 bg-transparent text-2xl font-bold text-foreground outline-none placeholder:text-muted-foreground/30 font-mono disabled:opacity-50 min-w-0" />
            <TokenSelector selected={fromToken} onSelect={(t) => { if (t.symbol === toToken.symbol) setToToken(fromToken); setFromToken(t); }} />
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground font-mono">Balance: {bal?.isLoading ? "..." : bal?.formatted ?? "0.00"}</p>
            {isConnected && <button onClick={() => setFromAmount(bal?.balance?.formatted ?? "")} className="text-[10px] text-primary font-semibold uppercase tracking-wider hover:underline">Max</button>}
          </div>
        </div>

        <div className="flex justify-center -my-4 relative z-10">
          <button onClick={flipTokens} className="h-9 w-9 border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all hover:rotate-180 duration-300">
            <ArrowDownUp className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 bg-muted/20">
          <p className="text-xs text-muted-foreground mb-3 tracking-wider uppercase">You Receive</p>
          <div className="flex items-center gap-3">
            <input type="text" placeholder="0.00" value={toAmountFormatted} readOnly className="flex-1 bg-transparent text-3xl font-bold text-foreground outline-none placeholder:text-muted-foreground/30 font-mono min-w-0" />
            <TokenSelector selected={toToken} onSelect={(t) => { if (t.symbol === fromToken.symbol) setFromToken(toToken); setToToken(t); }} />
          </div>
        </div>
      </div>

      {fromAmount && swap.outputAmount > 0 && (
        <div className="mt-3 p-4 border border-border bg-card text-sm space-y-2">
          <div className="flex justify-between"><span className="text-muted-foreground text-xs uppercase tracking-wider">Rate</span><span className="text-foreground font-mono text-xs">1 {fromToken.symbol} = {swap.spotRate.toFixed(4)} {toToken.symbol}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground text-xs uppercase tracking-wider">Price Impact</span><span className={`font-mono text-xs ${impactColor}`}>{swap.priceImpact.toFixed(4)}%</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground text-xs uppercase tracking-wider">Min Received</span><span className="text-foreground font-mono text-xs">{minReceived} {toToken.symbol}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground text-xs uppercase tracking-wider">Slippage</span><span className="text-foreground font-mono text-xs">{slippage}%</span></div>
        </div>
      )}

      <Button className="w-full mt-4 h-12 text-sm font-semibold tracking-wider uppercase bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleClick} disabled={swap.isBusy || hasInsufficientBalance || parsedFromAmount <= 0n}>
        {swap.isBusy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {getButtonText()}
      </Button>

      <div className="mt-8 border border-border bg-card p-5">
        <h3 className="text-xs font-semibold tracking-wider uppercase mb-4">Swap History</h3>
        <SectionHistory transactions={history.transactions} columns={SWAP_COLUMNS} section="swap" />
      </div>

      <TransactionModal stage={txStage} approveLabel={`Approve ${fromAmount} ${fromToken.symbol}`}
        actionLabel={`Swap ${fromAmount} ${fromToken.symbol} → ${toToken.symbol}`}
        successSummary={`Swapped ${fromAmount} ${fromToken.symbol} → ${swap.outputAmount.toFixed(2)} ${toToken.symbol}`}
        txHash={swap.swapTxHash || swap.approveTxHash} errorMessage={(swap.swapError || swap.approveError)?.message}
        onClose={handleModalClose} onRetry={() => swap.resetAll()} />
    </div>
  );
};

export default Swap;
