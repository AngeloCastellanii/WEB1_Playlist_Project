/* IndexedDB: abre la base, inserta, busca, actualiza y borra registros.
   Tambien guarda el historial de acciones. */
(function (global) {
  'use strict';

  function openDB(name, version, onUpgrade) {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(name, version);

      request.onupgradeneeded = function (event) {
        if (typeof onUpgrade === 'function') {
          onUpgrade(event.target.result, event);
        }
      };

      request.onsuccess = function (event) {
        resolve(event.target.result);
      };

      request.onerror = function (event) {
        reject(event.target.error);
      };
    });
  }

  function runStore(db, storeName, mode, work) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(storeName, mode);
      var store = tx.objectStore(storeName);
      var request;
      var settled = false;

      function done(value) {
        if (settled) return;
        settled = true;
        resolve(value);
      }

      function fail(err) {
        if (settled) return;
        settled = true;
        reject(err);
      }

      try {
        request = work(store);
      } catch (err) {
        fail(err);
        return;
      }

      if (request && typeof request.onsuccess !== 'undefined') {
        request.onsuccess = function (event) {
          done(event.target.result);
        };
        request.onerror = function (event) {
          fail(event.target.error);
        };
      } else {
        tx.oncomplete = function () {
          done(request);
        };
      }

      tx.onerror = function (event) {
        fail(event.target.error);
      };

      tx.onabort = function (event) {
        fail(event.target.error || new Error('Transaction aborted'));
      };
    });
  }

  function createIDB(config) {
    var dbPromise = null;

    function getDB() {
      if (!dbPromise) {
        dbPromise = openDB(config.name, config.version || 1, config.onUpgrade);
      }
      return dbPromise;
    }

    return {
      insert: function (storeName, data) {
        return getDB().then(function (db) {
          return runStore(db, storeName, 'readwrite', function (store) {
            return store.put(data);
          });
        });
      },

      find: function (storeName, query) {
        query = query || {};
        return getDB().then(function (db) {
          return runStore(db, storeName, 'readonly', function (store) {
            if (query.key !== undefined) {
              return store.get(query.key);
            }
            if (query.index && query.value !== undefined) {
              return store.index(query.index).getAll(query.value);
            }
            return store.getAll();
          });
        });
      },

      update: function (storeName, data) {
        return this.insert(storeName, data);
      },

      remove: function (storeName, query) {
        return getDB().then(function (db) {
          return runStore(db, storeName, 'readwrite', function (store) {
            return store.delete(query.key);
          });
        });
      },

      count: function (storeName) {
        return getDB().then(function (db) {
          return runStore(db, storeName, 'readonly', function (store) {
            return store.count();
          });
        });
      },

      clear: function (storeName) {
        return getDB().then(function (db) {
          return runStore(db, storeName, 'readwrite', function (store) {
            return store.clear();
          });
        });
      }
    };
  }

  function createHistory(db, storeName) {
    storeName = storeName || 'history';

    function record(action, detail) {
      var entry = {
        id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        action: action,
        detail: detail || {},
        date: new Date().toISOString()
      };
      return db.insert(storeName, entry).then(function () {
        return entry;
      });
    }

    function list() {
      return db.find(storeName, {}).then(function (rows) {
        return (rows || []).slice().sort(function (a, b) {
          return String(a.date).localeCompare(String(b.date));
        });
      });
    }

    return { record: record, list: list };
  }

  global.IDB = { create: createIDB, open: openDB };
  global.History = { create: createHistory };
})(window);
