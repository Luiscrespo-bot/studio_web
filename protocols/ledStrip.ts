// Driver de Tira LED Bluetooth (Protocolo Miracles Star)
// Formato del paquete: BC | CMD | LEN | DATOS... | 55

export const LED_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
export const LED_TX_UUID = '0000fff3-0000-1000-8000-00805f9b34fb';
export const LED_RX_UUID = '0000fff4-0000-1000-8000-00805f9b34fb';

function be16(n: number): number[] {
  const val = Math.max(0, Math.min(65535, Math.round(n)));
  return [(val >> 8) & 0xff, val & 0xff];
}

export function makeLedPacket(cmd: number, data: number[]): Uint8Array {
  return new Uint8Array([0xbc, cmd, data.length, ...data, 0x55]);
}

export function hexToHsv(hex: string): { h: number; s: number } {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map((x) => x + x).join('');
  }
  const r = parseInt(c.slice(0, 2), 16) / 255.0;
  const g = parseInt(c.slice(2, 4), 16) / 255.0;
  const b = parseInt(c.slice(4, 6), 16) / 255.0;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;

  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s };
}

export class LedStripManager {
  private device: any = null;
  private server: any = null;
  private txChar: any = null;
  private rxChar: any = null;
  public connected: boolean = false;
  public deviceName: string = 'Tira LED';
  public address: string = '';
  public rxCount: number = 0;
  public busy: boolean = false;
  private logCallback: (msg: string) => void;
  private stateCallback?: (connected: boolean) => void;

  // Estado local para retroalimentación visual en pantalla
  public state = {
    power: true,
    colorHex: '#ff0000',
    brightness: 1000,
    speed: 50,
    stripMic: false,
    effect: 1,
    sensitivity: 50,
    mode: 1,
    ledCount: 30,
  };

  constructor(logCb: (msg: string) => void, stateCb?: (connected: boolean) => void) {
    this.logCallback = logCb;
    this.stateCallback = stateCb;
  }

