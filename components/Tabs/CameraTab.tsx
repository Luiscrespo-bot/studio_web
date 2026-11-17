import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, EyeOff } from 'lucide-react';
import { BlePrinterManager } from '../../protocols/blePrinter';
import {
  PRINT_W,
  binarizeImageData,
  canvasToMx10Raster,
  wrapJob,
} from '../../protocols/mx10';

interface CameraTabProps {
  printer: BlePrinterManager;
  onPreview: (canvas: HTMLCanvasElement, onConfirm: () => void) => void;
  addToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const CameraTab: React.FC<CameraTabProps> = ({
  printer,
  onPreview,
  addToast,
}) => {
  const [active, setActive] = useState(false);
  const [bwMode, setBwMode] = useState(true);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Listar cámaras
    navigator.mediaDevices?.enumerateDevices().then((devs) => {
      const cams = devs.filter((d) => d.kind === 'videoinput');
      setDevices(cams);
      if (cams.length > 0 && !selectedDevice) {
        setSelectedDevice(cams[0].deviceId);
      }
    });

    startCamera();

    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async (deviceId?: string) => {
    stopCamera();
    setErrorMsg('');
    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
      addToast('Cámara iniciada.', 'info');
    } catch (err: any) {
      setErrorMsg(`No se pudo acceder a la cámara: ${err.message || err}`);
      setActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setActive(false);
  };

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDevice(deviceId);
    startCamera(deviceId);
  };

  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    if (v.videoWidth === 0) {
      addToast('La cámara aún no tiene imagen.', 'info');
      return;
    }

    const aspect = v.videoHeight / v.videoWidth;
    const newHeight = Math.max(1, Math.round(PRINT_W * aspect));

    const canvas = document.createElement('canvas');
    canvas.width = PRINT_W;
    canvas.height = newHeight;
    const ctx = canvas.getContext('2d')!;

    ctx.drawImage(v, 0, 0, PRINT_W, newHeight);

    if (bwMode) {
      const binImg = binarizeImageData(ctx, PRINT_W, newHeight, 'threshold', {
        threshold: 190,
        autoLevels: true,
      });
      ctx.putImageData(binImg, 0, 0);
    }

    onPreview(canvas, async () => {
      if (!printer.connected) {
        // Opción de guardar si no hay impresora
        const link = document.createElement('a');
        link.download = `foto_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        addToast('Foto guardada como PNG.', 'success');
        return;
      }
      addToast('Enviando foto a la impresora...', 'info');
      try {
        const raster = canvasToMx10Raster(canvas, 'threshold', { threshold: 190 });
        const job = wrapJob(raster);
        await printer.sendData(job);
        addToast('✔ Foto impresa correctamente.', 'success');
      } catch (err: any) {
        addToast(`Error al imprimir foto: ${err.message || err}`, 'error');
      }
    });
  };

  return (
    <div className="tab-container">
      <div className="tab-header">
        <h1>Cámara → Imprimir</h1>
        <p className="tab-subtitle">
          Captura fotos en tiempo real y envíalas directamente a la impresora térmica.
        </p>
      </div>

      <div className="cards-stack">
        <div className="camera-view-container">
          <div className="video-card">
            {errorMsg ? (
              <div className="camera-error-box">
                <EyeOff size={40} className="dim-icon" />
                <p>{errorMsg}</p>
                <button
                  className="btn-accent btn-sm"
                  onClick={() => startCamera(selectedDevice)}
                >
                  <RefreshCw size={14} /> Reintentar
                </button>
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`camera-video-feed ${bwMode ? 'filter-bw' : ''}`}
              />
            )}
          </div>
        </div>

        <div className="panel-card camera-controls-card">
          <div className="camera-opts-row">
            <div className="cam-select-wrap">
              <label>Cámara:</label>
              <select
                value={selectedDevice}
                onChange={(e) => handleDeviceChange(e.target.value)}
                className="select-dropdown"
              >
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Cámara ${d.deviceId.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="control-item checkbox-item">
              <label>Blanco y negro:</label>
              <input
                type="checkbox"
                checked={bwMode}
                onChange={(e) => setBwMode(e.target.checked)}
              />
            </div>
          </div>

          <div className="shutter-row">
            <button
              className="shutter-button"
              onClick={takeSnapshot}
              title="Disparar foto e imprimir"
              disabled={!active}
            >
              <span className="shutter-inner" />
            </button>
            <span className="shutter-caption">Disparar / Imprimir</span>
          </div>
        </div>
      </div>
    </div>
  );
};
