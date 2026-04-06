import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAccount } from "wagmi";
import { useVaultData } from "@/hooks/useVaultData";
import { SectionHistory } from "@/components/SectionHistory";
import { useSectionHistory } from "@/hooks/useSectionHistory";
import EmptyState from "@/components/EmptyState";
import BackButton from "@/components/BackButton";

const YIELD_COLUMNS = [
  { key: "action", label: "Action" },
  { key: "token", label: "Token" },
  { key: "amount", label: "Amount" },
  { key: "shares", label: "Shares" },
];

const YieldOverview = () => {
  const { isConnected } = useAccount();
  const usdcVault = useVaultData("USDC");
  const eurcVault = useVaultData("EURC");
  const history = useSectionHistory("yield");
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const hasPositions = usdcVault.userShares > 0 || eurcVault.userShares > 0;

  const vaults = [
    { token: "USDC" as const, share: "luneUSDC", tvl: usdcVault.totalAssets, sharePrice: usdcVault.sharePrice, userShares: usdcVault.userShares, userDeposited: usdcVault.userDeposited, route: "/yield/usdc", accent: "teal" },
    { token: "EURC" as const, share: "luneEURC", tvl: eurcVault.totalAssets, sharePrice: eurcVault.sharePrice, userShares: eurcVault.userShares, userDeposited: eurcVault.userDeposited, route: "/yield/eurc", accent: "purple" },
  ];

  const [claimedRewards, setClaimedRewards] = useState(false);

  return (
    <div className="container max-w-3xl mx-auto py-16">
      <BackButton />
      <h1 className="text-3xl font-bold uppercase tracking-tight mb-8">Yield Vaults</h1>

      {isConnected && hasPositions && (
        <>
        <div className="border border-border bg-card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-xs font-semibold tracking-wider uppercase text-primary">Your Rewards</h3>
             <Button onClick={() => setClaimedRewards(true)} disabled={claimedRewards} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold tracking-wider uppercase">
               {claimedRewards ? "Claimed" : "Claim Rewards"}
             </Button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
               <div className="flex justify-between items-center text-sm p-4 border border-border bg-background"><span className="text-muted-foreground text-xs uppercase tracking-wider">Earned LUNEX</span><span className="font-mono text-green-500 font-bold">{claimedRewards ? "0.00" : "12.50"}</span></div>
               <div className="flex justify-between items-center text-sm p-4 border border-border bg-background"><span className="text-muted-foreground text-xs uppercase tracking-wider">Pending Compounding</span><span className="font-mono text-primary font-bold">{claimedRewards ? "$0.00" : "$4.20"}</span></div>
          </div>
        </div>
        <div className="border border-border bg-card p-6 mb-6">
          <h3 className="text-xs font-semibold tracking-wider uppercase mb-4 text-primary">Your Vault Positions</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {vaults.filter(v => v.userShares > 0).map(v => (
              <div key={v.token} className="p-4 border border-border bg-background space-y-2">
                <p className="text-xs font-semibold tracking-wider uppercase">{v.share}</p>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground text-xs">Shares</span><span className="font-mono">{v.userShares.toFixed(4)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground text-xs">Value</span><span className="font-mono">${fmt(v.userDeposited)}</span></div>
                <p className="text-xs text-muted-foreground">{v.userShares.toFixed(4)} {v.share} = {fmt(v.userDeposited)} {v.token}</p>
              </div>
            ))}
          </div>
        </div>
        </>
      )}

      {isConnected && !hasPositions && (
        <div className="mb-6 border border-border bg-card"><EmptyState variant="deposits" title="No active yield positions" description="Deposit USDC or EURC into vaults to start earning." /></div>
      )}
      {!isConnected && (
        <div className="mb-6 border border-border bg-card"><EmptyState variant="deposits" title="Connect your wallet" description="Connect your wallet to view vault positions." /></div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {vaults.map((v) => (
          <div key={v.token} className={`border border-border bg-card p-6 ${v.accent === "teal" ? "gradient-teal" : "gradient-purple"}`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold uppercase tracking-wider">{v.share}</h2>
              <span className="px-3 py-1 text-xs font-bold bg-muted text-muted-foreground tracking-wider">APY: N/A</span>
            </div>
            <div className="space-y-3 text-sm mb-5">
              <div className="flex justify-between"><span className="text-muted-foreground text-xs uppercase tracking-wider">Total Deposited</span><span className="font-mono">${fmt(v.tvl)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground text-xs uppercase tracking-wider">Share Price</span><span className="font-mono">1 = {v.sharePrice.toFixed(6)} {v.token}</span></div>
            </div>
            <div className="flex gap-2">
              <Link to={v.route} className="flex-1"><Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold tracking-wider uppercase" size="sm">Deposit</Button></Link>
              <Link to={v.route} className="flex-1"><Button variant="outline" className="w-full border-border text-xs font-semibold tracking-wider uppercase" size="sm">Withdraw</Button></Link>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border border-border bg-card p-5">
        <h3 className="text-xs font-semibold tracking-wider uppercase mb-4">Yield History</h3>
        <SectionHistory transactions={history.transactions} columns={YIELD_COLUMNS} section="yield" />
      </div>
    </div>
  );
};

export default YieldOverview;
