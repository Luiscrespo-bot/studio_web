import React, { useState, useEffect, useRef } from 'react';
import type { TabId, Toast, LogMessage } from './types';
import { Sidebar } from './components/Sidebar';
import { ConnTab } from './components/Tabs/ConnTab';
import { PrinterTab } from './components/Tabs/PrinterTab';
import { ImageTab } from './components/Tabs/ImageTab';
import { CameraTab } from './components/Tabs/CameraTab';
import { QrTab } from './components/Tabs/QrTab';
import { LedTab } from './components/Tabs/LedTab';
import { TclTab } from './components/Tabs/TclTab';
import { PreviewModal } from './components/Modals/PreviewModal';
import { PairModal } from './components/Modals/PairModal';
import { BlePrinterManager } from './protocols/blePrinter';
import { LedStripManager } from './protocols/ledStrip';
import { WebAudioEngine } from './protocols/audioEngine';
import { TclRemoteClient } from './protocols/tclRemote';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<TabId>('conn');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null);
  const [previewConfirmFn, setPreviewConfirmFn] = useState<(() => void) | null>(null);
  const [pairModalOpen, setPairModalOpen] = useState<boolean>(false);

  // Logs independientes
  const [printerLogs, setPrinterLogs] = useState<LogMessage[]>([]);
  const [ledLogs, setLedLogs] = useState<LogMessage[]>([]);
  const [tvLogs, setTvLogs] = useState<LogMessage[]>([]);

  // Estados de conexión reactivos
  const [, setTick] = useState(0);
  const refreshUi = () => setTick((t) => t + 1);

  const addLog = (category: 'printer' | 'led' | 'tv', text: string) => {
    const time = new Date().toLocaleTimeString();
    const entry: LogMessage = {
      id: Math.random().toString(36).substring(2, 9),
      time,
      text,
    };
    if (category === 'printer') {
      setPrinterLogs((prev) => [entry, ...prev.slice(0, 49)]);
    } else if (category === 'led') {
      setLedLogs((prev) => [entry, ...prev.slice(0, 49)]);
    } else {
      setTvLogs((prev) => [entry, ...prev.slice(0, 49)]);
    }
  };

  const addToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  };

  // Instancias de protocolos
  const printerRef = useRef<BlePrinterManager | null>(null);
  const ledRef = useRef<LedStripManager | null>(null);
  const audioRef = useRef<WebAudioEngine | null>(null);
  const tclRef = useRef<TclRemoteClient | null>(null);

  if (!printerRef.current) {
    printerRef.current = new BlePrinterManager(
      (msg) => addLog('printer', msg),
      () => refreshUi()
    );
  }

  if (!ledRef.current) {
    ledRef.current = new LedStripManager(
      (msg) => addLog('led', msg),
      () => refreshUi()
    );
  }

  if (!audioRef.current) {
    audioRef.current = new WebAudioEngine(ledRef.current, (msg) =>
      addLog('led', msg)
    );
  }

  if (!tclRef.current) {
    tclRef.current = new TclRemoteClient(
      (msg) => addLog('tv', msg),
      () => refreshUi()
    );
  }

  const printer = printerRef.current;
  const led = ledRef.current;
  const audio = audioRef.current;
  const tcl = tclRef.current;

  // Polling de estado de TV cada 6s
  useEffect(() => {
    tcl.fetchStatus();
    const timer = setInterval(() => {
      tcl.fetchStatus();
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const handlePreview = (canvas: HTMLCanvasElement, onConfirm: () => void) => {
    setPreviewCanvas(canvas);
    setPreviewConfirmFn(() => onConfirm);
  };

  const handleConfirmPreview = () => {
    if (previewConfirmFn) {
      previewConfirmFn();
    }
    setPreviewCanvas(null);
    setPreviewConfirmFn(null);
  };

  return (
    <div className="app-layout">
      {/* Barra lateral de navegación y estados */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        printerConnected={printer.connected}
        ledConnected={led.connected}
        tvConnected={tcl.connected}
        tvPaired={tcl.paired}
      />

      {/* Vista principal activa */}
      <main className="content-area">
        {currentTab === 'conn' && (
          <ConnTab
            printer={printer}
            led={led}
            tcl={tcl}
            onOpenPairModal={() => setPairModalOpen(true)}
            onSwitchTab={setCurrentTab}
            addToast={addToast}
            onRefreshStates={refreshUi}
          />
        )}

        {currentTab === 'printer' && (
          <PrinterTab
            printer={printer}
            onPreview={handlePreview}
            onSwitchTab={setCurrentTab}
            addToast={addToast}
            logs={printerLogs}
            clearLogs={() => setPrinterLogs([])}
          />
        )}

        {currentTab === 'imagen' && (
          <ImageTab
            printer={printer}
            onPreview={handlePreview}
            addToast={addToast}
          />
        )}

        {currentTab === 'camara' && (
          <CameraTab
            printer={printer}
            onPreview={handlePreview}
            addToast={addToast}
          />
        )}

        {currentTab === 'qr' && (
          <QrTab
            printer={printer}
            onPreview={handlePreview}
            addToast={addToast}
          />
        )}

        {currentTab === 'led' && (
          <LedTab
            led={led}
            audio={audio}
            onSwitchTab={setCurrentTab}
            addToast={addToast}
            logs={ledLogs}
            clearLogs={() => setLedLogs([])}
            onRefreshStates={refreshUi}
          />
        )}

        {currentTab === 'tcl' && (
          <TclTab
            tcl={tcl}
            onSwitchTab={setCurrentTab}
            addToast={addToast}
            logs={tvLogs}
            clearLogs={() => setTvLogs([])}
            onRefreshStates={refreshUi}
          />
        )}
      </main>

      {/* Modal de Vista Previa de Impresión */}
      <PreviewModal
        canvas={previewCanvas}
        onConfirm={handleConfirmPreview}
        onCancel={() => {
          setPreviewCanvas(null);
          setPreviewConfirmFn(null);
        }}
      />

      {/* Modal de Emparejamiento TCL */}
      {pairModalOpen && (
        <PairModal
          tcl={tcl}
          onSuccess={() => {
            addToast('¡Televisor conectado con éxito!', 'success');
            refreshUi();
          }}
          onClose={() => setPairModalOpen(false)}
        />
      )}

      {/* Contenedor de Notificaciones Toast flotantes */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-card toast-${t.type || 'info'}`}>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
