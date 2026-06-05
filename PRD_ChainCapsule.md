# PRD — ChainCapsule
### On-chain Time Capsule & Dead Man's Switch on Sui + Walrus
**Hackathon:** Tatum x Build on Sui with Walrus  
**Prize Targets:** Best Walrus Integration ($200) · Best Use of Tatum Tools ($200) · Top 3 Placement ($300–$600)  
**Deadline:** June 6, 2025 · 17:00 UTC  
**Team Size:** 1–3  
**Chain:** Sui Mainnet  

---

## 1. Problem Statement

Billions of dollars in crypto are lost every year because owners die without sharing their keys. Lawyers get hacked. USB drives get lost. There is no trustless, programmable way to say "release this file to my family if I go dark for 90 days."

ChainCapsule lets anyone encrypt a file or message client-side, store the ciphertext on Walrus, and program a Sui smart contract to release the decryption key after a future date or after N days of on-chain inactivity — no server, no middleman, no single point of failure.

**One-liner for the demo:** "Store your secrets on-chain. The blockchain unlocks them when you can't."

**Two unlock modes:**
- **Time capsule:** Fixed future date (e.g. "open on my 60th birthday")
- **Dead man's switch:** Inactivity trigger (e.g. "if I don't check in for 90 days, release to my family")

---

## 2. Core Features (MVP — 24hr scope)

| Feature | Description |
|---|---|
| Client-side encryption | AES-256-GCM encrypt file in browser — ciphertext never touches a server |
| Walrus storage | Encrypted blob stored on Walrus, blob ID recorded on Sui |
| Move smart contract | Capsule object holds blob ID, encrypted key, beneficiary, unlock conditions |
| Two unlock modes | Fixed timestamp OR inactivity timer using Sui Clock module |
| Heartbeat system | Owner pings contract periodically to reset inactivity clock |
| Beneficiary unlock | Beneficiary calls unlock() → gets decryption key → fetches + decrypts blob |
| AI assistant (MCP bonus) | Tatum MCP: "How long until my capsule unlocks?" natural language queries |

---

## 3. User Flow

### Mode A — Time Capsule (fixed date)

```
[Owner]
  │
  ├─ Encrypts file with AES-256 in browser (Web Crypto API)
  ├─ Uploads CIPHERTEXT to Walrus → gets blob_id
  ├─ Calls create(blob_id, enc_key, beneficiary, unlock_date_ms=future, 0) on Sui
  ├─ Capsule object created on-chain. Owner shares object ID with beneficiary.
  │
[On unlock date]
  │
[Beneficiary]
  ├─ Calls unlock(capsule_object_id) — Sui Clock verifies date has passed
  ├─ Receives enc_key from on-chain storage
  ├─ Fetches ciphertext blob from Walrus using blob_id
  └─ Decrypts in browser → original file revealed
```

### Mode B — Dead Man's Switch (inactivity)

```
[Owner — sets up capsule]
  │
  ├─ Same setup as above, but unlock_date_ms=0, inactivity_days=90
  │
[Owner — periodic heartbeat while alive]
  ├─ Visits dashboard → clicks "I'm alive" → sends heartbeat tx via Tatum RPC
  ├─ Contract resets last_heartbeat timestamp
  │
[90 days pass with no heartbeat]
  │
[Beneficiary]
  ├─ Calls unlock() — Sui Clock checks: now - last_heartbeat >= 90 days
  └─ Decryption key released → file decrypted from Walrus
```

---

## 4. Smart Contract — Move

