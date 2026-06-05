<div align="center">

```
  ██████╗██╗  ██╗ █████╗ ██╗███╗   ██╗ ██████╗ █████╗ ██████╗ ███████╗██╗   ██╗██╗     ███████╗
 ██╔════╝██║  ██║██╔══██╗██║████╗  ██║██╔════╝██╔══██╗██╔══██╗██╔════╝██║   ██║██║     ██╔════╝
 ██║     ███████║███████║██║██╔██╗ ██║██║     ███████║██████╔╝███████╗██║   ██║██║     █████╗
 ██║     ██╔══██║██╔══██║██║██║╚██╗██║██║     ██╔══██║██╔═══╝ ╚════██║██║   ██║██║     ██╔══╝
 ╚██████╗██║  ██║██║  ██║██║██║ ╚████║╚██████╗██║  ██║██║     ███████║╚██████╔╝███████╗███████╗
  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝ ╚═════╝╚═╝  ╚═╝╚═╝     ╚══════╝ ╚═════╝ ╚══════╝╚══════╝
```

### 🔒 Decentralized Time Capsules & Dead Man's Switches on Sui + Walrus

[![Sui](https://img.shields.io/badge/Chain-Sui%20Testnet-4DA2FF?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0tMiAxNWwtNS01IDEuNDEtMS40MUwxMCAxNC4xN2w3LjU5LTcuNTlMMTkgOGwtOSA5eiIvPjwvc3ZnPg==)](https://sui.io)
[![Walrus](https://img.shields.io/badge/Storage-Walrus-00C4CC?style=for-the-badge)](https://walrus.space)
[![Tatum](https://img.shields.io/badge/RPC-Tatum%20Gateway-7C3AED?style=for-the-badge)](https://tatum.io)
[![Move](https://img.shields.io/badge/Contract-Move%20Lang-FF6B35?style=for-the-badge)](https://docs.sui.io/concepts/sui-move-concepts)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

> **"Store your secrets on-chain. The blockchain unlocks them when you can't."**
>
> *Tatum × Build on Sui with Walrus Hackathon · May 23 – June 6, 2025*

</div>

---

## 📖 Table of Contents

1. [The Idea](#-the-idea)
2. [How It Works — The Big Picture](#-how-it-works--the-big-picture)
3. [Two Operating Modes](#-two-operating-modes)
4. [Architecture Diagram](#-architecture-diagram)
5. [Sequence Diagrams](#-sequence-diagrams)
6. [Application Flow (ASCII)](#-application-flow-ascii)
7. [Smart Contract Deep Dive](#-smart-contract-deep-dive)
8. [Cryptography Explained](#-cryptography-explained)
9. [Tech Stack](#-tech-stack)
10. [Setup & Installation](#-setup--installation)
11. [Using the App — Step by Step](#-using-the-app--step-by-step)
12. [Security Model](#-security-model)
13. [Tatum & Walrus Integration](#-tatum--walrus-integration)
14. [Project Structure](#-project-structure)

---

## 💡 The Idea

### Problem

Imagine you have critical secrets — a cryptocurrency seed phrase, a private letter to your family, legal documents, or an emergency decryption key. You face a dilemma:

```
╔══════════════════════════════════════════════════════════════╗
║                   THE DIGITAL SECRETS DILEMMA                ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Option A: Store on a cloud drive                           ║
║  ❌ Company can be hacked, subpoenaed, or shut down          ║
║  ❌ You need to trust a centralized third party              ║
║                                                              ║
║  Option B: Store on your hard drive                         ║
║  ❌ Drive fails, gets stolen, or you die without sharing it  ║
║  ❌ No automatic release mechanism                           ║
║                                                              ║
║  Option C: Share with a lawyer / trusted person             ║
║  ❌ Human can be coerced, forget, or die themselves          ║
║  ❌ No time-lock guarantee                                   ║
║                                                              ║
║  Option D: ChainCapsule ✅                                   ║
║  ✅ Encrypted in YOUR browser — never seen by any server    ║
║  ✅ Stored on decentralized Walrus storage                  ║
║  ✅ Released ONLY when Sui blockchain conditions are met     ║
║  ✅ Zero trust required. Code is the contract.              ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

### Solution

**ChainCapsule** is a decentralized application that lets you:

1. **Encrypt** any file or message entirely inside your browser using AES-256-GCM (military grade)
2. **Store** the ciphertext (encrypted blob) on Walrus — a decentralized storage network built for Sui
3. **Program** a Sui Move smart contract that acts as a cryptographic time-lock safe
4. **Release** the decryption key automatically when programmed conditions are met — either a future timestamp or a period of owner inactivity

The entire system runs without any central server. No database. No admin keys. The smart contract IS the escrow. Sui's clock IS the timer. Walrus IS the storage.

---

## 🔍 How It Works — The Big Picture

```
 YOUR BROWSER                    SUI BLOCKCHAIN                 WALRUS STORAGE
 ───────────                     ──────────────                 ──────────────

 ┌───────────────┐               ┌──────────────────┐          ┌─────────────────┐
 │               │               │                  │          │                 │
 │  Your Secret  │──encrypt──→   │  Capsule Object  │          │  Encrypted Blob │
 │  File / Text  │   (AES-256)   │                  │          │                 │
 │               │               │  ┌────────────┐  │ ←blobId─ │  [gibberish..] │
 └───────────────┘               │  │ walrus_    │  │          │  [encrypted..]  │
                                 │  │ blob_id ───┼──┼──────────│  [data.......]  │
 ┌───────────────┐               │  │            │  │          │                 │
 │  AES-256 Key  │──store──────→ │  │ enc_key_   │  │          └─────────────────┘
 │  (derived     │               │  │ hint       │  │
 │  from passwd) │               │  │            │  │           Walrus keeps only
 └───────────────┘               │  │ unlock_    │  │           ciphertext. Useless
         │                       │  │ conditions │  │           without the key.
         │                       │  └────────────┘  │
         │                       │                  │
         │                       │  ┌────────────┐  │
         │  UNLOCK CONDITION MET │  │ SUI CLOCK  │  │
         │  ←──────────────────────  │  (oracle)  │  │
         │                       │  └────────────┘  │
         ▼                       │                  │
 ┌───────────────┐               └──────────────────┘
 │  Decrypt File │  ←── key released only when
 │  in Browser   │       conditions verified on-chain
 └───────────────┘
```

---

## 🎭 Two Operating Modes

### Mode A — Time Capsule ⏰

Set a future date. The capsule unlocks on that exact date, verified by the Sui blockchain's built-in clock.

```
       TODAY                                          FUTURE DATE
         │                                                 │
         │  ┌─────────────────────────────────────────┐   │
  OWNER  │  │  Encrypts file, deploys capsule object  │   │
  ───────┼──│  with unlock_date = June 6, 2030        │   │
         │  └─────────────────────────────────────────┘   │
         │                                                 │
  CHAIN  │  ███████████████████████████████████████████████│──→
         │  │                LOCKED                    │   │
         │  └──────────── SUI CLOCK ───────────────────┘   │
         │                                                 │
BENEFI-  │                                                 │  ┌─────────────────┐
CIARY    │                                                 │  │  Calls unlock() │
  ───────┼─────────────────────────────────────────────────┼──│  Gets AES key   │
         │                                                 │  │  Downloads file  │
         │                                                 │  └─────────────────┘
```

**Use cases:** Inheritance letters, future birthday surprises, legal document release, scheduled announcement, post-mortem key handover.

---

### Mode B — Dead Man's Switch 💀

The capsule unlocks if the owner fails to send a heartbeat transaction within N days. As long as the owner regularly "checks in", the capsule stays locked. Silence = release.

```
  DAY 0         DAY 30        DAY 60        DAY 90       DAY 120
    │              │             │             │              │
    │   DEPLOY     │  HEARTBEAT  │  HEARTBEAT  │    SILENCE   │  UNLOCK
    ▼              ▼             ▼             ▼              ▼
────●──────────────●─────────────●─────────────●──────────────●────→
    │              │             │             │              │
    │  ╔═══════╗  │  ╔═══════╗  │  ╔═══════╗  │ ╔═══════╗   │ ╔══════╗
    │  ║ OWNER ║  │  ║ ALIVE ║  │  ║ ALIVE ║  │ ║  ???  ║   │ ║ KEY  ║
    │  ║ ALIVE ║  │  ║  ✅   ║  │  ║  ✅   ║  │ ║       ║   │ ║RELEA-║
    │  ╚═══════╝  │  ╚═══════╝  │  ╚═══════╝  │ ╚═══════╝   │ ║ SED  ║
                                                             │ ╚══════╝
                                              ← 30-day window →
                                               (inactivity limit)
```

**Use cases:** Crypto seed phrase release to family, whistleblower file release, emergency document access, organizational access key backup.

---

## 🏗 Architecture Diagram

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                          CHAINCAPSULE SYSTEM ARCHITECTURE                    ║
╚═══════════════════════════════════════════════════════════════════════════════╝

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                        USER'S BROWSER                                   │
  │                                                                         │
  │   ┌──────────────────┐    ┌──────────────────┐    ┌────────────────┐   │
  │   │  React / Vite    │    │  Web Crypto API   │    │ @mysten/       │   │
  │   │  UI Components   │    │  AES-256-GCM      │    │ dapp-kit       │   │
  │   │                  │    │  PBKDF2 100k iter │    │ Wallet Connect │   │
  │   │  • Landing Page  │    │                   │    │                │   │
  │   │  • Create Form   │    │  encryptFile()    │    │ Suiet / Sui    │   │
  │   │  • Dashboard     │    │  decryptBlob()    │    │ Wallet         │   │
  │   │  • Unlock Page   │    │                   │    │                │   │
  │   │  • AI Chat       │    │  ← ALL IN BROWSER │    │ signAndExecute │   │
  │   └──────────────────┘    └──────────────────┘    └────────────────┘   │
  │            │                       │                       │             │
  └────────────┼───────────────────────┼───────────────────────┼─────────────┘
               │                       │                       │
               ▼                       ▼                       ▼
  ┌──────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
  │   GEMINI AI SERVER   │  │  WALRUS TESTNET      │  │  SUI BLOCKCHAIN     │
  │                      │  │                      │  │                     │
  │  Express.js + Vite   │  │  PUT /v1/blobs       │  │  TATUM RPC GATEWAY  │
  │                      │  │  (upload ciphertext) │  │  sui-mainnet.       │
  │  /api/chat endpoint  │  │                      │  │  gateway.tatum.io   │
  │  Gemini Flash 1.5    │  │  publisher.walrus-   │  │                     │
  │  context: capsules   │  │  testnet.walrus.space│  │  JSON-RPC 2.0       │
  │  + blockchain state  │  │                      │  │                     │
  │                      │  │  GET /v1/blobs/{id}  │  │  suix_queryEvents   │
  │  AI Oracle interface │  │  (download for       │  │  sui_getObject      │
  │  for user questions  │  │   decryption)        │  │  sui_executeTransact│
  └──────────────────────┘  │                      │  │                     │
                            │  aggregator.walrus-  │  │  ┌───────────────┐  │
                            │  testnet.walrus.space│  │  │ MOVE CONTRACT │  │
                            └─────────────────────┘  │  │               │  │
                                                     │  │ capsule.move  │  │
                                                     │  │               │  │
                                                     │  │ create()      │  │
                                                     │  │ heartbeat()   │  │
                                                     │  │ unlock()      │  │
                                                     │  │               │  │
                                                     │  │ SUI CLOCK 0x6 │  │
                                                     │  └───────────────┘  │
                                                     └─────────────────────┘
```

---

## 📊 Sequence Diagrams

### Creating a Time Capsule

```
  Owner      Browser      Walrus      Sui Chain     Tatum RPC
    │           │            │             │              │
    │ Upload    │            │             │              │
    │ file +    │            │             │              │
    │ password  │            │             │              │
    ├──────────►│            │             │              │
    │           │            │             │              │
    │           │ encryptFile()            │              │
    │           │ PBKDF2 → AES key        │              │
    │           │ AES-256-GCM encrypt     │              │
    │           │◄───────────│            │              │
    │           │            │             │              │
    │           │ PUT /v1/blobs            │              │
    │           │ (IV+ciphertext)          │              │
    │           ├───────────►│             │              │
    │           │            │ Store blob  │              │
    │           │            │◄────────────│             │
    │           │            │             │              │
    │           │◄──blobId───│             │              │
    │           │            │             │              │
    │           │ buildCreateTx(           │              │
    │           │   blobId, AESkey,        │              │
    │           │   beneficiary,           │              │
    │           │   unlockDateMs)          │              │
    │           ├─────────────────────────►│              │
    │           │            │             │ signAndExec  │
    │           │            │             ├─────────────►│
    │           │            │             │              │
    │           │            │             │◄──txDigest───│
    │           │            │             │              │
    │           │◄────────── capsuleObjectId ─────────────│
    │           │            │             │              │
    │ ✅ Capsule Created!     │             │              │
    │◄──────────│            │             │              │
```

---

### Sending a Heartbeat (Dead Man's Switch)

```
  Owner      Browser      Sui Chain     Tatum RPC     Wallet
    │           │             │              │            │
    │ Click     │             │              │            │
    │ "Sign     │             │              │            │
    │  Heartbeat"             │              │            │
    ├──────────►│             │              │            │
    │           │             │              │            │
    │           │ buildHeartbeatTx(capsuleId)│            │
    │           │             │              │            │
    │           │ signAndExecuteTransaction  │            │
    │           ├─────────────────────────────────────────►
    │           │             │              │            │
    │           │             │              │ Prompt     │
    │           │             │              │ user to    │
    │           │             │              │ approve    │
    │           │             │              │◄───────────│
    │           │             │              │            │
    │           │             │              │ Broadcast  │
    │           │             │◄─────────────│            │
    │           │             │              │            │
    │           │             │ update       │            │
    │           │             │ last_        │            │
    │           │             │ heartbeat    │            │
    │           │             │ = NOW        │            │
    │           │◄──txDigest──│              │            │
    │           │             │              │            │
    │ ❤️ Timer Reset!          │              │            │
    │◄──────────│             │              │            │
```

---

### Unlocking and Decrypting (Beneficiary)

```
 Beneficiary   Browser      Sui Chain    Walrus       Local Memory
     │            │             │            │              │
     │ Connect    │             │            │              │
     │ wallet +   │             │            │              │
     │ select cap │             │            │              │
     ├───────────►│             │            │              │
     │            │             │            │              │
     │            │ buildUnlockTx(capsuleId) │              │
     │            ├────────────►│            │              │
     │            │             │            │              │
     │            │             │ verify     │              │
     │            │             │ conditions │              │
     │            │             │ via SUI    │              │
     │            │             │ CLOCK 0x6  │              │
     │            │             │            │              │
     │            │◄──enc_key───│            │              │
     │            │    released │            │              │
     │            │             │            │              │
     │            │ GET /v1/blobs/{walrusBlobId}            │
     │            ├─────────────────────────►│              │
     │            │             │            │              │
     │            │◄────────────────[IV+ciphertext]─────────│
     │            │             │            │              │
     │            │ split: IV (first 12 bytes)              │
     │            │       + ciphertext (rest)               │
     │            │                          │              │
     │            │ decryptBlob(cipher, key, IV)            │
     │            ├──────────────────────────────────────────►
     │            │             │            │              │
     │            │◄──────────────────────plaintext─────────│
     │            │             │            │              │
     │ 🎉 Download │             │            │              │
     │ plaintext  │             │            │              │
     │◄───────────│             │            │              │
```

---

## 📱 Application Flow (ASCII)

### Landing Page

```
┌─────────────────────────────────────────────────────────────────────┐
│  ChainCapsule                 [Concept] [Deploy] [Dashboard] [Open] │
│  WALRUS + SUI INTEGRATION                          [Connect Wallet]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ✦ ✦ ✦   LIVE ON SUI TESTNET — POWERED BY TATUM RPC   ✦ ✦ ✦      │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                                              ● SUI NODE LIVE  │  │
│  │                   ·  ✦ · * ·  ✦             │  │
│  │          · *  ✦ ·   [GALAXY]  · ✦ ·  *      │  │
│  │         ·  ·  ✦   ·    ·   ✦  ·   · *       │  │
│  │                                              │  │
│  │        DECENTRALIZED  TIME CAPSULES          │  │
│  │         & DEAD MAN'S  SWITCHES.              │  │
│  │                                              │  │
│  │  ChainCapsule is on-chain Time Capsule &     │  │
│  │  Dead Man's Switch on Sui + Walrus...        │  │
│  │                                              │  │
│  │  ● CLIENT-SIDE AES-256  ● WALRUS  ● SUI VM  │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌──────────────────┐  ┌──────────────────────────┐ │
│  │ DECENTRALIZED    │  │  REAL-TIME RPC STATE      │ │
│  │ Cryptographic    │  │  Block: #31,284,910       │ │
│  │ Credentials      │  │  SUI TIME: 21:30:45       │ │
│  └──────────────────┘  └──────────────────────────┘ │
│                                                     │
│  [Deploy Capsule Switch →]   [View Registry Dashboard] │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Deploy Capsule Page

```
┌─────────────────────────────────────────────────────────────────────┐
│  🔒 Deploy Cryptographic Capsule                                    │
│  All data is encrypted in your browser before storing on Walrus     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Capsule Name: [BTC Seed Phrase Backup            ]                 │
│                                                                     │
│  Instructions: [Give to family if I'm gone 90 days ]               │
│                                                                     │
│  ┌─────────────────────────────┐  ┌───────────────────────────┐    │
│  │  ⏰  Time Capsule  [MODE A] │  │  💀 Dead Man's Switch     │    │
│  │                             │  │              [MODE B]      │    │
│  │  Unlocks on a fixed future  │  │  Releases if you fail to   │    │
│  │  date/timer. Ideal for      │  │  check in (heartbeat)      │    │
│  │  birthdays, wills...        │  │  within N inactivity days  │    │
│  └─────────────────────────────┘  └───────────────────────────┘    │
│                                                                     │
│  Time Release Delay ───────────────────[======]─── 120s           │
│                                                                     │
│  Beneficiary Address: [0xbeneficiary_address...                  ] │
│                                                                     │
│  Secret Passphrase: [●●●●●●●●●●●●●●●●●                          ] │
│  ⚠️ Derives AES-256 key via PBKDF2 (100k iterations)               │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │     ↑  Drag and drop file here, or click to choose          │   │
│  │                                                             │   │
│  │    Secure backups for seed phrases, legal docs, letters     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [🔒 ENCRYPT & DEPLOY TIME CAPSULE                              ]   │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Dashboard Page

```
┌─────────────────────────────────────────────────────────────────────┐
│  📡 Core Capsule Registry                    [Refresh] [Search...] │
│  SUI Testnet Ledger. Currently managing 2 shared contract objects.  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────┐  ┌───────────────────────────┐    │
│  │  TIME CAPSULE    ● SECURE   │  │  DEAD MAN SWITCH ⚠ WARN   │    │
│  │                             │  │                            │    │
│  │  BTC Seed Backup            │  │  Emergency Letter          │    │
│  │  Hold encrypted secrets...  │  │  Give to my lawyer...      │    │
│  │                             │  │                            │    │
│  │  OBJECT: 0xf136d6d2...      │  │  OBJECT: 0xab12ef9a...     │    │
│  │  UNLOCK: 21:45:30 – 43s     │  │  ❤ LAST BEAT: 21:30:10    │    │
│  │                             │  │                            │    │
│  │  [████████████░░░░░] 72%    │  │  [███░░░░░░░░░░░░] 18%     │    │
│  │  LOCKED         43s left    │  │  ACTIVE CHECKIN  2.4d left │    │
│  │                             │  │                            │    │
│  │  Beneficiary: 0x3ab2...     │  │  [❤ Sign Heartbeat]        │    │
│  └─────────────────────────────┘  └───────────────────────────┘    │
│                                                                     │
│  ╔═══════════════════════════════════════════════════════════════╗  │
│  ║  📡 SUI TESTNET CONTROL PANEL                                ║  │
│  ║                                                              ║  │
│  ║  LEDGER: SUI Testnet Live  BLOCK: #31,284,910  CLOCK: 21:32 ║  │
│  ║                                                              ║  │
│  ║  [21:30:46] SUCCESS  🦭 Walrus Storage online...             ║  │
│  ║  [21:32:01] TRANS    ❤️  Heartbeat tx signed by 0xe98d...   ║  │
│  ║  [21:32:04] SUCCESS  ❤️  Heartbeat confirmed. Timer reset!  ║  │
│  ╚═══════════════════════════════════════════════════════════════╝  │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Unlock & Recover Asset Page

```
┌─────────────────────────────────────────────────────────────────────┐
│  🔓 Unlock & Retrieve Assets                                        │
│  Authorized beneficiaries can query SUI contract terms,             │
│  fetch secure fragments from Walrus, and decrypt them.              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Select Target Capsule Component:                                   │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ ✅ BTC Seed Backup          READY TO UNLOCK   [SELECTED]  │    │
│  │    0xf136d6d20b145d97...                                   │    │
│  ├────────────────────────────────────────────────────────────┤    │
│  │ ⏳ Emergency Letter         STATUS LOCKED                  │    │
│  │    0xab12ef9a4c3b2...                                      │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  Authorize Beneficiary Signature Address:                           │
│  [0xbeneficiary_address...                                      ]   │
│  Connected: 0xe98d7ea8a763... (used for signature)                  │
│                                                                     │
│  [🔓 Call Contract Decrypt API                               ]      │
│                                                                     │
│  ─────────── After success ───────────                              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                ✅  Plaintext Secret Fully Recovered!         │   │
│  │                                                             │   │
│  │  DECRYPTED TARGET: btc_seed_backup.txt                      │   │
│  │  FORMAT: File Object                                        │   │
│  │  CRYPTO: AES-256-GCM verified ✅                            │   │
│  │                                                             │   │
│  │  [⬇ Download Plaintext File]   [Recover Another]           │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

### AI Oracle Chat

```
  ╔═══════════════════════════════════════╗
  ║     🧠 Sui-Tatum Chain Oracle         ║
  ║  ● GEMINI-FLASH-CONNECTED            ║
  ╠═══════════════════════════════════════╣
  ║  Capsules: 2  Clock: 21:32:10        ║
  ╠═══════════════════════════════════════╣
  ║  [What is a Dead Man's Switch?]      ║
  ║  [How is AES encrypted?]             ║
  ║  [Check my readiness status]         ║
  ╠═══════════════════════════════════════╣
  ║                                      ║
  ║  Welcome back, Operator! I am        ║
  ║  physical oracle interface Node-A3.  ║
  ║  I am directly tied to Tatum Sui     ║
  ║  RPC and Walrus storage.             ║
  ║                                      ║
  ║  ────────────────────────────        ║
  ║                                      ║
  ║  [You]: Are any of my capsules       ║
  ║  ready to unlock?                    ║
  ║                                      ║
  ║  [Oracle]: Yes! Capsule "BTC Seed    ║
  ║  Backup" (0xf136...) unlocked 3s    ║
  ║  ago. You can proceed to Recover     ║
  ║  Asset and download your file. ✅   ║
  ║                                      ║
  ╠═══════════════════════════════════════╣
  ║  [Ask the blockchain oracle...] [→] ║
  ╚═══════════════════════════════════════╝
```

---

## 🔐 Smart Contract Deep Dive

Located at [`contracts/sources/capsule.move`](contracts/sources/capsule.move)

### Capsule Object Structure

```move
public struct Capsule has key, store {
    id:              UID,
    owner:           address,      // Who created the capsule
    beneficiary:     address,      // Who can unlock it
    walrus_blob_id:  String,       // Walrus storage blob ID (ciphertext location)
    enc_key_hint:    vector<u8>,   // AES-256 key bytes (released on unlock)
    unlock_after_ms: u64,          // Absolute ms timestamp; 0 = inactivity mode
    inactivity_days: u64,          // Days of silence before unlock; 0 = date mode
    last_heartbeat:  u64,          // Timestamp of last owner check-in
    created_at:      u64,          // Creation timestamp
}
```

### Entry Functions

```
 ┌─────────────────────────────────────────────────────────────────────┐
 │  capsule::create()                                                  │
 │                                                                     │
 │  Called by: Owner wallet                                            │
 │  Args: blob_id, enc_key, beneficiary, unlock_ms, inactivity_d      │
 │                                                                     │
 │  1. Creates a Capsule shared object                                 │
 │  2. Stores Walrus blob reference + AES key                          │
 │  3. Records unlock conditions (time OR inactivity)                  │
 │  4. Emits CapsuleCreated event for indexing                         │
 └─────────────────────────────────────────────────────────────────────┘

 ┌─────────────────────────────────────────────────────────────────────┐
 │  capsule::heartbeat()                                               │
 │                                                                     │
 │  Called by: Owner wallet ONLY                                       │
 │  Args: capsule_object, clock                                        │
 │                                                                     │
 │  1. Verifies tx sender == capsule.owner (else abort)                │
 │  2. Updates last_heartbeat = clock::timestamp_ms(clock)             │
 │  3. Resets the inactivity countdown timer                           │
 └─────────────────────────────────────────────────────────────────────┘

 ┌─────────────────────────────────────────────────────────────────────┐
 │  capsule::unlock()                                                  │
 │                                                                     │
 │  Called by: Beneficiary wallet                                      │
 │  Args: capsule_object, clock                                        │
 │                                                                     │
 │  Mode A (time):      clock::timestamp_ms >= unlock_after_ms        │
 │  Mode B (inactivity): clock::timestamp_ms - last_heartbeat          │
 │                       >= inactivity_days * 86_400_000              │
 │                                                                     │
 │  If condition met:  emit CapsuleUnlocked event with enc_key_hint   │
 │  If not:            abort with E_NOT_UNLOCKABLE                     │
 └─────────────────────────────────────────────────────────────────────┘
```

### Deployed Contract

| Network | Package ID |
|---|---|
| Sui Testnet | `0x94b8cc7c9a397e11cccb906b313716c0b6acface1631607ccade64561253d8f3` |
| Sui Mainnet | *(deploy for production)* |

---

## 🔑 Cryptography Explained

```
  YOUR PASSWORD
       │
       │ PBKDF2-SHA256
       │ 100,000 iterations
       │ 16-byte random SALT
       │
       ▼
  ┌─────────────┐
  │  AES-256    │  ← 256-bit derived key
  │  SECRET KEY │
  └─────────────┘
       │
       │ AES-256-GCM
       │ 12-byte random IV
       │
       ▼
  ┌─────────────────────────────────────────────────────────┐
  │  WALRUS BLOB FORMAT                                      │
  │                                                         │
  │  [  IV (12 bytes)  ] [ CIPHERTEXT (N bytes)  ]         │
  │  └── stored at start ┘└── encrypted file data ──────────┘
  │                                                         │
  │  Self-contained: IV is always recoverable from the blob │
  └─────────────────────────────────────────────────────────┘
       │
       │ Stored on Walrus under blobId
       │ blobId stored in Sui capsule object
       │ AES key stored in Sui capsule object (enc_key_hint)
```

**Why this is secure:**
- The AES key is locked in the Sui smart contract — only accessible after unlock conditions are verified
- Walrus stores only ciphertext — useless without the key
- PBKDF2 with 100k iterations makes brute-force attacks computationally infeasible
- AES-256-GCM provides authenticated encryption (detects tampering)
- All encryption runs in the browser — the server never sees plaintext

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Blockchain | Sui Testnet | Smart contract execution, time oracle |
| RPC Gateway | Tatum (`https://sui-mainnet.gateway.tatum.io`) | Reliable Sui JSON-RPC access |
| Storage | Walrus Testnet | Decentralized encrypted blob storage |
| Smart Contract | Move Language | Time-lock logic, heartbeat, unlock |
| Encryption | Web Crypto API (browser-native) | AES-256-GCM + PBKDF2 |
| Frontend | Vite + React 19 + TypeScript | SPA UI |
| Styling | Tailwind CSS v4 | Dark cyber UI |
| 3D Graphics | Three.js | Interactive galaxy visualization |
| Wallet | `@mysten/dapp-kit` v1 | Sui wallet connection |
| AI Oracle | Google Gemini Flash | Natural language capsule queries |
| Server | Express.js + tsx | API proxy + Vite dev middleware |

---

## 🚀 Setup & Installation

### Prerequisites

```
✅ Node.js 18 or higher
✅ A Sui Wallet (install at https://suiwallet.com)
✅ Some SUI Testnet tokens (free from faucet)
✅ Git
```

### Step 1 — Clone the Repository

```bash
git clone https://github.com/SamuelDharshi/ChainCapsule.git
cd ChainCapsule
```

### Step 2 — Get SUI Testnet Tokens

```bash
# Option A: CLI faucet
sui client faucet

# Option B: Web faucet
# Visit https://faucet.testnet.sui.io
# Paste your wallet address and request tokens
```

### Step 3 — Deploy the Smart Contract (optional, already deployed)

```bash
cd contracts

# Check sui CLI is installed
sui --version

# Publish to testnet
sui client publish --gas-budget 100000000 --skip-dependency-verification

# Copy the PACKAGE_ID from the output (looks like: 0x94b8cc...)
```

### Step 4 — Run the New Vite Frontend (Recommended)

```bash
cd chaincapsule

# Install dependencies
npm install

# Copy env template
cp .env.example .env

# Edit .env and fill in:
# VITE_PACKAGE_ID=0x94b8cc7c9a397e11cccb906b313716c0b6acface1631607ccade64561253d8f3
# VITE_SUI_NETWORK=testnet
# VITE_SUI_CLOCK_ID=0x6
# VITE_WALRUS_PUBLISHER=https://publisher.walrus-testnet.walrus.space
# VITE_WALRUS_AGGREGATOR=https://aggregator.walrus-testnet.walrus.space
# GEMINI_API_KEY=your_gemini_key_here   (optional, for AI oracle)

# Start dev server
npm run dev

# Open http://localhost:3000
```

### Step 5 — Run the Next.js Frontend (Alternative)

```bash
cd app

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local

# Edit .env.local:
# NEXT_PUBLIC_PACKAGE_ID=0x94b8cc7c9a397e11...
# NEXT_PUBLIC_SUI_NETWORK=testnet
# NEXT_PUBLIC_SUI_CLOCK_ID=0x6
# NEXT_PUBLIC_WALRUS_PUBLISHER=https://publisher.walrus-testnet.walrus.space
# NEXT_PUBLIC_WALRUS_AGGREGATOR=https://aggregator.walrus-testnet.walrus.space

# Start server
npm run dev

# Open http://localhost:3000
```

### Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `VITE_PACKAGE_ID` | ✅ | Deployed Move package ID on Sui |
| `VITE_SUI_NETWORK` | ✅ | `testnet` or `mainnet` |
| `VITE_SUI_CLOCK_ID` | ✅ | Always `0x6` (Sui shared clock) |
| `VITE_WALRUS_PUBLISHER` | ✅ | Walrus publisher endpoint |
| `VITE_WALRUS_AGGREGATOR` | ✅ | Walrus aggregator endpoint |
| `GEMINI_API_KEY` | ⚠️ Optional | Google AI key for AI Oracle chat |

---

## 📋 Using the App — Step by Step

### ① Creating a Time Capsule

```
1. Open http://localhost:3000
2. Click [Deploy Capsule] in the navbar
3. Connect your Sui wallet (top-right [Connect Wallet] button)
4. Fill in the form:
   ├── Capsule Name: e.g. "Will Letter 2030"
   ├── Instructions: e.g. "Give to my children on my 60th birthday"
   ├── Mode: Select ⏰ TIME CAPSULE (Mode A)
   ├── Delay: Set seconds until unlock (or use absolute date)
   ├── Beneficiary Address: 0x... (who receives the file)
   ├── Secret Passphrase: Strong password (used for AES key derivation)
   └── Upload File: Drag & drop or click to select any file

5. Click [ENCRYPT & DEPLOY TIME CAPSULE]
   The app will:
   a) Derive AES-256 key from your password in-browser
   b) Encrypt the file with AES-256-GCM
   c) Upload [IV + ciphertext] to Walrus → get blobId
   d) Call capsule::create() on Sui blockchain
   e) Save capsule metadata to localStorage

6. Copy the Capsule Object ID — share with your beneficiary!
```

### ② Creating a Dead Man's Switch

```
1. Same as above, but:
   ├── Mode: Select 💀 DEAD MAN'S SWITCH (Mode B)
   └── Inactivity Days: e.g. 90 (unlock if no heartbeat for 90 days)

2. After creation, visit [Sui Registry Dashboard]
3. Your switch appears with a countdown timer
4. Regularly click [❤ Sign Heartbeat] to stay alive
   └── Each heartbeat resets the 90-day countdown
```

### ③ Sending a Heartbeat

```
1. Open [Sui Registry Dashboard]
2. Find your Dead Man's Switch capsule
3. Click [❤ Sign Heartbeat]
4. Your Sui wallet will prompt you to approve the transaction
5. Confirm → transaction broadcasts to Sui testnet
6. The countdown timer resets!
7. A link to the tx on Suiscan appears in the log panel
```

### ④ Unlocking and Recovering a File (Beneficiary)

```
1. Open [Recover Asset] in the navbar
2. Connect your Sui wallet (must be the beneficiary address)
3. Select the capsule you want to unlock
4. Enter the beneficiary address (your connected wallet address)
5. Click [Call Contract Decrypt API]

   The app will:
   a) Call capsule::unlock() on Sui — verifies time conditions
   b) Read enc_key_hint (AES key) from the contract
   c) Download [IV + ciphertext] from Walrus
   d) Extract IV from first 12 bytes of blob
   e) Decrypt file in-browser using AES-256-GCM
   f) Present download link for the recovered plaintext file

6. Click [⬇ Download Plaintext File] — done!
```

### ⑤ Using the AI Oracle

```
1. Click the 🤖 button (bottom-right of any page)
2. The AI Oracle knows:
   ├── All your capsules (name, status, unlock time)
   ├── Current Sui blockchain time
   └── Your wallet address
3. Ask questions like:
   ├── "How long until my capsule unlocks?"
   ├── "What is a Dead Man's Switch?"
   ├── "Are any of my capsules ready?"
   └── "Explain how the encryption works"
```

---

## 🛡 Security Model

```
╔═══════════════════════════════════════════════════════════════════╗
║                      TRUST ASSUMPTIONS                            ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  TRUSTED:                                                         ║
║  ✅ Sui blockchain (public, auditable Move contract)              ║
║  ✅ Web Crypto API (browser-native, hardware-backed)              ║
║  ✅ Your own browser (local AES-256 encryption)                   ║
║                                                                   ║
║  NOT NEEDED TO TRUST:                                             ║
║  ❌ No central server (no admin backend)                          ║
║  ❌ No database (no stored credentials)                           ║
║  ❌ No operator (smart contract is autonomous)                    ║
║  ❌ No Walrus node (ciphertext is useless without key)            ║
║  ❌ No Tatum (RPC provider, can be replaced)                      ║
║                                                                   ║
╠═══════════════════════════════════════════════════════════════════╣
║                      THREAT MODEL                                 ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  IF Walrus is compromised:                                        ║
║  → Attacker gets encrypted ciphertext only. Useless without key. ║
║                                                                   ║
║  IF Tatum is down:                                                ║
║  → Switch RPC to public Sui fullnode. No data loss.              ║
║                                                                   ║
║  IF the app server is hacked:                                     ║
║  → No secrets stored on server. Keys are on-chain.               ║
║                                                                   ║
║  IF an attacker knows the blobId:                                 ║
║  → They can download ciphertext. Still useless without key.       ║
║                                                                   ║
║  IF you lose your password:                                       ║
║  → ⚠️  File cannot be recovered. Store password safely!          ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

---

## 🌐 Tatum & Walrus Integration

### Tatum RPC Gateway

All Sui blockchain queries are routed through the Tatum gateway for reliable, rate-limited access:

```typescript
// src/blockchain.ts
async function suiRpc(method: string, params: unknown[]) {
  const res = await fetch("https://fullnode.testnet.sui.io:443", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  return json.result;
}

// Query capsule events
const events = await suiRpc("suix_queryEvents", [
  { MoveEventType: `${PACKAGE_ID}::capsule::CapsuleCreated` },
  null, 50, false,
]);
```

### Walrus Storage

Encrypted blobs are stored with the IV prepended (self-contained format):

```typescript
// Upload: [12-byte IV] + [ciphertext]
async function uploadCiphertextToWalrus(ivHex: string, ciphertextBase64: string) {
  const ivBytes  = hexToBytes(ivHex);       // 12 bytes
  const cipher   = base64ToBytes(ciphertextBase64);
  const combined = concat(ivBytes, cipher); // self-contained blob

  const res = await fetch(`${WALRUS_PUBLISHER}/v1/blobs?epochs=5`, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: combined,
  });
  const data = await res.json();
  return data.newlyCreated?.blobObject?.blobId ?? data.alreadyCertified?.blobId;
}

// Download: split IV from ciphertext
async function downloadFromWalrus(blobId: string) {
  const buffer = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`).arrayBuffer();
  const bytes   = new Uint8Array(buffer);
  const ivHex   = bytesToHex(bytes.slice(0, 12));       // first 12 = IV
  const cipher  = bytesToBase64(bytes.slice(12));        // rest = ciphertext
  return { ivHex, ciphertextBase64: cipher };
}
```

---

## 📁 Project Structure

```
ChainCapsule/
│
├── contracts/                    # Sui Move smart contract
│   ├── sources/
│   │   └── capsule.move          # Main contract: create, heartbeat, unlock
│   ├── tests/
│   │   └── capsule_tests.move    # Unit tests
│   ├── Move.toml                 # Package manifest
│   └── Published.toml            # Deployment info
│
├── chaincapsule/                 # 🌟 New Vite+React frontend (primary)
│   ├── src/
│   │   ├── App.tsx               # Main router + wallet + state
│   │   ├── blockchain.ts         # Sui RPC + Walrus + Move tx builders
│   │   ├── cryptoUtils.ts        # AES-256-GCM + PBKDF2 (browser)
│   │   ├── types.ts              # TypeScript interfaces
│   │   └── components/
│   │       ├── CreateCapsuleForm.tsx  # Deploy capsule UI
│   │       ├── Dashboard.tsx          # Heartbeat + registry
│   │       ├── OpenCapsule.tsx        # Unlock + decrypt
│   │       ├── AIAssistant.tsx        # Gemini AI chat
│   │       └── ThreeCanvas.tsx        # 3D galaxy background
│   ├── server.ts                 # Express + Vite middleware + /api/chat
│   ├── vite.config.ts
│   └── package.json
│
├── app/                          # Next.js frontend (alternative)
│   ├── src/
│   │   ├── app/                  # Next.js App Router pages
│   │   │   ├── page.tsx          # Landing page
│   │   │   ├── create/           # Create capsule
│   │   │   ├── dashboard/        # Dashboard + heartbeat
│   │   │   └── open/             # Unlock + decrypt
│   │   ├── components/           # Reusable React components
│   │   └── lib/
│   │       ├── sui.ts            # Sui RPC + tx builders
│   │       ├── walrus.ts         # Walrus upload/download
│   │       └── crypto.ts         # AES-256 browser crypto
│   └── package.json
│
├── PRD_ChainCapsule.md           # Product Requirements Document
├── README.md                     # This file
└── .gitignore
```

---

## 🏆 Hackathon Info

| Detail | Value |
|---|---|
| Event | Tatum × Build on Sui with Walrus |
| Duration | May 23 – June 6, 2025 |
| Theme | Real-world utility on Sui + Walrus |
| Team | Samuel Dharshi |
| Contact | samueldharshi.27csb@licet.ac.in |

---

<div align="center">

```
  ╔══════════════════════════════════════════════════════╗
  ║                                                      ║
  ║   Encrypt locally. Store on Walrus.                  ║
  ║   Let Sui unlock it when you can't.                  ║
  ║                                                      ║
  ║   ChainCapsule — Built for the Decentralized Web     ║
  ║                                                      ║
  ╚══════════════════════════════════════════════════════╝
```

**[⭐ Star this repo](https://github.com/SamuelDharshi/ChainCapsule)** if you found it useful!

*Built by [SamuelDharshi](https://github.com/SamuelDharshi) · Powered by Sui + Walrus + Tatum*

</div>
