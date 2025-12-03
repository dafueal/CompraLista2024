// Añadir al inicio del archivo
console.log('Firebase Database:', db);

// Prueba de conexión
const connectedRef = db.ref('.info/connected');
connectedRef.on('value', (snap) => {
  if (snap.val() === true) {
    console.log('Conectado a Firebase');
  } else {
    console.log('No conectado a Firebase');
  }
});

let currentCode = '';

document.addEventListener('DOMContentLoaded', () => {
    const savedCode = localStorage.getItem('currentListCode');
    if (savedCode) {
        currentCode = savedCode;
        updateCodeDisplay(savedCode);
        subscribeToList(savedCode);
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
    subscribeToList(code);
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
        subscribeToList(code);
        codeInput.value = '';
        hideCodeInput();
    } else {
        alert('Por favor, introduce un código válido de 6 caracteres');
    }
}

function subscribeToList(code) {
    const listRef = db.ref('lists/' + code);
    listRef.on('value', (snapshot) => {
        const data = snapshot.val() || [];
        renderList(data);
    });
}

function addItem() {
    console.log('Intentando añadir item');

    const input = document.getElementById('item-input');
    const text = input.value.trim();

    if (!currentCode) {
        console.log('No hay código de lista activo');
        initializeNewList();
    }

    if (text !== '') {
        console.log('Añadiendo:', text, 'a la lista:', currentCode);

        db.ref('lists/' + currentCode).push({
            text: text,
            completed: false,
            timestamp: Date.now()
        }).then(() => {
            console.log('Item añadido exitosamente');
            input.value = '';
        }).catch(error => {
            console.log('Error al añadir:', error);
        });
    }
}


function toggleComplete(itemId) {
    console.log('Toggle complete para item:', itemId);
    const itemRef = db.ref('lists/' + currentCode + '/' + itemId);

    itemRef.get().then((snapshot) => {
        const item = snapshot.val();
        itemRef.update({
            completed: !item.completed
        });
    });
}

function deleteItem(itemId) {
    console.log('Intentando eliminar item:', itemId);
    // Añadir la confirmación antes de eliminar
    if (confirm('¿Estás seguro de que quieres eliminar este producto de la lista?')) {
        console.log('Confirmación recibida. Eliminando item:', itemId);
        const itemRef = db.ref('lists/' + currentCode + '/' + itemId);
        itemRef.remove()
          .then(() => {
            console.log('Item eliminado exitosamente');
          })
          .catch(error => {
            console.error('Error al eliminar item:', error);
          });
    } else {
        console.log('Eliminación cancelada por el usuario.');
    }
}


function clearAll() {
    if (confirm('¿Estás seguro de que quieres eliminar toda la lista?')) {
        db.ref('lists/' + currentCode).set([]);
    }
}

// *** AQUÍ ESTÁ EL CAMBIO PRINCIPAL ***
function renderList(items) {
    console.log('Renderizando lista:', items);
    const list = document.getElementById('shopping-list');
    list.innerHTML = '';

    // Si items es un objeto, convertirlo a array
    const itemsArray = items ? Object.entries(items).map(([key, value]) => ({
        id: key,
        ...value
    })) : [];

    // ORDENAR EL ARRAY:
    // Los items con completed: false (no tachados) van primero
    // Los items con completed: true (tachados) van al final
    itemsArray.sort((a, b) => {
        // Si a está completado y b no, a va después (retorna 1)
        // Si a no está completado y b sí, a va antes (retorna -1)
        if (a.completed === b.completed) return 0; // Mantener orden si son iguales
        return a.completed ? 1 : -1;
    });

    itemsArray.forEach(item => {
        const li = document.createElement('li');
        if (item.completed) {
            li.classList.add('completed');
        }
        li.innerHTML = `
            <span>${item.text}</span>
            <div class="actions">
                <button class="check-btn" onclick="toggleComplete('${item.id}')">✓</button>
                <button class="delete-btn" onclick="deleteItem('${item.id}')">Eliminar</button>
            </div>
        `;
        list.appendChild(li);
    });
}

function shareList() {
    const listRef = db.ref('lists/' + currentCode);

    listRef.get().then((snapshot) => {
        const items = snapshot.val();
        let textToShare = `CompraLista2024\n\nCódigo: ${currentCode}\n\nProductos:\n`;

        Object.entries(items).forEach(([key, item]) => {
            const status = item.completed ? "✓" : "□";
            textToShare += `${status} ${item.text}\n`;
        });

        if (navigator.share) {
            navigator.share({
                title: 'CompraLista2024',
                text: textToShare
            });
        } else {
            fallbackShare(textToShare);
        }
    });
}


function fallbackShare(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    alert('Código copiado al portapapeles');
}

document.getElementById('item-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addItem();
    }
});

function showCodeInput() {
    document.querySelector('.code-section').style.display = 'flex';
    document.getElementById('sync-button').style.display = 'none';
}

function hideCodeInput() {
    document.querySelector('.code-section').style.display = 'none';
    document.getElementById('sync-button').style.display = 'block';
}

// Speech Recognition Setup
// Nota: webkitSpeechRecognition puede fallar en navegadores que no sean Chrome/Edge
// Se añade verificación básica
if ('webkitSpeechRecognition' in window) {
    let recognition = new webkitSpeechRecognition(); 
    recognition.lang = 'es-ES'; 
    window.startSpeechRecognition = function() {
      recognition.start();
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript; 
        document.getElementById('item-input').value = transcript; 
      };
    }
} else {
    console.log('Reconocimiento de voz no soportado en este navegador');
    window.startSpeechRecognition = function() {
        alert("Tu navegador no soporta el reconocimiento de voz.");
    }
}
