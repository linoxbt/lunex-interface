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
                {BRIDGE_CHAINS[k].label}
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
                {BRIDGE_CHAINS[k].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
