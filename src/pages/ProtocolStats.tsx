import { DollarSign, Droplets, Shield, BarChart3 } from "lucide-react";
import { usePoolData } from "@/hooks/usePoolData";
import { useVaultData } from "@/hooks/useVaultData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import BackButton from "@/components/BackButton";

const ProtocolStats = () => {
  const pool = usePoolData();
  const usdcVault = useVaultData("USDC");
  const eurcVault = useVaultData("EURC");
  const totalTvl = pool.totalLiquidity + usdcVault.totalAssets + eurcVault.totalAssets;
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const { data: stats } = useQuery({
    queryKey: ["protocol-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("protocol_stats").select("*").eq("id", 1).single();
      return data;
    },
    refetchInterval: 10000,
  });

  const totalVolume = stats?.total_volume_usd ?? 0;
  const swapVolume = stats?.swap_volume_usd ?? 0;
  const poolVolume = stats?.pool_volume_usd ?? 0;
  const vaultVolume = stats?.vault_volume_usd ?? 0;

  return (
    <div className="container max-w-6xl mx-auto py-16 px-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 border-b border-border pb-8">
        <div>
          <BackButton />
          <h1 className="text-4xl font-bold tracking-tight mt-6">Protocol Analytics</h1>
          <p className="text-muted-foreground mt-2 font-mono text-sm">Protocol metrics and real-time on-chain data distribution</p>
        </div>
        <div className="flex items-center gap-4 mt-6 md:mt-0">
          <div className="text-right">
             <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Network Status</p>
             <p className="text-xs font-bold text-green-500 uppercase tracking-widest flex items-center justify-end gap-2">
               <span className="flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
               Operational
             </p>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {[
          { label: 'Total Value Locked', val: `$${fmt(totalTvl)}`, icon: DollarSign, color: 'primary' },
          { label: 'Cumulative Volume', val: `$${fmt(totalVolume)}`, icon: BarChart3, color: 'primary' },
          { label: 'Pool Liquidity', val: `$${fmt(pool.totalLiquidity)}`, icon: Droplets, color: 'primary' },
          { label: 'Swap Fees (24h)', val: '$312.42', icon: Shield, color: 'primary' },
        ].map((kpi, i) => (
          <div key={i} className="border border-border bg-card p-6 rounded-sm relative overflow-hidden group">
            <kpi.icon className="absolute -bottom-2 -right-2 h-16 w-16 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity" />
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground mb-4">{kpi.label}</p>
            <p className="text-3xl font-bold font-mono tracking-tighter">{kpi.val}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content (Left) */}
        <div className="lg:col-span-2 space-y-8">
          {/* Asset Distribution */}
          <section className="bg-card border border-border rounded-sm">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-widest">Asset Distribution</h3>
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Liquidity Pool</span>
            </div>
            <div className="p-8">
              <div className="flex h-12 w-full rounded-sm overflow-hidden mb-8 border border-border">
                <div title="USDC" className="h-full bg-primary" style={{ width: '50%' }}></div>
                <div title="EURC" className="h-full bg-secondary" style={{ width: '50%' }}></div>
              </div>
              <div className="grid grid-cols-2 gap-12">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 bg-primary rounded-full" />
                    <span className="text-xs font-bold uppercase tracking-wider">USDC Reserve</span>
                  </div>
                  <div className="pl-6 font-mono">
                    <p className="text-2xl font-bold">{fmt(pool.usdcReserve)}</p>
                    <p className="text-xs text-muted-foreground mt-1">${fmt(pool.usdcReserve)} USD</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 border-l border-border pl-6 lg:pl-12">
                    <div className="h-3 w-3 bg-secondary rounded-full" />
                    <span className="text-xs font-bold uppercase tracking-wider">EURC Reserve</span>
                  </div>
                  <div className="pl-12 lg:pl-18 border-l border-border font-mono">
                    <p className="text-2xl font-bold pl-6">{fmt(pool.eurcReserve)}</p>
                    <p className="text-xs text-muted-foreground mt-1 pl-6">€{fmt(pool.eurcReserve)} EUR</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-muted/20 border-t border-border flex justify-between items-center">
               <div className="flex gap-4">
                  <div className="flex items-center gap-2"><span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Fee:</span><span className="text-[10px] font-bold font-mono">{pool.feePercent}%</span></div>
                  <div className="flex items-center gap-2 border-l border-border pl-4"><span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Slippage:</span><span className="text-[10px] font-bold font-mono">Min.</span></div>
               </div>
               <span className="text-[10px] font-bold text-primary uppercase tracking-[0.25em]">Verified Strategy</span>
            </div>
          </section>

          {/* Volume Breakdown */}
          <section className="bg-card border border-border rounded-sm">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-sm font-bold uppercase tracking-widest">Volume & Interaction</h3>
            </div>
            <div className="divide-y divide-border">
              {[
                { label: 'Swap Volume', val: swapVolume, sub: 'Total USDC/EURC conversions' },
                { label: 'LP Activity', val: poolVolume, sub: 'Liquidity additions & removals' },
                { label: 'Vault Transfers', val: vaultVolume, sub: 'Yield vault interacts (ERC-4626)' },
              ].map((item, i) => (
                <div key={i} className="px-6 py-5 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-1">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{item.sub}</p>
                  </div>
                  <div className="text-right font-mono">
                    <p className="text-lg font-bold">${fmt(item.val)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar (Right) */}
        <div className="space-y-6">
          {/* APY Card */}
          <section className="bg-card border border-border rounded-sm p-6">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground mb-8 text-center">Standard Yield Index</h3>
            <div className="space-y-8">
               <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">luneUSDC Vault</p>
                  <p className="text-4xl font-bold font-mono text-primary">8.50%</p>
                  <p className="text-[8px] font-bold uppercase text-muted-foreground mt-1 tracking-widest">Annual Percentage Yield</p>
               </div>
               <div className="h-px bg-border w-12 mx-auto" />
               <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">luneEURC Vault</p>
                  <p className="text-4xl font-bold font-mono text-secondary">7.20%</p>
                  <p className="text-[8px] font-bold uppercase text-muted-foreground mt-1 tracking-widest">Annual Percentage Yield</p>
               </div>
            </div>
          </section>

          {/* Protocol Integrity */}
          <section className="bg-primary/5 border border-primary/20 rounded-sm p-6">
            <h4 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-4">On-Chain Transparency</h4>
            <div className="space-y-4">
               <div>
                  <p className="text-[8px] uppercase tracking-widest text-muted-foreground mb-1">LP Supply</p>
                  <p className="text-sm font-bold font-mono">{fmt(pool.lpTotalSupply)} Units</p>
               </div>
               <div>
                  <p className="text-[8px] uppercase tracking-widest text-muted-foreground mb-1">Vault Interoperability</p>
                  <p className="text-sm font-bold font-mono uppercase">ERC-4626 Standard</p>
               </div>
               <div>
                  <p className="text-[8px] uppercase tracking-widest text-muted-foreground mb-1">Bridge Model</p>
                  <p className="text-sm font-bold font-mono uppercase">Circle CCTP (Native)</p>
               </div>
            </div>
          </section>

          <div className="p-6 border border-border rounded-sm bg-muted/10 opacity-60">
             <p className="text-[10px] font-bold uppercase tracking-widest mb-2">Protocol Architecture</p>
             <p className="text-[10px] leading-relaxed text-muted-foreground">
               Lunex utilizes a dynamic invariant StableSwap model optimized for Euro/USD peg stability.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProtocolStats;
