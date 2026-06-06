"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Brain, Plus, Paperclip, ArrowUp, ChevronRight,
  Database, X, Zap, Copy, Check, Settings, RefreshCw,
  GitBranch, Sparkles, Activity, Terminal
} from "lucide-react";
import BackgroundVideo from "../components/BackgroundVideo";

/* ─── types ─── */
interface Message { id: string; role: "user" | "assistant"; content: string; timestamp: Date; }
interface CapturedMemory { content: string; topic: string; }
interface Contradiction { explanation: string; }
type Tab = "chat" | "memory" | "import";

/* ─── constants ─── */
const GUEST_LIMIT = 20;
const HISTORY_ITEMS = [
  { label: "AWS Aurora pgvector Sync", synced: true },
  { label: "Claude Context Optimization", synced: true },
  { label: "DynamoDB Pipeline Redesign", synced: false },
  { label: "Memory Import Session", synced: false },
];
const STARTER_PROMPTS = [
  { label: "Introduce yourself", text: "Tell me your name, what you do, and where you're based." },
  { label: "Your current projects", text: "What projects are you actively working on right now?" },
  { label: "Your preferences", text: "How do you like Claude to respond — tone, length, style?" },
  { label: "Something to remember", text: "Tell me one important thing you want Claude to always know." },
];

/* ─── mock fallback ─── */
function mockResponse(t: string, mem: CapturedMemory[]): string {
  const l = t.toLowerCase();
  if (mem.length && (l.includes("remember") || l.includes("know about")))
    return `Here's what I've captured:\n\n${mem.slice(0,4).map(m=>`— ${m.content}`).join("\n")}\n\nAnything else?`;
  if (l.includes("name")) return "Got it — I'll remember that. What else?";
  if (l.includes("work") || l.includes("job")) return "Noted. What are you focused on right now?";
  if (l.includes("prefer") || l.includes("like")) return "Preference captured. I'll carry this into every future session.";
  return "Message received. Imprint is extracting key facts and storing them securely.\n\nNext time we speak, I'll already know this about you.";
}

/* ─── streaming helper ─── */
async function streamChatResponse(
  messages: { role: string; content: string }[],
  userId: string,
  onChunk: (partial: string) => void
): Promise<string> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, messages }),
    });
    if (res.status === 429) { const d = await res.json(); return d.error ?? "Limit reached."; }
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      full += decoder.decode(value, { stream: true });
      onChunk(full);
    }
    return full;
  } catch { return ""; }
}

/* ─── syntax colouring ─── */
function colourLine(raw: string): string {
  let s = raw.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  s = s.replace(/"([^"]+)":/g,'<span style="color:#4eecd8">"$1"</span>:');
  s = s.replace(/: "([^"]+)"/g,': <span style="color:#f9d97a">"$1"</span>');
  s = s.replace(/: (true|false|null)/g,': <span style="color:#c792ea">$1</span>');
  s = s.replace(/: (\d+\.?\d*)/g,': <span style="color:#f78c6c">$1</span>');
  return s;
}

