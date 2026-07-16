import { useState, useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

/* ---------- design tokens ---------- */
const T = {
  bg: "#F4F5F1", card: "#FFFFFF", ink: "#15221B", sub: "#5C6B62", line: "#E2E5DD",
  pine: "#1E4D38", pineSoft: "#E4EEE8", lane: "#E8590C", laneSoft: "#FDEBE0",
  teal: "#0B7285", tealSoft: "#E0F1F4",
};

const fontImport = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600&display=swap');
`;

const globalCss = fontImport + `
  input:focus, textarea:focus { border-color: ${T.pine} !important; }
  button:focus-visible { outline: 2px solid ${T.lane}; outline-offset: 2px; }
  * { -webkit-tap-highlight-color: transparent; }
  .ts-row:hover td { background: #EFF4EF; }
  @keyframes tsDrift1 { from { transform: translate3d(-6%,-4%,0) scale(1); } to { transform: translate3d(6%,5%,0) scale(1.18); } }
  @keyframes tsDrift2 { from { transform: translate3d(5%,6%,0) scale(1.12); } to { transform: translate3d(-5%,-6%,0) scale(0.95); } }
  @keyframes tsGlide { 0%,100% { transform: translate3d(-3%,1%,0) rotate(-2deg) scale(1); } 50% { transform: translate3d(3%,-2%,0) rotate(1.5deg) scale(1.07); } }
  @keyframes tsGlide2 { 0%,100% { transform: translate3d(2%,-1%,0) rotate(1deg) scale(1.05); } 50% { transform: translate3d(-3%,2%,0) rotate(-1.5deg) scale(0.97); } }
  @keyframes tsStreak { from { transform: translateX(-25%); opacity: 0; } 50% { opacity: 1; } to { transform: translateX(25%); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .ts-motion * { animation: none !important; } }
`;

const S = {
  app: { fontFamily: "'Barlow', sans-serif", background: T.bg, minHeight: "100vh", color: T.ink, maxWidth: 480, margin: "0 auto", position: "relative", paddingBottom: 90 },
  wide: { fontFamily: "'Barlow', sans-serif", background: T.bg, minHeight: "100vh", color: T.ink, maxWidth: 1080, margin: "0 auto", padding: "0 20px 40px" },
  display: { fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", letterSpacing: "0.04em" },
  card: { background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 16, marginBottom: 12 },
  glass: { background: "rgba(255,255,255,0.86)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,0.65)", boxShadow: "0 8px 32px rgba(21,34,27,0.10)", borderRadius: 14, padding: 16, marginBottom: 12 },
  label: { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: T.sub },
  input: { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 16, fontFamily: "'Barlow', sans-serif", background: "#FBFBF9", color: T.ink, outline: "none" },
  btn: { background: T.pine, color: "#fff", border: "none", borderRadius: 12, padding: "13px 18px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'Barlow', sans-serif", width: "100%" },
  btnGhost: { background: "transparent", color: T.pine, border: `1.5px solid ${T.pine}`, borderRadius: 12, padding: "11px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Barlow', sans-serif" },
  chipBtn: (on) => ({ padding: "9px 14px", borderRadius: 999, border: `1.5px solid ${on ? T.pine : T.line}`, background: on ? T.pine : "#FBFBF9", color: on ? "#fff" : T.ink, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "'Barlow', sans-serif" }),
  chip: { display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999, fontSize: 12, fontWeight: 600 },
};

/* ---------- storage keys ---------- */
const K = {
  session: "ftrack:session",
  account: (p) => `ftrack:account:${p}`,
  clients: "ftrack:clients",
  trainers: "ftrack:trainers",
  invites: "ftrack:invites",
  checkins: (p) => `ftrack:checkins:${p}`,
  feedback: (p) => `ftrack:feedback:${p}`,
  avatar: (p) => `ftrack:avatar:${p}`,
  gallery: (p, i) => `ftrack:gallery:${p}:${i}`,
  photo: (p, id, slot) => `ftrack:photo:${p}:${id}:${slot}`,
};

/* ---------- helpers ---------- */
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDay = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const fmtFull = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const daysSince = (d) => Math.floor((new Date(todayStr()) - new Date(d)) / 86400000);
const coachCode = (phone) => ("C" + parseInt(phone.slice(-6)).toString(36)).toUpperCase();

async function loadJSON(key, fallback) {
  try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : fallback; }
  catch { return fallback; }
}
async function saveJSON(key, val) {
  try { await window.storage.set(key, JSON.stringify(val)); } catch (e) { console.error("save failed", e); }
}
async function loadRaw(key) {
  try { const r = await window.storage.get(key); return r?.value || null; } catch { return null; }
}

function compressImage(file, maxDim = 640) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------- demo data ---------- */
function makeDemoPhoto(progress, dateLabel) {
  const c = document.createElement("canvas");
  c.width = 480; c.height = 640;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 640);
  grad.addColorStop(0, "#DFE7E0"); grad.addColorStop(1, "#C6D3C8");
  g.fillStyle = grad; g.fillRect(0, 0, 480, 640);
  g.fillStyle = "#43554A";
  g.beginPath(); g.arc(240, 145, 50, 0, Math.PI * 2); g.fill();
  const shoulder = 148, waist = 124 - progress * 28;
  g.beginPath();
  g.moveTo(240 - shoulder / 1.6, 210); g.lineTo(240 + shoulder / 1.6, 210);
  g.lineTo(240 + waist / 1.6, 425); g.lineTo(240 - waist / 1.6, 425);
  g.closePath(); g.fill();
  g.fillRect(240 - waist / 1.6, 425, waist / 2, 155);
  g.fillRect(240 + waist / 1.6 - waist / 2, 425, waist / 2, 155);
  g.fillStyle = "#2C3A31"; g.font = "600 20px sans-serif"; g.textAlign = "center";
  g.fillText("Demo photo · " + dateLabel, 240, 612);
  return c.toDataURL("image/jpeg", 0.7);
}

function makeGalleryPhoto(label) {
  const c = document.createElement("canvas");
  c.width = 480; c.height = 360;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 480, 360);
  grad.addColorStop(0, "#1E4D38"); grad.addColorStop(1, "#0B7285");
  g.fillStyle = grad; g.fillRect(0, 0, 480, 360);
  g.strokeStyle = "rgba(255,255,255,0.25)"; g.lineWidth = 6;
  g.beginPath(); g.moveTo(80, 180); g.lineTo(400, 180); g.stroke(); // barbell bar
  for (const x of [90, 120, 360, 390]) { g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(x - 8, 130, 16, 100); }
  g.fillStyle = "#fff"; g.font = "600 22px sans-serif"; g.textAlign = "center";
  g.fillText(label, 240, 320);
  return c.toDataURL("image/jpeg", 0.75);
}

async function seedDemoCheckins(phone, { days = 21, startW = 82.4, loss = 2.8, startWaist = 92, waistLoss = 2.2, endGap = 0 } = {}) {
  const existing = await loadJSON(K.checkins(phone), []);
  const have = new Set(existing.map((c) => c.date));
  const out = [...existing];
  const noteBank = ["Slept badly, low energy today", "Ate out for dinner — biryani, no regrets", "Best workout in weeks", "Long day at work, skipped steps", "Feeling lighter already", ""];
  const photoDays = new Set([days - 1, Math.floor(days / 2), endGap]);
  for (let i = days - 1; i >= endGap; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    if (have.has(date)) continue;
    if (i > endGap + 5 && (i * 7 + phone.charCodeAt(9)) % 9 === 0) continue;
    const prog = (days - 1 - i) / Math.max(days - 1, 1);
    const id = `demo-${phone.slice(-4)}-${date}`;
    const hasFront = photoDays.has(i);
    if (hasFront) { try { await window.storage.set(K.photo(phone, id, "front"), makeDemoPhoto(prog, fmtDay(date))); } catch {} }
    out.push({
      id, date,
      weight: (startW - prog * loss + Math.sin(i * 1.7) * 0.35).toFixed(1),
      waist: (startWaist - prog * waistLoss + Math.sin(i * 1.3) * 0.25).toFixed(1),
      chest: (101 + prog * 0.6).toFixed(1),
      arm: (34.5 + prog * 0.4).toFixed(1),
      energy: 2 + ((i * 3) % 4), sleep: (6 + ((i * 2) % 5) * 0.5).toFixed(1),
      nutrition: 2 + ((i * 5) % 4), workout: i % 3 !== 1,
      notes: noteBank[i % noteBank.length],
      hasFront, hasSide: false,
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  await saveJSON(K.checkins(phone), out);

  const fb = await loadJSON(K.feedback(phone), []);
  if (fb.length === 0) {
    await saveJSON(K.feedback(phone), [{
      id: "demo-fb", date: todayStr(),
      text: "Strong three weeks — weight is trending down steadily and your training consistency is the reason. Energy dips on poor-sleep days, so let's protect your sleep this week and keep the streak alive.",
      actions: [
        { id: "demo-a1", text: "Hit 8,000 steps every day this week", done: false },
        { id: "demo-a2", text: "Lights out by 11pm on weekdays", done: true },
        { id: "demo-a3", text: "Add one protein source at breakfast", done: false },
      ],
    }]);
  }
}

async function seedDemoClients(trainerPhone) {
  const demo = [
    { phone: "9000000001", name: "Ananya Rao", age: "29", sex: "Female", goal: "Lose fat", freq: "3–4 / week", targetWeight: "58", note: "Vegetarian", opts: { days: 21, startW: 64.5, loss: 2.1, startWaist: 78, waistLoss: 2.4, endGap: 0 } },
    { phone: "9000000002", name: "Vikram Singh", age: "41", sex: "Male", goal: "Build muscle", freq: "5+ / week", targetWeight: "", note: "Old shoulder injury", opts: { days: 18, startW: 71.2, loss: -1.4, startWaist: 84, waistLoss: 0.4, endGap: 1 } },
    { phone: "9000000003", name: "Priya Sharma", age: "34", sex: "Female", goal: "Stay consistent", freq: "1–2 / week", targetWeight: "", note: "Travels for work", opts: { days: 21, startW: 59.8, loss: 0.6, startWaist: 74, waistLoss: 0.5, endGap: 5 } },
  ];
  const clients = await loadJSON(K.clients, []);
  for (const d of demo) {
    await saveJSON(K.account(d.phone), { role: "client", createdAt: todayStr(), trainerId: trainerPhone, profile: { name: d.name, age: d.age, sex: d.sex, goal: d.goal, freq: d.freq, targetWeight: d.targetWeight, note: d.note, hasAvatar: false } });
    await seedDemoCheckins(d.phone, d.opts);
    if (!clients.includes(d.phone)) clients.push(d.phone);
  }
  await saveJSON(K.clients, clients);
}

const SAMPLE_TRAINER_PROFILE = {
  name: "Arjun Mehta",
  headline: "Strength & fat-loss coach",
  years: "9",
  location: "Gachibowli, Hyderabad",
  philosophy: "No crash diets, no punishment workouts. We build habits you can hold for a decade: train hard three times a week, walk daily, eat food you actually like in amounts that work. Progress photos and honest check-ins beat motivation every time.",
  credentials: "ACE Certified Personal Trainer\nPrecision Nutrition L1\nEx-state-level powerlifter\n200+ client transformations",
  specialties: ["Fat loss", "Strength", "Busy professionals"],
  hasAvatar: false, galleryCount: 0,
};

/* ---------- shared bits ---------- */
function computeStreak(checkins) {
  let s = 0;
  const dates = new Set(checkins.map((c) => c.date));
  let d = new Date();
  if (!dates.has(todayStr())) d.setDate(d.getDate() - 1);
  while (dates.has(d.toISOString().slice(0, 10))) { s++; d.setDate(d.getDate() - 1); }
  return s;
}

function Delta({ curr, prev, unit, goodWhenDown = true }) {
  if (curr == null || prev == null || curr === "" || prev === "") return null;
  const d = +((+curr) - (+prev)).toFixed(1);
  if (d === 0) return <span style={{ ...S.chip, background: "#EEF0EA", color: T.sub }}>— 0</span>;
  const down = d < 0;
  const good = goodWhenDown ? down : !down;
  return (
    <span style={{ ...S.chip, background: good ? T.tealSoft : T.laneSoft, color: good ? T.teal : T.lane }}>
      {down ? "▾" : "▴"} {Math.abs(d)}{unit}
    </span>
  );
}

function Avatar({ src, name, size = 44 }) {
  return src
    ? <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: `2px solid ${T.pineSoft}`, flex: "none" }} />
    : <div style={{ width: size, height: size, borderRadius: "50%", background: T.pineSoft, color: T.pine, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.4, flex: "none", fontFamily: "'Barlow Condensed', sans-serif" }}>{(name || "?").slice(0, 1).toUpperCase()}</div>;
}

/* ---------- motion background: blurred athletes, drifting light ---------- */
function Sprinter(props) {
  return (
    <svg viewBox="0 0 260 210" {...props}>
      <g stroke="currentColor" strokeWidth="17" strokeLinecap="round" fill="none">
        <path d="M148 62 L120 112" />
        <path d="M142 74 L176 92 L204 78" />
        <path d="M136 82 L102 86 L78 64" />
        <path d="M120 112 L158 136 L172 178" />
        <path d="M120 112 L86 130 L48 118" />
      </g>
      <circle cx="158" cy="40" r="18" fill="currentColor" />
    </svg>
  );
}
function Lifter(props) {
  return (
    <svg viewBox="0 0 200 230" {...props}>
      <g stroke="currentColor" strokeWidth="16" strokeLinecap="round" fill="none">
        <path d="M100 74 L100 134" />
        <path d="M100 84 L66 46" />
        <path d="M100 84 L134 46" />
        <path d="M100 134 L72 172 L76 208" />
        <path d="M100 134 L128 172 L124 208" />
        <path d="M28 42 L172 42" strokeWidth="10" />
      </g>
      <circle cx="100" cy="58" r="16" fill="currentColor" />
      <circle cx="28" cy="42" r="13" fill="currentColor" />
      <circle cx="172" cy="42" r="13" fill="currentColor" />
    </svg>
  );
}
function MotionBg({ intensity = 1 }) {
  const blob = (bg, style, anim) => (
    <div style={{ position: "absolute", width: "58vmax", height: "58vmax", borderRadius: "50%", background: bg, filter: "blur(70px)", opacity: Math.min(1, 0.5 * intensity), animation: anim, ...style }} />
  );
  return (
    <div className="ts-motion" aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none", background: T.bg }}>
      {blob(`radial-gradient(circle at 30% 30%, #BFD8C7, transparent 62%)`, { top: "-18%", left: "-15%" }, "tsDrift1 26s ease-in-out infinite alternate")}
      {blob(`radial-gradient(circle at 60% 40%, #F3D9C2, transparent 62%)`, { bottom: "-24%", right: "-14%" }, "tsDrift2 34s ease-in-out infinite alternate")}
      {blob(`radial-gradient(circle at 50% 50%, #CFE3EA, transparent 58%)`, { top: "26%", right: "30%", width: "40vmax", height: "40vmax" }, "tsDrift1 42s ease-in-out infinite alternate-reverse")}
      <Sprinter style={{ position: "absolute", width: "64vmin", bottom: "-5%", left: "-7%", color: T.pine, opacity: Math.min(0.3, 0.10 * intensity), filter: "blur(9px)", animation: "tsGlide 22s ease-in-out infinite" }} />
      <Lifter style={{ position: "absolute", width: "46vmin", top: "3%", right: "-5%", color: T.teal, opacity: Math.min(0.3, 0.09 * intensity), filter: "blur(11px)", animation: "tsGlide2 28s ease-in-out infinite" }} />
      <div style={{ position: "absolute", top: "38%", left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${T.pine}33, transparent)`, filter: "blur(1px)", animation: "tsStreak 9s ease-in-out infinite" }} />
      <div style={{ position: "absolute", top: "64%", left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${T.lane}26, transparent)`, filter: "blur(2px)", animation: "tsStreak 13s ease-in-out infinite" }} />
    </div>
  );
}

const GOALS = ["Lose fat", "Build muscle", "Get fitter", "Stay consistent"];
const FREQS = ["1–2 / week", "3–4 / week", "5+ / week"];
const SEXES = ["Male", "Female", "Other"];
const SPECIALTIES = ["Fat loss", "Strength", "Muscle gain", "Yoga & mobility", "Running", "Busy professionals", "Post-natal", "Seniors"];

/* ==================================================================== */
export default function App() {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await loadJSON(K.session, null);
      if (session) setUser(session);
      setLoaded(true);
    })();
  }, []);

  const login = async (u) => { setUser(u); await saveJSON(K.session, u); };
  const logout = async () => { try { await window.storage.delete(K.session); } catch {} setUser(null); };

  if (!loaded) return (
    <div style={{ ...S.app, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <style>{globalCss}</style>
      <div style={{ ...S.display, fontSize: 22, color: T.sub }}>Loading…</div>
    </div>
  );

  if (!user) return <Login onLogin={login} />;
  if (user.role === "trainer") return <TrainerConsole trainer={user} onLogout={logout} />;
  return <ClientApp user={user} onLogout={logout} />;
}

/* ==================================================================== */
/* LOGIN                                                                 */
/* ==================================================================== */
function Login({ onLogin }) {
  const [step, setStep] = useState("phone");
  const [asTrainer, setAsTrainer] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [entered, setEntered] = useState("");
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [invite, setInvite] = useState(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendOtp = () => {
    const clean = phone.replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(clean)) { setError("Enter a valid 10-digit Indian mobile number."); return; }
    setError(""); setPhone(clean);
    setOtp(String(Math.floor(100000 + Math.random() * 900000)));
    setEntered(""); setCooldown(30); setStep("otp");
  };

  const verify = async () => {
    if (entered.trim() !== otp) { setError("That code doesn't match. Check and try again."); return; }
    setError("");
    const existing = await loadJSON(K.account(phone), null);
    if (existing?.role === "trainer") { onLogin({ phone, role: "trainer" }); return; }
    if (existing?.role === "client" && existing.profile?.name) { onLogin({ phone, role: "client" }); return; }
    if (asTrainer) {
      await saveJSON(K.account(phone), { ...(existing || {}), role: "trainer", createdAt: todayStr() });
      const trainers = await loadJSON(K.trainers, []);
      if (!trainers.includes(phone)) await saveJSON(K.trainers, [...trainers, phone]);
      onLogin({ phone, role: "trainer" });
      return;
    }
    // invite-only: clients can sign up only if a coach invited this number
    const invites = await loadJSON(K.invites, []);
    const inv = invites.find((i) => i.phone === phone && i.status === "pending");
    if (!inv) {
      setError("This number hasn't been invited yet. Trackside is invite-only — ask your coach to send you an invite.");
      setStep("phone");
      return;
    }
    const tAcct = await loadJSON(K.account(inv.trainerId), {});
    setInvite({ trainerId: inv.trainerId, trainerName: tAcct.trainerProfile?.name || "your coach", prefillName: inv.name || "" });
    setStep("onboarding");
  };

  if (step === "onboarding") return <Onboarding phone={phone} invite={invite} onDone={(u) => onLogin(u)} />;

  return (
    <div style={{ ...S.app, background: "transparent", display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100vh", padding: "0 20px 40px", boxSizing: "border-box" }}>
      <style>{globalCss}</style>
      <MotionBg intensity={1.5} />
      <div style={{ position: "relative", zIndex: 1 }}>
      <div style={{ marginBottom: 28, textAlign: "center" }}>
        <div style={{ ...S.display, fontSize: 40, fontWeight: 700, color: T.pine, lineHeight: 1 }}>Trackside</div>
        <div style={{ fontSize: 14, color: T.sub, marginTop: 6 }}>{asTrainer ? "Coach console" : "Daily progress, coached weekly."}</div>
      </div>

      {step === "phone" && (
        <div style={S.glass}>
          <div style={{ ...S.display, fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{asTrainer ? "Coach sign-in" : "Sign in"}</div>
          <div style={{ fontSize: 13, color: T.sub, marginBottom: 14 }}>We'll text a one-time code to verify it's you.</div>
          <div style={{ ...S.label, marginBottom: 4 }}>Mobile number</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <div style={{ ...S.input, width: 64, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: T.sub }}>+91</div>
            <input style={S.input} type="tel" inputMode="numeric" placeholder="98765 43210" maxLength={10} value={phone} autoFocus
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && sendOtp()} />
          </div>
          {error && <div style={{ fontSize: 13, color: T.lane, marginBottom: 10 }}>{error}</div>}
          <button style={S.btn} onClick={sendOtp}>Send OTP</button>
        </div>
      )}

      {step === "otp" && (
        <div style={S.glass}>
          <div style={{ ...S.display, fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Enter the code</div>
          <div style={{ fontSize: 13, color: T.sub, marginBottom: 14 }}>
            Sent to +91 {phone.slice(0, 5)} {phone.slice(5)} · <button onClick={() => { setStep("phone"); setError(""); }} style={{ background: "none", border: "none", color: T.pine, cursor: "pointer", fontSize: 13, fontFamily: "inherit", padding: 0, textDecoration: "underline" }}>change</button>
          </div>
          <div style={{ background: T.pineSoft, border: `1px dashed ${T.pine}`, borderRadius: 10, padding: "10px 12px", marginBottom: 14, fontSize: 13 }}>
            <span style={{ ...S.label, color: T.pine }}>Demo mode</span> — no SMS is sent from this prototype. Your code is <strong style={{ letterSpacing: "0.15em" }}>{otp}</strong>
          </div>
          <input style={{ ...S.input, textAlign: "center", fontSize: 24, letterSpacing: "0.4em", fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 12 }}
            type="text" inputMode="numeric" maxLength={6} placeholder="••••••" autoFocus value={entered}
            onChange={(e) => setEntered(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && verify()} />
          {error && <div style={{ fontSize: 13, color: T.lane, marginBottom: 10 }}>{error}</div>}
          <button style={S.btn} onClick={verify}>Verify & continue</button>
          <button disabled={cooldown > 0} onClick={sendOtp}
            style={{ background: "none", border: "none", width: "100%", marginTop: 10, color: cooldown > 0 ? T.sub : T.pine, fontSize: 13, cursor: cooldown > 0 ? "default" : "pointer", fontFamily: "inherit" }}>
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        </div>
      )}

      <button onClick={() => { setAsTrainer(!asTrainer); setStep("phone"); setError(""); }}
        style={{ background: "none", border: "none", color: "#9AA69E", fontSize: 12, cursor: "pointer", fontFamily: "inherit", marginTop: 18 }}>
        {asTrainer ? "← Back to client sign-in" : "Coach sign-in"}
      </button>
      </div>
    </div>
  );
}

/* ==================================================================== */
/* ONBOARDING — invite-aware (linking is trainer-driven only)            */
/* ==================================================================== */
function Onboarding({ phone, invite: inviteProp, onDone }) {
  const [invite, setInvite] = useState(inviteProp || null);
  const [step, setStep] = useState(1);
  const [avatar, setAvatar] = useState(null);
  const [name, setName] = useState(inviteProp?.prefillName || "");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [goal, setGoal] = useState("");
  const [freq, setFreq] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // if we weren't handed an invite (e.g. resuming signup in-app), look one up
  useEffect(() => {
    if (inviteProp) return;
    (async () => {
      const invites = await loadJSON(K.invites, []);
      const i = invites.find((x) => x.phone === phone && x.status === "pending");
      if (i) {
        const tAcct = await loadJSON(K.account(i.trainerId), {});
        setInvite({ trainerId: i.trainerId, trainerName: tAcct.trainerProfile?.name || "your coach", prefillName: i.name || "" });
        setName((n) => n || i.name || "");
      }
    })();
  }, [phone, inviteProp]);

  const onAvatar = async (file) => {
    if (!file) return;
    try { setAvatar(await compressImage(file, 320)); } catch { alert("Couldn't read that photo — try another."); }
  };

  const next = () => {
    if (!name.trim()) { setError("Just your name — everything else is optional."); return; }
    setError(""); setStep(2);
  };

  const finish = async () => {
    setSaving(true);
    const trainerId = invite?.trainerId || null;
    const profile = { name: name.trim(), age, sex, goal, freq, targetWeight, note, hasAvatar: !!avatar };
    await saveJSON(K.account(phone), { role: "client", profile, trainerId, createdAt: todayStr() });
    if (avatar) { try { await window.storage.set(K.avatar(phone), avatar); } catch {} }
    const clients = await loadJSON(K.clients, []);
    if (!clients.includes(phone)) await saveJSON(K.clients, [...clients, phone]);
    if (invite) {
      const invites = await loadJSON(K.invites, []);
      await saveJSON(K.invites, invites.map((i) => i.phone === phone && i.trainerId === invite.trainerId ? { ...i, status: "joined" } : i));
    }
    onDone({ phone, role: "client" });
  };

  const Chips = ({ options, value, onPick }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => <button key={o} style={S.chipBtn(value === o)} onClick={() => onPick(value === o ? "" : o)}>{o}</button>)}
    </div>
  );

  return (
    <div style={{ ...S.app, background: "transparent", padding: "24px 20px 40px", boxSizing: "border-box", minHeight: "100vh" }}>
      <style>{globalCss}</style>
      <MotionBg intensity={1.1} />
      <div style={{ position: "relative", zIndex: 1 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={S.label}>Step {step} of 2 · takes under a minute</div>
        <div style={{ height: 4, background: T.line, borderRadius: 2, marginTop: 8 }}>
          <div style={{ height: 4, width: step === 1 ? "50%" : "100%", background: T.pine, borderRadius: 2, transition: "width .3s" }} />
        </div>
      </div>

      {invite && (
        <div style={{ ...S.card, background: T.pineSoft, border: `1.5px solid ${T.pine}`, display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 22 }}>🤝</span>
          <div style={{ fontSize: 14 }}>You were invited by <strong>{invite.trainerName}</strong>. Finish signup and you'll be connected automatically.</div>
        </div>
      )}

      {step === 1 && (
        <div style={S.glass}>
          <div style={{ ...S.display, fontSize: 24, fontWeight: 700, marginBottom: 14 }}>About you</div>

          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <label style={{ cursor: "pointer", textAlign: "center" }}>
              {avatar
                ? <img src={avatar} alt="you" style={{ width: 88, height: 88, borderRadius: "50%", objectFit: "cover", border: `3px solid ${T.pine}` }} />
                : <div style={{ width: 88, height: 88, borderRadius: "50%", border: `2px dashed ${T.line}`, display: "flex", alignItems: "center", justifyContent: "center", color: T.sub, fontSize: 12, background: "#FBFBF9" }}>+ photo</div>}
              <input type="file" accept="image/*" capture="user" style={{ display: "none" }} onChange={(e) => onAvatar(e.target.files?.[0])} />
              <div style={{ fontSize: 11, color: T.sub, marginTop: 6 }}>{avatar ? "Tap to change" : "Optional"}</div>
            </label>
          </div>

          <div style={{ ...S.label, marginBottom: 4 }}>Your name</div>
          <input style={{ ...S.input, marginBottom: 14 }} placeholder="What should your coach call you?" value={name} autoFocus onChange={(e) => setName(e.target.value)} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 6 }}>
            <div>
              <div style={{ ...S.label, marginBottom: 4 }}>Age</div>
              <input style={S.input} type="number" inputMode="numeric" placeholder="32" value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
            <div>
              <div style={{ ...S.label, marginBottom: 4 }}>Sex</div>
              <Chips options={SEXES} value={sex} onPick={setSex} />
            </div>
          </div>

          {error && <div style={{ fontSize: 13, color: T.lane, marginTop: 8 }}>{error}</div>}
          <button style={{ ...S.btn, marginTop: 14 }} onClick={next}>Next → your goal</button>
        </div>
      )}

      {step === 2 && (
        <div style={S.glass}>
          <div style={{ ...S.display, fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Your goal</div>
          <div style={{ fontSize: 13, color: T.sub, marginBottom: 14 }}>Tap what fits. Nothing here is set in stone — your coach will fine-tune it with you.</div>

          <div style={{ ...S.label, marginBottom: 6 }}>Main goal</div>
          <div style={{ marginBottom: 16 }}><Chips options={GOALS} value={goal} onPick={setGoal} /></div>

          <div style={{ ...S.label, marginBottom: 6 }}>How often can you train?</div>
          <div style={{ marginBottom: 16 }}><Chips options={FREQS} value={freq} onPick={setFreq} /></div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 4 }}>
            <div>
              <div style={{ ...S.label, marginBottom: 4 }}>Target weight (kg) — optional</div>
              <input style={S.input} type="number" inputMode="decimal" placeholder="e.g. 72" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} />
            </div>
            <div>
              <div style={{ ...S.label, marginBottom: 4 }}>Anything your coach should know? — optional</div>
              <input style={S.input} placeholder="Old knee injury, vegetarian, travel a lot…" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>

          {error && <div style={{ fontSize: 13, color: T.lane, marginTop: 8 }}>{error}</div>}
          <button style={{ ...S.btn, marginTop: 14, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={finish}>{saving ? "Setting up…" : "Start tracking"}</button>
        </div>
      )}
      </div>
    </div>
  );
}

/* ==================================================================== */
/* CLIENT APP                                                            */
/* ==================================================================== */
function ClientApp({ user, onLogout }) {
  const [view, setView] = useState("home");
  const [checkins, setCheckins] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [profile, setProfile] = useState(null);
  const [trainerId, setTrainerId] = useState(null);
  const [avatar, setAvatar] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const reload = async () => {
    const acct = await loadJSON(K.account(user.phone), {});
    setProfile(acct.profile?.name ? acct.profile : null);
    setTrainerId(acct.trainerId || null);
    if (acct.profile?.hasAvatar) setAvatar(await loadRaw(K.avatar(user.phone)));
    setCheckins(await loadJSON(K.checkins(user.phone), []));
    setFeedback(await loadJSON(K.feedback(user.phone), []));
    // any pending invite from a (different) trainer? — trainer-driven switch flow
    const invites = await loadJSON(K.invites, []);
    const inv = invites.find((i) => i.phone === user.phone && i.status === "pending" && i.trainerId !== (acct.trainerId || null));
    if (inv) {
      const tAcct = await loadJSON(K.account(inv.trainerId), {});
      setPendingInvite({ trainerId: inv.trainerId, trainerName: tAcct.trainerProfile?.name || "A coach" });
    } else setPendingInvite(null);
    setLoaded(true);
  };
  useEffect(() => { reload(); }, [user.phone]);

  const sorted = useMemo(() => [...checkins].sort((a, b) => a.date.localeCompare(b.date)), [checkins]);
  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const doneToday = latest?.date === todayStr();
  const streak = useMemo(() => computeStreak(checkins), [checkins]);

  const addCheckin = async (ci) => {
    const next = [...checkins.filter((c) => c.date !== ci.date), ci];
    setCheckins(next);
    await saveJSON(K.checkins(user.phone), next);
    setView("home");
  };
  const toggleAction = async (fbId, actId) => {
    const next = feedback.map((f) => f.id !== fbId ? f : { ...f, actions: f.actions.map((a) => a.id === actId ? { ...a, done: !a.done } : a) });
    setFeedback(next);
    await saveJSON(K.feedback(user.phone), next);
  };

  const [pendingInvite, setPendingInvite] = useState(null);
  const acceptInvite = async () => {
    if (!pendingInvite) return;
    const acct = await loadJSON(K.account(user.phone), {});
    await saveJSON(K.account(user.phone), { ...acct, trainerId: pendingInvite.trainerId });
    const invites = await loadJSON(K.invites, []);
    await saveJSON(K.invites, invites.map((i) => i.phone === user.phone && i.trainerId === pendingInvite.trainerId ? { ...i, status: "joined" } : i));
    setTrainerId(pendingInvite.trainerId);
    setPendingInvite(null);
  };

  const [seeding, setSeeding] = useState(false);
  const seedDemo = async () => {
    setSeeding(true);
    await seedDemoCheckins(user.phone);
    setCheckins(await loadJSON(K.checkins(user.phone), []));
    setFeedback(await loadJSON(K.feedback(user.phone), []));
    setSeeding(false);
    setView("progress");
  };

  if (!loaded) return <div style={{ ...S.app, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><style>{globalCss}</style><div style={{ ...S.display, fontSize: 22, color: T.sub }}>Loading your log…</div></div>;

  if (!profile) return <Onboarding phone={user.phone} invite={null} onDone={reload} />;

  return (
    <div style={{ ...S.app, background: "transparent" }}>
      <style>{globalCss}</style>
      <MotionBg intensity={0.8} />
      <div style={{ position: "relative", zIndex: 1 }}>

      <div style={{ padding: "18px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Avatar src={avatar} name={profile?.name} />
          <div>
            <div style={{ ...S.display, fontSize: 22, fontWeight: 700, lineHeight: 1 }}>Hey {profile?.name?.split(" ")[0] || "there"}</div>
            <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>{profile?.goal ? profile.goal + " · " : ""}{streak > 0 ? `${streak}-day streak` : "Trackside"}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{ background: "none", border: "none", color: T.sub, fontSize: 12, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>Sign out</button>
      </div>

      <div style={{ padding: "0 16px" }}>
        {view === "home" && <ClientHome {...{ sorted, latest, prev, streak, doneToday, feedback, setView, toggleAction, onSeed: seedDemo, seeding, trainerId, pendingInvite, acceptInvite }} />}
        {view === "checkin" && <CheckinForm phone={user.phone} latest={latest} onSave={addCheckin} onCancel={() => setView("home")} />}
        {view === "progress" && <Progress phone={user.phone} sorted={sorted} profile={profile} onSeed={seedDemo} seeding={seeding} />}
        {view === "coach" && <CoachPage trainerId={trainerId} pendingInvite={pendingInvite} acceptInvite={acceptInvite} />}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "rgba(255,255,255,0.88)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderTop: `1px solid ${T.line}`, display: "flex", padding: "8px 0 14px", zIndex: 2 }}>
        {[["home", "Home"], ["checkin", "Check-in"], ["progress", "Progress"], ["coach", "Coach"]].map(([v, l]) => (
          <button key={v} onClick={() => setView(v)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 15, fontWeight: 600, color: view === v ? T.pine : T.sub, borderTop: view === v ? `2px solid ${T.pine}` : "2px solid transparent", paddingTop: 8 }}>
            {l}
          </button>
        ))}
      </div>
      </div>
    </div>
  );
}

/* invite acceptance card — shared by Home and Coach tab */
function InviteCard({ pendingInvite, acceptInvite, switching }) {
  return (
    <div style={{ ...S.card, background: T.pineSoft, border: `1.5px solid ${T.pine}` }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ fontSize: 22 }}>🤝</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, marginBottom: 10 }}>
            <strong>{pendingInvite.trainerName}</strong> invited you to be their client.
            {switching && <span style={{ color: T.sub }}> Accepting moves your log to them — your current coach loses access to future check-ins.</span>}
          </div>
          <button style={{ ...S.btn, width: "auto", padding: "10px 18px" }} onClick={acceptInvite}>
            {switching ? "Switch to this coach" : "Accept invite"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClientHome({ sorted, latest, prev, streak, doneToday, feedback, setView, toggleAction, onSeed, seeding, trainerId, pendingInvite, acceptInvite }) {
  const latestFb = feedback[0];
  return (
    <>
      {pendingInvite && <InviteCard pendingInvite={pendingInvite} acceptInvite={acceptInvite} switching={!!trainerId} />}

      {!trainerId && !pendingInvite && (
        <div style={{ ...S.card, border: `1.5px solid ${T.lane}` }}>
          <div style={{ ...S.label, color: T.lane, marginBottom: 6 }}>Not linked to a coach</div>
          <div style={{ fontSize: 14, color: T.sub }}>Trackside is invite-only. Ask your coach to add your mobile number from their console — you'll be connected automatically.</div>
        </div>
      )}

      <div style={{ ...S.card, background: doneToday ? T.pineSoft : T.card, border: `1.5px solid ${doneToday ? T.pine : T.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={S.label}>{fmtFull(todayStr())}</div>
          <div style={{ ...S.display, fontSize: 30, fontWeight: 700, color: doneToday ? T.pine : T.ink }}>
            {doneToday ? "Logged ✓" : "Log today"}
          </div>
          <div style={{ fontSize: 13, color: T.sub }}>{streak > 0 ? `${streak}-day streak` : "Start your streak"}</div>
        </div>
        {!doneToday && <button style={{ ...S.btn, width: "auto" }} onClick={() => setView("checkin")}>Check in</button>}
      </div>

      {latest && (
        <div style={S.card}>
          <div style={{ ...S.label, marginBottom: 10 }}>Latest vs previous</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[["Weight", latest.weight, prev?.weight, " kg", true], ["Waist", latest.waist, prev?.waist, " cm", true], ["Chest", latest.chest, prev?.chest, " cm", false], ["Arm", latest.arm, prev?.arm, " cm", false]].map(([n, c, p, u, gd]) => c != null && c !== "" ? (
              <div key={n}>
                <div style={{ fontSize: 12, color: T.sub }}>{n}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ ...S.display, fontSize: 24, fontWeight: 700 }}>{c}<span style={{ fontSize: 13, color: T.sub }}>{u}</span></span>
                  <Delta curr={c} prev={p} unit={u.trim()} goodWhenDown={gd} />
                </div>
              </div>
            ) : null)}
          </div>
        </div>
      )}

      <div style={S.card}>
        <div style={{ ...S.label, marginBottom: 8 }}>From your coach</div>
        {!latestFb ? (
          <div style={{ fontSize: 14, color: T.sub }}>No feedback yet. Keep logging — your coach reviews your check-ins here.</div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: T.sub, marginBottom: 6 }}>{fmtFull(latestFb.date)}</div>
            <div style={{ fontSize: 15, lineHeight: 1.5, marginBottom: 10 }}>{latestFb.text}</div>
            {latestFb.actions?.length > 0 && (
              <div>
                <div style={{ ...S.label, marginBottom: 6 }}>Action items</div>
                {latestFb.actions.map((a) => (
                  <label key={a.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "7px 0", cursor: "pointer", fontSize: 14 }}>
                    <input type="checkbox" checked={a.done} onChange={() => toggleAction(latestFb.id, a.id)} style={{ accentColor: T.pine, width: 18, height: 18, marginTop: 1 }} />
                    <span style={{ textDecoration: a.done ? "line-through" : "none", color: a.done ? T.sub : T.ink }}>{a.text}</span>
                  </label>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {sorted.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: 28 }}>
          <div style={{ ...S.display, fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Day one starts here</div>
          <div style={{ fontSize: 14, color: T.sub, marginBottom: 14 }}>Log your weight, measurements and a progress photo. It takes under a minute.</div>
          <button style={{ ...S.btnGhost }} disabled={seeding} onClick={onSeed}>{seeding ? "Loading demo…" : "Or load 3 weeks of demo data"}</button>
        </div>
      )}
    </>
  );
}

/* ---------- client: coach page ---------- */
function CoachPage({ trainerId, pendingInvite, acceptInvite }) {
  const [tp, setTp] = useState(null);
  const [tAvatar, setTAvatar] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      setLoaded(false); setTp(null); setTAvatar(null); setGallery([]);
      if (trainerId) {
        const acct = await loadJSON(K.account(trainerId), {});
        setTp(acct.trainerProfile || null);
        if (acct.trainerProfile?.hasAvatar) setTAvatar(await loadRaw(K.avatar(trainerId)));
        const n = acct.trainerProfile?.galleryCount || 0;
        const imgs = [];
        for (let i = 0; i < n; i++) { const v = await loadRaw(K.gallery(trainerId, i)); if (v) imgs.push(v); }
        setGallery(imgs);
      }
      setLoaded(true);
    })();
  }, [trainerId]);

  if (!loaded) return <div style={{ ...S.card, textAlign: "center", color: T.sub }}>Loading…</div>;

  if (!trainerId) return (
    <>
      {pendingInvite && <InviteCard pendingInvite={pendingInvite} acceptInvite={acceptInvite} switching={false} />}
      {!pendingInvite && (
        <div style={S.card}>
          <div style={{ ...S.display, fontSize: 22, fontWeight: 700, marginBottom: 6 }}>No coach yet</div>
          <div style={{ fontSize: 14, color: T.sub }}>Trackside is invite-only. Ask your coach to add your mobile number from their console, and their invite will appear here.</div>
        </div>
      )}
    </>
  );

  const creds = (tp?.credentials || "").split("\n").map((s) => s.trim()).filter(Boolean);

  return (
    <>
      {/* hero */}
      <div style={{ ...S.card, textAlign: "center", paddingTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <Avatar src={tAvatar} name={tp?.name} size={92} />
        </div>
        <div style={{ ...S.display, fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>{tp?.name || "Your coach"}</div>
        {tp?.headline && <div style={{ fontSize: 15, color: T.pine, fontWeight: 600, marginTop: 4 }}>{tp.headline}</div>}
        <div style={{ fontSize: 13, color: T.sub, marginTop: 6 }}>
          {[tp?.years && `${tp.years} yrs coaching`, tp?.location].filter(Boolean).join(" · ")}
        </div>
        {tp?.specialties?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 12 }}>
            {tp.specialties.map((s) => <span key={s} style={{ ...S.chip, background: T.pineSoft, color: T.pine }}>{s}</span>)}
          </div>
        )}
        {!tp && <div style={{ fontSize: 13, color: T.sub, marginTop: 10 }}>Your coach hasn't filled in their page yet.</div>}
      </div>

      {tp?.philosophy && (
        <div style={{ ...S.card, borderLeft: `4px solid ${T.pine}` }}>
          <div style={{ ...S.label, marginBottom: 8 }}>Coaching philosophy</div>
          <div style={{ fontSize: 15, lineHeight: 1.6, fontStyle: "italic" }}>"{tp.philosophy}"</div>
        </div>
      )}

      {creds.length > 0 && (
        <div style={S.card}>
          <div style={{ ...S.label, marginBottom: 8 }}>Credentials</div>
          {creds.map((c) => (
            <div key={c} style={{ display: "flex", gap: 8, padding: "5px 0", fontSize: 14 }}>
              <span style={{ color: T.pine, fontWeight: 700 }}>✓</span>{c}
            </div>
          ))}
        </div>
      )}

      {gallery.length > 0 && (
        <div style={S.card}>
          <div style={{ ...S.label, marginBottom: 8 }}>Gallery</div>
          <div style={{ display: "grid", gridTemplateColumns: gallery.length === 1 ? "1fr" : "1fr 1fr", gap: 8 }}>
            {gallery.map((g, i) => <img key={i} src={g} alt="" style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 10, border: `1px solid ${T.line}` }} />)}
          </div>
        </div>
      )}

      {/* switch coach — invite-driven */}
      {pendingInvite ? (
        <InviteCard pendingInvite={pendingInvite} acceptInvite={acceptInvite} switching />
      ) : (
        <div style={{ ...S.card, background: "transparent", border: "none", padding: "4px 16px" }}>
          <div style={{ fontSize: 12, color: T.sub, textAlign: "center" }}>
            Switching coaches? Ask your new coach to send an invite to your number — it'll appear here.
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- client: check-in ---------- */
function CheckinForm({ phone, latest, onSave, onCancel }) {
  const [f, setF] = useState({ weight: "", waist: "", chest: "", arm: "", energy: 3, sleep: "", nutrition: 3, workout: false, notes: "" });
  const [photos, setPhotos] = useState({ front: null, side: null });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const onPhoto = async (slot, file) => {
    if (!file) return;
    try { setPhotos((p) => ({ ...p, [slot]: null })); const data = await compressImage(file); setPhotos((p) => ({ ...p, [slot]: data })); }
    catch { alert("Couldn't read that photo — try another one."); }
  };

  const save = async () => {
    if (!f.weight) { alert("Weight is required — it anchors your trend line."); return; }
    setSaving(true);
    const id = Date.now().toString(36);
    const ci = { id, date: todayStr(), weight: f.weight, waist: f.waist, chest: f.chest, arm: f.arm, energy: f.energy, sleep: f.sleep, nutrition: f.nutrition, workout: f.workout, notes: f.notes, hasFront: !!photos.front, hasSide: !!photos.side };
    for (const slot of ["front", "side"]) {
      if (photos[slot]) { try { await window.storage.set(K.photo(phone, id, slot), photos[slot]); } catch (e) { console.error(e); } }
    }
    await onSave(ci);
    setSaving(false);
  };

  const NumField = ({ k, label, unit, ph }) => (
    <div>
      <div style={{ ...S.label, marginBottom: 4 }}>{label} <span style={{ fontWeight: 400 }}>({unit})</span></div>
      <input style={S.input} type="number" inputMode="decimal" placeholder={ph || ""} value={f[k]} onChange={(e) => set(k, e.target.value)} />
    </div>
  );

  return (
    <>
      <div style={S.card}>
        <div style={{ ...S.display, fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Daily check-in · {fmtDay(todayStr())}</div>

        <div style={{ ...S.label, marginBottom: 8 }}>Progress photos</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          {["front", "side"].map((slot) => (
            <label key={slot} style={{ flex: 1, aspectRatio: "3/4", border: `1.5px dashed ${photos[slot] ? T.pine : T.line}`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", background: "#FBFBF9" }}>
              {photos[slot]
                ? <img src={photos[slot]} alt={slot} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ ...S.display, color: T.sub, fontSize: 15 }}>+ {slot}</span>}
              <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => onPhoto(slot, e.target.files?.[0])} />
            </label>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <NumField k="weight" label="Weight" unit="kg" ph={latest?.weight} />
          <NumField k="waist" label="Waist" unit="cm" ph={latest?.waist} />
          <NumField k="chest" label="Chest" unit="cm" ph={latest?.chest} />
          <NumField k="arm" label="Arm" unit="cm" ph={latest?.arm} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ ...S.label, marginBottom: 4 }}>Energy · {f.energy}/5</div>
            <input type="range" min="1" max="5" value={f.energy} onChange={(e) => set("energy", +e.target.value)} style={{ width: "100%", accentColor: T.pine }} />
          </div>
          <div>
            <div style={{ ...S.label, marginBottom: 4 }}>Nutrition · {f.nutrition}/5</div>
            <input type="range" min="1" max="5" value={f.nutrition} onChange={(e) => set("nutrition", +e.target.value)} style={{ width: "100%", accentColor: T.pine }} />
          </div>
          <NumField k="sleep" label="Sleep" unit="hrs" />
          <div>
            <div style={{ ...S.label, marginBottom: 4 }}>Workout done?</div>
            <button onClick={() => set("workout", !f.workout)} style={{ ...S.btnGhost, width: "100%", padding: "10px", background: f.workout ? T.pine : "transparent", color: f.workout ? "#fff" : T.pine }}>
              {f.workout ? "Yes ✓" : "Not yet"}
            </button>
          </div>
        </div>

        <div style={{ ...S.label, marginBottom: 4 }}>Notes for your coach</div>
        <textarea style={{ ...S.input, minHeight: 70, resize: "vertical" }} placeholder="Sore hamstrings, ate out for dinner…" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>

      <button style={{ ...S.btn, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save check-in"}</button>
      <button style={{ ...S.btnGhost, width: "100%", marginTop: 8, border: "none" }} onClick={onCancel}>Cancel</button>
    </>
  );
}

/* ---------- client: progress ---------- */
function Progress({ phone, sorted, profile, onSeed, seeding }) {
  const [pair, setPair] = useState(null);
  useEffect(() => {
    (async () => {
      const withFront = sorted.filter((c) => c.hasFront);
      if (withFront.length < 1) return;
      const first = withFront[0], last = withFront[withFront.length - 1];
      const get = (c) => loadRaw(K.photo(phone, c.id, "front"));
      setPair({ first: { date: first.date, img: await get(first) }, last: first.id === last.id ? null : { date: last.date, img: await get(last) } });
    })();
  }, [sorted, phone]);

  const data = sorted.map((c) => ({ date: fmtDay(c.date), Weight: c.weight ? +c.weight : null, Waist: c.waist ? +c.waist : null }));
  const target = profile?.targetWeight ? +profile.targetWeight : null;

  if (sorted.length === 0) return (
    <div style={{ ...S.card, textAlign: "center", padding: 28 }}>
      <div style={{ fontSize: 14, color: T.sub, marginBottom: 14 }}>No check-ins yet. Your trends and photo timeline will build here.</div>
      <button style={S.btnGhost} disabled={seeding} onClick={onSeed}>{seeding ? "Loading demo…" : "Load 3 weeks of demo data"}</button>
    </div>
  );

  return (
    <>
      <div style={S.card}>
        <div style={{ ...S.label, marginBottom: 10 }}>Weight trend (kg){target ? ` · target ${target}` : ""}</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid stroke={T.line} strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: T.sub }} />
            <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11, fill: T.sub }} />
            <Tooltip />
            <Line type="monotone" dataKey="Weight" stroke={T.pine} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={S.card}>
        <div style={{ ...S.label, marginBottom: 10 }}>Waist trend (cm)</div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid stroke={T.line} strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: T.sub }} />
            <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11, fill: T.sub }} />
            <Tooltip />
            <Line type="monotone" dataKey="Waist" stroke={T.teal} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={S.card}>
        <div style={{ ...S.label, marginBottom: 10 }}>Then vs now</div>
        {!pair?.first?.img ? (
          <div style={{ fontSize: 14, color: T.sub }}>Add front photos in your check-ins to unlock the side-by-side comparison.</div>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            {[pair.first, pair.last].filter(Boolean).map((p, i) => (
              <div key={i} style={{ flex: 1 }}>
                <img src={p.img} alt="" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 10, border: `1px solid ${T.line}` }} />
                <div style={{ textAlign: "center", fontSize: 12, color: T.sub, marginTop: 4 }}>{fmtDay(p.date)}{i === 0 ? " · start" : " · latest"}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ==================================================================== */
/* TRAINER CONSOLE                                                       */
/* ==================================================================== */
function TrainerConsole({ trainer, onLogout }) {
  const [tab, setTab] = useState("clients"); // clients | invites | page
  const [clients, setClients] = useState(null);
  const [selected, setSelected] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [sort, setSort] = useState({ key: "lastLog", dir: -1 }); // stalest first: coach's to-do

  const loadAll = async () => {
    const phones = await loadJSON(K.clients, []);
    const out = [];
    for (const p of phones) {
      const acct = await loadJSON(K.account(p), {});
      if (acct.role !== "client" || acct.trainerId !== trainer.phone) continue;
      const checkins = (await loadJSON(K.checkins(p), [])).sort((a, b) => a.date.localeCompare(b.date));
      const feedback = await loadJSON(K.feedback(p), []);
      const avatar = acct.profile?.hasAvatar ? await loadRaw(K.avatar(p)) : null;
      out.push({ phone: p, profile: acct.profile || { name: "Unnamed" }, avatar, checkins, feedback });
    }
    setClients(out);
  };
  useEffect(() => { loadAll(); }, []);

  const sendFeedback = async (phone, fb) => {
    const c = clients.find((x) => x.phone === phone);
    const next = [fb, ...c.feedback];
    await saveJSON(K.feedback(phone), next);
    setClients(clients.map((x) => x.phone === phone ? { ...x, feedback: next } : x));
    if (selected?.phone === phone) setSelected({ ...selected, feedback: next });
  };

  if (!clients) return <div style={{ ...S.wide, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><style>{globalCss}</style><div style={{ ...S.display, fontSize: 22, color: T.sub }}>Loading clients…</div></div>;

  const activeToday = clients.filter((c) => c.checkins[c.checkins.length - 1]?.date === todayStr()).length;
  const needAttention = clients.filter((c) => { const l = c.checkins[c.checkins.length - 1]; return !l || daysSince(l.date) >= 3; }).length;
  const weekAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); })();
  const enriched = clients.map((c) => {
    const cis = c.checkins;
    const last = cis[cis.length - 1];
    const older = [...cis].reverse().find((x) => x.date <= weekAgo);
    const d7 = last?.weight && older?.weight ? +((+last.weight) - (+older.weight)).toFixed(1) : null;
    return {
      ...c, last, d7,
      streak: computeStreak(cis),
      staleDays: last ? daysSince(last.date) : Infinity,
      adherence7: cis.filter((x) => daysSince(x.date) < 7).length,
      spark: cis.slice(-14).map((x) => ({ w: x.weight ? +x.weight : null })),
    };
  });
  const sortFns = {
    name: (a, b) => (a.profile.name || "").localeCompare(b.profile.name || ""),
    lastLog: (a, b) => (a.staleDays === Infinity ? 9e9 : a.staleDays) - (b.staleDays === Infinity ? 9e9 : b.staleDays),
    streak: (a, b) => b.streak - a.streak,
    d7: (a, b) => (a.d7 ?? 9e9) - (b.d7 ?? 9e9),
    adherence: (a, b) => b.adherence7 - a.adherence7,
  };
  const rows = [...enriched].sort((a, b) => sortFns[sort.key](a, b) * sort.dir);
  const logs7 = clients.reduce((s, c) => s + c.checkins.filter((x) => daysSince(x.date) < 7).length, 0);
  const rate7 = clients.length ? Math.round((logs7 / (clients.length * 7)) * 100) : 0;
  const tdS = { padding: "12px 14px", fontSize: 14, whiteSpace: "nowrap", verticalAlign: "middle" };

  return (
    <div style={{ ...S.wide, background: "transparent" }}>
      <style>{globalCss}</style>
      <MotionBg intensity={0.7} />
      <div style={{ position: "relative", zIndex: 1 }}>

      <div style={{ padding: "22px 0 10px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ ...S.display, fontSize: 28, fontWeight: 700, lineHeight: 1 }}>Trackside · Coach console</div>
          <div style={{ fontSize: 13, color: T.sub, marginTop: 3 }}>+91 {trainer.phone.slice(0, 2)}•••{trainer.phone.slice(-3)}</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={loadAll} style={{ ...S.btnGhost, padding: "8px 14px", fontSize: 13 }}>Refresh</button>
          <button onClick={onLogout} style={{ background: "none", border: "none", color: T.sub, fontSize: 13, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>Sign out</button>
        </div>
      </div>

      {/* tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${T.line}`, marginBottom: 16 }}>
        {[["clients", "Clients"], ["invites", "Invites & link"], ["page", "My page"]].map(([v, l]) => (
          <button key={v} onClick={() => { setTab(v); setSelected(null); }} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 16, fontWeight: 600, color: tab === v ? T.pine : T.sub, borderBottom: tab === v ? `2.5px solid ${T.pine}` : "2.5px solid transparent", padding: "8px 14px" }}>
            {l}
          </button>
        ))}
      </div>

      {tab === "clients" && !selected && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
            {[["Clients", clients.length, T.ink], ["Logged today", activeToday, T.pine], ["Need attention", needAttention, needAttention > 0 ? T.lane : T.sub], ["Check-in rate 7d", rate7 + "%", T.teal]].map(([l, v, col]) => (
              <div key={l} style={{ ...S.card, marginBottom: 0, textAlign: "center", padding: 14 }}>
                <div style={{ ...S.display, fontSize: 32, fontWeight: 700, color: col }}>{v}</div>
                <div style={S.label}>{l}</div>
              </div>
            ))}
          </div>

          {clients.length === 0 ? (
            <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
              <div style={{ ...S.display, fontSize: 22, fontWeight: 600, marginBottom: 8 }}>No clients yet</div>
              <div style={{ fontSize: 14, color: T.sub, marginBottom: 16 }}>Invite clients from the "Invites & link" tab — they'll appear here as soon as they sign up.</div>
              <button style={S.btnGhost} disabled={seeding} onClick={async () => { setSeeding(true); await seedDemoClients(trainer.phone); await loadAll(); setSeeding(false); }}>
                {seeding ? "Creating demo clients…" : "Load 3 demo clients"}
              </button>
            </div>
          ) : (
            <div style={{ ...S.card, padding: 0, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
                <thead>
                  <tr style={{ borderBottom: `1.5px solid ${T.line}` }}>
                    {[["name", "Client"], ["lastLog", "Last log"], ["streak", "Streak"], [null, "Weight"], ["d7", "Δ 7 days"], [null, "Trend"], ["adherence", "Logs / 7d"], [null, "Status"]].map(([k, l]) => (
                      <th key={l} onClick={k ? () => setSort((s) => ({ key: k, dir: s.key === k ? -s.dir : 1 })) : undefined}
                        style={{ ...S.label, textAlign: "left", padding: "12px 14px", cursor: k ? "pointer" : "default", whiteSpace: "nowrap", userSelect: "none" }}>
                        {l}{sort.key === k ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.phone} className="ts-row" onClick={() => setSelected(c)} style={{ cursor: "pointer", borderTop: `1px solid ${T.line}` }}>
                      <td style={tdS}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <Avatar src={c.avatar} name={c.profile.name} size={36} />
                          <div>
                            <div style={{ fontWeight: 600 }}>{c.profile.name}</div>
                            <div style={{ fontSize: 12, color: T.sub }}>{[c.profile.age && `${c.profile.age}y`, c.profile.sex, c.profile.goal].filter(Boolean).join(" · ")}</div>
                          </div>
                        </div>
                      </td>
                      <td style={tdS}>{c.last ? fmtDay(c.last.date) : "—"}</td>
                      <td style={tdS}>{c.streak}d</td>
                      <td style={{ ...tdS, fontWeight: 600 }}>{c.last?.weight ? `${c.last.weight} kg` : "—"}</td>
                      <td style={tdS}>
                        {c.d7 == null ? <span style={{ color: T.sub }}>—</span> : (() => {
                          const good = c.profile.goal === "Build muscle" ? c.d7 >= 0 : c.d7 <= 0;
                          return <span style={{ ...S.chip, background: good ? T.tealSoft : T.laneSoft, color: good ? T.teal : T.lane }}>{c.d7 > 0 ? "▴" : c.d7 < 0 ? "▾" : "—"} {Math.abs(c.d7)} kg</span>;
                        })()}
                      </td>
                      <td style={tdS}>
                        {c.spark.length > 1 ? (
                          <LineChart width={110} height={30} data={c.spark} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
                            <Line type="monotone" dataKey="w" dot={false} stroke={T.pine} strokeWidth={2} connectNulls />
                          </LineChart>
                        ) : <span style={{ color: T.sub }}>—</span>}
                      </td>
                      <td style={tdS}>{c.adherence7}/7</td>
                      <td style={tdS}>
                        {c.staleDays >= 3
                          ? <span style={{ ...S.chip, background: T.laneSoft, color: T.lane }}>{c.last ? `No log ${c.staleDays}d` : "Never logged"}</span>
                          : <span style={{ ...S.chip, background: T.pineSoft, color: T.pine }}>{c.streak >= 7 ? "On fire" : "On track"}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "clients" && selected && <ClientDetail client={selected} onBack={() => setSelected(null)} onSend={sendFeedback} />}
      {tab === "invites" && <InvitesTab trainer={trainer} />}
      {tab === "page" && <TrainerPageEditor trainer={trainer} />}
      </div>
    </div>
  );
}

/* ---------- trainer: invites tab ---------- */
function InvitesTab({ trainer }) {
  const [invites, setInvites] = useState([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);
  const [copied, setCopied] = useState("");

  const code = coachCode(trainer.phone);
  const link = `trackside.in/j/${code.toLowerCase()}`;

  const load = async () => {
    const all = await loadJSON(K.invites, []);
    setInvites(all.filter((i) => i.trainerId === trainer.phone).reverse());
  };
  useEffect(() => { load(); }, []);

  const addInvite = async () => {
    const clean = phone.replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(clean)) { setError("Enter a valid 10-digit mobile number."); return; }
    setError("");
    const all = await loadJSON(K.invites, []);
    if (all.some((i) => i.phone === clean && i.trainerId === trainer.phone)) { setError("You've already invited this number."); return; }
    await saveJSON(K.invites, [...all, { phone: clean, name: name.trim(), trainerId: trainer.phone, status: "pending", createdAt: todayStr() }]);
    setName(""); setPhone(""); setAdded(true);
    setTimeout(() => setAdded(false), 2000);
    load();
  };

  const copy = async (text, which) => {
    try { await navigator.clipboard.writeText(text); setCopied(which); setTimeout(() => setCopied(""), 1500); }
    catch { alert(text); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12, alignItems: "start" }}>
      <div>
        <div style={S.card}>
          <div style={{ ...S.display, fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Add a client</div>
          <div style={{ fontSize: 13, color: T.sub, marginBottom: 14 }}>They'll get an SMS invite. When they sign in with this number, they're linked to you automatically — no codes to type.</div>
          <div style={{ ...S.label, marginBottom: 4 }}>Client name</div>
          <input style={{ ...S.input, marginBottom: 12 }} placeholder="e.g. Rohit Kumar" value={name} onChange={(e) => setName(e.target.value)} />
          <div style={{ ...S.label, marginBottom: 4 }}>Mobile number</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <div style={{ ...S.input, width: 58, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: T.sub }}>+91</div>
            <input style={S.input} type="tel" inputMode="numeric" maxLength={10} placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && addInvite()} />
          </div>
          {error && <div style={{ fontSize: 13, color: T.lane, marginBottom: 10 }}>{error}</div>}
          <button style={S.btn} onClick={addInvite}>{added ? "Invite sent ✓" : "Send invite"}</button>
          <div style={{ fontSize: 12, color: T.sub, marginTop: 8 }}>Demo mode: no SMS goes out — the invite activates when this number signs in.</div>
        </div>

        <div style={S.card}>
          <div style={{ ...S.display, fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Your invite link</div>
          <div style={{ fontSize: 13, color: T.sub, marginBottom: 12 }}>Share on WhatsApp or print the QR at your gym. Anyone signing up through it links to you.</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{ ...S.input, fontFamily: "monospace", fontSize: 14, display: "flex", alignItems: "center" }}>{link}</div>
            <button style={{ ...S.btnGhost, whiteSpace: "nowrap" }} onClick={() => copy("https://" + link, "link")}>{copied === "link" ? "Copied ✓" : "Copy"}</button>
          </div>
          <div style={{ fontSize: 12, color: T.sub, marginTop: 8 }}>QR poster generation ships with the production build.</div>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ ...S.display, fontSize: 20, fontWeight: 600, marginBottom: 10 }}>Sent invites</div>
        {invites.length === 0 && <div style={{ fontSize: 14, color: T.sub }}>No invites yet.</div>}
        {invites.map((i) => (
          <div key={i.phone} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.line}` }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{i.name || "Unnamed"}</div>
              <div style={{ fontSize: 12, color: T.sub }}>+91 {i.phone.slice(0, 5)} {i.phone.slice(5)} · invited {fmtDay(i.createdAt)}</div>
            </div>
            <span style={{ ...S.chip, background: i.status === "joined" ? T.pineSoft : "#EEF0EA", color: i.status === "joined" ? T.pine : T.sub }}>
              {i.status === "joined" ? "Joined ✓" : "Pending"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- trainer: my page editor ---------- */
function TrainerPageEditor({ trainer }) {
  const [p, setP] = useState(null);
  const [avatar, setAvatar] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const set = (k, v) => setP((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    (async () => {
      const acct = await loadJSON(K.account(trainer.phone), {});
      const tp = acct.trainerProfile || { name: "", headline: "", years: "", location: "", philosophy: "", credentials: "", specialties: [], hasAvatar: false, galleryCount: 0 };
      setP(tp);
      if (tp.hasAvatar) setAvatar(await loadRaw(K.avatar(trainer.phone)));
      const imgs = [];
      for (let i = 0; i < (tp.galleryCount || 0); i++) { const v = await loadRaw(K.gallery(trainer.phone, i)); if (v) imgs.push(v); }
      setGallery(imgs);
    })();
  }, [trainer.phone]);

  if (!p) return <div style={{ ...S.card, color: T.sub }}>Loading…</div>;

  const onAvatar = async (file) => { if (file) try { setAvatar(await compressImage(file, 320)); } catch {} };
  const onGallery = async (file) => {
    if (!file || gallery.length >= 4) return;
    try { setGallery([...gallery, await compressImage(file, 720)]); } catch {}
  };

  const save = async () => {
    setSaving(true);
    const acct = await loadJSON(K.account(trainer.phone), {});
    const tp = { ...p, hasAvatar: !!avatar, galleryCount: gallery.length };
    await saveJSON(K.account(trainer.phone), { ...acct, trainerProfile: tp });
    if (avatar) { try { await window.storage.set(K.avatar(trainer.phone), avatar); } catch {} }
    for (let i = 0; i < gallery.length; i++) { try { await window.storage.set(K.gallery(trainer.phone, i), gallery[i]); } catch {} }
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleSpec = (s) => set("specialties", p.specialties?.includes(s) ? p.specialties.filter((x) => x !== s) : [...(p.specialties || []), s]);

  const loadSample = () => {
    setP({ ...SAMPLE_TRAINER_PROFILE, hasAvatar: !!avatar, galleryCount: 0 });
    setGallery([makeGalleryPhoto("Morning strength class"), makeGalleryPhoto("Client PB day")]);
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ ...S.display, fontSize: 20, fontWeight: 600 }}>My page</div>
          <button style={{ ...S.btnGhost, padding: "6px 12px", fontSize: 13 }} onClick={loadSample}>Fill with sample</button>
        </div>
        <div style={{ fontSize: 13, color: T.sub, marginBottom: 16 }}>This is what your clients see on their Coach tab. Make it worth reading — it's your pitch to every new signup.</div>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <label style={{ cursor: "pointer", textAlign: "center" }}>
            {avatar
              ? <img src={avatar} alt="you" style={{ width: 88, height: 88, borderRadius: "50%", objectFit: "cover", border: `3px solid ${T.pine}` }} />
              : <div style={{ width: 88, height: 88, borderRadius: "50%", border: `2px dashed ${T.line}`, display: "flex", alignItems: "center", justifyContent: "center", color: T.sub, fontSize: 12, background: "#FBFBF9" }}>+ photo</div>}
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => onAvatar(e.target.files?.[0])} />
            <div style={{ fontSize: 11, color: T.sub, marginTop: 6 }}>Profile photo</div>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ ...S.label, marginBottom: 4 }}>Name</div>
            <input style={S.input} placeholder="Arjun Mehta" value={p.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <div style={{ ...S.label, marginBottom: 4 }}>Headline</div>
            <input style={S.input} placeholder="Strength & fat-loss coach" value={p.headline} onChange={(e) => set("headline", e.target.value)} />
          </div>
          <div>
            <div style={{ ...S.label, marginBottom: 4 }}>Years coaching</div>
            <input style={S.input} type="number" placeholder="9" value={p.years} onChange={(e) => set("years", e.target.value)} />
          </div>
          <div>
            <div style={{ ...S.label, marginBottom: 4 }}>Location</div>
            <input style={S.input} placeholder="Gachibowli, Hyderabad" value={p.location} onChange={(e) => set("location", e.target.value)} />
          </div>
        </div>

        <div style={{ ...S.label, marginBottom: 6 }}>Specialties</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {SPECIALTIES.map((s) => <button key={s} style={S.chipBtn(p.specialties?.includes(s))} onClick={() => toggleSpec(s)}>{s}</button>)}
        </div>

        <div style={{ ...S.label, marginBottom: 4 }}>Coaching philosophy</div>
        <textarea style={{ ...S.input, minHeight: 90, resize: "vertical", marginBottom: 12 }} placeholder="What do you believe about training and nutrition? Clients read this before their first check-in." value={p.philosophy} onChange={(e) => set("philosophy", e.target.value)} />

        <div style={{ ...S.label, marginBottom: 4 }}>Credentials (one per line)</div>
        <textarea style={{ ...S.input, minHeight: 80, resize: "vertical", marginBottom: 14 }} placeholder={"ACE Certified Personal Trainer\nPrecision Nutrition L1"} value={p.credentials} onChange={(e) => set("credentials", e.target.value)} />

        <div style={{ ...S.label, marginBottom: 6 }}>Gallery ({gallery.length}/4)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {gallery.map((g, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img src={g} alt="" style={{ width: 110, height: 82, objectFit: "cover", borderRadius: 8, border: `1px solid ${T.line}` }} />
              <button onClick={() => setGallery(gallery.filter((_, j) => j !== i))} style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%", border: "none", background: T.lane, color: "#fff", cursor: "pointer", fontSize: 12, lineHeight: 1 }}>✕</button>
            </div>
          ))}
          {gallery.length < 4 && (
            <label style={{ width: 110, height: 82, border: `1.5px dashed ${T.line}`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.sub, fontSize: 13, background: "#FBFBF9" }}>
              + add
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => onGallery(e.target.files?.[0])} />
            </label>
          )}
        </div>

        <button style={{ ...S.btn, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={save}>{saved ? "Saved ✓" : saving ? "Saving…" : "Save page"}</button>
      </div>
    </div>
  );
}

/* ---------- trainer: single client detail ---------- */
function ClientDetail({ client, onBack, onSend }) {
  const [openCi, setOpenCi] = useState(null);
  const [photos, setPhotos] = useState({});
  const [fbText, setFbText] = useState("");
  const [fbActions, setFbActions] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [sent, setSent] = useState(false);

  const sorted = client.checkins;
  const recent = [...sorted].reverse();
  const p = client.profile;

  useEffect(() => {
    if (!openCi) return;
    (async () => {
      const out = {};
      for (const slot of ["front", "side"]) {
        if (openCi[slot === "front" ? "hasFront" : "hasSide"]) {
          const v = await loadRaw(K.photo(client.phone, openCi.id, slot));
          if (v) out[slot] = v;
        }
      }
      setPhotos(out);
    })();
  }, [openCi, client.phone]);

  const draftWithAI = async () => {
    setDrafting(true);
    try {
      const week = recent.slice(0, 7).map(({ date, weight, waist, chest, arm, energy, sleep, nutrition, workout, notes }) => ({ date, weight, waist, chest, arm, energy, sleep, nutrition, workout, notes }));
      const profileCtx = { name: p.name, age: p.age, sex: p.sex, goal: p.goal, trainingFrequency: p.freq, targetWeight: p.targetWeight, coachNote: p.note };
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content: `You are a fitness coach's assistant. Client profile: ${JSON.stringify(profileCtx)}. Last check-ins (newest first): ${JSON.stringify(week)}. Write concise, encouraging, specific coach feedback aligned to their stated goal. Respond ONLY with JSON, no markdown fences: {"text": "2-4 sentence feedback message addressed to the client by first name", "actions": ["3 short actionable items"]}` }],
        }),
      });
      const data = await res.json();
      const raw = data.content.filter((i) => i.type === "text").map((i) => i.text).join("\n").replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(raw);
      setFbText(parsed.text || "");
      setFbActions((parsed.actions || []).join("\n"));
    } catch { alert("AI draft failed — write it manually or try again."); }
    setDrafting(false);
  };

  const send = async () => {
    if (!fbText.trim()) return;
    const actions = fbActions.split("\n").map((s) => s.trim()).filter(Boolean).map((text, i) => ({ id: `${Date.now()}-${i}`, text, done: false }));
    await onSend(client.phone, { id: Date.now().toString(36), date: todayStr(), text: fbText.trim(), actions });
    setFbText(""); setFbActions(""); setSent(true);
    setTimeout(() => setSent(false), 2500);
  };

  const chartData = sorted.map((c) => ({ date: fmtDay(c.date), Weight: c.weight ? +c.weight : null }));

  return (
    <>
      <button onClick={onBack} style={{ background: "none", border: "none", color: T.pine, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: 12, padding: 0 }}>← All clients</button>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12, alignItems: "start" }}>
        <div>
          <div style={S.card}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 10 }}>
              <Avatar src={client.avatar} name={p.name} size={56} />
              <div>
                <div style={{ ...S.display, fontSize: 22, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 13, color: T.sub }}>{[p.age && `${p.age}y`, p.sex, `+91 •••${client.phone.slice(-4)}`].filter(Boolean).join(" · ")}</div>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {p.goal && <span style={{ ...S.chip, background: T.pineSoft, color: T.pine }}>{p.goal}</span>}
              {p.freq && <span style={{ ...S.chip, background: T.tealSoft, color: T.teal }}>{p.freq}</span>}
              {p.targetWeight && <span style={{ ...S.chip, background: "#EEF0EA", color: T.sub }}>Target {p.targetWeight} kg</span>}
            </div>
            {p.note && <div style={{ fontSize: 13, color: T.sub, marginTop: 8 }}>Note: "{p.note}"</div>}
          </div>

          {chartData.length > 1 && (
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom: 10 }}>Weight trend (kg)</div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={T.line} strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: T.sub }} />
                  <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11, fill: T.sub }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="Weight" stroke={T.pine} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={S.card}>
            <div style={{ ...S.label, marginBottom: 8 }}>Check-ins</div>
            {recent.length === 0 && <div style={{ fontSize: 14, color: T.sub }}>No check-ins yet.</div>}
            {recent.slice(0, 14).map((c) => (
              <div key={c.id}>
                <button onClick={() => { setPhotos({}); setOpenCi(openCi?.id === c.id ? null : c); }} style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", background: openCi?.id === c.id ? T.pineSoft : "transparent", border: "none", borderBottom: `1px solid ${T.line}`, padding: "10px 6px", cursor: "pointer", fontFamily: "inherit", fontSize: 14, color: T.ink, borderRadius: 8 }}>
                  <span style={{ fontWeight: 600 }}>{fmtFull(c.date)}</span>
                  <span style={{ color: T.sub }}>{c.weight} kg · E{c.energy} · {c.workout ? "trained" : "rest"}{c.hasFront || c.hasSide ? " · 📷" : ""}</span>
                </button>
                {openCi?.id === c.id && (
                  <div style={{ margin: "8px 0", padding: 12, background: "#FBFBF9", borderRadius: 10, border: `1px solid ${T.line}` }}>
                    <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                      Weight {c.weight} kg{c.waist && ` · Waist ${c.waist} cm`}{c.chest && ` · Chest ${c.chest} cm`}{c.arm && ` · Arm ${c.arm} cm`}<br />
                      Energy {c.energy}/5 · Nutrition {c.nutrition}/5{c.sleep && ` · Sleep ${c.sleep}h`} · {c.workout ? "Workout done" : "No workout"}
                      {c.notes && <><br /><em>"{c.notes}"</em></>}
                    </div>
                    {(photos.front || photos.side) && (
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        {photos.front && <img src={photos.front} alt="front" style={{ width: "48%", borderRadius: 8, aspectRatio: "3/4", objectFit: "cover" }} />}
                        {photos.side && <img src={photos.side} alt="side" style={{ width: "48%", borderRadius: 8, aspectRatio: "3/4", objectFit: "cover" }} />}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={S.label}>Send feedback</div>
              <button onClick={draftWithAI} disabled={drafting || recent.length === 0} style={{ ...S.btnGhost, padding: "6px 12px", fontSize: 13, opacity: recent.length === 0 ? 0.4 : 1 }}>
                {drafting ? "Analyzing week…" : "✨ Draft with AI"}
              </button>
            </div>
            <textarea style={{ ...S.input, minHeight: 100, resize: "vertical", marginBottom: 10 }} placeholder={`Feedback message to ${p.name?.split(" ")[0] || "the client"}…`} value={fbText} onChange={(e) => setFbText(e.target.value)} />
            <div style={{ ...S.label, marginBottom: 4 }}>Action items (one per line)</div>
            <textarea style={{ ...S.input, minHeight: 80, resize: "vertical", marginBottom: 10 }} placeholder={"Hit 8k steps daily\nAdd one protein source at breakfast"} value={fbActions} onChange={(e) => setFbActions(e.target.value)} />
            <button style={S.btn} onClick={send}>{sent ? "Sent ✓" : "Send to client"}</button>
          </div>

          {client.feedback.length > 0 && (
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom: 8 }}>Previously sent</div>
              {client.feedback.slice(0, 6).map((f) => (
                <div key={f.id} style={{ padding: "8px 0", borderBottom: `1px solid ${T.line}`, fontSize: 13 }}>
                  <span style={{ color: T.sub }}>{fmtDay(f.date)} — </span>{f.text.slice(0, 100)}{f.text.length > 100 ? "…" : ""}
                  {f.actions?.length > 0 && <span style={{ color: T.sub }}> · {f.actions.filter((a) => a.done).length}/{f.actions.length} actions done</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
