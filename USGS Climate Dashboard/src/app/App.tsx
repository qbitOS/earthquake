import { useState, useEffect, useRef, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Activity, Radio, Zap, AlertTriangle, Signal, Clock, Play, RotateCcw, Layers, Wifi,
} from "lucide-react";

// ─── Static Data ──────────────────────────────────────────────────────────────

const EVENTS = [
  { id: 1, location: "Venezuela",    region: "S. America",  lat: 10.5,  lon: -63.2,  mag: 7.5, depth: 14, time: "20:31:07", ago: "17m",    color: "#ef4444" },
  { id: 2, location: "Japan Honshu", region: "W. Pacific",  lat: 35.6,  lon: 140.8,  mag: 6.9, depth: 32, time: "19:44:22", ago: "1h 4m",   color: "#f97316" },
  { id: 3, location: "Philippines",  region: "SE Asia",     lat: 12.4,  lon: 123.9,  mag: 5.8, depth: 67, time: "18:12:45", ago: "2h 36m",  color: "#f97316" },
  { id: 4, location: "Chile",        region: "S. America",  lat: -23.5, lon: -70.1,  mag: 5.2, depth: 45, time: "17:55:11", ago: "2h 53m",  color: "#eab308" },
  { id: 5, location: "Alaska",       region: "N. America",  lat: 59.8,  lon: -152.3, mag: 4.9, depth: 18, time: "16:41:33", ago: "4h 7m",   color: "#eab308" },
  { id: 6, location: "Indonesia",    region: "SE Asia",     lat: -6.2,  lon: 130.5,  mag: 4.7, depth: 92, time: "15:22:18", ago: "5h 26m",  color: "#84cc16" },
  { id: 7, location: "New Zealand",  region: "SW Pacific",  lat: -40.1, lon: 175.8,  mag: 4.3, depth: 23, time: "14:09:52", ago: "6h 39m",  color: "#84cc16" },
  { id: 8, location: "Mexico",       region: "N. America",  lat: 16.8,  lon: -97.3,  mag: 4.1, depth: 55, time: "13:44:07", ago: "7h 4m",   color: "#22c55e" },
];

const STATIONS = [
  { id: "ANMO", name: "Albuquerque, NM", lat: 34.9,  lon: -106.5, status: "synced",  pArr: "17:12", sArr: "29:44" },
  { id: "COLA", name: "College, AK",     lat: 64.9,  lon: -147.8, status: "synced",  pArr: "12:33", sArr: "20:51" },
  { id: "HRV",  name: "Harvard, MA",     lat: 42.5,  lon: -71.6,  status: "synced",  pArr: "19:08", sArr: "32:15" },
  { id: "KONO", name: "Kongsberg, NO",   lat: 59.6,  lon:   9.6,  status: "active",  pArr: "28:44", sArr: "48:22" },
  { id: "LSZ",  name: "Lusaka, ZM",      lat: -15.3, lon:  28.2,  status: "active",  pArr: "31:17", sArr: "52:39" },
  { id: "MAJO", name: "Matsushiro, JP",  lat: 36.5,  lon: 138.2,  status: "synced",  pArr: "09:22", sArr: "15:44" },
  { id: "PFO",  name: "Pinon Flat, CA",  lat: 33.6,  lon: -116.5, status: "delayed", pArr: "16:55", sArr: "28:10" },
  { id: "PMSA", name: "Palmer, AQ",      lat: -64.8, lon:  -64.1, status: "synced",  pArr: "38:02", sArr: "64:17" },
];

const MAG_HISTORY = [
  { t: "13:00", mag: 3.2, events: 2 },
  { t: "14:00", mag: 4.1, events: 3 },
  { t: "15:00", mag: 4.7, events: 5 },
  { t: "16:00", mag: 4.9, events: 4 },
  { t: "17:00", mag: 5.2, events: 7 },
  { t: "18:00", mag: 5.8, events: 6 },
  { t: "19:00", mag: 6.9, events: 3 },
  { t: "20:00", mag: 7.5, events: 2 },
  { t: "21:00", mag: 3.8, events: 1 },
];

const WAVE_CONFIG: Record<string, { color: string; label: string; speed: string; duration: number }> = {
  P:       { color: "#22d3ee", label: "P-wave",   speed: "6.8 km/s", duration: 6500  },
  S:       { color: "#d946ef", label: "S-wave",   speed: "4.1 km/s", duration: 10500 },
  Surface: { color: "#facc15", label: "Surface",  speed: "3.5 km/s", duration: 14500 },
};

const STATUS_COLOR: Record<string, string> = {
  synced:  "#22c55e",
  active:  "#22d3ee",
  delayed: "#f97316",
};

// ─── Seismic Ray Path Diagram ────────────────────────────────────────────────

interface RayPhase {
  name: string;
  color: string;
  alpha: number;
  maxDist: number;
  bend: number;   // quadratic control-point angular offset (radians)
  lineWidth: number;
}

