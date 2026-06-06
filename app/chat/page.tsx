"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Brain, Plus, Paperclip, ChevronRight, Database,
  Copy, Check, Settings, RefreshCw, Upload, BarChart2,
  Edit3, ArrowLeft, Search, MessageSquare, MoreHorizontal,
  Pencil, ChevronDown, Mic, Layers, Zap, BookOpen,
  Calendar, Mail, Code2, PenLine, GraduationCap, Key,
  Eye, EyeOff, X, ExternalLink, Trash2
} from "lucide-react";

/* ─── types ─── */
interface Message { id:string; role:"user"|"assistant"; content:string; timestamp:Date; }
interface CapturedMemory { content:string; topic:string; }
interface Contradiction { explanation:string; }
type Tab = "chat"|"memory"|"import";
type View = "home"|"chat";

/* ─── constants ─── */
const HISTORY_ITEMS = [
  { id:"1", label:"AWS Aurora pgvector Sync", time:"2h ago" },
  { id:"2", label:"Claude Context Optimization", time:"yesterday" },
  { id:"3", label:"DynamoDB Pipeline Redesign", time:"2d ago" },
  { id:"4", label:"Memory Import Session", time:"3d ago" },
];
const MOCK_MEMORIES = [
  { content:"Building Imprint — a persistent Claude memory layer for H0 hackathon", topic:"projects" },
  { content:"Stack: Next.js 16, DynamoDB, Bedrock, Chrome Extension MV3", topic:"work" },
  { content:"Prefers concise, direct responses with code examples", topic:"preferences" },
  { content:"Based in India, using AWS AISPL account", topic:"personal" },
];
const TOPIC_COLORS:Record<string,string> = {
  projects:"#7c3aed", work:"#0070f3", preferences:"#d97706", personal:"#059669", general:"#6b7280",
};

/* ─── time greeting ─── */
function getGreeting(name:string):string {
  const h = new Date().getHours();
  if (h < 12) return `Morning, ${name}`;
  if (h < 17) return `Afternoon, ${name}`;
  return `Evening, ${name}`;
}

/* ─── mock fallback ─── */
function mockResponse(t:string, mem:CapturedMemory[]):string {
  const l=t.toLowerCase();
  if (mem.length&&(l.includes("remember")||l.includes("know about")))
    return `Here's what I've captured:\n\n${mem.slice(0,4).map(m=>`— ${m.content}`).join("\n")}\n\nAnything else?`;
  if (l.includes("name")) return "Got it — I'll remember that. What else would you like me to know?";
  if (l.includes("work")||l.includes("job")) return "Noted. I've stored that context and will reference it in future sessions.";
  return "I've received your message and extracted the key facts to remember.\n\nNext time we speak, I'll already have this context loaded automatically.";
}

/* ─── streaming helper ─── */
async function streamChatResponse(
  messages:{role:string;content:string}[],
  userId:string,
  claudeKey:string,
  onChunk:(p:string)=>void
):Promise<string> {
  try {
    const res = await fetch("/api/chat",{
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({userId, messages, claudeKey: claudeKey||undefined}),
    });
    if(!res.ok||!res.body) throw new Error(`HTTP ${res.status}`);
    const reader=res.body.getReader(), decoder=new TextDecoder();
    let full="";
    while(true){const{done,value}=await reader.read();if(done)break;full+=decoder.decode(value,{stream:true});onChunk(full);}
    return full;
  } catch { return ""; }
}

/* ─── syntax colouring (memory view) ─── */
function colourLine(raw:string):string{
  let s=raw.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  s=s.replace(/"([^"]+)":/g,'<span style="color:#1d4ed8">"$1"</span>:');
  s=s.replace(/: "([^"]+)"/g,': <span style="color:#059669">"$1"</span>');
  s=s.replace(/: (true|false|null)/g,': <span style="color:#7c3aed">$1</span>');
  s=s.replace(/: (\d+\.?\d*)/g,': <span style="color:#d97706">$1</span>');
  return s;
}

