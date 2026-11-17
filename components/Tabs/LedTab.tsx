import React, { useState, useEffect, useRef } from 'react';
import {
  Power,
  Music,
  Activity,
  Play,
  Square,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { LedStripManager } from '../../protocols/ledStrip';
import { WebAudioEngine } from '../../protocols/audioEngine';
import type { LogMessage } from '../../types';

interface LedTabProps {
  led: LedStripManager;
  audio: WebAudioEngine;
  onSwitchTab: (tab: any) => void;
  addToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
  logs: LogMessage[];
  clearLogs: () => void;
  onRefreshStates: () => void;
}

const SWATCHES = [
  '#ff0000',
  '#ff8800',
  '#ffee00',
  '#00ff44',
  '#00e5ff',
  '#0044ff',
  '#a000ff',
  '#ffffff',
];

export const LedTab: React.FC<LedTabProps> = ({
  led,
  audio,
  onSwitchTab,
  addToast,
  logs,
  clearLogs,
  onRefreshStates,
}) => {
  const [color, setColor] = useState(led.state.colorHex);
  const [brightness, setBrightness] = useState(led.state.brightness);
  const [speed, setSpeed] = useState(led.state.speed);
  const [powerState, setPowerState] = useState(led.state.power);
  const [effect, setEffect] = useState(led.state.effect);
  const [sensitivity, setSensitivity] = useState(led.state.sensitivity);

  // Audio reactivo
  const [audioRunning, setAudioRunning] = useState(audio.active);
  const [audioGain, setAudioGain] = useState(audio.gain);
  const [audioMode, setAudioMode] = useState<'freq' | 'beat'>(audio.mode);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDev, setSelectedAudioDev] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);

  // Avanzado
  const [customMode, setCustomMode] = useState('1');
  const [ledCount, setLedCount] = useState('30');
  const [rawHex, setRawHex] = useState('04 00 00 03 E8 00 00');

  // Prueba técnica
  const [testing, setTesting] = useState(false);
  const [testProgress, setTestProgress] = useState(0);
  const [testStatus, setTestStatus] = useState('Listo para iniciar.');
  const [includeModes, setIncludeModes] = useState(true);
  const [includeMic, setIncludeMic] = useState(false);
  const cancelTestRef = useRef(false);

  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Listar micrófonos
    audio.getAudioDevices().then((devs) => {
      setAudioDevices(devs);
      if (devs.length > 0 && !selectedAudioDev) {
        setSelectedAudioDev(devs[0].deviceId);
      }
    });

    audio.onLevelUpdate = (lvl) => setAudioLevel(lvl);

    audio.onSpectrumUpdate = (data) => {
      if (!spectrumCanvasRef.current) return;
      const cvs = spectrumCanvasRef.current;
      const ctx = cvs.getContext('2d')!;
      const w = cvs.width;
      const h = cvs.height;
      ctx.clearRect(0, 0, w, h);

      const barCount = 32;
      const step = Math.floor(data.length / barCount);
      const barW = (w / barCount) - 2;

      for (let i = 0; i < barCount; i++) {
        const val = data[i * step] / 255.0;
        const barH = val * h;
        const hue = (i / barCount) * 280;
        ctx.fillStyle = `hsl(${hue}, 90%, 55%)`;
        ctx.fillRect(i * (barW + 2), h - barH, barW, barH);
      }
    };

    return () => {
      audio.onLevelUpdate = undefined;
      audio.onSpectrumUpdate = undefined;
    };
  }, []);

  const handleColorChange = (c: string) => {
    setColor(c);
    led.setColorHex(c);
  };

  const handleBrightnessChange = (val: number) => {
    setBrightness(val);
    led.setBrightness(val);
  };

  const handleSpeedChange = (val: number) => {
    setSpeed(val);
    led.setSpeed(val);
  };

  const handlePower = (on: boolean) => {
    setPowerState(on);
    led.power(on);
    onRefreshStates();
  };

  const handleToggleAudio = async () => {
    if (audioRunning) {
      audio.stop();
      setAudioRunning(false);
      addToast('Audio reactivo detenido.', 'info');
    } else {
      if (!led.connected) {
        addToast('Conecta la tira LED primero.', 'error');
        return;
      }
      const ok = await audio.start(selectedAudioDev);
      setAudioRunning(ok);
      if (ok) addToast('Audio reactivo escuchando el micrófono.', 'success');
    }
  };

  const handleStartTechnicalTest = async () => {
    if (!led.connected) {
      addToast('Conecta la tira LED primero en Conexiones.', 'error');
      return;
    }
    if (audioRunning) {
      audio.stop();
      setAudioRunning(false);
    }

    setTesting(true);
    setTestProgress(0);
    cancelTestRef.current = false;
    addToast('Iniciando prueba técnica de la tira LED...', 'info');

    try {
      const res = await led.runTechnicalTest(
        (frac, txt) => {
          setTestProgress(frac);
          setTestStatus(txt);
        },
        () => cancelTestRef.current,
        { modes: includeModes, mic: includeMic }
      );

      if (res.ok) {
        setTestStatus(`✔ Prueba completada (${res.steps.length} pasos ejecutados).`);
        addToast('✔ Prueba técnica de la tira completada.', 'success');
      } else {
        setTestStatus(`✖ Interrumpida: ${res.aborted}`);
        addToast(`Prueba interrumpida: ${res.aborted}`, 'error');
      }
    } finally {
      setTesting(false);
      onRefreshStates();
    }
  };

  const handleCancelTechnicalTest = () => {
    cancelTestRef.current = true;
    setTestStatus('Deteniendo prueba técnica...');
  };

  return (
    <div className="tab-container">
      <div className="tab-header">
        <h1>Tira LED RGB</h1>
        <p className="tab-subtitle">
          Bluetooth BLE · Protocolo Miracles Star · Efectos y Audio Reactivo
        </p>
      </div>

      <div className="cards-stack">
        {/* Banner de estado */}
        <div className={`status-banner ${led.connected ? 'banner-ok' : 'banner-err'}`}>
          <div className="banner-left">
            <span className="banner-dot" />
            <span>
              {led.connected
                ? `● Tira LED conectada: ${led.deviceName} (${led.address || 'BLE'})`
                : '● Tira LED desconectada — conéctala en «Conexiones»'}
            </span>
          </div>
          <button
            className="btn-accent btn-sm"
            onClick={() => onSwitchTab('conn')}
          >
            Ir a Conexiones
          </button>
        </div>

        {/* Control Principal */}
        <div className="panel-card">
          <div className="card-header">
            <h3>Control de Iluminación</h3>
            <div className="power-toggle-btns">
              <button
                className={`btn-power ${powerState ? 'active' : ''}`}
                onClick={() => handlePower(true)}
              >
                <Power size={14} /> Encender
              </button>
              <button
                className={`btn-power ${!powerState ? 'active-off' : ''}`}
                onClick={() => handlePower(false)}
              >
                <Power size={14} /> Apagar
              </button>
            </div>
          </div>

          <div className="color-section">
            <label className="dim-sub">Color principal:</label>
            <div className="swatches-row">
              <div
                className="color-picker-wrapper"
                style={{ backgroundColor: color }}
              >
                <input
                  type="color"
                  value={color}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="native-color-input"
                />
              </div>

              {SWATCHES.map((hex) => (
                <button
                  key={hex}
                  className="swatch-btn"
                  style={{ backgroundColor: hex }}
                  onClick={() => handleColorChange(hex)}
                  title={hex}
                />
              ))}
            </div>
          </div>

          <div className="sliders-cluster">
            <div className="control-item">
              <div className="slider-label-row">
                <span>Brillo</span>
                <b>{brightness} / 1000</b>
              </div>
              <input
                type="range"
                min="3"
                max="1000"
                value={brightness}
                onChange={(e) => handleBrightnessChange(parseInt(e.target.value, 10))}
              />
            </div>

            <div className="control-item">
              <div className="slider-label-row">
                <span>Velocidad de efectos</span>
                <b>{speed} %</b>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={speed}
                onChange={(e) => handleSpeedChange(parseInt(e.target.value, 10))}
              />
            </div>
          </div>
        </div>

        {/* Micrófono de la Tira */}
        <div className="panel-card">
          <div className="card-header">
            <h3>Micrófono Integrado de la Tira</h3>
            <div className="power-toggle-btns">
              <button
                className="btn-accent btn-sm"
                onClick={() => led.setStripMic(true)}
              >
                Activar
              </button>
              <button
                className="btn-secondary btn-sm"
                onClick={() => led.setStripMic(false)}
              >
                Desactivar
              </button>
            </div>
          </div>

          <div className="effects-radio-row">
            <label className="dim-sub">Efecto interno (1-4):</label>
            <div className="radio-pills">
              {[1, 2, 3, 4].map((num) => (
                <button
                  key={num}
                  className={`pill-option ${effect === num ? 'selected' : ''}`}
                  onClick={() => {
                    setEffect(num);
                    led.setEffect(num);
                  }}
                >
                  Efecto {num}
                </button>
              ))}
            </div>
          </div>

          <div className="control-item" style={{ marginTop: '14px' }}>
            <div className="slider-label-row">
              <span>Sensibilidad del micrófono</span>
              <b>{sensitivity} %</b>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={sensitivity}
              onChange={(e) => {
                const s = parseInt(e.target.value, 10);
                setSensitivity(s);
                led.setSensitivity(s);
              }}
            />
          </div>
        </div>

        {/* Audio Reactivo (PC) */}
        <div className="panel-card">
          <div className="card-header">
            <h3>
              <Music size={18} className="accent-icon" /> Audio Reactivo (Micrófono del PC)
            </h3>
            <span className="badge-pill">Web Audio FFT</span>
          </div>

          <p className="card-desc">
            Analiza el audio del micrófono o entrada de línea en tiempo real con Web Audio API y sincroniza el color y ritmo de la tira.
          </p>

          <div className="audio-setup-row">
            <div className="cam-select-wrap">
              <label>Entrada de audio:</label>
              <select
                value={selectedAudioDev}
                onChange={(e) => setSelectedAudioDev(e.target.value)}
                className="select-dropdown"
              >
                {audioDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Entrada ${d.deviceId.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="power-toggle-btns" style={{ alignSelf: 'flex-end' }}>
              <button
                className={audioRunning ? 'btn-red' : 'btn-accent'}
                onClick={handleToggleAudio}
              >
                {audioRunning ? <Square size={14} /> : <Play size={14} />}
                {audioRunning ? 'Detener' : 'Iniciar Audio'}
              </button>
            </div>
          </div>

          <div className="radio-group-horizontal">
            <label className="radio-label">
              <input
                type="radio"
                name="amode"
                value="freq"
                checked={audioMode === 'freq'}
                onChange={() => {
                  setAudioMode('freq');
                  audio.mode = 'freq';
                }}
              />
              Frecuencia dominante (graves=rojo → agudos=violeta)
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="amode"
                value="beat"
                checked={audioMode === 'beat'}
                onChange={() => {
                  setAudioMode('beat');
                  audio.mode = 'beat';
                }}
              />
              Golpe de bajo (cambia de color en cada beat)
            </label>
          </div>

          <div className="control-item" style={{ marginTop: '12px' }}>
            <div className="slider-label-row">
              <span>Ganancia / Sensibilidad</span>
              <b>{audioGain.toFixed(1)}x</b>
            </div>
            <input
              type="range"
              min="0.5"
              max="10.0"
              step="0.1"
              value={audioGain}
              onChange={(e) => {
                const g = parseFloat(e.target.value);
                setAudioGain(g);
                audio.gain = g;
              }}
            />
          </div>

          {/* Visualizador de espectro y nivel */}
          <div className="visualizer-box">
            <canvas ref={spectrumCanvasRef} width={400} height={40} className="spectrum-canvas" />
            <div className="vu-meter-bar">
              <div
                className="vu-meter-fill"
                style={{ width: `${Math.min(100, audioLevel * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Avanzado */}
        <div className="panel-card">
          <div className="card-header">
            <h3>Comandos Avanzados</h3>
          </div>

          <div className="advanced-grid">
            <div className="input-action-row">
              <label>Modo/Efecto (0-255):</label>
              <input
                type="number"
                min="0"
                max="255"
                value={customMode}
                onChange={(e) => setCustomMode(e.target.value)}
                style={{ width: '80px' }}
              />
              <button
                className="btn-secondary btn-sm"
                onClick={() => led.setMode(parseInt(customMode, 10) || 1)}
              >
                Aplicar
              </button>
            </div>

            <div className="input-action-row">
              <label>Nº de LEDs (8-300):</label>
              <input
                type="number"
                min="8"
                max="300"
                value={ledCount}
                onChange={(e) => setLedCount(e.target.value)}
                style={{ width: '80px' }}
              />
              <button
                className="btn-secondary btn-sm"
                onClick={() => led.setLeds(parseInt(ledCount, 10) || 30)}
              >
                Aplicar
              </button>
            </div>
          </div>

          <div className="raw-packet-row">
            <label>Paquete manual Hex (agrega BC, len y 55 automáticamente):</label>
            <div className="input-with-button">
              <input
                type="text"
                value={rawHex}
                onChange={(e) => setRawHex(e.target.value)}
                placeholder="04 00 00 03 E8 00 00"
              />
              <button
                className="btn-accent btn-sm"
                onClick={() => led.sendRaw(rawHex)}
              >
                Enviar Hex
              </button>
            </div>
          </div>
        </div>

        {/* Prueba Técnica */}
        <div className="panel-card">
          <div className="card-header">
            <h3>
              <Sparkles size={18} className="gold-icon" /> Prueba Técnica de la Tira
            </h3>
          </div>

          <p className="card-desc">
            Ejecuta una secuencia automatizada de diagnóstico: comunicación, parpadeo, colores, barrido de matiz, saturación y rampa de brillo. Al finalizar restaura tus ajustes.
          </p>

          <div className="checkbox-row-pair">
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={includeModes}
                onChange={(e) => setIncludeModes(e.target.checked)}
              />
              Incluir modos y efectos (1-4)
            </label>
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={includeMic}
                onChange={(e) => setIncludeMic(e.target.checked)}
              />
              Incluir micrófono de la tira
            </label>
          </div>

          <div className="actions-cluster" style={{ marginTop: '12px' }}>
            <button
              className="btn-accent"
              onClick={handleStartTechnicalTest}
              disabled={testing || !led.connected}
            >
              <Activity size={16} /> Iniciar Prueba Técnica
            </button>
            <button
              className="btn-secondary"
              onClick={handleCancelTechnicalTest}
              disabled={!testing}
            >
              <Square size={16} /> Detener
            </button>
          </div>

          {testing && (
            <div className="test-progress-box">
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${testProgress * 100}%` }}
                />
              </div>
              <span className="dim-sub">{testStatus}</span>
            </div>
          )}
        </div>

        {/* Log */}
        <div className="panel-card">
          <div className="card-header">
            <h3>Registro de la Tira LED</h3>
            <button className="btn-secondary btn-sm" onClick={clearLogs}>
              <RefreshCw size={12} /> Limpiar
            </button>
          </div>
          <div className="console-log">
            {logs.length === 0 ? (
              <span className="dim-sub">Sin actividad reciente...</span>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="log-line">
                  <span className="log-time">{log.time}</span>
                  <span className="log-text">{log.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
