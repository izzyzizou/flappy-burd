import { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 390, H = 680, BIRD_X = 90, BIRD_SIZE = 28;
const GRAVITY = 0.38, FLAP = -7.2;
const PIPE_WIDTH = 58, PIPE_GAP = 162, PIPE_SPEED = 2.4, PIPE_INTERVAL = 110;
const GROUND_H = 72;

// ─── Skins ────────────────────────────────────────────────────────────────────
const SKINS = [
  { id: "cyber",   name: "Cyber Blue",  price: 0,   body: "#00f5ff", wing: "#0099cc", glow: "#00f5ff", beak: "#ff6b35", emoji: "🐦" },
  { id: "plasma",  name: "Plasma Pink", price: 30,  body: "#ff2d78", wing: "#cc1155", glow: "#ff2d78", beak: "#ffcc00", emoji: "🌸" },
  { id: "gold",    name: "Solar Gold",  price: 50,  body: "#ffd700", wing: "#cc9900", glow: "#ffd700", beak: "#ff6600", emoji: "⭐" },
  { id: "void",    name: "Void Shadow", price: 75,  body: "#9b59b6", wing: "#5d2d8a", glow: "#9b59b6", beak: "#00f5ff", emoji: "👻" },
  { id: "inferno", name: "Inferno",     price: 120, body: "#ff4500", wing: "#cc2200", glow: "#ff4500", beak: "#ffff00", emoji: "🔥" },
  { id: "matrix",  name: "Matrix",      price: 200, body: "#00ff41", wing: "#009921", glow: "#00ff41", beak: "#ffffff", emoji: "💻" },
];

// ─── Maps ─────────────────────────────────────────────────────────────────────
const MAPS = [
  { id: "synthwave", name: "Synthwave",    price: 0,   emoji: "🌆",
    sky: ["#020010","#0a003a","#150055"], ground: ["#1a0035","#0f0025","#060015"],
    grid: "rgba(255,45,120,0.25)", gridGlow: "#ff2d78", horizon: "rgba(255,45,120,0.18)",
    building: "#08002a", pipe: ["#ff2d78","#ff69a0","#c0004a"], pipeGlow: "#ff2d78" },
  { id: "jungle",    name: "Neon Jungle",  price: 60,  emoji: "🌿",
    sky: ["#001208","#002a10","#003a18"], ground: ["#001a08","#000f04","#000802"],
    grid: "rgba(0,255,100,0.2)", gridGlow: "#00ff64", horizon: "rgba(0,255,100,0.15)",
    building: "#001a08", pipe: ["#00c853","#66ff99","#007a33"], pipeGlow: "#00c853" },
  { id: "space",     name: "Deep Space",   price: 80,  emoji: "🚀",
    sky: ["#000005","#050015","#0a0030"], ground: ["#050010","#030008","#010005"],
    grid: "rgba(100,100,255,0.2)", gridGlow: "#6464ff", horizon: "rgba(100,100,255,0.12)",
    building: "#050015", pipe: ["#6464ff","#9999ff","#3232cc"], pipeGlow: "#6464ff" },
  { id: "lava",      name: "Lava Zone",    price: 150, emoji: "🌋",
    sky: ["#100000","#2a0500","#3a0800"], ground: ["#200500","#150300","#0a0100"],
    grid: "rgba(255,80,0,0.3)", gridGlow: "#ff5000", horizon: "rgba(255,80,0,0.25)",
    building: "#1a0300", pipe: ["#ff5000","#ff8c00","#cc3000"], pipeGlow: "#ff5000" },
];

// ─── Audio ────────────────────────────────────────────────────────────────────
function useSynth() {
  const ctx = useRef(null);
  const init = useCallback(() => {
    if (!ctx.current) ctx.current = new (window.AudioContext || window.webkitAudioContext)();
    return ctx.current;
  }, []);
  const play = useCallback((freq, type = "square", duration = 0.1, vol = 0.08) => {
    try {
      const ac = init();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      gain.gain.setValueAtTime(vol, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + duration);
    } catch {}
  }, [init]);

  return {
    flap:  () => play(520, "square", 0.07, 0.07),
    score: () => { play(880, "square", 0.05); setTimeout(() => play(1100, "square", 0.05), 60); },
    die:   () => { play(200, "sawtooth", 0.3, 0.1); setTimeout(() => play(120, "sawtooth", 0.4, 0.1), 100); },
    buy:   () => { play(660, "sine", 0.08); setTimeout(() => play(880, "sine", 0.08), 80); setTimeout(() => play(1320, "sine", 0.15), 160); },
  };
}

// ─── Canvas draw functions ────────────────────────────────────────────────────
function drawBird(ctx, y, vel, frame, skin) {
  const rot = Math.min(Math.max(vel * 0.06, -0.45), 1.1);
  ctx.save();
  ctx.translate(BIRD_X, y);
  ctx.rotate(rot);
  ctx.shadowColor = skin.glow;
  ctx.shadowBlur = 18;
  ctx.fillStyle = skin.body;
  ctx.beginPath(); ctx.ellipse(0, 0, 14, 11, 0, 0, Math.PI * 2); ctx.fill();
  const wingY = Math.sin(frame * 0.35) * 4;
  ctx.fillStyle = skin.wing;
  ctx.beginPath(); ctx.ellipse(-3, wingY + 4, 8, 5, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#001122"; ctx.beginPath(); ctx.arc(6, -3, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(7, -4, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = skin.beak;
  ctx.beginPath(); ctx.moveTo(12, -1); ctx.lineTo(18, 1); ctx.lineTo(12, 3); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawPipe(ctx, x, topH, frame, map) {
  const botY = topH + PIPE_GAP;
  const [c1, c2, c3] = map.pipe;
  const makeGrad = () => {
    const g = ctx.createLinearGradient(x, 0, x + PIPE_WIDTH, 0);
    g.addColorStop(0, c1);
    g.addColorStop(0.5, c2);
    g.addColorStop(1, c3);
    return g;
  };
  ctx.shadowColor = map.pipeGlow;
  ctx.shadowBlur = 14;
  ctx.fillStyle = makeGrad(); ctx.fillRect(x, 0, PIPE_WIDTH, topH);
  ctx.fillStyle = c1; ctx.fillRect(x - 6, topH - 22, PIPE_WIDTH + 12, 22);
  ctx.fillStyle = makeGrad(); ctx.fillRect(x, botY, PIPE_WIDTH, H - botY - GROUND_H);
  ctx.fillStyle = c1; ctx.fillRect(x - 6, botY, PIPE_WIDTH + 12, 22);
  ctx.shadowBlur = 0;
  const a = 0.6 + Math.sin(frame * 0.05) * 0.15;
  ctx.strokeStyle = `rgba(255,255,255,${a * 0.3})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 4, 0, 4, topH - 22);
  ctx.strokeRect(x - 2, topH - 22, 4, 22);
  ctx.strokeRect(x + 4, botY + 22, 4, H - botY - 22 - GROUND_H);
  ctx.strokeRect(x - 2, botY, 4, 22);
}

function drawBackground(ctx, bgOffset, frame, map) {
  const sky = ctx.createLinearGradient(0, 0, 0, H - GROUND_H);
  map.sky.forEach((c, i) => sky.addColorStop(i / (map.sky.length - 1), c));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H - GROUND_H);

  const stars = [[30,40],[80,20],[150,60],[220,30],[300,50],[360,15],[50,100],[180,90],[280,80],[340,110],[120,140],[250,120]];
  stars.forEach(([sx, sy], i) => {
    ctx.globalAlpha = 0.4 + Math.sin(frame * 0.06 + i * 0.7) * 0.3;
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(sx, sy, 1 + Math.sin(frame * 0.07 + i) * 0.5, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;

  ctx.fillStyle = map.building;
  [[0,80,40],[40,50,30],[70,90,25],[95,60,35],[130,100,28],[158,45,20],[178,75,32],[210,110,28],[238,55,22],[260,85,30],[290,120,25],[315,65,35],[350,95,28],[378,50,12]].forEach(([bx,bh,bw]) => {
    ctx.fillRect(bx, H - GROUND_H - bh, bw, bh);
    ctx.fillStyle = "rgba(255,220,80,0.15)";
    for (let wy = 10; wy < bh - 10; wy += 14) {
      for (let wx = 4; wx < bw - 6; wx += 10) {
        if (Math.random() > 0.4) ctx.fillRect(bx + wx, H - GROUND_H - bh + wy, 5, 7);
      }
    }
    ctx.fillStyle = map.building;
  });

  const hg = ctx.createLinearGradient(0, H - GROUND_H - 60, 0, H - GROUND_H);
  hg.addColorStop(0, "transparent"); hg.addColorStop(1, map.horizon);
  ctx.fillStyle = hg;
  ctx.fillRect(0, H - GROUND_H - 60, W, 60);

  const gg = ctx.createLinearGradient(0, H - GROUND_H, 0, H);
  map.ground.forEach((c, i) => gg.addColorStop(i / (map.ground.length - 1), c));
  ctx.fillStyle = gg;
  ctx.fillRect(0, H - GROUND_H, W, GROUND_H);

  ctx.strokeStyle = map.grid;
  ctx.lineWidth = 1;
  const off = bgOffset % 40;
  for (let gx = -off; gx < W + 40; gx += 40) {
    ctx.beginPath(); ctx.moveTo(gx, H - GROUND_H); ctx.lineTo(gx - 30, H); ctx.stroke();
  }
  for (let i = 1; i < 4; i++) {
    ctx.globalAlpha = 0.12 + i * 0.06;
    ctx.beginPath(); ctx.moveTo(0, H - GROUND_H + (GROUND_H / 4) * i); ctx.lineTo(W, H - GROUND_H + (GROUND_H / 4) * i); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.shadowColor = map.gridGlow; ctx.shadowBlur = 8; ctx.strokeStyle = map.gridGlow; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, H - GROUND_H); ctx.lineTo(W, H - GROUND_H); ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawHUD(ctx, score, coins) {
  ctx.shadowColor = "#00f5ff";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#00f5ff";
  ctx.font = "bold 52px 'Courier New',monospace";
  ctx.textAlign = "center";
  ctx.fillText(score, W / 2, 80);
  ctx.shadowBlur = 0;
  ctx.font = "bold 15px 'Courier New',monospace";
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffd700";
  ctx.shadowColor = "#ffd700";
  ctx.shadowBlur = 8;
  ctx.fillText(`⬡ ${coins}`, W - 14, 30);
  ctx.shadowBlur = 0;
}

function StorePage({ coins, ownedSkins, ownedMaps, activeSkin, activeMap, onBuy, onEquip, onClose }) {
  const [tab, setTab] = useState("skins");
  const items  = tab === "skins" ? SKINS : MAPS;
  const owned  = tab === "skins" ? ownedSkins : ownedMaps;
  const active = tab === "skins" ? activeSkin : activeMap;

  return (
    <div onPointerDown={(e) => e.stopPropagation()} style={{
      position: "absolute", inset: 0, background: "#020010",
      display: "flex", flexDirection: "column", fontFamily: "'Courier New',monospace", color: "#fff",
    }}>
      <div style={{ padding: "18px 20px 0", borderBottom: "1px solid rgba(0,245,255,0.1)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 5, color: "#ff2d78", textTransform: "uppercase", marginBottom: 2 }}>NEON FLAPPY</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#00f5ff", textShadow: "0 0 20px #00f5ff", letterSpacing: -1 }}>STORE</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: "rgba(255,215,0,0.5)", textTransform: "uppercase", marginBottom: 4 }}>COINS</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#ffd700", textShadow: "0 0 14px #ffd700" }}>⬡ {coins}</div>
          </div>
        </div>
        <div style={{ display: "flex" }}>
          {[{id:"skins",label:"🐦  Skins"},{id:"maps",label:"🗺️  Maps"}].map(({id,label}) => (
            <div key={id} onPointerDown={(e) => { e.stopPropagation(); setTab(id); }} style={{
              flex: 1, padding: "10px 0", textAlign: "center", fontSize: 11, letterSpacing: 3,
              textTransform: "uppercase", cursor: "pointer",
              borderBottom: tab === id ? "2px solid #00f5ff" : "2px solid transparent",
              color: tab === id ? "#00f5ff" : "rgba(255,255,255,0.35)",
              textShadow: tab === id ? "0 0 10px #00f5ff" : "none",
              transition: "all 0.15s",
            }}>{label}</div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {items.map(item => {
          const isOwned = owned.includes(item.id);
          const isActive = active === item.id;
          const canAfford = coins >= item.price;
          return (
            <div key={item.id} style={{
              borderRadius: 14, padding: 14, position: "relative",
              background: isActive ? "linear-gradient(135deg,rgba(0,245,255,0.1),rgba(0,245,255,0.03))" : "rgba(255,255,255,0.03)",
              border: isActive ? "1.5px solid rgba(0,245,255,0.45)" : isOwned ? "1.5px solid rgba(255,255,255,0.09)" : "1.5px solid rgba(255,255,255,0.04)",
              boxShadow: isActive ? "0 0 18px rgba(0,245,255,0.08)" : "none",
            }}>
              {isActive && (
                <div style={{ position: "absolute", top: 8, right: 8, fontSize: 8, letterSpacing: 2,
                  background: "#00f5ff", color: "#000", padding: "2px 6px", borderRadius: 4, fontWeight: 900 }}>ON</div>
              )}
              <div style={{ fontSize: 34, textAlign: "center", marginBottom: 6 }}>{item.emoji}</div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#fff", textAlign: "center", marginBottom: 6 }}>{item.name}</div>

              {tab === "skins" && (
                <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 10 }}>
                  {[item.body, item.wing, item.beak].map((c, i) => (
                    <div key={i} style={{ width: 11, height: 11, borderRadius: "50%", background: c, boxShadow: `0 0 5px ${c}` }} />
                  ))}
                </div>
              )}

              {tab === "maps" && (
                <div style={{ display: "flex", justifyContent: "center", gap: 2, marginBottom: 10, borderRadius: 4, overflow: "hidden", height: 12 }}>
                  {item.sky.map((c, i) => <div key={i} style={{ flex: 1, background: c }} />)}
                </div>
              )}

              {isOwned ? (
                <div onPointerDown={(e) => { e.stopPropagation(); onEquip(tab === "skins" ? "skin" : "map", item.id); }} style={{
                  textAlign: "center", padding: "8px 0", borderRadius: 8, fontSize: 10, letterSpacing: 2, cursor: "pointer", fontWeight: 700,
                  background: isActive ? "rgba(0,245,255,0.07)" : "rgba(255,255,255,0.05)",
                  border: isActive ? "1px solid rgba(0,245,255,0.25)" : "1px solid rgba(255,255,255,0.1)",
                  color: isActive ? "#00f5ff" : "rgba(255,255,255,0.5)",
                }}>{isActive ? "EQUIPPED" : "EQUIP"}</div>
              ) : (
                <div onPointerDown={(e) => { e.stopPropagation(); if (canAfford) onBuy(tab === "skins" ? "skin" : "map", item); }} style={{
                  textAlign: "center", padding: "8px 0", borderRadius: 8, fontSize: 10, letterSpacing: 2, fontWeight: 700,
                  cursor: canAfford ? "pointer" : "not-allowed",
                  background: canAfford ? "linear-gradient(135deg,rgba(255,215,0,0.13),rgba(255,215,0,0.04))" : "rgba(255,255,255,0.02)",
                  border: canAfford ? "1px solid rgba(255,215,0,0.35)" : "1px solid rgba(255,255,255,0.05)",
                  color: canAfford ? "#ffd700" : "rgba(255,255,255,0.18)",
                  textShadow: canAfford ? "0 0 8px #ffd700" : "none",
                }}>⬡ {item.price}</div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ padding: "10px 20px", borderTop: "1px solid rgba(255,255,255,0.05)", textAlign: "center",
        fontSize: 10, letterSpacing: 3, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", flexShrink: 0 }}>
        EARN ⬡1 COIN PER PIPE CLEARED
      </div>

      <div onPointerDown={(e) => { e.stopPropagation(); onClose(); }} style={{
        margin: "10px 18px 70px", padding: "13px 0", borderRadius: 12, textAlign: "center",
        fontSize: 11, letterSpacing: 4, textTransform: "uppercase", cursor: "pointer", flexShrink: 0,
        border: "1.5px solid rgba(255,45,120,0.35)", color: "#ff2d78",
        textShadow: "0 0 8px #ff2d78", boxShadow: "0 0 12px rgba(255,45,120,0.08)",
      }}>← BACK TO GAME</div>
    </div>
  );
}

export default function FlappyBird() {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    bird:{y:H/2, vel:0}, pipes:[], score:0, frame:0, bgOffset:0, phase:"start", flashFrames:0,
    bestScore:0, coins:0, activeSkin:"cyber", activeMap:"synthwave"
  });
  const animRef = useRef(null);

  const [page, setPage] = useState("game");
  const [phase, setPhase] = useState("start");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [coins, setCoins] = useState(0);
  const [ownedSkins, setOwnedSkins] = useState(["cyber"]);
  const [ownedMaps, setOwnedMaps] = useState(["synthwave"]);
  const [activeSkin, setActiveSkin] = useState("cyber");
  const [activeMap, setActiveMap] = useState("synthwave");
  const [toast, setToast] = useState(null);

  const sfx = useSynth();

  const buildSave = useCallback((overrides = {}) => ({
    coins: stateRef.current.coins,
    best: stateRef.current.bestScore,
    ownedSkins, ownedMaps,
    activeSkin: stateRef.current.activeSkin,
    activeMap: stateRef.current.activeMap,
    ...overrides,
  }), [ownedSkins, ownedMaps]);

  const persist = useCallback(async (data) => {
    try { await window.storage?.set?.("flappy_save2", JSON.stringify(data)); } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage?.get?.("flappy_save2");
        if (!r) return;
        const d = JSON.parse(r.value);
        if (d.coins != null) { setCoins(d.coins); stateRef.current.coins = d.coins; }
        if (d.best != null) { setBest(d.best); stateRef.current.bestScore = d.best; }
        if (d.ownedSkins) setOwnedSkins(d.ownedSkins);
        if (d.ownedMaps) setOwnedMaps(d.ownedMaps);
        if (d.activeSkin) { setActiveSkin(d.activeSkin); stateRef.current.activeSkin = d.activeSkin; }
        if (d.activeMap) { setActiveMap(d.activeMap); stateRef.current.activeMap = d.activeMap; }
      } catch {}
    })();
  }, []);

  useEffect(() => { stateRef.current.activeSkin = activeSkin; }, [activeSkin]);
  useEffect(() => { stateRef.current.activeMap = activeMap; }, [activeMap]);
  useEffect(() => { stateRef.current.coins = coins; }, [coins]);

  const reset = useCallback(() => {
    const s = stateRef.current;
    Object.assign(s, {
      bird:{y:H/2, vel:0}, pipes:[], score:0, frame:0, bgOffset:0, phase:"playing", flashFrames:0
    });
    setScore(0); setPhase("playing");
  }, []);

  const flap = useCallback(() => {
    if (page !== "game") return;
    const s = stateRef.current;
    if (s.phase === "start" || s.phase === "dead") { reset(); return; }
    s.bird.vel = FLAP; sfx.flap();
  }, [page, reset, sfx]);

  useEffect(() => {
    const h = (e) => { if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); flap(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [flap]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const loop = () => {
      const s = stateRef.current;
      s.frame++; s.bgOffset += PIPE_SPEED * 0.6;

      if (s.phase === "playing") {
        s.bird.vel += GRAVITY;
        s.bird.y += s.bird.vel;

        if (s.frame % PIPE_INTERVAL === 0) {
          s.pipes.push({ x: W + 10, topH: 80 + Math.random() * (H - GROUND_H - PIPE_GAP - 130), scored: false });
        }

        s.pipes.forEach(p => { p.x -= PIPE_SPEED; });
        s.pipes = s.pipes.filter(p => p.x > -PIPE_WIDTH - 20);

        s.pipes.forEach(p => {
          if (!p.scored && p.x + PIPE_WIDTH < BIRD_X) {
            p.scored = true; s.score++; s.coins++;
            setScore(s.score); setCoins(s.coins); sfx.score();
          }
        });

        const bx = BIRD_X, by = s.bird.y;
        const dead = by + BIRD_SIZE / 2 > H - GROUND_H || by - BIRD_SIZE / 2 < 0 ||
          s.pipes.some(p => bx + BIRD_SIZE / 2 - 4 > p.x && bx - BIRD_SIZE / 2 + 4 < p.x + PIPE_WIDTH &&
            (by - BIRD_SIZE / 2 + 4 < p.topH || by + BIRD_SIZE / 2 - 4 > p.topH + PIPE_GAP));

        if (dead) {
          s.phase = "dead"; s.flashFrames = 12; sfx.die();
          const nb = Math.max(s.score, s.bestScore);
          s.bestScore = nb;
          setBest(nb); setPhase("dead");
          persist(buildSave({ coins: s.coins, best: nb, ownedSkins:["cyber"], ownedMaps:["synthwave"] }));
        }
      }

      if (s.flashFrames > 0) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, W, H);
        s.flashFrames--;
        animRef.current = requestAnimationFrame(loop);
        return;
      }

      const skin = SKINS.find(sk => sk.id === s.activeSkin) || SKINS[0];
      const map = MAPS.find(m => m.id === s.activeMap) || MAPS[0];
      drawBackground(ctx, s.bgOffset, s.frame, map);
      s.pipes.forEach(p => drawPipe(ctx, p.x, p.topH, s.frame, map));
      drawBird(ctx, s.bird.y, s.bird.vel, s.frame, skin);
      if (s.phase === "playing" || s.phase === "dead") drawHUD(ctx, s.score, s.coins);
      ctx.fillStyle = "rgba(0,0,0,0.04)";
      for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [sfx, persist, buildSave]);

  const handleBuy = useCallback((type, item) => {
    setCoins((prev) => {
      if (prev < item.price) return prev;
      const nc = prev - item.price;
      stateRef.current.coins = nc;

      if (type === "skin") {
        setOwnedSkins((os) => {
          const next = [...os, item.id];
          setActiveSkin(item.id); stateRef.current.activeSkin = item.id;
          persist(buildSave({ coins: nc, ownedSkins: next, activeSkin: item.id }));
          return next;
        });
      } else {
        setOwnedMaps((om) => {
          const next = [...om, item.id];
          setActiveMap(item.id); stateRef.current.activeMap = item.id;
          persist(buildSave({ coins: nc, ownedMaps: next, activeMap: item.id }));
          return next;
        });
      }

      sfx.buy();
      setToast(`✓ ${item.name} unlocked!`);
      setTimeout(() => setToast(null), 2200);
      return nc;
    });
  }, [sfx, persist, buildSave]);

  const handleEquip = useCallback((type, id) => {
    if (type === "skin") { setActiveSkin(id); stateRef.current.activeSkin = id; }
    else { setActiveMap(id); stateRef.current.activeMap = id; }
    persist(buildSave({ activeSkin: type === "skin" ? id : stateRef.current.activeSkin, activeMap: type === "map" ? id : stateRef.current.activeMap }));
  }, [persist, buildSave]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "linear-gradient(135deg,#010008,#06001f)", fontFamily: "'Courier New',monospace", userSelect: "none", WebkitUserSelect: "none" }}>
      <div style={{ position: "relative", width: W, height: H, maxWidth: "100vw", maxHeight: "100vh", borderRadius: 24, overflow: "hidden", boxShadow: "0 0 60px rgba(0,245,255,0.14),0 0 120px rgba(255,45,120,0.09)", border: "1.5px solid rgba(0,245,255,0.18)" }}>

        <div onPointerDown={page === "game" ? flap : undefined} style={{ position: "absolute", inset: 0, touchAction: "none", cursor: page === "game" ? "pointer" : "default" }}>
          <canvas ref={canvasRef} width={W} height={H} style={{ display: "block", width: "100%", height: "100%" }} />

          {page === "game" && phase === "start" && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(1,0,12,0.75)", backdropFilter: "blur(2px)", pointerEvents: "none" }}>
              <div style={{ fontSize: 12, letterSpacing: 6, color: "#ff2d78", textTransform: "uppercase", marginBottom: 10 }}>SYNTHWAVE</div>
              <div style={{ fontSize: 52, fontWeight: 900, color: "#00f5ff", textShadow: "0 0 30px #00f5ff", letterSpacing: -1, lineHeight: 1, marginBottom: 4 }}>FLAPPY</div>
              <div style={{ fontSize: 52, fontWeight: 900, color: "#ff2d78", textShadow: "0 0 30px #ff2d78", letterSpacing: -1, lineHeight: 1, marginBottom: 36 }}>NEON</div>
              <div style={{ width: 60, height: 60, border: "2px solid #00f5ff", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22, boxShadow: "0 0 18px #00f5ff33", animation: "pulse 1.4s ease-in-out infinite" }}>
                <span style={{ fontSize: 24 }}>▶</span>
              </div>
              <div style={{ color: "rgba(0,245,255,0.7)", fontSize: 12, letterSpacing: 3, textTransform: "uppercase" }}>TAP TO START</div>
              <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.7;transform:scale(.95)}}`}</style>
            </div>
          )}

          {page === "game" && phase === "dead" && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(1,0,12,0.82)", backdropFilter: "blur(3px)", pointerEvents: "none" }}>
              <div style={{ fontSize: 12, letterSpacing: 6, color: "#ff2d78", textTransform: "uppercase", marginBottom: 16 }}>GAME OVER</div>
              <div style={{ display: "flex", gap: 40, marginBottom: 14 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "rgba(0,245,255,0.5)", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>SCORE</div>
                  <div style={{ color: "#00f5ff", fontSize: 44, fontWeight: 900, textShadow: "0 0 20px #00f5ff" }}>{score}</div>
                </div>
                <div style={{ width: 1, background: "rgba(255,255,255,0.1)" }} />
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "rgba(255,45,120,0.6)", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>BEST</div>
                  <div style={{ color: "#ff2d78", fontSize: 44, fontWeight: 900, textShadow: "0 0 20px #ff2d78" }}>{best}</div>
                </div>
              </div>
              <div style={{ color: "#ffd700", fontSize: 14, letterSpacing: 3, marginBottom: 28, textShadow: "0 0 10px #ffd700" }}>⬡ {coins} COINS</div>
              <div style={{ color: "rgba(0,245,255,0.65)", fontSize: 11, letterSpacing: 3, textTransform: "uppercase" }}>TAP TO PLAY AGAIN</div>
            </div>
          )}
        </div>

        {page === "store" && (
          <StorePage coins={coins} ownedSkins={ownedSkins} ownedMaps={ownedMaps} activeSkin={activeSkin} activeMap={activeMap} onBuy={handleBuy} onEquip={handleEquip} onClose={() => setPage("game") } />
        )}

        {toast && (
          <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.92)", border: "1px solid #ffd700", borderRadius: 10, padding: "8px 18px", fontSize: 11, letterSpacing: 2, color: "#ffd700", textShadow: "0 0 8px #ffd700", whiteSpace: "nowrap", pointerEvents: "none", zIndex: 200 }}>
            {toast}
          </div>
        )}

        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 58, background: "rgba(2,0,16,0.96)", borderTop: "1px solid rgba(0,245,255,0.1)", display: "flex", backdropFilter: "blur(10px)", zIndex: 50 }}>
          {[{id:"game",label:"PLAY",icon:"▶"},{id:"store",label:"STORE",icon:"🛒"}].map(({id,label,icon}) => (
            <div key={id} onPointerDown={(e) => { e.stopPropagation(); setPage(id); }} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer", transition: "all 0.15s",
              color: page === id ? "#00f5ff" : "rgba(255,255,255,0.3)",
              textShadow: page === id ? "0 0 10px #00f5ff" : "none",
              borderTop: page === id ? "2px solid #00f5ff" : "2px solid transparent",
            }}>
              <div style={{ fontSize: 16 }}>{icon}</div>
              <div style={{ fontSize: 8, letterSpacing: 3, textTransform: "uppercase" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
