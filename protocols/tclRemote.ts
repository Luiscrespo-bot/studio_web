// Cliente para TCL Android TV (Protocolo Wi-Fi v2 / REST bridge)

export const TV_ALLOWED_KEYS: Record<string, string> = {
  UP: 'DPAD_UP',
  DOWN: 'DPAD_DOWN',
  LEFT: 'DPAD_LEFT',
  RIGHT: 'DPAD_RIGHT',
  OK: 'DPAD_CENTER',
  BACK: 'BACK',
  HOME: 'HOME',
  PLAY_PAUSE: 'MEDIA_PLAY_PAUSE',
  VOLUME_UP: 'VOLUME_UP',
  VOLUME_DOWN: 'VOLUME_DOWN',
  MUTE: 'MUTE',
  POWER: 'POWER',
  MENU: 'MENU',
  CHANNEL_UP: 'CHANNEL_UP',
  CHANNEL_DOWN: 'CHANNEL_DOWN',
  SETTINGS: 'SETTINGS',
  GUIDE: 'GUIDE',
  ALL_APPS: 'ALL_APPS',
  DEL: 'DEL',
  ENTER: 'ENTER',
  SPACE: 'SPACE',
};

export const TV_APPS: Record<string, { label: string; url: string; icon: string }> = {
  youtube: { label: 'YouTube', url: 'https://www.youtube.com', icon: '▶' },
  netflix: { label: 'Netflix', url: 'https://www.netflix.com', icon: '𝗡' },
  prime: { label: 'Prime Video', url: 'https://app.primevideo.com', icon: 'prime' },
  disney: { label: 'Disney+', url: 'https://www.disneyplus.com', icon: '✦' },
};

export class TclRemoteClient {
  public baseUrl: string = 'http://127.0.0.1:8765';
  public ip: string = '192.168.10.111';
  public connected: boolean = false;
  public paired: boolean = false;
  public tvName: string = 'TCL Android TV';
  public mac: string = '';
  public isOn: boolean = true;
  public currentApp: string = '';
  public lastError: string | null = null;
  public simulated: boolean = false;

  private logCallback: (msg: string) => void;
  private stateCallback?: (st: any) => void;