/* ══════════════════════════════════════════════
   API KEY MODAL
══════════════════════════════════════════════ */
function ApiKeyModal({onSave, onClose}:{onSave:(key:string)=>void; onClose:()=>void}) {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  function save() {
    if (!key.trim().startsWith("sk-ant-")) { setError("Must start with sk-ant-"); return; }
    onSave(key.trim());
  }
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)"}}>
      <div style={{width:"100%",maxWidth:460,background:"#2f2f2f",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:"32px",boxShadow:"0 32px 80px rgba(0,0,0,0.5)"}}>
        {/* Top accent */}
        <div style={{position:"absolute",top:0,left:"25%",right:"25%",height:1,background:"linear-gradient(90deg,transparent,rgba(207,143,109,0.5),transparent)",borderRadius:1}}/>

        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
          <div style={{width:40,height:40,borderRadius:12,background:"linear-gradient(135deg,#cf8f6d,#c47a4a)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <Key size={18} style={{color:"white"}}/>
          </div>
          <div>
            <h2 style={{fontSize:17,fontWeight:600,color:"rgba(255,255,255,0.9)",letterSpacing:"-0.01em",margin:0}}>Connect your Claude API key</h2>
            <p style={{fontSize:12.5,color:"rgba(255,255,255,0.35)",margin:0,marginTop:2}}>Unlimited messages · Your key, your data</p>
          </div>
          <button onClick={onClose} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.3)",padding:4}}>
            <X size={16}/>
          </button>
        </div>

        <p style={{fontSize:13.5,color:"rgba(255,255,255,0.45)",lineHeight:1.7,marginBottom:20}}>
          Imprint uses your Anthropic API key to send messages directly to Claude — no message limits, no middleman. Your key is stored only in your browser.
        </p>

        <div style={{position:"relative",marginBottom:12}}>
          <input
            type={show?"text":"password"}
            placeholder="sk-ant-api03-..."
            value={key}
            onChange={e=>{setKey(e.target.value);setError("");}}
            style={{width:"100%",background:"rgba(255,255,255,0.05)",border:`1px solid ${error?"rgba(239,68,68,0.5)":"rgba(255,255,255,0.1)"}`,borderRadius:12,padding:"11px 44px 11px 14px",fontSize:14,color:"rgba(255,255,255,0.85)",outline:"none",boxSizing:"border-box",fontFamily:"monospace"}}
          />
          <button onClick={()=>setShow(!show)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.3)",padding:0}}>
            {show?<EyeOff size={14}/>:<Eye size={14}/>}
          </button>
        </div>

        {error && <p style={{fontSize:12,color:"rgba(239,68,68,0.8)",marginBottom:12}}>{error}</p>}

        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:20}}>
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener"
            style={{display:"flex",alignItems:"center",gap:4,fontSize:12.5,color:"rgba(207,143,109,0.7)",textDecoration:"none"}}>
            Get your API key <ExternalLink size={11}/>
          </a>
          <span style={{color:"rgba(255,255,255,0.15)",fontSize:12}}>·</span>
          <span style={{fontSize:12,color:"rgba(255,255,255,0.25)"}}>Free tier: $5 credit on signup</span>
        </div>

        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:"10px",borderRadius:10,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.45)",fontSize:14,cursor:"pointer"}}>
            Cancel
          </button>
          <button onClick={save} disabled={!key.trim()}
            style={{flex:2,padding:"10px",borderRadius:10,background:key.trim()?"linear-gradient(135deg,#cf8f6d,#c47a4a)":"rgba(255,255,255,0.05)",border:"none",color:key.trim()?"white":"rgba(255,255,255,0.25)",fontSize:14,fontWeight:600,cursor:key.trim()?"pointer":"not-allowed"}}>
            Connect key
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   SIDEBAR  — exact Claude dark sidebar
══════════════════════════════════════════════ */
function Sidebar({
  view, activeTab, memories, claudeKey, displayName,
  onNewChat, onDashboard, onSelectHistory, onTabChange, onOpenKeyModal,
}:{
  view:View; activeTab:Tab; memories:CapturedMemory[]; claudeKey:string; displayName:string;
  onNewChat:()=>void; onDashboard:()=>void;
  onSelectHistory:(l:string)=>void; onTabChange:(t:Tab)=>void; onOpenKeyModal:()=>void;
}) {
  return (
    <aside style={{width:256,height:"100%",display:"flex",flexDirection:"column",background:"#1a1918",flexShrink:0,overflow:"hidden"}}>
      {/* Logo + new chat button */}
      <div style={{padding:"14px 12px 8px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <Link href="/" style={{display:"flex",alignItems:"center",gap:8,textDecoration:"none"}}>
          {/* Anthropic asterisk style logo */}
          <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#cf8f6d,#c47a4a)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <span style={{color:"white",fontSize:16,fontWeight:700,lineHeight:1}}>✳</span>
          </div>
          <span style={{fontSize:15,fontWeight:600,color:"rgba(255,255,255,0.82)",letterSpacing:"-0.01em"}}>Imprint</span>
        </Link>
        <button onClick={onNewChat} title="New chat"
          style={{width:30,height:30,borderRadius:8,background:"transparent",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,0.35)"}}>
          <Pencil size={14}/>
        </button>
      </div>

      {/* Main nav — Claude style */}
      <div style={{padding:"0 8px 4px"}}>
        {[
          {icon:<Plus size={15}/>, label:"New chat", action:onNewChat, bold:true},
          {icon:<Database size={15}/>, label:"Memories", action:()=>onTabChange("memory")},
          {icon:<Upload size={15}/>, label:"Import", action:()=>onTabChange("import")},
          {icon:<BarChart2 size={15}/>, label:"Dashboard", action:onDashboard},
        ].map(n=>(
          <button key={n.label} onClick={n.action}
            style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"7px 10px",borderRadius:8,border:"none",background:"transparent",cursor:"pointer",color:"rgba(255,255,255,0.65)",fontSize:14,fontWeight:n.bold?600:400,textAlign:"left",marginBottom:1}}
            onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.background="rgba(255,255,255,0.07)"}
            onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.background="transparent"}>
            <span style={{opacity:0.6}}>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </div>

      <div style={{height:1,background:"rgba(255,255,255,0.06)",margin:"4px 12px 8px"}}/>

      {/* Pinned */}
      {memories.length > 0 && (
        <>
          <div style={{padding:"0 18px 6px"}}>
            <span style={{fontSize:11,color:"rgba(255,255,255,0.3)",fontWeight:500}}>Pinned</span>
          </div>
          {(memories.length?memories:MOCK_MEMORIES).slice(0,2).map((m,i)=>(
            <button key={i} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:8,border:"none",background:"transparent",cursor:"pointer",textAlign:"left",marginBottom:1}}
              onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.background="rgba(255,255,255,0.05)"}
              onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.background="transparent"}>
              <span style={{fontSize:13,color:"rgba(255,255,255,0.45)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.content}</span>
            </button>
          ))}
          <div style={{height:1,background:"rgba(255,255,255,0.06)",margin:"4px 12px 8px"}}/>
        </>
      )}

      {/* Recents */}
      <div style={{padding:"0 18px 6px"}}>
        <span style={{fontSize:11,color:"rgba(255,255,255,0.3)",fontWeight:500}}>Recents</span>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"0 8px"}}>
        {/* Active */}
        <button onClick={()=>onTabChange("chat")}
          style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:8,border:"none",background:view==="chat"&&activeTab==="chat"?"rgba(255,255,255,0.08)":"transparent",cursor:"pointer",textAlign:"left",marginBottom:1}}
          onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.background="rgba(255,255,255,0.07)"}
          onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.background=view==="chat"&&activeTab==="chat"?"rgba(255,255,255,0.08)":"transparent"}>
          <span style={{fontSize:13,color:"rgba(255,255,255,0.72)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500}}>General coding session</span>
        </button>
        {HISTORY_ITEMS.map(item=>(
          <button key={item.id} onClick={()=>onSelectHistory(item.label)}
            style={{width:"100%",display:"flex",alignItems:"center",padding:"6px 10px",borderRadius:8,border:"none",background:"transparent",cursor:"pointer",marginBottom:1}}
            onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.background="rgba(255,255,255,0.05)"}
            onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.background="transparent"}>
            <span style={{fontSize:13,color:"rgba(255,255,255,0.4)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,textAlign:"left"}}>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Profile footer */}
      <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",padding:"10px 12px"}}>
        {/* API key status */}
        {claudeKey ? (
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",marginBottom:6,borderRadius:8,background:"rgba(5,150,105,0.1)",border:"1px solid rgba(5,150,105,0.2)"}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:"#059669",flexShrink:0}}/>
            <span style={{fontSize:12,color:"rgba(5,150,105,0.9)",flex:1}}>API key connected</span>
            <button onClick={onOpenKeyModal} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(5,150,105,0.5)",padding:0,fontSize:11}}>change</button>
          </div>
        ) : (
          <button onClick={onOpenKeyModal}
            style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:8,border:"1px dashed rgba(207,143,109,0.25)",background:"rgba(207,143,109,0.05)",cursor:"pointer",marginBottom:6,transition:"all 0.15s"}}
            onMouseEnter={e=>{(e.currentTarget).style.background="rgba(207,143,109,0.1)";(e.currentTarget).style.borderColor="rgba(207,143,109,0.4)";}}
            onMouseLeave={e=>{(e.currentTarget).style.background="rgba(207,143,109,0.05)";(e.currentTarget).style.borderColor="rgba(207,143,109,0.25)";}}>
            <Key size={13} style={{color:"rgba(207,143,109,0.6)",flexShrink:0}}/>
            <span style={{fontSize:13,color:"rgba(207,143,109,0.7)",fontWeight:500}}>Connect API key</span>
            <span style={{marginLeft:"auto",fontSize:10,color:"rgba(207,143,109,0.4)"}}>unlimited</span>
          </button>
        )}
        {/* User row */}
        <div style={{display:"flex",alignItems:"center",gap:9,padding:"5px 8px",borderRadius:8,cursor:"pointer"}}
          onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.background="rgba(255,255,255,0.05)"}
          onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.background="transparent"}>
          <div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,#cf8f6d,#c47a4a)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"white",flexShrink:0}}>Y</div>
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontSize:13,color:"rgba(255,255,255,0.75)",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500}}>{displayName}</p>
            <p style={{fontSize:11,color:"rgba(255,255,255,0.3)",margin:0}}>{claudeKey?"Pro · Unlimited":"Free · Connect key"}</p>
          </div>
          <ChevronDown size={12} style={{color:"rgba(255,255,255,0.2)",flexShrink:0}}/>
        </div>
      </div>
    </aside>
  );
}

