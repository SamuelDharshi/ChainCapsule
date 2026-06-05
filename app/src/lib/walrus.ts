// ─── Walrus Decentralized Storage Integration ────────────────────────────────
// Handles encrypted blob uploads to Walrus publisher and fetches from aggregator.

const WALRUS_PUBLISHER =
  process.env.NEXT_PUBLIC_WALRUS_PUBLISHER ||
  "https://publisher.walrus-testnet.walrus.space";

const WALRUS_AGGREGATOR =
  process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR ||
  "https://aggregator.walrus-testnet.walrus.space";

/**
 * Upload an encrypted Uint8Array blob to Walrus.
 * The ciphertext is stored on Walrus; only the blob ID is stored on Sui.
 * @param ciphertext - Raw encrypted bytes from encryptFile()
 * @param epochs     - Number of epochs to store (default 5 ≈ ~5 days on testnet)
 * @returns          - Walrus blob ID string
 */
export async function uploadToWalrus(
  ciphertext: Uint8Array,
  epochs = 5
): Promise<string> {
  const res = await fetch(`${WALRUS_PUBLISHER}/v1/blobs?epochs=${epochs}`, {
    method:  "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body:    ciphertext as unknown as BodyInit,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Walrus upload failed [${res.status}]: ${text}`);
  }

  const data = await res.json();

  // Walrus returns either newlyCreated or alreadyCertified
  const blobId =
    data.newlyCreated?.blobObject?.blobId ??
    data.alreadyCertified?.blobId;

  if (!blobId) {
    throw new Error(`Walrus upload: unexpected response shape: ${JSON.stringify(data)}`);
  }

  return blobId as string;
}

/**
 * Fetch an encrypted blob from Walrus aggregator by blob ID.
 * @param blobId - The Walrus blob ID stored in the Sui capsule
 * @returns      - Raw ArrayBuffer (still encrypted)
 */
export async function fetchFromWalrus(blobId: string): Promise<ArrayBuffer> {
  const url = `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Walrus fetch failed [${res.status}] for blobId: ${blobId}`);
  }

  return res.arrayBuffer();
}

/**
 * Get the public gateway URL for a given blob ID (useful for debugging).
 */
export function walrusBlobUrl(blobId: string): string {
  return `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`;
}
