import { useState, useEffect, useCallback } from "react";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "../components/ui/popover";
import { Checkbox } from "../components/ui/checkbox";
import {
  Shield,
  Users,
  BookOpen,
  BarChart3,
  RefreshCw,
  Activity,
  Newspaper,
  Sparkles,
  Trash2,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  CheckCircle,
  XCircle,
  Radio,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  fetchHotNews,
  searchNews,
  fetchNews,
  getNewsStats,
  updateNewsStatus,
  deleteNews,
  generateQuestionsFromNews,
  getAdminQuestions,
  deleteQuestion,
  getAdminUsers,
  updateAdminUser,
  getAdminQuestionStats,
  NewsItem,
  NewsStats,
  AdminQuestion,
  AdminUser,
} from "../../lib/admin";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUESTION_TYPES = [
  { value: "singleChoice", labelKey: "dashboard.singleChoice" },
  { value: "multiChoice", labelKey: "dashboard.multiChoice" },
  { value: "trueFalse", labelKey: "dashboard.trueFalse" },
  { value: "fillBlank", labelKey: "dashboard.fillBlank" },
  { value: "wordFormation", labelKey: "dashboard.wordFormation" },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LoadingSpinner({ text: textProp }: { text?: string }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-2 py-8 justify-center text-gray-500">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span>{textProp ? textProp : t("common.loading")}</span>
    </div>
  );
}

