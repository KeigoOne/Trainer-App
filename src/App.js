import { useState, useCallback, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);



// ── Sync diff to Supabase: upsert changed/added, delete removed ──
async function syncToSupabase(prev, next, userId) {
  const prevMap = Object.fromEntries(prev.map(c => [c.id, c]));
  const nextMap = Object.fromEntries(next.map(c => [c.id, c]));

  // Delete removed clients
  for (const id of Object.keys(prevMap)) {
    if (!nextMap[id]) {
      await supabase.from("clients").delete().eq("id", id).eq("user_id", userId);
    }
  }

  // Upsert added or changed clients
  for (const client of next) {
    const prev = prevMap[client.id];
    if (!prev || JSON.stringify(prev) !== JSON.stringify(client)) {
      await supabase.from("clients").upsert({ id: client.id, user_id: userId, data: client });
    }
  }
}

function useStorage(user) {
  const [clients, setClientsState] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);

  // Load from Supabase on mount
  useEffect(() => {
    if (!user) return;
    supabase
      .from("clients")
      .select("data")
      .eq("user_id", user.id)
      .then(({ data, error }) => {
        if (data) setClientsState(data.map(r => r.data));
        setDbLoading(false);
      });
  }, [user]);

  const setClients = useCallback((updater) => {
    setClientsState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (user) syncToSupabase(prev, next, user.id);
      return next;
    });
  }, [user]);

  return [clients, setClients, dbLoading];
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  const t = new Date(dateStr); t.setHours(0,0,0,0);
  return Math.ceil((t - now) / 86400000);
}
function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" });
}
function formatDateTime(dateStr, timeStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr).toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" });
  return timeStr ? `${date}, ${timeStr}` : date;
}
function addDays(dateStr, days) {
  const d = new Date(dateStr); d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
function today() { return new Date().toISOString().split("T")[0]; }
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function getFirstDayOfMonth(year, month) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

const GENDERS = ["Male", "Female", "Other"];
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
const CLIENT_COLORS = ["#00E5A0","#FF6B6B","#A29BFE","#FFB74D","#4ECDC4","#FF8CC8","#74B9FF","#FDCB6E","#E17055","#55EFC4"];

function genderEmoji(g) { return g === "Female" ? "👩" : g === "Male" ? "👨" : "🧑"; }

// ── MINI CALENDAR (per-client) ──
function MiniCalendar({ sessionDates = [], paymentDates = [] }) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const todayStr = today();
  const sessionSet = new Set(sessionDates.filter(d => { const [y,m]=d.split("-").map(Number); return y===viewYear&&m-1===viewMonth; }).map(d=>parseInt(d.split("-")[2])));
  const paymentSet = new Set(paymentDates.filter(d => { const [y,m]=d.split("-").map(Number); return y===viewYear&&m-1===viewMonth; }).map(d=>parseInt(d.split("-")[2])));
  const todayDay = (() => { const [ty,tm,td]=todayStr.split("-").map(Number); return ty===viewYear&&tm-1===viewMonth?td:null; })();
  function prev() { if(viewMonth===0){setViewYear(y=>y-1);setViewMonth(11);}else setViewMonth(m=>m-1); }
  function next() { if(viewMonth===11){setViewYear(y=>y+1);setViewMonth(0);}else setViewMonth(m=>m+1); }
  const cells = [];
  for(let i=0;i<firstDay;i++) cells.push(null);
  for(let d=1;d<=daysInMonth;d++) cells.push(d);
  return (
    <div style={{background:CARD2,borderRadius:14,padding:14,border:`1px solid ${BORDER}`}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <button onClick={prev} style={{background:"none",border:"none",color:MUTED,cursor:"pointer",fontSize:18,padding:"2px 8px"}}>‹</button>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:TEXT,textAlign:"center"}}>{MONTH_NAMES[viewMonth]} {viewYear}</div>
          <div style={{fontSize:11,color:MUTED,textAlign:"center"}}>{sessionSet.size} ședințe această lună · {sessionDates.length} total</div>
        </div>
        <button onClick={next} style={{background:"none",border:"none",color:MUTED,cursor:"pointer",fontSize:18,padding:"2px 8px"}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
        {DAY_NAMES.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:MUTED,padding:"2px 0"}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {cells.map((day,i)=>{
          if(!day) return <div key={`e${i}`}/>;
          const isSess=sessionSet.has(day), isPay=paymentSet.has(day), isToday=day===todayDay;
          return (
            <div key={day} style={{textAlign:"center",borderRadius:7,padding:"5px 1px",background:isSess?`${ACCENT}22`:isPay?"#A29BFE22":"transparent",border:isToday?`1.5px solid ${ACCENT}`:isSess?`1px solid ${ACCENT}50`:isPay?"1px solid #A29BFE50":"1px solid transparent"}}>
              <div style={{fontSize:12,fontWeight:isSess||isPay?700:400,color:isSess?ACCENT:isPay?"#A29BFE":isToday?ACCENT:MUTED}}>{day}</div>
              {(isSess||isPay)&&<div style={{width:4,height:4,borderRadius:"50%",background:isSess?ACCENT:"#A29BFE",margin:"1px auto 0"}}/>}
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",gap:12,marginTop:10,paddingTop:8,borderTop:`1px solid ${BORDER}`}}>
        <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:MUTED}}><div style={{width:8,height:8,borderRadius:"50%",background:ACCENT}}/>Antrenament</div>
        <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:MUTED}}><div style={{width:8,height:8,borderRadius:"50%",background:"#A29BFE"}}/>Plată</div>
      </div>
    </div>
  );
}

