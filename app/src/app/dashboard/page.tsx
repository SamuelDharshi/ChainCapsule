"use client";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { useEffect, useState } from "react";
import { getCapsulesByOwner, getCapsuleObject, CapsuleData, buildHeartbeatTx } from "@/lib/sui";
import CapsuleCard from "@/components/CapsuleCard";
import Link from "next/link";

export default function DashboardPage() {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [capsules, setCapsules] = useState<CapsuleData[]>([]);
  const [loading, setLoading] = useState(false);
  const [heartbeating, setHeartbeating] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  async function loadCapsules(address: string) {
    setLoading(true);
    setError("");
    try {
      const ids = await getCapsulesByOwner(address);
      const details = await Promise.all(ids.map(id => getCapsuleObject(id).catch(() => null)));
      setCapsules(details.filter(Boolean) as CapsuleData[]);
    } catch (e) {
      setError(`Failed to load capsules: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (account?.address) loadCapsules(account.address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address]);

  async function handleHeartbeat(capsuleId: string) {
    setHeartbeating(capsuleId);
    try {
      const tx = buildHeartbeatTx(capsuleId);
      await signAndExecute({ transaction: tx });
      showToast("💓 Heartbeat sent! Inactivity timer reset.", "success");
      if (account?.address) loadCapsules(account.address);
    } catch (e) {
      showToast(`Heartbeat failed: ${String(e)}`, "error");
    } finally {
      setHeartbeating(null);
    }
  }

  if (!account) {
    return (
      <div className="section flex-center" style={{ minHeight: "60vh" }}>
        <div className="card text-center" style={{ maxWidth: 420, padding: "3rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔌</div>
          <h3 className="mb-2">Connect your wallet</h3>
          <p className="text-muted text-sm">Connect your Sui wallet to view your active capsules.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      <div className="container">
        {/* Header */}
        <div className="flex-between mb-4" style={{ flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ fontSize: "2rem", marginBottom: "0.25rem" }}>
              My <span className="text-gradient">Dashboard</span>
            </h1>
            <div className="text-muted text-sm mono">{account.address.slice(0, 18)}…</div>
          </div>
          <Link href="/create" className="btn btn-primary" id="dashboard-create-new">
            + New Capsule
          </Link>
        </div>

        {/* Stats bar */}
        <div className="grid-3 mb-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {[
            { label: "Total Capsules", value: capsules.length, icon: "⛓️" },
            { label: "Time Capsules", value: capsules.filter(c => c.unlockAfterMs > 0).length, icon: "⏰" },
            { label: "Dead Man Switches", value: capsules.filter(c => c.inactivityDays > 0).length, icon: "💀" },
          ].map(stat => (
            <div key={stat.label} className="card text-center">
              <div style={{ fontSize: "1.75rem", marginBottom: "0.25rem" }}>{stat.icon}</div>
              <div style={{ fontSize: "2rem", fontWeight: 800, background: "var(--grad-primary)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                {stat.value}
              </div>
              <div className="text-muted text-xs">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="card mb-3" style={{ borderColor: "rgba(244,63,94,0.4)", background: "rgba(244,63,94,0.06)" }}>
            <span className="text-danger text-sm">⚠️ {error}</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex-center" style={{ padding: "4rem", color: "var(--text-muted)" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem", animation: "spin-slow 2s linear infinite", display: "inline-block" }}>⏳</div>
              <div>Loading capsules from chain…</div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && capsules.length === 0 && !error && (
          <div className="card text-center" style={{ padding: "4rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📭</div>
            <h3 className="mb-2">No capsules yet</h3>
            <p className="text-muted text-sm mb-3">Create your first capsule to start protecting your legacy.</p>
            <Link href="/create" className="btn btn-primary" id="empty-create-link">
              🔒 Create a Capsule
            </Link>
          </div>
        )}

        {/* Capsule grid */}
        {!loading && capsules.length > 0 && (
          <div className="grid-2">
            {capsules.map(cap => (
              <CapsuleCard
                key={cap.objectId}
                capsule={cap}
                onHeartbeat={() => handleHeartbeat(cap.objectId)}
                loading={heartbeating === cap.objectId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          <span>{toast.type === "success" ? "✅" : "❌"}</span>
          <span className="text-sm">{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
