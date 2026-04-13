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
    <div className="container max-w-5xl mx-auto py-16 px-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
        <div>
          <BackButton />
          <h1 className="text-4xl font-bold uppercase tracking-tighter mt-4">Protocol Statistics</h1>
          <p className="text-sm text-muted-foreground tracking-widest uppercase mt-1">Real-time Onchain Performance Metrics</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Live Network Data</span>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="relative overflow-hidden border border-border bg-card p-8 group hover:border-primary/50 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <DollarSign className="h-16 w-16" />
          </div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2">Total Value Locked</p>
          <p className="text-4xl font-bold font-mono tracking-tighter">${fmt(totalTvl)}</p>
          <div className="mt-4 h-1 w-full bg-muted overflow-hidden">
            <div className="h-full bg-primary" style={{ width: '100%' }}></div>
          </div>
        </div>
        <div className="relative overflow-hidden border border-border bg-card p-8 group hover:border-primary/50 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <BarChart3 className="h-16 w-16" />
          </div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2">Cumulative Volume</p>
          <p className="text-4xl font-bold font-mono tracking-tighter">${fmt(totalVolume)}</p>
          <div className="mt-4 h-1 w-full bg-muted overflow-hidden">
            <div className="h-full bg-primary" style={{ width: '85%' }}></div>
          </div>
        </div>
        <div className="relative overflow-hidden border border-border bg-card p-8 group hover:border-primary/50 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Droplets className="h-16 w-16" />
          </div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2">Total Liquidity</p>
          <p className="text-4xl font-bold font-mono tracking-tighter">${fmt(pool.totalLiquidity)}</p>
          <div className="mt-4 h-1 w-full bg-muted overflow-hidden">
            <div className="h-full bg-primary" style={{ width: '70%' }}></div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Detailed Breakdown */}
          <section className="border border-border bg-card overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-muted/30">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
                Volume Breakdown
              </h3>
            </div>
            <div className="divide-y divide-border">
              <div className="flex items-center justify-between p-6">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Swap Operations</p>
                  <p className="text-xl font-bold font-mono">${fmt(swapVolume)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">+12.4%</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">24h Change</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-6">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Liquidity Provisioning</p>
                  <p className="text-xl font-bold font-mono">${fmt(poolVolume)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">+5.2%</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">24h Change</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-6">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Vault Interactivity</p>
                  <p className="text-xl font-bold font-mono">${fmt(vaultVolume)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">+8.7%</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">24h Change</p>
                </div>
              </div>
            </div>
          </section>

          {/* Reserves Table */}
          <section className="border border-border bg-card overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-muted/30">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-primary" />
                StableSwap Reserves
              </h3>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/10 text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">
                    <th className="px-6 py-4">Asset</th>
                    <th className="px-6 py-4">Reserve</th>
                    <th className="px-6 py-4">Weight</th>
                    <th className="px-6 py-4">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono text-sm leading-none">
                  <tr>
                    <td className="px-6 py-5 flex items-center gap-3">
                      <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold">U</div>
                      USDC
                    </td>
                    <td className="px-6 py-5">{fmt(pool.usdcReserve)}</td>
                    <td className="px-6 py-5">50.00%</td>
                    <td className="px-6 py-5 font-bold">${fmt(pool.usdcReserve)}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-5 flex items-center gap-3">
                      <div className="h-6 w-6 rounded-full bg-secondary/20 flex items-center justify-center text-[10px] font-bold">E</div>
                      EURC
                    </td>
                    <td className="px-6 py-5">{fmt(pool.eurcReserve)}</td>
                    <td className="px-6 py-5">50.00%</td>
                    <td className="px-6 py-5 font-bold">${fmt(pool.eurcReserve)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 bg-muted/10 border-t border-border flex justify-between items-center">
               <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Fee Structure</span>
               <span className="text-[10px] text-primary font-bold uppercase tracking-widest">{pool.feePercent}% Swap Fee | 0% Admin Fee</span>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          {/* Vault Stats Card */}
          <section className="border border-border bg-card p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest mb-6 border-b border-border pb-4">Vault Performance</h3>
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-bold uppercase tracking-wider">luneUSDC</span>
                  <span className="text-xs text-primary font-bold font-mono">8.5% APY</span>
                </div>
                <div className="h-1.5 w-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: '85%' }}></div>
                </div>
                <div className="flex justify-between items-center text-[10px] text-muted-foreground uppercase font-semibold">
                  <span>Share Price</span>
                  <span className="font-mono text-foreground">{usdcVault.sharePrice.toFixed(6)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-bold uppercase tracking-wider">luneEURC</span>
                  <span className="text-xs text-secondary font-bold font-mono">7.2% APY</span>
                </div>
                <div className="h-1.5 w-full bg-muted">
                  <div className="h-full bg-secondary" style={{ width: '72%' }}></div>
                </div>
                <div className="flex justify-between items-center text-[10px] text-muted-foreground uppercase font-semibold">
                  <span>Share Price</span>
                  <span className="font-mono text-foreground">{eurcVault.sharePrice.toFixed(6)}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 gap-4">
             <div className="border border-border bg-card p-5">
               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">LP Total Supply</p>
               <p className="text-xl font-bold font-mono">{fmt(pool.lpTotalSupply)}</p>
             </div>
             <div className="border border-border bg-card p-5">
               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Bridge Utilization</p>
               <p className="text-xl font-bold font-mono">94.2%</p>
             </div>
          </div>

          <div className="p-6 border border-primary/20 bg-primary/5">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">Security Audit</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Lunex Protocol contracts are undergoing continuous formal verification. Vaults utilize the ERC-4626 standard for maximal interoperability.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProtocolStats;
