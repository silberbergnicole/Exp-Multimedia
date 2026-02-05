// Carga las variables del archivo .env inmediatamente
require('dotenv').config(); 

const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

// --- Dependencias de Google Cloud ---
const { Storage } = require('@google-cloud/storage'); 
const { GoogleAuth } = require('google-auth-library');

const app = express();
const PORT = 3001; 

// --- Configuración de Middleware ---
app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.static(path.join(__dirname, '/'))); 

// --- Configuración de Google Cloud ---
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID; 
const REGION = process.env.GOOGLE_CLOUD_REGION || 'us-central1';
const BUCKET_NAME = `${PROJECT_ID}-irisarri-uploads`; 

const storage = new Storage({ projectId: PROJECT_ID });
const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/cloud-platform'
});

function base64ToBuffer(base64String) {
    const base64Data = base64String.split(';base64,').pop();
    return Buffer.from(base64Data, 'base64');
}

// =========================================================
// RUTA PRINCIPAL: TRANSFORMACIÓN CON IA (Imagen 3)
// =========================================================

app.post('/api/transformar-foto', async (req, res) => {
    const { fotoBase64 } = req.body;
    const fileName = `input/${uuidv4()}.jpg`;
    
    if (!fotoBase64) {
        return res.status(400).json({ success: false, message: 'No se recibió ninguna imagen.' });
    }

    try {
        const imageBuffer = base64ToBuffer(fotoBase64);

        // 1. Subir imagen a GCS
        const bucket = storage.bucket(BUCKET_NAME);
        const file = bucket.file(fileName);
        
        await file.save(imageBuffer, {
            contentType: 'image/jpeg',
            metadata: { cacheControl: 'public, max-age=3600' }
        });
        
        console.log(`LOG: Imagen subida como ${fileName}`);

        // 2. Obtener token
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();

        // 3. Primero BGSWAP para cambiar el fondo, luego cliente hará OUTPAINT
        const apiUrl = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/publishers/google/models/imagen-3.0-generate-001:predict`;
        
        const requestBody = {
            instances: [{
                prompt: `Vista amplia del interior histórico de Confitería Irisarri de 1905: grandes vitrinas de madera oscura llenas de dulces artesanales, múltiples mesas vintage con sillas tapizadas, paredes con decoración victoriana ornamentada, lámparas de araña antiguas colgando del techo, estantes altos con frascos de dulces de colores, mostrador largo de mármol, piso de baldosas antiguas. Iluminación cálida de gas. Espacio amplio y profundo con mucha perspectiva. Fotografía sepia vintage de 1905 con textura de papel antiguo y grano visible. Persona en el centro.`,
                image: {
                    bytesBase64Encoded: imageBuffer.toString('base64')
                }
            }],
            parameters: {
                sampleCount: 1,
                aspectRatio: "3:4",
                personGeneration: "allow_all",
                safetySetting: "block_some"
            }
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken.token}`,
                'Content-Type': 'application/json; charset=utf-8'
            },
            body: JSON.stringify(requestBody)
        });

        console.log(`LOG: Status de respuesta: ${response.status}`);
        const data = await response.json();
        console.log(`LOG: Respuesta de API:`, JSON.stringify(data).substring(0, 300));
        
        if (!response.ok) {
            console.error(`ERROR API completo:`, JSON.stringify(data, null, 2));
            throw new Error(`API Error ${response.status}: ${JSON.stringify(data)}`);
        }

        // Verificar si hay predicción
        if (!data.predictions || data.predictions.length === 0) {
            console.error(`ERROR: Respuesta vacía (posiblemente bloqueado por filtros de contenido):`, data);
            throw new Error(`La imagen fue bloqueada por filtros de seguridad. Intenta con otra foto.`);
        }

        if (!data.predictions[0] || !data.predictions[0].bytesBase64Encoded) {
            console.error(`ERROR: No hay imagen en respuesta:`, data);
            throw new Error(`No se generó imagen. Intenta con otra foto diferente.`);
        }

        const editedImage = data.predictions[0].bytesBase64Encoded;
        const mimeType = data.predictions[0].mimeType || 'image/png';
        const outputImageBase64 = `data:${mimeType};base64,${editedImage}`;

        res.json({ 
            success: true, 
            url_imagen: outputImageBase64,
            message: 'Fondo de confitería con BGSWAP + filtros vintage'
        });
        
    } catch (error) {
        console.error("Error con Imagen 3:", error);
        
        // Mensaje más amigable
        let userMessage = 'Error al procesar la imagen';
        if (error.message.includes('filtros de seguridad') || error.message.includes('bloqueada')) {
            userMessage = 'La imagen fue bloqueada por seguridad. Intenta con otra foto.';
        } else if (error.message.includes('No se generó imagen')) {
            userMessage = 'No se pudo transformar. Intenta con otra foto con mejor iluminación.';
        }
        
        res.status(500).json({ success: false, message: userMessage });
    } finally {
        try {
            await storage.bucket(BUCKET_NAME).file(fileName).delete();
            console.log(`Archivo ${fileName} eliminado.`);
        } catch (cleanupError) {
            console.warn("Error limpieza:", cleanupError.message);
        }
    }
});

// Inicia el servidor
app.listen(PORT, () => {
    console.log(`\n🎉 Servidor Express corriendo en http://localhost:${PORT}`);
    console.log(`   El frontend está disponible en http://localhost:${PORT}/index.html`);
});
