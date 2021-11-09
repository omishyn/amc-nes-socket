'use strict';

const internals = {
  defaults: {
    prefix: 'socket'
  },
  api: ['broadcast'],
  registerServerMethods: (server, prefix) => {
    return new Promise(function (resolve, reject) {
      let methods = [];
      try {
        // register all server methods
        internals.api.forEach(function (name) {
          methods.push({
            name: prefix + '.' + name,
            method: internals.getApiFunction(name, prefix)
          });
        });
        server.method(methods);
        //Resolve Server
        resolve(server.methods);
      }
      catch (err) {
        const excp = sprintf('System.Database.Factory: Register Base Data Module Inner Exception -> message: %s', err.message);
        return reject(new AMC_Exception(excp));
      }
    });
  },
  getApiFunction: (name, prefix) => {
    return function () {
      // copy all arguments to a 'real' array to work with
      let args = Array.prototype.slice.call(arguments);
      // save originally passed callback for later
      let origCb = arguments[args.length - 1];
      // number of arguments minus callback
      let bound = args.length - 1;
      if (typeof origCb !== 'function') {
        // no-op function if there is no callback
        origCb = Hoek.ignore;
        // no callback, take all arguments
        bound = args.length;
      }
      // save reference to namespace of plugin instance
      const ns = internals[prefix];
      const HoekReach = Hoek.reach(ns, name);

      // call nano's method with arguments and substituted callback
      return HoekReach.apply(ns, args);
    }
  },
  socket: (server, config) => {
    internals.defaults.options = config;

    const prefix = config.prefix || internals.defaults.prefix;

    internals[prefix].broadcast = (message) => {
      server.broadcast(message);
    };

    global.broadcast = internals.socket.broadcast;

    void internals.registerServerMethods(server, prefix);
  }
};

/**
 *
 * @param server
 * @param options {config: *}
 * @param next
 */
exports.plugin = {
  register: async (server, options) => {
    if (!options.config || !options.config.enable) {
      sysmon.log('Can\'t initialize nes socket plugin. Required parameters: {"config": {"enable":true}}');
      options.message = 'Plugin: System.NesSocket.Core was disabled';
    } else {
      options.message = 'Plugin: System.NesSocket.Core registered OK.';

      // Init Nes Socket class
      internals.socket(server, options.config);

      await server.register({
        plugin: require('@hapi/nes'),
        options: {
          auth: false,
          'onConnection': socket => {
            sysmon.log(`Socket ${socket.id} has connected`);
          },
          'onDisconnection': socket => {
            sysmon.log(`Socket ${socket.id} has disconnected`);
          },
          'onMessage': async function(socket, message) {
            sysmon.log(`Socket ${socket.id}:`, message);
          }
        }
      });

      server.events.on('response', (request) => {
        broadcast(JSON.stringify({
          docs: {
            path: request.route.path,
            method: request.route.method,
            inventoryId: request && request.payload && request.payload.inventoryId || null,
            statusCode: request.response.statusCode
          }
        }));
      });
    }

    return Promise.resolve();
  },
  'pkg': require('./../package.json')
};
