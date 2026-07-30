# PlayList (Proyecto)

Aplicacion web para crear playlists y reproducir archivos de audio del equipo. Todo se guarda en el navegador con IndexedDB. No usa frameworks: solo HTML, CSS y JavaScript.

## Como abrirla

Abre `index.html` con un servidor local (por ejemplo Live Server). Asi IndexedDB y la reproduccion funcionan correctamente.

## Estructura

```
WEB1_Playlist_Project/
  index.html       Pantalla de la app
  styles.css       Estilos y colores
  README.md        Este archivo
  assets/logo.png  Logo
  js/
    idb.js         Base de datos e historial
    playlist.js    Playlists y canciones
    player.js      Reproductor
    app.js         Interfaz y flujo de la app
```

Los scripts se cargan en este orden en `index.html`: `idb.js` → `playlist.js` → `player.js` → `app.js`.

---

## index.html

Define la estructura visual:

- Encabezado con logo y titulo.
- Panel izquierdo: selector y lista de playlists.
- Panel central: canciones de la playlist activa.
- Panel derecho: formulario para crear una playlist (nombre, descripcion, archivos).
- Barra inferior: info de la cancion, progreso y controles.

Los botones no llaman funciones con `onclick`. Usan atributos `data-action` (por ejemplo `data-action="save-playlist"`). `app.js` escucha esos clics y decide que hacer.

Hay dos inputs de tipo file ocultos:

- `#fileInput`: archivos del formulario "Crear Playlist".
- `#addSongsInput`: archivos que se agregan a la playlist que ya esta activa.

---

## styles.css

Define el aspecto de la app. Colores principales:

- Fondo: `#0c0c0c`
- Grises: `#343434`, `#4c4c4c`, `#b6b6b6`
- Acento: `#c8984c`

En movil, el area central (`.pl-main`) hace scroll para que se vea el formulario completo por encima de la barra de reproduccion.

---

## js/idb.js

Se encarga de IndexedDB. Expone dos objetos globales: `IDB` e `History`.

### Funciones internas

- `openDB(name, version, onUpgrade)`: abre (o crea) la base de datos. Si la version es nueva, ejecuta `onUpgrade` para crear los almacenes.
- `runStore(db, storeName, mode, work)`: abre una transaccion sobre un almacen, ejecuta la operacion (`work`) y devuelve una Promise. Escucha los eventos `onsuccess`, `onerror`, `oncomplete` y `onabort`.
- `createIDB(config)`: crea el cliente CRUD. Guarda la conexion en `getDB()` para no abrirla muchas veces.

### Metodos del cliente (`IDB.create(...)`)

| Metodo | Que hace |
|--------|----------|
| `insert(storeName, data)` | Guarda o reemplaza un registro con `store.put` |
| `find(storeName, query)` | Si `query.key` existe, busca por llave. Si hay `index` y `value`, busca por indice. Si no, trae todos con `getAll` |
| `update(storeName, data)` | Llama a `insert` (mismo `put`) |
| `remove(storeName, query)` | Elimina el registro con esa `key` |
| `count(storeName)` | Cuenta cuantos registros hay |
| `clear(storeName)` | Vacia el almacen |

### History (`History.create(db, storeName)`)

- `record(action, detail)`: crea un registro con id, nombre de la accion, detalle y fecha, y lo guarda en el almacen `history`.
- `list()`: devuelve todos los registros del historial ordenados por fecha.

Ejemplo de uso desde fuera:

```js
var db = IDB.create({ name: 'PlayListDB', version: 2, onUpgrade: ... });
db.insert('playlists', { id: '1', name: 'Rock' });
db.find('playlists', { key: '1' });
```

---

## js/playlist.js

Maneja la logica de playlists y canciones. Usa el cliente de `idb.js`. Expone `PlaylistService`.

### Constantes y helpers

