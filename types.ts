export type TabId = 'conn' | 'printer' | 'imagen' | 'camara' | 'qr' | 'led' | 'tcl';

export type DitherMode = 'threshold' | 'floyd' | 'atkinson' | 'halftone';

export interface PrinterState {
  connected: boolean;
  deviceName: string;
  address: string;
  printing: boolean;
  bitOrder: 'lsb' | 'msb';
  mirror: boolean;
  rotate: boolean;
  threshold: number;
}

export interface LedState {
  connected: boolean;
  deviceName: string;
  address: string;
  power: boolean;
  colorHex: string;
  brightness: number; // 3 - 1000
  speed: number; // 0 - 100
  stripMic: boolean;
  effect: number; // 1 - 4
  sensitivity: number; // 0 - 100
  mode: number;
  ledCount: number;
}

export interface TvState {
  connected: boolean;
  paired: boolean;
  ip: string;
  tvName: string;
  mac: string;
  isOn: boolean;
  currentApp: string;
  lastError: string | null;
  serverRunning: boolean;
  serverUrl: string;
}

export interface Toast {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'error';
}

export interface LogMessage {
  id: string;
  time: string;
  text: string;
}

