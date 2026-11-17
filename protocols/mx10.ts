// Protocolo MX10 / V5G y algoritmos de procesamiento de imagen en Canvas
import type { DitherMode } from '../types';

export const PRINT_W = 384;

// Tabla para invertir bits (LSB-first)
export const REV_TABLE = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  let b = 0;
  for (let j = 0; j < 8; j++) {
    if ((i >> j) & 1) b |= 1 << (7 - j);
  }
  REV_TABLE[i] = b;
}

export function crc8(data: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x80) ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc;
}

export function frame(cmd: number, payload: Uint8Array = new Uint8Array(0)): Uint8Array {
  const n = payload.length;
  const out = new Uint8Array(6 + n + 2);
  out[0] = 0x51;
  out[1] = 0x78;
  out[2] = cmd;
  out[3] = 0x00;
  out[4] = n & 0xff;
  out[5] = (n >> 8) & 0xff;
  out.set(payload, 6);
  out[6 + n] = crc8(payload);
  out[6 + n + 1] = 0xff;
  return out;
}

export const A3 = new Uint8Array([0x51, 0x78, 0xa3, 0x00, 0x01, 0x00, 0x00, 0x00, 0xff]);
export const A4_QUALITY_3 = new Uint8Array([0x51, 0x78, 0xa4, 0x00, 0x01, 0x00, 0x33, 0x99, 0xff]);
export const A6_START = new Uint8Array([0x51, 0x78, 0xa6, 0x00, 0x0b, 0x00, 0xaa, 0x55, 0x17, 0x38, 0x44, 0x5f, 0x5f, 0x5f, 0x44, 0x38, 0x2c, 0xa1, 0xff]);
export const A6_END = new Uint8Array([0x51, 0x78, 0xa6, 0x00, 0x0b, 0x00, 0xaa, 0x55, 0x17, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x17, 0x11, 0xff]);
export const A1_FEED = new Uint8Array([0x51, 0x78, 0xa1, 0x00, 0x02, 0x00, 0x30, 0x00, 0xf9, 0xff]);
export const A8 = new Uint8Array([0x51, 0x78, 0xa8, 0x00, 0x01, 0x00, 0x00, 0x00, 0xff]);

export function speed10(): Uint8Array {
  return frame(0xbd, new Uint8Array([0x0a]));
}

export function feed(lines: number = 0x60): Uint8Array {
  return frame(0xa1, new Uint8Array([lines & 0xff, (lines >> 8) & 0xff]));
}

export function concatBuffers(buffers: Uint8Array[]): Uint8Array {
  const total = buffers.reduce((acc, b) => acc + b.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const b of buffers) {
    out.set(b, offset);
    offset += b.length;
  }
  return out;
}

// ── Binarización y Dithering en ImageData ───────────────────────────────────

export function autoContrastGrayscale(gray: Float32Array, len: number) {
  let min = 255;
  let max = 0;
  for (let i = 0; i < len; i++) {
    if (gray[i] < min) min = gray[i];
    if (gray[i] > max) max = gray[i];
  }
  const range = max - min;
  if (range > 10) {
    for (let i = 0; i < len; i++) {
      gray[i] = Math.max(0, Math.min(255, ((gray[i] - min) / range) * 255));
    }
  }
}

