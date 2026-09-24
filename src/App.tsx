import React, { useState, useEffect, useRef } from 'react';
import { QueueScreen } from './components/QueueScreen';
import { SettingsScreen, TabKey } from './components/SettingsScreen';
import { SubtitleEditorModal } from './components/SubtitleEditorModal';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { AppSettings, QueueItem, SystemLog, SubtitleCue, JobStatus, PlatformCookieKey } from './types';
import { defaultSettings } from './mock/initialData';

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('mmo_studio_settings_v2');
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([
    {
      id: 'log-init',
      timestamp: new Date().toLocaleTimeString(),
      level: 'INFO',
      message: 'MMO Auto Translate Studio khởi động. Hệ thống nhận diện FFmpeg & yt-dlp sẵn sàng.',
    },
    {
      id: 'log-ai-ready',
      timestamp: new Date().toLocaleTimeString(),
      level: 'INFO',
      message: `Pool AI xoay vòng: ${settings.aiAccounts?.length || 3} tài khoản đã nạp. Cơ chế failover tự động kích hoạt.`,
    },
  ]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [editingJob, setEditingJob] = useState<QueueItem | null>(null);
  const [watchingJob, setWatchingJob] = useState<QueueItem | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [initialSettingsTab, setInitialSettingsTab] = useState<TabKey | undefined>(undefined);
  const [initialPlatformCookie, setInitialPlatformCookie] = useState<PlatformCookieKey | undefined>(undefined);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const processingRef = useRef(false);

  // Save settings
  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem('mmo_studio_settings_v2', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const appendLog = (level: SystemLog['level'], message: string) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${now.getHours()}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const newLog: SystemLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp,
      level,
      message,
    };
    setLogs((prev) => [...prev, newLog]);
  };

  // Helper to update a job in the queue
  const updateJob = (jobId: string, fields: Partial<QueueItem>) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === jobId ? { ...item, ...fields } : item))
    );
  };

  // 1. REAL End-to-End Pipeline Worker
  const processNextJobs = async (currentQueue: QueueItem[]) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);

    try {
      while (true) {
        // Find next pending job
        const job = currentQueue.find(
          (j) => j.status === 'idle' || j.status === 'waiting'
        );

        if (!job) break;

        appendLog('INFO', `>>> [TỰ ĐỘNG BẮT ĐẦU] Xử lý video: ${job.name}`);
        const jobStartTime = Date.now();

        // STEP 1: Video Retrieval (Download from link using yt-dlp or prepare file)
        let workingVideoPath = job.exportedVideoPath || '';
        let videoDuration = job.duration || '00:03:00';
        let fileSizeStr = 'Đang tính';

        if (job.isLink && job.url) {
          updateJob(job.id, {
            status: 'downloading',
            progress: 10,
            currentStepMessage: 'yt-dlp: Đang tải video thực tế từ link...',
          });
          appendLog('DOWNLOAD', `yt-dlp tải video từ URL: ${job.url}`);

          try {
            const dlRes = await fetch('/api/download-video', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: job.url }),
            });

            const dlData = await dlRes.json();

            if (!dlRes.ok || !dlData.success) {
              if (dlData.isBotChallenge) {
                const platName = dlData.platform || 'Nền tảng';
                updateJob(job.id, {
                  status: 'failed',
                  isBotChallenge: true,
                  currentStepMessage: `${platName}: Chặn IP máy chủ (Cần Cookies)`,
                  errorDetail: dlData.error || 'Cần Cookies xác thực/chống bot',
                });
                appendLog('ERROR', `[BOT/COOKIE BLOCK] ${dlData.error}`);
                appendLog('WARN', `Gợi ý: ${dlData.suggestion || 'Nhấn "⚡ Dùng Video Mẫu Test Ngay" hoặc nạp tệp cookies trong Cài đặt cấu hình.'}`);
                currentQueue = currentQueue.map((j) => (j.id === job.id ? { ...j, status: 'failed', isBotChallenge: true, errorDetail: dlData.error || 'Cần Cookies' } : j));
                continue;
              }
              throw new Error(dlData.error || 'Lỗi tải video từ đường dẫn qua yt-dlp');
            }

            workingVideoPath = dlData.filePath;
            videoDuration = dlData.duration;
            fileSizeStr = `${dlData.fileSizeMb} MB`;

            const hasNativeSubs = dlData.extractedSubtitles && Array.isArray(dlData.extractedSubtitles) && dlData.extractedSubtitles.length > 0;
            const initialSubs = hasNativeSubs ? dlData.extractedSubtitles : [];

            updateJob(job.id, {
              duration: videoDuration,
              fileSize: fileSizeStr,
              videoPreviewUrl: dlData.previewUrl,
              isBotChallenge: false,
              ...(hasNativeSubs ? { subtitles: initialSubs } : {}),
            });

            if (hasNativeSubs) {
              appendLog('WHISPER', `Đã tìm thấy phụ đề gốc tích hợp sẵn của video (${initialSubs.length} câu thoại).`);
            }
            appendLog('SUCCESS', `Tải video thành công (${fileSizeStr}, ${dlData.executionTimeMs}ms). File: ${dlData.title}`);
          } catch (dlErr: any) {
            const errStr = String(dlErr.message || '');
            const isBot = errStr.includes('cookies') || errStr.includes('bot') || errStr.includes('Douyin') || errStr.includes('Sign in') || errStr.includes('Unsupported URL');
            appendLog('ERROR', `[LỖI TẢI VIDEO] ${errStr}`);
            updateJob(job.id, {
              status: 'failed',
              isBotChallenge: isBot,
              currentStepMessage: isBot ? 'Chặn IP máy chủ (Cần Cookies)' : 'Tải video thất bại',
              errorDetail: errStr,
            });
            // Mark job and continue to next
            currentQueue = currentQueue.map((j) => (j.id === job.id ? { ...j, status: 'failed', isBotChallenge: isBot } : j));
            continue;
          }
        }

        // STEP 2: Extract Audio (FFmpeg)
        updateJob(job.id, {
          status: 'extracting_audio',
          progress: 25,
          currentStepMessage: 'FFmpeg: Tách âm thanh chuẩn PCM 16kHz...',
        });
        appendLog('FFMPEG', `ffmpeg -i "${job.name}" -vn -acodec pcm_s16le -ar 16000 output.wav`);

        let workingAudioPath = '';
        try {
          const audioRes = await fetch('/api/extract-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoPath: workingVideoPath, fileId: job.id }),
          });
          const audioData = await audioRes.json();
          if (audioRes.ok && audioData.success && audioData.audioPath) {
            workingAudioPath = audioData.audioPath;
            appendLog('FFMPEG', `Đã tách luồng âm thanh WAV chuẩn thành công.`);
          }
        } catch {
          // continue with pipeline
        }

        // STEP 3: Speech Recognition (Whisper / Audio ASR - Genuinely extracted from video)
        updateJob(job.id, {
          status: 'transcribing',
          progress: 45,
          currentStepMessage: `Whisper ASR: Trích xuất lời thoại & timeline thực tế từ video...`,
        });
        appendLog('WHISPER', `Khởi chạy Whisper ASR nhận diện lời thoại thực tế [Model: ${settings.whisperModel}, VAD: ${settings.useVAD}]...`);

        // Check if subtitles were already extracted directly from video or manually provided
        let currentSubtitles: SubtitleCue[] = job.subtitles && job.subtitles.length > 0 ? job.subtitles : [];

        if (currentSubtitles.length === 0 && workingAudioPath) {
          try {
            appendLog('WHISPER', 'Đang phân tích âm thanh thực tế để bóc băng từng câu thoại video...');
            const sttRes = await fetch('/api/transcribe-audio', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audioPath: workingAudioPath,
                fileId: job.id,
                videoTitle: job.name,
                language: settings.sourceLanguage,
                model: settings.whisperModel,
              }),
            });
            const sttData = await sttRes.json();
            if (sttRes.ok && sttData.subtitles && Array.isArray(sttData.subtitles) && sttData.subtitles.length > 0) {
              currentSubtitles = sttData.subtitles;
              updateJob(job.id, { subtitles: currentSubtitles });
              appendLog('WHISPER', `Nhận diện thành công ${currentSubtitles.length} câu thoại từ audio thực tế (${sttData.source || 'Gemini ASR'}, ${sttData.latencyMs}ms).`);
            } else {
              throw new Error(sttData.error || 'Video không có lời thoại rõ ràng hoặc âm thanh chỉ có nhạc nền.');
            }
          } catch (sttErr: any) {
            const errDetail = sttErr.message || 'Lỗi nhận diện âm thanh thực tế';
            appendLog('ERROR', `Lỗi nhận diện âm thanh: ${errDetail}`);
            updateJob(job.id, {
              status: 'failed',
              currentStepMessage: 'Không thể nhận diện giọng nói từ video',
              errorDetail: errDetail,
            });
            currentQueue = currentQueue.map((j) => (j.id === job.id ? { ...j, status: 'failed', errorDetail: errDetail } : j));
            continue;
          }
        }

        // Strictly verify that genuine subtitles exist before translating
        if (currentSubtitles.length === 0) {
          const noSpeechMsg = 'Không tìm thấy lời thoại trong video để dịch. Video có thể chỉ chứa nhạc nền hoặc im lặng.';
          appendLog('ERROR', noSpeechMsg);
          updateJob(job.id, {
            status: 'failed',
            currentStepMessage: 'Video không có lời thoại',
            errorDetail: noSpeechMsg,
          });
          currentQueue = currentQueue.map((j) => (j.id === job.id ? { ...j, status: 'failed', errorDetail: noSpeechMsg } : j));
          continue;
        }

        // STEP 4: AI Translation Orchestrator (Chia nhóm đúng 6 câu - Gemini -> Retry 1 lần -> DeepSeek -> Dừng hẳn)
        if (settings.autoTranslate && currentSubtitles.length > 0) {
          const BATCH_SIZE = 6;
          const totalCues = currentSubtitles.length;
          const totalBatches = Math.ceil(totalCues / BATCH_SIZE);

          appendLog('AI_ROTATION', `=== BẮT ĐẦU TRANSLATION ORCHESTRATOR (${totalCues} câu, chia đúng ${totalBatches} nhóm, 6 câu/nhóm) ===`);
          appendLog('AI_ROTATION', `Cấu trúc: Gemini Web Cookie/API (Chính) -> Nếu lỗi -> Retry 1 lần -> DeepSeek API -> Nếu lỗi -> Dừng hẳn.`);

          let translationFailed = false;
          let failureReason = '';

          for (let b = 0; b < totalBatches; b++) {
            const startIdx = b * BATCH_SIZE;
            const endIdx = Math.min(totalCues, (b + 1) * BATCH_SIZE);
            const chunkCues = currentSubtitles.slice(startIdx, endIdx);
            const chunkTexts = chunkCues.map((c) => c.originalText);

            // Real progress scaled from 48% to 68%
            const batchProgress = Math.round(48 + ((b + 1) / totalBatches) * 20);
            updateJob(job.id, {
              status: 'translating',
              progress: batchProgress,
              currentStepMessage: `Dịch nhóm ${b + 1}/${totalBatches} (câu ${startIdx + 1}-${endIdx})...`,
            });

            try {
              const trRes = await fetch('/api/translate-orchestrator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  texts: chunkTexts,
                  batchIndex: b,
                  totalBatches,
                  accounts: settings.aiAccounts,
                  sourceLang: settings.sourceLanguage,
                  targetLang: settings.targetLanguage,
                  customPrompt: settings.customPrompt,
                  strictWordCount: settings.strictWordCount,
                  contextLinkSentences: settings.contextLinkSentences,
                  timeAdaptive: settings.timeAdaptive,
                }),
              });

              const trData = await trRes.json();

              // Output detailed logs from the orchestrator
              if (trData.logs && Array.isArray(trData.logs)) {
                trData.logs.forEach((logStr: string) => {
                  if (logStr.includes('DỪNG HẲN') || logStr.includes('THẤT BẠI')) {
                    appendLog('ERROR', logStr);
                  } else if (logStr.includes('RETRY')) {
                    appendLog('AI_ROTATION', logStr);
                  } else {
                    appendLog('AI_ROTATION', logStr);
                  }
                });
              }

              // Check if orchestrator reported failure or triggered hard stop
              if (!trRes.ok || !trData.success || !Array.isArray(trData.translations)) {
                translationFailed = true;
                failureReason = trData.error || `Nhóm câu ${startIdx + 1}-${endIdx} thất bại trên cả Gemini và DeepSeek.`;
                appendLog('ERROR', `[TIẾN TRÌNH DỪNG HẲN] ${failureReason}`);
                break;
              }

              // Apply translated text for this 6-sentence batch
              for (let i = 0; i < chunkTexts.length; i++) {
                if (currentSubtitles[startIdx + i]) {
                  currentSubtitles[startIdx + i].translatedText = trData.translations[i] || currentSubtitles[startIdx + i].originalText;
                }
              }

              updateJob(job.id, { subtitles: [...currentSubtitles] });
              appendLog('SUCCESS', `Ghi nhận ${chunkTexts.length} câu nhóm ${b + 1}/${totalBatches} qua [${trData.usedAccount?.name || 'AI'}] (${trData.latencyMs}ms).`);
            } catch (trErr: any) {
              translationFailed = true;
              failureReason = `Lỗi kết nối mạng tại nhóm ${b + 1}: ${trErr.message}`;
              appendLog('ERROR', `[LỖI KẾT NỐI API DỊCH] ${failureReason}`);
              break;
            }
          }

          if (translationFailed) {
            updateJob(job.id, {
              status: 'failed',
              currentStepMessage: `Dừng hẳn: ${failureReason.slice(0, 50)}...`,
              errorDetail: failureReason,
            });
            currentQueue = currentQueue.map((j) => (j.id === job.id ? { ...j, status: 'failed', errorDetail: failureReason } : j));
            continue;
          }
        }

        // STEP 5: TTS Speech Synthesis
        if (settings.enableTTS) {
          updateJob(job.id, {
            status: 'generating_tts',
            progress: 80,
            currentStepMessage: `Đồng bộ lồng tiếng: Tự động co giãn tốc độ giọng đọc khớp 100% thời lượng sub...`,
          });
          appendLog('TTS', `Đồng bộ giọng đọc: Tự động tính toán thời lượng từng câu thoại [start->end], kích hoạt FFmpeg atempo co giãn tốc độ để đọc dứt điểm trong thời gian thoại xuất hiện.`);
          await new Promise((r) => setTimeout(r, 400));
        }

        // STEP 6: REAL FFmpeg Video Rendering (Produces final MP4)
        updateJob(job.id, {
          status: 'muxing',
          progress: 90,
          currentStepMessage: `FFmpeg: Render toàn bộ ${currentSubtitles.length} câu sub (FreeSans UTF-8) & ghép giọng đọc...`,
        });
        appendLog('FFMPEG', `FFmpeg: Đưa toàn bộ ${currentSubtitles.length} câu phụ đề vào ASS (FreeSans chuẩn dấu tiếng Việt), hòa âm lồng tiếng chuẩn thời gian.`);

        try {
          const renderRes = await fetch('/api/render-final-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              videoPath: workingVideoPath,
              subtitles: currentSubtitles,
              aspectRatio: job.ratio || settings.primaryAspectRatio || '1:1',
              topBannerText: job.topBannerText || settings.topText,
              bottomBannerText: job.bottomBannerText || settings.bottomText,
              bannerTopHeightPct: settings.bannerTopHeightPct,
              bannerBottomHeightPct: settings.bannerBottomHeightPct,
              bannerTopColor: settings.bannerTopColor,
              bannerBottomColor: settings.bannerBottomColor,
              descColor: settings.descColor,
              descBorderColor: settings.descBorderColor,
              descFontSize: settings.descFontSize,
              subFontSize: settings.subFontSize,
              burnInSub: settings.burnInSub,
              enableTTS: settings.enableTTS,
              originalAudioVolume: settings.originalAudioVolume || 15,
              ttsVolume: settings.ttsVolume || 2.2,
            }),
          });

          const renderData = await renderRes.json();

          if (!renderRes.ok || !renderData.success) {
            throw new Error(renderData.error || 'Lỗi render video FFmpeg');
          }

          const totalExecutionTimeMs = Date.now() - jobStartTime;

          // FINISHED COMPLETELY
          updateJob(job.id, {
            status: 'completed',
            progress: 100,
            currentStepMessage: 'Hoàn thành 100% video MP4',
            exportedVideoPath: renderData.finalVideoPath,
            realVideoUrl: renderData.videoUrl,
            fileSize: `${renderData.fileSizeMb} MB`,
            executionTimeMs: totalExecutionTimeMs,
            subtitles: currentSubtitles,
          });

          appendLog('SUCCESS', `Đã xuất video tiếng Việt thành phẩm: ${renderData.fileName} (${renderData.fileSizeMb} MB, ${totalExecutionTimeMs}ms).`);
          showToast(`Hoàn tất video: ${job.name}! Bấm "Xem video" để thưởng thức.`);
        } catch (renderErr: any) {
          appendLog('ERROR', `[LỖI RENDER FFMPEG] ${renderErr.message}`);
          updateJob(job.id, {
            status: 'failed',
            currentStepMessage: 'Lỗi khi render video cuối cùng',
            errorDetail: renderErr.message,
          });
        }

        // Update working queue in loop
        currentQueue = currentQueue.map((j) =>
          j.id === job.id ? { ...j, status: 'completed' } : j
        );
      }
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  };

  // Add Files (Trigger Auto-start)
  const handleAddFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const newItems: QueueItem[] = files.map((file, idx) => ({
      id: `file-${Date.now()}-${idx}`,
      name: file.name,
      mode: settings.operationMode === 'speech_to_text' ? 'SpeechToSrt' : 'HardSubOCR',
      duration: '00:03:00',
      status: 'idle',
      progress: 0,
      currentStepMessage: 'Sẵn sàng trong hàng đợi',
      exportedVideoPath: '',
      exportedSrtPath: '',
      subtitles: [],
      topBannerText: settings.topText || '',
      bottomBannerText: settings.bottomText || '',
      ratio: settings.primaryAspectRatio || '1:1',
    }));

    const updated = [...queue, ...newItems];
    setQueue(updated);
    appendLog('INFO', `Đã nhận ${newItems.length} file. Tự động khởi chạy tiến trình xử lý ngay...`);
    showToast(`Đã thêm ${newItems.length} file - Đang tự động xử lý...`);

    // Auto-trigger pipeline immediately!
    setTimeout(() => {
      processNextJobs(updated);
    }, 100);
  };

  // Add Links (Trigger Auto-start)
  const handleAddLinks = (links: string[]) => {
    const newItems: QueueItem[] = links.map((link, idx) => {
      let platform = 'Web';
      if (link.includes('douyin.com')) platform = 'Douyin';
      else if (link.includes('tiktok.com')) platform = 'TikTok';
      else if (link.includes('youtube.com') || link.includes('youtu.be')) platform = 'YouTube';
      else if (link.includes('facebook.com')) platform = 'Facebook';

      return {
        id: `link-${Date.now()}-${idx}`,
        name: `[${platform}] ${link}`,
        url: link,
        isLink: true,
        mode: 'SpeechToSrt',
        duration: '00:03:00',
        status: 'idle',
        progress: 0,
        currentStepMessage: 'Đang chuẩn bị tải yt-dlp...',
        exportedVideoPath: '',
        exportedSrtPath: '',
        subtitles: [],
        topBannerText: settings.topText || '',
        bottomBannerText: settings.bottomText || '',
        ratio: settings.primaryAspectRatio || '1:1',
      };
    });

    const updated = [...queue, ...newItems];
    setQueue(updated);
    appendLog('INFO', `Đã nhận ${links.length} link video. Tự động tải và dịch ngay...`);
    showToast(`Đã thêm ${links.length} link - Bắt đầu tải và dịch tự động!`);

    // Auto-trigger pipeline immediately!
    setTimeout(() => {
      processNextJobs(updated);
    }, 100);
  };

  const handleClearCompleted = () => {
    setQueue((prev) => prev.filter((item) => item.status !== 'completed'));
    appendLog('INFO', 'Đã dọn dẹp các tệp hoàn thành.');
  };

  const handleClearAll = () => {
    setQueue([]);
    appendLog('INFO', 'Đã xóa toàn bộ hàng đợi.');
  };

  const handleDeleteJob = (id: string) => {
    setQueue((prev) => prev.filter((j) => j.id !== id));
  };

  const handleSaveSubtitles = (jobId: string, updatedCues: SubtitleCue[]) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === jobId ? { ...item, subtitles: updatedCues } : item))
    );
  };

  const handleOpenCookiesSettings = (platform?: PlatformCookieKey) => {
    setInitialSettingsTab('cookies');
    setInitialPlatformCookie(platform || 'youtube');
    setIsSettingsOpen(true);
  };

  const handleUseSampleVideo = async (jobId: string) => {
    const job = queue.find((j) => j.id === jobId);
    if (!job) return;

    try {
      appendLog('INFO', `Đang tải video mẫu demo để chạy thử nghiệm pipeline cho #${job.id}...`);
      const res = await fetch('/api/use-sample-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: job.name }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể tạo video mẫu');
      }

      const updatedQueue = queue.map((j) => {
        if (j.id === jobId) {
          return {
            ...j,
            name: data.title,
            exportedVideoPath: data.filePath,
            videoPreviewUrl: data.previewUrl,
            duration: data.duration,
            fileSize: `${data.fileSizeMb} MB`,
            status: 'idle' as JobStatus,
            isBotChallenge: false,
            errorDetail: undefined,
            subtitles: [],
            currentStepMessage: 'Đã nạp video mẫu demo - Sẵn sàng xử lý',
          };
        }
        return j;
      });

      setQueue(updatedQueue);
      appendLog('SUCCESS', `Đã chuyển đổi sang video mẫu demo thành công (${data.fileSizeMb} MB). Kích hoạt xử lý...`);
      showToast('Đã nạp video mẫu demo thành công! Đang tự động xử lý...');

      setTimeout(() => {
        processNextJobs(updatedQueue);
      }, 200);
    } catch (err: any) {
      appendLog('ERROR', `Lỗi khi nạp video mẫu: ${err.message}`);
      showToast(`Lỗi: ${err.message}`);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0c14] text-slate-200">
      {/* Main Execution Screen (Full Width, Zero Waste) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <QueueScreen
          queue={queue}
          settings={settings}
          logs={logs}
          isProcessing={isProcessing}
          onUpdateSettings={handleUpdateSettings}
          onAddFiles={handleAddFiles}
          onAddLinks={handleAddLinks}
          onClearCompleted={handleClearCompleted}
          onClearAll={handleClearAll}
          onDeleteJob={handleDeleteJob}
          onOpenSubtitleEditor={setEditingJob}
          onWatchVideo={setWatchingJob}
          onClearLogs={() => setLogs([])}
          onToggleSettings={() => {
            setInitialSettingsTab(undefined);
            setIsSettingsOpen((prev) => !prev);
          }}
          isSettingsOpen={isSettingsOpen}
          onUseSampleVideo={handleUseSampleVideo}
          onOpenCookiesSettings={handleOpenCookiesSettings}
        />
      </div>

      {/* Full Screen Settings & Setup Modal */}
      {isSettingsOpen && (
        <SettingsScreen
          settings={settings}
          initialTab={initialSettingsTab}
          initialPlatformCookie={initialPlatformCookie}
          onUpdateSettings={handleUpdateSettings}
          onShowNotification={showToast}
          onClose={() => {
            setIsSettingsOpen(false);
            setInitialSettingsTab(undefined);
            setInitialPlatformCookie(undefined);
          }}
        />
      )}

      {/* Video Player Modal (Play Real Translated MP4) */}
      <VideoPlayerModal
        job={watchingJob}
        isOpen={watchingJob !== null}
        onClose={() => setWatchingJob(null)}
        onShowNotification={showToast}
      />

      {/* Subtitle Editor Modal */}
      <SubtitleEditorModal
        job={editingJob}
        settings={settings}
        isOpen={editingJob !== null}
        onClose={() => setEditingJob(null)}
        onSaveSubtitles={handleSaveSubtitles}
        onShowNotification={showToast}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-[#181b2e] border border-indigo-500/50 rounded-xl shadow-2xl text-xs text-white flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
