"use client";

import Link from "next/link";

const features = [
  {
    title: "Message Routing",
    description:
      "Send FIX messages with automatic sequence numbering, SOH-delimited wire formatting, and session-aware routing to counterparties.",
    icon: "⚡",
  },
  {
    title: "Protocol Validation",
    description:
      "Validate FIX 4.2, 4.4, and 5.0 messages against required field rules. Surface missing tags and semantic errors before transmission.",
    icon: "✓",
  },
  {
    title: "Session Management",
    description:
      "Monitor all active FIX sessions including state, sequence numbers, counterparty IDs, and connection timestamps in real time.",
    icon: "🔗",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#080c14] text-white font-sans">
      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <span className="text-lg font-bold tracking-tight text-cyan-400">
          ALICE FIX Gateway
        </span>
        <Link
          href="/dashboard/console"
          className="text-sm px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 transition-colors"
        >
          Open Console
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-28 pb-16 text-center">
        <div className="inline-block mb-4 px-3 py-1 rounded-full border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 text-xs tracking-widest uppercase">
          Powered by ALICE-FIX
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
          ALICE FIX Gateway
        </h1>
        <p className="text-xl md:text-2xl text-cyan-300 font-medium mb-4">
          Don&apos;t drop orders.
          <br />
          <span className="text-white">Route the law of finance.</span>
        </p>
        <p className="text-gray-400 max-w-xl mx-auto mb-10">
          FIX protocol gateway powered by ALICE-FIX. Send, parse, and validate
          FIX 4.2 / 4.4 / 5.0 messages with real-time session management
          — built for electronic trading infrastructure.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/dashboard/console"
            className="px-8 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 font-semibold transition-colors"
          >
            Launch Console
          </Link>
          <a
            href="#features"
            className="px-8 py-3 rounded-lg border border-white/20 hover:border-white/40 font-semibold transition-colors"
          >
            Learn More
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-center text-3xl font-bold mb-12 text-white">
          What ALICE FIX Gateway Does
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-white/10 bg-white/5 p-6 hover:border-cyan-500/50 transition-colors"
            >
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="text-lg font-semibold mb-2 text-white">
                {f.title}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Message types strip */}
      <section className="border-t border-white/10 py-12">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-sm text-gray-500 uppercase tracking-widest mb-4">
            Supported Message Types
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              "NewOrderSingle (D)",
              "ExecutionReport (8)",
              "OrderCancelRequest (F)",
              "MarketDataRequest (V)",
              "Heartbeat (0)",
              "Logon (A)",
              "Logout (5)",
            ].map((t) => (
              <span
                key={t}
                className="px-3 py-1 rounded-full text-xs border border-white/20 text-gray-300 font-mono"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Protocol versions */}
      <section className="border-t border-white/10 py-12">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-sm text-gray-500 uppercase tracking-widest mb-4">
            Supported FIX Versions
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {["FIX 4.2", "FIX 4.4", "FIX 5.0"].map((v) => (
              <span
                key={v}
                className="px-4 py-2 rounded-lg text-sm border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 font-mono font-semibold"
              >
                {v}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4">
          Start routing FIX messages today.
        </h2>
        <p className="text-gray-400 mb-8">
          Zero dropped orders. ALICE handles the protocol.
        </p>
        <Link
          href="/dashboard/console"
          className="inline-block px-10 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 font-semibold transition-colors"
        >
          Open FIX Console
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-8 text-center text-xs text-gray-600">
        ALICE FIX Gateway — AGPL-3.0 — For electronic trading infrastructure use only.
      </footer>
    </main>
  );
}
