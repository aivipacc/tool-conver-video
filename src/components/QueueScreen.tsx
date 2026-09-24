import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Link as LinkIcon, 
  FileVideo, 
  Subtitles, 
  Volume2, 
  Eye, 
  Download,
  AlertCircle,
  Clock,
  Terminal,
  Eraser,
  Play,
  Film,
  Zap,
  Sliders,
  Check,
  Cookie,
  Sparkles,
  AlertTriangle,
  Upload
} from 'lucide-react';
import { QueueItem, AppSettings, SystemLog, JobStatus, PlatformCookieKey } from '../types';

interface QueueScreenProps {
  queue: QueueItem[];
  settings: AppSettings;
  logs: SystemLog[];
  isProcessing: boolean;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  onAddFiles: (files: FileList | File[]) => void;
  onAddLinks: (links: string[]) => void;
  onClearCompleted: () => void;
  onClearAll: () => void;
  onDeleteJob: (id: string) => void;
  onOpenSubtitleEditor: (job: QueueItem) => void;
  onWatchVideo: (job: QueueItem) => void;
  onClearLogs: () => void;
  onToggleSettings?: () => void;
  isSettingsOpen?: boolean;
  onUseSampleVideo?: (jobId: string) => void;
  onOpenCookiesSettings?: (platform?: PlatformCookieKey) => void;
}