- `STORES`: nombres de los almacenes (`playlists`, `songs`, `history`).
- `uid(prefix)`: genera un id unico (por ejemplo `pl-1732...` o `song-1732...`).
- `setupSchema(db)`: crea los tres object stores la primera vez que se abre la base. En `songs` ademas crea un indice `playlistId`.
- `log(action, detail)`: llama a `history.record` cuando hay historial disponible.

### Metodos del servicio (`PlaylistService.create(db, history)`)

| Metodo | Que hace |
|--------|----------|
| `listPlaylists()` | Trae todas las playlists y las ordena por nombre |
| `getPlaylist(id)` | Busca una playlist por id |
| `createPlaylist(data)` | Crea una playlist con nombre, descripcion, lista vacia de `songIds` y fecha. Exige nombre. Luego registra en el historial |
| `updatePlaylist(playlist)` | Guarda los cambios de una playlist ya existente |
| `deletePlaylist(id)` | Borra todas sus canciones y despues la playlist |
| `songsOf(playlistId)` | Lee los `songIds` de la playlist y busca cada cancion en el almacen `songs` |
| `addSongs(playlistId, files)` | Por cada archivo crea un registro con nombre, tipo, tamano y `blob`, lo inserta, lo agrega a `songIds` y actualiza la playlist |
| `removeSong(playlistId, songId)` | Quita el id de la lista, borra la cancion y actualiza la playlist |
| `getSong(id)` | Busca una cancion por id |

Un registro de cancion guarda el archivo real (`blob`), no solo el nombre. Asi se puede reproducir despues aunque se cierre el navegador.

---

## js/player.js

Controla la reproduccion con un `Audio` del navegador. Expone `Player`.

### Estado interno

- `queue`: lista de canciones a reproducir.
- `index`: posicion actual en la cola.
- `loop` / `shuffle`: modos de repeticion y aleatorio.
- `objectUrl`: URL temporal creada con `URL.createObjectURL` a partir del blob.
- `listeners`: callbacks registrados con `on`.

### Funciones importantes

| Funcion | Que hace |
|---------|----------|
| `on(event, handler)` | Suscribe un callback a un evento (`track`, `state`, `time`, `mode`, `queue`) |
| `emit(event, payload)` | Avisa a todos los listeners de ese evento |
| `setQueue(songs, startIndex)` | Cambia la cola, detiene lo que sonaba y deja el indice listo |
| `updateQueue(songs)` | Cambia la cola sin cortar la cancion actual (se usa al refrescar la lista) |
| `load(song)` | Crea la object URL del blob, la pone en `audio.src` y espera los metadatos |
| `playAt(i)` | Carga la cancion en la posicion `i` y la reproduce |
| `play()` / `pause()` / `stop()` | Controles basicos. `stop` pone el tiempo en 0 |
| `toggle()` | Si esta en pausa reproduce; si suena, pausa |
| `next()` / `prev()` | Pasa a la siguiente o anterior. Con shuffle elige al azar. Con loop vuelve al inicio o al final |
| `seek(ratio)` | Salta a un punto de la cancion (0 a 1) segun el clic en la barra |
| `toggleLoop()` / `toggleShuffle()` | Activan o desactivan esos modos |
| `current()` | Devuelve la cancion actual o `null` |

Cuando una cancion termina (`ended`), llama sola a `next()`.

---

## js/app.js

Es el archivo que une todo: dibuja la interfaz, reacciona a los clics y llama a `playlist.js` y `player.js`.

Tiene dos partes: la UI (`createUI`) y el flujo de la aplicacion (estado + handlers).

### Helpers de UI

- `$`: atajo de `querySelector`.
- `formatTime(sec)`: convierte segundos a texto tipo `1:05`.
- `icon(name)`: devuelve el SVG de iconos (playlist, basura, play, etc.).

### createUI(root, handlers)

Guarda referencias a los elementos del DOM (`playlistSelect`, `songList`, `plName`, botones del player, etc.) y mantiene `draftFiles` (archivos elegidos en el formulario antes de guardar).

Funciones de dibujo y formulario:

