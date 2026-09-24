import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Layers, 
  Cpu, 
  Volume2, 
  FolderOpen, 
  Save, 
  Plus, 
  Trash2, 
  Play, 
  Check, 
  Sparkles, 
  Eye, 
  Palette, 
  Type, 
  RefreshCw,
  Code,
  ShieldAlert,
  Clock,
  Zap,
  Globe,
  Share2,
  Video,
  X,
  FileText,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Radio,
  Cookie,
  Upload,
  ExternalLink,
  Image as ImageIcon
} from 'lucide-react';
import { 
  AppSettings, 
  AIAccount, 
  AspectRatio, 
  WhisperModel, 
  DeviceType,
  OperationMode,
  TTSServer,
  TTSSpeedMode,
  TTSExportMode,
  MaskType,
  MaskWidth,
  PlatformCookieKey,
  PlatformCookieStatusMap,
} from '../types';
import { TTSService } from '../services/ttsService';

interface SettingsScreenProps {
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  onShowNotification: (msg: string) => void;
  onClose?: () => void;
  initialTab?: TabKey;
  initialPlatformCookie?: PlatformCookieKey;
}

export type TabKey = 
  | 'whisper' 
  | 'ai_pool' 
  | 'tts' 
  | 'subtitles' 
  | 'decor' 
  | 'storage' 
  | 'social'
  | 'cookies';

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onUpdateSettings,
  onShowNotification,
  onClose,
  initialTab,
  initialPlatformCookie,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab || 'ai_pool');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isPlayingTts, setIsPlayingTts] = useState(false);
  const [pingStatus, setPingStatus] = useState<Record<string, { loading: boolean; msg: string; success?: boolean }>>({});

  // Cookies Management State (Multi-platform)
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformCookieKey>(initialPlatformCookie || 'youtube');

  useEffect(() => {
    if (initialPlatformCookie) {
      setSelectedPlatform(initialPlatformCookie);
    }
  }, [initialPlatformCookie]);
  const [platformCookieStatus, setPlatformCookieStatus] = useState<PlatformCookieStatusMap>({
    youtube: { exists: false, sizeBytes: 0, lineCount: 0 },
    douyin: { exists: false, sizeBytes: 0, lineCount: 0 },
    tiktok: { exists: false, sizeBytes: 0, lineCount: 0 },
    facebook: { exists: false, sizeBytes: 0, lineCount: 0 },
    instagram: { exists: false, sizeBytes: 0, lineCount: 0 },
  });
  const [cookiesInput, setCookiesInput] = useState('');
  const [isSavingCookies, setIsSavingCookies] = useState(false);

  // Fetch cookie status on mount
  const refreshPlatformCookies = () => {
    fetch('/api/platform-cookies-status')
      .then((r) => r.json())
      .then((data: PlatformCookieStatusMap) => {
        if (data && typeof data === 'object') {
          setPlatformCookieStatus(data);
        }
      })
      .catch(() => {});
  };

  React.useEffect(() => {
    refreshPlatformCookies();
  }, []);

  // Local state for all settings so edits are responsive
  const [localSettings, setLocalSettings] = useState<AppSettings>({ ...settings });

  // Dedicated states for Gemini (AI Dịch Chính)
  const [geminiType, setGeminiType] = useState<'gemini_cookie' | 'gemini'>('gemini_cookie');
  const [geminiName, setGeminiName] = useState('');
  const [geminiKeyOrCookie, setGeminiKeyOrCookie] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-3.1-flash-lite');
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [geminiTestMsg, setGeminiTestMsg] = useState<{ success: boolean; msg: string } | null>(null);

  // Dedicated states for DeepSeek (AI Dự Phòng)
  const [deepseekName, setDeepseekName] = useState('');
  const [deepseekKey, setDeepseekKey] = useState('');
  const [deepseekModel, setDeepseekModel] = useState('deepseek-chat');
  const [deepseekBaseUrl, setDeepseekBaseUrl] = useState('https://api.deepseek.com');
  const [isTestingDeepSeek, setIsTestingDeepSeek] = useState(false);
  const [deepseekTestMsg, setDeepseekTestMsg] = useState<{ success: boolean; msg: string } | null>(null);

  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  const updateField = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveAll = () => {
    onUpdateSettings(localSettings);
    setSavedSuccess(true);
    onShowNotification('Đã lưu toàn bộ cấu hình hệ thống thành công!');
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  // Test & Add Gemini
  const handleTestGemini = async () => {
    if (!geminiKeyOrCookie.trim()) {
      onShowNotification('Vui lòng nhập Cookie hoặc API Key Gemini trước khi kiểm tra!');
      return;
    }
    setIsTestingGemini(true);
    setGeminiTestMsg(null);
    try {
      const res = await fetch('/api/check-account-ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: geminiType,
          keyOrCookie: geminiKeyOrCookie.trim(),
          model: geminiModel,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGeminiTestMsg({ success: true, msg: `OK (${data.latencyMs}ms): ${data.message}` });
      } else {
        setGeminiTestMsg({ success: false, msg: data.error || 'Kiểm tra thất bại' });
      }
    } catch (e: any) {
      setGeminiTestMsg({ success: false, msg: `Lỗi kết nối: ${e.message}` });
    } finally {
      setIsTestingGemini(false);
    }
  };

  const handleAddGemini = () => {
    if (!geminiName.trim()) {
      onShowNotification('Vui lòng nhập Tên tài khoản Gemini!');
      return;
    }
    if (!geminiKeyOrCookie.trim()) {
      onShowNotification(geminiType === 'gemini_cookie' ? 'Vui lòng dán chuỗi Cookie Gemini Web!' : 'Vui lòng nhập API Key Gemini!');
      return;
    }

    const newAcc: AIAccount = {
      id: `gemini-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      provider: geminiType,
      name: geminiName.trim(),
      keyOrCookie: geminiKeyOrCookie.trim(),
      model: geminiModel || 'gemini-3.1-flash-lite',
      status: 'active',
      requestsCount: 0,
      lastUsed: 'Vừa thêm',
      lastResponseTimeMs: 0,
    };

    const updated = [...(localSettings.aiAccounts || []), newAcc];
    updateField('aiAccounts', updated);
    onUpdateSettings({ aiAccounts: updated });

    setGeminiName('');
    setGeminiKeyOrCookie('');
    setGeminiTestMsg(null);
    onShowNotification(`Đã thêm [${newAcc.name}] vào Pool GEMINI (AI DỊCH CHÍNH)!`);
  };

  // Test & Add DeepSeek
  const handleTestDeepSeek = async () => {
    if (!deepseekKey.trim()) {
      onShowNotification('Vui lòng nhập API Key DeepSeek (sk-...) trước khi kiểm tra!');
      return;
    }
    setIsTestingDeepSeek(true);
    setDeepseekTestMsg(null);
    try {
      const res = await fetch('/api/check-account-ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'deepseek',
          keyOrCookie: deepseekKey.trim(),
          baseUrl: deepseekBaseUrl.trim() || 'https://api.deepseek.com',
          model: deepseekModel || 'deepseek-chat',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeepseekTestMsg({ success: true, msg: `OK (${data.latencyMs}ms): ${data.message}` });
      } else {
        setDeepseekTestMsg({ success: false, msg: data.error || 'Kiểm tra thất bại' });
      }
    } catch (e: any) {
      setDeepseekTestMsg({ success: false, msg: `Lỗi kết nối: ${e.message}` });
    } finally {
      setIsTestingDeepSeek(false);
    }
  };

  const handleAddDeepSeek = () => {
    if (!deepseekName.trim()) {
      onShowNotification('Vui lòng nhập Tên tài khoản DeepSeek!');
      return;
    }
    if (!deepseekKey.trim()) {
      onShowNotification('Vui lòng nhập API Key DeepSeek (sk-...)!');
      return;
    }

    const newAcc: AIAccount = {
      id: `deepseek-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      provider: 'deepseek',
      name: deepseekName.trim(),
      keyOrCookie: deepseekKey.trim(),
      baseUrl: deepseekBaseUrl.trim() || 'https://api.deepseek.com',
      model: deepseekModel || 'deepseek-chat',
      status: 'active',
      requestsCount: 0,
      lastUsed: 'Vừa thêm',
      lastResponseTimeMs: 0,
    };

    const updated = [...(localSettings.aiAccounts || []), newAcc];
    updateField('aiAccounts', updated);
    onUpdateSettings({ aiAccounts: updated });

    setDeepseekName('');
    setDeepseekKey('');
    setDeepseekTestMsg(null);
    onShowNotification(`Đã thêm [${newAcc.name}] vào Pool DEEPSEEK (AI DỰ PHÒNG)!`);
  };

  const handleDeleteAccount = (id: string) => {
    const updated = (localSettings.aiAccounts || []).filter((a) => a.id !== id);
    updateField('aiAccounts', updated);
    onUpdateSettings({ aiAccounts: updated });
    onShowNotification('Đã xóa tài khoản khỏi Pool.');
  };

  const handleToggleAccountStatus = (id: string) => {
    const updated = (localSettings.aiAccounts || []).map((a) => {
      if (a.id === id) {
        return {
          ...a,
          status: (a.status === 'active' ? 'exhausted' : 'active') as 'active' | 'exhausted',
        };
      }
      return a;
    });
    updateField('aiAccounts', updated);
    onUpdateSettings({ aiAccounts: updated });
  };

  // Real Ping Check
  const handlePingAccount = async (acc: AIAccount) => {
    setPingStatus((prev) => ({ ...prev, [acc.id]: { loading: true, msg: 'Đang kiểm tra kết nối API thật...' } }));
    try {
      const res = await fetch('/api/check-account-ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: acc.provider,
          keyOrCookie: acc.keyOrCookie,
          baseUrl: acc.baseUrl,
          model: acc.model,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPingStatus((prev) => ({
          ...prev,
          [acc.id]: { loading: false, msg: `OK (${data.latencyMs}ms): ${data.message}`, success: true },
        }));
        // Update account response time
        const updated = (localSettings.aiAccounts || []).map((a) =>
          a.id === acc.id ? { ...a, status: 'active' as const, lastResponseTimeMs: data.latencyMs, lastUsed: 'Vừa ping' } : a
        );
        updateField('aiAccounts', updated);
        onUpdateSettings({ aiAccounts: updated });
      } else {
        const errMsg = data.error || `Lỗi HTTP ${res.status}`;
        setPingStatus((prev) => ({
          ...prev,
          [acc.id]: { loading: false, msg: errMsg, success: false },
        }));
        if (data.status === 'exhausted') {
          const updated = (localSettings.aiAccounts || []).map((a) =>
            a.id === acc.id ? { ...a, status: 'exhausted' as const, lastError: errMsg } : a
          );
          updateField('aiAccounts', updated);
          onUpdateSettings({ aiAccounts: updated });
        }
      }
    } catch (err: any) {
      setPingStatus((prev) => ({
        ...prev,
        [acc.id]: { loading: false, msg: `Lỗi kết nối: ${err.message}`, success: false },
      }));
    }
  };

  // TTS Sample Preview
  const handleTestTTS = () => {
    if (isPlayingTts) {
      TTSService.stop();
      setIsPlayingTts(false);
      return;
    }

    setIsPlayingTts(true);
    const sampleText = 'Chào mừng bạn đến với công cụ dịch video chuyên nghiệp. Giọng đọc tiếng Việt tự nhiên, rõ từng dấu câu!';
    TTSService.speak(
      sampleText,
      localSettings.speedRate || 1.0,
      () => setIsPlayingTts(false),
      () => setIsPlayingTts(false)
    );
  };

  // Multi-platform Cookies Management Handlers
  const handleSavePlatformCookies = async () => {
    if (!cookiesInput.trim()) {
      onShowNotification(`Vui lòng dán nội dung cookies hoặc chọn tệp cookies cho [${selectedPlatform.toUpperCase()}]`);
      return;
    }
    setIsSavingCookies(true);
    try {
      const res = await fetch('/api/save-platform-cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: selectedPlatform, cookiesText: cookiesInput }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        refreshPlatformCookies();
        setCookiesInput('');
        onShowNotification(`Đã lưu ${data.lineCount} cookies cho [${selectedPlatform.toUpperCase()}] thành công!`);
      } else {
        onShowNotification(`Lỗi khi lưu cookies cho ${selectedPlatform}: ${data.error || 'Thất bại'}`);
      }
    } catch (err: any) {
      onShowNotification(`Lỗi kết nối máy chủ: ${err.message}`);
    } finally {
      setIsSavingCookies(false);
    }
  };

  const handleDeletePlatformCookies = async (platformToDelete: PlatformCookieKey) => {
    try {
      const res = await fetch(`/api/delete-platform-cookies/${platformToDelete}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        refreshPlatformCookies();
        if (platformToDelete === selectedPlatform) {
          setCookiesInput('');
        }
        onShowNotification(`Đã xóa tệp cookies của [${platformToDelete.toUpperCase()}]`);
      }
    } catch (err: any) {
      onShowNotification(`Lỗi khi xóa cookies ${platformToDelete}: ${err.message}`);
    }
  };

  const handleCookieFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCookiesInput(text);
        onShowNotification(`Đã nạp file "${file.name}" (${(file.size / 1024).toFixed(1)} KB) cho [${selectedPlatform.toUpperCase()}]. Nhấn "Lưu Cookies" để áp dụng!`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0c16] text-slate-200 flex flex-col overflow-hidden animate-in fade-in duration-150">
      {/* Top Application Header */}
      <div className="h-14 px-6 bg-[#101222] border-b border-[#1e2338] flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center">
            <Sliders className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <span>Cài đặt & Thiết lập Cấu hình Hệ thống</span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono">
                FULL CONFIGURATION
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Quản lý toàn bộ thông số Whisper, Pool tài khoản AI Dịch, Thuyết minh TTS, Phụ đề và Video Output
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveAll}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
          >
            {savedSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{savedSuccess ? 'Đã lưu cấu hình!' : 'Lưu toàn bộ cài đặt'}</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#1b1f35] text-slate-400 hover:text-white rounded-lg border border-[#232942] transition-colors"
              title="Đóng (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Settings Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <div className="w-64 bg-[#0d0f1e] border-r border-[#1a1f33] flex flex-col shrink-0 py-3 select-none">
          <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
            <button
              onClick={() => setActiveTab('ai_pool')}
              className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all ${
                activeTab === 'ai_pool'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-300 hover:bg-[#161a2e] hover:text-white'
              }`}
            >
              <Zap className="w-4 h-4 shrink-0 text-amber-400" />
              <div className="text-left">
                <div>AI Dịch thuật & Pool Tài Khoản</div>
                <div className="text-[10px] font-normal opacity-70">Gemini, DeepSeek, OpenAI...</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('whisper')}
              className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all ${
                activeTab === 'whisper'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-300 hover:bg-[#161a2e] hover:text-white'
              }`}
            >
              <Cpu className="w-4 h-4 shrink-0 text-cyan-400" />
              <div className="text-left">
                <div>Whisper & Nhận diện STT / OCR</div>
                <div className="text-[10px] font-normal opacity-70">Tách giọng, HardSub OCR</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('tts')}
              className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all ${
                activeTab === 'tts'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-300 hover:bg-[#161a2e] hover:text-white'
              }`}
            >
              <Volume2 className="w-4 h-4 shrink-0 text-pink-400" />
              <div className="text-left">
                <div>Thuyết minh & Lồng tiếng (TTS)</div>
                <div className="text-[10px] font-normal opacity-70">Giọng đọc Việt, ngắt nghỉ dấu câu</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('subtitles')}
              className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all ${
                activeTab === 'subtitles'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-300 hover:bg-[#161a2e] hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0 text-emerald-400" />
              <div className="text-left">
                <div>Che Sub Gốc & Định dạng Sub</div>
                <div className="text-[10px] font-normal opacity-70">Auto Mask, Font, Viền, Màu</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('decor')}
              className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all ${
                activeTab === 'decor'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-300 hover:bg-[#161a2e] hover:text-white'
              }`}
            >
              <Video className="w-4 h-4 shrink-0 text-purple-400" />
              <div className="text-left">
                <div>Trang trí Video & Tỷ lệ Khung</div>
                <div className="text-[10px] font-normal opacity-70">1:1, 16:9, 9:16, Banner, Logo</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('storage')}
              className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all ${
                activeTab === 'storage'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-300 hover:bg-[#161a2e] hover:text-white'
              }`}
            >
              <FolderOpen className="w-4 h-4 shrink-0 text-blue-400" />
              <div className="text-left">
                <div>Thư mục & Tối ưu Hàng đợi</div>
                <div className="text-[10px] font-normal opacity-70">Đường dẫn xuất file, luồng chạy</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('social')}
              className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all ${
                activeTab === 'social'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-300 hover:bg-[#161a2e] hover:text-white'
              }`}
            >
              <Share2 className="w-4 h-4 shrink-0 text-red-400" />
              <div className="text-left">
                <div>Tự động Đăng Mạng Xã Hội</div>
                <div className="text-[10px] font-normal opacity-70">YouTube Chrome, Facebook Page</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('cookies')}
              className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all ${
                activeTab === 'cookies'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-300 hover:bg-[#161a2e] hover:text-white'
              }`}
            >
              <Cookie className="w-4 h-4 shrink-0 text-amber-400" />
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span>Cookies Nền Tảng (Riêng Biệt)</span>
                  {Object.values(platformCookieStatus).some((p) => p.exists) && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" title="Đã có cookies nền tảng" />
                  )}
                </div>
                <div className="text-[10px] font-normal opacity-70">
                  {Object.values(platformCookieStatus).filter((p) => p.exists).length}/5 nền tảng đã lưu
                </div>
              </div>
            </button>
          </nav>

          {/* Quick Account Summary */}
          <div className="p-3 mx-3 rounded-xl bg-[#14172b] border border-[#222740] text-xs">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>Pool tài khoản AI:</span>
              <span className="font-bold text-white">{(localSettings.aiAccounts || []).length} tài khoản</span>
            </div>
            <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Chế độ xoay vòng tự động</span>
            </div>
          </div>
        </div>

        {/* Right Content View */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#0a0c16]">
          {/* TAB 1: AI TRANSLATION & POOL MANAGER */}
          {activeTab === 'ai_pool' && (
            <div className="max-w-5xl space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <span>Cấu hình AI Dịch thuật & Quản lý Pool Tài Khoản Xoay Vòng</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Hỗ trợ thêm nhiều tài khoản Gemini, DeepSeek (api.deepseek.com) và OpenAI. Hệ thống sẽ tự động chuyển đổi tài khoản tiếp theo khi hết lượt (402) hoặc lỗi (401/429/503).
                </p>
              </div>

              {/* General Translation Options */}
              <div className="bg-[#121424] border border-[#21263d] rounded-xl p-5 space-y-4">
                <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                  Quy tắc & Văn phong Dịch thuật
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-slate-300 block mb-1.5 font-medium">Chiến lược Xoay Vòng</label>
                    <select
                      value={localSettings.rotationStrategy || 'failover_only'}
                      onChange={(e) => updateField('rotationStrategy', e.target.value as any)}
                      className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                    >
                      <option value="failover_only">Chỉ chuyển khi lỗi / Hết Quota (Khuyên dùng)</option>
                      <option value="round_robin">Xoay vòng đều giữa các tài khoản</option>
                      <option value="fastest">Ưu tiên tài khoản phản hồi nhanh nhất</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1.5 font-medium">Ngôn ngữ Đích</label>
                    <input
                      type="text"
                      value={localSettings.targetLanguage || 'Tiếng Việt'}
                      onChange={(e) => updateField('targetLanguage', e.target.value)}
                      className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1.5 font-medium">Số câu xử lý mỗi đợt (Batch)</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={localSettings.batchLines || 10}
                      onChange={(e) => updateField('batchLines', Number(e.target.value))}
                      className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Checkbox rules */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={localSettings.contextLinkSentences !== false}
                      onChange={(e) => updateField('contextLinkSentences', e.target.checked)}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <span>Dịch liên kết câu (Ngữ cảnh liền mạch)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={localSettings.strictWordCount !== false}
                      onChange={(e) => updateField('strictWordCount', e.target.checked)}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <span>Giới hạn lệch tối đa 1-2 từ</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={localSettings.timeAdaptive || false}
                      onChange={(e) => updateField('timeAdaptive', e.target.checked)}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <span>Rút gọn câu để đọc kịp thời lượng video</span>
                  </label>
                </div>

                {/* Custom Prompt */}
                <div>
                  <label className="text-xs text-slate-300 block mb-1 font-medium">
                    Chỉ thị Văn phong Chuyên sâu (Custom Prompt cho AI)
                  </label>
                  <textarea
                    rows={2}
                    value={localSettings.customPrompt || ''}
                    onChange={(e) => updateField('customPrompt', e.target.value)}
                    placeholder="Ví dụ: Giọng văn giật gân, cuốn hút người xem video ngắn triệu view. Nếu gặp danh xưng thì dịch trang trọng..."
                    className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* Translation Orchestrator Architecture Visual Banner */}
              <div className="bg-gradient-to-r from-purple-950/40 via-[#151a33] to-blue-950/40 border border-purple-500/30 rounded-xl p-4 shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Sơ Đồ Translation Orchestrator (Chia Nhóm Đúng 6 Câu - Gemini & DeepSeek Thay Nhau)
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-center text-[11px] font-mono mt-3">
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-700/60 flex flex-col justify-center items-center">
                    <span className="text-cyan-400 font-bold mb-1">BƯỚC 1</span>
                    <span className="text-slate-200">Video / Link</span>
                    <span className="text-[10px] text-slate-400">yt-dlp + FFmpeg</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-700/60 flex flex-col justify-center items-center">
                    <span className="text-indigo-400 font-bold mb-1">BƯỚC 2</span>
                    <span className="text-slate-200">Whisper Local</span>
                    <span className="text-[10px] text-slate-400">Sub thật 100%</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-purple-950/60 border border-purple-500/40 flex flex-col justify-center items-center">
                    <span className="text-purple-300 font-bold mb-1">BƯỚC 3</span>
                    <span className="text-purple-200 font-semibold">Gemini Cookie / API</span>
                    <span className="text-[10px] text-purple-300/80">AI Dịch Chính (6 câu)</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-500/40 flex flex-col justify-center items-center">
                    <span className="text-amber-300 font-bold mb-1">BƯỚC 4</span>
                    <span className="text-amber-200 font-semibold">Retry 1 Lần</span>
                    <span className="text-[10px] text-amber-300/80">Tự động thử lại</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-blue-950/60 border border-blue-500/40 flex flex-col justify-center items-center">
                    <span className="text-blue-300 font-bold mb-1">BƯỚC 5</span>
                    <span className="text-blue-200 font-semibold">DeepSeek API</span>
                    <span className="text-[10px] text-rose-300/80">Dự phòng (Lỗi -&gt; Dừng hẳn)</span>
                  </div>
                </div>
              </div>

              {/* TWO DEDICATED ADD ACCOUNT FORMS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. GEMINI WEB COOKIE / API (AI DỊCH CHÍNH) */}
                <div className="bg-[#121424] border border-purple-500/30 rounded-xl p-5 space-y-3.5 shadow-md">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span>Thêm Tài Khoản Gemini (AI Dịch Chính)</span>
                    </h4>
                    <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold">
                      ƯU TIÊN 1
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Dịch nhóm 6 câu đầu tiên. Hỗ trợ nạp <strong>Cookie Web</strong> từ gemini.google.com (không lo hết hạn mức) hoặc <strong>API Key</strong> Google AI Studio.
                  </p>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setGeminiType('gemini_cookie')}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                        geminiType === 'gemini_cookie'
                          ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                          : 'bg-[#171a2d] text-slate-400 border-[#293049] hover:text-white'
                      }`}
                    >
                      🍪 Gemini Web Cookie
                    </button>
                    <button
                      type="button"
                      onClick={() => setGeminiType('gemini')}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                        geminiType === 'gemini'
                          ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                          : 'bg-[#171a2d] text-slate-400 border-[#293049] hover:text-white'
                      }`}
                    >
                      🔑 Gemini API Key
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-slate-300 block mb-1">Tên Gợi Nhớ Tài Khoản</label>
                      <input
                        type="text"
                        placeholder={geminiType === 'gemini_cookie' ? 'Ví dụ: Gemini Web Cookie #1' : 'Ví dụ: Gemini Flash 3.1 Key VIP'}
                        value={geminiName}
                        onChange={(e) => setGeminiName(e.target.value)}
                        className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-300 block mb-1">
                        {geminiType === 'gemini_cookie' ? 'Dán Chuỗi Cookie (__Secure-1PSID hoặc toàn bộ Cookie)' : 'Nhập Gemini API Key (AIza...)'}
                      </label>
                      <input
                        type="password"
                        placeholder={geminiType === 'gemini_cookie' ? 'Dán cookie string từ tab Network/Application trên gemini.google.com' : 'AIzaSy...'}
                        value={geminiKeyOrCookie}
                        onChange={(e) => setGeminiKeyOrCookie(e.target.value)}
                        className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-300 block mb-1">Mô Hình Dịch</label>
                      <input
                        type="text"
                        value={geminiModel}
                        onChange={(e) => setGeminiModel(e.target.value)}
                        placeholder="gemini-3.1-flash-lite"
                        className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500 font-mono"
                      />
                    </div>
                  </div>

                  {geminiTestMsg && (
                    <div className={`p-2 rounded text-[11px] ${geminiTestMsg.success ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-500/30' : 'bg-rose-950/50 text-rose-300 border border-rose-500/30'}`}>
                      {geminiTestMsg.msg}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleTestGemini}
                      disabled={isTestingGemini}
                      className="px-3 py-2 bg-[#1a1e36] hover:bg-[#252b4c] text-purple-300 border border-purple-500/40 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTestingGemini ? 'animate-spin' : ''}`} />
                      <span>{isTestingGemini ? 'Đang test...' : 'Kiểm tra'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAddGemini}
                      className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Lưu vào Pool Gemini (AI Chính)</span>
                    </button>
                  </div>
                </div>

                {/* 2. DEEPSEEK API (AI DỰ PHÒNG KHI GEMINI LỖI) */}
                <div className="bg-[#121424] border border-blue-500/30 rounded-xl p-5 space-y-3.5 shadow-md">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-blue-400" />
                      <span>Thêm Tài Khoản DeepSeek API (AI Dự Phòng)</span>
                    </h4>
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold">
                      CỨU NGUY
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Được kích hoạt tự động nếu Gemini lỗi 2 lần (lần đầu + retry 1 lần). Nếu DeepSeek cũng lỗi, hệ thống <strong>dừng hẳn</strong> để bạn kiểm tra.
                  </p>

                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-slate-300 block mb-1">Tên Gợi Nhớ Tài Khoản</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: DeepSeek API Dự Phòng #1"
                        value={deepseekName}
                        onChange={(e) => setDeepseekName(e.target.value)}
                        className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-300 block mb-1">DeepSeek API Key (sk-...)</label>
                      <input
                        type="password"
                        placeholder="sk-..."
                        value={deepseekKey}
                        onChange={(e) => setDeepseekKey(e.target.value)}
                        className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-slate-300 block mb-1">Model</label>
                        <input
                          type="text"
                          value={deepseekModel}
                          onChange={(e) => setDeepseekModel(e.target.value)}
                          placeholder="deepseek-chat"
                          className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-300 block mb-1">Base URL</label>
                        <input
                          type="text"
                          value={deepseekBaseUrl}
                          onChange={(e) => setDeepseekBaseUrl(e.target.value)}
                          placeholder="https://api.deepseek.com"
                          className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {deepseekTestMsg && (
                    <div className={`p-2 rounded text-[11px] ${deepseekTestMsg.success ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-500/30' : 'bg-rose-950/50 text-rose-300 border border-rose-500/30'}`}>
                      {deepseekTestMsg.msg}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleTestDeepSeek}
                      disabled={isTestingDeepSeek}
                      className="px-3 py-2 bg-[#1a1e36] hover:bg-[#252b4c] text-blue-300 border border-blue-500/40 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTestingDeepSeek ? 'animate-spin' : ''}`} />
                      <span>{isTestingDeepSeek ? 'Đang test...' : 'Kiểm tra'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAddDeepSeek}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Lưu vào Pool DeepSeek (AI Dự Phòng)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Pool Accounts Table */}
              <div className="bg-[#121424] border border-[#21263d] rounded-xl overflow-hidden shadow-md">
                <div className="px-5 py-3 bg-[#16192c] border-b border-[#21263d] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Danh Sách Tài Khoản Trong Pool Dịch Thuật
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold">
                      {(localSettings.aiAccounts || []).length} Tài Khoản
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setJsonInput(JSON.stringify(localSettings.aiAccounts || [], null, 2));
                        setShowJsonModal(true);
                      }}
                      className="px-2.5 py-1 bg-[#1c2035] hover:bg-[#252b47] text-slate-300 hover:text-white rounded text-[11px] border border-[#2a314d] flex items-center gap-1"
                    >
                      <Code className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Import / Export JSON</span>
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-[#1e2338]">
                  {(localSettings.aiAccounts || []).length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                      <AlertTriangle className="w-8 h-8 text-amber-400/60 mx-auto mb-2" />
                      <p className="text-xs text-slate-400 font-medium">Chưa có tài khoản AI dịch thuật nào trong Pool.</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Hãy nhập Cookie / API Key Gemini phía trên và nạp thêm tài khoản DeepSeek API để kích hoạt cơ chế xoay vòng.
                      </p>
                    </div>
                  ) : (
                    (localSettings.aiAccounts || []).map((acc, index) => {
                      const pingInfo = pingStatus[acc.id];
                      const isGemini = acc.provider === 'gemini' || acc.provider === 'gemini_cookie';
                      return (
                        <div key={acc.id} className="p-4 hover:bg-[#151829] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                          <div className="flex items-start gap-3">
                            <div className={`w-6 h-6 rounded-full font-mono text-[11px] flex items-center justify-center font-bold shrink-0 mt-0.5 ${
                              isGemini ? 'bg-purple-900/60 text-purple-300 border border-purple-500/40' : 'bg-blue-900/60 text-blue-300 border border-blue-500/40'
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm">{acc.name}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold font-mono ${
                                  acc.provider === 'gemini_cookie'
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                    : acc.provider === 'gemini'
                                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                    : acc.provider === 'deepseek'
                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                    : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                }`}>
                                  {acc.provider === 'gemini_cookie' ? 'Gemini Cookie (Chính)' : acc.provider === 'gemini' ? 'Gemini API (Chính)' : acc.provider === 'deepseek' ? 'DeepSeek API (Dự Phòng)' : acc.provider}
                                </span>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  Model: {acc.model || 'Mặc định'}
                                </span>
                              </div>

                              <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
                                <span>Token: {acc.keyOrCookie.length > 12 ? `${acc.keyOrCookie.slice(0, 6)}••••••••${acc.keyOrCookie.slice(-4)}` : '••••••••'}</span>
                                {acc.baseUrl && <span>URL: {acc.baseUrl}</span>}
                                {acc.lastResponseTimeMs ? (
                                  <span className="text-emerald-400 font-mono">Độ trễ: {acc.lastResponseTimeMs}ms</span>
                                ) : null}
                              </div>

                              {/* Ping feedback message */}
                              {pingInfo && (
                                <div className={`text-[11px] mt-1.5 flex items-center gap-1.5 ${
                                  pingInfo.loading
                                    ? 'text-amber-400'
                                    : pingInfo.success
                                    ? 'text-emerald-400 font-semibold'
                                    : 'text-rose-400'
                                }`}>
                                  {pingInfo.loading && <RefreshCw className="w-3 h-3 animate-spin" />}
                                  <span>{pingInfo.msg}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Account Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Ping Button */}
                            <button
                              onClick={() => handlePingAccount(acc)}
                              disabled={pingInfo?.loading}
                              className="px-2.5 py-1.5 bg-[#1b1f35] hover:bg-[#252b47] text-cyan-300 hover:text-cyan-200 rounded-lg text-xs font-medium border border-[#2b3353] flex items-center gap-1.5 active:scale-95 transition-all"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${pingInfo?.loading ? 'animate-spin' : ''}`} />
                              <span>Kiểm tra</span>
                            </button>

                            {/* Status toggle */}
                            <button
                              onClick={() => handleToggleAccountStatus(acc.id)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                acc.status === 'active'
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
                              }`}
                            >
                              {acc.status === 'active' ? 'Đang hoạt động' : 'Tạm dừng'}
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteAccount(acc.id)}
                              className="p-1.5 bg-[#1b1f35] hover:bg-rose-600/20 text-slate-400 hover:text-rose-300 rounded-lg border border-[#2b3353] transition-colors"
                              title="Xóa tài khoản"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WHISPER STT & HARD SUB OCR */}
          {activeTab === 'whisper' && (
            <div className="max-w-4xl space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-cyan-400" />
                  <span>Cấu hình Whisper Speech-to-Text & Nhận diện HardSub OCR</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Thiết lập chế độ bóc tách giọng nói thành văn bản SRT hoặc quét chữ cứng trên khung hình video.
                </p>
              </div>

              <div className="bg-[#121424] border border-[#21263d] rounded-xl p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-300 block mb-1.5 font-medium">Chế độ Nhận diện Chính</label>
                    <select
                      value={localSettings.operationMode || 'speech_to_text'}
                      onChange={(e) => updateField('operationMode', e.target.value as OperationMode)}
                      className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                    >
                      <option value="speech_to_text">Tách âm thanh & Nhận diện giọng nói (Speech-to-Text Whisper)</option>
                      <option value="hard_sub_ocr">Quét chữ phụ đề cứng trên video (HardSub OCR)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1.5 font-medium">Ngôn ngữ Nguồn (Gốc)</label>
                    <select
                      value={localSettings.sourceLanguage || 'auto'}
                      onChange={(e) => updateField('sourceLanguage', e.target.value)}
                      className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                    >
                      <option value="auto">Tự động phát hiện (Auto Detect)</option>
                      <option value="zh">Tiếng Trung (Chinese - Douyin/Kuaishou)</option>
                      <option value="en">Tiếng Anh (English - YouTube/TikTok)</option>
                      <option value="vi">Tiếng Việt (Vietnamese)</option>
                      <option value="ja">Tiếng Nhật (Japanese)</option>
                      <option value="ko">Tiếng Hàn (Korean)</option>
                      <option value="th">Tiếng Thái (Thai)</option>
                      <option value="ru">Tiếng Nga (Russian)</option>
                      <option value="fr">Tiếng Pháp (French)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-slate-300 block mb-1.5 font-medium">Model Whisper</label>
                    <select
                      value={localSettings.whisperModel || 'base'}
                      onChange={(e) => updateField('whisperModel', e.target.value as WhisperModel)}
                      className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white outline-none focus:border-indigo-500 font-mono"
                    >
                      <option value="tiny">tiny (Siêu nhanh, ít RAM)</option>
                      <option value="base">base (Cân bằng, khuyên dùng)</option>
                      <option value="small">small (Chuẩn xác cao hơn)</option>
                      <option value="medium">medium (Chuyên sâu)</option>
                      <option value="large-v3">large-v3 (Chính xác tối đa)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1.5 font-medium">Phần cứng Xử lý (Device)</label>
                    <select
                      value={localSettings.device || 'cuda'}
                      onChange={(e) => updateField('device', e.target.value as DeviceType)}
                      className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white outline-none focus:border-indigo-500 font-mono"
                    >
                      <option value="cuda">GPU NVIDIA (CUDA Cores - Tốc độ cao)</option>
                      <option value="cpu">CPU (Bộ vi xử lý chính)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1.5 font-medium">Lọc Tạp Âm Giọng Nói (VAD)</label>
                    <div className="pt-2">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white">
                        <input
                          type="checkbox"
                          checked={localSettings.useVAD !== false}
                          onChange={(e) => updateField('useVAD', e.target.checked)}
                          className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                        />
                        <span>Bật Voice Activity Detection (VAD)</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1.5 font-medium">Đường dẫn Whisper CLI / Python Environment</label>
                  <input
                    type="text"
                    value={localSettings.whisperCliPath || 'faster-whisper-xxl'}
                    onChange={(e) => updateField('whisperCliPath', e.target.value)}
                    className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white font-mono outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={localSettings.enableAutoStart !== false}
                      onChange={(e) => updateField('enableAutoStart', e.target.checked)}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <span className="font-semibold text-emerald-400">
                      Tự động kích hoạt luồng xử lý ngay khi thêm File hoặc Dán Link video (Khuyên dùng)
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TTS THUYẾT MINH & LỒNG TIẾNG */}
          {activeTab === 'tts' && (
            <div className="max-w-4xl space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-pink-400" />
                  <span>Cấu hình Thuyết Minh & Lồng Tiếng (TTS - Natural Voice)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tạo giọng đọc thuyết minh tiếng Việt tự nhiên, đúng dấu thanh điệu, có ngắt nghỉ theo dấu phẩy và dấu chấm câu.
                </p>
              </div>

              <div className="bg-[#121424] border border-[#21263d] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#21263d]">
                  <div>
                    <label className="text-sm font-bold text-white block">Kích hoạt Thuyết Minh Lồng Tiếng vào Video</label>
                    <p className="text-xs text-slate-400">Tự động tổng hợp âm thanh giọng đọc và ghép vào video hoàn chỉnh</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.enableTTS !== false}
                    onChange={(e) => updateField('enableTTS', e.target.checked)}
                    className="w-5 h-5 rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-slate-300 block mb-1.5 font-medium">Động Cơ Thuyết Minh</label>
                    <select
                      value={localSettings.ttsServer || 'edge_tts'}
                      onChange={(e) => updateField('ttsServer', e.target.value as TTSServer)}
                      className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                    >
                      <option value="edge_tts">Google Neural Voice (Tiếng Việt thanh điệu chuẩn)</option>
                      <option value="piper_onnx">Nghim Piper ONNX (ngochuyennew / namminh)</option>
                      <option value="vits">VITS AI Voice Engine</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1.5 font-medium">Tốc độ Đọc (Speed Rate)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0.7"
                        max="1.5"
                        step="0.05"
                        value={localSettings.speedRate || 1.0}
                        onChange={(e) => updateField('speedRate', parseFloat(e.target.value))}
                        className="flex-1 accent-indigo-500 cursor-pointer"
                      />
                      <span className="text-xs font-mono font-bold text-indigo-400 w-10 text-right">
                        {(localSettings.speedRate || 1.0).toFixed(2)}x
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1.5 font-medium flex items-center gap-1.5">
                      <span>Đồng bộ Thời lượng & Giọng đọc</span>
                      <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] rounded font-bold">Khuyên dùng</span>
                    </label>
                    <select
                      value={localSettings.ttsSpeedMode || 'adaptive'}
                      onChange={(e) => updateField('ttsSpeedMode', e.target.value as TTSSpeedMode)}
                      className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                    >
                      <option value="adaptive">Tự động co giãn theo thời lượng câu (Ví dụ: Sub 01:02:39 - 01:02:42 đọc dứt điểm trong 3s)</option>
                      <option value="fixed">Tốc độ Cố định theo thanh trượt (Fixed Speed)</option>
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {localSettings.ttsSpeedMode === 'fixed'
                        ? 'Giọng đọc giữ nguyên tốc độ cố định, có thể lệch thời gian nếu sub ngắn.'
                        : 'Hệ thống tự động tính toán thời lượng từng câu và áp dụng FFmpeg atempo tăng tốc để đọc xong chính xác trước khi hết phụ đề.'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-slate-300 block mb-1.5 font-medium">
                      Âm lượng Gốc khi Lồng Tiếng (Audio Ducking)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="5"
                        max="50"
                        step="1"
                        value={localSettings.originalAudioVolume || 15}
                        onChange={(e) => updateField('originalAudioVolume', parseInt(e.target.value))}
                        className="flex-1 accent-indigo-500 cursor-pointer"
                      />
                      <span className="text-xs font-mono font-bold text-indigo-400 w-10 text-right">
                        {localSettings.originalAudioVolume || 15}%
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1.5 font-medium">
                      Âm lượng Giọng Thuyết Minh (TTS Gain)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="1.0"
                        max="3.0"
                        step="0.1"
                        value={localSettings.ttsVolume || 1.8}
                        onChange={(e) => updateField('ttsVolume', parseFloat(e.target.value))}
                        className="flex-1 accent-indigo-500 cursor-pointer"
                      />
                      <span className="text-xs font-mono font-bold text-indigo-400 w-10 text-right">
                        {(localSettings.ttsVolume || 1.8).toFixed(1)}x
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1.5 font-medium">Chế độ Xuất Âm Thanh</label>
                    <select
                      value={localSettings.ttsExportMode || 'mux_with_audio_ducking'}
                      onChange={(e) => updateField('ttsExportMode', e.target.value as TTSExportMode)}
                      className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                    >
                      <option value="mux_with_audio_ducking">Lồng tiếng kèm Audio Ducking (Khuyên dùng)</option>
                      <option value="replace_audio">Thay thế hoàn toàn âm thanh gốc</option>
                      <option value="separate_file">Tách file âm thanh thuyết minh riêng</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white">
                      <input
                        type="checkbox"
                        checked={localSettings.naturalPause !== false}
                        onChange={(e) => updateField('naturalPause', e.target.checked)}
                        className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                      />
                      <span>Tự động ngắt nghỉ tự nhiên theo dấu câu (phẩy 250ms, chấm 500ms)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white">
                      <input
                        type="checkbox"
                        checked={localSettings.realignSRT !== false}
                        onChange={(e) => updateField('realignSRT', e.target.checked)}
                        className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                      />
                      <span>Căn chỉnh lại mốc thời gian phụ đề khớp với thời gian đọc thực tế</span>
                    </label>
                  </div>

                  <button
                    onClick={handleTestTTS}
                    className="px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-lg shadow-pink-600/20 active:scale-95 transition-all"
                  >
                    <Play className={`w-3.5 h-3.5 ${isPlayingTts ? 'animate-pulse' : ''}`} />
                    <span>{isPlayingTts ? 'Dừng đọc...' : 'Nghe thử giọng mẫu'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CHE SUB GỐC & ĐỊNH DẠNG PHỤ ĐỀ */}
          {activeTab === 'subtitles' && (
            <div className="max-w-4xl space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-400" />
                  <span>Che Phụ Đề Gốc & Định Dạng Subtitle (SRT Styling)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tự động che phủ vùng chữ Trung Quốc / tiếng Anh gốc và tạo phụ đề tiếng Việt sắc nét.
                </p>
              </div>

              {/* Masking */}
              <div className="bg-[#121424] border border-[#21263d] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#21263d]">
                  <div>
                    <label className="text-sm font-bold text-white block">Tự động Che Phụ Đề Cứng Gốc (Auto Mask)</label>
                    <p className="text-xs text-slate-400">Làm mờ hoặc phủ màu đè lên dòng chữ cũ trên video</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.autoDetectHardSub !== false}
                    onChange={(e) => updateField('autoDetectHardSub', e.target.checked)}
                    className="w-5 h-5 rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-slate-300 block mb-1.5 font-medium">Kiểu Che Vùng Chữ</label>
                    <select
                      value={localSettings.maskType || 'blur'}
                      onChange={(e) => updateField('maskType', e.target.value as MaskType)}
                      className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                    >
                      <option value="blur">Làm mờ thông minh (Blur Gaussian)</option>
                      <option value="solid">Phủ dải màu đen đồng nhất (Solid Box)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1.5 font-medium">Độ Rộng Vùng Che</label>
                    <select
                      value={localSettings.maskWidth || 'full_width'}
                      onChange={(e) => updateField('maskWidth', e.target.value as MaskWidth)}
                      className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                    >
                      <option value="full_width">Tràn toàn màn hình (Full Width 100%)</option>
                      <option value="sub_width">Theo độ rộng câu thoại (Sub Width)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1.5 font-medium">Chiều cao Vùng che (%)</label>
                    <input
                      type="number"
                      min={5}
                      max={30}
                      value={localSettings.fallbackHeightPct || 10}
                      onChange={(e) => updateField('fallbackHeightPct', parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Subtitle Font & Appearance */}
              <div className="bg-[#121424] border border-[#21263d] rounded-xl p-5 space-y-4">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Định Dạng Font & Màu Sắc Phụ Đề Vietsub
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs text-slate-300 block mb-1.5 font-medium">Font Chữ</label>
                    <select
                      value={localSettings.subFont || 'Arial'}
                      onChange={(e) => updateField('subFont', e.target.value)}
                      className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white outline-none focus:border-indigo-500 font-mono"
                    >
                      <option value="Arial">Arial (Phổ biến, rõ nét)</option>
                      <option value="Roboto">Roboto</option>
                      <option value="Montserrat">Montserrat</option>
                      <option value="Impact">Impact (Đậm nét viral)</option>
                      <option value="Be Vietnam Pro">Be Vietnam Pro</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1.5 font-medium">Cỡ Chữ (Font Size)</label>
                    <input
                      type="number"
                      min={16}
                      max={60}
                      value={localSettings.subFontSize || 28}
                      onChange={(e) => updateField('subFontSize', parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1.5 font-medium">Màu Chữ Phụ Đề</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={localSettings.subColor || '#FFFFFF'}
                        onChange={(e) => updateField('subColor', e.target.value)}
                        className="w-8 h-8 rounded border border-white/20 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={localSettings.subColor || '#FFFFFF'}
                        onChange={(e) => updateField('subColor', e.target.value)}
                        className="flex-1 px-2.5 py-1.5 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1.5 font-medium">Màu Viền Chữ</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={localSettings.subBorderColor || '#000000'}
                        onChange={(e) => updateField('subBorderColor', e.target.value)}
                        className="w-8 h-8 rounded border border-white/20 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={localSettings.subBorderColor || '#000000'}
                        onChange={(e) => updateField('subBorderColor', e.target.value)}
                        className="flex-1 px-2.5 py-1.5 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={localSettings.burnInSub !== false}
                      onChange={(e) => updateField('burnInSub', e.target.checked)}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <span className="font-semibold text-emerald-400">Burn-in chèn cứng phụ đề vào MP4</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={localSettings.enableCharLineLimit || false}
                      onChange={(e) => updateField('enableCharLineLimit', e.target.checked)}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <span>Giới hạn ký tự mỗi dòng ({localSettings.charPerLine || 45} ký tự)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={localSettings.useSubBg || false}
                      onChange={(e) => updateField('useSubBg', e.target.checked)}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <span>Dùng nền hộp đen cho phụ đề</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: TRANG TRÍ VIDEO & TỶ LỆ KHUNG */}
          {activeTab === 'decor' && (
            <div className="max-w-5xl space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Video className="w-5 h-5 text-purple-400" />
                  <span>Trang Trí Video, Tỷ Lệ Khung Hình & Banner Thương Hiệu</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tùy chỉnh tỷ lệ 1:1, 16:9, 9:16, Banner Trên/Dưới và xem trước trực quan theo thời gian thực.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left settings */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Aspect Ratio Selector */}
                  <div className="bg-[#121424] border border-[#21263d] rounded-xl p-5 space-y-3">
                    <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                      Tỷ Lệ Khung Video Đầu Ra
                    </h4>

                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: '1:1', label: '1:1 Vuông', sub: 'Facebook / Douyin' },
                        { id: '16:9', label: '16:9 Ngang', sub: 'YouTube Chuẩn' },
                        { id: '9:16', label: '9:16 Dọc', sub: 'TikTok / Shorts / Reels' },
                      ].map((ratio) => (
                        <button
                          key={ratio.id}
                          onClick={() => updateField('primaryAspectRatio', ratio.id as AspectRatio)}
                          className={`p-3 rounded-xl border text-center transition-all ${
                            localSettings.primaryAspectRatio === ratio.id
                              ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-md shadow-indigo-600/20'
                              : 'bg-[#171a2d] border-[#293049] text-slate-400 hover:text-white'
                          }`}
                        >
                          <div className="font-bold text-sm">{ratio.label}</div>
                          <div className="text-[10px] opacity-70 mt-0.5">{ratio.sub}</div>
                        </button>
                      ))}
                    </div>

                    <div className="pt-2 flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white">
                        <input
                          type="checkbox"
                          checked={localSettings.upscaleFullHd !== false}
                          onChange={(e) => updateField('upscaleFullHd', e.target.checked)}
                          className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                        />
                        <span>Nâng cấp độ phân giải Full HD (1080p)</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white">
                        <input
                          type="checkbox"
                          checked={localSettings.exportMultipleRatios || false}
                          onChange={(e) => updateField('exportMultipleRatios', e.target.checked)}
                          className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                        />
                        <span>Xuất cả 3 tỷ lệ cùng lúc</span>
                      </label>
                    </div>
                  </div>

                  {/* Top & Bottom Banner Config */}
                  <div className="bg-[#121424] border border-[#21263d] rounded-xl p-5 space-y-4">
                    <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                      Banner Tiêu Đề Trên & Chú Thích Dưới
                    </h4>

                    <div>
                      <label className="text-xs text-slate-300 block mb-1">Tiêu Đề Banner Trên (Top Text)</label>
                      <input
                        type="text"
                        value={localSettings.topText || ''}
                        onChange={(e) => updateField('topText', e.target.value)}
                        placeholder="Ví dụ: BÍ MẬT LỊCH SỬ CỔ ĐẠI"
                        className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white font-bold outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-300 block mb-1">Chú Thích Banner Dưới (Bottom Text)</label>
                      <input
                        type="text"
                        value={localSettings.bottomText || ''}
                        onChange={(e) => updateField('bottomText', e.target.value)}
                        placeholder="Ví dụ: Xem hết video để khám phá chân tướng!"
                        className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-slate-300 block mb-1">Chiều cao Banner Trên (%)</label>
                        <input
                          type="number"
                          min={5}
                          max={25}
                          value={localSettings.bannerTopHeightPct || 12}
                          onChange={(e) => updateField('bannerTopHeightPct', parseInt(e.target.value))}
                          className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-300 block mb-1">Chiều cao Banner Dưới (%)</label>
                        <input
                          type="number"
                          min={5}
                          max={25}
                          value={localSettings.bannerBottomHeightPct || 10}
                          onChange={(e) => updateField('bannerBottomHeightPct', parseInt(e.target.value))}
                          className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: WYSIWYG Real-time Video Studio Preview */}
                <div className="lg:col-span-5 bg-[#121424] border border-[#21263d] rounded-xl p-5 flex flex-col items-center justify-between">
                  <div className="w-full flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Eye className="w-4 h-4 text-cyan-400" />
                      <span>Xem Trước Màn Hình (Preview)</span>
                    </span>
                    <span className="font-mono text-[11px] text-indigo-400 font-bold">
                      {localSettings.primaryAspectRatio || '1:1'}
                    </span>
                  </div>

                  {/* Canvas Container */}
                  <div className="w-full flex-1 flex items-center justify-center p-3 bg-[#0a0c16] rounded-xl border border-white/5 overflow-hidden min-h-[340px]">
                    <div
                      className={`relative bg-[#000000] border-2 border-indigo-500/50 shadow-2xl flex flex-col justify-between overflow-hidden transition-all duration-300 ${
                        localSettings.primaryAspectRatio === '16:9'
                          ? 'w-full aspect-video'
                          : localSettings.primaryAspectRatio === '9:16'
                          ? 'h-[320px] aspect-[9/16]'
                          : 'h-[300px] aspect-square'
                      }`}
                    >
                      {/* Top Banner */}
                      <div
                        style={{
                          height: `${localSettings.bannerTopHeightPct || 12}%`,
                          backgroundColor: localSettings.bannerTopColor || '#111111',
                        }}
                        className="w-full flex items-center justify-center px-2 text-center shrink-0 border-b border-white/10"
                      >
                        <span
                          style={{
                            color: localSettings.descColor || '#FFFFFF',
                            textShadow: `0 0 6px ${localSettings.descBorderColor || '#800040'}`,
                          }}
                          className="font-black text-xs uppercase tracking-wide truncate max-w-full"
                        >
                          {localSettings.topText || 'BÍ MẬT LỊCH SỬ CỔ ĐẠI'}
                        </span>
                      </div>

                      {/* Mock Center Video Scene */}
                      <div className="flex-1 relative flex items-center justify-center bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-black overflow-hidden">
                        <Video className="w-10 h-10 text-white/20 animate-pulse" />

                        {/* Subtitle simulation overlay */}
                        <div className="absolute bottom-3 left-2 right-2 text-center">
                          <span
                            style={{
                              color: localSettings.subColor || '#FFFFFF',
                              textShadow: `1px 1px 3px ${localSettings.subBorderColor || '#000000'}`,
                              backgroundColor: localSettings.useSubBg ? 'rgba(0,0,0,0.75)' : 'transparent',
                            }}
                            className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold"
                          >
                            Bước vào cổ trấn ngàn năm, bạn sẽ ngỡ ngàng!
                          </span>
                        </div>
                      </div>

                      {/* Bottom Banner */}
                      <div
                        style={{
                          height: `${localSettings.bannerBottomHeightPct || 10}%`,
                          backgroundColor: localSettings.bannerBottomColor || '#111111',
                        }}
                        className="w-full flex items-center justify-center px-2 text-center shrink-0 border-t border-white/10"
                      >
                        <span
                          style={{
                            color: localSettings.descColor || '#FFFFFF',
                          }}
                          className="text-[10px] font-medium truncate max-w-full"
                        >
                          {localSettings.bottomText || 'Xem hết video để khám phá chân tướng!'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full text-center text-[10px] text-slate-500 mt-2 font-mono">
                    Khung hình render thực tế bằng FFmpeg libx264
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: THƯ MỤC LƯU TRỮ & TỐI ƯU HÀNG ĐỢI */}
          {activeTab === 'storage' && (
            <div className="max-w-4xl space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-blue-400" />
                  <span>Cấu hình Thư Mục Lưu Trữ & Hiệu Năng Hàng Đợi</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Quản lý vị trí lưu trữ file video tải về, file phụ đề SRT thô, phụ đề đã dịch và video thành phẩm.
                </p>
              </div>

              <div className="bg-[#121424] border border-[#21263d] rounded-xl p-5 space-y-4">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Thư mục Video Tải Về</label>
                  <input
                    type="text"
                    value={localSettings.downloadVideoDir || 'public/media/downloads'}
                    onChange={(e) => updateField('downloadVideoDir', e.target.value)}
                    className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white font-mono outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-300 block mb-1">Thư mục Phụ Đề Gốc (Raw SRT)</label>
                    <input
                      type="text"
                      value={localSettings.rawSrtDir || 'public/media/raw_srt'}
                      onChange={(e) => updateField('rawSrtDir', e.target.value)}
                      className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white font-mono outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1">Thư mục Phụ Đề Dịch (Translated SRT)</label>
                    <input
                      type="text"
                      value={localSettings.translatedSrtDir || 'public/media/translated_srt'}
                      onChange={(e) => updateField('translatedSrtDir', e.target.value)}
                      className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white font-mono outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">Thư mục Video Thành Phẩm (Output MP4)</label>
                  <input
                    type="text"
                    value={localSettings.ttsOutputDir || 'public/media/output'}
                    onChange={(e) => updateField('ttsOutputDir', e.target.value)}
                    className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white font-mono outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="text-xs text-slate-300 block mb-1">Số Luồng Xử Lý Đồng Thời</label>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={localSettings.concurrency || 2}
                      onChange={(e) => updateField('concurrency', parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1">Số Lần Thử Lại Khi Tải Lỗi</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={localSettings.downloadRetries || 3}
                      onChange={(e) => updateField('downloadRetries', parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white">
                      <input
                        type="checkbox"
                        checked={localSettings.overwriteSrt !== false}
                        onChange={(e) => updateField('overwriteSrt', e.target.checked)}
                        className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                      />
                      <span>Ghi đè file phụ đề nếu đã tồn tại</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: TỰ ĐỘNG ĐĂNG MẠNG XÃ HỘI */}
          {activeTab === 'social' && (
            <div className="max-w-4xl space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-red-400" />
                  <span>Tự Động Đăng Video Lên YouTube & Facebook Page</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tự động tải video thành phẩm lên kênh sau khi quá trình render hoàn tất.
                </p>
              </div>

              {/* YouTube */}
              <div className="bg-[#121424] border border-[#21263d] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#21263d]">
                  <div>
                    <label className="text-sm font-bold text-white block">Tự động Đăng lên Kênh YouTube</label>
                    <p className="text-xs text-slate-400">Điều khiển qua Chrome User Profile tự động</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.autoPostYoutube || false}
                    onChange={(e) => updateField('autoPostYoutube', e.target.checked)}
                    className="w-5 h-5 rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-300 block mb-1">Mẫu Tiêu Đề Video</label>
                    <input
                      type="text"
                      value={localSettings.youtubeTitleTemplate || '{title} #shorts #history'}
                      onChange={(e) => updateField('youtubeTitleTemplate', e.target.value)}
                      className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white font-mono outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1">Đường dẫn Chrome User Data</label>
                    <input
                      type="text"
                      value={localSettings.youtubeProfilePath || 'C:\\Users\\Admin\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 1'}
                      onChange={(e) => updateField('youtubeProfilePath', e.target.value)}
                      className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white font-mono outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Facebook */}
              <div className="bg-[#121424] border border-[#21263d] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#21263d]">
                  <div>
                    <label className="text-sm font-bold text-white block">Tự động Đăng lên Fanpage Facebook</label>
                    <p className="text-xs text-slate-400">Đăng qua Facebook Graph API</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.autoPostFacebook || false}
                    onChange={(e) => updateField('autoPostFacebook', e.target.checked)}
                    className="w-5 h-5 rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-300 block mb-1">Facebook Page ID</label>
                    <input
                      type="text"
                      value={localSettings.facebookPageId || ''}
                      onChange={(e) => updateField('facebookPageId', e.target.value)}
                      placeholder="Nhập Page ID..."
                      className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white font-mono outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1">Page Access Token</label>
                    <input
                      type="password"
                      value={localSettings.facebookPageAccessToken || ''}
                      onChange={(e) => updateField('facebookPageAccessToken', e.target.value)}
                      placeholder="EAAG..."
                      className="w-full px-3 py-2 bg-[#171a2d] border border-[#293049] rounded-lg text-xs text-white font-mono outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: COOKIES NỀN TẢNG ĐỘC LẬP & VƯỢT CHỐNG BOT */}
          {activeTab === 'cookies' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Header Box */}
              <div className="bg-gradient-to-r from-amber-950/40 via-[#181a2e] to-[#121424] border border-amber-500/30 rounded-2xl p-5 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                    <Cookie className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span>Quản lý Cookies Riêng Từng Nền Tảng (Độc Lập 100%)</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                        ISOLATED COOKIES
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Mỗi nền tảng (YouTube, Douyin, TikTok, Facebook, Instagram) lưu file cookie riêng biệt. Tải Douyin sẽ không bị ghi đè hay mất cookie YouTube.
                    </p>
                  </div>
                </div>
              </div>

              {/* Platform Selector Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {[
                  { id: 'youtube' as const, label: 'YouTube', domain: 'youtube.com', color: 'border-red-500/40 text-red-400' },
                  { id: 'douyin' as const, label: 'Douyin (抖音)', domain: 'douyin.com', color: 'border-cyan-500/40 text-cyan-400' },
                  { id: 'tiktok' as const, label: 'TikTok', domain: 'tiktok.com', color: 'border-pink-500/40 text-pink-400' },
                  { id: 'facebook' as const, label: 'Facebook', domain: 'facebook.com', color: 'border-blue-500/40 text-blue-400' },
                  { id: 'instagram' as const, label: 'Instagram', domain: 'instagram.com', color: 'border-purple-500/40 text-purple-400' },
                ].map((p) => {
                  const stat = platformCookieStatus[p.id];
                  const isSelected = selectedPlatform === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPlatform(p.id);
                        setCookiesInput('');
                      }}
                      className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                        isSelected
                          ? 'bg-gradient-to-b from-[#1e233d] to-[#14172a] border-indigo-500 shadow-lg shadow-indigo-600/20'
                          : 'bg-[#121424] border-[#22273f] hover:border-[#353e63] text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                          {p.label}
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            stat.exists ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500/80'
                          }`}
                          title={stat.exists ? 'Đã có cookies' : 'Chưa có cookies'}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {stat.exists ? (
                          <span className="text-emerald-400 font-mono">
                            {stat.lineCount} cookies ({(stat.sizeBytes / 1024).toFixed(1)} KB)
                          </span>
                        ) : (
                          <span className="text-slate-500">Chưa thiết lập</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Status Indicator for Selected Platform */}
              {(() => {
                const currentStat = platformCookieStatus[selectedPlatform];
                const platNames: Record<PlatformCookieKey, string> = {
                  youtube: 'YouTube (youtube.com)',
                  douyin: 'Douyin (douyin.com)',
                  tiktok: 'TikTok (tiktok.com)',
                  facebook: 'Facebook (facebook.com)',
                  instagram: 'Instagram (instagram.com)',
                };
                return (
                  <div className="p-4 rounded-xl bg-[#121424] border border-[#21263d] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3.5 h-3.5 rounded-full ${
                          currentStat.exists ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                        }`}
                      />
                      <div>
                        <div className="text-xs font-bold text-white">
                          Cookies [{platNames[selectedPlatform]}]:{' '}
                          <span className={currentStat.exists ? 'text-emerald-400' : 'text-rose-400'}>
                            {currentStat.exists
                              ? `Đang hoạt động (${currentStat.lineCount} cookies, ${(currentStat.sizeBytes / 1024).toFixed(1)} KB)`
                              : 'Chưa cấu hình tệp riêng'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {currentStat.exists
                            ? `yt-dlp sẽ dùng cookies riêng (cookies_${selectedPlatform}.txt) cô lập, hoàn toàn không đụng tới cookies nền tảng khác.`
                            : `Khi tải link ${selectedPlatform.toUpperCase()}, nếu gặp lỗi chặn bot, hãy dán cookies của ${selectedPlatform.toUpperCase()} vào bên dưới.`}
                        </div>
                      </div>
                    </div>

                    {currentStat.exists && (
                      <button
                        onClick={() => handleDeletePlatformCookies(selectedPlatform)}
                        className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa Cookies [{selectedPlatform.toUpperCase()}]</span>
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Step-by-step Guide */}
              <div className="bg-[#121424] border border-[#21263d] rounded-xl p-5 space-y-3">
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wide flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-400" />
                  <span>Cách lấy Cookies {selectedPlatform.toUpperCase()} trong 30 giây (Rất đơn giản)</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
                  <div className="p-3 bg-[#181b2e] border border-[#252b45] rounded-lg space-y-1">
                    <strong className="text-white block font-mono text-[11px] text-indigo-400">BƯỚC 1:</strong>
                    <span>Cài tiện ích <strong>Get cookies.txt LOCALLY</strong> (hoặc Cookie-Editor) trên Chrome, Edge hoặc Firefox.</span>
                  </div>

                  <div className="p-3 bg-[#181b2e] border border-[#252b45] rounded-lg space-y-1">
                    <strong className="text-white block font-mono text-[11px] text-indigo-400">BƯỚC 2:</strong>
                    <span>
                      Mở tab <strong>
                        {selectedPlatform === 'youtube' && 'youtube.com'}
                        {selectedPlatform === 'douyin' && 'douyin.com'}
                        {selectedPlatform === 'tiktok' && 'tiktok.com'}
                        {selectedPlatform === 'facebook' && 'facebook.com'}
                        {selectedPlatform === 'instagram' && 'instagram.com'}
                      </strong> trên trình duyệt, bấm tiện ích và chọn <strong>Export</strong>.
                    </span>
                  </div>

                  <div className="p-3 bg-[#181b2e] border border-[#252b45] rounded-lg space-y-1">
                    <strong className="text-white block font-mono text-[11px] text-indigo-400">BƯỚC 3:</strong>
                    <span>Bấm nút <strong>"Chọn tệp cookies từ máy"</strong> hoặc dán nội dung rồi bấm <strong>"Lưu Cookies [{selectedPlatform.toUpperCase()}]"</strong>!</span>
                  </div>
                </div>
              </div>

              {/* Upload & Paste Form */}
              <div className="bg-[#121424] border border-[#21263d] rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Nội dung Cookies cho [{selectedPlatform.toUpperCase()}] (Hỗ trợ JSON & Netscape txt)</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <label className="px-3 py-1.5 bg-[#1f243c] hover:bg-[#2b3254] text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-all">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Chọn tệp cookies ({selectedPlatform})</span>
                      <input
                        type="file"
                        accept=".txt,.json"
                        onChange={handleCookieFileUpload}
                        className="hidden"
                      />
                    </label>

                    {cookiesInput && (
                      <button
                        onClick={() => setCookiesInput('')}
                        className="px-2.5 py-1.5 bg-[#171a2d] hover:bg-[#20243d] text-slate-400 hover:text-white rounded-lg text-xs"
                      >
                        Xóa trắng
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  rows={8}
                  value={cookiesInput}
                  onChange={(e) => setCookiesInput(e.target.value)}
                  placeholder={`Dán nội dung cookies của ${selectedPlatform.toUpperCase()} vào đây (Hỗ trợ JSON từ Cookie-Editor hoặc Netscape txt)...\nVí dụ JSON:\n[\n  { "domain": ".${selectedPlatform === 'douyin' ? 'douyin' : selectedPlatform}.com", "name": "...", "value": "..." }\n]`}
                  className="w-full p-3 bg-[#0a0c16] border border-[#242940] rounded-xl text-xs font-mono text-emerald-400 outline-none focus:border-amber-500 shadow-inner"
                />

                <div className="flex items-center justify-between pt-2">
                  <p className="text-[11px] text-emerald-400/90 flex items-center gap-1.5">
                    <span>✨</span>
                    <span>Tự động nhận diện: Hệ thống tự động chuẩn hóa sang định dạng Netscape txt chuẩn yt-dlp.</span>
                  </p>

                  <button
                    onClick={handleSavePlatformCookies}
                    disabled={isSavingCookies || !cookiesInput.trim()}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-600/20 active:scale-95 transition-all"
                  >
                    {isSavingCookies ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>Lưu Cookies [{selectedPlatform.toUpperCase()}] & Áp Dụng Ngay</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* JSON Import/Export Modal */}
      {showJsonModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#121424] border border-[#282f4d] rounded-2xl w-full max-w-2xl flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-4 bg-[#16192e] border-b border-[#222740] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Code className="w-4 h-4 text-indigo-400" />
                <span>Import / Export Danh Sách Tài Khoản AI Pool</span>
              </h3>
              <button onClick={() => setShowJsonModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-400">
                Bạn có thể sao chép cấu hình Pool hoặc dán chuỗi JSON danh sách tài khoản để nạp hàng loạt:
              </p>
              <textarea
                rows={10}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                className="w-full p-3 bg-[#0a0c16] border border-[#222842] rounded-xl text-xs font-mono text-emerald-400 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="px-5 py-3 bg-[#16192e] border-t border-[#222740] flex items-center justify-end gap-2">
              <button
                onClick={() => setShowJsonModal(false)}
                className="px-4 py-2 bg-[#1b1f35] text-slate-300 rounded-lg text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  try {
                    const parsed = JSON.parse(jsonInput);
                    if (Array.isArray(parsed)) {
                      updateField('aiAccounts', parsed);
                      onUpdateSettings({ aiAccounts: parsed });
                      onShowNotification('Đã nạp danh sách tài khoản AI từ JSON!');
                      setShowJsonModal(false);
                    } else {
                      onShowNotification('Dữ liệu JSON phải là một mảng Array []');
                    }
                  } catch (err: any) {
                    onShowNotification(`Lỗi cú pháp JSON: ${err.message}`);
                  }
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
              >
                Lưu và Áp dụng JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
