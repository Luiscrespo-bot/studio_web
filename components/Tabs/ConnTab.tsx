import React, { useState } from 'react';
import {
  Printer,
  Lightbulb,
  Tv,
  HelpCircle,
} from 'lucide-react';
import { BlePrinterManager } from '../../protocols/blePrinter';
import { LedStripManager } from '../../protocols/ledStrip';
import { TclRemoteClient } from '../../protocols/tclRemote';

interface ConnTabProps {
  printer: BlePrinterManager;
  led: LedStripManager;
  tcl: TclRemoteClient;
  onOpenPairModal: () => void;
  onSwitchTab: (tab: any) => void;
  addToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onRefreshStates: () => void;
}

export const ConnTab: React.FC<ConnTabProps> = ({
  printer,
  led,
  tcl,
  onOpenPairModal,
  onSwitchTab,
  addToast,
  onRefreshStates,
}) => {
  const [connectingPrinter, setConnectingPrinter] = useState(false);
  const [connectingLed, setConnectingLed] = useState(false);
  const [connectingTv, setConnectingTv] = useState(false);
  const [tvIp, setTvIp] = useState(tcl.ip);

  const handleConnectPrinter = async () => {
    setConnectingPrinter(true);
    try {
      if (printer.isWebBluetoothAvailable()) {
        await printer.connect();
        addToast('Impresora MX10 conectada por Bluetooth BLE.', 'success');
      } else {
        printer.connectSimulated();
        addToast('Web Bluetooth no detectado: Conectado a MX10 virtual.', 'info');
      }
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        printer.connectSimulated();
        addToast('Modo de prueba activado (Simulador MX10).', 'info');
      }
    } finally {
      setConnectingPrinter(false);
      onRefreshStates();
    }
  };

  const handleConnectLed = async () => {
    setConnectingLed(true);
    try {
      if (led.isWebBluetoothAvailable()) {
        await led.connect();
        addToast('Tira LED conectada por Bluetooth BLE.', 'success');
      } else {
        led.connectSimulated();
        addToast('Conectado a Tira LED virtual para pruebas.', 'info');
      }
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        led.connectSimulated();
        addToast('Modo de prueba activado (Simulador LED).', 'info');
      }
    } finally {
      setConnectingLed(false);
      onRefreshStates();
    }
  };

  const handleDisconnectPrinter = async () => {
    await printer.disconnect();
    addToast('Impresora desconectada.', 'info');
    onRefreshStates();
  };

  const handleDisconnectLed = async () => {
    await led.disconnect();
    addToast('Tira LED desconectada.', 'info');
    onRefreshStates();
  };

  const handleConnectTv = async () => {
    setConnectingTv(true);
    tcl.setIp(tvIp);
    try {
      await tcl.connect();
      addToast('Conectado al televisor TCL.', 'success');
    } catch (err: any) {
      addToast(`Error al conectar TV: ${err.message || err}`, 'error');
    } finally {
      setConnectingTv(false);
      onRefreshStates();
    }
  };

  const handleDisconnectTv = async () => {
    await tcl.disconnect();
    addToast('Televisor TCL desconectado.', 'info');
    onRefreshStates();
  };

  return (
    <div className="tab-container">
      <div className="tab-header">
        <h1>Conexiones</h1>
        <p className="tab-subtitle">
          Gestiona la Impresora térmica, la Tira LED (BLE) y tu TCL Android TV (Wi-Fi).
        </p>
      </div>

      <div className="cards-stack">
        {/* Card BLE Scan / Conexión rápida */}
        <div className="panel-card">
          <div className="card-header">
            <h3>Dispositivos Bluetooth (Web BLE)</h3>
            <span className="badge-pill">Bluetooth LE 4.0+</span>
          </div>
          <p className="card-desc">
            Enciende tu impresora MX10 y tu tira LED. En navegadores Chrome, Edge u Opera con Bluetooth activo, puedes conectarlos directamente.
          </p>

          <div className="actions-row-grid">
            <button
              className="btn-gold"
              onClick={handleConnectPrinter}
              disabled={connectingPrinter || printer.connected}
            >
              <Printer size={18} />
              {connectingPrinter
                ? 'Conectando...'
                : printer.connected
                ? 'Impresora Conectada'
                : 'Conectar Impresora MX10'}
            </button>

            <button
              className="btn-green"
              onClick={handleConnectLed}
              disabled={connectingLed || led.connected}
            >
              <Lightbulb size={18} />
              {connectingLed
                ? 'Conectando...'
                : led.connected
                ? 'Tira LED Conectada'
                : 'Conectar Tira LED'}
            </button>
          </div>

          <div className="card-hint">
            <HelpCircle size={14} />
            <span>
              Si no tienes los dispositivos físicos a mano o tu navegador no soporta Web Bluetooth, la aplicación activará automáticamente el <b>Modo Simulado</b> para probar todas las funciones.
            </span>
          </div>
        </div>

        {/* Card Estado Impresora */}
        <div className="panel-card">
          <div className="card-header-split">
            <div className="split-left">
              <Printer size={20} className={printer.connected ? 'gold-icon' : 'dim-icon'} />
              <div>
                <h4>Impresora MX10</h4>
                <p className="device-spec">
                  Protocolo V5G / 51 78 · Cabezal 384 px · BLE
                </p>
              </div>
            </div>
            <div className="split-right">
              <span
                className={`status-pill ${
                  printer.connected ? 'pill-ok' : 'pill-err'
                }`}
              >
                {printer.connected ? '● Conectada' : '● Desconectada'}
              </span>
              {printer.connected && (
                <button
                  className="btn-secondary btn-sm"
                  onClick={handleDisconnectPrinter}
                >
                  Desconectar
                </button>
              )}
            </div>
          </div>
          <div className="card-sub-info">
            <span>Dispositivo: <b>{printer.connected ? printer.deviceName : '—'}</b></span>
            <span>ID / Dirección: <b>{printer.connected ? printer.address : '—'}</b></span>
          </div>
        </div>

        {/* Card Estado Tira LED */}
        <div className="panel-card">
          <div className="card-header-split">
            <div className="split-left">
              <Lightbulb size={20} className={led.connected ? 'green-icon' : 'dim-icon'} />
              <div>
                <h4>Tira LED RGB</h4>
                <p className="device-spec">
                  Protocolo Miracles Star · Servicio fff0 · BLE
                </p>
              </div>
            </div>
            <div className="split-right">
              <span
                className={`status-pill ${
                  led.connected ? 'pill-ok' : 'pill-err'
                }`}
              >
                {led.connected ? '● Conectada' : '● Desconectada'}
              </span>
              {led.connected && (
                <button
                  className="btn-secondary btn-sm"
                  onClick={handleDisconnectLed}
                >
                  Desconectar
                </button>
              )}
            </div>
          </div>
          <div className="card-sub-info">
            <span>Dispositivo: <b>{led.connected ? led.deviceName : '—'}</b></span>
            <span>ID / Dirección: <b>{led.connected ? led.address : '—'}</b></span>
          </div>
        </div>

        {/* Card Estado TCL Android TV */}
        <div className="panel-card">
          <div className="card-header-split">
            <div className="split-left">
              <Tv size={20} className={tcl.connected ? 'accent-icon' : 'dim-icon'} />
              <div>
                <h4>TCL Android TV (Wi-Fi)</h4>
                <p className="device-spec">
                  Protocolo Android TV Remote v2 · Puerto 6466/6467
                </p>
              </div>
            </div>
            <div className="split-right">
              <span
                className={`status-pill ${
                  tcl.connected
                    ? 'pill-ok'
                    : tcl.paired
                    ? 'pill-warn'
                    : 'pill-err'
                }`}
              >
                {tcl.connected
                  ? '● Conectada'
                  : tcl.paired
                  ? '● Emparejada (Desconectada)'
                  : '● Desconectada'}
              </span>
            </div>
          </div>

          <div className="tv-config-row">
            <div className="form-group inline-group">
              <label>IP del TV:</label>
              <input
                type="text"
                value={tvIp}
                onChange={(e) => setTvIp(e.target.value)}
                placeholder="192.168.10.111"
              />
            </div>
            <div className="btn-group-actions">
              <button className="btn-accent btn-sm" onClick={onOpenPairModal}>
                🔗 Emparejar TV
              </button>
              {tcl.connected ? (
                <button
                  className="btn-secondary btn-sm"
                  onClick={handleDisconnectTv}
                >
                  Desconectar
                </button>
              ) : (
                <button
                  className="btn-green btn-sm"
                  onClick={handleConnectTv}
                  disabled={connectingTv}
                >
                  🔌 Conectar
                </button>
              )}
              <button
                className="btn-blue-outline btn-sm"
                onClick={() => onSwitchTab('tcl')}
              >
                📺 Ir a Control TV
              </button>
            </div>
          </div>

          <div className="card-sub-info">
            <span>Equipo: <b>{tcl.tvName}</b></span>
            <span>IP: <b>{tcl.ip}</b></span>
            <span>Pantalla: <b>{tcl.isOn ? 'Encendida' : 'Standby / Apagada'}</b></span>
          </div>
        </div>
      </div>
    </div>
  );
};
