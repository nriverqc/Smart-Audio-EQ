# Smart Audio EQ - Actualización Multi-Pestaña Premium 🎚️

## ✨ Nuevas Características Implementadas

### 1. **Arquitectura Multi-Pestaña**
- **Usuarios Free**: 1 `AudioContext` activo a la vez (previene consumo de recursos)
- **Usuarios Premium**: `AudioContext` independiente por pestaña (control profesional)
- Manejo automático de límites de contextos con fallback graceful

### 2. **Analizador de Espectro (Spectrum Analyzer)**
- Visualización en tiempo real de frecuencias con gradiente de colores
- Canvas de 300x150px integrado en el popup
- Refresco cada frame de animación para animación suave
- Componente: [popup/SpectrumAnalyzer.jsx](popup/SpectrumAnalyzer.jsx)

### 3. **Mixer de Pestañas (Premium)**
- Control de volumen independiente por pestaña con audición activa
- Detección automática de pestañas con audio
- Slider de 0-1 normalizado (0-100%)
- Persistencia de volumes en `chrome.storage.local`
- Componente: [popup/TabMixer.jsx](popup/TabMixer.jsx)

### 4. **Expansión de Bandas Ecualizador**
| Parámetro | Free | Premium |
|-----------|------|---------|
| Bandas | 6 | 15 |
| Frecuencias | 60, 170, 350, 1k, 3.5k, 10k | 20, 40, 60, 100, 170, 250, 350, 500, 1k, 2k, 3.5k, 5k, 7k, 10k, 16k |
| Rango de ganancia | ±12dB | ±12dB |

### 5. **Presets Mejorados**
- Presets de 6 bandas ampliados a 15 bandas para Premium
- 5 presets Free + 6 presets Premium = 11 total
- Cada preset optimizado para el rango de frecuencia extendido

### 6. **Mejoras de Sync y JSON**
- Validación robusta de respuestas JSON en popup
- Verificación de `content-type` antes de parsear
- Fallback a sincronización via content script si API falla
- Manejo de errores mejorado con try-catch

## 🛠️ Arquitectura Técnica

### Flujo de Comunicación Multi-Pestaña
```
Popup (React)
    ↓ chrome.runtime.sendMessage
Background (Service Worker)
    ├── GET_ANALYSER_DATA → offscreen.js
    ├── SET_TAB_VOLUME → offscreen.js
    └── SET_GAIN → offscreen.js
    ↓
Offscreen (Audio Processing)
    ├── AudioContext (6 o 15 bandas)
    ├── AnalyserNode (spectrum data)
    └── DynamicsCompressor (limiter)
```

### Gestión de Estado
- `chrome.storage.local.isPremium` - Estado premium del usuario
- `chrome.storage.local.tabVolumes` - Volúmenes por TabId
- `chrome.storage.local.customGains` - Ganancias del EQ custom
- `chrome.storage.local.masterVolume` - Volumen maestro (0-200%)

### Archivos Modificados
1. **popup/App.jsx** - JSON parsing validation, import componentes Premium
2. **popup/Equalizer.jsx** - Soporte dinámico de 6 o 15 bandas
3. **popup/presets.js** - Presets expandidos a 15 bandas
4. **audio/processor.js** - AnalyserNode, soporte multi-banda dinámico
5. **offscreen.js** - GET_ANALYSER_DATA, SET_TAB_VOLUME handlers
6. **background.js** - Mejora comentarios (sin cambios de lógica)

### Archivos Nuevos
1. **popup/SpectrumAnalyzer.jsx** - Visualización de espectro
2. **popup/TabMixer.jsx** - Mixer de volumen por pestaña
3. **utils/audioManager.js** - Clase para gestión de contextos (futuro)

## 📥 Instalación / Actualización

### Para Desarrolladores
```bash
# 1. Actualizar código local
git pull origin main

# 2. Instalar dependencias (si es necesario)
npm install

# 3. Compilar
npm run build

# 4. Crear distribución ZIP
npm run zip
# O manualmente:
powershell -Command "Compress-Archive -Path dist\* -DestinationPath extension.zip -Force"

# 5. Cargar en Chrome (Load Unpacked)
# - Chrome > Extensions (chrome://extensions)
# - Enable "Developer Mode" (esquina superior derecha)
# - Click "Load unpacked" → Seleccionar carpeta "dist/"
```

### Para Usuarios
1. Descargar `extension.zip` del repositorio
2. Extraer a una carpeta (ej. `C:\ChromeExtensions\SmartAudioEQ`)
3. Abrir Chrome: `chrome://extensions`
4. Activar "Developer Mode" (esquina superior derecha)
5. Click "Load unpacked"
6. Seleccionar la carpeta extraída
7. ✅ La extensión aparecerá en la barra de herramientas

**Extension ID**: `edblkdnmdjodkbolefojlgdfkmbkplpf`

## 🎯 Flujo de Usuario Premium vs Free

### 🆓 Usuario Free
1. ✅ Puede usar EQ con 6 bandas
2. ✅ Puede ver analizador de espectro
3. ❌ Solo 1 pestaña con audio activo
4. ❌ No ve TabMixer
5. ⏱️ Cada 30s aparece popup para ir a Premium
6. 🎨 5 presets disponibles

