// Configuración inicial y logs
console.log('Firebase Database:', db);
const connectedRef = db.ref('.info/connected');
connectedRef.on('value', (snap) => {
  console.log(snap.val() === true ? 'Conectado a Firebase' : 'No conectado a Firebase');
});

let currentCode = '';
// Variables globales para mantener los datos en memoria
let currentListItems = {};
let currentProductStats = {};

document.addEventListener('DOMContentLoaded', () => {
    const savedCode = localStorage.getItem('currentListCode');
    if (savedCode) {
        currentCode = savedCode;
        updateCodeDisplay(savedCode);
        subscribeToData(savedCode); // Nombre de función actualizado
        hideCodeInput();
    } else {
        initializeNewList();
        document.getElementById('sync-button').style.display = 'none';
    }
});

function generateCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function initializeNewList() {
    const code = generateCode();
    currentCode = code;
    localStorage.setItem('currentListCode', code);
    updateCodeDisplay(code);
    subscribeToData(code);
}

function updateCodeDisplay(code) {
    let codeDisplay = document.querySelector('.code-display');
    if (!codeDisplay) {
        codeDisplay = document.createElement('div');
        codeDisplay.className = 'code-display';
        const container = document.querySelector('.container');
        container.insertBefore(codeDisplay, container.firstChild);
    }
    codeDisplay.textContent = `Código de tu lista: ${code}`;
}

function connectList() {
    const codeInput = document.getElementById('share-code');
    const code = codeInput.value.trim().toUpperCase();

    if (code.length === 6) {
        currentCode = code;
        localStorage.setItem('currentListCode', code);
        updateCodeDisplay(code);
        subscribeToData(code);
        codeInput.value = '';
        hideCodeInput();
    } else {
        alert('Por favor, introduce un código válido de 6 caracteres');
    }
}

// *** NUEVA LÓGICA DE SUSCRIPCIÓN ***
// Escuchamos dos cosas: la lista de compra y el historial de estadísticas
function subscribeToData(code) {
    // 1. Escuchar la lista de la compra actual
    const listRef = db.ref('lists/' + code);
    listRef.on('value', (snapshot) => {
        currentListItems = snapshot.val() || {};
        processAndRender(); // Renderizar cuando cambia la lista
    });

    // 2. Escuchar las estadísticas de productos (historial)
    const statsRef = db.ref('stats/' + code);
    statsRef.on('value', (snapshot) => {
        currentProductStats = snapshot.val() || {};
        processAndRender(); // Renderizar cuando cambian las estadísticas
    });
}

// *** FUNCIÓN PRINCIPAL DE RENDERIZADO ***
function processAndRender() {
    const listEl = document.getElementById('shopping-list');
    listEl.innerHTML = '';

    // A. Preparar items reales (existentes en la lista)
    let finalItems = [];
    const normalizedMap = new Map(); // Para evitar duplicados y chequear sugerencias

    const rawItems = Object.entries(currentListItems).map(([key, value]) => ({
        id: key,
        ...value,
        isSuggestion: false // Es un item real
    }));

    // Filtrar duplicados reales (tu lógica anterior)
    rawItems.forEach(item => {
        const normalizedText = item.text.trim().toLowerCase();
        
        if (!normalizedMap.has(normalizedText)) {
            normalizedMap.set(normalizedText, item);
        } else {
            const existing = normalizedMap.get(normalizedText);
            // Priorizar el no tachado
            if (existing.completed && !item.completed) {
                normalizedMap.set(normalizedText, item);
            }
        }
    });

    // B. Generar Sugerencias Automáticas
    const now = Date.now();
    Object.entries(currentProductStats).forEach(([prodName, stats]) => {
        // Solo sugerir si tenemos datos suficientes (al menos 2 compras para calcular media)
        if (stats.averageInterval && stats.lastPurchased) {
            const nextExpectedDate = stats.lastPurchased + stats.averageInterval;
            
            // Si ya pasó la fecha esperada Y el producto no está ya en la lista
            if (now > nextExpectedDate && !normalizedMap.has(prodName)) {
                
                // Crear un item virtual (sugerencia)
                const suggestionItem = {
                    id: 'suggestion-' + prodName, // ID temporal
                    text: capitalizeFirstLetter(prodName), // Recuperar formato bonito
                    completed: false,
                    isSuggestion: true, // ESTA BANDERA ES CLAVE
                    timestamp: now
                };
                
                // Lo añadimos al mapa para que se renderice
                normalizedMap.set(prodName, suggestionItem);
            }
        }
    });

    // C. Convertir a array y Ordenar
    finalItems = Array.from(normalizedMap.values());

    finalItems.sort((a, b) => {
        // 1. Las sugerencias van primero (opcional, o puedes ponerlas al final de los pendientes)
        // Vamos a poner sugerencias arriba del todo para que se vean bien
        if (a.isSuggestion !== b.isSuggestion) {
            return a.isSuggestion ? -1 : 1; 
        }
        // 2. Pendientes arriba, Tachados abajo
        if (a.completed === b.completed) return 0;
        return a.completed ? 1 : -1;
    });

    // D. Dibujar en el DOM
    finalItems.forEach(item => {
        const li = document.createElement('li');
        
        if (item.completed) li.classList.add('completed');
        if (item.isSuggestion) li.classList.add('suggestion');

        // Los botones cambian según si es sugerencia o item real
        let actionButtons = '';
        if (item.isSuggestion) {
            // Botón "+" para confirmar la sugerencia
            actionButtons = `
                <button class="check-btn" onclick="confirmSuggestion('${item.text}')" title="Añadir a la lista">➕</button>
                <button class="delete-btn" onclick="dismissSuggestion('${item.text}')" title="Descartar">✕</button>
            `;
        } else {
            // Botones normales
            actionButtons = `
                <button class="check-btn" onclick="toggleComplete('${item.id}')">✓</button>
                <button class="delete-btn" onclick="deleteItem('${item.id}')">Eliminar</button>
            `;
        }

        li.innerHTML = `
            <span>${item.text} ${item.isSuggestion ? '<small>(Sugerido)</small>' : ''}</span>
            <div class="actions">
                ${actionButtons}
            </div>
        `;
        list.appendChild(li);
    });
}