export function binarizeImageData(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mode: DitherMode = 'threshold',
  opts: {
    threshold?: number;
    halftoneCell?: number;
    autoLevels?: boolean;
    mirror?: boolean;
    rotate?: boolean;
  } = {}
): ImageData {
  const src = ctx.getImageData(0, 0, width, height);
  const data = src.data;
  const len = width * height;
  const gray = new Float32Array(len);

  // Extraer escala de grises (luminosidad estándar)
  for (let y = 0; y < height; y++) {
    const srcY = opts.rotate ? (height - 1 - y) : y;
    for (let x = 0; x < width; x++) {
      const srcX = opts.rotate ? (width - 1 - x) : (opts.mirror ? (width - 1 - x) : x);
      const idx = (srcY * width + srcX) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      gray[y * width + x] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
  }

  if (opts.autoLevels) {
    autoContrastGrayscale(gray, len);
  }

  const outImg = ctx.createImageData(width, height);
  const out = outImg.data;
  const th = opts.threshold ?? 190;
  const cellSize = opts.halftoneCell ?? 8;

  if (mode === 'threshold') {
    for (let i = 0; i < len; i++) {
      const isBlack = gray[i] < th;
      const v = isBlack ? 0 : 255;
      const oIdx = i * 4;
      out[oIdx] = v;
      out[oIdx + 1] = v;
      out[oIdx + 2] = v;
      out[oIdx + 3] = 255;
    }
  } else if (mode === 'floyd') {
    // Floyd-Steinberg: 7/16, 3/16, 5/16, 1/16
    const buf = new Float32Array(gray);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const oldVal = buf[i];
        const newVal = oldVal >= 128 ? 255 : 0;
        const err = oldVal - newVal;
        const oIdx = i * 4;
        out[oIdx] = newVal;
        out[oIdx + 1] = newVal;
        out[oIdx + 2] = newVal;
        out[oIdx + 3] = 255;

        if (x + 1 < width) buf[i + 1] += err * (7 / 16);
        if (y + 1 < height) {
          if (x > 0) buf[i + width - 1] += err * (3 / 16);
          buf[i + width] += err * (5 / 16);
          if (x + 1 < width) buf[i + width + 1] += err * (1 / 16);
        }
      }
    }
  } else if (mode === 'atkinson') {
    // Atkinson: difusión de 6/8 del error
    const buf = new Float32Array(gray);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const oldVal = buf[i];
        const newVal = oldVal >= 128 ? 255 : 0;
        const err = (oldVal - newVal) / 8.0;
        const oIdx = i * 4;
        out[oIdx] = newVal;
        out[oIdx + 1] = newVal;
        out[oIdx + 2] = newVal;
        out[oIdx + 3] = 255;

        const neighbors = [
          [x + 1, y], [x + 2, y],
          [x - 1, y + 1], [x, y + 1], [x + 1, y + 1],
          [x, y + 2]
        ];
        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            buf[ny * width + nx] += err;
          }
        }
      }
    }
  } else if (mode === 'halftone') {
    // Halftone circular
    for (let i = 0; i < len * 4; i += 4) {
      out[i] = 255;
      out[i + 1] = 255;
      out[i + 2] = 255;
      out[i + 3] = 255;
    }
    const maxR = (cellSize / 2.0) * 0.95;
    for (let y0 = 0; y0 < height; y0 += cellSize) {
      for (let x0 = 0; x0 < width; x0 += cellSize) {
        const x1 = Math.min(x0 + cellSize, width);
        const y1 = Math.min(y0 + cellSize, height);
        let sum = 0;
        let count = 0;
        for (let yy = y0; yy < y1; yy++) {
          for (let xx = x0; xx < x1; xx++) {
            sum += gray[yy * width + xx];
            count++;
          }
        }
        const avg = sum / (count || 1);
        const r = (1.0 - avg / 255.0) * maxR;
        if (r >= 0.5) {
          const cx = (x0 + x1) / 2.0;
          const cy = (y0 + y1) / 2.0;
          const rSq = r * r;
          const startY = Math.max(0, Math.floor(cy - r));
          const endY = Math.min(height - 1, Math.ceil(cy + r));
          const startX = Math.max(0, Math.floor(cx - r));
          const endX = Math.min(width - 1, Math.ceil(cx + r));

          for (let py = startY; py <= endY; py++) {
            for (let px = startX; px <= endX; px++) {
              const dx = px - cx;
              const dy = py - cy;
              if (dx * dx + dy * dy <= rSq) {
                const idx = (py * width + px) * 4;
                out[idx] = 0;
                out[idx + 1] = 0;
                out[idx + 2] = 0;
              }
            }
          }
        }
      }
    }
  }

  return outImg;
}

// ── Conversión de Canvas a Comandos MX10 ────────────────────────────────────

export function canvasToMx10Raster(
  canvas: HTMLCanvasElement,
  mode: DitherMode = 'threshold',
  opts: {
    threshold?: number;
    halftoneCell?: number;
    autoLevels?: boolean;
    mirror?: boolean;
    rotate?: boolean;
    bitOrder?: 'lsb' | 'msb';
  } = {}
): Uint8Array {
  const w = PRINT_W;
  const h = canvas.height;
  const ctx = canvas.getContext('2d')!;
  const binImg = binarizeImageData(ctx, w, h, mode, opts);
  const data = binImg.data;
  const isLsb = (opts.bitOrder ?? 'lsb') === 'lsb';

  const chunks: Uint8Array[] = [];
  const bytesPerLine = w / 8; // 48 bytes

  for (let y = 0; y < h; y++) {
    const row = new Uint8Array(bytesPerLine);
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      // Negro si RGB < 128
      const isBlack = data[idx] < 128;
      if (isBlack) {
        row[Math.floor(x / 8)] |= 1 << (7 - (x % 8));
      }
    }
    // Si es LSB, invertir bits
    if (isLsb) {
      for (let b = 0; b < bytesPerLine; b++) {
        row[b] = REV_TABLE[row[b]];
      }
    }
    chunks.push(frame(0xa2, row));
  }

  return concatBuffers(chunks);
}

