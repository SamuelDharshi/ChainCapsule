# ChainCapsule

> **On-chain Time Capsule & Dead Man's Switch — Built on Sui + Walrus**
> Hackathon: Tatum × Build on Sui with Walrus · June 2025

[![Sui](https://img.shields.io/badge/Chain-Sui-4DA2FF?logo=sui)](https://sui.io)
[![Walrus](https://img.shields.io/badge/Storage-Walrus-00C4CC)](https://walrus.space)
[![Tatum](https://img.shields.io/badge/RPC-Tatum-7C3AED)](https://tatum.io)

---

## What is ChainCapsule?

ChainCapsule lets anyone **encrypt a file or message client-side**, store the ciphertext on **Walrus decentralized storage**, and program a **Sui Move smart contract** to release the decryption key:

- **After a fixed future date** (Time Capsule mode) — e.g., "open on my 60th birthday"
- **After N days of on-chain inactivity** (Dead Man's Switch) — e.g., "if I don't check in for 90 days, release to my family"

**One-liner:** *"Store your secrets on-chain. The blockchain unlocks them when you can't."*

---

## Live Demo

| Resource | Link |
|---|---|
| Frontend | `https://chain-capsule.vercel.app` *(update after deployment)* |
| Smart Contract | `https://suiscan.xyz/testnet/object/PACKAGE_ID` |
| Demo Video | *(link to 2:30 walkthrough)* |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Client)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  File → AES-256-GCM encryption (Web Crypto API)     │   │
│  │  Password → PBKDF2 key derivation (100k iterations) │   │
│  └──────────────────────────────────────────────────────┘   │
│                      ↓ ciphertext                            │
└─────────────────────────────────────────────────────────────┘
        │                              │
        ▼                              ▼
┌─────────────────┐        ┌──────────────────────┐
│  Walrus          │        │  Sui Move Contract    │
│  (PUT ciphertext)│        │  capsule::create()    │
│  → returns blobId│        │  stores:              │
│                  │        │   - walrus_blob_id    │
│  (GET ciphertext)│        │   - enc_key_hint      │
│  via aggregator  │        │   - unlock conditions │
└─────────────────┘        │   - beneficiary       │
                           └──────────────────────┘
                                      │
                           ┌──────────────────────┐
                           │  Tatum RPC Gateway    │
                           │  (all Sui JSON-RPC    │
                           │   calls via Tatum)    │
                           └──────────────────────┘
                                      │
                           ┌──────────────────────┐
                           │  Claude AI + MCP      │
                           │  Natural language     │
                           │  capsule queries      │
                           └──────────────────────┘
```

---

## Smart Contract (Move)

Located at `contracts/sources/capsule.move`.

### Capsule Struct
```move
struct Capsule has key, store {
  id:              UID,
  owner:           address,
  beneficiary:     address,
  walrus_blob_id:  String,      // Walrus blob ID of encrypted ciphertext
  enc_key_hint:    vector<u8>,  // Encrypted AES key — released on unlock
  unlock_after_ms: u64,         // Absolute epoch-ms; 0 = inactivity mode
  inactivity_days: u64,         // Days of silence before unlock; 0 = date mode
  last_heartbeat:  u64,         // Timestamp of last owner heartbeat
  created_at:      u64,
}
```

### Entry Functions
| Function | Who | Description |
|---|---|---|
| `create(blob_id, enc_key, beneficiary, unlock_ms, inactivity_d, clock, ctx)` | Owner | Creates & shares the capsule object |
| `heartbeat(cap, clock, ctx)` | Owner only | Resets `last_heartbeat` to now (dead man's switch reset) |
| `unlock(cap, clock, ctx)` | Beneficiary only | Verifies unlock condition via `sui::clock`, returns `enc_key_hint` |

### Deploy
```bash
# Install Sui CLI: https://docs.sui.io/references/cli
sui client publish --gas-budget 100000000 --skip-dependency-verification
# Copy the PACKAGE_ID from output → paste into .env.local
```

---

## Frontend Setup

### Prerequisites
- Node.js 18+
- A Sui wallet (Sui Wallet browser extension)
- Tatum API key (free at [tatum.io](https://tatum.io))

### Installation
```bash
cd app
cp .env.local.example .env.local
# Fill in your NEXT_PUBLIC_TATUM_KEY and NEXT_PUBLIC_PACKAGE_ID

npm install
npm run dev
# Open http://localhost:3000
```

### Environment Variables
```bash
NEXT_PUBLIC_TATUM_KEY=           # Tatum API key
NEXT_PUBLIC_SUI_NETWORK=testnet  # or "mainnet"
NEXT_PUBLIC_PACKAGE_ID=0x...     # After contract deploy
NEXT_PUBLIC_SUI_CLOCK_ID=0x6     # Sui shared Clock object
NEXT_PUBLIC_WALRUS_PUBLISHER=https://publisher.walrus-testnet.walrus.space
NEXT_PUBLIC_WALRUS_AGGREGATOR=https://aggregator.walrus-testnet.walrus.space
ANTHROPIC_API_KEY=               # Optional: for AI assistant
```

---

## User Flow

### Mode A — Time Capsule

1. Owner encrypts file with AES-256-GCM in browser
2. Uploads ciphertext to Walrus → receives `blobId`
3. Calls `capsule::create(blobId, encKey, beneficiary, unlockDateMs, 0)` on Sui via Tatum RPC
4. Shares the capsule Object ID with the beneficiary
5. **On unlock date:** Beneficiary calls `capsule::unlock` → Sui Clock verifies → receives `enc_key_hint`
6. Beneficiary fetches ciphertext from Walrus, decrypts in browser → downloads file

### Mode B — Dead Man's Switch

1. Same setup, but `unlock_after_ms=0, inactivity_days=90`
2. Owner visits dashboard periodically → clicks "I'm Alive" → `capsule::heartbeat` tx via Tatum
3. If owner goes silent for 90 days → beneficiary calls `unlock` → key released

---

## Security Notes

- **All encryption happens in the browser.** The plaintext file never leaves the client machine.
- **Walrus stores only ciphertext.** Even if Walrus were compromised, files are unreadable without the key.
- **The decryption key is stored on Sui.** Only accessible to the beneficiary after the unlock condition is verified by the smart contract.
- **No server, no database, no trust required.** The entire system runs on Walrus + Sui.
- **Key derivation:** PBKDF2 with 100,000 iterations, SHA-256, 16-byte random salt.
- **Encryption:** AES-256-GCM with 12-byte random IV per file.

---

## Tatum Integration

All Sui blockchain calls go through the Tatum gateway:

```typescript
const TATUM_RPC = "https://sui-mainnet.gateway.tatum.io";

const res = await fetch(TATUM_RPC, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.NEXT_PUBLIC_TATUM_KEY,
  },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
});
```

The AI assistant (`/api/capsule-ai`) also uses Tatum to fetch live capsule state and passes it to Claude for natural language responses.

---

## Walrus Integration

```typescript
// Upload encrypted blob (ciphertext never unencrypted)
const res = await fetch(`${WALRUS_PUBLISHER}/v1/blobs?epochs=5`, {
  method: "PUT",
  headers: { "Content-Type": "application/octet-stream" },
  body: ciphertext, // Uint8Array — already AES-256-GCM encrypted
});
const { blobId } = res.json().newlyCreated.blobObject;

// Fetch for decryption
const ciphertext = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`).arrayBuffer();
```

**Key insight:** Only the `blobId` (a short string) is stored on Sui. The actual data lives on Walrus. This keeps Sui storage costs minimal while using Walrus for what it's designed for.

---

## Tatum Platform Gaps Documented

| Gap | ChainCapsule's Contribution |
|---|---|
| No Walrus blob upload example in Tatum docs | This README is the first encrypted Walrus+Tatum reference |
| Tatum MCP has no Sui Clock query examples | The AI capsule status tool fills this gap |
| No heartbeat/cron pattern documented for Sui dApps | The dashboard heartbeat button + optional Cloudflare Worker pattern |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | Sui (Testnet → Mainnet) |
| RPC | Tatum (`https://sui-mainnet.gateway.tatum.io`) |
| Storage | Walrus (encrypted ciphertext blobs) |
| Contract | Move — `sui::clock` for time conditions |
| Encryption | Web Crypto API (AES-256-GCM, PBKDF2) — client-side |
| Frontend | Next.js 14 + TypeScript |
| Wallet | `@mysten/dapp-kit` |
| AI | Anthropic Claude + Tatum RPC for MCP context |
| Deployment | Vercel (frontend) |

---

## Pre-Submission Checklist

- [ ] Deployed on Sui Mainnet
- [ ] Walrus stores actual encrypted ciphertext (not just metadata)
- [ ] Walrus blob ID stored inside Sui Move Capsule object
- [ ] All Sui RPC calls use `https://sui-mainnet.gateway.tatum.io`
- [ ] Tatum MCP used for AI capsule status queries
- [ ] Heartbeat function demonstrated in demo video
- [ ] Beneficiary unlock flow demonstrated
- [ ] GitHub repo public, README explains encryption + Walrus + Tatum
- [ ] Demo video shows live SuiScan transaction
- [ ] Posted on X/LinkedIn tagging @Tatum_io @WalrusFoundation @SuiNetwork

---

*Built for the Tatum × Walrus Hackathon · May 23 – June 6, 2025*  
*Store. Build. Ship. 🚀*
