// Carga las variables del archivo .env inmediatamente
require('dotenv').config(); 

const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // Para generar nombres de archivo únicos

// --- Dependencias de Google Cloud para Vertex AI e Imagen ---
const { VertexAI } = require('@google-cloud/vertexai');
const { Storage } = require('@google-cloud/storage'); 
const { GoogleAuth } = require('google-auth-library'); 

const app = express();
const PORT = 3001; 

// --- Configuración de Middleware ---
app.use(cors());
// Aumentamos el límite para recibir imágenes Base64 grandes (hasta 50MB)
app.use(express.json({ limit: '50mb' })); 
// Sirve los archivos estáticos (frontend) desde la raíz del proyecto
app.use(express.static(path.join(__dirname, '/'))); 

// --- Configuración de Vertex AI y Cloud Storage ---
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID; 
const REGION = process.env.GOOGLE_CLOUD_REGION || 'us-central1';
// El nombre del bucket de GCS donde se subirán las fotos temporalmente
const BUCKET_NAME = `${PROJECT_ID}-irisarri-uploads`; 

if (!PROJECT_ID) {
    console.error("ERROR: La variable GOOGLE_CLOUD_PROJECT_ID no está definida en .env.");
    process.exit(1);
}

// Inicializar clientes de Vertex AI y Cloud Storage
const vertex_ai = new VertexAI({ project: PROJECT_ID, location: REGION });
const storage = new Storage({ projectId: PROJECT_ID });
const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/cloud-platform'
});

// Helper para convertir el Base64 del frontend a un Buffer binario para GCS
function base64ToBuffer(base64String) {
    // Elimina el prefijo 'data:image/jpeg;base64,' si existe
    const base64Data = base64String.split(';base64,').pop();
    return Buffer.from(base64Data, 'base64');
}

// =========================================================
// RUTA PRINCIPAL DE LA API: TRANSFORMACIÓN DE LA FOTO CON VERTEX AI IMAGEN
// =========================================================

app.post('/api/transformar-foto', async (req, res) => {
    const { fotoBase64 } = req.body;
    let gcsUrl = null; // Variable para almacenar la URL del archivo subido
    const fileName = `input/${uuidv4()}.jpg`; // Nombre único para el archivo
    
    if (!fotoBase64) {
        return res.status(400).json({ success: false, message: 'No se recibió ninguna imagen.' });
    }

    try {
        const imageBuffer = base64ToBuffer(fotoBase64);

        // 1. Subir la imagen a Google Cloud Storage (Requisito de la API de Imagen)
        const bucket = storage.bucket(BUCKET_NAME);
        const file = bucket.file(fileName);
        
        // Verificar que el bucket existe
        const [bucketExists] = await bucket.exists();
        if (!bucketExists) {
            throw new Error(`El bucket ${BUCKET_NAME} no existe. Por favor créalo manualmente en Google Cloud Console.`);
        }
        
        await file.save(imageBuffer, {
            contentType: 'image/jpeg',
            metadata: { cacheControl: 'public, max-age=31536000' }
        });
        
        console.log(`LOG: Imagen subida a GCS como ${fileName}`);

        // 2. Obtener token de autenticación
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();

        // 3. Usar Imagen 3 Edit API con máscara semántica solo para ropa
        const apiUrl = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/publishers/google/models/imagen-3.0-capability-001:predict`;
        
        // Crear máscara semántica que detecte solo la ropa (class ID 165)
        const requestBody = {
            instances: [{
                prompt: `Transformar solo la ropa actual por elegante vestimenta de época 1905: vestidos victorianos largos hasta el suelo con encaje, corsés y mangas largas para mujeres, o trajes formales antiguos con chalecos, corbatas de moño y sombreros para hombres. Mantener exactamente los mismos rostros, expresiones, poses y características físicas de las personas. Solo cambiar la ropa por prendas vintage auténticas de principios del siglo XX.`,
                referenceImages: [
                    {
                        referenceType: "REFERENCE_TYPE_RAW",
                        referenceId: 1,
                        referenceImage: {
                            bytesBase64Encoded: imageBuffer.toString('base64')
                        }
                    },
                    {
                        referenceType: "REFERENCE_TYPE_MASK",
                        referenceId: 2,
                        referenceImage: {
                            bytesBase64Encoded: imageBuffer.toString('base64')
                        },
                        maskImageConfig: {
                            maskMode: "MASK_MODE_SEMANTIC",
                            maskClasses: [165], // 165 = apparel (ropa)
                            dilation: 0.02
                        }
                    }
                ]
            }],
            parameters: {
                editMode: "EDIT_MODE_INPAINT_INSERTION",
                sampleCount: 1,
                personGeneration: "allow_all",
                safetySetting: "block_medium_and_above",
                language: "en",
                editConfig: {
                    baseSteps: 50
                },
                guidanceScale: 80
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

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(`API Error: ${JSON.stringify(data)}`);
        }

        // 4. Extraer la imagen editada
        if (!data.predictions || !data.predictions[0] || !data.predictions[0].bytesBase64Encoded) {
            throw new Error(`No se editó la imagen. Respuesta: ${JSON.stringify(data)}`);
        }

        const editedImage = data.predictions[0].bytesBase64Encoded;
        const mimeType = data.predictions[0].mimeType || 'image/png';
        const outputImageBase64 = `data:${mimeType};base64,${editedImage}`;

        res.json({ 
            success: true, 
            url_imagen: outputImageBase64,
            message: 'Imagen transformada con Imagen 3 Edit (vestimenta 1905)'
        }); 
        
    } catch (error) {
        console.error("Error al procesar:", error);
        res.status(500).json({ success: false, message: `Error: ${error.message}` });
    }
});

// Inicia el servidor
app.listen(PORT, () => {
    console.log(`\n🎉 Servidor Express corriendo en http://localhost:${PORT}`);
    console.log(`   El frontend está disponible en http://localhost:${PORT}/index.html`);
});