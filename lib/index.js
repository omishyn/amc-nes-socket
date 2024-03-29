'use strict';

const {handleMessage} = require('./handle');
const internals = {
  defaults: {
    prefix: 'socket'
  },
  api: ['broadcast'],
  registerServerMethods: (server, prefix) => {
    return new Promise(function (resolve, reject) {
      const methods = [];
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
        return reject(
          new AMC_Exception(
            sprintf('System.NesSocket.Core: Register Inner Exception -> message: %s', err.message)
          )
        );
      }
    });
  },
  getApiFunction: (name, prefix) => {
    return function () {
      const ns = internals[prefix];
      // call nano's method with arguments and substituted callback
      return Hoek.reach(ns, name).apply(ns, Array.prototype.slice.call(arguments));
    }
  },
  socket: (server, config) => {
    internals.defaults.options = config;

    const prefix = config.prefix || internals.defaults.prefix;

    internals[prefix].broadcast = (message) => {
      server.broadcast && server.broadcast(message);
    };

    global.broadcast = internals[prefix].broadcast;

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
            handleMessage(socket, message);
          }
        }
      });

      server.events.on('response', (request) => {
        const payload = request && request.payload || {};

        if(!payload.broadcast && options.config.onlyWithBroadcast) {
          return;
        }

        broadcast(JSON.stringify({
          docs: {
            path: request.route.path,
            method: request.route.method,
            statusCode: request.response.statusCode,
            ...payload.broadcast
          }
        }));
      });
    }

    return Promise.resolve();
  },
  'pkg': require('./../package.json')
};
