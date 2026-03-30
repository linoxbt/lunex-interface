import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useTokenBalances } from "@/hooks/useTokenBalance";
import { useAddLiquidity } from "@/hooks/useLiquidity";
import { usePoolData } from "@/hooks/usePoolData";
import { TransactionModal, computeTxStage } from "@/components/TransactionModal";
import { useSectionHistory } from "@/hooks/useSectionHistory";
import BackButton from "@/components/BackButton";

const AddLiquidity = () => {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const balances = useTokenBalances();
  const pool = usePoolData();
  const history = useSectionHistory("pool");
  const [usdcAmount, setUsdcAmount] = useState("");
  const [eurcAmount, setEurcAmount] = useState("");

  const liq = useAddLiquidity(usdcAmount, eurcAmount);

  useEffect(() => {
    if (liq.isConfirmed && liq.actionTxHash) {
      history.addTx({ txHash: liq.actionTxHash, type: "add_liquidity", data: { action: "Add", usdcAmount: usdcAmount || "0", eurcAmount: eurcAmount || "0", lpTokens: liq.lpPreview.toFixed(4) } });
    }
  }, [liq.isConfirmed, liq.actionTxHash, history, usdcAmount, eurcAmount, liq.lpPreview]);

  useEffect(() => {
    if (liq.isConfirmed) {
      balances.USDC.refetch();
      balances.EURC.refetch();
      pool.refetchAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liq.isConfirmed]);

  const txStage = computeTxStage({
    approveError: liq.usdcApproveError || liq.eurcApproveError, actionError: liq.error, isConfirmed: liq.isConfirmed,
    isActionPending: liq.isActionPending, actionTxHash: liq.actionTxHash, isActionConfirming: liq.isActionConfirming,
    isApprovePending: liq.usdcApprovePending || liq.eurcApprovePending,
    approveTxHash: liq.usdcApproveTxHash || liq.eurcApproveTxHash,
    isApproveConfirming: liq.usdcApproveConfirming || liq.eurcApproveConfirming,
  });

  const handleModalClose = () => {
    const wasSuccess = liq.isConfirmed;
    liq.resetAll();
    if (wasSuccess) {
      setUsdcAmount("");
      setEurcAmount("");
      balances.USDC.refetch();
      balances.EURC.refetch();
      pool.refetchAll();
    }
  };

  const sharePreview = pool.lpTotalSupply > 0 && liq.lpPreview > 0 ? ((liq.lpPreview / (pool.lpTotalSupply + liq.lpPreview)) * 100).toFixed(4) : "0.00";
  const hasAmount = !!(usdcAmount || eurcAmount);

  const getButtonText = () => {
    if (!isConnected) return "CONNECT WALLET";
    if (!hasAmount) return "ENTER AMOUNTS";
    if (liq.isApproving) return "APPROVING...";
    if (liq.isBusy) return "ADDING LIQUIDITY...";
    return "ADD LIQUIDITY";
  };

  const handleClick = () => {
    if (!isConnected && openConnectModal) { openConnectModal(); return; }
    if (hasAmount) liq.execute();
  };

  const tokenFields = [
    { token: "USDC" as const, value: usdcAmount, onChange: setUsdcAmount },
    { token: "EURC" as const, value: eurcAmount, onChange: setEurcAmount },
  ];

  return (
    <div className="container max-w-md mx-auto py-16">
      <BackButton />
      <h1 className="text-3xl font-bold uppercase tracking-tight mb-8">Add Liquidity</h1>
      <div className="border border-border bg-card p-6 space-y-4">
        {tokenFields.map(({ token, value, onChange }) => {
          const bal = balances[token];
          return (
            <div key={token} className="p-4 bg-muted/20 border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground tracking-wider uppercase">{token}</span>
                <button onClick={() => onChange(bal.balance ? bal.balance.formatted : "")} className="text-xs text-primary hover:underline font-mono">Max: {bal.isLoading ? "..." : bal.formatted}</button>
              </div>
              <input type="number" placeholder="0.00" value={value} onChange={(e) => onChange(e.target.value)} disabled={!isConnected} className="w-full bg-transparent text-2xl font-bold text-foreground outline-none placeholder:text-muted-foreground/30 font-mono disabled:opacity-50" />
            </div>
          );
        })}
        <div className="p-4 border border-border space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground text-xs uppercase tracking-wider">LP Tokens Out</span><span className="text-foreground font-mono">{liq.lpPreview.toFixed(4)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground text-xs uppercase tracking-wider">Pool Share</span><span className="text-foreground font-mono">{sharePreview}%</span></div>
        </div>
        <Button className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold tracking-wider uppercase" onClick={handleClick} disabled={liq.isBusy}>
          {liq.isBusy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{getButtonText()}
        </Button>
      </div>
      <TransactionModal stage={txStage}
        approveLabel={liq.usdcApprovePending || liq.usdcApproveConfirming ? `Approve ${usdcAmount} USDC` : `Approve ${eurcAmount} EURC`}
        actionLabel={`Add ${usdcAmount || "0"} USDC + ${eurcAmount || "0"} EURC`}
        successSummary={`Added liquidity → ${liq.lpPreview.toFixed(4)} LP tokens`}
        txHash={liq.actionTxHash || liq.usdcApproveTxHash || liq.eurcApproveTxHash}
        errorMessage={(liq.error || liq.usdcApproveError || liq.eurcApproveError)?.message}
        onClose={handleModalClose} onRetry={() => liq.resetAll()} />
    </div>
  );
};

export default AddLiquidity;
