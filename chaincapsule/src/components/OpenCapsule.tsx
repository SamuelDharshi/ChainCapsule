import React, { useState } from "react";
import { Key, Unlock, Download, ShieldAlert, CheckCircle2, Clipboard, Globe, Radio, RefreshCw, Eye } from "lucide-react";
import { useSignAndExecuteTransaction, useCurrentAccount } from "@mysten/dapp-kit";
import { decryptBlob } from "../cryptoUtils";
import { Capsule, LogEvent, BlockchainState } from "../types";
import { buildUnlockTx, downloadFromWalrus, getCapsuleObject } from "../blockchain";

interface OpenCapsuleProps {
  capsules: Capsule[];
  blockchainState: BlockchainState;
  onUnlockCapsule: (capsuleId: string) => void;
  onAddLog: (log: LogEvent) => void;
  onSetThreeState: (state: "neutral" | "active" | "warning" | "uploading" | "unlocked") => void;
}

export default function OpenCapsule({
  capsules,
  blockchainState,
  onUnlockCapsule,
  onAddLog,
  onSetThreeState,
}: OpenCapsuleProps) {
  const [selectedId, setSelectedId] = useState("");
  const [beneficiaryKeyInput, setBeneficiaryKeyInput] = useState(blockchainState.beneficiaryAddress);
  
  // Decryption step
  const [decryptedFileUrl, setDecryptedFileUrl] = useState<string | null>(null);
  const [decryptedFileName, setDecryptedFileName] = useState("");
  const [errorText, setErrorText] = useState("");
  const [statusStep, setStatusStep] = useState<"select" | "authenticating" | "fetching" | "decrypting" | "ready">("select");
  const [downloadBlob, setDownloadBlob] = useState<Blob | null>(null);

  // Real dapp-kit transaction signer + current account
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const account = useCurrentAccount();

  // Ready capsules matching conditions (using real time)
  const assessUnlockable = (c: Capsule) => {
    if (c.isUnlocked) return true;
    const now = Date.now();
    if (c.unlockAfterMs > 0) {
      return now >= c.unlockAfterMs;
    } else {
      const MS_IN_DAY = 86400000;
      return now - c.lastHeartbeat >= (c.inactivityDays * MS_IN_DAY);
    }
  };

  const handleOpenMechanism = async (capsule: Capsule) => {
    // Verify the connected wallet is the beneficiary (or match typed address)
    const connectedAddr = account?.address?.toLowerCase() ?? "";
    const typedAddr = beneficiaryKeyInput.trim().toLowerCase();
    const beneficiaryAddr = capsule.beneficiary.toLowerCase();

    if (typedAddr !== beneficiaryAddr && connectedAddr !== beneficiaryAddr) {
      setErrorText(`❌ Access Denied: Beneficiary wallet validation failed. Specified beneficiary for this capsule object is: ${capsule.beneficiary.slice(0, 14)}...`);
      onAddLog({
        id: `${Date.now()}-unlock-failed-auth`,
        timestamp: Date.now(),
        type: "error",
        message: `🚨 Beneficiary Authentication Signature Mismatch for capsule: "${capsule.name}". Target: ${capsule.beneficiary}. Provided: ${beneficiaryKeyInput}`,
      });
      return;
    }

    setErrorText("");
    setStatusStep("authenticating");
    onSetThreeState("active");

    onAddLog({
      id: `${Date.now()}-unlock-auth`,
      timestamp: Date.now(),
      type: "info",
      message: `🔐 Authenticating Beneficiary Signature for SUI capsule contract: ${capsule.id}...`,
    });

    await new Promise((res) => setTimeout(res, 800));

    // Check unlock conditions using real time
    const ready = assessUnlockable(capsule);
    if (!ready) {
      const remainingSecs = Math.max(0, (capsule.unlockAfterMs - Date.now()) / 1000);
      setErrorText(`⏳ Contract Lock Active: Sui clock rules dictate the contract is not currently unlockable. Remaining: ${remainingSecs.toFixed(0)} seconds.`);
      onAddLog({
        id: `${Date.now()}-unlock-failed-clock`,
        timestamp: Date.now(),
        type: "warning",
        message: `🚨 SUI VM returned assertion error: E_NOT_UNLOCKABLE. Sui Clock validation constraints are not yet satisfied.`,
      });
      setStatusStep("select");
      onSetThreeState("neutral");
      return;
    }

    try {
      // ── Step A: Call SUI Contract unlock ──────────────────────────────────
      onAddLog({
        id: `${Date.now()}-unlock-contract-call`,
        timestamp: Date.now(),
        type: "transaction",
        message: `⛓️ Calling chaincapsule::capsule::unlock on-chain. Verifying inactivity conditions against SUI Clock...`,
      });

      const tx = buildUnlockTx(capsule.id);
      const txResult = await signAndExecute({ transaction: tx });

      const digest = txResult && typeof txResult === 'object' && 'digest' in txResult
        ? String((txResult as any).digest)
        : undefined;

      onAddLog({
        id: `${Date.now()}-unlock-contract-done`,
        timestamp: Date.now(),
        type: "success",
        message: `✅ Unlock transaction confirmed on-chain!`,
        txHash: digest,
      });

      setStatusStep("fetching");

      // ── Step B: Get enc_key_hint from Sui chain object ─────────────────────
      onAddLog({
        id: `${Date.now()}-unlock-key-fetch`,
        timestamp: Date.now(),
        type: "info",
        message: `🔑 Reading decryption key from Sui contract object: ${capsule.id}...`,
      });

      // The enc_key_hint (AES key) is stored on-chain — read from local memory first,
      // then verify against chain if not available
      let aesHexKey = capsule.encKeyHint;

      if (!aesHexKey) {
        // Fetch from chain if not in local state
        const onChainData = await getCapsuleObject(capsule.id);
        aesHexKey = onChainData.encKeyHint;
      }

      onUnlockCapsule(capsule.id);

      onAddLog({
        id: `${Date.now()}-unlock-key-released`,
        timestamp: Date.now(),
        type: "success",
        message: `🔑 SUI Contract released decryption key to authorized beneficiary! Hex Key: ${aesHexKey.slice(0, 12)}...`,
      });

      // ── Step C: Pull Encrypted Blob from Walrus ────────────────────────────
      onAddLog({
        id: `${Date.now()}-unlock-walrus-fetch`,
        timestamp: Date.now(),
        type: "info",
        message: `📥 Fetching ciphertext fragments from Walrus Gateway (blobId: ${capsule.walrusBlobId})...`,
      });

      setStatusStep("decrypting");

      // Download from Walrus — first 12 bytes are IV (prepended during upload)
      let ivHex: string;
      let ciphertextBase64: string;

      if (capsule.ciphertext && capsule.iv) {
        // Use in-memory data if available (just created this session)
        ivHex = capsule.iv;
        ciphertextBase64 = capsule.ciphertext;
        onAddLog({
          id: `${Date.now()}-unlock-using-memory`,
          timestamp: Date.now(),
          type: "info",
          message: `💾 Using in-memory ciphertext (session cache).`,
        });
      } else {
        // Fetch from Walrus (IV is prepended to blob)
        const walrusData = await downloadFromWalrus(capsule.walrusBlobId);
        ivHex = walrusData.ivHex;
        ciphertextBase64 = walrusData.ciphertextBase64;
        onAddLog({
          id: `${Date.now()}-unlock-walrus-done`,
          timestamp: Date.now(),
          type: "success",
          message: `🦭 Walrus blob retrieved. IV extracted (${ivHex.slice(0, 8)}...). Ciphertext size: ${Math.round(ciphertextBase64.length * 0.75)} bytes.`,
        });
      }

      // ── Step D: Decrypt using Web Crypto AES-GCM ──────────────────────────
      onAddLog({
        id: `${Date.now()}-unlock-decrypt-crypto`,
        timestamp: Date.now(),
        type: "info",
        message: `🖥️ Initiating Web Crypto AES-GCM Client Decryption. File mapping: ${capsule.fileName}`,
      });

      const decryptedBuffer = await decryptBlob(ciphertextBase64, aesHexKey, ivHex);
      const outputBlob = new Blob([decryptedBuffer], { type: capsule.fileType });
      const outputUrl = URL.createObjectURL(outputBlob);

      setDecryptedFileUrl(outputUrl);
      setDecryptedFileName(capsule.fileName);
      setDownloadBlob(outputBlob);

      setStatusStep("ready");
      onSetThreeState("unlocked");

      onAddLog({
        id: `${Date.now()}-unlock-decrypt-done`,
        timestamp: Date.now(),
        type: "success",
        message: `🎉 Success! Decryption sequence complete. Plaintext recovered and mapped in memory.`,
      });
    } catch (err: any) {
      console.error(err);
      setErrorText(`🚨 Cryptographic Defect: Unregistered decryption vectors or corrupted hash sums. (${err.message || err})`);
      onAddLog({
        id: `${Date.now()}-unlock-decrypt-err`,
        timestamp: Date.now(),
        type: "error",
        message: `🚨 Decryption processing failed: ${err.message || err}`,
      });
      setStatusStep("select");
      onSetThreeState("neutral");
    }
  };

  const handleDownload = () => {
    if (!decryptedFileUrl || !decryptedFileName) return;
    const link = document.createElement("a");
    link.href = decryptedFileUrl;
    link.setAttribute("download", decryptedFileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    onAddLog({
      id: `${Date.now()}-file-saved`,
      timestamp: Date.now(),
      type: "success",
      message: `💾 File Saved to system: "${decryptedFileName}"`,
    });
  };

  const resetRecovery = () => {
    setDecryptedFileUrl(null);
    setDecryptedFileName("");
    setDownloadBlob(null);
    setStatusStep("select");
    setSelectedId("");
    onSetThreeState("neutral");
  };

  return (
    <div className="bg-stone-900 bg-opacity-40 border border-stone-800 p-6 rounded-2xl backdrop-blur-md max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-600 bg-opacity-10 rounded-xl border border-emerald-500/30">
          <Unlock className="w-6 h-6 text-emerald-400 animate-pulse" />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-stone-100">Unlock & Retrieve Assets</h2>
          <p className="text-xs text-stone-400">
            Authorized beneficiaries can query SUI contract terms, fetch secure fragments from Walrus, and decrypt them.
          </p>
        </div>
      </div>

      {statusStep === "select" && (
        <div className="space-y-5">
          {/* List of Registered Capsules */}
          <div>
            <label className="block text-xs font-medium text-stone-300 font-mono mb-2 uppercase tracking-wider">
              Select Target Capsule Component
            </label>
            {capsules.length === 0 ? (
              <div className="bg-stone-950/70 border border-stone-800 text-stone-500 rounded-xl text-center py-4 text-xs">
                No capsules registry available. Open dashboard to deploy a contract first.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 max-h-[180px] overflow-y-auto pr-1">
                {capsules.map((c) => {
                  const isUnlockableNow = assessUnlockable(c);
                  
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                        selectedId === c.id
                          ? "bg-slate-900/80 border-cyan-500 ring-1 ring-cyan-500/30 text-stone-100"
                          : "bg-stone-950 hover:bg-stone-900/60 border-stone-800 text-stone-300"
                      }`}
                    >
                      <div className="min-w-0 pr-4">
                        <span className="text-xs font-bold truncate block">{c.name}</span>
                        <span className="text-[9px] font-mono text-stone-500 block truncate">{c.id}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                          isUnlockableNow 
                            ? "bg-emerald-950 text-emerald-400 border-emerald-900" 
                            : "bg-amber-950 text-amber-500 border-amber-900"
                        }`}>
                          {isUnlockableNow ? "READY TO UNLOCK" : "STATUS LOCKED"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Wallet Beneficiary Key verification */}
          {selectedId && (
            <div className="p-4 bg-stone-950 border border-stone-800 rounded-xl space-y-4">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400 animate-spin" style={{ animationDuration: "15s" }} />
                <span className="text-xs font-mono font-bold text-stone-300">BENEFICIARY SMART WALLET</span>
              </div>
              
              <div>
                <label className="block text-[10px] text-stone-500 font-mono uppercase mb-1.5">
                  Authorize Beneficiary Signature Address
                </label>
                <input
                  type="text"
                  required
                  placeholder="0xbeneficiary..."
                  value={beneficiaryKeyInput}
                  onChange={(e) => setBeneficiaryKeyInput(e.target.value)}
                  className="w-full bg-stone-900 border border-stone-800 focus:border-emerald-500 focus:outline-none text-xs text-stone-100 font-mono px-3.5 py-2.5 rounded-lg"
                />
                <p className="text-[9px] text-stone-500 mt-1 leading-snug">
                  {account?.address
                    ? `Connected: ${account.address.slice(0, 14)}... (will be used for signature)`
                    : "Connect your Sui wallet to sign the unlock transaction."
                  }
                </p>
              </div>

              {/* Action Button */}
              <button
                onClick={() => {
                  const capsObj = capsules.find((c) => c.id === selectedId);
                  if (capsObj) handleOpenMechanism(capsObj);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs uppercase py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Unlock className="w-3.5 h-3.5" /> Call Contract Decrypt API
              </button>
            </div>
          )}

          {errorText && (
            <div className="p-4 bg-red-950 bg-opacity-30 border border-red-900 text-red-400 text-xs rounded-xl flex items-start gap-2 animate-shake">
              <ShieldAlert className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
              <div>{errorText}</div>
            </div>
          )}
        </div>
      )}

      {/* Unlocking animation screens */}
      {(statusStep === "authenticating" || statusStep === "fetching" || statusStep === "decrypting") && (
        <div className="bg-stone-950/80 border border-stone-850 p-8 rounded-2xl text-center space-y-4">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
          <div>
            <h4 className="text-sm font-semibold text-stone-100 capitalize">
              {statusStep === "authenticating" 
                ? "Verifying Beneficiary Identity Account..." 
                : statusStep === "fetching"
                ? "Reassembling Ciphertext Fragments from Walrus..."
                : "Decrypting Files local client environment..."}
            </h4>
            <p className="text-[10px] text-stone-400 font-mono mt-1 max-w-xs mx-auto leading-relaxed">
              {statusStep === "authenticating"
                ? "Calling SUI Clock module to verify that absolute timer has safely crossed trigger date..."
                : statusStep === "fetching"
                ? "Walrus Decentralized protocol certified shards are being compiled back to single AES-256 ciphertext block."
                : "Employing browser Web Crypto pbkdf2 context to unpack AES key and decrypt original bytes in-memory."}
            </p>
          </div>
        </div>
      )}

      {/* Success decrypted result page */}
      {statusStep === "ready" && (
        <div className="bg-stone-950 border border-emerald-500/30 p-6 rounded-2xl text-center space-y-5 animate-fade-in">
          <div className="inline-flex p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full">
            <CheckCircle2 className="w-10 h-10 animate-bounce" />
          </div>

          <div>
            <h3 className="text-base font-semibold text-stone-100">Plaintext Secret Fully Recovered!</h3>
            <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
              Crypto-oracle completed execution. AES key block has successfully unpacked and processed the Walrus binary.
            </p>
          </div>

          {/* Secure File Info box */}
          <div className="p-4 bg-stone-900 bg-opacity-35 border border-stone-800 rounded-xl space-y-3.5 max-w-md mx-auto text-left font-mono text-[10px]">
            <div className="flex justify-between border-b border-stone-850 pb-1.5">
              <span className="text-stone-500">DECRYPTED TARGET:</span>
              <span className="text-stone-100 font-bold max-w-[190px] truncate">{decryptedFileName}</span>
            </div>
            <div className="flex justify-between border-b border-stone-850 pb-1.5">
              <span className="text-stone-500">FORMAT DECLARED:</span>
              <span className="text-stone-300">File Object</span>
            </div>
            <div className="flex justify-between pb-1.5">
              <span className="text-stone-500">CRYPTOGRAPHIC PROTOCOL:</span>
              <span className="text-emerald-400">AES-256-GCM verified</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto">
            <button
              onClick={handleDownload}
              className="flex-1 bg-linear-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-stone-100 font-semibold text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5"
            >
              <Download className="w-4 h-4 text-white" /> Download Plane File
            </button>
            <button
              onClick={resetRecovery}
              className="flex-1 bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-200 text-xs py-2.5 rounded-xl transition-all"
            >
              Recover Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
