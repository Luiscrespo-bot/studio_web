import React, { useState } from 'react';
import { Printer, Eye, Zap, Settings, RefreshCw } from 'lucide-react';
import { BlePrinterManager } from '../../protocols/blePrinter';
import {
  renderTextImage,
  renderTestPage,
  renderQuickTestRaster,
  canvasToMx10Raster,
  wrapJob,
} from '../../protocols/mx10';
import type { LogMessage } from '../../types';

interface PrinterTabProps {
  printer: BlePrinterManager;
  onPreview: (canvas: HTMLCanvasElement, onConfirm: () => void) => void;
  onSwitchTab: (tab: any) => void;
  addToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
  logs: LogMessage[];
  clearLogs: () => void;
}

export const PrinterTab: React.FC<PrinterTabProps> = ({
  printer,
  onPreview,
  onSwitchTab,
  addToast,
  logs,
  clearLogs,
}) => {
  const [text, setText] = useState('¡Hola desde PRINTER STUDIO WEB!\nImpresión térmica MX10 por Bluetooth BLE.\nTexto con acentos: á é í ó ú ñ.');
  const [fontSize, setFontSize] = useState(24);
  const [printing, setPrinting] = useState(false);

  const handlePreviewText = () => {
    if (!text.trim()) {
      addToast('Escribe algo primero en el cuadro de texto.', 'info');
      return;
    }
    const canvas = renderTextImage(text, fontSize);
    onPreview(canvas, () => handlePrintCanvas(canvas, 'Texto'));
  };

  const handlePrintCanvas = async (canvas: HTMLCanvasElement, label: string) => {
    if (!printer.connected) {
      addToast('Conecta la impresora en la pestaña Conexiones primero.', 'error');
      return;
    }
    setPrinting(true);
    addToast(`Preparando trabajo de impresión (${label})...`, 'info');
    try {
      const rasterData = canvasToMx10Raster(canvas, 'threshold');
      const job = wrapJob(rasterData);
      await printer.sendData(job);
      addToast('✔ Impresión enviada con éxito.', 'success');
    } catch (err: any) {
      addToast(`Error al imprimir: ${err.message || err}`, 'error');
    } finally {
      setPrinting(false);
    }
  };

  const handleTechnicalTest = () => {
    const canvas = renderTestPage(
      printer.deviceName,
      printer.address,
      'lsb',
      false,
      false,
      190
    );
    onPreview(canvas, () => handlePrintCanvas(canvas, 'Prueba Técnica (Hoja de calibración)'));
  };

  const handleQuickTest = async () => {
    if (!printer.connected) {
      addToast('Conecta la impresora en la pestaña Conexiones primero.', 'error');
      return;
    }
    setPrinting(true);
    addToast('Enviando prueba rápida (marco + barras)...', 'info');
    try {
      const job = renderQuickTestRaster();
      await printer.sendData(job);
      addToast('✔ Prueba rápida completada.', 'success');
    } catch (err: any) {
      addToast(`Error: ${err.message || err}`, 'error');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="tab-container">
      <div className="tab-header">
        <h1>Impresora MX10</h1>
        <p className="tab-subtitle">
          BLE · Protocolo V5G · Cabezal térmico de 384 puntos
        </p>
      </div>

      <div className="cards-stack">
        {/* Banner */}
        <div className={`status-banner ${printer.connected ? 'banner-ok' : 'banner-err'}`}>
          <div className="banner-left">
            <span className="banner-dot" />
            <span>
              {printer.connected
                ? `● Impresora conectada: ${printer.deviceName} (${printer.address || 'BLE'})`
                : '● Impresora desconectada — conéctala en «Conexiones»'}
            </span>
          </div>
          <button
            className="btn-accent btn-sm"
            onClick={() => onSwitchTab('conn')}
          >
            Ir a Conexiones
          </button>
        </div>

        {/* Especificaciones */}
        <div className="panel-card">
          <div className="card-header">
            <h3>Especificaciones</h3>
          </div>
          <div className="specs-grid">
            <div className="spec-row">
              <span className="spec-label">Modelo</span>
              <span className="spec-val">MX10 / PeriPage Compatible</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">Protocolo</span>
              <span className="spec-val">V5G / 51 78 CMD ... CRC FF</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">Cabezal</span>
              <span className="spec-val">384 px (48 bytes por línea)</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">Transporte</span>
              <span className="spec-val">Web Bluetooth API / BLE</span>
            </div>
          </div>
        </div>

        {/* Imprimir Texto */}
        <div className="panel-card">
          <div className="card-header">
            <h3>Imprimir Texto</h3>
            <div className="font-size-control">
              <label>Tamaño fuente: <b>{fontSize}px</b></label>
              <input
                type="range"
                min="14"
                max="42"
                step="2"
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
              />
            </div>
          </div>

          <textarea
            className="text-input-area"
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe el texto que deseas imprimir..."
          />

          <div className="actions-cluster">
            <button className="btn-secondary" onClick={handlePreviewText}>
              <Eye size={16} /> Previsualizar
            </button>
            <button
              className="btn-gold"
              onClick={handlePreviewText}
              disabled={printing || !printer.connected}
            >
              <Printer size={16} /> Imprimir Texto
            </button>
            <button
              className="btn-accent"
              onClick={handleTechnicalTest}
              disabled={printing}
            >
              <Settings size={16} /> ⚙ Prueba Técnica
            </button>
            <button
              className="btn-secondary"
              onClick={handleQuickTest}
              disabled={printing || !printer.connected}
            >
              <Zap size={16} /> ⚡ Prueba Rápida
            </button>
          </div>
        </div>

        {/* Log de la Impresora */}
        <div className="panel-card">
          <div className="card-header">
            <h3>Registro de Transmisión</h3>
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
