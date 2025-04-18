// firebase-config.js already initializes the app
// firebase.initializeApp(firebaseConfig); // <-- Esto ya está en firebase-config.js

// Habilitar persistencia offline ANTES de obtener la referencia a la base de datos
firebase.database().enablePersistence()
  .then(() => {
    console.log('Persistencia offline habilitada');
    // Ahora sí, obtenemos la referencia a la base de datos
    const db = firebase.database();

    // Prueba de conexión (ya la tienes, pero aquí dentro si quieres asegurarte de que db esté lista)
    const connectedRef = db.ref('.info/connected');
    connectedRef.on('value', (snap) => {
      if (snap.val() === true) {
        console.log('Conectado a Firebase');
        // Opcional: Aquí podrías añadir lógica para sincronizar UI o mostrar estado online
      } else {
        console.log('No conectado a Firebase');
        // Opcional: Aquí podrías añadir lógica para mostrar estado offline
      }
    });

    // ... el resto de tu código que usa 'db' ...
    // Asegúrate de que el código que usa 'db' esté definido *después* de que 'db' se inicialice
    // O podrías envolver tu lógica principal (como el DOMContentLoaded listener) dentro de este .then()
    // para garantizar que la persistencia esté habilitada antes de cargar datos o interactuar.

     document.addEventListener('DOMContentLoaded', () => {
        const savedCode = localStorage.getItem('currentListCode');
        if (savedCode) {
            currentCode = savedCode;
            updateCodeDisplay(savedCode);
            subscribeToList(savedCode); // Esta suscripción ahora usará la caché offline
            hideCodeInput();
        } else {
            initializeNewList(); // Esto intentará escribir, se pondrá en cola si está offline
            document.getElementById('sync-button').style.display = 'none';
        }
    });

    // Resto de funciones: generateCode, initializeNewList, updateCodeDisplay, connectList,
    // subscribeToList, addItem, toggleComplete, deleteItem, clearAll, renderList,
    // shareList, fallbackShare, event listener para input, showCodeInput, hideCodeInput,
    // Speech Recognition Setup (recognition, startSpeechRecognition)
    // ... asegúrate de que todas estas funciones tengan acceso a la variable `db` si la usan.
    // La forma más limpia sería definir 'db' fuera del then() pero asignarle el valor dentro,
    // o simplemente poner la mayor parte de la lógica de inicialización dentro del then().

  })
  .catch((err) => {
    // Manejar errores si la persistencia no se puede habilitar
    // (por ejemplo, si el navegador no la soporta o hay un problema de espacio)
    console.error("La persistencia offline de Firebase falló:", err);
    // En este caso, la aplicación seguirá funcionando online, pero sin caché offline.
    const db = firebase.database(); // Asegúrate de que db esté definida incluso si falla la persistencia

    // Prueba de conexión (moverla aquí también si la lógica principal está fuera del then)
     const connectedRef = db.ref('.info/connected');
    connectedRef.on('value', (snap) => {
      if (snap.val() === true) {
        console.log('Conectado a Firebase');
        // Opcional: Aquí podrías añadir lógica para sincronizar UI o mostrar estado online
      } else {
        console.log('No conectado a Firebase');
        // Opcional: Aquí podrías añadir lógica para mostrar estado offline
      }
    });

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
    // Resto de funciones...
  });

// Es crucial que cualquier código que dependa de 'db' solo se ejecute *después* de que 'db'
// haya sido inicializada, idealmente dentro del bloque .then() de enablePersistence,
// o manejando el caso de error en el .catch().

// Para simplificar, podrías definir `let db;` al principio del script
// y luego asignarle el valor dentro del then() y catch().
// O reestructurar tu DOMContentLoaded para que espere a que db esté lista.
