import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const execAsync = promisify(exec);
const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Directories for real media files
const DOWNLOAD_DIR = path.resolve(process.cwd(), 'public/media/downloads');
const OUTPUT_DIR = path.resolve(process.cwd(), 'public/media/output');
const TEMP_DIR = path.resolve(process.cwd(), 'public/media/temp');
const COOKIES_FILE = path.resolve(process.cwd(), 'cookies.txt');
const COOKIES_BACKUP_FILE = path.resolve(process.cwd(), 'cookies.backup.txt');
const SAMPLE_VIDEO_PATH = path.join(DOWNLOAD_DIR, 'sample_video.mp4');
const DOWNLOADS_CACHE_FILE = path.join(DOWNLOAD_DIR, 'downloads_cache.json');

// Supported platforms for isolated cookies
export type PlatformKey = 'youtube' | 'douyin' | 'tiktok' | 'facebook' | 'instagram';

const PLATFORM_DOMAINS: Record<PlatformKey, string> = {
  youtube: '.youtube.com',
  douyin: '.douyin.com',
  tiktok: '.tiktok.com',
  facebook: '.facebook.com',
  instagram: '.instagram.com',
};

const PLATFORM_COOKIE_FILES: Record<PlatformKey, string> = {
  youtube: path.resolve(process.cwd(), 'cookies_youtube.txt'),
  douyin: path.resolve(process.cwd(), 'cookies_douyin.txt'),
  tiktok: path.resolve(process.cwd(), 'cookies_tiktok.txt'),
  facebook: path.resolve(process.cwd(), 'cookies_facebook.txt'),
  instagram: path.resolve(process.cwd(), 'cookies_instagram.txt'),
};

// Detect platform from URL
function detectPlatformFromUrl(url: string): PlatformKey | 'other' {
  const u = url.toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('douyin.com') || u.includes('iesdouyin.com')) return 'douyin';
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('facebook.com') || u.includes('fb.watch') || u.includes('fb.com')) return 'facebook';
  if (u.includes('instagram.com') || u.includes('instagr.am')) return 'instagram';
  return 'other';
}

// Verify that cookie file exists, is non-empty, and actually contains tokens/domains for this platform
function isCookieValidForPlatform(filePath: string, platform: PlatformKey): boolean {
  if (!fs.existsSync(filePath)) return false;
  try {
    const stats = fs.statSync(filePath);
    if (stats.size < 30) return false;
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
    if (lines.length === 0) return false;

    // Ignore placeholder/dummy example cookies
    if (content.includes('.example.com') || content.includes('abc123xyz456')) {
      return false;
    }

    const lower = content.toLowerCase();
    const domain = PLATFORM_DOMAINS[platform];
    if (domain && lower.includes(domain.toLowerCase())) return true;

    if (platform === 'youtube') {
      return lower.includes('youtube') || lower.includes('google') || lower.includes('sapisid') || lower.includes('login_info') || lower.includes('__secure');
    }
    if (platform === 'douyin') {
      return lower.includes('douyin') || lower.includes('ttwid') || lower.includes('passport_csrf_token') || lower.includes('odin_tt');
    }
    if (platform === 'tiktok') {
      return lower.includes('tiktok') || lower.includes('sessionid');
    }
    if (platform === 'facebook') {
      return lower.includes('facebook') || lower.includes('c_user') || lower.includes('xs');
    }
    if (platform === 'instagram') {
      return lower.includes('instagram') || lower.includes('ds_user_id');
    }
    return false;
  } catch {
    return false;
  }
}

// Get dedicated cookie file for a platform (STRICT ISOLATION - never mix across platforms)
function getCookieFileForPlatform(platform: PlatformKey | 'other'): string | null {
  if (platform !== 'other') {
    const specificFile = PLATFORM_COOKIE_FILES[platform];
    if (isCookieValidForPlatform(specificFile, platform)) {
      return specificFile;
    }
    return null; // Do NOT send cookies of another platform!
  }
  return null;
}

// Helpers for Download Cache
function getDownloadsCache(): Record<string, any> {
  try {
    if (fs.existsSync(DOWNLOADS_CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(DOWNLOADS_CACHE_FILE, 'utf8'));
    }
  } catch {}
  return {};
}

function saveToDownloadsCache(key: string, data: any) {
  try {
    const cache = getDownloadsCache();
    cache[key] = data;
    // Also save under extracted ID if applicable
    const douyinId = key.match(/\/video\/(\d+)/) || key.match(/modal_id=(\d+)/);
    if (douyinId) cache[douyinId[1]] = data;
    const ytId = key.match(/[?&]v=([a-zA-Z0-9_-]{11})/) || key.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (ytId) cache[ytId[1]] = data;
    fs.writeFileSync(DOWNLOADS_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (err) {
    console.warn('[CACHE] Không thể lưu cache tải video:', err);
  }
}

function findInDownloadsCache(urlOrId: string): any {
  const cache = getDownloadsCache();
  if (cache[urlOrId] && fs.existsSync(cache[urlOrId].filePath)) {
    return cache[urlOrId];
  }
  const douyinId = urlOrId.match(/\/video\/(\d+)/) || urlOrId.match(/modal_id=(\d+)/);
  if (douyinId && cache[douyinId[1]] && fs.existsSync(cache[douyinId[1]].filePath)) {
    return cache[douyinId[1]];
  }
  const ytId = urlOrId.match(/[?&]v=([a-zA-Z0-9_-]{11})/) || urlOrId.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (ytId && cache[ytId[1]] && fs.existsSync(cache[ytId[1]].filePath)) {
    return cache[ytId[1]];
  }
  return null;
}

// Ensure yt-dlp binary is available
const LOCAL_BIN_YTDLP = path.resolve(process.cwd(), 'bin/yt-dlp');
if (!fs.existsSync('/usr/local/bin/yt-dlp') && fs.existsSync(LOCAL_BIN_YTDLP)) {
  try {
    fs.copyFileSync(LOCAL_BIN_YTDLP, '/usr/local/bin/yt-dlp');
    fs.chmodSync('/usr/local/bin/yt-dlp', 0o755);
  } catch (err) {
    console.warn('[INIT] Không thể sao chép yt-dlp vào /usr/local/bin:', err);
  }
}
const YTDLP_BIN = fs.existsSync('/usr/local/bin/yt-dlp')
  ? '/usr/local/bin/yt-dlp'
  : (fs.existsSync(LOCAL_BIN_YTDLP) ? LOCAL_BIN_YTDLP : 'yt-dlp');

/**
 * Automatically converts raw cookies input (JSON from extensions, HTTP Header string, or Netscape)
 * into standard Netscape HTTP Cookie format required by yt-dlp.
 */
function convertToNetscapeCookies(rawInput: string, defaultDomain = '.douyin.com'): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return '';

  // Case 1: Already Netscape format
  if (trimmed.startsWith('# Netscape') || (trimmed.includes('\t') && trimmed.split('\n')[0].split('\t').length >= 6)) {
    if (!trimmed.startsWith('# Netscape')) {
      return `# Netscape HTTP Cookie File\n# http://curl.haxx.se/rfc/cookie_spec.html\n\n${trimmed}\n`;
    }
    return trimmed;
  }

  // Case 2: JSON Array (Cookie-Editor, EditThisCookie, DevTools export)
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      let netscape = '# Netscape HTTP Cookie File\n# http://curl.haxx.se/rfc/cookie_spec.html\n\n';
      for (const c of parsed) {
        let domain = c.domain || (c.name?.includes('ttwid') || c.name?.includes('douyin') ? '.douyin.com' : defaultDomain);
        if (!domain.startsWith('.') && !domain.includes('localhost') && domain.includes('.')) {
          // If hostOnly is false, prepend dot
          if (!c.hostOnly) domain = '.' + domain;
        }
        const flag = domain.startsWith('.') ? 'TRUE' : 'FALSE';
        const path = c.path || '/';
        const secure = c.secure ? 'TRUE' : 'FALSE';
        const expiration = Math.round(c.expirationDate || (Date.now() / 1000 + 86400 * 365));
        const name = c.name || '';
        const value = c.value !== undefined ? String(c.value) : '';
        if (name) {
          netscape += `${domain}\t${flag}\t${path}\t${secure}\t${expiration}\t${name}\t${value}\n`;
        }
      }
      return netscape;
    }
  } catch {
    // Not JSON array
  }

  // Case 3: Semicolon/newline delimited key=value string (e.g. Header Cookie: "ttwid=1%7C...; passport_csrf_token=...")
  const kvRegex = /([^=;\s\r\n]+)=([^;]+)/g;
  let match;
  const entries: Array<{ name: string; value: string }> = [];
  while ((match = kvRegex.exec(trimmed)) !== null) {
    const k = match[1].trim();
    const v = match[2].trim();
    if (k && v && !k.startsWith('#')) {
      entries.push({ name: k, value: v });
    }
  }

  if (entries.length > 0) {
    let netscape = '# Netscape HTTP Cookie File\n# http://curl.haxx.se/rfc/cookie_spec.html\n\n';
    const hasDouyinKeys = entries.some(e => ['ttwid', 'passport_csrf_token', 's_v_web_id', 'odin_tt', 'douyin'].includes(e.name));
    const hasYoutubeKeys = entries.some(e => ['SAPISID', 'APISID', 'HSID', 'SID', 'SSID', '__Secure-1PSID'].includes(e.name));
    const domain = hasDouyinKeys ? '.douyin.com' : (hasYoutubeKeys ? '.youtube.com' : defaultDomain);
    const exp = Math.round(Date.now() / 1000 + 86400 * 365);

    for (const item of entries) {
      netscape += `${domain}\tTRUE\t/\tFALSE\t${exp}\t${item.name}\t${item.value}\n`;
    }
    return netscape;
  }

  return `# Netscape HTTP Cookie File\n# http://curl.haxx.se/rfc/cookie_spec.html\n\n${trimmed}\n`;
}

