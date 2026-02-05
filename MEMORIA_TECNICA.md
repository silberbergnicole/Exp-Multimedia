# Memoria Técnica: Aplicación de Transformación Fotográfica Vintage - Confitería Irisarri 1905

## 1. Objetivo del Proyecto
Desarrollar una aplicación web interactiva que permita a los usuarios transformar fotografías modernas a un estilo vintage de 1905, ubicándolos frente a la fachada histórica de la Confitería Irisarri, preservando los rostros y poses originales.

## 2. Stack Tecnológico Final
- **Backend**: Node.js v18+ con Express 4.x
- **IA**: Google Cloud Vertex AI - Imagen 3 API (BGSWAP mode)
- **Almacenamiento**: Google Cloud Storage (temporal)
- **Autenticación**: Google Cloud Service Account JSON
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Fuentes**: Instrument Serif (italic), Instrument Sans
- **Puerto**: 3001

## 3. Proceso de Desarrollo: 5 Intentos con IA

### Intento 1: Imagen 3 INPAINT con Masking Semántico
**Archivo**: `server.js`

**Implementación**:
```javascript
editConfig: {
  editMode: "EDIT_MODE_INPAINT",
  maskConfig: {
    maskType: "MASK_TYPE_SEMANTIC",
    classes: [165]  // Clase para ropa/indumentaria
  }
}
```

**Prompt**: "Mujer con vestido o traje elegante de época 1905..."

**Problemas Encontrados**:
- ❌ Respuestas vacías: `predictions: []` sin mensajes de error
- ❌ Filtros de contenido bloqueaban imágenes silenciosamente
- ❌ Clase 165 (apparel) no detectaba correctamente la ropa en todas las fotos
- ❌ Close-ups de rostros fallaban en detección
- ❌ No había manera de saber por qué falló (sin feedback)

**Razón del Descarte**: Demasiados fallos silenciosos, imposible debuggear efectivamente

---

### Intento 2: Imagen 4 Generate
**Archivo**: Pruebas en `server.js` (variante)

**Implementación**:
```javascript
model: "imagen-4.0-generate-001"
```

**Prompt**: "Persona en vestimenta de 1905 frente a Confitería Irisarri..."

**Problemas Encontrados**:
- ❌ Generaba personas completamente nuevas
- ❌ No preservaba los rostros originales de los usuarios
- ❌ Resultados artísticos pero no cumplían objetivo de "transformar" foto del usuario

**Razón del Descarte**: Requisito fundamental era mantener el rostro original del usuario

---

### Intento 3: Gemini 2.0 Flash
**Archivo**: Variante en desarrollo

**Implementación**:
```javascript
model: "gemini-2.0-flash-exp"
```

**Prompt**: "Transforma esta foto moderna a estilo 1905..."

**Problemas Encontrados**:
- ❌ Error: "Gemini no generó imagen"
- ❌ API devolvía respuestas de texto en lugar de imágenes
- ❌ Modelo optimizado para conversación, no para transformación de imágenes
- ❌ No soportaba el flujo de edición de imágenes requerido

**Razón del Descarte**: Modelo inadecuado para procesamiento de imágenes

---

### Intento 4: Replicate API (Recraft V3)
**Archivo**: `server-replicate.js`

**Implementación**:
```javascript
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
const output = await replicate.run(
  "recraft-ai/recraft-v3",
  { input: { prompt, image } }
);
```

**Prompt**: "Vintage 1905 photograph style, sepia tone..."

**Problemas Encontrados**:
- ❌ HTTP 402: "Insufficient credit"
- ❌ Requiere plan de pago de Replicate
- ❌ No viable para proyecto sin presupuesto

**Razón del Descarte**: Costo económico no contemplado en proyecto

---

### Intento 5: Puppeteer + ImageFX Web Interface
**Archivo**: `server-imagefx.js`

**Implementación**:
```javascript
const browser = await puppeteer.launch({ headless: false });
const page = await browser.newPage();
await page.goto('https://aitestkitchen.withgoogle.com/es/tools/image-fx');
// Automatización de clicks y uploads
```

**Problemas Encontrados**:
- ❌ Error: "Execution context was destroyed"
- ❌ Navegación destruía contexto antes de completar automatización
- ❌ Requiere autenticación de Google (complejidad adicional)
- ❌ Inestable para uso en producción
- ❌ Dependencia de interfaz web que puede cambiar

**Razón del Descarte**: Solución frágil, no apta para producción

---

## 4. Solución Final: BGSWAP (Background Swap)
**Archivo**: `server-final.js`

### Por qué Funcionó
- ✅ Modo específico para reemplazo de fondo
- ✅ Detección automática de personas con `segmentationClasses: ["person"]`
- ✅ No requiere máscaras manuales
- ✅ Preserva rostros y poses originales
- ✅ Respuestas consistentes y confiables

