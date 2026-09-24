import { AppSettings, QueueItem, SubtitleCue, SystemLog } from '../types';

export const defaultSettings: AppSettings = {
  // Chế độ xử lý chính
  operationMode: 'speech_to_text',
  sourceLanguage: 'auto',
  enableAutoStart: true,

  // Cấu hình Whisper & CLI
  whisperModel: 'base',
  device: 'CPU',
  useVAD: false,
  whisperCliPath: '/usr/local/bin/whisper',

  // Dịch phụ đề bằng AI & Xoay vòng tài khoản (Rotation Pool)
  autoTranslate: true,
  translateProvider: 'gemini_api',
  deepseekAuthToken: '',
  aiAccounts: [],
  rotationStrategy: 'failover_only',
  targetLanguage: 'Tiếng Việt',
  timeAdaptive: false,
  strictWordCount: true,
  contextLinkSentences: true,
  customPrompt: 'Nếu dính đến Phật Giáo, Hãy dùng ngôn ngữ trang trọng và thành kính nhất đối với Đức Phật.\nNếu nói đến thế kỷ, ví dụ Thế kỷ thứ V thì chuyển thành thế kỷ thứ năm',
  metaAiMode: 'folder',
  metaAiFolder: 'D:\\cookie\\metaai',
  geminiMode: 'folder',
  geminiFolder: 'D:\\cookie\\gemini',
  proxyMode: 'none',
  singleConversation: true,
  batchLines: 50,
  maxRetries: 10,
  delaySeconds: 1,

  // Thuyết minh & Đọc phụ đề (TTS)
  enableTTS: true,
  ttsServer: 'edge_tts',
  piperModel: 'ngochuyennew',
  ttsVoice: 'Google Neural Voice (Tiếng Việt)',
  speedRate: 1.0,
  ttsSpeedMode: 'adaptive',
  ttsExportMode: 'mux_video_duck',
  naturalPause: true,
  originalAudioVolume: 15,
  ttsVolume: 2.2,
  useBgm: false,
  bgmFile: 'lofi_acoustic_chill.mp3',
  bgmVolume: 18,
  ttsOutputDir: 'D:\\VIDEO\\VIDEO THUYETMINH',
  ttsMaxRetries: 10,
  ttsThreads: 0,
  ttsPauseDuration: 0.0,
  realignSRT: true,

  // Rút gọn câu bằng AI
  aiShorten: false,
  aiShortenProvider: 'CKEY (OpenAI-compatible)',
  aiShortenBaseUrl: 'https://api.xah.io/v1',
  aiShortenApiKey: 'sk-xxxxxxxxxxxxxxxxxxxxxxxx',
  aiShortenModel: 'gpt-5.4',

  // Cấu hình thư mục lưu trữ
  rawSrtDir: 'D:\\VIDEO\\SUB',
  translatedSrtDir: 'D:\\VIDEO\\SUB DICH',
  downloadVideoDir: 'D:\\VIDEO\\VIDEO TAI VE',

  // Cài đặt tối ưu hàng đợi
  concurrency: 1,
  downloadRetries: 10,
  subExtractRetries: 10,
  retryFailedPasses: 2,
  onlyDownload: false,
  autoOpenFolder: true,
  overwriteSrt: false,
  skipExistingSrt: true,

  // Tùy chọn định dạng SRT
  enableCharLineLimit: false,
  charPerLine: 20,
  maxLinesPerSub: 1,

  // Che / chèn phụ đề output
  autoDetectHardSub: false,
  maskType: 'Blur',
  maskWidth: 'sub_width',
  fallbackHeightPct: 13,
  burnInSub: true,
  autoFitSubtitleSize: false,
  subFont: 'Arial Bold',
  subFontSize: 42,
  subBorder: 0.3,
  subPosX: 50,
  subPosY: 97,
  subColor: '#FFFFFF',
  subBorderColor: '#000000',
  useSubBg: true,
  subBgColor: '#000000',
  subBgOpacity: 55,

  // Setup video output sau thuyết minh
  enableDecorations: true,
  aiSuggestDescription: true,
  aiDescSource: 'Meta AI (Cookie)',
  aiDescStyle: 'Tự động nhận diện nội dung',
  aiDescPrompt: '',
  aiDescRetries: 2,
  insertDescriptions: true,
  descPlacement: 'both',
  descAlignTop: 'center',
  descAlignBottom: 'center',
  topText: 'Tên video tự dịch bằng AI',
  bottomText: 'Mô tả / hook phía dưới',
  descFont: 'Arial Bold',
  descFontSize: 32,
  descBorder: 0.3,
  descAutoFit: true,
  descBold: true,
  descItalic: false,
  descUnderline: false,
  descStrikethrough: false,
  descColor: '#FFFFFF',
  descBorderColor: '#800040',

  // Banner, logo & nền màu
  useLogo: true,
  logoPath: 'C:\\Users\\Doan Nguyen\\Downloads\\logobian.png',
  logoPos: 'top_left',
  logoShiftX: 1116,
  logoShiftY: 160,
  logoScale: 100,
  useTopBottomBanner: true,
  bannerUseImage: true,
  bannerSharedImage: 'mau-background-dep-5.jpg',
  bannerTopImage: '',
  bannerBottomImage: '',
  bannerTopColor: '#111111',
  bannerBottomColor: '#111111',
  bannerTopHeightPct: 12,
  bannerBottomHeightPct: 11,

  // Tỷ lệ khung video đầu ra
  changeAspectRatio: true,
  primaryAspectRatio: '1:1',
  exportMultipleRatios: false,
  exportRatios: { '1:1': true, '16:9': false, '9:16': false },
  addRatioPrefix: true,
  upscaleFullHd: true,
  renderMode: 'fast_merged',
  encoder: 'slow_high_quality',
  cropToFit: true,
  zoomVideo: false,
  zoomLevel: 1.0,

  // Đồng bộ tốc độ đọc
  syncMode: 'keep_stretch_fast',
  standardSpeed: 1.0,

  // Tự động đăng YouTube
  autoPostYoutube: false,
  youtubeProfilePath: 'D:\\VIDEO\\pofile video',
  youtubeTitleTemplate: '{tenvideo}',
  youtubeDescTemplate: '{tieude}\n{toptext}\n{bottomtext}',
  youtubeRetries: 3,
  youtubeTargetVideo: 'Video chính / tỷ lệ đầu tiên',
  youtubeScheduleMode: true,
  youtubeMadeForKids: false,
  youtubeStartDate: '2026-07-07',
  youtubeStartTime: '20:00',
  youtubeNextScheduledTime: '2026-07-13 20:00',
  youtubeFrequency: 'day',
  youtubeIntervalDays: 1,
  youtubeQueueOrder: 'top_down',

  // Tự động đăng Facebook Page
  autoPostFacebook: false,
  facebookPageId: '1218394768016354',
  facebookGraphApiVersion: 'v25.0',
  facebookPageAccessToken: 'EAAGNO4a7r8BAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  facebookPublicVideoUrl: '',
  facebookRetries: 3,
  facebookTargetVideo: '1:1',
  facebookScheduleMode: true,
  facebookStartDate: '2026-07-04',
  facebookStartTime: '12:00',
  facebookNextScheduledTime: '2026-07-13 18:00',
  facebookFrequency: 'hour',
  facebookIntervalHours: 3,
  facebookSkipQuietHours: true,
  facebookQuietStart: '00:00',
  facebookQuietEnd: '07:00',
  facebookQueueOrder: 'first_done',

  // CLI Tools
  ffmpegPath: 'E:\\ffmpeg\\bin\\ffmpeg.exe',
  pythonPath: 'C:\\Users\\Doan Nguyen\\AppData\\Local\\Programs\\Python\\Python310\\python.exe',
  tesseractPath: 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe',
  whisperScriptPath: 'D:\\LAPTRINH\\NET 8\\MMO AUTO SRT STUDIO\\bin\\Debug\\net8.0-windows\\Python\\whisper_service.py',
};

