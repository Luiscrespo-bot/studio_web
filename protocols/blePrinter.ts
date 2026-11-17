// Web Bluetooth Driver para Impresora Térmica MX10 (V5G)

export interface PrinterDevice {
  name: string;
  id: string;
}

export class BlePrinterManager {
  private device: any = null;
  private server: any = null;
  private writeChar: any = null;
  public connected: boolean = false;
  public deviceName: string = 'MX10';
  public address: string = '';
  public busy: boolean = false;
  private onLostCallback?: () => void;
  private logCallback: (msg: string) => void;

  constructor(logCb: (msg: string) => void, onLost?: () => void) {
    this.logCallback = logCb;
    this.onLostCallback = onLost;
  }

  public isWebBluetoothAvailable(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  public async connect(): Promise<boolean> {
    if (!this.isWebBluetoothAvailable()) {
      throw new Error(
        'Web Bluetooth no está disponible en este navegador. Usa Chrome o Edge sobre HTTPS/localhost.'
      );
    }

    try {
      this.logCallback('Solicitando dispositivo Bluetooth...');
      // Solicita dispositivos BLE que anuncien servicios o acepten todos
      // @ts-ignore
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '0000ff00-0000-1000-8000-00805f9b34fb',
          '0000ae00-0000-1000-8000-00805f9b34fb',
          '0000ae01-0000-1000-8000-00805f9b34fb',
          '0000ae30-0000-1000-8000-00805f9b34fb',
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        ],
      });

      this.deviceName = this.device.name || 'MX10';
      this.address = this.device.id || 'BLE-DEV';

      this.device.addEventListener('gattserverdisconnected', () => {
        this.connected = false;
        this.writeChar = null;
        this.logCallback('⚠ La impresora se desconectó.');
        if (this.onLostCallback) this.onLostCallback();
      });

      this.logCallback(`Conectando a ${this.deviceName}...`);
      this.server = await this.device.gatt.connect();

      // Buscar características de escritura
      const services = await this.server.getPrimaryServices();
      let fallbackChar = null;

      for (const service of services) {
        try {
          const chars = await service.getCharacteristics();
          for (const ch of chars) {
            const props = ch.properties;
            if (props.write || props.writeWithoutResponse) {
              if (!fallbackChar) fallbackChar = ch;
              if (!service.uuid.startsWith('000018')) {
                this.writeChar = ch;
                break;
              }
            }
          }
          if (this.writeChar) break;
        } catch {
          // ignorar servicios protegidos
        }
      }

      this.writeChar = this.writeChar || fallbackChar;
      if (!this.writeChar) {
        throw new Error('No se encontró una característica BLE de escritura compatible.');
      }

      this.connected = true;
      this.logCallback(`✔ Impresora conectada exitosamente: ${this.deviceName}`);
      return true;
    } catch (err: any) {
      this.connected = false;
      this.writeChar = null;
      this.logCallback(`Error de conexión: ${err.message || err}`);
      throw err;
    }
  }

  // Permite modo simulado para desarrollo sin hardware BLE
  public connectSimulated(name: string = 'MX10-Virtual') {
    this.connected = true;
    this.deviceName = name;
    this.address = 'SIM-00:11:22:33:44';
    this.logCallback(`✔ Conectado a modo simulado: ${this.deviceName}`);
  }

  public async disconnect() {
    if (this.device && this.device.gatt && this.device.gatt.connected) {
      await this.device.gatt.disconnect();
    }
    this.connected = false;
    this.writeChar = null;
    this.logCallback('Impresora desconectada.');
  }

  public async sendData(
    data: Uint8Array,
    onProgress?: (fraction: number) => void
  ): Promise<{ bytes: number; seconds: number; speedKb: number }> {
    if (!this.connected) {
      throw new Error('La impresora no está conectada.');
    }

    this.busy = true;
    const CHUNK = 20;
    const t0 = performance.now();
    const total = data.length;

    try {
      if (this.writeChar) {
        for (let i = 0; i < total; i += CHUNK) {
          const chunk = data.slice(i, i + CHUNK);
          try {
            if (this.writeChar.writeValueWithoutResponse) {
              await this.writeChar.writeValueWithoutResponse(chunk);
            } else {
              await this.writeChar.writeValue(chunk);
            }
          } catch {
            await this.writeChar.writeValue(chunk);
          }
          if (onProgress) onProgress(Math.min(1, (i + chunk.length) / total));
          await new Promise((r) => setTimeout(r, 8));
        }
      } else {
        // Simulación con temporizador realista
        for (let i = 0; i < total; i += CHUNK * 2) {
          await new Promise((r) => setTimeout(r, 6));
          if (onProgress) onProgress(Math.min(1, (i + CHUNK * 2) / total));
        }
      }

      const dt = (performance.now() - t0) / 1000;
      const speed = dt > 0 ? total / dt / 1024 : 0;
      this.logCallback(
        `✔ Enviados ${total} bytes en ${dt.toFixed(1)} s (${speed.toFixed(1)} KB/s)`
      );
      return { bytes: total, seconds: dt, speedKb: speed };
    } finally {
      this.busy = false;
      if (onProgress) onProgress(1);
    }
  }
}

