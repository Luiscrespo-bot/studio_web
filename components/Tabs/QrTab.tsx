import React, { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import { Download, Printer, Eye } from 'lucide-react';
import { BlePrinterManager } from '../../protocols/blePrinter';
import { PRINT_W, canvasToMx10Raster, wrapJob } from '../../protocols/mx10';

interface QrTabProps {
  printer: BlePrinterManager;
  onPreview: (canvas: HTMLCanvasElement, onConfirm: () => void) => void;
  addToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const QrTab: React.FC<QrTabProps> = ({
  printer,
  onPreview,
  addToast,
}) => {
  const [data, setData] = useState('https://github.com/google-deepmind');
  const [boxSize, setBoxSize] = useState(6);
  const [border, setBorder] = useState(4);
  const [info, setInfo] = useState('');
  const [hasQr, setHasQr] = useState(false);
  const [printing, setPrinting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generateQr = async () => {
    if (!data.trim()) {
      addToast('Escribe un texto o URL para el código QR.', 'info');
      return;
    }

    try {
      // Generar imagen de QR temporal
      const tempCanvas = document.createElement('canvas');
      await QRCode.toCanvas(tempCanvas, data, {
        scale: boxSize,
        margin: border,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });

      const qrW = tempCanvas.width;
      const qrH = tempCanvas.height;
      const finalH = Math.max(qrH + 20, 100);

      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = PRINT_W;
      canvas.height = finalH;

      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, PRINT_W, finalH);

      // Centrar el QR en el ancho del cabezal térmico (384 px)
      const posX = Math.max(0, Math.floor((PRINT_W - qrW) / 2));
      const posY = Math.max(0, Math.floor((finalH - qrH) / 2));
      ctx.drawImage(tempCanvas, posX, posY);

      setHasQr(true);
      setInfo(`QR generado • ${PRINT_W} × ${finalH} px • ${data.length} caracteres`);
      addToast('Código QR generado.', 'info');
    } catch (err: any) {
      addToast(`Error al generar QR: ${err.message || err}`, 'error');
    }
  };

  useEffect(() => {
    generateQr();
  }, [boxSize, border]);

  const handleSave = () => {
    if (!canvasRef.current || !hasQr) return;
    const link = document.createElement('a');
    link.download = `qrcode_${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
    addToast('Código QR guardado como PNG.', 'success');
  };

  const handlePrint = () => {
    if (!canvasRef.current || !hasQr) return;
    const c = canvasRef.current;

    onPreview(c, async () => {
      if (!printer.connected) {
        addToast('Conecta la impresora en Conexiones primero.', 'error');
        return;
      }
      setPrinting(true);
      addToast('Enviando código QR a la impresora...', 'info');
      try {
        const raster = canvasToMx10Raster(c, 'threshold', { threshold: 190 });
        const job = wrapJob(raster);
        await printer.sendData(job);
        addToast('✔ Código QR impreso exitosamente.', 'success');
      } catch (err: any) {
        addToast(`Error al imprimir QR: ${err.message || err}`, 'error');
      } finally {
        setPrinting(false);
      }
    });
  };

  return (
    <div className="tab-container">
      <div className="tab-header">
        <h1>QR Code → Imprimir</h1>
        <p className="tab-subtitle">
          Genera códigos QR de alta legibilidad e imprímelos directamente en la MX10.
        </p>
      </div>

      <div className="cards-stack">
        <div className="image-preview-card qr-preview-box">
          <canvas
            ref={canvasRef}
            className="thermal-canvas-preview"
            style={{ maxWidth: '384px' }}
          />
        </div>

        <div className="panel-card">
          <div className="qr-input-group">
            <label>Texto o URL:</label>
            <div className="input-with-button">
              <input
                type="text"
                value={data}
                onChange={(e) => setData(e.target.value)}
                placeholder="https://ejemplo.com o cualquier texto"
                onKeyDown={(e) => e.key === 'Enter' && generateQr()}
              />
              <button className="btn-accent" onClick={generateQr}>
                <Eye size={16} /> Generar QR
              </button>
            </div>
          </div>

          <div className="controls-grid-opts qr-opts-grid">
            <div className="control-item">
              <label>
                Tamaño módulo: <b>{boxSize} px</b>
              </label>
              <input
                type="range"
                min="3"
                max="10"
                value={boxSize}
                onChange={(e) => setBoxSize(parseInt(e.target.value, 10))}
              />
            </div>

            <div className="control-item">
              <label>
                Borde / Margen: <b>{border}</b>
              </label>
              <input
                type="range"
                min="1"
                max="8"
                value={border}
                onChange={(e) => setBorder(parseInt(e.target.value, 10))}
              />
            </div>
          </div>

          <div className="image-toolbar-top" style={{ marginTop: '16px' }}>
            <button
              className="btn-green"
              onClick={handleSave}
              disabled={!hasQr}
            >
              <Download size={16} /> Guardar PNG
            </button>
            <button
              className="btn-gold"
              onClick={handlePrint}
              disabled={!hasQr || printing}
            >
              <Printer size={16} /> Imprimir QR
            </button>
          </div>

          {info && <p className="dim-sub qr-meta-info">{info}</p>}
        </div>
      </div>
    </div>
  );
};
