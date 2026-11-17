import React, { useState } from 'react';
import {
  Power,
  Volume2,
  VolumeX,
  Volume1,
  RotateCcw,
  Play,
  Menu,
  Home,
  Settings,
  Send,
  Delete,
  CornerDownLeft,
  RefreshCw,
} from 'lucide-react';
import { TclRemoteClient, TV_APPS } from '../../protocols/tclRemote';
import type { LogMessage } from '../../types';

interface TclTabProps {
  tcl: TclRemoteClient;
  onSwitchTab: (tab: any) => void;
  addToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
  logs: LogMessage[];
  clearLogs: () => void;
  onRefreshStates: () => void;
}

const KB_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ['@', '.', ',', '-', '_', '/', ':', ';', '?', '!', '+', '#'],
];

export const TclTab: React.FC<TclTabProps> = ({
  tcl,
  onSwitchTab,
  addToast,
  logs,
  clearLogs,
  onRefreshStates,
}) => {
  const [textInput, setTextInput] = useState('');

  const handleKey = async (key: string) => {
    try {
      await tcl.sendKey(key);
      addToast(`Tecla enviada: ${key}`, 'info');
    } finally {
      onRefreshStates();
    }
  };

  const handleSendText = async (textToSend?: string) => {
    const txt = textToSend ?? textInput;
    if (!txt) return;
    try {
      await tcl.sendText(txt);
      addToast(`Texto enviado: «${txt}»`, 'success');
      if (textToSend === undefined) {
        setTextInput('');
      }
    } catch (err: any) {
      addToast(`Error al enviar texto: ${err.message || err}`, 'error');
    }
  };

  const handleLaunchApp = async (appKey: string) => {
    const app = TV_APPS[appKey];
    addToast(`Abriendo ${app?.label || appKey}...`, 'info');
    await tcl.launchApp(appKey);
    onRefreshStates();
  };

  const handleRefresh = async () => {
    await tcl.fetchStatus();
    addToast('Estado del televisor actualizado.', 'info');
    onRefreshStates();
  };

  return (
    <div className="tab-container">
      <div className="tab-header">
        <h1>Control Remoto TCL Android TV</h1>
        <p className="tab-subtitle">
          Wi-Fi v2 · Navegación, Teclado Virtual, Apps y Streaming desde tu navegador
        </p>
      </div>

      <div className="cards-stack">
        {/* Banner de Estado */}
        <div className={`status-banner ${tcl.connected ? 'banner-ok' : 'banner-err'}`}>
          <div className="banner-left">
            <span className="banner-dot" />
            <span>
              {tcl.connected
                ? `● Conectada a ${tcl.tvName} (${tcl.ip}) • ${tcl.isOn ? 'Pantalla Encendida' : 'En espera'} ${tcl.currentApp ? `• App: ${tcl.currentApp}` : ''}`
                : `● Desconectada de ${tcl.tvName} (${tcl.ip}) — conéctala en «Conexiones»`}
            </span>
          </div>
          <div className="banner-actions">
            <button className="btn-secondary btn-sm" onClick={handleRefresh}>
              <RefreshCw size={12} /> Actualizar
            </button>
            <button
              className="btn-accent btn-sm"
              onClick={() => onSwitchTab('conn')}
            >
              Ir a Conexiones
            </button>
          </div>
        </div>

        {/* Rejilla de Mando Virtual (Navegación + Controles) */}
        <div className="tv-remote-grid">
          {/* Columna Izquierda: NAVEGACIÓN D-PAD */}
          <div className="panel-card dpad-card">
            <div className="card-header">
              <h3>Navegación</h3>
              <button
                className="btn-secondary btn-sm"
                onClick={() => handleKey('HOME')}
                title="Ir al Inicio de Android TV"
              >
                <Home size={14} /> Inicio
              </button>
            </div>

            {/* D-Pad Circular */}
            <div className="dpad-container">
              <button
                className="dpad-btn dpad-up"
                onClick={() => handleKey('UP')}
                title="Arriba"
              >
                ▲
              </button>
              <button
                className="dpad-btn dpad-left"
                onClick={() => handleKey('LEFT')}
                title="Izquierda"
              >
                ◀
              </button>
              <button
                className="dpad-btn dpad-ok"
                onClick={() => handleKey('OK')}
                title="OK / Seleccionar"
              >
                OK
              </button>
              <button
                className="dpad-btn dpad-right"
                onClick={() => handleKey('RIGHT')}
                title="Derecha"
              >
                ▶
              </button>
              <button
                className="dpad-btn dpad-down"
                onClick={() => handleKey('DOWN')}
                title="Abajo"
              >
                ▼
              </button>
            </div>

            {/* Botones de acción rápida */}
            <div className="quick-actions-row">
              <button
                className="btn-quick"
                onClick={() => handleKey('BACK')}
                title="Atrás"
              >
                <RotateCcw size={16} />
                <span>Atrás</span>
              </button>
              <button
                className="btn-quick"
                onClick={() => handleKey('PLAY_PAUSE')}
                title="Play / Pausa"
              >
                <Play size={16} />
                <span>Play/Pausa</span>
              </button>
              <button
                className="btn-quick"
                onClick={() => handleKey('MENU')}
                title="Menú"
              >
                <Menu size={16} />
                <span>Menú</span>
              </button>
            </div>
          </div>

          {/* Columna Derecha: CONTROLES DEL TELEVISOR */}
          <div className="panel-card tv-controls-card">
            <div className="card-header">
              <h3>Controles del Televisor</h3>
            </div>

            {/* Botón Encendido */}
            <button
              className="power-button-prominent"
              onClick={() => handleKey('POWER')}
            >
              <Power size={18} />
              <span>Encendido / Standby</span>
            </button>

            {/* Volumen */}
            <div className="tv-section-box">
              <span className="section-mini-title">VOLUMEN</span>
              <div className="vol-btn-row">
                <button
                  className="btn-secondary"
                  onClick={() => handleKey('VOLUME_UP')}
                  title="Subir volumen"
                >
                  <Volume2 size={16} /> ＋
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => handleKey('MUTE')}
                  title="Silenciar"
                >
                  <VolumeX size={16} /> Silenciar
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => handleKey('VOLUME_DOWN')}
                  title="Bajar volumen"
                >
                  <Volume1 size={16} /> −
                </button>
              </div>
            </div>

            {/* Canales */}
            <div className="tv-section-box">
              <span className="section-mini-title">CANALES</span>
              <div className="ch-btn-row">
                <button
                  className="btn-secondary"
                  onClick={() => handleKey('CHANNEL_UP')}
                >
                  CH ＋
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => handleKey('CHANNEL_DOWN')}
                >
                  CH −
                </button>
              </div>
            </div>

            {/* Ajustes */}
            <button
              className="btn-secondary full-w-btn"
              onClick={() => handleKey('SETTINGS')}
            >
              <Settings size={15} /> Configuración del TV
            </button>
          </div>
        </div>

        {/* Aplicaciones de Streaming */}
        <div className="panel-card">
          <div className="card-header">
            <h3>Aplicaciones (Accesos Directos)</h3>
            <span className="dim-sub">Apertura directa en el televisor</span>
          </div>

          <div className="apps-grid-tiles">
            <button
              className="app-tile-btn app-youtube"
              onClick={() => handleLaunchApp('youtube')}
            >
              <span className="app-tile-icon">▶</span>
              <b>YouTube</b>
              <small>Abrir app</small>
            </button>

            <button
              className="app-tile-btn app-netflix"
              onClick={() => handleLaunchApp('netflix')}
            >
              <span className="app-tile-icon">𝗡</span>
              <b>Netflix</b>
              <small>Abrir app</small>
            </button>

            <button
              className="app-tile-btn app-prime"
              onClick={() => handleLaunchApp('prime')}
            >
              <span className="app-tile-icon">prime</span>
              <b>Prime Video</b>
              <small>Abrir app</small>
            </button>

            <button
              className="app-tile-btn app-disney"
              onClick={() => handleLaunchApp('disney')}
            >
              <span className="app-tile-icon">✦</span>
              <b>Disney+</b>
              <small>Abrir app</small>
            </button>

            <button
              className="app-tile-btn app-all"
              onClick={() => handleKey('ALL_APPS')}
            >
              <span className="app-tile-icon">▦</span>
              <b>Todas las Apps</b>
              <small>Menú del TV</small>
            </button>
          </div>
        </div>

        {/* Búsqueda y Teclado Virtual */}
        <div className="panel-card">
          <div className="card-header">
            <h3>Búsqueda y Teclado del Televisor</h3>
            <span className="dim-sub">Escribe en campos activos o búsquedas</span>
          </div>

          <div className="tv-typing-row">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Escribe para buscar o escribir en tu TCL..."
              onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
            />
            <button
              className="btn-accent"
              onClick={() => handleSendText()}
              disabled={!textInput.trim()}
            >
              <Send size={15} /> Enviar a TV
            </button>
          </div>

          {/* Teclado Virtual QWERTY */}
          <div className="virtual-keyboard-box">
            {KB_ROWS.map((row, rIdx) => (
              <div key={rIdx} className="keyboard-row">
                {row.map((char) => (
                  <button
                    key={char}
                    className="key-cap"
                    onClick={() => handleSendText(char)}
                  >
                    {char}
                  </button>
                ))}
                {rIdx === 3 && (
                  <button
                    className="key-cap key-del"
                    onClick={() => handleKey('DEL')}
                    title="Borrar (Backspace)"
                  >
                    <Delete size={14} /> ⌫
                  </button>
                )}
              </div>
            ))}

            <div className="keyboard-row keyboard-space-row">
              <button
                className="key-cap key-space"
                onClick={() => handleKey('SPACE')}
              >
                Espacio
              </button>
              <button
                className="key-cap key-enter"
                onClick={() => handleKey('ENTER')}
              >
                <CornerDownLeft size={14} /> Enter
              </button>
            </div>
          </div>
        </div>

        {/* Servidor Web Móvil Info */}
        <div className="panel-card">
          <div className="card-header">
            <h3>Servidor Web Móvil & Acceso desde Celular</h3>
            <span className="badge-pill">Puerto 8765</span>
          </div>
          <p className="card-desc">
            Cuando el servidor Python esté iniciado con <code>start.bat</code> o <code>python printer_studio_led.py</code>, puedes abrir <code>http://localhost:8765</code> en tu navegador o <code>http://[IP-DE-ESTA-PC]:8765</code> desde cualquier teléfono celular en la misma Wi-Fi para usarlo como control táctil de bolsillo.
          </p>
        </div>

        {/* Log de Actividad */}
        <div className="panel-card">
          <div className="card-header">
            <h3>Registro de Control TV</h3>
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
