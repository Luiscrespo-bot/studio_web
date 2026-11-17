import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Download, Printer, Sliders } from 'lucide-react';
import { BlePrinterManager } from '../../protocols/blePrinter';
import {
  PRINT_W,
  binarizeImageData,
  canvasToMx10Raster,
  wrapJob,
} from '../../protocols/mx10';
import type { DitherMode } from '../../types';

interface ImageTabProps {
  printer: BlePrinterManager;
  onPreview: (canvas: HTMLCanvasElement, onConfirm: () => void) => void;
  addToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const ImageTab: React.FC<ImageTabProps> = ({
  printer,
  onPreview,
  addToast,
}) => {
  const [sourceImg, setSourceImg] = useState<HTMLImageElement | null>(null);
  const [mode, setMode] = useState<DitherMode>('threshold');
  const [threshold, setThreshold] = useState<number>(190);
  const [halftoneCell, setHalftoneCell] = useState<number>(8);
  const [autoLevels, setAutoLevels] = useState<boolean>(false);
  const [imageInfo, setImageInfo] = useState<string>('');
  const [printing, setPrinting] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback(() => {
    if (!sourceImg || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const aspect = sourceImg.height / sourceImg.width;
    const newHeight = Math.max(1, Math.round(PRINT_W * aspect));
    canvas.width = PRINT_W;
    canvas.height = newHeight;

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(sourceImg, 0, 0, PRINT_W, newHeight);

    // Aplicar algoritmo seleccionado
    const binImg = binarizeImageData(ctx, PRINT_W, newHeight, mode, {
      threshold,
      halftoneCell,
      autoLevels,
    });
    ctx.putImageData(binImg, 0, 0);

    setImageInfo(`${PRINT_W} × ${newHeight} px · Modo: ${mode}`);
  }, [sourceImg, mode, threshold, halftoneCell, autoLevels]);

  useEffect(() => {
    processImage();
  }, [processImage]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setSourceImg(img);
        addToast(`Imagen cargada: ${file.name}`, 'info');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `printer_image_${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
    addToast('Imagen B/N guardada.', 'success');
  };

  const handlePrint = () => {
    if (!canvasRef.current) return;
    const c = canvasRef.current;
    onPreview(c, async () => {
      if (!printer.connected) {
        addToast('Conecta la impresora primero.', 'error');
        return;
      }
      setPrinting(true);
      addToast('Enviando imagen a la impresora...', 'info');
      try {
        const raster = canvasToMx10Raster(c, mode, {
          threshold,
          halftoneCell,
          autoLevels,
        });
        const job = wrapJob(raster);
        await printer.sendData(job);
        addToast('✔ Imagen impresa con éxito.', 'success');
      } catch (err: any) {
        addToast(`Error al imprimir imagen: ${err.message || err}`, 'error');
      } finally {
        setPrinting(false);
      }
    });
  };

  return (
    <div className="tab-container">
      <div className="tab-header">
        <h1>Imagen → Imprimir</h1>
        <p className="tab-subtitle">
          Sube una foto, ajusta la conversión a blanco y negro y envíala a la impresora térmica.
        </p>
      </div>

      <div className="cards-stack">
        {/* Contenedor de Vista Previa */}
        <div className="image-preview-card">
          {sourceImg ? (
            <div className="canvas-wrapper">
              <canvas ref={canvasRef} className="thermal-canvas-preview" />
            </div>
          ) : (
            <div
              className="dropzone-empty"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={48} className="gold-icon" />
              <p>Haz clic aquí para seleccionar o arrastra una imagen</p>
              <span className="dim-sub">PNG, JPG, WebP, BMP</span>
            </div>
          )}
        </div>

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/*"
          onChange={handleFileUpload}
        />

        {/* Panel de Controles */}
        <div className="panel-card">
          <div className="image-toolbar-top">
            <button
              className="btn-accent"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} /> Subir Imagen
            </button>
            <button
              className="btn-green"
              onClick={handleSave}
              disabled={!sourceImg}
            >
              <Download size={16} /> Guardar B/N
            </button>
            <button
              className="btn-gold"
              onClick={handlePrint}
              disabled={!sourceImg || printing}
            >
              <Printer size={16} /> Enviar a Impresora
            </button>
          </div>

          <div className="controls-grid-opts">
            <div className="control-item">
              <label>Modo de Conversión:</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as DitherMode)}
                className="select-dropdown"
              >
                <option value="threshold">Threshold (Umbral directo)</option>
                <option value="floyd">Floyd-Steinberg (Difusión suave)</option>
                <option value="atkinson">Atkinson (Alto contraste Mac)</option>
                <option value="halftone">Halftone (Trama de puntos)</option>
              </select>
            </div>

            <div className="control-item">
              <label>
                Umbral: <b>{threshold}</b>
              </label>
              <input
                type="range"
                min="0"
                max="255"
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
                disabled={mode !== 'threshold'}
              />
            </div>

            <div className="control-item">
              <label>
                Celda Halftone: <b>{halftoneCell} px</b>
              </label>
              <input
                type="range"
                min="4"
                max="16"
                step="1"
                value={halftoneCell}
                onChange={(e) => setHalftoneCell(parseInt(e.target.value, 10))}
                disabled={mode !== 'halftone'}
              />
            </div>

            <div className="control-item checkbox-item">
              <label>Auto-niveles:</label>
              <input
                type="checkbox"
                checked={autoLevels}
                onChange={(e) => setAutoLevels(e.target.checked)}
              />
            </div>
          </div>

          {imageInfo && (
            <div className="image-status-bar">
              <Sliders size={14} />
              <span>{imageInfo}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
