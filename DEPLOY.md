# Deploy en Render.com

## Pasos para desplegar:

### 1. Crear cuenta en Render
- Ve a [render.com](https://render.com)
- Regístrate con tu cuenta de GitHub

### 2. Crear nuevo Web Service
- Click en "New +" → "Web Service"
- Conecta tu repositorio: `Exp-Multimedia`
- Configura:
  - **Name**: `irisarri-backend`
  - **Environment**: `Node`
  - **Build Command**: `npm install`
  - **Start Command**: `node server-final.js`

### 3. Configurar Variables de Entorno
En la sección "Environment", agrega:

```
GOOGLE_CLOUD_PROJECT_ID = gen-lang-client-0746607273
GOOGLE_CLOUD_REGION = us-central1
REPLICATE_API_TOKEN = r8_ZNeVbRsreOg903MDVwgDZloASujGxxV20Z1DZ
```

**Para GOOGLE_APPLICATION_CREDENTIALS:**
Copia TODO el contenido del archivo `vertex-ai-key.json` y pégalo en una variable de entorno llamada `GOOGLE_CREDENTIALS` (como texto, no como ruta).

### 4. Actualizar server-final.js
El servidor debe leer las credenciales desde la variable de entorno en lugar de archivo.

### 5. Actualizar app.js
Una vez desplegado, cambia la URL del API:
```javascript
const API_ENDPOINT = 'https://irisarri-backend.onrender.com/api/transformar-foto';
```

### 6. Deploy
- Click en "Create Web Service"
- Espera 5-10 minutos para el primer deploy
- Copia la URL que te da Render
