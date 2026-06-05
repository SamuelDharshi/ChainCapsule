"use client";
import { CapsuleData, isUnlockable, msUntilUnlock, shortAddr } from "@/lib/sui";
import CountdownTimer from "./CountdownTimer";
import Link from "next/link";
import { useState } from "react";

interface Props {
  capsule: CapsuleData;
  onHeartbeat?: () => void;
  loading?: boolean;
}

export default function CapsuleCard({ capsule, onHeartbeat, loading }: Props) {
  const [expired, setExpired] = useState(isUnlockable(capsule));
  const remaining = msUntilUnlock(capsule);
  const unlockTarget = capsule.unlockAfterMs > 0
    ? capsule.unlockAfterMs
    : capsule.lastHeartbeat + capsule.inactivityDays * 86_400_000;

  const mode = capsule.unlockAfterMs > 0 ? "time-capsule" : "dead-mans-switch";
  const modeLabel = mode === "time-capsule" ? "⏰ Time Capsule" : "💀 Dead Man's Switch";

  return (
    <div className={`card ${expired ? "card-glow" : ""}`} style={{ position: "relative", overflow: "hidden" }}>
      {/* Mode badge */}
      <div className="flex-between mb-2">
        <span className="badge badge-locked" style={{ fontSize: "0.7rem" }}>{modeLabel}</span>
        <span className={`badge ${expired ? "badge-unlocked" : "badge-active"}`}>
          {expired ? "🔓 Unlockable" : "🔒 Locked"}
        </span>
      </div>

      {/* Object ID */}
      <div className="mb-2">
        <div className="text-muted text-xs mb-1">Capsule ID</div>
        <div className="mono text-sm truncate" style={{ color: "var(--accent-cyan)" }}>
          {capsule.objectId}
        </div>
      </div>

      {/* Beneficiary */}
      <div className="flex gap-2 mb-3" style={{ flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div className="text-muted text-xs mb-1">Beneficiary</div>
          <div className="mono text-sm">{shortAddr(capsule.beneficiary)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div className="text-muted text-xs mb-1">Walrus Blob</div>
          <div className="mono text-sm truncate" style={{ color: "var(--accent-violet)" }}>
            {capsule.walrusBlobId ? `${capsule.walrusBlobId.slice(0, 12)}…` : "—"}
          </div>
        </div>
      </div>

      {/* Countdown */}
      <div className="mb-3">
        <div className="text-muted text-xs mb-2">
          {mode === "time-capsule" ? "Unlocks in" : "Inactivity timer"}
        </div>
        <CountdownTimer targetMs={unlockTarget} onExpire={() => setExpired(true)} />
      </div>

      {/* Actions */}
      <div className="flex gap-1" style={{ flexWrap: "wrap" }}>
        {mode === "dead-mans-switch" && !expired && (
          <button
            id={`heartbeat-${capsule.objectId.slice(-6)}`}
            className="btn btn-success btn-sm"
            onClick={onHeartbeat}
            disabled={loading}
          >
            {loading ? "⏳ Sending…" : "💓 I'm Alive"}
          </button>
        )}
        <Link
          href={`/dashboard/detail/?id=${capsule.objectId}`}
          className="btn btn-secondary btn-sm"
          id={`view-${capsule.objectId.slice(-6)}`}
        >
          View Details →
        </Link>
        <Link
          href={`/open/?id=${capsule.objectId}`}
          className="btn btn-sm"
          id={`open-${capsule.objectId.slice(-6)}`}
          style={{ background: expired ? "var(--grad-primary)" : "var(--bg-card)", border: "1px solid var(--border-subtle)", color: expired ? "#fff" : "var(--text-muted)" }}
        >
          {expired ? "🔓 Unlock" : "Share Link"}
        </Link>
      </div>

      {/* Decorative glow accent */}
      {expired && (
        <div style={{
          position: "absolute", top: 0, right: 0,
          width: 120, height: 120, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(34,211,238,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
      )}
    </div>
  );
}