export const QueueScreen: React.FC<QueueScreenProps> = ({
  queue,
  settings,
  logs,
  isProcessing,
  onAddFiles,
  onAddLinks,
  onClearCompleted,
  onClearAll,
  onDeleteJob,
  onOpenSubtitleEditor,
  onWatchVideo,
  onClearLogs,
  onToggleSettings,
  isSettingsOpen = false,
  onUseSampleVideo,
  onOpenCookiesSettings,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleDownloadVideo = () => {
    if (!urlInput.trim()) return;
    const links = urlInput
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (links.length > 0) {
      onAddLinks(links);
      setUrlInput('');
    }
  };

  const getStatusBadge = (status: JobStatus, item: QueueItem) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Hoàn tất MP4</span>
          </span>
        );
      case 'downloading':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-medium text-[11px] animate-pulse">
            <LinkIcon className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            <span>Tải video yt-dlp...</span>
          </span>
        );
      case 'extracting_audio':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 font-medium text-[11px] animate-pulse">
            <Volume2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Tách WAV...</span>
          </span>
        );
      case 'transcribing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-medium text-[11px] animate-pulse">
            <Subtitles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Nhận diện STT...</span>
          </span>
        );
      case 'translating':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-medium text-[11px] animate-pulse">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Dịch AI xoay vòng...</span>
          </span>
        );
      case 'generating_tts':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-medium text-[11px] animate-pulse">
            <Volume2 className="w-3.5 h-3.5 text-purple-400" />
            <span>Lồng tiếng TTS...</span>
          </span>
        );
      case 'muxing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300 font-medium text-[11px] animate-pulse">
            <Film className="w-3.5 h-3.5 text-pink-400" />
            <span>FFmpeg Render MP4...</span>
          </span>
        );
      case 'failed':
        if (item.isBotChallenge) {
          return (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold text-[11px]">
              <Cookie className="w-3.5 h-3.5 text-amber-400" />
              <span>Cần Cookies chống bot</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-semibold text-[11px]">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>Thất bại: {item.errorDetail || 'Lỗi xử lý'}</span>
          </span>
        );
      case 'idle':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-700/30 border border-slate-700/50 text-slate-400 text-[11px]">
            <Clock className="w-3.5 h-3.5" />
            <span>Chờ tự động chạy...</span>
          </span>
        );
    }
  };

  const completedCount = queue.filter((q) => q.status === 'completed').length;
  const runningCount = queue.filter((q) => q.status !== 'completed' && q.status !== 'idle' && q.status !== 'failed').length;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0c14] text-slate-200 overflow-hidden select-none">
      {/* Top Application Bar: [ Ô điền link ] [ Tải video ] [ Thêm video ] [ Cài đặt cấu hình ] */}
      <div className="px-4 py-2.5 bg-[#111320] border-b border-[#1f2438] flex items-center justify-between gap-3 shrink-0">
        {/* Left: Input link + Nút Tải video (Bên cạnh nhau) */}
        <div className="flex-1 flex items-center gap-2 max-w-3xl">
          <div className="relative flex-1">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleDownloadVideo();
              }}
              placeholder="Dán link video (Douyin, TikTok, YouTube, Facebook, Kuaishou, Web...)"
              className="w-full px-3.5 py-2 pl-9 bg-[#171a2d] border border-[#2b3149] focus:border-cyan-500 rounded-lg text-xs text-white placeholder-slate-400 outline-none transition-all shadow-inner"
            />
            <LinkIcon className="w-4 h-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2" />
            {urlInput && (
              <button
                onClick={() => setUrlInput('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Nút Tải video */}
          <button
            onClick={handleDownloadVideo}
            disabled={!urlInput.trim()}
            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-cyan-600/20 active:scale-95 transition-all shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Tải video</span>
          </button>
        </div>

        {/* Right: Nút Thêm video + Nút Cài đặt cấu hình */}
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onAddFiles(e.target.files);
                e.target.value = '';
              }
            }}
            multiple
            accept="video/*,audio/*"
            className="hidden"
          />

          {/* Nút Thêm video */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-[#1b1f32] hover:bg-[#252b44] text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm video</span>
          </button>

          {/* Nút Cài đặt cấu hình */}
          {onToggleSettings && (
            <button
              onClick={onToggleSettings}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                isSettingsOpen
                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                  : 'bg-[#181b2c] hover:bg-[#242940] text-slate-200 border-[#2b3149]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>Cài đặt cấu hình</span>
            </button>
          )}

          {queue.length > 0 && (
            <button
              onClick={onClearAll}
              className="p-2 bg-[#171a2d] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg border border-[#262b42] transition-colors ml-1"
              title="Xóa tất cả hàng đợi"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Execution Workspace: Queue Table */}
      <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-3">
        {/* Queue Table Card */}
        <div className="flex-1 bg-[#121422] border border-[#20253b] rounded-xl flex flex-col overflow-hidden shadow-xl">
          {/* Table Header */}
          <div className="grid grid-cols-12 px-4 py-2.5 bg-[#16192a] border-b border-[#21263d] text-[11px] font-bold text-slate-300 uppercase tracking-wider">
            <div className="col-span-1 text-center">STT</div>
            <div className="col-span-4">Tên Video & Nguồn</div>
            <div className="col-span-1 text-center">Tỷ lệ</div>
            <div className="col-span-1 text-center">Thời lượng</div>
            <div className="col-span-2">Tiến độ thực tế</div>
            <div className="col-span-2 text-center">Trạng thái</div>
            <div className="col-span-1 text-center">Thao tác</div>
          </div>

          {/* Table Body */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#1e2338]">
            {queue.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500">
                <FileVideo className="w-12 h-12 text-slate-600 mb-3" />
                <h3 className="text-sm font-bold text-slate-300 mb-1">
                  Chưa có video nào trong hàng đợi
                </h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  Kéo thả file video vào đây hoặc bấm &quot;Thêm Video&quot; / &quot;Dán Link Video&quot;. Hệ thống sẽ tự động kích hoạt tiến trình xử lý ngay lập tức!
                </p>
              </div>
            ) : (
              queue.map((item, index) => (
                <div
                  key={item.id}
                  className="grid grid-cols-12 px-4 py-3 items-center text-xs hover:bg-[#151829] transition-colors"
                >
                  {/* STT */}
                  <div className="col-span-1 text-center font-mono text-[11px] text-slate-400">
                    #{index + 1}
                  </div>

                  {/* Name & Source */}
                  <div className="col-span-4 pr-3">
                    <div className="font-semibold text-slate-100 truncate flex items-center gap-1.5" title={item.name}>
                      <Film className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-cyan-400">{item.currentStepMessage}</span>
                      {item.executionTimeMs && (
                        <span className="text-slate-500 font-mono">({item.executionTimeMs}ms)</span>
                      )}
                    </div>
                  </div>

                  {/* Aspect Ratio */}
                  <div className="col-span-1 text-center font-mono font-bold text-indigo-300 text-[11px]">
                    {item.ratio || settings.primaryAspectRatio || '1:1'}
                  </div>

                  {/* Duration */}
                  <div className="col-span-1 text-center font-mono text-slate-300 text-[11px]">
                    {item.duration || '00:03:00'}
                  </div>

                  {/* Live Progress Bar */}
                  <div className="col-span-2 pr-3">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                      <span>{item.progress}%</span>
                      {item.fileSize && <span className="text-emerald-400">{item.fileSize}</span>}
                    </div>
                    <div className="w-full bg-[#1b1f32] h-2 rounded-full overflow-hidden border border-white/5">
                      <div
                        className={`h-full transition-all duration-300 ${
                          item.status === 'completed'
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                            : item.status === 'failed'
                            ? 'bg-rose-500'
                            : 'bg-gradient-to-r from-amber-500 to-indigo-500'
                        }`}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="col-span-2 text-center">
                    {getStatusBadge(item.status, item)}
                  </div>

                  {/* Actions Column: XEM VIDEO, SUBTITLES, DELETE */}
                  <div className="col-span-1 flex items-center justify-center gap-1">
                    {/* XEM VIDEO BUTTON (PROMINENT) */}
                    <button
                      onClick={() => onWatchVideo(item)}
                      title="Xem video thành phẩm (MP4 Vietsub)"
                      className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all active:scale-95 shadow-sm"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>

                    {/* Subtitle Editor */}
                    <button
                      onClick={() => onOpenSubtitleEditor(item)}
                      title="Chỉnh sửa phụ đề & lồng tiếng"
                      className="p-1.5 bg-[#1d2136] hover:bg-[#282d49] text-cyan-300 rounded-lg transition-colors"
                    >
                      <Subtitles className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => onDeleteJob(item.id)}
                      title="Xóa video khỏi danh sách"
                      className="p-1.5 bg-[#1d2136] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* YouTube Bot Block Resolution Card */}
                  {item.isBotChallenge && (
                    <div className="col-span-12 mt-2.5 p-3 bg-amber-950/40 border border-amber-500/35 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-inner">
                      <div className="flex items-center gap-2.5 text-amber-200">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <div>
                          <span className="font-bold text-amber-300">
                            {item.url?.includes('douyin') ? 'Douyin (TikTok Trung Quốc)' : (item.url?.includes('youtube') || item.url?.includes('youtu.be') ? 'YouTube' : 'Nền tảng')} chặn IP máy chủ (Yêu cầu Cookies chống bot).
                          </span>
                          <span className="text-[11px] text-slate-300 ml-1.5 block sm:inline">
                            Bạn có thể chọn một trong các giải pháp bên cạnh để tiếp tục:
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {onUseSampleVideo && (
                          <button
                            onClick={() => onUseSampleVideo(item.id)}
                            className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>⚡ Dùng Video Mẫu Test Ngay</span>
                          </button>
                        )}

                        {onOpenCookiesSettings && (
                          <button
                            onClick={() => {
                              const plat: PlatformCookieKey = item.url?.includes('douyin')
                                ? 'douyin'
                                : (item.url?.includes('tiktok') ? 'tiktok' : 'youtube');
                              onOpenCookiesSettings(plat);
                            }}
                            className="px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-all"
                          >
                            <Cookie className="w-3.5 h-3.5 text-amber-300" />
                            <span>Cung cấp Cookies {item.url?.includes('douyin') ? 'Douyin' : (item.url?.includes('tiktok') ? 'TikTok' : 'YouTube')}</span>
                          </button>
                        )}

                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 bg-[#1b1f33] hover:bg-[#252b45] text-indigo-300 border border-indigo-500/40 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-all"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Tải video từ máy</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* System Terminal Log (Real-time bottom console) */}
        <div className="h-44 bg-[#080910] border border-[#1b1f33] rounded-xl flex flex-col overflow-hidden shadow-2xl shrink-0">
          <div className="px-3.5 py-1.5 bg-[#0e101a] border-b border-[#1b1f33] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-mono font-bold text-slate-300 uppercase">
                Nhật ký thực thi hệ thống thời gian thực (Real Engine Terminal)
              </span>
            </div>

            <button
              onClick={onClearLogs}
              className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 font-mono transition-colors"
            >
              <Eraser className="w-3 h-3" />
              <span>Xóa log</span>
            </button>
          </div>

          <div
            ref={logContainerRef}
            className="flex-1 p-2.5 overflow-y-auto font-mono text-[11px] space-y-1 bg-[#06080e]"
          >
            {logs.map((log) => {
              let color = 'text-slate-300';
              if (log.level === 'SUCCESS') color = 'text-emerald-400 font-semibold';
              else if (log.level === 'ERROR') color = 'text-rose-400 font-semibold';
              else if (log.level === 'WARN') color = 'text-amber-300';
              else if (log.level === 'FFMPEG') color = 'text-cyan-400';
              else if (log.level === 'WHISPER') color = 'text-purple-300';
              else if (log.level === 'DEEPSEEK') color = 'text-indigo-300';
              else if (log.level === 'TTS') color = 'text-pink-300';

              return (
                <div key={log.id} className="leading-tight flex items-start gap-2">
                  <span className="text-slate-500 shrink-0 select-none">[{log.timestamp}]</span>
                  <span className="font-bold shrink-0 select-none text-[10px] px-1 rounded bg-white/5">
                    [{log.level}]
                  </span>
                  <span className={color}>{log.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