  public isWebBluetoothAvailable(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  public async connect(): Promise<boolean> {
    if (!this.isWebBluetoothAvailable()) {
      throw new Error('Web Bluetooth no disponible en este navegador.');
    }

    try {
      this.logCallback('Buscando tira LED Bluetooth...');
      // @ts-ignore
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [LED_SERVICE_UUID, '0000fff0-0000-1000-8000-00805f9b34fb'],
      });

      this.deviceName = this.device.name || 'Tira LED';
      this.address = this.device.id || 'LED-BLE';

      this.device.addEventListener('gattserverdisconnected', () => {
        this.connected = false;
        this.txChar = null;
        this.rxChar = null;
        this.logCallback('⚠ Tira LED desconectada.');
        if (this.stateCallback) this.stateCallback(false);
      });

      this.logCallback(`Conectando a ${this.deviceName}...`);
      this.server = await this.device.gatt.connect();

      const service = await this.server.getPrimaryService(LED_SERVICE_UUID);
      this.txChar = await service.getCharacteristic(LED_TX_UUID);

      try {
        this.rxChar = await service.getCharacteristic(LED_RX_UUID);
        await this.rxChar.startNotifications();
        this.rxChar.addEventListener('characteristicvaluechanged', (event: any) => {
          this.rxCount++;
          const val = new Uint8Array(event.target.value.buffer);
          const hex = Array.from(val).map((b) => b.toString(16).padStart(2, '0')).join(' ');
          this.logCallback(`RX ← ${hex}`);
        });
        this.logCallback('Notificaciones RX activas.');
      } catch {
        this.logCallback('(Sin canal RX de notificaciones)');
      }

      this.connected = true;
      this.logCallback(`✔ Tira LED conectada: ${this.deviceName}`);
      if (this.stateCallback) this.stateCallback(true);
      return true;
    } catch (err: any) {
      this.connected = false;
      this.txChar = null;
      this.logCallback(`Error de conexión LED: ${err.message || err}`);
      if (this.stateCallback) this.stateCallback(false);
      throw err;
    }
  }

  public connectSimulated(name: string = 'LED-Virtual') {
    this.connected = true;
    this.deviceName = name;
    this.address = 'SIM-LED-01';
    this.logCallback(`✔ Conectado a Tira LED virtual: ${this.deviceName}`);
    if (this.stateCallback) this.stateCallback(true);
  }

  public async disconnect() {
    if (this.device && this.device.gatt && this.device.gatt.connected) {
      await this.device.gatt.disconnect();
    }
    this.connected = false;
    this.txChar = null;
    this.rxChar = null;
    this.logCallback('Tira LED desconectada.');
    if (this.stateCallback) this.stateCallback(false);
  }

  public async sendPacket(cmd: number, data: number[]): Promise<void> {
    const pkt = makeLedPacket(cmd, data);
    const hex = Array.from(pkt).map((b) => b.toString(16).padStart(2, '0')).join(' ');

    if (!this.connected) {
      this.logCallback('No conectado.');
      return;
    }

    if (this.txChar) {
      try {
        if (this.txChar.writeValueWithoutResponse) {
          await this.txChar.writeValueWithoutResponse(pkt);
        } else {
          await this.txChar.writeValue(pkt);
        }
        this.logCallback(`TX → ${hex}`);
      } catch (err: any) {
        this.logCallback(`Error TX LED: ${err.message || err}`);
      }
    } else {
      // Modo simulado
      this.logCallback(`TX [sim] → ${hex}`);
    }
  }

  public async sendFast(cmd: number, data: number[]): Promise<void> {
    if (!this.connected || this.busy) return;
    this.busy = true;
    try {
      const pkt = makeLedPacket(cmd, data);
      if (this.txChar) {
        if (this.txChar.writeValueWithoutResponse) {
          await this.txChar.writeValueWithoutResponse(pkt);
        } else {
          await this.txChar.writeValue(pkt);
        }
      }
    } catch {
      // descartar en audio rápido
    } finally {
      this.busy = false;
    }
  }

  // ── Comandos de Alto Nivel ────────────────────────────────────────────────

  public power(on: boolean) {
    this.state.power = on;
    this.sendPacket(0x01, [on ? 1 : 0]);
  }

  public setColorHex(hex: string) {
    this.state.colorHex = hex;
    const { h, s } = hexToHsv(hex);
    this.sendPacket(0x04, [...be16(h), ...be16(Math.round(s * 1000)), 0, 0]);
  }

  public setColorHsv(hue: number, sat: number, fast: boolean = false) {
    const data = [...be16(hue), ...be16(Math.round(sat * 1000)), 0, 0];
    if (fast) {
      this.sendFast(0x04, data);
    } else {
      this.sendPacket(0x04, data);
    }
  }

  public setBrightness(v: number, fast: boolean = false) {
    const b = Math.max(3, Math.min(1000, Math.round(v)));
    this.state.brightness = b;
    const data = [...be16(b), 0, 0, 0, 0];
    if (fast) {
      this.sendFast(0x05, data);
    } else {
      this.sendPacket(0x05, data);
    }
  }

  public setSpeed(v: number) {
    const s = Math.max(0, Math.min(100, Math.round(v)));
    this.state.speed = s;
    this.sendPacket(0x08, [s]);
  }

  public setMode(n: number) {
    this.state.mode = n;
    this.sendPacket(0x06, [Math.floor(n / 255), n % 255]);
  }

  public setLeds(n: number) {
    if (n >= 8 && n <= 300) {
      this.state.ledCount = n;
      this.sendPacket(0x03, be16(n));
    } else {
      this.logCallback('La cantidad de LEDs debe estar entre 8 y 300.');
    }
  }

  public setStripMic(on: boolean) {
    this.state.stripMic = on;
    this.sendPacket(0x0f, [on ? 1 : 0]);
  }

  public setEffect(fx: number) {
    this.state.effect = fx;
    this.sendPacket(0x11, [fx]);
  }

  public setSensitivity(v: number) {
    const s = Math.max(0, Math.min(100, Math.round(v)));
    this.state.sensitivity = s;
    this.sendPacket(0x12, [s]);
  }

  public sendRaw(hexStr: string) {
    try {
      const bytes = hexStr
        .trim()
        .split(/\s+/)
        .map((x) => parseInt(x, 16))
        .filter((x) => !isNaN(x));
      if (bytes.length > 0) {
        this.sendPacket(bytes[0], bytes.slice(1));
      }
    } catch (e: any) {
      this.logCallback(`Error formato Hex: ${e.message}`);
    }
  }

  // ── Prueba Técnica Completa ───────────────────────────────────────────────

  public async runTechnicalTest(
    onProgress: (frac: number, stepText: string) => void,
    isCancelled: () => boolean,
    opts: { modes?: boolean; mic?: boolean } = {}
  ): Promise<{ ok: boolean; steps: string[]; rx: number; aborted?: string }> {
    const rep = { ok: true, steps: [] as string[], rx: 0, aborted: '' };
    const saved = { ...this.state };

    const wait = async (sec: number) => {
      const ms = sec * 1000;
      const step = 50;
      let elapsed = 0;
      while (elapsed < ms) {
        if (isCancelled()) throw new Error('Prueba cancelada por el usuario');
        if (!this.connected) throw new Error('Se perdió la conexión con la tira');
        await new Promise((r) => setTimeout(r, step));
        elapsed += step;
      }
    };

    const sweep = async (n: number, dt: number, fn: (t: number) => void) => {
      for (let i = 0; i <= n; i++) {
        fn(i / n);
        await wait(dt);
      }
    };

    try {
      if (!this.connected) throw new Error('La tira no está conectada');

      // 1. Comunicación
      onProgress(0.1, '1/7 · Comunicación inicial');
      const rxBefore = this.rxCount;
      this.setBrightness(1000);
      this.setColorHsv(0, 1.0);
      this.power(true);
      await wait(0.8);
      rep.rx = this.rxCount - rxBefore;
      rep.steps.push('Comunicación');

      // 2. Parpadeo
      onProgress(0.25, '2/7 · Encendido y apagado');
      for (let i = 0; i < 3; i++) {
        this.power(false);
        await wait(0.35);
        this.power(true);
        await wait(0.35);
      }
      rep.steps.push('Encendido/Apagado');

      // 3. Colores básicos
      const colors = [
        ['Rojo', 0],
        ['Verde', 120],
        ['Azul', 240],
        ['Amarillo', 60],
        ['Cian', 180],
        ['Magenta', 300],
      ];
      for (let idx = 0; idx < colors.length; idx++) {
        const [cName, h] = colors[idx];
        onProgress(0.25 + (idx / colors.length) * 0.25, `Color: ${cName}`);
        this.setColorHsv(h as number, 1.0);
        await wait(0.6);
      }
      rep.steps.push('Colores básicos');

      // 4. Barrido de matiz
      onProgress(0.55, '4/7 · Barrido de espectro');
      await sweep(40, 0.04, (t) => this.setColorHsv(t * 360, 1.0, true));
      rep.steps.push('Barrido de matiz');

      // 5. Rampa de brillo
      onProgress(0.7, '5/7 · Rampa de brillo');
      await sweep(30, 0.04, (t) => this.setBrightness(Math.round(1000 - t * 990), true));
      await sweep(30, 0.04, (t) => this.setBrightness(Math.round(10 + t * 990), true));
      rep.steps.push('Rampa de brillo');

      // 6. Modos opcionales
      if (opts.modes) {
        onProgress(0.85, '6/7 · Efectos y modos');
        this.setSpeed(75);
        for (let m = 1; m <= 4; m++) {
          this.setMode(m);
          await wait(1.2);
        }
        rep.steps.push('Modos');
      }

      // 7. Micrófono de la tira
      if (opts.mic) {
        onProgress(0.92, '7/7 · Micrófono interno');
        this.setStripMic(true);
        await wait(0.4);
        for (let fx = 1; fx <= 3; fx++) {
          this.setEffect(fx);
          await wait(1.2);
        }
        this.setStripMic(false);
        rep.steps.push('Micrófono');
      }

      onProgress(1.0, '✔ Prueba completada con éxito');
      return rep;
    } catch (err: any) {
      rep.ok = false;
      rep.aborted = err.message || String(err);
      return rep;
    } finally {
      // Restaurar estado
      if (this.connected) {
        this.setColorHex(saved.colorHex);
        this.setBrightness(saved.brightness);
        this.setSpeed(saved.speed);
        this.power(saved.power);
      }
    }
  }
}

