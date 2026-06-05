import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Sparkles, X, BrainCircuit, Wallet, Globe } from "lucide-react";
import { ChatMessage, Capsule, BlockchainState } from "../types";

interface AIAssistantProps {
  capsules: Capsule[];
  blockchainState: BlockchainState;
}

export default function AIAssistant({ capsules, blockchainState }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "init",
      role: "model",
      text: "Welcome back, Operator! I am physical oracle interface Node-A3. I am directly tied to Tatum Sui RPC and Walrus storage.\n\nAsk me anything! For example:\n• *What is a Dead Man's Switch?*\n• *How does client-side AES-256 work?*\n• *Are any of my capsules ready to unlock?*",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text: input,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          capsules,
          blockchainState,
        }),
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-model`,
          role: "model",
          text: data.text,
          timestamp: Date.now(),
        },
      ]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-err`,
          role: "model",
          text: `⚠️ **Connection Error**: I was unable to reach the Gemini server. Ensure your GEMINI_API_KEY is configured in your Secrets tab.\n\n*Technical Details: ${error.message || "Failed request proxying"}*`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const setPrompt = (promptText: string) => {
    setInput(promptText);
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white p-4 rounded-full shadow-2xl flex items-center justify-center gap-2 group transition-transform hover:scale-105"
      >
        <Sparkles className="w-5 h-5 animate-pulse text-cyan-200" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-out text-sm font-medium tracking-wide">
          Ask AI Oracle
        </span>
      </button>

      {/* Floating Chat Drawer */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 max-w-[calc(100vw-2rem)] h-[520px] bg-stone-950 border border-stone-800 rounded-2xl shadow-3xl flex flex-col z-50 overflow-hidden backdrop-blur-xl bg-opacity-95 text-stone-100">
          {/* Header */}
          <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-900 bg-opacity-50">
            <div className="flex items-center gap-2.5">
              <div className="bg-cyan-500 bg-opacity-10 p-1.5 rounded-lg border border-cyan-500/30">
                <BrainCircuit className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <span className="font-semibold text-sm block text-stone-100">Sui-Tatum Chain Oracle</span>
                <span className="text-[10px] text-stone-400 font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  GEMINI-3.5-FLASH-CONNECTED
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-stone-400 hover:text-stone-200 p-1 rounded-lg hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Stats Panel inside Chat */}
          <div className="px-4 py-2 bg-stone-900 bg-opacity-30 border-b border-stone-800 flex justify-between items-center text-[10px] font-mono text-stone-400">
            <span className="flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-indigo-400" />
              {capsules.length} Capsules
            </span>
            <span className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              Clock: {new Date(blockchainState.currentTimeMs).toLocaleTimeString()}
            </span>
          </div>

          {/* Suggestion prompts */}
          {messages.length === 1 && (
            <div className="p-3 bg-stone-900/50 flex flex-wrap gap-1.5 border-b border-stone-800">
              <button
                onClick={() => setPrompt("What is a Dead Man's Switch?")}
                className="text-[10px] bg-stone-800 hover:bg-stone-700 text-stone-300 px-2 py-1 rounded"
              >
                What is a Dead Man's Switch?
              </button>
              <button
                onClick={() => setPrompt("Explain how browser client-side AES-256 works on Walrus.")}
                className="text-[10px] bg-stone-800 hover:bg-stone-700 text-stone-300 px-2 py-1 rounded"
              >
                How is AES encrypted?
              </button>
              <button
                onClick={() => setPrompt("Do I have any ready capsules?")}
                className="text-[10px] bg-stone-800 hover:bg-stone-700 text-stone-300 px-2 py-1 rounded"
              >
                Check my readiness status
              </button>
            </div>
          )}

          {/* Messages List Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
            {messages.map((m) => (
              <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs inline-block leading-relaxed ${
                    m.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-none"
                      : "bg-stone-900 border border-stone-800 text-stone-200 rounded-bl-none"
                  }`}
                >
                  <div className="whitespace-pre-line prose prose-stone prose-invert text-stone-200">
                    {m.text}
                  </div>
                </div>
                <span className="text-[9px] text-stone-500 font-mono mt-0.5">
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-1.5 px-3 py-2 bg-stone-900 rounded-xl max-w-[80%] border border-stone-800 text-xs text-stone-400">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                Querying Tatum RPC Node...
              </div>
            )}
          </div>

          {/* Input Form */}
          <form onSubmit={handleSend} className="p-3 border-t border-stone-800 bg-stone-900/60 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the blockchain oracle..."
              className="flex-1 bg-stone-950 text-stone-100 text-xs border border-stone-800 focus:border-cyan-500 focus:outline-none rounded-lg px-3 py-2"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-stone-800 text-white p-2 rounded-lg transition-colors flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
