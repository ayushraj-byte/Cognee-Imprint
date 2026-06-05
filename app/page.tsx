import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="border-b border-white/5 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧠</span>
          <span className="font-semibold text-sm">Claude Memory Enhancer</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Dashboard
          </Link>
          <a
            href="https://chromewebstore.google.com"
            className="text-sm px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            Install Extension
          </a>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-8 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-xs text-blue-400 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
          Built for H0: Hack the Zero Stack — AWS + Vercel
        </div>

        <h1 className="text-5xl font-bold leading-tight mb-6">
          Claude finally
          <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            {" "}remembers you
          </span>
        </h1>

        <p className="text-lg text-slate-400 mb-4 max-w-2xl mx-auto leading-relaxed">
          The only Claude tool that gives Claude persistent memory across every
          session — and{" "}
          <strong className="text-white">catches when you contradict yourself</strong>.
        </p>

        <p className="text-sm text-slate-600 mb-10">
          Free tier · BYOK for unlimited · Powered by AWS DynamoDB + Amazon Bedrock
        </p>

        <div className="flex items-center justify-center gap-4">
          <a
            href="#install"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium transition-colors"
          >
            Install Chrome Extension →
          </a>
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium transition-colors"
          >
            View Dashboard
          </Link>
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-5xl mx-auto px-8 py-16">
        <h2 className="text-center text-sm text-slate-500 uppercase tracking-wider mb-12">
          How it works
        </h2>
        <div className="grid grid-cols-3 gap-6">
          {[
            {
              step: "01",
              title: "Install the extension",
              desc: "Add Claude Memory Enhancer to Chrome. It works directly inside claude.ai — no new chat interface.",
              icon: "🧩",
            },
            {
              step: "02",
              title: "Chat normally",
              desc: "Every conversation, Claude silently learns facts about you. Memories are stored in AWS DynamoDB with auto-decay.",
              icon: "💬",
            },
            {
              step: "03",
              title: "Claude remembers",
              desc: "Next session, Claude knows your name, job, preferences — everything. And if you contradict yourself, it catches it.",
              icon: "⚡",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="bg-white/[0.03] border border-white/5 rounded-2xl p-6"
            >
              <div className="text-2xl mb-4">{item.icon}</div>
              <div className="text-xs text-slate-600 mb-1">{item.step}</div>
              <h3 className="font-semibold text-white mb-2">{item.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-8 py-16 border-t border-white/5">
        <h2 className="text-center text-sm text-slate-500 uppercase tracking-wider mb-12">
          Features
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            {
              icon: "🔁",
              title: "Persistent Memory",
              desc: "Claude remembers you across every session. No context window limits.",
            },
            {
              icon: "⚠️",
              title: "Contradiction Detection",
              desc: "Real-time alerts when you say something that conflicts with a past memory. Powered by DynamoDB Streams.",
            },
            {
              icon: "🗂️",
              title: "Topic Namespaces",
              desc: "Memories auto-classified into work, personal, preferences, health, projects, relationships.",
            },
            {
              icon: "📊",
              title: "Memory Dashboard",
              desc: "View, edit, pin, and delete all your memories from a beautiful Vercel-hosted dashboard.",
            },
            {
              icon: "⏳",
              title: "Memory Decay (TTL)",
              desc: "Old, unused memories auto-expire via DynamoDB TTL. Pin important ones to keep forever.",
            },
            {
              icon: "📥",
              title: "Memory Import",
              desc: "Paste any text and Claude extracts the key facts — import past conversations instantly.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-white/[0.02] border border-white/5 rounded-xl p-5 flex gap-4"
            >
              <span className="text-2xl flex-shrink-0">{f.icon}</span>
              <div>
                <h3 className="font-medium text-white text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div className="max-w-3xl mx-auto px-8 py-16 border-t border-white/5">
        <h2 className="text-center text-sm text-slate-500 uppercase tracking-wider mb-12">
          Pricing
        </h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
            <div className="text-xs text-slate-500 mb-1">Free Tier</div>
            <div className="text-3xl font-bold text-white mb-1">$0</div>
            <div className="text-xs text-slate-600 mb-6">20 messages/day</div>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>✓ Persistent memory</li>
              <li>✓ Contradiction detection</li>
              <li>✓ Memory dashboard</li>
              <li>✓ Topic namespaces</li>
            </ul>
          </div>
          <div className="bg-gradient-to-br from-blue-500/10 to-violet-500/10 border border-blue-500/20 rounded-2xl p-6">
            <div className="text-xs text-blue-400 mb-1">BYOK — Power Tier</div>
            <div className="text-3xl font-bold text-white mb-1">$0</div>
            <div className="text-xs text-slate-500 mb-6">
              Bring your own Claude API key
            </div>
            <ul className="space-y-2 text-sm text-slate-300">
              <li>✓ Everything in Free</li>
              <li>✓ Unlimited messages</li>
              <li>✓ No rate limits</li>
              <li>✓ Key stored encrypted (AES-256)</li>
            </ul>
          </div>
        </div>
        <p className="text-center text-xs text-slate-600 mt-6">
          We store memory, not compute. Running cost: $0 on AWS Free Tier + Vercel.
        </p>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-700">
        Claude Memory Enhancer · Built for H0: Hack the Zero Stack 2026 · AWS DynamoDB + Vercel
      </footer>
    </main>
  );
}
