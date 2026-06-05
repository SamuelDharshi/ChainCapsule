// ─── Sui + Tatum RPC Integration ──────────────────────────────────────────────
// All Sui blockchain calls are routed through the Tatum gateway for reliability.
// Uses the modern @mysten/sui package (not the deprecated @mysten/sui.js).

import { Transaction } from "@mysten/sui/transactions";

const TATUM_KEY  = process.env.NEXT_PUBLIC_TATUM_KEY ?? "";
const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID ?? "";
const CLOCK_ID   = process.env.NEXT_PUBLIC_SUI_CLOCK_ID ?? "0x6";
const NETWORK    = (process.env.NEXT_PUBLIC_SUI_NETWORK ?? "testnet") as "testnet" | "mainnet" | "devnet";

// Tatum gateway endpoint (mainnet)
const TATUM_RPC = "https://sui-mainnet.gateway.tatum.io";

// Fullnode URLs per network (getFullnodeUrl removed in @mysten/sui v1+)
const FULLNODE_URLS: Record<string, string> = {
  mainnet: "https://fullnode.mainnet.sui.io:443",
  testnet: "https://fullnode.testnet.sui.io:443",
  devnet:  "https://fullnode.devnet.sui.io:443",
};

// Use Tatum for mainnet, fall back to public fullnode for testnet/devnet
function getRpcUrl(): string {
  if (NETWORK === "mainnet" && TATUM_KEY) return TATUM_RPC;
  return FULLNODE_URLS[NETWORK] ?? FULLNODE_URLS.testnet;
}

/**
 * Make a raw Sui JSON-RPC call through Tatum gateway.
 * Includes x-api-key header for authenticated Tatum access.
 */
export async function suiRpc(method: string, params: unknown[]): Promise<unknown> {
  const url     = getRpcUrl();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (NETWORK === "mainnet" && TATUM_KEY) {
    headers["x-api-key"] = TATUM_KEY;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });

  const json = await res.json();
  if (json.error) throw new Error(`Sui RPC error: ${JSON.stringify(json.error)}`);
  return json.result;
}

/**
 * Get the RPC URL for direct fetch calls.
 */
export function getSuiRpcUrl(): string {
  return getRpcUrl();
}

// ─── Capsule Data Types ───────────────────────────────────────────────────────

export interface CapsuleData {
  objectId:       string;
  owner:          string;
  beneficiary:    string;
  walrusBlobId:   string;
  encKeyHint:     number[];
  unlockAfterMs:  number;
  inactivityDays: number;
  lastHeartbeat:  number;
  createdAt:      number;
}

/**
 * Fetch and parse a Capsule object from the Sui chain.
 */
export async function getCapsuleObject(objectId: string): Promise<CapsuleData> {
  const result = await suiRpc("sui_getObject", [
    objectId,
    { showContent: true, showOwner: true },
  ]) as {
    data?: {
      content?: {
        fields?: Record<string, unknown>;
      };
    };
  };

  const fields = result?.data?.content?.fields;
  if (!fields) throw new Error(`Capsule object not found: ${objectId}`);

  return {
    objectId,
    owner:          fields.owner as string,
    beneficiary:    fields.beneficiary as string,
    walrusBlobId:   fields.walrus_blob_id as string,
    encKeyHint:     fields.enc_key_hint as number[],
    unlockAfterMs:  Number(fields.unlock_after_ms),
    inactivityDays: Number(fields.inactivity_days),
    lastHeartbeat:  Number(fields.last_heartbeat),
    createdAt:      Number(fields.created_at),
  };
}

/**
 * Check if a capsule is currently unlockable based on local time.
 */
export function isUnlockable(capsule: CapsuleData): boolean {
  const now = Date.now();
  if (capsule.unlockAfterMs > 0)  return now >= capsule.unlockAfterMs;
  if (capsule.inactivityDays > 0) return now - capsule.lastHeartbeat >= capsule.inactivityDays * 86_400_000;
  return false;
}

/**
 * Get remaining milliseconds until the capsule can be unlocked.
 */
export function msUntilUnlock(capsule: CapsuleData): number {
  const now = Date.now();
  if (capsule.unlockAfterMs > 0) return Math.max(0, capsule.unlockAfterMs - now);
  if (capsule.inactivityDays > 0) {
    const deadline = capsule.lastHeartbeat + capsule.inactivityDays * 86_400_000;
    return Math.max(0, deadline - now);
  }
  return -1;
}

// ─── Transaction Builders ─────────────────────────────────────────────────────

/** Build the `capsule::heartbeat` transaction */
export function buildHeartbeatTx(capsuleObjectId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::capsule::heartbeat`,
    arguments: [tx.object(capsuleObjectId), tx.object(CLOCK_ID)],
  });
  return tx;
}

/** Build the `capsule::unlock` transaction */
export function buildUnlockTx(capsuleObjectId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::capsule::unlock`,
    arguments: [tx.object(capsuleObjectId), tx.object(CLOCK_ID)],
  });
  return tx;
}

/** Build the `capsule::create` transaction */
export function buildCreateTx(params: {
  blobId:       string;
  encKey:       Uint8Array;
  beneficiary:  string;
  unlockDateMs: number;
  inactivityD:  number;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::capsule::create`,
    arguments: [
      tx.pure.string(params.blobId),
      tx.pure.vector("u8", Array.from(params.encKey)),
      tx.pure.address(params.beneficiary),
      tx.pure.u64(params.unlockDateMs),
      tx.pure.u64(params.inactivityD),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

/**
 * Query CapsuleCreated events to find capsules owned by the given address.
 */
export async function getCapsulesByOwner(ownerAddress: string): Promise<string[]> {
  try {
    const result = await suiRpc("suix_queryEvents", [
      { MoveEventType: `${PACKAGE_ID}::capsule::CapsuleCreated` },
      null, 50, false,
    ]) as { data?: Array<{ parsedJson?: { owner?: string; capsule_id?: string } }> };

    return (result?.data ?? [])
      .filter(e => e.parsedJson?.owner === ownerAddress)
      .map(e => e.parsedJson?.capsule_id ?? "")
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Format ms duration into human-readable string */
export function formatDuration(ms: number): string {
  if (ms <= 0) return "Unlockable now";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/** Shorten a Sui address for display */
export function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
