const apiKey = 'AIzaSyDd0DoDu6kvSv9PQVy6DE-hGhQZxpwSaWs'; // Remplacez par votre clé API Google Cloud

const imageInput = document.getElementById('imageInput');
const imageCanvas = document.getElementById('imageCanvas');
const ctx = imageCanvas.getContext('2d');
let drawing = false;
let lastX, lastY;
let currentTool = 'pen';
const labels = [];
let isLabeling = false;
const history = [];
let isUndoing = false;

imageInput.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const imageURL = URL.createObjectURL(file);
        const img = new Image();
        img.onload = function() {
            const ctx = imageCanvas.getContext('2d');
            imageCanvas.width = img.width;
            imageCanvas.height = img.height;
            ctx.drawImage(img, 0, 0, img.width, img.height);
        };
        img.src = imageURL;
    }
});

imageCanvas.addEventListener('mousedown', (e) => {
    drawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];
});

imageCanvas.addEventListener('mouseup', () => drawing = false);
imageCanvas.addEventListener('mouseout', () => drawing = false);

imageCanvas.addEventListener('mousemove', (e) => {
    const rect = imageCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = document.getElementById('penSize').value;
    ctx.strokeStyle = document.getElementById('penColor').value;

    if (isAnnotationMode) { // Vérifie si le mode d'annotation est activé
        if (isLabeling) {
            addLabel(x, y);
        }
    } else { // Mode de dessin
        if (!drawing) return;

        if (currentTool === 'pen' || currentTool === 'marker') {
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(x, y);
            ctx.stroke();
        }
    }

    lastX = x;
    lastY = y;
    saveToHistory();
});

const penTool = document.getElementById('penTool');
const markerTool = document.getElementById('markerTool');
const labelTool = document.getElementById('labelTool');
const saveButton = document.getElementById('saveButton');
const undoButton = document.getElementById('undoButton');
const segmentButton = document.getElementById('segmentButton');
const annotateButton = document.getElementById('annotateButton');

let isAnnotationMode = false;

annotateButton.addEventListener('click', function() {
    if (isAnnotationMode) {
        isAnnotationMode = false;
        annotateButton.textContent = 'Activer le mode d\'annotation';
    } else {
        isAnnotationMode = true;
        annotateButton.textContent = 'Désactiver le mode d\'annotation';
    }
});

segmentButton.addEventListener('click', function() {
    // Obtenez l'image actuelle sur le canevas
    const imageData = imageCanvas.toDataURL('image/png');

    // Appelez la fonction pour envoyer l'image à l'API de segmentation
    segmentImage(imageData);
});

penTool.addEventListener('click', function() {
    currentTool = 'pen';
    drawing = true;
    ctx.globalCompositeOperation = 'source-over';
    isLabeling = false;
});

markerTool.addEventListener('click', function() {
    currentTool = 'marker';
    drawing = true;
    ctx.globalCompositeOperation = 'source-over';
    isLabeling = false;
});

labelTool.addEventListener('click', function() {
    currentTool = 'label';
    drawing = false;
    isLabeling = true;
});

const clearButton = document.getElementById('clearButton'); // Bouton Effacer

clearButton.addEventListener('click', function() {
    ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
    labels.length = 0;
    redrawCanvas();
});

undoButton.addEventListener('click', undo);

function saveToHistory() {
    if (!isUndoing) {
        const snapshot = imageCanvas.toDataURL('image/png');
        history.push(snapshot);
    }
}

function undo() {
    if (history.length > 1) {
        isUndoing = true;
        history.pop();
        const lastSnapshot = history[history.length - 1];
        const img = new Image();
        img.onload = function() {
            ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
            ctx.drawImage(img, 0, 0, img.width, img.height);
            isUndoing = false;
        };
        img.src = lastSnapshot;
    }
}

function addLabel(x, y) {
    if (isAnnotationMode) {
        const label = prompt('Entrez le texte de l\'étiquette :', '');

        if (label !== null) {
            labels.push({ x, y, text: label });
            redrawCanvas();
        }
    }
}

function redrawCanvas() {
    const img = new Image();
    img.onload = function() {
        ctx.drawImage(img, 0, 0, img.width, img.height);
        for (const label of labels) {
            ctx.font = '16px Arial';
            ctx.fillStyle = 'red';
            ctx.fillText(label.text, label.x, label.y);
        }
    };
    img.src = imageCanvas.toDataURL('image/png');
}

