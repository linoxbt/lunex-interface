import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { formatUnits } from "viem";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useRemoveLiquidity } from "@/hooks/useLiquidity";
import { usePoolData } from "@/hooks/usePoolData";
import { TransactionModal, computeTxStage } from "@/components/TransactionModal";
import { useSectionHistory } from "@/hooks/useSectionHistory";
import BackButton from "@/components/BackButton";

const RemoveLiquidity = () => {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const pool = usePoolData();
  const history = useSectionHistory("pool");
  const [percentage, setPercentage] = useState([100]);
  const [mode, setMode] = useState<"both" | "usdc" | "eurc">("both");

  const lpToRemoveRaw = (pool.lpBalanceRaw * BigInt(percentage[0])) / 100n;
  const lpToRemoveStr = formatUnits(lpToRemoveRaw, 18);
  const lpToRemove = parseFloat(lpToRemoveStr);
  const shareOfPool = pool.lpTotalSupply > 0 ? lpToRemove / pool.lpTotalSupply : 0;
  const usdcOut = mode === "eurc" ? 0 : pool.usdcReserve * shareOfPool * (mode === "both" ? 1 : 2);
  const eurcOut = mode === "usdc" ? 0 : pool.eurcReserve * shareOfPool * (mode === "both" ? 1 : 2);

  const liq = useRemoveLiquidity(lpToRemoveRaw, lpToRemoveStr, mode);

  useEffect(() => {
    if (liq.isConfirmed && liq.actionTxHash) {
      history.addTx({
        txHash: liq.actionTxHash,
        type: "remove_liquidity",
        data: {
          action: "Remove",
          usdcAmount: usdcOut.toFixed(2),
          eurcAmount: eurcOut.toFixed(2),
          lpTokens: lpToRemove.toFixed(4),
        },
      });
    }
  }, [liq.isConfirmed, liq.actionTxHash, history, usdcOut, eurcOut, lpToRemove]);

  useEffect(() => {
    if (liq.isConfirmed) pool.refetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liq.isConfirmed]);

  const txStage = computeTxStage({
    approveError: liq.approveError,
    actionError: liq.error,
    isConfirmed: liq.isConfirmed,
    isActionPending: liq.isActionPending,
    actionTxHash: liq.actionTxHash,
    isActionConfirming: liq.isActionConfirming,
    isApprovePending: liq.isApprovePending,
    approveTxHash: liq.approveTxHash,
    isApproveConfirming: liq.isApproveConfirming,
  });

  const handleModalClose = () => {
    const wasSuccess = liq.isConfirmed;
    liq.resetAll();
    if (wasSuccess) {
      setPercentage([0]);
      pool.refetchAll();
    }
  };

  const getButtonText = () => {
    if (!isConnected) return "CONNECT WALLET";
    if (pool.lpBalanceRaw <= 0n) return "NO LP TOKENS";
    if (percentage[0] === 0) return "SELECT AMOUNT";
    if (liq.isApproving) return "APPROVING LP...";
    if (liq.isBusy) return "REMOVING...";
    return "REMOVE LIQUIDITY";
  };

  const handleClick = () => {
    if (!isConnected && openConnectModal) {
      openConnectModal();
      return;
    }
    if (percentage[0] > 0 && lpToRemoveRaw > 0n) liq.execute();
  };

  return (
    <div className="container max-w-md mx-auto py-16">
      <BackButton />
      <h1 className="text-2xl font-bold uppercase tracking-tight mb-8">Remove Liquidity</h1>
      <div className="border border-border bg-card p-6 space-y-6">
        <div>
          <div className="flex justify-between text-sm mb-2"><span className="text-muted-foreground text-xs uppercase tracking-wider">Your LP Balance</span><span className="text-foreground font-mono text-xs">{pool.lpBalance.toFixed(4)}</span></div>
          <div className="flex justify-between text-sm mb-4"><span className="text-muted-foreground text-xs uppercase tracking-wider">Amount to remove</span><span className="text-foreground font-bold text-3xl font-mono">{percentage[0]}%</span></div>
          <Slider value={percentage} onValueChange={setPercentage} max={100} step={1} className="mb-4" />
          <div className="flex gap-px bg-border">
            {[25, 50, 75, 100].map((v) => (
              <button key={v} onClick={() => setPercentage([v])} className={`flex-1 py-2 text-xs font-semibold tracking-wider transition-colors ${percentage[0] === v ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}>{v === 100 ? "MAX" : `${v}%`}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-2 tracking-wider uppercase">Withdrawal mode</p>
          <div className="flex gap-px bg-border">
            {([{ key: "both", label: "BOTH" }, { key: "usdc", label: "USDC ONLY" }, { key: "eurc", label: "EURC ONLY" }] as const).map(({ key, label }) => (
              <button key={key} onClick={() => setMode(key)} className={`flex-1 py-2.5 text-xs font-semibold tracking-wider transition-colors ${mode === key ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}>{label}</button>
            ))}
          </div>
        </div>
        <div className="p-4 border border-border space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground text-xs uppercase tracking-wider">LP to Burn</span><span className="text-foreground font-mono">{lpToRemove.toFixed(4)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground text-xs uppercase tracking-wider">USDC Out (est.)</span><span className="text-foreground font-mono">{usdcOut.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground text-xs uppercase tracking-wider">EURC Out (est.)</span><span className="text-foreground font-mono">{eurcOut.toFixed(2)}</span></div>
        </div>
        <Button className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold tracking-wider uppercase" onClick={handleClick} disabled={liq.isBusy || lpToRemoveRaw <= 0n}>
          {liq.isBusy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {getButtonText()}
        </Button>
      </div>
      <TransactionModal stage={txStage} approveLabel={`Approve LP tokens`}
        actionLabel={`Remove ${lpToRemove.toFixed(4)} LP tokens`}
        successSummary={`Removed ${lpToRemove.toFixed(4)} LP → ${usdcOut.toFixed(2)} USDC + ${eurcOut.toFixed(2)} EURC`}
        txHash={liq.actionTxHash || liq.approveTxHash} errorMessage={(liq.error || liq.approveError)?.message}
        onClose={handleModalClose} onRetry={() => liq.resetAll()} />
    </div>
  );
};

export default RemoveLiquidity;
