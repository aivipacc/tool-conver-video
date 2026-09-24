import { SubtitleCue } from '../types';

export class SubtitleUtils {
  /**
   * Formats seconds into SRT timestamp: HH:MM:SS,mmm
   */
  public static secondsToSrtTime(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = Math.floor((totalSeconds - Math.floor(totalSeconds)) * 1000);

    const pad = (num: number, size: number = 2) => String(num).padStart(size, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(milliseconds, 3)}`;
  }

  /**
   * Generates a standard SRT string from SubtitleCue items
   */
  public static generateSrt(cues: SubtitleCue[], useTranslated: boolean = true): string {
    return cues
      .map((cue, index) => {
        const text = useTranslated ? cue.translatedText || cue.originalText : cue.originalText;
        return `${index + 1}\n${cue.startTime} --> ${cue.endTime}\n${text.trim()}\n`;
      })
      .join('\n');
  }

  /**
   * Trigger browser file download
   */
  public static downloadFile(content: string, filename: string, mimeType: string = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Applies character per line and max lines constraint
   */
  public static wrapSubtitleText(text: string, charLimit: number = 20, maxLines: number = 1): string {
    if (!text) return '';
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + (currentLine ? ' ' : '') + word).length <= charLimit) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    if (maxLines > 0 && lines.length > maxLines) {
      return lines.slice(0, maxLines).join('\n');
    }
    return lines.join('\n');
  }
}
