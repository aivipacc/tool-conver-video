export type AIAccountProvider = 'gemini' | 'gemini_cookie' | 'deepseek' | 'openai_compatible';

export interface AIAccount {
  id: string;
  provider: AIAccountProvider;
  name: string;
  keyOrCookie: string; // API Key or Cookie string (__Secure-1PSID, etc.)
  baseUrl?: string;
  model?: string;
  status: 'active' | 'exhausted' | 'error';
  requestsCount: number;
  lastUsed?: string;
  lastResponseTimeMs?: number;
  lastError?: string;
}

export type PlatformCookieKey = 'youtube' | 'douyin' | 'tiktok' | 'facebook' | 'instagram';

export interface SinglePlatformStatus {
  exists: boolean;
  lineCount: number;
  sizeBytes: number;
  updatedAt?: string;
}

export type PlatformCookieStatusMap = Record<PlatformCookieKey, SinglePlatformStatus>;

export interface SubtitleCue {
  id: number;
  startTime: string; // "00:00:01,200"
  endTime: string;   // "00:00:04,500"
  startSeconds: number;
  endSeconds: number;
  originalText: string;
  translatedText: string;
  ttsAudioUrl?: string;
  ttsDuration?: number;
}

export type OperationMode = 'speech_to_text' | 'hard_sub_ocr';
export type WhisperModel = 'tiny' | 'base' | 'small' | 'medium' | 'large-v3';
export type DeviceType = 'CPU' | 'CUDA';
export type TranslateProvider = 'deepseek_free' | 'deepseek_api' | 'gemini_api' | 'meta_ai' | 'claude';
export type TTSServer = 'nghim_piper' | 'edge_tts' | 'capcut_tts' | 'browser_speech';
export type TTSSpeedMode = 'fixed' | 'adaptive' | 'smooth_sync';
export type TTSExportMode = 'mux_video_duck' | 'separate_audio' | 'replace_original';
export type MaskType = 'Blur' | 'Solid';
export type MaskWidth = 'sub_width' | 'full_width';
export type AspectRatio = '1:1' | '16:9' | '9:16';

export interface AppSettings {
  // Chế độ xử lý chính
  operationMode: OperationMode;
  sourceLanguage: string; // 'auto' | 'zh' | 'en' | 'vi' | 'ja' | 'ko'
  enableAutoStart: boolean;

  // Whisper & CLI
  whisperModel: WhisperModel;
  device: DeviceType;
  useVAD: boolean;
  whisperCliPath: string;

  // Dịch phụ đề bằng AI & Xoay vòng tài khoản (Rotation Pool)
  autoTranslate: boolean;
  translateProvider: TranslateProvider;
  deepseekAuthToken: string;
  aiAccounts: AIAccount[];
  rotationStrategy: 'round_robin' | 'failover_only' | 'fastest';
  targetLanguage: string;
  timeAdaptive: boolean;
  strictWordCount: boolean;
  contextLinkSentences: boolean;
  customPrompt: string;
  metaAiMode: 'direct' | 'folder';
  metaAiFolder: string;
  geminiMode: 'direct' | 'folder';
  geminiFolder: string;
  proxyMode: 'none' | 'static' | 'fproxy';
  singleConversation: boolean;
  batchLines: number;
  maxRetries: number;
  delaySeconds: number;

  // Thuyết minh (TTS)
  enableTTS: boolean;
  ttsServer: TTSServer;
  piperModel: string;
  ttsVoice: string;
  speedRate: number;
  ttsSpeedMode: TTSSpeedMode;
  ttsExportMode: TTSExportMode;
  naturalPause: boolean;
  originalAudioVolume: number; // percentage (e.g. 15)
  ttsVolume: number;           // factor (e.g. 1.5)
  useBgm: boolean;
  bgmFile: string;
  bgmVolume: number;          // percentage (e.g. 18)
  ttsOutputDir: string;
  ttsMaxRetries: number;
  ttsThreads: number;
  ttsPauseDuration: number;
  realignSRT: boolean;

  // Rút gọn câu bằng AI
  aiShorten: boolean;
  aiShortenProvider: string;
  aiShortenBaseUrl: string;
  aiShortenApiKey: string;
  aiShortenModel: string;

  // Cấu hình thư mục lưu trữ
  rawSrtDir: string;
  translatedSrtDir: string;
  downloadVideoDir: string;

  // Cài đặt tối ưu hàng đợi
  concurrency: number;
  downloadRetries: number;
  subExtractRetries: number;
  retryFailedPasses: number;
  onlyDownload: boolean;
  autoOpenFolder: boolean;
  overwriteSrt: boolean;
  skipExistingSrt: boolean;

  // Tùy chọn định dạng SRT
  enableCharLineLimit: boolean;
  charPerLine: number;
  maxLinesPerSub: number;

