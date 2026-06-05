"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import {
  getCapsuleObject, CapsuleData, isUnlockable, msUntilUnlock,
  buildHeartbeatTx, shortAddr, formatDuration
} from "@/lib/sui";
import CountdownTimer from "@/components/CountdownTimer";
import Link from "next/link";

function CapsuleDetailContent() {
  const searchParams = useSearchParams();
  const objectId = searchParams.get("id") ?? "";

  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [capsule, setCapsule]   = useState<CapsuleData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [beating, setBeating]   = useState(false);
  const [error, setError]       = useState("");
  const [toast, setToast]       = useState("");
  const [copied, setCopied]     = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  useEffect(() => {
    if (!objectId) { setError("No capsule ID provided."); setLoading(false); return; }
    getCapsuleObject(objectId)
      .then(setCapsule)
      .catch(() => setError("Capsule not found or not yet indexed."))
      .finally(() => setLoading(false));
  }, [objectId]);

  async function handleHeartbeat() {
    if (!account || !objectId) return;
    setBeating(true);
    try {
      await signAndExecute({ transaction: buildHeartbeatTx(objectId) });
      showToast("💓 Heartbeat sent! Inactivity timer reset.");
      const updated = await getCapsuleObject(objectId);
      setCapsule(updated);
    } catch (e) {
      showToast(`Heartbeat failed: ${String(e)}`);
    } finally {
      setBeating(false);
    }
  }

  function copyShareLink() {
    const openUrl = `${window.location.origin}/open/?id=${objectId}`;
    navigator.clipboard.writeText(openUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="section flex-center" style={{ minHeight: "60vh" }}>
        <div className="text-muted">Loading capsule…</div>
      </div>
    );
  }

  if (error || !capsule) {
    return (
      <div className="section flex-center" style={{ minHeight: "60vh" }}>
        <div className="card text-center" style={{ maxWidth: 400, padding: "2rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>❌</div>
          <h3 className="mb-2">Capsule not found</h3>
          <p className="text-muted text-sm mb-3">{error}</p>
          <Link href="/dashboard" className="btn btn-secondary btn-sm">← Dashboard</Link>
        </div>
      </div>
    );
  }

  const unlockable   = isUnlockable(capsule);
  const remaining    = msUntilUnlock(capsule);
  const mode         = capsule.unlockAfterMs > 0 ? "time-capsule" : "dead-mans-switch";
  const isOwner      = account?.address === capsule.owner;
  const unlockTarget = capsule.unlockAfterMs > 0
    ? capsule.unlockAfterMs
    : capsule.lastHeartbeat + capsule.inactivityDays * 86_400_000;

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: 720 }}>
        {/* Back */}
        <Link href="/dashboard" className="text-muted text-sm" style={{ textDecoration: "none", display: "inline-block", marginBottom: "1.5rem" }}>
          ← Back to Dashboard
        </Link>

        {/* Title */}
        <div className="flex-between mb-4" style={{ flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h2 style={{ marginBottom: "0.25rem" }}>
              {mode === "time-capsule" ? "⏰" : "💀"}{" "}
              <span className="text-gradient">{mode === "time-capsule" ? "Time Capsule" : "Dead Man's Switch"}</span>
            </h2>
            <div className="mono text-xs text-muted truncate" style={{ maxWidth: 360 }}>{objectId}</div>
          </div>
          <span className={`badge ${unlockable ? "badge-unlocked" : "badge-locked"}`} style={{ fontSize: "0.85rem" }}>
            {unlockable ? "🔓 Unlockable" : "🔒 Locked"}
          </span>
        </div>

        {/* Countdown */}
        <div className="card card-glow mb-3" style={{ textAlign: "center", padding: "2rem" }}>
          <div className="text-muted text-sm mb-2">
            {unlockable ? "Ready to unlock!" : mode === "time-capsule" ? "Unlocks in" : "Inactivity timer expires in"}
          </div>
          <div className="flex-center">
            <CountdownTimer targetMs={unlockTarget} />
          </div>
          {!unlockable && (
            <div className="text-muted text-xs mt-2">{formatDuration(remaining)} remaining</div>
          )}
        </div>

        {/* Details grid */}
        <div className="card mb-3">
          <h4 className="mb-2">Capsule Details</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <DetailRow label="Owner"          value={shortAddr(capsule.owner)} mono />
            <DetailRow label="Beneficiary"    value={shortAddr(capsule.beneficiary)} mono />
            <DetailRow label="Walrus Blob ID" value={capsule.walrusBlobId ? `${capsule.walrusBlobId.slice(0, 24)}…` : "—"} mono />
            <DetailRow label="Created"        value={new Date(capsule.createdAt).toLocaleString()} />
            <DetailRow label="Last Heartbeat" value={new Date(capsule.lastHeartbeat).toLocaleString()} />
            {mode === "time-capsule" && (
              <DetailRow label="Fixed Unlock" value={new Date(capsule.unlockAfterMs).toLocaleString()} />
            )}
            {mode === "dead-mans-switch" && (
              <DetailRow label="Inactivity"   value={`${capsule.inactivityDays} days`} />
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="card mb-3">
          <h4 className="mb-2">Actions</h4>
          <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
            {isOwner && mode === "dead-mans-switch" && (
              <button id="detail-heartbeat-btn" className="btn btn-success" onClick={handleHeartbeat} disabled={beating}>
                {beating ? "⏳ Sending…" : "💓 Send Heartbeat"}
              </button>
            )}
            <Link href={`/open/?id=${objectId}`} className="btn btn-primary" id="detail-unlock-link">
              🔓 Beneficiary Unlock Page
            </Link>
            <button id="detail-copy-link" className="btn btn-secondary" onClick={copyShareLink}>
              {copied ? "✅ Copied!" : "🔗 Copy Beneficiary Link"}
            </button>
            <a
              href={`https://suiscan.xyz/${process.env.NEXT_PUBLIC_SUI_NETWORK ?? "testnet"}/object/${objectId}`}
              target="_blank" rel="noopener noreferrer"
              className="btn btn-secondary" id="detail-suiscan"
            >
              🔍 SuiScan
            </a>
          </div>
        </div>
      </div>

      {toast && (
        <div className="toast success">
          <span>✅</span>
          <span className="text-sm">{toast}</span>
        </div>
      )}
    </div>
  );
}

export default function CapsuleDetailPage() {
  return (
    <Suspense fallback={<div className="section flex-center" style={{ minHeight: "60vh" }}><div className="text-muted">Loading…</div></div>}>
      <CapsuleDetailContent />
    </Suspense>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex-between text-sm" style={{ gap: "1rem", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.5rem" }}>
      <span className="text-muted" style={{ flexShrink: 0 }}>{label}</span>
      <span className={mono ? "mono truncate" : "truncate"} style={{ textAlign: "right", color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}