export const sampleSubtitles: SubtitleCue[] = [];

export const initialQueue: QueueItem[] = [];

export const initialLogs: SystemLog[] = [
  {
    id: 'log-1',
    timestamp: '2026-07-13 16:32:29',
    level: 'INFO',
    message: 'Đã khôi phục 1 mục trong hàng đợi từ phiên trước.',
  },
  {
    id: 'log-2',
    timestamp: '2026-07-13 16:32:29',
    level: 'INFO',
    message: 'Chương trình MMO Auto SRT Studio đã sẵn sàng.',
  },
  {
    id: 'log-3',
    timestamp: '2026-07-13 16:32:30',
    level: 'INFO',
    message: 'Kiểm tra môi trường: FFmpeg OK | Python faster-whisper OK | Tesseract OCR OK.',
  },
  {
    id: 'log-4',
    timestamp: '2026-07-13 16:32:31',
    level: 'DEEPSEEK',
    message: 'DeepSeek Web Auth Token hợp lệ. Chế độ dịch liên kết câu đã bật.',
  },
  {
    id: 'log-5',
    timestamp: '2026-07-13 16:32:31',
    level: 'TTS',
    message: 'Nghim TTS Piper ONNX Engine sẵn sàng [Model: ngochuyennew, Rate: 1.0x].',
  },
];
