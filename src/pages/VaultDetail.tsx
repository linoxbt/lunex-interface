import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount, useReadContract } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useVaultDeposit, useVaultWithdraw } from "@/hooks/useVault";
import { useVaultData } from "@/hooks/useVaultData";
import { TransactionModal, computeTxStage } from "@/components/TransactionModal";
import { useSectionHistory } from "@/hooks/useSectionHistory";
import { formatUnits, parseUnits } from "viem";
import { vaultAbi } from "@/config/abis";
import { CONTRACTS, arcTestnet } from "@/config/wagmi";
import BackButton from "@/components/BackButton";
import { hasInsufficientRawBalance, hasInsufficientTokenBalance, parseTokenAmount } from "@/lib/tokenAmounts";

const VaultDetail = () => {
  const { token } = useParams<{ token: string }>();
  const isUSDC = token === "usdc";
  const tokenName = (isUSDC ? "USDC" : "EURC") as "USDC" | "EURC";
  const shareName = isUSDC ? "luneUSDC" : "luneEURC";
  const vaultAddress = isUSDC ? CONTRACTS.LUNE_VAULT_USDC : CONTRACTS.LUNE_VAULT_EURC;

  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const balance = useTokenBalance(tokenName);
  const vault = useVaultData(tokenName);
  const history = useSectionHistory("yield");

  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");


  const assetsInputRaw = (() => {
    if (tab !== "withdraw" || !amount) return 0n;
    try {
      return parseUnits(amount, 6);
    } catch {
      return 0n;
    }
  })();

  const { data: convertedSharesRaw } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "convertToShares",
    args: assetsInputRaw > 0n ? [assetsInputRaw] : undefined,
    chainId: arcTestnet.id,
    query: { enabled: tab === "withdraw" && assetsInputRaw > 0n, refetchInterval: 5000 },
  });

  const isUsingMaxWithdraw = tab === "withdraw" && amount && parseFloat(amount || "0") >= vault.userDeposited * 0.999;
  const sharesToRedeemRaw = tab === "withdraw"
    ? isUsingMaxWithdraw
      ? vault.userSharesRaw
      : ((convertedSharesRaw as bigint | undefined) ?? 0n)
    : 0n;

  const depositAmount = tab === "deposit" ? amount : "";
  const withdrawSharesStr = formatUnits(sharesToRedeemRaw, 18);

  const deposit = useVaultDeposit(tokenName, depositAmount);
  const withdraw = useVaultWithdraw(tokenName, sharesToRedeemRaw);
  const active = tab === "deposit" ? deposit : withdraw;

  useEffect(() => {
    if (active.isConfirmed) {
      balance.refetch();
      vault.refetchAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.isConfirmed]);

  useEffect(() => {
    if (active.isConfirmed && active.actionTxHash) {
      history.addTx({
        txHash: active.actionTxHash,
        type: tab,
        data: {
          action: tab === "deposit" ? "Deposit" : "Withdraw",
          token: tokenName,
          amount,
          shares:
            tab === "deposit"
              ? (vault.sharePrice > 0 ? (parseFloat(amount || "0") / vault.sharePrice).toFixed(4) : "0")
              : parseFloat(withdrawSharesStr).toFixed(4),
        },
      });
    }
  }, [active.isConfirmed, active.actionTxHash, tab, tokenName, amount, withdrawSharesStr, vault.sharePrice, history]);

  const txStage = computeTxStage({
    approveError: active.approveError,
    actionError: active.error,
    isConfirmed: active.isConfirmed,
    isActionPending: active.isActionPending,
    actionTxHash: active.actionTxHash,
    isActionConfirming: active.isActionConfirming,
    isApprovePending: active.isApprovePending,
    approveTxHash: active.approveTxHash as string | undefined,
    isApproveConfirming: active.isApproveConfirming,
  });

  const handleModalClose = () => {
    const wasSuccess = active.isConfirmed;
    active.resetAll();
    if (wasSuccess) setAmount("");
  };

  const preview = (() => {
    if (!amount || parseFloat(amount) <= 0) return "0.00";
    if (tab === "deposit") return vault.sharePrice > 0 ? (parseFloat(amount) / vault.sharePrice).toFixed(4) : "0.00";
    return amount;
  })();

  const parsedInputAmount = parseTokenAmount(amount, 6);
  const hasInsufficientDepositBalance = tab === "deposit" && hasInsufficientTokenBalance(amount, balance.balance);
  const hasInsufficientWithdrawBalance = tab === "withdraw" && hasInsufficientRawBalance(amount, vault.userAssetsRaw, 6);
  const hasInsufficientBalance = hasInsufficientDepositBalance || hasInsufficientWithdrawBalance;

  const getButtonText = () => {
    if (!isConnected) return "CONNECT WALLET";
    if (tab === "withdraw" && vault.userSharesRaw <= 0n) return "NO SHARES";
    if (!amount || parsedInputAmount <= 0n) return "ENTER AN AMOUNT";
    if (hasInsufficientDepositBalance) return `INSUFFICIENT ${tokenName}`;
    if (hasInsufficientWithdrawBalance) return "AMOUNT EXCEEDS VAULT POSITION";
    if (active.isApproving) return "APPROVING...";
    if (active.isBusy) return tab === "deposit" ? "DEPOSITING..." : "WITHDRAWING...";
    return tab === "deposit" ? "DEPOSIT" : "WITHDRAW";
  };

  const handleClick = () => {
    if (!isConnected && openConnectModal) {
      openConnectModal();
      return;
    }
    if (!amount || parsedInputAmount <= 0n || hasInsufficientBalance) return;
    if (tab === "withdraw" && sharesToRedeemRaw <= 0n) return;
    active.execute();
  };

  const handleMax = () => {
    if (tab === "deposit" && balance.balance) {
      setAmount(balance.balance.formatted);
    } else if (tab === "withdraw") {
      setAmount(vault.userDeposited.toFixed(6));
    }
  };

  return (
    <div className="container max-w-md mx-auto py-16">
      <BackButton />
      <h1 className="text-2xl font-bold uppercase tracking-tight mb-1">{shareName} Vault</h1>
      <p className="text-xs text-muted-foreground mb-8 tracking-wider uppercase">
        APY: <span className="font-mono">—</span> · Share Price: 1 {shareName} = {vault.sharePrice.toFixed(6)} {tokenName}
      </p>

      {isConnected && vault.userShares > 0 && (
        <div className="border border-border bg-card p-4 mb-6">
          <p className="text-xs text-muted-foreground tracking-wider uppercase mb-2">Your Position</p>
          <p className="text-sm font-mono">{vault.userShares.toFixed(6)} {shareName} = {vault.userDeposited.toFixed(2)} {tokenName}</p>
        </div>
      )}

      <div className="flex gap-px bg-border mb-6">
        {(["deposit", "withdraw"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setAmount("");
            }}
            className={`flex-1 py-2.5 text-xs font-semibold tracking-wider uppercase transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="border border-border bg-card p-6 space-y-4">
        <div className="p-4 bg-muted/20 border border-border">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground text-xs uppercase tracking-wider">{tokenName} Amount</span>
            <button onClick={handleMax} className="text-xs text-primary hover:underline font-mono">
              Max: {tab === "deposit" ? (balance.isLoading ? "..." : balance.formatted) : vault.userDeposited.toFixed(2)}
            </button>
          </div>
          <input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!isConnected}
            className="w-full bg-transparent text-2xl font-bold text-foreground outline-none placeholder:text-muted-foreground/30 font-mono disabled:opacity-50"
          />
        </div>

        {tab === "withdraw" && (
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
            Available to withdraw: {vault.userShares.toFixed(6)} {shareName} = {vault.userDeposited.toFixed(2)} {tokenName}
          </p>
        )}

        <div className="p-4 border border-border space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground text-xs uppercase tracking-wider">{tab === "deposit" ? "You receive" : "Shares to redeem"}</span>
            <span className="font-mono">{tab === "deposit" ? `${preview} ${shareName}` : `${parseFloat(withdrawSharesStr).toFixed(6)} ${shareName}`}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground text-xs uppercase tracking-wider">Share Price</span>
            <span className="font-mono">1 {shareName} = {vault.sharePrice.toFixed(6)} {tokenName}</span>
          </div>
        </div>

        <Button className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 uppercase text-xs font-semibold tracking-wider" onClick={handleClick} disabled={active.isBusy || parsedInputAmount <= 0n || hasInsufficientBalance}>
          {active.isBusy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {getButtonText()}
        </Button>
      </div>

      <TransactionModal
        stage={txStage}
        approveLabel={`Approve ${amount} ${tokenName}`}
        actionLabel={tab === "deposit" ? `Deposit ${amount} ${tokenName}` : `Withdraw ${amount} ${tokenName}`}
        successSummary={tab === "deposit" ? `Deposited ${amount} ${tokenName} → ${preview} ${shareName}` : `Withdrew ${amount} ${tokenName}`}
        txHash={active.actionTxHash || (active.approveTxHash as string | undefined)}
        errorMessage={(active.error || active.approveError)?.message}
        onClose={handleModalClose}
        onRetry={() => active.resetAll()}
      />
    </div>
  );
};

export default VaultDetail;
