import React, { useEffect, useState } from "react";
import { Battery, Heart, ShieldAlert, Clock, RefreshCw, AlertTriangle, Key, ArrowRight, Radio, Search } from "lucide-react";
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Capsule, LogEvent, BlockchainState } from "../types";
import { buildHeartbeatTx } from "../blockchain";

interface DashboardProps {
  capsules: Capsule[];
  blockchainState: BlockchainState;
  onSendHeartbeat: (capsuleId: string) => void;
  onSetTimeMs: (newTime: number) => void;
  logs: LogEvent[];
  onAddLog: (log: LogEvent) => void;
  onSetThreeState: (state: "neutral" | "active" | "warning" | "uploading" | "unlocked") => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export default function Dashboard({
  capsules,
  blockchainState,
  onSendHeartbeat,
  onSetTimeMs,
  logs,
  onAddLog,
  onSetThreeState,
  onRefresh,
  isLoading,
}: DashboardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [, setTick] = useState(0);
  const [pendingHeartbeat, setPendingHeartbeat] = useState<string | null>(null);

  // Real dapp-kit transaction signer
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  // Dynamic ticking representing real-time checking of switches
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleHeartbeatClick = async (id: string, name: string) => {
    if (pendingHeartbeat === id) return; // prevent double-click
    setPendingHeartbeat(id);
    onSetThreeState("active");

    onAddLog({
      id: `${Date.now()}-heartbeat-start`,
      timestamp: Date.now(),
      type: "info",
      message: `❤️ Preparing heartbeat transaction for: "${name}"...`,
    });

    try {
      const tx = buildHeartbeatTx(id);
      const txResult = await signAndExecute({ transaction: tx });

      const digest = txResult && typeof txResult === 'object' && 'digest' in txResult
        ? String((txResult as any).digest)
        : undefined;

      onSendHeartbeat(id);

      onAddLog({
        id: `${Date.now()}-heartbeat-click`,
        timestamp: Date.now(),
        type: "transaction",
        message: `❤️ Broadcasted Heartbeat proof-of-life for: "${name}". Sui Clock updated.`,
        txHash: digest,
      });
    } catch (err: any) {
      onAddLog({
        id: `${Date.now()}-heartbeat-err`,
        timestamp: Date.now(),
        type: "error",
        message: `🚨 Heartbeat transaction failed: ${err.message || err}`,
      });
    } finally {
      setPendingHeartbeat(null);
      setTimeout(() => onSetThreeState("neutral"), 1500);
    }
  };

  // Filter list
  const filteredCapsules = capsules.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Search and Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-800 pb-5">
        <div>
          <h2 className="text-xl font-semibold text-stone-100 flex items-center gap-2">
            <Radio className="w-5 h-5 text-indigo-400 animate-pulse" />
            Core Capsule Registry
          </h2>
          <p className="text-xs text-stone-400">
            SUI Testnet Ledger. Currently managing {capsules.length} shared contract object{capsules.length !== 1 ? "s" : ""}.
          </p>
        </div>

        {/* Search + Refresh */}
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 px-3 py-2 rounded-xl text-xs font-mono transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-cyan-400" : "text-stone-400"}`} />
              {isLoading ? "Loading..." : "Refresh"}
            </button>
          )}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-stone-500" />
            <input
              type="text"
              placeholder="Search capsule ID or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-stone-950 border border-stone-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-stone-100 placeholder-stone-500 focus:border-cyan-500 focus:outline-none min-w-[260px]"
            />
          </div>
        </div>
      </div>

      {filteredCapsules.length === 0 ? (
        <div className="bg-stone-950/40 border border-stone-800 rounded-2xl p-10 text-center">
          <Clock className="w-12 h-12 text-stone-600 mx-auto mb-3 animate-pulse" />
          <h3 className="text-sm font-semibold text-stone-300">
            {isLoading ? "Loading Capsules..." : "No Capsules Found"}
          </h3>
          <p className="text-xs text-stone-500 mt-1 max-w-xs mx-auto">
            {isLoading
              ? "Querying Sui chain for your capsules..."
              : blockchainState.walletAddress
              ? "You don't have any active cryptographic contracts. Proceed to \"Deploy Capsule\" to create your first secure trigger."
              : "Connect your Sui wallet to see your capsules."
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredCapsules.map((c) => {
            const isTimeMode = c.unlockAfterMs > 0;
            let timeRemainingMs = 0;
            let percentRemaining = 100;
            let isTricked = false;

            if (isTimeMode) {
              timeRemainingMs = c.unlockAfterMs - blockchainState.currentTimeMs;
              isTricked = timeRemainingMs <= 0;
              const totalDuration = c.unlockAfterMs - c.createdAt;
              percentRemaining = totalDuration > 0 ? Math.max(0, (timeRemainingMs / totalDuration) * 100) : 0;
            } else {
              // Dead man's switch
              const MS_IN_DAY = 86400000;
              const totalAllowedMs = c.inactivityDays * MS_IN_DAY;
              const elapsedMs = blockchainState.currentTimeMs - c.lastHeartbeat;
              timeRemainingMs = totalAllowedMs - elapsedMs;
              isTricked = elapsedMs >= totalAllowedMs;
              percentRemaining = Math.max(0, (timeRemainingMs / totalAllowedMs) * 100);
            }

            // Status style
            const isAlarmWarning = !isTricked && !isTimeMode && percentRemaining < 25;
            const isThisHeartbeatPending = pendingHeartbeat === c.id;

            return (
              <div
                key={c.id}
                className={`border rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 ${
                  isTricked
                    ? "bg-gradient-to-br from-emerald-950/20 to-stone-950 border-emerald-500/30 ring-1 ring-emerald-500/20"
                    : isAlarmWarning
                    ? "bg-gradient-to-br from-amber-950/20 to-stone-950 border-amber-500/50 shadow-lg"
                    : "bg-stone-950/50 border-stone-800 hover:border-stone-700 hover:bg-stone-950/80"
                }`}
              >
                {/* Upper Banner Status */}
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <span
                      className={`text-[9px] font-mono font-semibold uppercase px-2 py-0.5 rounded border ${
                        isTimeMode
                          ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                          : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                      }`}
                    >
                      {isTimeMode ? "TIME CAPSULE" : "DEAD MAN SWITCH"}
                    </span>
                    <span className="text-[10px] text-stone-500 font-mono flex items-center gap-1.5 bg-stone-900 border border-stone-800 px-2 py-0.5 rounded">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isTricked
                            ? "bg-emerald-400"
                            : isAlarmWarning
                            ? "bg-amber-400 animate-ping"
                            : "bg-cyan-400"
                        }`}
                      />
                      {isTricked ? "Unlocked & Ready" : isAlarmWarning ? "Warning! Inactive" : "Secure Protection"}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-stone-100 truncate">{c.name}</h3>
                    <p className="text-[11px] text-stone-400 mt-1 line-clamp-2 leading-relaxed">
                      {c.description || "Holds cryptographic secrets on Walrus storage."}
                    </p>
                  </div>

                  {/* Core Status Indicator Box */}
                  <div className="my-4 p-3 bg-stone-950 border border-stone-900 rounded-xl space-y-2">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-stone-500">OBJECT COMPONENT:</span>
                      <span className="text-stone-400 font-bold truncate max-w-[150px]">{c.id}</span>
                    </div>

                    {isTimeMode ? (
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-stone-500">UNLOCK TIMESTAMP:</span>
                        <span className="text-stone-300 font-semibold">
                          {new Date(c.unlockAfterMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}{" "}
                          – Seconds Remaining:{" "}
                          <span className="text-cyan-400 font-bold">
                            {isTricked ? "0s" : `${Math.ceil(timeRemainingMs / 1000)}s`}
                          </span>
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-stone-500 font-semibold flex items-center gap-1.5">
                          <Heart className="w-3 h-3 text-red-500 animate-pulse fill-red-500" /> LAST HEARTBEAT:
                        </span>
                        <span className="text-stone-300">
                          {new Date(c.lastHeartbeat).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    )}

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="h-1.5 w-full bg-stone-900 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-1000 ${
                            isTricked
                              ? "bg-emerald-500"
                              : isAlarmWarning
                              ? "bg-gradient-to-r from-amber-500 to-rose-500 animate-pulse"
                              : isTimeMode
                              ? "bg-cyan-500"
                              : "bg-indigo-500"
                          }`}
                          style={{ width: `${percentRemaining}%` }}
                        />
                      </div>
                      {!isTricked && (
                        <div className="flex justify-between text-[8px] text-stone-500 font-mono uppercase">
                          <span>{isTimeMode ? "Locked" : "Active Check-in"}</span>
                          <span>
                            {isTimeMode
                              ? `${Math.max(0, Math.ceil(timeRemainingMs / 1000))}s until release`
                              : `${(timeRemainingMs / 86400000).toFixed(2)} inactive days remaining`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dashboard Action Row */}
                <div className="pt-4 border-t border-stone-900 flex items-center justify-between gap-3">
                  {!isTimeMode && !isTricked ? (
                    <button
                      onClick={() => handleHeartbeatClick(c.id, c.name)}
                      disabled={isThisHeartbeatPending}
                      className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-inner transition-colors disabled:opacity-60"
                    >
                      {isThisHeartbeatPending ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Heart className="w-3.5 h-3.5 fill-current animate-pulse text-rose-200" />
                      )}
                      {isThisHeartbeatPending ? "Signing..." : "Sign Heartbeat"}
                    </button>
                  ) : (
                    <div className="text-[10px] font-mono text-stone-500 flex items-center gap-1">
                      <span>Owner:</span>
                      <span className="text-stone-400 font-semibold">{c.owner.slice(0, 10)}...</span>
                    </div>
                  )}

                  {isTricked ? (
                    <button
                      onClick={() => window.location.hash = "open"}
                      className="flex items-center gap-1 text-[10px] font-bold text-center uppercase bg-emerald-500 bg-opacity-20 hover:bg-opacity-30 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-lg transition-all"
                    >
                      <Key className="w-3 h-3 text-emerald-400" /> Ready to Unlock <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <div className="text-[10px] font-mono text-stone-400 flex items-center gap-1 bg-stone-900 px-2.5 py-1 rounded">
                      <span className="text-stone-500">Beneficiary:</span>
                      <span className="font-semibold text-indigo-400">{c.beneficiary.slice(0, 10)}...</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SUI Ledger Blockchain sandbox Control Node & System Event Viewer */}
      <div className="bg-stone-950 border border-stone-800 p-5 rounded-2xl mt-6">
        <h3 className="text-xs font-mono font-bold tracking-widest text-indigo-400 uppercase mb-4 flex items-center gap-2">
          <Battery className="w-4 h-4 text-indigo-400 animate-pulse" /> SUI Testnet Control Panel
        </h3>

        {/* Simulated Wallet metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-stone-900 bg-opacity-30 p-3 rounded-xl border border-stone-900 mb-4 text-[10px] font-mono">
          <div>
            <div className="text-stone-500">LEDGER TYPE:</div>
            <div className="text-indigo-400 font-bold mt-0.5">SUI Testnet Live</div>
          </div>
          <div>
            <div className="text-stone-500">BLOCK HEIGHT:</div>
            <div className="text-stone-200 mt-0.5"># {blockchainState.blockHeight} blocks</div>
          </div>
          <div>
            <div className="text-stone-500">OWNER WALLET:</div>
            <div className="text-stone-300 mt-0.5 select-all hover:text-stone-100">
              {blockchainState.walletAddress
                ? `${blockchainState.walletAddress.slice(0, 16)}...`
                : "Not connected"}
            </div>
          </div>
          <div>
            <div className="text-stone-500">SUI CLOCK:</div>
            <div className="text-emerald-400 font-bold mt-0.5">{new Date(blockchainState.currentTimeMs).toLocaleTimeString()}</div>
          </div>
        </div>

        {/* Transaction log printout */}
        <div className="border border-stone-900 bg-stone-950 font-mono text-[9px] rounded-xl p-3.5 h-[150px] overflow-y-auto space-y-2 scrollbar-thin">
          <div className="text-stone-500 pb-1.5 border-b border-stone-900 uppercase tracking-widest text-[8px] flex justify-between">
            <span>SUI testnet logger streams</span>
            <span className="text-[7px] text-emerald-400 animate-pulse font-bold">● Listening SUI Gateway RPC</span>
          </div>
          {logs.slice().reverse().map((l) => (
            <div key={l.id} className="text-stone-400 select-all flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-stone-600 font-bold">[{new Date(l.timestamp).toLocaleTimeString([], { hour12: false })}]</span>
                <span className={`px-1 rounded text-[8px] font-extrabold capitalize ${
                  l.type === "success"
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-805"
                    : l.type === "warning"
                    ? "bg-amber-950 text-amber-400 border border-amber-805"
                    : l.type === "transaction"
                    ? "bg-indigo-950/45 text-indigo-400 border border-indigo-900"
                    : l.type === "error"
                    ? "bg-red-950 text-red-400 border border-red-900"
                    : "bg-stone-90 border border-stone-800 text-stone-300"
                }`}>
                  {l.type}
                </span>
                <span className="text-stone-300 leading-snug">{l.message}</span>
              </div>
              {l.txHash && (
                <div className="text-stone-600 pl-11">
                  TX: <a
                    href={`https://suiscan.xyz/testnet/tx/${l.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-500/80 hover:text-indigo-400 transition-colors cursor-pointer"
                  >{l.txHash.slice(0, 20)}...</a>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
