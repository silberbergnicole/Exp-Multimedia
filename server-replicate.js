require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Replicate = require('replicate');
const fs = require('fs');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// Inicializar Replicate
const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

// Convertir base64 a buffer
function base64ToBuffer(base64String) {
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64Data, 'base64');
}

app.post('/api/transformar-foto', async (req, res) => {
    try {
        const { imagen, fotoBase64 } = req.body;
        const imagenBase64 = imagen || fotoBase64;
        
        if (!imagenBase64) {
            return res.status(400).json({ error: 'No se recibió imagen' });
        }

        console.log('✅ Imagen recibida, procesando con Replicate...');

        // Usar Recraft V3 con imagen de referencia (mejor para mantener rostros)
        const output = await replicate.run(
            "recraft-ai/recraft-v3",
            {
                input: {
                    prompt: "Transform this photo into 1905 style: interior of historic Confitería Irisarri with wooden display cases full of sweets, Victorian decoration. People in elegant 1905 Victorian clothing - long formal dresses for women, suits with vests for men. Sepia vintage photography from early 1900s. CRITICAL: Keep the exact same faces and poses.",
                    raw_image: imagenBase64,
                    style: "realistic_image",
                    image_size: "1024x1024",
                    num_outputs: 1
                }
            }
        );

        console.log('✅ Imagen generada:', output);

        if (output && output[0]) {
            res.json({
                success: true,
                url_imagen: output[0],
                message: 'Transformación con Replicate FLUX'
            });
        } else {
            throw new Error('No se generó imagen');
        }

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ 
            error: error.message,
            details: 'Error al procesar con Replicate'
        });
    }
});

app.listen(PORT, () => {
    console.log(`\n🎉 Servidor Replicate corriendo en http://localhost:${PORT}`);
    console.log(`   Abre: http://localhost:${PORT}/index.html\n`);
});