/* ══════════════════════════════════════════════
   MEMORY TAB
══════════════════════════════════════════════ */
function MemoryView({memories,userId}:{memories:CapturedMemory[];userId:string}){
  const [copied,setCopied]=useState(false);
  const allMems=memories.length?memories:MOCK_MEMORIES;
  const jsonStr=JSON.stringify({memories:allMems.map(m=>({topic:m.topic,content:m.content}))},null,2);
  const lines=jsonStr.split("\n");
  async function copy(){await navigator.clipboard.writeText(jsonStr).catch(()=>{});setCopied(true);setTimeout(()=>setCopied(false),2000);}
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"#212121"}}>
      <div style={{display:"flex",alignItems:"center",height:44,padding:"0 16px",borderBottom:"1px solid rgba(255,255,255,0.07)",flexShrink:0}}>
        <Database size={13} style={{color:"rgba(255,255,255,0.4)",marginRight:8}}/>
        <span style={{fontSize:13,color:"rgba(255,255,255,0.55)",fontFamily:"monospace"}}>memory.json</span>
        <span style={{fontSize:10,background:"rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.4)",borderRadius:10,padding:"1px 8px",marginLeft:8}}>{allMems.length}</span>
        <button onClick={copy} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.25)",display:"flex",padding:4}}>
          {copied?<Check size={12} style={{color:"#059669"}}/>:<Copy size={12}/>}
        </button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"8px 0"}}>
        {lines.map((line,i)=>(
          <div key={i} style={{display:"flex",minHeight:20}}>
            <span style={{color:"rgba(255,255,255,0.15)",userSelect:"none",width:40,textAlign:"right",paddingRight:12,fontFamily:"monospace",fontSize:11,lineHeight:"20px",flexShrink:0}}>{i+1}</span>
            <span style={{fontFamily:"monospace",fontSize:12,lineHeight:"20px",color:"rgba(255,255,255,0.5)",flex:1,paddingRight:16,whiteSpace:"pre"}} dangerouslySetInnerHTML={{__html:colourLine(line)}}/>
          </div>
        ))}
      </div>
      <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",padding:"7px 16px",display:"flex",justifyContent:"space-between",fontSize:10,fontFamily:"monospace",color:"rgba(255,255,255,0.25)",flexShrink:0}}>
        <span>DynamoDB · Vercel Edge</span>
        <span>{allMems.length} memories</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   IMPORT TAB