export function wrapJob(rasterData: Uint8Array): Uint8Array {
  return concatBuffers([
    A3,
    A4_QUALITY_3,
    A6_START,
    rasterData,
    speed10(),
    feed(0x60),
    A6_END,
    A8,
    A3,
  ]);
}

// ── Generador de Texto a Canvas ─────────────────────────────────────────────

export function renderTextImage(text: string, fontSize: number = 24): HTMLCanvasElement {
  const w = PRINT_W;
  const margin = 12;
  const maxW = w - margin * 2;
  const dummyCanvas = document.createElement('canvas');
  const dCtx = dummyCanvas.getContext('2d')!;
  dCtx.font = `bold ${fontSize}px sans-serif`;

  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    const words = para.split(' ');
    let current = '';
    for (const word of words) {
      const trial = current ? `${current} ${word}` : word;
      if (dCtx.measureText(trial).width <= maxW) {
        current = trial;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }

  const lineHeight = Math.round(fontSize * 1.35);
  const totalH = Math.max(lines.length * lineHeight + margin * 2, 40);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, totalH);

  ctx.fillStyle = '#000000';
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textBaseline = 'top';

  lines.forEach((line, i) => {
    ctx.fillText(line, margin, margin + i * lineHeight);
  });

  return canvas;
}

// ── Generador de Hoja de Calibración / Prueba Técnica (10 Secciones) ────────