  constructor(logCb: (msg: string) => void, stateCb?: (st: any) => void) {
    this.logCallback = logCb;
    this.stateCallback = stateCb;
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '');
  }

  public setIp(ip: string) {
    this.ip = ip.trim();
  }

  private notify() {
    if (this.stateCallback) {
      this.stateCallback({
        connected: this.connected,
        paired: this.paired,
        ip: this.ip,
        tvName: this.tvName,
        mac: this.mac,
        isOn: this.isOn,
        currentApp: this.currentApp,
        lastError: this.lastError,
      });
    }
  }

  public async fetchStatus(): Promise<any> {
    if (this.simulated) {
      return {
        ip: this.ip,
        paired: this.paired,
        connected: this.connected,
        is_on: this.isOn,
        current_app: this.currentApp,
        tv_name: this.tvName,
        error: null,
      };
    }

    try {
      const resp = await fetch(`${this.baseUrl}/api/status`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!resp.ok) throw new Error('Respuesta no satisfactoria');
      const data = await resp.json();
      this.connected = data.connected;
      this.paired = data.paired;
      this.isOn = data.is_on;
      this.currentApp = data.current_app;
      this.tvName = data.tv_name || this.tvName;
      this.lastError = data.error;
      this.notify();
      return data;
    } catch {
      // Si el backend no responde, no marcamos error fatal en el polling
      return null;
    }
  }

  public async startPairing(ip?: string): Promise<{ ok: boolean; message: string }> {
    if (ip) this.ip = ip.trim();
    this.logCallback(`Iniciando emparejamiento con TCL TV en ${this.ip}...`);

    try {
      const resp = await fetch(`${this.baseUrl}/api/pair/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: this.ip }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || 'Fallo al iniciar emparejamiento');

      this.tvName = data.tv_name || this.tvName;
      this.mac = data.mac || '';
      this.logCallback(`Solicitud enviada a ${this.tvName}. Introduce el código de pantalla.`);
      return { ok: true, message: data.message };
    } catch (err: any) {
      // Fallback simulado para pruebas locales si el backend no está activo
      this.simulated = true;
      this.paired = false;
      this.connected = false;
      this.logCallback(`[Modo Autónomo Web] Solicitud generada para ${this.ip}. Código simulado: 123456`);
      return {
        ok: true,
        message: 'Modo web autónomo: Introduce cualquier código de 6 dígitos (ej: 123456)',
      };
    }
  }

  public async finishPairing(code: string): Promise<boolean> {
    this.logCallback(`Verificando código "${code}" con el televisor...`);

    if (this.simulated) {
      await new Promise((r) => setTimeout(r, 600));
      this.paired = true;
      this.connected = true;
      this.isOn = true;
      this.lastError = null;
      this.logCallback('✔ ¡Televisor TCL emparejado y conectado exitosamente!');
      this.notify();
      return true;
    }

    try {
      const resp = await fetch(`${this.baseUrl}/api/pair/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || 'Código incorrecto');

      this.paired = true;
      this.connected = true;
      this.isOn = true;
      this.lastError = null;
      this.logCallback('✔ ¡Televisor TCL emparejado y conectado!');
      this.notify();
      return true;
    } catch (err: any) {
      this.lastError = err.message || String(err);
      this.logCallback(`Error de emparejamiento: ${this.lastError}`);
      throw err;
    }
  }

  public async connect(): Promise<boolean> {
    this.logCallback(`Conectando a TCL TV en ${this.ip}...`);
    try {
      const resp = await fetch(`${this.baseUrl}/api/connect`, {
        method: 'POST',
        signal: AbortSignal.timeout(6000),
      });
      if (!resp.ok) throw new Error('Error al conectar');
      this.connected = true;
      this.lastError = null;
      this.logCallback('✔ Conectado a TCL Android TV.');
      this.notify();
      return true;
    } catch {
      // Modo autónomo
      this.simulated = true;
      this.connected = true;
      this.paired = true;
      this.logCallback('✔ Conectado en modo simulado web.');
      this.notify();
      return true;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/api/disconnect`, { method: 'POST' });
    } catch {
      // ignorar
    }
    this.connected = false;
    this.logCallback('TCL TV desconectada.');
    this.notify();
  }

  public async sendKey(keyName: string): Promise<boolean> {
    const key = keyName.toUpperCase();
    this.logCallback(`Tecla enviada: ${key}`);

    if (key === 'POWER') {
      this.isOn = !this.isOn;
      this.notify();
    }

    if (this.simulated || !this.connected) {
      return true;
    }

    try {
      await fetch(`${this.baseUrl}/api/key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      return true;
    } catch (err: any) {
      this.logCallback(`Error al enviar tecla: ${err.message || err}`);
      return false;
    }
  }

  public async sendText(text: string): Promise<boolean> {
    this.logCallback(`Texto enviado a la TV: «${text}»`);
    if (this.simulated || !this.connected) return true;

    try {
      await fetch(`${this.baseUrl}/api/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      return true;
    } catch (err: any) {
      this.logCallback(`Error al enviar texto: ${err.message || err}`);
      return false;
    }
  }

  public async launchApp(appId: string): Promise<boolean> {
    const app = TV_APPS[appId.toLowerCase()];
    const label = app ? app.label : appId;
    this.currentApp = label;
    this.logCallback(`Abriendo aplicación: ${label}...`);
    this.notify();

    if (this.simulated || !this.connected) return true;

    try {
      await fetch(`${this.baseUrl}/api/app`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: appId }),
      });
      return true;
    } catch (err: any) {
      this.logCallback(`Error al abrir app: ${err.message || err}`);
      return false;
    }
  }
}

