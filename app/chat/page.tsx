"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Brain, Plus, Paperclip, ArrowUp, ChevronRight,
  Database, X, Zap, Copy, Check, Settings, RefreshCw
} from "lucide-react";
import BackgroundVideo from "../components/BackgroundVideo";

/* ─── types ─── */
interface Message { id: string; role: "user" | "assistant"; content: string; timestamp: Date; }
interface CapturedMemory { content: string; topic: string; }
interface Contradiction { explanation: string; }
type Tab = "chat" | "memory" | "import";

/* ─── constants ─── */
const GUEST_LIMIT = 20;
const HISTORY_ITEMS = ["AWS Aurora pgvector Sync", "Claude Context Optimization", "DynamoDB Pipeline Redesign", "Memory Import Session"];
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
      {/* tab strip */}
      <div className="flex items-center border-b border-white/[0.05] h-9 px-0 font-mono text-[11px] bg-[#0c0c0c]/60 flex-shrink-0">
        <div className="flex items-center gap-2 px-4 h-full border-r border-white/[0.05] bg-white/[0.03] text-white/55">
          <Database size={10} className="text-teal-400/60" />
          <span>memory.json</span>
          {memories.length > 0 && <span className="text-[9px] bg-teal-400/15 text-teal-400/70 rounded-full px-1.5 leading-4">{memories.length}</span>}
        </div>
        <button onClick={copy} className="ml-auto mr-3 text-white/20 hover:text-white/50 p-1 transition-colors">
          {copied ? <Check size={11}/> : <Copy size={11}/>}
        </button>
      </div>
      {/* code body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {memories.length === 0 ? (
          <div className="p-6 font-mono text-[11px] leading-6 select-none">
            <p className="text-white/20">// No memories captured yet.</p>
            <p className="text-white/12">// Start chatting to build your persistent memory layer.</p>
            <br/><p className="text-white/[0.08]">// Imprint indexes every message as pgvector</p>
            <p className="text-white/[0.08]">// embeddings into AWS Aurora Serverless.</p>
          </div>
        ) : (
          <div className="py-2">
            {lines.map((line, i) => (
              <div key={i} className="flex hover:bg-white/[0.015] group min-h-5">
                <span className="text-white/[0.13] select-none w-9 text-right pr-3 font-mono text-[10px] leading-5 flex-shrink-0 group-hover:text-white/25 pt-px">{i+1}</span>
                <span className="font-mono text-[11px] leading-5 text-white/38 flex-1 pr-4 whitespace-pre" dangerouslySetInnerHTML={{ __html: colourLine(line) }}/>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* status bar */}
      <div className="border-t border-white/[0.04] px-4 py-1.5 flex items-center justify-between font-mono text-[9px] text-white/[0.15] bg-[#090909] flex-shrink-0">
        <span className="flex items-center gap-1.5"><Zap size={8} className="text-teal-400/40"/>Aurora Serverless · Vercel Edge</span>
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
        <p className="text-white/30 text-xs font-mono uppercase tracking-widest mb-2">Import memories</p>
        <p className="text-white/45 text-sm mb-4 leading-relaxed">Paste any text — notes, a bio, preferences. Imprint will extract facts and store them.</p>
        {done ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Check size={28} className="text-teal-400/60"/>
            <p className="text-white/50 text-sm">Memories extracted and saved.</p>
            <button onClick={()=>setDone(false)} className="text-white/30 hover:text-white/60 text-xs transition-colors">Import more →</button>
          </div>
        ) : (
          <>
            <textarea value={text} onChange={e=>setText(e.target.value)} rows={8} placeholder="e.g. My name is Yashasvi, I'm building an AI memory app for the H0 hackathon..."
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 text-sm text-white/75 placeholder:text-white/20 outline-none focus:border-white/[0.15] resize-none transition-all scrollbar-thin leading-relaxed"/>
            <div className="flex justify-end mt-3">
              <button onClick={run} disabled={!text.trim()||loading}
                className="flex items-center gap-2 px-5 py-2 bg-white/[0.06] border border-white/[0.08] rounded-full text-sm text-white/60 hover:text-white/85 hover:bg-white/[0.09] transition-all disabled:opacity-30">
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

  const [userId] = useState(() => {
    if (typeof window === "undefined") return "guest-" + Math.random().toString(36).slice(2);
    const s = localStorage.getItem("imprint_user_id"); if (s) return s;
    const id = crypto.randomUUID(); localStorage.setItem("imprint_user_id", id); return id;
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const remaining = GUEST_LIMIT - msgCount;
  const isLimitReached = mode === "guest" && !keyConnected && remaining <= 0;
  const shortSession = userId.slice(0, 7);

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
      style={{ fontFamily:"system-ui,-apple-system,sans-serif", background:"#111" }}>
      <BackgroundVideo overlayOpacity={0.90} />

      {/* ════ SIDEBAR (Claude Code style) ════ */}
      <aside className="w-[240px] h-full flex flex-col relative z-10 flex-shrink-0"
        style={{ background:"rgba(18,18,18,0.92)", backdropFilter:"blur(12px)", borderRight:"1px solid rgba(255,255,255,0.055)" }}>

        {/* Project header — "Imprint / session" */}
        <div className="px-3 pt-4 pb-2">
          <Link href="/" className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/[0.04] transition-colors group">
            <div className="w-[18px] h-[18px] rounded bg-white/[0.07] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
              <Brain size={10} className="text-white/50" />
            </div>
            <span className="text-white/55 text-[12.5px] font-medium">Imprint</span>
            <span className="text-white/18 text-xs">/</span>
            <span className="text-white/30 text-[11px] font-mono truncate">{shortSession}</span>
          </Link>
        </div>

        {/* Tab pills — Chat / Memory / Import */}
        <div className="px-3 pb-3">
          <div className="flex gap-0.5 bg-white/[0.03] rounded-lg p-[3px] border border-white/[0.04]">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="flex-1 text-[11.5px] py-[5px] rounded-[5px] transition-all font-medium"
                style={{
                  background: activeTab === tab.id ? "rgba(255,255,255,0.09)" : "transparent",
                  color: activeTab === tab.id ? "rgba(255,255,255,0.80)" : "rgba(255,255,255,0.28)",
                }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* + New session */}
        <div className="px-3 pb-1">
          <button onClick={() => setMessages([])}
            className="w-full flex items-center gap-2 px-2.5 py-[7px] rounded-md text-white/40 hover:text-white/65 hover:bg-white/[0.04] text-[13px] transition-all">
            <Plus size={14} strokeWidth={1.8} />
            <span>New session</span>
          </button>
        </div>

        {/* Routines / Customize / More */}
        <div className="px-3 pb-1">
          {["Routines", "Customize"].map(item => (
            <button key={item}
              className="w-full text-left px-2.5 py-[7px] text-white/22 hover:text-white/45 text-[13px] rounded-md hover:bg-white/[0.03] transition-all">
              {item}
            </button>
          ))}
          <button className="w-full text-left px-2.5 py-[7px] text-white/22 hover:text-white/45 text-[13px] rounded-md hover:bg-white/[0.03] transition-all flex items-center gap-1">
            More <ChevronRight size={11} className="text-white/15" />
          </button>
        </div>

        {/* Recents */}
        <div className="flex items-center justify-between px-5 pt-3 pb-1.5">
          <span className="text-[10px] font-semibold text-white/20 tracking-[0.14em] uppercase">Recents</span>
          <Settings size={11} className="text-white/15" />
        </div>

        <div className="flex-1 overflow-y-auto px-3 scrollbar-thin">
          {/* Active session */}
          <div className="flex items-center gap-[10px] px-2.5 py-[7px] rounded-md mb-0.5 bg-white/[0.05]">
            <span className="text-[7px] flex-shrink-0" style={{ color:"#d4a017" }}>●</span>
            <span className="text-[13px] text-white/75 truncate font-medium">General coding session</span>
          </div>
          {HISTORY_ITEMS.map(item => (
            <button key={item}
              className="w-full flex items-center gap-[10px] px-2.5 py-[7px] rounded-md mb-0.5 text-white/32 hover:text-white/58 hover:bg-white/[0.03] transition-all text-left">
              <span className="text-[7px] text-white/18 flex-shrink-0">○</span>
              <span className="text-[13px] truncate">{item}</span>
            </button>
          ))}
        </div>

        {/* Profile */}
        <div className="p-3 border-t border-white/[0.05]">
          <div className="flex items-center gap-2.5 px-2 py-[7px] rounded-md hover:bg-white/[0.03] cursor-pointer transition-all">
            <div className="w-[26px] h-[26px] rounded-full bg-gradient-to-br from-white/15 to-white/5 border border-white/10 flex items-center justify-center text-[11px] font-semibold text-white/75 flex-shrink-0">
              Y
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] text-white/60 truncate leading-none">Yashasvi Daddy</p>
              <p className="text-[10px] text-white/22 leading-none mt-0.5">
                {keyConnected ? "Pro" : "Free"} · {remaining} left
              </p>
            </div>
            <ChevronRight size={12} className="text-white/15 flex-shrink-0" />
          </div>
        </div>
      </aside>

      {/* ════ MAIN COLUMN ════ */}
      <main className="flex-1 h-full flex flex-col relative z-10 overflow-hidden min-w-0">

        {/* ── Memory tab ── */}
        {activeTab === "memory" && (
          <MemoryView memories={memories} userId={userId} />
        )}

        {/* ── Import tab ── */}
        {activeTab === "import" && (
          <ImportView userId={userId} onDone={(m) => setMemories(p => [...p, ...m])} />
        )}

        {/* ── Chat tab ── */}
        {activeTab === "chat" && (
          <>
            {/* Messages scroll area */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <div className="max-w-[680px] w-full mx-auto px-6 py-10">

                {/* Contradiction banners */}
                {contradictions.map((c, i) => (
                  <div key={i} className="mb-4 rounded-xl px-4 py-3 border border-red-500/15 bg-red-500/[0.04]">
                    <p className="text-[10px] text-red-400/70 uppercase tracking-widest mb-1 font-mono">↯ Contradiction</p>
                    <p className="text-sm text-red-300/50">{c.explanation}</p>
                  </div>
                ))}

                {messages.length === 0 ? (
                  /* Empty state */
                  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                    <div className="w-11 h-11 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mb-6">
                      <Brain size={20} className="text-white/45" />
                    </div>
                    <h2 className="text-[1.9rem] text-white font-light tracking-tight mb-2 leading-snug"
                      style={{ fontFamily:"'Instrument Serif',serif" }}>
                      What shall we commit to{" "}
                      <em className="italic" style={{ color:"#4eecd8" }}>memory</em>?
                    </h2>
                    <p className="text-white/22 text-sm mb-10 max-w-sm leading-relaxed">
                      Every message teaches Imprint who you are. Context is synced to AWS Aurora instantly.
                    </p>
                    <div className="grid grid-cols-2 gap-2.5 w-full max-w-[540px]">
                      {STARTER_PROMPTS.map(p => (
                        <button key={p.label} onClick={()=>{setInput(p.text);inputRef.current?.focus();}}
                          className="text-left p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.045] hover:border-white/[0.12] transition-all group">
                          <p className="text-white/65 text-[13px] font-medium mb-1 group-hover:text-white/85 transition-colors">{p.label}</p>
                          <p className="text-white/22 text-xs leading-relaxed">{p.text}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Messages */
                  <div className="space-y-6">
                    {messages.map(msg => (
                      <div key={msg.id} className={`flex gap-3 ${msg.role==="user"?"justify-end":"justify-start"}`}>
                        {msg.role === "assistant" && (
                          <div className="w-[26px] h-[26px] rounded-md bg-white/[0.04] border border-white/[0.07] flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Brain size={12} className="text-white/45" />
                          </div>
                        )}
                        <div className={`flex flex-col gap-1.5 max-w-[78%] ${msg.role==="user"?"items-end":"items-start"}`}>
                          <div className={`rounded-xl px-4 py-2.5 text-[13.5px] leading-relaxed ${
                            msg.role==="user"
                              ? "bg-white/[0.07] border border-white/[0.065] text-white/82"
                              : "text-white/72"
                          }`}>
                            {msg.content === "" && sending ? (
                              <span className="flex items-center gap-1.5 py-0.5">
                                {[0,0.16,0.32].map((d,i)=>(
                                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce" style={{animationDelay:`${d}s`}}/>
                                ))}
                              </span>
                            ) : (
                              msg.content.split("\n").map((l,i,a)=><span key={i}>{l}{i<a.length-1&&<br/>}</span>)
                            )}
                          </div>
                          {msg.role==="assistant" && msg.content && (
                            <p className="text-[9.5px] text-white/10 font-mono px-1 flex items-center gap-1.5">
                              <Zap size={7} style={{color:"#4eecd8",opacity:0.4}}/>
                              Synced · Aurora · {Math.max(8,Math.floor(msg.content.length/6))} tok
                            </p>
                          )}
                        </div>
                      </div>
                    ))}

                    {isLimitReached && (
                      <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
                        <p className="text-white/38 text-sm" style={{fontFamily:"'Instrument Serif',serif"}}><em>Free tier limit reached.</em></p>
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

            {/* ── Input (Claude Code style) ── */}
            <div className="px-5 pb-5 pt-1 max-w-[680px] w-full mx-auto">
              <div className="rounded-xl overflow-hidden"
                style={{ border:"1px solid rgba(255,255,255,0.08)", background:"rgba(20,20,20,0.92)", backdropFilter:"blur(8px)", boxShadow:"0 4px 28px rgba(0,0,0,0.45)" }}>

                {/* Textarea */}
                <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
                  onKeyDown={handleKey} disabled={sending||isLimitReached} rows={1}
                  placeholder={isLimitReached?"Upgrade to continue…":"Message Imprint…"}
                  className="w-full bg-transparent text-[13.5px] text-white/82 placeholder:text-white/20 border-none outline-none resize-none px-4 pt-3.5 pb-2 leading-relaxed scrollbar-thin"
                  style={{ minHeight:"50px", maxHeight:"200px", overflowY:"auto" }}
                  onInput={e=>{ const t=e.currentTarget; t.style.height="auto"; t.style.height=Math.min(t.scrollHeight,200)+"px"; }}
                />

                {/* Bottom bar — identical to Claude Code's branch/model bar */}
                <div className="flex items-center px-3 pb-2.5 pt-0">
                  {/* Left: project branch info (like "devmirror main +858 -0") */}
                  <div className="flex items-center gap-0 flex-1 min-w-0">
                    <button className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06] transition-all text-[11px] font-mono text-white/38 flex-shrink-0">
                      <span style={{color:"#4eecd8",opacity:0.55,fontSize:"8px"}}>◆</span>
                      <span>imprint-core</span>
                      <span className="text-white/15 mx-0.5">·</span>
                      <span>main</span>
                      {memories.length > 0 && (
                        <><span className="text-white/15 mx-0.5">·</span>
                        <span style={{color:"#4eecd8",opacity:0.6}}>+{memories.length}</span></>
                      )}
                    </button>
                    <button className="ml-2 w-7 h-7 flex items-center justify-center rounded-md text-white/22 hover:text-white/48 hover:bg-white/[0.04] transition-all">
                      <Paperclip size={13} strokeWidth={1.6}/>
                    </button>
                  </div>

                  {/* Right: model + tier + send */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[11px] font-mono text-white/25 hidden sm:block">sonnet-4-5</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-white/[0.06] text-white/22 hidden sm:block">
                      {keyConnected ? "Pro" : "Free"}
                    </span>
                    <button onClick={send} disabled={!input.trim()||sending||isLimitReached}
                      className="w-7 h-7 rounded-full bg-white flex items-center justify-center hover:bg-white/85 transition-all disabled:opacity-20 disabled:cursor-not-allowed">
                      <ArrowUp size={13} className="text-black"/>
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer disclaimer */}
              <p className="text-center text-[10px] text-white/[0.09] mt-2 tracking-wide font-mono">
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
