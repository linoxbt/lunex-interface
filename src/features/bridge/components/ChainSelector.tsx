import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BRIDGE_CHAINS, BRIDGE_CHAIN_KEYS, type BridgeChainKey } from "../config/bridgeConfig";

import lunexLogo from "@/assets/lunex-logo.png";

const SVGO = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const chainIcons: Record<string, string> = {
  ethereum: SVGO(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#627EEA"/><path d="M50 15v34l18-8-18-26zm0 43v26l18-36-18 10zm-18-10l18 8V15L32 48z" fill="#fff"/></svg>`),
  avalanche: SVGO(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#E84142"/><path d="M50 25L25 75h15l10-20 10 20h15L50 25z" fill="#fff"/></svg>`),
  arbitrum: SVGO(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#28A0F0"/><path d="M50 25L25 75h15l10-20 10 20h15L50 25z" fill="#fff"/></svg>`),
  base: SVGO(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#0052FF"/><circle cx="50" cy="50" r="20" fill="none" stroke="#fff" stroke-width="12"/></svg>`),
  polygon: SVGO(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#8247E5"/><path d="M50 30L30 42v16l20 12 20-12V42L50 30z" fill="#fff"/></svg>`),
  arc: "https://arc.network/favicon.ico"
};

interface ChainSelectorProps {
  fromChain: BridgeChainKey;
  toChain: BridgeChainKey;
  onFromChange: (chain: BridgeChainKey) => void;
  onToChange: (chain: BridgeChainKey) => void;
  onSwap: () => void;
  disabled?: boolean;
}

export function ChainSelector({
  fromChain,
  toChain,
  onFromChange,
  onToChange,
  onSwap,
  disabled,
}: ChainSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 space-y-1">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          From
        </p>
        <Select
          value={fromChain}
          onValueChange={(v) => onFromChange(v as BridgeChainKey)}
          disabled={disabled}
        >
          <SelectTrigger className="bg-background border-border text-sm font-semibold h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BRIDGE_CHAIN_KEYS.filter((k) => k !== toChain).map((k) => (
              <SelectItem key={k} value={k}>
                <span className="flex items-center gap-2">
                  <img src={chainIcons[k]} alt={k} className="h-4 w-4 rounded-full object-contain" />
                  <span>{BRIDGE_CHAINS[k].label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        variant="outline"
        size="icon"
        className="shrink-0 h-9 w-9 border-border mt-4"
        onClick={onSwap}
        disabled={disabled}
      >
        <ArrowRightLeft className="h-4 w-4" />
      </Button>

      <div className="flex-1 space-y-1">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          To
        </p>
        <Select
          value={toChain}
          onValueChange={(v) => onToChange(v as BridgeChainKey)}
          disabled={disabled}
        >
          <SelectTrigger className="bg-background border-border text-sm font-semibold h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BRIDGE_CHAIN_KEYS.filter((k) => k !== fromChain).map((k) => (
              <SelectItem key={k} value={k}>
                <span className="flex items-center gap-2">
                  <img src={chainIcons[k]} alt={k} className="h-4 w-4 rounded-full object-contain" />
                  <span>{BRIDGE_CHAINS[k].label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>

        </Select>
      </div>
    </div>
  );
}
