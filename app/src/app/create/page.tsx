"use client";
import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { encryptFile, packPayload } from "@/lib/crypto";
import { uploadToWalrus } from "@/lib/walrus";
import { buildCreateTx } from "@/lib/sui";
import FileDropzone from "@/components/FileDropzone";

type Mode = "time-capsule" | "dead-mans-switch";
type StepId = 1 | 2 | 3 | 4;

interface StepInfo { id: StepId; label: string; }
const STEPS: StepInfo[] = [
  { id: 1, label: "Encrypt" },
  { id: 2, label: "Upload" },
  { id: 3, label: "Configure" },
  { id: 4, label: "Deploy" },
];

export default function CreatePage() {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  // Step state
  const [step, setStep] = useState<StepId>(1);
  const [mode, setMode] = useState<Mode>("time-capsule");

  // Step 1 — file + password
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [encPayload, setEncPayload] = useState<{ ciphertext: Uint8Array; rawKey: Uint8Array; } | null>(null);

  // Step 2 — Walrus upload
  const [blobId, setBlobId] = useState("");
  const [uploading, setUploading] = useState(false);

  // Step 3 — capsule config
  const [beneficiary, setBeneficiary] = useState("");
  const [unlockDate, setUnlockDate] = useState("");
  const [inactivityDays, setInactivityDays] = useState(90);

  // Step 4 — deploy result
  const [deploying, setDeploying] = useState(false);
  const [capsuleId, setCapsuleId] = useState("");
  const [error, setError] = useState("");

  // ── Step 1: Encrypt file in browser ───────────────────────────────
  async function handleEncrypt() {
    if (!file || !password) return;
    setError("");
    try {
      const result = await encryptFile(file, password);
      const packed = packPayload(result);
      setEncPayload({ ciphertext: packed, rawKey: result.rawKey });
      setStep(2);
    } catch (e) {
      setError(`Encryption failed: ${String(e)}`);
    }
  }

  // ── Step 2: Upload to Walrus ───────────────────────────────────────
  async function handleUpload() {
    if (!encPayload) return;
    setUploading(true); setError("");
    try {
      const id = await uploadToWalrus(encPayload.ciphertext, 10);
      setBlobId(id);
      setStep(3);
    } catch (e) {
      setError(`Walrus upload failed: ${String(e)}`);
    } finally {
      setUploading(false);
    }
  }

  // ── Step 4: Deploy capsule on Sui ──────────────────────────────────
  async function handleDeploy() {
    if (!account || !encPayload || !blobId || !beneficiary) return;
    setDeploying(true); setError("");
    try {
      const unlockDateMs = mode === "time-capsule" && unlockDate
        ? new Date(unlockDate).getTime()
        : 0;
      const inactivityD = mode === "dead-mans-switch" ? inactivityDays : 0;

      const tx = buildCreateTx({
        blobId,
        encKey:       encPayload.rawKey,
        beneficiary,
        unlockDateMs,
        inactivityD,
      });

      const result = await signAndExecute({ transaction: tx });
      // Extract created object ID from effects
      const createdObj = (result as { effects?: { created?: Array<{ reference?: { objectId?: string } }> } })
        ?.effects?.created?.[0]?.reference?.objectId ?? "check SuiScan";
      setCapsuleId(createdObj);
      setStep(4);
    } catch (e) {
      setError(`Deploy failed: ${String(e)}`);
    } finally {
      setDeploying(false);
    }
  }

  if (!account) {
    return (
      <div className="section flex-center" style={{ minHeight: "60vh" }}>
        <div className="card text-center" style={{ maxWidth: 420, padding: "3rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔌</div>
          <h3 className="mb-2">Connect your wallet</h3>
          <p className="text-muted text-sm">
            Connect a Sui wallet to create and deploy your capsule.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: 680 }}>
        {/* Header */}
        <div className="text-center mb-4">
          <h1 style={{ fontSize: "2.2rem", marginBottom: "0.5rem" }}>
            Create a <span className="text-gradient">Capsule</span>
          </h1>
          <p className="text-muted">Your file is encrypted in the browser — nothing leaves your device unencrypted.</p>
        </div>

        {/* Stepper */}
        <div className="stepper mb-4">
          {STEPS.map((s, i) => (
            <div key={s.id} className="step-item">
              <div className={`step-circle ${step > s.id ? "done" : step === s.id ? "active" : "inactive"}`}>
                {step > s.id ? "✓" : s.id}
              </div>
              <div style={{ display: "flex", flexDirection: "column", marginLeft: "0.4rem", flexShrink: 0 }}>
                <span style={{ fontSize: "0.75rem", color: step >= s.id ? "var(--text-primary)" : "var(--text-muted)", fontWeight: 600 }}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`step-line ${step > s.id ? "done" : ""}`} />
              )}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="card mb-3" style={{ borderColor: "rgba(244,63,94,0.4)", background: "rgba(244,63,94,0.06)" }}>
            <span className="text-danger text-sm">⚠️ {error}</span>
          </div>
        )}

        {/* ── Step 1: Encrypt ── */}
        {step === 1 && (
          <div className="card">
            <h3 className="mb-3">🔐 Encrypt your file</h3>

            {/* Mode selector */}
            <div className="mb-3">
              <div className="input-label mb-2">Unlock Mode</div>
              <div className="flex gap-2">
                <button
                  id="mode-time-capsule"
                  className={`btn ${mode === "time-capsule" ? "btn-primary" : "btn-secondary"} btn-sm`}
                  style={{ flex: 1 }}
                  onClick={() => setMode("time-capsule")}
                >
                  ⏰ Time Capsule
                </button>
                <button
                  id="mode-dead-mans-switch"
                  className={`btn ${mode === "dead-mans-switch" ? "btn-danger" : "btn-secondary"} btn-sm`}
                  style={{ flex: 1 }}
                  onClick={() => setMode("dead-mans-switch")}
                >
                  💀 Dead Man&#39;s Switch
                </button>
              </div>
            </div>

            <div className="mb-3">
              <div className="input-label mb-2">File to encrypt</div>
              <FileDropzone onFile={setFile} />
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="password">Encryption Password</label>
              <input
                id="password"
                type="password"
                className="input"
                placeholder="Min 12 characters recommended"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <div className="text-muted text-xs mt-1">
                This password derives your AES-256 key. Store it securely — it is NOT stored on-chain.
              </div>
            </div>

            <button
              id="btn-encrypt"
              className="btn btn-primary w-full"
              onClick={handleEncrypt}
              disabled={!file || password.length < 6}
            >
              🔐 Encrypt in Browser
            </button>
          </div>
        )}

        {/* ── Step 2: Upload to Walrus ── */}
        {step === 2 && (
          <div className="card">
            <h3 className="mb-1">🌊 Upload to Walrus</h3>
            <p className="text-muted text-sm mb-3">
              Your encrypted ciphertext will be stored on Walrus decentralized storage.
              Only the blob ID is recorded on Sui.
            </p>

            <div className="card mb-3" style={{ background: "rgba(16,185,129,0.06)", borderColor: "rgba(16,185,129,0.2)" }}>
              <div className="flex gap-2" style={{ alignItems: "center" }}>
                <span style={{ fontSize: "1.5rem" }}>✅</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>File encrypted successfully</div>
                  <div className="text-muted text-xs">AES-256-GCM · {encPayload?.ciphertext.length.toLocaleString()} bytes</div>
                </div>
              </div>
            </div>

            <button
              id="btn-upload"
              className="btn btn-primary w-full"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? "⏳ Uploading to Walrus…" : "🌊 Upload Ciphertext to Walrus"}
            </button>
          </div>
        )}

        {/* ── Step 3: Configure ── */}
        {step === 3 && (
          <div className="card">
            <h3 className="mb-1">⚙️ Configure your capsule</h3>
            <p className="text-muted text-sm mb-3">Set who can unlock it and when.</p>

            {/* Blob ID confirmation */}
            <div className="card mb-3" style={{ background: "rgba(34,211,238,0.05)", borderColor: "rgba(34,211,238,0.2)", padding: "0.75rem 1rem" }}>
              <div className="text-muted text-xs mb-1">Walrus Blob ID</div>
              <div className="mono text-sm truncate" style={{ color: "var(--accent-cyan)" }}>{blobId}</div>
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="beneficiary">Beneficiary Address</label>
              <input
                id="beneficiary"
                type="text"
                className="input mono"
                placeholder="0x..."
                value={beneficiary}
                onChange={e => setBeneficiary(e.target.value)}
              />
              <div className="text-muted text-xs mt-1">The Sui address that can unlock and decrypt this capsule.</div>
            </div>

            {mode === "time-capsule" ? (
              <div className="input-group">
                <label className="input-label" htmlFor="unlock-date">Unlock Date & Time</label>
                <input
                  id="unlock-date"
                  type="datetime-local"
                  className="input"
                  value={unlockDate}
                  onChange={e => setUnlockDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
            ) : (
              <div className="input-group">
                <label className="input-label" htmlFor="inactivity-days">
                  Inactivity Threshold: <strong style={{ color: "var(--accent-rose)" }}>{inactivityDays} days</strong>
                </label>
                <input
                  id="inactivity-days"
                  type="range"
                  min={1}
                  max={365}
                  value={inactivityDays}
                  onChange={e => setInactivityDays(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--accent-violet)" }}
                />
                <div className="flex-between text-xs text-muted mt-1">
                  <span>1 day</span><span>365 days</span>
                </div>
              </div>
            )}

            <button
              id="btn-configure-next"
              className="btn btn-primary w-full"
              onClick={() => setStep(4)}
              disabled={!beneficiary || (mode === "time-capsule" && !unlockDate)}
            >
              Continue to Deploy →
            </button>
          </div>
        )}

        {/* ── Step 4: Deploy ── */}
        {step === 4 && !capsuleId && (
          <div className="card">
            <h3 className="mb-1">🚀 Deploy to Sui</h3>
            <p className="text-muted text-sm mb-3">
              Calling <span className="mono">capsule::create</span> on the Sui smart contract.
              Your wallet will prompt you to sign the transaction.
            </p>

            {/* Summary */}
            <div className="card mb-3" style={{ background: "rgba(139,92,246,0.05)", gap: "0.5rem", display: "flex", flexDirection: "column" }}>
              <SummaryRow label="Mode"        value={mode === "time-capsule" ? "⏰ Time Capsule" : "💀 Dead Man's Switch"} />
              <SummaryRow label="Blob ID"     value={blobId.slice(0, 20) + "…"} mono />
              <SummaryRow label="Beneficiary" value={beneficiary.slice(0, 14) + "…"} mono />
              {mode === "time-capsule"
                ? <SummaryRow label="Unlocks at" value={new Date(unlockDate).toLocaleString()} />
                : <SummaryRow label="Inactivity" value={`${inactivityDays} days`} />
              }
            </div>

            <button
              id="btn-deploy"
              className="btn btn-primary w-full"
              onClick={handleDeploy}
              disabled={deploying}
            >
              {deploying ? "⏳ Waiting for wallet signature…" : "🚀 Deploy Capsule on Sui"}
            </button>
          </div>
        )}

        {/* ── Success ── */}
        {capsuleId && (
          <div className="card card-glow text-center animate-fade-in" style={{ padding: "2.5rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎉</div>
            <h2 className="text-gradient mb-2">Capsule Created!</h2>
            <p className="text-muted text-sm mb-3">Your capsule is live on Sui. Share the link below with your beneficiary.</p>

            <div className="card mb-3" style={{ padding: "0.75rem 1rem" }}>
              <div className="text-muted text-xs mb-1">Capsule Object ID</div>
              <div className="mono text-sm" style={{ color: "var(--accent-cyan)", wordBreak: "break-all" }}>{capsuleId}</div>
            </div>

            <div className="flex gap-2" style={{ flexWrap: "wrap", justifyContent: "center" }}>
              <a
                href={`/open/?id=${capsuleId}`}
                className="btn btn-secondary btn-sm"
                id="share-beneficiary-link"
              >
                🔗 Beneficiary Link
              </a>
              <a
                href={`https://suiscan.xyz/testnet/object/${capsuleId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
                id="view-suiscan"
              >
                🔍 View on SuiScan
              </a>
              <a href="/dashboard" className="btn btn-primary btn-sm" id="go-dashboard">
                📊 Go to Dashboard
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex-between text-sm" style={{ gap: "1rem" }}>
      <span className="text-muted">{label}</span>
      <span className={mono ? "mono" : ""} style={{ textAlign: "right", color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}
