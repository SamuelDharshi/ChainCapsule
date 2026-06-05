"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import {
  getCapsuleObject, CapsuleData, isUnlockable, buildUnlockTx, formatDuration, msUntilUnlock
} from "@/lib/sui";
import { fetchFromWalrus } from "@/lib/walrus";
import { decryptBlob, unpackPayload } from "@/lib/crypto";
import CountdownTimer from "@/components/CountdownTimer";

function OpenCapsuleContent() {
  const searchParams = useSearchParams();
  const objectId = searchParams.get("id") ?? "";

  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [capsule, setCapsule]       = useState<CapsuleData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [unlocking, setUnlocking]   = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [error, setError]           = useState("");

  const [encKeyFromChain, setEncKeyFromChain] = useState<number[] | null>(null);
  const [password, setPassword]               = useState("");
  const [decryptedUrl, setDecryptedUrl]       = useState("");
  const [fileName, setFileName]               = useState("capsule-file");

  useEffect(() => {
    if (!objectId) { setError("No capsule ID provided."); setLoading(false); return; }
    getCapsuleObject(objectId)
      .then(setCapsule)
      .catch(() => setError("Capsule not found or not indexed yet."))
      .finally(() => setLoading(false));
  }, [objectId]);

  async function handleUnlock() {
    if (!account) return;
    setUnlocking(true); setError("");
    try {
      await signAndExecute({ transaction: buildUnlockTx(objectId) });
      const updated = await getCapsuleObject(objectId);
      setEncKeyFromChain(updated.encKeyHint);
    } catch (e) {
      setError(`Unlock failed: ${String(e)}`);
    } finally {
      setUnlocking(false);
    }
  }

  async function handleDecrypt() {
    if (!capsule || !encKeyFromChain || !password) return;
    setDecrypting(true); setError("");
    try {
      const raw = await fetchFromWalrus(capsule.walrusBlobId);
      const { ciphertext, iv } = unpackPayload(raw);
      const rawKey = new Uint8Array(encKeyFromChain);
      const plaintext = await decryptBlob(ciphertext, rawKey, iv);
      const blob = new Blob([plaintext]);
      const url  = URL.createObjectURL(blob);
      setDecryptedUrl(url);
      setFileName(`capsule-${objectId.slice(-8)}`);
    } catch (e) {
      setError(`Decryption failed. Wrong password or corrupted data: ${String(e)}`);
    } finally {
      setDecrypting(false);
    }
  }

  if (loading) {
    return (
      <div className="section flex-center" style={{ minHeight: "60vh" }}>
        <div className="text-muted">Loading capsule…</div>
      </div>
    );
  }

  if (error && !capsule) {
    return (
      <div className="section flex-center" style={{ minHeight: "60vh" }}>
        <div className="card text-center" style={{ maxWidth: 400, padding: "2rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>❌</div>
          <h3 className="mb-2">Capsule not found</h3>
          <p className="text-muted text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const unlockable   = capsule ? isUnlockable(capsule) : false;
  const remaining    = capsule ? msUntilUnlock(capsule) : -1;
  const mode         = capsule && capsule.unlockAfterMs > 0 ? "time-capsule" : "dead-mans-switch";
  const unlockTarget = capsule
    ? capsule.unlockAfterMs > 0
      ? capsule.unlockAfterMs
      : capsule.lastHeartbeat + capsule.inactivityDays * 86_400_000
    : 0;

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: 640 }}>
        {/* Header */}
        <div className="text-center mb-4">
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>
            {unlockable ? "🔓" : "🔒"}
          </div>
          <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
            {unlockable
              ? <><span className="text-gradient">Capsule Ready</span></>
              : <>Capsule <span className="text-muted">Locked</span></>
            }
          </h1>
          <div className="mono text-xs text-muted truncate" style={{ maxWidth: 360, margin: "0 auto" }}>
            {objectId}
          </div>
        </div>

        {/* Status when locked */}
        {capsule && !unlockable && (
          <div className="card mb-3" style={{ textAlign: "center", padding: "2rem" }}>
            <div className="text-muted text-sm mb-3">
              {mode === "time-capsule"
                ? "This capsule unlocks at a fixed date."
                : "This capsule unlocks after owner inactivity."}
            </div>
            <CountdownTimer targetMs={unlockTarget} />
            <div className="text-muted text-xs mt-2">{formatDuration(remaining)} remaining</div>
            <div className="divider" />
            <div className="text-muted text-sm">
              You will be able to call unlock after the timer expires.<br />
              Come back then — or bookmark this page.
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="card mb-3" style={{ borderColor: "rgba(244,63,94,0.4)", background: "rgba(244,63,94,0.06)" }}>
            <span className="text-danger text-sm">⚠️ {error}</span>
          </div>
        )}

        {/* Unlock flow */}
        {capsule && unlockable && (
          <>
            {!encKeyFromChain && (
              <div className="card mb-3 card-glow">
                <h3 className="mb-1">Step 1: Unlock the capsule</h3>
                <p className="text-muted text-sm mb-3">
                  Call <span className="mono">capsule::unlock</span> on Sui. The smart contract will verify
                  the condition is met and release the encrypted key.
                </p>
                {!account ? (
                  <div className="card text-center" style={{ background: "rgba(139,92,246,0.06)", borderColor: "rgba(139,92,246,0.25)" }}>
                    <p className="text-sm">Connect your Sui wallet to unlock this capsule.</p>
                  </div>
                ) : (
                  <button id="btn-unlock-chain" className="btn btn-primary w-full" onClick={handleUnlock} disabled={unlocking}>
                    {unlocking ? "⏳ Sending transaction…" : "🔓 Unlock on Sui"}
                  </button>
                )}
              </div>
            )}

            {encKeyFromChain && !decryptedUrl && (
              <div className="card mb-3 card-glow" style={{ borderColor: "rgba(16,185,129,0.4)" }}>
                <h3 className="mb-1">Step 2: Decrypt the file</h3>
                <div className="card mb-3" style={{ background: "rgba(16,185,129,0.06)", borderColor: "rgba(16,185,129,0.2)" }}>
                  <div className="flex gap-2" style={{ alignItems: "center" }}>
                    <span style={{ fontSize: "1.5rem" }}>✅</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Decryption key received from chain</div>
                      <div className="text-muted text-xs">{encKeyFromChain.length} bytes · AES-256</div>
                    </div>
                  </div>
                </div>
                <p className="text-muted text-sm mb-3">
                  Enter the password the owner used when creating this capsule.
                  Decryption happens entirely in your browser.
                </p>
                <div className="input-group">
                  <label className="input-label" htmlFor="decrypt-password">Decryption Password</label>
                  <input
                    id="decrypt-password" type="password" className="input"
                    placeholder="Enter the capsule password"
                    value={password} onChange={e => setPassword(e.target.value)}
                  />
                </div>
                <button id="btn-decrypt-file" className="btn btn-success w-full" onClick={handleDecrypt} disabled={decrypting || !password}>
                  {decrypting ? "⏳ Fetching from Walrus & decrypting…" : "🔓 Fetch & Decrypt File"}
                </button>
              </div>
            )}

            {decryptedUrl && (
              <div className="card card-glow text-center animate-fade-in" style={{ padding: "2.5rem", borderColor: "rgba(16,185,129,0.4)" }}>
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎉</div>
                <h2 className="mb-2" style={{ color: "var(--accent-emerald)" }}>File Decrypted!</h2>
                <p className="text-muted text-sm mb-3">
                  Your file was fetched from Walrus and decrypted entirely in the browser.
                </p>
                <a href={decryptedUrl} download={fileName} id="btn-download-file" className="btn btn-success btn-lg">
                  ⬇️ Download File
                </a>
              </div>
            )}
          </>
        )}

        {capsule && (
          <div className="card mt-3" style={{ background: "transparent" }}>
            <div className="flex gap-3 text-sm text-muted" style={{ flexWrap: "wrap", justifyContent: "center" }}>
              <span>Blob: <span className="mono text-xs">{capsule.walrusBlobId?.slice(0, 16)}…</span></span>
              <span>·</span>
              <span>Mode: {mode === "time-capsule" ? "⏰ Time Capsule" : "💀 Dead Man's Switch"}</span>
              <span>·</span>
              <a
                href={`https://suiscan.xyz/${process.env.NEXT_PUBLIC_SUI_NETWORK ?? "testnet"}/object/${objectId}`}
                target="_blank" rel="noopener noreferrer"
                style={{ color: "var(--accent-cyan)", textDecoration: "none" }}
              >
                View on SuiScan ↗
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OpenCapsulePage() {
  return (
    <Suspense fallback={<div className="section flex-center" style={{ minHeight: "60vh" }}><div className="text-muted">Loading…</div></div>}>
      <OpenCapsuleContent />
    </Suspense>
  );
}
