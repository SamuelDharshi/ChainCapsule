/**
 * AES-256-GCM encryption and decryption utilities using native browser Web Crypto API.
 */

export interface EncryptionResult {
  ciphertext: string; // Base64 ciphertext
  rawKey: string;     // Hex representation of derived AES key
  iv: string;         // Hex IV
  salt: string;       // Hex salt
}

// Convert a Uint8Array into a hex string
export function uint8ArrayToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Convert a hex string into a Uint8Array
export function hexToUint8Array(hex: string): Uint8Array {
  const cleanHex = hex.replace(/\s+/g, "");
  const numBytes = cleanHex.length / 2;
  const arr = new Uint8Array(numBytes);
  for (let i = 0; i < numBytes; i++) {
    arr[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

// Convert an ArrayBuffer to a Base64 string
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Convert a Base64 string to an ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Encrypt file arrayBuffer using a client password via PBKDF2 + AES-GCM 256
 */
export async function encryptFile(file: File, password: string): Promise<EncryptionResult> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const keyMat = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const aesKey = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMat,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt"]
  );

  const fileBuffer = await file.arrayBuffer();
  
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    aesKey,
    fileBuffer
  );

  const rawKeyBuffer = await window.crypto.subtle.exportKey("raw", aesKey);
  const rawKeyArray = new Uint8Array(rawKeyBuffer);

  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    rawKey: uint8ArrayToHex(rawKeyArray),
    iv: uint8ArrayToHex(iv),
    salt: uint8ArrayToHex(salt),
  };
}

/**
 * Decrypt ciphertext Base64 using hex representations of key and IV
 */
export async function decryptBlob(
  ciphertextBase64: string,
  rawKeyHex: string,
  ivHex: string
): Promise<ArrayBuffer> {
  const ciphertextBytes = base64ToArrayBuffer(ciphertextBase64);
  const rawKeyBytes = hexToUint8Array(rawKeyHex);
  const ivBytes = hexToUint8Array(ivHex);

  const key = await window.crypto.subtle.importKey(
    "raw",
    rawKeyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  return window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBytes,
    },
    key,
    ciphertextBytes
  );
}
