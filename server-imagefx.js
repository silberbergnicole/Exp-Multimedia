require('dotenv').config();
const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Helper para esperar
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// Convertir base64 a buffer
function base64ToBuffer(base64String) {
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64Data, 'base64');
}

app.post('/api/transformar-foto', async (req, res) => {
    let browser = null;
    const tempImagePath = path.join(__dirname, 'temp-upload.jpg');
    
    try {
        const { imagen, fotoBase64 } = req.body;
        const imagenBase64 = imagen || fotoBase64;
        
        if (!imagenBase64) {
            return res.status(400).json({ error: 'No se recibió imagen' });
        }

        // Guardar imagen temporalmente
        const imageBuffer = base64ToBuffer(imagenBase64);
        fs.writeFileSync(tempImagePath, imageBuffer);
        console.log('✅ Imagen guardada temporalmente');

        // Lanzar navegador
        console.log('🌐 Iniciando navegador...');
        const userDataDir = path.join(__dirname, 'chrome-profile');
        browser = await puppeteer.launch({
            headless: false, // Cambiar a true cuando funcione
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                `--user-data-dir=${userDataDir}`
            ]
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        
        // Ir a ImageFX
        console.log('📍 Navegando a ImageFX...');
        await page.goto('https://aitestkitchen.withgoogle.com/tools/image-fx', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // Verificar si necesita login
        const needsLogin = await page.evaluate(() => {
            return document.body.innerText.includes('Sign in') || 
                   document.body.innerText.includes('Iniciar sesión');
        });

        if (needsLogin) {
            console.log('⚠️ PRIMERA VEZ: Necesitas iniciar sesión en el navegador que se abrió');
            console.log('   Inicia sesión con tu cuenta de Google y luego vuelve a intentar');
            await sleep(120000); // Esperar 2 minutos para que inicie sesión
        }

        // Esperar a que cargue la interfaz
        await sleep(3000);

        // Buscar botón de subir imagen
        console.log('🔍 Buscando botón de upload...');
        const uploadSelector = 'input[type="file"]';
        await page.waitForSelector(uploadSelector, { timeout: 10000 });
        
        // Subir imagen
        console.log('📤 Subiendo imagen...');
        const inputFile = await page.$(uploadSelector);
        await inputFile.uploadFile(tempImagePath);
        
        await sleep(2000);

        // Escribir prompt
        console.log('✍️ Escribiendo prompt...');
        const promptText = `Mantén las mismas personas y rostros. Transforma la escena al interior de la histórica Confitería Irisarri de 1905: vitrinas antiguas de madera con dulces, decoración victoriana. Cambia la ropa a vestimenta elegante de 1905: vestidos largos victorianos con encaje para mujeres, trajes formales con chaleco para hombres. Estilo fotografía sepia antigua.`;
        
        // Buscar el textarea del prompt
        const promptSelector = 'textarea, [contenteditable="true"]';
        await page.waitForSelector(promptSelector, { timeout: 10000 });
        await page.click(promptSelector);
        await page.keyboard.type(promptText);
        
        await sleep(1000);

        // Buscar y hacer click en botón generar
        console.log('🎨 Generando imagen...');
        const generateButtonSelectors = [
            'button[aria-label*="Generate"]',
            'button:has-text("Generate")',
            'button[type="submit"]',
            '.generate-button'
        ];
        
        let generateClicked = false;
        for (const selector of generateButtonSelectors) {
            try {
                await page.click(selector);
                generateClicked = true;
                console.log(`✅ Click en botón: ${selector}`);
                break;
            } catch (e) {
                continue;
            }
        }
        
        if (!generateClicked) {
            throw new Error('No se encontró botón de generar');
        }

        // Esperar a que se genere la imagen (esto puede tardar)
        console.log('⏳ Esperando generación (puede tardar 30-60 segundos)...');
        await sleep(45000);

        // Buscar la imagen generada
        console.log('🔍 Buscando imagen generada...');
        const imageSelectors = [
            'img[alt*="generated"]',
            'img[src*="googleusercontent"]',
            '.generated-image img',
            'canvas'
        ];
        
        let generatedImageData = null;
        
        for (const selector of imageSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    if (selector.includes('canvas')) {
                        generatedImageData = await page.evaluate((canvas) => {
                            return canvas.toDataURL('image/png');
                        }, element);
                    } else {
                        const src = await page.evaluate(el => el.src, element);
                        if (src && src.startsWith('data:')) {
                            generatedImageData = src;
                        } else if (src && src.startsWith('http')) {
                            // Descargar la imagen
                            const response = await page.goto(src);
                            const buffer = await response.buffer();
                            generatedImageData = `data:image/png;base64,${buffer.toString('base64')}`;
                        }
                    }
                    
                    if (generatedImageData) {
                        console.log('✅ Imagen capturada!');
                        break;
                    }
                }
            } catch (e) {
                continue;
            }
        }
        
        if (!generatedImageData) {
            // Tomar screenshot como fallback
            console.log('📸 Tomando screenshot como fallback...');
            const screenshot = await page.screenshot({ encoding: 'base64' });
            generatedImageData = `data:image/png;base64,${screenshot}`;
        }

        res.json({
            success: true,
            url_imagen: generatedImageData,
            message: 'Generado con ImageFX'
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ 
            error: error.message,
            details: 'Revisa la consola del servidor'
        });
    } finally {
        if (browser) {
            await browser.close();
        }
        if (fs.existsSync(tempImagePath)) {
            fs.unlinkSync(tempImagePath);
        }
    }
});

app.listen(PORT, () => {
    console.log(`\n🎉 Servidor ImageFX corriendo en http://localhost:${PORT}`);
    console.log(`   Abre: http://localhost:${PORT}/index.html\n`);
});
