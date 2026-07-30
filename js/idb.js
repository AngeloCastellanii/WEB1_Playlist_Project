/* IndexedDB: abrir la base, insertar, buscar, actualizar y borrar registros.
   Tambien guarda el historial de acciones realizadas. */
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
        fail(event.target.error || new Error('Transacción abortada'));
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
      
      insertar: function (storeName, data) {
        return getDB().then(function (db) {
          return runStore(db, storeName, 'readwrite', function (store) {
            return store.put(data);
          });
        });
      },

      
      buscar: function (storeName, query) {
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

      
      actualizar: function (storeName, data) {
        return this.insertar(storeName, data);
      },

      
      borrar: function (storeName, query) {
        return getDB().then(function (db) {
          return runStore(db, storeName, 'readwrite', function (store) {
            return store.delete(query.key);
          });
        });
      },

      
      contar: function (storeName) {
        return getDB().then(function (db) {
          return runStore(db, storeName, 'readonly', function (store) {
            return store.count();
          });
        });
      },

      
      limpiar: function (storeName) {
        return getDB().then(function (db) {
          return runStore(db, storeName, 'readwrite', function (store) {
            return store.clear();
          });
        });
      }
    };
  }

  function createHistorial(db, storeName) {
    storeName = storeName || 'historial';

    function registrar(accion, detalle) {
      var entry = {
        id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        accion: accion,
        detalle: detalle || {},
        fecha: new Date().toISOString()
      };
      return db.insertar(storeName, entry).then(function () {
        return entry;
      });
    }

    function listar() {
      return db.buscar(storeName, {}).then(function (rows) {
        return (rows || []).slice().sort(function (a, b) {
          return String(a.fecha).localeCompare(String(b.fecha));
        });
      });
    }

    return { registrar: registrar, listar: listar };
  }

  global.IDB = { create: createIDB, open: openDB };
  global.Historial = { create: createHistorial };
})(window);
