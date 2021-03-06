"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.getDebugInfo = void 0;

var _path = _interopRequireDefault(require("path"));

var _http = _interopRequireDefault(require("http"));

var _https = _interopRequireDefault(require("https"));

var _tmp = _interopRequireDefault(require("tmp"));

var _execa = _interopRequireDefault(require("execa"));

var _chokidar = _interopRequireDefault(require("chokidar"));

var _detectPort = _interopRequireDefault(require("detect-port"));

var _detectPortInUseAndPrompt = require("../utils/detect-port-in-use-and-prompt");

var _socket = require("socket.io");

var _fsExtra = _interopRequireDefault(require("fs-extra"));

var _signalExit = _interopRequireDefault(require("signal-exit"));

var _gatsbyCoreUtils = require("gatsby-core-utils");

var _reporter = _interopRequireDefault(require("gatsby-cli/lib/reporter"));

var _getSslCert = require("../utils/get-ssl-cert");

var _developProxy = require("../utils/develop-proxy");

var _gatsbyTelemetry = require("gatsby-telemetry");

// NOTE(@mxstbr): Do not use the reporter in this file, as that has side-effects on import which break structured logging
// Adapted from https://stackoverflow.com/a/16060619
const requireUncached = file => {
  try {
    delete require.cache[require.resolve(file)];
  } catch (e) {
    return null;
  }

  try {
    return require(file);
  } catch (e) {
    return null;
  }
}; // Heuristics for gatsby-config.js, as not all changes to it require a full restart to take effect


const doesConfigChangeRequireRestart = (lastConfig, newConfig) => {
  // Ignore changes to siteMetadata
  const replacer = (_, v) => {
    if (typeof v === `function` || v instanceof RegExp) {
      return v.toString();
    } else {
      return v;
    }
  };

  const oldConfigString = JSON.stringify({ ...lastConfig,
    siteMetadata: null
  }, replacer);
  const newConfigString = JSON.stringify({ ...newConfig,
    siteMetadata: null
  }, replacer);
  if (oldConfigString === newConfigString) return false;
  return true;
}; // Return a user-supplied port otherwise the default Node.js debugging port


const getDebugPort = port => port !== null && port !== void 0 ? port : 9229;

const getDebugInfo = program => {
  if (Object.prototype.hasOwnProperty.call(program, `inspect`)) {
    return {
      port: getDebugPort(program.inspect),
      break: false
    };
  } else if (Object.prototype.hasOwnProperty.call(program, `inspectBrk`)) {
    return {
      port: getDebugPort(program.inspectBrk),
      break: true
    };
  } else {
    return null;
  }
};

exports.getDebugInfo = getDebugInfo;

class ControllableScript {
  constructor(script, debugInfo) {
    this.script = script;
    this.debugInfo = debugInfo;
  }

  start() {
    var _global$__GATSBY;

    const args = [];

    const tmpFileName = _tmp.default.tmpNameSync({
      tmpdir: _path.default.join(process.cwd(), `.cache`)
    });

    _fsExtra.default.outputFileSync(tmpFileName, this.script);

    this.isRunning = true; // Passing --inspect isn't necessary for the child process to launch a port but it allows some editors to automatically attach

    if (this.debugInfo) {
      if (this.debugInfo.break) {
        args.push(`--inspect-brk=${this.debugInfo.port}`);
      } else {
        args.push(`--inspect=${this.debugInfo.port}`);
      }
    }

    this.process = _execa.default.node(tmpFileName, args, {
      env: { ...process.env,
        GATSBY_NODE_GLOBALS: JSON.stringify((_global$__GATSBY = global.__GATSBY) !== null && _global$__GATSBY !== void 0 ? _global$__GATSBY : {})
      },
      stdio: [`inherit`, `inherit`, `inherit`, `ipc`]
    });
  }

  async stop(signal = null, code) {
    if (!this.process) {
      throw new Error(`Trying to stop the process before starting it`);
    }

    this.isRunning = false;

    try {
      if (signal) {
        this.process.kill(signal);
      } else {
        this.process.send({
          type: `COMMAND`,
          action: {
            type: `EXIT`,
            payload: code
          }
        }, () => {// The try/catch won't suffice for this process.send
          // So use the callback to manually catch the Error, otherwise it'll be thrown
          // Ref: https://nodejs.org/api/child_process.html#child_process_subprocess_send_message_sendhandle_options_callback
        });
      }
    } catch (err) {// Ignore error if process has crashed or already quit.
      // Ref: https://github.com/gatsbyjs/gatsby/issues/28011#issuecomment-877302917
    }

    return new Promise(resolve => {
      if (!this.process) {
        throw new Error(`Trying to stop the process before starting it`);
      }

      this.process.on(`exit`, () => {
        if (this.process) {
          this.process.removeAllListeners();
        }

        this.process = undefined;
        resolve();
      });
    });
  }

  onMessage(callback) {
    if (!this.process) {
      throw new Error(`Trying to attach message handler before process started`);
    }

    this.process.on(`message`, callback);
  }

