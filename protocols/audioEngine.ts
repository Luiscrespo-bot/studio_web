// Motor de Audio Reactivo usando Web Audio API + AnalyserNode (FFT)
import { LedStripManager } from './ledStrip';

export class WebAudioEngine {
  private led: LedStripManager;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private animId: number | null = null;

  public active: boolean = false;
  public gain: number = 3.0;
  public mode: 'freq' | 'beat' = 'freq';
  private hue: number = 0;
  private bassAvg: number = 0;
  private lastBeat: number = 0;
  private frameCount: number = 0;
  private sendEvery: number = 4; // cada ~80-100 ms

  public onLevelUpdate?: (level: number) => void;
  public onSpectrumUpdate?: (data: Uint8Array) => void;
  private logCallback: (msg: string) => void;

  constructor(led: LedStripManager, logCb: (msg: string) => void) {
    this.led = led;
    this.logCallback = logCb;
  }

  public async getAudioDevices(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [];
    }
    const devs = await navigator.mediaDevices.enumerateDevices();
    return devs.filter((d) => d.kind === 'audioinput');
  }

  public async start(deviceId?: string): Promise<boolean> {
    if (this.active) {
      this.stop();
    }

    try {
      this.logCallback('Iniciando captura de micrófono para audio reactivo...');
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        video: false,
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;

      this.source = this.audioCtx.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);

      this.active = true;
      this.hue = 0;
      this.bassAvg = 0;
      this.lastBeat = 0;
      this.frameCount = 0;

      this.led.setStripMic(false); // apagar mic interno
      this.logCallback(`✔ Audio reactivo activo (Modo: ${this.mode}, Ganancia: ${this.gain})`);

      this.loop();
      return true;
    } catch (err: any) {
      this.active = false;
      this.logCallback(`Error al iniciar audio: ${err.message || err}`);
      return false;
    }
  }

  public stop() {
    this.active = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    if (this.onLevelUpdate) {
      this.onLevelUpdate(0);
    }
    this.logCallback('Audio reactivo detenido.');
  }

  private loop = () => {
    if (!this.active || !this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    if (this.onSpectrumUpdate) {
      this.onSpectrumUpdate(dataArray);
    }

    // Calcular volumen promedio en rango audible
    let sum = 0;
    const sampleRate = this.audioCtx?.sampleRate || 44100;
    const binSize = (sampleRate / 2) / bufferLength;

    const minBin = Math.floor(40 / binSize);
    const maxBin = Math.min(bufferLength - 1, Math.floor(4000 / binSize));
    let binCount = 0;

    let maxMag = 0;
    let dominantBin = minBin;

    for (let i = minBin; i <= maxBin; i++) {
      const val = dataArray[i];
      sum += val;
      binCount++;
      if (val > maxMag) {
        maxMag = val;
        dominantBin = i;
      }
    }

    const avgMag = binCount > 0 ? sum / binCount : 0;
    const level = Math.min(1.0, (avgMag / 255.0) * this.gain);

    if (this.onLevelUpdate) {
      this.onLevelUpdate(level);
    }

    // Análisis de bajos (40 - 200 Hz)
    const bassMaxBin = Math.min(bufferLength - 1, Math.floor(200 / binSize));
    let bassSum = 0;
    let bassCount = 0;
    for (let i = minBin; i <= bassMaxBin; i++) {
      bassSum += dataArray[i];
      bassCount++;
    }
    const bassAvg = bassCount > 0 ? bassSum / bassCount / 255.0 : 0;

    if (this.mode === 'freq') {
      const domFreq = dominantBin * binSize;
      const f = Math.max(60, Math.min(domFreq, 4000));
      const targetHue = (270.0 * Math.log(f / 60.0)) / Math.log(4000.0 / 60.0);
      this.hue += (targetHue - this.hue) * 0.35;
    } else {
      // Modo Beat
      const now = performance.now();
      if (bassAvg > this.bassAvg * 1.35 && bassAvg > 0.08 && now - this.lastBeat > 180) {
        this.hue = (this.hue + 47.0) % 360;
        this.lastBeat = now;
      }
    }
    this.bassAvg = this.bassAvg * 0.95 + bassAvg * 0.05;

    this.frameCount++;
    if (this.frameCount % this.sendEvery === 0) {
      const bVal = Math.max(5, Math.min(1000, Math.round(1000 * Math.pow(level, 0.8))));
      this.led.setColorHsv(this.hue % 360, 1.0, true);
      this.led.setBrightness(bVal, true);
    }

    this.animId = requestAnimationFrame(this.loop);
  };
}

