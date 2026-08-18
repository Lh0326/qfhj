import { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import {
  User,
  Stethoscope,
  BookOpen,
  LogOut,
  LogIn,
  LayoutDashboard,
  HeartPulse,
  Microscope,
  Globe,
  Wand2,
  Menu,
  X,
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { Button } from "./ui/button";
import { Avatar } from "./ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import logoUrl from "../../assets/qfhj-logo.png";

type NavItem = {
  path: string;
  labelKey: string;
  icon: typeof User;
  tag?: string;
};

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated, isSuperuser } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const navGroups: { title: string; titleEn: string; items: NavItem[] }[] = [
    {
      title: "核心功能",
      titleEn: "Core",
      items: [
        { path: "/qfhj", labelKey: "nav.tcmDiagnosis", icon: Stethoscope, tag: "LLM" },
        { path: "/wizard-diagnosis", labelKey: "nav.wizardDiagnosis", icon: Wand2, tag: "Flow" },
        { path: "/skin-detection", labelKey: "nav.skinDetection", icon: Microscope, tag: "Vision" },
      ],
    },
    {
      title: "健康档案",
      titleEn: "Health",
      items: [
        { path: "/", labelKey: "nav.profile", icon: User },
        { path: "/tcm-graph", labelKey: "nav.tcmGraph", icon: HeartPulse, tag: "Scale" },
      ],
    },
    {
      title: "知识支持",
      titleEn: "Knowledge",
      items: [
        { path: "/tcm-knowledge", labelKey: "nav.tcmKnowledge", icon: BookOpen, tag: "Neo4j" },
        ...(isSuperuser ? [{ path: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, tag: "Admin" } as NavItem] : []),
      ],
    },
  ];

  const navLabels: Record<string, string> = {
    "nav.profile": "个人中心",
    "nav.dashboard": "仪表盘",
    "nav.tcmDiagnosis": "中医问诊",
    "nav.wizardDiagnosis": "向导辨证",
    "nav.tcmKnowledge": "知识库",
    "nav.tcmGraph": "体质辨识",
    "nav.skinDetection": "皮肤检测",
  };

  const navLabelsEn: Record<string, string> = {
    "nav.profile": "Profile",
    "nav.dashboard": "Dashboard",
    "nav.tcmDiagnosis": "AI Consultation",
    "nav.wizardDiagnosis": "Guided Dx",
    "nav.tcmKnowledge": "Knowledge",
    "nav.tcmGraph": "Constitution",
    "nav.skinDetection": "Skin Detection",
  };

  const labels = language === "en" ? navLabelsEn : navLabels;
  const displayName = language === "en" ? "Health Profile User" : "健康档案用户";

  const renderBrand = () => (
    <Link to="/" className="flex items-center gap-3 px-1">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-white shadow-[0_8px_24px_rgba(45,59,46,0.12)] ring-1 ring-[#E2E8E3]">
        <img src={logoUrl} alt="千方慧鉴" className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0">
        <div className="text-[18px] font-bold tracking-tight text-[#223126]">千方慧鉴</div>
        <div className="mt-0.5 text-[11px] text-[#6B7B6E]">智慧中医辅助平台</div>
      </div>
    </Link>
  );

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    return (
      <Link
        key={item.path}
        to={item.path}
        className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
          isActive
            ? "bg-white text-[#223126] shadow-[0_10px_30px_rgba(91,125,99,0.13)] ring-1 ring-[#DCE7DD]"
            : "text-[#627365] hover:bg-white/72 hover:text-[#223126] hover:shadow-sm"
        }`}
      >
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-all ${isActive ? "bg-[#E8F0EA] text-[#5B7D63]" : "bg-white/55 text-[#7D9282] group-hover:text-[#5B7D63]"}`}>
          <Icon size={18} />
        </span>
        <span className="flex-1 truncate">{labels[item.labelKey]}</span>
        {item.tag && (
          <span className="rounded-full bg-[#F5F0E8] px-2 py-0.5 text-[9px] font-semibold text-[#8B6F47] ring-1 ring-[#EAD8A6]/60">
            {item.tag}
          </span>
        )}
      </Link>
    );
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-5 pt-6">{renderBrand()}</div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-4 pb-4">
        {navGroups.map((group) => (
          <div key={group.title}>
            <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9AA89C]">
              {language === "en" ? group.titleEn : group.title}
            </div>
            <div className="space-y-1.5">{group.items.map(renderNavItem)}</div>
          </div>
        ))}
      </nav>

      <div className="space-y-3 border-t border-[#E2E8E3] p-4">
        <div className="rounded-2xl bg-white/72 p-3 ring-1 ring-[#E2E8E3]">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#5B7D63]">
            <ShieldCheck size={14} />
            {language === "en" ? "Safe auxiliary use" : "安全辅助使用"}
          </div>
          <p className="mt-1 text-[11px] leading-5 text-[#6B7B6E]">
            {language === "en" ? "For health reference only, not a replacement for clinical diagnosis." : "仅作健康参考，不替代执业医师诊断。"}
          </p>
        </div>

      </div>
    </div>
  );


  const accountControls = (
    <div className="absolute right-16 top-3 z-50 flex items-center gap-2 rounded-2xl border border-[#E2E8E3]/90 bg-white/86 px-2.5 py-2 shadow-[0_12px_34px_rgba(45,59,46,0.10)] backdrop-blur-xl sm:right-4 lg:right-6">
      <div className="hidden items-center gap-1.5 sm:flex">
        <Globe size={15} className="text-[#8B9E8F]" />
        <Select value={language} onValueChange={(val) => setLanguage(val as "zh" | "en")}>
          <SelectTrigger className="h-8 w-[84px] border-[#E2E8E3] bg-white/70 text-xs text-[#6B7B6E]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="zh">中文</SelectItem>
            <SelectItem value="en">English</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isAuthenticated ? (
        <div className="flex items-center gap-2">
          <Avatar className="flex h-8 w-8 items-center justify-center bg-gradient-to-br from-[#5B7D63] to-[#A8BFAE] text-xs font-bold text-white">
            {user?.avatar ? <img src={user.avatar} alt={displayName} className="h-full w-full rounded-full object-cover" /> : displayName.charAt(0)}
          </Avatar>
          <span className="hidden max-w-[116px] truncate text-sm font-medium text-[#2D3B2E] md:inline">{displayName}</span>
          <button
            onClick={logout}
            className="flex h-8 items-center gap-1 rounded-xl px-2 text-xs text-[#6B7B6E] transition-colors hover:bg-red-50 hover:text-[#C0392B]"
            title={language === "en" ? "Logout" : "退出登录"}
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">{language === "en" ? "Logout" : "退出"}</span>
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" className="h-8 rounded-xl px-2 text-xs text-[#6B7B6E] hover:text-[#2D3B2E]" onClick={() => navigate("/login")}>
            <LogIn size={15} className="mr-1" />
            {language === "en" ? "Login" : "登录"}
          </Button>
          <Button size="sm" className="hidden h-8 rounded-xl bg-[#5B7D63] px-3 text-xs text-white hover:bg-[#46674D] sm:inline-flex" onClick={() => navigate("/register")}>
            {language === "en" ? "Register" : "注册"}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative min-h-screen bg-[#F8FAF7] text-[#223126]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[12%] top-[-20%] h-[34rem] w-[34rem] rounded-full bg-[#E8F0EA]/70 blur-3xl" />
        <div className="absolute right-[-12%] top-[18%] h-[30rem] w-[30rem] rounded-full bg-[#F5F0E8]/80 blur-3xl" />
        <div className="absolute bottom-[-20%] left-[42%] h-[28rem] w-[28rem] rounded-full bg-[#EEF4F7]/70 blur-3xl" />
      </div>

      {accountControls}

      <aside className="fixed bottom-0 left-0 top-0 z-30 hidden w-[292px] border-r border-[#E2E8E3]/80 bg-white/68 backdrop-blur-xl lg:block">
        {sidebar}
      </aside>

      <header className="fixed left-0 right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-[#E2E8E3]/80 bg-white/78 px-4 backdrop-blur-xl lg:hidden">
        {renderBrand()}
        <button onClick={() => setMobileOpen(true)} className="rounded-xl p-2 text-[#6B7B6E] hover:bg-[#F0F4F1]">
          <Menu size={20} />
        </button>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="mobile-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              key="mobile-panel"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
              className="fixed bottom-0 left-0 top-0 z-50 flex w-[306px] flex-col bg-[#F8FAF7] shadow-xl"
            >
              <div className="flex h-16 items-center justify-between border-b border-[#E2E8E3] px-4">
                {renderBrand()}
                <button onClick={() => setMobileOpen(false)} className="rounded-xl p-2 text-[#6B7B6E] hover:bg-[#F0F4F1]">
                  <X size={18} />
                </button>
              </div>
              {sidebar}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="relative min-h-screen pt-20 lg:ml-[292px] lg:pt-6">
        <div className="mx-auto max-w-[1280px] p-4 pb-20 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
