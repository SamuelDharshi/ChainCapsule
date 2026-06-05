// ─── Client-side Cryptography Layer ─────────────────────────────────────────
// All encryption/decryption runs entirely in the browser via Web Crypto API.
// The plaintext file NEVER leaves the client machine.

export interface EncryptedPayload {
  ciphertext: Uint8Array;
  iv:         Uint8Array;   // 12 bytes, GCM nonce
  salt:       Uint8Array;   // 16 bytes, PBKDF2 salt
  rawKey:     Uint8Array;   // 32 bytes, exported AES-256 key (store on-chain)
}

/**
 * Encrypt a File using AES-256-GCM with PBKDF2 key derivation.
 * @param file     - The plaintext file to encrypt
 * @param password - Password used to derive the AES key via PBKDF2
 * @returns        Encrypted payload including ciphertext, IV, salt, and raw key
 */
export async function encryptFile(
  file: File,
  password: string
): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));

  // Import password as raw PBKDF2 key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  // Derive AES-256-GCM key from password + salt
  const aesKey = await crypto.subtle.deriveKey(
    {
      name:       "PBKDF2",
      salt,
      iterations: 100_000,
      hash:       "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,          // exportable — we'll store raw key on-chain
    ["encrypt"]
  );

  // Encrypt the file
  const fileBuffer = await file.arrayBuffer();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    fileBuffer
  );

  // Export raw key bytes (stored as enc_key_hint on the Sui capsule)
  const rawKey = await crypto.subtle.exportKey("raw", aesKey);

  return {
    ciphertext: new Uint8Array(ciphertext),
    iv,
    salt,
    rawKey: new Uint8Array(rawKey),
  };
}

/**
 * Decrypt a blob fetched from Walrus.
 * @param ciphertext - Encrypted bytes from Walrus
 * @param rawKey     - 32-byte AES key retrieved from the unlocked Sui capsule
 * @param iv         - 12-byte GCM nonce (prepended to the stored payload)
 * @returns          Decrypted plaintext as ArrayBuffer
 */
export async function decryptBlob(
  ciphertext: ArrayBuffer,
  rawKey:     Uint8Array,
  iv:         Uint8Array
): Promise<ArrayBuffer> {
  // Ensure both have concrete ArrayBuffer (not SharedArrayBuffer) for Web Crypto API
  const rawKeyBuf = rawKey.buffer.byteLength === rawKey.byteLength
    ? rawKey.buffer as ArrayBuffer
    : rawKey.buffer.slice(rawKey.byteOffset, rawKey.byteOffset + rawKey.byteLength) as ArrayBuffer;
  const ivBuf = new Uint8Array(iv) as Uint8Array<ArrayBuffer>;

  const key = await crypto.subtle.importKey(
    "raw",
    rawKeyBuf,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBuf }, key, ciphertext);
}

/**
 * Pack the encrypted payload into a single binary blob for Walrus upload.
 * Layout: [4 bytes: iv_len][iv][4 bytes: salt_len][salt][ciphertext]
 */
export function packPayload(payload: EncryptedPayload): Uint8Array {
  const { ciphertext, iv, salt } = payload;
  const header = new Uint8Array(4 + iv.length + 4 + salt.length);
  const view   = new DataView(header.buffer);
  view.setUint32(0, iv.length, false);
  header.set(iv, 4);
  view.setUint32(4 + iv.length, salt.length, false);
  header.set(salt, 4 + iv.length + 4);

  const result = new Uint8Array(header.length + ciphertext.length);
  result.set(header, 0);
  result.set(ciphertext, header.length);
  return result;
}

/**
 * Unpack a binary blob retrieved from Walrus into its components.
 */
export function unpackPayload(packed: ArrayBuffer): { ciphertext: ArrayBuffer; iv: Uint8Array; salt: Uint8Array } {
  const buf  = new Uint8Array(packed);
  const view = new DataView(packed);
  let offset = 0;

  const ivLen = view.getUint32(offset, false);
  offset += 4;
  const iv = buf.slice(offset, offset + ivLen);
  offset += ivLen;

  const saltLen = view.getUint32(offset, false);
  offset += 4;
  const salt = buf.slice(offset, offset + saltLen);
  offset += saltLen;

  const ciphertext = packed.slice(offset);
  return { ciphertext, iv, salt };
}

/**
 * Convert Uint8Array to hex string (for on-chain storage).
 */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Convert hex string back to Uint8Array.
 */
export function fromHex(hex: string): Uint8Array {
  const result = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    result[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return result;
}
