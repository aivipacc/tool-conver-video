import React from 'react';
import { X, Download, Play, CheckCircle2, Film, Clock, Sparkles } from 'lucide-react';
import { QueueItem } from '../types';

interface VideoPlayerModalProps {
  job: QueueItem | null;
  isOpen: boolean;
  onClose: () => void;
  onShowNotification: (msg: string) => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  job,
  isOpen,
  onClose,
  onShowNotification,
}) => {
  if (!isOpen || !job) return null;

  const videoSource = job.realVideoUrl || (job.exportedVideoPath ? `/media/output/${job.exportedVideoPath.split(/[\/\\]/).pop()}` : '') || job.videoPreviewUrl;

  const handleDownload = () => {
    if (!videoSource) return;
    const a = document.createElement('a');
    a.href = videoSource;
    a.download = `${job.name.replace(/\.[^/.]+$/, '')}_VIETSUB.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onShowNotification('Đang tải video thành phẩm về máy tính!');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-[#141624] border border-[#262c42] rounded-2xl flex flex-col shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#181b2c] border-b border-[#242a3e] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Film className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-2">
                <span>Trình phát video thành phẩm đã dịch tiếng Việt</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-semibold">
                  MP4 VIETSUB
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-mono truncate max-w-lg">
                {job.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {videoSource && (
              <button
                onClick={handleDownload}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải video MP4</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Player Display */}
        <div className="p-5 flex flex-col items-center justify-center bg-[#090b12]">
          {videoSource ? (
            <div className="relative w-full max-h-[60vh] flex items-center justify-center rounded-xl overflow-hidden bg-black border border-white/10 shadow-2xl">
              <video
                controls
                autoPlay
                className="max-h-[60vh] max-w-full rounded-lg"
                src={videoSource}
              >
                Trình duyệt không hỗ trợ phát thẻ video HTML5.
              </video>
            </div>
          ) : (
            <div className="w-full h-64 flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-700 rounded-xl">
              <Play className="w-10 h-10 text-slate-600 mb-2" />
              <p className="text-xs">Đang chờ hệ thống render video thành phẩm...</p>
            </div>
          )}

          {/* Video Metadata Bar */}
          <div className="w-full mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 bg-[#141726] rounded-lg border border-[#21263d]">
              <span className="text-[10px] text-slate-400 block">Tỷ lệ video:</span>
              <span className="font-mono font-bold text-cyan-400">{job.ratio || '1:1'}</span>
            </div>

            <div className="p-2.5 bg-[#141726] rounded-lg border border-[#21263d]">
              <span className="text-[10px] text-slate-400 block">Thời lượng:</span>
              <span className="font-mono font-bold text-slate-200">{job.duration || '00:03:00'}</span>
            </div>

            <div className="p-2.5 bg-[#141726] rounded-lg border border-[#21263d]">
              <span className="text-[10px] text-slate-400 block">Dung lượng file:</span>
              <span className="font-mono font-bold text-emerald-400">{job.fileSize || '3.2 MB'}</span>
            </div>

            <div className="p-2.5 bg-[#141726] rounded-lg border border-[#21263d]">
              <span className="text-[10px] text-slate-400 block">Thời gian render:</span>
              <span className="font-mono font-bold text-amber-300">
                {job.executionTimeMs ? `${job.executionTimeMs}ms` : 'Siêu tốc'}
              </span>
            </div>
          </div>
        </div>

        {/* Subtitle Snippet */}
        {job.subtitles && job.subtitles.length > 0 && (
          <div className="px-5 py-3 bg-[#111320] border-t border-[#1f2438] max-h-32 overflow-y-auto">
            <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Phụ đề tiếng Việt đã lồng vào video:</span>
            </div>
            <div className="space-y-1">
              {job.subtitles.slice(0, 4).map((sub) => (
                <div key={sub.id} className="text-[11px] text-slate-300 flex items-start gap-2">
                  <span className="text-slate-500 font-mono text-[10px] shrink-0">{sub.startTime}</span>
                  <span className="text-cyan-200">{sub.translatedText || sub.originalText}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
