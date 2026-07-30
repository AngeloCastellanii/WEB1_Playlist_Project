/* Reproductor de audio: play, pause, stop, anterior, siguiente,
   repetir, aleatorio y barra de progreso. */
(function (global) {
  'use strict';

  function createPlayer(options) {
    options = options || {};
    var audio = options.audio || new Audio();
    var queue = [];
    var index = -1;
    var loop = false;
    var shuffle = false;
    var objectUrl = null;
    var listeners = {};

    function emit(event, payload) {
      (listeners[event] || []).forEach(function (fn) {
        fn(payload);
      });
    }

    function on(event, handler) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(handler);
      return function off() {
        listeners[event] = listeners[event].filter(function (fn) {
          return fn !== handler;
        });
      };
    }

    function revoke() {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    }

    function current() {
      return index >= 0 ? queue[index] : null;
    }

    function setQueue(songs, startIndex) {
      stop();
      queue = Array.isArray(songs) ? songs.slice() : [];
      index = queue.length ? Math.max(0, startIndex || 0) : -1;
      if (!queue.length) index = -1;
      emit('queue', { queue: queue, index: index });
      return current();
    }

    
    function updateQueue(songs) {
      var currentId = current() && current().id;
      queue = Array.isArray(songs) ? songs.slice() : [];
      if (!queue.length) {
        index = -1;
      } else if (currentId) {
        var found = queue.findIndex(function (s) { return s.id === currentId; });
        index = found >= 0 ? found : Math.min(index, queue.length - 1);
      } else if (index < 0 || index >= queue.length) {
        index = 0;
      }
      emit('queue', { queue: queue, index: index });
      return current();
    }

    function load(song) {
      revoke();
      if (!song || !song.blob) {
        audio.removeAttribute('src');
        audio.load();
        emit('track', null);
        return Promise.resolve();
      }
      objectUrl = URL.createObjectURL(song.blob);
      audio.src = objectUrl;
      emit('track', song);
      return new Promise(function (resolve) {
        var onReady = function () {
          audio.removeEventListener('loadedmetadata', onReady);
          emit('time', { current: 0, duration: audio.duration || 0 });
          resolve(song);
        };
        audio.addEventListener('loadedmetadata', onReady);
        audio.load();
      });
    }

    function playAt(i) {
      if (i < 0 || i >= queue.length) return Promise.resolve(null);
      index = i;
      emit('queue', { queue: queue, index: index });
      return load(queue[index]).then(function (song) {
        return audio.play().then(function () {
          emit('state', { playing: true });
          return song;
        });
      });
    }

    function play() {
      if (index < 0 && queue.length) return playAt(0);
      if (index < 0) return Promise.resolve(null);
      if (!audio.src) {
        return load(queue[index]).then(function () {
          return audio.play().then(function () {
            emit('state', { playing: true });
            return current();
          });
        });
      }
      return audio.play().then(function () {
        emit('state', { playing: true });
        return current();
      });
    }

    function pause() {
      audio.pause();
      emit('state', { playing: false });
    }

    function stop() {
      audio.pause();
      audio.currentTime = 0;
      emit('state', { playing: false });
      emit('time', { current: 0, duration: audio.duration || 0 });
    }

    function toggle() {
      return audio.paused ? play() : (pause(), Promise.resolve(current()));
    }

    function nextIndex() {
      if (!queue.length) return -1;
      if (shuffle) {
        if (queue.length === 1) return 0;
        var n;
        do {
          n = Math.floor(Math.random() * queue.length);
        } while (n === index);
        return n;
      }
      if (index + 1 < queue.length) return index + 1;
      return loop ? 0 : -1;
    }

    function prevIndex() {
      if (!queue.length) return -1;
      if (audio.currentTime > 3) return index;
      if (index - 1 >= 0) return index - 1;
      return loop ? queue.length - 1 : index;
    }

    function next() {
      var n = nextIndex();
      if (n < 0) {
        stop();
        return Promise.resolve(null);
      }
      return playAt(n);
    }

    function prev() {
      var n = prevIndex();
      if (n < 0) return Promise.resolve(null);
      if (n === index && audio.currentTime > 3) {
        audio.currentTime = 0;
        emit('time', { current: 0, duration: audio.duration || 0 });
        return Promise.resolve(current());
      }
      return playAt(n);
    }

    function seek(ratio) {
      if (!isFinite(audio.duration) || audio.duration <= 0) return;
      audio.currentTime = Math.max(0, Math.min(1, ratio)) * audio.duration;
      emit('time', { current: audio.currentTime, duration: audio.duration });
    }

    function setLoop(value) {
      loop = !!value;
      emit('mode', { loop: loop, shuffle: shuffle });
      return loop;
    }

    function setShuffle(value) {
      shuffle = !!value;
      emit('mode', { loop: loop, shuffle: shuffle });
      return shuffle;
    }

    function toggleLoop() {
      return setLoop(!loop);
    }

    function toggleShuffle() {
      return setShuffle(!shuffle);
    }

    audio.addEventListener('timeupdate', function () {
      emit('time', { current: audio.currentTime || 0, duration: audio.duration || 0 });
    });

    audio.addEventListener('ended', function () {
      emit('state', { playing: false });
      next();
    });

    audio.addEventListener('play', function () {
      emit('state', { playing: true });
    });

    audio.addEventListener('pause', function () {
      emit('state', { playing: false });
    });

    return {
      on: on,
      setQueue: setQueue,
      updateQueue: updateQueue,
      playAt: playAt,
      play: play,
      pause: pause,
      stop: stop,
      toggle: toggle,
      next: next,
      prev: prev,
      seek: seek,
      toggleLoop: toggleLoop,
      toggleShuffle: toggleShuffle,
      setLoop: setLoop,
      setShuffle: setShuffle,
      current: current,
      getIndex: function () { return index; },
      getQueue: function () { return queue.slice(); },
      isPlaying: function () { return !audio.paused; },
      isLoop: function () { return loop; },
      isShuffle: function () { return shuffle; }
    };
  }

  global.Player = { create: createPlayer };
})(window);