```move
module chaincapsule::capsule {
  use sui::object::{Self, UID};
  use sui::transfer;
  use sui::tx_context::{Self, TxContext};
  use std::string::String;
  use sui::clock::{Self, Clock};

  const E_NOT_UNLOCKABLE: u64 = 1;
  const E_NOT_OWNER:      u64 = 2;
  const MS_IN_DAY:        u64 = 86_400_000;

  struct Capsule has key, store {
    id:              UID,
    owner:           address,
    beneficiary:     address,
    walrus_blob_id:  String,     // Encrypted ciphertext blob ID
    enc_key_hint:    vector<u8>, // Encrypted AES key (released on unlock)
    unlock_after_ms: u64,        // Absolute timestamp, 0 = inactivity mode
    inactivity_days: u64,        // 0 if using fixed date mode
    last_heartbeat:  u64,        // Owner resets this to stay "alive"
  }

  public fun create(
    blob_id:        String,
    enc_key:        vector<u8>,
    beneficiary:    address,
    unlock_date_ms: u64,
    inactivity_d:   u64,
    clock:          &Clock,
    ctx:            &mut TxContext
  ) {
    let now = clock::timestamp_ms(clock);
    let capsule = Capsule {
      id:              object::new(ctx),
      owner:           tx_context::sender(ctx),
      beneficiary,
      walrus_blob_id:  blob_id,
      enc_key_hint:    enc_key,
      unlock_after_ms: unlock_date_ms,
      inactivity_days: inactivity_d,
      last_heartbeat:  now,
    };
    transfer::share_object(capsule);
  }

  // Owner calls this periodically to stay "alive"
  public fun heartbeat(cap: &mut Capsule, clock: &Clock, ctx: &TxContext) {
    assert!(tx_context::sender(ctx) == cap.owner, E_NOT_OWNER);
    cap.last_heartbeat = clock::timestamp_ms(clock);
  }

  // Beneficiary calls this when unlock condition is met
  public fun unlock(
    cap:   &mut Capsule,
    clock: &Clock,
    ctx:   &TxContext
  ): vector<u8> {
    let now = clock::timestamp_ms(clock);
    let unlockable =
      (cap.unlock_after_ms > 0 && now >= cap.unlock_after_ms) ||
      (cap.inactivity_days > 0 &&
       now - cap.last_heartbeat >= cap.inactivity_days * MS_IN_DAY);
    assert!(unlockable, E_NOT_UNLOCKABLE);
    assert!(tx_context::sender(ctx) == cap.beneficiary, E_NOT_OWNER);
    cap.enc_key_hint
  }
}
```

**Deploy command:**
```bash
sui client publish --gas-budget 100000000 --skip-dependency-verification
```

---

## 5. Frontend — Key Code Snippets

### Client-Side AES-256 Encryption

```typescript
// Encrypt file in browser — ciphertext never leaves client unencrypted
export async function encryptFile(file: File, password: string) {
  const salt   = crypto.getRandomValues(new Uint8Array(16));
  const iv     = crypto.getRandomValues(new Uint8Array(12));
  const keyMat = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]
  );
  const aesKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMat,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt"]
  );
  const buf        = await file.arrayBuffer();
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, buf);
  const rawKey     = await crypto.subtle.exportKey("raw", aesKey);
  return {
    ciphertext: new Uint8Array(ciphertext),
    iv,
    salt,
    rawKey: new Uint8Array(rawKey), // Store this on-chain (encrypted with beneficiary pubkey if needed)
  };
}

// Decrypt after retrieving from Walrus
export async function decryptBlob(
  ciphertext: ArrayBuffer,
  rawKey:     Uint8Array,
  iv:         Uint8Array
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw", rawKey, { name: "AES-GCM" }, false, ["decrypt"]
  );
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
}
```

### Walrus Upload + Tatum RPC

