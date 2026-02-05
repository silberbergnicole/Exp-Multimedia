document.addEventListener('DOMContentLoaded', () => {
    // 1. SELECTORES DEL DOM
    const captureStep = document.getElementById('capture-step');
    const processingStep = document.getElementById('processing-step');
    const resultStep = document.getElementById('result-step');
    
    const photoInput = document.getElementById('photo-file');
    const downloadBtn = document.getElementById('download-btn');
    const shareBtn = document.getElementById('share-btn');
    const retakeBtn = document.getElementById('retake-btn');
    const transformedPhoto = document.getElementById('transformed-photo');
    const API_ENDPOINT = 'https://irisarri-backend.onrender.com/api/transformar-foto';

    // -----------------------------------------------------
    // FUNCIONALIDAD: MANEJO DE PASOS
    // -----------------------------------------------------
    
    /**
     * Muestra el paso deseado y oculta los demás.
     * @param {HTMLElement} stepToShow - El elemento Section a mostrar (ej. captureStep).
     */
    function changeStep(stepToShow) {
        // Oculta todos los pasos
        [captureStep, processingStep, resultStep].forEach(step => {
            step.classList.add('hidden');
        });
        // Muestra el paso deseado
        stepToShow.classList.remove('hidden');
    }

    // -----------------------------------------------------
    // FUNCIONALIDAD: LECTURA DE ARCHIVO Y PROCESAMIENTO
    // -----------------------------------------------------
    
    photoInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // 1. Cambia a la pantalla de Procesamiento
        changeStep(processingStep);

        // 2. Lee el archivo como Base64 (necesario para enviar por JSON/API)
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Image = e.target.result;
            // 3. Llama a la función de simulación del procesamiento IA
            processPhotoWithIA(base64Image); 
        };
        reader.readAsDataURL(file); // Comienza la lectura del archivo
    });

/**
 * Función que hace la llamada real al servidor Express.
 * @param {string} base64Image - La imagen del usuario codificada.
 */
async function processPhotoWithIA(base64Image) {
    console.log("LOG: Enviando imagen a servidor para procesamiento IA...");
    
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fotoBase64: base64Image })
        });

        const data = await response.json();
        
        if (data.success && data.url_imagen) {
            const urlFinal = data.url_imagen;

            // Muestra la imagen transformada
            transformedPhoto.src = urlFinal;
            downloadBtn.setAttribute('data-download-url', urlFinal);
            changeStep(resultStep);
            console.log("LOG: Procesamiento completado.");
            
        } else {
            alert('¡Error al transformar la foto! ' + data.message);
            changeStep(captureStep);
        }

    } catch (error) {
        console.error("LOG: Fallo la conexión con el servidor:", error);
        alert('No se pudo conectar con el servidor. Si es la primera vez que usas la app, el servidor puede tardar hasta 60 segundos en despertar. Por favor intenta nuevamente en unos momentos.');
        changeStep(captureStep);
    }
}


    // -----------------------------------------------------
    // FUNCIONALIDAD: ACCIONES FINALES (Descargar y Compartir)
    // -----------------------------------------------------
    
    // Botón de Descarga
    downloadBtn.addEventListener('click', () => {
        // Crear un canvas para capturar la imagen con los filtros CSS aplicados
        const img = transformedPhoto;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Configurar el tamaño del canvas igual que la imagen
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        
        // Aplicar los mismos filtros CSS al contexto del canvas
        ctx.filter = 'sepia(90%) brightness(0.9) contrast(1.3) saturate(0.5) hue-rotate(15deg) grayscale(15%)';
        
        // Dibujar la imagen en el canvas con los filtros
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Aplicar el efecto de viñeta y grano manualmente
        // Viñeta
        const gradient = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 0,
            canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) / 1.5
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(101, 67, 33, 0.4)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Convertir el canvas a blob y descargar
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Irisarri_Vintage_1898.jpg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 'image/jpeg', 0.95);
    });

    // Botón de Compartir (Simulación para móvil)
    shareBtn.addEventListener('click', () => {
        const shareData = {
            title: 'Mi Retrato Irisarri 1905',
            text: '¡Mira cómo me veo en la época de fundación de Confitería Irisarri!',
            url: window.location.href // Comparte el enlace de la app
        };

        // Usa la API nativa de compartir si está disponible (solo en móviles)
        if (navigator.share) {
            navigator.share(shareData)
                .then(() => console.log('Contenido compartido con éxito'))
                .catch((error) => console.log('Error al compartir', error));
        } else {
            // Alternativa para escritorio o si la API no está disponible:
            alert("Comparte esta foto en Instagram con el hashtag #IrisarriEnElTiempo");
        }
    });

    // Botón de Tomar Otra Foto
    retakeBtn.addEventListener('click', () => {
        // Limpiar el input de archivo
        photoInput.value = '';
        // Volver al paso inicial
        changeStep(captureStep);
    });

});
