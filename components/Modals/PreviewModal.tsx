import React, { useEffect, useRef } from 'react';
import { Printer, X, Check } from 'lucide-react';

interface PreviewModalProps {
  canvas: HTMLCanvasElement | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  canvas,
  onConfirm,
  onCancel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && canvas) {
      containerRef.current.innerHTML = '';
      const displayCanvas = document.createElement('canvas');
      displayCanvas.width = canvas.width;
      displayCanvas.height = canvas.height;
      const ctx = displayCanvas.getContext('2d')!;
      ctx.drawImage(canvas, 0, 0);
      displayCanvas.style.width = '100%';
      displayCanvas.style.height = 'auto';
      displayCanvas.style.imageRendering = 'pixelated';
      displayCanvas.style.backgroundColor = '#ffffff';
      displayCanvas.style.boxShadow = '0 8px 30px rgba(0,0,0,0.5)';
      containerRef.current.appendChild(displayCanvas);
    }
  }, [canvas]);

  if (!canvas) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card preview-modal">
        <div className="modal-header">
          <div className="title-row">
            <Printer size={20} className="gold-icon" />
            <div>
              <h3>Vista Previa de Impresión</h3>
              <p className="dim-sub">Esto es exactamente lo que verás impreso en el papel térmico (384 px).</p>
            </div>
          </div>
          <button className="btn-icon" onClick={onCancel} title="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="preview-body" ref={containerRef} />

        <div className="preview-meta">
          <span>Resolución: <b>{canvas.width} × {canvas.height} px</b></span>
          <span>•</span>
          <span>Cabezal térmico: <b>384 puntos (48 bytes/línea)</b></span>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>
            <X size={16} /> Cancelar
          </button>
          <button className="btn-gold" onClick={onConfirm}>
            <Check size={16} /> Confirmar e Imprimir
          </button>
        </div>
      </div>
    </div>
  );
};