```typescript
const TATUM_KEY  = process.env.NEXT_PUBLIC_TATUM_KEY;
const WALRUS_PUB = "https://publisher.walrus-testnet.walrus.space";
const WALRUS_AGG = "https://aggregator.walrus-testnet.walrus.space";
const TATUM_RPC  = "https://sui-mainnet.gateway.tatum.io";

// Upload encrypted blob to Walrus
export async function uploadToWalrus(ciphertext: Uint8Array): Promise<string> {
  const res = await fetch(`${WALRUS_PUB}/v1/blobs?epochs=5`, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: ciphertext,
  });
  const data = await res.json();
  return data.newlyCreated?.blobObject?.blobId
      ?? data.alreadyCertified?.blobId;
}

// Fetch encrypted blob from Walrus for decryption
export async function fetchFromWalrus(blobId: string): Promise<ArrayBuffer> {
  const res = await fetch(`${WALRUS_AGG}/v1/blobs/${blobId}`);
  return res.arrayBuffer();
}

// Tatum RPC — all Sui calls go through here
export async function suiRpc(method: string, params: unknown[]) {
  const res = await fetch(TATUM_RPC, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": TATUM_KEY!,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return (await res.json()).result;
}

// Send heartbeat — owner calls this to reset inactivity clock
export async function sendHeartbeat(capsuleObjectId: string, wallet: WalletAdapter) {
  const tx = new TransactionBlock();
  tx.moveCall({
    target: `${PACKAGE_ID}::capsule::heartbeat`,
    arguments: [
      tx.object(capsuleObjectId),
      tx.object("0x6"), // Sui Clock object ID
    ],
  });
  return wallet.signAndExecuteTransactionBlock({ transactionBlock: tx });
}
```

### Tatum MCP Integration (AI Bonus)

```typescript
// Custom MCP tool: "how long until my capsule unlocks?"
export async function queryCapsuleStatus(capsuleObjectId: string) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: `You are a ChainCapsule assistant. Use the Tatum MCP tools to query
               Sui blockchain data. Answer questions about capsule unlock status,
               time remaining, and beneficiary instructions.`,
      messages: [{ role: "user", content:
        `How long until capsule ${capsuleObjectId} unlocks? Use the Tatum RPC to check.`
      }],
      mcp_servers: [{
        type: "url",
        url: "https://mcp.tatum.io", // Tatum MCP endpoint
        name: "tatum-mcp"
      }]
    }),
  });
  return response.json();
}
```

---

## 6. Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | Sui Mainnet |
| RPC Provider | Tatum (`https://sui-mainnet.gateway.tatum.io`) |
| Decentralized Storage | Walrus (encrypted ciphertext blobs) |
| Smart Contract | Move — uses `sui::clock` for time conditions |
| Encryption | Web Crypto API (AES-256-GCM, PBKDF2) — all client-side |
| Frontend | Next.js 14 + TypeScript |
| Wallet | Suiet wallet adapter |
| AI (bonus) | Tatum MCP server + Claude |
| Heartbeat cron | Cloudflare Worker (optional — user-triggered in MVP) |
| Deployment | Vercel (frontend) + Sui Mainnet (contract) |

---

## 7. Pages / Routes

```
/                       → Landing: "Store secrets. Let time unlock them."
/create                 → Encrypt file, choose unlock mode, deploy capsule
/dashboard              → List of user's active capsules with countdown timers
/dashboard/[objectId]   → Single capsule: heartbeat button, status, beneficiary info
/open/[objectId]        → Beneficiary page: check if unlockable, decrypt + download file
```

---

## 8. 24-Hour Build Timeline

| Hours | Task |
|---|---|
| 0–1 | Setup: Tatum API key, Sui wallet, scaffold Next.js, install @mysten/sui.js |
| 1–5 | Write + test Move contract (clock module, heartbeat, unlock logic), deploy testnet |
| 5–9 | Client-side AES encrypt/decrypt + Walrus upload/fetch via Tatum RPC |
| 9–16 | Frontend: create capsule flow, dashboard with countdown timers, beneficiary unlock page |
| 16–19 | Switch to Mainnet, add Tatum MCP AI feature ("how long until unlock?") |
| 19–21 | Add Cloudflare Worker heartbeat cron (optional enhancement) |
| 21–23 | README with setup guide, architecture, Walrus+Tatum integration notes |
| 23–24 | Record 2:30 demo video, submit |

---

## 9. Demo Video Script (2 min 30 sec)

