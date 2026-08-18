import { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import {
  Send, Sparkles, Lock, Loader2, BookMarked, ChevronUp, ChevronDown,
  Eye, HeartPulse, Stethoscope, StopCircle, Users, RefreshCcw,
  Clock, Activity, BarChart3, AlertTriangle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useNavigate } from "react-router";
import { sendChatMessageStream, ChatMessage } from "../../lib/ai";
import { MarkdownRenderer } from "../components/ui/markdown-renderer";
import {
  saveConversation,
  getConversationList,
  getConversationDetail,
  deleteConversation,
  ChatConversation,
} from "../../lib/chat";

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

interface ChatMessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SEVERITY_LEVELS = [
  { value: "occasional", label: "偶尔（略微）", short: "偶尔" },
  { value: "sometimes", label: "较少（有点）", short: "较少" },
  { value: "often", label: "较多（一般）", short: "较多" },
  { value: "frequent", label: "很多（非常）", short: "很多" },
  { value: "always", label: "总是（极其）", short: "总是" },
];

const MERIDIAN_TIME = [
  { value: "zi", label: "子时 23-1点", meridian: "胆经" },
  { value: "chou", label: "丑时 1-3点", meridian: "肝经" },
  { value: "yin", label: "寅时 3-5点", meridian: "肺经" },
  { value: "mao", label: "卯时 5-7点", meridian: "大肠经" },
  { value: "chen", label: "辰时 7-9点", meridian: "胃经" },
  { value: "si", label: "巳时 9-11点", meridian: "脾经" },
  { value: "wu", label: "午时 11-13点", meridian: "心经" },
  { value: "wei", label: "未时 13-15点", meridian: "小肠经" },
  { value: "shen", label: "申时 15-17点", meridian: "膀胱经" },
  { value: "you", label: "酉时 17-19点", meridian: "肾经" },
  { value: "xu", label: "戌时 19-21点", meridian: "心包经" },
  { value: "hai", label: "亥时 21-23点", meridian: "三焦经" },
];

const DURATION_STAGES = [
  { value: "1-3d", label: "1-3天", stage: "太阳经（表证初起）" },
  { value: "4-7d", label: "4-7天", stage: "阳明/少阳经（入里化热）" },
  { value: "1-2w", label: "1-2周", stage: "太阴经（脾虚湿困）" },
  { value: "2-4w", label: "2-4周", stage: "少阴经（心肾虚损）" },
  { value: "1m+", label: "1个月以上", stage: "厥阴经（寒热错杂）" },
];

const CONCURRENT_SYMPTOMS = [
  "头痛", "头晕", "发热", "怕冷", "出汗异常", "口渴",
  "口苦", "失眠", "多梦", "心悸", "胸闷", "气短",
  "食欲不振", "恶心", "腹胀", "便秘", "腹泻", "尿频",
  "腰痛", "关节痛", "肢体麻木", "乏力", "面色萎黄", "面色苍白",
  "舌质淡", "舌质红", "舌苔白", "舌苔黄", "脉浮", "脉沉",
];

interface StructuredData {
  severity: string | null;
  meridianTime: string | null;
  duration: string | null;
  observation: string;
  hearingSmell: string;
  inquiry: string;
  pulseTongue: string;
  concurrent: string[];
}

// ---------------------------------------------------------------------------
// Structured Diagnosis Panel
// ---------------------------------------------------------------------------

function StructuredDiagnosisPanel({
  data,
  onChange,
  isZh,
}: {
  data: StructuredData;
  onChange: (d: StructuredData) => void;
  isZh: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Severity */}
      <div>
        <label className="flex items-center gap-1.5 text-sm font-medium text-[#2D3B2E] mb-2">
          <BarChart3 className="h-4 w-4 text-[#7C9A82]" />
          {isZh ? "症候程度评估" : "Symptom Severity"}
        </label>
        <div className="flex flex-wrap gap-2">
          {SEVERITY_LEVELS.map((lv) => (
            <button
              key={lv.value}
              onClick={() =>
                onChange({
                  ...data,
                  severity: data.severity === lv.value ? null : lv.value,
                })
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                data.severity === lv.value
                  ? "bg-[#7C9A82] text-white border-[#7C9A82]"
                  : "bg-white text-[#6B7B6E] border-[#D5DDD6] hover:border-[#7C9A82]/50"
              }`}
            >
              {lv.short}
            </button>
          ))}
        </div>
      </div>

      {/* Meridian Time */}
      <div>
        <label className="flex items-center gap-1.5 text-sm font-medium text-[#2D3B2E] mb-2">
          <Clock className="h-4 w-4 text-[#7C9A82]" />
          {isZh ? "子午归经（发作时间）" : "Meridian Time"}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {MERIDIAN_TIME.map((mt) => (
            <button
              key={mt.value}
              onClick={() =>
                onChange({
                  ...data,
                  meridianTime: data.meridianTime === mt.value ? null : mt.value,
                })
              }
              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all border ${
                data.meridianTime === mt.value
                  ? "bg-[#5B7D63] text-white border-[#5B7D63]"
                  : "bg-white text-[#6B7B6E] border-[#D5DDD6] hover:border-[#7C9A82]/50"
              }`}
            >
              {mt.label}
              {data.meridianTime === mt.value && (
                <span className="ml-1 opacity-80">→ {mt.meridian}</span>
              )}
            </button>
          ))}
        </div>
        {data.meridianTime && (
          <p className="mt-1.5 text-xs text-[#5B7D63] font-medium">
            → 对应经络：{MERIDIAN_TIME.find((m) => m.value === data.meridianTime)?.meridian}
          </p>
        )}
      </div>

      {/* Duration / Six-Channel */}
      <div>
        <label className="flex items-center gap-1.5 text-sm font-medium text-[#2D3B2E] mb-2">
          <Activity className="h-4 w-4 text-[#7C9A82]" />
          {isZh ? "六经传变（持续时日）" : "Duration / Six-Channel"}
        </label>
        <div className="flex flex-wrap gap-2">
          {DURATION_STAGES.map((ds) => (
            <button
              key={ds.value}
              onClick={() =>
                onChange({
                  ...data,
                  duration: data.duration === ds.value ? null : ds.value,
                })
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                data.duration === ds.value
                  ? "bg-[#C4A862] text-white border-[#C4A862]"
                  : "bg-white text-[#6B7B6E] border-[#D5DDD6] hover:border-[#C4A862]/50"
              }`}
            >
              {ds.label}
              {data.duration === ds.value && (
                <span className="ml-1 opacity-80">→ {ds.stage.split("（")[0]}</span>
              )}
            </button>
          ))}
        </div>
        {data.duration && (
          <p className="mt-1.5 text-xs text-[#8B6F47] font-medium">
            → 传变阶段：{DURATION_STAGES.find((d) => d.value === data.duration)?.stage}
          </p>
        )}
      </div>

      {/* Four Diagnostics */}
      <div className="rounded-xl border border-[#D5DDD6] bg-[#F8FAF8] p-3 space-y-3">
        <div>
          <p className="text-sm font-medium text-[#2D3B2E]">
            {isZh ? "四诊合参补充（选填）" : "Four Diagnostics Notes"}
          </p>
          <p className="text-xs text-[#6B7B6E] mt-1">
            {isZh ? "参考中医诊断学望闻问切与十问歌，补充越完整，系统越能形成主证、兼证、病位、病性和证据链。" : "More complete notes help build evidence-based syndrome differentiation."}
          </p>
          {isZh && (
            <p className="text-[11px] text-[#8B6F47] mt-1 leading-relaxed">
              建议按这些关键词填写：望诊看面色、舌质舌苔、皮肤形态；闻诊听声音咳喘、辨口气体味；问诊问寒热汗、饮食二便、睡眠情绪、病程诱因；切诊补脉象、按压痛、局部冷热。
            </p>
          )}
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <Textarea
            value={data.observation}
            onChange={(e) => onChange({ ...data, observation: e.target.value })}
            placeholder={isZh ? "望诊：面色红/白/黄/青？舌质淡/红/暗？舌苔白/黄/厚/腻？皮肤颜色、形态、体态等" : "Inspection: complexion, tongue body/coating, skin, posture"}
            className="min-h-[86px] bg-white border-[#D5DDD6] text-sm"
          />
          <Textarea
            value={data.hearingSmell}
            onChange={(e) => onChange({ ...data, hearingSmell: e.target.value })}
            placeholder={isZh ? "闻诊：声音高低、有无咳嗽喘息、口气、体味、痰声等" : "Listening/smelling: voice, cough, wheeze, odor"}
            className="min-h-[86px] bg-white border-[#D5DDD6] text-sm"
          />
          <Textarea
            value={data.inquiry}
            onChange={(e) => onChange({ ...data, inquiry: e.target.value })}
            placeholder={isZh ? "问诊：寒热、汗出、头身胸腹、饮食口味、大小便、睡眠、情绪、病程、诱因、既往史" : "Inquiry: chills/fever, sweat, diet, stool, sleep, mood, course"}
            className="min-h-[86px] bg-white border-[#D5DDD6] text-sm"
          />
          <Textarea
            value={data.pulseTongue}
            onChange={(e) => onChange({ ...data, pulseTongue: e.target.value })}
            placeholder={isZh ? "切诊/舌脉：脉浮/沉/迟/数/弦/滑/细？腹部或局部按压痛、冷热、硬结？" : "Palpation/tongue-pulse: pulse, tenderness, local cold/heat"}
            className="min-h-[86px] bg-white border-[#D5DDD6] text-sm"
          />
        </div>
      </div>

      {/* Concurrent Symptoms */}
      <div>
        <label className="flex items-center gap-1.5 text-sm font-medium text-[#2D3B2E] mb-2">
          <AlertTriangle className="h-4 w-4 text-[#C4A862]" />
          {isZh ? "兼证（可多选）" : "Concurrent Symptoms"}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {CONCURRENT_SYMPTOMS.map((sym) => {
            const selected = data.concurrent.includes(sym);
            return (
              <button
                key={sym}
                onClick={() =>
                  onChange({
                    ...data,
                    concurrent: selected
                      ? data.concurrent.filter((s) => s !== sym)
                      : [...data.concurrent, sym],
                  })
                }
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
                  selected
                    ? "bg-[#E8F0EA] text-[#5B7D63] border-[#7C9A82]/40"
                    : "bg-white text-[#6B7B6E] border-[#D5DDD6] hover:border-[#7C9A82]/30"
                }`}
              >
                {sym}
              </button>
            );
          })}
        </div>
        {data.concurrent.length > 0 && (
          <p className="mt-1.5 text-xs text-[#7C9A82]">
            已选 {data.concurrent.length} 项：{data.concurrent.join("、")}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function TCMDiagnosis() {
  const { isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const isZh = language === "zh";
  const navigate = useNavigate();
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: "0",
      role: "assistant",
      content: isZh
        ? "欢迎使用千方慧鉴问诊系统。请描述您的症状或健康问题，我将结合望、闻、问、切与多种辨证体系，为您提供中医综合辨证分析。\n\n您也可以展开下方的「结构化问诊」面板，补充症状程度、发作时间、持续时间、舌脉/面色/睡眠饮食等维度，获得更完整的四诊合参结果。"
        : "Welcome to the Smart TCM Diagnosis System. Please describe your symptoms or health issues.\n\nYou can also expand the 'Structured Diagnosis' panel below to select severity, onset time, duration and more for a more precise analysis.",
    },
  ]);
  const loadingMessageId = useRef<string | null>(null);
  const loadingContent = useRef("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Structured diagnosis data
  const [structuredData, setStructuredData] = useState<StructuredData>({
    severity: null,
    meridianTime: null,
    duration: null,
    observation: "",
    hearingSmell: "",
    inquiry: "",
    pulseTongue: "",
    concurrent: [],
  });
  const [panelOpen, setPanelOpen] = useState(false);

  // Stop current AI generation
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    loadingMessageId.current = null;
    setLoading(false);
    setMessages((prev) =>
      prev.filter((m) => !(m.role === "assistant" && m.id === loadingMessageId.current && !m.content))
    );
  }, []);

  // Conversation history state
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
  const [conversationListOpen, setConversationListOpen] = useState(false);

  const loadConversations = useCallback(async () => {
    if (!isAuthenticated) return;
    setConversationsLoading(true);
    try {
      const data = await getConversationList(1, 50);
      setConversations(data.items || []);
    } catch (e) {
      console.error("加载对话历史失败:", e);
      setConversations([]);
    } finally {
      setConversationsLoading(false);
    }
  }, [isAuthenticated]);

  const loadConversationDetail = async (conversationId: number) => {
    try {
      setLoading(true);
      const data = await getConversationDetail(conversationId);
      const loadedMessages: ChatMessageItem[] = data.messages.map((msg) => ({
        id: msg.id.toString(),
        role: msg.role,
        content: msg.content,
      }));
      setMessages(loadedMessages);
      setCurrentConversationId(conversationId);
      setConversationListOpen(false);
    } catch (e) {
      console.error("加载对话详情失败:", e);
    } finally {
      setLoading(false);
    }
  };

  const startNewConversation = () => {
    setMessages([
      {
        id: "0",
        role: "assistant",
        content: isZh
          ? "欢迎使用千方慧鉴问诊系统。请描述您的症状或健康问题，我将结合望、闻、问、切与多种辨证体系，为您提供中医综合辨证分析。\n\n您也可以展开下方的「结构化问诊」面板，补充症状程度、发作时间、持续时间、舌脉/面色/睡眠饮食等维度，获得更完整的四诊合参结果。"
          : "Welcome to the Smart TCM Diagnosis System. Please describe your symptoms.\n\nExpand the 'Structured Diagnosis' panel below for a more precise analysis.",
      },
    ]);
    setCurrentConversationId(null);
    setConversationListOpen(false);
    setStructuredData({
      severity: null,
      meridianTime: null,
      duration: null,
      observation: "",
      hearingSmell: "",
      inquiry: "",
      pulseTongue: "",
      concurrent: [],
    });
  };

  const saveCurrentConversation = async () => {
    if (!isAuthenticated || messages.length <= 1) return;
    const messagesToSave = messages
      .filter((m) => m.role === "user" || (m.role === "assistant" && m.content))
      .map((m) => ({ role: m.role, content: m.content }));
    try {
      const result = await saveConversation({
        id: currentConversationId || undefined,
        title: messages[1]?.content?.slice(0, 30) || "新对话",
        messages: messagesToSave,
      });
      setCurrentConversationId(result.id);
    } catch (e) {
      console.error("保存对话失败:", e);
    }
  };

  const handleDeleteConversation = async (conversationId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteConversation(conversationId);
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      if (currentConversationId === conversationId) {
        startNewConversation();
      }
    } catch (e) {
      console.error("删除对话失败:", e);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadConversations();
  }, [isAuthenticated, loadConversations]);

  // Track whether user has scrolled up away from bottom
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // If user is within 80px of bottom, consider them "at bottom"
      userScrolledUp.current = scrollHeight - scrollTop - clientHeight > 80;
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Only auto-scroll if user hasn't scrolled up
  useEffect(() => {
    if (!userScrolledUp.current) {
      const isStreaming = loadingMessageId.current !== null;
      if (isStreaming && chatContainerRef.current) {
        // 流式输出期间使用瞬时滚动，避免平滑动画堆叠导致滚轮失控
        const container = chatContainerRef.current;
        container.scrollTop = container.scrollHeight;
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages]);

  // Build structured message with collected data
  const buildStructuredPrefix = useCallback((): string => {
    const parts: string[] = [];
    if (structuredData.severity) {
      const sv = SEVERITY_LEVELS.find((l) => l.value === structuredData.severity);
      if (sv) parts.push(`【症候程度】${sv.label}`);
    }
    if (structuredData.meridianTime) {
      const mt = MERIDIAN_TIME.find((m) => m.value === structuredData.meridianTime);
      if (mt) parts.push(`【子午归经·发作时间】${mt.label}（对应${mt.meridian}）`);
    }
    if (structuredData.duration) {
      const ds = DURATION_STAGES.find((d) => d.value === structuredData.duration);
      if (ds) parts.push(`【六经传变·持续时日】${ds.label}（${ds.stage}）`);
    }
    if (structuredData.concurrent.length > 0) {
      parts.push(`【兼证/伴随症状】${structuredData.concurrent.join("、")}`);
    }
    if (structuredData.observation.trim()) {
      parts.push(`【望诊信息】${structuredData.observation.trim()}`);
    }
    if (structuredData.hearingSmell.trim()) {
      parts.push(`【闻诊信息】${structuredData.hearingSmell.trim()}`);
    }
    if (structuredData.inquiry.trim()) {
      parts.push(`【问诊补充】${structuredData.inquiry.trim()}`);
    }
    if (structuredData.pulseTongue.trim()) {
      parts.push(`【切诊/舌脉信息】${structuredData.pulseTongue.trim()}`);
    }
    if (parts.length > 0) {
      parts.unshift("【四诊合参结构化资料】请结合望、闻、问、切进行综合辨证，缺失信息请提示补充，避免只按单一症状诊断。");
    }
    return parts.length > 0 ? parts.join("\n") + "\n\n" : "";
  }, [structuredData]);

  // Core send function
  const doSend = useCallback(
    async (content: string, currentMessages: ChatMessageItem[]) => {
      if (loading) stopGeneration();

      const userMessage: ChatMessageItem = {
        id: Date.now().toString(),
        role: "user",
        content,
      };
      const assistantId = (Date.now() + 1).toString();
      const assistantPlaceholder: ChatMessageItem = {
        id: assistantId,
        role: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
      setLoading(true);
      setError(null);
      loadingMessageId.current = assistantId;
      loadingContent.current = "";

      const conversationHistory: ChatMessage[] = currentMessages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      await sendChatMessageStream(
        content,
        conversationHistory,
        {
          onChunk: (text: string) => {
            loadingContent.current += text;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: loadingContent.current } : m
              )
            );
          },
          onComplete: () => {
            loadingMessageId.current = null;
            abortControllerRef.current = null;
            setLoading(false);
            saveCurrentConversation();
          },
          onError: (err: Error) => {
            loadingMessageId.current = null;
            abortControllerRef.current = null;
            console.error("AI API error:", err);
            setError(isZh ? "发送失败，请重试" : "Failed to send. Please try again.");
            setLoading(false);
            setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          },
        },
        { signal: abortController.signal }
      );
    },
    [loading, stopGeneration, isZh]
  );

  const handleSendMessage = async () => {
    if (!isAuthenticated || !inputMessage.trim()) return;
    const prefix = buildStructuredPrefix();
    const fullMessage = prefix + inputMessage.trim();
    const currentMessages = [...messages];
    setInputMessage("");
    // Clear structured data after sending
    setStructuredData({
      severity: null,
      meridianTime: null,
      duration: null,
      observation: "",
      hearingSmell: "",
      inquiry: "",
      pulseTongue: "",
      concurrent: [],
    });
    await doSend(fullMessage, currentMessages);
  };

  const sendQuickMessage = async (content: string) => {
    if (!isAuthenticated) return;
    await doSend(content, [...messages]);
  };

  // Quick action definitions
  const quickActions = [
    {
      icon: <Eye className="h-5 w-5 mb-1" />,
      label: isZh ? "望诊分析" : "Visual Diagnosis",
      description: isZh ? "面色、舌象、形态等望诊辨证" : "Facial, tongue, and posture analysis",
      message: isZh
        ? "请帮我进行望诊分析，我想了解中医望诊的相关知识，包括面色诊察、舌诊、形态观察等方面的辨证要点。"
        : "Please help me with visual diagnosis analysis.",
      color: "border-[#7C9A82]/30 hover:border-[#7C9A82] hover:bg-[#E8F0EA]/30",
    },
    {
      icon: <HeartPulse className="h-5 w-5 mb-1" />,
      label: isZh ? "体质辨识" : "Constitution ID",
      description: isZh ? "中医九种体质分类与调理建议" : "Nine TCM constitution types",
      message: isZh
        ? "请帮我进行中医体质辨识，分析我可能属于哪种体质类型，并给出相应的调理建议。"
        : "Please identify my TCM constitution type and provide adjustment suggestions.",
      color: "border-[#C4A862]/30 hover:border-[#C4A862] hover:bg-[#F5F0E8]/30",
    },
    {
      icon: <Stethoscope className="h-5 w-5 mb-1" />,
      label: isZh ? "常见症状咨询" : "Common Symptoms",
      description: isZh ? "头痛、失眠、消化不良等常见症状" : "Headache, insomnia, indigestion, etc.",
      message: isZh
        ? "我想咨询一些常见症状的中医辨证分析，如头痛、失眠、消化不良、疲劳等症状可能对应的中医证型及调理方法。"
        : "I want to consult about common symptoms from a TCM perspective.",
      color: "border-[#7C9A82]/30 hover:border-[#7C9A82] hover:bg-[#E8F0EA]/30",
    },
    {
      icon: <Users className="h-5 w-5 mb-1" />,
      label: isZh ? "多流派会诊" : "Multi-School Consult",
      description: isZh ? "伤寒/温病/脏腑多视角辨证" : "Multi-perspective diagnosis",
      message: isZh
        ? "请从多流派会诊的角度分析我的症状。请分别从以下学术流派的视角进行辨证分析：\n1. 伤寒学派视角（六经辨证）\n2. 温病学派视角（卫气营血/三焦辨证）\n3. 脏腑辨证视角\n4. 经络辨证视角\n\n请各流派分别给出辨证结论和治法方药建议，最后给出综合会诊意见。"
        : "Please analyze my symptoms from a multi-school consultation perspective, covering: Six-Channel, Four-Level, Zang-Fu, and Meridian differentiation approaches. Provide a comprehensive consultation summary.",
      color: "border-[#5B7D63]/30 hover:border-[#5B7D63] hover:bg-[#E8F0EA]/30",
    },
    {
      icon: <RefreshCcw className="h-5 w-5 mb-1" />,
      label: isZh ? "复诊评估" : "Follow-up Assessment",
      description: isZh ? "疗效反馈与方案调整" : "Treatment feedback & adjustment",
      message: isZh
        ? "我来复诊了。"
        : "I'm here for a follow-up visit.",
      color: "border-[#C4A862]/30 hover:border-[#C4A862] hover:bg-[#F5F0E8]/30",
      isFollowUp: true,
    },
  ];

  // Handle follow-up click - load last conversation summary
  const handleFollowUp = async (action: (typeof quickActions)[number]) => {
    if (!isAuthenticated) return;

    // Try to load the latest conversation for context
    if (conversations.length > 0) {
      const lastConv = conversations[0];
      try {
        const detail = await getConversationDetail(lastConv.id);
        const msgs = detail.messages;
        const summary = msgs
          .filter((m) => m.content)
          .map((m) => `${m.role === "user" ? "患者" : "AI"}：${m.content.slice(0, 100)}`)
          .join("\n");

        const followUpMsg = isZh
          ? `【复诊模式】以下是上次问诊记录：\n${summary}\n\n请根据以上记录，作为复诊接待。先询问我的疗效情况（明显好转/好转/无变化/加重），然后根据我的反馈调整治疗方案。`
          : `【Follow-up Mode】Previous diagnosis record:\n${summary}\n\nPlease start the follow-up process by asking about my treatment efficacy.`;

        await doSend(followUpMsg, [...messages]);
      } catch {
        await doSend(action.message, [...messages]);
      }
    } else {
      await doSend(action.message, [...messages]);
    }
  };

  return (
    <div className="space-y-6 max-w-full">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2 text-[#2D3B2E]">
          <Sparkles className="h-5 w-5 text-[#7C9A82]" />
          {isZh ? "中医智能问诊" : "TCM Intelligent Diagnosis"}
        </h2>

        {isAuthenticated && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setConversationListOpen((prev) => {
                  const next = !prev;
                  if (next) loadConversations();
                  return next;
                });
              }}
              className="text-xs border-[#D5DDD6] text-[#5B7D63]"
            >
              <BookMarked className="h-4 w-4 mr-1" />
              {isZh ? "问诊记录" : "Records"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={startNewConversation}
              className="text-xs border-[#D5DDD6] text-[#5B7D63]"
            >
              <Sparkles className="h-4 w-4 mr-1" />
              {isZh ? "新的问诊" : "New"}
            </Button>
          </div>
        )}
      </div>

      {/* Conversation history sidebar */}
      {conversationListOpen && (
        <Card className="p-4 mb-4 border-[#7C9A82]/30 bg-[#F0F4F1]/50 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm text-[#2D3B2E]">
              {isZh ? "问诊记录" : "Diagnosis Records"}
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setConversationListOpen(false)}>
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
          {conversationsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-sm text-[#6B7B6E] text-center py-4">
              {isZh ? "暂无问诊记录" : "No diagnosis records yet"}
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`p-2 rounded-xl cursor-pointer text-sm hover:bg-[#E8F0EA] transition-colors ${
                    currentConversationId === conv.id
                      ? "bg-[#E8F0EA] border border-[#7C9A82]/30"
                      : ""
                  }`}
                  onClick={() => loadConversationDetail(conv.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate flex-1 text-[#2D3B2E]">
                      {conv.title || (isZh ? "新问诊" : "New Diagnosis")}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-[#6B7B6E] hover:text-red-600 hover:bg-red-50"
                      onClick={(e) => handleDeleteConversation(conv.id, e)}
                    >
                      {isZh ? "删除" : "Delete"}
                    </Button>
                  </div>
                  <p className="text-xs text-[#A8BFAE] mt-1">
                    {new Date(conv.updatedAt).toLocaleString("zh-CN")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.58fr)_minmax(320px,0.82fr)] xl:items-start">
      {/* Chat area */}
      <Card className="p-6 border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
        <div ref={chatContainerRef} className="h-[30rem] overflow-y-auto space-y-4 mb-4">
          {messages.map((message, index) => (
            <div key={message.id || index}>
              <div
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] p-4 rounded-2xl ${
                    message.role === "user"
                      ? "bg-[#7C9A82] text-white"
                      : "bg-[#F0F4F1] text-[#2D3B2E]"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <MarkdownRenderer content={message.content} />
                  ) : (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <span className="text-sm text-red-800">{error}</span>
            <Button size="sm" variant="ghost" onClick={() => setError(null)}>
              {isZh ? "关闭" : "Close"}
            </Button>
          </div>
        )}

        {!isAuthenticated && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                {isZh ? "请登录后使用中医问诊功能" : "Please log in to use the diagnosis feature"}
              </span>
            </div>
            <Button size="sm" onClick={() => navigate("/login")}>
              {isZh ? "立即登录" : "Log In"}
            </Button>
          </div>
        )}

        {/* Structured diagnosis panel */}
        <div className="mb-4">
          <button
            onClick={() => setPanelOpen((p) => !p)}
            className="flex items-center gap-2 text-sm font-medium text-[#5B7D63] hover:text-[#7C9A82] transition-colors w-full py-2"
          >
            {panelOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {isZh ? "结构化问诊（症候程度 · 子午归经 · 六经传变 · 兼证）" : "Structured Diagnosis"}
            {!panelOpen && (structuredData.severity || structuredData.meridianTime || structuredData.duration || structuredData.concurrent.length > 0) && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-[#7C9A82] text-white text-[10px]">
                {[
                  structuredData.severity && "程度",
                  structuredData.meridianTime && "时间",
                  structuredData.duration && "时日",
                  structuredData.concurrent.length > 0 && "兼证",
                ]
                  .filter(Boolean)
                  .length}项已选
              </span>
            )}
          </button>
          {panelOpen && (
            <Card className="p-4 border-[#D5DDD6] bg-white/80 rounded-xl">
              <StructuredDiagnosisPanel
                data={structuredData}
                onChange={setStructuredData}
                isZh={isZh}
              />
              <div className="mt-3 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-[#6B7B6E]"
                  onClick={() =>
                    setStructuredData({
                      severity: null,
                      meridianTime: null,
                      duration: null,
                      concurrent: [],
                    })
                  }
                >
                  {isZh ? "清空选项" : "Clear All"}
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Input area */}
        <div className="flex gap-2">
          <Textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={
              isAuthenticated
                ? loading
                  ? isZh
                    ? "输入新问题可打断当前回复..."
                    : "Type a new message to interrupt..."
                  : "请描述您的症状，如：头痛、失眠、消化不良..."
                : isZh
                  ? "请先登录后输入症状..."
                  : "Please log in first..."
            }
            className="min-h-[60px] border-[#D5DDD6] focus:border-[#7C9A82]"
            disabled={!isAuthenticated}
            onKeyPress={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          {loading ? (
            <Button
              onClick={stopGeneration}
              className="px-6 bg-red-500 hover:bg-red-600 text-white shrink-0"
              title={isZh ? "停止生成" : "Stop generation"}
            >
              <StopCircle className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSendMessage}
              className="px-6 bg-[#7C9A82] hover:bg-[#5B7D63] text-white shrink-0"
              disabled={!isAuthenticated || !inputMessage.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </Card>

      <div className="xl:col-span-1 space-y-4">
        <Card className="p-5 border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#2D3B2E]">{isZh ? "AI 分析面板" : "AI Analysis Panel"}</h3>
              <p className="mt-1 text-xs text-[#6B7B6E]">{isZh ? "按问诊阶段沉淀证候、归经、病程与追问建议。" : "Syndrome, meridian, duration and follow-up cues."}</p>
            </div>
            <Activity className="h-5 w-5 text-[#7C9A82]" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {[
              [isZh ? "症候程度" : "Severity", structuredData.severity ? SEVERITY_LEVELS.find((lv) => lv.value === structuredData.severity)?.short : (isZh ? "待选择" : "Pending")],
              [isZh ? "子午归经" : "Meridian", structuredData.meridianTime ? MERIDIAN_TIME.find((mt) => mt.value === structuredData.meridianTime)?.meridian : (isZh ? "待选择" : "Pending")],
              [isZh ? "六经阶段" : "Stage", structuredData.duration ? DURATION_STAGES.find((ds) => ds.value === structuredData.duration)?.stage.split("（")[0] : (isZh ? "待选择" : "Pending")],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-[#E2E8E3] bg-[#F7FAF5] p-3">
                <div className="text-[11px] text-[#6B7B6E]">{label}</div>
                <div className="mt-1 truncate text-sm font-semibold text-[#2D3B2E]">{value}</div>
              </div>
            ))}
          </div>
        </Card>

      {/* Quick action buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
        {quickActions.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            className={`h-auto p-3 flex flex-col items-center text-center ${action.color}`}
            disabled={!isAuthenticated}
            onClick={() =>
              action.isFollowUp
                ? handleFollowUp(action)
                : sendQuickMessage(action.message)
            }
          >
            {action.icon}
            <span className="font-medium text-sm text-[#2D3B2E]">{action.label}</span>
            <span className="text-[11px] text-[#6B7B6E] mt-0.5">{action.description}</span>
          </Button>
        ))}
      </div>
      </div>
      </div>
    </div>
  );
}
