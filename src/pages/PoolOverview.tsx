import { Link } from "react-router-dom";
import { Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "wagmi";
import { usePoolData } from "@/hooks/usePoolData";
import { SectionHistory } from "@/components/SectionHistory";
import { useSectionHistory } from "@/hooks/useSectionHistory";
import EmptyState from "@/components/EmptyState";
import BackButton from "@/components/BackButton";

const POOL_COLUMNS = [
  { key: "action", label: "Action" },
  { key: "usdcAmount", label: "USDC" },
  { key: "eurcAmount", label: "EURC" },
  { key: "lpTokens", label: "LP Tokens" },
];

const PoolOverview = () => {
  const { isConnected } = useAccount();
  const pool = usePoolData();
  const history = useSectionHistory("pool");
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const hasPoolPosition = pool.lpBalanceRaw > 0n;
  const userUsdcValue = pool.lpTotalSupply > 0 ? (pool.lpBalance / pool.lpTotalSupply) * pool.usdcReserve : 0;
  const userEurcValue = pool.lpTotalSupply > 0 ? (pool.lpBalance / pool.lpTotalSupply) * pool.eurcReserve : 0;

  return (
    <div className="container max-w-2xl mx-auto py-16">
      <BackButton />
      <h1 className="text-3xl font-bold uppercase tracking-tight mb-8">Pool</h1>

      {isConnected && pool.isLpBalanceLoading && (
        <div className="mb-4 border border-border bg-card p-6">
          <p className="text-xs text-muted-foreground tracking-wider uppercase">Loading your pool position...</p>
        </div>
      )}

      {isConnected && !pool.isLpBalanceLoading && hasPoolPosition && (
        <div className="border border-border bg-card p-6 mb-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-semibold tracking-wider uppercase text-primary">Your Position</h3>
            <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-[10px] font-bold tracking-wider uppercase">Auto-Accruing Fees</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border">
            <div className="p-4 bg-background"><p className="text-xs text-muted-foreground tracking-wider">LP TOKENS</p><p className="text-sm font-bold font-mono">{pool.lpBalance.toFixed(4)}</p></div>
            <div className="p-4 bg-background"><p className="text-xs text-muted-foreground tracking-wider">USDC VALUE</p><p className="text-sm font-bold font-mono">{fmt(userUsdcValue)}</p></div>
            <div className="p-4 bg-background"><p className="text-xs text-muted-foreground tracking-wider">EURC VALUE</p><p className="text-sm font-bold font-mono">{fmt(userEurcValue)}</p></div>
            <div className="p-4 bg-background"><p className="text-xs text-muted-foreground tracking-wider">POOL SHARE</p><p className="text-sm font-bold font-mono">{pool.poolShare.toFixed(4)}%</p></div>
            <div className="p-4 bg-background"><p className="text-xs text-muted-foreground tracking-wider">FEES</p><p className="text-sm font-bold font-mono text-green-500">Auto-Compounding</p></div>
          </div>
        </div>
      )}

      {isConnected && !pool.isLpBalanceLoading && !hasPoolPosition && (
        <div className="mb-4 border border-border bg-card">
          <EmptyState variant="pool" title="No active pool position" description="Deposit USDC and EURC to earn swap fees." action={<Link to="/pool/add"><Button size="sm" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold tracking-wider uppercase"><Plus className="h-3.5 w-3.5" /> Add Liquidity</Button></Link>} />
        </div>
      )}

      {!isConnected && (
        <div className="mb-4 border border-border bg-card">
          <EmptyState variant="deposits" title="Wallet not connected" description="Connect your wallet to see your liquidity position." />
        </div>
      )}

      <div className="border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold uppercase tracking-wider">USDC / EURC</h2>
            <p className="text-xs text-muted-foreground tracking-wider uppercase">LunexSwapPool · Fee: {pool.feePercent}%</p>
          </div>
          <div className="flex gap-2">
            <Link to="/pool/add"><Button size="sm" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold tracking-wider uppercase"><Plus className="h-3.5 w-3.5" /> Add</Button></Link>
            <Link to="/pool/remove"><Button size="sm" variant="outline" className="gap-1.5 border-border text-xs font-semibold tracking-wider uppercase"><Minus className="h-3.5 w-3.5" /> Remove</Button></Link>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
          {[
            { label: "USDC RESERVE", value: fmt(pool.usdcReserve) },
            { label: "EURC RESERVE", value: fmt(pool.eurcReserve) },
            { label: "TOTAL LIQUIDITY", value: `$${fmt(pool.totalLiquidity)}` },
            { label: "LP SUPPLY", value: pool.lpTotalSupply.toFixed(2) },
          ].map((stat) => (
            <div key={stat.label} className="p-4 bg-background">
              <p className="text-xs text-muted-foreground mb-1 tracking-wider">{stat.label}</p>
              <p className="text-sm font-bold text-foreground font-mono">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 border border-border bg-card p-5">
        <h3 className="text-xs font-semibold tracking-wider uppercase mb-4">Pool History</h3>
        <SectionHistory transactions={history.transactions} columns={POOL_COLUMNS} section="pool" />
      </div>
    </div>
  );
};

export default PoolOverview;
