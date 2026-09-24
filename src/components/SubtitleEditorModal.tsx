import React, { useState } from 'react';
import { 
  X, 
  Play, 
  Pause, 
  Download, 
  Save, 
  Plus, 
  Trash2, 
  Volume2, 
  Subtitles, 
  Sparkles, 
  FileText,
  Clock
} from 'lucide-react';
import { QueueItem, SubtitleCue, AppSettings } from '../types';
import { SubtitleUtils } from '../services/subtitles';
import { TTSService } from '../services/ttsService';

interface SubtitleEditorModalProps {
  job: QueueItem | null;
  settings: AppSettings;
  isOpen: boolean;
  onClose: () => void;
  onSaveSubtitles: (jobId: string, subtitles: SubtitleCue[]) => void;
  onShowNotification: (msg: string) => void;
}

export const SubtitleEditorModal: React.FC<SubtitleEditorModalProps> = ({
  job,
  settings,
  isOpen,
  onClose,
  onSaveSubtitles,
  onShowNotification,
}) => {
  if (!isOpen || !job) return null;

  const [cues, setCues] = useState<SubtitleCue[]>(job.subtitles || []);
  const [playingCueId, setPlayingCueId] = useState<number | null>(null);
  const [activeCueId, setActiveCueId] = useState<number | null>(
    cues.length > 0 ? cues[0].id : null
  );

  const handleCueChange = (id: number, field: 'originalText' | 'translatedText' | 'startTime' | 'endTime', value: string) => {
    setCues(prev =>
      prev.map(cue => (cue.id === id ? { ...cue, [field]: value } : cue))
    );
  };

  const handlePlayCueVoice = (cue: SubtitleCue) => {
    const textToSpeak = cue.translatedText || cue.originalText;
    if (!textToSpeak) return;

    setPlayingCueId(cue.id);
    setActiveCueId(cue.id);
    TTSService.speak(
      textToSpeak,
      settings.speedRate,
      () => setPlayingCueId(null),
      () => setPlayingCueId(null)
    );
  };

  const handleAddNewCue = () => {
    const newId = cues.length > 0 ? Math.max(...cues.map(c => c.id)) + 1 : 1;
    const newCue: SubtitleCue = {
      id: newId,
      startTime: '00:00:20,000',
      endTime: '00:00:23,500',
      startSeconds: 20.0,
      endSeconds: 23.5,
      originalText: '新增字幕文本...',
      translatedText: 'Thêm dòng phụ đề tiếng Việt mới...',
    };
    setCues(prev => [...prev, newCue]);
  };

  const handleDeleteCue = (id: number) => {
    setCues(prev => prev.filter(c => c.id !== id));
  };

  const handleSave = () => {
    onSaveSubtitles(job.id, cues);
    onShowNotification('Đã cập nhật và lưu phụ đề thành công!');
    onClose();
  };

  const handleExportSrt = () => {
    const srtContent = SubtitleUtils.generateSrt(cues, true);
    SubtitleUtils.downloadFile(srtContent, `${job.name.replace(/\.[^/.]+$/, '')}_sub_vi.srt`);
    onShowNotification('Đã tải xuống file phụ đề .SRT!');
  };

  const activeCue = cues.find(c => c.id === activeCueId) || cues[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl h-[85vh] bg-[#141624] border border-[#262c42] rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-slate-200">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#191d2f] border-b border-[#242a3e] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Subtitles className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-xs font-bold text-white tracking-wide uppercase">
                Trình biên tập phụ đề & Lồng tiếng (Subtitle & TTS Studio)
              </h2>
              <p className="text-[11px] text-slate-400 font-mono truncate max-w-md">
                {job.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportSrt}
              className="px-3 py-1.5 bg-[#202538] hover:bg-[#2a3148] text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Xuất file .SRT</span>
            </button>

            <button
              onClick={handleSave}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Lưu thay đổi</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Studio Body: Left is Subtitle List, Right is Preview Frame */}
        <div className="flex-1 flex overflow-hidden">
          {/* Subtitle Lines Table */}
          <div className="flex-1 flex flex-col border-r border-[#242a3e] overflow-hidden">
            <div className="p-3 bg-[#171a2b] border-b border-[#242a3e] flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Tổng số câu thoại: <strong className="text-indigo-300 font-mono">{cues.length}</strong>
              </span>

              <button
                onClick={handleAddNewCue}
                className="px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded text-xs flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm câu mới</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {cues.map((cue, index) => {
                const isPlaying = playingCueId === cue.id;
                const isSelected = activeCueId === cue.id;

                return (
                  <div
                    key={cue.id}
                    onClick={() => setActiveCueId(cue.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#1b1f33] border-indigo-500/60 shadow-md'
                        : 'bg-[#161929] border-[#22273d] hover:bg-[#1a1e30]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2 text-[11px] text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="font-mono px-1.5 py-0.5 bg-[#242a3e] rounded text-slate-300 font-semibold">
                          #{index + 1}
                        </span>
                        <div className="flex items-center gap-1 font-mono text-[10px]">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <input
                            type="text"
                            value={cue.startTime}
                            onChange={(e) => handleCueChange(cue.id, 'startTime', e.target.value)}
                            className="w-20 bg-[#121420] border border-[#2b3149] rounded px-1 text-center text-slate-300"
                          />
                          <span>&rarr;</span>
                          <input
                            type="text"
                            value={cue.endTime}
                            onChange={(e) => handleCueChange(cue.id, 'endTime', e.target.value)}
                            className="w-20 bg-[#121420] border border-[#2b3149] rounded px-1 text-center text-slate-300"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayCueVoice(cue);
                          }}
                          title="Nghe thử giọng thuyết minh câu này"
                          className={`p-1.5 rounded transition-colors ${
                            isPlaying
                              ? 'bg-amber-500 text-white animate-pulse'
                              : 'bg-[#242a3e] text-slate-300 hover:text-white hover:bg-indigo-600'
                          }`}
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCue(cue.id);
                          }}
                          title="Xóa câu này"
                          className="p-1.5 bg-[#242a3e] text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Original Subtitle Text */}
                    <div className="mb-2">
                      <label className="text-[10px] text-slate-500 block mb-0.5 uppercase tracking-wider">
                        Phụ đề gốc (Speech-to-Text / OCR):
                      </label>
                      <input
                        type="text"
                        value={cue.originalText}
                        onChange={(e) => handleCueChange(cue.id, 'originalText', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#10121d] border border-[#22273d] rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>

                    {/* Translated Subtitle Text */}
                    <div>
                      <label className="text-[10px] text-cyan-400/90 font-medium block mb-0.5 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>Bản dịch AI & Lồng tiếng (Tiếng Việt):</span>
                      </label>
                      <textarea
                        rows={2}
                        value={cue.translatedText}
                        onChange={(e) => handleCueChange(cue.id, 'translatedText', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#121522] border border-indigo-500/40 rounded-lg text-xs text-white font-medium focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Live Preview of Selected Cue */}
          <div className="w-[420px] bg-[#0f111c] p-5 flex flex-col justify-between overflow-y-auto">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 text-indigo-400" />
                <span>Xem thử hiển thị trên video</span>
              </h3>

              {/* Simulated 1:1 Video Box */}
              <div className="relative aspect-square w-full bg-[#161826] rounded-xl border border-[#262c42] overflow-hidden flex flex-col justify-between shadow-lg">
                {/* Top Banner */}
                <div className="h-10 bg-[#111111] flex items-center justify-center px-2 text-center border-b border-purple-500/30">
                  <span className="text-[11px] font-bold text-white tracking-wider truncate">
                    {job.topBannerText || 'BÍ MẬT LỊCH SỬ CỔ ĐẠI'}
                  </span>
                </div>

                {/* Body Canvas */}
                <div className="flex-1 flex items-center justify-center p-4 relative bg-gradient-to-b from-[#1b1f33] to-[#111320]">
                  <div className="text-center">
                    <Volume2 className="w-8 h-8 mx-auto text-indigo-400/60 mb-2" />
                    <div className="text-[11px] font-mono text-slate-400">
                      Timeline: {activeCue ? `${activeCue.startTime} - ${activeCue.endTime}` : '00:00:00'}
                    </div>
                  </div>

                  {/* Active Subtitle Burned In */}
                  {activeCue && (
                    <div className="absolute bottom-3 left-4 right-4 text-center">
                      <div className="inline-block px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-xs font-bold text-white border border-white/10 shadow-lg">
                        {activeCue.translatedText || activeCue.originalText}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Banner */}
                <div className="h-9 bg-[#111111] flex items-center justify-center px-2 text-center border-t border-purple-500/30">
                  <span className="text-[10px] font-semibold text-slate-300 tracking-wide truncate">
                    {job.bottomBannerText || 'Xem hết video để khám phá chân tướng!'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-4 p-3 bg-[#161929] rounded-xl border border-[#242a3e] space-y-2">
              <div className="text-[11px] font-semibold text-slate-300">
                Tối ưu hóa thuyết minh TTS:
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Mô hình Nghim Piper ONNX sẽ đọc trực tiếp phần dịch tiếng Việt. Bấm vào biểu tượng loa để nghe thử phát âm từng câu thoại trước khi render video thành phẩm.
              </p>
              <button
                onClick={() => {
                  if (activeCue) handlePlayCueVoice(activeCue);
                }}
                className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Nghe thử câu đang chọn</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
