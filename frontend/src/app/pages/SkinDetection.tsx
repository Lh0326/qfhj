import { useState, useRef, useCallback } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Upload,
  Scan,
  AlertCircle,
  CheckCircle,
  History,
  Image,
  Loader2,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { getToken } from "../../lib/auth";
import { useNavigate } from "react-router";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DetectionResult {
  success: boolean;
  message: string;
  diseaseLabel: string;
  confidenceScore: number;
  confidenceLabel?: string;
  segmentationMapUrl: string | null;
  tcmAnalysis: string;
  westernDiagnosis: string;
}

interface HistoryEntry {
  id: string;
  imageUrl: string;
  diseaseLabel: string;
  confidenceScore: number;
  analyzedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HISTORY_KEY = "smarttcm_skin_detection_history";
const MAX_HISTORY = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

function addToHistory(entry: HistoryEntry) {
  const prev = loadHistory();
  saveHistory([entry, ...prev]);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LoginGate({ t, navigate }: { t: (k: string) => string; navigate: ReturnType<typeof useNavigate> }) {
  return (
    <Card className="p-12 text-center border-[#E2E8E3] bg-gradient-to-br from-[#F5F0E8] to-[#E8F0EA] rounded-3xl">
      <AlertCircle className="h-16 w-16 mx-auto mb-4 text-[#C4A862]" />
      <h3 className="text-2xl font-bold mb-2 text-[#2D3B2E]">{t("skinDetection.loginRequired")}</h3>
      <p className="text-[#6B7B6E] mb-6">{t("skinDetection.loginRequiredDesc")}</p>
      <Button
        onClick={() => navigate("/login")}
        className="bg-[#7C9A82] hover:bg-[#5B7D63] text-white rounded-xl"
      >
        {t("skinDetection.loginNow")}
      </Button>
    </Card>
  );
}

function EmptyHistory({ t }: { t: (k: string) => string }) {
  return (
    <div className="py-10 text-center text-[#6B7B6E]/60">
      <History className="h-10 w-10 mx-auto mb-3 opacity-40" />
      <p className="text-sm">{t("skinDetection.noHistory")}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SkinDetection() {
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DetectionResult | null>(null);

  // History state
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());

  // ----- Drag & drop handlers -----

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }, []);

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError(t("skinDetection.fileTypeError"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(t("skinDetection.fileSizeError"));
      return;
    }
    setError(null);
    setResult(null);
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // ----- Analyze handler -----

  const handleAnalyze = async () => {
    if (!selectedFile || analyzing) return;

    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const token = getToken();
      const formData = new FormData();
      formData.append("image", selectedFile);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const response = await fetch("/api/v1/skin-detection/analyze", {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(t("skinDetection.serverError", { status: response.status }));
      }

      const data: DetectionResult = await response.json();
      setResult(data);

      // Save to history
      const entry: HistoryEntry = {
        id: Date.now().toString(),
        imageUrl: previewUrl || "",
        diseaseLabel: data.diseaseLabel,
        confidenceScore: data.confidenceScore,
        confidenceLabel: data.confidenceLabel,
        analyzedAt: new Date().toISOString(),
      };
      addToHistory(entry);
      setHistory(loadHistory());
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("请求超时，请稍后重试");
      } else if (err instanceof TypeError) {
        setError("网络连接失败，请确认后端服务已启动后重试");
      } else {
        setError(
          err instanceof Error
            ? err.message
            : t("skinDetection.unknownError")
        );
      }
    } finally {
      setAnalyzing(false);
    }
  };

  // ----- Confidence bar color -----

  const getConfidenceColor = (score: number): string => {
    if (score >= 0.8) return "bg-green-500";
    if (score >= 0.6) return "bg-[#7C9A82]";
    if (score >= 0.4) return "bg-orange-500";
    return "bg-red-500";
  };

  const getConfidenceTextColor = (score: number): string => {
    if (score >= 0.8) return "text-green-700";
    if (score >= 0.6) return "text-[#6B7B6E]";
    if (score >= 0.4) return "text-orange-700";
    return "text-red-700";
  };

  // ----- Render -----

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <LoginGate t={t} navigate={navigate} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#5B7D63] to-[#C4A862] flex items-center justify-center shadow-md">
          <Scan className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#2D3B2E]">
            {t("skinDetection.title")}
          </h1>
          <p className="text-sm text-[#6B7B6E]">
            {t("skinDetection.subtitle")}
          </p>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)] xl:items-start">
        {/* Left: Upload area */}
        <Card className="p-6 border-[#E2E8E3] bg-gradient-to-b from-white to-[#F0F4F1]/30">
          <h2 className="text-lg font-semibold text-[#2D3B2E] mb-4 flex items-center gap-2">
            <Upload className="h-5 w-5 text-[#7C9A82]" />
            {t("skinDetection.uploadTitle")}
          </h2>

          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !previewUrl && fileInputRef.current?.click()}
            className={`
              relative rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200
              ${
                previewUrl
                  ? "border-[#D5DDD6] bg-[#F0F4F1]/20"
                  : isDragging
                    ? "border-red-500 bg-red-50/50 scale-[1.01]"
                    : "border-[#D5DDD6] bg-[#F0F4F1]/40 hover:border-[#7C9A82] hover:bg-[#F0F4F1]/60"
              }
              flex flex-col items-center justify-center min-h-[360px]
            `}
          >
            {previewUrl ? (
              <div className="relative w-full h-full p-2">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-contain max-h-[260px] rounded-lg"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearImage();
                  }}
                  className="absolute top-4 right-4 h-8 w-8 rounded-full bg-[#7C9A82]/80 hover:bg-[#5B7D63] text-white flex items-center justify-center shadow-md transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-[#6B7B6E]">
                <div className="h-16 w-16 rounded-full bg-[#E8F0EA] flex items-center justify-center">
                  <Image className="h-8 w-8 text-[#A8BFAE]" />
                </div>
                <p className="font-medium text-[#2D3B2E]">
                  {t("skinDetection.dropHere")}
                </p>
                <p className="text-sm text-[#7C9A82]">
                  {t("skinDetection.orClickBrowse")}
                </p>
                <Badge variant="outline" className="text-xs text-[#7C9A82] border-[#D5DDD6]">
                  JPG / PNG / WEBP (max 10MB)
                </Badge>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          {/* Analyze button */}
          <div className="mt-4">
            <Button
              onClick={handleAnalyze}
              disabled={!selectedFile || analyzing}
              className="w-full h-12 text-base bg-[#7C9A82] hover:bg-[#5B7D63] text-white shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  {t("skinDetection.analyzing")}
                </>
              ) : (
                <>
                  <Scan className="h-5 w-5 mr-2" />
                  {t("skinDetection.analyze")}
                </>
              )}
            </Button>
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </Card>

        {/* Right: Results */}
        <Card className="p-6 border-[#E2E8E3] bg-gradient-to-b from-white to-[#F0F4F1]/30">
          <h2 className="text-lg font-semibold text-[#2D3B2E] mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-[#7C9A82]" />
            {t("skinDetection.resultTitle")}
          </h2>

          {result ? (
            <div className="space-y-5">
              {/* Disease label */}
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-lg bg-gradient-to-br from-[#5B7D63] to-[#C4A862] flex items-center justify-center shadow-sm">
                  <Scan className="h-7 w-7 text-white" />
                </div>
                <div>
                  <p className="text-xs text-[#7C9A82] font-medium uppercase tracking-wide">
                    {t("skinDetection.diseaseLabel")}
                  </p>
                  <p className="text-xl font-bold text-[#2D3B2E]">
                    {result.diseaseLabel}
                  </p>
                </div>
              </div>

              {/* Confidence score */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#8B6F47]">
                    {t("skinDetection.confidence")}
                  </span>
                  <span className={`text-sm font-bold ${getConfidenceTextColor(result.confidenceScore)}`}>
                    {result.confidenceLabel || `${(result.confidenceScore * 100).toFixed(1)}%`}
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-[#E8F0EA] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${getConfidenceColor(result.confidenceScore)}`}
                    style={{ width: `${Math.max(0, result.confidenceScore) * 100}%` }}
                  />
                </div>
              </div>

              {/* Segmentation map */}
              <div>
                <p className="text-sm font-medium text-[#8B6F47] mb-2">
                  {t("skinDetection.segmentationMap")}
                </p>
                <div className="rounded-lg border border-[#E2E8E3] bg-[#F0F4F1]/50 h-40 flex items-center justify-center overflow-hidden">
                  {result.segmentationMapUrl ? (
                    <img
                      src={result.segmentationMapUrl}
                      alt="Segmentation Map"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-[#A8BFAE]">
                      <Scan className="h-8 w-8 opacity-40" />
                      <span className="text-xs">{t("skinDetection.noSegmentationMap")}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Message banner */}
              {result.message && (
                <div className="p-3 rounded-lg bg-[#F0F4F1] border border-[#E2E8E3] flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-[#A8BFAE] shrink-0 mt-0.5" />
                  <p className="text-sm text-[#8B6F47]">{result.message}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[280px] text-[#A8BFAE]/60">
              <Scan className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">{t("skinDetection.noResultYet")}</p>
              <p className="text-xs mt-1">{t("skinDetection.uploadAndAnalyze")}</p>
            </div>
          )}
        </Card>
      </div>

      {/* Diagnosis details (TCM + Western) */}
      {result && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* TCM Analysis */}
          <Card className="p-6 border-red-200 bg-gradient-to-br from-[#F0F4F1]/50 to-[#F5F0E8]/30">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-[#7C9A82] flex items-center justify-center">
                <span className="text-white text-sm font-bold">中</span>
              </div>
              <h3 className="text-lg font-semibold text-[#2D3B2E]">
                {t("skinDetection.tcmAnalysis")}
              </h3>
            </div>
            <p className="text-sm text-[#2D3B2E] leading-relaxed whitespace-pre-wrap">
              {result.tcmAnalysis}
            </p>
          </Card>

          {/* Western Diagnosis */}
          <Card className="p-6 border-[#E2E8E3] bg-gradient-to-br from-amber-50/50 to-yellow-50/30">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-[#C4A862] flex items-center justify-center">
                <span className="text-white text-sm font-bold">W</span>
              </div>
              <h3 className="text-lg font-semibold text-[#2D3B2E]">
                {t("skinDetection.westernDiagnosis")}
              </h3>
            </div>
            <p className="text-sm text-[#2D3B2E] leading-relaxed whitespace-pre-wrap">
              {result.westernDiagnosis}
            </p>
          </Card>
        </div>
      )}

      {/* History section */}
      <Card className="p-6 border-[#E2E8E3]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#2D3B2E] flex items-center gap-2">
            <History className="h-5 w-5 text-[#7C9A82]" />
            {t("skinDetection.historyTitle")}
          </h2>
          {history.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-[#7C9A82] hover:text-[#5B7D63]"
              onClick={() => {
                localStorage.removeItem(HISTORY_KEY);
                setHistory([]);
              }}
            >
              {t("skinDetection.clearHistory")}
            </Button>
          )}
        </div>

        {history.length === 0 ? (
          <EmptyHistory t={t} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="group rounded-lg border border-[#E2E8E3] overflow-hidden hover:border-[#7C9A82] hover:shadow-md transition-all cursor-pointer bg-white"
              >
                <div className="aspect-square bg-[#F0F4F1] overflow-hidden">
                  <img
                    src={entry.imageUrl}
                    alt={entry.diseaseLabel}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                </div>
                <div className="p-2 space-y-1">
                  <p className="text-xs font-medium text-[#2D3B2E] truncate">
                    {entry.diseaseLabel}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#7C9A82] font-medium">
                      {(entry.confidenceScore * 100).toFixed(0)}%
                    </span>
                    <span className="text-[10px] text-[#A8BFAE]">
                      {new Date(entry.analyzedAt).toLocaleDateString("zh-CN", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
