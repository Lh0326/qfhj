import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "../components/ui/tooltip";
import {
  CheckCircle2, ChevronLeft, ChevronRight, Clock, Activity,
  BarChart3, Sparkles, Users, RefreshCcw, AlertTriangle,
  X, Loader2, Lock, Download, FileText, HelpCircle,
  Brain,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useNavigate, useSearchParams } from "react-router";
import * as echarts from "echarts";

import apiData from "../../../data/address.json";
import { getToken } from "../../lib/auth";
const API = apiData.apiBaseUrl || "http://localhost:8081/api/v1";
function authHeaders() {
  const t = getToken();
  return t ? { "Content-Type": "application/json", Authorization: `Bearer ${t}` } : { "Content-Type": "application/json" };
}
async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...authHeaders(), ...(opts.headers || {}) } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────
interface SymptomDict { id: number; name: string; category: string; isAssessable: boolean; }

interface AssessmentItem {
  symptomId: number; symptomName: string;
  severity: string | null; skipAssessment: boolean;
}
interface MeridianItem {
  assessmentId: number; symptomName: string;
  attackTime: string | null; attackMeridian: string | null;
}
interface DurationItem {
  assessmentId: number; symptomName: string;
  durationDays: number | null; durationHours: number | null; liuJingStage: string | null;
}
interface DiagnosisResult {
  primarySyndrome: string; secondarySyndromes: string;
  treatmentMethod: string; confidenceScore: number;
  structuredResult: Record<string, unknown> | null;
  rawAiResponse?: string;
}

interface Step5Result { analysis?: string; formula?: string; modification?: string; }
interface Step6Result { adjustedPlan?: string; }
interface Step7Result { consultationResults?: string; finalPlan?: string; }

// ─── Constants ────────────────────────────────────────────────
const STEPS = [
  { label: "症候程度评估", icon: BarChart3 },
  { label: "子午归经", icon: Clock },
  { label: "六经传变", icon: Activity },
  { label: "AI辨证分析", icon: Sparkles },
  { label: "合病合方", icon: AlertTriangle },
  { label: "疗效评估", icon: RefreshCcw },
  { label: "多专家会诊", icon: Users },
];

const STEP_DESCRIPTIONS = [
  "通过5级程度量化评估症状频次和影响程度。比如：头痛是偶尔出现还是持续不断？这些信息只是辨证线索，最终仍需结合舌脉、病程和诱因综合判断。",
  "子午流注可作为发作时间与经络脏腑关系的参考线索。比如半夜1-3点症状明显可提示肝经时段，但不能单凭时间直接判定病位。",
  "六经传变不是简单按天数推断，本步骤优先看寒热、表里、胸胁、胃肠、精神状态等症状组合，持续时长只作为辅助参考。",
  "AI综合前面采集的数据进行八纲、脏腑、经络、六经等交叉辨证，给出辅助分析和调护建议。专业术语会配合通俗解释，方便理解。",
  "当多个病机同时存在时，需要分清主次和兼夹关系。本步骤分析是否需要合方或加减化裁，避免把多个方剂机械叠加。",
  "评估之前的调理效果：哪些症状好转了、哪些没变化？AI会根据反馈重新判断病机变化，并给出下一步调护参考。",
  "请四位不同流派的AI专家分别分析病情，从伤寒、温病、脏腑、经络等角度交叉复核，最后综合形成更稳妥的辅助方案。",
];

const SEVERITY_OPTIONS = [
  { value: "occasional", label: "偶尔（略微）" },
  { value: "sometimes", label: "较少（有点）" },
  { value: "often", label: "较多（一般）" },
  { value: "frequent", label: "很多（非常）" },
  { value: "always", label: "总是（极其）" },
];

const MERIDIAN_MAP: Record<string, { name: string; time: string; meridian: string }> = {
  zi: { name: "子时", time: "23:00-01:00", meridian: "胆经" },
  chou: { name: "丑时", time: "01:00-03:00", meridian: "肝经" },
  yin: { name: "寅时", time: "03:00-05:00", meridian: "肺经" },
  mao: { name: "卯时", time: "05:00-07:00", meridian: "大肠经" },
  chen: { name: "辰时", time: "07:00-09:00", meridian: "胃经" },
  si: { name: "巳时", time: "09:00-11:00", meridian: "脾经" },
  wu: { name: "午时", time: "11:00-13:00", meridian: "心经" },
  wei: { name: "未时", time: "13:00-15:00", meridian: "小肠经" },
  shen: { name: "申时", time: "15:00-17:00", meridian: "膀胱经" },
  you: { name: "酉时", time: "17:00-19:00", meridian: "肾经" },
  xu: { name: "戌时", time: "19:00-21:00", meridian: "心包经" },
  hai: { name: "亥时", time: "21:00-23:00", meridian: "三焦经" },
};

const TONGUE_OPTIONS = ["苔薄白", "苔薄黄", "苔黄腻", "苔白腻", "苔少/无苔", "舌质淡", "舌质红", "舌质暗", "舌有瘀斑", "舌胖大有齿痕"];
const PULSE_OPTIONS = ["脉浮紧", "脉浮缓", "脉浮数", "脉沉细", "脉沉迟", "脉弦", "脉弦数", "脉滑数", "脉濡", "脉弱", "脉沉弦"];
const ENV_OPTIONS = ["受凉", "受湿", "情志刺激", "饮食不节", "过度劳累", "季节变化"];

// 舌诊白话批注 —— 帮助普通用户理解中医术语
const TONGUE_ANNOTATIONS: Record<string, string> = {
  "苔薄白": "舌苔薄薄一层、呈白色，通常是正常舌苔，也可见于轻微受凉",
  "苔薄黄": "舌苔薄而偏黄，提示体内可能有轻微的热",
  "苔黄腻": "舌苔又黄又厚腻，像一层黄油，提示体内有湿热积聚",
  "苔白腻": "舌苔白而厚腻，像铺了一层白垢，多见于体内寒湿较重",
  "苔少/无苔": "舌苔很少甚至看不到，像镜面一样光滑，提示胃气不足或阴虚",
  "舌质淡": "舌体颜色偏淡发白，不如正常红润，多见于气血不足、贫血",
  "舌质红": "舌体颜色比正常偏红，提示体内有热",
  "舌质暗": "舌体颜色偏暗紫，提示气血运行不畅",
  "舌有瘀斑": "舌面上有紫色或暗色斑点，像淤青一样，提示体内有瘀血",
  "舌胖大有齿痕": "舌体胖大、边缘有牙齿印痕，多见于脾虚、体内湿气重",
};

// 脉诊白话批注
const PULSE_ANNOTATIONS: Record<string, string> = {
  "脉浮紧": "轻按就能感到脉搏，且感觉紧张有力，常见于刚受风寒",
  "脉浮缓": "轻按就能感到脉搏，但跳动比较松缓，多见于受了风邪",
  "脉浮数": "轻按就能感到脉搏，且跳动偏快，提示体表有热",
  "脉沉细": "需要重按才能摸到脉搏，且细如线，多见于气血不足",
  "脉沉迟": "需要重按才能摸到脉搏，且跳动偏慢，提示体内有寒",
  "脉弦": "脉搏感觉绷紧如按弓弦，多见于肝气不舒、压力大或疼痛",
  "脉弦数": "脉搏既绷紧又偏快，提示肝气郁结化火",
  "脉滑数": "脉搏感觉圆滑流利且偏快，像珠子滚过，多见于痰热或食积",
  "脉濡": "脉搏软弱无力、浮而细，多见于湿气困住脾胃",
  "脉弱": "脉搏无力，轻按重按都感觉很弱，提示气血不足、身体虚弱",
  "脉沉弦": "需要重按才能摸到脉搏，且绷紧如弦，多见于肝郁气滞",
};

// ─── 补充问诊常量 ────────────────────────────────
const SI_COLD_HEAT_OPTIONS = ["恶寒", "恶风", "恶热", "手足不温", "五心烦热", "但头汗出", "半身寒热"];
const SI_SWEATING_OPTIONS = ["无汗", "自汗", "盗汗", "大汗", "汗出恶风", "头汗", "手足汗出", "半身汗出"];
const SI_BOWEL_OPTIONS = ["大便干结", "大便稀溏", "大便先干后溏", "完谷不化", "大便粘滞"];
const SI_URINE_OPTIONS = ["小便清长", "小便黄赤", "小便频数", "夜尿多", "小便不利"];
const SI_SLEEP_OPTIONS = ["入睡困难", "易醒", "早醒", "多梦", "睡眠尚可", "嗜睡多卧"];
const SI_TASTE_OPTIONS = ["口淡无味", "口苦", "口甜/口腻", "口酸", "口咸", "口中粘腻"];
const SI_COMPLEXION_OPTIONS = ["面色萎黄", "面色苍白", "面色潮红", "面色晦暗", "面色青灰", "面色正常"];
const PAIN_NATURE_OPTIONS = ["胀痛", "刺痛", "空痛", "重痛", "隐痛", "绞痛", "灼痛", "冷痛", "游走痛"];
const SPUTUM_TYPE_OPTIONS = ["白痰清稀", "白痰量多", "黄痰", "黄痰带血", "痰少粘稠难咯", "痰中带血丝", "无痰干咳"];
const DIGESTION_DETAIL_OPTIONS = ["喜热饮", "喜冷饮", "食后腹胀", "食后加重", "饥不欲食", "口渴不欲饮"];
const EMOTION_DETAIL_OPTIONS = ["叹气频作", "急躁易怒", "悲伤欲哭", "恐惧不安", "思虑过度", "心烦不宁"];

const PAIN_LOCATION_MAP: Record<string, string[]> = {
  "头痛": ["前额(阳明)", "两侧(少阳)", "后枕(太阳)", "头顶(厥阴)", "满头"],
  "腰痛": ["腰脊正中", "两侧腰肌", "腰骶部"],
  "关节痛": ["上肢关节", "下肢关节", "脊柱", "全身多关节"],
  "胸痛": ["胸骨后", "左胸(心前区)", "右胸", "两胁", "胸脘"],
  "腹痛": ["上腹(胃脘)", "脐周", "下腹", "少腹", "全腹"],
};

const SYMPTOM_QUESTION_MAP: Record<string, RegExp> = {
  pain: /头痛|腰痛|关节痛|胸痛|腹痛|胃脘痛|胁肋胀痛/,
  sputum: /咳嗽|咳痰|喘息/,
  digestion: /食欲不振|恶心|呕吐|腹胀|便秘|腹泻|便溏/,
  emotion: /情志抑郁|烦躁易怒|善太息/,
};

const SI_ANNOTATIONS: Record<string, string> = {
  "恶寒": "自觉怕冷，加衣取暖不能缓解，多提示表寒或阳虚",
  "恶风": "怕风，吹风则不适，多见于风邪袭表",
  "恶热": "怕热、喜凉，多见于热证或阴虚内热",
  "手足不温": "手脚发凉，多见于阳郁或气血不畅",
  "五心烦热": "手心、足心、心胸发热烦躁，多见于阴虚火旺",
  "无汗": "应当出汗时不出汗，多见于风寒表实",
  "自汗": "白天清醒时经常出汗，活动后更明显，多见于气虚",
  "盗汗": "入睡后出汗、醒来汗止，多见于阴虚内热",
  "大便干结": "大便干燥坚硬、排出困难，多见于肠道津亏或热结",
  "大便稀溏": "大便不成形、偏稀，多见于脾虚湿盛",
  "小便清长": "尿量多而色清，多见于阳虚或寒证",
  "小便黄赤": "尿色深黄甚至偏红，多见于湿热或热盛伤津",
  "胀痛": "痛而胀满，时轻时重，多见于气滞",
  "刺痛": "痛如针刺、固定不移，多见于瘀血",
  "隐痛": "痛势较轻、绵绵不止，多见于虚证",
  "绞痛": "痛如刀绞、剧烈，多见于结石或虫积",
  "灼痛": "痛处有灼热感，多见于热证",
  "冷痛": "痛处发凉、得温则缓，多见于寒证",
};

const COMPLIANCE_TEXT = "本系统仅作为执业医师的临床诊疗辅助工具，不构成直接的医疗诊断与治疗建议，所有诊疗行为必须由具备资质的执业医师完成。";

// AI等待时的提示文案轮播
const AI_WAITING_TIPS = {
  diagnosis: [
    "正在分析症候程度与子午归经数据...",
    "综合判断六经传变阶段...",
    "四诊合参，推导证型...",
    "生成理法方药方案...",
    "匹配经典方剂与加减化裁...",
  ],
  combined: [
    "分析多证型之间的关联...",
    "推导合方配伍方案...",
    "计算加减化裁建议...",
  ],
  followup: [
    "对比初诊与复诊数据...",
    "评估各症状改善程度...",
    "生成调整后治疗方案...",
  ],
  consultation: [
    "伤寒学派分析中...",
    "温病学派分析中...",
    "脏腑辨证分析中...",
    "经络辨证分析中...",
    "综合各流派意见...",
  ],
};

// ─── AI等待骨架组件 ──────────────────────────────────────
function AiLoadingOverlay({ title, tips }: { title: string; tips: string[] }) {
  const [tipIdx, setTipIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTipIdx(i => (i + 1) % tips.length), 3000);
    return () => clearInterval(timer);
  }, [tips.length]);
  // Simulated progress: 0 → 95% over ~30 seconds, slowing down as it approaches 95
  useEffect(() => {
    setProgress(0);
    const start = Date.now();
    const totalMs = 35000; // 35s to reach 95%
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(95, 95 * (1 - Math.exp(-elapsed / totalMs * 3)));
      setProgress(Math.round(p));
    }, 300);
    return () => clearInterval(timer);
  }, []);

  return (
    <Card className="p-8 text-center border-[#7C9A82]/20 bg-gradient-to-b from-[#F5F0E8]/30 to-white">
      <div className="relative h-16 w-16 mx-auto mb-5">
        {/* 外圈旋转 */}
        <div className="absolute inset-0 rounded-full border-4 border-[#E8F0EA] border-t-[#7C9A82] animate-spin" />
        {/* 内圈脉动 */}
        <div className="absolute inset-3 rounded-full bg-[#7C9A82]/10 animate-pulse flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-[#7C9A82]" />
        </div>
      </div>
      <p className="text-[#5B7D63] font-bold text-base mb-2">{title}</p>
      <p className="text-sm text-[#6B7B6E] transition-all duration-500 min-h-[20px]">{tips[tipIdx]}</p>
      {/* 进度条 + 百分比 */}
      <div className="mt-5 mx-auto max-w-xs">
        <div className="h-2 bg-[#E8F0EA] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#7C9A82] to-[#5B7D63] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }} />
        </div>
        <p className="text-lg font-bold text-[#5B7D63] mt-2">{progress}%</p>
      </div>
      <p className="text-[10px] text-[#A8BFAE] mt-1">AI正在深度推理，通常需要15-30秒</p>
    </Card>
  );
}