  onExit(callback) {
    if (!this.process) {
      throw new Error(`Trying to attach exit handler before process started`);
    }

    this.process.on(`exit`, callback);
  } // eslint-disable-next-line @typescript-eslint/no-explicit-any


  send(msg) {
    if (!this.process) {
      throw new Error(`Trying to send a message before process started`);
    }

    this.process.send(msg);
  }

}

let isRestarting; // checks if a string is a valid ip

const REGEX_IP = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])$/;

module.exports = async program => {
  global.__GATSBY = {
    buildId: _gatsbyCoreUtils.uuid.v4(),
    root: program.directory
  }; // In some cases, port can actually be a string. But our codebase is expecting it to be a number.
  // So we want to early just force it to a number to ensure we always act on a correct type.

  program.port = parseInt(program.port + ``, 10);
  const developProcessPath = (0, _gatsbyCoreUtils.slash)(require.resolve(`./develop-process`));
  const telemetryServerPath = (0, _gatsbyCoreUtils.slash)(require.resolve(`../utils/telemetry-server`));

  try {
    program.port = await (0, _detectPortInUseAndPrompt.detectPortInUseAndPrompt)(program.port);
  } catch (e) {
    if (e.message === `USER_REJECTED`) {
      process.exit(0);
    }

    throw e;
  } // Run the actual develop server on a random port, and the proxy on the program port
  // which users will access


  const proxyPort = program.port;
  const debugInfo = getDebugInfo(program);

  const rootFile = file => _path.default.join(program.directory, file); // Require gatsby-config.js before accessing process.env, to enable the user to change
  // environment variables from the config file.


  let lastConfig = requireUncached(rootFile(`gatsby-config`)); // INTERNAL_STATUS_PORT allows for setting the websocket port used for monitoring
  // when the browser should prompt the user to restart the develop process.
  // This port is randomized by default and in most cases should never be required to configure.
  // It is exposed for environments where port access needs to be explicit, such as with Docker.
  // As the port is meant for internal usage only, any attempt to interface with features
  // it exposes via third-party software is not supported.

  const [statusServerPort, developPort, telemetryServerPort] = await Promise.all([(0, _detectPort.default)(process.env.INTERNAL_STATUS_PORT), (0, _detectPort.default)(), (0, _detectPort.default)()]); // In order to enable custom ssl, --cert-file --key-file and -https flags must all be
  // used together

  if ((program[`cert-file`] || program[`key-file`]) && !program.https) {
    _reporter.default.panic(`for custom ssl --https, --cert-file, and --key-file must be used together`);
  } // Check if https is enabled, then create or get SSL cert.
  // Certs are named 'devcert' and issued to the host.
  // NOTE(@mxstbr): We mutate program.ssl _after_ passing it
  // to the develop process controllable script above because
  // that would mean we double SSL browser => proxy => server


  if (program.https) {
    const sslHost = program.host === `0.0.0.0` || program.host === `::` ? `localhost` : program.host;

    if (REGEX_IP.test(sslHost)) {
      _reporter.default.panic(`You're trying to generate a ssl certificate for an IP (${sslHost}). Please use a hostname instead.`);
    }

    const ssl = await (0, _getSslCert.getSslCert)({
      name: sslHost,
      caFile: program[`ca-file`],
      certFile: program[`cert-file`],
      keyFile: program[`key-file`],
      directory: program.directory
    });

    if (ssl) {
      program.ssl = ssl;
    }
  } // NOTE(@mxstbr): We need to start the develop proxy before the develop process to ensure
  // codesandbox detects the right port to expose by default


  const proxy = (0, _developProxy.startDevelopProxy)({
    proxyPort: proxyPort,
    targetPort: developPort,
    program
  });
  const developProcess = new ControllableScript(`
    const cmd = require(${JSON.stringify(developProcessPath)});
    const args = ${JSON.stringify({ ...program,
    port: developPort,
    proxyPort,
    // Don't pass SSL options down to the develop process, it should always use HTTP
    ssl: null,
    debugInfo
  })};
    cmd(args);
  `, debugInfo);
  const telemetryServerProcess = new ControllableScript(`require(${JSON.stringify(telemetryServerPath)}).default(${JSON.stringify(telemetryServerPort)})`, null);
  let unlocks = [];

  if (!(0, _gatsbyCoreUtils.isCI)()) {
    const statusUnlock = await (0, _gatsbyCoreUtils.createServiceLock)(program.directory, `developstatusserver`, {
      port: statusServerPort
    });
    const developUnlock = await (0, _gatsbyCoreUtils.createServiceLock)(program.directory, `developproxy`, {
      port: proxyPort
    });
    const telemetryUnlock = await (0, _gatsbyCoreUtils.createServiceLock)(program.directory, `telemetryserver`, {
      port: telemetryServerPort
    });
    await (0, _gatsbyCoreUtils.updateInternalSiteMetadata)({
      name: program.sitePackageJson.name,
      sitePath: program.directory,
      pid: process.pid,
      lastRun: Date.now()
    });

    if (!statusUnlock || !developUnlock) {
      const data = await (0, _gatsbyCoreUtils.getService)(program.directory, `developproxy`);
      const port = (data === null || data === void 0 ? void 0 : data.port) || 8000;
      console.error(`Looks like develop for this site is already running, can you visit ${program.ssl ? `https:` : `http:`}//localhost:${port} ? If it is not, try again in five seconds!`);
      process.exit(1);
    }

    unlocks = unlocks.concat([statusUnlock, developUnlock, telemetryUnlock]);
  }

  const statusServer = program.ssl ? _https.default.createServer(program.ssl) : _http.default.createServer();
  statusServer.listen(statusServerPort);
  const io = new _socket.Server(statusServer, {
    // whitelist all (https://github.com/expressjs/cors#configuration-options)
    cors: {
      origin: true
    },
    cookie: true
  });

  const handleChildProcessIPC = msg => {
    if (msg.type === `HEARTBEAT`) return;

    if (process.send) {
      // Forward IPC
      process.send(msg);
    }

    io.emit(`structured-log`, msg);

    if (msg.type === `LOG_ACTION` && msg.action.type === `SET_STATUS` && msg.action.payload === `SUCCESS`) {
      proxy.serveSite();
    }
  };

  io.on(`connection`, socket => {
    socket.on(`develop:restart`, async respond => {
      isRestarting = true;
      proxy.serveRestartingScreen(); // respond() responds to the client, which in our case prompts it to reload the page to show the restarting screen

      if (respond) respond(`develop:is-starting`);
      await developProcess.stop();
      developProcess.start();
      developProcess.onMessage(handleChildProcessIPC);
      isRestarting = false;
    });
  });
  developProcess.start();
  developProcess.onMessage(handleChildProcessIPC);
  telemetryServerProcess.start(); // Plugins can call `process.exit` which would be sent to `develop-process` (child process)
  // This needs to be propagated back to the parent process

  developProcess.onExit((code, signal) => {
    try {
      (0, _gatsbyTelemetry.flush)();
    } catch (e) {// nop
    }

    if (isRestarting) return;

    if (signal !== null) {
      process.kill(process.pid, signal);
      return;
    }

    if (code !== null) {
      process.exit(code);
    } // This should not happen:
    // https://nodejs.org/api/child_process.html#child_process_event_exit
    // The 'exit' event is emitted after the child process ends. If the process
    // exited, code is the final exit code of the process, otherwise null.
    // If the process terminated due to receipt of a signal, signal is the
    // string name of the signal, otherwise null. One of the two will always be
    // non - null.
    //
    // but just in case let do non-zero exit, because we are in situation
    // we don't expect to be possible


    process.exit(1);
  });
  const files = [rootFile(`gatsby-config.js`), rootFile(`gatsby-node.js`), rootFile(`gatsby-config.ts`), rootFile(`gatsby-node.ts`)];
  const GATSBY_CONFIG_REGEX = /^gatsby-config\.[jt]s$/;
  let watcher;

  if (!(0, _gatsbyCoreUtils.isCI)()) {
    watcher = _chokidar.default.watch(files).on(`change`, filePath => {
      const file = _path.default.basename(filePath);

      if (file.match(GATSBY_CONFIG_REGEX)) {
        const newConfig = requireUncached(rootFile(`gatsby-config`));

        if (!doesConfigChangeRequireRestart(lastConfig, newConfig)) {
          lastConfig = newConfig;
          return;
        }

        lastConfig = newConfig;
      }

      console.warn(`develop process needs to be restarted to apply the changes to ${file}`);
      io.emit(`structured-log`, {
        type: `LOG_ACTION`,
        action: {
          type: `DEVELOP`,
          payload: `RESTART_REQUIRED`,
          dirtyFile: file
        }
      });
    });
  } // route ipc messaging to the original develop process


  process.on(`message`, msg => {
    developProcess.send(msg);
  });
  process.on(`SIGINT`, async () => {
    await shutdownServices({
      developProcess,
      telemetryServerProcess,
      unlocks,
      statusServer,
      proxy,
      watcher
    }, `SIGINT`);
    process.exit(0);
  });
  process.on(`SIGTERM`, async () => {
    await shutdownServices({
      developProcess,
      telemetryServerProcess,
      unlocks,
      statusServer,
      proxy,
      watcher
    }, `SIGTERM`);
    process.exit(0);
  });
  (0, _signalExit.default)((_code, signal) => {
    shutdownServices({
      developProcess,
      telemetryServerProcess,
      unlocks,
      statusServer,
      proxy,
      watcher
    }, signal);
  });
};

function shutdownServices({
  statusServer,
  developProcess,
  proxy,
  unlocks,
  watcher,
  telemetryServerProcess
}, signal) {
  try {
    (0, _gatsbyTelemetry.flush)();
  } catch (e) {// nop
  }

  const services = [developProcess.stop(signal), telemetryServerProcess.stop(), watcher === null || watcher === void 0 ? void 0 : watcher.close(), new Promise(resolve => statusServer.close(resolve)), new Promise(resolve => proxy.server.close(resolve))];
  unlocks.forEach(unlock => {
    if (unlock) {
      services.push(unlock());
    }
  });
  return Promise.all(services).catch(() => {}).then(() => {});
}
//# sourceMappingURL=develop.js.map