function EmptyState({ messageKey, icon: Icon }: { messageKey: string; icon: React.ComponentType<{ className?: string }> }) {
  const { t } = useLanguage();
  return (
    <div className="py-12 text-center text-gray-400">
      <Icon className="h-10 w-10 mx-auto mb-3 opacity-40" />
      <p>{t(messageKey)}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const map: Record<string, { label: string; cls: string }> = {
    raw: { label: t("dashboard.pending"), cls: "bg-yellow-100 text-yellow-700" },
    used: { label: t("dashboard.used"), cls: "bg-green-100 text-green-700" },
    expired: { label: t("dashboard.expired"), cls: "bg-gray-100 text-gray-500" },
  };
  const s = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-600" };
  return <Badge className={`text-xs ${s.cls}`}>{s.label}</Badge>;
}

// ---------------------------------------------------------------------------
// Tab: News Management
// ---------------------------------------------------------------------------

function NewsTab() {
  const { t, language } = useLanguage();
  const isZh = language === "zh";
  const [stats, setStats] = useState<NewsStats | null>(null);
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genDialogOpen, setGenDialogOpen] = useState(false);
  const [genNewsId, setGenNewsId] = useState<number | null>(null);
  const [genTypes, setGenTypes] = useState<string[]>(["singleChoice", "trueFalse"]);
  const [genDifficulty, setGenDifficulty] = useState("");
  const [genCount, setGenCount] = useState(5);

  const PAGE_SIZE = 10;

  const loadNews = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchNews({ status: status || undefined, page, size: PAGE_SIZE });
      setNewsList(data.news);
      setTotal(data.total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("dashboard.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  const loadStats = async () => {
    try {
      const s = await getNewsStats();
      setStats(s);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadNews(); }, [loadNews]);
  useEffect(() => { loadStats(); }, []);

  const handleFetchNews = async () => {
    setFetching(true);
    try {
      const result = await fetchHotNews();
      toast.success(t("dashboard.fetchSuccess") + ` ${result.length} ${t("dashboard.newsUnit")}`);
      loadNews();
      loadStats();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("dashboard.fetchFailed"));
    } finally {
      setFetching(false);
    }
  };

  const handleSearch = async () => {
    if (!searchKeyword.trim()) return;
    setSearching(true);
    try {
      const result = await searchNews(searchKeyword.trim());
      setNewsList(result);
      setTotal(result.length);
      setPage(0);
      toast.success(t("dashboard.searchSuccess") + ` ${result.length} ${t("dashboard.newsUnit")}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("dashboard.searchFailed"));
    } finally {
      setSearching(false);
    }
  };

  const handleStatusChange = async (id: number, newStatus: "raw" | "used" | "expired") => {
    try {
      await updateNewsStatus(id, newStatus);
      toast.success(t("dashboard.successUpdate"));
      loadNews();
      loadStats();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("dashboard.updateFailed"));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("dashboard.confirmDelete"))) return;
    try {
      await deleteNews(id);
      toast.success(t("dashboard.successDelete"));
      loadNews();
      loadStats();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("dashboard.deleteFailed"));
    }
  };

  const openGenDialog = (newsId: number) => {
    setGenNewsId(newsId);
    setGenTypes(["singleChoice", "trueFalse"]);
    setGenDifficulty("");
    setGenCount(5);
    setGenDialogOpen(true);
  };

  const handleAIGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateQuestionsFromNews({
        newsId: genNewsId ?? undefined,
        count: genCount,
        difficulty: genDifficulty || undefined,
        types: genTypes.length > 0 ? genTypes : undefined,
      });
      toast.success(t("dashboard.generateSuccess") + ` ${result.length} ${t("dashboard.questionsUnit")}`);
      setGenDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("dashboard.generateFailed"));
    } finally {
      setGenerating(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: t("dashboard.newsTotal"), value: stats.total, color: "text-[#5B7D63]", bg: "bg-blue-50" },
            { label: t("dashboard.pending"), value: stats.raw, color: "text-yellow-600", bg: "bg-yellow-50" },
            { label: t("dashboard.used"), value: stats.used, color: "text-green-600", bg: "bg-green-50" },
            { label: t("dashboard.expired"), value: stats.expired, color: "text-gray-500", bg: "bg-gray-50" },
          ].map((s) => (
            <Card key={s.label} className={`p-4 ${s.bg}`}>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleFetchNews} disabled={fetching}>
          {fetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Radio className="h-4 w-4 mr-2" />}
          {t("dashboard.fetchHotNews")}
        </Button>
        <div className="flex gap-2 flex-1 max-w-md">
          <Input
            placeholder={t("dashboard.searchPlaceholder")}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button variant="outline" onClick={handleSearch} disabled={searching}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["", "raw", "used", "expired"].map((s) => (
          <Button
            key={s}
            variant={status === s ? "default" : "outline"}
            size="sm"
            onClick={() => { setStatus(s); setPage(0); }}
          >
            {s === "" ? t("dashboard.filterAll") : s === "raw" ? t("dashboard.pending") : s === "used" ? t("dashboard.used") : t("dashboard.expired")}
          </Button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <LoadingSpinner />
      ) : newsList.length === 0 ? (
        <EmptyState messageKey="dashboard.noNewsData" icon={Newspaper} />
      ) : (
        <div className="space-y-3">
          {newsList.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-gray-900 truncate">{item.title}</h3>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-2">{item.content}</p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-400">
                    <span>{t("dashboard.source")}: {item.source}</span>
                    <span>{t("dashboard.category")}: {item.category}</span>
                    {item.publishedAt && (
                      <span>{t("dashboard.publishTime")}: {new Date(item.publishedAt).toLocaleDateString(isZh ? "zh-CN" : "en-US")}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    title={t("dashboard.aiGenerate")}
                    onClick={() => openGenDialog(item.id)}
                    disabled={generating}
                  >
                    <Sparkles className="h-4 w-4 text-purple-600" />
                  </Button>
                  <select
                    className="text-xs border rounded px-1 py-1"
                    value={item.status}
                    onChange={(e) => handleStatusChange(item.id, e.target.value as "raw" | "used" | "expired")}
                  >
                    <option value="raw">{t("dashboard.pending")}</option>
                    <option value="used">{t("dashboard.used")}</option>
                    <option value="expired">{t("dashboard.expired")}</option>
                  </select>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                  {item.sourceUrl && (
                    <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-500">{page + 1} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* AI Generate Dialog */}
      <Dialog open={genDialogOpen} onOpenChange={setGenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              {t("dashboard.aiGenerate")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs mb-1 block">{t("dashboard.questionType")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    {genTypes.length === 0
                    ? t("dashboard.pleaseSelectTypes")
                    : t("dashboard.selectedTypesCount", { count: genTypes.length })}
                    <ChevronDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-2">
                  <div className="space-y-1">
                    {QUESTION_TYPES.map((type) => (
                      <label
                        key={type.value}
                        className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-accent text-sm"
                      >
                        <Checkbox
                          checked={genTypes.includes(type.value)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setGenTypes([...genTypes, type.value]);
                            } else {
                              setGenTypes(genTypes.filter((t) => t !== type.value));
                            }
                          }}
                        />
                        {t(type.labelKey)}
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">{t("dashboard.hskLevel")}</Label>
                <Input
                  placeholder="1-6"
                  value={genDifficulty}
                  onChange={(e) => setGenDifficulty(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">{t("dashboard.count")}</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={genCount}
                  onChange={(e) => setGenCount(parseInt(e.target.value) || 5)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleAIGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {generating ? t("dashboard.generating") : t("dashboard.generate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Question Management
// ---------------------------------------------------------------------------

function QuestionsTab() {
  const { t } = useLanguage();
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [questionTypeFilter, setQuestionTypeFilter] = useState<string[]>([]);

  const PAGE_SIZE = 10;

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminQuestions({
        skip: page,
        limit: PAGE_SIZE,
        searchText: searchText || undefined,
        questionType: questionTypeFilter.length === 1 ? questionTypeFilter[0] : undefined,
      });
      setQuestions(data.questions);
      setTotal(data.total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("dashboard.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [page, searchText, questionTypeFilter]);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  const handleDelete = async (id: number) => {
    if (!confirm(t("dashboard.confirmDeleteQuestion"))) return;
    try {
      await deleteQuestion(id);
      toast.success(t("dashboard.successDelete"));
      loadQuestions();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("dashboard.deleteFailed"));
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      {/* Question List */}
      <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-green-600" />
          {t("dashboard.questionBankMgmt")}
        </h3>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <Input
            placeholder={t("dashboard.searchQuestion")}
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setPage(0); }}
            className="max-w-xs"
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="min-w-[140px] justify-between font-normal"
              >
                {questionTypeFilter.length === 0
                  ? t("dashboard.allTypes")
                  : questionTypeFilter.length === 1
                    ? t(questionTypeFilter[0] === "singleChoice" ? "dashboard.singleChoice" : questionTypeFilter[0] === "multiChoice" ? "dashboard.multiChoice" : questionTypeFilter[0] === "trueFalse" ? "dashboard.trueFalse" : questionTypeFilter[0] === "fillBlank" ? "dashboard.fillBlank" : "dashboard.wordFormation")
                    : `${t("dashboard.selectedTypes")} ${questionTypeFilter.length}`}
                <ChevronDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2">
              <div className="space-y-1">
                {QUESTION_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-accent text-sm"
                  >
                    <Checkbox
                      checked={questionTypeFilter.includes(type.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setQuestionTypeFilter([...questionTypeFilter, type.value]);
                        } else {
                          setQuestionTypeFilter(questionTypeFilter.filter((t) => t !== type.value));
                        }
                        setPage(0);
                      }}
                    />
                    {t(type.labelKey)}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={loadQuestions}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : questions.length === 0 ? (
          <EmptyState messageKey="dashboard.noQuestions" icon={BookOpen} />
        ) : (
          <div className="space-y-3">
            {questions.map((q) => (
              <Card key={q.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge>{q.questionType}</Badge>
                      {q.difficulty && <Badge variant="secondary">{q.difficulty}</Badge>}
                      {q.contentCategory && <Badge variant="outline">{q.contentCategory}</Badge>}
                    </div>
                    <p className="text-sm text-gray-900">{q.content}</p>
                    {q.options && q.options.length > 0 && (
                      <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                        {q.options.map((opt, i) => <div key={i}>{String.fromCharCode(65 + i)}. {opt}</div>)}
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="text-green-600 font-medium">{t("dashboard.answer")}: {q.correctAnswer}</span>
                      {q.knowledgePoint && <span>{t("dashboard.knowledge")}: {q.knowledgePoint}</span>}
                      {q.competition && <span>{t("dashboard.competition")}: {q.competition}</span>}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(q.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </Card>
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-500">{page + 1} / {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: User Management
// ---------------------------------------------------------------------------

function UsersTab() {
  const { t, language } = useLanguage();
  const isZh = language === "zh";
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [saving, setSaving] = useState(false);

  const PAGE_SIZE = 10;

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminUsers({ skip: page, limit: PAGE_SIZE });
      setUsers(data);
      setTotal(data.length);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("dashboard.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleToggleActive = async (user: AdminUser) => {
    try {
      await updateAdminUser(user.id, { isActive: !user.isActive });
      toast.success(isZh ? `${!user.isActive ? t("dashboard.enable") : t("dashboard.disable")} ${t("common.success")}` : `${!user.isActive ? "Enabled" : "Disabled"} successfully`);
      loadUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("dashboard.operationFailed"));
    }
  };

  const handleToggleSuperuser = async (user: AdminUser) => {
    if (!confirm(user.isSuperuser ? t("dashboard.confirmRevokeAdmin") : t("dashboard.confirmGrantAdmin"))) return;
    try {
      await updateAdminUser(user.id, { isSuperuser: !user.isSuperuser });
      toast.success(user.isSuperuser ? t("dashboard.revokeSuccess") : t("dashboard.grantSuccess"));
      loadUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("dashboard.operationFailed"));
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      await updateAdminUser(editingUser.id, {
        email: editingUser.email,
        fullName: editingUser.fullName,
      });
      toast.success(t("dashboard.successUserUpdate"));
      setEditingUser(null);
      loadUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("dashboard.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-[#5B7D63]" />
            {t("dashboard.userList")}
          </h3>
          <Button variant="outline" size="sm" onClick={loadUsers}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : users.length === 0 ? (
          <EmptyState messageKey="dashboard.noUserData" icon={Users} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-gray-600">
                  <th className="py-3 px-3 font-medium">{t("login.username")}</th>
                  <th className="py-3 px-3 font-medium">{t("dashboard.email")}</th>
                  <th className="py-3 px-3 font-medium">{t("dashboard.name")}</th>
                  <th className="py-3 px-3 font-medium">{t("dashboard.status")}</th>
                  <th className="py-3 px-3 font-medium">{t("dashboard.role")}</th>
                  <th className="py-3 px-3 font-medium">{t("dashboard.registerTime")}</th>
                  <th className="py-3 px-3 font-medium">{t("dashboard.action")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3 font-medium text-gray-900">{u.username}</td>
                    <td className="py-3 px-3 text-sm text-gray-600">{u.email}</td>
                    <td className="py-3 px-3 text-sm">{u.fullName}</td>
                    <td className="py-3 px-3">
                      <Badge className={u.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                        {u.isActive ? t("dashboard.active") : t("dashboard.disabled")}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">
                      {u.isSuperuser ? (
                        <Badge className="bg-[#E8F0EA] text-[#5B7D63]">{t("dashboard.superAdmin")}</Badge>
                      ) : (
                        <Badge variant="outline">{t("dashboard.normalUser")}</Badge>
                      )}
                    </td>
                    <td className="py-3 px-3 text-xs text-gray-500">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString("zh-CN") : "-"}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          title={u.isActive ? t("dashboard.disable") : t("dashboard.enable")}
                          onClick={() => handleToggleActive(u)}
                        >
                          {u.isActive ? (
                            <XCircle className="h-4 w-4 text-gray-500" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title={u.isSuperuser ? t("dashboard.revokeAdmin") : t("dashboard.grantAdmin")}
                          onClick={() => handleToggleSuperuser(u)}
                        >
                          <Shield className={`h-4 w-4 ${u.isSuperuser ? "text-red-500" : "text-gray-400"}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title={t("dashboard.editUser")}
                          onClick={() => setEditingUser({ ...u })}
                        >
                          <Activity className="h-4 w-4 text-blue-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-500">{page + 1} / {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">{t("dashboard.editUser")}</h2>
            <div className="space-y-4">
              <div>
                <Label className="text-xs">{t("login.username")}</Label>
                <Input value={editingUser.username} disabled />
              </div>
              <div>
                <Label className="text-xs">{t("dashboard.email")}</Label>
                <Input
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">{t("dashboard.name")}</Label>
                <Input
                  value={editingUser.fullName}
                  onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setEditingUser(null)}>
                {t("common.cancel")}
              </Button>
              <Button className="flex-1" onClick={handleUpdateUser} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {t("common.save")}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const { user, isAuthenticated, isSuperuser } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [stats, setStats] = useState<{ totalUsers: number; totalQuestions: number; totalQuizzes: number } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const [users, questions] = await Promise.all([
        getAdminUsers({ skip: 0, limit: 1 }).catch(() => []),
        getAdminQuestionStats().catch(() => ({ total: 0 })),
      ]);
      setStats({
        totalUsers: Array.isArray(users) ? users.length : 0,
        totalQuestions: questions.total,
        totalQuizzes: 0,
      });
    } catch { /* ignore */ }
    finally { setStatsLoading(false); }
  };

  useEffect(() => {
    if (isAuthenticated && isSuperuser) fetchStats();
  }, [isAuthenticated, isSuperuser]);

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <Card className="p-8 text-center bg-gradient-to-br from-blue-50 to-purple-50">
          <Shield className="h-16 w-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-2xl font-bold mb-2">{t("dashboard.loginFirst")}</h2>
          <p className="text-gray-600 mb-6">{t("dashboard.loginDesc")}</p>
          <Button onClick={() => navigate("/login")} size="lg">{t("dashboard.goLogin")}</Button>
        </Card>
      </div>
    );
  }

  if (!isSuperuser) {
    return (
      <div className="space-y-6">
        <Card className="p-8 text-center bg-gradient-to-br from-red-50 to-orange-50">
          <Shield className="h-16 w-16 mx-auto mb-4 text-[#7C9A82]" />
          <h2 className="text-2xl font-bold mb-2">{t("dashboard.noPermission")}</h2>
          <p className="text-gray-600 mb-6">{t("dashboard.noPermissionDesc")}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate("/")} variant="outline" size="lg">{t("dashboard.backToProfile")}</Button>
            <Button onClick={() => navigate("/login")} size="lg">{t("dashboard.relogin")}</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("dashboard.adminDashboard")}</h1>
          <p className="text-gray-500 mt-1">{t("dashboard.welcome")}{t("dashboard.welcomeComma")}{user?.fullName || user?.username} — {user?.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={statsLoading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${statsLoading ? "animate-spin" : ""}`} />
          {t("dashboard.refreshOverview")}
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">{t("dashboard.totalUsers")}</p>
              <p className="text-3xl font-bold mt-2">{statsLoading ? "-" : (stats?.totalUsers ?? "-")}</p>
            </div>
            <Users className="h-10 w-10 text-[#5B7D63]" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">{t("dashboard.totalQuestions")}</p>
              <p className="text-3xl font-bold mt-2">{statsLoading ? "-" : (stats?.totalQuestions ?? "-")}</p>
            </div>
            <BookOpen className="h-10 w-10 text-green-600" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">{t("dashboard.totalRecords")}</p>
              <p className="text-3xl font-bold mt-2">{statsLoading ? "-" : (stats?.totalQuizzes ?? "-")}</p>
            </div>
            <BarChart3 className="h-10 w-10 text-purple-600" />
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="news">
        <TabsList>
          <TabsTrigger value="news">
            <Newspaper className="h-4 w-4 mr-1" />
            {t("dashboard.newsManagement")}
          </TabsTrigger>
          <TabsTrigger value="questions">
            <BookOpen className="h-4 w-4 mr-1" />
            {t("dashboard.questionManagement")}
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="h-4 w-4 mr-1" />
            {t("dashboard.userManagement")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="news">
          <NewsTab />
        </TabsContent>

        <TabsContent value="questions">
          <QuestionsTab />
        </TabsContent>

        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
