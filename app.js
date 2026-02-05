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
    const API_ENDPOINT = 'http://localhost:3001/api/transformar-foto';

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
        alert('Fallo la conexión con el servidor. ¿Está corriendo Node.js?');
        changeStep(captureStep);
    }
}


    // -----------------------------------------------------
    // FUNCIONALIDAD: ACCIONES FINALES (Descargar y Compartir)
    // -----------------------------------------------------
    
    // Botón de Descarga
    downloadBtn.addEventListener('click', () => {
        const url = downloadBtn.getAttribute('data-download-url');
        if (url) {
            // Crea un enlace temporal para forzar la descarga
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Irisarri_Vintage_1905.jpg'; // Nombre del archivo de descarga
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
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