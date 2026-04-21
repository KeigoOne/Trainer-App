import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import { LOGO_B64 } from "./logo";

// ─── MOTIVATIONAL QUOTES ──────────────────────────────────────────────────────
const QUOTES = [
  { text: "Succesul nu vine la tine — tu mergi la el.", author: "Marva Collins" },
  { text: "Corpul tău poate rezista aproape orice. Este mintea ta cea care trebuie convinsă.", author: "" },
  { text: "Nu număra zilele. Fă ca zilele să conteze.", author: "Muhammad Ali" },
  { text: "Durerea pe care o simți azi va fi puterea pe care o vei simți mâine.", author: "" },
  { text: "Un an de acum, vei dori să fi început azi.", author: "" },
  { text: "Fiecare antrenament este un pas mai aproape de versiunea ta cea mai bună.", author: "" },
  { text: "Disciplina este puntea dintre obiective și realizări.", author: "Jim Rohn" },
  { text: "Progresul nu trebuie să fie perfect. Trebuie doar să fie consistent.", author: "" },
  { text: "The body achieves what the mind believes.", author: "" },
  { text: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn" },
  { text: "Sănătatea nu este totul, dar fără sănătate totul este nimic.", author: "" },
  { text: "Fiecare repetare te aduce mai aproape de obiectivul tău.", author: "" },
  { text: "Strong body, strong mind.", author: "" },
  { text: "Motivația te pornește. Obișnuința te menține în mișcare.", author: "" },
  { text: "Fii mai bun decât erai ieri.", author: "" },
];
function getQuote(){ return QUOTES[Math.floor(Math.random()*QUOTES.length)]; }

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const ACCENT = "#00E5A0";
const ACCENT2 = "#FF6B6B";
const BG = "#0D0F14";
const CARD = "#161A23";
const CARD2 = "#1E2330";
const BORDER = "#2A3040";
const TEXT = "#E8ECF4";
const MUTED = "#6B7590";
const MONTH_NAMES = ["Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie","Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie"];
const DAY_NAMES = ["Lu","Ma","Mi","Jo","Vi","Sâ","Du"];
const CLIENT_COLORS = ["#FF6B6B","#FFB74D","#FF8CC8","#74B9FF","#FDCB6E","#E17055","#C084FC","#FB923C","#F472B6","#38BDF8"];
// Fixed semantic colors for event types
const COLOR_SESSION_COMPLETED = "#00E5A0";   // green
const COLOR_SESSION_PLANNED = "#3B82F6";     // blue
const COLOR_BOOKING = "#3B82F6";             // blue
const COLOR_PAYMENT = "#166534";             // dark green
const GENDERS = ["Male","Female","Other"];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
// Sanitize user input — strip HTML tags and trim whitespace
function sanitize(str){ if(!str)return""; return String(str).replace(/<[^>]*>/g,"").trim().substring(0,500); }
// Validate email format
function isValidEmail(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
// Validate password strength
function isStrongPassword(p){ return p&&p.length>=8&&/[A-Z]/.test(p)&&/[0-9]/.test(p); }
function daysUntil(d){if(!d)return null;const n=new Date();n.setHours(0,0,0,0);const t=new Date(d);t.setHours(0,0,0,0);return Math.ceil((t-n)/86400000);}
function formatDate(d){if(!d)return"—";return new Date(d).toLocaleDateString("ro-RO",{day:"2-digit",month:"short",year:"numeric"});}
function formatDateTime(d,t){return d?(t?`${formatDate(d)}, ${t}`:formatDate(d)):"—";}
function addDays(s,n){const d=new Date(s);d.setDate(d.getDate()+n);return d.toISOString().split("T")[0];}
function today(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function nowTime(){const d=new Date();return`${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;}
function getDaysInMonth(y,m){return new Date(y,m+1,0).getDate();}
function getFirstDayOfMonth(y,m){const d=new Date(y,m,1).getDay();return d===0?6:d-1;}
function genderEmoji(g){return g==="Female"?"👩":g==="Male"?"👨":"🧑";}

// Generate a short-lived signed URL for a private photo path
async function getSignedUrl(path) {
  const { data, error } = await supabase.storage
    .from("progress-photos")
    .createSignedUrl(path, 60 * 30); // 30 minutes
  return error ? null : data.signedUrl;
}

// ─── SUPABASE SYNC ────────────────────────────────────────────────────────────
async function syncToSupabaseRaw(prev,next,userId){
  const pm=Object.fromEntries(prev.map(c=>[c.id,c]));
  const nm=Object.fromEntries(next.map(c=>[c.id,c]));
  for(const id of Object.keys(pm)){
    if(!nm[id]){
      const{error}=await supabase.from("clients").delete().eq("id",id).eq("user_id",userId);
      if(error)console.error("Sync delete error:",error.message);
    }
  }
  for(const client of next){
    const p=pm[client.id];
    if(!p||JSON.stringify(p)!==JSON.stringify(client)){
      const{error}=await supabase.from("clients").upsert({
        id:client.id,user_id:userId,
        client_email:client.email||null,
        data:client,
        updated_at:new Date().toISOString()
      });
      if(error)console.error("Sync upsert error for",client.name,":",error.message,error.code);
      else console.log("Synced:",client.name,"history entries:",client.history?.length);
    }
  }
}
function useStorage(user){
  const [clients,setClientsState]=useState([]);
  const [dbLoading,setDbLoading]=useState(true);
  useEffect(()=>{
    if(!user)return;
    supabase.from("clients").select("data").eq("user_id",user.id)
      .then(({data})=>{if(data)setClientsState(data.map(r=>r.data));setDbLoading(false);});
  },[user]);
  const setClients=useCallback((updater)=>{
    setClientsState((prev)=>{
      const next=typeof updater==="function"?updater(prev):updater;
      if(user)syncToSupabaseRaw(prev,next,user.id);
      return next;
    });
  },[user]);
  return[clients,setClients,dbLoading];
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S={
  app:{minHeight:"100vh",background:BG,color:TEXT,fontFamily:"'DM Sans',sans-serif",paddingBottom:40,position:"relative"},
  header:{background:`linear-gradient(135deg,${CARD} 0%,#12161F 100%)`,borderBottom:`1px solid ${BORDER}`,padding:"16px 18px",position:"sticky",top:0,zIndex:200},
  main:{padding:"16px 14px",maxWidth:500,margin:"0 auto"},
  sTitle:{fontSize:11,fontWeight:700,color:MUTED,letterSpacing:"1px",textTransform:"uppercase",marginBottom:10},
  card:{background:CARD,borderRadius:16,padding:15,border:`1px solid ${BORDER}`,marginBottom:10},
  row:{display:"flex",alignItems:"center",gap:8},
  sb:{display:"flex",alignItems:"center",justifyContent:"space-between"},
  avatar:(g)=>({width:42,height:42,borderRadius:11,background:g==="Female"?"linear-gradient(135deg,#FF6B9D,#C44569)":g==="Male"?"linear-gradient(135deg,#4ECDC4,#2980B9)":"linear-gradient(135deg,#A29BFE,#6C5CE7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}),
  badge:(c,bg)=>({display:"inline-flex",alignItems:"center",gap:3,padding:"3px 8px",borderRadius:6,fontSize:11,fontWeight:700,color:c,background:bg}),
  btn:(v)=>({border:"none",cursor:"pointer",borderRadius:10,fontWeight:700,fontSize:14,transition:"all 0.15s",display:"inline-flex",alignItems:"center",gap:6,fontFamily:"'DM Sans',sans-serif",...(v==="primary"?{background:ACCENT,color:"#000",padding:"11px 20px"}:v==="danger"?{background:`${ACCENT2}20`,color:ACCENT2,padding:"8px 14px",fontSize:13}:v==="ghost"?{background:CARD2,color:TEXT,padding:"8px 14px",fontSize:13,border:`1px solid ${BORDER}`}:v==="success"?{background:`${ACCENT}20`,color:ACCENT,padding:"8px 14px",fontSize:13}:v==="icon"?{background:"transparent",color:MUTED,padding:"4px 6px",fontSize:15,border:"none"}:{background:CARD2,color:TEXT,padding:"11px 20px",border:`1px solid ${BORDER}`})}),
  input:{width:"100%",background:CARD2,border:`1px solid ${BORDER}`,borderRadius:10,padding:"11px 14px",color:TEXT,fontSize:16,outline:"none",boxSizing:"border-box",fontFamily:"'DM Sans',sans-serif"},
  label:{fontSize:12,fontWeight:600,color:MUTED,marginBottom:5,display:"block"},
  // CENTERED modal
  modal:{position:"fixed",inset:0,background:"#000000CC",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,backdropFilter:"blur(4px)",padding:16},
  modalBox:{background:CARD,borderRadius:20,padding:"24px 20px 28px",width:"100%",maxWidth:460,border:`1px solid ${BORDER}`,maxHeight:"88vh",overflowY:"auto"},
  divider:{height:1,background:BORDER,margin:"12px 0"},
  statBox:{background:CARD2,borderRadius:10,padding:"9px 6px",textAlign:"center",border:`1px solid ${BORDER}`},
};

// ─── DRAWER ───────────────────────────────────────────────────────────────────
function Drawer({open,onClose,items,onSelect,activeView,user,profile}){
  return(
    <>
      {/* Overlay */}
      {open&&<div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:300,backdropFilter:"blur(2px)"}}/>}
      {/* Panel */}
      <div style={{position:"fixed",top:0,left:0,height:"100%",width:280,background:CARD,borderRight:`1px solid ${BORDER}`,zIndex:301,transform:open?"translateX(0)":"translateX(-100%)",transition:"transform 0.25s cubic-bezier(0.4,0,0.2,1)",display:"flex",flexDirection:"column",fontFamily:"'DM Sans',sans-serif"}}>
        {/* Header */}
        <div style={{padding:"24px 20px 16px",borderBottom:`1px solid ${BORDER}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${ACCENT},#00B87A)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>💪</div>
            <div><div style={{fontSize:16,fontWeight:800,color:TEXT}}>PT Tracker</div><div style={{fontSize:10,color:MUTED,textTransform:"uppercase",letterSpacing:"0.5px"}}>{profile?.role==="trainer"?"Antrenor":profile?.role==="admin"?"Admin":"Client"}</div></div>
          </div>
          {user&&<div style={{fontSize:12,color:MUTED,marginTop:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email}</div>}
        </div>
        {/* Nav items */}
        <div style={{flex:1,padding:"12px 10px",overflowY:"auto"}}>
          {items.map(([view,icon,label])=>(
            <button key={view} onClick={()=>{onSelect(view);onClose();}} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"12px 12px",borderRadius:12,border:"none",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:activeView===view?700:500,background:activeView===view?`${ACCENT}18`:"transparent",color:activeView===view?ACCENT:TEXT,marginBottom:2,transition:"all 0.15s",textAlign:"left"}}>
              <span style={{fontSize:18,width:24,textAlign:"center"}}>{icon}</span>{label}
              {activeView===view&&<div style={{marginLeft:"auto",width:6,height:6,borderRadius:3,background:ACCENT}}/>}
            </button>
          ))}
        </div>
        {/* Logout */}
        <div style={{padding:"12px 10px 32px",borderTop:`1px solid ${BORDER}`}}>
          <button onClick={()=>supabase.auth.signOut()} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"12px 12px",borderRadius:12,border:"none",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:500,background:"transparent",color:ACCENT2,textAlign:"left"}}>
            <span style={{fontSize:18,width:24,textAlign:"center"}}>⏻</span>Deconectare
          </button>
        </div>
      </div>
    </>
  );
}

// ─── MINI CALENDAR ────────────────────────────────────────────────────────────
function MiniCalendar({sessionDates=[],paymentDates=[],bookingDates=[]}){
  const now=new Date();
  const[vy,setVy]=useState(now.getFullYear());
  const[vm,setVm]=useState(now.getMonth());
  const dim=getDaysInMonth(vy,vm),fd=getFirstDayOfMonth(vy,vm),ts=today();
  const ss=new Set(sessionDates.filter(d=>{const[y,m]=d.split("-").map(Number);return y===vy&&m-1===vm;}).map(d=>parseInt(d.split("-")[2])));
  const ps=new Set(paymentDates.filter(d=>{const[y,m]=d.split("-").map(Number);return y===vy&&m-1===vm;}).map(d=>parseInt(d.split("-")[2])));
  const bs=new Set(bookingDates.filter(d=>{if(!d)return false;const[y,m]=d.split("-").map(Number);return y===vy&&m-1===vm;}).map(d=>parseInt(d.split("-")[2])));
  const[ty,tm,td]=ts.split("-").map(Number);const today_d=ty===vy&&tm-1===vm?td:null;
  function prev(){if(vm===0){setVy(y=>y-1);setVm(11);}else setVm(m=>m-1);}
  function next(){if(vm===11){setVy(y=>y+1);setVm(0);}else setVm(m=>m+1);}
  const cells=[];for(let i=0;i<fd;i++)cells.push(null);for(let d=1;d<=dim;d++)cells.push(d);
  return(
    <div style={{background:CARD2,borderRadius:14,padding:14,border:`1px solid ${BORDER}`}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <button onClick={prev} style={{background:"none",border:"none",color:MUTED,cursor:"pointer",fontSize:18,padding:"2px 8px"}}>‹</button>
        <div><div style={{fontSize:14,fontWeight:700,color:TEXT,textAlign:"center"}}>{MONTH_NAMES[vm]} {vy}</div><div style={{fontSize:11,color:MUTED,textAlign:"center"}}>{ss.size} ședințe luna · {sessionDates.length} total</div></div>
        <button onClick={next} style={{background:"none",border:"none",color:MUTED,cursor:"pointer",fontSize:18,padding:"2px 8px"}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>{DAY_NAMES.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:MUTED,padding:"2px 0"}}>{d}</div>)}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {cells.map((day,i)=>{
          if(!day)return<div key={`e${i}`}/>;
          const isSess=ss.has(day),isPay=ps.has(day),isBook=bs.has(day),isToday=day===today_d;
          const daybg=isSess?`${COLOR_SESSION_COMPLETED}22`:isBook?`${COLOR_BOOKING}18`:isPay?`${COLOR_PAYMENT}22`:"transparent";
          const dayborder=isToday?`1.5px solid ${ACCENT}`:isSess?`1px solid ${COLOR_SESSION_COMPLETED}50`:isBook?`1px solid ${COLOR_BOOKING}50`:isPay?`1px solid ${COLOR_PAYMENT}50`:"1px solid transparent";
          const daycolor=isSess?COLOR_SESSION_COMPLETED:isBook?COLOR_BOOKING:isPay?COLOR_PAYMENT:isToday?ACCENT:MUTED;
          return(<div key={day} style={{textAlign:"center",borderRadius:7,padding:"5px 1px",background:daybg,border:dayborder}}>
            <div style={{fontSize:12,fontWeight:isSess||isPay||isBook?700:400,color:daycolor}}>{day}</div>
            {(isSess||isPay||isBook)&&<div style={{width:4,height:4,borderRadius:"50%",background:isSess?COLOR_SESSION_COMPLETED:isBook?COLOR_BOOKING:COLOR_PAYMENT,margin:"1px auto 0"}}/>}
          </div>);
        })}
      </div>
      <div style={{display:"flex",gap:10,marginTop:10,paddingTop:8,borderTop:`1px solid ${BORDER}`,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:MUTED}}><div style={{width:8,height:8,borderRadius:"50%",background:COLOR_SESSION_COMPLETED}}/>Completat</div>
        <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:MUTED}}><div style={{width:8,height:8,borderRadius:"50%",background:COLOR_BOOKING}}/>Rezervare</div>
        <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:MUTED}}><div style={{width:8,height:8,borderRadius:"50%",background:COLOR_PAYMENT}}/>Plată</div>
      </div>
    </div>
  );
}

// ─── GLOBAL CALENDAR ─────────────────────────────────────────────────────────
function GlobalCalendar({clients,bookings=[],onQuickAddSession}){
  const now=new Date();
  const[vy,setVy]=useState(now.getFullYear());
  const[vm,setVm]=useState(now.getMonth());
  const[selDay,setSelDay]=useState(null);
  const dim=getDaysInMonth(vy,vm),fd=getFirstDayOfMonth(vy,vm),ts=today();
  const dayMap={};
  clients.forEach((c,ci)=>{
    const color=CLIENT_COLORS[ci%CLIENT_COLORS.length];
    (c.history||[]).forEach(h=>{const[y,m,d]=h.date.split("-").map(Number);if(y===vy&&m-1===vm){if(!dayMap[d])dayMap[d]=[];dayMap[d].push({clientName:c.name,color,type:h.type,sessionPrice:c.sessionPrice,amount:h.amount,time:h.time,completed:h.completed});}});
  });
  // Add bookings from booking system
  bookings.forEach(b=>{
    if(!b.booking_date)return;
    const[y,m,d]=b.booking_date.split("-").map(Number);
    if(y===vy&&m-1===vm){
      if(!dayMap[d])dayMap[d]=[];
      dayMap[d].push({clientName:b.client_name,color:COLOR_BOOKING,type:"booking",time:b.time_slots?.start_time||"",completed:false});
    }
  });
  const[ty,tm,td]=ts.split("-").map(Number);const today_d=ty===vy&&tm-1===vm?td:null;
  function prev(){if(vm===0){setVy(y=>y-1);setVm(11);}else setVm(m=>m-1);}
  function next(){if(vm===11){setVy(y=>y+1);setVm(0);}else setVm(m=>m+1);}
  const cells=[];for(let i=0;i<fd;i++)cells.push(null);for(let d=1;d<=dim;d++)cells.push(d);
  const monthSessions=Object.values(dayMap).flat().filter(e=>e.type==="session").length;
  const monthIncome=clients.flatMap(c=>(c.history||[]).filter(h=>{const[y,m]=h.date.split("-").map(Number);return y===vy&&m-1===vm&&h.type==="payment";}).map(h=>Number(h.amount||0))).reduce((a,b)=>a+b,0);
  const selEvents=selDay?(dayMap[selDay]||[]).slice().sort((a,b)=>(a.time||"00:00").localeCompare(b.time||"00:00")):[];
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div style={{background:`${ACCENT}15`,border:`1px solid ${ACCENT}40`,borderRadius:12,padding:"12px 14px"}}><div style={{fontSize:22,fontWeight:900,color:ACCENT}}>{monthSessions}</div><div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase"}}>Antrenamente luna</div></div>
        <div style={{background:"#A29BFE15",border:"1px solid #A29BFE40",borderRadius:12,padding:"12px 14px"}}><div style={{fontSize:22,fontWeight:900,color:"#A29BFE"}}>{monthIncome} RON</div><div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase"}}>Plăți luna</div></div>
      </div>
      <div style={{background:CARD2,borderRadius:14,padding:14,border:`1px solid ${BORDER}`,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <button onClick={prev} style={{background:"none",border:"none",color:MUTED,cursor:"pointer",fontSize:20,padding:"2px 8px"}}>‹</button>
          <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{fontSize:15,fontWeight:800,color:TEXT}}>{MONTH_NAMES[vm]} {vy}</div><button onClick={()=>onQuickAddSession&&onQuickAddSession(selDay?`${vy}-${String(vm+1).padStart(2,"0")}-${String(selDay).padStart(2,"0")}`:null)} style={{background:`${ACCENT}20`,border:`1px solid ${ACCENT}40`,borderRadius:8,padding:"3px 10px",color:ACCENT,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>+ Ședință</button></div>
          <button onClick={next} style={{background:"none",border:"none",color:MUTED,cursor:"pointer",fontSize:20,padding:"2px 8px"}}>›</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:6}}>{DAY_NAMES.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:MUTED}}>{d}</div>)}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
          {cells.map((day,i)=>{
            if(!day)return<div key={`e${i}`}/>;
            const events=dayMap[day]||[],isToday=day===today_d,isSel=day===selDay;
            return(<div key={day} onClick={()=>setSelDay(day===selDay?null:day)} style={{borderRadius:8,padding:"6px 2px 4px",cursor:events.length>0||isToday?"pointer":"default",background:isSel?`${ACCENT}20`:isToday?`${ACCENT}0D`:events.length>0?CARD:"transparent",border:isSel?`1.5px solid ${ACCENT}`:isToday?`1px solid ${ACCENT}60`:events.length>0?`1px solid ${BORDER}`:"1px solid transparent",transition:"all 0.1s"}}>
              <div style={{textAlign:"center",fontSize:12,fontWeight:events.length>0?700:400,color:isToday?ACCENT:events.length>0?TEXT:MUTED}}>{day}</div>
              <div style={{display:"flex",justifyContent:"center",flexWrap:"wrap",gap:2,marginTop:3,minHeight:7}}>{events.slice(0,4).map((e,di)=><div key={di} style={{width:5,height:5,borderRadius:"50%",background:e.type==="payment"?COLOR_PAYMENT:e.type==="booking"?COLOR_BOOKING:e.completed===false?COLOR_SESSION_PLANNED:e.type==="session"?COLOR_SESSION_COMPLETED:e.color}}/>)}</div>
            </div>);
          })}
        </div>
      </div>
      {selDay&&(
        <div style={{background:CARD,borderRadius:14,padding:16,border:`1px solid ${BORDER}`,marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:700,color:MUTED,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.5px"}}>{selDay} {MONTH_NAMES[vm]} {vy}</div>
          {selEvents.length===0?<div style={{color:MUTED,fontSize:14}}>Nicio activitate în această zi</div>
            :selEvents.map((e,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 0",borderBottom:i<selEvents.length-1?`1px solid ${BORDER}`:"none"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:10,height:10,borderRadius:"50%",background:e.type==="payment"?"#A29BFE":e.color,flexShrink:0}}/><div><div style={{fontSize:14,fontWeight:600}}>{e.clientName}</div><div style={{fontSize:11,color:MUTED}}>{e.type==="session"?(e.completed===false?"📅 Planificat":"🏋️ Antrenament"):e.type==="booking"?"🗓 Rezervare":"💳 Plată"}{e.time?` · ${e.time}`:""}</div></div></div>
                {e.type==="session"&&e.sessionPrice>0&&<span style={{fontSize:13,fontWeight:700,color:e.color}}>{e.sessionPrice} RON</span>}
                {e.type==="payment"&&<span style={{fontSize:13,fontWeight:700,color:"#A29BFE"}}>{e.amount} RON</span>}
              </div>
            ))}
        </div>
      )}
      <div style={{display:"flex",gap:10,marginTop:14,paddingTop:10,borderTop:`1px solid ${BORDER}`,flexWrap:"wrap"}}>
    <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:MUTED}}><div style={{width:8,height:8,borderRadius:"50%",background:COLOR_SESSION_COMPLETED}}/>Completat</div>
    <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:MUTED}}><div style={{width:8,height:8,borderRadius:"50%",background:COLOR_SESSION_PLANNED}}/>Planificat</div>
    <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:MUTED}}><div style={{width:8,height:8,borderRadius:"50%",background:COLOR_BOOKING}}/>Rezervare</div>
    <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:MUTED}}><div style={{width:8,height:8,borderRadius:"50%",background:COLOR_PAYMENT}}/>Plată</div>
  </div>
  {clients.length>0&&(<><div style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"1px",marginBottom:8,marginTop:14}}>Clienți</div><div style={{display:"flex",flexWrap:"wrap",gap:7}}>{clients.map((c,ci)=>(<div key={c.id} style={{display:"flex",alignItems:"center",gap:5,background:CARD2,borderRadius:8,padding:"5px 10px",border:`1px solid ${BORDER}`}}><div style={{width:8,height:8,borderRadius:"50%",background:CLIENT_COLORS[ci%CLIENT_COLORS.length]}}/><span style={{fontSize:12,fontWeight:600}}>{c.name}</span></div>))}</div></>)}
    </div>
  );
}

// ─── MEASUREMENTS ─────────────────────────────────────────────────────────────
function MeasurementsSection({clientId,readOnly=false}){
  const[measurements,setMeasurements]=useState([]);
  const[loading,setLoading]=useState(true);
  const[showForm,setShowForm]=useState(false);
  const[form,setForm]=useState({date:today(),weight:"",arms:"",hips:"",legs:"",notes:""});
  const[saving,setSaving]=useState(false);
  useEffect(()=>{supabase.from("measurements").select("*").eq("client_id",clientId).order("date",{ascending:false}).then(({data})=>{if(data)setMeasurements(data);setLoading(false);});},[clientId]);
  async function save(){
    setSaving(true);
    const{data,error}=await supabase.from("measurements").insert({client_id:clientId,date:form.date,weight:form.weight?Number(form.weight):null,arms:form.arms?Number(form.arms):null,hips:form.hips?Number(form.hips):null,legs:form.legs?Number(form.legs):null,notes:form.notes||null}).select().single();
    if(!error&&data){setMeasurements(p=>[data,...p]);setShowForm(false);setForm({date:today(),weight:"",arms:"",hips:"",legs:"",notes:""});}
    setSaving(false);
  }
  async function del(id){await supabase.from("measurements").delete().eq("id",id);setMeasurements(p=>p.filter(m=>m.id!==id));}
  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <div style={S.sTitle}>📏 Măsurători</div>
        {!readOnly&&<button style={S.btn("success")} onClick={()=>setShowForm(true)}>+ Adaugă</button>}
      </div>
      {loading?<div style={{color:MUTED,fontSize:13}}>Se încarcă...</div>:measurements.length===0?<div style={{color:MUTED,fontSize:13,padding:"10px 0"}}>Nicio măsurătoare încă</div>:
        measurements.map(m=>(
          <div key={m.id} style={{...S.card,padding:"12px 14px",marginBottom:8}}>
            <div style={S.sb}><div style={{fontSize:12,fontWeight:700,color:MUTED}}>{formatDate(m.date)}</div>{!readOnly&&<button style={{...S.btn("icon"),color:ACCENT2}} onClick={()=>del(m.id)}>✕</button>}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
              {[["⚖️ Greutate",m.weight,"kg"],["💪 Brațe",m.arms,"cm"],["🫀 Șolduri",m.hips,"cm"],["🦵 Picioare",m.legs,"cm"]].map(([label,val,unit])=>val!=null&&(
                <div key={label} style={{background:CARD2,borderRadius:8,padding:"8px 10px"}}><div style={{fontSize:11,color:MUTED,fontWeight:600}}>{label}</div><div style={{fontSize:16,fontWeight:800,color:ACCENT,marginTop:2}}>{val} <span style={{fontSize:11,color:MUTED}}>{unit}</span></div></div>
              ))}
            </div>
            {m.notes&&<div style={{fontSize:12,color:MUTED,marginTop:8,fontStyle:"italic"}}>"{m.notes}"</div>}
          </div>
        ))
      }
      {showForm&&(
        <div style={S.modal} onClick={()=>setShowForm(false)}>
          <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>📏 Măsurătoare nouă</div>
            <label style={S.label}>Data</label>
            <input type="date" style={{...S.input,marginBottom:12,colorScheme:"dark"}} value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              {[["weight","⚖️ Greutate (kg)"],["arms","💪 Brațe (cm)"],["hips","🫀 Șolduri (cm)"],["legs","🦵 Picioare (cm)"]].map(([key,label])=>(
                <div key={key}><label style={S.label}>{label}</label><input style={S.input} type="number" placeholder="0" value={form[key]} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}/></div>
              ))}
            </div>
            <label style={S.label}>Note</label>
            <input style={{...S.input,marginBottom:18}} placeholder="Observații..." value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}/>
            <div style={{display:"flex",gap:8}}><button style={{...S.btn(),flex:1}} onClick={()=>setShowForm(false)}>Anulează</button><button style={{...S.btn("primary"),flex:2}} onClick={save} disabled={saving}>{saving?"Se salvează...":"✅ Salvează"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── SIGNED PHOTO COMPONENTS ──────────────────────────────────────────────────
function SignedPhotoThumb({photo, onClick}) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    getSignedUrl(photo.path).then(setUrl);
  }, [photo.path]);
  return (
    <div style={{position:"relative",borderRadius:10,overflow:"hidden",border:`1px solid ${BORDER}`,cursor:"pointer",background:CARD2,aspectRatio:"1"}} onClick={onClick}>
      {url
        ? <img src={url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
        : <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>⏳</div>
      }
      <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(transparent,rgba(0,0,0,0.7))",padding:"6px 4px 4px",fontSize:10,color:"#fff",fontWeight:600,textAlign:"center"}}>{formatDate(photo.date)}</div>
    </div>
  );
}

function SignedPhotoFull({path}) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    getSignedUrl(path).then(setUrl);
  }, [path]);
  if (!url) return <div style={{textAlign:"center",padding:24,color:MUTED,fontSize:13}}>Se încarcă...</div>;
  return <img src={url} alt="" style={{width:"100%",borderRadius:12,marginTop:12,objectFit:"contain",maxHeight:400}}/>;
}

// ─── PROGRESS PHOTOS ──────────────────────────────────────────────────────────
function ProgressPhotosSection({clientId,readOnly=false}){
  const[photos,setPhotos]=useState([]);
  const[loading,setLoading]=useState(true);
  const[uploading,setUploading]=useState(false);
  const[viewPhoto,setViewPhoto]=useState(null);
  const[photoDate,setPhotoDate]=useState(today());
  const[showDatePick,setShowDatePick]=useState(false);
  const fileRef=useRef();
  useEffect(()=>{supabase.from("progress_photos").select("*").eq("client_id",clientId).order("date",{ascending:false}).then(({data})=>{if(data)setPhotos(data);setLoading(false);});},[clientId]);
  async function handleFile(e){
    const file=e.target.files[0];if(!file)return;
    setUploading(true);
    try{
      const ext=file.name.split(".").pop();
      const path=`${clientId}/${Date.now()}.${ext}`;
      const{error:upErr}=await supabase.storage.from("progress-photos").upload(path,file,{upsert:true});
      if(upErr)throw upErr;
      // Store only the path — signed URL generated at display time
      const{data,error:dbErr}=await supabase.from("progress_photos").insert({client_id:clientId,date:photoDate,photo_url:"",path}).select().single();
      if(!dbErr&&data)setPhotos(p=>[data,...p]);
    }catch(err){alert("Eroare: "+err.message);}
    setUploading(false);setShowDatePick(false);e.target.value="";
  }
  async function del(photo){
    await supabase.storage.from("progress-photos").remove([photo.path]);
    await supabase.from("progress_photos").delete().eq("id",photo.id);
    setPhotos(p=>p.filter(x=>x.id!==photo.id));
  }
  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <div style={S.sTitle}>📸 Poze progres</div>
        {!readOnly&&<button style={S.btn("success")} onClick={()=>setShowDatePick(true)}>+ Adaugă</button>}
      </div>
      {loading?<div style={{color:MUTED,fontSize:13}}>Se încarcă...</div>:photos.length===0?<div style={{color:MUTED,fontSize:13,padding:"10px 0"}}>Nicio poză încă</div>:
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
          {photos.map(p=>(
            <SignedPhotoThumb key={p.id} photo={p} onClick={()=>setViewPhoto(p)}/>
          ))}
        </div>
      }
      {showDatePick&&(
        <div style={S.modal} onClick={()=>setShowDatePick(false)}>
          <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>📸 Adaugă poză</div>
            <label style={S.label}>Data pozei</label>
            <input type="date" style={{...S.input,marginBottom:18,colorScheme:"dark"}} value={photoDate} onChange={e=>setPhotoDate(e.target.value)}/>
            <input type="file" accept="image/*" ref={fileRef} style={{display:"none"}} onChange={handleFile}/>
            <button style={{...S.btn("primary"),width:"100%",justifyContent:"center"}} onClick={()=>fileRef.current.click()} disabled={uploading}>{uploading?"Se încarcă...":"📷 Alege o poză"}</button>
            <button style={{...S.btn(),width:"100%",justifyContent:"center",marginTop:8}} onClick={()=>setShowDatePick(false)}>Anulează</button>
          </div>
        </div>
      )}
      {viewPhoto&&(
        <div style={{...S.modal}} onClick={()=>setViewPhoto(null)}>
          <div style={{background:CARD,borderRadius:20,padding:16,width:"100%",maxWidth:400}} onClick={e=>e.stopPropagation()}>
            <div style={S.sb}><div style={{fontSize:14,fontWeight:700}}>{formatDate(viewPhoto.date)}</div>{!readOnly&&<button style={{...S.btn("danger"),padding:"6px 12px",fontSize:12}} onClick={()=>{del(viewPhoto);setViewPhoto(null);}}>🗑 Șterge</button>}</div>
            <SignedPhotoFull path={viewPhoto.path}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PROFILE VIEW ─────────────────────────────────────────────────────────────
function ProfileView({user,profile,setProfile}){
  const[name,setName]=useState(profile?.name||"");
  const[dob,setDob]=useState(profile?.date_of_birth||"");
  const[joinCode,setJoinCode]=useState(profile?.join_code||"");
  const[editCode,setEditCode]=useState(false);
  const[newCode,setNewCode]=useState(profile?.join_code||"");
  const[saving,setSaving]=useState(false);
  const[msg,setMsg]=useState("");

  async function saveProfile(){
    setSaving(true);setMsg("");
    const{error}=await supabase.from("profiles").update({name,date_of_birth:dob||null}).eq("id",user.id);
    if(!error){setProfile(p=>({...p,name,date_of_birth:dob}));setMsg("Salvat cu succes!");}
    else setMsg("Eroare la salvare.");
    setSaving(false);
    setTimeout(()=>setMsg(""),3000);
  }

  async function saveCode(){
    if(!newCode.trim()){setMsg("Codul nu poate fi gol.");return;}
    const code=newCode.trim().toUpperCase();
    setSaving(true);setMsg("");
    const{error}=await supabase.from("profiles").update({join_code:code}).eq("id",user.id);
    if(!error){setJoinCode(code);setProfile(p=>({...p,join_code:code}));setEditCode(false);setMsg("Cod actualizat! Clienții existenți rămân conectați.");}
    else setMsg("Eroare — codul poate fi deja folosit.");
    setSaving(false);
    setTimeout(()=>setMsg(""),4000);
  }

  return(
    <div>
      <div style={S.sTitle}>Profilul meu</div>

      {/* Account type badge */}
      <div style={{...S.card,marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:52,height:52,borderRadius:14,background:`linear-gradient(135deg,${ACCENT},#00B87A)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>{profile?.role==="trainer"?"🏋️":profile?.role==="admin"?"👑":"🏃"}</div>
          <div>
            <div style={{fontSize:17,fontWeight:800}}>{profile?.name||user?.email}</div>
            <div style={{fontSize:12,color:MUTED,marginTop:2}}>{user?.email}</div>
            <span style={{...S.badge(profile?.role==="trainer"?ACCENT:profile?.role==="admin"?"#FFB74D":"#A29BFE",profile?.role==="trainer"?`${ACCENT}20`:profile?.role==="admin"?"#FFB74D20":"#A29BFE20"),marginTop:6,display:"inline-flex"}}>{profile?.role==="trainer"?"🏋️ Antrenor":profile?.role==="admin"?"👑 Admin":"🏃 Client"}</span>
          </div>
        </div>
      </div>

      {/* Personal info */}
      <div style={S.card}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:14}}>Informații personale</div>
        <label style={S.label}>Nume complet</label>
        <input style={{...S.input,marginBottom:12}} value={name} onChange={e=>setName(e.target.value)} placeholder="Numele tău"/>
        <label style={S.label}>Email</label>
        <input style={{...S.input,marginBottom:12,opacity:0.6}} value={user?.email||""} disabled/>
        <label style={S.label}>Data nașterii</label>
        <input type="date" style={{...S.input,marginBottom:16,colorScheme:"dark"}} value={dob} onChange={e=>setDob(e.target.value)}/>
        <button style={{...S.btn("primary"),width:"100%",justifyContent:"center"}} onClick={saveProfile} disabled={saving}>{saving?"Se salvează...":"💾 Salvează"}</button>
      </div>

      {/* Trainer join code section */}
      {(profile?.role==="trainer"||profile?.role==="admin")&&(
        <div style={S.card}>
          <div style={{fontSize:14,fontWeight:700,marginBottom:6}}>Codul tău de antrenor</div>
          <div style={{fontSize:12,color:MUTED,marginBottom:14}}>Oferă acest cod clienților tăi la înregistrare. Poți schimba codul oricând — clienții existenți rămân conectați.</div>
          {!editCode?(
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,background:CARD2,borderRadius:12,padding:"14px 16px",border:`1px solid ${BORDER}`,marginBottom:12}}>
                <div style={{fontSize:24,fontWeight:900,color:ACCENT,letterSpacing:"0.15em",flex:1}}>{joinCode}</div>
                <button style={S.btn("ghost")} onClick={()=>{setNewCode(joinCode);setEditCode(true);}}>✏️ Schimbă</button>
              </div>
              <div style={{fontSize:11,color:MUTED}}>💡 Trimite acest cod clienților tăi pentru a se înregistra.</div>
            </div>
          ):(
            <div>
              <label style={S.label}>Cod nou (6 caractere)</label>
              <input style={{...S.input,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.1em"}} maxLength={10} value={newCode} onChange={e=>setNewCode(e.target.value.toUpperCase())} placeholder="ex. ABC123"/>
              <div style={{display:"flex",gap:8}}>
                <button style={{...S.btn(),flex:1}} onClick={()=>setEditCode(false)}>Anulează</button>
                <button style={{...S.btn("primary"),flex:2}} onClick={saveCode} disabled={saving}>{saving?"Se salvează...":"✅ Salvează codul"}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {msg&&<div style={{background:msg.includes("Eroare")?`${ACCENT2}15`:`${ACCENT}15`,border:`1px solid ${msg.includes("Eroare")?ACCENT2:ACCENT}40`,borderRadius:10,padding:"10px 14px",fontSize:13,color:msg.includes("Eroare")?ACCENT2:ACCENT,marginTop:10}}>{msg}</div>}
    </div>
  );
}



// ─── CLIENT BOOKINGS SECTION (shown in client detail) ─────────────────────────
function ClientBookingsSection({clientId, trainerId}){
  const[bookings,setBookings]=useState([]);
  const[loading,setLoading]=useState(true);
  const[clientUserId,setClientUserId]=useState(null);

  useEffect(()=>{
    async function load(){
      const{data:cData}=await supabase.from("clients").select("client_user_id").eq("id",clientId).single();
      if(!cData?.client_user_id){setLoading(false);return;}
      setClientUserId(cData.client_user_id);
      const{data:b}=await supabase.from("bookings")
        .select("*,time_slots(start_time,end_time,day_of_week,repeat,specific_date)")
        .eq("client_id",cData.client_user_id)
        .eq("trainer_id",trainerId)
        .eq("status","confirmed")
        .order("booking_date",{ascending:true});
      if(b)setBookings(b);
      setLoading(false);
    }
    load();
  },[clientId,trainerId]);

  async function cancelBooking(id){
    await supabase.from("bookings").update({status:"cancelled"}).eq("id",id);
    setBookings(p=>p.filter(b=>b.id!==id));
  }

  if(loading) return <div style={{color:MUTED,fontSize:13,padding:"8px 0"}}>Se încarcă rezervările...</div>;
  if(!clientUserId) return <div style={{color:MUTED,fontSize:13,padding:"8px 0"}}>Clientul nu are cont legat — rezervările nu sunt disponibile.</div>;
  if(bookings.length===0) return <div style={{color:MUTED,fontSize:13,padding:"8px 0"}}>Nicio rezervare activă.</div>;

  return(
    <>
      {bookings.map(b=>{
        const slot=b.time_slots;
        const dayLabel=slot?.repeat?DAYS_RO[slot.day_of_week]:slot?.specific_date||"";
        const isPast=b.booking_date<today();
        return(
          <div key={b.id} style={{...S.card,padding:"11px 14px",marginBottom:7,border:`1px solid ${COLOR_BOOKING}30`}}>
            <div style={S.sb}>
              <div style={S.row}>
                <span style={{fontSize:17}}>🗓</span>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:COLOR_BOOKING}}>{b.booking_date} · {slot?.start_time||""}–{slot?.end_time||""}</div>
                  <div style={{fontSize:11,color:MUTED}}>{dayLabel} · {b.client_name}</div>
                </div>
              </div>
              <div style={S.row}>
                {isPast
                  ?<span style={S.badge(MUTED,CARD2)}>Trecut</span>
                  :<button style={{...S.btn("danger"),padding:"5px 10px",fontSize:12}} onClick={()=>cancelBooking(b.id)}>✕ Anulează</button>
                }
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ─── QUICK SESSION MODAL ──────────────────────────────────────────────────────
function QuickSessionModal({clients,initialDate,onClose,onConfirm}){
  const[qClient,setQClient]=useState("");
  const[qDate,setQDate]=useState(initialDate||today());
  const[qTime,setQTime]=useState(nowTime());
  return(
    <div style={S.modal} onClick={onClose}>
      <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>⚡ Adaugă ședință rapidă</div>
        <label style={S.label}>Client</label>
        <select style={{...S.input,marginBottom:12,appearance:"none"}} value={qClient} onChange={e=>setQClient(e.target.value)}>
          <option value="">Alege client...</option>
          {clients.map(c=><option key={c.id} value={c.id}>{c.name} ({c.sessionsLeft??0} rămase)</option>)}
        </select>
        <label style={S.label}>📅 Data</label>
        <input type="date" style={{...S.input,marginBottom:12,colorScheme:"dark"}} value={qDate} onChange={e=>setQDate(e.target.value)}/>
        <label style={S.label}>🕐 Ora</label>
        <input type="time" style={{...S.input,marginBottom:18,colorScheme:"dark"}} value={qTime} onChange={e=>setQTime(e.target.value)}/>
        <div style={{display:"flex",gap:8}}>
          <button style={{...S.btn(),flex:1}} onClick={onClose}>Anulează</button>
          <button style={{...S.btn("primary"),flex:2}} disabled={!qClient||!qDate} onClick={()=>onConfirm(qClient,qDate,qTime)}>✅ Confirmă</button>
        </div>
      </div>
    </div>
  );
}


// ─── BOOKING SYSTEM ───────────────────────────────────────────────────────────
const DAYS_RO = ["Duminică","Luni","Marți","Miercuri","Joi","Vineri","Sâmbătă"];

// Trainer: manage time slots
function TrainerBookingView({user}){
  const[slots,setSlots]=useState([]);
  const[bookings,setBookings]=useState([]);
  const[loading,setLoading]=useState(true);
  const[showAdd,setShowAdd]=useState(false);
  const[form,setForm]=useState({day_of_week:"1",start_time:"09:00",end_time:"10:00",max_bookings:1,repeat:true,specific_date:""});

  useEffect(()=>{
    Promise.all([
      supabase.from("time_slots").select("*").eq("trainer_id",user.id).order("day_of_week").order("start_time"),
      supabase.from("bookings").select("*,time_slots(start_time,end_time,day_of_week)").eq("trainer_id",user.id).eq("status","confirmed")
    ]).then(([{data:s},{data:b}])=>{
      if(s)setSlots(s);
      if(b)setBookings(b);
      setLoading(false);
    });
  },[user.id]);

  async function addSlot(){
    const{data,error}=await supabase.from("time_slots").insert({
      trainer_id:user.id,
      day_of_week:form.repeat?Number(form.day_of_week):null,
      specific_date:form.repeat?null:form.specific_date||null,
      start_time:form.start_time,
      end_time:form.end_time,
      max_bookings:Number(form.max_bookings),
      repeat:form.repeat
    }).select().single();
    if(!error&&data){setSlots(p=>[...p,data]);setShowAdd(false);}
  }

  async function deleteSlot(id){
    await supabase.from("time_slots").delete().eq("id",id);
    setSlots(p=>p.filter(s=>s.id!==id));
  }

  const slotBookings=(slotId)=>bookings.filter(b=>b.slot_id===slotId);

  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <div style={S.sTitle}>🗓 Sloturi de rezervare</div>
        <button style={S.btn("success")} onClick={()=>setShowAdd(true)}>+ Adaugă</button>
      </div>
      {loading?<div style={{color:MUTED,fontSize:13}}>Se încarcă...</div>:
        slots.length===0?<div style={{...S.card,color:MUTED,fontSize:13}}>Niciun slot definit încă</div>:
        slots.map(slot=>{
          const booked=slotBookings(slot.id);
          const spotsLeft=slot.max_bookings-booked.length;
          return(
            <div key={slot.id} style={{...S.card,marginBottom:8}}>
              <div style={S.sb}>
                <div>
                  <div style={{fontSize:14,fontWeight:700}}>{slot.repeat?DAYS_RO[slot.day_of_week]:slot.specific_date} · {slot.start_time}–{slot.end_time}</div>
                  <div style={{fontSize:12,color:MUTED,marginTop:2}}>{slot.repeat?"Recurent săptămânal":"O singură dată"}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={S.badge(spotsLeft>0?ACCENT:ACCENT2,spotsLeft>0?`${ACCENT}20`:`${ACCENT2}20`)}>{booked.length}/{slot.max_bookings}</span>
                  <button style={{...S.btn("icon"),color:ACCENT2}} onClick={()=>deleteSlot(slot.id)}>✕</button>
                </div>
              </div>
              {booked.length>0&&(
                <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${BORDER}`}}>
                  {booked.map(b=>(
                    <div key={b.id} style={{fontSize:12,color:MUTED,display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                      <span style={{color:ACCENT}}>✓</span>{b.client_name} {b.booking_date&&`· ${b.booking_date}`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      }

      {showAdd&&(
        <div style={S.modal} onClick={()=>setShowAdd(false)}>
          <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>🗓 Slot nou</div>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              {[[true,"🔁 Recurent"],[false,"📅 O dată"]].map(([val,label])=>(
                <button key={String(val)} onClick={()=>setForm(p=>({...p,repeat:val}))} style={{flex:1,padding:"9px",borderRadius:10,border:`2px solid ${form.repeat===val?ACCENT:BORDER}`,background:form.repeat===val?`${ACCENT}15`:CARD2,color:form.repeat===val?ACCENT:MUTED,fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:700,cursor:"pointer"}}>{label}</button>
              ))}
            </div>
            {form.repeat?(
              <><label style={S.label}>Ziua săptămânii</label>
              <select style={{...S.input,marginBottom:12,appearance:"none"}} value={form.day_of_week} onChange={e=>setForm(p=>({...p,day_of_week:e.target.value}))}>
                {DAYS_RO.map((d,i)=><option key={i} value={i}>{d}</option>)}
              </select></>
            ):(
              <><label style={S.label}>Data specifică</label>
              <input type="date" style={{...S.input,marginBottom:12,colorScheme:"dark"}} value={form.specific_date} onChange={e=>setForm(p=>({...p,specific_date:e.target.value}))}/></>
            )}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              <div><label style={S.label}>Ora start</label><input type="time" style={{...S.input,colorScheme:"dark"}} value={form.start_time} onChange={e=>setForm(p=>({...p,start_time:e.target.value}))}/></div>
              <div><label style={S.label}>Ora final</label><input type="time" style={{...S.input,colorScheme:"dark"}} value={form.end_time} onChange={e=>setForm(p=>({...p,end_time:e.target.value}))}/></div>
            </div>
            <label style={S.label}>Locuri disponibile</label>
            <input type="number" style={{...S.input,marginBottom:18}} min="1" value={form.max_bookings} onChange={e=>setForm(p=>({...p,max_bookings:e.target.value}))}/>
            <div style={{display:"flex",gap:8}}>
              <button style={{...S.btn(),flex:1}} onClick={()=>setShowAdd(false)}>Anulează</button>
              <button style={{...S.btn("primary"),flex:2}} onClick={addSlot}>✅ Salvează slot</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Client: view and book slots
function ClientBookingView({user,trainerId,clientName}){
  const[slots,setSlots]=useState([]);
  const[myBookings,setMyBookings]=useState([]);
  const[slotCounts,setSlotCounts]=useState({}); // {slotId_date: count}
  const[loading,setLoading]=useState(true);
  const[booking,setBooking]=useState(null);
  const[bookingDate,setBookingDate]=useState("");
  const[msg,setMsg]=useState("");

  useEffect(()=>{
    async function load(){
      const[{data:s},{data:b},{data:counts}]=await Promise.all([
        supabase.from("time_slots").select("*").eq("trainer_id",trainerId).order("day_of_week").order("start_time"),
        supabase.from("bookings").select("*").eq("client_id",user.id).eq("status","confirmed"),
        // Get all confirmed bookings per slot+date for this trainer
        supabase.from("bookings").select("slot_id,booking_date").eq("trainer_id",trainerId).eq("status","confirmed")
      ]);
      if(s)setSlots(s);
      if(b)setMyBookings(b);
      // Build count map: {slotId_date: count}
      if(counts){
        const map={};
        counts.forEach(c=>{
          const key=`${c.slot_id}_${c.booking_date}`;
          map[key]=(map[key]||0)+1;
        });
        setSlotCounts(map);
      }
      setLoading(false);
    }
    load();
  },[trainerId,user.id]);

  function getNextDate(dayOfWeek){
    const t=new Date();
    const diff=(Number(dayOfWeek)-t.getDay()+7)%7||7;
    const next=new Date(t);
    next.setDate(t.getDate()+diff);
    return`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,"0")}-${String(next.getDate()).padStart(2,"0")}`;
  }

  function spotsLeftForDate(slot,date){
    if(!date)return slot.max_bookings;
    const count=slotCounts[`${slot.id}_${date}`]||0;
    return slot.max_bookings-count;
  }

  async function book(){
    const date=booking.repeat?bookingDate:booking.specific_date;
    if(!date){setMsg("Alege o dată.");return;}
    // Frontend check
    if(spotsLeftForDate(booking,date)<=0){setMsg("Nu mai sunt locuri disponibile pentru această dată.");return;}
    // Already booked check
    const alreadyBooked=myBookings.some(b=>b.slot_id===booking.id&&b.booking_date===date);
    if(alreadyBooked){setMsg("Ai deja o rezervare pentru această dată.");return;}
    const{data,error}=await supabase.from("bookings").insert({
      slot_id:booking.id,
      trainer_id:booking.trainer_id,
      client_id:user.id,
      client_name:clientName||user.email,
      booking_date:date,
      status:"confirmed"
    }).select().single();
    if(!error&&data){
      setMyBookings(p=>[...p,data]);
      // Update local count
      setSlotCounts(prev=>{
        const key=`${booking.id}_${date}`;
        return{...prev,[key]:(prev[key]||0)+1};
      });
      setBooking(null);
      setBookingDate("");
      setMsg("Rezervare confirmată! ✅");
    } else {
      // DB trigger may have blocked it
      setMsg(error?.message?.includes("complet")?"Slot complet pentru această dată.":"Eroare: "+(error?.message||"necunoscută"));
    }
    setTimeout(()=>setMsg(""),4000);
  }

  async function cancelBooking(id){
    const b=myBookings.find(x=>x.id===id);
    await supabase.from("bookings").update({status:"cancelled"}).eq("id",id);
    setMyBookings(p=>p.filter(x=>x.id!==id));
    if(b){
      setSlotCounts(prev=>{
        const key=`${b.slot_id}_${b.booking_date}`;
        return{...prev,[key]:Math.max(0,(prev[key]||1)-1)};
      });
    }
    setMsg("Rezervare anulată.");
    setTimeout(()=>setMsg(""),3000);
  }

  const activeBookings=myBookings.filter(b=>b.status==="confirmed");

  return(
    <div>
      <div style={S.sTitle}>🗓 Rezervări</div>
      {msg&&<div style={{background:msg.includes("✅")?`${ACCENT}15`:`${ACCENT2}15`,border:`1px solid ${msg.includes("✅")?ACCENT:ACCENT2}40`,borderRadius:10,padding:"10px 14px",fontSize:13,color:msg.includes("✅")?ACCENT:ACCENT2,marginBottom:12}}>{msg}</div>}

      {activeBookings.length>0&&(
        <>
          <div style={{fontSize:11,fontWeight:700,color:MUTED,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.5px"}}>Rezervările mele</div>
          {activeBookings.map(b=>(
            <div key={b.id} style={{...S.card,padding:"12px 14px",marginBottom:8,border:`1px solid ${COLOR_BOOKING}40`}}>
              <div style={S.sb}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:COLOR_BOOKING}}>{b.booking_date}</div>
                  <div style={{fontSize:12,color:MUTED}}>Confirmat</div>
                </div>
                <button style={S.btn("danger")} onClick={()=>cancelBooking(b.id)}>Anulează</button>
              </div>
            </div>
          ))}
          <div style={S.divider}/>
        </>
      )}

      <div style={{fontSize:11,fontWeight:700,color:MUTED,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.5px"}}>Sloturi disponibile</div>
      {loading?<div style={{color:MUTED,fontSize:13}}>Se încarcă...</div>:
        slots.length===0?<div style={{color:MUTED,fontSize:13}}>Niciun slot disponibil momentan</div>:
        slots.map(slot=>{
          // For recurring slots show next occurrence spots; for one-time show that date's spots
          const previewDate=slot.repeat?getNextDate(slot.day_of_week):slot.specific_date;
          const spotsLeft=spotsLeftForDate(slot,previewDate);
          const isFull=spotsLeft<=0;
          return(
            <div key={slot.id} style={{...S.card,marginBottom:8,opacity:isFull?0.6:1}}>
              <div style={S.sb}>
                <div>
                  <div style={{fontSize:14,fontWeight:700}}>{slot.repeat?DAYS_RO[slot.day_of_week]:slot.specific_date} · {slot.start_time}–{slot.end_time}</div>
                  <div style={{fontSize:12,color:isFull?ACCENT2:ACCENT,marginTop:2,fontWeight:600}}>
                    {isFull?"Complet":spotsLeft===1?"1 loc disponibil":`${spotsLeft} locuri disponibile`}
                  </div>
                </div>
                <button
                  style={{...S.btn(isFull?"ghost":"primary"),opacity:isFull?0.5:1}}
                  disabled={isFull}
                  onClick={()=>{setBooking(slot);setBookingDate(previewDate);}}
                >
                  {isFull?"Complet":"Rezervă"}
                </button>
              </div>
            </div>
          );
        })
      }

      {booking&&(
        <div style={S.modal} onClick={()=>{setBooking(null);setBookingDate("");}}>
          <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:6}}>🗓 Confirmă rezervarea</div>
            <div style={{fontSize:13,color:MUTED,marginBottom:16}}>{booking.start_time}–{booking.end_time} · {booking.repeat?DAYS_RO[booking.day_of_week]:booking.specific_date}</div>
            {booking.repeat&&(
              <>
                <label style={S.label}>Alege data</label>
                <input
                  type="date"
                  style={{...S.input,marginBottom:8,colorScheme:"dark"}}
                  value={bookingDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={e=>setBookingDate(e.target.value)}
                />
                {bookingDate&&(
                  <div style={{fontSize:12,color:spotsLeftForDate(booking,bookingDate)<=0?ACCENT2:ACCENT,marginBottom:14,fontWeight:600}}>
                    {spotsLeftForDate(booking,bookingDate)<=0?"Complet pentru această dată":
                    `${spotsLeftForDate(booking,bookingDate)} loc${spotsLeftForDate(booking,bookingDate)===1?"":"uri"} disponibil${spotsLeftForDate(booking,bookingDate)===1?"":"e"}`}
                  </div>
                )}
              </>
            )}
            <div style={{display:"flex",gap:8}}>
              <button style={{...S.btn(),flex:1}} onClick={()=>{setBooking(null);setBookingDate("");}}>Anulează</button>
              <button
                style={{...S.btn("primary"),flex:2}}
                disabled={booking.repeat&&(!bookingDate||spotsLeftForDate(booking,bookingDate)<=0)}
                onClick={book}
              >✅ Confirmă</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TRAINER APP ──────────────────────────────────────────────────────────────
function TrainerApp({user,profile,setProfile}){
  const[clients,setClients,dbLoading]=useStorage(user);
  const[view,setView]=useState("welcome");
  const[drawerOpen,setDrawerOpen]=useState(false);
  const[modal,setModal]=useState(null);
  const[editForm,setEditForm]=useState(null);
  const[selClient,setSelClient]=useState(null);
  const[calendarKey,setCalendarKey]=useState(0);
  const[calendarBookings,setCalendarBookings]=useState([]);
  useEffect(()=>{
    supabase.from("bookings").select("*,time_slots(start_time,end_time)").eq("trainer_id",user.id).eq("status","confirmed")
      .then(({data})=>{ if(data) setCalendarBookings(data); });
  },[user.id]);
  const[clientTab,setClientTab]=useState("info");
  const[sessDate,setSessDate]=useState(today());
  const[sessTime,setSessTime]=useState(nowTime());
  const[payAmount,setPayAmount]=useState("");
  const[paySessions,setPaySessions]=useState("");
  const[payDueDays,setPayDueDays]=useState(30);
  const[payDate,setPayDate]=useState(today());
  const[deleteConfirm,setDeleteConfirm]=useState(null);
  const[deleteClientConfirm,setDeleteClientConfirm]=useState(null);

  const ts=today();
  const todaySess=clients.flatMap(c=>(c.history||[]).filter(h=>h.type==="session"&&h.date===ts).map(h=>({...h,clientName:c.name,sessionPrice:c.sessionPrice||0})));
  const todaySessCompleted=todaySess.filter(h=>h.completed!==false);
  const todaySessPlanned=todaySess.filter(h=>h.completed===false);
  const todayIncome=todaySessCompleted.reduce((s,h)=>s+Number(h.sessionPrice||0),0);
  const todayPays=clients.flatMap(c=>(c.history||[]).filter(h=>h.type==="payment"&&h.date===ts).map(h=>({...h,clientName:c.name})));
  const todayPayTotal=todayPays.reduce((s,h)=>s+Number(h.amount||0),0);
  const thisMonth=ts.slice(0,7);
  const monthIncome=clients.flatMap(c=>(c.history||[]).filter(h=>h.type==="payment"&&h.date?.startsWith(thisMonth)).map(h=>Number(h.amount||0))).reduce((a,b)=>a+b,0);

  function openAdd(){setEditForm({id:"",name:"",age:"",gender:"Male",email:"",fee:"",sessionPrice:"",paidDate:null,dueDays:30,nextDue:null,sessionsLeft:0,totalSessions:0,history:[]});setModal({type:"addClient"});}
  function openEdit(c){setEditForm({...c});setModal({type:"editClient"});}
  function saveClient(){
    if(!editForm.name.trim())return;
    const sanitized={
      ...editForm,
      name:sanitize(editForm.name),
      age:sanitize(editForm.age),
      email:sanitize(editForm.email),
      fee:sanitize(editForm.fee),
      sessionPrice:sanitize(editForm.sessionPrice),
    };
    if(modal.type==="addClient")setClients(prev=>[...prev,{...sanitized,id:crypto.randomUUID(),history:[]}]);
    else setClients(prev=>prev.map(c=>c.id===editForm.id?sanitized:c));
    setModal(null);
  }
  function deleteClient(id){setClients(prev=>prev.filter(c=>c.id!==id));setSelClient(null);setModal(null);}
  function openMarkSession(clientId){setSessDate(today());setSessTime(nowTime());setModal({type:"markSession",clientId});}
  function confirmSession(){
    setClients(prev=>prev.map(c=>{if(c.id!==modal.clientId)return c;return{...c,sessionsLeft:Math.max(0,(c.sessionsLeft||0)-1),history:[...(c.history||[]),{id:crypto.randomUUID(),type:"session",date:sessDate,time:sessTime,sessionPrice:c.sessionPrice||0,note:"Ședință completată"}]};}));
    setModal(null);
  }
  function openMarkPaid(clientId){const c=clients.find(x=>x.id===clientId);setPayAmount(c?.fee||"");setPaySessions("");setPayDueDays(c?.dueDays||30);setPayDate(today());setModal({type:"markPaid",clientId});}
  function confirmPayment(){
    setClients(prev=>prev.map(c=>{if(c.id!==modal.clientId)return c;const nd=addDays(payDate,payDueDays);return{...c,paidDate:payDate,nextDue:nd,dueDays:payDueDays,sessionsLeft:(c.sessionsLeft||0)+Number(paySessions||0),totalSessions:(c.totalSessions||0)+Number(paySessions||0),fee:payAmount||c.fee,history:[...(c.history||[]),{id:crypto.randomUUID(),type:"payment",date:payDate,time:"",amount:Number(payAmount||c.fee||0),sessions:Number(paySessions||0),note:`Plată: ${paySessions} ședințe`}]};}));
    setModal(null);
  }
  function deleteEntry(clientId,entryId){
    setClients(prev=>prev.map(c=>{
      if(c.id!==clientId)return c;
      const newHistory=(c.history||[]).filter(h=>h.id!==entryId);
      // Recalculate sessionsLeft from scratch: payments add sessions, sessions subtract
      const paidSessions=newHistory.filter(h=>h.type==="payment").reduce((s,h)=>s+Number(h.sessions||0),0);
      const usedSessions=newHistory.filter(h=>h.type==="session"&&h.completed!==false).length;
      const newSessionsLeft=Math.max(0,paidSessions-usedSessions);
      const newTotalSessions=paidSessions;
      return{...c,sessionsLeft:newSessionsLeft,totalSessions:newTotalSessions,history:newHistory};
    }));
    setDeleteConfirm(null);
  }

  const client=selClient?clients.find(c=>c.id===selClient):null;
  const navItems=[["welcome","🏠","Acasă"],["clients","👥","Clienți"],["calendar","📅","Calendar"],["today","⚡","Azi"],["booking","🗓","Rezervări"],["profile","👤","Profil"]];

  const viewTitle=selClient&&client?client.name:navItems.find(([v])=>v===view)?.[2]||"";

  return(
    <div style={S.app}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
      {/* Background logo */}
      <div style={{position:"fixed",inset:0,backgroundImage:`url(${LOGO_B64})`,backgroundSize:"280px",backgroundRepeat:"no-repeat",backgroundPosition:"center center",opacity:0.04,pointerEvents:"none",zIndex:0}}/>
      {dbLoading&&<div style={{position:"fixed",inset:0,background:BG,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:9999}}><div style={{fontSize:40,marginBottom:16}}>💪</div><div style={{color:ACCENT,fontSize:14,fontWeight:700}}>Se încarcă...</div></div>}

      <Drawer open={drawerOpen} onClose={()=>setDrawerOpen(false)} items={navItems} onSelect={(v)=>{setView(v);setSelClient(null);}} activeView={view} user={user} profile={profile}/>

      <div style={S.header}>
        <div style={S.sb}>
          <div style={S.row}>
            <button onClick={()=>setDrawerOpen(true)} style={{background:"none",border:"none",cursor:"pointer",color:TEXT,fontSize:22,padding:"2px 6px 2px 0",lineHeight:1}}>☰</button>
            <div style={{fontSize:16,fontWeight:800}}>{selClient&&client?<button style={{background:"none",border:"none",color:TEXT,cursor:"pointer",fontWeight:800,fontSize:16,fontFamily:"'DM Sans',sans-serif",padding:0}} onClick={()=>setSelClient(null)}>← {client.name}</button>:viewTitle}</div>
          </div>
          <div style={S.row}>
            {view==="clients"&&!selClient&&<button style={S.btn("primary")} onClick={openAdd}>+ Client</button>}
          </div>
        </div>
      </div>

      <div style={S.main}>
        {/* WELCOME VIEW */}
        {view==="welcome"&&(()=>{
          const trainerName=profile?.name||user?.email?.split("@")[0]||"Antrenor";
          const ts2=today();
          const todaySessionsAll=clients.flatMap(c=>(c.history||[]).filter(h=>h.type==="session"&&h.date===ts2).map(h=>({...h,clientName:c.name,sessionPrice:c.sessionPrice||0}))).sort((a,b)=>(a.time||"00:00").localeCompare(b.time||"00:00"));
          const paymentsDue=clients.filter(c=>{const d=daysUntil(c.nextDue);return d!==null&&d<=5&&d>=0;});
          const overdueClients=clients.filter(c=>{const d=daysUntil(c.nextDue);return d!==null&&d<0;});
          return(
            <>
              {/* Greeting */}
              {(()=>{const q=getQuote();return(
              <div style={{background:`linear-gradient(135deg,${CARD},${CARD2})`,borderRadius:20,padding:"20px 18px",border:`1px solid ${BORDER}`,marginBottom:14}}>
                <div style={{fontSize:13,color:MUTED,fontWeight:600,marginBottom:4}}>Bună ziua,</div>
                <div style={{fontSize:22,fontWeight:900,color:TEXT,letterSpacing:"-0.5px"}}>{trainerName} 💪</div>
                <div style={{fontSize:12,color:MUTED,marginTop:4,marginBottom:trainerName?6:12}}>{new Date().toLocaleDateString("ro-RO",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
              {trainerName&&profile?.role==="client"&&<div style={{fontSize:12,color:ACCENT,fontWeight:700,marginBottom:12}}>🏋️ Antrenor: {trainerName}</div>}
                <div style={{borderTop:`1px solid ${BORDER}`,paddingTop:12,marginTop:4}}>
                  <div style={{fontSize:13,fontStyle:"italic",color:TEXT,lineHeight:1.5}}>"{q.text}"</div>
                  {q.author&&<div style={{fontSize:11,color:MUTED,marginTop:4,fontWeight:600}}>— {q.author}</div>}
                </div>
              </div>
              );})()}

              {/* Today sessions */}
              <div style={S.sTitle}>Azi — {todaySessionsAll.length} {todaySessionsAll.length===1?"ședință":"ședințe"}</div>
              {todaySessionsAll.length===0
                ?<div style={{...S.card,color:MUTED,fontSize:13}}>Nicio ședință programată azi</div>
                :todaySessionsAll.map(s=>{const isPlanned=s.completed===false;return(
                  <div key={s.id} style={{...S.card,padding:"12px 14px",marginBottom:8,border:`1px solid ${isPlanned?"#FFB74D30":BORDER}`}}>
                    <div style={S.sb}>
                      <div style={S.row}>
                        <div style={{width:36,height:36,borderRadius:10,background:isPlanned?"#FFB74D18":`${ACCENT}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{isPlanned?"📅":"🏋️"}</div>
                        <div><div style={{fontSize:14,fontWeight:700,color:isPlanned?"#FFB74D":TEXT}}>{s.clientName}</div><div style={{fontSize:12,color:MUTED}}>{s.time||"—"}</div></div>
                      </div>
                      {!isPlanned&&s.sessionPrice>0&&<span style={S.badge(ACCENT,`${ACCENT}20`)}>{s.sessionPrice} RON</span>}
                      {isPlanned&&<span style={S.badge("#FFB74D","#FFB74D20")}>Planificat</span>}
                    </div>
                  </div>
                );})
              }

              {/* Payment reminders */}
              {(paymentsDue.length>0||overdueClients.length>0)&&(
                <>
                  <div style={S.sTitle}>⚠️ Remindere plăți</div>
                  {overdueClients.map(c=>{const d=daysUntil(c.nextDue);return(
                    <div key={c.id} style={{...S.card,padding:"12px 14px",marginBottom:8,border:`1px solid ${ACCENT2}40`}}>
                      <div style={S.sb}>
                        <div style={S.row}><span style={{fontSize:16}}>🔴</span><div><div style={{fontSize:14,fontWeight:700}}>{c.name}</div><div style={{fontSize:12,color:ACCENT2}}>{Math.abs(d)} zile întârziere</div></div></div>
                        <button style={S.btn("ghost")} onClick={()=>{setSelClient(c.id);setView("clients");}}>Vezi →</button>
                      </div>
                    </div>
                  );})}
                  {paymentsDue.map(c=>{const d=daysUntil(c.nextDue);return(
                    <div key={c.id} style={{...S.card,padding:"12px 14px",marginBottom:8,border:`1px solid #FFB74D40`}}>
                      <div style={S.sb}>
                        <div style={S.row}><span style={{fontSize:16}}>🟡</span><div><div style={{fontSize:14,fontWeight:700}}>{c.name}</div><div style={{fontSize:12,color:"#FFB74D"}}>Scade în {d} zile</div></div></div>
                        <button style={S.btn("ghost")} onClick={()=>{setSelClient(c.id);setView("clients");}}>Vezi →</button>
                      </div>
                    </div>
                  );})}
                </>
              )}

              {/* Quick stats */}
              <div style={S.sTitle}>Rezumat financiar</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                <div style={S.statBox}><div style={{fontSize:22,fontWeight:900,color:ACCENT}}>{todayIncome} RON</div><div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase",marginTop:2}}>Câștig azi</div></div>
                <div style={S.statBox}><div style={{fontSize:22,fontWeight:900,color:"#A29BFE"}}>{monthIncome} RON</div><div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase",marginTop:2}}>Luna aceasta</div></div>
              </div>

              {/* All clients summary */}
              {clients.length>0&&(
                <>
                  <div style={S.sTitle}>Toți clienții</div>
                  {clients.map(c=>{
                    const d=daysUntil(c.nextDue),ov=d!==null&&d<0;
                    const earned=(c.history||[]).filter(h=>h.type==="payment").reduce((s,h)=>s+Number(h.amount||0),0);
                    return(
                      <div key={c.id} style={{...S.card,cursor:"pointer"}} onClick={()=>{setSelClient(c.id);setView("clients");}}>
                        <div style={S.sb}>
                          <div style={S.row}><div style={{...S.avatar(c.gender),width:32,height:32,fontSize:15}}>{genderEmoji(c.gender)}</div><div style={{fontWeight:700}}>{c.name}</div></div>
                          {c.nextDue&&<span style={S.badge(ov?ACCENT2:ACCENT,ov?`${ACCENT2}20`:`${ACCENT}20`)}>{ov?`${Math.abs(d)}z întârziere`:`${d}z`}</span>}
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginTop:10}}>
                          {[[c.sessionsLeft??0,"ȘEDINȚE",ACCENT],[c.fee?`${c.fee} RON`:"—","ABONAMENT","#FFB74D"],[`${earned} RON`,"TOTAL","#A29BFE"]].map(([v,l,col])=>(
                            <div key={l} style={{background:CARD2,borderRadius:8,padding:"8px 5px",textAlign:"center"}}><div style={{fontSize:13,fontWeight:800,color:col}}>{v}</div><div style={{fontSize:9,color:MUTED,fontWeight:700}}>{l}</div></div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </>
          );
        })()}

        {/* CLIENTS LIST */}
        {view==="clients"&&!selClient&&(
          <>{clients.length===0&&<div style={{textAlign:"center",padding:"48px 24px",color:MUTED}}><div style={{fontSize:48,marginBottom:12}}>🏋️</div><div style={{fontWeight:700,fontSize:16,marginBottom:6}}>Niciun client încă</div><div style={{fontSize:14}}>Apasă "+ Client" pentru a începe</div></div>}
          {clients.map(c=>{
            const days=daysUntil(c.nextDue),overdue=days!==null&&days<0,soon=days!==null&&days>=0&&days<=5;
            return(
              <div key={c.id} style={{...S.card,cursor:"pointer",border:`1px solid ${overdue?"#FF6B6B50":BORDER}`}} onClick={()=>{setSelClient(c.id);setClientTab("info");}}>
                <div style={S.sb}>
                  <div style={S.row}><div style={S.avatar(c.gender)}>{genderEmoji(c.gender)}</div><div><div style={{fontSize:15,fontWeight:700}}>{c.name}</div><div style={{fontSize:12,color:MUTED}}>{c.age?`${c.age} ani`:""}{c.age&&c.gender?" · ":""}{c.gender}</div></div></div>
                  {c.nextDue?<span style={S.badge(overdue?ACCENT2:soon?"#FFB74D":ACCENT,overdue?`${ACCENT2}20`:soon?"#FFB74D20":`${ACCENT}20`)}>{overdue?`⚠ ${Math.abs(days)}z`:days===0?"⚡ Azi":`⏳ ${days}z`}</span>:<span style={S.badge(MUTED,CARD2)}>Neplătit</span>}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginTop:10}}>
                  <div style={S.statBox}><div style={{fontSize:17,fontWeight:800,color:ACCENT}}>{c.sessionsLeft??0}</div><div style={{fontSize:9,color:MUTED,fontWeight:700}}>ȘEDINȚE</div></div>
                  <div style={S.statBox}><div style={{fontSize:13,fontWeight:800,color:"#A29BFE"}}>{c.fee?`${c.fee} RON`:"—"}</div><div style={{fontSize:9,color:MUTED,fontWeight:700}}>ABONAMENT</div></div>
                  <div style={S.statBox}><div style={{fontSize:13,fontWeight:800,color:"#FFB74D"}}>{c.sessionPrice?`${c.sessionPrice} RON`:"—"}</div><div style={{fontSize:9,color:MUTED,fontWeight:700}}>PE ȘEDINȚĂ</div></div>
                </div>
                {c.sessionsLeft>0&&c.totalSessions>0&&<div style={{height:5,borderRadius:3,background:BORDER,marginTop:10,overflow:"hidden"}}><div style={{height:"100%",borderRadius:3,width:`${Math.min(100,(c.sessionsLeft/c.totalSessions)*100)}%`,background:ACCENT}}/></div>}
              </div>
            );
          })}</>
        )}

        {/* CLIENT DETAIL */}
        {view==="clients"&&selClient&&client&&(()=>{
          const sessionDates=(client.history||[]).filter(h=>h.type==="session").map(h=>h.date);
          const paymentDates=(client.history||[]).filter(h=>h.type==="payment").map(h=>h.date);
          const days=daysUntil(client.nextDue),overdue=days!==null&&days<0;
          const totalEarned=(client.history||[]).filter(h=>h.type==="payment").reduce((s,h)=>s+Number(h.amount||0),0);
          return(
            <>
              <div style={S.card}>
                <div style={S.sb}>
                  <div style={S.row}><div style={S.avatar(client.gender)}>{genderEmoji(client.gender)}</div><div><div style={{fontSize:19,fontWeight:800}}>{client.name}</div><div style={{fontSize:12,color:MUTED}}>{client.age?`${client.age} ani`:""} · {client.gender}{client.email?` · ${client.email}`:""}</div></div></div>
                  <button style={S.btn("ghost")} onClick={()=>openEdit(client)}>✏️</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginTop:10}}>
                  <div style={S.statBox}><div style={{fontSize:17,fontWeight:800,color:ACCENT}}>{client.sessionsLeft??0}</div><div style={{fontSize:9,color:MUTED,fontWeight:700}}>ȘEDINȚE</div></div>
                  <div style={S.statBox}><div style={{fontSize:13,fontWeight:800,color:"#A29BFE"}}>{client.fee?`${client.fee} RON`:"—"}</div><div style={{fontSize:9,color:MUTED,fontWeight:700}}>ABONAMENT</div></div>
                  <div style={S.statBox}><div style={{fontSize:13,fontWeight:800,color:"#FFB74D"}}>{client.sessionPrice?`${client.sessionPrice} RON`:"—"}</div><div style={{fontSize:9,color:MUTED,fontWeight:700}}>PE ȘEDINȚĂ</div></div>
                </div>
                {client.sessionsLeft>0&&client.totalSessions>0&&<><div style={{height:5,borderRadius:3,background:BORDER,marginTop:12,overflow:"hidden"}}><div style={{height:"100%",borderRadius:3,width:`${Math.min(100,(client.sessionsLeft/client.totalSessions)*100)}%`,background:ACCENT}}/></div><div style={{fontSize:11,color:MUTED,marginTop:4}}>{client.sessionsLeft} din {client.totalSessions} ședințe rămase</div></>}
                {client.nextDue&&<><div style={S.divider}/><div style={S.sb}><div><div style={{fontSize:11,color:MUTED,fontWeight:600}}>URMĂTOAREA PLATĂ</div><div style={{fontSize:15,fontWeight:700,marginTop:2}}>{formatDate(client.nextDue)}</div></div><span style={S.badge(overdue?ACCENT2:days<=5?"#FFB74D":ACCENT,overdue?`${ACCENT2}20`:days<=5?"#FFB74D20":`${ACCENT}20`)}>{overdue?`${Math.abs(days)}z întârziere`:days===0?"Scade azi":`${days} zile`}</span></div></>}
              </div>
              <div style={{display:"flex",gap:8,marginBottom:14}}>
                <button style={{...S.btn("primary"),flex:1}} onClick={()=>openMarkPaid(client.id)}>💳 Plată</button>
                <button style={{...S.btn("success"),flex:1}} onClick={()=>openMarkSession(client.id)}>✅ Ședință</button>
              </div>
              {/* Sub-tabs */}
              <div style={{display:"flex",gap:4,background:`${CARD2}80`,borderRadius:10,padding:3,marginBottom:16}}>
                {[["info","📋 Info"],["bookings","🗓 Rezervări"],["measures","📏 Măsurători"],["photos","📸 Poze"]].map(([t,label])=>(
                  <button key={t} style={{flex:1,padding:"7px 0",borderRadius:7,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,transition:"all 0.2s",background:clientTab===t?ACCENT:"transparent",color:clientTab===t?"#000":MUTED,fontFamily:"'DM Sans',sans-serif"}} onClick={()=>setClientTab(t)}>{label}</button>
                ))}
              </div>
              {clientTab==="info"&&(
                <>
                  <div style={S.sTitle}>📅 Calendar prezență</div>
                  <div style={{marginBottom:14}}><MiniCalendar sessionDates={sessionDates} paymentDates={paymentDates}/></div>
                  <div style={{background:"#A29BFE15",border:"1px solid #A29BFE40",borderRadius:12,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div style={{fontSize:13,color:MUTED,fontWeight:600}}>Total câștigat</div>
                    <div style={{fontSize:20,fontWeight:900,color:"#A29BFE"}}>{totalEarned} RON</div>
                  </div>
                  <div style={S.sTitle}>Istoric activitate</div>
                  {(client.history||[]).length===0&&<div style={{color:MUTED,fontSize:14,padding:"10px 0"}}>Nicio activitate încă</div>}
                  {[...(client.history||[])].reverse().map(h=>{
                    const isPlanned=h.type==="session"&&h.completed===false;
                    return(
                    <div key={h.id} style={{...S.card,padding:"11px 14px",marginBottom:7,border:`1px solid ${isPlanned?"#FFB74D30":BORDER}`}}>
                      <div style={S.sb}>
                        <div style={S.row}>
                          <span style={{fontSize:17}}>{h.type==="payment"?"💳":isPlanned?"📅":"🏋️"}</span>
                          <div>
                            <div style={{fontSize:13,fontWeight:600,color:isPlanned?"#FFB74D":TEXT}}>{h.note}</div>
                            <div style={{fontSize:11,color:MUTED}}>{formatDateTime(h.date,h.time)}</div>
                          </div>
                        </div>
                        <div style={S.row}>
                          {h.type==="payment"&&<span style={S.badge(COLOR_PAYMENT,`${COLOR_PAYMENT}20`)}>+{h.amount} RON</span>}
                          {h.type==="session"&&!isPlanned&&h.sessionPrice>0&&<span style={S.badge(COLOR_SESSION_COMPLETED,`${COLOR_SESSION_COMPLETED}20`)}>{h.sessionPrice} RON</span>}
                          {isPlanned&&(
                            <button style={{...S.btn("success"),padding:"5px 10px",fontSize:12}} onClick={()=>{
                              setClients(prev=>prev.map(c=>{
                                if(c.id!==client.id)return c;
                                return{...c,
                                  sessionsLeft:Math.max(0,(c.sessionsLeft||0)-1),
                                  history:(c.history||[]).map(x=>x.id===h.id?{...x,completed:true,note:"Ședință completată"}:x)
                                };
                              }));
                            }}>✅ Marchează</button>
                          )}
                          <button style={{...S.btn("icon"),color:ACCENT2,marginLeft:2}} onClick={()=>setDeleteConfirm({clientId:client.id,entryId:h.id})}>✕</button>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </>
              )}
              {clientTab==="bookings"&&(
                <>
                  <div style={S.sTitle}>🗓 Rezervări active</div>
                  <ClientBookingsSection clientId={client.id} trainerId={user.id}/>
                </>
              )}
              {clientTab==="measures"&&<MeasurementsSection clientId={client.id}/>}
              {clientTab==="photos"&&<ProgressPhotosSection clientId={client.id}/>}
              <div style={S.divider}/>
              <button style={{...S.btn("danger"),width:"100%"}} onClick={()=>setDeleteClientConfirm(client.id)}>🗑 Șterge client</button>
            </>
          );
        })()}

        {view==="calendar"&&(<><div style={S.sTitle}>📅 Calendar general</div>{clients.length===0?<div style={{textAlign:"center",padding:"48px 20px",color:MUTED}}><div style={{fontSize:42,marginBottom:10}}>📅</div><div style={{fontSize:14}}>Adaugă clienți pentru a vedea calendarul</div></div>:<GlobalCalendar key={calendarKey} clients={clients} bookings={calendarBookings} onQuickAddSession={(date)=>{setModal({type:"quickSession",date:date||today()});}}/>}</>)}

        {view==="today"&&(
          <>
            <div style={S.sTitle}>{new Date().toLocaleDateString("ro-RO",{weekday:"long",day:"numeric",month:"long"})}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              <div style={{background:`${ACCENT}15`,border:`1px solid ${ACCENT}40`,borderRadius:12,padding:14,textAlign:"center"}}><div style={{fontSize:22,fontWeight:900,color:ACCENT}}>{todayIncome} RON</div><div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase"}}>Ședințe azi</div></div>
              <div style={{background:"#A29BFE15",border:"1px solid #A29BFE40",borderRadius:12,padding:14,textAlign:"center"}}><div style={{fontSize:22,fontWeight:900,color:"#A29BFE"}}>{todayPayTotal} RON</div><div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase"}}>Plăți azi</div></div>
            </div>
            <div style={S.sTitle}>Ședințe completate ({todaySessCompleted.length})</div>
            {todaySessCompleted.length===0?<div style={{color:MUTED,fontSize:14,marginBottom:12}}>Nicio ședință completată azi</div>:todaySessCompleted.map(s=>(<div key={s.id} style={{...S.card,padding:"11px 14px",marginBottom:7}}><div style={S.sb}><div style={S.row}><span>🏋️</span><div><div style={{fontWeight:600}}>{s.clientName}</div>{s.time&&<div style={{fontSize:11,color:MUTED}}>{s.time}</div>}</div></div><span style={S.badge(ACCENT,`${ACCENT}20`)}>{s.sessionPrice} RON</span></div></div>))}
            {todaySessPlanned.length>0&&(
              <>
                <div style={S.sTitle}>Planificate azi ({todaySessPlanned.length})</div>
                {todaySessPlanned.map(s=>(
                  <div key={s.id} style={{...S.card,padding:"11px 14px",marginBottom:7,border:"1px solid #FFB74D30"}}>
                    <div style={S.sb}>
                      <div style={S.row}><span>📅</span><div><div style={{fontWeight:600,color:"#FFB74D"}}>{s.clientName}</div>{s.time&&<div style={{fontSize:11,color:MUTED}}>{s.time}</div>}</div></div>
                      <button style={{...S.btn("success"),padding:"6px 12px",fontSize:12}} onClick={()=>{
                        setClients(prev=>prev.map(c=>{
                          const h=c.history?.find(x=>x.id===s.id);
                          if(!h)return c;
                          return{...c,sessionsLeft:Math.max(0,(c.sessionsLeft||0)-1),history:c.history.map(x=>x.id===s.id?{...x,completed:true,note:"Ședință completată"}:x)};
                        }));
                      }}>✅ Marchează</button>
                    </div>
                  </div>
                ))}
              </>
            )}
            <div style={S.sTitle}>Plăți ({todayPays.length})</div>
            {todayPays.length===0?<div style={{color:MUTED,fontSize:14,marginBottom:12}}>Nicio plată azi</div>:todayPays.map(p=>(<div key={p.id} style={{...S.card,padding:"11px 14px",marginBottom:7}}><div style={S.sb}><div style={S.row}><span>💳</span><span style={{fontWeight:600}}>{p.clientName}</span></div><span style={S.badge("#A29BFE","#A29BFE20")}>{p.amount} RON</span></div></div>))}
            <div style={S.divider}/>
            <div style={S.sTitle}>Marchează rapid</div>
            {clients.filter(c=>c.sessionsLeft>0).map(c=>(<div key={c.id} style={{...S.card,padding:"11px 14px",marginBottom:7}}><div style={S.sb}><div style={S.row}><div style={{...S.avatar(c.gender),width:32,height:32,fontSize:15}}>{genderEmoji(c.gender)}</div><div><div style={{fontWeight:600}}>{c.name}</div><div style={{fontSize:12,color:MUTED}}>{c.sessionsLeft} rămase</div></div></div><button style={S.btn("success")} onClick={()=>openMarkSession(c.id)}>✅ Done</button></div></div>))}
            {clients.filter(c=>c.sessionsLeft>0).length===0&&<div style={{color:MUTED,fontSize:14}}>Niciun client cu ședințe disponibile</div>}
          </>
        )}

        {view==="booking"&&<TrainerBookingView user={user}/>}
        {view==="profile"&&<ProfileView user={user} profile={profile} setProfile={setProfile}/>}
      </div>

      {/* MODALS - all centered */}
      {modal?.type&&(modal.type==="addClient"||modal.type==="editClient")&&editForm&&(
        <div style={S.modal} onClick={()=>setModal(null)}>
          <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:18}}>{modal.type==="addClient"?"➕ Client nou":"✏️ Editează client"}</div>
            <label style={S.label}>Nume complet *</label>
            <input style={{...S.input,marginBottom:12}} placeholder="ex. Ion Popescu" value={editForm.name} onChange={e=>setEditForm(p=>({...p,name:e.target.value}))}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              <div><label style={S.label}>Vârstă</label><input style={S.input} placeholder="ex. 28" type="number" value={editForm.age} onChange={e=>setEditForm(p=>({...p,age:e.target.value}))}/></div>
              <div><label style={S.label}>Gen</label><select style={{...S.input,appearance:"none"}} value={editForm.gender} onChange={e=>setEditForm(p=>({...p,gender:e.target.value}))}>{GENDERS.map(g=><option key={g}>{g}</option>)}</select></div>
            </div>
            <label style={S.label}>Email client (pentru conectare cont)</label>
            <input style={{...S.input,marginBottom:12}} placeholder="client@email.com" type="email" value={editForm.email||""} onChange={e=>setEditForm(p=>({...p,email:e.target.value}))}/>
            <div style={S.divider}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              <div><label style={S.label}>Abonament (RON)</label><input style={S.input} placeholder="ex. 400" type="number" value={editForm.fee} onChange={e=>setEditForm(p=>({...p,fee:e.target.value}))}/></div>
              <div><label style={S.label}>Preț/ședință (RON)</label><input style={S.input} placeholder="ex. 100" type="number" value={editForm.sessionPrice} onChange={e=>setEditForm(p=>({...p,sessionPrice:e.target.value}))}/></div>
            </div>
            <label style={S.label}>Ciclu plată (zile)</label>
            <input style={{...S.input,marginBottom:18}} placeholder="ex. 30" type="number" value={editForm.dueDays} onChange={e=>setEditForm(p=>({...p,dueDays:Number(e.target.value)}))}/>
            <div style={{display:"flex",gap:8}}><button style={{...S.btn(),flex:1}} onClick={()=>setModal(null)}>Anulează</button><button style={{...S.btn("primary"),flex:2}} onClick={saveClient}>{modal.type==="addClient"?"Adaugă client":"Salvează"}</button></div>
          </div>
        </div>
      )}

      {modal?.type==="markSession"&&(()=>{
        const c=clients.find(x=>x.id===modal.clientId);
        return(
          <div style={S.modal} onClick={()=>setModal(null)}>
            <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}><div style={{width:38,height:38,borderRadius:10,background:`${ACCENT}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🏋️</div><div><div style={{fontSize:18,fontWeight:800}}>Înregistrează ședință</div><div style={{fontSize:13,color:MUTED}}>{c?.name} · {c?.sessionsLeft} rămase</div></div></div>
              <div style={S.divider}/>
              <label style={S.label}>📅 Data ședinței</label>
              <input type="date" style={{...S.input,marginBottom:14,colorScheme:"dark"}} value={sessDate} onChange={e=>setSessDate(e.target.value)}/>
              <label style={S.label}>🕐 Ora ședinței</label>
              <input type="time" style={{...S.input,marginBottom:18,colorScheme:"dark"}} value={sessTime} onChange={e=>setSessTime(e.target.value)}/>
              <div style={{background:CARD2,borderRadius:10,padding:"12px 14px",marginBottom:18,border:`1px solid ${BORDER}`}}>
                <div style={{fontSize:12,color:MUTED,marginBottom:4,fontWeight:600}}>REZUMAT</div>
                <div style={{fontSize:14,fontWeight:700}}>{c?.name}</div>
                <div style={{fontSize:13,color:MUTED,marginTop:2}}>{sessDate?formatDate(sessDate):"—"}{sessTime?` la ${sessTime}`:""}</div>
                {c?.sessionPrice>0&&<div style={{fontSize:13,color:ACCENT,marginTop:4,fontWeight:700}}>Valoare: {c.sessionPrice} RON</div>}
              </div>
              <div style={{display:"flex",gap:8}}><button style={{...S.btn(),flex:1}} onClick={()=>setModal(null)}>Anulează</button><button style={{...S.btn("primary"),flex:2}} onClick={confirmSession} disabled={!sessDate}>✅ Confirmă</button></div>
            </div>
          </div>
        );
      })()}

      {modal?.type==="markPaid"&&(()=>{
        const c=clients.find(x=>x.id===modal.clientId);
        const preview=payDate&&payDueDays?addDays(payDate,payDueDays):null;
        return(
          <div style={S.modal} onClick={()=>setModal(null)}>
            <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}><div style={{width:38,height:38,borderRadius:10,background:"#A29BFE20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>💳</div><div><div style={{fontSize:18,fontWeight:800}}>Înregistrează plată</div><div style={{fontSize:13,color:MUTED}}>{c?.name}</div></div></div>
              <div style={S.divider}/>
              <label style={S.label}>📅 Data plății</label>
              <input type="date" style={{...S.input,marginBottom:14,colorScheme:"dark"}} value={payDate} onChange={e=>setPayDate(e.target.value)}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                <div><label style={S.label}>Sumă (RON)</label><input style={S.input} type="number" placeholder="ex. 400" value={payAmount} onChange={e=>setPayAmount(e.target.value)}/></div>
                <div><label style={S.label}>Ședințe cumpărate</label><input style={S.input} type="number" placeholder="ex. 8" value={paySessions} onChange={e=>setPaySessions(e.target.value)}/></div>
              </div>
              <label style={S.label}>⏳ Scadență (zile)</label>
              <input style={{...S.input,marginBottom:12}} type="number" placeholder="ex. 30" value={payDueDays} onChange={e=>setPayDueDays(Number(e.target.value))}/>
              {preview&&<div style={{background:CARD2,borderRadius:10,padding:"12px 14px",marginBottom:18,border:`1px solid ${BORDER}`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:13,color:MUTED}}>Data plății</div><div style={{fontSize:14,fontWeight:700}}>{formatDate(payDate)}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:13,color:MUTED}}>Scadența</div><div style={{fontSize:14,fontWeight:700,color:ACCENT}}>{formatDate(preview)}</div></div></div></div>}
              <div style={{display:"flex",gap:8}}><button style={{...S.btn(),flex:1}} onClick={()=>setModal(null)}>Anulează</button><button style={{...S.btn("primary"),flex:2}} onClick={confirmPayment}>✅ Confirmă</button></div>
            </div>
          </div>
        );
      })()}

      {deleteClientConfirm&&(()=>{
        const c=clients.find(x=>x.id===deleteClientConfirm);
        return(
          <div style={S.modal} onClick={()=>setDeleteClientConfirm(null)}>
            <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
              <div style={{textAlign:"center",marginBottom:20}}><div style={{fontSize:42,marginBottom:12}}>⚠️</div><div style={{fontSize:18,fontWeight:800,marginBottom:8}}>Ștergi clientul?</div><div style={{fontSize:14,color:MUTED,lineHeight:1.5}}>Ești sigur că vrei să ștergi <strong style={{color:TEXT}}>{c?.name}</strong>?<br/>Toate datele vor fi pierdute definitiv.</div></div>
              <div style={{display:"flex",gap:8}}><button style={{...S.btn(),flex:1}} onClick={()=>setDeleteClientConfirm(null)}>Anulează</button><button style={{...S.btn("danger"),flex:1,justifyContent:"center",background:ACCENT2,color:"#fff"}} onClick={()=>{deleteClient(deleteClientConfirm);setDeleteClientConfirm(null);}}>🗑 Da, șterge</button></div>
            </div>
          </div>
        );
      })()}

      {deleteConfirm&&(
        <div style={S.modal} onClick={()=>setDeleteConfirm(null)}>
          <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
            <div style={{textAlign:"center",marginBottom:16}}><div style={{fontSize:36,marginBottom:10}}>🗑️</div><div style={{fontSize:17,fontWeight:800,marginBottom:6}}>Ștergi această înregistrare?</div><div style={{fontSize:13,color:MUTED}}>Dacă este o ședință, aceasta va fi restituită.</div></div>
            <div style={{display:"flex",gap:8}}><button style={{...S.btn(),flex:1}} onClick={()=>setDeleteConfirm(null)}>Anulează</button><button style={{...S.btn("danger"),flex:1,justifyContent:"center"}} onClick={()=>deleteEntry(deleteConfirm.clientId,deleteConfirm.entryId)}>✕ Șterge</button></div>
          </div>
        </div>
      )}

      {/* QUICK SESSION FROM CALENDAR */}
      {modal?.type==="quickSession"&&(
        <QuickSessionModal
          clients={clients}
          initialDate={modal.date||today()}
          onClose={()=>setModal(null)}
          onConfirm={(qClient,qDate,qTime)=>{
            const isFuture=qDate>today();
            setClients(prev=>prev.map(c=>{
              if(c.id!==qClient)return c;
              return{...c,
                sessionsLeft:isFuture?c.sessionsLeft:Math.max(0,(c.sessionsLeft||0)-1),
                history:[...(c.history||[]),{
                  id:crypto.randomUUID(),type:"session",
                  date:qDate,time:qTime,
                  sessionPrice:c.sessionPrice||0,
                  completed:!isFuture,
                  note:isFuture?"Ședință planificată":"Ședință completată"
                }]
              };
            }));
            setCalendarKey(k=>k+1);
            setModal(null);
          }}
        />
      )}
    </div>
  );
}


// ─── UNLINKED SCREEN ──────────────────────────────────────────────────────────
function UnlinkedScreen({user,profile}){
  const[retrying,setRetrying]=useState(false);
  const[msg,setMsg]=useState("");

  async function retryLink(){
    setRetrying(true);setMsg("");
    try{
      const{data,error}=await supabase.rpc("link_client_account");
      if(error)throw error;
      if(!data.success){setMsg(data.message);setRetrying(false);return;}
      setMsg("Cont legat cu succes! Se reîncarcă...");
      setTimeout(()=>window.location.reload(),1500);
    }catch(e){setMsg("Eroare: "+e.message);}
    setRetrying(false);
  }

  return(
    <div style={{...S.app,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,textAlign:"center"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
      <div style={{fontSize:48,marginBottom:16}}>🔗</div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:8}}>Cont nelegat</div>
      <div style={{fontSize:14,color:MUTED,lineHeight:1.6,marginBottom:24}}>
        Antrenorul tău trebuie să adauge emailul tău (<strong style={{color:TEXT}}>{user.email}</strong>) în profilul tău de client. După ce face asta, apasă butonul de mai jos.
      </div>
      {msg&&<div style={{background:msg.includes("succes")?`${ACCENT}15`:`${ACCENT2}15`,border:`1px solid ${msg.includes("succes")?ACCENT:ACCENT2}40`,borderRadius:10,padding:"10px 14px",fontSize:13,color:msg.includes("succes")?ACCENT:ACCENT2,marginBottom:16,width:"100%"}}>{msg}</div>}
      <button style={{...S.btn("primary"),marginBottom:12,justifyContent:"center"}} onClick={retryLink} disabled={retrying}>
        {retrying?"Se verifică...":"🔄 Am fost adăugat, încearcă din nou"}
      </button>
      <button style={S.btn("ghost")} onClick={()=>supabase.auth.signOut()}>⏻ Deconectare</button>
    </div>
  );
}


// ─── CLIENT CALENDAR VIEW ─────────────────────────────────────────────────────
function ClientCalendarView({user,profile,sessionDates,paymentDates}){
  const[bookingDates,setBookingDates]=useState([]);
  useEffect(()=>{
    supabase.from("bookings").select("booking_date,time_slots(start_time)").eq("client_id",user.id).eq("status","confirmed")
      .then(({data})=>{ if(data) setBookingDates(data.map(b=>b.booking_date).filter(Boolean)); });
  },[user.id]);
  return(
    <div>
      <div style={S.sTitle}>📅 Prezențele tale</div>
      <MiniCalendar sessionDates={sessionDates} paymentDates={paymentDates} bookingDates={bookingDates}/>
      {bookingDates.length>0&&(
        <div style={{...S.card,marginTop:12,background:"#A29BFE15",border:"1px solid #A29BFE40"}}>
          <div style={{fontSize:12,color:"#A29BFE",fontWeight:700,marginBottom:6}}>🗓 Rezervări confirmate</div>
          {bookingDates.map((d,i)=><div key={i} style={{fontSize:13,color:TEXT,padding:"3px 0"}}>{formatDate(d)}</div>)}
        </div>
      )}
    </div>
  );
}

// ─── CLIENT APP ───────────────────────────────────────────────────────────────
function ClientApp({user,profile,setProfile,clientCard,refreshClientCard}){
  const[view,setView]=useState("welcome");
  const[drawerOpen,setDrawerOpen]=useState(false);
  const navItems=[["welcome","🏠","Acasă"],["calendar","📅","Calendar"],["booking","🗓","Rezervări"],["measures","📏","Măsurători"],["photos","📸","Poze"],["profile","👤","Profil"]];

  // Refresh client card on mount to always show latest data
  const[trainerName,setTrainerName]=useState("");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{ if(refreshClientCard) refreshClientCard(); },[]);

  useEffect(()=>{
    if(!profile?.trainer_id)return;
    supabase.from("profiles").select("name").eq("id",profile.trainer_id).single()
      .then(({data})=>{ if(data?.name) setTrainerName(data.name); });
  },[profile?.trainer_id]);

  if(!clientCard&&profile?.role==="client"){
    return <UnlinkedScreen user={user} profile={profile}/>;
  }

  const sessionDates=(clientCard?.history||[]).filter(h=>h.type==="session").map(h=>h.date);
  const paymentDates=(clientCard?.history||[]).filter(h=>h.type==="payment").map(h=>h.date);
  const lastSession=[...(clientCard?.history||[])].filter(h=>h.type==="session").sort((a,b)=>b.date.localeCompare(a.date))[0];
  const days=daysUntil(clientCard?.nextDue),overdue=days!==null&&days<0;
  const viewTitle=navItems.find(([v])=>v===view)?.[2]||"";

  return(
    <div style={S.app}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
      {/* Background logo */}
      <div style={{position:"fixed",inset:0,backgroundImage:`url(${LOGO_B64})`,backgroundSize:"280px",backgroundRepeat:"no-repeat",backgroundPosition:"center center",opacity:0.04,pointerEvents:"none",zIndex:0}}/>
      <Drawer open={drawerOpen} onClose={()=>setDrawerOpen(false)} items={navItems} onSelect={(v)=>{setView(v);}} activeView={view} user={user} profile={profile}/>
      <div style={S.header}>
        <div style={S.sb}>
          <div style={S.row}>
            <button onClick={()=>setDrawerOpen(true)} style={{background:"none",border:"none",cursor:"pointer",color:TEXT,fontSize:22,padding:"2px 6px 2px 0",lineHeight:1}}>☰</button>
            <div style={{fontSize:16,fontWeight:800}}>{viewTitle}</div>
          </div>
        </div>
      </div>

      <div style={S.main}>
        {view==="welcome"&&(
          <>
            {/* Client greeting */}
            {(()=>{const q=getQuote();return(
            <div style={{background:`linear-gradient(135deg,${CARD},${CARD2})`,borderRadius:20,padding:"20px 18px",border:`1px solid ${BORDER}`,marginBottom:14}}>
              <div style={{fontSize:13,color:MUTED,fontWeight:600,marginBottom:4}}>Bună ziua,</div>
              <div style={{fontSize:22,fontWeight:900,color:TEXT,letterSpacing:"-0.5px"}}>{profile?.name||user?.email?.split("@")[0]} 👋</div>
              <div style={{fontSize:12,color:MUTED,marginTop:4,marginBottom:trainerName?6:12}}>{new Date().toLocaleDateString("ro-RO",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
              {trainerName&&profile?.role==="client"&&<div style={{fontSize:12,color:ACCENT,fontWeight:700,marginBottom:12}}>🏋️ Antrenor: {trainerName}</div>}
              <div style={{borderTop:`1px solid ${BORDER}`,paddingTop:12,marginTop:4}}>
                <div style={{fontSize:13,fontStyle:"italic",color:TEXT,lineHeight:1.5}}>"{q.text}"</div>
                {q.author&&<div style={{fontSize:11,color:MUTED,marginTop:4,fontWeight:600}}>— {q.author}</div>}
              </div>
            </div>
            );})()}
            {/* Today session for client */}
            {(()=>{const todaySessClient=(clientCard?.history||[]).filter(h=>h.type==="session"&&h.date===today()).sort((a,b)=>(a.time||"00:00").localeCompare(b.time||"00:00"));return todaySessClient.length>0&&(
              <div style={{...S.card,marginBottom:14,border:`1px solid ${ACCENT}40`}}>
                <div style={{fontSize:11,color:ACCENT,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8}}>Azi ai {todaySessClient.length} {todaySessClient.length===1?"ședință":"ședințe"}</div>
                {todaySessClient.map(s=><div key={s.id} style={{fontSize:14,fontWeight:700,color:TEXT}}>{s.time||"—"}</div>)}
              </div>
            );})()}
            <div style={S.sTitle}>Rezumatul tău</div>
            <div style={{background:`linear-gradient(135deg,${ACCENT}20,${ACCENT}08)`,border:`1px solid ${ACCENT}40`,borderRadius:20,padding:"24px 20px",marginBottom:12,textAlign:"center"}}>
              <div style={{fontSize:64,fontWeight:900,color:ACCENT,lineHeight:1}}>{clientCard?.sessionsLeft??0}</div>
              <div style={{fontSize:13,color:MUTED,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.8px",marginTop:6}}>Ședințe rămase</div>
              {clientCard?.sessionsLeft>0&&clientCard?.totalSessions>0&&<div style={{height:6,borderRadius:3,background:BORDER,marginTop:14,overflow:"hidden"}}><div style={{height:"100%",borderRadius:3,width:`${Math.min(100,(clientCard?.sessionsLeft/clientCard?.totalSessions)*100)}%`,background:ACCENT}}/></div>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              <div style={{background:CARD,borderRadius:14,padding:14,border:`1px solid ${overdue?"#FF6B6B50":BORDER}`}}>
                <div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:6}}>Următoarea plată</div>
                {clientCard?.nextDue?<><div style={{fontSize:14,fontWeight:800,color:overdue?ACCENT2:TEXT}}>{formatDate(clientCard?.nextDue)}</div><div style={{fontSize:11,color:overdue?ACCENT2:MUTED,marginTop:4,fontWeight:600}}>{overdue?`${Math.abs(days)}z întârziere`:days===0?"Scade azi":`${days} zile`}</div></>:<div style={{fontSize:13,color:MUTED}}>—</div>}
              </div>
              <div style={{background:CARD,borderRadius:14,padding:14,border:`1px solid ${BORDER}`}}>
                <div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:6}}>Ultima ședință</div>
                {lastSession?<><div style={{fontSize:14,fontWeight:800}}>{formatDate(lastSession.date)}</div><div style={{fontSize:11,color:MUTED,marginTop:4}}>{lastSession.time||""}</div></>:<div style={{fontSize:13,color:MUTED}}>—</div>}
              </div>
            </div>
            <div style={S.sTitle}>Istoric activitate</div>
            <div style={{background:CARD,borderRadius:16,border:`1px solid ${BORDER}`,overflow:"hidden"}}>
              {(clientCard?.history||[]).length===0?<div style={{padding:16,color:MUTED,fontSize:14}}>Nicio activitate încă</div>
                :[...(clientCard?.history||[])].reverse().slice(0,10).map((h,i,arr)=>(
                  <div key={h.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:i<arr.length-1?`1px solid ${BORDER}`:"none"}}>
                    <div style={S.row}><span style={{fontSize:17}}>{h.type==="payment"?"💳":"🏋️"}</span><div><div style={{fontSize:13,fontWeight:600}}>{h.note}</div><div style={{fontSize:11,color:MUTED}}>{formatDateTime(h.date,h.time)}</div></div></div>
                    {h.type==="payment"&&<span style={S.badge(COLOR_PAYMENT,`${COLOR_PAYMENT}20`)}>+{h.amount} RON</span>}
                    {h.type==="session"&&h.sessionPrice>0&&<span style={S.badge(COLOR_SESSION_COMPLETED,`${COLOR_SESSION_COMPLETED}20`)}>{h.sessionPrice} RON</span>}
                  </div>
                ))}
            </div>
          </>
        )}
        {view==="calendar"&&(<ClientCalendarView user={user} profile={profile} sessionDates={sessionDates} paymentDates={paymentDates}/>)}
        {view==="booking"&&(profile?.trainer_id?<ClientBookingView user={user} trainerId={profile.trainer_id} clientName={profile?.name}/>:<div style={{color:MUTED,fontSize:14,padding:20,textAlign:"center"}}>Contul tău nu este încă legat de un antrenor.</div>)}
        {view==="measures"&&<MeasurementsSection clientId={clientCard?.id}/>}
        {view==="photos"&&<ProgressPhotosSection clientId={clientCard?.id}/>}
        {view==="profile"&&<ProfileView user={user} profile={profile} setProfile={setProfile}/>}
      </div>
    </div>
  );
}

// ─── AUTH SCREEN ──────────────────────────────────────────────────────────────
function AuthScreen({onAuth}){
  const[mode,setMode]=useState("login");
  const[installPrompt,setInstallPrompt]=useState(null);
  const[installed,setInstalled]=useState(false);
  useEffect(()=>{
    window.addEventListener("beforeinstallprompt",(e)=>{e.preventDefault();setInstallPrompt(e);});
    window.addEventListener("appinstalled",()=>setInstalled(true));
  },[]);
  async function handleInstall(){
    if(!installPrompt)return;
    installPrompt.prompt();
    const{outcome}=await installPrompt.userChoice;
    if(outcome==="accepted")setInstalled(true);
    setInstallPrompt(null);
  }
  const[role,setRole]=useState("client");
  const[email,setEmail]=useState("");
  const[password,setPassword]=useState("");
  const[name,setName]=useState("");
  const[trainerJoinCode,setTrainerJoinCode]=useState("");
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState("");
  const[success,setSuccess]=useState("");

  async function handleSubmit(){
    setError("");setSuccess("");setLoading(true);
    try{
      if(mode==="login"){
        const{error}=await supabase.auth.signInWithPassword({email,password});
        if(error)throw error;
        onAuth();
      } else {
        if(!sanitize(name))throw new Error("Introduceți numele.");
        if(!isValidEmail(email))throw new Error("Adresă de email invalidă.");
        if(!isStrongPassword(password))throw new Error("Parola trebuie să aibă minim 8 caractere, o literă mare și o cifră.");
        // Validate BEFORE creating account
        // Trainer role is verified server-side via DB trigger — no frontend secret needed
        let trainerId=null;
        if(role==="client"){
          if(!trainerJoinCode.trim())throw new Error("Introduceți codul antrenorului.");
          const{data:trainerProfile,error:tErr}=await supabase.from("profiles").select("id").eq("join_code",trainerJoinCode.trim().toUpperCase()).maybeSingle();
          // Vague error message — don't reveal if code exists or not
          if(tErr||!trainerProfile)throw new Error("Cod invalid. Verificați codul primit de la antrenor.");
          trainerId=trainerProfile.id;
        }
        // All validation passed — now create the account
        // Profile is created automatically by DB trigger on auth.users insert
        const{data,error}=await supabase.auth.signUp({email,password,options:{data:{name,role,trainer_id:trainerId}}});
        if(error)throw error;
        // Small delay to let the trigger create the profile first
        await new Promise(r=>setTimeout(r,1000));
        if(role==="client"&&trainerId){
          await supabase.from("clients").update({client_user_id:data.user.id}).eq("client_email",email).eq("user_id",trainerId);
          // Update trainer_id in profile now that it exists
          await supabase.from("profiles").update({trainer_id:trainerId}).eq("id",data.user.id);
        }
        setSuccess(role==="trainer"?"Cont antrenor creat! Verifică emailul pentru confirmare.":"Cont client creat! Verifică emailul pentru confirmare.");
      }
    }catch(e){setError(e.message||"A apărut o eroare.");}
    setLoading(false);
  }

  const inputStyle={width:"100%",background:CARD2,border:`1px solid ${BORDER}`,borderRadius:10,padding:"12px 14px",color:TEXT,fontSize:16,outline:"none",boxSizing:"border-box",marginBottom:12,fontFamily:"'DM Sans',sans-serif"};

  return(
    <div style={{minHeight:"100vh",background:BG,display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'DM Sans',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
      <div style={{width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:60,height:60,borderRadius:16,background:`linear-gradient(135deg,${ACCENT},#00B87A)`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",overflow:"hidden"}}>
            <img src={LOGO_B64} alt="PT Tracker" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          </div>
          <div style={{fontSize:26,fontWeight:900,color:TEXT,letterSpacing:"-0.5px"}}>PT Tracker</div>
          <div style={{fontSize:13,color:MUTED,marginTop:4,textTransform:"uppercase",letterSpacing:"0.8px"}}>Personal Trainer Pro</div>
          {installPrompt&&!installed&&(
            <button onClick={handleInstall} style={{marginTop:14,background:`${ACCENT}20`,border:`1px solid ${ACCENT}40`,borderRadius:10,padding:"9px 18px",color:ACCENT,cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"'DM Sans',sans-serif",display:"inline-flex",alignItems:"center",gap:6}}>
              📲 Adaugă pe ecranul principal
            </button>
          )}
          {installed&&<div style={{marginTop:10,fontSize:12,color:ACCENT}}>✓ Aplicație instalată!</div>}
        </div>
        <div style={{background:CARD,borderRadius:20,padding:"28px 24px",border:`1px solid ${BORDER}`}}>
          <div style={{display:"flex",background:CARD2,borderRadius:10,padding:3,marginBottom:20}}>
            {[["login","Autentificare"],["register","Înregistrare"]].map(([m,label])=>(
              <button key={m} onClick={()=>{setMode(m);setError("");setSuccess("");}} style={{flex:1,padding:"8px 0",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,transition:"all 0.2s",background:mode===m?ACCENT:"transparent",color:mode===m?"#000":MUTED,fontFamily:"'DM Sans',sans-serif"}}>{label}</button>
            ))}
          </div>
          {mode==="register"&&(
            <>
              <div style={{fontSize:12,fontWeight:700,color:MUTED,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.5px"}}>Tip de cont</div>
              <div style={{display:"flex",gap:8,marginBottom:14}}>
                {[["client","🏃 Client"],["trainer","🏋️ Antrenor"]].map(([r,label])=>(
                  <button key={r} onClick={()=>setRole(r)} style={{flex:1,padding:"10px 0",borderRadius:10,border:`2px solid ${role===r?ACCENT:BORDER}`,background:role===r?`${ACCENT}15`:CARD2,color:role===r?ACCENT:MUTED,fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:700,cursor:"pointer",transition:"all 0.15s"}}>{label}</button>
                ))}
              </div>
              <label style={{fontSize:12,fontWeight:700,color:MUTED,display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.5px"}}>Nume complet</label>
              <input style={inputStyle} placeholder="Ion Popescu" value={name} onChange={e=>setName(e.target.value)}/>
            </>
          )}
          <label style={{fontSize:12,fontWeight:700,color:MUTED,display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.5px"}}>Email</label>
          <input type="email" style={inputStyle} placeholder="exemplu@email.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>
          <label style={{fontSize:12,fontWeight:700,color:MUTED,display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.5px"}}>Parolă</label>
          <input type="password" style={inputStyle} placeholder="Minim 6 caractere" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>
          {mode==="register"&&role==="trainer"&&(
            <div style={{background:`${ACCENT}15`,border:`1px solid ${ACCENT}40`,borderRadius:10,padding:"10px 14px",fontSize:13,color:ACCENT,marginBottom:12}}>
              ℹ️ Contul de antrenor va fi aprobat automat de sistem.
            </div>
          )}
          {mode==="register"&&role==="client"&&(
            <><label style={{fontSize:12,fontWeight:700,color:MUTED,display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.5px"}}>🔑 Codul antrenorului</label><input style={{...inputStyle,textTransform:"uppercase",letterSpacing:"0.1em"}} placeholder="ex. AB12CD" value={trainerJoinCode} onChange={e=>setTrainerJoinCode(e.target.value)}/></>
          )}
          {error&&<div style={{background:`${ACCENT2}15`,border:`1px solid ${ACCENT2}40`,borderRadius:10,padding:"10px 14px",fontSize:13,color:ACCENT2,marginBottom:14}}>⚠ {error}</div>}
          {success&&<div style={{background:`${ACCENT}15`,border:`1px solid ${ACCENT}40`,borderRadius:10,padding:"10px 14px",fontSize:13,color:ACCENT,marginBottom:14}}>✓ {success}</div>}
          <button onClick={handleSubmit} disabled={loading||!email||!password} style={{width:"100%",background:ACCENT,color:"#000",border:"none",borderRadius:12,padding:"14px",fontSize:15,fontWeight:800,cursor:loading?"not-allowed":"pointer",opacity:loading||!email||!password?0.6:1,fontFamily:"'DM Sans',sans-serif"}}>
            {loading?"Se procesează...":mode==="login"?"Intră în cont":role==="trainer"?"Creează cont antrenor":"Creează cont client"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function Root(){
  const[user,setUser]=useState(undefined);
  const[profile,setProfile]=useState(null);
  const[clientCard,setClientCard]=useState(null);
  const[profileLoading,setProfileLoading]=useState(false);

  useEffect(()=>{
    supabase.auth.getUser().then(({data:{user}})=>setUser(user??null));
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>{
      setUser(session?.user??null);
      if(!session){setProfile(null);setClientCard(null);}
    });
    return()=>subscription.unsubscribe();
  },[]);

  async function refreshClientCard(){
    const{data:rpcData}=await supabase.rpc("get_client_card");
    if(rpcData?.found)setClientCard(rpcData.data);
    return rpcData?.found??false;
  }

  useEffect(()=>{
    if(!user)return;
    setProfileLoading(true);
    supabase.from("profiles").select("*").eq("id",user.id).single().then(async({data:prof,error:profErr})=>{
      setProfile(prof);
      if(prof?.role==="client"){
        await refreshClientCard();
      }
      setProfileLoading(false);
    });
  },[user]);

  if(user===undefined||profileLoading){
    return(<div style={{minHeight:"100vh",background:BG,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}><div style={{fontSize:40,marginBottom:16}}>💪</div><div style={{color:ACCENT,fontSize:14,fontWeight:700}}>Se încarcă...</div></div>);
  }

  if(!user)return<AuthScreen onAuth={()=>supabase.auth.getUser().then(({data:{user}})=>setUser(user))}/>;
  // If profile not loaded yet, keep showing loading spinner
  if(!profile)return(<div style={{minHeight:"100vh",background:BG,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}><div style={{fontSize:40,marginBottom:16}}>💪</div><div style={{color:ACCENT,fontSize:14,fontWeight:700}}>Se încarcă profilul...</div><button style={{marginTop:24,background:"transparent",border:`1px solid ${BORDER}`,borderRadius:9,padding:"8px 16px",color:MUTED,cursor:"pointer",fontSize:13,fontFamily:"'DM Sans',sans-serif"}} onClick={()=>supabase.auth.signOut()}>Deconectare</button></div>);
  if(profile.role==="client")return<ClientApp user={user} profile={profile} setProfile={setProfile} clientCard={clientCard} refreshClientCard={refreshClientCard}/>;
  if(profile.role==="trainer"||profile.role==="admin")return<TrainerApp user={user} profile={profile} setProfile={setProfile}/>;
  // Unknown role - show logout
  return(<div style={{minHeight:"100vh",background:BG,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}><div style={{fontSize:40,marginBottom:16}}>⚠️</div><div style={{color:ACCENT2,fontSize:14,fontWeight:700,marginBottom:16}}>Rol necunoscut: {profile.role}</div><button style={{background:"transparent",border:`1px solid ${BORDER}`,borderRadius:9,padding:"8px 16px",color:MUTED,cursor:"pointer",fontSize:13,fontFamily:"'DM Sans',sans-serif"}} onClick={()=>supabase.auth.signOut()}>Deconectare</button></div>);
}
