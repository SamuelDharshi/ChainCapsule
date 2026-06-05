import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "ChainCapsule — Store Secrets. Let Time Unlock Them.",
  description:
    "Encrypt files client-side, store on Walrus decentralized storage, and program a Sui smart contract to release the decryption key after a fixed date or inactivity.",
};

const features = [
  {
    icon: "🔐",
    title: "Client-Side Encryption",
    desc: "AES-256-GCM encrypts your file in the browser. Plaintext never leaves your device.",
  },
  {
    icon: "🌊",
    title: "Walrus Decentralized Storage",
    desc: "Encrypted ciphertext is stored on Walrus. Only the blob ID is recorded on Sui.",
  },
  {
    icon: "⛓️",
    title: "Sui Smart Contract",
    desc: "Move contract holds the blob ID and encrypted key. Released only when conditions are met.",
  },
  {
    icon: "⏰",
    title: "Time Capsule Mode",
    desc: "Set a fixed future date. Your file becomes readable on your 60th birthday, anniversary, or any milestone.",
  },
  {
    icon: "💀",
    title: "Dead Man's Switch",
    desc: "If you don't check in for N days, the contract automatically releases the key to your beneficiary.",
  },
  {
    icon: "🤖",
    title: "AI Assistant",
    desc: "Ask \"How long until my capsule unlocks?\" in plain English via the Tatum MCP integration.",
  },
];

export default function LandingPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="section" style={{ minHeight: "calc(100vh - 64px)", display: "flex", alignItems: "center" }}>
        <div className="container text-center">
          {/* Eyebrow */}
          <div className="animate-fade-in" style={{ marginBottom: "1.5rem" }}>
            <span className="badge badge-locked" style={{ fontSize: "0.8rem", padding: "0.35rem 1rem" }}>
              Built on Sui + Walrus · Powered by Tatum
            </span>
          </div>

          {/* Headline */}
          <h1 className="animate-fade-in delay-100" style={{ marginBottom: "1.5rem" }}>
            Store your secrets<br />
            <span className="text-gradient">on-chain.</span>
          </h1>

          <p className="animate-fade-in delay-200" style={{
            fontSize: "clamp(1.1rem, 2vw, 1.35rem)",
            color: "var(--text-secondary)",
            maxWidth: 600,
            margin: "0 auto 2.5rem",
            lineHeight: 1.7,
          }}>
            Encrypt any file in your browser, store the ciphertext on Walrus, and
            program a Sui smart contract to release the decryption key after a
            future date — or after you go dark.
          </p>

          {/* CTAs */}
          <div className="animate-fade-in delay-300 flex-center gap-2" style={{ flexWrap: "wrap" }}>
            <Link href="/create" id="cta-create" className="btn btn-primary btn-lg">
              🔒 Create a Capsule
            </Link>
            <Link href="/dashboard" id="cta-dashboard" className="btn btn-secondary btn-lg">
              📊 My Dashboard
            </Link>
          </div>

          {/* Floating visual */}
          <div className="animate-float" style={{ marginTop: "4rem", fontSize: "5rem", lineHeight: 1 }}>
            ⛓️
          </div>
          <div style={{
            width: 300, height: 300,
            background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)",
            borderRadius: "50%",
            margin: "-140px auto 0",
            pointerEvents: "none",
          }} />
        </div>
      </section>

      {/* ── Mode Cards ───────────────────────────────────────────────── */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <h2 className="text-center mb-4">Two ways to protect your legacy</h2>
          <div className="grid-2" style={{ gap: "2rem", maxWidth: 860, margin: "0 auto" }}>
            {/* Mode A */}
            <div className="card card-glow" style={{ padding: "2.5rem", textAlign: "center" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⏰</div>
              <h3 className="text-gradient mb-2">Time Capsule</h3>
              <p className="text-muted" style={{ lineHeight: 1.8, marginBottom: "1.5rem" }}>
                Set a fixed unlock date — a birthday, anniversary, or retirement.
                The file is completely inaccessible until that exact moment on Sui's clock.
              </p>
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.8rem", color: "var(--accent-cyan)", background: "rgba(34,211,238,0.06)", padding: "0.75rem 1rem", borderRadius: 8, border: "1px solid rgba(34,211,238,0.15)" }}>
                unlock_after_ms = Jan 1, 2030
              </div>
            </div>

            {/* Mode B */}
            <div className="card" style={{ padding: "2.5rem", textAlign: "center" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>💀</div>
              <h3 style={{ background: "var(--grad-danger)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", marginBottom: "0.5rem" }}>
                Dead Man&#39;s Switch
              </h3>
              <p className="text-muted" style={{ lineHeight: 1.8, marginBottom: "1.5rem" }}>
                If you don&#39;t send a heartbeat for N days, the contract releases
                the key to your beneficiary. Perfect for estate planning.
              </p>
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.8rem", color: "var(--accent-rose)", background: "rgba(244,63,94,0.06)", padding: "0.75rem 1rem", borderRadius: 8, border: "1px solid rgba(244,63,94,0.15)" }}>
                inactivity_days = 90
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Grid ─────────────────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <h2 className="text-center mb-4">How it works</h2>
          <div className="grid-3">
            {features.map((f, i) => (
              <div key={i} className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>{f.icon}</div>
                <h4 style={{ marginBottom: "0.5rem" }}>{f.title}</h4>
                <p className="text-muted text-sm" style={{ lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security callout ─────────────────────────────────────────── */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="card card-glow" style={{ maxWidth: 760, margin: "0 auto", padding: "2.5rem", textAlign: "center" }}>
            <h2 className="mb-2">Zero trust. Zero server.</h2>
            <p className="text-muted" style={{ lineHeight: 1.8, marginBottom: "2rem" }}>
              Your plaintext never leaves your browser. Walrus stores only ciphertext.
              The decryption key lives on Sui — locked until the smart contract
              verifies your unlock condition.
            </p>
            <div className="flex-center gap-3" style={{ flexWrap: "wrap" }}>
              {["✅ Client-side encryption", "✅ No server", "✅ No database", "✅ No middleman"].map(item => (
                <span key={item} className="badge badge-active" style={{ fontSize: "0.8rem" }}>{item}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section className="section text-center">
        <div className="container">
          <h2 className="mb-2">Ready to store your legacy?</h2>
          <p className="text-muted mb-4">Takes less than 2 minutes to create your first capsule.</p>
          <Link href="/create" id="cta-bottom" className="btn btn-primary btn-lg">
            🔒 Create Your Capsule
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid var(--border-subtle)", padding: "2rem 0", marginTop: "2rem" }}>
        <div className="container flex-between text-muted text-sm" style={{ flexWrap: "wrap", gap: "1rem" }}>
          <span>⛓️ ChainCapsule · Built for Tatum x Walrus Hackathon</span>
          <span>Sui + Walrus + Tatum MCP</span>
        </div>
      </footer>
    </>
  );
}
