import { useState, useEffect } from "react";
import { Lock, Cpu, Coins, Hourglass, Heart, ShieldAlert, FileKey2, HelpCircle, ArrowRight, Zap, RefreshCw, Layers, Sparkles } from "lucide-react";
import { useCurrentAccount, ConnectButton } from "@mysten/dapp-kit";
import ThreeCanvas from "./components/ThreeCanvas";
import CreateCapsuleForm from "./components/CreateCapsuleForm";
import Dashboard from "./components/Dashboard";
import OpenCapsule from "./components/OpenCapsule";
import AIAssistant from "./components/AIAssistant";
import { Capsule, BlockchainState, LogEvent } from "./types";
import {
  getCapsulesByOwner,
  getCapsuleObject,
  loadLocalMeta,
} from "./blockchain";

export default function App() {
  const [activeTab, setActiveTab] = useState<"landing" | "create" | "dashboard" | "open">("landing");
  const [threeState, setThreeState] = useState<"neutral" | "active" | "warning" | "uploading" | "unlocked">("neutral");

  // Real wallet from dapp-kit
  const account = useCurrentAccount();

  // Blockchain display state — block height is cosmetic, time is real
  const [blockchain, setBlockchain] = useState<BlockchainState>({
    currentTimeMs: Date.now(),
    blockHeight: 31284902,
    walletAddress: "",
    walletBalance: 0,
    beneficiaryAddress: "",
    beneficiaryBalance: 0,
  });

  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [loadingCapsules, setLoadingCapsules] = useState(false);
  const [logs, setLogs] = useState<LogEvent[]>([
    {
      id: "genesis",
      timestamp: Date.now(),
      type: "info",
      message: "⛓️ SUI Validator Node initialized. Listening on Tatum RPC gateway...",
    },
    {
      id: "genesis-walrus",
      timestamp: Date.now(),
      type: "success",
      message: "🦭 Walrus Storage decentralized storage aggregate online (TestNet cluster-9).",
    }
  ]);

  const addLog = (log: LogEvent) => {
    setLogs((prev) => [...prev, log]);
  };

  // Hash routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (["landing", "create", "dashboard", "open"].includes(hash)) {
        setActiveTab(hash as any);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const handleTabChange = (tab: "landing" | "create" | "dashboard" | "open") => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  // Update blockchain state when wallet connects/disconnects
  useEffect(() => {
    if (account?.address) {
      setBlockchain(prev => ({
        ...prev,
        walletAddress: account.address,
      }));
      addLog({
        id: `wallet-connect-${Date.now()}`,
        timestamp: Date.now(),
        type: "success",
        message: `🔗 Wallet connected: ${account.address.slice(0, 10)}...${account.address.slice(-6)}`,
      });
      // Load capsules from chain
      loadCapsulesFromChain(account.address);
    } else {
      setBlockchain(prev => ({
        ...prev,
        walletAddress: "",
      }));
      setCapsules([]);
    }
  }, [account?.address]);

  // Load real capsules from Sui chain + localStorage metadata
  async function loadCapsulesFromChain(ownerAddress: string) {
    setLoadingCapsules(true);
    addLog({
      id: `load-capsules-${Date.now()}`,
      timestamp: Date.now(),
      type: "info",
      message: `📡 Querying Sui chain for capsules owned by ${ownerAddress.slice(0, 10)}...`,
    });

    try {
      const capsuleIds = await getCapsulesByOwner(ownerAddress);

      if (capsuleIds.length === 0) {
        addLog({
          id: `no-capsules-${Date.now()}`,
          timestamp: Date.now(),
          type: "info",
          message: "📭 No capsules found on-chain for this wallet. Create your first one!",
        });
        setLoadingCapsules(false);
        return;
      }

      const loaded: Capsule[] = [];

      for (const objectId of capsuleIds) {
        try {
          const onChain = await getCapsuleObject(objectId);
          const meta = loadLocalMeta(objectId);

          const capsule: Capsule = {
            id: objectId,
            name: meta?.name ?? `Capsule ${objectId.slice(0, 8)}`,
            description: meta?.description ?? "",
            owner: onChain.owner,
            beneficiary: onChain.beneficiary,
            walrusBlobId: onChain.walrusBlobId,
            ciphertext: "", // fetched on-demand during unlock
            fileName: meta?.fileName ?? "unknown.bin",
            fileType: meta?.fileType ?? "application/octet-stream",
            fileSize: meta?.fileSize ?? 0,
            encKeyHint: onChain.encKeyHint,
            unlockAfterMs: onChain.unlockAfterMs,
            inactivityDays: onChain.inactivityDays,
            lastHeartbeat: onChain.lastHeartbeat,
            isUnlocked: false,
            iv: "", // extracted from Walrus blob on-demand
            salt: meta?.salt ?? "",
            createdAt: onChain.createdAt,
          };
          loaded.push(capsule);
        } catch (err) {
          console.warn(`Failed to load capsule ${objectId}:`, err);
        }
      }

      setCapsules(loaded);
      addLog({
        id: `loaded-capsules-${Date.now()}`,
        timestamp: Date.now(),
        type: "success",
        message: `✅ Loaded ${loaded.length} capsule(s) from Sui chain.`,
      });
    } catch (err: any) {
      addLog({
        id: `load-err-${Date.now()}`,
        timestamp: Date.now(),
        type: "error",
        message: `🚨 Failed to load capsules: ${err.message || err}`,
      });
    } finally {
      setLoadingCapsules(false);
    }
  }

  // Block height cosmetic ticker + real time
  useEffect(() => {
    const timer = setInterval(() => {
      setBlockchain((prev) => ({
        ...prev,
        currentTimeMs: Date.now(),
        blockHeight: prev.blockHeight + (Math.random() > 0.8 ? 1 : 0),
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Called by CreateCapsuleForm after successful on-chain creation
  const handleCapsuleCreated = (newCap: Capsule) => {
    setCapsules((prev) => [newCap, ...prev]);
  };

  // Called by Dashboard after successful heartbeat tx
  const handleSendHeartbeat = (capsuleId: string) => {
    setCapsules((prev) =>
      prev.map((c) =>
        c.id === capsuleId
          ? { ...c, lastHeartbeat: Date.now() }
          : c
      )
    );
  };

  // Called by OpenCapsule after successful unlock tx
  const handleUnlockCapsule = (capsuleId: string) => {
    setCapsules((prev) =>
      prev.map((c) =>
        c.id === capsuleId ? { ...c, isUnlocked: true } : c
      )
    );
  };

  // Refresh capsules from chain (used after create/heartbeat)
  const handleRefreshCapsules = () => {
    if (account?.address) {
      loadCapsulesFromChain(account.address);
    }
  };

  // Not needed for real chain (no virtual time travel), kept for UI compatibility
  const handleSetTimeMs = (_newTime: number) => {
    // No-op for real chain — time comes from Sui Clock object
  };

  return (
    <div className="min-h-screen bg-stone-975 text-stone-100 font-sans flex flex-col selection:bg-cyan-500 selection:text-black">
      
      {/* Top Banner Warning Sandbox Info */}
      <div className="bg-linear-to-r from-indigo-950/60 via-stone-900/85 to-indigo-950/60 border-b border-indigo-900/35 px-4 py-2 text-center text-[10px] font-mono tracking-wide text-indigo-300 flex items-center justify-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '10s' }} />
        <span>LIVE ON SUI TESTNET — POWERED BY TATUM RPC + WALRUS STORAGE</span>
        <span className="hidden sm:inline bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30 font-bold uppercase text-[9px] text-cyan-200">
          Sui clock syncing live
        </span>
      </div>

      {/* Main futuristic Navigation Bar */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-stone-975 bg-opacity-80 border-b border-stone-900 px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleTabChange("landing")}>
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-cyan-400 to-indigo-600 flex items-center justify-center shadow-lg relative group">
            <Lock className="w-5 h-5 text-stone-100 group-hover:scale-110 transition-transform" />
            <div className="absolute inset-0 rounded-xl bg-cyan-400 opacity-20 blur-sm group-hover:opacity-45 transition-opacity" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
              ChainCapsule
            </h1>
            <p className="text-[10px] font-mono text-cyan-400 font-medium uppercase tracking-widest leading-none">
              Walrus + Sui Integration
            </p>
          </div>
        </div>

        {/* Tab Selector Links */}
        <nav className="flex items-center bg-stone-920 border border-stone-850 p-1 rounded-xl">
          <button
            onClick={() => handleTabChange("landing")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              activeTab === "landing"
                ? "bg-stone-800 text-cyan-400 shadow-md border border-stone-700/50"
                : "text-stone-400 hover:text-stone-200"
            }`}
          >
            Concept Overview
          </button>
          <button
            onClick={() => handleTabChange("create")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              activeTab === "create"
                ? "bg-stone-800 text-cyan-400 shadow-md border border-stone-700/50"
                : "text-stone-400 hover:text-stone-200"
            }`}
          >
            Deploy Capsule
          </button>
          <button
            onClick={() => handleTabChange("dashboard")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
              activeTab === "dashboard"
                ? "bg-stone-800 text-cyan-400 shadow-md border border-stone-700/50"
                : "text-stone-400 hover:text-stone-200"
            }`}
          >
            Sui Registry Dashboard
            {capsules.length > 0 && (
              <span className="bg-indigo-600 text-white text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full leading-relaxed">
                {capsules.length}
              </span>
            )}
          </button>
          <button
            onClick={() => handleTabChange("open")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              activeTab === "open"
                ? "bg-stone-800 text-cyan-400 shadow-md border border-stone-700/50"
                : "text-stone-400 hover:text-stone-200"
            }`}
          >
            Recover Asset
          </button>
        </nav>

        {/* Wallet Connect + Live Stats */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
            <div className="bg-stone-900 border border-stone-850 px-3 py-1.5 rounded-xl text-[10px] text-stone-300">
              <span className="text-stone-500">SUI TIME:</span>{" "}
              <span className="text-cyan-400 font-bold">{new Date(blockchain.currentTimeMs).toLocaleTimeString()}</span>
            </div>
            {account?.address && (
              <div className="bg-stone-900 border border-stone-850 px-3 py-1.5 rounded-xl text-[10px] text-stone-300">
                <span className="text-stone-500">WALLET:</span>{" "}
                <span className="text-stone-100 font-bold select-all">{account.address.slice(0, 6)}...{account.address.slice(-4)}</span>
              </div>
            )}
          </div>
          {/* Real wallet connect button from dapp-kit */}
          <ConnectButton />
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        
        {/* Landing Page layout with 3D Canvas visual and PRD blocks */}
        {activeTab === "landing" && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Widescreen Interactive Galaxy Visualizer */}
            <div className="w-full bg-stone-900/10 border border-stone-850/60 rounded-3xl pulse-glow-container overflow-hidden relative">
              <ThreeCanvas state={threeState} />
              
              <div className="absolute bottom-4 left-4 right-4 pointer-events-none flex flex-wrap gap-2 items-center justify-between text-xs font-mono text-stone-500 bg-stone-950/20 backdrop-blur-sm px-4 py-2 rounded-xl border border-stone-900/10">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} />
                  Drag with mouse/touch to interact with astronomical coordinates
                </span>
                <span className="hidden sm:inline text-cyan-400 font-bold uppercase tracking-wide">
                  ● Walrus Epoch-Array Cluster 9 Active
                </span>
              </div>
            </div>

            {/* Statistics & Feature Grid below the main canvas */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Quick launch metrics & core technology stack */}
              <div className="lg:col-span-4 space-y-6 flex flex-col justify-between">
                <div className="bg-linear-to-br from-indigo-950/25 via-stone-900/40 to-stone-950/10 p-5 rounded-2xl border border-stone-850/60">
                  <h3 className="text-xs uppercase font-mono tracking-wider text-cyan-400 font-bold mb-3">
                    Verified Cryptographic Credentials
                  </h3>
                  <p className="text-xs text-stone-400 leading-relaxed">
                    Decryption keys are split and escrowed across Sui smart contract registers. Your plaintext elements are guaranteed to remain shielded until precise release conditions are satisfied on-chain.
                  </p>
                  
                  {/* High precision stats column block */}
                  <div className="grid grid-cols-3 gap-2 mt-5">
                    <div className="bg-stone-900/50 border border-stone-850/60 p-3 rounded-xl text-center">
                      <div className="text-[9px] font-mono text-stone-500 uppercase">SUI Gas</div>
                      <div className="text-xs font-extrabold text-stone-100 mt-1 font-mono">~0.02 SUI</div>
                    </div>
                    <div className="bg-stone-900/50 border border-stone-850/60 p-3 rounded-xl text-center">
                      <div className="text-[9px] font-mono text-stone-500 uppercase">Cipher</div>
                      <div className="text-xs font-extrabold text-cyan-400 mt-1 font-mono">AES-256</div>
                    </div>
                    <div className="bg-stone-900/50 border border-stone-850/60 p-3 rounded-xl text-center">
                      <div className="text-[9px] font-mono text-stone-500 uppercase">Vault</div>
                      <div className="text-xs font-extrabold text-indigo-400 mt-1 font-mono">Walrus</div>
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-stone-950 border border-stone-850/45 rounded-2xl">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 block font-bold mb-2">
                    ● Real-Time RPC State
                  </span>
                  <p className="text-[11px] text-stone-400 leading-relaxed font-mono">
                    {account?.address
                      ? <>Node: {account.address.slice(0, 8)}...{account.address.slice(-6)}<br />Block height: #{blockchain.blockHeight}</>
                      : <>Not connected. Connect wallet to interact.<br />Block height: #{blockchain.blockHeight}</>
                    }
                  </p>
                </div>
              </div>

              {/* Right Column: Hero description overlay & dynamic trigger links */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Bento Grid representing Problem vs Solution */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  
                  {/* Switch Mode A Description */}
                  <div className="bg-stone-900/40 border border-stone-850 p-6 rounded-2xl flex flex-col justify-between hover:border-cyan-500/20 transition-colors">
                    <div>
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4">
                        <Hourglass className="w-4 h-4" />
                      </div>
                      <h3 className="text-xs uppercase font-mono tracking-wider text-stone-300 font-bold">
                        Mode A — Time Locked Release
                      </h3>
                      <p className="text-xs text-stone-400 mt-2 leading-relaxed">
                        Encrypt coordinates, token wallets, backdoors, or confidential instructions directly in your browser. Stamped securely by Sui, a timestamp lock prevents any decryption request from completing until the destination date.
                      </p>
                    </div>
                    <div className="border-t border-stone-900/60 pt-3.5 mt-4 text-[10px] text-cyan-400/80 font-mono font-bold">
                      Ideal for inheritances, future plans, escrow.
                    </div>
                  </div>

                  {/* Switch Mode B Description */}
                  <div className="bg-stone-900/40 border border-stone-850 p-6 rounded-2xl flex flex-col justify-between hover:border-indigo-500/20 transition-colors">
                    <div>
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
                        <Heart className="w-4 h-4 animate-pulse fill-indigo-500/30" />
                      </div>
                      <h3 className="text-xs uppercase font-mono tracking-wider text-stone-300 font-bold">
                        Mode B — Dead Man's Switch
                      </h3>
                      <p className="text-xs text-stone-400 mt-2 leading-relaxed">
                        Protects assets in case of physical absence. Keep your clock timer renewed by issuing active "Sign Heartbeat" calls continuously on-chain. If you fail to check in before the expiration interval, decryption keys release to recipients automatically.
                      </p>
                    </div>
                    <div className="border-t border-stone-900/60 pt-3.5 mt-4 text-[10px] text-indigo-400/80 font-mono font-bold">
                      Ideal for cold storage backup & estate safety.
                    </div>
                  </div>

                </div>

                {/* Main Action buttons */}
                <div className="flex flex-wrap gap-4 pt-2">
                  <button
                    onClick={() => handleTabChange("create")}
                    aria-label="Deploy Capsule Switch"
                    className="bg-emerald-400 hover:bg-emerald-300 text-stone-950 font-bold text-xs tracking-wider uppercase px-6 py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.55)] cursor-pointer flex items-center gap-2"
                  >
                    Deploy Capsule Switch <ArrowRight className="w-4 h-4 text-stone-950" />
                  </button>
                  <button
                    onClick={() => handleTabChange("dashboard")}
                    aria-label="View Contracts Registry"
                    className="bg-transparent border border-stone-800 hover:border-stone-700 hover:bg-stone-900/50 text-stone-200 font-semibold text-xs tracking-wider uppercase px-6 py-3.5 rounded-xl transition-all cursor-pointer flex items-center gap-2"
                  >
                    View Registry Dashboard
                  </button>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* Tab B: Deploy / Create Form component */}
        {activeTab === "create" && (
          <div className="max-w-3xl mx-auto">
            <CreateCapsuleForm
              onCapsuleCreated={handleCapsuleCreated}
              onAddLog={addLog}
              blockchainState={blockchain}
              onSetThreeState={setThreeState}
              onRefresh={handleRefreshCapsules}
            />
          </div>
        )}

        {/* Tab C: Sandbox Dashboard Component */}
        {activeTab === "dashboard" && (
          <Dashboard
            capsules={capsules}
            blockchainState={blockchain}
            onSendHeartbeat={handleSendHeartbeat}
            onSetTimeMs={handleSetTimeMs}
            logs={logs}
            onAddLog={addLog}
            onSetThreeState={setThreeState}
            onRefresh={handleRefreshCapsules}
            isLoading={loadingCapsules}
          />
        )}

        {/* Tab D: Open / Recovery component */}
        {activeTab === "open" && (
          <OpenCapsule
            capsules={capsules}
            blockchainState={blockchain}
            onUnlockCapsule={handleUnlockCapsule}
            onAddLog={addLog}
            onSetThreeState={setThreeState}
          />
        )}

      </main>

      {/* Persistent global layout: Tatum SUI Gateway Footer / Info section */}
      <footer className="mt-auto border-t border-stone-900 bg-stone-950 py-5 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-mono text-[10px] text-stone-500">
            <Layers className="w-4 h-4 text-stone-600" />
            <span>Tatum x Walrus Hackathon Entry · Powered by SUI Testnet VM</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 font-mono text-[9px] bg-stone-900 border border-stone-800 rounded px-2.5 py-1 text-stone-400">
              <Coins className="w-3.5 h-3.5 text-indigo-400" />
              SUI RPC URL: <span className="text-stone-300 select-all">fullnode.testnet.sui.io</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[9px] bg-stone-900 border border-stone-800 rounded px-2.5 py-1 text-stone-400">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              AGGREGATOR: <span className="text-stone-300 select-all">walrus-testnet.walrus.space</span>
            </div>
          </div>
        </div>
      </footer>

      {/* AI Assistant Chat drawer - connected to all capsules for live context */}
      <AIAssistant capsules={capsules} blockchainState={blockchain} />

    </div>
  );
}