// ─── Stepper Component ────────────────────────────────────────
function StepIndicator({ current, maxReached, onStepClick }: {
  current: number; maxReached: number; onStepClick: (s: number) => void;
}) {
  return (
    <div className="flex items-center justify-between mb-6 px-2 overflow-x-auto">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const done = i < maxReached;
        const active = i === current;
        const clickable = i <= maxReached;
        return (
          <div key={i} className="flex flex-col items-center min-w-[80px]">
            <button
              disabled={!clickable}
              onClick={() => clickable && onStepClick(i)}
              className={`
                h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold transition-all border-2
                ${active ? "bg-[#7C9A82] text-white border-[#7C9A82] shadow-md" :
                  done ? "bg-[#5B7D63] text-white border-[#5B7D63] cursor-pointer hover:scale-105" :
                  clickable ? "bg-white text-[#A8BFAE] border-[#D5DDD6] cursor-pointer hover:bg-[#F0F4F1]" :
                  "bg-white text-[#A8BFAE] border-[#D5DDD6] cursor-not-allowed"}
              `}
            >
              {done && !active ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </button>
            <span className={`text-[10px] mt-1 text-center leading-tight ${active ? "text-[#5B7D63] font-bold" : done ? "text-[#7C9A82]" : clickable ? "text-[#6B7B6E]" : "text-[#A8BFAE]"}`}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}


// ─── TCM Body Map Visualization ───────────────────────────────
type BodyZone =
  | "head" | "throat" | "chest" | "rib" | "upperAbdomen" | "lowerAbdomen"
  | "kidney" | "back" | "limbs" | "handsFeet" | "skin" | "spirit"
  | "shoulder" | "elbow" | "wrist" | "knee" | "ankle" | "mouthTongue";

interface BodyMarker {
  zone: BodyZone;
  label: string;
  color: string;
  intensity: number;
  note: string;
}

interface BodyMeridianLine {
  label: string;
  color: string;
  path: string;
  note: string;
}

const BODY_ZONE_META: Record<BodyZone, { x: number; y: number; label: string }> = {
  // 坐标按用户提供的 1024×1536 正面中医人形图实测校准：左上角为 0%，右下角为 100%。
  // 注意：图像为正面人形，画面左侧对应患者右侧，画面右侧对应患者左侧。
  head: { x: 50, y: 9.5, label: "头面清窍" },
  throat: { x: 50, y: 17.5, label: "咽喉" },
  mouthTongue: { x: 50, y: 13.8, label: "口舌舌诊" },
  chest: { x: 50, y: 28.5, label: "心肺胸膈" },
  rib: { x: 62, y: 34, label: "肝胆胁肋" },
  upperAbdomen: { x: 50, y: 36, label: "脾胃中焦" },
  lowerAbdomen: { x: 50, y: 50.5, label: "下焦" },
  kidney: { x: 40.5, y: 48.5, label: "腰肾命门" },
  back: { x: 50, y: 21.5, label: "太阳背俞" },
  limbs: { x: 32.5, y: 41, label: "四肢经络" },
  handsFeet: { x: 79, y: 50.5, label: "手足末端" },
  skin: { x: 50, y: 23.5, label: "肌表卫分" },
  spirit: { x: 50, y: 9, label: "神志睡眠" },
  shoulder: { x: 36.5, y: 21.5, label: "肩项" },
  elbow: { x: 32.5, y: 41, label: "肘关节" },
  wrist: { x: 24, y: 49, label: "腕掌" },
  knee: { x: 43, y: 67, label: "膝关节" },
  ankle: { x: 44, y: 86.5, label: "踝足" },
};

function severityToIntensity(severity: string | null): number {
  const map: Record<string, number> = { occasional: 1, sometimes: 2, often: 3, frequent: 4, always: 5 };
  return severity ? (map[severity] || 2) : 2;
}

const SYMPTOM_BODY_ZONE_OVERRIDES: Record<string, { zone: BodyZone; note: string; color: string }> = {
  // 现有症状字典逐项校准：优先按中医病位/脏腑经络含义定位，避免纯关键词误落到肩部或默认肌表。
  头痛: { zone: "head", note: "头痛定位头面清窍；中医常结合太阳、少阳、阳明及肝阳上扰等判断。", color: "#E35D4F" },
  头晕: { zone: "head", note: "头晕属于清窍失养或痰浊、肝风上扰等头面表现，标于头部。", color: "#E35D4F" },
  目赤: { zone: "head", note: "目赤属目窍异常，多与肝胆火热、风热上扰有关，标于头面眼目。", color: "#E35D4F" },
  目眩: { zone: "head", note: "目眩属头目清窍症状，常从肝肾、痰浊或气血不足辨析。", color: "#E35D4F" },
  耳鸣: { zone: "head", note: "耳鸣表现于耳窍，病机可涉肾精不足或肝胆上扰，因此标于头面耳窍。", color: "#E35D4F" },
  鼻塞: { zone: "head", note: "鼻塞为鼻窍不利，常与肺卫外感有关，标于头面鼻窍。", color: "#E35D4F" },
  口苦: { zone: "rib", note: "口苦虽表现于口，但中医常提示少阳胆腑或肝胆郁热，故标于肝胆胁肋区。", color: "#C6932F" },
  口渴: { zone: "mouthTongue", note: "口渴为口津异常，常提示津液受伤或里热，标于口舌区域。", color: "#E0A83A" },
  口干: { zone: "mouthTongue", note: "口干属口津不足或热伤津液表现，标于口舌区域，避免误作肩项。", color: "#E0A83A" },
  咽痛: { zone: "throat", note: "咽痛定位咽喉，多与肺胃热、风热或阴虚火旺相关。", color: "#D96B3A" },
  面色萎黄: { zone: "head", note: "面色萎黄是面部望诊信息，常提示脾虚气血不足，标于头面面色。", color: "#E0A83A" },
  面色苍白: { zone: "head", note: "面色苍白是面部望诊信息，常提示气血阳气不足，标于头面面色。", color: "#6E9BD6" },
  面色潮红: { zone: "head", note: "面色潮红表现于面部，可见虚热或阳热上扰，标于头面面色。", color: "#E35D4F" },
  心悸: { zone: "chest", note: "心悸病位核心在心胸，需结合心神、气血、痰饮或心肾辨证。", color: "#D94B5F" },
  胸闷: { zone: "chest", note: "胸闷定位胸膈，常涉及肺气宣降、宗气及肝气郁滞。", color: "#D94B5F" },
  气短: { zone: "chest", note: "气短多与肺脾肾气化和胸中宗气有关，先标于心肺胸膈。", color: "#D94B5F" },
  胸痛: { zone: "chest", note: "胸痛定位胸膈心肺区域，需辨气滞、血瘀、痰阻或寒凝。", color: "#D94B5F" },
  胃脘痛: { zone: "upperAbdomen", note: "胃脘位于上腹中焦，胃脘痛标于脾胃中焦。", color: "#E0A83A" },
  腹胀: { zone: "upperAbdomen", note: "腹胀多属中焦脾胃运化、气机升降失常，标于脾胃中焦。", color: "#E0A83A" },
  腹痛: { zone: "upperAbdomen", note: "腹痛按中焦脾胃/肠腑先定位腹部，后续再结合寒热虚实细分。", color: "#E0A83A" },
  胁肋胀痛: { zone: "rib", note: "胁肋为肝胆经循行重点，胁肋胀痛直接标于肝胆胁肋区。", color: "#C6932F" },
  恶心: { zone: "upperAbdomen", note: "恶心与胃失和降相关，标于脾胃中焦。", color: "#E0A83A" },
  呕吐: { zone: "upperAbdomen", note: "呕吐多为胃气上逆，标于脾胃中焦。", color: "#E0A83A" },
  食欲不振: { zone: "upperAbdomen", note: "食欲不振属受纳运化异常，核心在脾胃中焦。", color: "#E0A83A" },
  便秘: { zone: "upperAbdomen", note: "便秘属肠腑传导失常，标于腹部中下焦通路。", color: "#E0A83A" },
  腹泻: { zone: "upperAbdomen", note: "腹泻常见脾胃运化失司、湿困中焦，标于脾胃肠腑区域。", color: "#8CA65A" },
  便溏: { zone: "upperAbdomen", note: "便溏多提示脾虚湿困，标于脾胃中焦。", color: "#8CA65A" },
  尿频: { zone: "lowerAbdomen", note: "尿频属水道气化异常，定位下焦膀胱与肾。", color: "#6E9BD6" },
  尿急: { zone: "lowerAbdomen", note: "尿急定位下焦膀胱水道，需辨湿热、气化不利等。", color: "#6E9BD6" },
  尿黄: { zone: "lowerAbdomen", note: "尿黄为小便色泽异常，常提示下焦湿热或津液不足，标于下焦。", color: "#6E9BD6" },
  失眠: { zone: "spirit", note: "失眠归于心神不宁，也可涉肝血、阴虚火旺，标于神志睡眠区。", color: "#B75BA6" },
  多梦: { zone: "spirit", note: "多梦属神志睡眠异常，常与心肝血、痰热扰神相关。", color: "#B75BA6" },
  嗜睡: { zone: "spirit", note: "嗜睡属于神志清阳不振或痰湿困阻表现，标于神志区。", color: "#B75BA6" },
  乏力: { zone: "limbs", note: "乏力虽为全身症状，体感多见四肢倦怠，常从脾气、气血不足辨析。", color: "#7E74B8" },
  自汗: { zone: "skin", note: "自汗为腠理卫表不固、汗液外泄，标于肌表卫分。", color: "#7C9A82" },
  盗汗: { zone: "kidney", note: "盗汗常提示阴虚内热、营阴不固，标于腰肾命门以体现阴液根本。", color: "#5A83C7" },
  畏寒: { zone: "kidney", note: "畏寒多见阳气不足或寒邪内盛，标于腰肾命门以体现阳气温煦。", color: "#5A83C7" },
  发热: { zone: "skin", note: "发热可见外感卫表或里热，第一层图谱标于肌表卫分，后续结合证型细分。", color: "#E35D4F" },
  五心烦热: { zone: "handsFeet", note: "五心烦热指两手心、两足心及心胸烦热，常见阴虚内热，标于手足末端。", color: "#B75BA6" },
  口燥咽干: { zone: "throat", note: "口燥咽干表现于口咽津液不足，常见阴虚或热伤津液，标于咽喉口舌通路。", color: "#D96B3A" },
  腰痛: { zone: "kidney", note: "腰为肾之府，腰痛优先标于腰肾命门区域。", color: "#5A83C7" },
  关节痛: { zone: "limbs", note: "关节痛属于筋骨关节痹痛，未指定部位时标于四肢经络。", color: "#7E74B8" },
  肢体麻木: { zone: "limbs", note: "肢体麻木多与经络气血运行不畅有关，标于四肢经络。", color: "#7E74B8" },
  下肢浮肿: { zone: "lowerAbdomen", note: "下肢浮肿虽见于腿部，但中医常责之脾肾气化、水湿停聚，标于下焦水道。", color: "#6E9BD6" },
  手足逆冷: { zone: "handsFeet", note: "手足逆冷为四末失温，直接标于手足末端。", color: "#6E9BD6" },
  咳嗽: { zone: "chest", note: "咳嗽病位核心在肺，标于心肺胸膈。", color: "#D94B5F" },
  咳痰: { zone: "chest", note: "咳痰与肺失宣降、痰湿阻肺相关，标于心肺胸膈。", color: "#D94B5F" },
  喘息: { zone: "chest", note: "喘息为肺气上逆或肾不纳气等呼吸异常，标于心肺胸膈。", color: "#D94B5F" },
  鼻流清涕: { zone: "head", note: "鼻流清涕表现于鼻窍，多属肺卫受寒，标于头面鼻窍。", color: "#6E9BD6" },
  情志抑郁: { zone: "rib", note: "情志抑郁多与肝失疏泄、气机郁滞有关，标于肝胆胁肋。", color: "#C6932F" },
  烦躁易怒: { zone: "rib", note: "烦躁易怒常见肝郁化火或肝胆火旺，标于肝胆胁肋而非四肢肩项。", color: "#C6932F" },
  善太息: { zone: "rib", note: "善太息是频频叹息，多提示肝气郁结、胸胁气机不舒，标于肝胆胁肋区。", color: "#C6932F" },
};

function getSymptomBodyZone(name: string): { zone: BodyZone; note: string; color: string } {
  const exact = SYMPTOM_BODY_ZONE_OVERRIDES[name];
  if (exact) return exact;

  if (/肩|肩痛|肩周|肩背/.test(name)) {
    return { zone: "shoulder", note: "肩项位于图像双肩区域，常与太阳、少阳经循行及风寒湿痹相关。", color: "#7C9A82" };
  }
  if (/肘|肘痛/.test(name)) {
    return { zone: "elbow", note: "肘部标注在上肢屈伸枢纽，提示经络痹阻或局部筋脉不利。", color: "#7E74B8" };
  }
  if (/腕|手腕|腕痛/.test(name)) {
    return { zone: "wrist", note: "腕掌区域对应手部经络末端，便于定位麻木、疼痛或寒凉。", color: "#7E74B8" };
  }
  if (/膝|膝痛|膝酸|膝软/.test(name)) {
    return { zone: "knee", note: "膝部标注在下肢关节区域，腰膝酸软需同时结合肾气与筋骨判断。", color: "#5A83C7" };
  }
  if (/踝|足跟|脚踝|足痛/.test(name)) {
    return { zone: "ankle", note: "踝足位于下肢末端，常用于寒湿痹阻、肾经循行或气血运行不足的提示。", color: "#6E9BD6" };
  }
  if (/头痛|头晕|眩晕|目赤|目眩|眼|耳鸣|面色|鼻塞|流涕/.test(name)) {
    return { zone: "head", note: "头面清窍受扰，常与少阳、阳明、肝胆或肺卫外感有关。", color: "#E35D4F" };
  }
  if (/口渴|口干|口燥|舌/.test(name)) {
    return { zone: "mouthTongue", note: "口舌津液或舌象异常，标于口舌采集点。", color: "#E0A83A" };
  }
  if (/咽痛|咽干|咽喉|声音|吞咽/.test(name)) {
    return { zone: "throat", note: "咽喉为肺胃之门户，多提示风热、肺胃热或津液不足。", color: "#D96B3A" };
  }
  if (/咳|喘|气短|胸闷|胸痛|心悸|心慌|心烦/.test(name)) {
    return { zone: "chest", note: "心肺胸膈区域反应气机宣降、心神与宗气状态。", color: "#D94B5F" };
  }
  if (/胁|肋|口苦|情志|烦躁|易怒|太息|乳房|少腹胀/.test(name)) {
    return { zone: "rib", note: "胁肋属肝胆经循行重点，常见少阳枢机或肝气郁滞。", color: "#C6932F" };
  }
  if (/胃|腹胀|腹满|腹痛|纳差|食欲|恶心|呕吐|嗳气|反酸|便溏|腹泻|泄泻|便秘/.test(name)) {
    return { zone: "upperAbdomen", note: "中焦脾胃主受纳运化，腹胀纳差便溏多从脾胃湿滞考虑。", color: "#E0A83A" };
  }
  if (/尿|小便|带下|月经|痛经|少腹|下腹|遗精|浮肿/.test(name)) {
    return { zone: "lowerAbdomen", note: "下焦主水道与冲任，需关注肾、膀胱及肝经气化。", color: "#6E9BD6" };
  }
  if (/腰|膝|畏寒|怕冷|夜尿|盗汗|潮热/.test(name)) {
    return { zone: "kidney", note: "腰为肾之府，畏寒夜尿或腰膝酸软多提示肾气/肾阳相关。", color: "#5A83C7" };
  }
  if (/项强|颈|背痛|身痛|骨节|恶寒|发热|无汗|汗出|自汗/.test(name)) {
    return { zone: "skin", note: "太阳经主一身之表，外感、发热汗出类表现先映射到肌表卫分。", color: "#7C9A82" };
  }
  if (/四肢|乏力|倦怠|麻木|酸痛|抽筋|关节/.test(name)) {
    return { zone: "limbs", note: "四肢或关节症状先定位到经络筋骨通路，再结合寒热虚实细分。", color: "#7E74B8" };
  }
  if (/手足|手脚|冰凉|发冷|五心/.test(name)) {
    return { zone: "handsFeet", note: "手足末端反映气血运行和阳气温煦状态，冰凉、烦热或麻木需结合寒热虚实。", color: "#7E74B8" };
  }
  if (/失眠|多梦|嗜睡|健忘|焦虑|惊悸|神疲/.test(name)) {
    return { zone: "spirit", note: "睡眠神志归心神与肝魂，失眠多梦需结合心肝血、阴阳判断。", color: "#B75BA6" };
  }
  return { zone: "skin", note: "暂归入肌表/全身反应，系统会结合后续舌脉与归经再判断。", color: "#7C9A82" };
}

function getStageMarker(stage: string): BodyMarker | null {
  if (/太阳/.test(stage)) return { zone: "back", label: "太阳", color: "#5B7D63", intensity: 4, note: "太阳主表，重点观察头项、背部与恶寒发热。" };
  if (/阳明/.test(stage)) return { zone: "upperAbdomen", label: "阳明", color: "#E0A83A", intensity: 4, note: "阳明多见里热或胃肠实滞，面口与胃肠同看。" };
  if (/少阳/.test(stage)) return { zone: "rib", label: "少阳", color: "#C6932F", intensity: 4, note: "少阳居半表半里，胁肋、口苦、寒热往来为关键。" };
  if (/太阴/.test(stage)) return { zone: "upperAbdomen", label: "太阴", color: "#8CA65A", intensity: 4, note: "太阴属脾虚湿困，腹满、便溏、纳差更有指向。" };
  if (/少阴/.test(stage)) return { zone: "kidney", label: "少阴", color: "#5A83C7", intensity: 4, note: "少阴关联心肾虚损，关注精神、畏寒、手足冷。" };
  if (/厥阴/.test(stage)) return { zone: "lowerAbdomen", label: "厥阴", color: "#9B6AB8", intensity: 4, note: "厥阴常见寒热错杂，上热下寒需上下同察。" };
  return null;
}

function buildBodyMarkers(args: {
  currentStep: number;
  assessments: AssessmentItem[];
  tongue: string[];
  pulse: string[];
  envFactors: string[];
  durations: DurationItem[];
  diagnosis: DiagnosisResult | null;
}): BodyMarker[] {
  const markers: BodyMarker[] = [];
  args.assessments.filter(a => !a.skipAssessment).slice(0, 8).forEach((a) => {
    const mapped = getSymptomBodyZone(a.symptomName);
    markers.push({ zone: mapped.zone, label: a.symptomName, color: mapped.color, intensity: severityToIntensity(a.severity), note: mapped.note });
  });

  args.durations.forEach((d) => {
    if (!d.liuJingStage) return;
    const marker = getStageMarker(d.liuJingStage);
    if (marker) markers.push(marker);
  });

  args.tongue.forEach((t) => {
    // 舌诊属于“口舌采集点”，不能把舌苔/舌质本身直接标到腹部；
    // 脾胃、湿热、阴虚等证候影响会在AI辨证和经络/证型层展示。
    if (/黄|红/.test(t)) markers.push({ zone: "mouthTongue", label: t, color: "#E0A83A", intensity: 3, note: "舌红、苔黄提示热象或津液受扰；标记固定在口舌区域，证候归属需结合脾胃、肝胆等综合判断。" });
    if (/白腻|胖大|齿痕|淡|少|无苔|暗|瘀/.test(t)) markers.push({ zone: "mouthTongue", label: t, color: "#8CA65A", intensity: 3, note: "舌淡、胖大齿痕、白腻、少苔或瘀斑均为舌诊证据；图谱标于口舌，避免误认为腹部定位。" });
  });

  args.pulse.forEach((p) => {
    if (/浮/.test(p)) markers.push({ zone: "skin", label: p, color: "#7C9A82", intensity: 3, note: "浮脉偏表，常与外感、太阳肌表相关。" });
    if (/弦/.test(p)) markers.push({ zone: "rib", label: p, color: "#C6932F", intensity: 3, note: "弦脉多见肝胆、气机不舒或痛证。" });
    if (/沉|细|弱/.test(p)) markers.push({ zone: "kidney", label: p, color: "#5A83C7", intensity: 3, note: "沉细弱提示里虚、气血不足或肾气不足方向。" });
    if (/滑|数/.test(p)) markers.push({ zone: "upperAbdomen", label: p, color: "#E0A83A", intensity: 3, note: "滑数常见痰热、湿热或食积化热。" });
  });

  args.envFactors.forEach((e) => {
    if (/受凉|季节变化/.test(e)) markers.push({ zone: "skin", label: e, color: "#6E9BD6", intensity: 2, note: "外寒先犯肌表，需观察恶寒、项背、鼻咽等表现。" });
    if (/受湿|饮食不节/.test(e)) markers.push({ zone: "upperAbdomen", label: e, color: "#8CA65A", intensity: 2, note: "湿邪与饮食常困脾胃，表现为困重、纳差、便溏。" });
    if (/情志/.test(e)) markers.push({ zone: "rib", label: e, color: "#C6932F", intensity: 2, note: "情志刺激多牵动肝胆气机，胁肋与胸闷需关注。" });
  });

  if (args.currentStep >= 3 && args.diagnosis?.primarySyndrome) {
    markers.push({ zone: "chest", label: args.diagnosis.primarySyndrome, color: "#B75BA6", intensity: 4, note: "AI主证型已生成，人形图继续汇总前序证据区域。" });
  }

  return markers.slice(0, 14);
}

function buildMeridianLines(meridians: MeridianItem[]): BodyMeridianLine[] {
  const colorMap: Record<string, string> = {
    胆经: "#C6932F", 肝经: "#9AA84F", 肺经: "#7C9A82", 大肠经: "#A8A05A",
    胃经: "#E0A83A", 脾经: "#8CA65A", 心经: "#D94B5F", 小肠经: "#D96B3A",
    膀胱经: "#5A83C7", 肾经: "#4F7FB0", 心包经: "#B75BA6", 三焦经: "#7E74B8",
  };
  const pathMap: Record<string, string> = {
    // 按正面全身图校准：路径只做轻量高亮，避免遮挡原图已有经络。
    胆经: "M57 10 C65 20,66 32,62 43 C60 55,58 70,57 88",
    肝经: "M55 90 C53 73,51 58,50 49 C51 41,56 35,62 32",
    肺经: "M50 20 C43 23,38 31,34 40 C31 45,27 49,21 50",
    大肠经: "M21 51 C28 46,34 37,39 28 C43 20,47 13,50 9",
    胃经: "M50 9 C54 25,53 38,50 48 C48 62,45 76,43 91",
    脾经: "M43 91 C42 73,45 58,50 48 C51 42,51 38,50 35",
    心经: "M50 29 C43 31,37 38,32 44 C28 49,24 51,21 50",
    小肠经: "M21 50 C28 45,34 35,42 24 C46 18,49 13,50 9",
    膀胱经: "M50 5 C49 22,47 42,44 58 C42 70,42 82,43 90",
    肾经: "M57 90 C55 72,52 57,50 49 C49 42,48 35,50 29",
    心包经: "M50 29 C57 33,64 42,72 48 C75 50,78 51,79 50",
    三焦经: "M79 50 C72 44,66 34,60 22 C56 15,52 10,50 7",
  };
  const seen = new Set<string>();
  return meridians
    .filter(m => !!m.attackMeridian && !seen.has(m.attackMeridian!) && seen.add(m.attackMeridian!))
    .slice(0, 4)
    .map(m => ({
      label: `${m.symptomName} → ${m.attackMeridian}`,
      color: colorMap[m.attackMeridian!] || "#7C9A82",
      path: pathMap[m.attackMeridian!] || "M50 14 C50 35,50 58,50 84",
      note: m.attackTime ? `已按发作时辰归入${m.attackMeridian}` : `关联${m.attackMeridian}`,
    }));
}

function TcmBodyMap({
  currentStep,
  assessments,
  meridians,
  tongue,
  pulse,
  envFactors,
  durations,
  diagnosis,
  loadingStep,
}: {
  currentStep: number;
  assessments: AssessmentItem[];
  meridians: MeridianItem[];
  tongue: string[];
  pulse: string[];
  envFactors: string[];
  durations: DurationItem[];
  diagnosis: DiagnosisResult | null;
  loadingStep: number | null;
}) {
  const markers = buildBodyMarkers({ currentStep, assessments, tongue, pulse, envFactors, durations, diagnosis });
  const lines = buildMeridianLines(meridians);
  const featured = markers[0];
  const scanning = loadingStep !== null || currentStep >= 3;
  const stepTip = [
    "选择症状后，红点会映射到头面、胸膈、脾胃、肝胆、腰肾等区域。",
    "选择发作时辰后，会显示对应经络线，并结合舌脉判断寒热虚实。",
    "六经传变会把主症归入太阳、阳明、少阳、太阴、少阴、厥阴区域。",
    "AI辨证时，经络图会汇总前面所有证据，形成主证可视化线索。",
    "合病合方会保留多区域提示，帮助理解为什么可能需要方药组合。",
    "疗效评估时，可对照原本高亮区域观察症状改善方向。",
    "多专家会诊会把各流派关注点集中到人形图上，方便演示说明。",
  ][currentStep] || "中医人形图会跟随当前步骤动态更新。";

  return (
    <Card className="overflow-hidden border-[#DDEAD8] bg-[radial-gradient(circle_at_50%_8%,rgba(255,255,255,0.95),rgba(238,247,234,0.88)_42%,rgba(245,240,232,0.78))] p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6A946B]">TCM Body Map</div>
          <h4 className="mt-1 text-sm font-bold text-[#20372B]">中医人形交互图谱</h4>
        </div>
        <Badge className="bg-white/80 text-[#5B7D63] border border-[#DDEAD8]">步骤 {currentStep + 1}</Badge>
      </div>

      <div className="relative mx-auto w-full max-w-[250px] overflow-hidden rounded-[1.5rem] bg-[#10261F] shadow-[0_18px_45px_rgba(28,58,43,0.22)] ring-1 ring-white/80" style={{ aspectRatio: "2 / 3" }}>
        <img
          src="/images/wizard/tcm-body-map.png"
          alt="中医人形经络交互图谱"
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.05),transparent_36%),linear-gradient(180deg,rgba(238,247,234,0.06),rgba(10,33,24,0.08))]" />
        {scanning && <div className="absolute left-[26%] right-[26%] top-[5%] h-[28%] rounded-full bg-[#9FE3A4]/18 blur-xl animate-pulse" />}
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full">
          <defs>
            <filter id="softGlow"><feGaussianBlur stdDeviation="1.1" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          {lines.map((line, index) => (
            <path key={`${line.label}-${index}`} d={line.path} fill="none" stroke={line.color} strokeWidth="1.05" strokeLinecap="round" strokeDasharray="2.8 2.2" opacity="0.82" filter="url(#softGlow)" />
          ))}
        </svg>
        {markers.map((marker, index) => {
          const meta = BODY_ZONE_META[marker.zone];
          const size = 10 + marker.intensity * 3;
          return (
            <div
              key={`${marker.label}-${marker.zone}-${index}`}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${meta.x}%`, top: `${meta.y}%` }}
              title={`${marker.label}：${marker.note}`}
            >
              <span className="absolute rounded-full opacity-30 animate-ping" style={{ width: size + 10, height: size + 10, backgroundColor: marker.color, left: -5, top: -5 }} />
              <span className="relative grid place-items-center rounded-full border-2 border-white text-[9px] font-bold text-white shadow-lg" style={{ width: size, height: size, backgroundColor: marker.color }}>
                {index + 1}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 rounded-2xl bg-white/70 p-3 text-xs leading-5 text-[#5E725F] ring-1 ring-white/80">
        <b className="text-[#315038]">当前提示：</b>{featured ? `${featured.label} → ${BODY_ZONE_META[featured.zone].label}。${featured.note}` : stepTip}
      </div>

      {(tongue.length > 0 || pulse.length > 0 || lines.length > 0) && (
        <div className="mt-2 grid gap-2 text-[10px] text-[#5E725F]">
          {lines.length > 0 && <div className="rounded-xl bg-[#EEF7EA]/80 px-2 py-1.5"><b>经络：</b>{lines.map(l => l.label).join("、")}</div>}
          {tongue.length > 0 && <div className="rounded-xl bg-[#FFF9E8]/90 px-2 py-1.5"><b>舌象：</b>{tongue.slice(0, 4).join("、")}</div>}
          {pulse.length > 0 && <div className="rounded-xl bg-[#F5F0E8]/90 px-2 py-1.5"><b>脉象：</b>{pulse.slice(0, 4).join("、")}</div>}
        </div>
      )}
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function WizardDiagnosis() {
  const { isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeSessionId = searchParams.get("resume");

  const [currentStep, setCurrentStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [symptoms, setSymptoms] = useState<SymptomDict[]>([]);
  const [symptomSearch, setSymptomSearch] = useState("");

  // Step data
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [bodyType, setBodyType] = useState<string | null>(null);
  const [envFactors, setEnvFactors] = useState<string[]>([]);
  const [tongue, setTongue] = useState<string[]>([]);
  const [pulse, setPulse] = useState<string[]>([]);
  const [meridians, setMeridians] = useState<MeridianItem[]>([]);
  // Supplementary inquiry state
  const [siColdHeat, setSiColdHeat] = useState<string[]>([]);
  const [siSweating, setSiSweating] = useState<string[]>([]);
  const [siBowel, setSiBowel] = useState<string[]>([]);
  const [siUrine, setSiUrine] = useState<string[]>([]);
  const [siSleep, setSiSleep] = useState<string[]>([]);
  const [siTaste, setSiTaste] = useState<string[]>([]);
  const [siComplexion, setSiComplexion] = useState<string[]>([]);
  const [siSymptomDetails, setSiSymptomDetails] = useState<Record<number, {
    painLocation?: string; painNature?: string;
    sputumType?: string; digestionDetail?: string; emotionDetail?: string;
  }>>({});
  const [durations, setDurations] = useState<DurationItem[]>([]);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [appliedCombined, setAppliedCombined] = useState(false);
  const [step5Result, setStep5Result] = useState<Step5Result | null>(null);
  const [overallEval, setOverallEval] = useState<string | null>(null);
  const [symptomEvals, setSymptomEvals] = useState<Record<number, string>>({});
  const [feedbackText, setFeedbackText] = useState("");
  const [step6Result, setStep6Result] = useState<Step6Result | null>(null);
  const [consultRawText, setConsultRawText] = useState<string | null>(null);
  const [finalPlan, setFinalPlan] = useState<string | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);

  const chartRefs = useRef<Record<string, echarts.ECharts | null>>({});

  // Load symptom dict
  useEffect(() => {
    if (isAuthenticated) {
      apiFetch("/wizard-diagnosis/symptoms").then(d => {
        const data = d.data || d;
        setSymptoms(Array.isArray(data) ? data : []);
      }).catch(console.error);
    }
  }, [isAuthenticated]);

  // Cleanup charts
  useEffect(() => {
    return () => { Object.values(chartRefs.current).forEach(c => c?.dispose()); };
  }, []);

  // Note: step 5 (疗效评估) no longer auto-advances to step 6.
  // User stays on the efficacy evaluation results page and clicks "下一步" manually.

  // Restore session data from backend
  const restoreSessionData = async (sid: number, currentBackendStep: number) => {
    try {
      // Step 1 data: symptom assessments
      if (currentBackendStep >= 2) {
        const step1Res = await apiFetch(`/wizard-diagnosis/sessions/${sid}/step1-data`);
        const step1Data = step1Res.data || step1Res;
        if (Array.isArray(step1Data)) {
          setAssessments(step1Data.map((a: any) => ({
            symptomId: a.symptomId,
            symptomName: a.symptomName,
            severity: a.severity,
            skipAssessment: a.skipAssessment || false,
          })));
        }
      }
      // Step 2 data: meridians, body type, environment, tongue, pulse
      if (currentBackendStep >= 3) {
        const step2Res = await apiFetch(`/wizard-diagnosis/sessions/${sid}/step2-data`);
        const step2Data = step2Res.data || step2Res;
        if (step2Data) {
          if (Array.isArray(step2Data.meridians)) {
            setMeridians(step2Data.meridians.map((m: any) => ({
              assessmentId: m.assessmentId,
              symptomName: m.symptomName,
              attackTime: m.attackTime,
              attackMeridian: m.attackMeridian,
            })));
          }
          setBodyType(step2Data.bodyType || null);
          if (step2Data.environmentFactors) {
            setEnvFactors(step2Data.environmentFactors.split(",").filter(Boolean));
          }
          const tongueArr: string[] = [];
          if (step2Data.tongueCoating) tongueArr.push(...step2Data.tongueCoating.split(",").filter(Boolean));
          if (step2Data.tongueBody) tongueArr.push(...step2Data.tongueBody.split(",").filter(Boolean));
          setTongue(tongueArr);
          if (step2Data.pulseType) {
            setPulse(step2Data.pulseType.split(",").filter(Boolean));
          }
          // Restore supplementary inquiry data
          if (step2Data.supplementaryInquiry) {
            const si = step2Data.supplementaryInquiry;
            if (si.coldHeat) setSiColdHeat(si.coldHeat.split(",").filter(Boolean));
            if (si.sweating) setSiSweating(si.sweating.split(",").filter(Boolean));
            if (si.bowel) setSiBowel(si.bowel.split(",").filter(Boolean));
            if (si.urine) setSiUrine(si.urine.split(",").filter(Boolean));
            if (si.sleep) setSiSleep(si.sleep.split(",").filter(Boolean));
            if (si.taste) setSiTaste(si.taste.split(",").filter(Boolean));
            if (si.complexion) setSiComplexion(si.complexion.split(",").filter(Boolean));
            if (si.symptomDetails && Array.isArray(si.symptomDetails)) {
              const detailsMap: Record<number, any> = {};
              si.symptomDetails.forEach((d: any) => {
                const idx = (step1Data as any[]).findIndex((a: any) => a.symptomName === d.symptomName);
                if (idx >= 0) detailsMap[idx] = d;
              });
              setSiSymptomDetails(detailsMap);
            }
          }
        }
      }
      // Step 3 data: durations
      if (currentBackendStep >= 4) {
        const step3Res = await apiFetch(`/wizard-diagnosis/sessions/${sid}/step3-data`);
        const step3Data = step3Res.data || step3Res;
        if (Array.isArray(step3Data)) {
          setDurations(step3Data.map((d: any) => ({
            assessmentId: d.assessmentId,
            symptomName: d.symptomName,
            durationDays: d.durationDays,
            durationHours: d.durationHours,
            liuJingStage: d.liuJingStage,
          })));
        }
      }
      // Step 4: AI diagnosis result
      if (currentBackendStep >= 5) {
        try {
          const diagRes = await apiFetch(`/wizard-diagnosis/sessions/${sid}/diagnosis`);
          const diagData = diagRes.data || diagRes;
          if (diagData) setDiagnosis(diagData);
        } catch { /* diagnosis might not exist yet */ }
      }
    } catch (e) {
      console.error("Error restoring session data:", e);
    }
  };

  // Create or resume session on mount
  const initSession = useCallback(async () => {
    if (sessionId) return;

    // Resume existing session
    if (resumeSessionId) {
      const parsedId = Number(resumeSessionId);
      if (!isNaN(parsedId)) {
        try {
          const sessionRes = await apiFetch(`/wizard-diagnosis/sessions/${parsedId}`);
          const sessionData = sessionRes.data || sessionRes;
          if (sessionData.status !== "active") {
            setError("该会话已完成，无法继续");
            return;
          }
          setSessionId(parsedId);
          const step = Math.max(0, (sessionData.currentStep || 1) - 1);
          setCurrentStep(step);
          setMaxReached(step);
          await restoreSessionData(parsedId, sessionData.currentStep || 1);
          // Clean URL to avoid re-resuming on refresh
          navigate("/wizard-diagnosis", { replace: true });
          return;
        } catch (e) {
          console.error("Failed to resume session:", e);
          setError("恢复会话失败，将创建新会话");
        }
      }
    }

    // Create new session
    try {
      const res = await apiFetch("/wizard-diagnosis/sessions", {
        method: "POST",
        body: JSON.stringify({ patientName: "" }),
      });
      const data = res.data || res;
      setSessionId(data.id);
    } catch (e) {
      console.error("Failed to create session:", e);
      setError("创建诊疗会话失败");
    }
  }, [sessionId, resumeSessionId]);

  useEffect(() => {
    if (isAuthenticated && !sessionId) initSession();
  }, [isAuthenticated, sessionId, initSession]);

  // Step navigation
  const goToStep = (step: number) => {
    if (step <= maxReached) setCurrentStep(step);
  };

  const clearLoading = () => { setLoading(false); setLoadingStep(null); };

  const goNext = () => {
    if (currentStep < 6) {
      const next = currentStep + 1;
      setCurrentStep(next);
      if (next > maxReached) setMaxReached(next);
    }
  };

  const goPrev = () => { if (currentStep > 0) setCurrentStep(currentStep - 1); };

  // ─── Step 1: Add/remove symptoms ───
  const addSymptom = (s: SymptomDict) => {
    if (assessments.find(a => a.symptomId === s.id)) return;
    setAssessments(prev => [...prev, {
      symptomId: s.id, symptomName: s.name,
      severity: null, skipAssessment: !s.isAssessable,
    }]);
    setSymptomSearch("");
  };

  const removeSymptom = (id: number) => {
    setAssessments(prev => prev.filter(a => a.symptomId !== id));
  };

  const updateSeverity = (symptomId: number, severity: string) => {
    setAssessments(prev => prev.map(a => a.symptomId === symptomId ? { ...a, severity } : a));
  };

  const toggleSkip = (symptomId: number) => {
    setAssessments(prev => prev.map(a => a.symptomId === symptomId ? { ...a, skipAssessment: !a.skipAssessment, severity: a.skipAssessment ? null : a.severity } : a));
  };

  const saveStep1 = async () => {
    const assessed = assessments.filter(a => a.severity || a.skipAssessment);
    if (assessed.length === 0) { setError("请至少选择并评估1个症状"); return false; }
    setLoading(true); setError(null);
    try {
      await apiFetch(`/wizard-diagnosis/sessions/${sessionId}/step1`, {
        method: "POST",
        body: JSON.stringify({ sessionId, symptoms: assessed.map(a => ({
          symptomId: a.symptomId, symptomName: a.symptomName,
          severity: a.skipAssessment ? null : a.severity,
          skipAssessment: a.skipAssessment,
        })) }),
      });
      // Init meridians & durations for step 2 & 3
      setMeridians(assessed.map((a, i) => ({
        assessmentId: i, symptomName: a.symptomName,
        attackTime: null, attackMeridian: null,
      })));
      setDurations(assessed.map((a, i) => ({
        assessmentId: i, symptomName: a.symptomName,
        durationDays: null, durationHours: null, liuJingStage: null,
      })));
      return true;
    } catch (e) { setError("保存失败"); return false; }
    finally { clearLoading(); }
  };

  // ─── Step 2: Save ───
  const saveStep2 = async () => {
    if (!tongue.length || !pulse.length) { setError("请填写舌诊和脉诊信息"); return false; }
    setLoading(true); setError(null);
    try {
      const supplementaryInquiry = {
        coldHeat: siColdHeat.join(","),
        sweating: siSweating.join(","),
        bowel: siBowel.join(","),
        urine: siUrine.join(","),
        sleep: siSleep.join(","),
        taste: siTaste.join(","),
        complexion: siComplexion.join(","),
        symptomDetails: Object.entries(siSymptomDetails)
          .filter(([, v]) => Object.values(v).some(x => x))
          .map(([idx, detail]) => ({
            assessmentId: meridians[Number(idx)]?.assessmentId,
            symptomName: meridians[Number(idx)]?.symptomName,
            ...detail,
          })),
      };
      await apiFetch(`/wizard-diagnosis/sessions/${sessionId}/step2`, {
        method: "POST",
        body: JSON.stringify({
          sessionId, bodyType, environmentFactors: envFactors.join(","),
          tongueCoating: tongue.filter(t => t.startsWith("苔")).join(","),
          tongueBody: tongue.filter(t => t.startsWith("舌")).join(","),
          pulseType: pulse.join(","),
          meridians: meridians.map(m => ({ ...m, assessmentId: m.assessmentId })),
          supplementaryInquiry,
        }),
      });
      return true;
    } catch (e) { setError("保存失败"); return false; }
    finally { clearLoading(); }
  };

  // ─── Step 3: Save data only ───
  const saveStep3Data = async () => {
    const unfilled = durations.filter(d => !d.durationDays && !d.durationHours);
    if (unfilled.length > 0) { setError("请填写所有症状的持续时长"); return false; }
    setLoading(true); setError(null);
    try {
      await apiFetch(`/wizard-diagnosis/sessions/${sessionId}/step3`, {
        method: "POST",
        body: JSON.stringify({ sessionId, durations }),
      });
      return true;
    } catch (e) { setError("保存失败"); return false; }
    finally { clearLoading(); }
  };

  // ─── Step 4: Trigger AI diagnosis (with auto-retry) ───
  const triggerDiagnosis = async (retries = 2) => {
    if (diagnosis) return true; // already have results
    setLoading(true); setLoadingStep(3); setError(null);
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await apiFetch(`/wizard-diagnosis/sessions/${sessionId}/diagnose`, { method: "POST" });
        const data = res.data || res;
        setDiagnosis(data);
        clearLoading();
        return true;
      } catch (e) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        setError("AI服务繁忙，系统正在自动重试，无需手动点击");
        window.setTimeout(() => {
          void triggerDiagnosis(retries);
        }, 3000);
        clearLoading();
        return false;
      }
    }
    clearLoading();
    return false;
  };

  // ─── Step 5: Combined formula ───
  const saveStep5 = async () => {
    setLoading(true); setLoadingStep(4); setError(null);
    try {
      const hasCombined = diagnosis?.secondarySyndromes && diagnosis.secondarySyndromes.length > 0;
      const res = await apiFetch(`/wizard-diagnosis/sessions/${sessionId}/step5`, {
        method: "POST",
        body: JSON.stringify({
          sessionId, hasCombined: !!hasCombined,
          combinedSyndromes: hasCombined ? String(diagnosis?.secondarySyndromes) : null,
          recommendedFormula: null,
          isApplied: appliedCombined,
        }),
      });
      const data = res.data || res;
      // If backend returned structured data, use it; otherwise synthesize from diagnosis
      if (data && (data.analysis || data.formula)) {
        setStep5Result(data);
      } else if (hasCombined) {
        const sr = (diagnosis?.structuredResult || {}) as Record<string, unknown>;
        setStep5Result({
          analysis: `主证「${diagnosis?.primarySyndrome || '待复核'}」与兼证「${diagnosis?.secondarySyndromes || '无'}」并存，属于多证型合病。${sr.fullAnalysis ? String(sr.fullAnalysis).split("```json")[0].substring(0, 300) + "..." : ""}`,
          formula: (sr.formulaRecommendation as string) || diagnosis?.treatmentMethod || "",
          modification: "",
        });
      } else {
        setStep5Result({ analysis: null, formula: null, modification: null });
      }
      return true;
    } catch (e) { setError("合病合方分析失败"); return false; }
    finally { clearLoading(); }
  };

  // ─── Step 6: Follow-up (auto-trigger, like triggerDiagnosis) ───
  const triggerFollowup = async () => {
    if (step6Result) return true; // already have results
    if (!overallEval) { setError("请选择整体疗效评估"); return false; }
    setLoading(true); setLoadingStep(5); setError(null);
    try {
      const res = await apiFetch(`/wizard-diagnosis/sessions/${sessionId}/step6`, {
        method: "POST",
        body: JSON.stringify({
          sessionId, overallEvaluation: overallEval,
          symptomEvaluations: JSON.stringify(symptomEvals),
          adjustedPlan: null, feedback: feedbackText,
        }),
      });
      const data = res.data || res;
      if (data?.adjustedPlan) {
        setStep6Result(data);
      } else {
        setStep6Result({ adjustedPlan: null });
      }
      clearLoading();
      return true;
    } catch (e) {
      setError("疗效评估失败，请稍后重试");
      clearLoading();
      return false;
    }
  };

  // ─── Step 6: Follow-up (called by handleNext on step 5) ───
  const saveStep6 = async () => {
    if (!overallEval) { setError("请选择整体疗效评估"); return false; }
    setLoading(true); setLoadingStep(5); setError(null);
    try {
      const res = await apiFetch(`/wizard-diagnosis/sessions/${sessionId}/step6`, {
        method: "POST",
        body: JSON.stringify({
          sessionId, overallEvaluation: overallEval,
          symptomEvaluations: JSON.stringify(symptomEvals),
          adjustedPlan: null, feedback: feedbackText,
        }),
      });
      const data = res.data || res;
      if (data?.adjustedPlan) {
        setStep6Result(data);
      } else {
        // Cache even if no adjustedPlan, to prevent re-triggering
        setStep6Result({ adjustedPlan: null });
      }
      return true;
    } catch (e) { setError("疗效评估失败"); return false; }
    finally { clearLoading(); }
  };

  // ─── Step 7: Multi-school consultation ───
  const generateConsultation = async (): Promise<{ consultText: string | null; planText: string | null }> => {
    if (!sessionId) return { consultText: null, planText: null };
    setLoading(true); setLoadingStep(6); setError(null);
    try {
      const res = await apiFetch(`/wizard-diagnosis/sessions/${sessionId}/step7`, {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          consultationResults: null,
          selectedSchool: null,
          finalPlan: null,
        }),
      });
      const payload = res.data ?? res;
      const consultText = payload?.consultationResults || null;
      const planText = payload?.finalPlan || null;
      if (consultText) setConsultRawText(consultText);
      if (planText) setFinalPlan(planText);
      if (!consultText && !planText) {
        setError("AI会诊生成未返回有效结果，请点击重试");
      }
      clearLoading();
      return { consultText, planText };
    } catch (e) {
      console.error("Step7 error:", e);
      setError("多流派会诊生成失败，请点击重试");
      clearLoading();
      return { consultText: null, planText: null };
    }
  };

  const saveStep7Final = async (consult?: string, plan?: string) => {
    if (!sessionId) return false;
    setLoading(true); setError(null);
    try {
      const cr = consult ?? consultRawText;
      const fp = plan ?? finalPlan;
      await apiFetch(`/wizard-diagnosis/sessions/${sessionId}/step7`, {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          consultationResults: cr,
          selectedSchool,
          finalPlan: fp,
        }),
      });
      await apiFetch(`/wizard-diagnosis/sessions/${sessionId}/complete`, { method: "POST" });
      return true;
    } catch (e) { setError("保存失败"); return false; }
    finally { clearLoading(); }
  };

  // Handle next step
  const handleNext = async () => {
    let ok = true;
    if (currentStep === 0) {
      ok = await saveStep1() ?? false;
      if (ok) goNext();
    } else if (currentStep === 1) {
      ok = await saveStep2() ?? false;
      if (ok) goNext();
    } else if (currentStep === 2) {
      // Step 3: save data, navigate to step 4, then trigger AI there
      ok = await saveStep3Data() ?? false;
      if (ok) {
        goNext(); // move to step 4
        // Trigger AI diagnosis on step 4
        triggerDiagnosis();
      }
    } else if (currentStep === 3) {
      // Step 4: just navigate forward (AI already done or in progress)
      goNext();
    } else if (currentStep === 4) {
      // Step 5: 合病合方 + 疗效评估（合并页面）
      // 三种状态：①首次进入(无step5Result)→触发合方分析，留在此页 → ②合方分析完成，填写评估表单→提交评估，留在此页 → ③评估完成(step6Result存在)→下一步跳到会诊
      if (step6Result) { goNext(); return; }
      if (!step5Result) {
        // 首次：触发合方分析，不跳转
        ok = await saveStep5() ?? false;
      } else {
        // 合方分析已完成，先校验必填项，通过后跳转并自动触发AI评估
        if (!overallEval) { setError("请选择整体疗效评估"); return; }
        goNext();
        triggerFollowup();
        return;
      }
    } else if (currentStep === 5) {
      // 疗效评估步骤：首次进入时触发AI评估（显示等待界面），完成后显示结果
      if (step6Result) { goNext(); return; }
      ok = await saveStep6() ?? false;
    } else if (currentStep === 6) {
      // Step 7: best-effort save, then navigate to profile
      try {
        if (consultRawText) {
          await saveStep7Final(consultRawText, finalPlan ?? undefined);
        }
      } catch {
        // 忽略保存错误，仍然跳转
      }
      navigate("/");
      return;
    }
  };
  /** Clean text for print: decode entities, strip markdown, format for document */
  const cleanText = (text: string | null | undefined): string => {
    if (!text) return "";
    return cleanAiDisplayText(text, "")
      .replace(/---+/g, "")
      .replace(/✓\s*/g, "")
      .replace(/[▸►]\s*/g, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/&nbsp;/g, " ")
      .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, (m) => String("①②③④⑤⑥⑦⑧⑨⑩".indexOf(m) + 1) + ". ")
      .replace(/^\s*[-·]\s+/gm, "· ")
      .replace(/^\s*[—–]\s+/gm, "  ");
  };

  /** Get chart as base64 image for PDF embedding */
  const getChartImage = (chartId: string): string => {
    const chart = chartRefs.current[chartId];
    if (!chart) return "";
    try {
      const dataUrl = chart.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#fff" });
      return dataUrl;
    } catch { return ""; }
  };

  /** 生成格式化的打印文档并打开打印窗口 */
  const handlePrintReport = () => {
    const now = new Date().toLocaleString("zh-CN");
    const radarImg = getChartImage("radar-chart");
    const meridianImg = getChartImage("meridian-chart");
    const pieImg = getChartImage("diagnosis-chart");

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>千方慧鉴 - 辨证诊疗报告</title>
<style>
  @page { margin: 18mm 15mm; size: A4; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Microsoft YaHei", "SimSun", serif; color: #333; line-height: 1.9; font-size: 10.5pt; }

  /* Header */
  .report-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2.5px solid #5B7D63; padding-bottom: 10px; margin-bottom: 16px; }
  .report-header h1 { font-size: 18pt; color: #2D3B2E; font-weight: 700; letter-spacing: 2px; }
  .report-header .meta { font-size: 8.5pt; color: #999; text-align: right; line-height: 1.6; }

  /* Section */
  .sec { margin-bottom: 14px; page-break-inside: avoid; }
  .sec-title { font-size: 11pt; font-weight: 700; color: #3D5B45; border-left: 3px solid #5B7D63; padding-left: 8px; margin-bottom: 8px; }

  /* Info grid */
  .info-row { display: flex; gap: 8px; margin-bottom: 6px; }
  .info-cell { flex: 1; padding: 6px 8px; border: 1px solid #E2E8E3; border-radius: 3px; background: #FAFBFA; }
  .info-cell .label { font-size: 8pt; color: #8B9E8F; }
  .info-cell .val { font-size: 10pt; font-weight: 600; color: #2D3B2E; }

  /* Charts */
  .chart-row { display: flex; gap: 10px; margin-bottom: 10px; }
  .chart-box { flex: 1; text-align: center; }
  .chart-box img { max-width: 100%; max-height: 180px; }
  .chart-label { font-size: 8pt; color: #8B9E8F; margin-bottom: 4px; }

  /* Content */
  .body-text { font-size: 10pt; color: #444; text-align: justify; white-space: pre-line; line-height: 1.85; }
  .badge-row { margin: 4px 0; }
  .badge { display: inline-block; padding: 2px 8px; border: 1px solid #D5DDD6; border-radius: 3px; font-size: 8.5pt; margin: 2px; background: #F0F4F1; color: #5B7D63; }

  /* Divider */
  .divider { border: none; border-top: 1px solid #E2E8E3; margin: 12px 0; }

  /* Symptoms table */
  .sym-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 8px; }
  .sym-table th { background: #F0F4F1; color: #5B7D63; padding: 4px 6px; text-align: left; font-weight: 600; border: 1px solid #D5DDD6; }
  .sym-table td { padding: 3px 6px; border: 1px solid #E2E8E3; }

  /* Footer */
  .disclaimer { margin-top: 14px; padding: 10px 12px; border: 1px solid #E7D9B8; background: #FFF9E8; color: #6B5A2B; border-radius: 6px; font-size: 8.8pt; line-height: 1.7; }
  .footer { text-align: center; font-size: 7.5pt; color: #999; margin-top: 16px; border-top: 1px solid #E2E8E3; padding-top: 6px; }
</style>
</head>
<body>

<!-- Header -->
<div class="report-header">
  <h1>辨证诊疗报告</h1>
  <div class="meta">
    生成时间：${now}<br>
    千方慧鉴 AI 辅助诊疗系统
  </div>
</div>

<!-- 一、症状采集概要 -->
<div class="sec">
  <div class="sec-title">一、症状采集概要</div>
  ${assessments.length > 0 ? `
  <table class="sym-table">
    <tr><th>症状</th><th>程度</th></tr>
    ${assessments.map(a => `<tr><td>${a.symptomName}</td><td>${a.skipAssessment ? "未评估" : (SEVERITY_OPTIONS.find(o => o.value === a.severity)?.label.split("（")[0] || "-")}</td></tr>`).join("")}
  </table>
  ` : ''}
  ${tongue.length > 0 || pulse.length > 0 ? `
  <div class="info-row">
    <div class="info-cell"><div class="label">舌诊</div><div class="val">${tongue.join("、") || "-"}</div></div>
    <div class="info-cell"><div class="label">脉诊</div><div class="val">${pulse.join("、") || "-"}</div></div>
    <div class="info-cell"><div class="label">体质</div><div class="val">${bodyType === "strong" ? "素体强健" : bodyType === "weak" ? "素体虚弱" : "-"}</div></div>
  </div>
  ` : ''}
</div>

<!-- 二、可视化分析 -->
${(pieImg || radarImg || meridianImg) ? `
<div class="sec">
  <div class="sec-title">二、可视化分析</div>
  <div class="chart-row">
    ${pieImg ? `<div class="chart-box"><div class="chart-label">证型分布</div><img src="${pieImg}" /></div>` : ''}
    ${radarImg ? `<div class="chart-box"><div class="chart-label">八纲辨证分布</div><img src="${radarImg}" /></div>` : ''}
    ${meridianImg ? `<div class="chart-box"><div class="chart-label">经络归经分析</div><img src="${meridianImg}" /></div>` : ''}
  </div>
</div>
` : ''}

<!-- 三、辨证结论 -->
${diagnosis ? `
<div class="sec">
  <div class="sec-title">三、辨证结论</div>
  <div class="info-row">
    <div class="info-cell"><div class="label">主证型</div><div class="val">${diagnosis.primarySyndrome || '辨证信息待补充'}</div></div>
    <div class="info-cell"><div class="label">治法</div><div class="val">${diagnosis.treatmentMethod || '-'}</div></div>
    <div class="info-cell"><div class="label">匹配置信度</div><div class="val">${((diagnosis.confidenceScore || 0) * 100).toFixed(0)}%</div></div>
  </div>
  ${diagnosis.secondarySyndromes ? `<div class="info-row"><div class="info-cell"><div class="label">兼证型</div><div class="val">${diagnosis.secondarySyndromes}</div></div></div>` : ''}
</div>
` : ''}

<!-- 四、治疗方案 -->
${diagnosis?.structuredResult && typeof diagnosis.structuredResult === "object" && !Array.isArray(diagnosis.structuredResult) ? (() => {
  const sr = (diagnosis.structuredResult as Record<string, unknown>);
  const formula = sr.formulaRecommendation as string;
  const acupoints = sr.acupoints as string[];
  const diet = sr.dietAdvice as string;
  const lifestyle = sr.lifestyleAdvice as string;
  let html = '';
  if (formula || acupoints?.length || diet || lifestyle) {
    html = '<div class="sec"><div class="sec-title">四、治疗方案</div>';
    if (formula) html += `<p style="margin-bottom:6px"><strong>方药：</strong>${cleanText(formula)}</p>`;
    if (acupoints?.length) html += `<div style="margin-bottom:6px"><strong>针灸/指压：</strong><div class="badge-row">${acupoints.map(p => `<span class="badge">${p}</span>`).join("")}</div></div>`;
    if (diet) html += `<p style="margin-bottom:6px"><strong>食疗药膳：</strong>${cleanText(diet)}</p>`;
    if (lifestyle) html += `<p style="margin-bottom:6px"><strong>养生调护：</strong>${cleanText(lifestyle)}</p>`;
    html += '</div>';
  }
  return html;
})() : ''}

<!-- 五、合病合方 -->
${step5Result?.analysis || step5Result?.formula ? `
<div class="sec">
  <div class="sec-title">五、合病合方分析</div>
  ${step5Result.analysis ? `<div class="body-text">${cleanText(step5Result.analysis)}</div>` : ''}
  ${step5Result.formula ? `<hr class="divider"><p><strong>合方推荐：</strong>${cleanText(step5Result.formula)}</p>` : ''}
  ${step5Result.modification ? `<p style="margin-top:4px"><strong>加减化裁：</strong>${cleanText(step5Result.modification)}</p>` : ''}
</div>
` : ''}

<!-- 六、疗效评估 -->
${step6Result?.adjustedPlan ? `
<div class="sec">
  <div class="sec-title">六、疗效评估与调整方案</div>
  <div class="body-text">${cleanText(step6Result.adjustedPlan)}</div>
</div>
` : ''}

<!-- 七、多流派会诊 -->
${consultRawText || finalPlan ? `
<div class="sec">
  <div class="sec-title">七、多专家会诊意见</div>
  ${consultRawText ? `<div class="body-text">${cleanText(consultRawText)}</div>` : ''}
  ${finalPlan ? `<hr class="divider"><p><strong>最终综合方案：</strong></p><div class="body-text">${cleanText(finalPlan)}</div>` : ''}
</div>
` : ''}

<!-- Disclaimer -->
<div class="disclaimer">
  <strong>免责声明与合理建议：</strong>本报告由“千方慧鉴”基于已录入的症状、舌脉、病程与反馈自动生成，仅用于中医健康管理、学习交流和执业医师辅助参考，不构成最终诊断、处方或治疗指令。中医辨证需四诊合参，线上信息可能不完整；涉及中药、针灸、理疗及慢病/孕产/儿童/老人等特殊人群，请务必由具备资质的执业医师面诊后决定。若出现胸痛、呼吸困难、持续高热、意识异常、出血、剧烈疼痛、突发肢体无力等危险信号，请立即前往正规医疗机构。
</div>

<!-- Footer -->
<div class="footer">
  <p>千方慧鉴 AI 辅助诊疗系统 · Neo4j 中医知识库 · 生成时间：${now}</p>
  <p>&copy; ${new Date().getFullYear()} 千方慧鉴。本报告建议随访复核，不建议自行照方用药。</p>
</div>
</body>
</html>`;

    const win = window.open("", "_blank", "width=800,height=600");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.onload = () => { win.print(); };
    }
  };

  // ─── Render helpers ───
  /** Decode HTML entities in AI text */
  const decodeHtmlEntities = (text: string): string => {
    return text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&emsp;/g, "  ")
      .replace(/&ensp;/g, " ");
  };

  /** 前端兜底清洗：拦截本地模型BPE残留、think标签、代码围栏和空JSON，避免乱码进入页面/PDF */
  const cleanAiDisplayText = (text: string | null | undefined, fallback = "系统已启用专业规则兜底，正在按主证、兼证、四诊资料与随访信息生成结构化分析。") => {
    if (!text) return "";
    let cleaned = decodeHtmlEntities(text)
      .replace(/Ċ/g, "\n")
      .replace(/Ġ/g, " ")
      .replace(/▁/g, " ")
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/<\/?think>/gi, "")
      .replace(/```\s*json/gi, "```")
      .replace(/^\s*JSON\s*(?=\{)/i, "")
      .trim();
    cleaned = cleaned.replace(/```[\s\S]*?```/g, (block) => {
      const inner = block.replace(/^```\s*/,'').replace(/```$/,'').trim();
      if (/^\{[\s\S]*\}$/.test(inner)) {
        try {
          const parsed = JSON.parse(inner);
          return Object.entries(parsed).filter(([, v]) => String(v ?? "").trim()).map(([k, v]) => `${k}：${Array.isArray(v) ? v.join("、") : v}`).join("\n");
        } catch { return ""; }
      }
      return inner;
    }).trim();
    const chineseCount = (cleaned.match(/[一-鿿]/g) || []).length;
    if (!cleaned || cleaned.includes("</think>") || /[ĊĠ]/.test(cleaned) || (cleaned.length > 10 && chineseCount / cleaned.length < 0.18)) return fallback;
    return cleaned;
  };

  const combinedAnalysisFallback = () => `合病分析：当前以“${diagnosis?.primarySyndrome || "主证待复核"}”为辨证核心，兼顾“${diagnosis?.secondarySyndromes || "兼证资料不足"}”。合病合方应先分清主次，不能机械叠加多个方剂；若兼夹证证据充分，可在主方基础上少量加减以兼顾气机、湿热、痰湿、虚损等偏差。所有方药仅作辅助分析展示，需由执业医师面诊后决定。`;

  const combinedFormulaFallback = () => `合方推荐：以主证对应主方为君，兼证以加减药味或小方意处理。肝郁脾虚可参考逍遥散合健脾思路；脾虚湿困可参考参苓白术散合平胃散思路；心脾两虚可参考归脾汤思路；痰湿或湿热明显时需先辨寒热再化湿化痰，避免多方堆砌。`;

  const combinedModificationFallback = () => `加减化裁：遵循“主证优先、兼证佐助、动态复核”的原则。若症状改善则小幅守方；若出现口干烦热、便溏畏寒、胸痛气促、出血、高热或意识异常，应停止自行调整并及时就医。`;

  const followupFallback = () => `【疗效评估】
本次复诊应以主症变化、睡眠饮食、二便、情绪、舌象和脉象为核心观察指标。若主症减轻且整体状态改善，说明原治法方向基本相符；若只局部改善或出现新症，应复核寒热虚实和兼夹证。

【调整建议】
有效者以守方微调为主；无效者重新辨证，不建议盲目加量或频繁换方。湿重苔腻者偏健脾化湿，舌红少苔或口干烦热者偏养阴清热，畏寒便溏者慎用苦寒。所有方药和针灸方案需由执业医师面诊后确定。`;

  const consultationFallback = () => `伤寒学派（六经辨证）：结合病程、寒热、汗出、胸胁、胃肠与精神状态判断六经层次，外感初起偏太阳，口苦胁满偏少阳，腹满便溏偏太阴。

温病学派（卫气营血）：重点观察发热、口渴、舌红苔黄、斑疹神昏等热邪层次；若资料不足，不应夸大为营血分。

脏腑辨证：当前主证倾向为“${diagnosis?.primarySyndrome || "资料不足证候待定"}”，兼顾“${diagnosis?.secondarySyndromes || "兼证待复核"}”。需围绕肝、脾、心、肾及气血津液判断病位病性。

经络辨证：子午归经和人形图标点只作定位线索，最终仍要回到八纲、脏腑、气血津液完成辨证。

综合意见：以主证为纲，兼证加减，动态随访；报告仅作中医辅助分析，不替代医生诊断处方。`;

  /** Render inline formatted text (bold, highlights) within a line */
  const renderInlineText = (text: string) => {
    // Decode any remaining HTML entities
    const decoded = decodeHtmlEntities(text);
    // Split by **bold** markers
    const parts = decoded.split(/(\*\*[^*]+\*\*)/g);
    if (parts.length <= 1) return decoded;
    return parts.map((part, i) => {
      const boldMatch = part.match(/^\*\*(.+?)\*\*$/);
      if (boldMatch) {
        return <span key={i} className="font-semibold text-[#3D5B45]">{boldMatch[1]}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  /** Parse fullAnalysis text into structured sections for display */
  const renderStructuredAnalysis = (text: string) => {
    // Strip JSON blocks first
    const withoutJson = text.split("```json")[0].split("```")[0];
    // Decode HTML entities throughout
    const parsed = cleanAiDisplayText(withoutJson, "AI辨证结果正在重新整理，请重新生成或查看上方主证型、治法与结构化摘要。");

    // Try to split by Chinese numbered sections: 一、二、三、...
    const sectionPattern = /\*\*[一二三四五六七八九十]+[、．.][^*]*\*\*/g;
    const matches = [...parsed.matchAll(sectionPattern)];
    if (matches.length === 0) {
      // No structured sections — render as professional paragraphs
      return (
        <div className="text-sm text-[#2D3B2E] leading-relaxed">
          {renderContentLines(parsed.trim())}
        </div>
      );
    }
    const sections: { title: string; content: string }[] = [];
    matches.forEach((m, i) => {
      const start = m.index! + m[0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index! : parsed.length;
      const title = m[0].replace(/\*\*/g, "").trim();
      const content = parsed.substring(start, end).trim();
      sections.push({ title, content });
    });

    return (
      <div className="divide-y divide-[#E8ECE9]">
        {sections.map((sec, i) => {
          return (
            <div key={i} className={i > 0 ? "pt-4" : ""}>
              <h5 className="text-xs font-bold text-[#8B9E8F] mb-2 tracking-wide">{sec.title}</h5>
              <div className="text-sm text-[#2D3B2E] leading-relaxed">
                {renderContentLines(sec.content)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /** Render content lines with proper formatting for various AI output patterns */
  const renderContentLines = (content: string, fallback = "系统已启用专业规则兜底：请结合主证、兼证、舌脉、病程和随访变化综合判断，方药与针灸方案需由执业医师面诊后确定。") => {
    const lines = cleanAiDisplayText(content, fallback).split("\n");
    const elements: React.ReactNode[] = [];

    for (let j = 0; j < lines.length; j++) {
      const trimmed = lines[j].trim();
      if (!trimmed) continue;

      // ①②③④⑤⑥⑦⑧⑨⑩ — circled numbers → styled numbered items
      const circledMatch = trimmed.match(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*(.*)/);
      if (circledMatch) {
        const num = "①②③④⑤⑥⑦⑧⑨⑩".indexOf(trimmed[0]) + 1;
        elements.push(
          <div key={j} className="flex gap-2 my-1.5 pl-1">
            <span className="shrink-0 w-5 h-5 rounded-full bg-[#7C9A82]/15 text-[#5B7D63] text-[11px] font-bold flex items-center justify-center mt-0.5">{num}</span>
            <span className="text-[#2D3B2E]">{renderInlineText(circledMatch[1])}</span>
          </div>
        );
        continue;
      }

      // ✓ check mark → styled check item
      if (trimmed.startsWith("✓") || trimmed.startsWith("✅")) {
        const rest = trimmed.replace(/^[✓✅]\s*/, "");
        elements.push(
          <div key={j} className="flex gap-2 my-1 pl-2">
            <CheckCircle2 className="h-4 w-4 text-[#7C9A82] shrink-0 mt-0.5" />
            <span className="text-[#2D3B2E]">{renderInlineText(rest)}</span>
          </div>
        );
        continue;
      }

      // ▸ triangle marker → styled sub-header
      if (trimmed.startsWith("▸") || trimmed.startsWith("►")) {
        const rest = trimmed.replace(/^[▸►]\s*/, "");
        elements.push(
          <div key={j} className="flex items-center gap-2 mt-3 mb-1 pl-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C4A862]" />
            <span className="font-medium text-[#3D5B45]">{renderInlineText(rest)}</span>
          </div>
        );
        continue;
      }

      // --- horizontal rule (3+ dashes alone)
      if (/^[-—]{3,}$/.test(trimmed)) {
        elements.push(<hr key={j} className="my-3 border-t border-dashed border-[#D5DDD6]" />);
        continue;
      }

      // — em-dash description (indented description under a numbered item)
      const emDashMatch = trimmed.match(/^[—–]\s*(.*)/);
      if (emDashMatch) {
        elements.push(
          <p key={j} className="pl-4 my-0.5 text-[#4A5D4E] border-l-2 border-[#E2E8E3] py-0.5">
            {renderInlineText(emDashMatch[1])}
          </p>
        );
        continue;
      }

      // **Bold label**：value pattern
      const boldLabelMatch = trimmed.match(/^\*\*(.+?)\*\*[：:]\s*(.*)/);
      if (boldLabelMatch) {
        elements.push(
          <p key={j} className="my-1">
            <span className="font-semibold text-[#3D5B45]">{boldLabelMatch[1]}</span>
            <span className="text-[#5B7D63]">：</span>
            <span>{renderInlineText(boldLabelMatch[2])}</span>
          </p>
        );
        continue;
      }

      // **Bold line** (standalone bold header)
      const boldMatch = trimmed.match(/^\*\*(.+?)\*\*$/);
      if (boldMatch) {
        elements.push(
          <p key={j} className="font-semibold text-[#3D5B45] mt-2">{boldMatch[1]}</p>
        );
        continue;
      }

      // - bullet list items
      const bulletMatch = trimmed.match(/^[-·]\s+(.*)/);
      if (bulletMatch) {
        elements.push(
          <div key={j} className="flex gap-2 my-0.5 pl-3">
            <span className="text-[#7C9A82] mt-1 shrink-0">·</span>
            <span className="text-[#2D3B2E]">{renderInlineText(bulletMatch[1])}</span>
          </div>
        );
        continue;
      }

      // Regular numbered items: 1. 2. 3.
      const numMatch = trimmed.match(/^(\d+)[.、)）]\s*(.*)/);
      if (numMatch) {
        elements.push(
          <div key={j} className="flex gap-2 my-0.5 pl-1">
            <span className="shrink-0 text-[#7C9A82] font-medium text-xs mt-0.5">{numMatch[1]}.</span>
            <span className="text-[#2D3B2E]">{renderInlineText(numMatch[2])}</span>
          </div>
        );
        continue;
      }

      // Regular paragraph — strip any remaining ** markers
      elements.push(<p key={j} className="my-1">{renderInlineText(trimmed)}</p>);
    }

    return elements;
  };
  const filteredSymptoms = symptoms.filter(s =>
    s.name.includes(symptomSearch) || s.category.includes(symptomSearch)
  );

  // ─── Visualization data helpers ───
  /**
   * 八纲辨证 radar data（临床规则校正版）
   *
   * 设计原则：
   * 1. 八纲先分三组对偶轴：表/里、寒/热、虚/实，再综合推导阴/阳。
   * 2. 症状只作为“证据线索”，舌脉和诱因作为校正项；不把单一症状机械等同于证型。
   * 3. 当前症状字典 52 项均有明确映射，避免大量症状未匹配后落入“症型不明确”。
   * 4. “表里同病、寒热错杂、虚实夹杂”不再用 100-x 的单轴互斥值判断，改用原始双侧证据同时达到阈值判断。
   */
  const getRadarData = () => {
    type Dim = "biao" | "li" | "han" | "re" | "xu" | "shi";
    type Scores = Record<Dim, number>;
    const sevMap: Record<string, number> = { occasional: 1, sometimes: 2, often: 3, frequent: 4, always: 5 };
    const scores: Scores = { biao: 0, li: 0, han: 0, re: 0, xu: 0, shi: 0 };

    const add = (dims: Partial<Scores>, sev = 1, weight = 1) => {
      (Object.entries(dims) as [Dim, number][]).forEach(([dim, value]) => {
        scores[dim] += value * sev * weight;
      });
    };

    const SYMPTOM_BAGANG_RULES: [RegExp, Partial<Scores>][] = [
      [/头痛/, { biao: 0.45, shi: 0.35 }],
      [/头晕|眩晕|目眩/, { li: 0.35, xu: 0.45, shi: 0.2 }],
      [/目赤|目红/, { li: 0.35, re: 0.75, shi: 0.35 }],
      [/耳鸣/, { li: 0.35, xu: 0.45, shi: 0.2 }],
      [/鼻塞|鼻流清涕|流涕|鼻鸣/, { biao: 0.75, han: 0.45 }],
      [/口苦/, { li: 0.65, re: 0.55, shi: 0.45 }],
      [/口渴|口干|口燥咽干/, { li: 0.45, re: 0.65, xu: 0.25 }],
      [/咽痛|咽喉肿/, { re: 0.8, shi: 0.35, biao: 0.25 }],
      [/面色萎黄/, { xu: 0.8, li: 0.35 }],
      [/面色苍白|面色.*白/, { xu: 0.75, han: 0.45 }],
      [/面色潮红|面红/, { re: 0.65, xu: 0.25 }],
      [/心悸|心慌/, { xu: 0.75, li: 0.25 }],
      [/胸闷/, { li: 0.45, shi: 0.75 }],
      [/气短|懒言/, { xu: 0.85 }],
      [/胸痛/, { li: 0.45, shi: 0.65, han: 0.2 }],
      [/胃脘痛/, { li: 0.75, shi: 0.45 }],
      [/腹胀|腹满/, { li: 0.8, shi: 0.55, xu: 0.2 }],
      [/腹痛/, { li: 0.75, shi: 0.45, han: 0.25 }],
      [/胁肋胀痛|胁痛|胁胀/, { li: 0.55, shi: 0.8 }],
      [/恶心|呕吐|干呕/, { li: 0.65, shi: 0.35 }],
      [/食欲不振|纳差|食不下|不欲食/, { li: 0.45, xu: 0.6 }],
      [/便秘|大便干燥|便干/, { li: 0.8, re: 0.45, shi: 0.55 }],
      [/腹泻|泄泻|便溏|下利/, { li: 0.8, xu: 0.55, han: 0.35 }],
      [/尿频|夜尿频/, { li: 0.35, xu: 0.45, han: 0.3 }],
      [/尿急|尿黄|小便.*黄|尿赤|尿短/, { li: 0.65, re: 0.65, shi: 0.35 }],
      [/失眠|多梦|入睡困难/, { li: 0.35, re: 0.35, xu: 0.45 }],
      [/嗜睡|但欲寐|精神萎靡/, { xu: 0.75, han: 0.35 }],
      [/乏力|疲乏|疲倦|神疲|易疲劳/, { xu: 0.85 }],
      [/自汗/, { xu: 0.75, biao: 0.25 }],
      [/盗汗/, { xu: 0.75, re: 0.45 }],
      [/恶寒|恶风|畏寒|怕冷/, { biao: 0.45, han: 0.75, xu: 0.25 }],
      [/发热/, { biao: 0.45, re: 0.75 }],
      [/五心烦热|手足心热|潮热/, { re: 0.85, xu: 0.65 }],
      [/腰痛|腰.*酸|膝软/, { li: 0.3, xu: 0.55, han: 0.25 }],
      [/关节痛|骨节.*痛/, { biao: 0.35, shi: 0.45, han: 0.35 }],
      [/肢体麻木|麻木/, { xu: 0.45, shi: 0.35 }],
      [/下肢浮肿|水肿|浮肿/, { li: 0.45, xu: 0.55, shi: 0.45, han: 0.25 }],
      [/手足逆冷|四肢厥冷|手脚冰凉|手足不温/, { han: 0.85, xu: 0.55 }],
      [/咳嗽/, { biao: 0.4, li: 0.25 }],
      [/咳痰|痰多/, { li: 0.45, shi: 0.65 }],
      [/喘息|喘促|气喘/, { li: 0.45, shi: 0.45, xu: 0.35 }],
      [/情志抑郁|善太息/, { li: 0.45, shi: 0.65 }],
      [/烦躁易怒|心烦|烦躁/, { li: 0.45, re: 0.55, shi: 0.45 }],
    ];

    assessments.forEach(a => {
      const sev = a.severity ? (sevMap[a.severity] || 1) : (a.skipAssessment ? 2 : 0);
      if (!sev) return;
      const name = a.symptomName;
      let matched = false;
      for (const [regex, dims] of SYMPTOM_BAGANG_RULES) {
        if (regex.test(name)) {
          add(dims, sev);
          matched = true;
        }
      }
      if (!matched) {
        if (/寒|冷|凉/.test(name)) add({ han: 0.45 }, sev);
        if (/热|燥|火|赤|黄/.test(name)) add({ re: 0.45 }, sev);
        if (/虚|乏|软|弱/.test(name)) add({ xu: 0.45 }, sev);
        if (/胀|痛|满|堵|痰|肿/.test(name)) add({ shi: 0.35 }, sev);
      }
    });

    tongue.forEach(t => {
      if (/苔薄黄/.test(t)) add({ re: 0.45 }, 1, 1.2);
      if (/苔黄腻/.test(t)) add({ li: 0.45, re: 0.75, shi: 0.55 }, 1, 1.2);
      if (/苔白腻/.test(t)) add({ li: 0.4, han: 0.55, shi: 0.55 }, 1, 1.2);
      if (/苔薄白/.test(t)) add({ biao: 0.2, han: 0.2 }, 1, 0.8);
      if (/苔少|无苔/.test(t)) add({ xu: 0.65, re: 0.35 }, 1, 1.2);
      if (/舌质淡/.test(t)) add({ xu: 0.75, han: 0.35 }, 1, 1.2);
      if (/舌质红/.test(t)) add({ re: 0.7 }, 1, 1.2);
      if (/舌质暗|瘀斑/.test(t)) add({ li: 0.35, shi: 0.65 }, 1, 1.2);
      if (/胖大|齿痕/.test(t)) add({ xu: 0.65, han: 0.25, shi: 0.25 }, 1, 1.2);
    });

    pulse.forEach(p => {
      if (/脉浮/.test(p)) add({ biao: 0.85 }, 1, 1.25);
      if (/脉沉/.test(p)) add({ li: 0.75 }, 1, 1.25);
      if (/脉迟|脉紧/.test(p)) add({ han: 0.75 }, 1, 1.25);
      if (/脉数|脉滑数|脉弦数/.test(p)) add({ re: 0.75 }, 1, 1.25);
      if (/脉弱|脉细|脉微/.test(p)) add({ xu: 0.8 }, 1, 1.25);
      if (/脉弦/.test(p)) add({ shi: 0.55, li: 0.25 }, 1, 1.15);
      if (/脉滑/.test(p)) add({ shi: 0.55, li: 0.25 }, 1, 1.15);
      if (/脉实|脉洪/.test(p)) add({ shi: 0.75, re: 0.25 }, 1, 1.25);
    });

    if (bodyType === "weak") add({ xu: 0.6 }, 1, 1);
    if (bodyType === "strong") add({ shi: 0.25 }, 1, 1);
    envFactors.forEach(e => {
      if (/受凉/.test(e)) add({ biao: 0.35, han: 0.45 }, 1, 1);
      if (/受湿/.test(e)) add({ li: 0.25, shi: 0.35 }, 1, 1);
      if (/情志/.test(e)) add({ li: 0.25, shi: 0.35 }, 1, 1);
      if (/饮食/.test(e)) add({ li: 0.35, shi: 0.25 }, 1, 1);
      if (/过度劳累/.test(e)) add({ xu: 0.4 }, 1, 1);
      if (/季节变化/.test(e)) add({ biao: 0.2 }, 1, 1);
    });

    const axisValue = (leftDim: Dim, rightDim: Dim) => {
      const left = scores[leftDim];
      const right = scores[rightDim];
      const total = left + right;
      if (total < 0.8) return { value: 50, severity: 0 };
      const value = Math.round(50 + ((right - left) / total) * 50);
      return { value: Math.min(100, Math.max(0, value)), severity: Math.round(Math.max(left, right)) };
    };

    const biaoLiAxis = axisValue("biao", "li");
    const hanReAxis = axisValue("han", "re");
    const xuShiAxis = axisValue("xu", "shi");
    const yangRaw = scores.biao * 0.25 + scores.re * 0.45 + scores.shi * 0.30;
    const yinRaw = scores.li * 0.20 + scores.han * 0.45 + scores.xu * 0.35;
    const yyTotal = yangRaw + yinRaw;
    const yinYangTendency = yyTotal < 0.8 ? 50 : Math.round(50 + ((yangRaw - yinRaw) / yyTotal) * 50);

    const sidePct = (leftDim: Dim, rightDim: Dim) => {
      const left = scores[leftDim], right = scores[rightDim], total = Math.max(left + right, 0.01);
      return { left: (left / total) * 100, right: (right / total) * 100, total };
    };
    const bl = sidePct("biao", "li");
    const hr = sidePct("han", "re");
    const xs = sidePct("xu", "shi");
    const patterns: string[] = [];
    const strong = 62;
    const mild = 58;

    if (bl.left > strong && hr.left > strong) patterns.push("表寒证");
    if (bl.left > strong && hr.right > strong) patterns.push("表热证");
    if (bl.right > strong && hr.right > strong && xs.right > mild) patterns.push("里实热证");
    if (bl.right > strong && hr.left > strong && xs.left > mild) patterns.push("里虚寒证");
    if (bl.right > strong && hr.right > strong && xs.left > mild) patterns.push("里虚热证");
    if (bl.right > strong && hr.left > strong && xs.right > mild) patterns.push("里实寒证");
    if (bl.right > strong && xs.left > strong && !patterns.some(p => p.includes("里虚"))) patterns.push("里虚证");
    if (bl.right > strong && xs.right > strong && !patterns.some(p => p.includes("里实"))) patterns.push("里实证");

    if (scores.biao >= 1.5 && scores.li >= 1.5) patterns.push("表里同病");
    if (scores.han >= 1.5 && scores.re >= 1.5) patterns.push("寒热错杂");
    if (scores.xu >= 1.5 && scores.shi >= 1.5) patterns.push("虚实夹杂");

    const hasYinDefEvidence = tongue.some(t => /舌质红|苔少|无苔/.test(t)) || pulse.some(p => /脉细|脉数/.test(p)) || assessments.some(a => /五心烦热|盗汗|口燥咽干/.test(a.symptomName));
    const hasYangDefEvidence = tongue.some(t => /舌质淡|胖大|齿痕/.test(t)) || pulse.some(p => /脉沉|脉迟|脉弱/.test(p)) || assessments.some(a => /畏寒|手足逆冷|便溏|尿频/.test(a.symptomName));
    if (scores.xu >= 1.8 && scores.re >= 1.4 && hasYinDefEvidence) patterns.push("阴虚证");
    if (scores.xu >= 1.8 && scores.han >= 1.4 && hasYangDefEvidence) patterns.push("阳虚证");

    if (patterns.length === 0) {
      if (bl.total >= 0.8) patterns.push(bl.right > mild ? "偏里证" : bl.left > mild ? "偏表证" : "表里倾向不显");
      if (hr.total >= 0.8) patterns.push(hr.right > mild ? "偏热证" : hr.left > mild ? "偏寒证" : "寒热倾向不显");
      if (xs.total >= 0.8) patterns.push(xs.right > mild ? "偏实证" : xs.left > mild ? "偏虚证" : "虚实倾向不显");
    }
    const usefulPatterns = patterns.filter(p => !p.endsWith("不显"));
    const finalPatterns = usefulPatterns.length > 0 ? Array.from(new Set(usefulPatterns)) : ["资料不足，暂不定型"];

    return [
      { name: "表 ←→ 里", value: biaoLiAxis.value, severity: biaoLiAxis.severity },
      { name: "寒 ←→ 热", value: hanReAxis.value, severity: hanReAxis.severity },
      { name: "虚 ←→ 实", value: xuShiAxis.value, severity: xuShiAxis.severity },
      { name: "阴 ←→ 阳", value: Math.min(100, Math.max(0, yinYangTendency)), severity: 0 },
      { patterns: finalPatterns },
    ];
  };

  /** Get meridian analysis data for bar chart */
  const getMeridianBarData = () => {
    const meridianScores: Record<string, number> = {};
    const sevMap: Record<string, number> = { occasional: 1, sometimes: 2, often: 3, frequent: 4, always: 5 };

    // Default all 12 meridians to 0
    Object.values(MERIDIAN_MAP).forEach(m => { meridianScores[m.meridian] = 0; });

    meridians.forEach(m => {
      if (m.attackMeridian) {
        const assessment = assessments.find(a => a.symptomName === m.symptomName);
        const sev = assessment?.severity ? (sevMap[assessment.severity] || 1) : 1;
        meridianScores[m.attackMeridian] = (meridianScores[m.attackMeridian] || 0) + sev;
      }
    });

    return Object.entries(meridianScores).map(([name, value]) => ({ name, value }));
  };

  const renderChart = (id: string, option: echarts.EChartsOption) => {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      if (chartRefs.current[id]) chartRefs.current[id]!.dispose();
      const chart = echarts.init(el);
      chart.setOption(option);
      chartRefs.current[id] = chart;
    }, 100);
  };

  // ─── Step Content ───
  const renderStepContent = () => {
    if (!isAuthenticated) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <Lock className="h-12 w-12 text-[#A8BFAE] mb-4" />
          <p className="text-[#6B7B6E]">请先登录后使用向导式辨证诊疗</p>
          <Button className="mt-4 bg-[#7C9A82] hover:bg-[#5B7D63] text-white" onClick={() => navigate("/login")}>立即登录</Button>
        </div>
      );
    }

    const descPanel = (
      <div className="w-full lg:w-[32%] shrink-0 space-y-4">
        <Card className="p-5 border-[#E2E8E3] bg-gradient-to-br from-[#F5F0E8]/50 to-[#E8F0EA]/30">
          <h3 className="text-base font-bold text-[#2D3B2E] mb-3 flex items-center gap-2">
            {(() => { const Icon = STEPS[currentStep].icon; return <Icon className="h-5 w-5 text-[#7C9A82]" />; })()}
            {STEPS[currentStep].label}
          </h3>
          <p className="text-sm text-[#6B7B6E] leading-relaxed">{STEP_DESCRIPTIONS[currentStep]}</p>
          <div className="mt-4 p-3 rounded-lg bg-[#E8F0EA]/50 border border-[#D5DDD6]">
            <HelpCircle className="h-4 w-4 text-[#7C9A82] inline mr-1" />
            <span className="text-xs text-[#5B7D63]">步骤 {currentStep + 1} / 7 · 人形图随选项实时更新</span>
          </div>
        </Card>
        <TcmBodyMap
          currentStep={currentStep}
          assessments={assessments}
          meridians={meridians}
          tongue={tongue}
          pulse={pulse}
          envFactors={envFactors}
          durations={durations}
          diagnosis={diagnosis}
          loadingStep={loadingStep}
        />
      </div>
    );

    switch (currentStep) {
      // ═══ Step 1 ═══
      case 0: return (
        <div className="flex flex-col lg:flex-row gap-4">
          {descPanel}
          <div className="flex-1">
            <Card className="p-5 border-[#E2E8E3]">
              <h4 className="font-semibold text-[#2D3B2E] mb-3">选择症状并评估程度</h4>
              <div className="relative mb-4">
                <input
                  type="text" value={symptomSearch}
                  onChange={e => setSymptomSearch(e.target.value)}
                  placeholder="搜索症状（如：头痛、口苦、失眠...）"
                  className="w-full p-2.5 rounded-lg border border-[#D5DDD6] text-sm focus:border-[#7C9A82] focus:outline-none"
                />
                {symptomSearch && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#D5DDD6] rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                    {filteredSymptoms.slice(0, 20).map(s => (
                      <button key={s.id} onClick={() => addSymptom(s)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-[#E8F0EA] flex justify-between">
                        <span>{s.name}</span>
                        <Badge variant="outline" className="text-[10px]">{s.category}</Badge>
                      </button>
                    ))}
                    {filteredSymptoms.length === 0 && <p className="p-3 text-sm text-[#A8BFAE]">未找到匹配症状</p>}
                  </div>
                )}
              </div>

              {assessments.length === 0 && (
                <p className="text-center py-8 text-[#A8BFAE] text-sm">请在上方搜索并添加症状</p>
              )}

              <div className="space-y-3">
                {assessments.map(a => (
                  <div key={a.symptomId} className="p-3 rounded-xl border border-[#D5DDD6] bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm text-[#2D3B2E]">{a.symptomName}</span>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-xs text-[#6B7B6E] cursor-pointer">
                          <input type="checkbox" checked={a.skipAssessment}
                            onChange={() => toggleSkip(a.symptomId)} className="rounded" />
                          不评估
                        </label>
                        <button onClick={() => removeSymptom(a.symptomId)} className="text-[#A8BFAE] hover:text-red-400">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {!a.skipAssessment && (
                      <div className="flex flex-wrap gap-1.5">
                        {SEVERITY_OPTIONS.map(opt => (
                          <button key={opt.value}
                            onClick={() => updateSeverity(a.symptomId, opt.value)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                              a.severity === opt.value
                                ? "bg-[#7C9A82] text-white border-[#7C9A82]"
                                : "bg-[#F0F4F1] text-[#6B7B6E] border-[#D5DDD6] hover:border-[#7C9A82]/50"
                            }`}
                          >{opt.label.split("（")[0]}</button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      );

      // ═══ Step 2 ═══
      case 1: return (
        <div className="flex flex-col lg:flex-row gap-4">
          {descPanel}
          <div className="flex-1 space-y-4">
            <Card className="p-5 border-[#E2E8E3]">
              <h4 className="font-semibold text-[#2D3B2E] mb-3">症状发作时间（子午归经）</h4>
              <div className="space-y-3">
                {meridians.map((m, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-[#D5DDD6]">
                    <span className="text-sm font-medium text-[#2D3B2E] w-24">{m.symptomName}</span>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(MERIDIAN_MAP).map(([k, v]) => (
                        <button key={k}
                          onClick={() => {
                            const next = [...meridians];
                            next[i] = { ...m, attackTime: k, attackMeridian: v.meridian };
                            setMeridians(next);
                          }}
                          className={`px-2 py-1 rounded border text-center leading-tight min-w-[56px] ${
                            m.attackTime === k ? "bg-[#5B7D63] text-white border-[#5B7D63]" : "bg-[#F0F4F1] text-[#6B7B6E] border-[#D5DDD6]"
                          }`}
                        >
                          <span className="text-[11px] font-medium block">{v.name}</span>
                          <span className={`text-[9px] block ${m.attackTime === k ? "text-white/70" : "text-[#A8BFAE]"}`}>{v.time}</span>
                        </button>
                      ))}
                    </div>
                    {m.attackMeridian && <Badge className="bg-[#E8F0EA] text-[#5B7D63] text-[10px]">{m.attackMeridian}</Badge>}
                  </div>
                ))}
              </div>
            </Card>

            {/* 补充问诊卡片 */}
            <Card className="p-5 border-[#C8D9CA]">
              <h4 className="font-semibold text-[#2D3B2E] mb-1">补充问诊（十问歌详查）</h4>
              <p className="text-[10px] text-[#8B9E8F] mb-3">以下信息可大幅提升AI辨证准确度，均为可选项</p>
              <div className="space-y-3">
                {/* 寒热汗出 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] font-medium text-[#6B7B6E] mb-1">寒热感觉（多选）</p>
                    <div className="flex flex-wrap gap-1">{SI_COLD_HEAT_OPTIONS.map(v => (
                      <button key={v} onClick={() => setSiColdHeat(p => p.includes(v) ? p.filter(x=>x!==v) : [...p,v])}
                        className={`px-2 py-1 rounded-lg text-[11px] border ${siColdHeat.includes(v) ? "bg-[#7C9A82] text-white border-[#7C9A82]" : "bg-white text-[#6B7B6E] border-[#D5DDD6]"}`}>{v}</button>
                    ))}</div>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-[#6B7B6E] mb-1">汗出情况（多选）</p>
                    <div className="flex flex-wrap gap-1">{SI_SWEATING_OPTIONS.map(v => (
                      <button key={v} onClick={() => setSiSweating(p => p.includes(v) ? p.filter(x=>x!==v) : [...p,v])}
                        className={`px-2 py-1 rounded-lg text-[11px] border ${siSweating.includes(v) ? "bg-[#7C9A82] text-white border-[#7C9A82]" : "bg-white text-[#6B7B6E] border-[#D5DDD6]"}`}>{v}</button>
                    ))}</div>
                  </div>
                </div>
                {/* 二便 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] font-medium text-[#6B7B6E] mb-1">大便情况（多选）</p>
                    <div className="flex flex-wrap gap-1">{SI_BOWEL_OPTIONS.map(v => (
                      <button key={v} onClick={() => setSiBowel(p => p.includes(v) ? p.filter(x=>x!==v) : [...p,v])}
                        className={`px-2 py-1 rounded-lg text-[11px] border ${siBowel.includes(v) ? "bg-[#7C9A82] text-white border-[#7C9A82]" : "bg-white text-[#6B7B6E] border-[#D5DDD6]"}`}>{v}</button>
                    ))}</div>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-[#6B7B6E] mb-1">小便情况（多选）</p>
                    <div className="flex flex-wrap gap-1">{SI_URINE_OPTIONS.map(v => (
                      <button key={v} onClick={() => setSiUrine(p => p.includes(v) ? p.filter(x=>x!==v) : [...p,v])}
                        className={`px-2 py-1 rounded-lg text-[11px] border ${siUrine.includes(v) ? "bg-[#7C9A82] text-white border-[#7C9A82]" : "bg-white text-[#6B7B6E] border-[#D5DDD6]"}`}>{v}</button>
                    ))}</div>
                  </div>
                </div>
                {/* 睡眠 + 口味 + 面色 */}
                <div>
                  <p className="text-[11px] font-medium text-[#6B7B6E] mb-1">睡眠情况（多选）</p>
                  <div className="flex flex-wrap gap-1">{SI_SLEEP_OPTIONS.map(v => (
                    <button key={v} onClick={() => setSiSleep(p => p.includes(v) ? p.filter(x=>x!==v) : [...p,v])}
                      className={`px-2 py-1 rounded-lg text-[11px] border ${siSleep.includes(v) ? "bg-[#7C9A82] text-white border-[#7C9A82]" : "bg-white text-[#6B7B6E] border-[#D5DDD6]"}`}>{v}</button>
                  ))}</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] font-medium text-[#6B7B6E] mb-1">口味感觉（多选）</p>
                    <div className="flex flex-wrap gap-1">{SI_TASTE_OPTIONS.map(v => (
                      <button key={v} onClick={() => setSiTaste(p => p.includes(v) ? p.filter(x=>x!==v) : [...p,v])}
                        className={`px-2 py-1 rounded-lg text-[11px] border ${siTaste.includes(v) ? "bg-[#7C9A82] text-white border-[#7C9A82]" : "bg-white text-[#6B7B6E] border-[#D5DDD6]"}`}>{v}</button>
                    ))}</div>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-[#6B7B6E] mb-1">面色观察（多选）</p>
                    <div className="flex flex-wrap gap-1">{SI_COMPLEXION_OPTIONS.map(v => (
                      <button key={v} onClick={() => setSiComplexion(p => p.includes(v) ? p.filter(x=>x!==v) : [...p,v])}
                        className={`px-2 py-1 rounded-lg text-[11px] border ${siComplexion.includes(v) ? "bg-[#7C9A82] text-white border-[#7C9A82]" : "bg-white text-[#6B7B6E] border-[#D5DDD6]"}`}>{v}</button>
                    ))}</div>
                  </div>
                </div>
                {/* 症状特异补充（动态） */}
                {(() => {
                  const painIdx = assessments.map((a, i) => ({ a, i })).filter(({ a }) => SYMPTOM_QUESTION_MAP.pain.test(a.symptomName));
                  const sputumIdx = assessments.map((a, i) => ({ a, i })).filter(({ a }) => SYMPTOM_QUESTION_MAP.sputum.test(a.symptomName));
                  const digestIdx = assessments.map((a, i) => ({ a, i })).filter(({ a }) => SYMPTOM_QUESTION_MAP.digestion.test(a.symptomName));
                  const emotionIdx = assessments.map((a, i) => ({ a, i })).filter(({ a }) => SYMPTOM_QUESTION_MAP.emotion.test(a.symptomName));
                  if (!painIdx.length && !sputumIdx.length && !digestIdx.length && !emotionIdx.length) return null;
                  const updateDetail = (idx: number, field: string, value: string) => {
                    setSiSymptomDetails(prev => {
                      const cur = prev[idx] || {};
                      return { ...prev, [idx]: { ...cur, [field]: cur[field] === value ? undefined : value } };
                    });
                  };
                  return (
                    <div className="mt-2 pt-2 border-t border-[#D5DDD6]">
                      <p className="text-[11px] font-semibold text-[#5B7D63] mb-2">症状特异补充</p>
                      <div className="space-y-3">
                        {painIdx.map(({ a, i }) => {
                          const locs = PAIN_LOCATION_MAP[a.symptomName] || PAIN_LOCATION_MAP[Object.keys(PAIN_LOCATION_MAP).find(k => a.symptomName.includes(k)) || ""] || [];
                          const detail = siSymptomDetails[i] || {};
                          return (
                            <div key={i} className="p-2 rounded-lg bg-[#F8FAF8] border border-[#E2E8E3]">
                              <p className="text-xs font-medium text-[#3D5B45] mb-1.5">{a.symptomName}</p>
                              {locs.length > 0 && <div className="mb-1.5">
                                <span className="text-[10px] text-[#8B9E8F] mr-1">部位:</span>
                                <div className="inline-flex flex-wrap gap-1">{locs.map(v => (
                                  <button key={v} onClick={() => updateDetail(i, "painLocation", v)}
                                    className={`px-1.5 py-0.5 rounded text-[10px] border ${detail.painLocation === v ? "bg-[#C4A862] text-white border-[#C4A862]" : "bg-white text-[#6B7B6E] border-[#D5DDD6]"}`}>{v}</button>
                                ))}</div>
                              </div>}
                              <div>
                                <span className="text-[10px] text-[#8B9E8F] mr-1">性质:</span>
                                <div className="inline-flex flex-wrap gap-1">{PAIN_NATURE_OPTIONS.map(v => (
                                  <button key={v} onClick={() => updateDetail(i, "painNature", v)}
                                    className={`px-1.5 py-0.5 rounded text-[10px] border ${detail.painNature === v ? "bg-[#C4A862] text-white border-[#C4A862]" : "bg-white text-[#6B7B6E] border-[#D5DDD6]"}`}>{v}</button>
                                ))}</div>
                              </div>
                            </div>
                          );
                        })}
                        {sputumIdx.map(({ a, i }) => {
                          const detail = siSymptomDetails[i] || {};
                          return (
                            <div key={i} className="p-2 rounded-lg bg-[#F8FAF8] border border-[#E2E8E3]">
                              <p className="text-xs font-medium text-[#3D5B45] mb-1.5">{a.symptomName} — 痰的性质</p>
                              <div className="flex flex-wrap gap-1">{SPUTUM_TYPE_OPTIONS.map(v => (
                                <button key={v} onClick={() => updateDetail(i, "sputumType", v)}
                                  className={`px-1.5 py-0.5 rounded text-[10px] border ${detail.sputumType === v ? "bg-[#C4A862] text-white border-[#C4A862]" : "bg-white text-[#6B7B6E] border-[#D5DDD6]"}`}>{v}</button>
                              ))}</div>
                            </div>
                          );
                        })}
                        {digestIdx.map(({ a, i }) => {
                          const detail = siSymptomDetails[i] || {};
                          return (
                            <div key={i} className="p-2 rounded-lg bg-[#F8FAF8] border border-[#E2E8E3]">
                              <p className="text-xs font-medium text-[#3D5B45] mb-1.5">{a.symptomName} — 饮食偏好</p>
                              <div className="flex flex-wrap gap-1">{DIGESTION_DETAIL_OPTIONS.map(v => (
                                <button key={v} onClick={() => {
                                  setSiSymptomDetails(prev => {
                                    const cur = prev[i] || {};
                                    const arr: string[] = (cur as any).digestionDetail ? (cur as any).digestionDetail.split(",").filter(Boolean) : [];
                                    const next = arr.includes(v) ? arr.filter(x=>x!==v) : [...arr, v];
                                    return { ...prev, [i]: { ...cur, digestionDetail: next.join(",") || undefined } };
                                  });
                                }}
                                  className={`px-1.5 py-0.5 rounded text-[10px] border ${((detail as any).digestionDetail || "").split(",").includes(v) ? "bg-[#C4A862] text-white border-[#C4A862]" : "bg-white text-[#6B7B6E] border-[#D5DDD6]"}`}>{v}</button>
                              ))}</div>
                            </div>
                          );
                        })}
                        {emotionIdx.map(({ a, i }) => {
                          const detail = siSymptomDetails[i] || {};
                          return (
                            <div key={i} className="p-2 rounded-lg bg-[#F8FAF8] border border-[#E2E8E3]">
                              <p className="text-xs font-medium text-[#3D5B45] mb-1.5">{a.symptomName} — 情志特点</p>
                              <div className="flex flex-wrap gap-1">{EMOTION_DETAIL_OPTIONS.map(v => (
                                <button key={v} onClick={() => updateDetail(i, "emotionDetail", v)}
                                  className={`px-1.5 py-0.5 rounded text-[10px] border ${detail.emotionDetail === v ? "bg-[#C4A862] text-white border-[#C4A862]" : "bg-white text-[#6B7B6E] border-[#D5DDD6]"}`}>{v}</button>
                              ))}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </Card>

            <Card className="p-5 border-[#E2E8E3]">
              <h4 className="font-semibold text-[#2D3B2E] mb-3">四诊补充信息</h4>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-[#6B7B6E] mb-1.5">素体特征</p>
                  <div className="flex gap-2">
                    {["素体强健", "素体虚弱"].map(v => (
                      <button key={v} onClick={() => setBodyType(v === "素体强健" ? "strong" : "weak")}
                        className={`px-3 py-1.5 rounded-lg text-xs border ${bodyType === (v === "素体强健" ? "strong" : "weak") ? "bg-[#7C9A82] text-white border-[#7C9A82]" : "bg-white border-[#D5DDD6]"}`}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-[#6B7B6E] mb-1.5">环境诱因（多选）</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ENV_OPTIONS.map(v => (
                      <button key={v} onClick={() => setEnvFactors(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])}
                        className={`px-2 py-1 rounded-lg text-[11px] border ${envFactors.includes(v) ? "bg-[#E8F0EA] text-[#5B7D63] border-[#7C9A82]/40" : "bg-white text-[#6B7B6E] border-[#D5DDD6]"}`}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-[#6B7B6E] mb-1.5">舌诊信息（多选）* <span className="text-[#B0B8B1] font-normal">悬停查看说明</span></p>
                  <div className="flex flex-wrap gap-1.5">
                    {TONGUE_OPTIONS.map(v => (
                      <Tooltip key={v}>
                        <TooltipTrigger asChild>
                          <button onClick={() => setTongue(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])}
                            className={`px-2 py-1 rounded-lg text-[11px] border ${tongue.includes(v) ? "bg-[#7C9A82] text-white border-[#7C9A82]" : "bg-white text-[#6B7B6E] border-[#D5DDD6] cursor-help"}`}>
                            {v}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[220px] bg-[#2D3B2E] text-white text-[11px] leading-relaxed px-3 py-2 rounded-lg">
                          {TONGUE_ANNOTATIONS[v]}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-[#6B7B6E] mb-1.5">脉诊信息（多选）* <span className="text-[#B0B8B1] font-normal">悬停查看说明</span></p>
                  <div className="flex flex-wrap gap-1.5">
                    {PULSE_OPTIONS.map(v => (
                      <Tooltip key={v}>
                        <TooltipTrigger asChild>
                          <button onClick={() => setPulse(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])}
                            className={`px-2 py-1 rounded-lg text-[11px] border ${pulse.includes(v) ? "bg-[#C4A862] text-white border-[#C4A862]" : "bg-white text-[#6B7B6E] border-[#D5DDD6] cursor-help"}`}>
                            {v}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[220px] bg-[#2D3B2E] text-white text-[11px] leading-relaxed px-3 py-2 rounded-lg">
                          {PULSE_ANNOTATIONS[v]}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      );

      // ═══ Step 3 ═══
      case 2: {
        // 六经传变：基于症状模式的智能判定（非纯天数）
        const sevMapStage: Record<string, number> = { occasional: 1, sometimes: 2, often: 3, frequent: 4, always: 5 };
        // 六经阶段症状匹配规则：[regex, weight, level]
        // 设计原则：
        //   - primary 必须是该经的标志性辨证要点（经文"XX之为病"主症）
        //   - secondary 是辅助佐证，权重较低
        //   - 每条规则尽可能精确，避免跨经重叠
        const STAGE_RULES: Record<string, [RegExp, number, "primary" | "secondary"][]> = {
          "太阳经（表证初起）": [
            [/恶风|恶寒|畏寒|怕冷/, 0.9, "primary"],
            [/发热/, 0.8, "primary"],
            [/头痛|项强|颈项强/, 0.7, "primary"],
            [/鼻塞|流涕|鼻鸣/, 0.4, "secondary"],
            [/身痛|身疼|骨节.*痛/, 0.5, "secondary"],
          ],
          "阳明经（里热炽盛）": [
            // 阳明经提纲："胃家实是也"，核心是里热成实
            // primary 必须有明确的里热实证，口渴/口干仅作secondary
            [/高热|身热.*汗|不恶寒.*热|大汗|大热/, 0.9, "primary"],
            [/谵语|神昏|烦躁.*狂/, 0.8, "primary"],
            [/大便秘结|数日未行|燥屎/, 0.7, "primary"],
            [/口渴.*饮|口大渴|渴欲饮水/, 0.6, "secondary"],
            [/面红.*赤|目赤/, 0.5, "secondary"],
            [/腹满.*拒按|腹胀.*拒按|腹硬满/, 0.6, "secondary"],
          ],
          "少阳经（半表半里）": [
            [/寒热往来|忽冷忽热/, 0.95, "primary"],   // 一证即是
            [/胸胁.*胀|胸胁.*满|胁痛|胁胀/, 0.85, "primary"],
            [/口苦/, 0.7, "secondary"],
            [/目眩|头晕/, 0.5, "secondary"],
            [/默默.*食|不欲食|食欲不振/, 0.5, "secondary"],
            [/心烦喜呕|恶心/, 0.5, "secondary"],
          ],
          "太阴经（脾虚湿困）": [
            // 太阴提纲："腹满而吐，食不下，自利益甚"
            [/腹满|腹胀|腹痛.*喜按|腹痛.*喜温/, 0.8, "primary"],
            [/腹泻|泄泻|便溏/, 0.8, "primary"],
            [/食欲.*振|纳差|食不下/, 0.6, "secondary"],
            [/口不渴|口淡/, 0.5, "secondary"],
            [/乏力|四肢乏力|倦怠/, 0.5, "secondary"],
          ],
          "少阴经（心肾虚损）": [
            // 少阴提纲："脉微细，但欲寐也"
            [/嗜睡|但欲寐|极度.*倦|精神萎靡/, 0.9, "primary"],
            [/四肢厥冷|四肢冰冷|手足冰冷|手脚冰凉/, 0.8, "primary"],
            [/腹泻.*未消化|下利清谷|完谷不化/, 0.7, "secondary"],
            [/畏寒.*蜷|蜷卧|蜷缩/, 0.6, "secondary"],
            [/小便清长|夜尿频/, 0.5, "secondary"],
          ],
          "厥阴经（寒热错杂）": [
            // 厥阴提纲："消渴，气上撞心，心中疼热，饥而不欲食"
            [/上热下寒|四肢冷.*身热|厥热往复/, 0.9, "primary"],
            [/消渴|气上撞心|心中疼热/, 0.8, "primary"],
            [/饥.*不欲食|饥而不欲食/, 0.7, "primary"],
            [/腹泻.*痛|下利/, 0.4, "secondary"],
            [/呕吐.*蚘|吐蚘/, 0.6, "secondary"],
          ],
        };

        // 为每个症状计算六经匹配分，同时追踪 primary 匹配数
        const stageScores: Record<string, number> = {};
        const stagePrimaryCount: Record<string, number> = {};
        const stageDetails: Record<string, string[]> = {};
        // 计算每条规则匹配到的症状数（去重用）
        const stageRuleHits: Record<string, Set<string>> = {};

        for (const stage of Object.keys(STAGE_RULES)) {
          stageScores[stage] = 0;
          stagePrimaryCount[stage] = 0;
          stageDetails[stage] = [];
          stageRuleHits[stage] = new Set();
        }
        assessments.forEach(a => {
          if (!a.severity) return;
          const s = sevMapStage[a.severity] || 1;
          const name = a.symptomName;
          for (const [stage, rules] of Object.entries(STAGE_RULES)) {
            for (const [regex, weight, level] of rules) {
              if (regex.test(name)) {
                // 同一症状对同一经只计一次最高贡献
                const hitKey = `${name}::${regex.source}`;
                if (stageRuleHits[stage].has(hitKey)) continue;
                stageRuleHits[stage].add(hitKey);

                const contrib = weight * s;
                stageScores[stage] += contrib;
                if (level === "primary") stagePrimaryCount[stage]++;
                stageDetails[stage].push(`${name}(${level === "primary" ? "主" : "次"}×${weight})`);
              }
            }
          }
        });

        // 舌诊和脉诊参与六经判定（权重降低，仅作佐证）
        tongue.forEach(t => {
          if (/苔黄/.test(t))  { stageScores["阳明经（里热炽盛）"] += 0.6; stageDetails["阳明经（里热炽盛）"].push(`${t}(舌诊佐证)`); }
          if (/舌红/.test(t))  { stageScores["阳明经（里热炽盛）"] += 0.4; stageDetails["阳明经（里热炽盛）"].push(`${t}(舌诊佐证)`); }
          if (/苔白腻/.test(t)) { stageScores["太阴经（脾虚湿困）"] += 0.7; stageDetails["太阴经（脾虚湿困）"].push(`${t}(舌诊佐证)`); }
          if (/舌胖大|齿痕/.test(t)) { stageScores["太阴经（脾虚湿困）"] += 0.6; stageDetails["太阴经（脾虚湿困）"].push(`${t}(舌诊佐证)`); }
          if (/脉浮/.test(t))    { stageScores["太阳经（表证初起）"] += 0.7; }
          if (/脉弦/.test(t))    { stageScores["少阳经（半表半里）"] += 0.7; }
          if (/脉沉细|脉微/.test(t)) { stageScores["少阴经（心肾虚损）"] += 0.7; }
          if (/脉洪大/.test(t))  { stageScores["阳明经（里热炽盛）"] += 0.7; }
        });

        // ── 归一化：用各经最大可能得分的比例排名 ──
        // 每经最大得分 = Σ(weight_i × 5（最高严重度）)，分 primary/secondary 两档
        const stageMaxScores: Record<string, number> = {};
        for (const [stage, rules] of Object.entries(STAGE_RULES)) {
          let maxScore = 0;
          for (const [, weight] of rules) { maxScore += weight * 5; }
          // 加上可能的最大舌诊/脉诊加分
          maxScore += 2.0; // 预留舌脉空间
          stageMaxScores[stage] = maxScore;
        }

        // 综合分 = 归一化得分 × (1 + primary匹配加成)
        // 至少有1个 primary 匹配才有资格竞争"主要阶段"
        const compositeScores: Record<string, number> = {};
        for (const stage of Object.keys(STAGE_RULES)) {
          const normalized = stageMaxScores[stage] > 0 ? stageScores[stage] / stageMaxScores[stage] : 0;
          const primaryBoost = stagePrimaryCount[stage] > 0 ? (1 + 0.15 * stagePrimaryCount[stage]) : 0.3;
          compositeScores[stage] = normalized * primaryBoost;
        }

        // 确定最佳匹配阶段：综合分最高 且 有至少1个primary匹配
        const sortedStages = Object.entries(compositeScores).sort((a, b) => b[1] - a[1]);
        const bestStage = (sortedStages[0]?.[1] > 0 && stagePrimaryCount[sortedStages[0][0]] >= 1)
          ? sortedStages[0][0] : null;
        // 活跃阶段（归一化得分 >= 0.15 且有 primary 匹配）
        const ACTIVE_NORM_THRESHOLD = 0.15;
        const activeStages = Object.entries(compositeScores)
          .filter(([name, score]) => score >= ACTIVE_NORM_THRESHOLD && stagePrimaryCount[name] >= 1)
          .sort((a, b) => b[1] - a[1])
          .map(([name]) => name);

        // 生成每个症状的推荐六经阶段
        const symptomStages = durations.map(d => {
          if (!d.symptomName) return null;
          let bestMatch: string | null = null;
          let bestScore = 0;
          for (const [stage, rules] of Object.entries(STAGE_RULES)) {
            for (const [regex, weight] of rules) {
              if (regex.test(d.symptomName)) {
                const assessment = assessments.find(a => a.symptomName === d.symptomName);
                const sev = assessment?.severity ? (sevMapStage[assessment.severity] || 1) : 1;
                const score = weight * sev;
                if (score > bestScore) { bestScore = score; bestMatch = stage; }
              }
            }
          }
          return bestMatch;
        });

        return (
          <div className="flex flex-col lg:flex-row gap-4">
            {descPanel}
            <div className="flex-1 space-y-4">
              <Card className="p-5 border-[#E2E8E3]">
                <h4 className="font-semibold text-[#2D3B2E] mb-1">六经传变持续时日</h4>
                <p className="text-xs text-[#8B6F47] mb-3">
                  系统已根据您的症状组合自动推断六经阶段。持续时长作为辅助信息供AI参考。
                </p>
                <div className="space-y-3">
                  {durations.map((d, i) => {
                    // 症状模式推断的阶段优先，天数仅辅助
                    const patternStage = symptomStages[i];
                    const durationHint = !d.durationDays ? null :
                      d.durationDays <= 1 ? "（初起，辅助信息）" :
                      d.durationDays <= 3 ? "（≤3天，辅助信息）" :
                      d.durationDays <= 7 ? "（≤7天，辅助信息）" :
                      d.durationDays <= 14 ? "（≤14天，辅助信息）" : "（>14天，辅助信息）";
                    return (
                      <div key={i} className="p-3 rounded-xl border border-[#D5DDD6] bg-white">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm font-medium text-[#2D3B2E] w-24">{d.symptomName}</span>
                          <div className="flex items-center gap-1.5">
                            <input type="number" min={0} max={365} placeholder="天"
                              value={d.durationDays ?? ""}
                              onChange={e => {
                                const next = [...durations];
                                const days = parseInt(e.target.value) || 0;
                                // 阶段以症状模式推断为准，不按天数覆盖
                                next[i] = { ...d, durationDays: days, liuJingStage: patternStage || d.liuJingStage };
                                setDurations(next);
                              }}
                              className="w-16 p-1.5 rounded border border-[#D5DDD6] text-sm text-center"
                            />
                            <span className="text-xs text-[#6B7B6E]">天</span>
                            <input type="number" min={0} max={23} placeholder="时"
                              value={d.durationHours ?? ""}
                              onChange={e => {
                                const next = [...durations];
                                next[i] = { ...d, durationHours: parseInt(e.target.value) || 0 };
                                setDurations(next);
                              }}
                              className="w-14 p-1.5 rounded border border-[#D5DDD6] text-sm text-center"
                            />
                            <span className="text-xs text-[#6B7B6E]">小时</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {patternStage && <Badge className="bg-[#7C9A82] text-white text-[11px]">AI推断: {patternStage}</Badge>}
                          {durationHint && <Badge className="bg-[#F5F0E8] text-[#8B6F47] text-[11px]">病程{durationHint}</Badge>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-[#C4A862]">填写完成后点击「下一步」将自动触发AI辨证分析</p>
              </Card>

              {/* 六经综合分析面板 */}
              {bestStage && (
                <Card className="p-5 border-[#D5DDD6] bg-[#FAFBFA]">
                  <h4 className="font-semibold text-[#2D3B2E] mb-2 text-sm">六经传变综合判定</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#8B9E8F]">主要阶段：</span>
                      <Badge className="bg-[#7C9A82] text-white text-[11px]">{bestStage}</Badge>
                    </div>
                    {activeStages.length > 1 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#8B9E8F]">兼夹阶段：</span>
                        <div className="flex flex-wrap gap-1">
                          {activeStages.filter(s => s !== bestStage).map(s => (
                            <Badge key={s} className="bg-[#F5F0E8] text-[#8B6F47] text-[11px]">{s}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* 各阶段得分条（归一化综合分） */}
                  <div className="mt-3 space-y-1.5">
                    {Object.entries(compositeScores)
                      .filter(([, s]) => s > 0)
                      .sort((a, b) => b[1] - a[1])
                      .map(([name, score]) => {
                        const maxComp = Math.max(...Object.values(compositeScores), 0.01);
                        return (
                      <div key={name} className="flex items-center gap-2">
                        <span className="text-[10px] text-[#6B7B6E] w-36 truncate" title={name}>{name.replace(/（.+）/,"")}</span>
                        <div className="flex-1 h-1.5 bg-[#E8F0EA] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${name === bestStage ? "bg-[#7C9A82]" : score >= ACTIVE_NORM_THRESHOLD ? "bg-[#C4A862]" : "bg-[#D5DDD6]"}`}
                            style={{ width: `${Math.min(100, (score / maxComp) * 100)}%` }} />
                        </div>
                        <span className="text-[10px] text-[#A8BFAE] w-12 text-right">
                          {(score * 100).toFixed(0)}%
                          {stagePrimaryCount[name] > 0 && <span className="text-[#7C9A82] ml-0.5">★</span>}
                        </span>
                      </div>
                    );})}
                  </div>
                </Card>
              )}
            </div>
          </div>
        );
      }

      // ═══ Step 4: AI Diagnosis ═══
      case 3: return (
        <div className="flex flex-col lg:flex-row gap-4">
          {descPanel}
          <div className="flex-1 space-y-4">
            {loading && loadingStep === 3 ? (
              <AiLoadingOverlay title="AI辨证分析中" tips={AI_WAITING_TIPS.diagnosis} />
            ) : diagnosis ? (
              <>
                {/* Unified Medical Report Card */}
                <Card className="border-[#D5DDD6] shadow-sm">
                  {/* Report Header */}
                  <div className="p-5 border-b border-[#E2E8E3] bg-[#FAFBFA]">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-[#2D3B2E] tracking-wide">辨证诊断报告</h4>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-[#E8F0EA] text-[#5B7D63] font-medium">含通俗解读</span>
                      </div>
                      <span className="text-[10px] text-[#A8BFAE]">{new Date().toLocaleDateString("zh-CN")}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-2.5 rounded-md bg-white border border-[#E8ECE9]">
                        <p className="text-[10px] text-[#8B9E8F] mb-0.5">主证型</p>
                        <p className="text-sm font-bold text-[#3D5B45]">{diagnosis.primarySyndrome || '（辨证信息待补充）'}</p>
                      </div>
                      <div className="p-2.5 rounded-md bg-white border border-[#E8ECE9]">
                        <p className="text-[10px] text-[#8B9E8F] mb-0.5">治法</p>
                        <p className="text-sm font-medium text-[#2D3B2E]">{diagnosis.treatmentMethod}</p>
                      </div>
                      <div className="p-2.5 rounded-md bg-white border border-[#E8ECE9]">
                        <p className="text-[10px] text-[#8B9E8F] mb-0.5">匹配置信度</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-[#E8F0EA] rounded-full overflow-hidden">
                            <div className="h-full bg-[#7C9A82] rounded-full" style={{ width: `${(diagnosis.confidenceScore || 0) * 100}%` }} />
                          </div>
                          <span className="text-xs font-bold text-[#5B7D63]">{((diagnosis.confidenceScore || 0) * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                    {diagnosis.secondarySyndromes && (
                      <div className="mt-2 p-2 rounded-md bg-[#F9F6F0] border border-[#E8DFD0]">
                        <span className="text-[10px] text-[#8B6F47]">兼证型：</span>
                        <span className="text-xs text-[#5B4A2E]">{diagnosis.secondarySyndromes}</span>
                      </div>
                    )}
                  </div>

                  {/* Visualization Charts */}
                  <div className="p-5 border-b border-[#E2E8E3]">
                    <p className="text-[10px] font-bold text-[#8B9E8F] mb-3 tracking-wide">可视化分析</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Pie chart - syndrome distribution */}
                      <div>
                        <p className="text-[10px] text-[#A8BFAE] mb-1 text-center">证型分布</p>
                        <div id="diagnosis-chart" className="h-44" ref={el => {
                          if (el && diagnosis.structuredResult) {
                            renderChart("diagnosis-chart", {
                              tooltip: { trigger: "item" },
                              series: [{
                                type: "pie", radius: ["40%", "70%"],
                                data: Array.isArray(diagnosis.structuredResult) ? diagnosis.structuredResult : [
                                  { value: (diagnosis.confidenceScore || 0.7) * 100, name: diagnosis.primarySyndrome, itemStyle: { color: "#7C9A82" } },
                                  { value: (1 - (diagnosis.confidenceScore || 0.7)) * 100, name: "其他", itemStyle: { color: "#E8F0EA" } },
                                ],
                                label: { fontSize: 10, color: "#6B7B6E" },
                              }],
                            });
                          }
                        }} />
                      </div>

                      {/* Radar chart - 八纲辨证 */}
                      <div>
                        <p className="text-[10px] text-[#A8BFAE] mb-1 text-center">八纲辨证（←阴 / 阳→）</p>
                        <div id="radar-chart" className="h-44" ref={el => {
                          if (el) {
                            const radarAll = getRadarData();
                            // 过滤出轴数据（排除 patterns 和 severity）
                            const radarData = radarAll.filter((d: any) => typeof d.value === "number") as { name: string; value: number }[];
                            renderChart("radar-chart", {
                              radar: {
                                indicator: radarData.map(d => ({ name: d.name, max: 100, min: 0 })),
                                shape: "circle",
                                splitNumber: 4,
                                axisName: { color: "#6B7B6E", fontSize: 9 },
                                splitArea: { areaStyle: { color: ["#FAFBFA", "#F0F4F1", "#E8F0EA", "#E2E8E3"] } },
                                splitLine: { lineStyle: { color: "#D5DDD6" } },
                              },
                              series: [{
                                type: "radar",
                                data: [{
                                  value: radarData.map(d => d.value),
                                  name: "八纲分布",
                                  areaStyle: { color: "rgba(124,154,130,0.25)" },
                                  lineStyle: { color: "#7C9A82", width: 2 },
                                  itemStyle: { color: "#5B7D63" },
                                }],
                              }],
                              tooltip: {
                                trigger: "item",
                                formatter: (params: any) => {
                                  const vals = params.value as number[];
                                  const labels = ["表←→里", "寒←→热", "虚←→实", "阴←→阳"];
                                  const interp = (v: number, left: string, right: string) =>
                                    v > 65 ? `偏${right}` : v < 35 ? `偏${left}` : "不明确";
                                  return labels.map((l, i) =>
                                    `${l}: ${vals[i]} (${interp(vals[i], l.split("←→")[0], l.split("←→")[1])})`
                                  ).join("<br/>");
                                },
                              },
                            });
                          }
                        }} />
                        {/* 证型判别标签 */}
                        {(() => {
                          const radarAll = getRadarData();
                          const patternsData = radarAll.find((d: any) => d.patterns) as { patterns: string[] } | undefined;
                          if (patternsData && patternsData.patterns.length > 0) {
                            return (
                              <div className="flex flex-wrap gap-1 mt-1 justify-center">
                                {patternsData.patterns.map((p: string, i: number) => (
                                  <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#E8F0EA] text-[#5B7D63] border border-[#D5DDD6]">
                                    {p}
                                  </span>
                                ))}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      {/* Bar chart - meridian analysis */}
                      <div>
                        <p className="text-[10px] text-[#A8BFAE] mb-1 text-center">经络归经分析</p>
                        <div id="meridian-chart" className="h-44" ref={el => {
                          if (el) {
                            const barData = getMeridianBarData().filter(d => d.value > 0);
                            if (barData.length === 0) {
                              // Show all meridians at 0
                              renderChart("meridian-chart", {
                                xAxis: { type: "category", data: getMeridianBarData().map(d => d.name), axisLabel: { fontSize: 9, rotate: 30, color: "#A8BFAE" } },
                                yAxis: { type: "value", show: false },
                                series: [{ type: "bar", data: getMeridianBarData().map(d => d.value), itemStyle: { color: "#E8F0EA" }, barWidth: "60%" }],
                                grid: { top: 5, bottom: 30, left: 5, right: 5 },
                              });
                            } else {
                              renderChart("meridian-chart", {
                                xAxis: { type: "category", data: barData.map(d => d.name), axisLabel: { fontSize: 9, rotate: 30, color: "#6B7B6E" } },
                                yAxis: { type: "value", show: false },
                                series: [{ type: "bar", data: barData.map(d => d.value), itemStyle: { color: "#7C9A82" }, barWidth: "50%",
                                  label: { show: true, position: "top", fontSize: 10, color: "#5B7D63", formatter: "{c}" } }],
                                grid: { top: 15, bottom: 30, left: 5, right: 5 },
                                tooltip: { trigger: "axis" },
                              });
                            }
                          }
                        }} />
                      </div>
                    </div>

                    {/* Quick info below charts */}
                    <div className="mt-3 pt-3 border-t border-[#E8ECE9]">
                      {diagnosis.structuredResult && typeof diagnosis.structuredResult === "object" && !Array.isArray(diagnosis.structuredResult) && (() => {
                        const sr = diagnosis.structuredResult as Record<string, unknown>;
                        const formulaRec = sr.formulaRecommendation as string | undefined;
                        const acupoints = sr.acupoints as string[] | undefined;
                        return (
                          <div className="flex flex-wrap gap-4">
                            {formulaRec && (
                              <div className="flex-1 min-w-[200px]">
                                <p className="text-[10px] text-[#8B9E8F] mb-0.5 font-medium">方药推荐</p>
                                <p className="text-sm font-semibold text-[#3D5B45] leading-relaxed">{formulaRec}</p>
                              </div>
                            )}
                            {acupoints && acupoints.length > 0 && (
                              <div>
                                <p className="text-[10px] text-[#8B9E8F] mb-0.5 font-medium">针灸/指压</p>
                                <div className="flex flex-wrap gap-1">
                                  {acupoints.map((pt, i) => (
                                    <span key={i} className="inline-block px-2 py-0.5 rounded text-[11px] bg-[#E8F0EA] text-[#5B7D63]">{pt}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Detailed Analysis - Document Style */}
                  {diagnosis.structuredResult && typeof diagnosis.structuredResult === "object" && !Array.isArray(diagnosis.structuredResult) && (() => {
                    const sr = diagnosis.structuredResult as Record<string, unknown>;
                    const dietAdvice = sr.dietAdvice as string | undefined;
                    const lifestyleAdvice = sr.lifestyleAdvice as string | undefined;
                    const fullAnalysis = sr.fullAnalysis as string | undefined;
                    return (
                      <div className="p-5">
                        {fullAnalysis && (
                          <div className="mb-5">
                            {renderStructuredAnalysis(fullAnalysis)}
                          </div>
                        )}
                        {(dietAdvice || lifestyleAdvice) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-[#E2E8E3]">
                            {dietAdvice && (
                              <div className="p-3 rounded-md bg-[#FAFBF7] border border-[#E8DFD0]/50">
                                <p className="text-[10px] font-medium text-[#8B6F47] mb-1.5">食疗药膳</p>
                                <p className="text-xs text-[#2D3B2E] leading-relaxed">{dietAdvice}</p>
                              </div>
                            )}
                            {lifestyleAdvice && (
                              <div className="p-3 rounded-md bg-[#F7FAF7] border border-[#D5DDD6]/50">
                                <p className="text-[10px] font-medium text-[#5B7D63] mb-1.5">养生调护</p>
                                <p className="text-xs text-[#2D3B2E] leading-relaxed">{lifestyleAdvice}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Print button */}
                  <div className="px-5 pb-4">
                    <Button variant="outline" size="sm" className="text-[11px] border-[#D5DDD6] text-[#6B7B6E]" onClick={handlePrintReport}>
                      <Download className="h-3 w-3 mr-1" />导出报告
                    </Button>
                  </div>
                </Card>
              </>
            ) : (
              <Card className="p-12 text-center border-[#E2E8E3]">
                <p className="text-[#A8BFAE]">等待AI分析...</p>
                <Button className="mt-4 bg-[#7C9A82] hover:bg-[#5B7D63] text-white" onClick={triggerDiagnosis}>
                  开始AI辨证分析
                </Button>
              </Card>
            )}
          </div>
        </div>
      );

      // ═══ Step 5: Combined Formula + 疗效评估（合并展示）═══
      case 4: return (
        <div className="flex flex-col lg:flex-row gap-4">
          {descPanel}
          <div className="flex-1 space-y-4">
            {/* ── 上半部分：合病合方分析 ── */}
            {loading && loadingStep === 4 ? (
              <AiLoadingOverlay title="合病合方分析中" tips={AI_WAITING_TIPS.combined} />
            ) : step5Result ? (
              <Card className="border-[#D5DDD6] shadow-sm">
                <div className="p-5 border-b border-[#E2E8E3] bg-[#FAFBFA]">
                  <h4 className="text-base font-bold text-[#2D3B2E] tracking-wide">合病合方分析</h4>
                </div>
                <div className="p-5">
                  <div className="flex gap-4 mb-4 p-2.5 rounded-md bg-[#FAFAF5] border border-[#E8DFD0]/50">
                    <div><span className="text-[10px] text-[#8B9E8F]">主证</span><p className="text-xs font-medium text-[#3D5B45]">{diagnosis?.primarySyndrome || '待复核'}</p></div>
                    <div><span className="text-[10px] text-[#8B9E8F]">兼证</span><p className="text-xs font-medium text-[#3D5B45]">{diagnosis?.secondarySyndromes || '无'}</p></div>
                  </div>
                  {step5Result.analysis && (
                    <div className="mb-4">
                      <h5 className="text-xs font-bold text-[#8B9E8F] mb-2 tracking-wide">合病分析</h5>
                      <div className="text-sm text-[#2D3B2E] leading-relaxed">{renderContentLines(decodeHtmlEntities(step5Result.analysis), combinedAnalysisFallback())}</div>
                    </div>
                  )}
                  {step5Result.formula && (
                    <div className="mb-4 pt-4 border-t border-[#E2E8E3]">
                      <h5 className="text-xs font-bold text-[#8B9E8F] mb-2 tracking-wide">合方推荐</h5>
                      <div className="text-sm text-[#2D3B2E] leading-relaxed">{renderContentLines(decodeHtmlEntities(step5Result.formula), combinedFormulaFallback())}</div>
                    </div>
                  )}
                  {step5Result.modification && (
                    <div className="pt-4 border-t border-[#E2E8E3]">
                      <h5 className="text-xs font-bold text-[#8B9E8F] mb-2 tracking-wide">加减化裁</h5>
                      <div className="text-sm text-[#2D3B2E] leading-relaxed">{renderContentLines(decodeHtmlEntities(step5Result.modification), combinedModificationFallback())}</div>
                    </div>
                  )}
                  {!step5Result.analysis && !step5Result.formula && !step5Result.modification && (
                    <p className="text-sm text-[#A8BFAE] text-center py-4">当前辨证未检测到典型合病，可继续下一步</p>
                  )}
                </div>
              </Card>
            ) : (
              <Card className="p-5 border-[#E2E8E3]">
                <h4 className="font-semibold text-[#2D3B2E] mb-3">合病合方分析</h4>
                {diagnosis?.secondarySyndromes ? (
                  <div className="space-y-4">
                    <div className="p-3 rounded-lg bg-[#F5F0E8]/50 border border-[#C4A62]/20">
                      <p className="text-sm text-[#8B6F47]">检测到多证型并存，点击「下一步」启动AI合方分析</p>
                      <p className="text-sm font-medium text-[#2D3B2E] mt-1">主证：{diagnosis.primarySyndrome || '待复核'}</p>
                      <p className="text-sm text-[#2D3B2E]">兼证：{diagnosis.secondarySyndromes || '无'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button onClick={() => setAppliedCombined(true)}
                        className={`text-sm ${appliedCombined ? "bg-[#5B7D63]" : "bg-[#7C9A82]"} text-white`}>
                        <CheckCircle2 className="h-4 w-4 mr-1" />{appliedCombined ? "已采纳合方" : "使用合方"}
                      </Button>
                      <span className="text-xs text-[#A8BFAE]">点击「下一步」将自动触发AI分析</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[#A8BFAE] text-center py-8">当前辨证未检测到多证型并存，无需合方</p>
                )}
              </Card>
            )}

            {/* ── 下半部分：疗效评估表单（仅在合方分析完成后显示）── */}
            {step5Result && !step6Result && (
              <>
                <div className="pt-2 pb-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-[#D5DDD6]" />
                    <span className="text-[10px] font-bold text-[#8B9E8F] tracking-wider">疗效评估</span>
                    <div className="flex-1 h-px bg-[#D5DDD6]" />
                  </div>
                </div>

                <Card className="p-5 border-[#E2E8E3]">
                  <h4 className="font-semibold text-[#2D3B2E] mb-3">整体疗效评估</h4>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "much_better", label: "明显好转", color: "bg-green-100 text-green-700 border-green-300" },
                      { value: "better", label: "好转", color: "bg-[#E8F0EA] text-[#5B7D63] border-[#7C9A82]/30" },
                      { value: "no_change", label: "无变化", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
                      { value: "worse", label: "加重", color: "bg-red-50 text-red-700 border-red-200" },
                    ].map(opt => (
                      <button key={opt.value} onClick={() => setOverallEval(opt.value)}
                        className={`px-4 py-2 rounded-lg text-sm border font-medium transition-all ${
                          overallEval === opt.value ? opt.color + " ring-2 ring-offset-1 ring-[#7C9A82]" : "bg-white text-[#6B7B6E] border-[#D5DDD6]"
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </Card>

                <Card className="p-5 border-[#E2E8E3]">
                  <h4 className="font-semibold text-[#2D3B2E] mb-3">各症状复诊评估</h4>
                  <div className="space-y-2">
                    {assessments.map(a => (
                      <div key={a.symptomId} className="flex items-center gap-3 p-2 rounded-lg border border-[#D5DDD6]">
                        <span className="text-sm text-[#2D3B2E] w-24">{a.symptomName}</span>
                        <div className="flex gap-1.5">
                          {["消失", "好转", "无变化", "加重"].map(v => (
                            <button key={v}
                              onClick={() => setSymptomEvals(prev => ({ ...prev, [a.symptomId]: v }))}
                              className={`px-2 py-0.5 rounded text-[11px] border ${
                                symptomEvals[a.symptomId] === v ? "bg-[#7C9A82] text-white border-[#7C9A82]" : "bg-[#F0F4F1] text-[#6B7B6E] border-[#D5DDD6]"
                              }`}>{v}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-5 border-[#E2E8E3]">
                  <h4 className="font-semibold text-[#2D3B2E] mb-3">反馈意见</h4>
                  <Textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)}
                    placeholder="请输入疗效反馈或调整建议..." className="min-h-[80px] border-[#D5DDD6]" />
                </Card>
                <p className="text-xs text-[#C4A862]">填写完成后点击「下一步」将自动触发AI疗效评估</p>
              </>
            )}

            {/* 疗效评估已完成时显示结果 */}
            {step5Result && step6Result?.adjustedPlan && (
              <Card className="border-[#D5DDD6] shadow-sm">
                <div className="p-5 border-b border-[#E2E8E3] bg-[#FAFBFA]">
                  <h4 className="text-base font-bold text-[#2D3B2E] tracking-wide">调整后治疗方案</h4>
                </div>
                <div className="p-5">
                  <div className="text-sm text-[#2D3B2E] leading-relaxed">{renderContentLines(decodeHtmlEntities(step6Result.adjustedPlan || ""), followupFallback())}</div>
                </div>
              </Card>
            )}
            {step5Result && step6Result && !step6Result.adjustedPlan && (
              <Card className="p-5 border-[#E2E8E3] bg-[#FAFBFA]">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-5 w-5 text-[#5B7D63]" />
                  <h4 className="text-sm font-semibold text-[#5B7D63]">疗效评估已完成</h4>
                </div>
                <p className="text-xs text-[#8B9E8F]">AI已根据您的反馈完成分析。如需进入多专家会诊，请点击「下一步」。</p>
              </Card>
            )}
          </div>
        </div>
      );

      // ═══ Step 6: Follow-up ═══
      case 5: return (
        <div className="flex flex-col lg:flex-row gap-4">
          {descPanel}
          <div className="flex-1 space-y-4">
            {loading && loadingStep === 5 ? (
              <AiLoadingOverlay title="AI疗效评估中" tips={AI_WAITING_TIPS.followup} />
            ) : step6Result?.adjustedPlan ? (
              <Card className="border-[#D5DDD6] shadow-sm">
                <div className="p-5 border-b border-[#E2E8E3] bg-[#FAFBFA]">
                  <h4 className="text-base font-bold text-[#2D3B2E] tracking-wide">调整后治疗方案</h4>
                </div>
                <div className="p-5">
                  <div className="text-sm text-[#2D3B2E] leading-relaxed">{renderContentLines(decodeHtmlEntities(step6Result.adjustedPlan || ""), followupFallback())}</div>
                </div>
              </Card>
            ) : step6Result ? (
              <Card className="p-5 border-[#E2E8E3] bg-[#FAFBFA]">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-5 w-5 text-[#5B7D63]" />
                  <h4 className="text-sm font-semibold text-[#5B7D63]">疗效评估已完成</h4>
                </div>
                <p className="text-xs text-[#8B9E8F]">AI已根据您的反馈完成分析。如需进入多专家会诊，请点击「下一步」。</p>
              </Card>
            ) : (
              <AiLoadingOverlay title="AI疗效评估中" tips={AI_WAITING_TIPS.followup} />
            )}
          </div>
        </div>
      );

      // ═══ Step 7: Multi-school Consultation ═══
      case 6: return (
        <div className="flex flex-col lg:flex-row gap-4">
          {descPanel}
          <div className="flex-1 space-y-4">
            {loading && loadingStep === 6 ? (
              <AiLoadingOverlay title="多流派专家会诊中" tips={AI_WAITING_TIPS.consultation} />
            ) : consultRawText ? (
              <Card className="border-[#D5DDD6] shadow-sm">
                {/* Report Header */}
                <div className="p-5 border-b border-[#E2E8E3] bg-[#FAFBFA]">
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-bold text-[#2D3B2E] tracking-wide">多流派会诊报告</h4>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="text-[11px] border-[#D5DDD6] text-[#6B7B6E]" onClick={handlePrintReport}>
                        <FileText className="h-3 w-3 mr-1" />导出
                      </Button>
                      <Button variant="outline" size="sm" className="text-[11px] border-[#D5DDD6] text-[#C4A862]"
                        onClick={() => { setConsultRawText(null); setFinalPlan(null); }}>
                        <RefreshCcw className="h-3 w-3 mr-1" />重新生成
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Consultation Content */}
                <div className="p-5">
                  {renderStructuredAnalysis(cleanAiDisplayText(consultRawText, consultationFallback()))}
                </div>

                {/* Final Plan */}
                {finalPlan && (
                  <div className="border-t border-[#E2E8E3]">
                    <div className="p-5 bg-[#FAFAF5]">
                      <h5 className="text-xs font-bold text-[#8B6F47] mb-3 tracking-wide">最终综合方案</h5>
                      <div className="text-sm text-[#2D3B2E] leading-relaxed">
                        {renderContentLines(decodeHtmlEntities(finalPlan), followupFallback())}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            ) : (
              <Card className="p-8 text-center border-[#E2E8E3]">
                <Users className="h-12 w-12 mx-auto text-[#A8BFAE] mb-4" />
                <h4 className="font-semibold text-[#2D3B2E] mb-2">多流派专家会诊</h4>
                <p className="text-sm text-[#6B7B6E] mb-4">
                  AI将从伤寒学派、温病学派、脏腑辨证、经络辨证四个流派分别分析您的病情，给出综合会诊意见。
                </p>
                <Button onClick={generateConsultation} disabled={loading}
                  className="bg-[#7C9A82] hover:bg-[#5B7D63] text-white">
                  <Brain className="h-4 w-4 mr-2" />启动多流派会诊
                </Button>
              </Card>
            )}
          </div>
        </div>
      );

      default: return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#5B7D63] to-[#C4A862] flex items-center justify-center shadow-md">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#2D3B2E]">向导式AI中医辨证诊疗</h1>
          <p className="text-xs text-[#6B7B6E]">7步结构化辨证 · 数据联动 · 全流程闭环</p>
        </div>
      </div>

      <StepIndicator current={currentStep} maxReached={maxReached} onStepClick={goToStep} />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          <span className="text-sm text-red-700 flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-xs text-red-500">关闭</button>
        </div>
      )}

      {renderStepContent()}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={goPrev}
          className={`border-[#D5DDD6] text-[#5B7D63] ${currentStep === 0 ? "invisible" : ""}`}>
          <ChevronLeft className="h-4 w-4 mr-1" />上一步
        </Button>

        <p className="text-[10px] text-[#A8BFAE] max-w-[60%] text-center leading-tight">{COMPLIANCE_TEXT}</p>

        <Button onClick={handleNext} disabled={loading}
          className="bg-[#7C9A82] hover:bg-[#5B7D63] text-white">
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          {currentStep === 6 ? "完成诊疗流程" : <>下一步<ChevronRight className="h-4 w-4 ml-1" /></>}
        </Button>
      </div>
    </div>
  );
}
