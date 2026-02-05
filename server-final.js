require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
const { GoogleAuth } = require('google-auth-library');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID;
const REGION = process.env.GOOGLE_CLOUD_REGION;
const BUCKET_NAME = `${PROJECT_ID}-irisarri-uploads`;

const storage = new Storage({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

const auth = new GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: 'https://www.googleapis.com/auth/cloud-platform'
});

function base64ToBuffer(base64String) {
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64Data, 'base64');
}

app.post('/api/transformar-foto', async (req, res) => {
    const tempGcsFile = `input/${uuidv4()}.jpg`;
    
    try {
        const { imagen, fotoBase64 } = req.body;
        const imagenBase64 = imagen || fotoBase64;
        
        if (!imagenBase64) {
            return res.status(400).json({ error: 'No se recibió imagen' });
        }

        const imageBuffer = base64ToBuffer(imagenBase64);
        const bucket = storage.bucket(BUCKET_NAME);
        
        await bucket.file(tempGcsFile).save(imageBuffer, {
            metadata: { contentType: 'image/jpeg' }
        });
        console.log(`✅ Imagen subida como ${tempGcsFile}`);

        const authClient = await auth.getClient();
        const accessToken = await authClient.getAccessToken();
        const apiUrl = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/publishers/google/models/imagen-3.0-capability-001:predict`;

        // Cambiar fondo con BGSWAP
        console.log('🎨 Transformando fondo a fachada Irisarri...');
        const requestBody = {
            instances: [{
                prompt: `Fachada exterior de Confitería Irisarri: cartel prominente con texto "CONFITERÍA IRISARRI" en la parte superior, grandes vitrinas de vidrio mostrando productos de confitería (tortas, dulces, pasteles) con iluminación interior cálida, marco de madera oscura en las vitrinas, fachada simple y elegante de color claro, estilo arquitectónico clásico uruguayo de principios de 1900s. Fotografía sepia vintage de 1905 con grano, textura de papel antiguo, sobreexposición suave. El cartel IRISARRI debe ser muy visible y legible.`,
                referenceImages: [
                    {
                        referenceType: "REFERENCE_TYPE_RAW",
                        referenceId: 1,
                        referenceImage: { bytesBase64Encoded: imageBuffer.toString('base64') }
                    },
                    {
                        referenceType: "REFERENCE_TYPE_MASK",
                        referenceId: 2,
                        referenceImage: { bytesBase64Encoded: imageBuffer.toString('base64') },
                        maskImageConfig: {
                            maskMode: "MASK_MODE_BACKGROUND",
                            segmentationClasses: ["person"]
                        }
                    }
                ]
            }],
            parameters: {
                editMode: "EDIT_MODE_BGSWAP",
                sampleCount: 1,
                personGeneration: "allow_all",
                safetySetting: "block_some",
                guidanceScale: 80
            }
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('❌ Error API:', data);
            throw new Error(`API Error: ${JSON.stringify(data)}`);
        }

        if (!data.predictions?.[0]?.bytesBase64Encoded) {
            console.error('❌ No hay imagen:', data);
            throw new Error('No se generó imagen. Intenta con otra foto.');
        }

        const finalImage = data.predictions[0].bytesBase64Encoded;
        const mimeType = data.predictions[0].mimeType || 'image/png';
        
        console.log('✅ Transformación completada');

        res.json({ 
            success: true, 
            url_imagen: `data:${mimeType};base64,${finalImage}`,
            message: 'Aquí está tu imagen.'
        });
        
    } catch (error) {
        console.error("❌ Error:", error);
        
        let userMessage = 'Error al procesar la imagen';
        if (error.message.includes('filtros') || error.message.includes('bloqueada')) {
            userMessage = 'La imagen fue bloqueada. Intenta con otra foto.';
        }
        
        res.status(500).json({ success: false, message: userMessage });
    } finally {
        try {
            await storage.bucket(BUCKET_NAME).file(tempGcsFile).delete();
            console.log(`🗑️ Archivo ${tempGcsFile} eliminado`);
        } catch (err) {
            console.log('No se pudo eliminar archivo temporal');
        }
    }
});

app.listen(PORT, () => {
    console.log(`\n🎉 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`   Frontend: http://localhost:${PORT}/index.html\n`);
});
