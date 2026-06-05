"use client";
import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface Props {
  capsuleObjectId?: string;
}

export default function AICapsuleChat({ capsuleObjectId }: Props) {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Hi! I'm your ChainCapsule assistant. Ask me anything about your capsule — like \"How long until it unlocks?\"" },
  ]);
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);

    const apiKey = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY ?? "";

    if (!apiKey) {
      setMessages(prev => [...prev, {
        role: "assistant",
        text: "AI assistant is not configured. Add NEXT_PUBLIC_ANTHROPIC_API_KEY to .env.local to enable it.",
      }]);
      setLoading(false);
      return;
    }

    try {
      // Direct browser → Anthropic API call (no server needed for Chrome extension)
      const systemPrompt = capsuleObjectId
        ? `You are ChainCapsule AI. The user is asking about capsule ${capsuleObjectId} on Sui blockchain. Answer clearly and concisely about time capsules, dead man's switches, Walrus storage, and Sui blockchain. Be helpful and brief.`
        : `You are ChainCapsule AI assistant. Help users understand how ChainCapsule works: encrypted file storage on Walrus, time-lock & dead man's switch mechanisms on Sui blockchain. Be concise and helpful.`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 300,
          system: systemPrompt,
          messages: [{ role: "user", content: userMsg }],
        }),
      });
      const data = await res.json();
      const answer = data?.content?.[0]?.text ?? data?.error?.message ?? "Could not get a response.";
      setMessages(prev => [...prev, { role: "assistant", text: answer }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "Network error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Toggle button */}
      <button
        id="ai-chat-toggle"
        onClick={() => setOpen(o => !o)}
        style={{
          position: "fixed", bottom: "1.5rem", right: "1.5rem",
          width: 56, height: 56, borderRadius: "50%",
          background: "var(--grad-primary)",
          border: "none", cursor: "pointer",
          fontSize: "1.5rem",
          boxShadow: "0 4px 20px rgba(139,92,246,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000,
          transition: "transform 0.2s ease",
        }}
        title="AI Capsule Assistant"
      >
        {open ? "✕" : "🤖"}
      </button>

      {/* Chat window */}
      {open && (
        <div style={{
          position: "fixed", bottom: "5.5rem", right: "1.5rem",
          width: 340, maxHeight: 480,
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-card), var(--shadow-glow)",
          display: "flex", flexDirection: "column",
          zIndex: 999,
          animation: "fadeIn 0.2s ease",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--border-subtle)",
            background: "rgba(139,92,246,0.08)",
            display: "flex", alignItems: "center", gap: "0.5rem",
          }}>
            <span style={{ fontSize: "1.25rem" }}>🤖</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>ChainCapsule AI</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Powered by Claude + Tatum</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  alignSelf:   msg.role === "user" ? "flex-end" : "flex-start",
                  background:  msg.role === "user" ? "var(--grad-primary)" : "var(--bg-card)",
                  color:       msg.role === "user" ? "#fff" : "var(--text-primary)",
                  border:      msg.role === "user" ? "none" : "1px solid var(--border-subtle)",
                  borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                  padding:     "0.6rem 0.9rem",
                  fontSize:    "0.85rem",
                  maxWidth:    "85%",
                  lineHeight:  1.5,
                }}
              >
                {msg.text}
              </div>
            ))}
            {loading && (
              <div style={{
                alignSelf: "flex-start",
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "12px 12px 12px 2px",
                padding: "0.6rem 1rem",
                fontSize: "1rem",
                color: "var(--text-muted)",
              }}>
                ⏳
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {messages.length === 1 && (
            <div style={{ padding: "0 1rem 0.5rem", display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {["How long until it unlocks?", "Who is the beneficiary?", "What's the blob ID?"].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  style={{
                    background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                    borderRadius: "100px", padding: "0.25rem 0.65rem",
                    fontSize: "0.72rem", color: "var(--text-secondary)",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: "0.75rem 1rem",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex", gap: "0.5rem",
          }}>
            <input
              id="ai-chat-input"
              type="text"
              className="input"
              placeholder="Ask about your capsule…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              style={{ flex: 1, padding: "0.5rem 0.75rem", fontSize: "0.85rem" }}
            />
            <button
              id="ai-chat-send"
              className="btn btn-primary btn-sm"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
            >
              →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
