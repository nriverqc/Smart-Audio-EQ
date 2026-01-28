# Smart Audio EQ - Browser Equalizer

Un potente ecualizador de audio para navegador web que permite mejorar la calidad de sonido en YouTube, Spotify, y cualquier sitio con contenido de audio.

## Características

### Versión Gratis
- ✅ Ecualizador de 6 bandas
- ✅ Presets básicos (Flat, Vocal, Guitar, Bass Light)
- ✅ Control de volumen maestro
- ✅ Analizador espectral en tiempo real
- ✅ Interfaz intuitiva

### Versión Premium
- ✅ Ecualizador de 15 bandas profesional
- ✅ Presets personalizados (guarda tus configuraciones)
- ✅ Presets Pro (Studio, Bass Pro, Gaming, Cinema, EDM, Podcast)
- ✅ Mezclador de pestañas (control de volumen por pestaña)
- ✅ Procesamiento de audio de baja latencia
- ✅ Sincronización en la nube (próximamente)

## Estructura del Proyecto

```
smart-audio-eq/
├── popup/                 # Interfaz de la extensión (React)
│   ├── App.jsx           # Componente principal
│   ├── Equalizer.jsx     # Ecualizador interactivo
│   ├── TabMixer.jsx      # Mezclador de pestañas
│   ├── SpectrumAnalyzer.jsx # Visualizador espectral
│   ├── presets.js        # Definición de presets
│   └── styles.css        # Estilos de la extensión
├── web/                  # Sitio web (React + Vite)
│   ├── src/
│   │   ├── App.jsx       # Enrutamiento principal
│   │   ├── firebase.js   # Configuración de Firebase
│   │   ├── pages/
│   │   │   ├── Home.jsx  # Página de inicio
│   │   │   └── Premium.jsx # Página de compra
│   │   └── index.css     # Estilos globales
│   └── vite.config.js
├── backend/              # API backend (Flask + Python)
│   ├── app.py           # Servidor principal
│   ├── requirements.txt  # Dependencias
│   └── ...
├── audio/               # Procesamiento de audio
│   └── processor.js     # Web Audio API + filtros
├── background.js        # Service worker de la extensión
├── content.js          # Content script
├── manifest.json       # Manifiesto de la extensión
└── vite.config.js      # Configuración de Vite (extensión)
```

## Tecnologías

- **Frontend (Extensión):** React, Vite, Web Audio API
- **Frontend (Web):** React, React Router, Vite, Firebase Auth
- **Pagos:** MercadoPago SDK, PayPal SDK
- **Backend:** Flask, SQLite, Firebase Firestore
- **Cloud:** Deployed en Render (backend), Cloudflare Pages (web)

## Instalación y Desarrollo

### Requisitos
- Node.js 16+ (para frontend)
- Python 3.8+ (para backend)
- npm o yarn

### Instalar dependencias

```bash
# Frontend (extensión + web)
npm install
cd web && npm install

# Backend
cd backend
pip install -r requirements.txt
```

### Desarrollo local

```bash
# Extensión (extension folder)
npm run build

# Web
cd web
npm run dev

# Backend (requiere .env con MERCADOPAGO_TOKEN, etc.)
cd backend
python app.py
```

### Build para producción

```bash
# Extensión
npm run build && npm run zip

# Web
cd web
npm run build
```

## Configuración de Ambiente

Crea un `.env` en la carpeta `backend/`:

```env
MP_ACCESS_TOKEN=your_mercadopago_token
FRONTEND_URL=https://smart-audio-eq.pages.dev
FLASK_ENV=production
```

## Instalación en Chrome

1. Ejecuta `npm run build` en la carpeta raíz
2. Ve a `chrome://extensions`
3. Activa "Modo de desarrollador"
4. Haz clic en "Cargar extensión sin empaquetar"
5. Selecciona la carpeta `dist/`

## API Backend

### Endpoints

- `POST /create-payment` - Crear preferencia de pago en MercadoPago
- `POST /process_payment` - Procesar pago con tarjeta
- `POST /webhook/mercadopago` - Webhook de MercadoPago
- `POST /register-paypal` - Registrar compra de PayPal
- `GET /check-license` - Verificar si usuario es Premium

## Licencia

ISC

## Autor

Smart Audio EQ Development Team - 2026
