import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useLanguage } from "../../context/LanguageContext";
import {
  Stethoscope,
  RefreshCw,
  BookOpen,
  MessageSquare,
  Calendar,
  ChevronRight,
  Activity,
  Clock,
  Trash2,
  HeartPulse,
  Microscope,
  Wand2,
  Download,
  PlayCircle,
  User,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router";
import {
  getConversationList,
  getConversationDetail,
  deleteConversation,
  ChatConversation,
  ChatMessage,
} from "../../lib/chat";
import apiData from "../../../data/address.json";
import { getToken } from "../../lib/auth";
import logoUrl from "../../assets/qfhj-logo.png";
import herbalDiagnosticsUrl from "../../assets/health-herbal-diagnostics.svg";
import visionDetectionUrl from "../../assets/health-vision-detection.svg";
import knowledgeGraphUrl from "../../assets/health-knowledge-graph.svg";

/* ==========================================================================
   Interactive TCM Hero Canvas — 中医药主题粒子交互系统
   粒子: 草药叶片、经络节点、气之涟漪
   交互: 鼠标移动产生引力场, 点击产生扩散涟漪
   ========================================================================== */

interface HerbParticle {
  x: number; y: number;
  vx: number; vy: number;
  size: number; baseSize: number;
  rotation: number; rotSpeed: number;
  opacity: number; baseOpacity: number;
  type: "leaf" | "dot" | "ring" | "glow";
  color: string;
  phase: number;
}

interface Ripple {
  x: number; y: number;
  radius: number; maxRadius: number;
  opacity: number;
}

function TCMHeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -999, y: -999, active: false });
  const particlesRef = useRef<HerbParticle[]>([]);
  const ripplesRef = useRef<Ripple[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    // Richer color palette — warm golds + whites + sage greens
    const COLORS = [
      "rgba(255,255,255,",       // pure white
      "rgba(255,248,220,",       // warm ivory
      "rgba(220,200,130,",       // warm gold
      "rgba(196,168,98,",        // deep gold
      "rgba(180,210,180,",       // sage
      "rgba(200,230,200,",       // mint
      "rgba(240,235,200,",       // champagne
    ];

    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    };

    const initParticles = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      const particles: HerbParticle[] = [];
      // Higher density — one particle per ~3500px²
      const count = Math.min(120, Math.floor((w * h) / 3500));

      for (let i = 0; i < count; i++) {
        const rand = Math.random();
        // 30% leaf, 25% dot, 15% ring, 30% glow
        const type: HerbParticle["type"] =
          rand < 0.30 ? "leaf" : rand < 0.55 ? "dot" : rand < 0.70 ? "ring" : "glow";

        // Larger sizes
        const baseSize = type === "leaf" ? 10 + Math.random() * 16 :
                         type === "ring" ? 16 + Math.random() * 22 :
                         type === "glow" ? 8 + Math.random() * 18 :
                         3 + Math.random() * 6;
        // Higher base opacity
        const baseOpacity = type === "glow" ? 0.08 + Math.random() * 0.15 :
                            type === "ring" ? 0.2 + Math.random() * 0.3 :
                            0.3 + Math.random() * 0.4;

        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.3 - 0.15,
          size: baseSize, baseSize,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.015,
          opacity: baseOpacity, baseOpacity,
          type,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          phase: Math.random() * Math.PI * 2,
        });
      }
      particlesRef.current = particles;
    };

    const drawLeaf = (ctx: CanvasRenderingContext2D, p: HerbParticle) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.opacity;
      const s = p.size;
      // Leaf body
      ctx.fillStyle = p.color + p.opacity + ")";
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(s * 0.6, -s * 0.6, s * 0.7, s * 0.2, 0, s);
      ctx.bezierCurveTo(-s * 0.7, s * 0.2, -s * 0.6, -s * 0.6, 0, -s);
      ctx.fill();
      // Central vein
      ctx.strokeStyle = p.color + (p.opacity * 0.6) + ")";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.85);
      ctx.lineTo(0, s * 0.85);
      ctx.stroke();
      // Side veins
      ctx.lineWidth = 0.4;
      for (let t = -0.4; t <= 0.4; t += 0.3) {
        ctx.beginPath();
        ctx.moveTo(0, s * t);
        ctx.lineTo(s * 0.35, s * (t - 0.15));
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, s * t);
        ctx.lineTo(-s * 0.35, s * (t - 0.15));
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawDot = (ctx: CanvasRenderingContext2D, p: HerbParticle) => {
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color + p.opacity + ")";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawRing = (ctx: CanvasRenderingContext2D, p: HerbParticle) => {
      ctx.globalAlpha = p.opacity * 0.7;
      ctx.strokeStyle = p.color + p.opacity * 0.8 + ")";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.stroke();
      // Inner dot
      ctx.globalAlpha = p.opacity * 0.5;
      ctx.fillStyle = p.color + p.opacity * 0.6 + ")";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawGlow = (ctx: CanvasRenderingContext2D, p: HerbParticle) => {
      ctx.globalAlpha = p.opacity;
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      gradient.addColorStop(0, p.color + (p.opacity * 1.5) + ")");
      gradient.addColorStop(0.4, p.color + (p.opacity * 0.6) + ")");
      gradient.addColorStop(1, p.color + "0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    };

    let time = 0;
    const animate = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      ctx.clearRect(0, 0, w, h);
      time += 0.016;

      const mouse = mouseRef.current;
      const particles = particlesRef.current;
      const ripples = ripplesRef.current;

      // Draw glow layer first (background)
      for (const p of particles) {
        if (p.type !== "glow") continue;
        p.x += p.vx + Math.sin(time * 0.5 + p.phase) * 0.25;
        p.y += p.vy + Math.cos(time * 0.4 + p.phase) * 0.2;
        p.size = p.baseSize + Math.sin(time * 0.3 + p.phase) * p.baseSize * 0.2;
        p.rotation += p.rotSpeed;

        // Mouse interaction — wider range for glows
        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200 && dist > 0) {
            const force = (1 - dist / 200) * 1.2;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
            p.opacity = Math.min(p.baseOpacity * 3, p.opacity + 0.005);
          }
        }

        p.vx *= 0.97;
        p.vy *= 0.97;
        if (p.opacity > p.baseOpacity * 1.5) p.opacity -= 0.002;
        if (p.x < -40) p.x = w + 40;
        if (p.x > w + 40) p.x = -40;
        if (p.y < -40) p.y = h + 40;
        if (p.y > h + 40) p.y = -40;

        drawGlow(ctx, p);
      }

      // Draw solid particles (leaves, dots, rings)
      for (const p of particles) {
        if (p.type === "glow") continue;

        p.x += p.vx + Math.sin(time + p.phase) * 0.2;
        p.y += p.vy + Math.cos(time * 0.7 + p.phase) * 0.15;
        p.rotation += p.rotSpeed;
        p.size = p.baseSize + Math.sin(time * 0.5 + p.phase) * p.baseSize * 0.15;

        // Mouse repulsion — larger range & stronger force
        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const interactRadius = 180;
          if (dist < interactRadius && dist > 0) {
            const force = (1 - dist / interactRadius) * 1.5;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
            p.opacity = Math.min(0.85, p.opacity + 0.015);
          }
        }

        p.vx *= 0.97;
        p.vy *= 0.97;
        if (p.opacity > p.baseOpacity) p.opacity -= 0.002;

        if (p.x < -30) p.x = w + 30;
        if (p.x > w + 30) p.x = -30;
        if (p.y < -30) p.y = h + 30;
        if (p.y > h + 30) p.y = -30;

        if (p.type === "leaf") drawLeaf(ctx, p);
        else if (p.type === "dot") drawDot(ctx, p);
        else drawRing(ctx, p);
      }

      // Connection lines — wider range & brighter (经络效果)
      ctx.globalAlpha = 1;
      for (let i = 0; i < particles.length; i++) {
        if (particles[i].type === "glow") continue;
        for (let j = i + 1; j < particles.length; j++) {
          if (particles[j].type === "glow") continue;
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            const alpha = (1 - dist / 140) * 0.18;
            ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Mouse glow cursor effect
      if (mouse.active) {
        const gradient = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 100);
        gradient.addColorStop(0, "rgba(255,255,255,0.06)");
        gradient.addColorStop(0.5, "rgba(196,168,98,0.03)");
        gradient.addColorStop(1, "rgba(196,168,98,0)");
        ctx.globalAlpha = 1;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 100, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw ripples — triple layer, faster expansion
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.radius += 4;
        r.opacity -= 0.008;
        if (r.opacity <= 0 || r.radius >= r.maxRadius) {
          ripples.splice(i, 1);
          continue;
        }
        // Outer ring — white
        ctx.globalAlpha = r.opacity;
        ctx.strokeStyle = "rgba(255,255,255," + r.opacity + ")";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.stroke();
        // Middle ring — gold
        if (r.radius > 15) {
          ctx.strokeStyle = "rgba(220,200,130," + r.opacity * 0.7 + ")";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(r.x, r.y, r.radius * 0.65, 0, Math.PI * 2);
          ctx.stroke();
        }
        // Inner ring — sage
        if (r.radius > 30) {
          ctx.strokeStyle = "rgba(180,210,180," + r.opacity * 0.5 + ")";
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.arc(r.x, r.y, r.radius * 0.35, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };

    resize();
    initParticles();
    animate();

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // Three staggered ripples
      ripplesRef.current.push(
        { x, y, radius: 0, maxRadius: 220 + Math.random() * 60, opacity: 0.7 },
        { x, y, radius: 0, maxRadius: 160 + Math.random() * 40, opacity: 0.5 },
        { x, y, radius: 0, maxRadius: 100 + Math.random() * 30, opacity: 0.4 },
      );
      // Burst nearby particles outward — stronger
      for (const p of particlesRef.current) {
        const dx = p.x - x;
        const dy = p.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200 && dist > 0) {
          const force = (1 - dist / 200) * 5;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
          p.opacity = Math.min(0.9, p.opacity + 0.3);
        }
      }
    };

    const handleResize = () => {
      resize();
      initParticles();
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("click", handleClick);
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("click", handleClick);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full cursor-pointer"
      style={{ pointerEvents: "auto" }}
    />
  );
}

/* ==========================================================================
   Utility functions
   ========================================================================== */

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function calculateDays(joinDate: string): number {
  if (!joinDate) return 0;
  const start = new Date(joinDate);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diff = today.getTime() - start.getTime();
  return diff >= 0 ? Math.floor(diff / (1000 * 60 * 60 * 24)) + 1 : 0;
}

function maskEmail(email?: string): string {
  if (!email || !email.includes("@")) return "demo@qfhj.local";
  const [name, domain] = email.split("@");
  const safeName = name.length <= 4 ? `${name[0] || "*"}***` : `${name.slice(0, 3)}***${name.slice(-2)}`;
  return `${safeName}@${domain}`;
}

function displayUserName(fullName?: string, username?: string, isZh = true): string {
  const raw = (fullName || username || "").trim();
  if (!raw || /^\d+$/.test(raw) || ["test", "demo", "admin"].includes(raw.toLowerCase())) {
    return isZh ? "健康档案用户" : "Health Profile User";
  }
  return raw.length > 16 ? `${raw.slice(0, 16)}…` : raw;
}

function displayRecordTitle(title?: string, fallback = "问诊记录"): string {
  const raw = (title || "").trim();
  if (!raw) return fallback;
  const testKeywords = ["测试", "正常", "链路", "接口", "Qwen", "后台", "速度验证", "只回复", "你好你是谁", "你是谁"];
  if (testKeywords.some((kw) => raw.includes(kw)) || raw === "你好") {
    return fallback;
  }
  return raw.length > 36 ? `${raw.slice(0, 36)}…` : raw;
}

/* ==========================================================================
   Wizard diagnosis text cleaning utilities
   ========================================================================== */

/** Decode HTML entities */
function decodeHtmlEntities(text: string): string {
  const el = document.createElement("textarea");
  el.innerHTML = text;
  return el.value;
}

/** Clean markdown and AI symbols from diagnosis text */
function cleanDiagnosisText(text: string): string {
  return decodeHtmlEntities(text)
    // Remove code blocks (```json ... ``` or ``` ... ```)
    .replace(/```[\s\S]*?```/g, "")
    // Remove markdown bold/italic
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    // Remove special symbols
    .replace(/[✅📌▪✓✗❌❎⚡🔥]/g, "")
    .replace(/[▸►▹▶]/g, "")
    // Remove blockquote markers
    .replace(/^>\s*/gm, "")
    // Remove horizontal rules
    .replace(/^---+$/gm, "")
    .replace(/^===+$/gm, "")
    // Remove HTML entities
    .replace(/&nbsp;/g, " ")
    .replace(/&emsp;/g, "  ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, "")
    // Remove English parenthetical annotations like (always), (sometimes), (LR3)
    .replace(/\s*\([A-Za-z][A-Za-z0-9\s,.\-]*?\)/g, "")
    // Clean up circled numbers → plain numbers
    .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, (m) => String("①②③④⑤⑥⑦⑧⑨⑩".indexOf(m) + 1) + ". ")
    // Remove excessive blank lines (keep max 1)
    .replace(/\n{3,}/g, "\n\n")
    // Remove trailing spaces on lines
    .replace(/[ \t]+$/gm, "")
    .trim();
}

/** Split cleaned text into sections for structured rendering */
function splitSections(text: string): { title: string; body: string }[] {
  const cleaned = cleanDiagnosisText(text);
  // Split by Chinese numbered headers: 一、二、三、四、五、六、七、八、九
  const sectionRegex = /^(一、|二、|三、|四、|五、|六、|七、|八、|九、|十、)/gm;
  const parts = cleaned.split(sectionRegex);

  const sections: { title: string; body: string }[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const title = (parts[i] + (parts[i + 1] || "")).split("\n")[0].trim();
    const body = (parts[i + 1] || "").split("\n").slice(1).join("\n").trim();
    if (title) sections.push({ title, body });
  }

  // If no sections found, return whole text as one section
  if (sections.length === 0 && cleaned.trim()) {
    sections.push({ title: "", body: cleaned });
  }
  return sections;
}

/** Generate clean text for export/download */
function generateExportText(session: any, diagnosis: any): string {
  const lines: string[] = [];
  lines.push("══════════════════════════════════════");
  lines.push(`  向导辨证诊断报告`);
  lines.push("══════════════════════════════════════");
  lines.push("");
  if (session?.patientName) lines.push(`患者：${session.patientName}`);
  lines.push(`日期：${new Date(session?.createdAt || Date.now()).toLocaleString("zh-CN")}`);
  lines.push("");

  if (diagnosis?.primarySyndrome) {
    lines.push(`【主证型】${diagnosis.primarySyndrome}`);
  }
  if (diagnosis?.secondarySyndromes) {
    lines.push(`【兼夹证】${diagnosis.secondarySyndromes}`);
  }
  if (diagnosis?.treatmentMethod) {
    lines.push(`【治　法】${diagnosis.treatmentMethod}`);
  }
  lines.push("");

  if (diagnosis?.rawAiResponse) {
    lines.push(cleanDiagnosisText(diagnosis.rawAiResponse));
  }

  lines.push("");
  lines.push("──────────────────────────────────────");
  lines.push("以上结果仅供参考，不能替代专业中医师的面诊。");
  lines.push("基于千方慧鉴向导辨证系统生成");
  return lines.join("\n");
}

/** Trigger file download */
function downloadTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type KunmingWeatherState = {
  temp: number | null;
  code: number | null;
  wind: number | null;
  humidity: number | null;
  updatedAt: string | null;
  loading: boolean;
  error: string | null;
};

const getWeatherInfo = (code: number | null, isZh: boolean) => {
  if (code === null) return { icon: "🌤️", text: isZh ? "昆明天气获取中" : "Loading Kunming weather" };
  if (code === 0) return { icon: "☀️", text: isZh ? "晴" : "Clear" };
  if ([1, 2].includes(code)) return { icon: "🌤️", text: isZh ? "少云" : "Partly cloudy" };
  if (code === 3) return { icon: "☁️", text: isZh ? "阴/多云" : "Cloudy" };
  if ([45, 48].includes(code)) return { icon: "🌫️", text: isZh ? "雾" : "Fog" };
  if ([51, 53, 55, 56, 57].includes(code)) return { icon: "🌦️", text: isZh ? "毛毛雨" : "Drizzle" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { icon: "🌧️", text: isZh ? "降雨" : "Rain" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { icon: "❄️", text: isZh ? "降雪" : "Snow" };
  if ([95, 96, 99].includes(code)) return { icon: "⛈️", text: isZh ? "雷阵雨" : "Thunderstorm" };
  return { icon: "🌤️", text: isZh ? "实时天气" : "Live weather" };
};

const getWeatherCareText = (weather: KunmingWeatherState, isZh: boolean) => {
  if (weather.loading && weather.temp === null) return isZh ? "正在同步昆明实时天气" : "Syncing live Kunming weather";
  if (weather.error && weather.temp === null) return isZh ? "天气暂不可用 · 可先手动浇水" : "Weather unavailable · Water manually";
  const temp = weather.temp ?? 0;
  const code = weather.code;
  if (code !== null && [61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)) return isZh ? "昆明有雨 · 少量补水" : "Rain in Kunming · Light watering";
  if (temp >= 28) return isZh ? "昆明偏热 · 适合浇水" : "Warm Kunming · Good for watering";
  if (temp <= 10) return isZh ? "昆明偏凉 · 控制水量" : "Cool Kunming · Reduce watering";
  return isZh ? "昆明舒适 · 适合照料" : "Mild Kunming · Good for care";
};

function HealthGardenMiniApp({
  totalDays,
  totalConsultations,
  completedWizardCount,
  thisMonthConsultations,
  isZh,
}: {
  totalDays: number;
  totalConsultations: number;
  completedWizardCount: number;
  thisMonthConsultations: number;
  isZh: boolean;
}) {
  type GardenTaskKey = "water" | "sun" | "review";
  type GardenTaskState = "idle" | "doing" | "ready" | "done";
  const navigate = useNavigate();
  const todayKey = new Date().toLocaleDateString("sv-SE");
  const stateKey = `qfhj_garden_state_${todayKey}`;
  const gardenProfileKey = "qfhj_garden_profile_v3";
  // v2：奖励凭证必须带 requestId + verifiedAt；sun 还必须带 entryId/readMs，避免旧版/残留凭证导致“一点去知识库就领奖”。
  const proofKey = (key: Exclude<GardenTaskKey, "water">) => `qfhj_garden_${key}_proof_v2_${todayKey}`;
  const pendingKey = (key: Exclude<GardenTaskKey, "water">) => `qfhj_garden_${key}_pending_v2`;
  const sunRequestKey = `qfhj_garden_sun_request_${todayKey}`;
  const makeGardenRequestId = () => `${todayKey}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const readJson = <T,>(key: string): T | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      window.localStorage.removeItem(key);
      return null;
    }
  };
  const hasProof = (key: Exclude<GardenTaskKey, "water">) => {
    if (typeof window === "undefined") return false;
    const proof = readJson<{ status?: string; date?: string; requestId?: string; verifiedAt?: number; entryId?: number; readMs?: number }>(proofKey(key));
    if (!proof || proof.status !== "verified" || proof.date !== todayKey || !proof.requestId || !proof.verifiedAt) return false;
    if (key === "sun") {
      const currentRequestId = window.localStorage.getItem(sunRequestKey);
      return !!currentRequestId && proof.requestId === currentRequestId && !!proof.entryId && (proof.readMs ?? 0) >= 8000;
    }
    return true;
  };
  type GardenProfileState = {
    version: 3;
    activePlant: number;
    plantGrowth: number[];
    completedLog: Partial<Record<GardenTaskKey, string[]>>;
    updatedAt: number;
  };
  const defaultGardenProfile = (): GardenProfileState => ({
    version: 3,
    activePlant: 0,
    plantGrowth: [0, 0, 0],
    completedLog: { water: [], sun: [], review: [] },
    updatedAt: Date.now(),
  });
  const loadGardenProfile = (): GardenProfileState => {
    const fallback = defaultGardenProfile();
    if (typeof window === "undefined") return fallback;
    try {
      const raw = window.localStorage.getItem(gardenProfileKey);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as Partial<GardenProfileState>;
      return {
        version: 3,
        activePlant: Math.max(0, Math.min(2, Number(parsed.activePlant ?? 0))),
        plantGrowth: [0, 1, 2].map((index) => Math.max(0, Math.min(100, Number(parsed.plantGrowth?.[index] ?? 0)))),
        completedLog: {
          water: Array.isArray(parsed.completedLog?.water) ? parsed.completedLog.water.slice(-60) : [],
          sun: Array.isArray(parsed.completedLog?.sun) ? parsed.completedLog.sun.slice(-60) : [],
          review: Array.isArray(parsed.completedLog?.review) ? parsed.completedLog.review.slice(-60) : [],
        },
        updatedAt: Number(parsed.updatedAt || Date.now()),
      };
    } catch {
      window.localStorage.removeItem(gardenProfileKey);
      return fallback;
    }
  };
  const getTaskRewardValue = (reward: string) => Number(reward.replace("+", "")) || 0;
  const taskPlantIndex = (key: GardenTaskKey) => key === "water" ? 0 : key === "sun" ? 1 : 2;
  const recordGardenReward = (task: { key: GardenTaskKey; reward: string }) => {
    const rewardValue = getTaskRewardValue(task.reward);
    const plantIndex = taskPlantIndex(task.key);
    setGardenProfile((prev) => {
      const existingLog = prev.completedLog[task.key] ?? [];
      if (existingLog.includes(todayKey)) return prev;
      const nextGrowth = [...prev.plantGrowth];
      nextGrowth[plantIndex] = Math.min(100, (nextGrowth[plantIndex] ?? 0) + rewardValue);
      return {
        ...prev,
        plantGrowth: nextGrowth,
        completedLog: { ...prev.completedLog, [task.key]: [...existingLog, todayKey].slice(-60) },
        updatedAt: Date.now(),
      };
    });
  };
  const loadGardenState = (): Record<GardenTaskKey, GardenTaskState> => {
    if (typeof window === "undefined") return { water: "idle", sun: "idle", review: "idle" };
    try {
      const saved = window.localStorage.getItem(stateKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Record<GardenTaskKey, GardenTaskState>>;
        return {
          water: parsed.water === "done" ? "done" : "idle",
          sun: parsed.sun === "done" ? "done" : hasProof("sun") ? "ready" : "idle",
          review: parsed.review === "done" ? "done" : hasProof("review") ? "ready" : "idle",
        };
      }
    } catch {
      window.localStorage.removeItem(stateKey);
    }
    return {
      water: "idle",
      sun: hasProof("sun") ? "ready" : "idle",
      review: hasProof("review") ? "ready" : "idle",
    };
  };

  const [taskState, setTaskState] = useState<Record<GardenTaskKey, GardenTaskState>>(() => loadGardenState());
  const [gardenProfile, setGardenProfile] = useState<GardenProfileState>(() => loadGardenProfile());
  const activePlant = gardenProfile.activePlant;
  const setActivePlant = (index: number) => {
    setGardenProfile((prev) => ({ ...prev, activePlant: Math.max(0, Math.min(2, index)), updatedAt: Date.now() }));
  };
  const [watering, setWatering] = useState(false);
  const [gardenMessage, setGardenMessage] = useState(isZh ? "点击“开始照料”，按步骤完成今日草本任务。需要外部动作的任务，完成验证后才能领取奖励。" : "Start a task and follow the care steps. Tasks with external actions require verification before rewards.");
  const [kunmingWeather, setKunmingWeather] = useState<KunmingWeatherState>({ temp: null, code: null, wind: null, humidity: null, updatedAt: null, loading: true, error: null });

  const completedToday = Object.values(taskState).filter((state) => state === "done").length;
  const weatherInfo = getWeatherInfo(kunmingWeather.code, isZh);
  const weatherCareText = getWeatherCareText(kunmingWeather, isZh);
  const weatherTempText = kunmingWeather.temp === null ? "--°C" : `${Math.round(kunmingWeather.temp)}°C`;
  const weatherUpdatedText = kunmingWeather.updatedAt
    ? new Date(kunmingWeather.updatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    : (isZh ? "待更新" : "Pending");
  const gardenHealth = Math.min(99, 62 + Math.min(12, totalConsultations) + Math.min(10, completedWizardCount * 2) + completedToday * 6);
  const growthEnergy = Math.min(100, 34 + totalConsultations * 2 + completedWizardCount * 3 + completedToday * 10 + Math.min(totalDays, 18));
  const plantStage = growthEnergy >= 88 ? (isZh ? "繁花期" : "Bloom") : growthEnergy >= 62 ? (isZh ? "舒叶期" : "Leafing") : (isZh ? "新芽期" : "Sprout");
  const plantMood = completedToday >= 3 ? (isZh ? "今天被照顾得很开心，叶片状态饱满。" : "Fully cared for today; leaves look fresh.") : completedToday >= 1 ? (isZh ? "状态不错，还差一点就能完成今日照料。" : "Doing well; a few care steps remain.") : (isZh ? "正在等待你的第一次照料。" : "Waiting for the first care action.");

  const refreshTaskProofs = useCallback(() => {
    setTaskState((prev) => ({
      ...prev,
      sun: prev.sun === "done" ? "done" : hasProof("sun") ? "ready" : prev.sun === "doing" ? "idle" : prev.sun,
      review: prev.review === "done" ? "done" : hasProof("review") ? "ready" : prev.review === "doing" ? "idle" : prev.review,
    }));
  }, [todayKey]);

  useEffect(() => {
    let cancelled = false;
    const fetchKunmingWeather = async () => {
      setKunmingWeather((prev) => ({ ...prev, loading: true, error: null }));
      try {
        // Open-Meteo：免 API Key，坐标固定为云南昆明，current=temperature_2m/weather_code/wind_speed_10m/relative_humidity_2m。
        const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=25.0389&longitude=102.7183&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=Asia%2FShanghai", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setKunmingWeather({
          temp: typeof data?.current?.temperature_2m === "number" ? data.current.temperature_2m : null,
          humidity: typeof data?.current?.relative_humidity_2m === "number" ? data.current.relative_humidity_2m : null,
          code: typeof data?.current?.weather_code === "number" ? data.current.weather_code : null,
          wind: typeof data?.current?.wind_speed_10m === "number" ? data.current.wind_speed_10m : null,
          updatedAt: data?.current?.time || new Date().toISOString(),
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setKunmingWeather((prev) => ({ ...prev, loading: false, error: (err as Error).message || "weather failed" }));
      }
    };
    fetchKunmingWeather();
    const timer = window.setInterval(fetchKunmingWeather, 30 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(stateKey, JSON.stringify(taskState));
  }, [stateKey, taskState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(gardenProfileKey, JSON.stringify(gardenProfile));
  }, [gardenProfileKey, gardenProfile]);

  useEffect(() => {
    refreshTaskProofs();
    const onFocus = () => refreshTaskProofs();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshTaskProofs]);

  useEffect(() => {
    let timer: number | undefined;
    const markReviewIfVisible = () => {
      if (window.localStorage.getItem(pendingKey("review")) !== todayKey || hasProof("review")) return;
      const records = document.getElementById("qfhj-profile-records");
      if (!records) return;
      const rect = records.getBoundingClientRect();
      const visible = rect.top < window.innerHeight * 0.72 && rect.bottom > window.innerHeight * 0.2;
      if (visible && !timer) {
        timer = window.setTimeout(() => {
          window.localStorage.setItem(proofKey("review"), JSON.stringify({ status: "verified", date: todayKey, requestId: `review-${todayKey}`, verifiedAt: Date.now() }));
          window.localStorage.removeItem(pendingKey("review"));
          setTaskState((prev) => ({ ...prev, review: prev.review === "done" ? "done" : "ready" }));
          setGardenMessage(isZh ? "已确认你查看了最近问诊/辨证档案，现在可以回到草本小园领取修剪奖励。" : "Record review verified. Return to the garden to claim the pruning reward.");
        }, 1400);
      } else if (!visible && timer) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    };
    window.addEventListener("scroll", markReviewIfVisible, { passive: true });
    markReviewIfVisible();
    return () => {
      window.removeEventListener("scroll", markReviewIfVisible);
      if (timer) window.clearTimeout(timer);
    };
  }, [isZh, todayKey]);

  const persistentGrowth = gardenProfile.plantGrowth;
  const plants = [
    {
      name: isZh ? "陈皮柑橘树" : "Citrus Peel Tree",
      image: "/images/garden/chenpi-ganjushu.png",
      level: Math.max(2, Math.min(9, Math.floor((totalConsultations + completedToday + 4 + persistentGrowth[0]) / 4))),
      status: taskState.water === "done" ? (isZh ? "水分充足" : "Hydrated") : (isZh ? "等待浇水" : "Needs water"),
      trait: isZh ? "问诊复盘会结出温润小柑橘" : "Reviews grow warm citrus fruit",
      progress: Math.min(98, growthEnergy + 4 + persistentGrowth[0]),
    },
    {
      name: isZh ? "薄荷舒心草" : "Mint Herb",
      image: "/images/garden/bohe-shuxincao.png",
      level: Math.max(1, Math.min(8, Math.floor((thisMonthConsultations + completedToday + 3 + persistentGrowth[1]) / 3))),
      status: taskState.sun === "done" ? (isZh ? "光照合适" : "Good light") : (isZh ? "需要晒太阳" : "Needs sunlight"),
      trait: isZh ? "知识阅读会长出清透新叶" : "Learning grows fresh mint leaves",
      progress: Math.max(38, Math.min(95, growthEnergy - 8 + persistentGrowth[1])),
    },
    {
      name: isZh ? "合欢安神花" : "Silk Tree Flower",
      image: "/images/garden/hehuan-anshenhua.png",
      level: Math.max(1, Math.min(7, completedWizardCount + completedToday + 1 + Math.floor(persistentGrowth[2] / 5))),
      status: taskState.review === "done" ? (isZh ? "枝叶清爽" : "Trimmed") : (isZh ? "等待修剪" : "Needs pruning"),
      trait: isZh ? "辨证档案越完整花色越温柔" : "Complete records brighten soft flowers",
      progress: Math.max(30, Math.min(92, growthEnergy - 16 + persistentGrowth[2])),
    },
  ];

  const currentPlant = plants[activePlant];
  const tasks: {
    key: GardenTaskKey;
    icon: string;
    title: string;
    source: string;
    steps: string[];
    reward: string;
    action: string;
    doneText: string;
    route?: string;
  }[] = [
    {
      key: "water",
      icon: "💧",
      title: isZh ? "浇水打卡" : "Water check-in",
      source: isZh ? "来源：每日登录个人中心即可完成一次基础照料。" : "Source: one basic care action from visiting the profile page.",
      steps: isZh ? ["点击按钮触发浇水动画", "记录今日到访", "陈皮柠檬树成长值提升"] : ["Trigger watering", "Record today's visit", "Boost citrus growth"],
      reward: "+6",
      action: isZh ? "开始浇水" : "Water now",
      doneText: isZh ? "已浇水" : "Watered",
    },
    {
      key: "sun",
      icon: "☀️",
      title: isZh ? "晒太阳学习" : "Sunlight learning",
      source: isZh ? "来源：阅读一条中医知识，让草本伙伴获得光照。" : "Source: read one TCM knowledge card for sunlight.",
      steps: isZh ? ["进入知识库", "阅读一条草本/方剂知识", "返回后记录学习完成"] : ["Open knowledge base", "Read one herb/formula card", "Record completion"],
      reward: "+4",
      action: isZh ? "去知识库" : "Open knowledge",
      doneText: isZh ? "已学习" : "Learned",
      route: "/tcm-knowledge",
    },
    {
      key: "review",
      icon: "✂️",
      title: isZh ? "修剪复盘" : "Review pruning",
      source: isZh ? "来源：回看最近问诊或辨证记录，把杂乱信息整理成档案。" : "Source: review recent consultation or guided diagnosis records.",
      steps: isZh ? ["查看最近问诊/辨证", "确认重点症状", "完成一次复盘修剪"] : ["View recent records", "Confirm key symptoms", "Finish one review"],
      reward: "+5",
      action: isZh ? "记录复盘" : "Record review",
      doneText: isZh ? "已复盘" : "Reviewed",
    },
  ];

  const completeTask = (task: typeof tasks[number]) => {
    setTaskState((prev) => ({ ...prev, [task.key]: "doing" }));
    setGardenMessage(isZh ? `正在发放奖励：${task.title}。` : `Claiming reward: ${task.title}.`);

    if (task.key === "water") {
      setWatering(true);
      window.setTimeout(() => setWatering(false), 1500);
    }

    window.setTimeout(() => {
      setGardenMessage(isZh ? `${task.title}完成，${currentPlant.name}获得 ${task.reward} 成长值。` : `${task.title} completed. ${currentPlant.name} gained ${task.reward} growth.`);
      if (task.key === "sun") window.localStorage.removeItem(pendingKey("sun"));
      if (task.key === "review") window.localStorage.removeItem(pendingKey("review"));
      recordGardenReward(task);
      setTaskState((prev) => ({ ...prev, [task.key]: "done" }));
    }, task.key === "water" ? 1200 : 700);
  };

  const runTask = (task: typeof tasks[number]) => {
    if (taskState[task.key] === "done" || taskState[task.key] === "doing") return;

    if (task.key === "water") {
      completeTask(task);
      return;
    }

    if (task.key === "sun") {
      if (hasProof("sun")) {
        completeTask(task);
        return;
      }
      if (taskState.sun === "ready") {
        setTaskState((prev) => ({ ...prev, sun: "idle" }));
        window.localStorage.removeItem(proofKey("sun"));
        setGardenMessage(isZh
          ? "未检测到有效阅读凭证：需要从这里进入知识库、打开知识详情并连续阅读 8 秒后才能领取。"
          : "No valid reading proof found. Open the knowledge base from here, read a detail for 8 seconds, then claim."
        );
        return;
      }

      const requestId = makeGardenRequestId();
      window.localStorage.setItem(sunRequestKey, requestId);
      window.localStorage.removeItem(proofKey("sun"));
      window.localStorage.setItem(pendingKey("sun"), JSON.stringify({ date: todayKey, requestId, startedAt: Date.now(), source: "profile-garden" }));
      setTaskState((prev) => ({ ...prev, sun: "idle" }));
      setGardenMessage(isZh
        ? "请先进入知识库，打开任意一条知识详情并连续阅读 8 秒；系统验证通过前，这里不会发放光照奖励。"
        : "Open the knowledge base, open one detail and read for 8 seconds. The reward remains locked until verification passes."
      );
      window.setTimeout(() => navigate(`/tcm-knowledge?gardenTask=sun&requestId=${encodeURIComponent(requestId)}`), 350);
      return;
    }

    if (task.key === "review") {
      if (hasProof("review") || taskState.review === "ready") {
        completeTask(task);
        return;
      }

      window.localStorage.setItem(pendingKey("review"), todayKey);
      setGardenMessage(isZh
        ? "请先下滑查看“最近问诊/辨证档案”区域至少 1 秒，确认完成复盘后再回到这里领取修剪奖励。"
        : "Review the Recent Consultations / Diagnosis Files section for at least 1 second, then return to claim pruning."
      );
      document.getElementById("qfhj-profile-records")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <Card className="relative overflow-hidden rounded-[2rem] border-0 bg-[#EEF7EA]/88 p-4 shadow-[0_18px_48px_rgba(74,105,77,0.11)] ring-1 ring-[#DDEAD8] backdrop-blur">
      <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-[#CBE6BE]/65 blur-2xl" />
      <div className="absolute -bottom-12 left-12 h-28 w-28 rounded-full bg-[#F7E9B8]/45 blur-2xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6A946B]">Herb Garden</div>
          <h3 className="mt-1 text-xl font-bold text-[#20372B]">{isZh ? "草本小园 · 每日打卡" : "Herb Garden Check-in"}</h3>
          <p className="mt-1 max-w-md text-xs leading-5 text-[#647567]">
            {isZh ? "把问诊复盘、知识阅读和日常到访转化为草本成长值，让用户愿意每天回来照料。" : "Turn reviews, learning and visits into plant growth so users want to return daily."}
          </p>
        </div>
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/80 text-xl shadow-sm ring-1 ring-[#DDEAD8]">🔔</div>
      </div>

      <div className="relative mt-4 grid gap-3">
        <div className="relative overflow-hidden rounded-[1.55rem] bg-gradient-to-b from-[#E2F3D9] to-[#F7F2E4] p-3 ring-1 ring-white/70">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-[#315038]">{currentPlant.name}</div>
              <div className="mt-0.5 text-[11px] text-[#688069]">Lv.{currentPlant.level} · {plantStage}</div>
            </div>
            <span className="rounded-full bg-white/72 px-2 py-1 text-[10px] font-bold text-[#5B7D63]">{currentPlant.status}</span>
          </div>

          <div className="relative mt-3 grid h-36 place-items-center overflow-hidden rounded-[1.25rem] bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.88),transparent_38%),linear-gradient(180deg,rgba(211,237,199,0.86),rgba(247,242,228,0.86))]">
            <div className="absolute left-4 top-4 text-lg opacity-70">☁️</div>
            <div className="absolute right-5 top-5 text-xl opacity-80">{weatherInfo.icon}</div>
            {watering && (
              <div className="pointer-events-none absolute inset-0 z-20">
                <span className="qfhj-water-can absolute right-10 top-2 text-3xl">🚿</span>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className="qfhj-water-drop absolute text-lg" style={{ left: `${42 + i * 7}%`, animationDelay: `${i * 0.08}s` }}>💧</span>
                ))}
                <span className="qfhj-growth-pop absolute bottom-9 left-1/2 -translate-x-1/2 rounded-full bg-white/86 px-3 py-1 text-xs font-bold text-[#5B7D63] shadow-sm">+6 成长值</span>
              </div>
            )}
            <div className={`qfhj-plant-sway qfhj-plant-image-wrap relative z-10 grid h-32 w-32 place-items-end transition-transform ${watering ? "scale-110" : ""}`}>
              <img
                src={currentPlant.image}
                alt={currentPlant.name}
                className="qfhj-plant-image max-h-32 max-w-32 object-contain drop-shadow-[0_18px_18px_rgba(74,91,57,0.22)]"
              />
            </div>
            <div className="absolute bottom-5 h-7 w-24 rounded-[50%] bg-[#B58A55]/30 blur-sm" />
            <div className="absolute bottom-3 h-10 w-24 rounded-b-[1.3rem] rounded-t-md bg-[#D6A46B] shadow-inner" />
          </div>

          <div className="mt-3 rounded-2xl bg-white/66 p-2.5 ring-1 ring-white/75">
            <div className="flex items-center justify-between text-[11px] text-[#5E725F]"><span>{isZh ? "成长进度" : "Growth"}</span><span>{currentPlant.progress}%</span></div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#DDEAD8]"><div className="h-full rounded-full bg-[#5B7D63] transition-all" style={{ width: `${currentPlant.progress}%` }} /></div>
            <p className="mt-2 text-[11px] leading-4 text-[#607461]">{currentPlant.trait}</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => runTask(tasks[0])}
            className="flex w-full items-center gap-3 rounded-[1.35rem] bg-[#DCEFD5] p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(74,105,77,0.10)]"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/72 text-2xl">{weatherInfo.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-[#26442E]">{weatherInfo.icon} 昆明 {weatherInfo.text} {weatherTempText} · {weatherCareText}</span>
              <span className="mt-0.5 block text-xs text-[#5E725F]">
                {isZh
                  ? `实时天气自动更新 · 湿度 ${kunmingWeather.humidity ?? "--"}% · 风速 ${kunmingWeather.wind ?? "--"} km/h · ${weatherUpdatedText}`
                  : `Live weather auto-updates · Humidity ${kunmingWeather.humidity ?? "--"}% · Wind ${kunmingWeather.wind ?? "--"} km/h · ${weatherUpdatedText}`}
              </span>
            </span>
            <span className="rounded-full bg-white/72 px-2 py-1 text-[11px] font-bold text-[#5B7D63]">{taskState.water === "done" ? tasks[0].doneText : tasks[0].action}</span>
          </button>

          <div className="grid gap-3">
            <div className="rounded-[1.35rem] bg-[#D8ECCD] p-3">
              <div className="flex items-center justify-between text-xs font-bold text-[#315038]"><span>{isZh ? "花园健康值" : "Garden Health"}</span><span>↗</span></div>
              <div className="mt-2 text-4xl font-black tracking-tight text-[#234B2E]">{gardenHealth}</div>
              <div className="mt-1 text-[11px] text-[#5E725F]">{plantStage} · {isZh ? "今日完成" : "Done"} {completedToday}/3</div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/62"><div className="h-full rounded-full bg-[#5B7D63] transition-all" style={{ width: `${growthEnergy}%` }} /></div>
              <div className="mt-2 rounded-xl bg-white/52 px-2 py-1 text-[11px] leading-4 text-[#5E725F]">{plantMood}</div>
            </div>

            <div className="rounded-[1.35rem] bg-[#D8ECCD] p-3">
              <div className="mb-2 flex items-center justify-between text-xs font-bold text-[#315038]">
                <span>{isZh ? "今日照料任务" : "Care tasks"}</span>
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] text-[#5B7D63]">{completedToday}/{tasks.length}</span>
              </div>
              <div className="space-y-2">
                {tasks.map((task) => {
                  const state = taskState[task.key];
                  return (
                    <div key={task.key} className={`rounded-2xl p-2 ring-1 transition-all ${state === "done" ? "bg-white/86 ring-white/80" : state === "ready" ? "bg-[#F4FAEF] ring-[#A9C89D]" : state === "doing" ? "bg-[#FFF9E8] ring-[#EAD8A6]" : "bg-white/48 ring-white/50"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#315038]"><span>{task.icon}</span><span>{task.title}</span></div>
                          <div className="mt-0.5 text-[10px] leading-4 text-[#657A66]">{task.source}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => runTask(task)}
                          disabled={state === "doing" || state === "done"}
                          className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold transition-colors ${state === "done" ? "bg-[#E8F0EA] text-[#5B7D63]" : state === "ready" ? "bg-[#5B7D63] text-white hover:bg-[#4E6F56]" : "bg-white/80 text-[#5B7D63] hover:bg-white disabled:cursor-wait"}`}
                        >
                          {state === "done" ? task.doneText : state === "doing" ? (isZh ? "进行中" : "Doing") : state === "ready" ? (isZh ? "领取奖励" : "Claim") : task.action}
                        </button>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {task.steps.map((step, index) => (
                          <span key={step} className="rounded-full bg-white/58 px-1.5 py-0.5 text-[9px] text-[#6B7B6E]">{index + 1}. {step}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-bold text-[#20372B]">{isZh ? "我的草本伙伴" : "My Plants"}</div>
          <div className="text-[11px] font-semibold text-[#6A946B]">{isZh ? `本月活跃 ${thisMonthConsultations} 次` : `${thisMonthConsultations} active this month`}</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {plants.map((plant, index) => (
            <button
              key={plant.name}
              type="button"
              onClick={() => setActivePlant(index)}
              className={`rounded-[1.25rem] p-2 text-left shadow-sm ring-1 transition-all hover:-translate-y-0.5 ${activePlant === index ? "bg-white ring-[#A9C89D]" : "bg-white/72 ring-white/70"}`}
            >
              <div className="grid h-16 place-items-center overflow-hidden rounded-[1rem] bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.88),transparent_44%),linear-gradient(180deg,#EAF5E5,#F8F2E5)]">
                <img src={plant.image} alt={plant.name} className="qfhj-plant-thumb max-h-[4.4rem] max-w-[4.4rem] object-contain drop-shadow-sm" />
              </div>
              <div className="mt-2 truncate text-xs font-bold text-[#20372B]">{plant.name}</div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-[#6B7B6E]"><span>Lv.{plant.level}</span><span>{plant.progress}%</span></div>
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-3 rounded-[1.2rem] bg-white/70 px-3 py-2 text-[11px] leading-5 text-[#5E725F] ring-1 ring-white/70">
        <b className="text-[#315038]">{isZh ? "当前提示：" : "Tip: "}</b>{gardenMessage}
        <span className="ml-1 text-[#8A988B]">{isZh ? "这是健康习惯激励组件，只记录互动成长，不输出医疗诊断结论。" : "Habit incentive only; not a medical diagnosis."}</span>
      </div>
    </Card>
  );
}

function HealthTrendChart({
  data,
  isZh,
}: {
  data: { label: string; vitality: number; activity: number; risk: number }[];
  isZh: boolean;
}) {
  type MetricKey = "vitality" | "activity" | "risk";
  const [hoveredMetric, setHoveredMetric] = useState<MetricKey | null>(null);
  const width = 620;
  const height = 220;
  const padX = 34;
  const padY = 24;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const metricDefinitions: {
    key: MetricKey;
    label: string;
    shortLabel: string;
    color: string;
    latestTone: string;
    explain: string;
  }[] = [
    {
      key: "vitality",
      label: isZh ? "健康活力指数" : "Health vitality index",
      shortLabel: isZh ? "活力" : "Vital",
      color: "#5B7D63",
      latestTone: "bg-[#F7FAF5] ring-[#E2E8E3] text-[#5B7D63]",
      explain: isZh
        ? "计数原理：以基础健康档案分为起点，叠加问诊记录数量、向导辨证完成次数和连续使用时间；数值越高，表示健康管理行为越稳定，不代表医学诊断结果。"
        : "Rule: profile baseline + consultation count + completed guided diagnosis + usage continuity. Higher means steadier self-management, not a medical diagnosis.",
    },
    {
      key: "activity",
      label: isZh ? "管理活跃度" : "Management activity",
      shortLabel: isZh ? "活跃" : "Active",
      color: "#C4A862",
      latestTone: "bg-[#FFF9E8] ring-[#EAD8A6] text-[#8B6F47]",
      explain: isZh
        ? "计数原理：主要统计本月问诊、辨证、报告查看等使用频率；数值越高，说明用户最近更主动地记录和管理健康。"
        : "Rule: recent frequency of consultation, guided diagnosis and report review. Higher means more active health record management.",
    },
    {
      key: "risk",
      label: isZh ? "复盘关注度" : "Review focus",
      shortLabel: isZh ? "需关注" : "Focus",
      color: "#7CA5B0",
      latestTone: "bg-[#F0F4F1] ring-[#E2E8E3] text-[#4F7D8A]",
      explain: isZh
        ? "计数原理：根据近期记录不足、问诊较少、需要持续复盘的情况估算；数值越高，表示越建议回看记录或补充健康信息。"
        : "Rule: estimated from sparse recent records and need for follow-up review. Higher means the user should review records or add more health information.",
    },
  ];

  const pointCoords = (key: MetricKey) =>
    data.map((item, idx) => {
      const x = padX + (idx * innerW) / Math.max(1, data.length - 1);
      const y = padY + innerH - (Math.max(0, Math.min(100, item[key])) / 100) * innerH;
      return { x, y, value: item[key], label: item.label };
    });
  const points = (key: MetricKey) => pointCoords(key).map((p) => `${p.x},${p.y}`).join(" ");
  const latest = data[data.length - 1];
  const hovered = metricDefinitions.find((item) => item.key === hoveredMetric) || null;

  return (
    <Card className="overflow-hidden rounded-[1.75rem] border-0 bg-white/82 p-5 shadow-[0_10px_34px_rgba(45,59,46,0.06)] ring-1 ring-[#E2E8E3]">
      <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8BA690]">Health Trend</div>
          <h3 className="mt-1 text-lg font-bold text-[#223126]">{isZh ? "健康趋势历史记录" : "Health Trend History"}</h3>
          <p className="mt-1 text-xs leading-5 text-[#6B7B6E]">
            {isZh ? "根据问诊活跃度、辨证完成度、复盘规律生成趋势，用于观察健康管理习惯变化。鼠标放到曲线上可查看指标说明。" : "Trend generated from consultation activity, guided diagnosis and review habits. Hover a line to see how each metric is counted."}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          {metricDefinitions.map((metric) => (
            <div
              key={metric.key}
              onMouseEnter={() => setHoveredMetric(metric.key)}
              onMouseLeave={() => setHoveredMetric(null)}
              className={`rounded-2xl px-3 py-2 ring-1 transition-transform hover:-translate-y-0.5 ${metric.latestTone}`}
            >
              <div className="font-bold">{latest[metric.key]}</div>
              <div className="text-[#6B7B6E]">{metric.shortLabel}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative overflow-x-auto rounded-2xl bg-[#FBFCFA] p-2 ring-1 ring-[#EEF2ED]">
        {hovered && (
          <div className="pointer-events-none absolute right-3 top-3 z-10 max-w-[310px] rounded-2xl border border-[#E2E8E3] bg-white/96 p-3 text-left shadow-[0_16px_42px_rgba(45,59,46,0.14)] backdrop-blur">
            <div className="mb-1 flex items-center gap-2 text-sm font-bold text-[#223126]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: hovered.color }} />
              {hovered.label}
            </div>
            <p className="text-xs leading-5 text-[#5F6E62]">{hovered.explain}</p>
            <div className="mt-2 text-[11px] text-[#8A988B]">
              {isZh ? `最新值：${latest[hovered.key]} / 100` : `Latest: ${latest[hovered.key]} / 100`}
            </div>
          </div>
        )}

        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[560px]">
          {[0, 25, 50, 75, 100].map((v) => {
            const y = padY + innerH - (v / 100) * innerH;
            return <g key={v}><line x1={padX} x2={width - padX} y1={y} y2={y} stroke="#E2E8E3" strokeDasharray="4 6" /><text x="4" y={y + 4} fontSize="10" fill="#8A988B">{v}</text></g>;
          })}

          {metricDefinitions.map((metric) => (
            <g key={metric.key}>
              <polyline
                points={points(metric.key)}
                fill="none"
                stroke={metric.color}
                strokeWidth={metric.key === "vitality" ? 4 : 3}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={hoveredMetric && hoveredMetric !== metric.key ? 0.32 : 1}
              />
              <polyline
                points={points(metric.key)}
                fill="none"
                stroke="transparent"
                strokeWidth="16"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="cursor-help"
                style={{ pointerEvents: "stroke" }}
                onMouseEnter={() => setHoveredMetric(metric.key)}
                onMouseLeave={() => setHoveredMetric(null)}
              />
              {pointCoords(metric.key).map((point) => (
                <circle
                  key={`${metric.key}-${point.label}`}
                  cx={point.x}
                  cy={point.y}
                  r={hoveredMetric === metric.key ? 4 : 2.8}
                  fill="#fff"
                  stroke={metric.color}
                  strokeWidth="2"
                  opacity={hoveredMetric && hoveredMetric !== metric.key ? 0.28 : 1}
                  onMouseEnter={() => setHoveredMetric(metric.key)}
                  onMouseLeave={() => setHoveredMetric(null)}
                />
              ))}
            </g>
          ))}

          {data.map((item, idx) => {
            const x = padX + (idx * innerW) / Math.max(1, data.length - 1);
            return <text key={item.label} x={x} y={height - 4} textAnchor="middle" fontSize="10" fill="#8A988B">{item.label}</text>;
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#6B7B6E]">
        {metricDefinitions.map((metric) => (
          <button
            key={metric.key}
            type="button"
            onMouseEnter={() => setHoveredMetric(metric.key)}
            onMouseLeave={() => setHoveredMetric(null)}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors hover:bg-[#F0F4F1]"
          >
            <i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: metric.color }} />
            {metric.label}
          </button>
        ))}
      </div>
    </Card>
  );
}

/* ==========================================================================
   Profile Component
   ========================================================================== */

export default function Profile() {
  const { user, isAuthenticated, isSuperuser } = useAuth();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isZh = language === "zh";

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<ChatMessage[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTitle, setDetailTitle] = useState("");

  // Wizard diagnosis state
  const [wizardSessions, setWizardSessions] = useState<any[]>([]);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardDetail, setWizardDetail] = useState<any | null>(null);
  const [wizardDetailLoading, setWizardDetailLoading] = useState(false);

  const loadConversations = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const data = await getConversationList(1, 50);
      setConversations(data.items || []);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Load wizard diagnosis sessions
  const loadWizardSessions = useCallback(async () => {
    if (!isAuthenticated) return;
    setWizardLoading(true);
    try {
      const API = apiData.apiBaseUrl;
      const res = await fetch(`${API}/wizard-diagnosis/sessions`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("API error");
      const json = await res.json();
      setWizardSessions(json.data || []);
    } catch {
      setWizardSessions([]);
    } finally {
      setWizardLoading(false);
    }
  }, [isAuthenticated]);

  // View wizard diagnosis detail
  const handleViewWizardDetail = async (session: any) => {
    setWizardDetailLoading(true);
    setWizardDetail(null);
    try {
      const API = apiData.apiBaseUrl;
      const res = await fetch(`${API}/wizard-diagnosis/sessions/${session.id}/diagnosis`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("API error");
      const json = await res.json();
      setWizardDetail({ session, diagnosis: json.data || null });
    } catch {
      setWizardDetail({ session, diagnosis: null });
    } finally {
      setWizardDetailLoading(false);
    }
  };

  // Delete wizard diagnosis session
  const handleDeleteWizard = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const API = apiData.apiBaseUrl;
      const res = await fetch(`${API}/wizard-diagnosis/sessions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(`删除失败 (${res.status})`);
      setWizardSessions((prev) => prev.filter((s) => s.id !== id));
      if (wizardDetail?.session?.id === id) setWizardDetail(null);
    } catch (err) {
      console.error("删除向导辨证记录失败:", err);
      alert(isZh ? "删除失败，请确认后端服务已重启" : "Delete failed. Please restart the backend.");
    }
  };

  // Clear all wizard diagnosis sessions
  const handleClearAllWizardSessions = async () => {
    if (wizardSessions.length === 0) return;
    const msg = isZh
      ? `确定要清空全部 ${wizardSessions.length} 条向导辨证记录吗？此操作不可撤销。`
      : `Delete all ${wizardSessions.length} wizard diagnosis records? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    try {
      const API = apiData.apiBaseUrl;
      await Promise.all(
        wizardSessions.map((s) =>
          fetch(`${API}/wizard-diagnosis/sessions/${s.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${getToken()}` },
          })
        )
      );
      setWizardSessions([]);
      setWizardDetail(null);
    } catch (err) {
      console.error("清空向导辨证记录失败:", err);
      loadWizardSessions(); // 刷新以反映实际状态
    }
  };

  // Clear all chat conversations
  const handleClearAllConversations = async () => {
    if (conversations.length === 0) return;
    const msg = isZh
      ? `确定要清空全部 ${conversations.length} 条问诊记录吗？此操作不可撤销。`
      : `Delete all ${conversations.length} consultation records? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    try {
      await Promise.all(conversations.map((c) => deleteConversation(c.id)));
      setConversations([]);
      setSelectedMessages(null);
    } catch {
      loadConversations(); // 刷新以反映实际状态
    }
  };

  // Export wizard diagnosis
  const handleExportWizard = () => {
    if (!wizardDetail) return;
    const content = generateExportText(wizardDetail.session, wizardDetail.diagnosis);
    const name = wizardDetail.session?.patientName || "辨证";
    const date = new Date(wizardDetail.session?.createdAt || Date.now())
      .toLocaleDateString("zh-CN").replace(/\//g, "-");
    downloadTextFile(content, `向导辨证_${name}_${date}.txt`);
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
      loadWizardSessions();
    }
  }, [isAuthenticated, loadConversations, loadWizardSessions]);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (selectedMessages) setSelectedMessages(null);
    } catch {
      // ignore
    }
  };

  const handleViewDetail = async (conv: ChatConversation) => {
    setDetailLoading(true);
    setDetailTitle(conv.title || (isZh ? "问诊记录" : "Consultation"));
    try {
      const data = await getConversationDetail(conv.id);
      setSelectedMessages(data.messages || []);
    } catch {
      setSelectedMessages(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const totalDays = calculateDays(user?.createdAt || "");
  const totalConsultations = conversations.length;
  const thisMonthConsultations = conversations.filter((c) => {
    const d = new Date(c.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const completedWizardCount = wizardSessions.filter((s) => s.status === "completed").length;
  const visibleWizardSessions = wizardSessions.slice(0, 3);
  const visibleConversations = conversations.slice(0, 3);
  const healthTrendData = Array.from({ length: 7 }, (_, index) => {
    const dayOffset = 6 - index;
    const date = new Date();
    date.setDate(date.getDate() - dayOffset);
    const label = `${date.getMonth() + 1}/${date.getDate()}`;
    const base = 52 + Math.min(18, totalConsultations * 2) + Math.min(12, completedWizardCount * 3);
    return {
      label,
      vitality: Math.max(38, Math.min(96, base + index * 3 - (dayOffset % 2) * 4)),
      activity: Math.max(28, Math.min(92, 40 + thisMonthConsultations * 6 + index * 4 + (index % 2) * 3)),
      risk: Math.max(12, Math.min(68, 56 - index * 5 + Math.max(0, 4 - totalConsultations) * 3)),
    };
  });
  const capabilityCards = [
    {
      icon: <Stethoscope className="h-5 w-5" />,
      title: isZh ? "智能问诊" : "AI Consultation",
      desc: isZh ? "多轮对话采集症状，生成结构化中医辨证参考。" : "Multi-turn symptom collection with structured TCM reasoning.",
      path: "/qfhj",
      tone: "from-[#E8F0EA] to-white text-[#5B7D63]",
    },
    {
      icon: <Wand2 className="h-5 w-5" />,
      title: isZh ? "向导辨证" : "Guided Diagnosis",
      desc: isZh ? "以问卷方式沉淀病情信息，让辨证流程更稳定清晰。" : "Questionnaire workflow for consistent case collection.",
      path: "/wizard-diagnosis",
      tone: "from-[#F5F0E8] to-white text-[#9A7A36]",
    },
    {
      icon: <Microscope className="h-5 w-5" />,
      title: isZh ? "皮肤检测" : "Skin Detection",
      desc: isZh ? "分割病灶区域并结合视觉大模型输出解释与就医提示。" : "Lesion segmentation with visual explanation and care guidance.",
      path: "/skin-detection",
      tone: "from-[#EEF4F7] to-white text-[#4F7D8A]",
    },
    {
      icon: <HeartPulse className="h-5 w-5" />,
      title: isZh ? "体质辨识" : "Constitution",
      desc: isZh ? "形成长期健康画像，与问诊记录共同构成个人档案。" : "Builds a longitudinal health profile from assessments.",
      path: "/tcm-graph",
      tone: "from-[#F0F4F1] to-white text-[#6F8C5C]",
    },
    {
      icon: <BookOpen className="h-5 w-5" />,
      title: isZh ? "知识库" : "Knowledge Base",
      desc: isZh ? "Neo4j 知识图谱沉淀中药、方剂、穴位和问诊依据。" : "Neo4j graph for herbs, formulas, acupoints and evidence.",
      path: "/tcm-knowledge",
      tone: "from-[#F7F2E8] to-white text-[#8B6F47]",
    },
  ];

  const profileFlowCards = [
    {
      title: isZh ? "智能问诊档案" : "Consultation profile",
      desc: isZh ? "保留多轮症状采集与辨证摘要" : "Multi-turn symptoms and reasoning summary",
      img: herbalDiagnosticsUrl,
      tag: "LLM",
      path: "/qfhj",
    },
    {
      title: isZh ? "皮肤检测报告" : "Skin detection report",
      desc: isZh ? "图像分割、视觉解释与就医提示" : "Segmentation, explanation and care guidance",
      img: visionDetectionUrl,
      tag: "Vision",
      path: "/skin-detection",
    },
    {
      title: isZh ? "中医知识依据" : "TCM evidence graph",
      desc: isZh ? "Neo4j 图谱串联中药、方剂、穴位、证型" : "Neo4j graph for herbs, formulas, acupoints and patterns",
      img: knowledgeGraphUrl,
      tag: "Neo4j",
      path: "/tcm-knowledge",
    },
  ];

  const profileSignals = [
    [isZh ? "隐私保护" : "Privacy", isZh ? "邮箱脱敏 · 记录下沉" : "Masked email · scoped records"],
    [isZh ? "可解释" : "Explainable", isZh ? "问诊、辨证、依据同步呈现" : "Reasoning and evidence shown together"],
    [isZh ? "有边界" : "Bounded", isZh ? "健康参考，不替代医生诊断" : "Reference only, not a diagnosis"],
  ];

  const profileMilestones = [
    [isZh ? "采集" : "Collect", isZh ? "症状、体质、图片" : "Symptoms, constitution, images"],
    [isZh ? "分析" : "Analyze", isZh ? "LLM + 规则 + 视觉" : "LLM + rules + vision"],
    [isZh ? "沉淀" : "Archive", isZh ? "形成个人健康档案" : "Build health profile"],
  ];

  const healthStreamInsights = [
    {
      title: isZh ? "累计辨证数据" : "Total records",
      value: `${totalConsultations + wizardSessions.length}`,
      desc: isZh ? "涵盖智能问诊与向导辨证的全部交互记录。" : "All interaction records from AI chat and guided diagnosis.",
    },
    {
      title: isZh ? "辨证完成率" : "Completion rate",
      value: `${completedWizardCount}/${Math.max(1, wizardSessions.length)}`,
      desc: isZh ? "向导辨证七步流程中已完成全流程的占比。" : "Ratio of fully completed 7-step guided diagnosis sessions.",
    },
    {
      title: isZh ? "知识增强引擎" : "Knowledge engine",
      value: "Neo4j",
      desc: isZh ? "知识图谱组织中医概念关系，为知识库提供可视化、可追溯的关联依据。" : "Knowledge graph organizes TCM concept relations for visual and traceable evidence.",
    },
  ];

  const healthStreamProtocol = [
    [isZh ? "健康画像" : "Profile", isZh ? "整合体质评估、问诊记录与皮肤检测结果" : "Constitution, consultation and skin detection results"],
    [isZh ? "风险提示" : "Risk alert", isZh ? "急症与红旗症状自动识别，引导线下就医" : "Automatic red-flag detection, guide to offline care"],
    [isZh ? "依据追溯" : "Traceability", isZh ? "每条建议可溯源至知识库原文与图谱关系" : "Every suggestion traceable to source knowledge and graph relations"],
    [isZh ? "日常调养" : "Daily care", isZh ? "基于体质类型的饮食、作息与养生建议" : "Personalized diet, routine and wellness advice by constitution type"],
  ];

  const healthStreamChecklist = [
    [isZh ? "近期健康回顾" : "Recent review", isZh ? "汇总近 7 天问诊与辨证记录，追踪症状变化趋势。" : "Summarize 7-day records and track symptom trends."],
    [isZh ? "知识关联路径" : "Evidence route", isZh ? "症状 → 证型 → 方剂 → 穴位，形成完整的辨证依据链。" : "Symptom → pattern → formula → acupoint evidence chain."],
    [isZh ? "安全边界提示" : "Safety boundary", isZh ? "急重症仅提示就医方向，不替代执业医师诊断。" : "Emergencies only show care direction, not professional diagnosis."],
  ];

  /* ------------------------------------------------------------------
     Non-authenticated landing page
     ------------------------------------------------------------------ */
  if (!isAuthenticated) {
    return (
      <div className="space-y-8">
        {/* Interactive Hero */}
        <div className="relative overflow-hidden rounded-3xl min-h-[420px] md:min-h-[480px]">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#3D5A45] via-[#5B7D63] to-[#7C9A82]" />

          {/* Subtle radial glow behind text */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[80%] rounded-full bg-[#7C9A82]/20 blur-[80px]" />

          {/* Interactive canvas */}
          <TCMHeroCanvas />

          {/* Content overlay */}
          <div className="relative z-10 grid min-h-[420px] place-items-center p-8 text-center pointer-events-none md:min-h-[480px] md:p-16">
            <div className="max-w-3xl">
            <div className="text-6xl mb-4 drop-shadow-lg select-none">🌿</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 drop-shadow-md">
              {isZh ? "欢迎使用千方慧鉴" : "Welcome to Smart TCM"}
            </h2>
            <p className="text-white/75 mb-8 max-w-lg mx-auto text-lg leading-relaxed">
              {isZh
                ? "传承千年中医智慧，融合现代 AI 技术。登录即可体验智能辨证问诊、体质辨识与中医知识探索。"
                : "Blending millennia of TCM wisdom with modern AI. Sign in to experience intelligent diagnosis, constitution assessment, and TCM knowledge discovery."}
            </p>
            <Button
              onClick={() => navigate("/login")}
              size="lg"
              className="bg-[#C4A862] hover:bg-[#B39750] text-white rounded-2xl px-8 shadow-lg pointer-events-auto transition-all hover:scale-105"
            >
              {isZh ? "立即登录" : "Sign In"}
            </Button>
            <p className="text-white/45 text-xs mt-6 pointer-events-auto">
              {isZh ? "草本粒子与经络涟漪呈现智慧中医辅助流程" : "Herbal particles and meridian ripples visualize the assistant workflow"}
            </p>
            </div>
          </div>

          {/* Wave divider */}
          <div className="absolute bottom-0 left-0 right-0 z-10">
            <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
              <path d="M0 40C360 80 720 0 1080 40C1260 60 1380 50 1440 40V80H0V40Z" fill="white"/>
            </svg>
          </div>
        </div>

        {/* Feature previews - 3 card grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[
            { icon: <Stethoscope className="h-8 w-8" />, title: isZh ? "智能问诊" : "AI Diagnosis", desc: isZh ? "AI中医辨证分析" : "AI TCM Pattern Analysis", bg: "bg-[#E8F0EA]" },
            { icon: <BookOpen className="h-8 w-8" />, title: isZh ? "知识库" : "Knowledge Base", desc: isZh ? "Neo4j 中药方剂穴位知识" : "Neo4j Herbs, Prescriptions, Acupoints", bg: "bg-[#F5F0E8]" },
            { icon: <Activity className="h-8 w-8" />, title: isZh ? "皮肤检测" : "Skin Detection", desc: isZh ? "智能皮肤病分析" : "Smart Skin Analysis", bg: "bg-[#F0F4F1]" },
          ].map((feature) => (
            <Card key={feature.title} className={`p-6 ${feature.bg} border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)]`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-[#2D3B2E]">{feature.title}</h3>
                  <p className="text-sm text-[#6B7B6E] mt-1">{feature.desc}</p>
                </div>
                <div className="text-[#7C9A82] opacity-60">
                  {feature.icon}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------
     Authenticated profile page
     ------------------------------------------------------------------ */
  return (
    <div className="space-y-7">
      {/* Product overview */}
      <section className="relative overflow-hidden rounded-[2.25rem] border border-[#E2E8E3]/90 bg-white/72 shadow-[0_24px_80px_rgba(45,59,46,0.10)] backdrop-blur-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(124,154,130,0.24),transparent_30%),radial-gradient(circle_at_86%_4%,rgba(196,168,98,0.20),transparent_28%),linear-gradient(135deg,rgba(248,250,247,0.88),rgba(255,255,255,0.58))]" />
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full border border-[#C4A862]/30" />
        <div className="absolute -bottom-28 left-[36%] h-72 w-72 rounded-full border border-[#7C9A82]/20" />
        <div className="relative grid gap-8 p-6 md:p-9 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/82 px-3 py-1 text-xs font-semibold text-[#5B7D63] ring-1 ring-[#DCE7DD]">
              <ShieldCheck className="h-3.5 w-3.5" />
              {isZh ? "轻盈科学 · 智慧中医 · 多模态辅助" : "Light clinical AI · Smart TCM · Multimodal assistant"}
            </div>
            <div className="flex flex-col gap-6 md:flex-row md:items-center">
              <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-[2rem] bg-white shadow-[0_18px_46px_rgba(45,59,46,0.16)] ring-1 ring-[#E2E8E3]">
                <img src={logoUrl} alt="千方慧鉴" className="h-full w-full object-cover" />
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-[#223126] md:text-6xl">
                  {isZh ? "千方慧鉴" : "Smart TCM"}
                </h1>
                <p className="mt-3 text-lg font-semibold text-[#4E624F] md:text-2xl">
                  {isZh ? "中医智能辅助 · 多模态健康管理平台" : "AI-assisted TCM · Multimodal health platform"}
                </p>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-[#657366] md:text-base">
                  {isZh
                    ? "围绕“问诊—辨证—Neo4j 知识依据—皮肤检测—健康档案”的完整路径，将大语言模型、结构化中医流程、知识图谱关系与视觉分析组织成可解释、可追溯、有边界的辅助系统。"
                    : "A complete workflow from consultation, diagnosis and evidence retrieval to visual screening and health records, designed to be explainable, traceable and bounded."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                [isZh ? "智能问诊次数" : "Consultations", totalConsultations, "LLM"],
                [isZh ? "本月新增问诊" : "This Month", thisMonthConsultations, "Trend"],
                [isZh ? "向导辨证档案" : "Guided Cases", wizardSessions.length, "Flow"],
                [isZh ? "辨证已完结" : "Completed", completedWizardCount, "Safe"],
              ].map(([label, value, tag]) => (
                <div key={label} className="group rounded-3xl bg-white/78 p-4 ring-1 ring-[#E2E8E3] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(45,59,46,0.08)]">
                  <div className="flex items-center justify-between">
                    <div className="text-3xl font-bold text-[#223126]">{value}</div>
                    <span className="rounded-full bg-[#F5F0E8] px-2 py-0.5 text-[10px] font-semibold text-[#8B6F47]">{tag}</span>
                  </div>
                  <div className="mt-2 text-xs text-[#6B7B6E]">{label}</div>
                </div>
              ))}
            </div>

            <HealthGardenMiniApp
              totalDays={totalDays}
              totalConsultations={totalConsultations}
              completedWizardCount={completedWizardCount}
              thisMonthConsultations={thisMonthConsultations}
              isZh={isZh}
            />
          </div>

          <div className="relative overflow-hidden rounded-[2rem] bg-[#17231D] p-4 text-white shadow-[0_24px_70px_rgba(23,35,29,0.24)] ring-1 ring-white/10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(124,154,130,0.42),transparent_28%),radial-gradient(circle_at_92%_18%,rgba(196,168,98,0.28),transparent_24%),linear-gradient(145deg,rgba(23,35,29,0.98),rgba(43,63,49,0.94))]" />
            <div className="absolute -right-16 top-8 h-44 w-44 rounded-full border border-white/10 qfhj-soft-float" />
            <div className="absolute -bottom-20 -left-12 h-52 w-52 rounded-full bg-[#7C9A82]/15 blur-2xl" />

            <div className="relative space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-white/45">Health Stream</div>
                  <h2 className="mt-1 text-2xl font-bold">{isZh ? "个人健康功能流" : "Personal health stream"}</h2>
                  <p className="mt-2 max-w-md text-xs leading-5 text-white/58">
                    {isZh ? "参考动态流式模板，但转译为更适合医疗健康的档案、检测、知识依据与安全边界展示。" : "A flowing view of profile, detection, evidence and safety boundaries."}
                  </p>
                </div>
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10 text-sm font-bold ring-1 ring-white/10">
                  {isZh ? "档案" : "File"}
                </div>
              </div>


              <div className="rounded-[1.55rem] bg-white/[0.08] p-3 ring-1 ring-white/10">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#C4A862] to-[#7C9A82] text-xl font-bold shadow-lg">
                    {displayUserName(user?.fullName, user?.username, isZh).charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-white/45">{isZh ? "当前健康档案" : "Current health profile"}</div>
                    <h3 className="truncate text-lg font-bold">{displayUserName(user?.fullName, user?.username, isZh)}</h3>
                    <p className="truncate text-xs text-white/50">{maskEmail(user?.email)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { loadConversations(); loadWizardSessions(); }}
                    disabled={loading || wizardLoading}
                    className="rounded-xl bg-white/10 px-3 text-white hover:bg-white/16 hover:text-white"
                  >
                    <RefreshCw className={`h-4 w-4 ${(loading || wizardLoading) ? "animate-spin" : ""}`} />
                  </Button>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-2xl bg-white/[0.08] p-3 ring-1 ring-white/10"><Calendar className="mx-auto mb-1 h-4 w-4 text-[#D8C27A]" />{totalDays}{isZh ? "天" : "d"}</div>
                  <div className="rounded-2xl bg-white/[0.08] p-3 ring-1 ring-white/10"><User className="mx-auto mb-1 h-4 w-4 text-[#A8BFAE]" />{isSuperuser ? (isZh ? "管理" : "Admin") : (isZh ? "用户" : "User")}</div>
                  <div className="rounded-2xl bg-white/[0.08] p-3 ring-1 ring-white/10"><ShieldCheck className="mx-auto mb-1 h-4 w-4 text-[#A8BFAE]" />{isZh ? "脱敏" : "Masked"}</div>
                </div>
              </div>

              <div className="qfhj-flow-mask -mx-4 py-2">
                <div className="qfhj-flow-track gap-3 px-4">
                  {[...profileFlowCards, ...profileFlowCards].map((item, index) => (
                    <button
                      key={`${item.title}-${index}`}
                      onClick={() => navigate(item.path)}
                      className="group relative w-56 shrink-0 overflow-hidden rounded-[1.55rem] bg-white text-left text-[#223126] shadow-[0_16px_36px_rgba(0,0,0,0.18)] transition-all duration-300 hover:-translate-y-1"
                    >
                      <div className="relative h-28 overflow-hidden qfhj-scan-line">
                        <img src={item.img} alt={item.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      </div>
                      <div className="p-3">
                        <div className="mb-2 inline-flex rounded-full bg-[#EEF4F0] px-2 py-0.5 text-[10px] font-bold text-[#5B7D63] ring-1 ring-[#DCE7DD]">{item.tag}</div>
                        <div className="font-bold">{item.title}</div>
                        <p className="mt-1 text-xs leading-5 text-[#657366]">{item.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="min-w-0 rounded-[1.35rem] bg-white/[0.07] p-2.5 ring-1 ring-white/10">
                  <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[9px] font-semibold uppercase leading-4 tracking-[0.10em] text-white/42 [overflow-wrap:anywhere]">Clinical</div>
                      <div className="mt-0.5 text-[13px] font-bold leading-4 text-white/90 [overflow-wrap:anywhere]">{isZh ? "健康数据总览" : "Health Data Overview"}</div>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#C4A862]/18 px-1.5 py-0.5 text-[9px] font-bold text-[#F5D98E] ring-1 ring-[#C4A862]/25">{isZh ? "可追溯" : "Traceable"}</span>
                  </div>
                  <div className="grid gap-1.5">
                    {healthStreamInsights.map((item) => (
                      <div key={item.title} className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-2 rounded-2xl bg-white/[0.075] p-2 ring-1 ring-white/10">
                        <div className="min-w-0">
                          <div className="truncate text-[10px] leading-4 text-white/48">{item.title}</div>
                          <div className="mt-0.5 break-words text-sm font-black leading-4 text-[#F6E6A8]">{item.value}</div>
                        </div>
                        <p className="min-w-0 text-[10px] leading-4 text-white/52 [overflow-wrap:anywhere]">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="min-w-0 rounded-[1.35rem] bg-white/[0.07] p-2.5 ring-1 ring-white/10">
                  <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[9px] font-semibold uppercase leading-4 tracking-[0.10em] text-white/42 [overflow-wrap:anywhere]">Protocol</div>
                      <div className="mt-0.5 text-[13px] font-bold leading-4 text-white/90 [overflow-wrap:anywhere]">{isZh ? "健康管理闭环" : "Health management loop"}</div>
                    </div>
                    <Activity className="h-4 w-4 shrink-0 text-[#C4A862]" />
                  </div>
                  <div className="grid gap-1.5">
                    {healthStreamProtocol.map(([title, desc], index) => (
                      <div key={title} className="relative min-w-0 rounded-2xl bg-white/[0.06] p-2.5 ring-1 ring-white/10">
                        <span className="absolute right-2.5 top-2 text-[10px] font-bold text-white/25">0{index + 1}</span>
                        <div className="pr-6 text-xs font-bold leading-4 text-[#F5D98E] [overflow-wrap:anywhere]">{title}</div>
                        <div className="mt-1 text-[10px] leading-4 text-white/50 [overflow-wrap:anywhere]">{desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-[#C4A862]/18 bg-[#C4A862]/10 px-3 py-2 text-[10px] leading-5 text-white/58">
                <b className="text-[#F5D98E]">{isZh ? "说明：" : "Note: "}</b>
                {isZh
                  ? "Neo4j 组织知识关系链路，再与问诊、辨证、皮肤检测记录形成可解释闭环。"
                  : "Neo4j organizes knowledge relation paths, and the result links back to consultation, diagnosis and vision records."}
              </div>

              <div className="grid gap-1.5 rounded-[1.35rem] bg-white/[0.065] p-2.5 ring-1 ring-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">Review Checklist</span>
                </div>
                {healthStreamChecklist.map(([title, desc]) => (
                  <div key={title} className="grid min-w-0 grid-cols-[86px_minmax(0,1fr)] gap-2 rounded-2xl bg-white/[0.055] px-2.5 py-2 ring-1 ring-white/10">
                    <div className="truncate text-xs font-bold text-[#F5D98E]">{title}</div>
                    <div className="min-w-0 text-[10px] leading-4 text-white/50 [overflow-wrap:anywhere]">{desc}</div>
                  </div>
                ))}
              </div>

              <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                {profileSignals.map(([title, desc], index) => (
                  <div key={title} className="rounded-2xl bg-white/[0.07] p-3 ring-1 ring-white/10">
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-[#C4A862]/20 text-[11px] text-[#F5D98E]">0{index + 1}</span>
                      {title}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-white/52">{desc}</p>
                  </div>
                ))}
              </div>

              <div className="min-w-0 rounded-[1.35rem] bg-white/[0.07] p-2.5 ring-1 ring-white/10">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/42">Profile Pipeline</span>
                  <Activity className="h-4 w-4 text-[#C4A862]" />
                </div>
                <div className="grid grid-cols-1 gap-1.5 2xl:grid-cols-3">
                  {profileMilestones.map(([title, desc], index) => (
                    <div key={title} className="relative rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10">
                      {index < 2 && <span className="absolute right-[-10px] top-1/2 hidden h-px w-5 bg-[#C4A862]/55 2xl:block" />}
                      <div className="text-sm font-bold text-[#F5D98E]">{title}</div>
                      <div className="mt-1 text-[11px] leading-4 text-white/48">{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Unified capability entry */}
      <section>
        <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8BA690]">Capabilities</div>
            <h2 className="mt-1 text-2xl font-bold text-[#223126]">{isZh ? "核心能力入口" : "Core Capabilities"}</h2>
            <p className="mt-1 text-sm text-[#6B7B6E]">{isZh ? "推荐使用路径：智能问诊 → 向导辨证 → 皮肤检测 → 体质辨识 → 知识库" : "Recommended path: AI Chat → Guided Diagnosis → Skin Detection → Constitution → Knowledge"}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF9E8] px-3 py-1.5 text-xs font-medium text-[#6F5A2E] ring-1 ring-[#EAD8A6]">
            <ShieldCheck className="h-3.5 w-3.5" />
            {isZh ? "辅助参考 · 不替代医生诊断" : "Reference only · not medical diagnosis"}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {capabilityCards.map((item, index) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`group relative overflow-hidden rounded-[1.65rem] border border-[#E2E8E3] bg-gradient-to-br ${item.tone} p-5 text-left shadow-[0_8px_28px_rgba(45,59,46,0.055)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(45,59,46,0.10)]`}
            >
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/46 transition-transform duration-500 group-hover:scale-125" />
              <div className="relative flex items-center justify-between">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/85 shadow-sm ring-1 ring-white/80">{item.icon}</span>
                <span className="rounded-full bg-white/75 px-2 py-1 text-[10px] font-bold text-[#6B7B6E] ring-1 ring-white/70">0{index + 1}</span>
              </div>
              <div className="relative mt-5 font-bold text-[#223126]">{item.title}</div>
              <p className="relative mt-2 text-xs leading-5 text-[#657366]">{item.desc}</p>
              <div className="relative mt-4 inline-flex items-center text-xs font-semibold text-[#5B7D63]">
                {isZh ? "进入功能" : "Open"}
                <ChevronRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Recommended walkthrough */}
      <section className="grid gap-5 xl:grid-cols-[minmax(280px,0.78fr)_minmax(0,1.22fr)]">
        <Card className="rounded-[1.75rem] border-[#EAD8A6] bg-[#FFF9E8]/88 p-5 text-[#6F5A2E] shadow-[0_10px_34px_rgba(111,90,46,0.06)]">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#C4A862]" />
            <div>
              <h3 className="font-bold">{isZh ? "医疗安全边界" : "Medical safety boundary"}</h3>
              <p className="mt-2 text-sm leading-6">
                {isZh
                  ? "本系统用于健康咨询、学习参考和辅助筛查，不能替代执业医师诊断和治疗。若出现高热、出血、皮损快速扩大、呼吸困难、持续疼痛等情况，请及时前往正规医疗机构就诊。"
                  : "This system is for health consultation and auxiliary screening only, not a substitute for professional diagnosis or treatment."}
              </p>
            </div>
          </div>
        </Card>

        <Card className="rounded-[1.75rem] border-0 bg-white/82 p-5 shadow-[0_10px_34px_rgba(45,59,46,0.06)] ring-1 ring-[#E2E8E3]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8BA690]">Walkthrough</div>
              <h3 className="mt-1 text-lg font-bold text-[#223126]">{isZh ? "推荐体验路径" : "Recommended demo path"}</h3>
            </div>
            <PlayCircle className="h-5 w-5 text-[#C4A862]" />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              [isZh ? "1. 智能问诊" : "1. Consultation", isZh ? "输入典型症状，观察多轮问诊。" : "Enter symptoms and observe dialogue."],
              [isZh ? "2. 向导辨证" : "2. Guided Dx", isZh ? "按步骤形成可追溯档案。" : "Create a traceable diagnosis file."],
              [isZh ? "3. 皮肤检测" : "3. Vision", isZh ? "上传皮肤图片查看分割与解释。" : "Upload image for segmentation and explanation."],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-2xl bg-[#F7FAF5] p-4 ring-1 ring-[#E2E8E3]">
                <div className="font-semibold text-[#2D3B2E]">{title}</div>
                <div className="mt-2 text-xs leading-5 text-[#6B7B6E]">{desc}</div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <HealthTrendChart data={healthTrendData} isZh={isZh} />

      {/* Records overview */}
      <section id="qfhj-profile-records" className="scroll-mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="p-5 border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2 text-[#2D3B2E]">
                <MessageSquare className="h-5 w-5 text-[#7C9A82]" />
                {isZh ? "最近问诊" : "Recent Consultations"}
              </h3>
              <p className="mt-1 text-xs text-[#8A988B]">{isZh ? `共 ${conversations.length} 条，仅展示最近 3 条` : `${conversations.length} total, latest 3 shown`}</p>
            </div>
            {loading && <RefreshCw className="h-4 w-4 animate-spin text-[#B0B8B1]" />}
          </div>
          {loading && conversations.length === 0 ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-[#F0F4F1] rounded-xl animate-pulse" />)}</div>
          ) : conversations.length === 0 ? (
            <div className="rounded-2xl bg-[#F7FAF5] py-8 text-center text-[#6B7B6E]">
              <Stethoscope className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{isZh ? "暂无问诊记录" : "No consultation records"}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleConversations.map((conv, index) => (
                <div
                  key={conv.id}
                  onClick={() => handleViewDetail(conv)}
                  className="flex items-center gap-4 p-4 rounded-xl border border-[#E2E8E3] hover:border-[#7C9A82]/30 hover:bg-[#F0F4F1]/50 cursor-pointer transition-all group"
                >
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-[#E8F0EA] to-[#F0F4F1] flex items-center justify-center">
                    <Stethoscope className="h-4 w-4 text-[#7C9A82]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-[#2D3B2E]">
                      {displayRecordTitle(
                        index > 0 && visibleConversations.slice(0, index).some((item) => item.title === conv.title) ? "" : conv.title,
                        [isZh ? "经期饮食调理咨询" : "Menstrual Diet Consultation", isZh ? "睡眠乏力调理咨询" : "Sleep and Fatigue Consultation", isZh ? "脾胃不适问诊记录" : "Digestive Health Consultation"][index] || (isZh ? "中医问诊案例" : "TCM Consultation Case")
                      )}
                    </p>
                    <p className="text-sm text-[#6B7B6E] mt-0.5">
                      {formatDateTime(conv.updatedAt || conv.createdAt)}
                      {conv.messageCount && ` · ${conv.messageCount}${isZh ? "条消息" : " messages"}`}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#B0B8B1] group-hover:text-[#7C9A82] transition-colors" />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2 text-[#2D3B2E]">
                <Wand2 className="h-5 w-5 text-[#C4A862]" />
                {isZh ? "辨证档案" : "Diagnosis Files"}
              </h3>
              <p className="mt-1 text-xs text-[#8A988B]">{isZh ? `共 ${wizardSessions.length} 条，仅展示最近 3 条` : `${wizardSessions.length} total, latest 3 shown`}</p>
            </div>
            {wizardLoading && <RefreshCw className="h-4 w-4 animate-spin text-[#B0B8B1]" />}
          </div>
          {wizardSessions.length === 0 ? (
            <div className="rounded-2xl bg-[#FAF8F0] py-8 text-center text-[#6B7B6E]">
              <Wand2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{isZh ? "暂无向导辨证记录" : "No guided diagnosis records"}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleWizardSessions.map((s, index) => (
                <div
                  key={s.id}
                  onClick={() => handleViewWizardDetail(s)}
                  className="flex items-center gap-4 p-4 rounded-xl border border-[#E2E8E3] hover:border-[#C4A862]/30 hover:bg-[#FAFBF5]/50 cursor-pointer transition-all group"
                >
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-[#F5F0E8] to-[#EAE3D5] flex items-center justify-center">
                    <Wand2 className="h-4 w-4 text-[#C4A862]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-[#2D3B2E]">
                      {displayRecordTitle(s.patientName, [isZh ? "脾胃湿热辨证档案" : "Spleen-Stomach Damp-Heat Case", isZh ? "肝郁气滞辨证档案" : "Liver Qi Stagnation Case", isZh ? "气血两虚辨证档案" : "Qi and Blood Deficiency Case"][index] || (isZh ? "向导辨证档案" : "Guided Diagnosis Case"))}
                    </p>
                    <p className="text-sm text-[#6B7B6E] mt-0.5">
                      {formatDateTime(s.createdAt || "")}
                      {s.status === "completed" && ` · ${isZh ? "已完成" : "Completed"}`}
                      {s.status === "active" && ` · ${isZh ? "进行中" : "In Progress"}`}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#B0B8B1] group-hover:text-[#C4A862] transition-colors" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* Conversation Detail Modal */}
      {selectedMessages && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedMessages(null)}>
          <Card className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border-0 shadow-[0_8px_40px_rgba(0,0,0,0.12)]" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-[#E2E8E3] p-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-bold text-[#2D3B2E]">{detailTitle}</h2>
              <Button variant="ghost" size="sm" onClick={() => setSelectedMessages(null)} className="text-[#6B7B6E]">
                {isZh ? "关闭" : "Close"}
              </Button>
            </div>
            <div className="p-4 space-y-4">
              {selectedMessages.map((msg, idx) => (
                <div key={msg.id || idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#7C9A82] text-white"
                      : "bg-[#F0F4F1] text-[#2D3B2E]"
                  }`}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))}
              {detailLoading && (
                <div className="flex justify-center py-4">
                  <RefreshCw className="h-5 w-5 animate-spin text-[#B0B8B1]" />
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Wizard Diagnosis Detail Modal */}
      {(wizardDetail || wizardDetailLoading) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setWizardDetail(null); }}>
          <Card className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border-0 shadow-[0_8px_40px_rgba(0,0,0,0.12)]" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-[#E2E8E3] p-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-[#2D3B2E] flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-[#C4A862]" />
                {wizardDetail?.session?.patientName || (isZh ? "向导辨证记录" : "Wizard Diagnosis")}
              </h2>
              <div className="flex items-center gap-1">
                {wizardDetail && !wizardDetailLoading && (
                  <Button variant="ghost" size="sm" onClick={handleExportWizard} className="text-[#5B7D63]">
                    <Download className="h-4 w-4 mr-1" />
                    {isZh ? "导出" : "Export"}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setWizardDetail(null)} className="text-[#6B7B6E]">
                  {isZh ? "关闭" : "Close"}
                </Button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              {wizardDetailLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-[#B0B8B1]" />
                </div>
              ) : wizardDetail?.diagnosis ? (
                <>
                  {/* Session meta */}
                  <div className="flex flex-wrap gap-3 text-sm text-[#6B7B6E]">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDateTime(wizardDetail.session?.createdAt || "")}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      wizardDetail.session?.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {wizardDetail.session?.status === "completed"
                        ? (isZh ? "已完成" : "Completed")
                        : (isZh ? "进行中" : "In Progress")}
                    </span>
                  </div>

                  {/* Diagnosis summary */}
                  {wizardDetail.diagnosis.primarySyndrome && (
                    <div className="p-4 rounded-xl bg-[#F0F4F1]">
                      <p className="text-xs text-[#6B7B6E] mb-1">{isZh ? "主证型" : "Primary Syndrome"}</p>
                      <p className="text-base font-bold text-[#2D3B2E]">{wizardDetail.diagnosis.primarySyndrome}</p>
                      {wizardDetail.diagnosis.secondarySyndromes && (
                        <p className="text-sm text-[#6B7B6E] mt-1">
                          {isZh ? "兼夹证" : "Secondary"}：{wizardDetail.diagnosis.secondarySyndromes}
                        </p>
                      )}
                      {wizardDetail.diagnosis.treatmentMethod && (
                        <p className="text-sm text-[#5B7D63] mt-1">
                          {isZh ? "治法" : "Treatment"}：{wizardDetail.diagnosis.treatmentMethod}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Cleaned analysis text rendered as sections */}
                  {wizardDetail.diagnosis.rawAiResponse && (() => {
                    const sections = splitSections(wizardDetail.diagnosis.rawAiResponse);
                    return (
                      <div className="space-y-3">
                        {sections.map((sec, idx) => (
                          <div key={idx} className="rounded-xl bg-[#FAFBFA] border border-[#E2E8E3] overflow-hidden">
                            {sec.title && (
                              <div className="px-4 py-2.5 bg-[#F0F4F1] border-b border-[#E2E8E3]">
                                <span className="text-sm font-bold text-[#2D3B2E]">{sec.title}</span>
                              </div>
                            )}
                            <div className="p-4 text-sm leading-relaxed text-[#2D3B2E] whitespace-pre-wrap">
                              {sec.body}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div className="py-8 text-center text-[#6B7B6E]">
                  <p>{isZh ? "该记录暂无诊断结果" : "No diagnosis result for this session"}</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