saveButton.addEventListener('click', function() {
    if (isLabeling) {
        isLabeling = false;
        redrawCanvas();
    }
    const dataURL = imageCanvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.href = dataURL;
    downloadLink.download = 'annotated_image.png';
    downloadLink.click();
});

function segmentImage(imageData) {
    const apiUrl = 'https://vision.googleapis.com/v1/images:annotate?key=' + apiKey;
    const requestData = {
        requests: [
            {
                image: {
                    content: imageData.replace('data:image/png;base64,', ''),
                },
                features: [
                    {
                        type: 'OBJECT_LOCALIZATION',
                    },
                ],
            },
        ],
    };

    fetch(apiUrl, {
        method: 'POST',
        body: JSON.stringify(requestData),
    })
        .then((response) => response.json())
        .then((data) => {
            processSegmentationResult(data);
        })
        .catch((error) => {
            console.error('Erreur lors de la requête à l\'API de segmentation', error);
        });
}

function processSegmentationResult(data) {
    if (data && data.responses && data.responses.length > 0) {
        // La réponse est valide, vous pouvez accéder aux données.
        const localizedObjects = data.responses[0].localizedObjectAnnotations;
        for (const obj of localizedObjects) {
            // Parcourez les objets segmentés (obj) et faites ce que vous voulez
            // Par exemple, dessinez un contour autour de chaque objet.
            drawBoundingBox(obj.boundingPoly);

            // Pour chaque objet, ajoutez un événement de clic pour l'annotation
            imageCanvas.addEventListener('click', (e) => {
                const rect = imageCanvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                if (
                    x >= obj.boundingPoly.normalizedVertices[0].x * imageCanvas.width &&
                    x <= obj.boundingPoly.normalizedVertices[2].x * imageCanvas.width &&
                    y >= obj.boundingPoly.normalizedVertices[0].y * imageCanvas.height &&
                    y <= obj.boundingPoly.normalizedVertices[2].y * imageCanvas.height
                ) {
                    // L'utilisateur a cliqué sur cet objet
                    const annotation = prompt('Entrez une annotation pour cet objet :', '');

                    if (annotation !== null) {
                        // Vous pouvez stocker l'annotation comme vous le souhaitez (par exemple, dans un tableau)
                        // labels.push({ x: x, y: y, text: annotation });
                        
                        // Vous pouvez également dessiner l'annotation sur l'image
                        ctx.font = '16px Arial';
                        ctx.fillStyle = 'blue';
                        ctx.fillText(annotation, x, y);
                    }
                }
            });
        }
    } else {
        console.error('Réponse de l\'API de segmentation invalide :', data);
    }
}

function drawBoundingBox(boundingPoly) {
    ctx.strokeStyle = 'green'; // Couleur du contour
    ctx.lineWidth = 2; // Largeur du contour

    ctx.beginPath();
    for (const vertex of boundingPoly.normalizedVertices) {
        const x = vertex.x * imageCanvas.width;
        const y = vertex.y * imageCanvas.height;
        if (vertex === boundingPoly.normalizedVertices[0]) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.closePath();
    ctx.stroke();
}


// Annotation/Segmentation automatique AI

const annotateButtonAi = document.getElementById('annotateButtonAi');

// Chargez le modèle COCO-SSD
cocoSsd.load().then(model => {
    annotateButtonAi.addEventListener('click', async () => {
        const ctx = imageCanvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
        
        // Prédisez les objets dans l'image
        const predictions = await model.detect(imageData);

        // Dessinez les boîtes de délimitation des objets
        ctx.drawImage(imageCanvas, 0, 0); // Assurez-vous que l'image est visible sur le canevas

        predictions.forEach(prediction => {
            const [x, y, width, height] = prediction.bbox;
            const label = `${prediction.class} (${Math.round(prediction.score * 100)}%)`;

            // Dessinez une boîte de délimitation
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.rect(x, y, width, height);
            ctx.stroke();

            // Affichez le label à côté de la boîte de délimitation
            ctx.font = '18px Arial';
            ctx.fillStyle = 'red';
            ctx.fillText(label, x, y > 10 ? y - 5 : 10);
        });
    });
});