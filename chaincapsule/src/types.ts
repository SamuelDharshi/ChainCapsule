export interface Capsule {
  id: string;
  name: string;
  owner: string;
  beneficiary: string;
  walrusBlobId: string;
  ciphertext: string; // Base64 ciphertext
  fileName: string;
  fileType: string;
  fileSize: number;
  encKeyHint: string; // Hex representation of key, released on contract unlock
  unlockAfterMs: number; // 0 if inactivity mode
  inactivityDays: number; // 0 if fixed date mode
  lastHeartbeat: number; // Epoch timestamp ms
  isUnlocked: boolean;
  iv: string; // Hex IV
  salt: string; // Hex salt
  createdAt: number;
  description?: string;
}

export interface BlockchainState {
  currentTimeMs: number;
  blockHeight: number;
  walletAddress: string;
  walletBalance: number; // in SUI
  beneficiaryAddress: string;
  beneficiaryBalance: number;
}

export interface LogEvent {
  id: string;
  timestamp: number;
  type: 'success' | 'info' | 'warning' | 'error' | 'transaction';
  message: string;
  txHash?: string;
  details?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}