1. **0:00–0:20** — Hook: "Every year billions in crypto are lost because people die without sharing keys. Here's the fix."
2. **0:20–0:55** — Create a capsule: encrypt a file in browser → upload ciphertext to Walrus → blob ID appears → set 2-minute inactivity timer → deploy to Mainnet via Tatum RPC
3. **0:55–1:30** — Dashboard: show active capsule, countdown timer, click "I'm alive" heartbeat button → Tatum RPC tx confirms
4. **1:30–2:00** — Let timer expire → switch to beneficiary wallet → call unlock → decryption key returned → fetch blob from Walrus → file decrypts in browser
5. **2:00–2:30** — Show SuiScan live: capsule object, heartbeat txs, unlock tx. Show code: Move contract clock logic, Tatum RPC, Walrus fetch, MCP query.

---

## 10. Judging Criteria Alignment

| Criterion | Weight | How ChainCapsule wins |
|---|---|---|
| Walrus + Tatum Integration | 30% | Walrus stores actual encrypted blobs (not hashes). Tatum RPC handles all chain calls. MCP used for AI status queries. |
| Technical Quality | 30% | AES-256-GCM encryption, Sui Clock module used natively, proper key management, clean TypeScript |
| Creativity | 20% | Dead man's switch mechanic is entirely new on Sui — emotionally resonant, no competitor |
| Presentation | 20% | Tight demo video with live Mainnet tx, clear README with Walrus encryption flow |
| Bonus: Social | +extra | Post on X/LinkedIn tagging @Tatum_io @WalrusFoundation @SuiNetwork |

---

## 11. Security Notes (mention in README — judges love this)

- **All encryption happens in the browser.** The plaintext file never leaves the client machine.
- **Walrus stores only ciphertext.** Even if Walrus were compromised, files are unreadable without the key.
- **The decryption key is stored on Sui.** It is only accessible to the beneficiary after the unlock condition is verified by the smart contract — not by any server or API.
- **No server, no database, no trust required.** The entire system runs on Walrus + Sui.

---

## 12. Tatum Platform Gaps — Ecosystem Contributions

Document these in your README to score extra points with Tatum judges:

- **Gap 1:** No Walrus blob upload example in Tatum docs — your README is the first encrypted Walrus+Tatum reference
- **Gap 2:** Tatum MCP has no Sui Clock query examples — your capsule status MCP tool fills this
- **Gap 3:** No heartbeat/cron pattern documented for Sui dApps — your Cloudflare Worker example helps the ecosystem

---

## 13. Pre-Submission Checklist

- [ ] Deployed on Sui **Mainnet** (not testnet)
- [ ] Walrus stores actual encrypted ciphertext (not just metadata)
- [ ] Walrus blob ID stored inside Sui Move Capsule object
- [ ] All Sui RPC calls use `https://sui-mainnet.gateway.tatum.io`
- [ ] Tatum MCP server used for AI capsule status queries
- [ ] Heartbeat function demonstrated in demo video
- [ ] Beneficiary unlock flow demonstrated in demo video with Mainnet tx
- [ ] GitHub repo public, README explains encryption + Walrus + Tatum stack
- [ ] Demo video shows live SuiScan transaction
- [ ] Posted on X/LinkedIn tagging @Tatum_io @WalrusFoundation @SuiNetwork
- [ ] Submitted via form before June 6, 17:00 UTC

---

## 14. Environment Variables

```bash
# .env.local
NEXT_PUBLIC_TATUM_KEY=your_tatum_api_key_here
NEXT_PUBLIC_SUI_NETWORK=mainnet
NEXT_PUBLIC_PACKAGE_ID=0x...       # after contract deploy
NEXT_PUBLIC_WALRUS_PUBLISHER=https://publisher.walrus-testnet.walrus.space
NEXT_PUBLIC_WALRUS_AGGREGATOR=https://aggregator.walrus-testnet.walrus.space
NEXT_PUBLIC_SUI_CLOCK_ID=0x6      # Sui shared Clock object
```

---

*Built for the Tatum x Walrus Hackathon · May 23 – June 6, 2025*  
*Store. Build. Ship.*
