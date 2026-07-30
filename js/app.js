/* Interfaz y conexion: dibuja la pantalla, escucha eventos
   y une la base de datos con el reproductor. */
(function () {
  'use strict';

  

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return '0:00';
    var s = Math.floor(sec);
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function icon(name) {
    var icons = {
      playlist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="2" fill="currentColor" stroke="none"/><circle cx="18" cy="16" r="2" fill="currentColor" stroke="none"/></svg>',
      trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>',
      play: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
      speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
      remove: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
    };
    return icons[name] || '';
  }

  function createUI(root, handlers) {
    handlers = handlers || {};
    root = typeof root === 'string' ? $(root) : root;

    var els = {
      playlistSelect: $('#playlistSelect', root),
      playlistList: $('#playlistList', root),
      songList: $('#songList', root),
      songsHeader: $('#songsHeader', root),
      draftList: $('#draftList', root),
      plName: $('#plName', root),
      plDesc: $('#plDesc', root),
      fileInput: $('#fileInput', root),
      addSongsInput: $('#addSongsInput', root),
      playerTitle: $('#playerTitle', root),
      playerArtist: $('#playerArtist', root),
      playerArt: $('#playerArt', root),
      progressFill: $('#progressFill', root),
      currentTime: $('#currentTime', root),
      totalTime: $('#totalTime', root),
      btnPlay: $('#btnPlay', root),
      btnShuffle: $('#btnShuffle', root),
      btnRepeat: $('#btnRepeat', root)
    };

    var draftFiles = [];

    function emit(name) {
      var args = Array.prototype.slice.call(arguments, 1);
      if (typeof handlers[name] === 'function') {
        return handlers[name].apply(null, args);
      }
    }

    function renderPlaylists(playlists, activeId) {
      var list = playlists || [];

      if (els.playlistSelect) {
        els.playlistSelect.innerHTML = '';
        if (!list.length) {
          var emptyOpt = document.createElement('option');
          emptyOpt.value = '';
          emptyOpt.textContent = 'Sin playlists';
          els.playlistSelect.appendChild(emptyOpt);
        } else {
          list.forEach(function (pl) {
            var opt = document.createElement('option');
            opt.value = pl.id;
            opt.textContent = pl.name;
            if (pl.id === activeId) opt.selected = true;
            els.playlistSelect.appendChild(opt);
          });
        }
      }

      if (!els.playlistList) return;
      els.playlistList.innerHTML = '';

      if (!list.length) {
        els.playlistList.innerHTML = '<div class="pl-empty-state">Crea tu primera playlist</div>';
        return;
      }

      list.forEach(function (pl) {
        var item = document.createElement('div');
        item.className = 'pl-item' + (pl.id === activeId ? ' active' : '');
        item.dataset.action = 'select-playlist';
        item.dataset.id = pl.id;
        item.innerHTML =
          '<div class="pl-item-icon">' + icon('playlist') + '</div>' +
          '<div class="pl-item-info">' +
            '<div class="pl-item-title"></div>' +
            '<div class="pl-item-meta"></div>' +
          '</div>' +
          '<div class="pl-item-actions">' +
            '<button class="pl-btn-icon" data-action="delete-playlist" data-id="' + pl.id + '" title="Eliminar">' +
              icon('trash') +
            '</button>' +
          '</div>';
        item.querySelector('.pl-item-title').textContent = pl.name;
        item.querySelector('.pl-item-meta').textContent =
          (pl.songIds ? pl.songIds.length : 0) + ' canciones';
        els.playlistList.appendChild(item);
      });
    }

    function renderSongs(songs, playlistName, playingId) {
      if (els.songsHeader) {
        els.songsHeader.textContent = 'Canciones' + (playlistName ? ' (' + playlistName + ')' : '');
      }
      if (!els.songList) return;
      els.songList.innerHTML = '';

      var list = songs || [];
      if (!list.length) {
        els.songList.innerHTML = '<div class="pl-empty-state">Agrega canciones con el selector de archivos</div>';
        return;
      }

      list.forEach(function (song, i) {
        var playing = song.id === playingId;
        var item = document.createElement('div');
        item.className = 'pl-item' + (playing ? ' active' : '');
        item.dataset.action = 'play-song';
        item.dataset.id = song.id;
        item.dataset.index = String(i);
        item.innerHTML =
          '<div class="pl-song-num">' + (i + 1) + '</div>' +
          '<div class="pl-song-play">' + icon('play') + '</div>' +
          '<div class="pl-item-info">' +
            '<div class="pl-item-title"></div>' +
            '<div class="pl-item-meta"></div>' +
          '</div>' +
          '<div class="pl-item-actions">' +
            '<button class="pl-btn-icon' + (playing ? ' is-playing' : '') + '" data-action="play-song" data-id="' + song.id + '" data-index="' + i + '" title="Reproducir">' +
              icon('speaker') +
            '</button>' +
            '<button class="pl-btn-icon" data-action="delete-song" data-id="' + song.id + '" title="Quitar">' +
              icon('trash') +
            '</button>' +
          '</div>';
        item.querySelector('.pl-item-title').textContent = song.name;
        item.querySelector('.pl-item-meta').textContent = song.type || 'audio';
        els.songList.appendChild(item);
      });
    }

    function renderDraft() {
      if (!els.draftList) return;
      els.draftList.innerHTML = '';
      if (!draftFiles.length) {
        els.draftList.innerHTML = '<div class="pl-empty-state pl-empty-state--sm">Archivos seleccionados aparecerán aquí</div>';
        return;
      }
      draftFiles.forEach(function (file, i) {
        var row = document.createElement('div');
        row.className = 'pl-draft-item';
        row.innerHTML =
          '<span class="pl-draft-num">' + (i + 1) + '</span>' +
          '<span class="pl-draft-name"></span>' +
          '<button class="pl-btn-icon" data-action="remove-draft" data-index="' + i + '" title="Quitar">' +
            icon('remove') +
          '</button>';
        row.querySelector('.pl-draft-name').textContent = file.name;
        els.draftList.appendChild(row);
      });
    }

    function getDraftFiles() {
      return draftFiles.slice();
    }

    function clearDraft() {
      draftFiles = [];
      if (els.fileInput) els.fileInput.value = '';
      if (els.plName) els.plName.value = '';
      if (els.plDesc) els.plDesc.value = '';
      renderDraft();
    }

    function getFormData() {
      return {
        name: els.plName ? els.plName.value : '',
        description: els.plDesc ? els.plDesc.value : '',
        files: getDraftFiles()
      };
    }

    function setPlayerTrack(song, playlistName) {
      if (els.playerTitle) {
        els.playerTitle.textContent = song ? song.name : 'Selecciona una canción';
      }
      if (els.playerArtist) {
        els.playerArtist.textContent = playlistName || '—';
      }
    }

    function setPlaying(playing) {
      if (els.playerArt) els.playerArt.classList.toggle('playing', !!playing);
      if (els.btnPlay) els.btnPlay.classList.toggle('is-playing', !!playing);
    }

    function setProgress(current, duration) {
      var pct = duration > 0 ? (current / duration) * 100 : 0;
      if (els.progressFill) els.progressFill.style.width = pct + '%';
      if (els.currentTime) els.currentTime.textContent = formatTime(current);
      if (els.totalTime) els.totalTime.textContent = formatTime(duration);
    }

    function setModes(mode) {
      if (els.btnRepeat) els.btnRepeat.classList.toggle('active', !!mode.loop);
      if (els.btnShuffle) els.btnShuffle.classList.toggle('active', !!mode.shuffle);
    }

    function filterAudio(fileList) {
      return Array.prototype.slice.call(fileList || []).filter(function (f) {
        return !f.type || f.type.indexOf('audio') === 0 || /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(f.name);
      });
    }

    root.addEventListener('click', function (event) {
      var target = event.target.closest('[data-action]');
      if (!target || !root.contains(target)) return;

      var action = target.dataset.action;
      var id = target.dataset.id;
      var index = target.dataset.index !== undefined ? Number(target.dataset.index) : undefined;

      event.stopPropagation();

      switch (action) {
        case 'select-playlist':
          emit('selectPlaylist', id);
          break;
        case 'delete-playlist':
          event.preventDefault();
          event.stopImmediatePropagation();
          emit('deletePlaylist', id);
          break;
        case 'play-song':
          emit('playSong', id, index);
          break;
        case 'delete-song':
          event.preventDefault();
          event.stopImmediatePropagation();
          emit('deleteSong', id);
          break;
        case 'remove-draft':
          draftFiles.splice(index, 1);
          renderDraft();
          break;
        case 'new-playlist':
          clearDraft();
          if (els.plName) els.plName.focus();
          emit('newPlaylist');
          break;
        case 'save-playlist':
          emit('savePlaylist', getFormData());
          break;
        case 'cancel-edit':
          clearDraft();
          emit('cancelEdit');
          break;
        case 'add-songs':
          if (els.addSongsInput) els.addSongsInput.click();
          break;
        case 'pick-files':
          if (els.fileInput) els.fileInput.click();
          break;
        case 'prev':
          emit('prev');
          break;
        case 'next':
          emit('next');
          break;
        case 'stop':
          emit('stop');
          break;
        case 'toggle-play':
          emit('togglePlay');
          break;
        case 'toggle-loop':
          emit('toggleLoop');
          break;
        case 'toggle-shuffle':
          emit('toggleShuffle');
          break;
        default:
          break;
      }
    });

    if (els.playlistSelect) {
      els.playlistSelect.addEventListener('change', function () {
        emit('selectPlaylist', els.playlistSelect.value);
      });
    }

    var progressBar = $('.pl-progress-bar', root);
    if (progressBar) {
      progressBar.addEventListener('click', function (event) {
        var rect = progressBar.getBoundingClientRect();
        emit('seek', (event.clientX - rect.left) / rect.width);
      });
    }

    if (els.fileInput) {
      els.fileInput.addEventListener('change', function () {
        draftFiles = draftFiles.concat(filterAudio(els.fileInput.files));
        renderDraft();
        els.fileInput.value = '';
      });
    }

    if (els.addSongsInput) {
      els.addSongsInput.addEventListener('change', function () {
        var audioFiles = filterAudio(els.addSongsInput.files);
        els.addSongsInput.value = '';
        emit('addToActive', audioFiles);
      });
    }

    renderDraft();

    return {
      renderPlaylists: renderPlaylists,
      renderSongs: renderSongs,
      clearDraft: clearDraft,
      setPlayerTrack: setPlayerTrack,
      setPlaying: setPlaying,
      setProgress: setProgress,
      setModes: setModes
    };
  }

  

  var state = {
    playlists: [],
    activePlaylistId: null,
    songs: [],
    playingSongId: null
  };

  var db = IDB.create({
    name: 'PlayListDB',
    version: 2,
    onUpgrade: function (database) {
      PlaylistService.setupSchema(database);
    }
  });

  var history = History.create(db, PlaylistService.stores.history);
  var service = PlaylistService.create(db, history);
  var player = Player.create();

  function activePlaylist() {
    return state.playlists.find(function (p) {
      return p.id === state.activePlaylistId;
    }) || null;
  }

  function refreshPlaylists(preferId) {
    return service.listPlaylists().then(function (list) {
      state.playlists = list;
      if (preferId && list.some(function (p) { return p.id === preferId; })) {
        state.activePlaylistId = preferId;
      } else if (!list.some(function (p) { return p.id === state.activePlaylistId; })) {
        state.activePlaylistId = list.length ? list[0].id : null;
      }
      ui.renderPlaylists(state.playlists, state.activePlaylistId);
      return refreshSongs();
    });
  }

  function refreshSongs() {
    var pl = activePlaylist();
    if (!pl) {
      state.songs = [];
      ui.renderSongs([], '', state.playingSongId);
      player.setQueue([]);
      return Promise.resolve([]);
    }
    return service.songsOf(pl.id).then(function (songs) {
      state.songs = songs;
      ui.renderSongs(songs, pl.name, state.playingSongId);
      player.updateQueue(songs);
      return songs;
    });
  }

  function selectPlaylist(id) {
    if (!id) return;
    state.activePlaylistId = id;
    ui.renderPlaylists(state.playlists, state.activePlaylistId);
    refreshSongs();
  }

  function savePlaylist(form) {
    var name = String(form.name || '').trim();
    if (!name) {
      window.alert('Escribe un nombre para la playlist');
      return;
    }

    var files = form.files || [];
    service.createPlaylist({
      name: name,
      description: form.description || ''
    }).then(function (playlist) {
      if (!files.length) return playlist;
      return service.addSongs(playlist.id, files).then(function () {
        return playlist;
      });
    }).then(function (playlist) {
      ui.clearDraft();
      return refreshPlaylists(playlist.id);
    }).catch(function (err) {
      window.alert(err.message || 'No se pudo guardar la playlist');
    });
  }

  function deletePlaylist(id) {
    if (!window.confirm('¿Eliminar esta playlist y sus canciones?')) return;
    var wasActive = state.activePlaylistId === id;
    service.deletePlaylist(id).then(function () {
      if (wasActive) {
        player.stop();
        state.playingSongId = null;
        ui.setPlayerTrack(null);
        ui.setPlaying(false);
      }
      return refreshPlaylists();
    });
  }

  function addFilesToActive(files) {
    var pl = activePlaylist();
    if (!pl) {
      window.alert('Selecciona o crea una playlist primero');
      return;
    }
    if (!files || !files.length) return;
    service.addSongs(pl.id, files).then(function () {
      return refreshPlaylists(pl.id);
    });
  }

  function deleteSong(songId) {
    var pl = activePlaylist();
    if (!pl) return;
    service.removeSong(pl.id, songId).then(function () {
      if (state.playingSongId === songId) {
        player.stop();
        state.playingSongId = null;
        ui.setPlayerTrack(null);
        ui.setPlaying(false);
      }
      return refreshPlaylists(pl.id);
    });
  }

  function playSong(songId, index) {
    var i = typeof index === 'number' && !isNaN(index)
      ? index
      : state.songs.findIndex(function (s) { return s.id === songId; });
    if (i < 0) return;
    player.setQueue(state.songs, i);
    player.playAt(i).then(function (song) {
      if (!song) return;
      state.playingSongId = song.id;
      var pl = activePlaylist();
      ui.setPlayerTrack(song, pl ? pl.name : '');
      ui.renderSongs(state.songs, pl ? pl.name : '', state.playingSongId);
      history.record('play', { songId: song.id, name: song.name });
    }).catch(function () {
      window.alert('No se pudo reproducir el archivo');
    });
  }

  var ui = createUI('#playlistApp', {
    selectPlaylist: selectPlaylist,
    deletePlaylist: deletePlaylist,
    playSong: playSong,
    deleteSong: deleteSong,
    savePlaylist: savePlaylist,
    cancelEdit: function () {},
    newPlaylist: function () {},
    addToActive: addFilesToActive,
    prev: function () { player.prev(); },
    next: function () { player.next(); },
    stop: function () {
      player.stop();
      ui.setPlaying(false);
    },
    togglePlay: function () {
      player.toggle().catch(function () {
        window.alert('No se pudo reproducir');
      });
    },
    toggleLoop: function () { player.toggleLoop(); },
    toggleShuffle: function () { player.toggleShuffle(); },
    seek: function (ratio) { player.seek(ratio); }
  });

  player.on('track', function (song) {
    state.playingSongId = song ? song.id : null;
    var pl = activePlaylist();
    ui.setPlayerTrack(song, pl ? pl.name : '');
    ui.renderSongs(state.songs, pl ? pl.name : '', state.playingSongId);
  });

  player.on('state', function (s) {
    ui.setPlaying(!!s.playing);
  });

  player.on('time', function (t) {
    ui.setProgress(t.current, t.duration);
  });

  player.on('mode', function (m) {
    ui.setModes(m);
  });

  refreshPlaylists().catch(function (err) {
    console.error(err);
    window.alert('No se pudo iniciar IndexedDB en este navegador');
  });

  window.PlayListApp = {
    state: state,
    service: service,
    history: history,
    player: player,
    refresh: refreshPlaylists
  };
})();
