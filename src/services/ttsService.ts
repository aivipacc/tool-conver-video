// Real Natural Vietnamese TTS audio service with punctuation and tone support

export class TTSService {
  private static currentAudio: HTMLAudioElement | null = null;

  public static speak(
    text: string,
    rate: number = 1.0,
    onEnd?: () => void,
    onError?: () => void
  ): () => void {
    this.stop();

    if (!text || !text.trim()) {
      if (onEnd) onEnd();
      return () => {};
    }

    try {
      const audioUrl = `/api/tts-audio?text=${encodeURIComponent(text.trim())}`;
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;
      audio.playbackRate = Math.max(0.5, Math.min(2.0, rate));

      audio.onended = () => {
        if (onEnd) onEnd();
        this.currentAudio = null;
      };

      audio.onerror = () => {
        // Fallback to browser SpeechSynthesis if network issue
        this.fallbackBrowserSpeech(text, rate, onEnd, onError);
      };

      audio.play().catch(() => {
        this.fallbackBrowserSpeech(text, rate, onEnd, onError);
      });

      return () => {
        audio.pause();
        audio.currentTime = 0;
        this.currentAudio = null;
      };
    } catch {
      this.fallbackBrowserSpeech(text, rate, onEnd, onError);
      return () => this.stop();
    }
  }

  public static stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  private static fallbackBrowserSpeech(
    text: string,
    rate: number = 1.0,
    onEnd?: () => void,
    onError?: () => void
  ) {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      if (onEnd) onEnd();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.lang = 'vi-VN';

      const voices = window.speechSynthesis.getVoices();
      const viVoice = voices.find(
        (v) =>
          v.lang.includes('vi') ||
          v.name.toLowerCase().includes('vietnam') ||
          v.name.toLowerCase().includes('an')
      );
      if (viVoice) utterance.voice = viVoice;

      utterance.onend = () => {
        if (onEnd) onEnd();
      };
      utterance.onerror = () => {
        if (onError) onError();
        if (onEnd) onEnd();
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      if (onEnd) onEnd();
      if (onError) onError();
    }
  }
}