| Funcion | Que hace |
|---------|----------|
| `renderPlaylists(playlists, activeId)` | Llena el `<select>` y la lista lateral de playlists |
| `renderSongs(songs, playlistName, playingId)` | Dibuja las canciones del panel central y marca la que suena |
| `renderDraft()` | Muestra los archivos pendientes en el formulario |
| `clearDraft()` | Limpia nombre, descripcion y archivos del formulario |
| `getFormData()` | Devuelve `{ name, description, files }` listo para guardar |
| `setPlayerTrack(song, playlistName)` | Actualiza titulo y subtítulo de la barra inferior |
| `setPlaying(playing)` | Cambia el icono play/pause y la animacion de la caratula |
| `setProgress(current, duration)` | Mueve la barra de progreso y los tiempos |
| `setModes(mode)` | Marca visualmente los botones de loop y shuffle |
| `filterAudio(fileList)` | Deja solo archivos de audio |

Los clics se resuelven con `data-action`. Por ejemplo:

- `save-playlist` → llama al handler `savePlaylist` con los datos del formulario.
- `play-song` → llama a `playSong` con el id y el indice.
- `add-songs` → abre `#addSongsInput`.
- `pick-files` → abre `#fileInput`.
- `toggle-play`, `prev`, `next`, `stop`, etc. → controles del reproductor.

### Estado de la app

```js
state = {
  playlists: [],
  activePlaylistId: null,
  songs: [],
  playingSongId: null
}
```

Al iniciar se crea:

- `db` con `IDB.create` y el esquema de `PlaylistService.setupSchema`
- `history` con `History.create`
- `service` con `PlaylistService.create`
- `player` con `Player.create`
- `ui` con `createUI('#playlistApp', { ...handlers })`

### Funciones del flujo

| Funcion | Que hace |
|---------|----------|
| `activePlaylist()` | Devuelve la playlist seleccionada segun `activePlaylistId` |
| `refreshPlaylists(preferId)` | Lee las playlists de la base, elige cual queda activa y refresca canciones |
| `refreshSongs()` | Carga las canciones de la activa, las pinta y actualiza la cola del player |
| `selectPlaylist(id)` | Cambia la playlist activa y recarga canciones |
| `savePlaylist(form)` | Crea la playlist, agrega los archivos del draft si hay, limpia el formulario y refresca |
| `deletePlaylist(id)` | Pide confirmacion, borra en la base y refresca. Si era la activa, detiene el audio |
| `addFilesToActive(files)` | Agrega archivos a la playlist activa (boton + de Canciones) |
| `deleteSong(songId)` | Quita una cancion; si era la que sonaba, detiene el audio |
| `playSong(songId, index)` | Pone la cola, reproduce esa pista y registra `play` en el historial |

Al final, `app.js` escucha eventos del player (`track`, `state`, `time`, `mode`) para mantener la barra inferior y la lista sincronizadas. Llama a `refreshPlaylists()` al cargar la pagina.

Para depurar en consola queda disponible `window.PlayListApp` (`state`, `service`, `history`, `player`, `refresh`).

---

## Flujo tipico

1. El usuario escribe un nombre, elige archivos con **input file** y pulsa **Guardar**.
2. `savePlaylist` → `service.createPlaylist` → `service.addSongs` (cada archivo se guarda como blob).
3. `refreshPlaylists` vuelve a leer la base y pinta playlists y canciones.
4. Al hacer clic en una cancion, `playSong` → `player.setQueue` + `player.playAt`.
5. `player.load` crea una URL del blob y el elemento `Audio` la reproduce.
6. Mientras suena, `timeupdate` actualiza la barra con `setProgress`.

## Datos en IndexedDB (`PlayListDB`)

| Almacen | Contenido |
|---------|-----------|
| `playlists` | id, name, description, songIds, createdAt |
| `songs` | id, name, type, size, blob, playlistId, addedAt |
| `history` | id, action, detail, date |

Si borras los datos del sitio en el navegador, se pierden playlists y archivos guardados.
