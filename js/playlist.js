/* Gestiona playlists y canciones: crear, listar, actualizar y eliminar.
   Guarda los archivos de audio en IndexedDB como blobs. */
(function (global) {
  'use strict';

  var STORES = {
    playlists: 'playlists',
    songs: 'songs',
    history: 'history'
  };

  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  }

  function createPlaylistService(db, history) {
    function log(action, detail) {
      if (!history) return Promise.resolve();
      return history.record(action, detail);
    }

    function listPlaylists() {
      return db.find(STORES.playlists, {}).then(function (rows) {
        return (rows || []).slice().sort(function (a, b) {
          return String(a.name || '').localeCompare(String(b.name || ''));
        });
      });
    }

    function getPlaylist(id) {
      return db.find(STORES.playlists, { key: id });
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
        return Promise.reject(new Error('Playlist name is required'));
      }
      return db.insert(STORES.playlists, playlist).then(function () {
        return log('create_playlist', { id: playlist.id, name: playlist.name });
      }).then(function () {
        return playlist;
      });
    }

    function updatePlaylist(playlist) {
      return db.update(STORES.playlists, playlist).then(function () {
        return log('update_playlist', { id: playlist.id, name: playlist.name });
      }).then(function () {
        return playlist;
      });
    }

    function deletePlaylist(id) {
      return getPlaylist(id).then(function (playlist) {
        if (!playlist) return null;
        var songIds = playlist.songIds || [];
        return Promise.all(songIds.map(function (sid) {
          return db.remove(STORES.songs, { key: sid });
        })).then(function () {
          return db.remove(STORES.playlists, { key: id });
        }).then(function () {
          return log('delete_playlist', { id: id, name: playlist.name });
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
          return db.find(STORES.songs, { key: id });
        })).then(function (songs) {
          return songs.filter(Boolean);
        });
      });
    }

    function addSongs(playlistId, files) {
      var list = Array.prototype.slice.call(files || []);
      if (!list.length) return Promise.resolve([]);

      return getPlaylist(playlistId).then(function (playlist) {
        if (!playlist) return Promise.reject(new Error('Playlist not found'));

        var created = [];
        var chain = Promise.resolve();

        list.forEach(function (file) {
          chain = chain.then(function () {
            var song = {
              id: uid('song'),
              name: file.name || 'Untitled',
              type: file.type || 'audio/mpeg',
              size: file.size || 0,
              blob: file,
              playlistId: playlistId,
              addedAt: new Date().toISOString()
            };
            return db.insert(STORES.songs, song).then(function () {
              playlist.songIds = playlist.songIds || [];
              playlist.songIds.push(song.id);
              created.push(song);
              return log('insert_song', {
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
        return db.remove(STORES.songs, { key: songId }).then(function () {
          return updatePlaylist(playlist);
        }).then(function () {
          return log('delete_song', { id: songId, playlistId: playlistId });
        });
      });
    }

    function getSong(id) {
      return db.find(STORES.songs, { key: id });
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
    if (!db.objectStoreNames.contains(STORES.history)) {
      db.createObjectStore(STORES.history, { keyPath: 'id' });
    }
  }

  global.PlaylistService = {
    create: createPlaylistService,
    setupSchema: setupSchema,
    stores: STORES
  };
})(window);