### Implementación Técnica

```javascript
editConfig: {
  editMode: "EDIT_MODE_BGSWAP",
  maskImageConfig: {
    maskMode: "MASK_MODE_BACKGROUND",
    segmentationClasses: ["person"]
  },
  guidanceScale: 80
}
```

### Prompt Optimizado
```
Fachada exterior de Confitería Irisarri: edificio histórico elegante de 1905, 
cartel prominente con texto 'CONFITERÍA IRISARRI' en letras doradas antiguas, 
arquitectura clásica europea, columnas, ornamentación art nouveau, Buenos Aires, 
fotografía sepia antigua, grano vintage
```

### Parámetros Clave
- `guidanceScale: 80` - Balance entre fidelidad y creatividad
- `maskMode: MASK_MODE_BACKGROUND` - Mantiene personas intactas
- `segmentationClasses: ["person"]` - Detección automática
- Formato PNG sin `compressionQuality`

### Errores Resueltos
1. **"Raw image is missing"** → Agregué `referenceImage` en estructura correcta
2. **"Invalid reference type: RAW"** → Cambié a `"REFERENCE_TYPE_RAW"`
3. **"Mask image is missing"** → Agregué `maskImageConfig` con `maskMode`
4. **"PNG does not accept compressionQuality"** → Eliminé parámetro

---

## 5. Flujo de Procesamiento Final

```
Usuario captura foto
    ↓
Frontend (app.js) convierte a base64
    ↓
POST /api/transformar-foto
    ↓
Backend (server-final.js):
  1. base64ToBuffer()
  2. Upload a Google Cloud Storage
  3. Construcción de payload con BGSWAP
  4. Llamada a Imagen 3 API
  5. Descarga imagen transformada
  6. Limpieza de archivos temporales
    ↓
Respuesta: { success: true, url_imagen: "data:image/png;base64,..." }
    ↓
Frontend aplica filtros CSS vintage
    ↓
Usuario ve resultado final
```

---

## 6. Filtros CSS Vintage

```css
.photo-result {
  filter: sepia(90%) brightness(0.9) contrast(1.3) 
          saturate(0.5) hue-rotate(15deg) grayscale(15%);
}
```

**Efecto**: Simula fotografía de principios del siglo XX con tono sepia, grano y viñeta

---

## 7. Funcionalidades Implementadas
- ✅ Captura de foto con cámara o upload
- ✅ Transformación con IA (fondo → fachada Irisarri)
- ✅ Filtros vintage automáticos
- ✅ Botón "Volver a sacar foto" (retake)
- ✅ Descargar imagen con nombre "Irisarri_Vintage_1905.jpg"
- ✅ Compartir via Web Share API
- ✅ UI responsive de 3 pasos (captura → procesando → resultado)

---

## 8. Archivos del Proyecto

### Archivos Activos
- `server-final.js` - Servidor backend con BGSWAP ✅
- `index.html` - Interfaz principal
- `app.js` - Lógica frontend
- `estilos.css` - Estilos visuales
- `vertex-ai-key.json` - Credenciales Google Cloud
- `.env` - Variables de entorno
- `package.json` - Dependencias

### Archivos Obsoletos (No en uso)
- `server.js` - Intento INPAINT ❌
- `server-simple.js` - Versión intermedia ❌
- `server-replicate.js` - API Replicate ❌
- `server-imagefx.js` - Puppeteer automation ❌

---

## 9. Limitaciones Conocidas
- Algunas imágenes aún pueden ser bloqueadas por filtros de contenido de Google
- Transformación depende de conectividad a Google Cloud
- Costos por uso de API (~$0.020 USD por imagen)
- Requiere fotos con personas claramente visibles
- Close-ups extremos pueden no funcionar correctamente

---

## 10. Lecciones Aprendidas
1. **La documentación no siempre refleja el comportamiento real** - Iteración y experimentación son necesarias
2. **Background swap más confiable que semantic masking** - BGSWAP demostró ser la solución más robusta
3. **Filtros de contenido pueden fallar silenciosamente** - Importante manejar respuestas vacías
4. **CSS complementa la IA** - Filtros vintage mejoran significativamente el resultado final
5. **Simplicidad gana** - BGSWAP fue más efectivo que approaches complejos con máscaras manuales

---

## 11. Comandos de Ejecución

```powershell
# Instalar dependencias
npm install

# Iniciar servidor
node server-final.js

# Acceder
# http://localhost:3001
```

---

**Fecha de Creación**: Diciembre 2025  
**Autor**: Proyecto Experiencia Multimedia - Confitería Irisarri 1905
