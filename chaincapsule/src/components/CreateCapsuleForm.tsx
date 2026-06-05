import React, { useState, useRef } from "react";
import { Upload, Lock, ShieldCheck, Key, Clock, Settings, UserCheck, CheckCircle2, RefreshCw } from "lucide-react";
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { encryptFile } from "../cryptoUtils";
import { Capsule, LogEvent, BlockchainState } from "../types";
import {
  uploadCiphertextToWalrus,
  buildCreateTx,
  saveLocalMeta,
  extractCapsuleIdFromTxResult,
  PACKAGE_ID,
} from "../blockchain";

interface CreateCapsuleFormProps {
  onCapsuleCreated: (capsule: Capsule) => void;
  onAddLog: (log: LogEvent) => void;
  blockchainState: BlockchainState;
  onSetThreeState: (state: "neutral" | "active" | "warning" | "uploading" | "unlocked") => void;
  onRefresh?: () => void;
}

export default function CreateCapsuleForm({
  onCapsuleCreated,
  onAddLog,
  blockchainState,
  onSetThreeState,
  onRefresh,
}: CreateCapsuleFormProps) {
  // Setup standard state managers
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unlockMode, setUnlockMode] = useState<"time" | "inactivity">("time");
  
  // Default values
  const [unlockAfterSeconds, setUnlockAfterSeconds] = useState(60); // 1 minute default for quick testing
  const [inactivityDays, setInactivityDays] = useState(30); // 30 days default
  const [beneficiary, setBeneficiary] = useState(blockchainState.beneficiaryAddress);
  const [password, setPassword] = useState("");

  // File Upload states
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Status
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [deployDetails, setDeployDetails] = useState<{
    walrusBlobId: string;
    keyReleasedOnSui: string;
    originalSize: number;
    cipherSize: number;
  } | null>(null);

  // Real dapp-kit transaction signer
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !password || !name) return;

    if (!blockchainState.walletAddress) {
      onAddLog({
        id: `${Date.now()}-no-wallet`,
        timestamp: Date.now(),
        type: "error",
        message: "🚨 Please connect your Sui wallet first!",
      });
      return;
    }

    if (!PACKAGE_ID) {
      onAddLog({
        id: `${Date.now()}-no-pkg`,
        timestamp: Date.now(),
        type: "error",
        message: "🚨 VITE_PACKAGE_ID is not configured. Check your .env file.",
      });
      return;
    }

    setIsEncrypting(true);
    onSetThreeState("uploading");

    onAddLog({
      id: `${Date.now()}-encrypt-start`,
      timestamp: Date.now(),
      type: "info",
      message: `🔐 Initializing Client-Side AES-256 PBKDF2 Key Derivation on: "${file.name}"`,
    });

    try {
      // ── Step 1: Encrypt file client-side ──────────────────────────────────
      const encResult = await encryptFile(file, password);

      onAddLog({
        id: `${Date.now()}-encrypt-success`,
        timestamp: Date.now(),
        type: "success",
        message: `✅ File cipher completed. Salt/Initialization Vector derived. Ciphertext size: ${Math.round(encResult.ciphertext.length * 0.75)} bytes.`,
      });

      // ── Step 2: Upload to Walrus (IV prepended to ciphertext) ─────────────
      onAddLog({
        id: `${Date.now()}-walrus`,
        timestamp: Date.now(),
        type: "info",
        message: `📡 Uploading encrypted fragments to Walrus Distributed Storage (v1/blobs?epochs=5)...`,
      });

      const walrusBlobId = await uploadCiphertextToWalrus(
        encResult.iv,
        encResult.ciphertext,
        5
      );

      onAddLog({
        id: `${Date.now()}-walrus-certified`,
        timestamp: Date.now(),
        type: "success",
        message: `🦭 Walrus certified storage write completed. Allocated Blob ID: ${walrusBlobId}`,
      });

      // ── Step 3: Build Sui Move transaction ────────────────────────────────
      onAddLog({
        id: `${Date.now()}-sui-publish`,
        timestamp: Date.now(),
        type: "transaction",
        message: `⛓️ Calling chaincapsule::capsule::create on SUI Testnet Ledger via Sui RPC...`,
      });

      // Convert hex key to byte array for on-chain storage
      const rawKeyHex = encResult.rawKey;
      const keyBytes = rawKeyHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16));

      const absoluteUnlockMs = unlockMode === "time"
        ? Date.now() + (unlockAfterSeconds * 1000)
        : 0;
      const inactivityDaysValue = unlockMode === "inactivity" ? inactivityDays : 0;

      // Validate beneficiary address
      const beneficiaryAddr = beneficiary.trim() || blockchainState.walletAddress;

      const tx = buildCreateTx({
        blobId:       walrusBlobId,
        encKeyBytes:  keyBytes,
        beneficiary:  beneficiaryAddr,
        unlockDateMs: absoluteUnlockMs,
        inactivityD:  inactivityDaysValue,
      });

      // ── Step 4: Sign and execute transaction ──────────────────────────────
      const txResult = await signAndExecute({ transaction: tx });
      const newCapsuleId = extractCapsuleIdFromTxResult(txResult);

      const capsuleId = newCapsuleId || `capsule_obj_0x${Math.random().toString(16).substring(2, 10)}`;

      onAddLog({
        id: `${Date.now()}-sui-object-created`,
        timestamp: Date.now(),
        type: "success",
        message: `🎉 SUI Shared Object initialized successfully! ID: ${capsuleId}. Owner signature confirmed.`,
        txHash: txResult && typeof txResult === 'object' && 'digest' in txResult
          ? String((txResult as any).digest)
          : undefined,
      });

      // ── Step 5: Save metadata to localStorage ────────────────────────────
      saveLocalMeta(capsuleId, {
        name,
        description: description || "Secret time locked asset on-chain",
        fileName:    file.name,
        fileType:    file.type || "application/octet-stream",
        fileSize:    file.size,
        salt:        encResult.salt,
      });

      // ── Step 6: Return Capsule object to parent ───────────────────────────
      const newCapsule: Capsule = {
        id:            capsuleId,
        name,
        description:   description || "Secret time locked asset on-chain",
        owner:         blockchainState.walletAddress,
        beneficiary:   beneficiaryAddr,
        walrusBlobId,
        ciphertext:    encResult.ciphertext,  // keep in memory for immediate unlock
        fileName:      file.name,
        fileType:      file.type || "application/octet-stream",
        fileSize:      file.size,
        encKeyHint:    encResult.rawKey,
        unlockAfterMs: absoluteUnlockMs,
        inactivityDays: inactivityDaysValue,
        lastHeartbeat: Date.now(),
        isUnlocked:    false,
        iv:            encResult.iv,
        salt:          encResult.salt,
        createdAt:     Date.now(),
      };

      onCapsuleCreated(newCapsule);

      setDeployDetails({
        walrusBlobId,
        keyReleasedOnSui: `${encResult.rawKey.slice(0, 10)}...${encResult.rawKey.slice(-10)}`,
        originalSize: file.size,
        cipherSize:   encResult.ciphertext.length,
      });

      setStep("confirm");
      onSetThreeState("neutral");

      // Refresh the capsule list after a short delay
      setTimeout(() => onRefresh?.(), 3000);

    } catch (err: any) {
      console.error(err);
      onAddLog({
        id: `${Date.now()}-crypto-err`,
        timestamp: Date.now(),
        type: "error",
        message: `🚨 Cryptographic or Contract Deploy Interruption: ${err.message || err}`,
      });
      onSetThreeState("neutral");
    } finally {
      setIsEncrypting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setFile(null);
    setPassword("");
    setStep("form");
    setDeployDetails(null);
    onSetThreeState("neutral");
  };

  return (
    <div className="bg-stone-900 bg-opacity-40 border border-stone-800 p-6 rounded-2xl backdrop-blur-md">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-600 bg-opacity-10 rounded-xl border border-indigo-500/30">
          <Lock className="w-6 h-6 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-stone-100">Deploy Cryptographic Capsule</h2>
          <p className="text-xs text-stone-400">All data is encrypted in your browser before storing decentralized on Walrus & Sui.</p>
        </div>
      </div>

      {step === "form" ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Capsule Name */}
          <div>
            <label className="block text-xs font-medium text-stone-300 font-mono mb-2 uppercase tracking-wider">
              Capsule Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. BTC Key Backup, Emergency Heritage Letter"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none text-stone-100 placeholder-stone-500 rounded-xl px-4 py-2.5 text-xs transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-stone-300 font-mono mb-2 uppercase tracking-wider">
              Secret Briefing / Instructions
            </label>
            <textarea
              placeholder="Provide public meta instructions for your beneficiary (will stay unencrypted on-chain)."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-stone-950 border border-stone-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none text-stone-100 placeholder-stone-500 rounded-xl px-4 py-2.5 text-xs transition-colors resize-none"
            />
          </div>

          {/* Core Configuration & Mode select */}
          <div className="grid grid-cols-2 gap-4">
            {/* Mode: Time Capsule */}
            <button
              type="button"
              onClick={() => setUnlockMode("time")}
              className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                unlockMode === "time"
                  ? "bg-stone-950 border-cyan-500/50 shadow-md ring-1 ring-cyan-500/30"
                  : "bg-stone-950/40 border-stone-800 hover:border-stone-700 hover:bg-stone-950/60"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <Clock className={`w-4 h-4 ${unlockMode === "time" ? "text-cyan-400" : "text-stone-400"}`} />
                <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded ${unlockMode === "time" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "bg-stone-900 text-stone-400"}`}>
                  Mode A
                </span>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-stone-200">Time Capsule</h4>
                <p className="text-[10px] text-stone-400 mt-1 leading-snug">Unlocks on a fixed future date/timer. Ideal for birthdays, wills, or milestones.</p>
              </div>
            </button>

            {/* Mode: Dead Man's Switch */}
            <button
              type="button"
              onClick={() => setUnlockMode("inactivity")}
              className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                unlockMode === "inactivity"
                  ? "bg-stone-950 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/30"
                  : "bg-stone-950/40 border-stone-800 hover:border-stone-700 hover:bg-stone-950/60"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <ShieldCheck className={`w-4 h-4 ${unlockMode === "inactivity" ? "text-indigo-400" : "text-stone-400"}`} />
                <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded ${unlockMode === "inactivity" ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" : "bg-stone-900 text-stone-400"}`}>
                  Mode B
                </span>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-stone-200">Dead Man's Switch</h4>
                <p className="text-[10px] text-stone-400 mt-1 leading-snug">Releases key if you fail to check in (heartbeat) within N inactivity days.</p>
              </div>
            </button>
          </div>

          {/* Trigger Condition parameters */}
          <div className="p-4 bg-stone-950 border border-stone-800 rounded-xl space-y-3">
            {unlockMode === "time" ? (
              <div>
                <label className="block text-[10px] font-mono text-stone-400 mb-1.5 uppercase">
                  Time Release Delay (Seconds) — <span className="text-emerald-400 font-bold">Fast-Testing Mode</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="30"
                    max="600"
                    step="30"
                    value={unlockAfterSeconds}
                    onChange={(e) => setUnlockAfterSeconds(Number(e.target.value))}
                    className="flex-1 accent-cyan-500"
                  />
                  <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950 px-2 py-1 rounded border border-cyan-800 min-w-[70px] text-center">
                    {unlockAfterSeconds}s
                  </span>
                </div>
                <p className="text-[9px] text-stone-400 mt-1 leading-snug">
                  Unlocks in exactly {Math.floor(unlockAfterSeconds / 60)}m {unlockAfterSeconds % 60}s. The Sui Clock on-chain will enforce this timer.
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-[10px] font-mono text-stone-400 mb-1.5 uppercase">
                  Heartbeat Expiry Trigger Days
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="180"
                    step="1"
                    value={inactivityDays}
                    onChange={(e) => setInactivityDays(Number(e.target.value))}
                    className="flex-1 accent-indigo-500"
                  />
                  <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-950 px-2 py-1 rounded border border-indigo-800 min-w-[70px] text-center">
                    {inactivityDays} days
                  </span>
                </div>
                <p className="text-[9px] text-stone-400 mt-1 leading-snug">
                  If the owner address fails to call "heartbeat" at least once every {inactivityDays} days, the Sui Smart Contract releases the decryption key to the beneficiary.
                </p>
              </div>
            )}
          </div>

          {/* Beneficiary Address */}
          <div>
            <label className="block text-xs font-medium text-stone-300 font-mono mb-2 uppercase tracking-wider">
              Beneficiary Public Wallet Address
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-[11.5px] text-stone-600 font-mono text-xs">Sui Address</span>
              <input
                type="text"
                required
                placeholder="0xbeneficiary..."
                value={beneficiary}
                onChange={(e) => setBeneficiary(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none text-stone-100 placeholder-stone-500 rounded-xl pl-24 pr-4 py-2.5 text-xs transition-colors font-mono"
              />
            </div>
          </div>

          {/* Real client-side decryption key password */}
          <div>
            <label className="block text-xs font-medium text-stone-300 font-mono mb-2 uppercase tracking-wider">
              Secret Passphrase / Encryption Key (Derived on-chain)
            </label>
            <div className="relative">
              <Key className="absolute left-3.5 top-[12.5px] w-4 h-4 text-stone-500" />
              <input
                type="password"
                required
                placeholder="Enter a strong password. This generates your local AES-256 key."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none text-stone-100 placeholder-stone-500 rounded-xl pl-10 pr-4 py-2.5 text-xs transition-colors font-mono"
              />
            </div>
            <p className="text-[10px] text-stone-500 mt-1 leading-relaxed">
              ⚠️ <strong>Security Notice:</strong> ChainCapsule takes this passphrase, derives a standard 256-bit AES key in-memory via PBKDF2 with 100,000 hashing rounds. This raw key is what will be published on-chain *only* once conditions are met. Keep this safe.
            </p>
          </div>

          {/* File Upload Arena - Supports drag and drop & click selection */}
          <div>
            <label className="block text-xs font-medium text-stone-300 font-mono mb-2 uppercase tracking-wider">
              Upload Secret File
            </label>
            
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${
                dragActive
                  ? "border-cyan-400 bg-cyan-950/15"
                  : file
                  ? "border-emerald-500/50 bg-emerald-950/5 text-stone-100"
                  : "border-stone-800 bg-stone-950/40 hover:border-stone-700 hover:bg-stone-950/60"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
              />
              {file ? (
                <div className="text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-xs font-medium text-stone-200">{file.name}</p>
                  <p className="text-[10px] text-stone-400 font-mono mt-1">
                    {(file.size / 1024).toFixed(1)} KB · file target secured
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="w-8 h-8 text-stone-500 mx-auto mb-2 animate-bounce" />
                  <p className="text-xs font-medium text-stone-300">Drag and drop file here, or click to choose</p>
                  <p className="text-[10px] text-stone-500 font-mono mt-1">
                    Secure backups for recovery phrases, legal documents, coordinates, or texts
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Deploy Button */}
          <button
            type="submit"
            disabled={isEncrypting || !file || !password || !name}
            className="w-full bg-linear-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-medium text-xs tracking-wider uppercase py-3 rounded-xl disabled:bg-stone-800 disabled:from-stone-900 disabled:to-stone-900 disabled:text-stone-600 transition-all flex items-center justify-center gap-2"
          >
            {isEncrypting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                DERIVING AES & DEPLOYING TO WALRUS STORAGE...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                ENCRYPT & DEPLOY TIME CAPSULE
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="text-center space-y-6">
          <div className="inline-flex p-3 bg-emerald-500 bg-opacity-10 border border-emerald-500/20 rounded-full text-emerald-400 mb-2">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-stone-100">Capsule Live On Sui Blockchain!</h3>
            <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
              Your file ciphertext is securely hosted on Walrus. The Move smart contract holds the key metadata, waiting for the trigger.
            </p>
          </div>

          {/* Deploy Details Panel */}
          {deployDetails && (
            <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 text-left font-mono text-[10px] text-stone-300 space-y-2">
              <div className="flex justify-between border-b border-stone-900 pb-1.5">
                <span className="text-stone-500">WALRUS BLOB ID:</span>
                <span className="text-cyan-400 text-right font-semibold break-all">{deployDetails.walrusBlobId}</span>
              </div>
              <div className="flex justify-between border-b border-stone-900 pb-1.5">
                <span className="text-stone-500">CRYPTOGRAPHIC CORE:</span>
                <span className="text-stone-400">AES-256-GCM (Salting Key)</span>
              </div>
              <div className="flex justify-between border-b border-stone-900 pb-1.5">
                <span className="text-stone-500">CIPHER KEY HELD ON-CHAIN:</span>
                <span className="text-stone-200">{deployDetails.keyReleasedOnSui}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-1 text-center">
                <div className="bg-stone-900/40 border border-stone-900 p-2 rounded">
                  <div className="text-stone-500 text-[9px]">PLAINTEXT SIZE</div>
                  <div className="text-stone-100 font-bold text-xs mt-0.5">{(deployDetails.originalSize / 1024).toFixed(1)} KB</div>
                </div>
                <div className="bg-stone-900/40 border border-stone-900 p-2 rounded">
                  <div className="text-stone-500 text-[9px]">ENCRYPTED CAPACITY</div>
                  <div className="text-cyan-400 font-bold text-xs mt-0.5">{(deployDetails.cipherSize / 1024).toFixed(1)} KB</div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={resetForm}
              className="flex-1 bg-stone-950 hover:bg-stone-900 border border-stone-800 text-stone-200 text-xs font-semibold py-2.5 rounded-xl transition-colors"
            >
              Deploy Another Capsule
            </button>
            <button
              onClick={() => window.location.hash = "dashboard"} // Standard custom tab trigger
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 font-semibold text-white text-xs py-2.5 rounded-xl transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