// Función auxiliar para mayúsculas
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// *** GESTIÓN DE ESTADÍSTICAS AL AÑADIR ***
function addItem() {
    const input = document.getElementById('item-input');
    const text = input.value.trim();

    if (!currentCode) initializeNewList();

    if (text !== '') {
        // 1. Añadir a la lista visual normal
        db.ref('lists/' + currentCode).push({
            text: text,
            completed: false,
            timestamp: Date.now()
        });

        // 2. ACTUALIZAR ESTADÍSTICAS
        updateProductStats(text);

        input.value = '';
    }
}

function updateProductStats(productName) {
    const normalizedName = productName.trim().toLowerCase();
    const statsRef = db.ref('stats/' + currentCode + '/' + normalizedName);
    const now = Date.now();

    statsRef.get().then((snapshot) => {
        const stats = snapshot.val();

        if (stats) {
            // Ya existía: Calculamos nuevo intervalo medio
            const lastTime = stats.lastPurchased;
            const currentInterval = now - lastTime;
            
            // Fórmula de media ponderada simple o media acumulativa
            // count: número de compras previas
            const count = stats.count || 1;
            const oldAvg = stats.averageInterval || currentInterval;
            
            // Nueva media = (MediaAnterior * Compras + NuevoIntervalo) / (Compras + 1)
            const newAvg = ((oldAvg * count) + currentInterval) / (count + 1);

            statsRef.update({
                lastPurchased: now,
                averageInterval: newAvg,
                count: count + 1
            });
        } else {
            // Producto nuevo: Inicializamos
            statsRef.set({
                lastPurchased: now,
                count: 1,
                // No hay averageInterval hasta la segunda compra
                averageInterval: null 
            });
        }
    });
}

// Convertir sugerencia en item real
function confirmSuggestion(text) {
    // Simplemente usamos addItem, que ya maneja la lógica de stats y DB
    const input = document.getElementById('item-input');
    const prevValue = input.value;
    
    input.value = text;
    addItem(); // Esto lo añade a la lista real y actualiza "lastPurchased" a HOY
    
    input.value = prevValue; // Restaurar si había algo escrito
}

// Descartar sugerencia (temporalmente "engañamos" al sistema actualizando la fecha sin comprar)
function dismissSuggestion(text) {
    const normalizedName = text.trim().toLowerCase();
    // Actualizamos 'lastPurchased' a hoy para que deje de sugerirlo por un tiempo,
    // pero NO aumentamos el contador de compras ni recalculamos la media (porque no se compró)
    db.ref('stats/' + currentCode + '/' + normalizedName).update({
        lastPurchased: Date.now()
    });
}

// Funciones estándar (ligeramente ajustadas o iguales)
function toggleComplete(itemId) {
    const itemRef = db.ref('lists/' + currentCode + '/' + itemId);
    itemRef.get().then((snapshot) => {
        const item = snapshot.val();
        if (item) {
            itemRef.update({ completed: !item.completed });
        }
    });
}

function deleteItem(itemId) {
    if (confirm('¿Eliminar de la lista?')) {
        db.ref('lists/' + currentCode + '/' + itemId).remove();
    }
}

function clearAll() {
    if (confirm('¿Borrar toda la lista?')) {
        db.ref('lists/' + currentCode).set([]);
    }
}

function showCodeInput() {
    document.querySelector('.code-section').style.display = 'flex';
    document.getElementById('sync-button').style.display = 'none';
}

function hideCodeInput() {
    document.querySelector('.code-section').style.display = 'none';
    document.getElementById('sync-button').style.display = 'block';
}

function shareList() {
    const items = currentListItems;
    let textToShare = `CompraLista2024\nCode: ${currentCode}\n\n`;
    Object.values(items).forEach(item => {
        textToShare += `${item.completed ? '✓' : '□'} ${item.text}\n`;
    });
    
    if (navigator.share) {
        navigator.share({ title: 'Mi Lista', text: textToShare });
    } else {
        fallbackShare(textToShare);
    }
}

function fallbackShare(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    alert('Copiado al portapapeles');
}

// Event Listeners
document.getElementById('item-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') addItem();
});

// Reconocimiento de voz
if ('webkitSpeechRecognition' in window) {
    let recognition = new webkitSpeechRecognition(); 
    recognition.lang = 'es-ES'; 
    window.startSpeechRecognition = function() {
      recognition.start();
      recognition.onresult = (event) => {
        document.getElementById('item-input').value = event.results[0][0].transcript; 
      };
    }
} else {
    window.startSpeechRecognition = () => alert("Voz no soportada.");
}