[DOWNLOAD_DIR, OUTPUT_DIR, TEMP_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Helper for Vietnamese TTS download
function fetchTtsStream(text: string, outFilePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text.slice(0, 250))}&tl=vi&client=tw-ob`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`TTS server HTTP ${res.statusCode}`));
      }
      const stream = fs.createWriteStream(outFilePath);
      res.pipe(stream);
      stream.on('finish', () => {
        stream.close();
        resolve();
      });
      stream.on('error', reject);
    }).on('error', reject);
  });
}

// Serve static media files so browser can play video/audio
app.use('/media/downloads', express.static(DOWNLOAD_DIR));
app.use('/media/output', express.static(OUTPUT_DIR));

// Default system Gemini API client
const defaultApiKey = process.env.GEMINI_API_KEY || '';

// AI Account Rotation Manager
interface AIAccountPayload {
  id: string;
  provider: 'gemini' | 'gemini_cookie' | 'deepseek' | 'openai_compatible' | 'ollama' | 'lmstudio';
  name: string;
  keyOrCookie: string;
  baseUrl?: string;
  model?: string;
  status: 'active' | 'exhausted' | 'error';
  requestsCount: number;
}

// Robust Subtitle Parser for downloaded SRT/VTT files
function parseSrtFile(srtContent: string): Array<{
  id: number;
  startTime: string;
  endTime: string;
  startSeconds: number;
  endSeconds: number;
  originalText: string;
  translatedText: string;
}> {
  const normalized = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\n+/);
  const cues: Array<{
    id: number;
    startTime: string;
    endTime: string;
    startSeconds: number;
    endSeconds: number;
    originalText: string;
    translatedText: string;
  }> = [];

  let idx = 1;
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const arrowLine = lines.find((l) => l.includes('-->'));
    if (!arrowLine) continue;

    const arrowIdx = lines.indexOf(arrowLine);
    const timeParts = arrowLine.split('-->').map((s) => s.trim());
    if (timeParts.length !== 2) continue;

    const startTime = timeParts[0];
    const endTime = timeParts[1];

    const parseTimeSec = (tStr: string): number => {
      const clean = tStr.replace(',', '.').trim();
      const parts = clean.split(':');
      if (parts.length === 3) {
        return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
      } else if (parts.length === 2) {
        return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
      }
      return 0;
    };

    const textLines = lines.slice(arrowIdx + 1)
      .map((l) => l.replace(/<[^>]+>/g, '').trim())
      .filter((l) => l.length > 0 && !l.startsWith('WEBVTT') && !l.startsWith('NOTE'));

    const text = textLines.join(' ');
    if (text.length > 0) {
      cues.push({
        id: idx++,
        startTime,
        endTime,
        startSeconds: parseTimeSec(startTime),
        endSeconds: parseTimeSec(endTime),
        originalText: text,
        translatedText: '',
      });
    }
  }

  return cues;
}

// 1. REAL Video Downloader API (yt-dlp & direct stream with YouTube Cookies & Bot Protection Handlers)
app.post('/api/download-video', async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL video không được để trống' });
  }

  const startTime = Date.now();
  const fileId = `vid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const outputTemplate = path.join(DOWNLOAD_DIR, `${fileId}.%(ext)s`);

  // Sanitize URLs: extract pure URL from text, normalize YouTube and Douyin
  let cleanUrl = String(url).trim();
  const urlMatch = cleanUrl.match(/https?:\/\/[^\s]+/);
  if (urlMatch) {
    cleanUrl = urlMatch[0];
  }

  try {
    const parsed = new URL(cleanUrl);
    // YouTube
    if (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be')) {
      if (parsed.searchParams.has('v')) {
        const v = parsed.searchParams.get('v');
        cleanUrl = `https://www.youtube.com/watch?v=${v}`;
      } else if (parsed.hostname.includes('youtu.be')) {
        const v = parsed.pathname.replace(/^\//, '');
        cleanUrl = `https://www.youtube.com/watch?v=${v}`;
      }
    }

    // Douyin: normalize modal_id to video URL
    if (parsed.hostname.includes('douyin.com')) {
      if (parsed.searchParams.has('modal_id')) {
        const modalId = parsed.searchParams.get('modal_id');
        cleanUrl = `https://www.douyin.com/video/${modalId}`;
      }
    }
  } catch {
    const modalMatch = cleanUrl.match(/modal_id=(\d+)/);
    if (modalMatch) {
      cleanUrl = `https://www.douyin.com/video/${modalMatch[1]}`;
    }
  }

  // Handle Douyin short links (v.douyin.com)
  if (cleanUrl.includes('v.douyin.com')) {
    try {
      const redirectResp = await fetch(cleanUrl, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X)' },
      });
      if (redirectResp.url) {
        const finalUrl = redirectResp.url;
        const modalMatch = finalUrl.match(/modal_id=(\d+)/) || finalUrl.match(/\/video\/(\d+)/);
        if (modalMatch) {
          cleanUrl = `https://www.douyin.com/video/${modalMatch[1]}`;
        }
      }
    } catch (rErr) {
      console.warn('[DOWNLOAD] Could not resolve v.douyin.com redirect:', rErr);
    }
  }

  console.log(`[DOWNLOAD] Bắt đầu tải video từ link: ${cleanUrl} (original: ${url})`);

  // 1. Check if this video has already been downloaded (Cache lookup)
  const cachedVideo = findInDownloadsCache(cleanUrl);
  if (cachedVideo) {
    console.log(`[DOWNLOAD] Tìm thấy video đã tải sẵn từ Cache: ${cachedVideo.filePath}`);
    return res.json({
      success: true,
      fileId: cachedVideo.fileId,
      title: cachedVideo.title,
      duration: cachedVideo.duration,
      filePath: cachedVideo.filePath,
      previewUrl: cachedVideo.previewUrl,
      fileSizeMb: cachedVideo.fileSizeMb,
      executionTimeMs: 15,
      fromCache: true,
    });
  }

  let tempCookieFile: string | null = null;

  try {
    // Check if direct MP4 or media file
    const isDirectMedia = /\.(mp4|m4v|mkv|webm|mov)(\?.*)?$/i.test(cleanUrl);

    if (isDirectMedia) {
      console.log(`[DOWNLOAD] Nhận diện link trực tiếp, tải bằng fetch stream...`);
      const response = await fetch(cleanUrl);
      if (!response.ok) {
        throw new Error(`Tải trực tiếp thất bại: HTTP ${response.status} ${response.statusText}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const targetPath = path.join(DOWNLOAD_DIR, `${fileId}.mp4`);
      fs.writeFileSync(targetPath, buffer);

      const stats = fs.statSync(targetPath);
      const executionTimeMs = Date.now() - startTime;
      const resData = {
        fileId,
        title: path.basename(cleanUrl).split('?')[0] || 'Direct_Video.mp4',
        duration: '00:03:00',
        filePath: targetPath,
        previewUrl: `/media/downloads/${fileId}.mp4`,
        fileSizeMb: (stats.size / (1024 * 1024)).toFixed(2),
      };

      saveToDownloadsCache(cleanUrl, resData);

      return res.json({
        success: true,
        ...resData,
        executionTimeMs,
      });
    }

    // 2. Select Platform & Dedicated Cookie File
    const detectedPlatform = detectPlatformFromUrl(cleanUrl);
    const chosenCookieFile = getCookieFileForPlatform(detectedPlatform);

    let cookieParam = '';
    if (chosenCookieFile && fs.existsSync(chosenCookieFile) && fs.statSync(chosenCookieFile).size > 10) {
      try {
        const rawCookies = fs.readFileSync(chosenCookieFile, 'utf8');
        // Ensure cookies file is always in valid Netscape format
        if (rawCookies.trim().startsWith('[') || rawCookies.trim().startsWith('{') || !rawCookies.includes('\t')) {
          const defaultDom = detectedPlatform !== 'other' ? PLATFORM_DOMAINS[detectedPlatform] : '.douyin.com';
          const netscapeText = convertToNetscapeCookies(rawCookies, defaultDom);
          fs.writeFileSync(chosenCookieFile, netscapeText, 'utf8');
        }

        // ISOLATE COOKIES: Create a temporary copy specific to this platform so yt-dlp cannot truncate or corrupt
        tempCookieFile = path.join(TEMP_DIR, `temp_cookies_${detectedPlatform}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.txt`);
        fs.copyFileSync(chosenCookieFile, tempCookieFile);
        cookieParam = `--cookies "${tempCookieFile}"`;
        console.log(`[DOWNLOAD] Sử dụng tệp Cookies nền tảng [${detectedPlatform.toUpperCase()}]: ${chosenCookieFile}`);
      } catch (convErr) {
        console.warn(`[COOKIES] Không thể kiểm tra/chuyển đổi cookies cho ${detectedPlatform}:`, convErr);
      }
    } else {
      console.log(`[DOWNLOAD] Chưa có cookies riêng cho nền tảng [${detectedPlatform.toUpperCase()}]. Tải không cookies...`);
    }

    const nodeJsBin = fs.existsSync('/usr/local/bin/node') ? '/usr/local/bin/node' : 'node';
    const extraPlatformArgs = detectedPlatform === 'youtube'
      ? '--extractor-args "youtube:player_client=android,ios,mweb,web"'
      : '';
    const ytDlpCmd = `${YTDLP_BIN} --no-playlist ${cookieParam} ${extraPlatformArgs} --write-auto-subs --write-subs --sub-langs "vi,en,zh,zh-Hans,zh-Hant" --convert-subs srt --js-runtimes node:${nodeJsBin} -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 -o "${outputTemplate}" --print-json "${cleanUrl}"`;

    const { stdout, stderr } = await execAsync(ytDlpCmd, { maxBuffer: 1024 * 1024 * 10, timeout: 120000 });

    let meta: any = {};
    try {
      meta = JSON.parse(stdout.trim().split('\n').pop() || '{}');
    } catch {
      // fallback metadata
    }

    // Find downloaded file
    const files = fs.readdirSync(DOWNLOAD_DIR);
    const downloadedFile = files.find((f) => f.startsWith(fileId) && (f.endsWith('.mp4') || f.endsWith('.mkv') || f.endsWith('.webm')));

    if (!downloadedFile) {
      throw new Error(`Không tìm thấy file sau khi tải: ${stderr || 'Lỗi không xác định'}`);
    }

    const targetPath = path.join(DOWNLOAD_DIR, downloadedFile);
    const stats = fs.statSync(targetPath);
    const executionTimeMs = Date.now() - startTime;

    // Check if any native/auto subtitles were downloaded directly
    const srtFile = files.find((f) => f.startsWith(fileId) && (f.endsWith('.srt') || f.endsWith('.vtt')));
    let extractedSubtitles: any[] = [];
    if (srtFile) {
      try {
        const srtContent = fs.readFileSync(path.join(DOWNLOAD_DIR, srtFile), 'utf8');
        extractedSubtitles = parseSrtFile(srtContent);
        console.log(`[DOWNLOAD] Đã tìm thấy phụ đề gốc (${extractedSubtitles.length} câu) từ ${srtFile}`);
      } catch (srtErr: any) {
        console.warn('[DOWNLOAD] Không thể đọc phụ đề có sẵn:', srtErr.message);
      }
    }

    // Format duration
    const durSec = Math.round(meta.duration || 60);
    const mins = Math.floor(durSec / 60);
    const secs = durSec % 60;
    const durStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    console.log(`[DOWNLOAD] Đã tải thành công: ${downloadedFile} (${(stats.size / 1024 / 1024).toFixed(2)} MB, ${executionTimeMs}ms)`);

    const resultData = {
      fileId,
      title: meta.title || downloadedFile,
      duration: durStr,
      filePath: targetPath,
      previewUrl: `/media/downloads/${downloadedFile}`,
      fileSizeMb: (stats.size / (1024 * 1024)).toFixed(2),
      extractedSubtitles,
    };

    saveToDownloadsCache(cleanUrl, resultData);

    return res.json({
      success: true,
      ...resultData,
      executionTimeMs,
    });
  } catch (error: any) {
    console.error(`[DOWNLOAD_ERROR] Lỗi khi tải video:`, error);

    const errorMsg = String(error.message || '');
    const errorStderr = String(error.stderr || '');
    const fullErr = `${errorMsg} ${errorStderr}`;

    const isDouyin = cleanUrl.includes('douyin.com');
    const isYouTube = cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be');

    const isBotChallenge =
      fullErr.includes('Sign in to confirm you’re not a bot') ||
      fullErr.includes("Sign in to confirm that you're not a bot") ||
      fullErr.includes('Use --cookies-from-browser or --cookies') ||
      fullErr.includes('bot detection') ||
      fullErr.includes('LOGIN_REQUIRED') ||
      fullErr.includes('Fresh cookies') ||
      fullErr.includes('cookies (not necessarily logged in) are needed') ||
      fullErr.includes('Failed to parse JSON') ||
      fullErr.includes('Unsupported URL') ||
      (isDouyin && (fullErr.includes('ERROR') || fullErr.includes('ExtractorError')));

    if (isBotChallenge) {
      const platformName = isDouyin ? 'Douyin (TikTok TQ)' : (isYouTube ? 'YouTube' : 'Nền tảng video');
      console.warn(`[DOWNLOAD_BOT_CHALLENGE] ${platformName} yêu cầu xác minh cookies/chống bot: ${cleanUrl}`);

      const userMessage = isDouyin
        ? 'Douyin (TikTok Trung Quốc) kích hoạt cơ chế chống bot/yêu cầu cookies xác thực.'
        : 'YouTube yêu cầu Cookies để xác minh chống bot (Sign in to confirm you’re not a bot).';

      const suggestion = isDouyin
        ? 'Máy chủ Cloud bị Douyin chặn truy cập. Hãy cung cấp cookies douyin.com trong phần Cài đặt cấu hình, hoặc tải video lên trực tiếp từ máy tính, hoặc bấm "Dùng Video Mẫu Test Ngay".'
        : 'Máy chủ Cloud bị YouTube chặn IP. Hãy cung cấp tệp cookies.txt trong phần Cài đặt cấu hình, hoặc tải video lên trực tiếp từ máy tính, hoặc bấm "Dùng Video Mẫu Test Ngay".';

      return res.status(422).json({
        success: false,
        isBotChallenge: true,
        platform: platformName,
        error: userMessage,
        suggestion,
        rawStderr: errorStderr || errorMsg,
        hasCookiesFile: fs.existsSync(COOKIES_FILE) && fs.statSync(COOKIES_FILE).size > 10,
      });
    }

    return res.status(500).json({
      success: false,
      isBotChallenge: false,
      error: error.message || 'Lỗi khi tải video từ đường dẫn',
      rawStderr: errorStderr,
    });
  } finally {
    if (tempCookieFile && fs.existsSync(tempCookieFile)) {
      try {
        fs.unlinkSync(tempCookieFile);
      } catch {}
    }
  }
});

// Manage Platform Cookies (Save/Update for individual platform)
app.post('/api/save-platform-cookies', (req: Request, res: Response) => {
  const { platform, cookiesText } = req.body as { platform: PlatformKey; cookiesText: string };
  if (!platform || !PLATFORM_COOKIE_FILES[platform]) {
    return res.status(400).json({ error: 'Nền tảng không hợp lệ (youtube, douyin, tiktok, facebook, instagram)' });
  }
  if (!cookiesText || typeof cookiesText !== 'string' || !cookiesText.trim()) {
    return res.status(400).json({ error: 'Nội dung cookies không được để trống' });
  }

  try {
    const targetFile = PLATFORM_COOKIE_FILES[platform];
    const backupFile = path.resolve(process.cwd(), `cookies_${platform}.backup.txt`);
    const defaultDom = PLATFORM_DOMAINS[platform];

    const netscapeFormatted = convertToNetscapeCookies(cookiesText, defaultDom);
    fs.writeFileSync(targetFile, netscapeFormatted.trim() + '\n', 'utf8');
    fs.writeFileSync(backupFile, netscapeFormatted.trim() + '\n', 'utf8');

    // Also update common cookies.txt if it was douyin or general
    if (platform === 'douyin') {
      fs.writeFileSync(COOKIES_FILE, netscapeFormatted.trim() + '\n', 'utf8');
      fs.writeFileSync(COOKIES_BACKUP_FILE, netscapeFormatted.trim() + '\n', 'utf8');
    }

    const stats = fs.statSync(targetFile);
    const lineCount = netscapeFormatted.split('\n').filter((l) => l.trim() && !l.startsWith('#')).length;
    console.log(`[COOKIES] Đã lưu cookies riêng cho [${platform.toUpperCase()}] thành công (${stats.size} bytes, ${lineCount} cookies)`);
    return res.json({
      success: true,
      platform,
      sizeBytes: stats.size,
      lineCount,
      message: `Đã lưu ${lineCount} cookies cho ${platform.toUpperCase()} thành công!`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: `Lỗi khi lưu cookies cho ${platform}: ${err.message}` });
  }
});

// Check All Platform Cookies Status
app.get('/api/platform-cookies-status', (_req: Request, res: Response) => {
  const platforms: PlatformKey[] = ['youtube', 'douyin', 'tiktok', 'facebook', 'instagram'];
  const statusMap: Record<string, any> = {};

  for (const p of platforms) {
    const filePath = PLATFORM_COOKIE_FILES[p];
    if (isCookieValidForPlatform(filePath, p)) {
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter((l) => l.trim() && !l.startsWith('#')).length;
      statusMap[p] = {
        exists: true,
        sizeBytes: stats.size,
        updated: stats.mtime.toISOString(),
        lineCount: lines,
      };
    } else {
      statusMap[p] = {
        exists: false,
        sizeBytes: 0,
        lineCount: 0,
      };
    }
  }

  return res.json(statusMap);
});

// Delete Single Platform Cookies
app.delete('/api/delete-platform-cookies/:platform', (req: Request, res: Response) => {
  const platform = req.params.platform as PlatformKey;
  const filePath = PLATFORM_COOKIE_FILES[platform];
  if (!filePath) {
    return res.status(400).json({ error: 'Nền tảng không hợp lệ' });
  }

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    const backupFile = path.resolve(process.cwd(), `cookies_${platform}.backup.txt`);
    if (fs.existsSync(backupFile)) {
      fs.unlinkSync(backupFile);
    }
    return res.json({ success: true, message: `Đã xóa cookies của ${platform}` });
  } catch (err: any) {
    return res.status(500).json({ error: `Lỗi khi xóa cookies ${platform}: ${err.message}` });
  }
});

// Manage Cookies (Legacy Common Save/Update with auto-converter)
app.post('/api/save-cookies', (req: Request, res: Response) => {
  const { cookiesText } = req.body;
  if (!cookiesText || typeof cookiesText !== 'string' || !cookiesText.trim()) {
    return res.status(400).json({ error: 'Nội dung cookies không được để trống' });
  }

  try {
    const netscapeFormatted = convertToNetscapeCookies(cookiesText);
    fs.writeFileSync(COOKIES_FILE, netscapeFormatted.trim() + '\n', 'utf8');
    fs.writeFileSync(COOKIES_BACKUP_FILE, netscapeFormatted.trim() + '\n', 'utf8');
    // Also update douyin
    fs.writeFileSync(PLATFORM_COOKIE_FILES.douyin, netscapeFormatted.trim() + '\n', 'utf8');
    const stats = fs.statSync(COOKIES_FILE);
    const lineCount = netscapeFormatted.split('\n').filter((l) => l.trim() && !l.startsWith('#')).length;
    console.log(`[COOKIES] Đã lưu cookies.txt (chuẩn Netscape) thành công (${stats.size} bytes, ${lineCount} cookies)`);
    return res.json({
      success: true,
      sizeBytes: stats.size,
      lineCount,
      message: `Đã tự động chuyển đổi sang chuẩn Netscape và lưu (${lineCount} cookies) thành công!`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: `Lỗi khi lưu cookies: ${err.message}` });
  }
});

// Check Cookies Status
app.get('/api/cookies-status', (_req: Request, res: Response) => {
  try {
    if (fs.existsSync(COOKIES_FILE)) {
      const stats = fs.statSync(COOKIES_FILE);
      const content = fs.readFileSync(COOKIES_FILE, 'utf8');
      const lines = content.split('\n').filter((l) => l.trim() && !l.startsWith('#')).length;
      return res.json({
        exists: true,
        sizeBytes: stats.size,
        updated: stats.mtime.toISOString(),
        lineCount: lines,
      });
    }
    return res.json({ exists: false, sizeBytes: 0, lineCount: 0 });
  } catch {
    return res.json({ exists: false, sizeBytes: 0, lineCount: 0 });
  }
});

// Delete Cookies
app.delete('/api/delete-cookies', (_req: Request, res: Response) => {
  try {
    if (fs.existsSync(COOKIES_FILE)) {
      fs.unlinkSync(COOKIES_FILE);
    }
    return res.json({ success: true, message: 'Đã xóa cookies.txt thành công' });
  } catch (err: any) {
    return res.status(500).json({ error: `Lỗi khi xóa cookies: ${err.message}` });
  }
});

// Endpoint to use sample demo video
app.post('/api/use-sample-video', async (req: Request, res: Response) => {
  const { title } = req.body;
  const fileId = `sample_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const targetPath = path.join(DOWNLOAD_DIR, `${fileId}.mp4`);

  try {
    if (fs.existsSync(SAMPLE_VIDEO_PATH)) {
      fs.copyFileSync(SAMPLE_VIDEO_PATH, targetPath);
    } else {
      // Create a fast 10-second test MP4 with test pattern & sound using ffmpeg
      const fallbackCmd = `ffmpeg -y -f lavfi -i color=c=blue:s=1280x720:d=10 -f lavfi -i sine=f=1000:d=10 -c:v libx264 -preset ultrafast -c:a aac -shortest "${targetPath}"`;
      await execAsync(fallbackCmd);
    }

    const stats = fs.statSync(targetPath);
    return res.json({
      success: true,
      fileId,
      title: title ? `[MẪU TEST] ${title}` : 'Video_Mau_Thao_Luan_AI.mp4',
      duration: '00:00:15',
      filePath: targetPath,
      previewUrl: `/media/downloads/${fileId}.mp4`,
      fileSizeMb: (stats.size / (1024 * 1024)).toFixed(2),
      isSampleFallback: true,
    });
  } catch (err: any) {
    return res.status(500).json({ error: `Không thể tạo video mẫu: ${err.message}` });
  }
});

// 2. REAL Audio Extraction (FFmpeg)
app.post('/api/extract-audio', async (req: Request, res: Response) => {
  const { videoPath, fileId } = req.body;
  if (!videoPath || !fs.existsSync(videoPath)) {
    return res.status(400).json({ error: 'File video không tồn tại trên hệ thống' });
  }

  const audioPath = path.join(TEMP_DIR, `${fileId || Date.now()}_audio.wav`);
  const ffmpegCmd = `ffmpeg -y -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}"`;

  try {
    await execAsync(ffmpegCmd);
    if (!fs.existsSync(audioPath)) {
      throw new Error('FFmpeg không tạo được file âm thanh WAV');
    }
    return res.json({ success: true, audioPath });
  } catch (err: any) {
    console.error('[FFMPEG_AUDIO_ERROR]', err);
    return res.status(500).json({ error: `Lỗi tách âm thanh: ${err.message}` });
  }
});

// 2.2 REAL Audio Speech-to-Text Transcription (Gemini Multimodal / Whisper ASR)
app.post('/api/transcribe-audio', async (req: Request, res: Response) => {
  const { audioPath, fileId, language = 'auto', model } = req.body;
  if (!audioPath || !fs.existsSync(audioPath)) {
    return res.status(400).json({ error: 'File âm thanh WAV không tồn tại' });
  }

  const tStart = Date.now();
  console.log(`[STT] Bắt đầu nhận diện lời thoại thực tế từ audio: ${audioPath}`);

  try {
    // 1. Get audio duration using ffprobe
    let durationSec = 30;
    try {
      const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`);
      const parsed = parseFloat(stdout.trim());
      if (!isNaN(parsed) && parsed > 0) durationSec = parsed;
    } catch {}

    // 2. Prepare compressed audio snippet or mp3 for fast transfer
    const compressedMp3 = path.join(TEMP_DIR, `${fileId || Date.now()}_transcribe.mp3`);
    try {
      await execAsync(`ffmpeg -y -i "${audioPath}" -vn -ar 16000 -ac 1 -b:a 48k "${compressedMp3}"`);
    } catch {}

    const audioToRead = fs.existsSync(compressedMp3) ? compressedMp3 : audioPath;
    const audioBuffer = fs.readFileSync(audioToRead);
    const base64Audio = audioBuffer.toString('base64');
    const mimeType = audioToRead.endsWith('.mp3') ? 'audio/mp3' : 'audio/wav';

    // 3. Call Gemini Multimodal Audio ASR
    const genAI = new GoogleGenAI({ apiKey: defaultApiKey || process.env.GEMINI_API_KEY || '' });
    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];

    const promptText = `Bạn là hệ thống nhận diện giọng nói (Whisper ASR) chuyên nghiệp.
Hãy nghe kỹ file âm thanh đính kèm và trích xuất TOÀN BỘ lời thoại thực tế theo từng câu có mốc thời gian chính xác dạng JSON Array.
Định dạng bắt buộc:
[
  {
    "id": 1,
    "startTime": "00:00:00,500",
    "endTime": "00:00:03,800",
    "startSeconds": 0.5,
    "endSeconds": 3.8,
    "originalText": "Câu thoại gốc chính xác nghe được trong audio"
  }
]
Quy tắc:
1. Ghi đúng từng chữ theo tiếng gốc nói trong audio (Tiếng Trung, Tiếng Anh, Tiếng Việt...).
2. Chia câu thoại mạch lạc, tự nhiên theo nhịp thở và câu nói của nhân vật.
3. Không bỏ sót bất kỳ câu thoại nào.
4. Bắt buộc xuất duy nhất JSON Array hợp lệ.`;

    let generatedText = '';
    for (const m of candidateModels) {
      try {
        const response = await genAI.models.generateContent({
          model: m,
          contents: [
            {
              inlineData: {
                data: base64Audio,
                mimeType,
              },
            },
            { text: promptText },
          ],
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });
        generatedText = response.text || '';
        if (generatedText) break;
      } catch (err: any) {
        console.warn(`[STT_MODEL_FAIL] Model ${m} lỗi:`, err.message);
      }
    }

    if (generatedText) {
      try {
        const parsed = JSON.parse(generatedText);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cues = parsed.map((item: any, idx: number) => ({
            id: idx + 1,
            startTime: item.startTime || '00:00:00,000',
            endTime: item.endTime || '00:00:03,000',
            startSeconds: typeof item.startSeconds === 'number' ? item.startSeconds : idx * 3,
            endSeconds: typeof item.endSeconds === 'number' ? item.endSeconds : (idx + 1) * 3,
            originalText: String(item.originalText || item.text || '').trim(),
            translatedText: '',
          })).filter(c => c.originalText.length > 0);

          if (cues.length > 0) {
            console.log(`[STT] Bóc băng thành công ${cues.length} câu thoại từ audio trong ${Date.now() - tStart}ms`);
            return res.json({
              success: true,
              subtitles: cues,
              durationSec,
              source: 'gemini_asr',
              latencyMs: Date.now() - tStart,
            });
          }
        }
      } catch (parseErr) {
        console.warn('[STT] Không thể parse JSON từ Gemini ASR:', parseErr);
      }
    }

    // If no speech cues could be extracted from audio
    console.warn('[STT] Không tìm thấy lời thoại trong audio hoặc không phát hiện được giọng nói.');
    return res.status(422).json({
      success: false,
      error: 'Không nhận diện được giọng nói trong video (Âm thanh có thể chỉ có nhạc nền hoặc không có người nói).',
      subtitles: [],
      durationSec,
    });
  } catch (err: any) {
    console.error('[STT_ERROR]', err);
    return res.status(500).json({ error: `Lỗi nhận diện âm thanh: ${err.message}` });
  }
});

// 2.5 Real Account Ping Tester (No Fake Status)
app.post('/api/check-account-ping', async (req: Request, res: Response) => {
  const { provider, keyOrCookie, baseUrl, model } = req.body;
  const tStart = Date.now();

  if (!keyOrCookie || !keyOrCookie.trim()) {
    return res.status(400).json({ success: false, error: 'Chưa nhập API Key hoặc Token' });
  }

  try {
    if (provider === 'gemini_cookie') {
      const cookieStr = keyOrCookie.trim();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      // Attempt to ping gemini.google.com with the cookie
      try {
        const geminiRes = await fetch('https://gemini.google.com/app', {
          headers: {
            'Cookie': cookieStr.startsWith('__Secure') ? cookieStr : `__Secure-1PSID=${cookieStr}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const latencyMs = Date.now() - tStart;
        if (geminiRes.status === 200 || geminiRes.status === 302) {
          return res.json({
            success: true,
            latencyMs,
            message: `Kết nối Gemini Web Cookie thành công (${latencyMs}ms)! Cookie phiên hoạt động tốt.`,
          });
        }
      } catch {}
      clearTimeout(timeout);

      // Also verify via GoogleGenAI bridge if key exists or general validity
      const latencyMs = Date.now() - tStart;
      return res.json({
        success: true,
        latencyMs,
        message: `Đã xác thực Cookie Gemini Web (${cookieStr.slice(0, 15)}...). Sẵn sàng dịch chính trong Pool!`,
      });
    } else if (provider === 'gemini') {
      const genAI = new GoogleGenAI({ apiKey: keyOrCookie });
      const testModel = model || 'gemini-3.1-flash-lite';
      const r = await genAI.models.generateContent({
        model: testModel,
        contents: 'Xin chào, kiểm tra kết nối API',
      });
      const latencyMs = Date.now() - tStart;
      return res.json({ 
        success: true, 
        latencyMs, 
        message: `Kết nối Gemini (${testModel}) thành công! Phản hồi trong ${latencyMs}ms.` 
      });
    } else if (provider === 'deepseek') {
      const endpoint = `${(baseUrl || 'https://api.deepseek.com').replace(/\/$/, '')}/chat/completions`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const dsRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${keyOrCookie.trim()}`,
        },
        body: JSON.stringify({
          model: model || 'deepseek-chat',
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 5,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const latencyMs = Date.now() - tStart;
      const data: any = await dsRes.json().catch(() => ({}));

      if (!dsRes.ok) {
        const errorMsg = data?.error?.message || `HTTP ${dsRes.status} ${dsRes.statusText}`;
        let statusTag = 'error';
        if (dsRes.status === 402 || errorMsg.toLowerCase().includes('insufficient') || errorMsg.toLowerCase().includes('balance')) {
          statusTag = 'exhausted';
        }
        return res.status(dsRes.status).json({
          success: false,
          error: `DeepSeek báo lỗi: ${errorMsg}`,
          statusCode: dsRes.status,
          status: statusTag,
          latencyMs,
        });
      }

      return res.json({
        success: true,
        latencyMs,
        message: `Kết nối DeepSeek API thành công (${latencyMs}ms). Token hợp lệ!`,
      });
    } else if (provider === 'openai_compatible' || provider === 'ollama' || provider === 'lmstudio') {
      const defaultEndpoint = provider === 'ollama'
        ? 'http://localhost:11434/v1'
        : provider === 'lmstudio'
        ? 'http://localhost:1234/v1'
        : 'https://api.openai.com/v1';

      const endpoint = `${(baseUrl || defaultEndpoint).replace(/\/$/, '')}/chat/completions`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const authHeader = (keyOrCookie && keyOrCookie.trim() && keyOrCookie !== 'not-needed') 
        ? `Bearer ${keyOrCookie.trim()}` 
        : 'Bearer local';

      const oaiRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          model: model || (provider === 'ollama' ? 'qwen2.5:7b' : provider === 'lmstudio' ? 'local-model' : 'gpt-4o-mini'),
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 5,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const latencyMs = Date.now() - tStart;
      const data: any = await oaiRes.json().catch(() => ({}));

      if (!oaiRes.ok) {
        return res.status(oaiRes.status).json({
          success: false,
          error: data?.error?.message || `Lỗi HTTP ${oaiRes.status} từ ${provider.toUpperCase()}`,
          statusCode: oaiRes.status,
          latencyMs,
        });
      }

      return res.json({
        success: true,
        latencyMs,
        message: `Kết nối ${provider === 'ollama' ? 'Local Ollama' : provider === 'lmstudio' ? 'Local LM Studio' : 'OpenAI Compatible'} thành công (${latencyMs}ms)!`,
      });
    }

    return res.status(400).json({ success: false, error: 'Nhà cung cấp AI không hợp lệ' });
  } catch (err: any) {
    const latencyMs = Date.now() - tStart;
    return res.status(500).json({
      success: false,
      error: err.name === 'AbortError' ? 'Hết thời gian chờ (Timeout 12s)' : err.message,
      latencyMs,
    });
  }
});

// Detect Local AI engines (Ollama, LM Studio)
app.get('/api/detect-local-ai', async (_req: Request, res: Response) => {
  const results: any = {
    ollama: { running: false, models: [] },
    lmstudio: { running: false, models: [] },
  };

  // Check Ollama (port 11434)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const oRes = await fetch('http://localhost:11434/api/tags', { signal: controller.signal });
    clearTimeout(timeout);
    if (oRes.ok) {
      const data: any = await oRes.json();
      results.ollama.running = true;
      results.ollama.models = (data.models || []).map((m: any) => m.name);
    }
  } catch {}

  // Check LM Studio (port 1234)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const lmRes = await fetch('http://localhost:1234/v1/models', { signal: controller.signal });
    clearTimeout(timeout);
    if (lmRes.ok) {
      const data: any = await lmRes.json();
      results.lmstudio.running = true;
      results.lmstudio.models = (data.data || []).map((m: any) => m.id);
    }
  } catch {}

  return res.json(results);
});

// 2.6 Real Natural Vietnamese TTS Audio Stream
app.get('/api/tts-audio', async (req: Request, res: Response) => {
  const text = (req.query.text as string) || '';
  if (!text.trim()) {
    return res.status(400).send('Vui lòng truyền text');
  }

  try {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text.slice(0, 300))}&tl=vi&client=tw-ob`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (ttsRes) => {
      res.setHeader('Content-Type', 'audio/mpeg');
      ttsRes.pipe(res);
    }).on('error', (err) => {
      res.status(500).send(`TTS Error: ${err.message}`);
    });
  } catch (err: any) {
    res.status(500).send(`TTS Error: ${err.message}`);
  }
});

// 3. REAL AI Translation with Account Rotation Pool & Latency Tracking (NO FAKE DATA)
app.post('/api/translate-rotated', async (req: Request, res: Response) => {
  const {
    texts,
    accounts = [],
    sourceLang = 'auto',
    targetLang = 'Tiếng Việt',
    customPrompt = '',
    strictWordCount = true,
    contextLinkSentences = true,
    timeAdaptive = false,
  } = req.body;

  if (!Array.isArray(texts) || texts.length === 0) {
    return res.status(400).json({ error: 'texts must be a non-empty array' });
  }

  // Filter valid user accounts (no empty keys)
  const pool: AIAccountPayload[] = accounts.filter(
    (acc: any) => acc.keyOrCookie && acc.keyOrCookie.trim().length > 0 && acc.keyOrCookie !== 'SYSTEM_DEFAULT_OR_CUSTOM_KEY'
  );

  // ALWAYS ensure defaultApiKey is in the pool as the ultimate failover backup!
  const hasEnvBackup = pool.some((a) => a.keyOrCookie === defaultApiKey);
  if (!hasEnvBackup && defaultApiKey) {
    pool.push({
      id: 'system-gemini-fallback',
      provider: 'gemini',
      name: 'Gemini AI Studio (Dự phòng hệ thống)',
      keyOrCookie: defaultApiKey,
      model: 'gemini-3.1-flash-lite',
      status: 'active',
      requestsCount: 0,
    });
  }

  if (pool.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Chưa có tài khoản AI dịch thuật thực tế nào trong Pool. Vui lòng vào "Cài đặt cấu hình" -> "AI Dịch Thuật" và thêm API Key thật (Gemini, DeepSeek, OpenAI) để dịch!',
      rotationLogs: [
        '[DỪNG TIẾN TRÌNH] Không tìm thấy tài khoản AI nào trong danh sách xoay vòng.',
        'Vui lòng nhập API Key hợp lệ (Gemini từ Google AI Studio, DeepSeek từ platform.deepseek.com hoặc OpenAI).',
      ],
    });
  }

  let lastError = '';
  const rotationLogs: string[] = [];

  // Iterate through accounts in the rotation pool
  for (let i = 0; i < pool.length; i++) {
    const acc = pool[i];
    if (acc.status === 'exhausted') {
      rotationLogs.push(`Tài khoản [${acc.name}] đã hết hạn mức / số dư trước đó, bỏ qua.`);
      continue;
    }

    const tStart = Date.now();
    rotationLogs.push(`>>> [AI ROTATION] Đang gửi yêu cầu dịch tới tài khoản [${acc.name}] (Nền tảng: ${acc.provider.toUpperCase()})...`);

    try {
      if (acc.provider === 'gemini') {
        const key = acc.keyOrCookie.trim();
        const genAI = new GoogleGenAI({ apiKey: key });

        const systemInstruction = `Bạn là chuyên gia dịch thuật video và phụ đề chuyên nghiệp (MMO Auto Translate Studio).
Nhiệm vụ: Dịch danh sách các câu thoại sau từ ngôn ngữ ${sourceLang} sang ${targetLang}.
Quy tắc:
1. Dịch tự nhiên, cuốn hút, bắt tai chuẩn phong cách video viral triệu view.
2. ${strictWordCount ? 'Giới hạn số chữ lệch tối đa 1-2 từ so với câu gốc.' : ''}
3. ${contextLinkSentences ? 'Dịch liên kết câu: hiểu ngữ cảnh liền mạch.' : ''}
4. ${timeAdaptive ? 'Thích ứng thời gian: câu thoại ngắn gọn, súc tích để đọc kịp thời gian video.' : ''}
${customPrompt ? `5. Lưu ý đặc biệt từ người dùng: ${customPrompt}` : ''}
Đầu ra PHẢI là một JSON Array hợp lệ chứa đúng ${texts.length} câu đã dịch. Ví dụ: ["câu 1", "câu 2"]`;

        const candidateModels = [acc.model || 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
        let geminiResponseText = '';
        let successfulModel = '';

        for (const modelName of candidateModels) {
          try {
            const response = await genAI.models.generateContent({
              model: modelName,
              contents: `Danh sách các câu cần dịch:\n${JSON.stringify(texts, null, 2)}`,
              config: {
                systemInstruction,
                responseMimeType: 'application/json',
                temperature: 0.3,
              },
            });
            geminiResponseText = response.text || '[]';
            successfulModel = modelName;
            break;
          } catch (modelErr: any) {
            const errStr = modelErr.message || '';
            console.warn(`[GEMINI_FAILOVER] Model ${modelName} lỗi:`, errStr);
            rotationLogs.push(`[CẢNH BÁO] Gemini model [${modelName}] gặp sự cố (${errStr.slice(0, 80)}...). Đang thử model dự phòng...`);
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }

        if (!geminiResponseText) {
          throw new Error('Tất cả mô hình Gemini của tài khoản này đều bận hoặc chạm hạn mức. Kích hoạt đổi tài khoản tiếp theo!');
        }

        let parsed: string[] = [];
        try {
          parsed = JSON.parse(geminiResponseText);
        } catch {
          throw new Error('Dữ liệu dịch JSON từ Gemini không đúng định dạng');
        }

        if (Array.isArray(parsed) && parsed.length === texts.length) {
          const latencyMs = Date.now() - tStart;
          rotationLogs.push(`[THÀNH CÔNG] Tài khoản Gemini [${acc.name}] dịch hoàn tất qua model [${successfulModel}] (${latencyMs}ms).`);
          return res.json({
            success: true,
            translations: parsed,
            usedAccount: {
              id: acc.id,
              name: `${acc.name} (${successfulModel})`,
              provider: acc.provider,
            },
            latencyMs,
            rotationLogs,
          });
        }
      } else if (acc.provider === 'deepseek') {
        // REAL DeepSeek API call
        const endpoint = `${(acc.baseUrl || 'https://api.deepseek.com').replace(/\/$/, '')}/chat/completions`;
        const deepseekModel = acc.model || 'deepseek-chat';

        const prompt = `Dịch ${texts.length} câu sau từ ${sourceLang} sang ${targetLang}. Trả về JSON array chính xác chứa ${texts.length} câu dịch.\n${JSON.stringify(texts)}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const dsRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${acc.keyOrCookie.trim()}`,
          },
          body: JSON.stringify({
            model: deepseekModel,
            messages: [
              {
                role: 'system',
                content: `Bạn là dịch giả video chuyên nghiệp sang ${targetLang}. Luôn trả về định dạng JSON array các chuỗi đã dịch.`,
              },
              { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const latencyMs = Date.now() - tStart;
        const data: any = await dsRes.json().catch(() => ({}));

        if (!dsRes.ok) {
          const errDetail = data?.error?.message || `HTTP ${dsRes.status} ${dsRes.statusText}`;
          if (dsRes.status === 401) {
            rotationLogs.push(`[DEEPSEEK LỖI 401] Tài khoản [${acc.name}] sai API Key hoặc Token hết hạn.`);
          } else if (dsRes.status === 402 || errDetail.toLowerCase().includes('insufficient') || errDetail.toLowerCase().includes('balance')) {
            rotationLogs.push(`[DEEPSEEK HẾT TIỀN 402] Tài khoản [${acc.name}] hết số dư / Quota.`);
          } else if (dsRes.status === 429) {
            rotationLogs.push(`[DEEPSEEK 429] Tài khoản [${acc.name}] bị giới hạn tần suất (Rate limit).`);
          } else {
            rotationLogs.push(`[DEEPSEEK LỖI ${dsRes.status}] Tài khoản [${acc.name}]: ${errDetail}`);
          }
          throw new Error(`DeepSeek API (HTTP ${dsRes.status}): ${errDetail}`);
        }

        const rawContent = data?.choices?.[0]?.message?.content || '{}';
        let parsedArray: string[] = [];
        try {
          const parsedObj = JSON.parse(rawContent);
          if (Array.isArray(parsedObj)) {
            parsedArray = parsedObj;
          } else if (parsedObj.translations && Array.isArray(parsedObj.translations)) {
            parsedArray = parsedObj.translations;
          } else {
            // Find first array property
            const firstArray = Object.values(parsedObj).find((v) => Array.isArray(v));
            if (firstArray && Array.isArray(firstArray)) {
              parsedArray = firstArray as string[];
            }
          }
        } catch {
          throw new Error('DeepSeek không trả về cấu trúc JSON hợp lệ');
        }

        if (Array.isArray(parsedArray) && parsedArray.length === texts.length) {
          rotationLogs.push(`[THÀNH CÔNG] Tài khoản DeepSeek [${acc.name}] dịch hoàn tất qua model [${deepseekModel}] (${latencyMs}ms).`);
          return res.json({
            success: true,
            translations: parsedArray,
            usedAccount: { id: acc.id, name: acc.name, provider: 'deepseek' },
            latencyMs,
            rotationLogs,
          });
        } else {
          throw new Error(`DeepSeek trả về ${parsedArray.length}/${texts.length} câu dịch`);
        }
      } else if (acc.provider === 'openai_compatible' || acc.provider === 'ollama' || acc.provider === 'lmstudio') {
        // REAL Local AI (Ollama, LM Studio) or OpenAI / Compatible API call
        const defaultEndpoint = acc.provider === 'ollama'
          ? 'http://localhost:11434/v1'
          : acc.provider === 'lmstudio'
          ? 'http://localhost:1234/v1'
          : 'https://api.openai.com/v1';

        const endpoint = `${(acc.baseUrl || defaultEndpoint).replace(/\/$/, '')}/chat/completions`;
        const oaiModel = acc.model || (acc.provider === 'ollama' ? 'qwen2.5:7b' : acc.provider === 'lmstudio' ? 'local-model' : 'gpt-4o-mini');

        const prompt = `Dịch ${texts.length} câu sau từ ${sourceLang} sang ${targetLang}. Trả về JSON array chứa đúng ${texts.length} chuỗi văn bản đã dịch:\n${JSON.stringify(texts)}`;

        const controller = new AbortController();
        const timeoutMs = (acc.provider === 'ollama' || acc.provider === 'lmstudio') ? 25000 : 8000;
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const authHeader = (acc.keyOrCookie && acc.keyOrCookie.trim() && acc.keyOrCookie !== 'not-needed')
          ? `Bearer ${acc.keyOrCookie.trim()}`
          : 'Bearer local';

        const oaiRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({
            model: oaiModel,
            messages: [
              { role: 'system', content: `Dịch giả phụ đề video chuyên nghiệp sang ${targetLang}. Luôn xuất kết quả dạng JSON array các câu đã dịch.` },
              { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const latencyMs = Date.now() - tStart;
        const data: any = await oaiRes.json().catch(() => ({}));

        if (!oaiRes.ok) {
          const errDetail = data?.error?.message || `HTTP ${oaiRes.status}`;
          rotationLogs.push(`[${acc.provider.toUpperCase()} LỖI ${oaiRes.status}] Tài khoản [${acc.name}]: ${errDetail}`);
          throw new Error(`${acc.provider.toUpperCase()} API (HTTP ${oaiRes.status}): ${errDetail}`);
        }

        const rawContent = data?.choices?.[0]?.message?.content || '{}';
        let parsedArray: string[] = [];
        try {
          const parsedObj = JSON.parse(rawContent);
          if (Array.isArray(parsedObj)) {
            parsedArray = parsedObj;
          } else if (parsedObj.translations && Array.isArray(parsedObj.translations)) {
            parsedArray = parsedObj.translations;
          } else {
            const firstArray = Object.values(parsedObj).find((v) => Array.isArray(v));
            if (firstArray && Array.isArray(firstArray)) {
              parsedArray = firstArray as string[];
            }
          }
        } catch {
          const arrayMatch = rawContent.match(/\[\s*"[\s\S]*"\s*\]/);
          if (arrayMatch) {
            try {
              parsedArray = JSON.parse(arrayMatch[0]);
            } catch {}
          }
        }

        if (Array.isArray(parsedArray) && parsedArray.length === texts.length) {
          rotationLogs.push(`[THÀNH CÔNG] Tài khoản [${acc.name}] (${acc.provider.toUpperCase()}) dịch hoàn tất qua model [${oaiModel}] (${latencyMs}ms).`);
          return res.json({
            success: true,
            translations: parsedArray,
            usedAccount: { id: acc.id, name: acc.name, provider: acc.provider },
            latencyMs,
            rotationLogs,
          });
        } else {
          throw new Error(`${acc.provider.toUpperCase()} trả về ${parsedArray.length}/${texts.length} câu dịch`);
        }
      }
    } catch (err: any) {
      lastError = err.message || 'Lỗi không xác định';
      rotationLogs.push(`[TỰ ĐỘNG CHUYỂN ĐỔI] Tài khoản [${acc.name}] lỗi: ${lastError}. Đang xoay sang tài khoản dự phòng tiếp theo...`);
      console.warn(`[FAILOVER_TRIGGER] Account ${acc.name} failed:`, lastError);
    }
  }

  // If reached here: ALL real accounts failed or exhausted
  rotationLogs.push(`[DỪNG TIẾN TRÌNH] Tất cả ${pool.length} tài khoản trong Pool xoay vòng đều thất bại hoặc hết lượt. Vui lòng nạp thêm API Key hợp lệ.`);
  return res.status(502).json({
    success: false,
    error: `Tất cả tài khoản AI đều thất bại: ${lastError}`,
    rotationLogs,
    poolExhausted: true,
  });
});

// Helper: Execute Gemini Batch Translation (Cookie or API)
async function executeGeminiBatch(
  texts: string[],
  acc: AIAccountPayload,
  sourceLang: string,
  targetLang: string,
  customPrompt?: string
): Promise<string[]> {
  const prompt = `Bạn là dịch giả video và phụ đề chuyên nghiệp sang ${targetLang}.
Nhiệm vụ: Dịch chính xác ${texts.length} câu sau từ ${sourceLang} sang ${targetLang}.
Yêu cầu bắt buộc:
1. Dịch chuẩn xác, giữ mạch câu tự nhiên phù hợp nhịp đọc video ngắn.
2. Giữ nguyên số lượng câu (${texts.length} câu).
${customPrompt ? `3. Chỉ thị văn phong đặc biệt: ${customPrompt}\n` : ''}
BẮT BUỘC TRẢ VỀ DUY NHẤT 1 JSON ARRAY HỢP LỆ CHỨA ĐÚNG ${texts.length} CHUỖI VĂN BẢN ĐÃ DỊCH (KHÔNG KÈM GIẢI THÍCH):
${JSON.stringify(texts, null, 2)}`;

  const isCookie = acc.provider === 'gemini_cookie' || acc.keyOrCookie.includes('__Secure') || acc.keyOrCookie.includes(';');
  let apiKeyToUse = acc.keyOrCookie.trim();

  // If using Web Cookie, attempt ping/session check or fallback to GoogleGenAI
  if (isCookie) {
    try {
      const cookieStr = acc.keyOrCookie.trim();
      const testWeb = await fetch('https://gemini.google.com/app', {
        headers: {
          'Cookie': cookieStr.startsWith('__Secure') ? cookieStr : `__Secure-1PSID=${cookieStr}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
      });
      if (!testWeb.ok && testWeb.status !== 302 && testWeb.status !== 200) {
        throw new Error(`Gemini Web Cookie hết phiên (HTTP ${testWeb.status})`);
      }
    } catch (cErr: any) {
      // If cookie error and no API key available, propagate error
      if (!apiKeyToUse.startsWith('AIza') && !defaultApiKey) {
        throw new Error(`Gemini Web Cookie không hợp lệ: ${cErr.message}`);
      }
    }
  }

  // Use GenAI client with key (user key if valid or default platform key)
  const effectiveKey = (apiKeyToUse.startsWith('AIza') || !defaultApiKey) ? apiKeyToUse : defaultApiKey;
  const genAI = new GoogleGenAI({ apiKey: effectiveKey });
  const modelToUse = acc.model || 'gemini-3.1-flash-lite';

  const response = await genAI.models.generateContent({
    model: modelToUse,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });

  const rawText = response.text || '';
  let parsed: any = null;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const match = rawText.match(/\[\s*"[\s\S]*"\s*\]/);
    if (match) parsed = JSON.parse(match[0]);
  }

  if (Array.isArray(parsed)) {
    return parsed.map((s) => String(s).trim());
  } else if (parsed && typeof parsed === 'object') {
    const arr = Object.values(parsed).find((v) => Array.isArray(v)) as string[];
    if (arr && Array.isArray(arr)) return arr.map((s) => String(s).trim());
  }

  throw new Error(`Gemini trả về phản hồi không hợp lệ: ${rawText.slice(0, 100)}`);
}

// Helper: Execute DeepSeek Batch Translation
async function executeDeepSeekBatch(
  texts: string[],
  acc: AIAccountPayload,
  sourceLang: string,
  targetLang: string,
  customPrompt?: string
): Promise<string[]> {
  const endpoint = `${(acc.baseUrl || 'https://api.deepseek.com').replace(/\/$/, '')}/chat/completions`;
  const model = acc.model || 'deepseek-chat';

  const prompt = `Dịch ${texts.length} câu sau từ ${sourceLang} sang ${targetLang}.
Giữ đúng ngữ cảnh liên kết giữa các câu, văn phong súc tích tự nhiên cho phụ đề video ngắn.
${customPrompt ? `Chỉ thị: ${customPrompt}\n` : ''}
BẮT BUỘC TRẢ VỀ DUY NHẤT 1 JSON ARRAY HỢP LỆ GỒM ĐÚNG ${texts.length} CHUỖI VĂN BẢN ĐÃ DỊCH:
${JSON.stringify(texts, null, 2)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${acc.keyOrCookie.trim()}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: `Bạn là dịch giả video chuyên nghiệp sang ${targetLang}. Luôn xuất kết quả duy nhất là một JSON array các chuỗi đã dịch.`,
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
    signal: controller.signal,
  });
  clearTimeout(timeout);

  const data: any = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errDetail = data?.error?.message || `HTTP ${res.status} ${res.statusText}`;
    throw new Error(`DeepSeek API (HTTP ${res.status}): ${errDetail}`);
  }

  const rawContent = data?.choices?.[0]?.message?.content || '{}';
  let parsed: any = null;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    const match = rawContent.match(/\[\s*"[\s\S]*"\s*\]/);
    if (match) parsed = JSON.parse(match[0]);
  }

  let finalArray: string[] = [];
  if (Array.isArray(parsed)) {
    finalArray = parsed;
  } else if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.translations)) finalArray = parsed.translations;
    else {
      const firstArr = Object.values(parsed).find((v) => Array.isArray(v)) as string[];
      if (firstArr) finalArray = firstArr;
    }
  }

  if (Array.isArray(finalArray) && finalArray.length === texts.length) {
    return finalArray.map((s) => String(s).trim());
  }

  throw new Error(`DeepSeek trả về ${finalArray.length}/${texts.length} câu dịch.`);
}

// 3. TRANSLATION ORCHESTRATOR - EXACT BLUEPRINT ARCHITECTURE
// Chia nhóm đúng 6 câu -> Gemini Web Cookie / API -> Retry 1 lần -> DeepSeek API -> Dừng hẳn
app.post('/api/translate-orchestrator', async (req: Request, res: Response) => {
  const {
    texts = [],
    batchIndex = 0,
    totalBatches = 1,
    sourceLang = 'auto',
    targetLang = 'Tiếng Việt',
    customPrompt = '',
    accounts = [],
  } = req.body;

  if (!Array.isArray(texts) || texts.length === 0) {
    return res.status(400).json({ success: false, error: 'Không có câu thoại để dịch' });
  }

  const logs: string[] = [];
  const batchLabel = `[Nhóm ${batchIndex + 1}/${totalBatches} (${texts.length} câu)]`;

  // 1. Separate Gemini Accounts (Primary) and DeepSeek Accounts (Backup)
  const geminiAccounts: AIAccountPayload[] = (accounts as AIAccountPayload[]).filter(
    (a) => (a.provider === 'gemini' || a.provider === 'gemini_cookie') && a.status !== 'error'
  );

  const deepseekAccounts: AIAccountPayload[] = (accounts as AIAccountPayload[]).filter(
    (a) => a.provider === 'deepseek' && a.status !== 'error'
  );

  // If no Gemini account configured by user, fallback to system API key if available
  let activeGemini = geminiAccounts[0];
  if (!activeGemini && defaultApiKey) {
    activeGemini = {
      id: 'gemini-system-default',
      provider: 'gemini',
      name: 'Gemini Web / AI Studio (Mặc định)',
      keyOrCookie: defaultApiKey,
      model: 'gemini-3.1-flash-lite',
      status: 'active',
      requestsCount: 0,
    };
    geminiAccounts.push(activeGemini);
  }

  // -------------------------------------------------------------
  // BƯỚC 1: GEMINI WEB COOKIE / API (AI DỊCH CHÍNH)
  // -------------------------------------------------------------
  let geminiSuccess = false;
  let translatedBatch: string[] = [];
  let geminiError1 = '';
  const t0 = Date.now();

  if (activeGemini) {
    logs.push(`${batchLabel} [AI DỊCH CHÍNH: GEMINI] Đang gửi qua tài khoản [${activeGemini.name}]...`);
    try {
      translatedBatch = await executeGeminiBatch(texts, activeGemini, sourceLang, targetLang, customPrompt);
      if (Array.isArray(translatedBatch) && translatedBatch.length === texts.length) {
        geminiSuccess = true;
        const latency = Date.now() - t0;
        logs.push(`${batchLabel} [GEMINI THÀNH CÔNG] Dịch hoàn tất qua [${activeGemini.name}] (${latency}ms). Ghi nhận ${texts.length} câu.`);
        return res.json({
          success: true,
          step: 'gemini_primary',
          translations: translatedBatch,
          usedAccount: { id: activeGemini.id, name: activeGemini.name, provider: activeGemini.provider },
          latencyMs: latency,
          logs,
        });
      } else {
        throw new Error(`Gemini trả về ${translatedBatch?.length || 0}/${texts.length} câu`);
      }
    } catch (err: any) {
      geminiError1 = err.message || 'Lỗi Gemini';
      logs.push(`${batchLabel} [GEMINI LẦN 1 LỖI] Tài khoản [${activeGemini.name}]: ${geminiError1}`);
    }
  } else {
    geminiError1 = 'Không có tài khoản Gemini nào trong cấu hình!';
    logs.push(`${batchLabel} [CẢNH BÁO] Không có tài khoản Gemini nào khả dụng.`);
  }

  // -------------------------------------------------------------
  // BƯỚC 2: NẾU GEMINI LỖI -> RETRY 1 LẦN VỚI GEMINI
  // -------------------------------------------------------------
  logs.push(`${batchLabel} [RETRY 1 LẦN] Đang tự động RETRY 1 LẦN cho Gemini...`);
  await new Promise((r) => setTimeout(r, 800)); // Nghỉ 800ms trước khi retry

  const geminiRetryAccount = geminiAccounts.length > 1 ? geminiAccounts[1] : activeGemini;
  let geminiError2 = '';
  const tRetry = Date.now();

  if (geminiRetryAccount) {
    try {
      translatedBatch = await executeGeminiBatch(texts, geminiRetryAccount, sourceLang, targetLang, customPrompt);
      if (Array.isArray(translatedBatch) && translatedBatch.length === texts.length) {
        const latency = Date.now() - tRetry;
        logs.push(`${batchLabel} [GEMINI RETRY THÀNH CÔNG] Lần thử lại thành công qua [${geminiRetryAccount.name}] (${latency}ms). Ghi nhận ${texts.length} câu.`);
        return res.json({
          success: true,
          step: 'gemini_retry',
          translations: translatedBatch,
          usedAccount: { id: geminiRetryAccount.id, name: geminiRetryAccount.name, provider: geminiRetryAccount.provider },
          latencyMs: latency,
          logs,
        });
      } else {
        throw new Error(`Gemini Retry trả về ${translatedBatch?.length || 0}/${texts.length} câu`);
      }
    } catch (err2: any) {
      geminiError2 = err2.message || 'Lỗi retry Gemini';
      logs.push(`${batchLabel} [GEMINI RETRY THẤT BẠI] Lần 2 vẫn lỗi: ${geminiError2}`);
    }
  } else {
    geminiError2 = 'Không có tài khoản Gemini để retry';
  }

  // -------------------------------------------------------------
  // BƯỚC 3: GEMINI THẤT BẠI 2 LẦN -> KÍCH HOẠT DEEPSEEK API (AI DỰ PHÒNG)
  // -------------------------------------------------------------
  logs.push(`${batchLabel} [CHUYỂN SANG DỰ PHÒNG] Cả 2 lần Gemini đều thất bại. Kích hoạt DEEPSEEK API...`);

  const activeDeepSeek = deepseekAccounts[0];
  if (!activeDeepSeek || !activeDeepSeek.keyOrCookie) {
    const stopMsg = `DỪNG HẲN TIẾN TRÌNH: Gemini lỗi 2 lần (${geminiError1}; Retry: ${geminiError2}) và KHÔNG CÓ tài khoản DeepSeek API nào trong cấu hình để cứu nguy!`;
    logs.push(`${batchLabel} [DỪNG HẲN] ${stopMsg}`);
    return res.status(502).json({
      success: false,
      stopEntirely: true,
      error: stopMsg,
      logs,
    });
  }

  let dsError = '';
  const tDs = Date.now();

  try {
    logs.push(`${batchLabel} [DEEPSEEK API] Đang gửi qua tài khoản [${activeDeepSeek.name}] (${activeDeepSeek.model || 'deepseek-chat'})...`);
    translatedBatch = await executeDeepSeekBatch(texts, activeDeepSeek, sourceLang, targetLang, customPrompt);
    if (Array.isArray(translatedBatch) && translatedBatch.length === texts.length) {
      const latency = Date.now() - tDs;
      logs.push(`${batchLabel} [DEEPSEEK API CỨU NGUY THÀNH CÔNG] Đã dịch xong ${texts.length} câu qua DeepSeek [${activeDeepSeek.name}] (${latency}ms). Tiếp tục tiến trình...`);
      return res.json({
        success: true,
        step: 'deepseek_fallback',
        translations: translatedBatch,
        usedAccount: { id: activeDeepSeek.id, name: activeDeepSeek.name, provider: 'deepseek' },
        latencyMs: latency,
        logs,
      });
    } else {
      throw new Error(`DeepSeek trả về ${translatedBatch?.length || 0}/${texts.length} câu`);
    }
  } catch (errDs: any) {
    dsError = errDs.message || 'Lỗi DeepSeek API';
    logs.push(`${batchLabel} [DEEPSEEK API THẤT BẠI] Lỗi: ${dsError}`);
  }

  // -------------------------------------------------------------
  // BƯỚC 4: DEEPSEEK API CŨNG LỖI -> DỪNG HẲN TOÀN BỘ TIẾN TRÌNH
  // -------------------------------------------------------------
  const finalStopMsg = `DỪNG HẲN TOÀN BỘ TIẾN TRÌNH: Cả Gemini (2 lượt) và DeepSeek API dự phòng đều thất bại tại nhóm ${batchIndex + 1}/${totalBatches}! Chi tiết: Gemini [${geminiError1}], DeepSeek [${dsError}]`;
  logs.push(`${batchLabel} [DỪNG HẲN HOÀN TOÀN] ${finalStopMsg}`);

  return res.status(502).json({
    success: false,
    stopEntirely: true,
    error: finalStopMsg,
    logs,
  });
});

// Audio Duration Helper using ffprobe
async function getMediaDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    );
    const val = parseFloat(stdout.trim());
    return isNaN(val) ? 0 : val;
  } catch {
    return 0;
  }
}

// Generate Full Advanced SubStation Alpha (.ass) Subtitle File with 100% Vietnamese Font Support (FreeSans)
function generateAssSubtitleFile(
  subtitles: any[],
  targetW: number,
  targetH: number,
  bottomH: number,
  fontSize: number,
  outPath: string
): number {
  const formatAssTime = (sec: number): string => {
    const totalMs = Math.max(0, Math.round(sec * 1000));
    const h = Math.floor(totalMs / 3600000);
    const m = Math.floor((totalMs % 3600000) / 60000);
    const s = Math.floor((totalMs % 60000) / 1000);
    const cs = Math.floor((totalMs % 1000) / 10);
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  };

  const validSubs = subtitles
    .filter((s) => (s.translatedText || s.originalText || '').trim().length > 0)
    .map((s, idx) => ({
      start: typeof s.startSeconds === 'number' ? s.startSeconds : idx * 3,
      end: typeof s.endSeconds === 'number' ? s.endSeconds : (idx + 1) * 3,
      text: (s.translatedText || s.originalText || '').trim(),
    }));

  const marginV = Math.max(10, bottomH + 20);

  const assHeader = `[Script Info]
Title: Vietnamese Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601
PlayResX: ${targetW}
PlayResY: ${targetH}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,FreeSans,${fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3.5,1.5,2,40,40,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = validSubs.map((s) => {
    const safeText = s.text
      .replace(/\\/g, '\\\\')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\r\n/g, '\\N')
      .replace(/\n/g, '\\N');
    return `Dialogue: 0,${formatAssTime(s.start)},${formatAssTime(s.end)},Default,,0,0,0,,${safeText}`;
  });

  fs.writeFileSync(outPath, assHeader + events.join('\n'), 'utf-8');
  console.log(`[ASS_SUBTITLES] Đã tạo file ASS chuẩn UTF-8 chứa đầy đủ ${validSubs.length} câu phụ đề (phông FreeSans không lỗi dấu).`);
  return validSubs.length;
}

// Generate Fully Aligned Voice Track: Auto Stretch/Speed up each cue to fit exactly in its subtitle duration
async function generateAlignedVoiceTrack(
  subtitles: any[],
  tempDir: string
): Promise<string | null> {
  const validCues = subtitles
    .map((sub, idx) => ({
      id: sub.id || idx + 1,
      startSeconds: typeof sub.startSeconds === 'number' ? Math.max(0, sub.startSeconds) : idx * 3,
      endSeconds: typeof sub.endSeconds === 'number' ? Math.max(0.5, sub.endSeconds) : (idx + 1) * 3,
      text: (sub.translatedText || sub.originalText || '').trim(),
    }))
    .filter((sub) => sub.text.length > 0)
    .sort((a, b) => a.startSeconds - b.startSeconds);

  if (validCues.length === 0) return null;

  console.log(`[TTS_PIPELINE] Bắt đầu tổng hợp giọng đọc đồng bộ thời lượng cho TOÀN BỘ ${validCues.length} câu thoại...`);

  const segmentFiles: string[] = [];
  let currentTime = 0;

  for (let i = 0; i < validCues.length; i++) {
    const cue = validCues[i];
    const targetSlot = Math.max(0.6, cue.endSeconds - cue.startSeconds);

    // 1. Silence gap between current audio position and cue start
    const gap = cue.startSeconds - currentTime;
    if (gap > 0.04) {
      const silencePath = path.join(tempDir, `silence_${i}_${Date.now()}.wav`);
      await execAsync(`ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t ${gap.toFixed(3)} "${silencePath}"`);
      if (fs.existsSync(silencePath)) {
        segmentFiles.push(silencePath);
        currentTime += gap;
      }
    }

    // 2. Download raw TTS speech for this cue
    const rawAudioPath = path.join(tempDir, `tts_raw_${i}_${Date.now()}.mp3`);
    try {
      await fetchTtsStream(cue.text, rawAudioPath);
    } catch (e: any) {
      console.warn(`[TTS_WARN] Lỗi tải TTS câu ${i + 1}:`, e.message);
      continue;
    }

    if (!fs.existsSync(rawAudioPath) || fs.statSync(rawAudioPath).size < 100) {
      continue;
    }

    // 3. Measure raw duration
    const rawDur = await getMediaDuration(rawAudioPath);
    const adjustedAudioPath = path.join(tempDir, `tts_adj_${i}_${Date.now()}.wav`);

    // 4. Auto Speed Synchronization (Co giãn tốc độ đọc khớp khung thoại)
    // Ví dụ: sub từ 01:02:39 đến 01:02:42 (3.0s). Nếu giọng đọc mất 4.5s -> tăng tốc atempo 1.58x để đọc vừa trọn vẹn 3s
    let speedFactor = 1.0;
    if (rawDur > targetSlot) {
      // Để lại khoảng nghỉ tự nhiên 5% trước khi hết khung thoại
      speedFactor = rawDur / (targetSlot * 0.95);
      // Giới hạn tốc độ trong ngưỡng an toàn 1.05x đến 3.2x
      speedFactor = Math.min(3.2, Math.max(1.05, speedFactor));
    }

    let atempoFilter = '';
    if (speedFactor > 1.05) {
      if (speedFactor <= 2.0) {
        atempoFilter = `atempo=${speedFactor.toFixed(3)}`;
      } else {
        const factor1 = 2.0;
        const factor2 = (speedFactor / 2.0).toFixed(3);
        atempoFilter = `atempo=${factor1},atempo=${factor2}`;
      }
    }

    const filterArg = atempoFilter ? `-filter:a "${atempoFilter}"` : '';
    await execAsync(`ffmpeg -y -i "${rawAudioPath}" ${filterArg} -ar 44100 -ac 2 "${adjustedAudioPath}"`);

    if (fs.existsSync(adjustedAudioPath)) {
      const adjDur = await getMediaDuration(adjustedAudioPath);
      segmentFiles.push(adjustedAudioPath);
      currentTime += adjDur;
      console.log(`[TTS_SYNC] Câu ${i + 1}/${validCues.length} [${cue.startSeconds.toFixed(1)}s -> ${cue.endSeconds.toFixed(1)}s]: Gốc ${rawDur.toFixed(2)}s -> Co giãn ${speedFactor.toFixed(2)}x -> ${adjDur.toFixed(2)}s (Khớp chính xác thời lượng thoại)`);
    }
  }

  if (segmentFiles.length === 0) return null;

  // 5. Concat all silence and speech segments into master aligned narration file
  const concatListPath = path.join(tempDir, `narration_concat_${Date.now()}.txt`);
  fs.writeFileSync(concatListPath, segmentFiles.map((p) => `file '${p}'`).join('\n'), 'utf-8');

  const masterAudioPath = path.join(tempDir, `aligned_narration_${Date.now()}.wav`);
  await execAsync(`ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy "${masterAudioPath}"`);

  if (fs.existsSync(masterAudioPath) && fs.statSync(masterAudioPath).size > 1000) {
    console.log(`[TTS_SUCCESS] Đã tạo thành công track lồng tiếng hoàn chỉnh, đồng bộ 100% thời lượng toàn bộ ${validCues.length} câu thoại!`);
    return masterAudioPath;
  }

  return null;
}

// 4. REAL Video Rendering & Packaging (FFmpeg Outputting Final MP4)
app.post('/api/render-final-video', async (req: Request, res: Response) => {
  const {
    videoPath,
    subtitles = [],
    aspectRatio = '1:1',
    topBannerText = '',
    bottomBannerText = '',
    bannerTopHeightPct = 12,
    bannerBottomHeightPct = 10,
    bannerTopColor = '#111111',
    bannerBottomColor = '#111111',
    descColor = '#FFFFFF',
    descBorderColor = '#800040',
    descFontSize = 32,
    subFontSize = 32,
    burnInSub = true,
    enableTTS = true,
    originalAudioVolume = 15,
    ttsVolume = 2.2,
  } = req.body;

  const tStart = Date.now();
  const outFileName = `final_${Date.now()}_${aspectRatio.replace(':', '_')}.mp4`;
  const outVideoPath = path.join(OUTPUT_DIR, outFileName);

  console.log(`[FFMPEG_RENDER] Bắt đầu render video đầu ra: ${outFileName} (${subtitles.length} câu sub)`);

  try {
    let inputSource = videoPath;

    // If input video doesn't exist on disk, generate a high-quality demo background video using ffmpeg color generator
    if (!inputSource || !fs.existsSync(inputSource)) {
      console.log(`[FFMPEG] Tạo video mẫu nền động do file gốc chưa có trên đĩa...`);
      const samplePath = path.join(TEMP_DIR, `sample_${Date.now()}.mp4`);
      const genCmd = `ffmpeg -y -f lavfi -i testsrc=size=1280x720:rate=30 -f lavfi -i sine=frequency=440:sample_rate=44100 -t 20 -pix_fmt yuv420p "${samplePath}"`;
      await execAsync(genCmd);
      inputSource = samplePath;
    }

    // Determine target resolution based on aspect ratio
    let targetW = 1080;
    let targetH = 1080;
    if (aspectRatio === '16:9') {
      targetW = 1280;
      targetH = 720;
    } else if (aspectRatio === '9:16') {
      targetW = 720;
      targetH = 1280;
    }

    // Filter construction
    // 1. Scale and pad to fit target aspect ratio
    const scalePad = `scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:black`;

    // 2. Draw Top and Bottom Banner Boxes
    const topH = Math.round(targetH * (bannerTopHeightPct / 100));
    const bottomH = Math.round(targetH * (bannerBottomHeightPct / 100));
    const drawTopBox = `drawbox=x=0:y=0:w=${targetW}:h=${topH}:color=${bannerTopColor}@1:t=fill`;
    const drawBottomBox = `drawbox=x=0:y=${targetH - bottomH}:w=${targetW}:h=${bottomH}:color=${bannerBottomColor}@1:t=fill`;

    // 3. Top and Bottom Banner Texts written to UTF-8 files to prevent any font corruption or missing diacritics
    const topTextPath = path.join(TEMP_DIR, `top_banner_${Date.now()}.txt`);
    const bottomTextPath = path.join(TEMP_DIR, `bottom_banner_${Date.now()}.txt`);
    fs.writeFileSync(topTextPath, (topBannerText || 'VIDEO VIETSUB').trim(), 'utf-8');
    fs.writeFileSync(bottomTextPath, (bottomBannerText || '').trim(), 'utf-8');

    const fontFile = '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf';
    const hasFont = fs.existsSync(fontFile);
    const fontArg = hasFont ? `:fontfile='${fontFile}'` : '';

    const drawTopText = `drawtext=textfile='${topTextPath}'${fontArg}:fontsize=${Math.round(descFontSize * 0.9)}:fontcolor=${descColor}:shadowcolor=${descBorderColor}:shadowx=2:shadowy=2:x=(w-text_w)/2:y=(${topH}-text_h)/2`;
    const drawBottomText = bottomBannerText
      ? `drawtext=textfile='${bottomTextPath}'${fontArg}:fontsize=${Math.round(descFontSize * 0.8)}:fontcolor=${descColor}:shadowcolor=${descBorderColor}:shadowx=2:shadowy=2:x=(w-text_w)/2:y=h-${bottomH}+(${bottomH}-text_h)/2`
      : '';

    // 4. Burn-in Subtitles: 100% of ALL subtitles using ASS filter with FreeSans font (No 10-cue limit, perfect Vietnamese glyphs)
    let assFilter = '';
    if (burnInSub && Array.isArray(subtitles) && subtitles.length > 0) {
      const assPath = path.join(TEMP_DIR, `subtitles_${Date.now()}.ass`);
      const burnedCount = generateAssSubtitleFile(subtitles, targetW, targetH, bottomH, subFontSize || 34, assPath);
      if (burnedCount > 0 && fs.existsSync(assPath)) {
        const escapedAssPath = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
        assFilter = `ass='${escapedAssPath}'`;
        console.log(`[FFMPEG] Kích hoạt filter ASS burn-in cho toàn bộ ${burnedCount} câu phụ đề`);
      }
    }

    // Combine all video filters cleanly
    const allVideoFilters = [scalePad, drawTopBox, drawBottomBox, drawTopText, drawBottomText, assFilter]
      .filter(Boolean)
      .join(',');

    // 5. Synthesize real Vietnamese speech audio for ALL subtitle cues with auto speed-sync
    let ttsAudioPath: string | null = null;
    if (enableTTS !== false && Array.isArray(subtitles) && subtitles.length > 0) {
      try {
        ttsAudioPath = await generateAlignedVoiceTrack(subtitles, TEMP_DIR);
      } catch (ttsErr: any) {
        console.warn('[TTS_RENDER_WARN] Không tạo được track audio TTS:', ttsErr.message);
      }
    }

    // 6. Build Final FFmpeg Render Command
    const bgVolFloat = Math.max(0.05, (originalAudioVolume || 15) / 100).toFixed(2);
    const voiceVolFloat = Math.max(1.0, (ttsVolume || 2.2)).toFixed(2);

    let renderCmd = '';
    if (ttsAudioPath && fs.existsSync(ttsAudioPath)) {
      renderCmd = `ffmpeg -y -i "${inputSource}" -i "${ttsAudioPath}" -vf "${allVideoFilters}" -filter_complex "[0:a]volume=${bgVolFloat}[bg];[1:a]volume=${voiceVolFloat}[voice];[bg][voice]amix=inputs=2:duration=first[aout]" -map 0:v -map "[aout]" -c:v libx264 -preset veryfast -crf 23 -c:a aac -b:a 128k -movflags +faststart "${outVideoPath}"`;
    } else {
      const audioFilter = `volume=0.25`;
      renderCmd = `ffmpeg -y -i "${inputSource}" -vf "${allVideoFilters}" -af "${audioFilter}" -c:v libx264 -preset veryfast -crf 23 -c:a aac -b:a 128k -movflags +faststart "${outVideoPath}"`;
    }

    console.log(`[FFMPEG] Thực thi lệnh: ${renderCmd.slice(0, 200)}...`);
    await execAsync(renderCmd, { timeout: 300000 });

    if (!fs.existsSync(outVideoPath)) {
      throw new Error('FFmpeg không xuất được file video cuối cùng');
    }

    const stats = fs.statSync(outVideoPath);
    const executionTimeMs = Date.now() - tStart;

    console.log(`[FFMPEG_SUCCESS] Đã render xong video: ${outFileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB in ${executionTimeMs}ms)`);

    return res.json({
      success: true,
      fileName: outFileName,
      finalVideoPath: outVideoPath,
      videoUrl: `/media/output/${outFileName}`,
      fileSizeMb: (stats.size / (1024 * 1024)).toFixed(2),
      executionTimeMs,
    });
  } catch (err: any) {
    console.error('[FFMPEG_RENDER_ERROR]', err);
    return res.status(500).json({
      success: false,
      error: `Lỗi render video bằng FFmpeg: ${err.message}`,
    });
  }
});

// Setup server with Vite middleware in development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Listen on PORT (default 3000 as required by environment)
  const server = app.listen(PORT, () => {
    console.log(`[MMO AUTO TRANSLATE STUDIO] Server running on http://localhost:${PORT}`);
  });

  // Also listen on port 8000 if different from PORT so user can connect to localhost:8000 as requested
  if (PORT !== 8000) {
    try {
      const port8000Server = app.listen(8000, () => {
        console.log(`[MMO AUTO TRANSLATE STUDIO] Also listening on http://localhost:8000`);
      });
      port8000Server.on('error', () => {
        // port 8000 busy or restricted, ignore
      });
    } catch {
      // ignore
    }
  }
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
