import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Search,
  ChevronRight,
  Loader2,
  ChevronLeft,
  SlidersHorizontal,
  X,
  BookOpen,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router";
import {
  getQuestions,
  getCategoryOptions,
  searchQuestions,
  getQuestionDetail,
  getKnowledgeGraphOverview,
  getQuestionKnowledgeGraph,
  syncKnowledgeGraph,
  Question,
  CategoryOptions,
  KnowledgeGraphResponse,
} from "../../lib/questions";
import { isAuthenticated as checkAuthToken } from "../../lib/auth";

const PAGE_SIZE = 20;

// TCM-specific knowledge type options
const TCM_KNOWLEDGE_TYPES = ["中药", "方剂", "穴位", "理论", "经络"];
const TCM_CATEGORIES = ["中药学", "方剂学", "针灸学", "中医基础理论", "经络学说"];

export default function TCMKnowledge() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const todayKey = new Date().toLocaleDateString("sv-SE");
  const gardenSearchParams = new URLSearchParams(window.location.search);
  const isGardenSunTask = gardenSearchParams.get("gardenTask") === "sun";
  const gardenRequestId = gardenSearchParams.get("requestId") || "";
  const gardenSunProofKey = `qfhj_garden_sun_proof_v2_${todayKey}`;
  const gardenSunPendingKey = "qfhj_garden_sun_pending_v2";
  const gardenSunReadEntryKey = `qfhj_garden_sun_read_entry_${todayKey}`;
  const gardenReadTimerRef = useRef<number | null>(null);
  const readGardenJson = <T,>(key: string): T | null => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      window.localStorage.removeItem(key);
      return null;
    }
  };
  const hasGardenStudyProof = () => {
    const proof = readGardenJson<{ status?: string; date?: string; requestId?: string; entryId?: number; readMs?: number; verifiedAt?: number }>(gardenSunProofKey);
    return !!proof && proof.status === "verified" && proof.date === todayKey && proof.requestId === gardenRequestId && !!proof.entryId && (proof.readMs ?? 0) >= 8000;
  };
  const [gardenStudyVerified, setGardenStudyVerified] = useState(() => isGardenSunTask && !!gardenRequestId && hasGardenStudyProof());

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Active filter values
  const [filters, setFilters] = useState({
    questionType: "",
    primaryProject: "",
    secondaryProject: "",
  });

  // Category options fetched from API (secondary projects come from backend)
  const [categoryOptions, setCategoryOptions] = useState<CategoryOptions | null>(null);

  // Knowledge list & pagination
  const [entries, setEntries] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Loading & error states
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detail view
  const [selectedEntry, setSelectedEntry] = useState<Question | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Neo4j graph view
  const [graph, setGraph] = useState<KnowledgeGraphResponse | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [syncingGraph, setSyncingGraph] = useState(false);

  // Load category options on mount
  useEffect(() => {
    getCategoryOptions()
      .then((opts) => {
        setCategoryOptions(opts);
      })
      .catch(() => {
        /* silently ignore -- filters just won't be populated */
      });
  }, []);

  const loadGraphOverview = useCallback(async (keyword?: string) => {
    setGraphLoading(true);
    setGraphError(null);
    try {
      const data = await getKnowledgeGraphOverview({ q: keyword?.trim() || undefined, limit: 42 });
      setGraph(data);
    } catch (err) {
      setGraphError((err as Error).message || "Neo4j 图谱加载失败");
    } finally {
      setGraphLoading(false);
    }
  }, []);

  const handleGraphSync = async () => {
    setSyncingGraph(true);
    setGraphError(null);
    try {
      await syncKnowledgeGraph(500);
      await loadGraphOverview(searchQuery || searchInput);
    } catch (err) {
      setGraphError((err as Error).message || "Neo4j 同步失败，请确认 qfhj-neo4j 容器已启动");
    } finally {
      setSyncingGraph(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadGraphOverview(searchQuery);
    }
  }, [isAuthenticated, searchQuery, loadGraphOverview]);

  // Fetch knowledge list
  const loadEntries = useCallback(
    async (pageNum: number, q?: string) => {
      if (q && q.trim().length >= 2) {
        setSearching(true);
        setError(null);
        try {
          const result = await searchQuestions({
            q: q.trim(),
            skip: pageNum - 1,
            limit: PAGE_SIZE,
          });
          setEntries(result.questions);
          setTotal(result.total);
          setTotalPages(result.totalPages);
          setPage(pageNum);
        } catch (err) {
          setError((err as Error).message || "搜索失败");
        } finally {
          setSearching(false);
        }
      } else {
        setLoading(true);
        setError(null);
        try {
          const result = await getQuestions({
            skip: pageNum - 1,
            limit: PAGE_SIZE,
            searchText: searchQuery.trim() || undefined,
            ...filters,
          });
          setEntries(result.questions);
          setTotal(result.total);
          setTotalPages(result.totalPages);
          setPage(pageNum);
        } catch (err) {
          setError((err as Error).message || "加载失败");
        } finally {
          setLoading(false);
        }
      }
    },
    [searchQuery, filters]
  );

  // Load on mount & whenever filters/page/search change
  useEffect(() => {
    if (isAuthenticated) {
      loadEntries(1);
    }
  }, [searchQuery, filters, isAuthenticated]);

  const handleSearch = () => {
    setSearchQuery(searchInput);
    setPage(1);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleTagClick = (tag: string, type: "questionType" | "primaryProject") => {
    setSearchInput("");
    setSearchQuery("");
    setFilters((prev) => ({
      ...prev,
      questionType: type === "questionType" ? tag : prev.questionType,
      primaryProject: type === "primaryProject" ? tag : prev.primaryProject,
    }));
    setPage(1);
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const clearFilter = (key: keyof typeof filters) => {
    setFilters((prev) => ({ ...prev, [key]: "" }));
  };

  const clearAllFilters = () => {
    setFilters({
      questionType: "",
      primaryProject: "",
      secondaryProject: "",
    });
  };

  const openDetail = async (id: number) => {
    if (gardenReadTimerRef.current) {
      window.clearTimeout(gardenReadTimerRef.current);
      gardenReadTimerRef.current = null;
    }
    setDetailLoading(true);
    setGraphLoading(true);
    setGraphError(null);
    setDetailError(null);
    setSelectedEntry(null);
    try {
      const detail = await getQuestionDetail(id);
      setSelectedEntry(detail);
      getQuestionKnowledgeGraph(id)
        .then(setGraph)
        .catch((graphErr) => setGraphError((graphErr as Error).message || "该知识条目的 Neo4j 图谱加载失败"))
        .finally(() => setGraphLoading(false));
      if (isGardenSunTask && gardenRequestId) {
        const pending = readGardenJson<{ date?: string; requestId?: string; source?: string }>(gardenSunPendingKey);
        if (pending?.date === todayKey && pending.requestId === gardenRequestId && pending.source === "profile-garden") {
          window.localStorage.setItem(gardenSunReadEntryKey, String(id));
          const startedReadingAt = Date.now();
          gardenReadTimerRef.current = window.setTimeout(() => {
            const stillReadingSameEntry = window.localStorage.getItem(gardenSunReadEntryKey) === String(id);
            const latestPending = readGardenJson<{ date?: string; requestId?: string; source?: string }>(gardenSunPendingKey);
            const stillPendingThisRequest = latestPending?.date === todayKey && latestPending.requestId === gardenRequestId && latestPending.source === "profile-garden";
            if (!stillReadingSameEntry || !stillPendingThisRequest) return;
            window.localStorage.setItem(gardenSunProofKey, JSON.stringify({
              status: "verified",
              date: todayKey,
              requestId: gardenRequestId,
              entryId: id,
              readMs: Date.now() - startedReadingAt,
              verifiedAt: Date.now(),
            }));
            window.localStorage.removeItem(gardenSunPendingKey);
            setGardenStudyVerified(true);
            gardenReadTimerRef.current = null;
          }, 8000);
        }
      }
    } catch (err) {
      setDetailError((err as Error).message || "加载详情失败");
      setGraphLoading(false);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (gardenReadTimerRef.current) window.clearTimeout(gardenReadTimerRef.current);
      window.localStorage.removeItem(gardenSunReadEntryKey);
    };
  }, [gardenSunReadEntryKey]);

  const closeDetail = () => {
    if (gardenReadTimerRef.current) {
      window.clearTimeout(gardenReadTimerRef.current);
      gardenReadTimerRef.current = null;
    }
    window.localStorage.removeItem(gardenSunReadEntryKey);
    setSelectedEntry(null);
  };

  // Derive a short summary from the entry content
  const getSummary = (entry: Question): string => {
    if (entry.knowledgePoint) return entry.knowledgePoint;
    if (entry.answer) {
      const text = entry.answer.replace(/\[图片:[^\]]+\]/g, "").trim();
      if (text.length > 120) return text.slice(0, 120) + "...";
      return text;
    }
    if (entry.options) {
      const text = entry.options.replace(/\[图片:[^\]]+\]/g, "").trim();
      if (text.length > 120) return text.slice(0, 120) + "...";
      return text;
    }
    if (entry.coreConnotation) return entry.coreConnotation;
    return "";
  };

  // Map backend questionType to TCM knowledge type label
  const getKnowledgeTypeLabel = (entry: Question): string | null => {
    if (entry.questionType) return entry.questionType;
    if (entry.questionCategory) return entry.questionCategory;
    return null;
  };

  // Get category badge color based on knowledge type
  const getTypeBadgeClass = (type: string | null): string => {
    if (!type) return "bg-gray-100 text-gray-700";
    const lower = type.toLowerCase();
    if (lower.includes("药材") || lower.includes("中药"))
      return "bg-[#E8F0EA] text-[#2D3B2E]";
    if (lower.includes("方剂")) return "bg-red-100 text-[#5B7D63]";
    if (lower.includes("穴位") || lower.includes("针灸"))
      return "bg-emerald-100 text-emerald-800";
    if (lower.includes("理论") || lower.includes("基础"))
      return "bg-blue-100 text-blue-800";
    if (lower.includes("诊断") || lower.includes("症状"))
      return "bg-purple-100 text-purple-800";
    return "bg-[#F0F4F1] text-[#6B7B6E]";
  };

  const getGraphNodeClass = (type?: string) => {
    const value = type || "概念";
    if (value.includes("题目")) return "border-[#7C9A82] bg-[#F7FAF5] text-[#315038]";
    if (value.includes("中药")) return "border-[#B7D7AA] bg-[#EEF7EA] text-[#315038]";
    if (value.includes("方剂")) return "border-[#EAC6B5] bg-[#FFF3ED] text-[#7A4D32]";
    if (value.includes("功效")) return "border-[#C9E6D3] bg-[#F0FBF4] text-[#38664A]";
    if (value.includes("经络") || value.includes("穴")) return "border-[#B9D9D2] bg-[#ECF8F5] text-[#23605A]";
    return "border-[#DDEAD8] bg-white text-[#5B7D63]";
  };

  const graphStats = graph?.stats ?? {};
  const graphNodes = graph?.nodes ?? [];
  const graphLinks = graph?.links ?? [];
  const visibleGraphNodes = graphNodes.slice(0, compactGraphLimit(false));
  const visibleGraphLinks = graphLinks.slice(0, 10);
  const graphReady = (graphStats.questions ?? 0) > 0 || graphNodes.length > 0;
  const activeGraphKeyword = (searchQuery || searchInput).trim();

  function compactGraphLimit(compact: boolean) {
    return compact ? 8 : 12;
  }

  const readableGraphError = (message?: string | null) => {
    if (!message) return "知识地图暂时没有准备好";
    if (message.includes("401") || message.includes("Unauthorized")) return "请先登录，再查看知识地图";
    if (message.includes("No static resource")) return "后端服务还没有刷新到新版，请重启 qfhj 后再试";
    if (message.includes("Failed to fetch") || message.includes("NetworkError")) return "后端或 Neo4j 连接暂时不可用，请确认本地服务正在运行";
    return message;
  };

  const relationLabel = (relation: string) => {
    const map: Record<string, string> = {
      RELATED_TO: "关联",
      HAS_ENTITY: "包含",
      BELONGS_TO: "属于",
      SAME_CATEGORY: "同类",
      MENTIONS: "提到",
      HAS_EFFECT: "功效",
    };
    return map[relation] || relation || "关联";
  };

  const handleGraphQuickStart = async () => {
    if (!graphReady) {
      await handleGraphSync();
      return;
    }
    await loadGraphOverview(activeGraphKeyword || undefined);
  };

  const renderGraphPanel = (compact = false) => {
    const panelNodes = graphNodes.slice(0, compactGraphLimit(compact));
    const topRelatedQuestions = (graph?.questions ?? []).slice(0, compact ? 2 : 3);
    const hasKeyword = activeGraphKeyword.length > 0;

    return (
      <Card className={`${compact ? "p-4" : "overflow-hidden p-0"} border-[#DDEAD8] bg-gradient-to-br from-[#F7FAF5] via-white to-[#FFF8ED] shadow-sm`}>
        {!compact && (
          <div className="border-b border-[#E2E8E3] bg-[#F7FAF5]/80 px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#5B7D63] px-2.5 py-1 text-xs font-bold text-white">知识地图</span>
                  <span className="rounded-full border border-[#CFE0D1] bg-white px-2.5 py-1 text-xs font-medium text-[#5B7D63]">Neo4j 后台驱动</span>
                  <h2 className="text-lg font-bold text-[#315038]">把复杂图数据库变成“一看就懂”的学习路线</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#657A66]">
                  不需要懂 Neo4j：你只要搜索一个词，系统会自动找出相关知识、草药/方剂/功效等关联，并给出可继续点击学习的结果。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={handleGraphQuickStart}
                  className="bg-[#7C9A82] text-white hover:bg-[#5B7D63]"
                  disabled={graphLoading || syncingGraph}
                >
                  {(graphLoading || syncingGraph) ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                  {graphReady ? "查看关联结果" : "一键生成知识地图"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => loadGraphOverview(activeGraphKeyword || undefined)}
                  className="border-[#D5DDD6] text-[#5B7D63]"
                  disabled={graphLoading || syncingGraph}
                >
                  刷新
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className={compact ? "space-y-3" : "space-y-4 p-5"}>
          {!compact && (
            <div className="grid gap-3 md:grid-cols-3">
              {[
                { label: "1. 搜索", value: hasKeyword ? `正在查看“${activeGraphKeyword}”` : "输入关键词，例如：失眠、陈皮、脾胃", tone: "bg-[#FFF8ED]" },
                { label: "2. 自动找关系", value: "Neo4j 在后台连接知识点", tone: "bg-[#F0F8F1]" },
                { label: "3. 得到结果", value: "看相关知识、关联概念和学习入口", tone: "bg-[#F6FAF7]" },
              ].map((step) => (
                <div key={step.label} className={`rounded-2xl border border-[#E2E8E3] ${step.tone} p-3`}>
                  <div className="text-xs font-bold text-[#7C9A82]">{step.label}</div>
                  <div className="mt-1 text-sm font-medium text-[#315038]">{step.value}</div>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[#E2E8E3] bg-white/85 p-3">
              <div className="text-xs text-[#7C9A82]">已整理知识</div>
              <div className="text-2xl font-bold text-[#315038]">{graphStats.questions ?? 0}</div>
              <div className="text-[11px] text-[#8CA58F]">可直接打开学习</div>
            </div>
            <div className="rounded-xl border border-[#E2E8E3] bg-white/85 p-3">
              <div className="text-xs text-[#7C9A82]">关联概念</div>
              <div className="text-2xl font-bold text-[#315038]">{graphStats.entities ?? 0}</div>
              <div className="text-[11px] text-[#8CA58F]">中药、方剂、功效等</div>
            </div>
            <div className="rounded-xl border border-[#E2E8E3] bg-white/85 p-3">
              <div className="text-xs text-[#7C9A82]">知识关系</div>
              <div className="text-2xl font-bold text-[#315038]">{graphStats.relations ?? 0}</div>
              <div className="text-[11px] text-[#8CA58F]">谁和谁有关</div>
            </div>
          </div>

          {graphError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <div className="font-bold">知识地图暂时无法显示</div>
              <div className="mt-1">{readableGraphError(graphError)}</div>
              <div className="mt-2 text-xs text-amber-700">你仍然可以正常使用下方知识列表；修好连接后点击“刷新”即可恢复知识地图。</div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-[#E2E8E3] bg-white/75 p-4">
            {graphLoading && !graph ? (
              <div className="flex items-center justify-center py-8 text-[#6B7B6E]">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 正在整理知识关系，请稍等...
              </div>
            ) : panelNodes.length === 0 ? (
              <div className="py-8 text-center">
                <div className="text-base font-bold text-[#315038]">还没有生成知识地图</div>
                <p className="mt-2 text-sm text-[#6B7B6E]">点击“一键生成知识地图”，系统会自动把现有知识整理成可查看的关联网络。</p>
                <Button
                  type="button"
                  onClick={handleGraphSync}
                  className="mt-4 bg-[#7C9A82] text-white hover:bg-[#5B7D63]"
                  disabled={syncingGraph}
                >
                  {syncingGraph ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                  一键生成知识地图
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {topRelatedQuestions.length > 0 && !compact ? (
                  <div>
                    <div className="mb-2 text-sm font-bold text-[#315038]">推荐先看</div>
                    <div className="grid gap-2 md:grid-cols-3">
                      {topRelatedQuestions.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => openDetail(item.id)}
                          className="rounded-xl border border-[#DDEAD8] bg-[#F7FAF5] p-3 text-left text-sm text-[#315038] transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <div className="line-clamp-2 font-semibold">{item.question}</div>
                          <div className="mt-1 text-xs text-[#7C9A82]">点击查看详情</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div>
                  <div className="mb-2 text-sm font-bold text-[#315038]">关联概念</div>
                  <div className="flex flex-wrap gap-2">
                    {panelNodes.map((node, index) => (
                      <button
                        type="button"
                        key={node.id}
                        onClick={() => node.questionId && openDetail(node.questionId)}
                        className={`max-w-[190px] rounded-2xl border px-3 py-2 text-left text-xs shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${getGraphNodeClass(node.type)}`}
                        title={node.description || node.label}
                      >
                        <div className="font-bold line-clamp-1">{index === 0 ? "◎ " : "• "}{node.label}</div>
                        <div className="mt-1 text-[11px] opacity-70">{node.type || "概念"}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {visibleGraphLinks.length > 0 && (
                  <div>
                    <div className="mb-2 text-sm font-bold text-[#315038]">为什么有关</div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {visibleGraphLinks.map((link, index) => {
                        const source = graphNodes.find((node) => node.id === link.source)?.label || link.source;
                        const target = graphNodes.find((node) => node.id === link.target)?.label || link.target;
                        return (
                          <div key={`${link.source}-${link.target}-${index}`} className="rounded-lg bg-[#F7FAF5] px-3 py-2 text-xs text-[#5B7D63]">
                            <span className="font-medium text-[#315038]">{source}</span>
                            <span className="mx-2 text-[#A8BFAE]">→ {relationLabel(link.relation)} →</span>
                            <span>{target}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {graph?.message && !compact ? <p className="text-xs text-[#8CA58F]">{graph.message}</p> : null}
        </div>
      </Card>
    );
  };

  // Filter field definitions with TCM labels
  const filterFields: {
    key: keyof typeof filters;
    label: string;
    options: string[];
  }[] = [
    {
      key: "questionType",
      label: "知识类型",
      options: TCM_KNOWLEDGE_TYPES,
    },
    {
      key: "primaryProject",
      label: "分类",
      options: TCM_CATEGORIES,
    },
    {
      key: "secondaryProject",
      label: "子分类",
      options: categoryOptions?.secondaryProjects ?? [],
    },
  ];

  // Filter pill labels
  const filterLabels: Record<string, string> = {
    questionType: "知识类型",
    primaryProject: "分类",
    secondaryProject: "子分类",
  };

  return (
    <div className="space-y-6 max-w-full">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-7 w-7 text-[#5B7D63]" />
          <h1 className="text-2xl font-bold text-[#5B7D63]">中医知识库</h1>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#F7F2E8] px-3 py-1.5 text-xs font-bold text-[#8B6F47] ring-1 ring-[#EAD8A6]">
          <span>Neo4j 知识图谱</span>
        </div>
      </div>

      {isGardenSunTask && (
        <Card className="border-[#DDEAD8] bg-[#F7FAF5] p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-bold text-[#315038]">草本小园任务：晒太阳学习</div>
              <p className="mt-1 text-xs leading-5 text-[#657A66]">
                请打开任意一条中医知识详情并阅读片刻；系统确认后，才能回到草本小园领取“光照”奖励。
              </p>
            </div>
            <Button
              type="button"
              disabled={!gardenStudyVerified}
              onClick={() => navigate("/?gardenTask=sunDone")}
              className={gardenStudyVerified ? "bg-[#5B7D63] text-white hover:bg-[#4E6F56]" : "bg-[#DDEAD8] text-[#6B7B6E]"}
            >
              {gardenStudyVerified ? "已完成阅读，返回领取" : "阅读详情后解锁"}
            </Button>
          </div>
        </Card>
      )}

      {/* Search bar */}
      <Card className="p-6 border-[#E2E8E3] bg-gradient-to-br from-amber-50/50 to-white">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#7C9A82]" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="输入想了解的内容，例如：失眠、陈皮、脾胃虚弱..."
              className="pl-10 border-[#D5DDD6] focus:border-[#7C9A82] focus:ring-[#7C9A82]/20"
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={searching}
            className="bg-[#7C9A82] hover:bg-[#5B7D63] text-white"
          >
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "搜索并查看关联"
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => setFiltersOpen((v) => !v)}
            className={
              activeFilterCount > 0
                ? "border-[#7C9A82] text-[#6B7B6E]"
                : "border-[#E2E8E3] text-[#6B7B6E]"
            }
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            筛选
            {activeFilterCount > 0 && (
              <Badge className="ml-2 bg-[#7C9A82] text-white">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </div>

        {/* Collapsible filter panel */}
        {filtersOpen && (
          <div className="mt-4 pt-4 border-t border-[#E2E8E3] grid grid-cols-2 md:grid-cols-3 gap-3">
            {filterFields.map((field) => (
              <div key={field.key}>
                <label className="text-xs text-[#6B7B6E] mb-1 block">
                  {field.label}
                </label>
                <Select
                  value={filters[field.key] || "__all__"}
                  onValueChange={(val) =>
                    setFilters((prev) => ({
                      ...prev,
                      [field.key]: val === "__all__" ? "" : val,
                    }))
                  }
                >
                  <SelectTrigger className="w-full border-[#E2E8E3]">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">全部</SelectItem>
                    {field.options.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            {activeFilterCount > 0 && (
              <div className="col-start-3 row-start-2 flex items-end ml-auto">
                <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                  <X className="mr-1 h-3 w-3" />
                  清除全部
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Active filter pills */}
        {activeFilterCount > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {Object.entries(filters).map(([key, value]) => {
              if (!value) return null;
              return (
                <Badge
                  key={key}
                  variant="secondary"
                  className="pr-1 pl-3 flex items-center gap-1 bg-[#E8F0EA] text-[#2D3B2E]"
                >
                  <span className="text-xs text-[#7C9A82]">
                    {filterLabels[key] ?? key}:
                  </span>
                  <span>{value}</span>
                  <button
                    onClick={() => clearFilter(key as keyof typeof filters)}
                    className="ml-1 hover:text-red-600 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}

        {/* Hot tags - TCM quick categories */}
        <div className="flex gap-2 mt-4 flex-wrap">
          <span className="text-sm text-[#6B7B6E]">热门分类:</span>
          {TCM_KNOWLEDGE_TYPES.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="cursor-pointer hover:bg-[#E8F0EA] hover:text-[#5B7D63] bg-[#F0F4F1] text-[#2D3B2E] transition-colors"
              onClick={() => handleTagClick(tag, "questionType")}
            >
              {tag}
            </Badge>
          ))}
          {TCM_CATEGORIES.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="cursor-pointer hover:bg-[#E8F0EA] hover:text-[#5B7D63] bg-[#F0F4F1] text-[#6B7B6E] transition-colors"
              onClick={() => handleTagClick(tag, "primaryProject")}
            >
              {tag}
            </Badge>
          ))}
        </div>
      </Card>

      {renderGraphPanel(false)}

      {/* Knowledge list */}
      {loading || searching ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#5B7D63]" />
          <span className="ml-3 text-[#6B7B6E]">
            {searching ? "搜索中..." : "加载中..."}
          </span>
        </div>
      ) : error ? (
        <Card className="p-8 text-center border-red-200">
          <p className="text-red-600 mb-3">{error}</p>
          <Button
            variant="outline"
            onClick={() => loadEntries(1)}
            className="border-[#D5DDD6] text-[#6B7B6E]"
          >
            重试
          </Button>
        </Card>
      ) : entries.length === 0 ? (
        <Card className="p-12 text-center border-[#E2E8E3]">
          <BookOpen className="h-16 w-16 mx-auto mb-4 text-[#A8BFAE]" />
          <p className="text-[#6B7B6E] text-lg">暂无匹配的知识条目</p>
          <p className="text-[#A8BFAE] text-sm mt-2">
            尝试调整搜索关键词或筛选条件
          </p>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between px-1">
            <p className="text-sm text-[#6B7B6E]">
              共找到 <strong className="text-[#5B7D63]">{total}</strong> 条知识
              {searchQuery && (
                <span>
                  {" "}
                  -- 关键词「
                  <strong className="text-[#5B7D63]">{searchQuery}</strong>」
                </span>
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {entries.map((entry) => {
              const typeLabel = getKnowledgeTypeLabel(entry);
              const summary = getSummary(entry);
              return (
                <Card
                  key={entry.id}
                  className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-[#E8F0EA] hover:border-[#D5DDD6] bg-white"
                  onClick={() => openDetail(entry.id)}
                >
                  <div className="flex h-full flex-col justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Title + type badge */}
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="font-bold text-lg text-[#2D3B2E] truncate">
                          {entry.question}
                        </h3>
                        {typeLabel && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${getTypeBadgeClass(typeLabel)}`}
                          >
                            {typeLabel}
                          </span>
                        )}
                        {entry.primaryProject && (
                          <Badge
                            variant="outline"
                            className="text-xs border-[#D5DDD6] text-[#6B7B6E]"
                          >
                            {entry.primaryProject}
                          </Badge>
                        )}
                      </div>

                      {/* Summary text */}
                      {summary && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {summary}
                        </p>
                      )}

                      {/* Knowledge point & category info */}
                      <div className="flex gap-2 flex-wrap items-center">
                        {entry.knowledgePoint && (
                          <span className="text-xs bg-[#F0F4F1] text-[#2D3B2E] border border-[#E2E8E3] rounded px-2 py-1 truncate max-w-xs">
                            知识点：{entry.knowledgePoint.length > 40
                              ? entry.knowledgePoint.slice(0, 40) + "..."
                              : entry.knowledgePoint}
                          </span>
                        )}
                        {entry.secondaryProject && (
                          <Badge
                            variant="outline"
                            className="text-xs border-gray-200 text-gray-500"
                          >
                            {entry.secondaryProject}
                          </Badge>
                        )}
                        {entry.contentCategory && (
                          <Badge
                            variant="outline"
                            className="text-xs border-gray-200 text-gray-500"
                          >
                            {entry.contentCategory}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0 pt-2">
                      <Button
                        size="sm"
                        className="bg-[#7C9A82] hover:bg-[#5B7D63] text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(entry.id);
                        }}
                      >
                        查看详情
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => loadEntries(page - 1)}
                className="border-[#D5DDD6] text-[#6B7B6E]"
              >
                <ChevronLeft className="h-4 w-4" />
                上一页
              </Button>
              <span className="text-sm text-[#6B7B6E]">
                第 <strong className="text-[#5B7D63]">{page}</strong> /{" "}
                {totalPages} 页
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => loadEntries(page + 1)}
                className="border-[#D5DDD6] text-[#6B7B6E]"
              >
                下一页
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Not authenticated notice */}
      {!isAuthenticated && !loading && (
        <Card className="p-6 bg-[#F0F4F1] border-[#E2E8E3]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="h-6 w-6 text-[#7C9A82]" />
              <div>
                <h4 className="font-medium text-[#2D3B2E]">
                  登录以查看完整知识库
                </h4>
                <p className="text-sm text-[#6B7B6E] mt-1">
                  登录后即可搜索浏览全部中医知识内容
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate("/login")}
              className="bg-[#7C9A82] hover:bg-[#5B7D63] text-white"
            >
              立即登录
            </Button>
          </div>
        </Card>
      )}

      {/* Knowledge Detail Modal */}
      {selectedEntry !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 border-[#E2E8E3]">
            {detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#5B7D63]" />
              </div>
            ) : detailError ? (
              <div className="text-center py-8">
                <p className="text-red-600 mb-3">{detailError}</p>
                <Button
                  variant="outline"
                  onClick={closeDetail}
                >
                  关闭
                </Button>
              </div>
            ) : selectedEntry ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-[#5B7D63] flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    知识详情
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={closeDetail}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <div className="space-y-4">
                  {/* Category badges */}
                  <div className="flex gap-2 flex-wrap">
                    {getKnowledgeTypeLabel(selectedEntry) && (
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-medium ${getTypeBadgeClass(getKnowledgeTypeLabel(selectedEntry))}`}
                      >
                        {getKnowledgeTypeLabel(selectedEntry)}
                      </span>
                    )}
                    {selectedEntry.primaryProject && (
                      <Badge
                        variant="outline"
                        className="border-[#D5DDD6] text-[#6B7B6E]"
                      >
                        {selectedEntry.primaryProject}
                      </Badge>
                    )}
                    {selectedEntry.secondaryProject && (
                      <Badge
                        variant="outline"
                        className="border-[#D5DDD6] text-[#7C9A82]"
                      >
                        {selectedEntry.secondaryProject}
                      </Badge>
                    )}
                    {selectedEntry.contentCategory && (
                      <Badge
                        variant="outline"
                        className="border-[#E2E8E3] text-[#7C9A82]"
                      >
                        {selectedEntry.contentCategory}
                      </Badge>
                    )}
                  </div>

                  {/* Title / question content */}
                  <div>
                    <h3 className="text-sm font-medium text-[#7C9A82] mb-1">
                      标题
                    </h3>
                    <p className="text-lg text-[#2D3B2E] font-medium">
                      {selectedEntry.question}
                    </p>
                  </div>

                  {renderGraphPanel(true)}

                  {/* Media: audio or video */}
                  {selectedEntry.mediaUrl && (
                    <div>
                      <h3 className="text-sm font-medium text-[#7C9A82] mb-2">
                        音视频资料
                      </h3>
                      <div className="rounded overflow-hidden border border-[#E2E8E3] bg-black/5">
                        {/\.(mp4|webm|ogg|mov)$/i.test(
                          selectedEntry.mediaUrl
                        ) ? (
                          <video
                            src={selectedEntry.mediaUrl}
                            controls
                            className="w-full max-h-80"
                          />
                        ) : (
                          <audio
                            src={selectedEntry.mediaUrl}
                            controls
                            className="w-full"
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Images */}
                  {selectedEntry.questionImageUrl && (
                    <div>
                      <h3 className="text-sm font-medium text-[#7C9A82] mb-2">
                        图片资料
                      </h3>
                      <div className="flex flex-col gap-2">
                        {selectedEntry.questionImageUrl
                          .split(";")
                          .map((url, i) => (
                            <img
                              key={i}
                              src={url.trim()}
                              alt={`图片 ${i + 1}`}
                              className="rounded max-w-full max-h-64 object-contain border border-[#E2E8E3]"
                            />
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Main content / answer */}
                  {selectedEntry.answer && (
                    <div>
                      <h3 className="text-sm font-medium text-[#7C9A82] mb-1">
                        内容详述
                      </h3>
                      <div className="bg-[#F0F4F1] p-4 rounded-lg border border-[#E2E8E3] text-gray-800 whitespace-pre-wrap">
                        {selectedEntry.answer}
                      </div>
                    </div>
                  )}

                  {/* Options displayed as related info */}
                  {selectedEntry.options && (
                    <div>
                      <h3 className="text-sm font-medium text-[#7C9A82] mb-1">
                        相关内容
                      </h3>
                      <div className="bg-gray-50 p-3 rounded-lg border border-[#E8F0EA]">
                        {selectedEntry.options
                          .split(";")
                          .map((opt, idx) => (
                            <p
                              key={idx}
                              className="text-sm text-gray-700 py-1 border-b border-[#F0F4F1] last:border-0"
                            >
                              {opt.trim()}
                            </p>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Knowledge point */}
                  {selectedEntry.knowledgePoint && (
                    <div className="border-t border-[#E2E8E3] pt-3">
                      <h3 className="text-sm font-medium text-[#7C9A82] mb-1">
                        知识要点
                      </h3>
                      <p className="text-sm text-[#5B7D63] bg-red-50 p-3 rounded border border-red-100 whitespace-pre-wrap">
                        {selectedEntry.knowledgePoint}
                      </p>
                    </div>
                  )}

                  {/* Core connotation */}
                  {selectedEntry.coreConnotation && (
                    <div className="border-t border-[#E2E8E3] pt-3">
                      <h3 className="text-sm font-medium text-[#7C9A82] mb-1">
                        核心内涵
                      </h3>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {selectedEntry.coreConnotation}
                      </p>
                    </div>
                  )}

                  {/* Metadata grid */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#E2E8E3]">
                    {[
                      ["分类", selectedEntry.primaryProject],
                      ["子分类", selectedEntry.secondaryProject],
                      ["内容分类", selectedEntry.contentCategory],
                      ["知识类型", selectedEntry.questionType],
                      ["文化要点", selectedEntry.culturalPoint],
                      ["认知层次", selectedEntry.fourStageCognition],
                      ["Bloom层次", selectedEntry.bloomCognitionLevel],
                      ["关注重点", selectedEntry.mainFocus],
                    ].map(
                      ([label, value]) =>
                        value && (
                          <div key={label}>
                            <span className="text-xs text-[#A8BFAE]">
                              {label}
                            </span>
                            <p className="text-sm text-gray-800">{value}</p>
                          </div>
                        )
                    )}
                  </div>

                  {/* Timestamps */}
                  <div className="text-xs text-[#B0B8B1] border-t border-[#E8F0EA] pt-3 flex justify-between">
                    <span>
                      创建于：
                      {selectedEntry.createdAt
                        ? new Date(selectedEntry.createdAt).toLocaleString("zh-CN")
                        : "—"}
                    </span>
                    <span>
                      更新于：
                      {selectedEntry.updatedAt
                        ? new Date(selectedEntry.updatedAt).toLocaleString("zh-CN")
                        : "—"}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  {isGardenSunTask && gardenStudyVerified && (
                    <Button
                      className="flex-1 bg-[#5B7D63] text-white hover:bg-[#4E6F56]"
                      onClick={() => navigate("/?gardenTask=sunDone")}
                    >
                      返回草本小园领取光照奖励
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="flex-1 border-[#D5DDD6] text-[#6B7B6E]"
                    onClick={closeDetail}
                  >
                    关闭
                  </Button>
                </div>
              </>
            ) : null}
          </Card>
        </div>
      )}
    </div>
  );
}