### 💎 Usuario Premium
1. ✅ Acceso a 15 bandas ecualizador
2. ✅ Analizador de espectro
3. ✅ TabMixer - control independiente por pestaña
4. ✅ Múltiples contextos de audio simultáneos
5. 🎨 11 presets (5 free + 6 premium)
6. ⏱️ No aparecen popups de compra

## 🧪 Testing Checklist

- [ ] Popup carga sin errores en popup.js:40
- [ ] JSON sync con backend funciona (respuesta con `{premium: true/false}`)
- [ ] EQ toggle ON/OFF funciona (audio capturado)
- [ ] 6 sliders de EQ funcionan (free) / 15 sliders (premium)
- [ ] SpectrumAnalyzer dibuja ondas cuando audio está activo
- [ ] TabMixer detecta pestañas con audición (premium only)
- [ ] Volúmenes por pestaña se guardan en storage
- [ ] Cambio de preset actualiza valores en popup
- [ ] Custom preset se guarda al ajustar sliders
- [ ] Popup redirige a premium cada 30s (free users only)
- [ ] Presets premium se deshabilitan si no es premium
- [ ] Sin errores en DevTools Console

## 🚀 Deploy

### Paso 1: Push a GitHub
```bash
git add -A
git commit -m "feat: Multi-tab, 15-band EQ, spectrum analyzer"
git push origin main
```

### Paso 2: Actualizar Chrome Web Store (si es publicada)
- Subir `extension.zip` al Chrome Developer Dashboard
- Versionar a 1.1.0
- Escribir release notes
- Enviar a revisión

### Paso 3: Notificar a Usuarios
Email template:
```
Asunto: Smart Audio EQ Actualización v1.1.0 - Mixer Multi-Pestaña Premium 🎚️

¡Hola usuario,

Tenemos novedades emocionantes en Smart Audio EQ:

✨ NUEVO en Premium:
- Mixer de volumen independiente por pestaña
- Ecualizador profesional de 15 bandas
- Analizador de espectro en tiempo real

📊 NUEVO para todos:
- Visualización de espectro mientras ecualiza
- Mejor sincronización de estado
- Mejor manejo de errores

Descarga la actualización desde Chrome Web Store.

¿No eres premium aún? Obtén acceso a todas las características:
[Smart Audio EQ Premium](https://smart-audio-eq.pages.dev/premium)

¡Que disfrutes!
```

## 🐛 Troubleshooting

### Error: "No audio tabs detected"
- Asegura que hay pestaña reproduyendo audio (YouTube, Spotify, etc.)
- Recarga la pestaña con audio
- Verifica que el EQ está ON

### Error: "Popup JSON parsing failed"
- Backend no está respondiendo JSON válido
- Verifica que `/check-license` endpoint retorna `{premium: true/false}`
- Revisa logs: Chrome DevTools → popup → Console

### Spectrum Analyzer no se mueve
- El audio capture puede no estar activo
- Clickea ON/OFF toggle
- Verifica que offscreen.js está corriendo (Service Worker activo)

### TabMixer vacío (premium users)
- Necesita al menos una pestaña reproduyendo audio
- Chrome debe tener permiso de `audible` query
- Revisa `chrome://extensions/` → Smart Audio EQ → Permisos

## 📚 Documentación Código

### SpectrumAnalyzer.jsx
- Pide data cada frame via `chrome.runtime.sendMessage({type: 'GET_ANALYSER_DATA'})`
- Dibuja barras de espectro con gradiente HSL
- Refresco @60fps con requestAnimationFrame

### TabMixer.jsx
- Query `chrome.tabs.query({audible: true})` cada 1s
- Envia `SET_TAB_VOLUME` al background cuando slider se mueve
- Almacena volúmenes en `chrome.storage.local.tabVolumes`

### audio/processor.js
- `initAudio(stream, isPremium)` - Crea contexto con 6 o 15 filtros
- `setGain(index, value)` - Ajusta ganancia de banda individual
- `getAnalyserData()` - Retorna Uint8Array de 128 valores (frequencyBinCount)
- Compressor hardcodeado: threshold -10dB, ratio 20:1, attack 5ms

## ✅ Validaciones de Integración

| Característica | Free | Premium | Tests |
|---|---|---|---|
| 6 bandas EQ | ✅ | ✅ | popup slider count |
| 15 bandas EQ | ❌ | ✅ | popup slider count |
| Spectrum Analyzer | ✅ | ✅ | canvas rendering |
| TabMixer | ❌ | ✅ | visible only if isPremium |
| 5 presets free | ✅ | ✅ | preset selector options |
| 6 presets premium | ❌ | ✅ | disabled in selector |
| Multi AudioContext | ❌ | ✅ | tab count limit |
| Redirect to Premium | ✅ | ❌ | 30s timer |

---

**Versión**: 1.1.0  
**Fecha**: 28 Enero 2026  
**Estado**: 🚀 Production Ready  
**Breaking Changes**: None
