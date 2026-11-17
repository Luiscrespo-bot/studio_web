# MX10 Studio & TCL Smart Remote Web

Aplicación web integral construida en **TSX, JavaScript, CSS y HTML** que reúne en una sola interfaz modular y moderna:
1. **Impresora Térmica MX10 (Bluetooth LE)**: Motor gráfico completo de 384 px, dithering avanzado (Floyd-Steinberg, Atkinson, Halftone, Umbral), generador de página de calibración de 10 secciones y test rápido.
2. **Tira LED RGB Miracles Star (Bluetooth LE)**: Control de color, rampa de brillo, velocidades, efectos internos, visualizador Web Audio API reactivo al micrófono en tiempo real y prueba técnica automatizada con diagnóstico.
3. **Control Remoto TCL Android TV (Wi-Fi)**: Mando a distancia completo con D-Pad, teclado virtual QWERTY completo, accesos directos a streaming (YouTube, Netflix, Prime Video, Disney+) y polling de estado.

---

## 📁 Estructura del Proyecto (`studio_web/`)

```
studio_web/
├── index.html                   # Documento HTML principal con fuentes y viewport
├── package.json                 # Dependencias (React 19, Lucide, QRCode, Vite)
├── tsconfig.json                # Configuración TypeScript
├── tsconfig.app.json
├── vite.config.ts               # Bundler y plugin de React
├── start_web.bat                # Script de inicio rápido de 1 clic para Windows
├── README.md                    # Este archivo de documentación
├── dist/                        # Compilación de producción (HTML, CSS y JS optimizados)
│   ├── index.html
│   └── assets/
└── src/
    ├── main.tsx                 # Entrada React (createRoot)
    ├── App.tsx                  # Componente principal, estado global, modales y toasts
    ├── index.css                # Estilos globales oscuros (tema CustomTkinter dark gold/accent)
    ├── types.ts                 # Definiciones e interfaces TypeScript
    ├── protocols/
    │   ├── mx10.ts              # Driver de impresora MX10, empaquetador LSB, CRC8 y dithering
    │   ├── blePrinter.ts        # Administrador Web Bluetooth LE para MX10 + simulador
    │   ├── ledStrip.ts          # Driver Miracles Star (0xBC...0x55), paquetes HSV y prueba técnica
    │   ├── audioEngine.ts       # Motor Web Audio API (FFT, espectro, detección de beats)
    │   └── tclRemote.ts         # Cliente TCL Android TV Remote v2 (REST bridge + simulador)
    └── components/
        ├── Sidebar.tsx          # Barra lateral de navegación con 7 pestañas e indicadores
        ├── Modals/
        │   ├── PreviewModal.tsx # Modal de vista previa en rollo de papel de 384 px
        │   └── PairModal.tsx    # Modal interactivo de emparejamiento con código para TV
        └── Tabs/
            ├── ConnTab.tsx      # Tab 1: Conexiones (MX10 BLE, LED BLE, TCL Wi-Fi)
            ├── PrinterTab.tsx   # Tab 2: Impresora (Texto dinámico, test 10 secciones, test rápido)
            ├── ImageTab.tsx     # Tab 3: Imagen (Subida, 4 modos de dither, umbrales, contraste)
            ├── CameraTab.tsx    # Tab 4: Cámara (Webcam en vivo, filtro B/N, snapshot térmico)
            ├── QrTab.tsx        # Tab 5: QR Code (Generación precisa a 384 px, márgenes, guardado)
            ├── LedTab.tsx       # Tab 6: Tira LED (RGB, brillo, mic de tira, Web Audio PC, prueba técnica)
            └── TclTab.tsx       # Tab 7: Control TV (D-Pad, accesos streaming, teclado virtual completo)
```

---

## 🚀 Cómo Iniciar la Aplicación

### Opción 1: Con el lanzador rápido (Windows)
Haz doble clic sobre el archivo:
```
studio_web/start_web.bat
```
El script iniciará el servidor local y abrirá automáticamente tu navegador en `http://localhost:5173`.

### Opción 2: Desde la terminal
Dentro de la carpeta `studio_web`:
```bash
# Iniciar modo desarrollo
npm run dev

# O compilar para producción
npm run build

# Previsualizar la compilación de producción
npm run preview
```

---

## 🛠️ Tecnologías y Características Implementadas

### 1. TSX y TypeScript Estricto
- Definición de tipos completa (`types.ts`) para estados de hardware, algoritmos de dither, paquetes Bluetooth y eventos de red.
- Compatible con `verbatimModuleSyntax` y `erasableSyntaxOnly`.

### 2. Protocolo de Impresión Térmica MX10 (384 px)
- **Cabezal de 384 puntos**: Cada línea de impresión corresponde exactamente a 48 bytes empaquetados con inversión de bits LSB-first (`REV_TABLE`).
- **Comandos V5G**: Encabezados de trama `0x51 0x78`, comando de raster `0xA2`, `0xA9` y avance de papel `0xA1`. Checksum CRC8 idéntico al implementado en hardware.
- **Dithering de alto rendimiento**:
  - *Umbral Simple*: Binarización directa con ajuste de punto de corte (0–255).
  - *Floyd-Steinberg*: Difusión de error bidireccional suave ideal para retratos y fotos.
  - *Atkinson*: Algoritmo clásico de MacPaint con difusión selectiva de 3/4 de error, conservando detalles nítidos.
  - *Medio Tono (Halftone)*: Tramado de puntos simulado de imprenta con tamaño de celda personalizable (2 a 12 px).
- **Página de Calibración Técnica (10 Secciones)**:
  1. Cabecera técnica y fecha.
  2. Guías de alineación de márgenes (384 px exactos).
  3. Escalera de grises binarizada con tramado.
  4. Patrones de resolución (rejillas de 1, 2 y 4 px).
  5. Rampa continua de gradiente.
  6. Muestrario tipográfico (8, 10, 12, 16, 20 y 24 pt con caracteres acentuados y símbolos).
  7. Código de barras Code128 de alta definición centrado.
  8. Microcódigo QR legible por smartphones.
  9. Patrón de comprobación de inyectores térmicos/puntos quemados.
  10. Métricas del sistema y firma técnica.

### 3. Tira LED RGB BLE y Web Audio
- **Protocolo Miracles Star**: Tramas con encabezado `0xBC`, longitud, payload HSV/efectos y pie de trama `0x55`.
- **Audio Reactivo con Web Audio API**: Captura del micrófono del ordenador mediante `getUserMedia({ audio: true })`, análisis FFT en tiempo real con 128 bandas de frecuencia, visualizador Canvas de espectro sonoro, vúmetro y modulación de color y brillo en función de graves y beats.
- **Prueba Técnica Automatizada**: Rutina de verificación de 14 pasos (parpadeo de confirmación, prueba de primarios rojo/verde/azul, barrido de matiz HUE a 360°, comprobación de saturación, rampa de brillo 3–1000, efectos internos 1 a 4 y sensibilidad de micrófono).

### 4. TCL Android TV Remote v2 (Wi-Fi)
- Navegación D-Pad con botones de dirección, OK, Home, Back, Play/Pause, Menú, Ajustes y selector de Canales/Volumen.
- Accesos directos a aplicaciones de streaming (YouTube, Netflix, Prime Video, Disney+).
- Teclado virtual QWERTY completo interactivo en pantalla y envío de texto mediante IME a Android TV.
- Soporte dual: Conexión mediante el puente REST local `:8765` o modo simulador interactivo integrado para pruebas sin televisor encendido.