══════════════════════════════════════════════ */
function ImportView({userId,onDone}:{userId:string;onDone:(m:CapturedMemory[])=>void}){
  const [text,setText]=useState("");const [loading,setLoading]=useState(false);const [done,setDone]=useState(false);
  async function run(){if(!text.trim()||loading)return;setLoading(true);try{const res=await fetch("/api/import",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId,text})});const d=await res.json();if(d.memories?.length){onDone(d.memories);setDone(true);setText("");}}catch{}finally{setLoading(false);}}
  return(
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:32,background:"#212121"}}>
      <div style={{width:"100%",maxWidth:560,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:32}}>
        <h2 style={{fontSize:18,fontWeight:600,color:"rgba(255,255,255,0.85)",marginBottom:8}}>Import memories</h2>
        <p style={{fontSize:14,color:"rgba(255,255,255,0.35)",marginBottom:20,lineHeight:1.6}}>Paste any text — notes, a bio, preferences. Imprint will extract facts and store them.</p>
        {done?(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12,padding:"24px 0"}}>
            <Check size={32} style={{color:"#059669"}}/>
            <p style={{fontSize:14,color:"rgba(255,255,255,0.55)"}}>Memories extracted and saved.</p>
            <button onClick={()=>setDone(false)} style={{fontSize:13,color:"rgba(255,255,255,0.3)",background:"none",border:"none",cursor:"pointer"}}>Import more →</button>
          </div>
        ):(
          <>
            <textarea value={text} onChange={e=>setText(e.target.value)} rows={7}
              placeholder="e.g. My name is Yashasvi, I'm building an AI memory app for the H0 hackathon..."
              style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"12px",fontSize:14,color:"rgba(255,255,255,0.75)",outline:"none",resize:"none",lineHeight:1.6,boxSizing:"border-box",fontFamily:"inherit"}}/>
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}>
              <button onClick={run} disabled={!text.trim()||loading}
                style={{display:"flex",alignItems:"center",gap:6,padding:"9px 20px",background:!text.trim()||loading?"rgba(255,255,255,0.08)":"linear-gradient(135deg,#cf8f6d,#c47a4a)",color:!text.trim()||loading?"rgba(255,255,255,0.25)":"white",border:"none",borderRadius:20,fontSize:13.5,fontWeight:500,cursor:!text.trim()||loading?"not-allowed":"pointer"}}>
                {loading?<RefreshCw size={13} style={{animation:"spin 0.8s linear infinite"}}/>:null}
                {loading?"Extracting…":"Extract & save"}
              </button>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════ */
