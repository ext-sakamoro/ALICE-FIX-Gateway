"use client";

import { useState } from "react";
import { useFixStore } from "@/lib/hooks/use-store";
import { fixClient } from "@/lib/api/client";

const MSG_TYPES = [
  { value: "NewOrderSingle", label: "NewOrderSingle (D)" },
  { value: "ExecutionReport", label: "ExecutionReport (8)" },
  { value: "OrderCancelRequest", label: "OrderCancelRequest (F)" },
  { value: "MarketDataRequest", label: "MarketDataRequest (V)" },
  { value: "Heartbeat", label: "Heartbeat (0)" },
  { value: "Logon", label: "Logon (A)" },
  { value: "Logout", label: "Logout (5)" },
];

const FIX_VERSIONS = [
  { value: "FIX.4.2", label: "FIX 4.2" },
  { value: "FIX.4.4", label: "FIX 4.4" },
  { value: "FIX.5.0", label: "FIX 5.0" },
];

type ActiveTab = "send" | "parse" | "validate" | "sessions";

function StatusBadge({ state }: { state: string }) {
  const color =
    state === "ACTIVE"
      ? "bg-green-500/20 text-green-400 border-green-500/40"
      : "bg-yellow-500/20 text-yellow-400 border-yellow-500/40";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${color}`}>
      {state}
    </span>
  );
}

export default function FixConsolePage() {
  const {
    msgType,
    setMsgType,
    rawMessage,
    setRawMessage,
    version,
    setVersion,
    result,
    setResult,
    loading,
    setLoading,
  } = useFixStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>("send");
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setLoading(true);
    setError(null);
    try {
      const res = await fixClient.send({
        msg_type: msgType,
        fields: { BeginString: version, SenderCompID: "ALICE", TargetCompID: "BROKER" },
      });
      setResult({ type: "send", data: res });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleParse() {
    if (!rawMessage.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fixClient.parse({ raw_message: rawMessage });
      setResult({ type: "parse", data: res });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parse failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleValidate() {
    if (!rawMessage.trim()) return;
    setLoading(true);
    setError(null);
    try {
      // Build a minimal field map from the raw message for validation
      const fields: Record<string, string> = {};
      const delimiter = rawMessage.includes("\x01") ? "\x01" : "|";
      rawMessage.split(delimiter).forEach((seg) => {
        const [k, v] = seg.split("=");
        if (k && v) fields[k.trim()] = v.trim();
      });
      const res = await fixClient.validate({ message: fields, version });
      setResult({ type: "validate", data: res });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadSessions() {
    setLoading(true);
    setError(null);
    try {
      const res = await fixClient.sessions();
      setResult({ type: "sessions", data: res });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sessions.");
    } finally {
      setLoading(false);
    }
  }

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: "send", label: "Send" },
    { id: "parse", label: "Parse" },
    { id: "validate", label: "Validate" },
    { id: "sessions", label: "Sessions" },
  ];

  return (
    <div className="min-h-screen bg-[#080c14] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-cyan-400">FIX Console</h1>
          <p className="text-xs text-gray-500 mt-0.5">ALICE FIX Gateway — Protocol Operations</p>
        </div>
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                activeTab === t.id
                  ? "bg-cyan-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-5">
          {/* FIX Version selector — shown on Send and Validate */}
          {(activeTab === "send" || activeTab === "validate") && (
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-widest">
                FIX Version
              </label>
              <select
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
              >
                {FIX_VERSIONS.map((v) => (
                  <option key={v.value} value={v.value} className="bg-[#0d1117]">
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Send tab */}
          {activeTab === "send" && (
            <>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-widest">
                  Message Type
                </label>
                <select
                  value={msgType}
                  onChange={(e) => setMsgType(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
                >
                  {MSG_TYPES.map((m) => (
                    <option key={m.value} value={m.value} className="bg-[#0d1117]">
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-gray-400 leading-relaxed">
                  Sends a FIX message with auto-assigned sequence number.
                  SenderCompID defaults to <span className="font-mono text-cyan-300">ALICE</span>,
                  TargetCompID to <span className="font-mono text-cyan-300">BROKER</span>.
                </p>
              </div>

              <button
                onClick={handleSend}
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold transition-colors"
              >
                {loading ? "Sending..." : "Send Message"}
              </button>
            </>
          )}

          {/* Parse tab */}
          {activeTab === "parse" && (
            <>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-widest">
                  Raw FIX Message
                </label>
                <textarea
                  value={rawMessage}
                  onChange={(e) => setRawMessage(e.target.value)}
                  placeholder={`8=FIX.4.4|9=120|35=D|49=ALICE|56=BROKER|34=1|52=20260223-00:00:00.000|11=ORD001|55=AAPL|54=1|38=100|40=2|44=150.00|10=000|`}
                  rows={12}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 resize-none font-mono leading-relaxed"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Use <span className="font-mono">|</span> or SOH (<span className="font-mono">\x01</span>) as field delimiter.
                </p>
              </div>

              <button
                onClick={handleParse}
                disabled={loading || !rawMessage.trim()}
                className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold transition-colors"
              >
                {loading ? "Parsing..." : "Parse Message"}
              </button>
            </>
          )}

          {/* Validate tab */}
          {activeTab === "validate" && (
            <>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-widest">
                  Raw FIX Message to Validate
                </label>
                <textarea
                  value={rawMessage}
                  onChange={(e) => setRawMessage(e.target.value)}
                  placeholder={`8=FIX.4.4|9=120|35=D|49=ALICE|56=BROKER|34=1|52=20260223-00:00:00.000|11=ORD001|55=AAPL|54=1|38=100|40=2|44=150.00|10=000|`}
                  rows={12}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 resize-none font-mono leading-relaxed"
                />
              </div>

              <button
                onClick={handleValidate}
                disabled={loading || !rawMessage.trim()}
                className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold transition-colors"
              >
                {loading ? "Validating..." : "Validate Message"}
              </button>
            </>
          )}

          {/* Sessions tab */}
          {activeTab === "sessions" && (
            <>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-gray-400 leading-relaxed">
                  Retrieve all active FIX sessions including state, sequence numbers,
                  counterparty identifiers, and connection timestamps.
                </p>
              </div>

              <button
                onClick={handleLoadSessions}
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold transition-colors"
              >
                {loading ? "Loading..." : "Load Sessions"}
              </button>
            </>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Result panel */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-widest">
            Result
          </h2>

          {!result && !loading && (
            <p className="text-sm text-gray-600 italic">
              Execute an operation to see results here.
            </p>
          )}

          {loading && (
            <div className="flex items-center gap-3 text-cyan-400 text-sm">
              <span className="animate-spin">⟳</span>
              Processing...
            </div>
          )}

          {result && !loading && (
            <div className="space-y-4 text-sm">
              {/* Send result */}
              {result.type === "send" && (
                <>
                  <div className="flex items-center justify-between text-gray-400">
                    <span>Message Type</span>
                    <span className="text-white font-mono">{result.data.msg_type}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-400">
                    <span>Sequence Number</span>
                    <span className="text-cyan-400 font-mono font-bold">
                      {result.data.sequence_number}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-gray-400">
                    <span>Session</span>
                    <span className="text-white font-mono text-xs">{result.data.session_id}</span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">
                      Wire Message
                    </p>
                    <pre className="text-xs text-green-400 bg-black/40 rounded-lg p-3 whitespace-pre-wrap break-all font-mono leading-relaxed max-h-56 overflow-y-auto">
                      {result.data.fix_message
                        .replace(/\x01/g, "|\n")
                        .trim()}
                    </pre>
                  </div>
                </>
              )}

              {/* Parse result */}
              {result.type === "parse" && (
                <>
                  <div className="flex items-center justify-between text-gray-400">
                    <span>Message Type</span>
                    <span className="text-white font-mono">{result.data.msg_type}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-400">
                    <span>Fields Parsed</span>
                    <span className="text-cyan-400">{result.data.field_count}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-400">
                    <span>Raw Length</span>
                    <span className="text-white">{result.data.raw_length} bytes</span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">
                      Fields
                    </p>
                    <div className="space-y-1 max-h-72 overflow-y-auto">
                      {result.data.fields?.map((f: {tag: number; name: string; value: string}) => (
                        <div
                          key={f.tag}
                          className="flex items-center gap-2 px-2 py-1 rounded bg-black/20"
                        >
                          <span className="text-cyan-400 font-mono text-xs w-8 shrink-0">
                            {f.tag}
                          </span>
                          <span className="text-gray-400 text-xs w-36 shrink-0 truncate">
                            {f.name}
                          </span>
                          <span className="text-white text-xs font-mono truncate">
                            {f.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Validate result */}
              {result.type === "validate" && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Result</span>
                    <span
                      className={`font-bold ${
                        result.data.valid ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {result.data.valid ? "VALID" : "INVALID"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-gray-400">
                    <span>Version</span>
                    <span className="text-white font-mono">{result.data.version}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-400">
                    <span>Message Type</span>
                    <span className="text-white font-mono">{result.data.msg_type}</span>
                  </div>

                  {result.data.errors?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">
                        Errors ({result.data.errors.length})
                      </p>
                      <div className="space-y-2">
                        {result.data.errors.map((e: {tag: number; field: string; message: string}, i: number) => (
                          <div
                            key={i}
                            className="rounded-lg bg-red-500/10 border border-red-500/20 p-3"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono text-red-400">
                                Tag {e.tag}
                              </span>
                              <span className="text-xs text-gray-400">{e.field}</span>
                            </div>
                            <p className="text-xs text-gray-300">{e.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.data.valid && (
                    <p className="text-xs text-green-400">
                      All required fields present. Message is valid for {result.data.version}.
                    </p>
                  )}
                </>
              )}

              {/* Sessions result */}
              {result.type === "sessions" && (
                <>
                  <div className="flex items-center justify-between text-gray-400 mb-2">
                    <span>Active Sessions</span>
                    <span className="text-cyan-400">{result.data.count}</span>
                  </div>
                  <div className="space-y-3">
                    {result.data.sessions?.map((s: {session_id: string; fix_version: string; state: string; sender_comp_id: string; target_comp_id: string; msg_seq_num: number}) => (
                      <div
                        key={s.session_id}
                        className="rounded-lg border border-white/10 bg-white/5 p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-mono text-white">{s.session_id}</span>
                          <StatusBadge state={s.state} />
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <span className="text-gray-500">Version</span>
                          <span className="text-gray-300 font-mono">{s.fix_version}</span>
                          <span className="text-gray-500">Sender</span>
                          <span className="text-gray-300 font-mono">{s.sender_comp_id}</span>
                          <span className="text-gray-500">Target</span>
                          <span className="text-gray-300 font-mono">{s.target_comp_id}</span>
                          <span className="text-gray-500">SeqNum</span>
                          <span className="text-cyan-400 font-mono">{s.msg_seq_num}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
