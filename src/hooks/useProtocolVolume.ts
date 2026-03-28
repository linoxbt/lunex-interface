import { useState, useEffect, useCallback } from "react";
import { useWatchContractEvent, usePublicClient } from "wagmi";
import { formatUnits, parseAbiItem } from "viem";
import { supabase } from "@/integrations/supabase/client";
import { arcTestnet } from "@/config/wagmi";

const VOLUME_CONTRACTS = {
  SWAP_POOL: "0x181DA777C301Bc37B078DEf57569685678e59eD0" as `0x${string}`,
  VAULT_USDC: "0x2cdFfC0dfe539cdC3019147383C458f0FBe82B04" as `0x${string}`,
  VAULT_EURC: "0x458d09fb8b621c9968Fc52Aa7510d511862175A9" as `0x${string}`,
};

interface ProtocolStats {
  totalVolume: number;
  swapVolume: number;
  poolVolume: number;
  vaultVolume: number;
}

async function recordVolume(txHash: string, blockNumber: bigint, eventType: string, amountUsd: number, contract: string) {
  try {
    await supabase.from("protocol_volume").upsert({
      tx_hash: txHash,
      block_number: Number(blockNumber),
      event_type: eventType,
      amount_usd: amountUsd,
      contract,
    }, { onConflict: "tx_hash,event_type" });
  } catch (e) {
    console.error("Failed to record volume:", e);
  }
}

export function useProtocolVolume() {
  const [stats, setStats] = useState<ProtocolStats>({
    totalVolume: 0, swapVolume: 0, poolVolume: 0, vaultVolume: 0,
  });

  const fetchStats = useCallback(async () => {
    const { data } = await supabase
      .from("protocol_stats")
      .select("total_volume_usd, swap_volume_usd, pool_volume_usd, vault_volume_usd")
      .eq("id", 1)
      .single();
    if (data) {
      setStats({
        totalVolume: Number(data.total_volume_usd),
        swapVolume: Number(data.swap_volume_usd),
        poolVolume: Number(data.pool_volume_usd),
        vaultVolume: Number(data.vault_volume_usd),
      });
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Watch swap events
  useWatchContractEvent({
    address: VOLUME_CONTRACTS.SWAP_POOL,
    abi: [parseAbiItem("event TokenExchange(address indexed buyer, uint256 sold_id, uint256 tokens_sold, uint256 bought_id, uint256 tokens_bought)")],
    eventName: "TokenExchange",
    chainId: arcTestnet.id,
    onLogs(logs) {
      for (const log of logs) {
        const args = log.args as any;
        if (args?.tokens_sold) {
          const amt = parseFloat(formatUnits(args.tokens_sold, 6));
          recordVolume(log.transactionHash!, log.blockNumber!, "swap", amt, VOLUME_CONTRACTS.SWAP_POOL).then(fetchStats);
        }
      }
    },
  });

  // Watch add liquidity
  useWatchContractEvent({
    address: VOLUME_CONTRACTS.SWAP_POOL,
    abi: [parseAbiItem("event AddLiquidity(address indexed provider, uint256 amount0, uint256 amount1, uint256 lp_minted, uint256 invariant)")],
    eventName: "AddLiquidity",
    chainId: arcTestnet.id,
    onLogs(logs) {
      for (const log of logs) {
        const args = log.args as any;
        if (args?.amount0 !== undefined) {
          const amt = parseFloat(formatUnits(args.amount0, 6)) + parseFloat(formatUnits(args.amount1, 6));
          recordVolume(log.transactionHash!, log.blockNumber!, "add_liquidity", amt, VOLUME_CONTRACTS.SWAP_POOL).then(fetchStats);
        }
      }
    },
  });

  // Watch remove liquidity
  useWatchContractEvent({
    address: VOLUME_CONTRACTS.SWAP_POOL,
    abi: [parseAbiItem("event RemoveLiquidity(address indexed provider, uint256 amount0, uint256 amount1, uint256 lp_burned)")],
    eventName: "RemoveLiquidity",
    chainId: arcTestnet.id,
    onLogs(logs) {
      for (const log of logs) {
        const args = log.args as any;
        if (args?.amount0 !== undefined) {
          const amt = parseFloat(formatUnits(args.amount0, 6)) + parseFloat(formatUnits(args.amount1, 6));
          recordVolume(log.transactionHash!, log.blockNumber!, "remove_liquidity", amt, VOLUME_CONTRACTS.SWAP_POOL).then(fetchStats);
        }
      }
    },
  });

  // Watch vault deposits (USDC + EURC)
  const vaultDepositAbi = [parseAbiItem("event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)")];
  const vaultWithdrawAbi = [parseAbiItem("event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)")];

  useWatchContractEvent({
    address: VOLUME_CONTRACTS.VAULT_USDC,
    abi: vaultDepositAbi,
    eventName: "Deposit",
    chainId: arcTestnet.id,
    onLogs(logs) {
      for (const log of logs) {
        const args = log.args as any;
        if (args?.assets) {
          const amt = parseFloat(formatUnits(args.assets, 6));
          recordVolume(log.transactionHash!, log.blockNumber!, "vault_deposit", amt, VOLUME_CONTRACTS.VAULT_USDC).then(fetchStats);
        }
      }
    },
  });

  useWatchContractEvent({
    address: VOLUME_CONTRACTS.VAULT_EURC,
    abi: vaultDepositAbi,
    eventName: "Deposit",
    chainId: arcTestnet.id,
    onLogs(logs) {
      for (const log of logs) {
        const args = log.args as any;
        if (args?.assets) {
          const amt = parseFloat(formatUnits(args.assets, 6));
          recordVolume(log.transactionHash!, log.blockNumber!, "vault_deposit", amt, VOLUME_CONTRACTS.VAULT_EURC).then(fetchStats);
        }
      }
    },
  });

  useWatchContractEvent({
    address: VOLUME_CONTRACTS.VAULT_USDC,
    abi: vaultWithdrawAbi,
    eventName: "Withdraw",
    chainId: arcTestnet.id,
    onLogs(logs) {
      for (const log of logs) {
        const args = log.args as any;
        if (args?.assets) {
          const amt = parseFloat(formatUnits(args.assets, 6));
          recordVolume(log.transactionHash!, log.blockNumber!, "vault_withdraw", amt, VOLUME_CONTRACTS.VAULT_USDC).then(fetchStats);
        }
      }
    },
  });

  useWatchContractEvent({
    address: VOLUME_CONTRACTS.VAULT_EURC,
    abi: vaultWithdrawAbi,
    eventName: "Withdraw",
    chainId: arcTestnet.id,
    onLogs(logs) {
      for (const log of logs) {
        const args = log.args as any;
        if (args?.assets) {
          const amt = parseFloat(formatUnits(args.assets, 6));
          recordVolume(log.transactionHash!, log.blockNumber!, "vault_withdraw", amt, VOLUME_CONTRACTS.VAULT_EURC).then(fetchStats);
        }
      }
    },
  });

  return stats;
}