function Dashboard({memories,msgCount,onStartChat,onSelectHistory,onTabChange,onOpenKeyModal,claudeKey}:{
  memories:CapturedMemory[];msgCount:number;claudeKey:string;
  onStartChat:()=>void;onSelectHistory:(l:string)=>void;onTabChange:(t:Tab)=>void;onOpenKeyModal:()=>void;
}){
  const allMems=memories.length?memories:MOCK_MEMORIES;
  return(
    <div style={{flex:1,overflowY:"auto",background:"#212121",padding:"40px 48px"}}>
      <div style={{marginBottom:40}}>
        <h1 style={{fontSize:28,fontWeight:700,color:"rgba(255,255,255,0.9)",letterSpacing:"-0.02em",marginBottom:6}}>{getGreeting("Yashasvi")}</h1>
        <p style={{fontSize:14,color:"rgba(255,255,255,0.35)"}}>Your memory layer is active · {allMems.length} facts stored</p>
      </div>
      {/* Key banner if not connected */}
      {!claudeKey && (
        <div style={{display:"flex",alignItems:"center",gap:16,padding:"16px 20px",borderRadius:14,border:"1px dashed rgba(207,143,109,0.25)",background:"rgba(207,143,109,0.04)",marginBottom:28,cursor:"pointer"}}
          onClick={onOpenKeyModal}>
          <Key size={20} style={{color:"rgba(207,143,109,0.6)",flexShrink:0}}/>
          <div style={{flex:1}}>
            <p style={{fontSize:14,fontWeight:500,color:"rgba(207,143,109,0.85)",margin:0}}>Connect your Anthropic API key for unlimited messages</p>
            <p style={{fontSize:12.5,color:"rgba(255,255,255,0.3)",margin:0,marginTop:2}}>Free on Anthropic · Takes 30 seconds · Stored only in your browser</p>
          </div>
          <ChevronRight size={16} style={{color:"rgba(207,143,109,0.4)",flexShrink:0}}/>
        </div>
      )}
      {/* Quick actions */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:28}}>
        {[
          {icon:<MessageSquare size={17}/>,title:"New Chat",desc:"Start with memory",c:"#cf8f6d",action:onStartChat},
          {icon:<Database size={17}/>,title:"Memories",desc:"Browse stored facts",c:"#7c3aed",action:()=>onTabChange("memory")},
          {icon:<Upload size={17}/>,title:"Import",desc:"Extract from text",c:"#d97706",action:()=>onTabChange("import")},
          {icon:<Key size={17}/>,title:claudeKey?"Key Active":"Add Key",desc:claudeKey?"Unlimited msgs":"Connect Claude",c:claudeKey?"#059669":"#6b7280",action:onOpenKeyModal},
        ].map(c=>(
          <button key={c.title} onClick={c.action}
            style={{padding:"18px 14px",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.03)",cursor:"pointer",textAlign:"left",display:"flex",flexDirection:"column",gap:10,transition:"background 0.15s"}}
            onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.background="rgba(255,255,255,0.06)"}
            onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.background="rgba(255,255,255,0.03)"}>
            <div style={{width:36,height:36,borderRadius:10,background:`${c.c}14`,border:`1px solid ${c.c}22`,display:"flex",alignItems:"center",justifyContent:"center",color:c.c}}>{c.icon}</div>
            <div>
              <p style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.75)",marginBottom:2}}>{c.title}</p>
              <p style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>{c.desc}</p>
            </div>
          </button>
        ))}
      </div>
      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:28}}>
        {[
          {label:"Sessions",value:HISTORY_ITEMS.length+1,sub:"total"},
          {label:"Memories",value:allMems.length,sub:"saved"},
          {label:"Today",value:msgCount,sub:"messages"},
          {label:"Model",value:"Haiku",sub:"claude-3-5"},
        ].map(s=>(
          <div key={s.label} style={{padding:"14px 16px",borderRadius:12,border:"1px solid rgba(255,255,255,0.06)",background:"rgba(255,255,255,0.025)"}}>
            <p style={{fontSize:11,color:"rgba(255,255,255,0.25)",letterSpacing:"0.04em",marginBottom:6}}>{s.label.toUpperCase()}</p>
            <p style={{fontSize:24,fontWeight:700,color:"rgba(255,255,255,0.85)",letterSpacing:"-0.02em",lineHeight:1,marginBottom:4}}>{s.value}</p>
            <p style={{fontSize:11,color:"rgba(207,143,109,0.6)"}}>{s.sub}</p>
          </div>
        ))}
      </div>
      {/* Two panels */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <div style={{borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.02)",overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
            <span style={{fontSize:11.5,fontWeight:600,color:"rgba(255,255,255,0.35)",letterSpacing:"0.06em"}}>RECENT CHATS</span>
            <button onClick={onStartChat} style={{fontSize:12,color:"rgba(207,143,109,0.6)",background:"none",border:"none",cursor:"pointer"}}>+ New</button>
          </div>
          <div onClick={onStartChat} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 16px",cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,0.04)"}}
            onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.background="rgba(255,255,255,0.04)"}
            onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.background="transparent"}>
            <span style={{width:6,height:6,borderRadius:"50%",background:"rgba(78,236,216,0.7)",flexShrink:0}}/>
            <span style={{fontSize:13,color:"rgba(255,255,255,0.75)",fontWeight:500,flex:1}}>General coding session</span>
            <span style={{fontSize:11,color:"rgba(207,143,109,0.5)"}}>active</span>
          </div>
          {HISTORY_ITEMS.map(item=>(
            <div key={item.id} onClick={()=>onSelectHistory(item.label)}
              style={{display:"flex",alignItems:"center",gap:8,padding:"10px 16px",cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,0.03)",transition:"background 0.12s"}}
              onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.background="rgba(255,255,255,0.04)"}
              onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.background="transparent"}>
              <span style={{width:5,height:5,borderRadius:"50%",background:"rgba(255,255,255,0.2)",flexShrink:0}}/>
              <span style={{fontSize:13,color:"rgba(255,255,255,0.45)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.label}</span>
              <span style={{fontSize:11,color:"rgba(255,255,255,0.2)"}}>{item.time}</span>
            </div>
          ))}
        </div>
        <div style={{borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.02)",overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
            <span style={{fontSize:11.5,fontWeight:600,color:"rgba(255,255,255,0.35)",letterSpacing:"0.06em"}}>SAVED MEMORIES</span>
            <button onClick={()=>onTabChange("memory")} style={{fontSize:12,color:"rgba(207,143,109,0.6)",background:"none",border:"none",cursor:"pointer"}}>View all →</button>
          </div>
          {allMems.slice(0,5).map((mem,i)=>(
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 16px",borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
              <span style={{fontSize:9,fontWeight:600,color:TOPIC_COLORS[mem.topic]||"#6b7280",background:`${TOPIC_COLORS[mem.topic]||"#6b7280"}15`,border:`1px solid ${TOPIC_COLORS[mem.topic]||"#6b7280"}22`,borderRadius:20,padding:"2px 7px",flexShrink:0,marginTop:1,textTransform:"uppercase",letterSpacing:"0.04em"}}>{mem.topic}</span>
              <span style={{fontSize:13,color:"rgba(255,255,255,0.45)",lineHeight:1.5,flex:1}}>{mem.content}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{height:32}}/>
    </div>
  );
}

/* ══════════════════════════════════════════════
   CLAUDE CHAT  — pixel-perfect Claude.ai dark clone
══════════════════════════════════════════════ */
function ClaudeChat({
  messages,sending,input,setInput,inputRef,send,handleKey,
  memories,contradictions,messagesEndRef,claudeKey,onOpenKeyModal,displayName,
}:{
  messages:Message[];sending:boolean;input:string;setInput:(v:string)=>void;
  inputRef:React.RefObject<HTMLTextAreaElement>;send:()=>void;handleKey:(e:React.KeyboardEvent)=>void;
  memories:CapturedMemory[];contradictions:Contradiction[];messagesEndRef:React.RefObject<HTMLDivElement>;
  claudeKey:string;onOpenKeyModal:()=>void;displayName:string;
}){
  const ACTION_CHIPS = [
    {icon:<PenLine size={13}/>, label:"Write"},
    {icon:<GraduationCap size={13}/>, label:"Learn"},
    {icon:<Code2 size={13}/>, label:"Code"},
    {icon:<Calendar size={13}/>, label:"Plan"},
    {icon:<Database size={13}/>, label:"Memory"},
  ];

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",background:"#212121",overflow:"hidden"}}>
      <style>{`
        @keyframes claude-dot { 0%,60%,100%{transform:translateY(0);opacity:0.3} 30%{transform:translateY(-5px);opacity:1} }
        @keyframes spin{to{transform:rotate(360deg)}}
        .msg-hover:hover .msg-actions{opacity:1!important}
      `}</style>

      {/* Top bar — matches Claude's minimal top bar */}
      <div style={{height:50,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <button style={{display:"flex",alignItems:"center",gap:7,padding:"5px 12px",borderRadius:8,background:"transparent",border:"1px solid rgba(255,255,255,0.1)",cursor:"pointer",fontSize:13.5,color:"rgba(255,255,255,0.6)"}}>
          <div style={{width:16,height:16,borderRadius:4,background:"linear-gradient(135deg,#cf8f6d,#c47a4a)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <span style={{color:"white",fontSize:9,lineHeight:1}}>✳</span>
          </div>
          Claude — Imprint
          <ChevronDown size={12} style={{color:"rgba(255,255,255,0.3)"}}/>
        </button>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {memories.length > 0 && (
            <span style={{fontSize:11.5,color:"rgba(78,236,216,0.7)",background:"rgba(78,236,216,0.08)",border:"1px solid rgba(78,236,216,0.15)",borderRadius:20,padding:"3px 10px",fontWeight:500}}>
              {memories.length} memories active
            </span>
          )}
          {!claudeKey && (
            <button onClick={onOpenKeyModal}
              style={{fontSize:12,color:"rgba(207,143,109,0.7)",background:"rgba(207,143,109,0.08)",border:"1px solid rgba(207,143,109,0.2)",borderRadius:20,padding:"4px 12px",cursor:"pointer",fontWeight:500}}>
              Connect API key →
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{flex:1,overflowY:"auto"}}>
        <div style={{maxWidth:740,margin:"0 auto",padding:"0 24px"}}>

          {contradictions.map((c,i)=>(
            <div key={i} style={{margin:"12px 0",borderRadius:10,padding:"10px 14px",border:"1px solid rgba(239,68,68,0.2)",background:"rgba(239,68,68,0.06)"}}>
              <p style={{fontSize:11,color:"rgba(239,68,68,0.7)",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:4,fontWeight:600}}>⚠ Contradiction detected</p>
              <p style={{fontSize:13,color:"rgba(239,68,68,0.5)"}}>{c.explanation}</p>
            </div>
          ))}

          {messages.length===0 ? (
            /* ── Empty state — exact Claude.ai greeting ── */
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"calc(100vh - 200px)",textAlign:"center",padding:"40px 0 20px"}}>
              {/* Asterisk logo — exact Claude style */}
              <div style={{marginBottom:24,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:52,lineHeight:1,background:"linear-gradient(135deg,#cf8f6d,#c47a4a)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",filter:"drop-shadow(0 0 24px rgba(207,143,109,0.3))"}}>✳</span>
              </div>
              {/* Time-based greeting — exact Claude font style */}
              <h1 style={{fontFamily:"'Georgia','Times New Roman',serif",fontSize:"clamp(2rem,5vw,3rem)",fontWeight:400,color:"rgba(255,255,255,0.88)",letterSpacing:"-0.02em",marginBottom:40,lineHeight:1.15}}>
                {getGreeting(displayName)}
              </h1>
              {/* Input box here (inline for empty state) */}
              <div style={{width:"100%",maxWidth:660,background:"#2f2f2f",borderRadius:20,border:"1px solid rgba(255,255,255,0.1)",boxShadow:"0 4px 24px rgba(0,0,0,0.3)",marginBottom:16,overflow:"hidden"}}>
                <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
                  onKeyDown={handleKey} rows={1}
                  placeholder="How can I help you today?"
                  style={{width:"100%",background:"transparent",fontSize:15,color:"rgba(255,255,255,0.82)",border:"none",outline:"none",resize:"none",padding:"18px 20px 0",lineHeight:1.6,minHeight:56,maxHeight:200,overflowY:"auto",fontFamily:"inherit",boxSizing:"border-box"}}
                  onInput={e=>{const t=e.currentTarget;t.style.height="auto";t.style.height=Math.min(t.scrollHeight,200)+"px";}}
                />
                <div style={{display:"flex",alignItems:"center",padding:"8px 14px 14px",gap:8}}>
                  <button style={{width:30,height:30,borderRadius:8,background:"transparent",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,0.3)"}}>
                    <Plus size={16}/>
                  </button>
                  <div style={{flex:1}}/>
                  <span style={{fontSize:12.5,color:"rgba(255,255,255,0.25)",fontWeight:500}}>claude-3-5-haiku</span>
                  <ChevronDown size={12} style={{color:"rgba(255,255,255,0.2)"}}/>
                  <button style={{width:30,height:30,borderRadius:8,background:"transparent",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,0.3)"}}>
                    <Mic size={14}/>
                  </button>
                  <button onClick={send} disabled={!input.trim()||sending}
                    style={{width:32,height:32,borderRadius:10,background:input.trim()&&!sending?"linear-gradient(135deg,#cf8f6d,#c47a4a)":"rgba(255,255,255,0.08)",border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:input.trim()&&!sending?"pointer":"not-allowed",transition:"background 0.15s"}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={input.trim()&&!sending?"white":"rgba(255,255,255,0.3)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                  </button>
                </div>
              </div>
              {/* Action chips — exact Claude style */}
              <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center"}}>
                {ACTION_CHIPS.map(chip=>(
                  <button key={chip.label}
                    style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:20,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.04)",cursor:"pointer",fontSize:13.5,color:"rgba(255,255,255,0.55)",fontWeight:500,transition:"all 0.15s"}}
                    onMouseEnter={e=>{(e.currentTarget).style.background="rgba(255,255,255,0.08)";(e.currentTarget).style.borderColor="rgba(255,255,255,0.18)";(e.currentTarget).style.color="rgba(255,255,255,0.82)";}}
                    onMouseLeave={e=>{(e.currentTarget).style.background="rgba(255,255,255,0.04)";(e.currentTarget).style.borderColor="rgba(255,255,255,0.1)";(e.currentTarget).style.color="rgba(255,255,255,0.55)";}}>
                    {chip.icon}{chip.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ── Messages ── */
            <div style={{display:"flex",flexDirection:"column",paddingTop:28,paddingBottom:24}}>
              {messages.map((msg)=>(
                <div key={msg.id} className="msg-hover" style={{marginBottom:4,position:"relative"}}>
                  {msg.role==="user" ? (
                    /* User message — right, rounded pill with slightly lighter dark bg */
                    <div style={{display:"flex",justifyContent:"flex-end",marginBottom:2}}>
                      <div style={{maxWidth:"80%",background:"#2f2f2f",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"18px 18px 4px 18px",padding:"12px 18px",fontSize:15,color:"rgba(255,255,255,0.88)",lineHeight:1.65}}>
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    /* Claude response — left, asterisk avatar */
                    <div style={{display:"flex",gap:14,alignItems:"flex-start",paddingBottom:8}}>
                      <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#cf8f6d,#c47a4a)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2}}>
                        <span style={{color:"white",fontSize:14,lineHeight:1}}>✳</span>
                      </div>
                      <div style={{flex:1,paddingTop:2}}>
                        <div style={{fontSize:15,color:"rgba(255,255,255,0.82)",lineHeight:1.75}}>
                          {msg.content===""&&sending ? (
                            <span style={{display:"flex",gap:5,alignItems:"center",height:26}}>
                              {[0,0.18,0.36].map((d,i)=>(
                                <span key={i} style={{width:7,height:7,borderRadius:"50%",background:"rgba(255,255,255,0.35)",display:"inline-block",animation:`claude-dot 1.2s ease-in-out ${d}s infinite`}}/>
                              ))}
                            </span>
                          ) : (
                            msg.content.split("\n").map((l,i,a)=><span key={i}>{l}{i<a.length-1&&<br/>}</span>)
                          )}
                        </div>
                        {msg.content && (
                          <div style={{display:"flex",alignItems:"center",gap:12,marginTop:8}}>
                            <span style={{fontSize:11,color:"rgba(255,255,255,0.2)"}}>{Math.max(8,Math.floor(msg.content.length/6))} tokens · synced</span>
                            {/* Copy button */}
                            <button style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.2)",display:"flex",padding:"2px",borderRadius:4}}
                              onClick={()=>navigator.clipboard.writeText(msg.content).catch(()=>{})}
                              onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.color="rgba(255,255,255,0.5)"}
                              onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.color="rgba(255,255,255,0.2)"}>
                              <Copy size={12}/>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef}/>
            </div>
          )}
        </div>
      </div>

      {/* Input bar — only shown when there ARE messages (empty state has its own) */}
      {messages.length > 0 && (
        <div style={{padding:"12px 24px 20px",background:"#212121"}}>
          {!claudeKey && (
            <div style={{maxWidth:740,margin:"0 auto 10px",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",borderRadius:12,border:"1px dashed rgba(207,143,109,0.2)",background:"rgba(207,143,109,0.04)"}}>
              <span style={{fontSize:13,color:"rgba(207,143,109,0.65)"}}>Connect your API key for unlimited messages</span>
              <button onClick={onOpenKeyModal} style={{fontSize:12.5,color:"rgba(207,143,109,0.8)",background:"none",border:"1px solid rgba(207,143,109,0.3)",borderRadius:16,padding:"4px 12px",cursor:"pointer",fontWeight:500}}>Connect →</button>
            </div>
          )}
          <div style={{maxWidth:740,margin:"0 auto"}}>
            <div style={{background:"#2f2f2f",borderRadius:20,border:"1px solid rgba(255,255,255,0.1)",boxShadow:"0 4px 24px rgba(0,0,0,0.3)",overflow:"hidden"}}>
              <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={handleKey} disabled={sending} rows={1}
                placeholder="Reply to Claude…"
                style={{width:"100%",background:"transparent",fontSize:15,color:"rgba(255,255,255,0.82)",border:"none",outline:"none",resize:"none",padding:"16px 20px 0",lineHeight:1.6,minHeight:54,maxHeight:220,overflowY:"auto",fontFamily:"inherit",boxSizing:"border-box"}}
                onInput={e=>{const t=e.currentTarget;t.style.height="auto";t.style.height=Math.min(t.scrollHeight,220)+"px";}}
              />
              <div style={{display:"flex",alignItems:"center",padding:"8px 14px 14px",gap:8}}>
                <button style={{width:30,height:30,borderRadius:8,background:"transparent",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,0.3)"}}>
                  <Plus size={16}/>
                </button>
                <div style={{flex:1}}/>
                <span style={{fontSize:12.5,color:"rgba(255,255,255,0.25)",fontWeight:500}}>claude-3-5-haiku</span>
                <ChevronDown size={12} style={{color:"rgba(255,255,255,0.2)"}}/>
                <button style={{width:30,height:30,borderRadius:8,background:"transparent",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,0.3)"}}>
                  <Mic size={14}/>
                </button>
                <button onClick={send} disabled={!input.trim()||sending}
                  style={{width:32,height:32,borderRadius:10,background:input.trim()&&!sending?"linear-gradient(135deg,#cf8f6d,#c47a4a)":"rgba(255,255,255,0.08)",border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:input.trim()&&!sending?"pointer":"not-allowed",transition:"background 0.15s"}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={input.trim()&&!sending?"white":"rgba(255,255,255,0.3)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                </button>
              </div>
            </div>
            <p style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.15)",marginTop:8}}>
              Powered by Claude · Imprint encrypts your memories
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   ROOT APP
══════════════════════════════════════════════ */
function ChatApp() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<View>("home");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [msgCount, setMsgCount] = useState(0);
  const [memories, setMemories] = useState<CapturedMemory[]>([]);
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [userId, setUserId] = useState("");
  const [sessionTitle, setSessionTitle] = useState("New session");
  const [claudeKey, setClaudeKey] = useState("");
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [displayName, setDisplayName] = useState("Yashasvi Daddy");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(()=>{
    const stored=localStorage.getItem("imprint_user_id");
    if(stored){setUserId(stored);}else{const id=crypto.randomUUID();localStorage.setItem("imprint_user_id",id);setUserId(id);}
    const key=localStorage.getItem("imprint_claude_key");
    if(key) setClaudeKey(key);
    const name=localStorage.getItem("imprint_display_name");
    if(name) setDisplayName(name);
  },[]);
  useEffect(()=>{ messagesEndRef.current?.scrollIntoView({behavior:"smooth"}); },[messages,sending]);

  function saveKey(key:string){ setClaudeKey(key); localStorage.setItem("imprint_claude_key",key); setShowKeyModal(false); }
  function startNewChat(title="New session"){ setMessages([]); setSessionTitle(title); setActiveTab("chat"); setView("chat"); }
  function switchTab(tab:Tab){ setActiveTab(tab); setView("chat"); }

  async function send(){
    const text=input.trim(); if(!text||sending)return;
    const userMsg:Message={id:crypto.randomUUID(),role:"user",content:text,timestamp:new Date()};
    setMessages(p=>[...p,userMsg]); setInput(""); setSending(true);
    if(inputRef.current) inputRef.current.style.height="auto";
    const assistantId=crypto.randomUUID();
    setMessages(p=>[...p,{id:assistantId,role:"assistant",content:"",timestamp:new Date()}]);
    try{
      fetch("/api/check",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId,message:text})})
        .then(r=>r.json()).then(d=>{if(d.hasContradiction)setContradictions(p=>[...p,...d.contradictions])}).catch(()=>{});
      const history=[...messages.map(m=>({role:m.role,content:m.content})),{role:"user" as const,content:text}];
      let reply=await streamChatResponse(history,userId,claudeKey,(partial)=>{
        setMessages(p=>p.map(m=>m.id===assistantId?{...m,content:partial}:m));
      });
      if(!reply){reply=mockResponse(text,memories);setMessages(p=>p.map(m=>m.id===assistantId?{...m,content:reply}:m));}
      setMsgCount(c=>c+1);
      fetch("/api/memories",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId,messages:[{role:"user",content:text},{role:"assistant",content:reply}],source:"imprint-chat"})})
        .then(r=>r.json()).then(d=>{if(d.memories?.length)setMemories(p=>[...p,...d.memories]);}).catch(()=>{});
    }catch{
      setMessages(p=>p.map(m=>m.id===assistantId?{...m,content:"Connection error — check your API key or setup."}:m));
    }finally{setSending(false);}
  }

  function handleKey(e:React.KeyboardEvent){ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();} }

  return(
    <div style={{height:"100vh",width:"100vw",display:"flex",overflow:"hidden",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif"}}>

      {showKeyModal && <ApiKeyModal onSave={saveKey} onClose={()=>setShowKeyModal(false)}/>}

      <Sidebar
        view={view} activeTab={activeTab} memories={memories}
        claudeKey={claudeKey} displayName={displayName}
        onNewChat={()=>startNewChat()} onDashboard={()=>setView("home")}
        onSelectHistory={(label)=>{setSessionTitle(label);setMessages([]);setActiveTab("chat");setView("chat");}}
        onTabChange={switchTab} onOpenKeyModal={()=>setShowKeyModal(true)}
      />

      <main style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
        {view==="home" && <Dashboard memories={memories} msgCount={msgCount} claudeKey={claudeKey} onStartChat={()=>startNewChat()} onSelectHistory={(label)=>{setSessionTitle(label);setMessages([]);setActiveTab("chat");setView("chat");}} onTabChange={switchTab} onOpenKeyModal={()=>setShowKeyModal(true)}/>}
        {view==="chat" && activeTab==="memory" && <MemoryView memories={memories} userId={userId}/>}
        {view==="chat" && activeTab==="import" && <ImportView userId={userId} onDone={m=>setMemories(p=>[...p,...m])}/>}
        {view==="chat" && activeTab==="chat" && (
          <ClaudeChat
            messages={messages} sending={sending} input={input} setInput={setInput}
            inputRef={inputRef} send={send} handleKey={handleKey}
            memories={memories} contradictions={contradictions}
            messagesEndRef={messagesEndRef} claudeKey={claudeKey}
            onOpenKeyModal={()=>setShowKeyModal(true)} displayName={displayName}
          />
        )}
      </main>
    </div>
  );
}

export default function ChatPage(){ return <Suspense><ChatApp/></Suspense>; }