export function renderTestPage(
  deviceName: string = 'MX10',
  address: string = '',
  bitOrder: string = 'lsb',
  mirror: boolean = false,
  rotate: boolean = false,
  threshold: number = 190
): HTMLCanvasElement {
  const W = PRINT_W;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = 2700;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, canvas.height);
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';

  const M = 10;
  let y = 10;

  const centerText = (txt: string, font: string) => {
    ctx.font = font;
    const tw = ctx.measureText(txt).width;
    ctx.fillText(txt, (W - tw) / 2, y);
    y += parseInt(font.match(/\d+/)![0], 10) + 6;
  };

  const section = (num: number, title: string) => {
    y += 10;
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`${num} · ${title}`, M, y);
    y += 16;
    ctx.beginPath();
    ctx.moveTo(M, y);
    ctx.lineTo(W - M, y);
    ctx.stroke();
    y += 8;
  };

  const note = (txt: string) => {
    ctx.font = '10px sans-serif';
    const words = txt.split(' ');
    let cur = '';
    for (const w of words) {
      const trial = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(trial).width <= W - M * 2) {
        cur = trial;
      } else {
        ctx.fillText(cur, M, y);
        y += 13;
        cur = w;
      }
    }
    if (cur) {
      ctx.fillText(cur, M, y);
      y += 15;
    }
  };

  // ── Encabezado
  centerText('PRINTER STUDIO WEB', 'bold 24px sans-serif');
  centerText('PRUEBA TÉCNICA · MX10 / V5G', 'bold 14px monospace');
  y += 4;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  ctx.font = '11px monospace';
  ctx.fillText(`Fecha     ${now}`, M, y); y += 14;
  ctx.fillText(`Equipo    ${deviceName} ${address.slice(-8)}`, M, y); y += 14;
  ctx.fillText(`Cabezal   ${W} px = ${W / 8} bytes/línea`, M, y); y += 14;
  ctx.fillText(`BIT_ORDER ${bitOrder}  MIRROR ${mirror}  ROTATE ${rotate}`, M, y); y += 14;
  ctx.fillText(`UMBRAL    ${threshold} (más alto = más negro)`, M, y); y += 14;

  // 1 · Orientación
  section(1, 'ORIENTACIÓN');
  const top1 = y;
  // Flecha izq
  ctx.beginPath();
  ctx.moveTo(M, top1 + 10);
  ctx.lineTo(M + 14, top1 + 2);
  ctx.lineTo(M + 14, top1 + 18);
  ctx.fill();
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('IZQ', M + 20, top1 + 14);

  // Flecha der
  ctx.beginPath();
  ctx.moveTo(W - M, top1 + 10);
  ctx.lineTo(W - M - 14, top1 + 2);
  ctx.lineTo(W - M - 14, top1 + 18);
  ctx.fill();
  ctx.fillText('DER', W - M - 48, top1 + 14);

  // F R 7
  ctx.font = 'bold 58px sans-serif';
  ctx.fillText('F', W / 2 - 60, top1 + 55);
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('R', W / 2 - 6, top1 + 55);
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('7', W / 2 + 28, top1 + 55);
  y = top1 + 75;
  note('Si «F R 7» se lee normal, la orientación es correcta.');

  // 2 · Regla
  section(2, 'REGLA · ANCHO ÚTIL 384 px');
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(W - 1, y);
  for (let x = 0; x <= W; x += 8) {
    const xx = Math.min(x, W - 1);
    const ln = x % 48 === 0 ? 12 : (x % 16 === 0 ? 7 : 4);
    ctx.moveTo(xx, y);
    ctx.lineTo(xx, y + ln);
  }
  ctx.stroke();
  ctx.font = '9px monospace';
  for (let x = 0; x <= W; x += 48) {
    ctx.fillText(`${x}`, Math.min(Math.max(x - 8, 2), W - 24), y + 22);
  }
  y += 32;
  note('Deben verse los dos bordes (0 y 384). Si falta uno, el cabezal recorta.');

  // 3 · Bytes y Bits
  section(3, 'BYTES (48) Y BITS');
  for (let i = 0; i < W / 8; i++) {
    if (i % 2 === 0) {
      ctx.fillRect(i * 8, y, 8, 12);
    }
  }
  y += 16;
  for (let k = 0; k < 8; k++) {
    ctx.fillRect(k, y + k * 2, 2, 2);
    ctx.fillRect(W - 8 + k, y + (7 - k) * 2, 2, 2);
  }
  ctx.font = '10px sans-serif';
  ctx.fillText('peldaño de 8 bits ↔ inverso a la derecha', 24, y + 10);
  y += 22;
  note('48 bloques iguales de 8 px; el primero (izq.) es negro.');

  // 4 · Líneas finas
  section(4, 'LÍNEAS FINAS 1-4 px');
  const bw = 82;
  const gap = 8;
  for (let k = 0; k < 4; k++) {
    const x0 = M + 2 + k * (bw + gap);
    const lw = k + 1;
    let xx = x0;
    while (xx + lw <= x0 + bw) {
      ctx.fillRect(xx, y, lw, 18);
      xx += lw * 2;
    }
    let yy = y + 22;
    while (yy + lw <= y + 22 + 18) {
      ctx.fillRect(x0, yy, bw, lw);
      yy += lw * 2;
    }
  }
  y += 46;
  note('Anchos 1, 2, 3 y 4 px. Las de 1 px deben verse separadas.');

  // 5 · Tramas
  section(5, 'TRAMAS (tablero y diagonal)');
  for (let k = 0; k < 3; k++) {
    const cs = [1, 2, 4][k];
    const x0 = M + 2 + k * (bw + gap);
    for (let yy = 0; yy < 22; yy++) {
      for (let xx = 0; xx < bw; xx++) {
        if (((Math.floor(xx / cs) + Math.floor(yy / cs)) % 2) === 0) {
          ctx.fillRect(x0 + xx, y + yy, 1, 1);
        }
      }
    }
  }
  const x0Diag = M + 2 + 3 * (bw + gap);
  ctx.strokeRect(x0Diag, y, bw, 22);
  ctx.beginPath();
  for (let xx = -22; xx < bw; xx += 6) {
    ctx.moveTo(x0Diag + xx, y + 22);
    ctx.lineTo(x0Diag + xx + 22, y);
  }
  ctx.stroke();
  y += 30;
  note('Tablero 1 / 2 / 4 px y rayado diagonal. Sin bandas verticales.');

  // 6 · Densidad
  section(6, 'DENSIDAD Y NEGRO TOTAL');
  ctx.fillRect(0, y, W, 16);
  y += 20;
  const shades = [200, 150, 100, 50];
  for (let k = 0; k < 4; k++) {
    ctx.fillStyle = `rgb(${shades[k]},${shades[k]},${shades[k]})`;
    ctx.fillRect(k * 96 + 2, y, 92, 22);
  }
  ctx.fillStyle = '#000000';
  y += 28;
  note('Barra negra 100% uniforme. Debajo: 20%, 40%, 60% y 80% de negro.');

  // 7 · Umbral 16 niveles
  section(7, 'UMBRAL · 16 NIVELES DE GRIS');
  const stepW = Math.floor(W / 16);
  for (let k = 0; k < 16; k++) {
    const g = Math.round((k * 255) / 15);
    ctx.fillStyle = `rgb(${g},${g},${g})`;
    ctx.fillRect(k * stepW, y, stepW, 20);
  }
  y += 22;
  ctx.fillStyle = '#000000';
  ctx.font = '9px monospace';
  for (let k = 0; k < 16; k++) {
    ctx.fillText(`${k + 1}`, k * stepW + 4, y + 10);
  }
  y += 18;
  note(`Prueba de gradientes de 16 niveles con corte por umbral.`);

  // 8 · Geometría
  section(8, 'GEOMETRÍA (avance y proporción)');
  const s = 65;
  ctx.strokeRect(M + 8, y, s, s);
  ctx.beginPath();
  ctx.moveTo(M + 8, y); ctx.lineTo(M + 8 + s, y + s);
  ctx.moveTo(M + 8, y + s); ctx.lineTo(M + 8 + s, y);
  ctx.stroke();

  const cx = M + 8 + s + 24;
  ctx.beginPath();
  ctx.arc(cx + s / 2, y + s / 2, s / 2, 0, Math.PI * 2);
  ctx.stroke();

  const tx = cx + s + 24;
  ctx.beginPath();
  ctx.moveTo(tx + s / 2, y);
  ctx.lineTo(tx + s, y + s);
  ctx.lineTo(tx, y + s);
  ctx.closePath();
  ctx.stroke();
  y += s + 10;
  note('Cuadrado y círculo redondos = avance de papel exacto.');

  // 9 · Texto y Pie
  section(9, 'TEXTO Y CARACTERES');
  [10, 12, 16, 20].forEach((sz) => {
    ctx.font = `bold ${sz}px sans-serif`;
    ctx.fillText(`${sz}px  Hola Mundo 0123456789`, M, y + sz);
    y += sz + 6;
  });
  ctx.font = '12px sans-serif';
  ctx.fillText('ÁÉÍÓÚ áéíóú ÑñÜü ¿?¡! @#%&*()', M, y + 14);
  y += 26;

  // Pie
  ctx.beginPath();
  for (let x = 0; x < W; x += 12) {
    ctx.moveTo(x, y);
    ctx.lineTo(x + 6, y);
  }
  ctx.stroke();
  y += 14;
  centerText('FIN DE LA PRUEBA · PRINTER STUDIO WEB', 'bold 12px monospace');
  y += 10;

  // Recortar al alto exacto
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = W;
  finalCanvas.height = y;
  const fCtx = finalCanvas.getContext('2d')!;
  fCtx.drawImage(canvas, 0, 0, W, y, 0, 0, W, y);
  fCtx.strokeStyle = '#000000';
  fCtx.lineWidth = 2;
  fCtx.strokeRect(0, 0, W, y);
  return finalCanvas;
}

// ── Prueba Rápida (Marco + Barras) ──────────────────────────────────────────

export function renderQuickTestRaster(): Uint8Array {
  const height = 64;
  const chunks: Uint8Array[] = [];
  const bytesPerLine = PRINT_W / 8;

  for (let y = 0; y < height; y++) {
    const row = new Uint8Array(bytesPerLine);
    for (let x = 0; x < PRINT_W; x++) {
      let isBlack = false;
      if (y === 0 || y === height - 1 || x === 0 || x === PRINT_W - 1) {
        isBlack = true;
      }
      if (y >= 20 && y < 44 && x >= 40 && x < 344) {
        if (Math.floor(x / 8) % 2 === 0) isBlack = true;
      }
      if (isBlack) {
        row[Math.floor(x / 8)] |= 1 << (7 - (x % 8));
      }
    }
    // LSB reverse
    for (let b = 0; b < bytesPerLine; b++) {
      row[b] = REV_TABLE[row[b]];
    }
    chunks.push(frame(0xa2, row));
  }

  return concatBuffers([
    A3,
    A4_QUALITY_3,
    A6_START,
    concatBuffers(chunks),
    speed10(),
    feed(0x50),
    A6_END,
    A8,
    A3,
  ]);
}
