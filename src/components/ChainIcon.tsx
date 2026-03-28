import type { BridgeChainKey } from "@/features/bridge/config/bridgeConfig";

const CHAIN_ICONS: Record<BridgeChainKey, { bg: string; letter: string; color: string }> = {
  ethereum: { bg: "bg-[#627EEA]/15", letter: "Ξ", color: "text-[#627EEA]" },
  avalanche: { bg: "bg-[#E84142]/15", letter: "A", color: "text-[#E84142]" },
  arbitrum: { bg: "bg-[#28A0F0]/15", letter: "A", color: "text-[#28A0F0]" },
  base: { bg: "bg-[#0052FF]/15", letter: "B", color: "text-[#0052FF]" },
  polygon: { bg: "bg-[#8247E5]/15", letter: "P", color: "text-[#8247E5]" },
  arc: { bg: "bg-primary/15", letter: "⌬", color: "text-primary" },
};

export function ChainIcon({ chain, size = "sm" }: { chain: BridgeChainKey; size?: "sm" | "md" }) {
  const { bg, letter, color } = CHAIN_ICONS[chain];
  const dim = size === "sm" ? "h-5 w-5 text-[10px]" : "h-6 w-6 text-xs";
  return (
    <span className={`inline-flex items-center justify-center rounded-full font-bold ${bg} ${color} ${dim}`}>
      {letter}
    </span>
  );
}