// ── GLOBAL CALENDAR ──
function GlobalCalendar({ clients }) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const todayStr = today();
  const dayMap = {};
  clients.forEach((c,ci) => {
    const color = CLIENT_COLORS[ci % CLIENT_COLORS.length];
    (c.history||[]).forEach(h => {
      const [y,m,d] = h.date.split("-").map(Number);
      if(y===viewYear&&m-1===viewMonth) {
        if(!dayMap[d]) dayMap[d]=[];
        dayMap[d].push({clientName:c.name,color,type:h.type,sessionPrice:c.sessionPrice,amount:h.amount,time:h.time});
      }
    });
  });
  const todayDay = (() => { const [ty,tm,td]=todayStr.split("-").map(Number); return ty===viewYear&&tm-1===viewMonth?td:null; })();
  function prev() { if(viewMonth===0){setViewYear(y=>y-1);setViewMonth(11);}else setViewMonth(m=>m-1); }
  function next() { if(viewMonth===11){setViewYear(y=>y+1);setViewMonth(0);}else setViewMonth(m=>m+1); }
  const cells=[];
  for(let i=0;i<firstDay;i++) cells.push(null);
  for(let d=1;d<=daysInMonth;d++) cells.push(d);
  const monthSessions=Object.values(dayMap).flat().filter(e=>e.type==="session").length;
  const monthIncome=clients.flatMap(c=>(c.history||[]).filter(h=>{const[y,m]=h.date.split("-").map(Number);return y===viewYear&&m-1===viewMonth&&h.type==="payment";}).map(h=>Number(h.amount||0))).reduce((a,b)=>a+b,0);
  const selectedEvents=selectedDay?(dayMap[selectedDay]||[]):[];
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div style={{background:`${ACCENT}15`,border:`1px solid ${ACCENT}40`,borderRadius:12,padding:"12px 14px"}}>
          <div style={{fontSize:22,fontWeight:900,color:ACCENT}}>{monthSessions}</div>
          <div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px"}}>Antrenamente luna</div>
        </div>
        <div style={{background:"#A29BFE15",border:"1px solid #A29BFE40",borderRadius:12,padding:"12px 14px"}}>
          <div style={{fontSize:22,fontWeight:900,color:"#A29BFE"}}>{monthIncome} RON</div>
          <div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px"}}>Plăți luna</div>
        </div>
      </div>
      <div style={{background:CARD2,borderRadius:14,padding:14,border:`1px solid ${BORDER}`,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <button onClick={prev} style={{background:"none",border:"none",color:MUTED,cursor:"pointer",fontSize:20,padding:"2px 8px"}}>‹</button>
          <div style={{fontSize:15,fontWeight:800,color:TEXT}}>{MONTH_NAMES[viewMonth]} {viewYear}</div>
          <button onClick={next} style={{background:"none",border:"none",color:MUTED,cursor:"pointer",fontSize:20,padding:"2px 8px"}}>›</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:6}}>
          {DAY_NAMES.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:MUTED}}>{d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
          {cells.map((day,i)=>{
            if(!day) return <div key={`e${i}`}/>;
            const events=dayMap[day]||[], isToday=day===todayDay, isSel=day===selectedDay;
            return (
              <div key={day} onClick={()=>setSelectedDay(day===selectedDay?null:day)} style={{borderRadius:8,padding:"6px 2px 4px",cursor:events.length>0||isToday?"pointer":"default",background:isSel?`${ACCENT}20`:isToday?`${ACCENT}0D`:events.length>0?CARD:"transparent",border:isSel?`1.5px solid ${ACCENT}`:isToday?`1px solid ${ACCENT}60`:events.length>0?`1px solid ${BORDER}`:"1px solid transparent",transition:"all 0.1s"}}>
                <div style={{textAlign:"center",fontSize:12,fontWeight:events.length>0?700:400,color:isToday?ACCENT:events.length>0?TEXT:MUTED}}>{day}</div>
                <div style={{display:"flex",justifyContent:"center",flexWrap:"wrap",gap:2,marginTop:3,minHeight:7}}>
                  {events.slice(0,4).map((e,di)=><div key={di} style={{width:5,height:5,borderRadius:"50%",background:e.type==="payment"?"#A29BFE":e.color}}/>)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {selectedDay&&(
        <div style={{background:CARD,borderRadius:14,padding:16,border:`1px solid ${BORDER}`,marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:700,color:MUTED,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.5px"}}>{selectedDay} {MONTH_NAMES[viewMonth]} {viewYear}</div>
          {selectedEvents.length===0?<div style={{color:MUTED,fontSize:14}}>Nicio activitate în această zi</div>
            :selectedEvents.map((e,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 0",borderBottom:i<selectedEvents.length-1?`1px solid ${BORDER}`:"none"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:e.type==="payment"?"#A29BFE":e.color,flexShrink:0}}/>
                  <div>
                    <div style={{fontSize:14,fontWeight:600}}>{e.clientName}</div>
                    <div style={{fontSize:11,color:MUTED}}>{e.type==="session"?"🏋️ Antrenament":"💳 Plată"}{e.time?` · ${e.time}`:""}</div>
                  </div>
                </div>
                {e.type==="session"&&e.sessionPrice>0&&<span style={{fontSize:13,fontWeight:700,color:e.color}}>{e.sessionPrice} RON</span>}
                {e.type==="payment"&&<span style={{fontSize:13,fontWeight:700,color:"#A29BFE"}}>{e.amount} RON</span>}
              </div>
            ))}
        </div>
      )}
      {clients.length>0&&(
        <>
          <div style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"1px",marginBottom:8}}>Legendă clienți</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
            {clients.map((c,ci)=>(
              <div key={c.id} style={{display:"flex",alignItems:"center",gap:5,background:CARD2,borderRadius:8,padding:"5px 10px",border:`1px solid ${BORDER}`}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:CLIENT_COLORS[ci%CLIENT_COLORS.length]}}/>
                <span style={{fontSize:12,fontWeight:600}}>{c.name}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════ MAIN APP ══════════════════════════════
function App({ user }) {
  const [clients, setClients, dbLoading] = useStorage(user);
  const [tab, setTab] = useState("clients");
  const [modal, setModal] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);

  // Session modal state
  const [sessDate, setSessDate] = useState(today());
  const [sessTime, setSessTime] = useState(nowTime());

  // Payment modal state
  const [payAmount, setPayAmount] = useState("");
  const [paySessions, setPaySessions] = useState("");
  const [payDueDays, setPayDueDays] = useState(30);
  const [payDate, setPayDate] = useState(today());

  // Confirm delete entry state
  const [deleteConfirm, setDeleteConfirm] = useState(null); // {clientId, entryId}
  const [deleteClientConfirm, setDeleteClientConfirm] = useState(null); // clientId

  const todayStr = today();
  const todaySessions = clients.flatMap(c=>(c.history||[]).filter(h=>h.type==="session"&&h.date===todayStr).map(h=>({...h,clientName:c.name,sessionPrice:c.sessionPrice||0})));
  const todayIncome = todaySessions.reduce((s,h)=>s+Number(h.sessionPrice||0),0);
  const todayPayments = clients.flatMap(c=>(c.history||[]).filter(h=>h.type==="payment"&&h.date===todayStr).map(h=>({...h,clientName:c.name})));
  const todayPaymentTotal = todayPayments.reduce((s,h)=>s+Number(h.amount||0),0);
  const thisMonth = todayStr.slice(0,7);
  const monthIncome = clients.flatMap(c=>(c.history||[]).filter(h=>h.type==="payment"&&h.date?.startsWith(thisMonth)).map(h=>Number(h.amount||0))).reduce((a,b)=>a+b,0);

  function openAddClient() { setEditForm({id:"",name:"",age:"",gender:"Male",fee:"",sessionPrice:"",paidDate:null,dueDays:30,nextDue:null,sessionsLeft:0,totalSessions:0,history:[]}); setModal({type:"addClient"}); }
  function openEditClient(c) { setEditForm({...c}); setModal({type:"editClient"}); }
  function saveClient() {
    if(!editForm.name.trim()) return;
    if(modal.type==="addClient") setClients(prev=>[...prev,{...editForm,id:Date.now().toString(),history:[]}]);
    else setClients(prev=>prev.map(c=>c.id===editForm.id?editForm:c));
    setModal(null);
  }
  function deleteClient(id) { setClients(prev=>prev.filter(c=>c.id!==id)); setSelectedClient(null); setModal(null); }

  // Open session modal
  function openMarkSession(clientId) {
    setSessDate(today());
    setSessTime(nowTime());
    setModal({type:"markSession", clientId});
  }

  // Confirm session
  function confirmSession() {
    const clientId = modal.clientId;
    setClients(prev=>prev.map(c=>{
      if(c.id!==clientId) return c;
      return {
        ...c, sessionsLeft: Math.max(0, (c.sessionsLeft||0)-1),
        history: [...(c.history||[]), {
          id: Date.now().toString(), type:"session",
          date: sessDate, time: sessTime,
          sessionPrice: c.sessionPrice||0,
          note:`Ședință completată`
        }]
      };
    }));
    setModal(null);
  }

  // Open payment modal
  function openMarkPaid(clientId) {
    const c = clients.find(x=>x.id===clientId);
    setPayAmount(c?.fee||"");
    setPaySessions("");
    setPayDueDays(c?.dueDays||30);
    setPayDate(today());
    setModal({type:"markPaid", clientId});
  }

  // Confirm payment
  function confirmPayment() {
    const clientId = modal.clientId;
    setClients(prev=>prev.map(c=>{
      if(c.id!==clientId) return c;
      const nd = addDays(payDate, payDueDays);
      return {
        ...c, paidDate:payDate, nextDue:nd, dueDays:payDueDays,
        sessionsLeft:(c.sessionsLeft||0)+Number(paySessions||0),
        totalSessions:(c.totalSessions||0)+Number(paySessions||0),
        fee:payAmount||c.fee,
        history:[...(c.history||[]),{
          id:Date.now().toString(), type:"payment",
          date:payDate, time:"",
          amount:Number(payAmount||c.fee||0),
          sessions:Number(paySessions||0),
          note:`Plată: ${paySessions} ședințe`
        }]
      };
    }));
    setModal(null);
  }

  // Delete a history entry
  function deleteEntry(clientId, entryId) {
    setClients(prev=>prev.map(c=>{
      if(c.id!==clientId) return c;
      const entry = (c.history||[]).find(h=>h.id===entryId);
      // If it was a session, restore the count
      const sessRestore = entry?.type==="session" ? 1 : 0;
      return {
        ...c,
        sessionsLeft: (c.sessionsLeft||0) + sessRestore,
        history: (c.history||[]).filter(h=>h.id!==entryId)
      };
    }));
    setDeleteConfirm(null);
  }

  const client = selectedClient ? clients.find(c=>c.id===selectedClient) : null;

  const S = {
    app:{minHeight:"100vh",background:BG,color:TEXT,fontFamily:"'DM Sans',sans-serif",paddingBottom:80},
    header:{background:`linear-gradient(135deg,${CARD} 0%,#12161F 100%)`,borderBottom:`1px solid ${BORDER}`,padding:"18px 18px 12px",position:"sticky",top:0,zIndex:100},
    navTabs:{display:"flex",gap:3,marginTop:12,background:`${CARD2}80`,borderRadius:10,padding:3},
    tab:(a)=>({flex:1,padding:"7px 0",borderRadius:7,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,transition:"all 0.2s",background:a?ACCENT:"transparent",color:a?"#000":MUTED}),
    main:{padding:"16px 14px",maxWidth:500,margin:"0 auto"},
    sTitle:{fontSize:11,fontWeight:700,color:MUTED,letterSpacing:"1px",textTransform:"uppercase",marginBottom:10},
    card:{background:CARD,borderRadius:16,padding:15,border:`1px solid ${BORDER}`,marginBottom:10},
    row:{display:"flex",alignItems:"center",gap:8},
    sb:{display:"flex",alignItems:"center",justifyContent:"space-between"},
    avatar:(g)=>({width:42,height:42,borderRadius:11,background:g==="Female"?"linear-gradient(135deg,#FF6B9D,#C44569)":g==="Male"?"linear-gradient(135deg,#4ECDC4,#2980B9)":"linear-gradient(135deg,#A29BFE,#6C5CE7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}),
    badge:(c,bg)=>({display:"inline-flex",alignItems:"center",gap:3,padding:"3px 8px",borderRadius:6,fontSize:11,fontWeight:700,color:c,background:bg}),
    btn:(v)=>({border:"none",cursor:"pointer",borderRadius:10,fontWeight:700,fontSize:14,transition:"all 0.15s",display:"inline-flex",alignItems:"center",gap:6,...(v==="primary"?{background:ACCENT,color:"#000",padding:"11px 20px"}:v==="danger"?{background:`${ACCENT2}20`,color:ACCENT2,padding:"8px 14px",fontSize:13}:v==="ghost"?{background:CARD2,color:TEXT,padding:"8px 14px",fontSize:13,border:`1px solid ${BORDER}`}:v==="success"?{background:`${ACCENT}20`,color:ACCENT,padding:"8px 14px",fontSize:13}:v==="icon"?{background:"transparent",color:MUTED,padding:"4px 6px",fontSize:15,border:"none"}:{background:CARD2,color:TEXT,padding:"11px 20px",border:`1px solid ${BORDER}`})}),
    input:{width:"100%",background:CARD2,border:`1px solid ${BORDER}`,borderRadius:10,padding:"11px 14px",color:TEXT,fontSize:14,outline:"none",boxSizing:"border-box"},
    label:{fontSize:12,fontWeight:600,color:MUTED,marginBottom:5,display:"block"},
    modal:{position:"fixed",inset:0,background:"#000000CC",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:999,backdropFilter:"blur(4px)"},
    modalBox:{background:CARD,borderRadius:"20px 20px 0 0",padding:"24px 20px 36px",width:"100%",maxWidth:500,border:`1px solid ${BORDER}`,maxHeight:"90vh",overflowY:"auto"},
    divider:{height:1,background:BORDER,margin:"12px 0"},
    statBox:{background:CARD2,borderRadius:10,padding:"9px 6px",textAlign:"center",border:`1px solid ${BORDER}`},
  };

  // ── Reusable history entry renderer ──
  function HistoryEntry({ h, clientId }) {
    return (
      <div style={{...S.card,padding:"11px 14px",marginBottom:7}}>
        <div style={S.sb}>
          <div style={S.row}>
            <span style={{fontSize:17}}>{h.type==="payment"?"💳":"🏋️"}</span>
            <div>
              <div style={{fontSize:13,fontWeight:600}}>{h.note}</div>
              <div style={{fontSize:11,color:MUTED}}>
                {formatDateTime(h.date, h.time)}
              </div>
            </div>
          </div>
          <div style={S.row}>
            {h.type==="payment"&&<span style={S.badge(ACCENT,`${ACCENT}20`)}>+{h.amount} RON</span>}
            {h.type==="session"&&h.sessionPrice>0&&<span style={S.badge("#A29BFE","#A29BFE20")}>{h.sessionPrice} RON</span>}
            <button
              style={{...S.btn("icon"),color:ACCENT2,marginLeft:2}}
              onClick={()=>setDeleteConfirm({clientId,entryId:h.id})}
              title="Șterge"
            >✕</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.app}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>

      {/* DB LOADING */}
      {dbLoading && (
        <div style={{position:"fixed",inset:0,background:"#0D0F14",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:9999}}>
          <div style={{fontSize:40,marginBottom:16}}>💪</div>
          <div style={{color:"#00E5A0",fontSize:14,fontWeight:700}}>Se încarcă datele...</div>
        </div>
      )}

      {/* HEADER */}
      <div style={S.header}>
        <div style={S.sb}>
          <div style={S.row}>
            <div style={{width:34,height:34,borderRadius:9,background:`linear-gradient(135deg,${ACCENT},#00B87A)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>💪</div>
            <div>
              <div style={{fontSize:17,fontWeight:800,letterSpacing:"-0.3px"}}>PT Tracker</div>
              <div style={{fontSize:10,color:MUTED,letterSpacing:"0.5px",textTransform:"uppercase"}}>Personal Trainer Pro</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {tab==="clients"&&!selectedClient&&<button style={S.btn("primary")} onClick={openAddClient}>+ Client</button>}
            <button onClick={()=>supabase.auth.signOut()} title="Deconectare" style={{background:"transparent",border:`1px solid ${BORDER}`,borderRadius:9,padding:"6px 10px",color:MUTED,cursor:"pointer",fontSize:13,fontWeight:700}}>⏻</button>
          </div>
        </div>
        <div style={S.navTabs}>
          {[["clients","👥","Clienți"],["calendar","📅","Calendar"],["today","⚡","Azi"],["summary","📊","Sumar"]].map(([t,icon,label])=>(
            <button key={t} style={S.tab(tab===t)} onClick={()=>{setTab(t);setSelectedClient(null);}}>{icon} {label}</button>
          ))}
        </div>
      </div>

      <div style={S.main}>

        {/* ── CLIENTS LIST ── */}
        {tab==="clients"&&!selectedClient&&(
          <>
            <div style={S.sTitle}>Clienții tăi ({clients.length})</div>
            {clients.length===0&&(
              <div style={{textAlign:"center",padding:"48px 24px",color:MUTED}}>
                <div style={{fontSize:48,marginBottom:12}}>🏋️</div>
                <div style={{fontWeight:700,fontSize:16,marginBottom:6}}>Niciun client încă</div>
                <div style={{fontSize:14}}>Apasă "+ Client" pentru a începe</div>
              </div>
            )}
            {clients.map(c=>{
              const days=daysUntil(c.nextDue),overdue=days!==null&&days<0,soon=days!==null&&days>=0&&days<=5;
              return (
                <div key={c.id} style={{...S.card,cursor:"pointer",border:`1px solid ${overdue?"#FF6B6B50":BORDER}`}} onClick={()=>setSelectedClient(c.id)}>
                  <div style={S.sb}>
                    <div style={S.row}>
                      <div style={S.avatar(c.gender)}>{genderEmoji(c.gender)}</div>
                      <div><div style={{fontSize:15,fontWeight:700}}>{c.name}</div><div style={{fontSize:12,color:MUTED}}>{c.age?`${c.age} ani`:""} · {c.gender}</div></div>
                    </div>
                    {c.nextDue?<span style={S.badge(overdue?ACCENT2:soon?"#FFB74D":ACCENT,overdue?`${ACCENT2}20`:soon?"#FFB74D20":`${ACCENT}20`)}>{overdue?`⚠ ${Math.abs(days)}z`:days===0?"⚡ Azi":`⏳ ${days}z`}</span>:<span style={S.badge(MUTED,CARD2)}>Neplătit</span>}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginTop:10}}>
                    <div style={S.statBox}><div style={{fontSize:17,fontWeight:800,color:ACCENT}}>{c.sessionsLeft??0}</div><div style={{fontSize:9,color:MUTED,fontWeight:700}}>ȘEDINȚE</div></div>
                    <div style={S.statBox}><div style={{fontSize:13,fontWeight:800,color:"#A29BFE"}}>{c.fee?`${c.fee} RON`:"—"}</div><div style={{fontSize:9,color:MUTED,fontWeight:700}}>ABONAMENT</div></div>
                    <div style={S.statBox}><div style={{fontSize:13,fontWeight:800,color:"#FFB74D"}}>{c.sessionPrice?`${c.sessionPrice} RON`:"—"}</div><div style={{fontSize:9,color:MUTED,fontWeight:700}}>PE ȘEDINȚĂ</div></div>
                  </div>
                  {c.sessionsLeft>0&&c.totalSessions>0&&(
                    <div style={{height:5,borderRadius:3,background:BORDER,marginTop:10,overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:3,width:`${Math.min(100,(c.sessionsLeft/c.totalSessions)*100)}%`,background:ACCENT}}/>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* ── CLIENT DETAIL ── */}
        {tab==="clients"&&selectedClient&&client&&(()=>{
          const sessionDates=(client.history||[]).filter(h=>h.type==="session").map(h=>h.date);
          const paymentDates=(client.history||[]).filter(h=>h.type==="payment").map(h=>h.date);
          const days=daysUntil(client.nextDue),overdue=days!==null&&days<0;
          const totalEarned=(client.history||[]).filter(h=>h.type==="payment").reduce((s,h)=>s+Number(h.amount||0),0);
          return (
            <>
              <button style={{...S.btn("ghost"),marginBottom:14,fontSize:13}} onClick={()=>setSelectedClient(null)}>← Înapoi</button>
              <div style={S.card}>
                <div style={S.sb}>
                  <div style={S.row}>
                    <div style={S.avatar(client.gender)}>{genderEmoji(client.gender)}</div>
                    <div><div style={{fontSize:19,fontWeight:800}}>{client.name}</div><div style={{fontSize:12,color:MUTED}}>{client.age?`${client.age} ani`:""} · {client.gender}</div></div>
                  </div>
                  <button style={S.btn("ghost")} onClick={()=>openEditClient(client)}>✏️</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginTop:10}}>
                  <div style={S.statBox}><div style={{fontSize:17,fontWeight:800,color:ACCENT}}>{client.sessionsLeft??0}</div><div style={{fontSize:9,color:MUTED,fontWeight:700}}>ȘEDINȚE</div></div>
                  <div style={S.statBox}><div style={{fontSize:13,fontWeight:800,color:"#A29BFE"}}>{client.fee?`${client.fee} RON`:"—"}</div><div style={{fontSize:9,color:MUTED,fontWeight:700}}>ABONAMENT</div></div>
                  <div style={S.statBox}><div style={{fontSize:13,fontWeight:800,color:"#FFB74D"}}>{client.sessionPrice?`${client.sessionPrice} RON`:"—"}</div><div style={{fontSize:9,color:MUTED,fontWeight:700}}>PE ȘEDINȚĂ</div></div>
                </div>
                {client.sessionsLeft>0&&client.totalSessions>0&&(
                  <>
                    <div style={{height:5,borderRadius:3,background:BORDER,marginTop:12,overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:3,width:`${Math.min(100,(client.sessionsLeft/client.totalSessions)*100)}%`,background:ACCENT}}/>
                    </div>
                    <div style={{fontSize:11,color:MUTED,marginTop:4}}>{client.sessionsLeft} din {client.totalSessions} ședințe rămase</div>
                  </>
                )}
                {client.nextDue&&(
                  <><div style={S.divider}/>
                  <div style={S.sb}>
                    <div><div style={{fontSize:11,color:MUTED,fontWeight:600}}>URMĂTOAREA PLATĂ</div><div style={{fontSize:15,fontWeight:700,marginTop:2}}>{formatDate(client.nextDue)}</div></div>
                    <span style={S.badge(overdue?ACCENT2:days<=5?"#FFB74D":ACCENT,overdue?`${ACCENT2}20`:days<=5?"#FFB74D20":`${ACCENT}20`)}>{overdue?`${Math.abs(days)}z întârziere`:days===0?"Scade azi":`${days} zile`}</span>
                  </div></>
                )}
              </div>

              <div style={{display:"flex",gap:8,marginBottom:16}}>
                <button style={{...S.btn("primary"),flex:1}} onClick={()=>openMarkPaid(client.id)}>💳 Plată</button>
                <button style={{...S.btn("success"),flex:1}} onClick={()=>openMarkSession(client.id)}>✅ Ședință</button>
              </div>

              <div style={S.sTitle}>📅 Calendar prezență</div>
              <div style={{marginBottom:14}}><MiniCalendar sessionDates={sessionDates} paymentDates={paymentDates}/></div>

              <div style={{background:"#A29BFE15",border:"1px solid #A29BFE40",borderRadius:12,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{fontSize:13,color:MUTED,fontWeight:600}}>Total câștigat de la {client.name}</div>
                <div style={{fontSize:20,fontWeight:900,color:"#A29BFE"}}>{totalEarned} RON</div>
              </div>

              <div style={S.sTitle}>Istoric activitate</div>
              {(client.history||[]).length===0&&<div style={{color:MUTED,fontSize:14,padding:"10px 0"}}>Nicio activitate încă</div>}
              {[...(client.history||[])].reverse().map(h=>(
                <HistoryEntry key={h.id} h={h} clientId={client.id}/>
              ))}
              <div style={S.divider}/>
              <button style={{...S.btn("danger"),width:"100%"}} onClick={()=>setDeleteClientConfirm(client.id)}>🗑 Șterge client</button>
            </>
          );
        })()}

        {/* ── CALENDAR TAB ── */}
        {tab==="calendar"&&(
          <>
            <div style={S.sTitle}>📅 Calendar general — toți clienții</div>
            {clients.length===0?<div style={{textAlign:"center",padding:"48px 20px",color:MUTED}}><div style={{fontSize:42,marginBottom:10}}>📅</div><div style={{fontSize:14}}>Adaugă clienți pentru a vedea calendarul</div></div>:<GlobalCalendar clients={clients}/>}
          </>
        )}

        {/* ── TODAY TAB ── */}
        {tab==="today"&&(
          <>
            <div style={S.sTitle}>{new Date().toLocaleDateString("ro-RO",{weekday:"long",day:"numeric",month:"long"})}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              <div style={{background:`${ACCENT}15`,border:`1px solid ${ACCENT}40`,borderRadius:12,padding:14,textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:900,color:ACCENT}}>{todayIncome} RON</div>
                <div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase"}}>Ședințe azi</div>
              </div>
              <div style={{background:"#A29BFE15",border:"1px solid #A29BFE40",borderRadius:12,padding:14,textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:900,color:"#A29BFE"}}>{todayPaymentTotal} RON</div>
                <div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase"}}>Plăți azi</div>
              </div>
            </div>
            <div style={S.sTitle}>Ședințe ({todaySessions.length})</div>
            {todaySessions.length===0?<div style={{color:MUTED,fontSize:14,marginBottom:12}}>Nicio ședință azi</div>:todaySessions.map(s=>(
              <div key={s.id} style={{...S.card,padding:"11px 14px",marginBottom:7}}>
                <div style={S.sb}>
                  <div style={S.row}><span>🏋️</span><div><div style={{fontWeight:600}}>{s.clientName}</div>{s.time&&<div style={{fontSize:11,color:MUTED}}>{s.time}</div>}</div></div>
                  <span style={S.badge(ACCENT,`${ACCENT}20`)}>{s.sessionPrice} RON</span>
                </div>
              </div>
            ))}
            <div style={S.sTitle}>Plăți ({todayPayments.length})</div>
            {todayPayments.length===0?<div style={{color:MUTED,fontSize:14,marginBottom:12}}>Nicio plată azi</div>:todayPayments.map(p=>(
              <div key={p.id} style={{...S.card,padding:"11px 14px",marginBottom:7}}><div style={S.sb}><div style={S.row}><span>💳</span><span style={{fontWeight:600}}>{p.clientName}</span></div><span style={S.badge("#A29BFE","#A29BFE20")}>{p.amount} RON</span></div></div>
            ))}
            <div style={S.divider}/>
            <div style={S.sTitle}>Marchează rapid</div>
            {clients.filter(c=>c.sessionsLeft>0).map(c=>(
              <div key={c.id} style={{...S.card,padding:"11px 14px",marginBottom:7}}>
                <div style={S.sb}>
                  <div style={S.row}><div style={{...S.avatar(c.gender),width:32,height:32,fontSize:15}}>{genderEmoji(c.gender)}</div><div><div style={{fontWeight:600}}>{c.name}</div><div style={{fontSize:12,color:MUTED}}>{c.sessionsLeft} rămase</div></div></div>
                  <button style={S.btn("success")} onClick={()=>openMarkSession(c.id)}>✅ Done</button>
                </div>
              </div>
            ))}
            {clients.filter(c=>c.sessionsLeft>0).length===0&&<div style={{color:MUTED,fontSize:14}}>Niciun client cu ședințe disponibile</div>}
          </>
        )}

        {/* ── SUMMARY TAB ── */}
        {tab==="summary"&&(
          <>
            <div style={S.sTitle}>Prezentare financiară</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              <div style={{background:`${ACCENT}15`,border:`1px solid ${ACCENT}40`,borderRadius:12,padding:14,textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:900,color:ACCENT}}>{todayIncome} RON</div>
                <div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase"}}>Azi</div>
              </div>
              <div style={{background:"#A29BFE15",border:"1px solid #A29BFE40",borderRadius:12,padding:14,textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:900,color:"#A29BFE"}}>{monthIncome} RON</div>
                <div style={{fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase"}}>Luna aceasta</div>
              </div>
            </div>
            <div style={S.sTitle}>Toți clienții</div>
            {clients.map(c=>{
              const days=daysUntil(c.nextDue),overdue=days!==null&&days<0;
              const totalEarned=(c.history||[]).filter(h=>h.type==="payment").reduce((s,h)=>s+Number(h.amount||0),0);
              return (
                <div key={c.id} style={S.card}>
                  <div style={S.sb}>
                    <div style={S.row}><div style={{...S.avatar(c.gender),width:32,height:32,fontSize:15}}>{genderEmoji(c.gender)}</div><div style={{fontWeight:700}}>{c.name}</div></div>
                    {c.nextDue&&<span style={S.badge(overdue?ACCENT2:ACCENT,overdue?`${ACCENT2}20`:`${ACCENT}20`)}>{overdue?`${Math.abs(days)}z întârziere`:`${days}z`}</span>}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginTop:10}}>
                    {[[c.sessionsLeft??0,"ȘEDINȚE",ACCENT],[c.fee?`${c.fee} RON`:"—","ABONAMENT","#FFB74D"],[`${totalEarned} RON`,"TOTAL","#A29BFE"]].map(([v,l,col])=>(
                      <div key={l} style={{background:CARD2,borderRadius:8,padding:"8px 5px",textAlign:"center"}}><div style={{fontSize:13,fontWeight:800,color:col}}>{v}</div><div style={{fontSize:9,color:MUTED,fontWeight:700}}>{l}</div></div>
                    ))}
                  </div>
                </div>
              );
            })}
            {clients.length===0&&<div style={{color:MUTED,fontSize:14,textAlign:"center",padding:24}}>Adaugă clienți pentru a vedea sumarul</div>}
          </>
        )}
      </div>

      {/* ══ MODALS ══ */}

      {/* Add/Edit Client */}
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
            <div style={S.divider}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              <div><label style={S.label}>Abonament (RON)</label><input style={S.input} placeholder="ex. 400" type="number" value={editForm.fee} onChange={e=>setEditForm(p=>({...p,fee:e.target.value}))}/></div>
              <div><label style={S.label}>Preț/ședință (RON)</label><input style={S.input} placeholder="ex. 100" type="number" value={editForm.sessionPrice} onChange={e=>setEditForm(p=>({...p,sessionPrice:e.target.value}))}/></div>
            </div>
            <label style={S.label}>Ciclu plată (zile)</label>
            <input style={{...S.input,marginBottom:18}} placeholder="ex. 30" type="number" value={editForm.dueDays} onChange={e=>setEditForm(p=>({...p,dueDays:Number(e.target.value)}))}/>
            <div style={{display:"flex",gap:8}}>
              <button style={{...S.btn(),flex:1}} onClick={()=>setModal(null)}>Anulează</button>
              <button style={{...S.btn("primary"),flex:2}} onClick={saveClient}>{modal.type==="addClient"?"Adaugă client":"Salvează"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MARK SESSION MODAL ── */}
      {modal?.type==="markSession"&&(()=>{
        const c=clients.find(x=>x.id===modal.clientId);
        return (
          <div style={S.modal} onClick={()=>setModal(null)}>
            <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
              {/* Header */}
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <div style={{width:38,height:38,borderRadius:10,background:`${ACCENT}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🏋️</div>
                <div>
                  <div style={{fontSize:18,fontWeight:800}}>Înregistrează ședință</div>
                  <div style={{fontSize:13,color:MUTED}}>{c?.name} · {c?.sessionsLeft} rămase</div>
                </div>
              </div>
              <div style={S.divider}/>

              {/* Date */}
              <label style={S.label}>📅 Data ședinței</label>
              <input
                type="date"
                style={{...S.input,marginBottom:14,colorScheme:"dark"}}
                value={sessDate}
                onChange={e=>setSessDate(e.target.value)}
              />

              {/* Time */}
              <label style={S.label}>🕐 Ora ședinței</label>
              <input
                type="time"
                style={{...S.input,marginBottom:18,colorScheme:"dark"}}
                value={sessTime}
                onChange={e=>setSessTime(e.target.value)}
              />

              {/* Preview */}
              <div style={{background:CARD2,borderRadius:10,padding:"12px 14px",marginBottom:18,border:`1px solid ${BORDER}`}}>
                <div style={{fontSize:12,color:MUTED,marginBottom:4,fontWeight:600}}>REZUMAT</div>
                <div style={{fontSize:14,fontWeight:700}}>{c?.name}</div>
                <div style={{fontSize:13,color:MUTED,marginTop:2}}>
                  {sessDate ? formatDate(sessDate) : "—"}{sessTime ? ` la ${sessTime}` : ""}
                </div>
                {c?.sessionPrice>0&&<div style={{fontSize:13,color:ACCENT,marginTop:4,fontWeight:700}}>Valoare: {c.sessionPrice} RON</div>}
              </div>

              <div style={{display:"flex",gap:8}}>
                <button style={{...S.btn(),flex:1}} onClick={()=>setModal(null)}>Anulează</button>
                <button style={{...S.btn("primary"),flex:2}} onClick={confirmSession} disabled={!sessDate}>✅ Confirmă ședința</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── MARK PAID MODAL ── */}
      {modal?.type==="markPaid"&&(()=>{
        const c=clients.find(x=>x.id===modal.clientId);
        const nextDuePreview = payDate && payDueDays ? addDays(payDate, payDueDays) : null;
        return (
          <div style={S.modal} onClick={()=>setModal(null)}>
            <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <div style={{width:38,height:38,borderRadius:10,background:"#A29BFE20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>💳</div>
                <div>
                  <div style={{fontSize:18,fontWeight:800}}>Înregistrează plată</div>
                  <div style={{fontSize:13,color:MUTED}}>{c?.name}</div>
                </div>
              </div>
              <div style={S.divider}/>

              {/* Payment date */}
              <label style={S.label}>📅 Data plății</label>
              <input
                type="date"
                style={{...S.input,marginBottom:14,colorScheme:"dark"}}
                value={payDate}
                onChange={e=>setPayDate(e.target.value)}
              />

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                <div>
                  <label style={S.label}>Sumă (RON)</label>
                  <input style={S.input} type="number" placeholder="ex. 400" value={payAmount} onChange={e=>setPayAmount(e.target.value)}/>
                </div>
                <div>
                  <label style={S.label}>Ședințe cumpărate</label>
                  <input style={S.input} type="number" placeholder="ex. 8" value={paySessions} onChange={e=>setPaySessions(e.target.value)}/>
                </div>
              </div>

              <label style={S.label}>⏳ Scadență următoare (zile)</label>
              <input style={{...S.input,marginBottom:12}} type="number" placeholder="ex. 30" value={payDueDays} onChange={e=>setPayDueDays(Number(e.target.value))}/>

              {/* Preview */}
              {nextDuePreview&&(
                <div style={{background:CARD2,borderRadius:10,padding:"12px 14px",marginBottom:18,border:`1px solid ${BORDER}`}}>
                  <div style={{fontSize:12,color:MUTED,marginBottom:4,fontWeight:600}}>REZUMAT</div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:13,color:MUTED}}>Data plății</div>
                      <div style={{fontSize:14,fontWeight:700}}>{formatDate(payDate)}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:13,color:MUTED}}>Următoarea scadență</div>
                      <div style={{fontSize:14,fontWeight:700,color:ACCENT}}>{formatDate(nextDuePreview)}</div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{display:"flex",gap:8}}>
                <button style={{...S.btn(),flex:1}} onClick={()=>setModal(null)}>Anulează</button>
                <button style={{...S.btn("primary"),flex:2}} onClick={confirmPayment}>✅ Confirmă plata</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── DELETE CLIENT CONFIRM ── */}
      {deleteClientConfirm&&(()=>{
        const c = clients.find(x=>x.id===deleteClientConfirm);
        return (
          <div style={S.modal} onClick={()=>setDeleteClientConfirm(null)}>
            <div style={{...S.modalBox,padding:"28px 20px 36px"}} onClick={e=>e.stopPropagation()}>
              <div style={{textAlign:"center",marginBottom:20}}>
                <div style={{fontSize:42,marginBottom:12}}>⚠️</div>
                <div style={{fontSize:18,fontWeight:800,marginBottom:8}}>Ștergi clientul?</div>
                <div style={{fontSize:14,color:MUTED,lineHeight:1.5}}>
                  Ești sigur că vrei să ștergi<br/>
                  <strong style={{color:TEXT}}>{c?.name}</strong>?<br/>
                  Toate datele și istoricul vor fi pierdute definitiv.
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button style={{...S.btn(),flex:1}} onClick={()=>setDeleteClientConfirm(null)}>Anulează</button>
                <button
                  style={{...S.btn("danger"),flex:1,justifyContent:"center",background:ACCENT2,color:"#fff"}}
                  onClick={()=>{ deleteClient(deleteClientConfirm); setDeleteClientConfirm(null); }}
                >🗑 Da, șterge</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── DELETE ENTRY CONFIRM ── */}
      {deleteConfirm&&(
        <div style={S.modal} onClick={()=>setDeleteConfirm(null)}>
          <div style={{...S.modalBox,padding:"24px 20px 32px"}} onClick={e=>e.stopPropagation()}>
            <div style={{textAlign:"center",marginBottom:16}}>
              <div style={{fontSize:36,marginBottom:10}}>🗑️</div>
              <div style={{fontSize:17,fontWeight:800,marginBottom:6}}>Ștergi această înregistrare?</div>
              <div style={{fontSize:13,color:MUTED}}>Dacă este o ședință, ședința va fi restituită clientului.</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button style={{...S.btn(),flex:1}} onClick={()=>setDeleteConfirm(null)}>Anulează</button>
              <button style={{...S.btn("danger"),flex:1,justifyContent:"center"}} onClick={()=>deleteEntry(deleteConfirm.clientId,deleteConfirm.entryId)}>✕ Șterge</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════ AUTH SCREEN ══════════════════════════════
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const ACCENT = "#00E5A0";
  const BG = "#0D0F14";
  const CARD = "#161A23";
  const CARD2 = "#1E2330";
  const BORDER = "#2A3040";
  const TEXT = "#E8ECF4";
  const MUTED = "#6B7590";
  const ACCENT2 = "#FF6B6B";

  async function handleSubmit() {
    setError(""); setSuccess(""); setLoading(true);
    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccess("Cont creat! Verifică emailul pentru confirmare.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuth();
      }
    } catch (e) {
      setError(e.message || "A apărut o eroare.");
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight:"100vh", background:BG, display:"flex", alignItems:"center", justifyContent:"center", padding:20, fontFamily:"'DM Sans',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
      <div style={{ width:"100%", maxWidth:400 }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ width:60, height:60, borderRadius:16, background:`linear-gradient(135deg,${ACCENT},#00B87A)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:30, margin:"0 auto 14px" }}>💪</div>
          <div style={{ fontSize:26, fontWeight:900, color:TEXT, letterSpacing:"-0.5px" }}>PT Tracker</div>
          <div style={{ fontSize:13, color:MUTED, marginTop:4, textTransform:"uppercase", letterSpacing:"0.8px" }}>Personal Trainer Pro</div>
        </div>

        {/* Card */}
        <div style={{ background:CARD, borderRadius:20, padding:"28px 24px", border:`1px solid ${BORDER}` }}>

          {/* Mode toggle */}
          <div style={{ display:"flex", background:CARD2, borderRadius:10, padding:3, marginBottom:24 }}>
            {[["login","Autentificare"],["register","Înregistrare"]].map(([m,label])=>(
              <button key={m} onClick={()=>{ setMode(m); setError(""); setSuccess(""); }} style={{ flex:1, padding:"8px 0", borderRadius:8, border:"none", cursor:"pointer", fontSize:13, fontWeight:700, transition:"all 0.2s", background:mode===m?ACCENT:"transparent", color:mode===m?"#000":MUTED }}>
                {label}
              </button>
            ))}
          </div>

          {/* Email */}
          <label style={{ fontSize:12, fontWeight:700, color:MUTED, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px" }}>Email</label>
          <input
            type="email"
            placeholder="exemplu@email.com"
            value={email}
            onChange={e=>setEmail(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
            style={{ width:"100%", background:CARD2, border:`1px solid ${BORDER}`, borderRadius:10, padding:"12px 14px", color:TEXT, fontSize:14, outline:"none", boxSizing:"border-box", marginBottom:14 }}
          />

          {/* Password */}
          <label style={{ fontSize:12, fontWeight:700, color:MUTED, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px" }}>Parolă</label>
          <input
            type="password"
            placeholder="Minim 6 caractere"
            value={password}
            onChange={e=>setPassword(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
            style={{ width:"100%", background:CARD2, border:`1px solid ${BORDER}`, borderRadius:10, padding:"12px 14px", color:TEXT, fontSize:14, outline:"none", boxSizing:"border-box", marginBottom:20 }}
          />

          {/* Error / Success */}
          {error && <div style={{ background:`${ACCENT2}15`, border:`1px solid ${ACCENT2}40`, borderRadius:10, padding:"10px 14px", fontSize:13, color:ACCENT2, marginBottom:16 }}>⚠ {error}</div>}
          {success && <div style={{ background:`${ACCENT}15`, border:`1px solid ${ACCENT}40`, borderRadius:10, padding:"10px 14px", fontSize:13, color:ACCENT, marginBottom:16 }}>✓ {success}</div>}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading || !email || !password}
            style={{ width:"100%", background:ACCENT, color:"#000", border:"none", borderRadius:12, padding:"14px", fontSize:15, fontWeight:800, cursor:loading?"not-allowed":"pointer", opacity:loading||!email||!password?0.6:1, transition:"opacity 0.2s" }}
          >
            {loading ? "Se procesează..." : mode==="login" ? "Intră în cont" : "Creează cont"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════ ROOT WRAPPER ══════════════════════════════
export default function Root() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = logged out

  useEffect(() => {
    // Check current session on load
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user ?? null));

    // Listen for login/logout changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Loading state
  if (user === undefined) {
    return (
      <div style={{ minHeight:"100vh", background:"#0D0F14", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ color:"#6B7590", fontSize:14, fontFamily:"sans-serif" }}>Se încarcă...</div>
      </div>
    );
  }

  // Not logged in → show auth screen
  if (!user) return <AuthScreen onAuth={() => supabase.auth.getUser().then(({ data: { user } }) => setUser(user))} />;

  // Logged in → show the app
  return <App user={user} />;
}
