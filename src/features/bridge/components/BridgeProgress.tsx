import { Check, Loader2, X, RotateCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type BridgeStatus } from "../state/bridgeState";
import { getExplorerTxUrl, type BridgeChainKey, BRIDGE_CHAINS } from "../config/bridgeConfig";

interface BridgeProgressProps {
  status: BridgeStatus;
  burnTxHash?: string;
  mintTxHash?: string;
  fromChain: BridgeChainKey;
  toChain: BridgeChainKey;
  error?: string | null;
  onRetry?: () => void;
  onReset?: () => void;
  onMint?: () => void;
  attestationReady?: boolean;
}

const STEPS = [
  { key: "burning", label: "Burning USDC" },
  { key: "waiting_attestation", label: "Waiting for attestation" },
  { key: "minting", label: "Minting on destination" },
  { key: "complete", label: "Bridge complete" },
] as const;

function stepIndex(status: BridgeStatus): number {
  if (status === "approving") return 0;
  if (status === "burning") return 0;
  if (status === "waiting_attestation") return 1;
  if (status === "minting") return 2;
  if (status === "complete") return 3;
  return -1;
}

export function BridgeProgress({
  status,
  burnTxHash,
  mintTxHash,
  fromChain,
  toChain,
  error,
  onRetry,
  onReset,
  onMint,
  attestationReady,
}: BridgeProgressProps) {
  const currentStep = stepIndex(status);

  return (
    <div className="border border-border bg-card p-6 space-y-6">
      <h3 className="text-sm font-bold uppercase tracking-wider">Bridge Progress</h3>

      <div className="space-y-4">
        {STEPS.map((step, i) => {
          const isActive = i === currentStep && status !== "complete" && status !== "failed";
          const isDone = i < currentStep || status === "complete";
          const isFailed = status === "failed" && i === currentStep;

          return (
            <div key={step.key} className="flex items-center gap-3">
              <div
                className={`h-8 w-8 flex items-center justify-center border text-xs font-bold ${
                  isDone
                    ? "bg-primary text-primary-foreground border-primary"
                    : isActive
                    ? "border-primary text-primary animate-pulse"
                    : isFailed
                    ? "border-destructive text-destructive"
                    : "border-border text-muted-foreground"
                }`}
              >
                {isDone ? (
                  <Check className="h-4 w-4" />
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isFailed ? (
                  <X className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              <div className="flex-1">
                <p
                  className={`text-xs font-semibold tracking-wider ${
                    isDone
                      ? "text-primary"
                      : isActive
                      ? "text-foreground"
                      : isFailed
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </p>
                {step.key === "waiting_attestation" && isActive && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    This may take several minutes for Arc Network
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Transaction links */}
      <div className="space-y-2 text-xs">
        {burnTxHash && (
          <a
            href={getExplorerTxUrl(fromChain, burnTxHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline"
          >
            Burn TX <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {mintTxHash && (
          <a
            href={getExplorerTxUrl(toChain, mintTxHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline"
          >
            Mint TX <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Error state */}
      {status === "failed" && error && (
        <div className="border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {status === "failed" && onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry} className="text-xs gap-1">
            <RotateCw className="h-3 w-3" /> Retry
          </Button>
        )}
        {status === "waiting_attestation" && attestationReady && onMint && (
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold uppercase tracking-wider"
            onClick={onMint}
          >
            Complete Mint
          </Button>
        )}
        {(status === "complete" || status === "failed") && onReset && (
          <Button size="sm" variant="outline" onClick={onReset} className="text-xs">
            New Bridge
          </Button>
        )}
      </div>
    </div>
  );
}
