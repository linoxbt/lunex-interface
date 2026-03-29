import { Link } from "react-router-dom";
import { ArrowRight, DollarSign, Droplets, Shield } from "lucide-react";
import FaucetBanner from "@/components/FaucetBanner";
import { usePoolData } from "@/hooks/usePoolData";
import { useVaultData } from "@/hooks/useVaultData";

const Landing = () => {
  const pool = usePoolData();
  const usdcVault = useVaultData("USDC");
  const eurcVault = useVaultData("EURC");
  const totalTvl = pool.totalLiquidity + usdcVault.totalAssets + eurcVault.totalAssets;
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="page-fade-in">
      <FaucetBanner />
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="container relative py-28 md:py-40 text-center">
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight uppercase leading-none mb-6">
            <span className="text-foreground whitespace-nowrap">Stable</span>
            <span className="text-primary whitespace-nowrap">Swap</span>
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-lg mx-auto mb-10 leading-relaxed">
            Curve-style StableSwap AMM optimised for USDC/EURC pairs with minimal slippage on Arc Network.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link to="/swap" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold tracking-wider uppercase hover:bg-primary/90 transition-colors w-full sm:w-auto justify-center">
              Launch App <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/docs" className="inline-flex items-center gap-2 border border-border text-foreground px-6 py-3 text-sm font-semibold tracking-wider uppercase hover:border-primary/40 hover:text-primary transition-colors w-full sm:w-auto justify-center">
              Learn More <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="container py-20">
        <div className="grid md:grid-cols-2 gap-4 mb-16">
          <Link to="/swap" className="group relative overflow-hidden border border-border gradient-teal p-10 transition-all hover:border-primary/30 glow-teal text-center md:text-left">
            <p className="text-xs text-primary tracking-widest uppercase mb-4">01 / SWAP</p>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3 uppercase tracking-tight">Swap Stablecoins</h2>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto md:mx-0 leading-relaxed">Near-zero slippage swaps between USDC and EURC with {pool.feePercent}% fees.</p>
            <span className="inline-flex items-center gap-2 text-primary text-xs font-semibold tracking-wider uppercase group-hover:gap-3 transition-all">Start Swapping <ArrowRight className="h-3.5 w-3.5" /></span>
          </Link>
          <Link to="/yield" className="group relative overflow-hidden border border-border gradient-purple p-10 transition-all hover:border-secondary/30 glow-purple text-center md:text-left">
            <p className="text-xs text-secondary tracking-widest uppercase mb-4">02 / YIELD</p>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3 uppercase tracking-tight">Earn Yield</h2>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto md:mx-0 leading-relaxed">ERC-4626 vaults with auto-compounding strategies. Deposit and earn.</p>
            <span className="inline-flex items-center gap-2 text-secondary text-xs font-semibold tracking-wider uppercase group-hover:gap-3 transition-all">View Vaults <ArrowRight className="h-3.5 w-3.5" /></span>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
          <div className="flex items-center gap-4 bg-background p-6 justify-center md:justify-start"><div className="flex h-10 w-10 items-center justify-center bg-primary/10"><DollarSign className="h-5 w-5 text-primary" /></div><div className="text-center md:text-left"><p className="text-xs text-muted-foreground tracking-wider">TOTAL TVL</p><p className="text-xl font-bold font-mono">${fmt(totalTvl)}</p></div></div>
          <div className="flex items-center gap-4 bg-background p-6 justify-center md:justify-start"><div className="flex h-10 w-10 items-center justify-center bg-primary/10"><Droplets className="h-5 w-5 text-primary" /></div><div className="text-center md:text-left"><p className="text-xs text-muted-foreground tracking-wider">POOL RESERVES</p><p className="text-xl font-bold font-mono">${fmt(pool.totalLiquidity)}</p></div></div>
          <div className="flex items-center gap-4 bg-background p-6 justify-center md:justify-start"><div className="flex h-10 w-10 items-center justify-center bg-primary/10"><Shield className="h-5 w-5 text-primary" /></div><div className="text-center md:text-left"><p className="text-xs text-muted-foreground tracking-wider">USDC VAULT TVL</p><p className="text-xl font-bold font-mono">${fmt(usdcVault.totalAssets)}</p></div></div>
          <div className="flex items-center gap-4 bg-background p-6 justify-center md:justify-start"><div className="flex h-10 w-10 items-center justify-center bg-secondary/10"><Shield className="h-5 w-5 text-secondary" /></div><div className="text-center md:text-left"><p className="text-xs text-muted-foreground tracking-wider">EURC VAULT TVL</p><p className="text-xl font-bold font-mono">${fmt(eurcVault.totalAssets)}</p></div></div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
