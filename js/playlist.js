/* Gestiona playlists y canciones: crear, listar, actualizar y eliminar.
   Guarda los archivos de audio en IndexedDB como blobs. */
(function (global) {
  'use strict';

  var STORES = {
    playlists: 'playlists',
    songs: 'songs',
    historial: 'historial'
  };

  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  }

  function createPlaylistService(db, historial) {
    function log(accion, detalle) {
      if (!historial) return Promise.resolve();
      return historial.registrar(accion, detalle);
    }

    function listPlaylists() {
      return db.buscar(STORES.playlists, {}).then(function (rows) {
        return (rows || []).slice().sort(function (a, b) {
          return String(a.name || '').localeCompare(String(b.name || ''));
        });
      });
    }

    function getPlaylist(id) {
      return db.buscar(STORES.playlists, { key: id });
    }

    function createPlaylist(data) {
      var playlist = {
        id: uid('pl'),
        name: String(data.name || '').trim(),
        description: String(data.description || '').trim(),
        songIds: Array.isArray(data.songIds) ? data.songIds.slice() : [],
        createdAt: new Date().toISOString()
      };
      if (!playlist.name) {
        return Promise.reject(new Error('El nombre de la playlist es obligatorio'));
      }
      return db.insertar(STORES.playlists, playlist).then(function () {
        return log('crear_playlist', { id: playlist.id, name: playlist.name });
      }).then(function () {
        return playlist;
      });
    }

    function updatePlaylist(playlist) {
      return db.actualizar(STORES.playlists, playlist).then(function () {
        return log('actualizar_playlist', { id: playlist.id, name: playlist.name });
      }).then(function () {
        return playlist;
      });
    }

    function deletePlaylist(id) {
      return getPlaylist(id).then(function (playlist) {
        if (!playlist) return null;
        var songIds = playlist.songIds || [];
        return Promise.all(songIds.map(function (sid) {
          return db.borrar(STORES.songs, { key: sid });
        })).then(function () {
          return db.borrar(STORES.playlists, { key: id });
        }).then(function () {
          return log('borrar_playlist', { id: id, name: playlist.name });
        }).then(function () {
          return playlist;
        });
      });
    }

    function songsOf(playlistId) {
      return getPlaylist(playlistId).then(function (playlist) {
        if (!playlist) return [];
        var ids = playlist.songIds || [];
        return Promise.all(ids.map(function (id) {
          return db.buscar(STORES.songs, { key: id });
        })).then(function (songs) {
          return songs.filter(Boolean);
        });
      });
    }

    function addSongs(playlistId, files) {
      var list = Array.prototype.slice.call(files || []);
      if (!list.length) return Promise.resolve([]);

      return getPlaylist(playlistId).then(function (playlist) {
        if (!playlist) return Promise.reject(new Error('Playlist no encontrada'));

        var created = [];
        var chain = Promise.resolve();

        list.forEach(function (file) {
          chain = chain.then(function () {
            var song = {
              id: uid('song'),
              name: file.name || 'Sin nombre',
              type: file.type || 'audio/mpeg',
              size: file.size || 0,
              blob: file,
              playlistId: playlistId,
              addedAt: new Date().toISOString()
            };
            return db.insertar(STORES.songs, song).then(function () {
              playlist.songIds = playlist.songIds || [];
              playlist.songIds.push(song.id);
              created.push(song);
              return log('insertar_cancion', {
                id: song.id,
                name: song.name,
                playlistId: playlistId
              });
            });
          });
        });

        return chain.then(function () {
          return updatePlaylist(playlist);
        }).then(function () {
          return created;
        });
      });
    }

    function removeSong(playlistId, songId) {
      return getPlaylist(playlistId).then(function (playlist) {
        if (!playlist) return null;
        playlist.songIds = (playlist.songIds || []).filter(function (id) {
          return id !== songId;
        });
        return db.borrar(STORES.songs, { key: songId }).then(function () {
          return updatePlaylist(playlist);
        }).then(function () {
          return log('borrar_cancion', { id: songId, playlistId: playlistId });
        });
      });
    }

    function getSong(id) {
      return db.buscar(STORES.songs, { key: id });
    }

    return {
      stores: STORES,
      listPlaylists: listPlaylists,
      getPlaylist: getPlaylist,
      createPlaylist: createPlaylist,
      updatePlaylist: updatePlaylist,
      deletePlaylist: deletePlaylist,
      songsOf: songsOf,
      addSongs: addSongs,
      removeSong: removeSong,
      getSong: getSong
    };
  }

  function setupSchema(db) {
    if (!db.objectStoreNames.contains(STORES.playlists)) {
      db.createObjectStore(STORES.playlists, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(STORES.songs)) {
      var songs = db.createObjectStore(STORES.songs, { keyPath: 'id' });
      songs.createIndex('playlistId', 'playlistId', { unique: false });
    }
    if (!db.objectStoreNames.contains(STORES.historial)) {
      db.createObjectStore(STORES.historial, { keyPath: 'id' });
    }
  }

  global.PlaylistService = {
    create: createPlaylistService,
    setupSchema: setupSchema,
    stores: STORES
  };
})(window);
