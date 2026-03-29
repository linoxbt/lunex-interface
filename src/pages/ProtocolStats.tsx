import { DollarSign, Droplets, Shield } from "lucide-react";
import { usePoolData } from "@/hooks/usePoolData";
import { useVaultData } from "@/hooks/useVaultData";

const ProtocolStats = () => {
  const pool = usePoolData();
  const usdcVault = useVaultData("USDC");
  const eurcVault = useVaultData("EURC");
  const totalTvl = pool.totalLiquidity + usdcVault.totalAssets + eurcVault.totalAssets;
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="container max-w-3xl mx-auto py-16">
      <h1 className="text-3xl font-bold uppercase tracking-tight mb-2">Protocol Stats</h1>
      <p className="text-xs text-muted-foreground mb-8 tracking-wider uppercase">Lunex Finance | Live Onchain Data</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border mb-6">
        <div className="p-5 bg-card"><div className="h-8 w-8 bg-primary/10 flex items-center justify-center mb-3"><DollarSign className="h-4 w-4 text-primary" /></div><p className="text-xs text-muted-foreground tracking-wider">TOTAL TVL</p><p className="text-xl font-bold font-mono">${fmt(totalTvl)}</p></div>
        <div className="p-5 bg-card"><div className="h-8 w-8 bg-primary/10 flex items-center justify-center mb-3"><Droplets className="h-4 w-4 text-primary" /></div><p className="text-xs text-muted-foreground tracking-wider">POOL LIQUIDITY</p><p className="text-xl font-bold font-mono">${fmt(pool.totalLiquidity)}</p></div>
        <div className="p-5 bg-card"><div className="h-8 w-8 bg-primary/10 flex items-center justify-center mb-3"><Shield className="h-4 w-4 text-primary" /></div><p className="text-xs text-muted-foreground tracking-wider">USDC VAULT TVL</p><p className="text-xl font-bold font-mono">${fmt(usdcVault.totalAssets)}</p></div>
        <div className="p-5 bg-card"><div className="h-8 w-8 bg-secondary/10 flex items-center justify-center mb-3"><Shield className="h-4 w-4 text-secondary" /></div><p className="text-xs text-muted-foreground tracking-wider">EURC VAULT TVL</p><p className="text-xl font-bold font-mono">${fmt(eurcVault.totalAssets)}</p></div>
      </div>

      <div className="border border-border bg-card p-6 mb-4">
        <h3 className="text-xs font-semibold tracking-wider uppercase mb-4">Pool Reserves</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
          <div className="p-4 bg-background"><p className="text-xs text-muted-foreground tracking-wider">USDC RESERVE</p><p className="text-sm font-bold font-mono">{fmt(pool.usdcReserve)}</p></div>
          <div className="p-4 bg-background"><p className="text-xs text-muted-foreground tracking-wider">EURC RESERVE</p><p className="text-sm font-bold font-mono">{fmt(pool.eurcReserve)}</p></div>
          <div className="p-4 bg-background"><p className="text-xs text-muted-foreground tracking-wider">SWAP FEE</p><p className="text-sm font-bold font-mono">{pool.feePercent}%</p></div>
          <div className="p-4 bg-background"><p className="text-xs text-muted-foreground tracking-wider">LP SUPPLY</p><p className="text-sm font-bold font-mono">{pool.lpTotalSupply.toFixed(2)}</p></div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="border border-border bg-card p-6">
          <h3 className="text-xs font-semibold tracking-wider uppercase mb-4">luneUSDC Vault</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground text-xs uppercase tracking-wider">TVL</span><span className="font-mono">${fmt(usdcVault.totalAssets)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground text-xs uppercase tracking-wider">Share Price</span><span className="font-mono">{usdcVault.sharePrice.toFixed(6)}</span></div>
          </div>
        </div>
        <div className="border border-border bg-card p-6">
          <h3 className="text-xs font-semibold tracking-wider uppercase mb-4">luneEURC Vault</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground text-xs uppercase tracking-wider">TVL</span><span className="font-mono">${fmt(eurcVault.totalAssets)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground text-xs uppercase tracking-wider">Share Price</span><span className="font-mono">{eurcVault.sharePrice.toFixed(6)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProtocolStats;