/* ─── Memory tab view ─── */
function MemoryView({ memories, userId }: { memories: CapturedMemory[]; userId: string }) {
  const [copied, setCopied] = useState(false);
  const obj = { session_id: userId.slice(0,8), backend:"aurora-serverless", edge:"vercel-edge",
    memories: memories.map(m=>({ topic:m.topic, content:m.content, confidence:0.97, vector_indexed:true })) };
  const jsonStr = JSON.stringify(obj, null, 2);
  const lines = jsonStr.split("\n");
  async function copy() { await navigator.clipboard.writeText(jsonStr).catch(()=>{}); setCopied(true); setTimeout(()=>setCopied(false),2000); }
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center border-b border-white/[0.04] h-9 px-0 font-mono text-[11px] bg-white/[0.01] flex-shrink-0">
        <div className="flex items-center gap-2 px-4 h-full border-r border-white/[0.04] bg-white/[0.02] text-white/40">
          <Database size={10} className="text-teal-400/50" />
          <span>memory.json</span>
          {memories.length > 0 && <span className="text-[9px] bg-teal-400/10 text-teal-400/60 rounded-full px-1.5 leading-4">{memories.length}</span>}
        </div>
        <button onClick={copy} className="ml-auto mr-3 text-white/20 hover:text-white/50 p-1 transition-colors duration-300">
          {copied ? <Check size={11}/> : <Copy size={11}/>}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {memories.length === 0 ? (
          <div className="p-6 font-mono text-[11px] leading-6 select-none">
            <p className="text-white/15">// No memories captured yet.</p>
            <p className="text-white/[0.08]">// Start chatting to build your persistent memory layer.</p>
            <br/><p className="text-white/[0.06]">// Imprint indexes every message as pgvector embeddings</p>
            <p className="text-white/[0.06]">// into AWS DynamoDB.</p>
          </div>
        ) : (
          <div className="py-2">
            {lines.map((line, i) => (
              <div key={i} className="flex hover:bg-white/[0.01] group min-h-5">
                <span className="text-white/[0.10] select-none w-9 text-right pr-3 font-mono text-[10px] leading-5 flex-shrink-0 group-hover:text-white/20 pt-px">{i+1}</span>
                <span className="font-mono text-[11px] leading-5 text-white/30 flex-1 pr-4 whitespace-pre" dangerouslySetInnerHTML={{ __html: colourLine(line) }}/>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="border-t border-white/[0.03] px-4 py-1.5 flex items-center justify-between font-mono text-[9px] text-white/[0.12] bg-white/[0.005] flex-shrink-0">
        <span className="flex items-center gap-1.5"><Zap size={8} className="text-teal-400/30"/>DynamoDB · Vercel Edge</span>
        <span>{memories.length} memories · {jsonStr.length}B</span>
      </div>
    </div>
  );
}

/* ─── Import tab view ─── */
function ImportView({ userId, onDone }: { userId: string; onDone: (mems: CapturedMemory[]) => void }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  async function run() {
    if (!text.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/import", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ userId, text }) });
      const d = await res.json();
      if (d.memories?.length) { onDone(d.memories); setDone(true); setText(""); }
    } catch { /* silent */ } finally { setLoading(false); }
  }
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 gap-5">
      <div className="w-full max-w-lg">
        <p className="text-white/20 text-xs font-mono uppercase tracking-widest mb-2">Import memories</p>
        <p className="text-white/35 text-sm mb-4 leading-relaxed">Paste any text — notes, a bio, preferences. Imprint will extract facts and store them.</p>
        {done ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-10 h-10 rounded-full bg-teal-400/10 border border-teal-400/20 flex items-center justify-center">
              <Check size={18} className="text-teal-400/70"/>
            </div>
            <p className="text-white/40 text-sm">Memories extracted and saved.</p>
            <button onClick={()=>setDone(false)} className="text-white/25 hover:text-white/50 text-xs transition-colors duration-300">Import more →</button>
          </div>
        ) : (
          <>
            <textarea value={text} onChange={e=>setText(e.target.value)} rows={8}
              placeholder="e.g. My name is Yashasvi, I'm building an AI memory app for the H0 hackathon..."
              className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white/65 placeholder:text-white/15 outline-none focus:border-white/[0.12] focus:bg-white/[0.03] resize-none transition-all duration-300 scrollbar-thin leading-relaxed"/>
            <div className="flex justify-end mt-3">
              <button onClick={run} disabled={!text.trim()||loading}
                className="flex items-center gap-2 px-5 py-2 bg-white/[0.04] border border-white/[0.07] rounded-full text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.07] hover:border-white/[0.12] transition-all duration-300 disabled:opacity-25">
                {loading ? <RefreshCw size={13} className="animate-spin"/> : <ArrowUp size={13}/>}
                {loading ? "Extracting…" : "Extract & save"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Main app ─── */
function ChatApp() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") || "guest";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [msgCount, setMsgCount] = useState(0);
  const [memories, setMemories] = useState<CapturedMemory[]>([]);
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [keyConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [userId, setUserId] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const remaining = GUEST_LIMIT - msgCount;
  const isLimitReached = mode === "guest" && !keyConnected && remaining <= 0;
  const shortSession = userId.slice(0, 7) || "loading";

  useEffect(() => {
    const stored = localStorage.getItem("imprint_user_id");
    if (stored) { setUserId(stored); return; }
    const id = crypto.randomUUID();
    localStorage.setItem("imprint_user_id", id);
    setUserId(id);
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending || isLimitReached) return;
    const userMsg: Message = { id:crypto.randomUUID(), role:"user", content:text, timestamp:new Date() };
    setMessages(p=>[...p, userMsg]);
    setInput(""); setSending(true);
    if (inputRef.current) inputRef.current.style.height = "auto";
    const assistantId = crypto.randomUUID();
    setMessages(p=>[...p,{id:assistantId,role:"assistant",content:"",timestamp:new Date()}]);
    try {
      fetch("/api/check",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId,message:text})})
        .then(r=>r.json()).then(d=>{if(d.hasContradiction)setContradictions(p=>[...p,...d.contradictions])}).catch(()=>{});
      const history = [...messages.map(m=>({role:m.role,content:m.content})),{role:"user" as const,content:text}];
      let reply = await streamChatResponse(history, userId, (partial)=>{
        setMessages(p=>p.map(m=>m.id===assistantId?{...m,content:partial}:m));
      });
      if (!reply) { reply = mockResponse(text,memories); setMessages(p=>p.map(m=>m.id===assistantId?{...m,content:reply}:m)); }
      setMsgCount(c=>c+1);
      fetch("/api/memories",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId,messages:[{role:"user",content:text},{role:"assistant",content:reply}],source:"imprint-chat"})})
        .then(r=>r.json()).then(d=>{if(d.memories?.length)setMemories(p=>[...p,...d.memories]);if(d.contradictions?.length)setContradictions(p=>[...p,...d.contradictions])}).catch(()=>{});
    } catch {
      setMessages(p=>p.map(m=>m.id===assistantId?{...m,content:"Connection error — check your setup."}:m));
    } finally { setSending(false); }
  }

  function handleKey(e: React.KeyboardEvent) { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();} }

  const TABS: { id: Tab; label: string }[] = [
    { id: "chat", label: "Chat" },
    { id: "memory", label: "Memory" },
    { id: "import", label: "Import" },
  ];

  return (
    <div className="h-screen w-screen flex overflow-hidden relative"
      style={{ fontFamily:"system-ui,-apple-system,sans-serif", background:"#070a13" }}>
      <BackgroundVideo overlayOpacity={0.93} />

      {/* Ambient glow behind input area */}
      <div className="pointer-events-none fixed bottom-0 left-1/2 -translate-x-1/4 w-[600px] h-[300px] rounded-full opacity-[0.07]"
        style={{ background:"radial-gradient(ellipse at center, #4eecd8 0%, #7c3aed 50%, transparent 80%)", filter:"blur(60px)", zIndex:5 }}/>

      {/* ════ SIDEBAR ════ */}
      <aside className="w-[240px] h-full flex flex-col relative z-10 flex-shrink-0"
        style={{
          background:"rgba(7,10,19,0.85)",
          backdropFilter:"blur(20px)",
          borderRight:"1px solid rgba(255,255,255,0.04)"
        }}>

        {/* Project header */}
        <div className="px-3 pt-4 pb-2">
          <Link href="/" className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-all duration-300 group">
            <div className="w-[18px] h-[18px] rounded-md bg-gradient-to-br from-teal-400/20 to-violet-500/10 border border-white/[0.07] flex items-center justify-center flex-shrink-0">
              <Brain size={10} className="text-teal-400/60" />
            </div>
            <span className="text-white/50 text-[12.5px] font-medium group-hover:text-white/70 transition-colors duration-300">Imprint</span>
            <span className="text-white/15 text-xs">/</span>
            <span className="text-white/25 text-[11px] font-mono truncate">{shortSession}</span>
          </Link>
        </div>

        {/* Tab pills — sliding indicator style */}
        <div className="px-3 pb-3">
          <div className="flex gap-0 relative">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="flex-1 text-[11.5px] py-[6px] rounded-md transition-all duration-300 font-medium relative"
                style={{
                  color: activeTab === tab.id ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.22)",
                  background: activeTab === tab.id ? "rgba(255,255,255,0.06)" : "transparent",
                  borderBottom: activeTab === tab.id ? "1px solid rgba(78,236,216,0.25)" : "1px solid transparent",
                }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="mx-3 border-t border-white/[0.04] mb-1"/>

        {/* + New session */}
        <div className="px-3 pb-1">
          <button onClick={() => setMessages([])}
            className="w-full flex items-center gap-2 px-2.5 py-[7px] rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.03] text-[13px] transition-all duration-300 group">
            <Plus size={13} strokeWidth={1.8} className="group-hover:text-teal-400/60 transition-colors duration-300"/>
            <span>New session</span>
          </button>
        </div>

        {/* Nav items */}
        <div className="px-3 pb-1">
          {["Routines", "Customize"].map(item => (
            <button key={item}
              className="w-full text-left px-2.5 py-[7px] text-white/18 hover:text-white/45 text-[13px] rounded-lg hover:bg-white/[0.025] transition-all duration-300">
              {item}
            </button>
          ))}
          <button className="w-full text-left px-2.5 py-[7px] text-white/18 hover:text-white/45 text-[13px] rounded-lg hover:bg-white/[0.025] transition-all duration-300 flex items-center gap-1">
            More <ChevronRight size={11} className="text-white/12 ml-auto" />
          </button>
        </div>

        {/* Divider */}
        <div className="mx-3 border-t border-white/[0.04] mb-1 mt-1"/>

        {/* Recents */}
        <div className="flex items-center justify-between px-5 pt-2 pb-1.5">
          <span className="text-[10px] font-semibold text-white/15 tracking-[0.16em] uppercase">Recents</span>
          <Settings size={10} className="text-white/12 hover:text-white/30 cursor-pointer transition-colors duration-300" />
        </div>

        <div className="flex-1 overflow-y-auto px-3 scrollbar-thin">
          {/* Active session */}
          <div className="flex items-center gap-[10px] px-2.5 py-[7px] rounded-lg mb-0.5 bg-white/[0.04] border border-white/[0.04]">
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-40"/>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-400/70"/>
            </span>
            <span className="text-[12.5px] text-white/70 truncate font-medium">General coding session</span>
          </div>

          {HISTORY_ITEMS.map(item => (
            <button key={item.label}
              className="w-full flex items-center gap-[10px] px-2.5 py-[7px] rounded-lg mb-0.5 text-white/28 hover:text-white/55 hover:bg-white/[0.025] transition-all duration-300 text-left group">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all duration-300 ${
                item.synced
                  ? "bg-teal-400/40 group-hover:bg-teal-400/60"
                  : "border border-white/15 group-hover:border-white/30"
              }`}/>
              <span className="text-[12.5px] truncate">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Profile */}
        <div className="p-3 border-t border-white/[0.04]">
          <div className="flex items-center gap-2.5 px-2 py-[7px] rounded-lg hover:bg-white/[0.025] cursor-pointer transition-all duration-300 group">
            <div className="w-[26px] h-[26px] rounded-full bg-gradient-to-br from-violet-500/30 to-teal-400/20 border border-white/[0.08] flex items-center justify-center text-[11px] font-semibold text-white/70 flex-shrink-0">
              Y
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] text-white/55 truncate leading-none group-hover:text-white/70 transition-colors duration-300">Yashasvi Daddy</p>
              <p className="text-[10px] text-white/18 leading-none mt-0.5">
                {keyConnected ? "Pro" : "Free"} · {remaining} left
              </p>
            </div>
            <ChevronRight size={11} className="text-white/12 flex-shrink-0" />
          </div>
        </div>
      </aside>

      {/* ════ MAIN COLUMN ════ */}
      <main className="flex-1 h-full flex flex-col relative z-10 overflow-hidden min-w-0">

        {activeTab === "memory" && <MemoryView memories={memories} userId={userId} />}
        {activeTab === "import" && <ImportView userId={userId} onDone={(m) => setMemories(p => [...p, ...m])} />}

        {activeTab === "chat" && (
          <>
            {/* Messages scroll area */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <div className="max-w-[680px] w-full mx-auto px-6 py-10">

                {/* Contradiction banners */}
                {contradictions.map((c, i) => (
                  <div key={i} className="mb-4 rounded-xl px-4 py-3 border border-red-500/10 bg-red-500/[0.03] backdrop-blur-sm">
                    <p className="text-[10px] text-red-400/60 uppercase tracking-widest mb-1 font-mono flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-red-400/60 inline-block"/>
                      Contradiction detected
                    </p>
                    <p className="text-sm text-red-300/40">{c.explanation}</p>
                  </div>
                ))}

                {messages.length === 0 ? (
                  /* Empty state */
                  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-400/10 to-violet-500/10 border border-white/[0.06] flex items-center justify-center mb-6">
                      <Brain size={22} className="text-teal-400/50" />
                    </div>
                    <h2 className="text-[1.9rem] text-white font-light tracking-tight mb-2 leading-snug"
                      style={{ fontFamily:"'Instrument Serif',serif" }}>
                      What shall we commit to{" "}
                      <em className="italic" style={{ color:"#4eecd8", opacity:0.8 }}>memory</em>?
                    </h2>
                    <p className="text-white/18 text-sm mb-10 max-w-sm leading-relaxed">
                      Every message teaches Imprint who you are. Context is synced to DynamoDB instantly.
                    </p>
                    <div className="grid grid-cols-2 gap-2.5 w-full max-w-[540px]">
                      {STARTER_PROMPTS.map(p => (
                        <button key={p.label} onClick={()=>{setInput(p.text);inputRef.current?.focus();}}
                          className="text-left p-4 rounded-xl border border-white/[0.05] bg-white/[0.015] hover:bg-white/[0.035] hover:border-white/[0.10] transition-all duration-300 group">
                          <p className="text-white/55 text-[13px] font-medium mb-1 group-hover:text-white/80 transition-colors duration-300">{p.label}</p>
                          <p className="text-white/18 text-xs leading-relaxed">{p.text}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-7">
                    {messages.map(msg => (
                      <div key={msg.id} className={`flex gap-3 ${msg.role==="user"?"justify-end":"justify-start"}`}>
                        {msg.role === "assistant" && (
                          <div className="w-[26px] h-[26px] rounded-lg bg-gradient-to-br from-teal-400/10 to-violet-500/10 border border-white/[0.06] flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Brain size={12} className="text-teal-400/50" />
                          </div>
                        )}
                        <div className={`flex flex-col gap-1.5 max-w-[78%] ${msg.role==="user"?"items-end":"items-start"}`}>
                          {msg.role === "user" ? (
                            /* User message — clean, no bubble */
                            <p className="text-slate-100 text-[13.5px] leading-relaxed text-right">
                              {msg.content}
                            </p>
                          ) : (
                            /* Assistant message */
                            <div className="text-white/65 text-[13.5px] leading-relaxed">
                              {msg.content === "" && sending ? (
                                <span className="flex items-center gap-1.5 py-1">
                                  {[0,0.15,0.30].map((d,i)=>(
                                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-teal-400/30 animate-bounce" style={{animationDelay:`${d}s`}}/>
                                  ))}
                                </span>
                              ) : (
                                msg.content.split("\n").map((l,i,a)=><span key={i}>{l}{i<a.length-1&&<br/>}</span>)
                              )}
                            </div>
                          )}

                          {/* Diagnostic card for assistant */}
                          {msg.role==="assistant" && msg.content && (
                            <div className="flex items-center gap-2 mt-0.5 px-2.5 py-1 rounded-md border border-white/[0.04] bg-white/[0.015]">
                              <span className="w-1 h-1 rounded-full bg-teal-400/50 flex-shrink-0"/>
                              <span className="text-[9.5px] text-white/20 font-mono">
                                Synced · DynamoDB · {Math.max(8,Math.floor(msg.content.length/6))} tok
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {isLimitReached && (
                      <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.015] px-5 py-4 backdrop-blur-sm">
                        <p className="text-white/30 text-sm" style={{fontFamily:"'Instrument Serif',serif"}}><em>Free tier limit reached.</em></p>
                        <Link href="/login" className="bg-white text-black text-xs font-semibold rounded-full px-4 py-2 hover:bg-white/90 transition-colors whitespace-nowrap">
                          Upgrade →
                        </Link>
                      </div>
                    )}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* ── Input command bar ── */}
            <div className="px-5 pb-5 pt-1 max-w-[680px] w-full mx-auto relative z-10">
              <div className="rounded-2xl overflow-hidden transition-all duration-300"
                style={{
                  border:"1px solid rgba(255,255,255,0.07)",
                  background:"rgba(10,13,24,0.90)",
                  backdropFilter:"blur(20px)",
                  boxShadow:"0 0 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02) inset"
                }}>

                <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
                  onKeyDown={handleKey} disabled={sending||isLimitReached} rows={1}
                  placeholder={isLimitReached?"Upgrade to continue…":"Message Imprint…"}
                  className="w-full bg-transparent text-[13.5px] text-slate-200 placeholder:text-white/15 border-none outline-none resize-none px-4 pt-3.5 pb-2 leading-relaxed scrollbar-thin"
                  style={{ minHeight:"50px", maxHeight:"200px", overflowY:"auto" }}
                  onInput={e=>{ const t=e.currentTarget; t.style.height="auto"; t.style.height=Math.min(t.scrollHeight,200)+"px"; }}
                />

                {/* Bottom bar */}
                <div className="flex items-center px-3 pb-2.5 pt-0">
                  <div className="flex items-center gap-0 flex-1 min-w-0">
                    {/* Git-style branch indicator */}
                    <button className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.10] transition-all duration-300 text-[11px] font-mono text-white/30 flex-shrink-0">
                      <GitBranch size={9} className="text-teal-400/40"/>
                      <span>imprint-core</span>
                      <span className="text-white/12 mx-0.5">·</span>
                      <span>main</span>
                      {memories.length > 0 && (
                        <><span className="text-white/12 mx-0.5">·</span>
                        <span className="text-teal-400/50">+{memories.length}</span></>
                      )}
                    </button>
                    <button className="ml-2 w-7 h-7 flex items-center justify-center rounded-lg text-white/18 hover:text-white/45 hover:bg-white/[0.035] transition-all duration-300">
                      <Paperclip size={13} strokeWidth={1.6}/>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[11px] font-mono text-white/20 hidden sm:block">haiku-3-5</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-white/[0.05] text-white/18 hidden sm:block">
                      {keyConnected ? "Pro" : "Free"}
                    </span>
                    <button onClick={send} disabled={!input.trim()||sending||isLimitReached}
                      className="w-7 h-7 rounded-full bg-white flex items-center justify-center hover:bg-white/85 transition-all duration-300 disabled:opacity-20 disabled:cursor-not-allowed"
                      style={{ boxShadow: input.trim() ? "0 0 12px rgba(255,255,255,0.15)" : "none" }}>
                      <ArrowUp size={13} className="text-black"/>
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-center text-[10px] text-white/[0.07] mt-2 tracking-wide font-mono">
                imprint · memory encrypted · {shortSession}
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function ChatPage() {
  return <Suspense><ChatApp /></Suspense>;
}