const RAY_PHASES: RayPhase[] = [
  { name: "P",       color: "#22d3ee", alpha: 0.55, maxDist: 0.94, bend:  0.00, lineWidth: 0.7 },
  { name: "S",       color: "#d946ef", alpha: 0.45, maxDist: 0.90, bend:  0.07, lineWidth: 0.7 },
  { name: "PP",      color: "#60a5fa", alpha: 0.35, maxDist: 0.87, bend:  0.13, lineWidth: 0.6 },
  { name: "PKP",     color: "#4ade80", alpha: 0.30, maxDist: 0.93, bend: -0.11, lineWidth: 0.6 },
  { name: "PcP",     color: "#fb923c", alpha: 0.28, maxDist: 0.76, bend:  0.19, lineWidth: 0.5 },
  { name: "Surface", color: "#facc15", alpha: 0.38, maxDist: 0.86, bend:  0.09, lineWidth: 0.6 },
  { name: "ScS",     color: "#a78bfa", alpha: 0.22, maxDist: 0.81, bend: -0.09, lineWidth: 0.5 },
  { name: "SS",      color: "#f87171", alpha: 0.22, maxDist: 0.83, bend:  0.16, lineWidth: 0.5 },
];

type ViewMode = "planet" | "current" | "selected";

function SeismicRayCanvas({ events, selectedId, viewMode }: { events: typeof EVENTS; selectedId: number | null; viewMode: ViewMode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#030711";
    ctx.fillRect(0, 0, W, H);

    const ev = events.find((e) => e.id === selectedId);

    if (!ev) {
      ctx.fillStyle = "rgba(34,211,238,0.25)";
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = "center";
      ctx.fillText("Select an event to render ray paths", W / 2, H / 2);
      return;
    }

    // View-mode parameters
    // R90 = pixels per 90 degrees of angular distance
    // maxAngDeg = maximum angular distance rendered (clips rays beyond this)
    const R90 =
      viewMode === "planet"   ? Math.min(W * 0.195, H * 0.32) :
      viewMode === "selected" ? Math.min(W * 0.50,  H * 0.78) :
                                Math.min(W * 0.30,  H * 0.42);

    const maxAngDeg =
      viewMode === "planet"   ? 180 :
      viewMode === "selected" ? 55  :
                                135;

    const CX = W * 0.48;
    const CY = H * 0.5;

    // ── Background radial glow at source ──
    const srcGlow = ctx.createRadialGradient(CX, CY, 0, CX, CY, R90 * 0.4);
    srcGlow.addColorStop(0, `${ev.color}44`);
    srcGlow.addColorStop(1, "transparent");
    ctx.fillStyle = srcGlow;
    ctx.fillRect(0, 0, W, H);

    // ── Distance rings ──
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    const ringDeg = viewMode === "selected" ? [10, 20, 30, 45, 55] : [30, 60, 90, 120, 150, 180];
    ringDeg.forEach((deg) => {
      if (deg > maxAngDeg) return;
      const r = (deg / 90) * R90;
      const isRef = deg === 90 || (viewMode === "selected" && deg === 30);
      ctx.beginPath();
      ctx.arc(CX, CY, r, 0, Math.PI * 2);
      ctx.strokeStyle = isRef ? "rgba(34,211,238,0.22)" : "rgba(34,211,238,0.07)";
      ctx.lineWidth = isRef ? 0.8 : 0.5;
      ctx.setLineDash(isRef ? [] : [3, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(34,211,238,0.3)";
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.textAlign = "left";
      ctx.fillText(`${deg}deg`, CX + r + 3, CY - 3);
    });

    // Outer boundary circle
    const boundR = (maxAngDeg / 90) * R90;
    ctx.beginPath();
    ctx.arc(CX, CY, boundR, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(34,211,238,0.28)";
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.stroke();
    ctx.restore();

    // ── Ray paths using screen blending ──
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const RAYS = viewMode === "planet" ? 480 : 720;
    for (let i = 0; i < RAYS; i++) {
      const bearing = (i / RAYS) * Math.PI * 2;

      RAY_PHASES.forEach((phase) => {
        const phaseDeg = phase.maxDist * 180;
        const clampedDeg = Math.min(phaseDeg, maxAngDeg);
        const r = (clampedDeg / 90) * R90;
        const ex = CX + r * Math.sin(bearing);
        const ey = CY - r * Math.cos(bearing);

        const midR = r * 0.52;
        const cpA = bearing + phase.bend;
        const cpX = CX + midR * Math.sin(cpA);
        const cpY = CY - midR * Math.cos(cpA);

        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.quadraticCurveTo(cpX, cpY, ex, ey);
        ctx.strokeStyle = phase.color;
        ctx.lineWidth = viewMode === "selected" ? phase.lineWidth * 1.4 : phase.lineWidth;
        ctx.globalAlpha = viewMode === "planet" ? phase.alpha * 0.75 : phase.alpha;
        ctx.stroke();
      });
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // -- Station dots (projected from epicenter via great-circle approx) --
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    STATIONS.forEach((st) => {
      const dLatRad = (st.lat - ev.lat) * (Math.PI / 180);
      const dLonRad = (st.lon - ev.lon) * (Math.PI / 180);
      const lat1 = (ev.lat * Math.PI) / 180;
      const lat2 = (st.lat * Math.PI) / 180;
      // Haversine angular distance
      const sinDLat = Math.sin(dLatRad / 2);
      const sinDLon = Math.sin(dLonRad / 2);
      const hav = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
      const angDeg = (2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav)) * 180) / Math.PI;
      // Forward azimuth bearing
      const bear = Math.atan2(
        Math.sin(dLonRad) * Math.cos(lat2),
        Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLonRad)
      );
      const r = (angDeg / 90) * R90;
      const sx = CX + r * Math.sin(bear);
      const sy = CY - r * Math.cos(bear);
      const sc = STATUS_COLOR[st.status] || "#22c55e";

      ctx.beginPath();
      ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = sc;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx, sy, 7, 0, Math.PI * 2);
      ctx.fillStyle = sc + "44";
      ctx.fill();

      // Station ID label
      ctx.fillStyle = "rgba(224,240,255,0.7)";
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.textAlign = "left";
      ctx.fillText(st.id, sx + 5, sy + 3);
    });
    ctx.restore();

    // ── Epicenter marker ──
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    const glow = ctx.createRadialGradient(CX, CY, 0, CX, CY, 28);
    glow.addColorStop(0, ev.color + "cc");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(CX, CY, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(CX, CY, 6, 0, Math.PI * 2);
    ctx.fillStyle = ev.color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(CX, CY, 6, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ── Legend (right side) ──
    const lx = W * 0.88;
    let ly = H * 0.12;
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillStyle = "rgba(34,211,238,0.6)";
    ctx.textAlign = "left";
    ctx.fillText("SEISMIC PHASES", lx, ly);
    ly += 14;

    RAY_PHASES.forEach((phase) => {
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + 18, ly);
      ctx.strokeStyle = phase.color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.9;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(157,184,207,0.85)";
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText(phase.name, lx + 22, ly + 3);
      ly += 13;
    });

    // ── Header label ──
    ctx.fillStyle = "rgba(34,211,238,0.5)";
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = "center";
    const modeLabel =
      viewMode === "planet"   ? "FULL PLANET VIEW - 180deg RADIUS - ALL PHASES" :
      viewMode === "selected" ? `SIGHT: ${ev.location.toUpperCase()} M${ev.mag} - 55deg RADIUS - ZOOMED` :
                                `M${ev.mag} ${ev.location.toUpperCase()} - CURRENT VIEW - 135deg RADIUS`;
    ctx.fillText(modeLabel, CX, 14);
    ctx.restore();
  }, [events, selectedId]);

  return (
    <canvas
      ref={canvasRef}
      width={1400}
      height={240}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}

// ─── Globe Canvas ──────────────────────────────────────────────────────────────

interface WaveEntry {
  id: number;
  eventId: number;
  type: string;
  startTime: number;
}

interface GlobeProps {
  events: typeof EVENTS;
  wavesRef: React.MutableRefObject<WaveEntry[]>;
  selectedIdRef: React.MutableRefObject<number | null>;
  onClickRef: React.MutableRefObject<(id: number | null) => void>;
}

function Globe({ events, wavesRef, selectedIdRef, onClickRef }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotRef = useRef(-25);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width;
    const H = canvas.height;
    const CX = W / 2;
    const CY = H / 2;
    const R = W / 2 - 14;
    let animId: number;

    const proj = (lat: number, lon: number) => {
      const latRad = (lat * Math.PI) / 180;
      const lonRad = ((lon - rotRef.current) * Math.PI) / 180;
      const cosLat = Math.cos(latRad);
      const sinLat = Math.sin(latRad);
      const sinLon = Math.sin(lonRad);
      const cosLon = Math.cos(lonRad);
      return {
        x: CX + R * cosLat * sinLon,
        y: CY - R * sinLat,
        vis: cosLat * cosLon > -0.05,
        depth: cosLat * cosLon,
      };
    };

    const draw = (ts: number) => {
      ctx.clearRect(0, 0, W, H);

      // — Sphere fill —
      ctx.save();
      const bg = ctx.createRadialGradient(CX - R * 0.28, CY - R * 0.32, R * 0.04, CX, CY, R);
      bg.addColorStop(0, "#183c6e");
      bg.addColorStop(0.45, "#0d1f40");
      bg.addColorStop(1, "#050a17");
      ctx.beginPath();
      ctx.arc(CX, CY, R, 0, Math.PI * 2);
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.clip();

      // — Grid —
      ctx.strokeStyle = "rgba(34,211,238,0.09)";
      ctx.lineWidth = 0.5;

      // Latitude parallels
      for (let lat = -60; lat <= 60; lat += 30) {
        const latRad = (lat * Math.PI) / 180;
        const ys = CY - R * Math.sin(latRad);
        const rx = R * Math.cos(latRad);
        ctx.beginPath();
        ctx.ellipse(CX, ys, rx, Math.max(rx * 0.055, 1), 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Meridians
      for (let lon = 0; lon < 360; lon += 30) {
        const lonRad = ((lon - rotRef.current) * Math.PI) / 180;
        const cosLon = Math.cos(lonRad);
        const sinLon = Math.sin(lonRad);
        if (cosLon > 0.04) {
          const rx = R * Math.abs(sinLon);
          ctx.beginPath();
          if (rx < 5) {
            ctx.moveTo(CX, CY - R);
            ctx.lineTo(CX, CY + R);
          } else {
            ctx.ellipse(CX, CY, rx, R, 0, 0, Math.PI * 2);
          }
          ctx.stroke();
        }
      }

      // Equator — slightly brighter
      ctx.strokeStyle = "rgba(34,211,238,0.2)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(CX, CY, R, R * 0.055, 0, 0, Math.PI * 2);
      ctx.stroke();

      // — Waves —
      const now = performance.now();
      wavesRef.current.forEach((wave) => {
        const ev = events.find((e) => e.id === wave.eventId);
        if (!ev) return;
        const { x, y, vis } = proj(ev.lat, ev.lon);
        if (!vis) return;
        const elapsed = now - wave.startTime;
        if (elapsed < 0) return;
        const prog = Math.min(1, elapsed / WAVE_CONFIG[wave.type].duration);
        const wR = prog * R * 0.9;
        const alpha = (1 - prog) * 0.88;
        if (alpha < 0.03 || wR < 1) return;
        ctx.beginPath();
        ctx.arc(x, y, wR, 0, Math.PI * 2);
        ctx.strokeStyle = WAVE_CONFIG[wave.type].color;
        ctx.lineWidth = wave.type === "P" ? 2.5 : 1.8;
        ctx.globalAlpha = alpha;
        ctx.stroke();
        ctx.globalAlpha = 1;
      });

      // — Station dots —
      STATIONS.forEach((s) => {
        const { x, y, vis } = proj(s.lat, s.lon);
        if (!vis) return;
        const sc = STATUS_COLOR[s.status] || "#22c55e";
        ctx.beginPath();
        ctx.arc(x, y, 2.8, 0, Math.PI * 2);
        ctx.fillStyle = sc;
        ctx.globalAlpha = 0.8;
        ctx.fill();
        ctx.globalAlpha = 1;
        // tiny glow
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = sc;
        ctx.globalAlpha = 0.18;
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // — Event markers (back-to-front by depth) —
      const selId = selectedIdRef.current;
      const projEvs = events
        .map((e) => ({ ...e, ...proj(e.lat, e.lon) }))
        .sort((a, b) => a.depth - b.depth);

      projEvs.forEach((e) => {
        if (!e.vis) return;
        const isSel = e.id === selId;
        const br = 3.5 + (e.mag - 4) * 1.9;
        const pulse = (Math.sin(ts * 0.0019 + e.id * 1.7) + 1) * 0.5;

        // Outer pulse
        ctx.beginPath();
        ctx.arc(e.x, e.y, br + pulse * 13, 0, Math.PI * 2);
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.18 + pulse * 0.18;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Glow halo
        ctx.beginPath();
        ctx.arc(e.x, e.y, br + 4, 0, Math.PI * 2);
        ctx.fillStyle = e.color;
        ctx.globalAlpha = 0.22;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Core dot
        ctx.beginPath();
        ctx.arc(e.x, e.y, isSel ? br + 2.5 : br, 0, Math.PI * 2);
        ctx.fillStyle = e.color;
        ctx.fill();

        // Selection ring
        if (isSel) {
          ctx.beginPath();
          ctx.arc(e.x, e.y, br + 8, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255,255,255,0.85)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(e.x, e.y, br + 13, 0, Math.PI * 2);
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 0.8;
          ctx.globalAlpha = 0.5;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // Label
        if (e.mag >= 5.5 || isSel) {
          ctx.fillStyle = isSel ? "#ffffff" : "rgba(255,255,255,0.85)";
          ctx.font = `bold ${isSel ? 11 : 10}px "JetBrains Mono", monospace`;
          ctx.shadowColor = "#000";
          ctx.shadowBlur = 5;
          ctx.fillText(`M${e.mag}`, e.x + br + 5, e.y - 2);
          ctx.shadowBlur = 0;
        }
      });

      ctx.restore();

      // — Atmosphere glow —
      const atmo = ctx.createRadialGradient(CX, CY, R * 0.88, CX, CY, R + 20);
      atmo.addColorStop(0, "rgba(34,211,238,0)");
      atmo.addColorStop(1, "rgba(34,211,238,0.3)");
      ctx.beginPath();
      ctx.arc(CX, CY, R + 20, 0, Math.PI * 2);
      ctx.fillStyle = atmo;
      ctx.fill();

      // — Limb —
      ctx.beginPath();
      ctx.arc(CX, CY, R, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(34,211,238,0.55)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Slow spin
      rotRef.current += 0.035;
      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []); // uses refs — no deps needed

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width;
      const sy = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * sx;
      const my = (e.clientY - rect.top) * sy;
      const CX = canvas.width / 2;
      const CY = canvas.height / 2;
      const R = canvas.width / 2 - 14;

      for (const ev of events) {
        const latRad = (ev.lat * Math.PI) / 180;
        const lonRad = ((ev.lon - rotRef.current) * Math.PI) / 180;
        const cosLat = Math.cos(latRad);
        if (cosLat * Math.cos(lonRad) <= -0.05) continue;
        const x = CX + R * cosLat * Math.sin(lonRad);
        const y = CY - R * Math.sin(latRad);
        if (Math.hypot(mx - x, my - y) < 18) {
          onClickRef.current(ev.id);
          return;
        }
      }
      onClickRef.current(null);
    },
    [events, onClickRef]
  );

  return (
    <canvas
      ref={canvasRef}
      width={390}
      height={390}
      onClick={handleClick}
      className="cursor-crosshair"
      style={{ borderRadius: "50%", display: "block", maxWidth: "100%", maxHeight: "100%" }}
    />
  );
}

// ─── Magnitude Badge ──────────────────────────────────────────────────────────

function MagBadge({ mag, color }: { mag: number; color: string }) {
  return (
    <span
      className="text-[11px] font-bold px-1.5 py-0.5 rounded shrink-0"
      style={{ background: color + "22", color, border: `1px solid ${color}44` }}
    >
      M{mag}
    </span>
  );
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="text-[11px] px-3 py-2 rounded"
      style={{
        background: "#0a0f1e",
        border: "1px solid rgba(34,211,238,0.35)",
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      <div style={{ color: "#22d3ee" }} className="mb-1 font-bold">{label}</div>
      <div style={{ color: "#e0f0ff" }}>Peak M{payload[0]?.value}</div>
      <div style={{ color: "#5a7a94" }}>{payload[0]?.payload?.events} events</div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [selectedId, setSelectedId] = useState<number | null>(1);
  const [activeWaveTypes, setActiveWaveTypes] = useState<Set<string>>(new Set(["P", "S"]));
  const [utcTime, setUtcTime] = useState("");
  const [waveCount, setWaveCount] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("current");

  const selectedIdRef = useRef<number | null>(1);
  const wavesRef = useRef<WaveEntry[]>([]);
  const waveIdRef = useRef(0);
  const onClickRef = useRef<(id: number | null) => void>(null!);

  // Keep onClickRef.current up to date
  onClickRef.current = (id: number | null) => {
    setSelectedId(id);
    selectedIdRef.current = id;
  };

  // Live UTC clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().slice(17, 25) + " UTC");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Wave cleanup
  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now();
      const before = wavesRef.current.length;
      wavesRef.current = wavesRef.current.filter(
        (w) => now - w.startTime < WAVE_CONFIG[w.type].duration * 1.08
      );
      if (wavesRef.current.length !== before) {
        setWaveCount(wavesRef.current.length);
      }
    }, 1500);
    return () => clearInterval(id);
  }, []);

  const toggleWaveType = (type: string) => {
    setActiveWaveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const launchWaves = () => {
    const eventId = selectedIdRef.current;
    if (!eventId) return;
    const now = performance.now();
    const newWaves: WaveEntry[] = [];
    if (activeWaveTypes.has("P"))
      newWaves.push({ id: waveIdRef.current++, eventId, type: "P", startTime: now });
    if (activeWaveTypes.has("S"))
      newWaves.push({ id: waveIdRef.current++, eventId, type: "S", startTime: now + 700 });
    if (activeWaveTypes.has("Surface"))
      newWaves.push({ id: waveIdRef.current++, eventId, type: "Surface", startTime: now + 1900 });
    wavesRef.current = [...wavesRef.current, ...newWaves];
    setWaveCount(wavesRef.current.length);
  };

  const clearWaves = () => {
    wavesRef.current = [];
    setWaveCount(0);
  };

  const selectedEvent = EVENTS.find((e) => e.id === selectedId);

  return (
    <div
      className="flex flex-col h-screen overflow-hidden select-none"
      style={{
        background: "#060918",
        color: "#e0f0ff",
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {/* ── Header ── */}
      <header
        className="flex items-center gap-3 px-4 py-2 shrink-0"
        style={{ background: "#080e1d", borderBottom: "1px solid rgba(34,211,238,0.2)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: "#22d3ee", boxShadow: "0 0 6px #22d3ee", animation: "pulse 2s infinite" }}
          />
          <span style={{ color: "#22d3ee", letterSpacing: "0.18em" }} className="font-bold text-sm">
            NEOSEISVIZ
          </span>
          <span style={{ color: "#5a7a94" }} className="text-xs hidden sm:block">
            - USGS REALTIME SEISMIC MONITOR
          </span>
        </div>

        <div className="flex items-center gap-4 ml-auto text-xs" style={{ color: "#5a7a94" }}>
          <span className="flex items-center gap-1.5 hidden md:flex">
            <Activity className="w-3 h-3" style={{ color: "#ef4444" }} />
            <span style={{ color: "#ef4444" }} className="font-bold">M7.5</span>
            <span>Venezuela active</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Signal className="w-3 h-3" style={{ color: "#22c55e" }} />
            <span style={{ color: "#22c55e" }}>2,847</span>
            <span className="hidden sm:inline">stations synced</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span style={{ color: "#9db8cf" }}>{utcTime}</span>
          </span>
          <span
            className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px]"
            style={{ border: "1px solid rgba(34,211,238,0.25)", color: "#22d3ee" }}
          >
            <Wifi className="w-3 h-3" />
            IRIS CONNECTED
          </span>
        </div>
      </header>

      {/* ── Main 3-column ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* LEFT: Event Feed */}
        <aside
          className="w-64 xl:w-72 shrink-0 flex flex-col overflow-hidden hidden md:flex"
          style={{ background: "#080e1d", borderRight: "1px solid rgba(34,211,238,0.15)" }}
        >
          <div
            className="px-3 py-2 flex items-center gap-2 shrink-0"
            style={{ borderBottom: "1px solid rgba(34,211,238,0.15)" }}
          >
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#22d3ee" }} />
            <span className="text-xs font-bold" style={{ color: "#22d3ee", letterSpacing: "0.12em" }}>
              SEISMIC EVENTS
            </span>
            <span className="ml-auto text-[11px]" style={{ color: "#5a7a94" }}>
              {EVENTS.length} logged
            </span>
          </div>

          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {EVENTS.map((ev) => (
              <button
                key={ev.id}
                onClick={() => onClickRef.current(ev.id)}
                className="w-full text-left px-3 py-2.5 transition-colors"
                style={{
                  borderBottom: "1px solid rgba(34,211,238,0.07)",
                  background: selectedId === ev.id ? "rgba(34,211,238,0.07)" : "transparent",
                  borderLeft: selectedId === ev.id ? `2px solid ${ev.color}` : "2px solid transparent",
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <MagBadge mag={ev.mag} color={ev.color} />
                  <span className="text-[11px] truncate" style={{ color: "#9db8cf" }}>
                    {ev.location}
                  </span>
                  <span className="ml-auto text-[10px] shrink-0" style={{ color: "#5a7a94" }}>
                    {ev.ago}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px]" style={{ color: "#5a7a94" }}>
                  <span>{ev.time}</span>
                  <span>{ev.depth} km</span>
                  <span>{ev.region}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Wave legend */}
          <div
            className="px-3 py-2.5 shrink-0"
            style={{ borderTop: "1px solid rgba(34,211,238,0.15)", background: "#060918" }}
          >
            <div
              className="text-[10px] mb-2 font-bold tracking-widest"
              style={{ color: "#5a7a94" }}
            >
              WAVE PHYSICS
            </div>
            {Object.entries(WAVE_CONFIG).map(([type, cfg]) => (
              <div key={type} className="flex items-center gap-2 py-0.5">
                <div
                  className="w-5 rounded"
                  style={{ height: "2px", background: cfg.color }}
                />
                <span className="text-[10px]" style={{ color: "#9db8cf" }}>
                  {cfg.label}
                </span>
                <span className="ml-auto text-[10px]" style={{ color: cfg.color }}>
                  {cfg.speed}
                </span>
              </div>
            ))}
          </div>
        </aside>

        {/* CENTER: Globe */}
        <main className="flex-1 flex flex-col items-center min-w-0 overflow-hidden">
          <div
            className="w-full px-4 py-2 flex items-center gap-3 shrink-0"
            style={{ borderBottom: "1px solid rgba(34,211,238,0.15)" }}
          >
            <Layers className="w-3.5 h-3.5" style={{ color: "#22d3ee" }} />
            <span className="text-xs font-bold" style={{ color: "#22d3ee", letterSpacing: "0.12em" }}>
              SEISMIC GLOBE
            </span>
            <span className="text-xs hidden sm:block" style={{ color: "#5a7a94" }}>
              - Orthographic - Click event to select
            </span>
            {selectedEvent && (
              <span className="ml-auto text-xs font-bold" style={{ color: selectedEvent.color }}>
                {selectedEvent.location} M{selectedEvent.mag}
              </span>
            )}
          </div>

          <div className="flex-1 flex items-center justify-center p-4 relative">
            <Globe
              events={EVENTS}
              wavesRef={wavesRef}
              selectedIdRef={selectedIdRef}
              onClickRef={onClickRef}
            />

            {/* Corner annotations */}
            <div
              className="absolute top-5 left-5 text-[10px] leading-5 hidden lg:block"
              style={{ color: "#5a7a94" }}
            >
              <div style={{ color: "#22d3ee" }}>* P-wave</div>
              <div style={{ color: "#d946ef" }}>* S-wave</div>
              <div style={{ color: "#facc15" }}>* Surface</div>
              <div style={{ color: "#22c55e", marginTop: 8 }}>- Station</div>
            </div>

            <div
              className="absolute bottom-5 right-5 text-[10px] text-right hidden lg:block"
              style={{ color: "#5a7a94" }}
            >
              <div>{STATIONS.filter((s) => s.status === "synced").length} synced</div>
              <div style={{ color: "#f97316" }}>
                {STATIONS.filter((s) => s.status === "delayed").length} delayed
              </div>
              <div style={{ color: "#22d3ee" }}>26 JUN 2026</div>
            </div>
          </div>

          {/* Wave Controls */}
          <div
            className="w-full px-4 py-3 shrink-0"
            style={{ borderTop: "1px solid rgba(34,211,238,0.15)", background: "#080e1d" }}
          >
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {Object.entries(WAVE_CONFIG).map(([type, cfg]) => {
                const on = activeWaveTypes.has(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleWaveType(type)}
                    className="text-xs px-3 py-1.5 rounded transition-all"
                    style={{
                      border: `1px solid ${on ? cfg.color + "70" : "rgba(34,211,238,0.18)"}`,
                      background: on ? cfg.color + "1a" : "transparent",
                      color: on ? cfg.color : "#5a7a94",
                      opacity: on ? 1 : 0.55,
                    }}
                  >
                    {type}
                  </button>
                );
              })}

              <button
                onClick={launchWaves}
                disabled={!selectedId}
                className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded font-bold transition-colors disabled:opacity-30"
                style={{ background: "#22d3ee", color: "#060918" }}
              >
                <Play className="w-3 h-3" />
                SIMULATE
              </button>

              <button
                onClick={clearWaves}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded transition-colors"
                style={{ border: "1px solid rgba(34,211,238,0.2)", color: "#5a7a94" }}
              >
                <RotateCcw className="w-3 h-3" />
                CLEAR
              </button>

              {waveCount > 0 && (
                <span className="text-[10px]" style={{ color: "#22d3ee" }}>
                  {waveCount} wave{waveCount !== 1 ? "s" : ""} propagating
                </span>
              )}
            </div>
          </div>
        </main>

        {/* RIGHT: Station Monitor */}
        <aside
          className="w-56 xl:w-64 shrink-0 flex flex-col overflow-hidden hidden lg:flex"
          style={{ background: "#080e1d", borderLeft: "1px solid rgba(34,211,238,0.15)" }}
        >
          <div
            className="px-3 py-2 flex items-center gap-2 shrink-0"
            style={{ borderBottom: "1px solid rgba(34,211,238,0.15)" }}
          >
            <Radio className="w-3.5 h-3.5" style={{ color: "#22d3ee" }} />
            <span className="text-xs font-bold" style={{ color: "#22d3ee", letterSpacing: "0.12em" }}>
              IRIS STATIONS
            </span>
          </div>

          {/* Stats grid */}
          <div
            className="grid grid-cols-2 shrink-0"
            style={{ borderBottom: "1px solid rgba(34,211,238,0.15)", gap: "1px", background: "rgba(34,211,238,0.08)" }}
          >
            {[
              { label: "P-speed",   value: "6.8 km/s", color: "#22d3ee" },
              { label: "S-speed",   value: "4.1 km/s", color: "#d946ef" },
              { label: "VAN ETA",   value: "17 min",   color: "#facc15" },
              { label: "M5+ Events", value: "3 active", color: "#ef4444" },
            ].map((stat) => (
              <div key={stat.label} className="p-2.5" style={{ background: "#060918" }}>
                <div className="text-[10px] mb-0.5" style={{ color: "#5a7a94" }}>{stat.label}</div>
                <div className="text-sm font-bold" style={{ color: stat.color }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Station list */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {STATIONS.map((s) => (
              <div
                key={s.id}
                className="px-3 py-2 transition-colors"
                style={{ borderBottom: "1px solid rgba(34,211,238,0.07)" }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      background: STATUS_COLOR[s.status],
                      boxShadow: `0 0 5px ${STATUS_COLOR[s.status]}`,
                    }}
                  />
                  <span className="text-[11px] font-bold" style={{ color: "#22d3ee" }}>{s.id}</span>
                  <span
                    className="ml-auto text-[10px]"
                    style={{ color: STATUS_COLOR[s.status] }}
                  >
                    {s.status}
                  </span>
                </div>
                <div className="text-[10px] mb-1" style={{ color: "#5a7a94" }}>{s.name}</div>
                <div className="flex gap-3 text-[10px]">
                  <span>
                    <span style={{ color: "#22d3ee" }}>P </span>
                    <span style={{ color: "#9db8cf" }}>{s.pArr}</span>
                  </span>
                  <span>
                    <span style={{ color: "#d946ef" }}>S </span>
                    <span style={{ color: "#9db8cf" }}>{s.sArr}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Selected event detail */}
          <div
            className="p-3 shrink-0"
            style={{ borderTop: "1px solid rgba(34,211,238,0.15)", background: "#060918" }}
          >
            <div
              className="text-[10px] mb-2 font-bold tracking-widest"
              style={{ color: "#5a7a94" }}
            >
              SELECTED EVENT
            </div>
            {selectedEvent ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-base" style={{ color: selectedEvent.color }}>
                    M{selectedEvent.mag}
                  </span>
                  <span className="text-xs" style={{ color: "#9db8cf" }}>{selectedEvent.location}</span>
                </div>
                <div className="text-[11px] space-y-0.5" style={{ color: "#5a7a94" }}>
                  <div>
                    <span style={{ color: "#9db8cf" }}>Depth</span>
                    {"  "}{selectedEvent.depth} km
                  </div>
                  <div>
                    <span style={{ color: "#9db8cf" }}>Time</span>
                    {"   "}{selectedEvent.time} UTC
                  </div>
                  <div>
                    <span style={{ color: "#9db8cf" }}>Lat</span>
                    {"    "}{selectedEvent.lat}deg
                  </div>
                  <div>
                    <span style={{ color: "#9db8cf" }}>Lon</span>
                    {"    "}{selectedEvent.lon}deg
                  </div>
                  <div>
                    <span style={{ color: "#9db8cf" }}>Region</span>
                    {"  "}{selectedEvent.region}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-[11px]" style={{ color: "#5a7a94" }}>
                Click a globe marker to select an event, then press SIMULATE to launch waves.
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ── Ray Path Diagram ── */}
      <div
        className="shrink-0"
        style={{
          height: "240px",
          background: "#030711",
          borderTop: "1px solid rgba(34,211,238,0.2)",
        }}
      >
        <div
          className="px-4 py-1.5 flex items-center gap-2"
          style={{ borderBottom: "1px solid rgba(34,211,238,0.1)" }}
        >
          <Zap className="w-3 h-3" style={{ color: "#22d3ee" }} />
          <span className="text-xs font-bold" style={{ color: "#22d3ee", letterSpacing: "0.12em" }}>
            SEISMIC RAY PATHS
          </span>
          <span className="text-[10px]" style={{ color: "#5a7a94" }}>
            - Azimuthal equidistant - 8 wave phases - Screen blend
          </span>
          <div className="ml-auto flex items-center gap-1">
            {(["planet", "current", "selected"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className="text-[10px] px-2 py-0.5 rounded transition-all"
                style={{
                  background: viewMode === mode ? "rgba(34,211,238,0.18)" : "transparent",
                  border: `1px solid ${viewMode === mode ? "rgba(34,211,238,0.5)" : "rgba(34,211,238,0.15)"}`,
                  color: viewMode === mode ? "#22d3ee" : "#5a7a94",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {mode === "planet" ? "PLANET" : mode === "current" ? "CURRENT" : "SIGHT"}
              </button>
            ))}
          </div>
        </div>
        <div style={{ height: "calc(100% - 28px)" }}>
          <SeismicRayCanvas events={EVENTS} selectedId={selectedId} viewMode={viewMode} />
        </div>
      </div>

      {/* ── Bottom: Magnitude Chart ── */}
      <div
        className="h-28 shrink-0 flex flex-col"
        style={{ background: "#080e1d", borderTop: "1px solid rgba(34,211,238,0.15)" }}
      >
        <div
          className="px-4 py-1 flex items-center gap-2 shrink-0"
          style={{ borderBottom: "1px solid rgba(34,211,238,0.1)" }}
        >
          <Zap className="w-3 h-3" style={{ color: "#22d3ee" }} />
          <span className="text-xs font-bold" style={{ color: "#22d3ee", letterSpacing: "0.12em" }}>
            MAGNITUDE TIMELINE
          </span>
          <span className="text-[10px]" style={{ color: "#5a7a94" }}>
            - 26 JUN 2026 - 8h window - USGS IRIS
          </span>
          <div className="ml-auto flex items-center gap-3 text-[10px]" style={{ color: "#5a7a94" }}>
            <span className="flex items-center gap-1">
              <span className="w-2 h-0.5 rounded inline-block" style={{ background: "#ef4444" }} />
              Major (7.0+)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-0.5 rounded inline-block" style={{ background: "#f97316" }} />
              Strong (6.0+)
            </span>
          </div>
        </div>
        <div className="px-2 pt-1" style={{ height: "80px" }}>
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={MAG_HISTORY} margin={{ top: 3, right: 16, bottom: 2, left: 24 }}>
              <defs>
                <linearGradient id="magGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22d3ee" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="2 6"
                stroke="rgba(34,211,238,0.07)"
                vertical={false}
              />
              <XAxis
                dataKey="t"
                tick={{ fill: "#5a7a94", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[2, 8]}
                tick={{ fill: "#5a7a94", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="mag"
                stroke="#22d3ee"
                strokeWidth={2}
                fill="url(#magGrad)"
                dot={false}
                activeDot={{ r: 5, fill: "#22d3ee", stroke: "#060918", strokeWidth: 1.5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Status Bar ── */}
      <div
        className="h-6 shrink-0 flex items-center px-4 gap-5 text-[10px]"
        style={{
          background: "#060918",
          borderTop: "1px solid rgba(34,211,238,0.1)",
          color: "#5a7a94",
        }}
      >
        <span className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full inline-block"
            style={{ background: "#22c55e", boxShadow: "0 0 4px #22c55e" }}
          />
          IRIS CONNECTED
        </span>
        <span className="hidden sm:inline">USGS+ SCIENTIFIC MODE</span>
        <span className="hidden md:inline">
          P=6.8 km/s - S=4.1 km/s - Surface=3.5 km/s
        </span>
        <span className="ml-auto hidden lg:inline">
          REAL PHYSICS ENGINE - NOT RANDOM PARTICLES
        </span>
      </div>
    </div>
  );
}
