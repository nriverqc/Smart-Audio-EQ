# 📦 Instalación de Smart Audio EQ Extension

## ✅ CAMBIOS REALIZADOS (28 de enero de 2026)

Se han corregido los siguientes problemas:

### 🐛 Error de Sincronización Arreglado
- **Problema**: Error "Unchecked runtime.lastError: A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received"
- **Causa**: Los listeners de Chrome runtime retornaban `true` pero no respondían correctamente
- **Solución**: Implementado manejo adecuado de respuestas asincrónicas con try-catch y validación de canal

### 📝 Cambios en:
1. **`content.js`**: 
   - Agregado try-catch en sendMessage
   - Implementado manejo correcto de respuestas sincrónicas y asincrónicas
   - Mejorado timeout en PREGUNTAR_DATOS

2. **`background.js`**:
   - Agregado logging detallado para debugging
   - Implementado try-catch en sendResponse
   - Mejor manejo de listeners externos

### ✨ Funcionalidad Mejorada
✅ La extensión ahora captura correctamente los datos del usuario desde la web
✅ El estado "premium/free" se sincroniza automáticamente
✅ Los datos se guardan en chrome.storage.local correctamente
✅ El popup muestra el email y estado premium del usuario

---

## 🚀 INSTALACIÓN

### Opción 1: Cargar desde Carpeta (Desarrollo)
1. Abre Chrome y ve a `chrome://extensions/`
2. Activa el "Modo de desarrollador" (esquina superior derecha)
3. Click en "Cargar extensión sin empaquetar"
4. Selecciona la carpeta: `d:\Smart Audio Pro – Browser Equalizer\dist`
5. ¡Listo! La extensión debe aparecer

### Opción 2: Instalar desde ZIP (Para distribución)
1. Abre Chrome y ve a `chrome://extensions/`
2. Descarga el archivo `extension.zip` de tu carpeta del proyecto
3. Extrae el contenido en una carpeta
4. Click en "Cargar extensión sin empaquetar"
5. Selecciona la carpeta extraída

---

## 🔐 FLUJO DE AUTENTICACIÓN

### Cómo funciona la sincronización:

```
1. Usuario se login en https://smart-audio-eq.pages.dev/
   ↓
2. Firebase autentica y obtiene los datos:
   - uid
   - email
   - isPremium (del documento del usuario en Firestore)
   ↓
3. Página web envía datos via window.postMessage:
   - Content Script recibe el mensaje
   - Content Script retransmite al Background Script
   ↓
4. Background Script guarda en chrome.storage.local:
   - chrome.storage.local.set({ uid, email, isPremium })
   ↓
5. Popup/App.jsx lee del storage y muestra:
   - Email del usuario
   - Estado Premium con badge "PRO 💎"
   - Presets premium habilitados si isPremium=true
```

---

## ⚙️ CONFIGURACIÓN

### Extension ID (Recuerda anotar este)
```
edblkdnmdjodkbolefojlgdfkmbkplpf
```

### URLs Configuradas
- **Frontend**: https://smart-audio-eq.pages.dev/
- **Backend**: https://smart-audio-eq-1.onrender.com
- **API Check License**: GET `/check-license?email={email}&uid={uid}`

---

## 🧪 TESTING & DEBUG

### Para ver los logs de la extensión:
1. Ve a `chrome://extensions/`
2. Busca "Smart Audio EQ"
3. Click en "Service Worker" para ver los logs de background.js
4. Click en "inspection pages" para ver los logs del popup

### Mensajes esperados en Console:
```
✅ "Smart Audio EQ: Received login data from page:"
✅ "Background: Received LOGIN_EXITOSO:"
✅ "Background: Datos sincronizados internamente"
✅ "Content: Extension asking for data via localStorage..."
```

---

## 📊 VERIFICACIÓN

Después de instalar, verifica que:

### En el navegador:
- [ ] Puedes ir a https://smart-audio-eq.pages.dev/ y loguearte con Google
- [ ] La página muestra si tienes Premium o no
- [ ] Puedes hacer pagos con MercadoPago (Colombia) o PayPal (resto mundo)

### En la extensión:
- [ ] Click en el icono de la extensión abre el popup
- [ ] El popup muestra tu email
- [ ] El popup muestra "PREMIUM 💎" o "Free" según tu estado
- [ ] El botón de "Ecualizar" funciona
- [ ] Los presets premium están deshabilitados si no tienes Premium

### En la consola (DevTools):
- [ ] No hay errores rojos de runtime.lastError
- [ ] Ves los logs de sincronización

---

## 🔄 ACTUALIZAR LA EXTENSIÓN

Cuando hagas cambios en el código:

1. Modifica los archivos en el proyecto
2. Ejecuta: `npm run build`
3. Ve a `chrome://extensions/`
4. Busca "Smart Audio EQ"
5. Click en el botón de reload 🔄
6. La extensión se recarga con los cambios

---

## 🆘 TROUBLESHOOTING

### "Extension is not installed" error
- Verifica que la extensión está cargada en chrome://extensions/
- El Extension ID debe coincidir: `edblkdnmdjodkbolefojlgdfkmbkplpf`

### El usuario no aparece en el popup
- Abre la web: https://smart-audio-eq.pages.dev/
- Loguéate con Google
- Haz refresh en la pestaña o en el popup
- Revisa la consola para logs de sincronización

### El storage no se guarda
- Abre DevTools del popup (F12)
- Ve a Application → Storage → Local Storage
- Busca la entrada de chrome-extension://
- Verifica que `email`, `uid`, `isPremium` estén ahí

---

## 📋 Comandos Útiles

```bash
# Build de la extensión
npm run build

# Crear ZIP para distribución
npm run zip

# Ver los cambios sin hacer commit
git status

# Hacer commit y push (si hay cambios)
git add .
git commit -m "descripción"
git push
```

---

## 📞 SOPORTE

Si hay problemas:
1. Revisa los logs en chrome://extensions/ → Service Worker
2. Abre DevTools (F12) en el popup
3. Revisa la consola de la web en https://smart-audio-eq.pages.dev/
4. Verifica que Firebase está autenticando correctamente
5. Confirma que el backend responde a `/check-license`

---

**Versión**: 1.0.0 (Corregida 28/01/2026)
**Estado**: ✅ Funcional - Sincronización de usuario implementada