  // Che / chèn phụ đề output
  autoDetectHardSub: boolean;
  maskType: MaskType;
  maskWidth: MaskWidth;
  fallbackHeightPct: number;
  burnInSub: boolean;
  autoFitSubtitleSize: boolean;
  subFont: string;
  subFontSize: number;
  subBorder: number;
  subPosX: number;
  subPosY: number;
  subColor: string;
  subBorderColor: string;
  useSubBg: boolean;
  subBgColor: string;
  subBgOpacity: number;

  // Setup video output sau thuyết minh
  enableDecorations: boolean;
  aiSuggestDescription: boolean;
  aiDescSource: string;
  aiDescStyle: string;
  aiDescPrompt: string;
  aiDescRetries: number;
  insertDescriptions: boolean;
  descPlacement: 'both' | 'top' | 'bottom';
  descAlignTop: 'center' | 'left' | 'right';
  descAlignBottom: 'center' | 'left' | 'right';
  topText: string;
  bottomText: string;
  descFont: string;
  descFontSize: number;
  descBorder: number;
  descAutoFit: boolean;
  descBold: boolean;
  descItalic: boolean;
  descUnderline: boolean;
  descStrikethrough: boolean;
  descColor: string;
  descBorderColor: string;

  // Banner, logo & nền màu
  useLogo: boolean;
  logoPath: string;
  logoPos: 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right';
  logoShiftX: number;
  logoShiftY: number;
  logoScale: number;
  useTopBottomBanner: boolean;
  bannerUseImage: boolean;
  bannerSharedImage: string;
  bannerTopImage: string;
  bannerBottomImage: string;
  bannerTopColor: string;
  bannerBottomColor: string;
  bannerTopHeightPct: number;
  bannerBottomHeightPct: number;

  // Tỷ lệ khung video đầu ra
  changeAspectRatio: boolean;
  primaryAspectRatio: AspectRatio;
  exportMultipleRatios: boolean;
  exportRatios: { '1:1': boolean; '16:9': boolean; '9:16': boolean };
  addRatioPrefix: boolean;
  upscaleFullHd: boolean;
  renderMode: 'fast_merged' | 'standard';
  encoder: 'slow_high_quality' | 'fast';
  cropToFit: boolean;
  zoomVideo: boolean;
  zoomLevel: number;

  // Đồng bộ tốc độ đọc
  syncMode: 'keep_stretch_fast' | 'keep_fixed' | 'speed_up_video';
  standardSpeed: number;

  // Tự động đăng YouTube
  autoPostYoutube: boolean;
  youtubeProfilePath: string;
  youtubeTitleTemplate: string;
  youtubeDescTemplate: string;
  youtubeRetries: number;
  youtubeTargetVideo: string;
  youtubeScheduleMode: boolean;
  youtubeMadeForKids: boolean;
  youtubeStartDate: string;
  youtubeStartTime: string;
  youtubeNextScheduledTime: string;
  youtubeFrequency: 'day' | 'hour';
  youtubeIntervalDays: number;
  youtubeQueueOrder: 'top_down' | 'first_done';

  // Tự động đăng Facebook Page
  autoPostFacebook: boolean;
  facebookPageId: string;
  facebookGraphApiVersion: string;
  facebookPageAccessToken: string;
  facebookPublicVideoUrl: string;
  facebookRetries: number;
  facebookTargetVideo: string;
  facebookScheduleMode: boolean;
  facebookStartDate: string;
  facebookStartTime: string;
  facebookNextScheduledTime: string;
  facebookFrequency: 'day' | 'hour';
  facebookIntervalHours: number;
  facebookSkipQuietHours: boolean;
  facebookQuietStart: string;
  facebookQuietEnd: string;
  facebookQueueOrder: 'first_done' | 'top_down';

  // Đường dẫn công cụ CLI & Cookies
  ffmpegPath: string;
  pythonPath: string;
  tesseractPath: string;
  whisperScriptPath: string;
  youtubeCookies?: string;
  hasCookiesFile?: boolean;
}

export type JobStatus = 'idle' | 'waiting' | 'downloading' | 'extracting_audio' | 'transcribing' | 'translating' | 'generating_tts' | 'muxing' | 'completed' | 'failed' | 'paused';

export interface QueueItem {
  id: string;
  name: string;
  url?: string;
  isLink?: boolean;
  mode: 'SpeechToSrt' | 'HardSubOCR';
  duration: string; // e.g. "00:05:37"
  status: JobStatus;
  progress: number; // 0 - 100
  currentStepMessage: string;
  exportedVideoPath: string;
  exportedSrtPath: string;
  realVideoUrl?: string;
  fileSize?: string;
  executionTimeMs?: number;
  errorDetail?: string;
  isBotChallenge?: boolean;
  subtitles: SubtitleCue[];
  videoThumbnail?: string;
  videoPreviewUrl?: string;
  topBannerText?: string;
  bottomBannerText?: string;
  ratio?: AspectRatio;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'FFMPEG' | 'WHISPER' | 'DEEPSEEK' | 'TTS' | 'DOWNLOAD' | 'AI_ROTATION';
  message: string;
}
