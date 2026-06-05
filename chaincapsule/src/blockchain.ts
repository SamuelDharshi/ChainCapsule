/**
 * blockchain.ts — Real Sui + Walrus integration for ChainCapsule
 *
 * Replaces all simulated blockchain calls with live Sui testnet RPC
 * and Walrus decentralized storage operations.
 *
 * IV Storage Strategy: The 12-byte AES-GCM IV is prepended to the
 * ciphertext before upload to Walrus. On download, the first 12 bytes
 * are extracted as the IV. This makes blobs self-contained.
 */

import { Transaction } from "@mysten/sui/transactions";

// ─── Network Config ────────────────────────────────────────────────────────────
// Vite exposes env vars with VITE_ prefix in the browser bundle
export const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID ?? "";
export const CLOCK_ID   = import.meta.env.VITE_SUI_CLOCK_ID ?? "0x6";
export const NETWORK    = import.meta.env.VITE_SUI_NETWORK ?? "testnet";

const WALRUS_PUBLISHER  = import.meta.env.VITE_WALRUS_PUBLISHER
  ?? "https://publisher.walrus-testnet.walrus.space";
const WALRUS_AGGREGATOR = import.meta.env.VITE_WALRUS_AGGREGATOR
  ?? "https://aggregator.walrus-testnet.walrus.space";

const FULLNODE_URLS: Record<string, string> = {
  mainnet: "https://fullnode.mainnet.sui.io:443",
  testnet: "https://fullnode.testnet.sui.io:443",
  devnet:  "https://fullnode.devnet.sui.io:443",
};

export function getSuiRpcUrl(): string {
  return FULLNODE_URLS[NETWORK] ?? FULLNODE_URLS.testnet;
}

// ─── Raw JSON-RPC helper ───────────────────────────────────────────────────────
export async function suiRpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(getSuiRpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`Sui RPC error: ${JSON.stringify(json.error)}`);
  return json.result;
}

// ─── Capsule On-Chain Data Shape ──────────────────────────────────────────────
export interface CapsuleOnChain {
  objectId:       string;
  owner:          string;
  beneficiary:    string;
  walrusBlobId:   string;
  encKeyHint:     string;  // hex of AES-256 key bytes
  unlockAfterMs:  number;
  inactivityDays: number;
  lastHeartbeat:  number;
  createdAt:      number;
}

/** Fetch and parse a Capsule shared object from Sui chain */
export async function getCapsuleObject(objectId: string): Promise<CapsuleOnChain> {
  const result = await suiRpc("sui_getObject", [
    objectId,
    { showContent: true, showOwner: true },
  ]) as {
    data?: { content?: { fields?: Record<string, unknown> } }
  };

  const f = result?.data?.content?.fields;
  if (!f) throw new Error(`Capsule object not found: ${objectId}`);

  // enc_key_hint is stored as an array of u8 bytes on-chain
  const keyBytes: number[] = Array.isArray(f.enc_key_hint)
    ? (f.enc_key_hint as number[])
    : [];
  const encKeyHint = keyBytes.map(b => b.toString(16).padStart(2, "0")).join("");

  return {
    objectId,
    owner:          f.owner as string,
    beneficiary:    f.beneficiary as string,
    walrusBlobId:   f.walrus_blob_id as string,
    encKeyHint,
    unlockAfterMs:  Number(f.unlock_after_ms ?? 0),
    inactivityDays: Number(f.inactivity_days ?? 0),
    lastHeartbeat:  Number(f.last_heartbeat ?? 0),
    createdAt:      Number(f.created_at ?? 0),
  };
}

/** Query all capsule object IDs owned (created) by a given wallet address */
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

// ─── Transaction Builders ──────────────────────────────────────────────────────

/** Build the `capsule::create` Move transaction */
export function buildCreateTx(params: {
  blobId:       string;
  encKeyBytes:  number[];   // raw AES-256 key as byte array
  beneficiary:  string;
  unlockDateMs: number;     // 0 for dead man's switch
  inactivityD:  number;     // 0 for time capsule
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::capsule::create`,
    arguments: [
      tx.pure.string(params.blobId),
      tx.pure.vector("u8", params.encKeyBytes),
      tx.pure.address(params.beneficiary),
      tx.pure.u64(params.unlockDateMs),
      tx.pure.u64(params.inactivityD),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

/** Build the `capsule::heartbeat` Move transaction */
export function buildHeartbeatTx(capsuleObjectId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::capsule::heartbeat`,
    arguments: [tx.object(capsuleObjectId), tx.object(CLOCK_ID)],
  });
  return tx;
}

