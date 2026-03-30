import { useAccount } from "wagmi";
import { useTokenBalances } from "@/hooks/useTokenBalance";
import { usePoolData } from "@/hooks/usePoolData";
import { useVaultData } from "@/hooks/useVaultData";
import { Wallet } from "lucide-react";
import { useSectionHistory } from "@/hooks/useSectionHistory";
import { SectionHistory } from "@/components/SectionHistory";
import EmptyState from "@/components/EmptyState";
import BackButton from "@/components/BackButton";

const ACTIVITY_COLUMNS = [
  { key: "action", label: "Action" },
  { key: "detail", label: "Detail" },
];

const Dashboard = () => {
  const { isConnected } = useAccount();
  const balances = useTokenBalances();
  const pool = usePoolData();
  const usdcVault = useVaultData("USDC");
  const eurcVault = useVaultData("EURC");

  const swapHistory = useSectionHistory("swap");
  const poolHistory = useSectionHistory("pool");
  const yieldHistory = useSectionHistory("yield");

  const recentActivity = [...swapHistory.transactions, ...poolHistory.transactions, ...yieldHistory.transactions]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5)
    .map(tx => ({ ...tx, data: { ...tx.data, action: tx.type.replace("_", " ").toUpperCase(), detail: Object.entries(tx.data).filter(([k]) => k !== "action").map(([k, v]) => `${k}: ${v}`).join(", ") } }));

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const hasPoolPosition = pool.lpBalanceRaw > 0n;
  const userUsdcValue = pool.lpTotalSupply > 0 ? (pool.lpBalance / pool.lpTotalSupply) * pool.usdcReserve : 0;
  const userEurcValue = pool.lpTotalSupply > 0 ? (pool.lpBalance / pool.lpTotalSupply) * pool.eurcReserve : 0;

  if (!isConnected) {
    return (
      <div className="container max-w-4xl mx-auto py-16">
        <BackButton />
        <h1 className="text-3xl font-bold uppercase tracking-tight mb-8">Dashboard</h1>
        <div className="border border-border bg-card"><EmptyState variant="deposits" title="Wallet not connected" description="Connect your wallet to view your positions and balances." /></div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-16">
      <BackButton />
      <div className="mb-10">
        <h1 className="text-3xl font-bold uppercase tracking-tight">Dashboard</h1>
        <p className="text-xs text-muted-foreground tracking-wider uppercase mt-1">Lunex Finance | Your Positions</p>
      </div>

      {/* My Balances */}
      <div className="border border-border bg-card p-6 mb-4">
        <div className="flex items-center gap-2 mb-4"><Wallet className="h-4 w-4 text-primary" /><h2 className="text-xs font-semibold tracking-wider uppercase">My Balances</h2></div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border">
          <div className="p-4 bg-background"><p className="text-xs text-muted-foreground">USDC</p><p className="text-sm font-bold font-mono">{balances.USDC.isLoading ? "..." : balances.USDC.formatted}</p></div>
          <div className="p-4 bg-background"><p className="text-xs text-muted-foreground">EURC</p><p className="text-sm font-bold font-mono">{balances.EURC.isLoading ? "..." : balances.EURC.formatted}</p></div>
          <div className="p-4 bg-background"><p className="text-xs text-muted-foreground">LP Tokens</p><p className="text-sm font-bold font-mono">{pool.lpBalance.toFixed(4)}</p></div>
          <div className="p-4 bg-background">
            <p className="text-xs text-muted-foreground">luneUSDC</p>
            <p className="text-sm font-bold font-mono">{usdcVault.userShares.toFixed(4)}</p>
            {usdcVault.userShares > 0 && <p className="text-xs text-muted-foreground font-mono">≈ {fmt(usdcVault.userDeposited)} USDC</p>}
          </div>
          <div className="p-4 bg-background">
            <p className="text-xs text-muted-foreground">luneEURC</p>
            <p className="text-sm font-bold font-mono">{eurcVault.userShares.toFixed(4)}</p>
            {eurcVault.userShares > 0 && <p className="text-xs text-muted-foreground font-mono">≈ {fmt(eurcVault.userDeposited)} EURC</p>}
          </div>
        </div>
      </div>

      {/* My Pool Position */}
      <div className="border border-border bg-card p-6 mb-4">
        <h3 className="text-xs font-semibold tracking-wider uppercase mb-4">My Pool Position</h3>
        {hasPoolPosition ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
            <div className="p-4 bg-background"><p className="text-xs text-muted-foreground">LP Tokens</p><p className="text-sm font-bold font-mono">{pool.lpBalance.toFixed(4)}</p></div>
            <div className="p-4 bg-background"><p className="text-xs text-muted-foreground">USDC Value</p><p className="text-sm font-bold font-mono">{fmt(userUsdcValue)}</p></div>
            <div className="p-4 bg-background"><p className="text-xs text-muted-foreground">EURC Value</p><p className="text-sm font-bold font-mono">{fmt(userEurcValue)}</p></div>
            <div className="p-4 bg-background"><p className="text-xs text-muted-foreground">Pool Share</p><p className="text-sm font-bold font-mono">{pool.poolShare.toFixed(4)}%</p></div>
          </div>
        ) : <p className="text-sm text-muted-foreground">No active pool position</p>}
      </div>

      {/* My Vault Position */}
      <div className="border border-border bg-card p-6 mb-4">
        <h3 className="text-xs font-semibold tracking-wider uppercase mb-4">My Vault Positions</h3>
        {usdcVault.userShares > 0 || eurcVault.userShares > 0 ? (
          <div className="grid md:grid-cols-2 gap-4">
            {usdcVault.userShares > 0 && (
              <div className="p-4 border border-border bg-background space-y-1">
                <p className="text-xs font-semibold">luneUSDC</p>
                <p className="text-sm font-mono">{usdcVault.userShares.toFixed(6)} luneUSDC = {fmt(usdcVault.userDeposited)} USDC</p>
              </div>
            )}
            {eurcVault.userShares > 0 && (
              <div className="p-4 border border-border bg-background space-y-1">
                <p className="text-xs font-semibold">luneEURC</p>
                <p className="text-sm font-mono">{eurcVault.userShares.toFixed(6)} luneEURC = {fmt(eurcVault.userDeposited)} EURC</p>
              </div>
            )}
          </div>
        ) : <p className="text-sm text-muted-foreground">No active vault positions</p>}
      </div>

      {/* Recent Activity */}
      <div className="border border-border bg-card p-6">
        <h3 className="text-xs font-semibold tracking-wider uppercase mb-4">Recent Activity</h3>
        <SectionHistory transactions={recentActivity} columns={ACTIVITY_COLUMNS} section="all" />
      </div>
    </div>
  );
};

export default Dashboard;