/** Build the `capsule::unlock` Move transaction */
export function buildUnlockTx(capsuleObjectId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::capsule::unlock`,
    arguments: [tx.object(capsuleObjectId), tx.object(CLOCK_ID)],
  });
  return tx;
}

// ─── Walrus Storage ────────────────────────────────────────────────────────────

/**
 * Upload ciphertext to Walrus with IV prepended.
 * Format: [12 bytes IV] + [ciphertext bytes]
 * This makes the blob self-contained for decryption.
 */
export async function uploadCiphertextToWalrus(
  ivHex: string,
  ciphertextBase64: string,
  epochs = 5
): Promise<string> {
  // Convert hex IV → Uint8Array (12 bytes)
  const ivBytes = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));

  // Convert base64 ciphertext → Uint8Array
  const binaryStr = atob(ciphertextBase64);
  const cipherBytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    cipherBytes[i] = binaryStr.charCodeAt(i);
  }

  // Prepend IV to ciphertext → [12 bytes IV | ciphertext]
  const blobBytes = new Uint8Array(ivBytes.length + cipherBytes.length);
  blobBytes.set(ivBytes, 0);
  blobBytes.set(cipherBytes, ivBytes.length);

  const res = await fetch(`${WALRUS_PUBLISHER}/v1/blobs?epochs=${epochs}`, {
    method:  "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body:    blobBytes,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Walrus upload failed [${res.status}]: ${text}`);
  }

  const data = await res.json();
  const blobId =
    data.newlyCreated?.blobObject?.blobId ??
    data.alreadyCertified?.blobId;

  if (!blobId) {
    throw new Error(`Walrus: unexpected response: ${JSON.stringify(data)}`);
  }

  return blobId as string;
}

/**
 * Fetch encrypted blob from Walrus and split into IV + ciphertext.
 * Returns: { ivHex, ciphertextBase64 }
 */
export async function downloadFromWalrus(
  blobId: string
): Promise<{ ivHex: string; ciphertextBase64: string }> {
  const url = `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Walrus fetch failed [${res.status}] for blobId: ${blobId}`);
  }

  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // First 12 bytes = IV
  const ivBytes = bytes.slice(0, 12);
  const cipherBytes = bytes.slice(12);

  const ivHex = Array.from(ivBytes).map(b => b.toString(16).padStart(2, "0")).join("");

  // Convert ciphertext bytes → base64
  let binary = "";
  for (let i = 0; i < cipherBytes.length; i++) {
    binary += String.fromCharCode(cipherBytes[i]);
  }
  const ciphertextBase64 = btoa(binary);

  return { ivHex, ciphertextBase64 };
}

// ─── Local Metadata Store (localStorage) ──────────────────────────────────────
// Stores capsule metadata not kept on-chain: name, description, fileName, fileType, fileSize, salt

export interface LocalCapsuleMeta {
  name:        string;
  description: string;
  fileName:    string;
  fileType:    string;
  fileSize:    number;
  salt:        string;  // kept for reference, not needed for decryption
}

const META_PREFIX = "cc-meta-";

export function saveLocalMeta(capsuleId: string, meta: LocalCapsuleMeta): void {
  try {
    localStorage.setItem(META_PREFIX + capsuleId, JSON.stringify(meta));
  } catch {
    // localStorage unavailable (private mode, etc.)
  }
}

export function loadLocalMeta(capsuleId: string): LocalCapsuleMeta | null {
  try {
    const raw = localStorage.getItem(META_PREFIX + capsuleId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Extract capsule object ID from a successful create transaction result */
export function extractCapsuleIdFromTxResult(txResult: unknown): string {
  // dapp-kit returns txResult.effects.created array
  const result = txResult as {
    effects?: {
      created?: Array<{ reference?: { objectId?: string }; owner?: unknown }>;
    };
  };
  const created = result?.effects?.created ?? [];
  // Find shared object (the capsule is a shared object)
  const shared = created.find(
    (obj) =>
      obj.owner &&
      typeof obj.owner === "object" &&
      "Shared" in (obj.owner as object)
  );
  return shared?.reference?.objectId ?? "";
}
