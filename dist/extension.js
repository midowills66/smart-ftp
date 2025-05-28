"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/basic-ftp/dist/parseControlResponse.js
var require_parseControlResponse = __commonJS({
  "node_modules/basic-ftp/dist/parseControlResponse.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.positiveIntermediate = exports2.positiveCompletion = exports2.isMultiline = exports2.isSingleLine = exports2.parseControlResponse = void 0;
    var LF = "\n";
    function parseControlResponse(text) {
      const lines = text.split(/\r?\n/).filter(isNotBlank);
      const messages = [];
      let startAt = 0;
      let tokenRegex;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!tokenRegex) {
          if (isMultiline(line)) {
            const token = line.substr(0, 3);
            tokenRegex = new RegExp(`^${token}(?:$| )`);
            startAt = i;
          } else if (isSingleLine(line)) {
            messages.push(line);
          }
        } else if (tokenRegex.test(line)) {
          tokenRegex = void 0;
          messages.push(lines.slice(startAt, i + 1).join(LF));
        }
      }
      const rest = tokenRegex ? lines.slice(startAt).join(LF) + LF : "";
      return { messages, rest };
    }
    exports2.parseControlResponse = parseControlResponse;
    function isSingleLine(line) {
      return /^\d\d\d(?:$| )/.test(line);
    }
    exports2.isSingleLine = isSingleLine;
    function isMultiline(line) {
      return /^\d\d\d-/.test(line);
    }
    exports2.isMultiline = isMultiline;
    function positiveCompletion(code) {
      return code >= 200 && code < 300;
    }
    exports2.positiveCompletion = positiveCompletion;
    function positiveIntermediate(code) {
      return code >= 300 && code < 400;
    }
    exports2.positiveIntermediate = positiveIntermediate;
    function isNotBlank(str) {
      return str.trim() !== "";
    }
  }
});

// node_modules/basic-ftp/dist/FtpContext.js
var require_FtpContext = __commonJS({
  "node_modules/basic-ftp/dist/FtpContext.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.FTPContext = exports2.FTPError = void 0;
    var net_1 = require("net");
    var parseControlResponse_1 = require_parseControlResponse();
    var FTPError2 = class extends Error {
      constructor(res) {
        super(res.message);
        this.name = this.constructor.name;
        this.code = res.code;
      }
    };
    exports2.FTPError = FTPError2;
    function doNothing() {
    }
    var FTPContext = class {
      /**
       * Instantiate an FTP context.
       *
       * @param timeout - Timeout in milliseconds to apply to control and data connections. Use 0 for no timeout.
       * @param encoding - Encoding to use for control connection. UTF-8 by default. Use "latin1" for older servers.
       */
      constructor(timeout = 0, encoding = "utf8") {
        this.timeout = timeout;
        this.verbose = false;
        this.ipFamily = void 0;
        this.tlsOptions = {};
        this._partialResponse = "";
        this._encoding = encoding;
        this._socket = this.socket = this._newSocket();
        this._dataSocket = void 0;
      }
      /**
       * Close the context.
       */
      close() {
        const message = this._task ? "User closed client during task" : "User closed client";
        const err = new Error(message);
        this.closeWithError(err);
      }
      /**
       * Close the context with an error.
       */
      closeWithError(err) {
        if (this._closingError) {
          return;
        }
        this._closingError = err;
        this._closeControlSocket();
        this._closeSocket(this._dataSocket);
        this._passToHandler(err);
        this._stopTrackingTask();
      }
      /**
       * Returns true if this context has been closed or hasn't been connected yet. You can reopen it with `access`.
       */
      get closed() {
        return this.socket.remoteAddress === void 0 || this._closingError !== void 0;
      }
      /**
       * Reset this contex and all of its state.
       */
      reset() {
        this.socket = this._newSocket();
      }
      /**
       * Get the FTP control socket.
       */
      get socket() {
        return this._socket;
      }
      /**
       * Set the socket for the control connection. This will only close the current control socket
       * if the new one is not an upgrade to the current one.
       */
      set socket(socket) {
        this.dataSocket = void 0;
        this.tlsOptions = {};
        this._partialResponse = "";
        if (this._socket) {
          const newSocketUpgradesExisting = socket.localPort === this._socket.localPort;
          if (newSocketUpgradesExisting) {
            this._removeSocketListeners(this.socket);
          } else {
            this._closeControlSocket();
          }
        }
        if (socket) {
          this._closingError = void 0;
          socket.setTimeout(0);
          socket.setEncoding(this._encoding);
          socket.setKeepAlive(true);
          socket.on("data", (data) => this._onControlSocketData(data));
          socket.on("end", () => this.closeWithError(new Error("Server sent FIN packet unexpectedly, closing connection.")));
          socket.on("close", (hadError) => {
            if (!hadError)
              this.closeWithError(new Error("Server closed connection unexpectedly."));
          });
          this._setupDefaultErrorHandlers(socket, "control socket");
        }
        this._socket = socket;
      }
      /**
       * Get the current FTP data connection if present.
       */
      get dataSocket() {
        return this._dataSocket;
      }
      /**
       * Set the socket for the data connection. This will automatically close the former data socket.
       */
      set dataSocket(socket) {
        this._closeSocket(this._dataSocket);
        if (socket) {
          socket.setTimeout(0);
          this._setupDefaultErrorHandlers(socket, "data socket");
        }
        this._dataSocket = socket;
      }
      /**
       * Get the currently used encoding.
       */
      get encoding() {
        return this._encoding;
      }
      /**
       * Set the encoding used for the control socket.
       *
       * See https://nodejs.org/api/buffer.html#buffer_buffers_and_character_encodings for what encodings
       * are supported by Node.
       */
      set encoding(encoding) {
        this._encoding = encoding;
        if (this.socket) {
          this.socket.setEncoding(encoding);
        }
      }
      /**
       * Send an FTP command without waiting for or handling the result.
       */
      send(command) {
        const containsPassword = command.startsWith("PASS");
        const message = containsPassword ? "> PASS ###" : `> ${command}`;
        this.log(message);
        this._socket.write(command + "\r\n", this.encoding);
      }
      /**
       * Send an FTP command and handle the first response. Use this if you have a simple
       * request-response situation.
       */
      request(command) {
        return this.handle(command, (res, task) => {
          if (res instanceof Error) {
            task.reject(res);
          } else {
            task.resolve(res);
          }
        });
      }
      /**
       * Send an FTP command and handle any response until you resolve/reject. Use this if you expect multiple responses
       * to a request. This returns a Promise that will hold whatever the response handler passed on when resolving/rejecting its task.
       */
      handle(command, responseHandler) {
        if (this._task) {
          const err = new Error("User launched a task while another one is still running. Forgot to use 'await' or '.then()'?");
          err.stack += `
Running task launched at: ${this._task.stack}`;
          this.closeWithError(err);
        }
        return new Promise((resolveTask, rejectTask) => {
          this._task = {
            stack: new Error().stack || "Unknown call stack",
            responseHandler,
            resolver: {
              resolve: (arg) => {
                this._stopTrackingTask();
                resolveTask(arg);
              },
              reject: (err) => {
                this._stopTrackingTask();
                rejectTask(err);
              }
            }
          };
          if (this._closingError) {
            const err = new Error(`Client is closed because ${this._closingError.message}`);
            err.stack += `
Closing reason: ${this._closingError.stack}`;
            err.code = this._closingError.code !== void 0 ? this._closingError.code : "0";
            this._passToHandler(err);
            return;
          }
          this.socket.setTimeout(this.timeout);
          if (command) {
            this.send(command);
          }
        });
      }
      /**
       * Log message if set to be verbose.
       */
      log(message) {
        if (this.verbose) {
          console.log(message);
        }
      }
      /**
       * Return true if the control socket is using TLS. This does not mean that a session
       * has already been negotiated.
       */
      get hasTLS() {
        return "encrypted" in this._socket;
      }
      /**
       * Removes reference to current task and handler. This won't resolve or reject the task.
       * @protected
       */
      _stopTrackingTask() {
        this.socket.setTimeout(0);
        this._task = void 0;
      }
      /**
       * Handle incoming data on the control socket. The chunk is going to be of type `string`
       * because we let `socket` handle encoding with `setEncoding`.
       * @protected
       */
      _onControlSocketData(chunk) {
        this.log(`< ${chunk}`);
        const completeResponse = this._partialResponse + chunk;
        const parsed = (0, parseControlResponse_1.parseControlResponse)(completeResponse);
        this._partialResponse = parsed.rest;
        for (const message of parsed.messages) {
          const code = parseInt(message.substr(0, 3), 10);
          const response = { code, message };
          const err = code >= 400 ? new FTPError2(response) : void 0;
          this._passToHandler(err ? err : response);
        }
      }
      /**
       * Send the current handler a response. This is usually a control socket response
       * or a socket event, like an error or timeout.
       * @protected
       */
      _passToHandler(response) {
        if (this._task) {
          this._task.responseHandler(response, this._task.resolver);
        }
      }
      /**
       * Setup all error handlers for a socket.
       * @protected
       */
      _setupDefaultErrorHandlers(socket, identifier) {
        socket.once("error", (error) => {
          error.message += ` (${identifier})`;
          this.closeWithError(error);
        });
        socket.once("close", (hadError) => {
          if (hadError) {
            this.closeWithError(new Error(`Socket closed due to transmission error (${identifier})`));
          }
        });
        socket.once("timeout", () => {
          socket.destroy();
          this.closeWithError(new Error(`Timeout (${identifier})`));
        });
      }
      /**
       * Close the control socket. Sends QUIT, then FIN, and ignores any response or error.
       */
      _closeControlSocket() {
        this._removeSocketListeners(this._socket);
        this._socket.on("error", doNothing);
        this.send("QUIT");
        this._closeSocket(this._socket);
      }
      /**
       * Close a socket, ignores any error.
       * @protected
       */
      _closeSocket(socket) {
        if (socket) {
          this._removeSocketListeners(socket);
          socket.on("error", doNothing);
          socket.destroy();
        }
      }
      /**
       * Remove all default listeners for socket.
       * @protected
       */
      _removeSocketListeners(socket) {
        socket.removeAllListeners();
        socket.removeAllListeners("timeout");
        socket.removeAllListeners("data");
        socket.removeAllListeners("end");
        socket.removeAllListeners("error");
        socket.removeAllListeners("close");
        socket.removeAllListeners("connect");
      }
      /**
       * Provide a new socket instance.
       *
       * Internal use only, replaced for unit tests.
       */
      _newSocket() {
        return new net_1.Socket();
      }
    };
    exports2.FTPContext = FTPContext;
  }
});

// node_modules/basic-ftp/dist/FileInfo.js
var require_FileInfo = __commonJS({
  "node_modules/basic-ftp/dist/FileInfo.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.FileInfo = exports2.FileType = void 0;
    var FileType;
    (function(FileType2) {
      FileType2[FileType2["Unknown"] = 0] = "Unknown";
      FileType2[FileType2["File"] = 1] = "File";
      FileType2[FileType2["Directory"] = 2] = "Directory";
      FileType2[FileType2["SymbolicLink"] = 3] = "SymbolicLink";
    })(FileType || (exports2.FileType = FileType = {}));
    var FileInfo2 = class {
      constructor(name) {
        this.name = name;
        this.type = FileType.Unknown;
        this.size = 0;
        this.rawModifiedAt = "";
        this.modifiedAt = void 0;
        this.permissions = void 0;
        this.hardLinkCount = void 0;
        this.link = void 0;
        this.group = void 0;
        this.user = void 0;
        this.uniqueID = void 0;
        this.name = name;
      }
      get isDirectory() {
        return this.type === FileType.Directory;
      }
      get isSymbolicLink() {
        return this.type === FileType.SymbolicLink;
      }
      get isFile() {
        return this.type === FileType.File;
      }
      /**
       * Deprecated, legacy API. Use `rawModifiedAt` instead.
       * @deprecated
       */
      get date() {
        return this.rawModifiedAt;
      }
      set date(rawModifiedAt) {
        this.rawModifiedAt = rawModifiedAt;
      }
    };
    exports2.FileInfo = FileInfo2;
    FileInfo2.UnixPermission = {
      Read: 4,
      Write: 2,
      Execute: 1
    };
  }
});

// node_modules/basic-ftp/dist/parseListDOS.js
var require_parseListDOS = __commonJS({
  "node_modules/basic-ftp/dist/parseListDOS.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.transformList = exports2.parseLine = exports2.testLine = void 0;
    var FileInfo_1 = require_FileInfo();
    var RE_LINE = new RegExp(
      "(\\S+)\\s+(\\S+)\\s+(?:(<DIR>)|([0-9]+))\\s+(\\S.*)"
      // First non-space followed by rest of line (name)
    );
    function testLine(line) {
      return /^\d{2}/.test(line) && RE_LINE.test(line);
    }
    exports2.testLine = testLine;
    function parseLine(line) {
      const groups = line.match(RE_LINE);
      if (groups === null) {
        return void 0;
      }
      const name = groups[5];
      if (name === "." || name === "..") {
        return void 0;
      }
      const file = new FileInfo_1.FileInfo(name);
      const fileType = groups[3];
      if (fileType === "<DIR>") {
        file.type = FileInfo_1.FileType.Directory;
        file.size = 0;
      } else {
        file.type = FileInfo_1.FileType.File;
        file.size = parseInt(groups[4], 10);
      }
      file.rawModifiedAt = groups[1] + " " + groups[2];
      return file;
    }
    exports2.parseLine = parseLine;
    function transformList(files) {
      return files;
    }
    exports2.transformList = transformList;
  }
});

// node_modules/basic-ftp/dist/parseListUnix.js
var require_parseListUnix = __commonJS({
  "node_modules/basic-ftp/dist/parseListUnix.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.transformList = exports2.parseLine = exports2.testLine = void 0;
    var FileInfo_1 = require_FileInfo();
    var JA_MONTH = "\u6708";
    var JA_DAY = "\u65E5";
    var JA_YEAR = "\u5E74";
    var RE_LINE = new RegExp("([bcdelfmpSs-])(((r|-)(w|-)([xsStTL-]))((r|-)(w|-)([xsStTL-]))((r|-)(w|-)([xsStTL-]?)))\\+?\\s*(\\d+)\\s+(?:(\\S+(?:\\s\\S+)*?)\\s+)?(?:(\\S+(?:\\s\\S+)*)\\s+)?(\\d+(?:,\\s*\\d+)?)\\s+((?:\\d+[-/]\\d+[-/]\\d+)|(?:\\S{3}\\s+\\d{1,2})|(?:\\d{1,2}\\s+\\S{3})|(?:\\d{1,2}" + JA_MONTH + "\\s+\\d{1,2}" + JA_DAY + "))\\s+((?:\\d+(?::\\d+)?)|(?:\\d{4}" + JA_YEAR + "))\\s(.*)");
    function testLine(line) {
      return RE_LINE.test(line);
    }
    exports2.testLine = testLine;
    function parseLine(line) {
      const groups = line.match(RE_LINE);
      if (groups === null) {
        return void 0;
      }
      const name = groups[21];
      if (name === "." || name === "..") {
        return void 0;
      }
      const file = new FileInfo_1.FileInfo(name);
      file.size = parseInt(groups[18], 10);
      file.user = groups[16];
      file.group = groups[17];
      file.hardLinkCount = parseInt(groups[15], 10);
      file.rawModifiedAt = groups[19] + " " + groups[20];
      file.permissions = {
        user: parseMode(groups[4], groups[5], groups[6]),
        group: parseMode(groups[8], groups[9], groups[10]),
        world: parseMode(groups[12], groups[13], groups[14])
      };
      switch (groups[1].charAt(0)) {
        case "d":
          file.type = FileInfo_1.FileType.Directory;
          break;
        case "e":
          file.type = FileInfo_1.FileType.SymbolicLink;
          break;
        case "l":
          file.type = FileInfo_1.FileType.SymbolicLink;
          break;
        case "b":
        case "c":
          file.type = FileInfo_1.FileType.File;
          break;
        case "f":
        case "-":
          file.type = FileInfo_1.FileType.File;
          break;
        default:
          file.type = FileInfo_1.FileType.Unknown;
      }
      if (file.isSymbolicLink) {
        const end = name.indexOf(" -> ");
        if (end !== -1) {
          file.name = name.substring(0, end);
          file.link = name.substring(end + 4);
        }
      }
      return file;
    }
    exports2.parseLine = parseLine;
    function transformList(files) {
      return files;
    }
    exports2.transformList = transformList;
    function parseMode(r, w, x) {
      let value = 0;
      if (r !== "-") {
        value += FileInfo_1.FileInfo.UnixPermission.Read;
      }
      if (w !== "-") {
        value += FileInfo_1.FileInfo.UnixPermission.Write;
      }
      const execToken = x.charAt(0);
      if (execToken !== "-" && execToken.toUpperCase() !== execToken) {
        value += FileInfo_1.FileInfo.UnixPermission.Execute;
      }
      return value;
    }
  }
});

// node_modules/basic-ftp/dist/parseListMLSD.js
var require_parseListMLSD = __commonJS({
  "node_modules/basic-ftp/dist/parseListMLSD.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.parseMLSxDate = exports2.transformList = exports2.parseLine = exports2.testLine = void 0;
    var FileInfo_1 = require_FileInfo();
    function parseSize(value, info) {
      info.size = parseInt(value, 10);
    }
    var factHandlersByName = {
      "size": parseSize,
      // File size
      "sizd": parseSize,
      // Directory size
      "unique": (value, info) => {
        info.uniqueID = value;
      },
      "modify": (value, info) => {
        info.modifiedAt = parseMLSxDate(value);
        info.rawModifiedAt = info.modifiedAt.toISOString();
      },
      "type": (value, info) => {
        if (value.startsWith("OS.unix=slink")) {
          info.type = FileInfo_1.FileType.SymbolicLink;
          info.link = value.substr(value.indexOf(":") + 1);
          return 1;
        }
        switch (value) {
          case "file":
            info.type = FileInfo_1.FileType.File;
            break;
          case "dir":
            info.type = FileInfo_1.FileType.Directory;
            break;
          case "OS.unix=symlink":
            info.type = FileInfo_1.FileType.SymbolicLink;
            break;
          case "cdir":
          // Current directory being listed
          case "pdir":
            return 2;
          // Don't include these entries in the listing
          default:
            info.type = FileInfo_1.FileType.Unknown;
        }
        return 1;
      },
      "unix.mode": (value, info) => {
        const digits = value.substr(-3);
        info.permissions = {
          user: parseInt(digits[0], 10),
          group: parseInt(digits[1], 10),
          world: parseInt(digits[2], 10)
        };
      },
      "unix.ownername": (value, info) => {
        info.user = value;
      },
      "unix.owner": (value, info) => {
        if (info.user === void 0)
          info.user = value;
      },
      get "unix.uid"() {
        return this["unix.owner"];
      },
      "unix.groupname": (value, info) => {
        info.group = value;
      },
      "unix.group": (value, info) => {
        if (info.group === void 0)
          info.group = value;
      },
      get "unix.gid"() {
        return this["unix.group"];
      }
      // Regarding the fact "perm":
      // We don't handle permission information stored in "perm" because its information is conceptually
      // different from what users of FTP clients usually associate with "permissions". Those that have
      // some expectations (and probably want to edit them with a SITE command) often unknowingly expect
      // the Unix permission system. The information passed by "perm" describes what FTP commands can be
      // executed with a file/directory. But even this can be either incomplete or just meant as a "guide"
      // as the spec mentions. From https://tools.ietf.org/html/rfc3659#section-7.5.5: "The permissions are
      // described here as they apply to FTP commands. They may not map easily into particular permissions
      // available on the server's operating system." The parser by Apache Commons tries to translate these
      // to Unix permissions – this is misleading users and might not even be correct.
    };
    function splitStringOnce(str, delimiter) {
      const pos = str.indexOf(delimiter);
      const a = str.substr(0, pos);
      const b = str.substr(pos + delimiter.length);
      return [a, b];
    }
    function testLine(line) {
      return /^\S+=\S+;/.test(line) || line.startsWith(" ");
    }
    exports2.testLine = testLine;
    function parseLine(line) {
      const [packedFacts, name] = splitStringOnce(line, " ");
      if (name === "" || name === "." || name === "..") {
        return void 0;
      }
      const info = new FileInfo_1.FileInfo(name);
      const facts = packedFacts.split(";");
      for (const fact of facts) {
        const [factName, factValue] = splitStringOnce(fact, "=");
        if (!factValue) {
          continue;
        }
        const factHandler = factHandlersByName[factName.toLowerCase()];
        if (!factHandler) {
          continue;
        }
        const result = factHandler(factValue, info);
        if (result === 2) {
          return void 0;
        }
      }
      return info;
    }
    exports2.parseLine = parseLine;
    function transformList(files) {
      const nonLinksByID = /* @__PURE__ */ new Map();
      for (const file of files) {
        if (!file.isSymbolicLink && file.uniqueID !== void 0) {
          nonLinksByID.set(file.uniqueID, file);
        }
      }
      const resolvedFiles = [];
      for (const file of files) {
        if (file.isSymbolicLink && file.uniqueID !== void 0 && file.link === void 0) {
          const target = nonLinksByID.get(file.uniqueID);
          if (target !== void 0) {
            file.link = target.name;
          }
        }
        const isPartOfDirectory = !file.name.includes("/");
        if (isPartOfDirectory) {
          resolvedFiles.push(file);
        }
      }
      return resolvedFiles;
    }
    exports2.transformList = transformList;
    function parseMLSxDate(fact) {
      return new Date(Date.UTC(
        +fact.slice(0, 4),
        // Year
        +fact.slice(4, 6) - 1,
        // Month
        +fact.slice(6, 8),
        // Date
        +fact.slice(8, 10),
        // Hours
        +fact.slice(10, 12),
        // Minutes
        +fact.slice(12, 14),
        // Seconds
        +fact.slice(15, 18)
        // Milliseconds
      ));
    }
    exports2.parseMLSxDate = parseMLSxDate;
  }
});

// node_modules/basic-ftp/dist/parseList.js
var require_parseList = __commonJS({
  "node_modules/basic-ftp/dist/parseList.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.parseList = void 0;
    var dosParser = __importStar(require_parseListDOS());
    var unixParser = __importStar(require_parseListUnix());
    var mlsdParser = __importStar(require_parseListMLSD());
    var availableParsers = [
      dosParser,
      unixParser,
      mlsdParser
      // Keep MLSD last, may accept filename only
    ];
    function firstCompatibleParser(line, parsers) {
      return parsers.find((parser) => parser.testLine(line) === true);
    }
    function isNotBlank(str) {
      return str.trim() !== "";
    }
    function isNotMeta(str) {
      return !str.startsWith("total");
    }
    var REGEX_NEWLINE = /\r?\n/;
    function parseList(rawList) {
      const lines = rawList.split(REGEX_NEWLINE).filter(isNotBlank).filter(isNotMeta);
      if (lines.length === 0) {
        return [];
      }
      const testLine = lines[lines.length - 1];
      const parser = firstCompatibleParser(testLine, availableParsers);
      if (!parser) {
        throw new Error("This library only supports MLSD, Unix- or DOS-style directory listing. Your FTP server seems to be using another format. You can see the transmitted listing when setting `client.ftp.verbose = true`. You can then provide a custom parser to `client.parseList`, see the documentation for details.");
      }
      const files = lines.map(parser.parseLine).filter((info) => info !== void 0);
      return parser.transformList(files);
    }
    exports2.parseList = parseList;
  }
});

// node_modules/basic-ftp/dist/ProgressTracker.js
var require_ProgressTracker = __commonJS({
  "node_modules/basic-ftp/dist/ProgressTracker.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ProgressTracker = void 0;
    var ProgressTracker = class {
      constructor() {
        this.bytesOverall = 0;
        this.intervalMs = 500;
        this.onStop = noop;
        this.onHandle = noop;
      }
      /**
       * Register a new handler for progress info. Use `undefined` to disable reporting.
       */
      reportTo(onHandle = noop) {
        this.onHandle = onHandle;
      }
      /**
       * Start tracking transfer progress of a socket.
       *
       * @param socket  The socket to observe.
       * @param name  A name associated with this progress tracking, e.g. a filename.
       * @param type  The type of the transfer, typically "upload" or "download".
       */
      start(socket, name, type) {
        let lastBytes = 0;
        this.onStop = poll(this.intervalMs, () => {
          const bytes = socket.bytesRead + socket.bytesWritten;
          this.bytesOverall += bytes - lastBytes;
          lastBytes = bytes;
          this.onHandle({
            name,
            type,
            bytes,
            bytesOverall: this.bytesOverall
          });
        });
      }
      /**
       * Stop tracking transfer progress.
       */
      stop() {
        this.onStop(false);
      }
      /**
       * Call the progress handler one more time, then stop tracking.
       */
      updateAndStop() {
        this.onStop(true);
      }
    };
    exports2.ProgressTracker = ProgressTracker;
    function poll(intervalMs, updateFunc) {
      const id = setInterval(updateFunc, intervalMs);
      const stopFunc = (stopWithUpdate) => {
        clearInterval(id);
        if (stopWithUpdate) {
          updateFunc();
        }
        updateFunc = noop;
      };
      updateFunc();
      return stopFunc;
    }
    function noop() {
    }
  }
});

// node_modules/basic-ftp/dist/StringWriter.js
var require_StringWriter = __commonJS({
  "node_modules/basic-ftp/dist/StringWriter.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.StringWriter = void 0;
    var stream_1 = require("stream");
    var StringWriter = class extends stream_1.Writable {
      constructor() {
        super(...arguments);
        this.buf = Buffer.alloc(0);
      }
      _write(chunk, _, callback) {
        if (chunk instanceof Buffer) {
          this.buf = Buffer.concat([this.buf, chunk]);
          callback(null);
        } else {
          callback(new Error("StringWriter expects chunks of type 'Buffer'."));
        }
      }
      getText(encoding) {
        return this.buf.toString(encoding);
      }
    };
    exports2.StringWriter = StringWriter;
  }
});

// node_modules/basic-ftp/dist/netUtils.js
var require_netUtils = __commonJS({
  "node_modules/basic-ftp/dist/netUtils.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ipIsPrivateV4Address = exports2.upgradeSocket = exports2.describeAddress = exports2.describeTLS = void 0;
    var tls_1 = require("tls");
    function describeTLS(socket) {
      if (socket instanceof tls_1.TLSSocket) {
        const protocol = socket.getProtocol();
        return protocol ? protocol : "Server socket or disconnected client socket";
      }
      return "No encryption";
    }
    exports2.describeTLS = describeTLS;
    function describeAddress(socket) {
      if (socket.remoteFamily === "IPv6") {
        return `[${socket.remoteAddress}]:${socket.remotePort}`;
      }
      return `${socket.remoteAddress}:${socket.remotePort}`;
    }
    exports2.describeAddress = describeAddress;
    function upgradeSocket(socket, options) {
      return new Promise((resolve, reject) => {
        const tlsOptions = Object.assign({}, options, {
          socket
        });
        const tlsSocket = (0, tls_1.connect)(tlsOptions, () => {
          const expectCertificate = tlsOptions.rejectUnauthorized !== false;
          if (expectCertificate && !tlsSocket.authorized) {
            reject(tlsSocket.authorizationError);
          } else {
            tlsSocket.removeAllListeners("error");
            resolve(tlsSocket);
          }
        }).once("error", (error) => {
          reject(error);
        });
      });
    }
    exports2.upgradeSocket = upgradeSocket;
    function ipIsPrivateV4Address(ip = "") {
      if (ip.startsWith("::ffff:")) {
        ip = ip.substr(7);
      }
      const octets = ip.split(".").map((o) => parseInt(o, 10));
      return octets[0] === 10 || octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31 || octets[0] === 192 && octets[1] === 168 || ip === "127.0.0.1";
    }
    exports2.ipIsPrivateV4Address = ipIsPrivateV4Address;
  }
});

// node_modules/basic-ftp/dist/transfer.js
var require_transfer = __commonJS({
  "node_modules/basic-ftp/dist/transfer.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.downloadTo = exports2.uploadFrom = exports2.connectForPassiveTransfer = exports2.parsePasvResponse = exports2.enterPassiveModeIPv4 = exports2.parseEpsvResponse = exports2.enterPassiveModeIPv6 = void 0;
    var netUtils_1 = require_netUtils();
    var stream_1 = require("stream");
    var tls_1 = require("tls");
    var parseControlResponse_1 = require_parseControlResponse();
    async function enterPassiveModeIPv6(ftp) {
      const res = await ftp.request("EPSV");
      const port = parseEpsvResponse(res.message);
      if (!port) {
        throw new Error("Can't parse EPSV response: " + res.message);
      }
      const controlHost = ftp.socket.remoteAddress;
      if (controlHost === void 0) {
        throw new Error("Control socket is disconnected, can't get remote address.");
      }
      await connectForPassiveTransfer(controlHost, port, ftp);
      return res;
    }
    exports2.enterPassiveModeIPv6 = enterPassiveModeIPv6;
    function parseEpsvResponse(message) {
      const groups = message.match(/[|!]{3}(.+)[|!]/);
      if (groups === null || groups[1] === void 0) {
        throw new Error(`Can't parse response to 'EPSV': ${message}`);
      }
      const port = parseInt(groups[1], 10);
      if (Number.isNaN(port)) {
        throw new Error(`Can't parse response to 'EPSV', port is not a number: ${message}`);
      }
      return port;
    }
    exports2.parseEpsvResponse = parseEpsvResponse;
    async function enterPassiveModeIPv4(ftp) {
      const res = await ftp.request("PASV");
      const target = parsePasvResponse(res.message);
      if (!target) {
        throw new Error("Can't parse PASV response: " + res.message);
      }
      const controlHost = ftp.socket.remoteAddress;
      if ((0, netUtils_1.ipIsPrivateV4Address)(target.host) && controlHost && !(0, netUtils_1.ipIsPrivateV4Address)(controlHost)) {
        target.host = controlHost;
      }
      await connectForPassiveTransfer(target.host, target.port, ftp);
      return res;
    }
    exports2.enterPassiveModeIPv4 = enterPassiveModeIPv4;
    function parsePasvResponse(message) {
      const groups = message.match(/([-\d]+,[-\d]+,[-\d]+,[-\d]+),([-\d]+),([-\d]+)/);
      if (groups === null || groups.length !== 4) {
        throw new Error(`Can't parse response to 'PASV': ${message}`);
      }
      return {
        host: groups[1].replace(/,/g, "."),
        port: (parseInt(groups[2], 10) & 255) * 256 + (parseInt(groups[3], 10) & 255)
      };
    }
    exports2.parsePasvResponse = parsePasvResponse;
    function connectForPassiveTransfer(host, port, ftp) {
      return new Promise((resolve, reject) => {
        let socket = ftp._newSocket();
        const handleConnErr = function(err) {
          err.message = "Can't open data connection in passive mode: " + err.message;
          reject(err);
        };
        const handleTimeout = function() {
          socket.destroy();
          reject(new Error(`Timeout when trying to open data connection to ${host}:${port}`));
        };
        socket.setTimeout(ftp.timeout);
        socket.on("error", handleConnErr);
        socket.on("timeout", handleTimeout);
        socket.connect({ port, host, family: ftp.ipFamily }, () => {
          if (ftp.socket instanceof tls_1.TLSSocket) {
            socket = (0, tls_1.connect)(Object.assign({}, ftp.tlsOptions, {
              socket,
              // Reuse the TLS session negotiated earlier when the control connection
              // was upgraded. Servers expect this because it provides additional
              // security: If a completely new session would be negotiated, a hacker
              // could guess the port and connect to the new data connection before we do
              // by just starting his/her own TLS session.
              session: ftp.socket.getSession()
            }));
          }
          socket.removeListener("error", handleConnErr);
          socket.removeListener("timeout", handleTimeout);
          ftp.dataSocket = socket;
          resolve();
        });
      });
    }
    exports2.connectForPassiveTransfer = connectForPassiveTransfer;
    var TransferResolver = class {
      /**
       * Instantiate a TransferResolver
       */
      constructor(ftp, progress) {
        this.ftp = ftp;
        this.progress = progress;
        this.response = void 0;
        this.dataTransferDone = false;
      }
      /**
       * Mark the beginning of a transfer.
       *
       * @param name - Name of the transfer, usually the filename.
       * @param type - Type of transfer, usually "upload" or "download".
       */
      onDataStart(name, type) {
        if (this.ftp.dataSocket === void 0) {
          throw new Error("Data transfer should start but there is no data connection.");
        }
        this.ftp.socket.setTimeout(0);
        this.ftp.dataSocket.setTimeout(this.ftp.timeout);
        this.progress.start(this.ftp.dataSocket, name, type);
      }
      /**
       * The data connection has finished the transfer.
       */
      onDataDone(task) {
        this.progress.updateAndStop();
        this.ftp.socket.setTimeout(this.ftp.timeout);
        if (this.ftp.dataSocket) {
          this.ftp.dataSocket.setTimeout(0);
        }
        this.dataTransferDone = true;
        this.tryResolve(task);
      }
      /**
       * The control connection reports the transfer as finished.
       */
      onControlDone(task, response) {
        this.response = response;
        this.tryResolve(task);
      }
      /**
       * An error has been reported and the task should be rejected.
       */
      onError(task, err) {
        this.progress.updateAndStop();
        this.ftp.socket.setTimeout(this.ftp.timeout);
        this.ftp.dataSocket = void 0;
        task.reject(err);
      }
      /**
       * Control connection sent an unexpected request requiring a response from our part. We
       * can't provide that (because unknown) and have to close the contrext with an error because
       * the FTP server is now caught up in a state we can't resolve.
       */
      onUnexpectedRequest(response) {
        const err = new Error(`Unexpected FTP response is requesting an answer: ${response.message}`);
        this.ftp.closeWithError(err);
      }
      tryResolve(task) {
        const canResolve = this.dataTransferDone && this.response !== void 0;
        if (canResolve) {
          this.ftp.dataSocket = void 0;
          task.resolve(this.response);
        }
      }
    };
    function uploadFrom(source, config) {
      const resolver = new TransferResolver(config.ftp, config.tracker);
      const fullCommand = `${config.command} ${config.remotePath}`;
      return config.ftp.handle(fullCommand, (res, task) => {
        if (res instanceof Error) {
          resolver.onError(task, res);
        } else if (res.code === 150 || res.code === 125) {
          const dataSocket = config.ftp.dataSocket;
          if (!dataSocket) {
            resolver.onError(task, new Error("Upload should begin but no data connection is available."));
            return;
          }
          const canUpload = "getCipher" in dataSocket ? dataSocket.getCipher() !== void 0 : true;
          onConditionOrEvent(canUpload, dataSocket, "secureConnect", () => {
            config.ftp.log(`Uploading to ${(0, netUtils_1.describeAddress)(dataSocket)} (${(0, netUtils_1.describeTLS)(dataSocket)})`);
            resolver.onDataStart(config.remotePath, config.type);
            (0, stream_1.pipeline)(source, dataSocket, (err) => {
              if (err) {
                resolver.onError(task, err);
              } else {
                resolver.onDataDone(task);
              }
            });
          });
        } else if ((0, parseControlResponse_1.positiveCompletion)(res.code)) {
          resolver.onControlDone(task, res);
        } else if ((0, parseControlResponse_1.positiveIntermediate)(res.code)) {
          resolver.onUnexpectedRequest(res);
        }
      });
    }
    exports2.uploadFrom = uploadFrom;
    function downloadTo(destination, config) {
      if (!config.ftp.dataSocket) {
        throw new Error("Download will be initiated but no data connection is available.");
      }
      const resolver = new TransferResolver(config.ftp, config.tracker);
      return config.ftp.handle(config.command, (res, task) => {
        if (res instanceof Error) {
          resolver.onError(task, res);
        } else if (res.code === 150 || res.code === 125) {
          const dataSocket = config.ftp.dataSocket;
          if (!dataSocket) {
            resolver.onError(task, new Error("Download should begin but no data connection is available."));
            return;
          }
          config.ftp.log(`Downloading from ${(0, netUtils_1.describeAddress)(dataSocket)} (${(0, netUtils_1.describeTLS)(dataSocket)})`);
          resolver.onDataStart(config.remotePath, config.type);
          (0, stream_1.pipeline)(dataSocket, destination, (err) => {
            if (err) {
              resolver.onError(task, err);
            } else {
              resolver.onDataDone(task);
            }
          });
        } else if (res.code === 350) {
          config.ftp.send("RETR " + config.remotePath);
        } else if ((0, parseControlResponse_1.positiveCompletion)(res.code)) {
          resolver.onControlDone(task, res);
        } else if ((0, parseControlResponse_1.positiveIntermediate)(res.code)) {
          resolver.onUnexpectedRequest(res);
        }
      });
    }
    exports2.downloadTo = downloadTo;
    function onConditionOrEvent(condition, emitter, eventName, action) {
      if (condition === true) {
        action();
      } else {
        emitter.once(eventName, () => action());
      }
    }
  }
});

// node_modules/basic-ftp/dist/Client.js
var require_Client = __commonJS({
  "node_modules/basic-ftp/dist/Client.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Client = void 0;
    var fs_1 = require("fs");
    var path_1 = require("path");
    var tls_1 = require("tls");
    var util_1 = require("util");
    var FtpContext_1 = require_FtpContext();
    var parseList_1 = require_parseList();
    var ProgressTracker_1 = require_ProgressTracker();
    var StringWriter_1 = require_StringWriter();
    var parseListMLSD_1 = require_parseListMLSD();
    var netUtils_1 = require_netUtils();
    var transfer_1 = require_transfer();
    var parseControlResponse_1 = require_parseControlResponse();
    var fsReadDir = (0, util_1.promisify)(fs_1.readdir);
    var fsMkDir = (0, util_1.promisify)(fs_1.mkdir);
    var fsStat = (0, util_1.promisify)(fs_1.stat);
    var fsOpen = (0, util_1.promisify)(fs_1.open);
    var fsClose = (0, util_1.promisify)(fs_1.close);
    var fsUnlink = (0, util_1.promisify)(fs_1.unlink);
    var LIST_COMMANDS_DEFAULT = () => ["LIST -a", "LIST"];
    var LIST_COMMANDS_MLSD = () => ["MLSD", "LIST -a", "LIST"];
    var Client = class {
      /**
       * Instantiate an FTP client.
       *
       * @param timeout  Timeout in milliseconds, use 0 for no timeout. Optional, default is 30 seconds.
       */
      constructor(timeout = 3e4) {
        this.availableListCommands = LIST_COMMANDS_DEFAULT();
        this.ftp = new FtpContext_1.FTPContext(timeout);
        this.prepareTransfer = this._enterFirstCompatibleMode([transfer_1.enterPassiveModeIPv6, transfer_1.enterPassiveModeIPv4]);
        this.parseList = parseList_1.parseList;
        this._progressTracker = new ProgressTracker_1.ProgressTracker();
      }
      /**
       * Close the client and all open socket connections.
       *
       * Close the client and all open socket connections. The client can’t be used anymore after calling this method,
       * you have to either reconnect with `access` or `connect` or instantiate a new instance to continue any work.
       * A client is also closed automatically if any timeout or connection error occurs.
       */
      close() {
        this.ftp.close();
        this._progressTracker.stop();
      }
      /**
       * Returns true if the client is closed and can't be used anymore.
       */
      get closed() {
        return this.ftp.closed;
      }
      /**
       * Connect (or reconnect) to an FTP server.
       *
       * This is an instance method and thus can be called multiple times during the lifecycle of a `Client`
       * instance. Whenever you do, the client is reset with a new control connection. This also implies that
       * you can reopen a `Client` instance that has been closed due to an error when reconnecting with this
       * method. In fact, reconnecting is the only way to continue using a closed `Client`.
       *
       * @param host  Host the client should connect to. Optional, default is "localhost".
       * @param port  Port the client should connect to. Optional, default is 21.
       */
      connect(host = "localhost", port = 21) {
        this.ftp.reset();
        this.ftp.socket.connect({
          host,
          port,
          family: this.ftp.ipFamily
        }, () => this.ftp.log(`Connected to ${(0, netUtils_1.describeAddress)(this.ftp.socket)} (${(0, netUtils_1.describeTLS)(this.ftp.socket)})`));
        return this._handleConnectResponse();
      }
      /**
       * As `connect` but using implicit TLS. Implicit TLS is not an FTP standard and has been replaced by
       * explicit TLS. There are still FTP servers that support only implicit TLS, though.
       */
      connectImplicitTLS(host = "localhost", port = 21, tlsOptions = {}) {
        this.ftp.reset();
        this.ftp.socket = (0, tls_1.connect)(port, host, tlsOptions, () => this.ftp.log(`Connected to ${(0, netUtils_1.describeAddress)(this.ftp.socket)} (${(0, netUtils_1.describeTLS)(this.ftp.socket)})`));
        this.ftp.tlsOptions = tlsOptions;
        return this._handleConnectResponse();
      }
      /**
       * Handles the first reponse by an FTP server after the socket connection has been established.
       */
      _handleConnectResponse() {
        return this.ftp.handle(void 0, (res, task) => {
          if (res instanceof Error) {
            task.reject(res);
          } else if ((0, parseControlResponse_1.positiveCompletion)(res.code)) {
            task.resolve(res);
          } else {
            task.reject(new FtpContext_1.FTPError(res));
          }
        });
      }
      /**
       * Send an FTP command and handle the first response.
       */
      send(command, ignoreErrorCodesDEPRECATED = false) {
        if (ignoreErrorCodesDEPRECATED) {
          this.ftp.log("Deprecated call using send(command, flag) with boolean flag to ignore errors. Use sendIgnoringError(command).");
          return this.sendIgnoringError(command);
        }
        return this.ftp.request(command);
      }
      /**
       * Send an FTP command and ignore an FTP error response. Any other kind of error or timeout will still reject the Promise.
       *
       * @param command
       */
      sendIgnoringError(command) {
        return this.ftp.handle(command, (res, task) => {
          if (res instanceof FtpContext_1.FTPError) {
            task.resolve({ code: res.code, message: res.message });
          } else if (res instanceof Error) {
            task.reject(res);
          } else {
            task.resolve(res);
          }
        });
      }
      /**
       * Upgrade the current socket connection to TLS.
       *
       * @param options  TLS options as in `tls.connect(options)`, optional.
       * @param command  Set the authentication command. Optional, default is "AUTH TLS".
       */
      async useTLS(options = {}, command = "AUTH TLS") {
        const ret = await this.send(command);
        this.ftp.socket = await (0, netUtils_1.upgradeSocket)(this.ftp.socket, options);
        this.ftp.tlsOptions = options;
        this.ftp.log(`Control socket is using: ${(0, netUtils_1.describeTLS)(this.ftp.socket)}`);
        return ret;
      }
      /**
       * Login a user with a password.
       *
       * @param user  Username to use for login. Optional, default is "anonymous".
       * @param password  Password to use for login. Optional, default is "guest".
       */
      login(user = "anonymous", password = "guest") {
        this.ftp.log(`Login security: ${(0, netUtils_1.describeTLS)(this.ftp.socket)}`);
        return this.ftp.handle("USER " + user, (res, task) => {
          if (res instanceof Error) {
            task.reject(res);
          } else if ((0, parseControlResponse_1.positiveCompletion)(res.code)) {
            task.resolve(res);
          } else if (res.code === 331) {
            this.ftp.send("PASS " + password);
          } else {
            task.reject(new FtpContext_1.FTPError(res));
          }
        });
      }
      /**
       * Set the usual default settings.
       *
       * Settings used:
       * * Binary mode (TYPE I)
       * * File structure (STRU F)
       * * Additional settings for FTPS (PBSZ 0, PROT P)
       */
      async useDefaultSettings() {
        const features = await this.features();
        const supportsMLSD = features.has("MLST");
        this.availableListCommands = supportsMLSD ? LIST_COMMANDS_MLSD() : LIST_COMMANDS_DEFAULT();
        await this.send("TYPE I");
        await this.sendIgnoringError("STRU F");
        await this.sendIgnoringError("OPTS UTF8 ON");
        if (supportsMLSD) {
          await this.sendIgnoringError("OPTS MLST type;size;modify;unique;unix.mode;unix.owner;unix.group;unix.ownername;unix.groupname;");
        }
        if (this.ftp.hasTLS) {
          await this.sendIgnoringError("PBSZ 0");
          await this.sendIgnoringError("PROT P");
        }
      }
      /**
       * Convenience method that calls `connect`, `useTLS`, `login` and `useDefaultSettings`.
       *
       * This is an instance method and thus can be called multiple times during the lifecycle of a `Client`
       * instance. Whenever you do, the client is reset with a new control connection. This also implies that
       * you can reopen a `Client` instance that has been closed due to an error when reconnecting with this
       * method. In fact, reconnecting is the only way to continue using a closed `Client`.
       */
      async access(options = {}) {
        var _a, _b;
        const useExplicitTLS = options.secure === true;
        const useImplicitTLS = options.secure === "implicit";
        let welcome;
        if (useImplicitTLS) {
          welcome = await this.connectImplicitTLS(options.host, options.port, options.secureOptions);
        } else {
          welcome = await this.connect(options.host, options.port);
        }
        if (useExplicitTLS) {
          const secureOptions = (_a = options.secureOptions) !== null && _a !== void 0 ? _a : {};
          secureOptions.host = (_b = secureOptions.host) !== null && _b !== void 0 ? _b : options.host;
          await this.useTLS(secureOptions);
        }
        await this.sendIgnoringError("OPTS UTF8 ON");
        await this.login(options.user, options.password);
        await this.useDefaultSettings();
        return welcome;
      }
      /**
       * Get the current working directory.
       */
      async pwd() {
        const res = await this.send("PWD");
        const parsed = res.message.match(/"(.+)"/);
        if (parsed === null || parsed[1] === void 0) {
          throw new Error(`Can't parse response to command 'PWD': ${res.message}`);
        }
        return parsed[1];
      }
      /**
       * Get a description of supported features.
       *
       * This sends the FEAT command and parses the result into a Map where keys correspond to available commands
       * and values hold further information. Be aware that your FTP servers might not support this
       * command in which case this method will not throw an exception but just return an empty Map.
       */
      async features() {
        const res = await this.sendIgnoringError("FEAT");
        const features = /* @__PURE__ */ new Map();
        if (res.code < 400 && (0, parseControlResponse_1.isMultiline)(res.message)) {
          res.message.split("\n").slice(1, -1).forEach((line) => {
            const entry = line.trim().split(" ");
            features.set(entry[0], entry[1] || "");
          });
        }
        return features;
      }
      /**
       * Set the working directory.
       */
      async cd(path4) {
        const validPath = await this.protectWhitespace(path4);
        return this.send("CWD " + validPath);
      }
      /**
       * Switch to the parent directory of the working directory.
       */
      async cdup() {
        return this.send("CDUP");
      }
      /**
       * Get the last modified time of a file. This is not supported by every FTP server, in which case
       * calling this method will throw an exception.
       */
      async lastMod(path4) {
        const validPath = await this.protectWhitespace(path4);
        const res = await this.send(`MDTM ${validPath}`);
        const date = res.message.slice(4);
        return (0, parseListMLSD_1.parseMLSxDate)(date);
      }
      /**
       * Get the size of a file.
       */
      async size(path4) {
        const validPath = await this.protectWhitespace(path4);
        const command = `SIZE ${validPath}`;
        const res = await this.send(command);
        const size = parseInt(res.message.slice(4), 10);
        if (Number.isNaN(size)) {
          throw new Error(`Can't parse response to command '${command}' as a numerical value: ${res.message}`);
        }
        return size;
      }
      /**
       * Rename a file.
       *
       * Depending on the FTP server this might also be used to move a file from one
       * directory to another by providing full paths.
       */
      async rename(srcPath, destPath) {
        const validSrc = await this.protectWhitespace(srcPath);
        const validDest = await this.protectWhitespace(destPath);
        await this.send("RNFR " + validSrc);
        return this.send("RNTO " + validDest);
      }
      /**
       * Remove a file from the current working directory.
       *
       * You can ignore FTP error return codes which won't throw an exception if e.g.
       * the file doesn't exist.
       */
      async remove(path4, ignoreErrorCodes = false) {
        const validPath = await this.protectWhitespace(path4);
        if (ignoreErrorCodes) {
          return this.sendIgnoringError(`DELE ${validPath}`);
        }
        return this.send(`DELE ${validPath}`);
      }
      /**
       * Report transfer progress for any upload or download to a given handler.
       *
       * This will also reset the overall transfer counter that can be used for multiple transfers. You can
       * also call the function without a handler to stop reporting to an earlier one.
       *
       * @param handler  Handler function to call on transfer progress.
       */
      trackProgress(handler) {
        this._progressTracker.bytesOverall = 0;
        this._progressTracker.reportTo(handler);
      }
      /**
       * Upload data from a readable stream or a local file to a remote file.
       *
       * @param source  Readable stream or path to a local file.
       * @param toRemotePath  Path to a remote file to write to.
       */
      async uploadFrom(source, toRemotePath, options = {}) {
        return this._uploadWithCommand(source, toRemotePath, "STOR", options);
      }
      /**
       * Upload data from a readable stream or a local file by appending it to an existing file. If the file doesn't
       * exist the FTP server should create it.
       *
       * @param source  Readable stream or path to a local file.
       * @param toRemotePath  Path to a remote file to write to.
       */
      async appendFrom(source, toRemotePath, options = {}) {
        return this._uploadWithCommand(source, toRemotePath, "APPE", options);
      }
      /**
       * @protected
       */
      async _uploadWithCommand(source, remotePath, command, options) {
        if (typeof source === "string") {
          return this._uploadLocalFile(source, remotePath, command, options);
        }
        return this._uploadFromStream(source, remotePath, command);
      }
      /**
       * @protected
       */
      async _uploadLocalFile(localPath, remotePath, command, options) {
        const fd = await fsOpen(localPath, "r");
        const source = (0, fs_1.createReadStream)("", {
          fd,
          start: options.localStart,
          end: options.localEndInclusive,
          autoClose: false
        });
        try {
          return await this._uploadFromStream(source, remotePath, command);
        } finally {
          await ignoreError(() => fsClose(fd));
        }
      }
      /**
       * @protected
       */
      async _uploadFromStream(source, remotePath, command) {
        const onError = (err) => this.ftp.closeWithError(err);
        source.once("error", onError);
        try {
          const validPath = await this.protectWhitespace(remotePath);
          await this.prepareTransfer(this.ftp);
          return await (0, transfer_1.uploadFrom)(source, {
            ftp: this.ftp,
            tracker: this._progressTracker,
            command,
            remotePath: validPath,
            type: "upload"
          });
        } finally {
          source.removeListener("error", onError);
        }
      }
      /**
       * Download a remote file and pipe its data to a writable stream or to a local file.
       *
       * You can optionally define at which position of the remote file you'd like to start
       * downloading. If the destination you provide is a file, the offset will be applied
       * to it as well. For example: To resume a failed download, you'd request the size of
       * the local, partially downloaded file and use that as the offset. Assuming the size
       * is 23, you'd download the rest using `downloadTo("local.txt", "remote.txt", 23)`.
       *
       * @param destination  Stream or path for a local file to write to.
       * @param fromRemotePath  Path of the remote file to read from.
       * @param startAt  Position within the remote file to start downloading at. If the destination is a file, this offset is also applied to it.
       */
      async downloadTo(destination, fromRemotePath, startAt = 0) {
        if (typeof destination === "string") {
          return this._downloadToFile(destination, fromRemotePath, startAt);
        }
        return this._downloadToStream(destination, fromRemotePath, startAt);
      }
      /**
       * @protected
       */
      async _downloadToFile(localPath, remotePath, startAt) {
        const appendingToLocalFile = startAt > 0;
        const fileSystemFlags = appendingToLocalFile ? "r+" : "w";
        const fd = await fsOpen(localPath, fileSystemFlags);
        const destination = (0, fs_1.createWriteStream)("", {
          fd,
          start: startAt,
          autoClose: false
        });
        try {
          return await this._downloadToStream(destination, remotePath, startAt);
        } catch (err) {
          const localFileStats = await ignoreError(() => fsStat(localPath));
          const hasDownloadedData = localFileStats && localFileStats.size > 0;
          const shouldRemoveLocalFile = !appendingToLocalFile && !hasDownloadedData;
          if (shouldRemoveLocalFile) {
            await ignoreError(() => fsUnlink(localPath));
          }
          throw err;
        } finally {
          await ignoreError(() => fsClose(fd));
        }
      }
      /**
       * @protected
       */
      async _downloadToStream(destination, remotePath, startAt) {
        const onError = (err) => this.ftp.closeWithError(err);
        destination.once("error", onError);
        try {
          const validPath = await this.protectWhitespace(remotePath);
          await this.prepareTransfer(this.ftp);
          return await (0, transfer_1.downloadTo)(destination, {
            ftp: this.ftp,
            tracker: this._progressTracker,
            command: startAt > 0 ? `REST ${startAt}` : `RETR ${validPath}`,
            remotePath: validPath,
            type: "download"
          });
        } finally {
          destination.removeListener("error", onError);
          destination.end();
        }
      }
      /**
       * List files and directories in the current working directory, or from `path` if specified.
       *
       * @param [path]  Path to remote file or directory.
       */
      async list(path4 = "") {
        const validPath = await this.protectWhitespace(path4);
        let lastError;
        for (const candidate of this.availableListCommands) {
          const command = validPath === "" ? candidate : `${candidate} ${validPath}`;
          await this.prepareTransfer(this.ftp);
          try {
            const parsedList = await this._requestListWithCommand(command);
            this.availableListCommands = [candidate];
            return parsedList;
          } catch (err) {
            const shouldTryNext = err instanceof FtpContext_1.FTPError;
            if (!shouldTryNext) {
              throw err;
            }
            lastError = err;
          }
        }
        throw lastError;
      }
      /**
       * @protected
       */
      async _requestListWithCommand(command) {
        const buffer = new StringWriter_1.StringWriter();
        await (0, transfer_1.downloadTo)(buffer, {
          ftp: this.ftp,
          tracker: this._progressTracker,
          command,
          remotePath: "",
          type: "list"
        });
        const text = buffer.getText(this.ftp.encoding);
        this.ftp.log(text);
        return this.parseList(text);
      }
      /**
       * Remove a directory and all of its content.
       *
       * @param remoteDirPath  The path of the remote directory to delete.
       * @example client.removeDir("foo") // Remove directory 'foo' using a relative path.
       * @example client.removeDir("foo/bar") // Remove directory 'bar' using a relative path.
       * @example client.removeDir("/foo/bar") // Remove directory 'bar' using an absolute path.
       * @example client.removeDir("/") // Remove everything.
       */
      async removeDir(remoteDirPath) {
        return this._exitAtCurrentDirectory(async () => {
          await this.cd(remoteDirPath);
          const absoluteDirPath = await this.pwd();
          await this.clearWorkingDir();
          const dirIsRoot = absoluteDirPath === "/";
          if (!dirIsRoot) {
            await this.cdup();
            await this.removeEmptyDir(absoluteDirPath);
          }
        });
      }
      /**
       * Remove all files and directories in the working directory without removing
       * the working directory itself.
       */
      async clearWorkingDir() {
        for (const file of await this.list()) {
          if (file.isDirectory) {
            await this.cd(file.name);
            await this.clearWorkingDir();
            await this.cdup();
            await this.removeEmptyDir(file.name);
          } else {
            await this.remove(file.name);
          }
        }
      }
      /**
       * Upload the contents of a local directory to the remote working directory.
       *
       * This will overwrite existing files with the same names and reuse existing directories.
       * Unrelated files and directories will remain untouched. You can optionally provide a `remoteDirPath`
       * to put the contents inside a directory which will be created if necessary including all
       * intermediate directories. If you did provide a remoteDirPath the working directory will stay
       * the same as before calling this method.
       *
       * @param localDirPath  Local path, e.g. "foo/bar" or "../test"
       * @param [remoteDirPath]  Remote path of a directory to upload to. Working directory if undefined.
       */
      async uploadFromDir(localDirPath, remoteDirPath) {
        return this._exitAtCurrentDirectory(async () => {
          if (remoteDirPath) {
            await this.ensureDir(remoteDirPath);
          }
          return await this._uploadToWorkingDir(localDirPath);
        });
      }
      /**
       * @protected
       */
      async _uploadToWorkingDir(localDirPath) {
        const files = await fsReadDir(localDirPath);
        for (const file of files) {
          const fullPath = (0, path_1.join)(localDirPath, file);
          const stats = await fsStat(fullPath);
          if (stats.isFile()) {
            await this.uploadFrom(fullPath, file);
          } else if (stats.isDirectory()) {
            await this._openDir(file);
            await this._uploadToWorkingDir(fullPath);
            await this.cdup();
          }
        }
      }
      /**
       * Download all files and directories of the working directory to a local directory.
       *
       * @param localDirPath  The local directory to download to.
       * @param remoteDirPath  Remote directory to download. Current working directory if not specified.
       */
      async downloadToDir(localDirPath, remoteDirPath) {
        return this._exitAtCurrentDirectory(async () => {
          if (remoteDirPath) {
            await this.cd(remoteDirPath);
          }
          return await this._downloadFromWorkingDir(localDirPath);
        });
      }
      /**
       * @protected
       */
      async _downloadFromWorkingDir(localDirPath) {
        await ensureLocalDirectory(localDirPath);
        for (const file of await this.list()) {
          const localPath = (0, path_1.join)(localDirPath, file.name);
          if (file.isDirectory) {
            await this.cd(file.name);
            await this._downloadFromWorkingDir(localPath);
            await this.cdup();
          } else if (file.isFile) {
            await this.downloadTo(localPath, file.name);
          }
        }
      }
      /**
       * Make sure a given remote path exists, creating all directories as necessary.
       * This function also changes the current working directory to the given path.
       */
      async ensureDir(remoteDirPath) {
        if (remoteDirPath.startsWith("/")) {
          await this.cd("/");
        }
        const names = remoteDirPath.split("/").filter((name) => name !== "");
        for (const name of names) {
          await this._openDir(name);
        }
      }
      /**
       * Try to create a directory and enter it. This will not raise an exception if the directory
       * couldn't be created if for example it already exists.
       * @protected
       */
      async _openDir(dirName) {
        await this.sendIgnoringError("MKD " + dirName);
        await this.cd(dirName);
      }
      /**
       * Remove an empty directory, will fail if not empty.
       */
      async removeEmptyDir(path4) {
        const validPath = await this.protectWhitespace(path4);
        return this.send(`RMD ${validPath}`);
      }
      /**
       * FTP servers can't handle filenames that have leading whitespace. This method transforms
       * a given path to fix that issue for most cases.
       */
      async protectWhitespace(path4) {
        if (!path4.startsWith(" ")) {
          return path4;
        }
        const pwd = await this.pwd();
        const absolutePathPrefix = pwd.endsWith("/") ? pwd : pwd + "/";
        return absolutePathPrefix + path4;
      }
      async _exitAtCurrentDirectory(func) {
        const userDir = await this.pwd();
        try {
          return await func();
        } finally {
          if (!this.closed) {
            await ignoreError(() => this.cd(userDir));
          }
        }
      }
      /**
       * Try all available transfer strategies and pick the first one that works. Update `client` to
       * use the working strategy for all successive transfer requests.
       *
       * @returns a function that will try the provided strategies.
       */
      _enterFirstCompatibleMode(strategies) {
        return async (ftp) => {
          ftp.log("Trying to find optimal transfer strategy...");
          let lastError = void 0;
          for (const strategy of strategies) {
            try {
              const res = await strategy(ftp);
              ftp.log("Optimal transfer strategy found.");
              this.prepareTransfer = strategy;
              return res;
            } catch (err) {
              lastError = err;
            }
          }
          throw new Error(`None of the available transfer strategies work. Last error response was '${lastError}'.`);
        };
      }
      /**
       * DEPRECATED, use `uploadFrom`.
       * @deprecated
       */
      async upload(source, toRemotePath, options = {}) {
        this.ftp.log("Warning: upload() has been deprecated, use uploadFrom().");
        return this.uploadFrom(source, toRemotePath, options);
      }
      /**
       * DEPRECATED, use `appendFrom`.
       * @deprecated
       */
      async append(source, toRemotePath, options = {}) {
        this.ftp.log("Warning: append() has been deprecated, use appendFrom().");
        return this.appendFrom(source, toRemotePath, options);
      }
      /**
       * DEPRECATED, use `downloadTo`.
       * @deprecated
       */
      async download(destination, fromRemotePath, startAt = 0) {
        this.ftp.log("Warning: download() has been deprecated, use downloadTo().");
        return this.downloadTo(destination, fromRemotePath, startAt);
      }
      /**
       * DEPRECATED, use `uploadFromDir`.
       * @deprecated
       */
      async uploadDir(localDirPath, remoteDirPath) {
        this.ftp.log("Warning: uploadDir() has been deprecated, use uploadFromDir().");
        return this.uploadFromDir(localDirPath, remoteDirPath);
      }
      /**
       * DEPRECATED, use `downloadToDir`.
       * @deprecated
       */
      async downloadDir(localDirPath) {
        this.ftp.log("Warning: downloadDir() has been deprecated, use downloadToDir().");
        return this.downloadToDir(localDirPath);
      }
    };
    exports2.Client = Client;
    async function ensureLocalDirectory(path4) {
      try {
        await fsStat(path4);
      } catch (err) {
        await fsMkDir(path4, { recursive: true });
      }
    }
    async function ignoreError(func) {
      try {
        return await func();
      } catch (err) {
        return void 0;
      }
    }
  }
});

// node_modules/basic-ftp/dist/StringEncoding.js
var require_StringEncoding = __commonJS({
  "node_modules/basic-ftp/dist/StringEncoding.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
  }
});

// node_modules/basic-ftp/dist/index.js
var require_dist = __commonJS({
  "node_modules/basic-ftp/dist/index.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports2 && exports2.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.enterPassiveModeIPv6 = exports2.enterPassiveModeIPv4 = void 0;
    __exportStar(require_Client(), exports2);
    __exportStar(require_FtpContext(), exports2);
    __exportStar(require_FileInfo(), exports2);
    __exportStar(require_parseList(), exports2);
    __exportStar(require_StringEncoding(), exports2);
    var transfer_1 = require_transfer();
    Object.defineProperty(exports2, "enterPassiveModeIPv4", { enumerable: true, get: function() {
      return transfer_1.enterPassiveModeIPv4;
    } });
    Object.defineProperty(exports2, "enterPassiveModeIPv6", { enumerable: true, get: function() {
      return transfer_1.enterPassiveModeIPv6;
    } });
  }
});

// node_modules/picomatch/lib/constants.js
var require_constants = __commonJS({
  "node_modules/picomatch/lib/constants.js"(exports2, module2) {
    "use strict";
    var path4 = require("path");
    var WIN_SLASH = "\\\\/";
    var WIN_NO_SLASH = `[^${WIN_SLASH}]`;
    var DOT_LITERAL = "\\.";
    var PLUS_LITERAL = "\\+";
    var QMARK_LITERAL = "\\?";
    var SLASH_LITERAL = "\\/";
    var ONE_CHAR = "(?=.)";
    var QMARK = "[^/]";
    var END_ANCHOR = `(?:${SLASH_LITERAL}|$)`;
    var START_ANCHOR = `(?:^|${SLASH_LITERAL})`;
    var DOTS_SLASH = `${DOT_LITERAL}{1,2}${END_ANCHOR}`;
    var NO_DOT = `(?!${DOT_LITERAL})`;
    var NO_DOTS = `(?!${START_ANCHOR}${DOTS_SLASH})`;
    var NO_DOT_SLASH = `(?!${DOT_LITERAL}{0,1}${END_ANCHOR})`;
    var NO_DOTS_SLASH = `(?!${DOTS_SLASH})`;
    var QMARK_NO_DOT = `[^.${SLASH_LITERAL}]`;
    var STAR = `${QMARK}*?`;
    var POSIX_CHARS = {
      DOT_LITERAL,
      PLUS_LITERAL,
      QMARK_LITERAL,
      SLASH_LITERAL,
      ONE_CHAR,
      QMARK,
      END_ANCHOR,
      DOTS_SLASH,
      NO_DOT,
      NO_DOTS,
      NO_DOT_SLASH,
      NO_DOTS_SLASH,
      QMARK_NO_DOT,
      STAR,
      START_ANCHOR
    };
    var WINDOWS_CHARS = {
      ...POSIX_CHARS,
      SLASH_LITERAL: `[${WIN_SLASH}]`,
      QMARK: WIN_NO_SLASH,
      STAR: `${WIN_NO_SLASH}*?`,
      DOTS_SLASH: `${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$)`,
      NO_DOT: `(?!${DOT_LITERAL})`,
      NO_DOTS: `(?!(?:^|[${WIN_SLASH}])${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
      NO_DOT_SLASH: `(?!${DOT_LITERAL}{0,1}(?:[${WIN_SLASH}]|$))`,
      NO_DOTS_SLASH: `(?!${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
      QMARK_NO_DOT: `[^.${WIN_SLASH}]`,
      START_ANCHOR: `(?:^|[${WIN_SLASH}])`,
      END_ANCHOR: `(?:[${WIN_SLASH}]|$)`
    };
    var POSIX_REGEX_SOURCE = {
      alnum: "a-zA-Z0-9",
      alpha: "a-zA-Z",
      ascii: "\\x00-\\x7F",
      blank: " \\t",
      cntrl: "\\x00-\\x1F\\x7F",
      digit: "0-9",
      graph: "\\x21-\\x7E",
      lower: "a-z",
      print: "\\x20-\\x7E ",
      punct: "\\-!\"#$%&'()\\*+,./:;<=>?@[\\]^_`{|}~",
      space: " \\t\\r\\n\\v\\f",
      upper: "A-Z",
      word: "A-Za-z0-9_",
      xdigit: "A-Fa-f0-9"
    };
    module2.exports = {
      MAX_LENGTH: 1024 * 64,
      POSIX_REGEX_SOURCE,
      // regular expressions
      REGEX_BACKSLASH: /\\(?![*+?^${}(|)[\]])/g,
      REGEX_NON_SPECIAL_CHARS: /^[^@![\].,$*+?^{}()|\\/]+/,
      REGEX_SPECIAL_CHARS: /[-*+?.^${}(|)[\]]/,
      REGEX_SPECIAL_CHARS_BACKREF: /(\\?)((\W)(\3*))/g,
      REGEX_SPECIAL_CHARS_GLOBAL: /([-*+?.^${}(|)[\]])/g,
      REGEX_REMOVE_BACKSLASH: /(?:\[.*?[^\\]\]|\\(?=.))/g,
      // Replace globs with equivalent patterns to reduce parsing time.
      REPLACEMENTS: {
        "***": "*",
        "**/**": "**",
        "**/**/**": "**"
      },
      // Digits
      CHAR_0: 48,
      /* 0 */
      CHAR_9: 57,
      /* 9 */
      // Alphabet chars.
      CHAR_UPPERCASE_A: 65,
      /* A */
      CHAR_LOWERCASE_A: 97,
      /* a */
      CHAR_UPPERCASE_Z: 90,
      /* Z */
      CHAR_LOWERCASE_Z: 122,
      /* z */
      CHAR_LEFT_PARENTHESES: 40,
      /* ( */
      CHAR_RIGHT_PARENTHESES: 41,
      /* ) */
      CHAR_ASTERISK: 42,
      /* * */
      // Non-alphabetic chars.
      CHAR_AMPERSAND: 38,
      /* & */
      CHAR_AT: 64,
      /* @ */
      CHAR_BACKWARD_SLASH: 92,
      /* \ */
      CHAR_CARRIAGE_RETURN: 13,
      /* \r */
      CHAR_CIRCUMFLEX_ACCENT: 94,
      /* ^ */
      CHAR_COLON: 58,
      /* : */
      CHAR_COMMA: 44,
      /* , */
      CHAR_DOT: 46,
      /* . */
      CHAR_DOUBLE_QUOTE: 34,
      /* " */
      CHAR_EQUAL: 61,
      /* = */
      CHAR_EXCLAMATION_MARK: 33,
      /* ! */
      CHAR_FORM_FEED: 12,
      /* \f */
      CHAR_FORWARD_SLASH: 47,
      /* / */
      CHAR_GRAVE_ACCENT: 96,
      /* ` */
      CHAR_HASH: 35,
      /* # */
      CHAR_HYPHEN_MINUS: 45,
      /* - */
      CHAR_LEFT_ANGLE_BRACKET: 60,
      /* < */
      CHAR_LEFT_CURLY_BRACE: 123,
      /* { */
      CHAR_LEFT_SQUARE_BRACKET: 91,
      /* [ */
      CHAR_LINE_FEED: 10,
      /* \n */
      CHAR_NO_BREAK_SPACE: 160,
      /* \u00A0 */
      CHAR_PERCENT: 37,
      /* % */
      CHAR_PLUS: 43,
      /* + */
      CHAR_QUESTION_MARK: 63,
      /* ? */
      CHAR_RIGHT_ANGLE_BRACKET: 62,
      /* > */
      CHAR_RIGHT_CURLY_BRACE: 125,
      /* } */
      CHAR_RIGHT_SQUARE_BRACKET: 93,
      /* ] */
      CHAR_SEMICOLON: 59,
      /* ; */
      CHAR_SINGLE_QUOTE: 39,
      /* ' */
      CHAR_SPACE: 32,
      /*   */
      CHAR_TAB: 9,
      /* \t */
      CHAR_UNDERSCORE: 95,
      /* _ */
      CHAR_VERTICAL_LINE: 124,
      /* | */
      CHAR_ZERO_WIDTH_NOBREAK_SPACE: 65279,
      /* \uFEFF */
      SEP: path4.sep,
      /**
       * Create EXTGLOB_CHARS
       */
      extglobChars(chars) {
        return {
          "!": { type: "negate", open: "(?:(?!(?:", close: `))${chars.STAR})` },
          "?": { type: "qmark", open: "(?:", close: ")?" },
          "+": { type: "plus", open: "(?:", close: ")+" },
          "*": { type: "star", open: "(?:", close: ")*" },
          "@": { type: "at", open: "(?:", close: ")" }
        };
      },
      /**
       * Create GLOB_CHARS
       */
      globChars(win32) {
        return win32 === true ? WINDOWS_CHARS : POSIX_CHARS;
      }
    };
  }
});

// node_modules/picomatch/lib/utils.js
var require_utils = __commonJS({
  "node_modules/picomatch/lib/utils.js"(exports2) {
    "use strict";
    var path4 = require("path");
    var win32 = process.platform === "win32";
    var {
      REGEX_BACKSLASH,
      REGEX_REMOVE_BACKSLASH,
      REGEX_SPECIAL_CHARS,
      REGEX_SPECIAL_CHARS_GLOBAL
    } = require_constants();
    exports2.isObject = (val) => val !== null && typeof val === "object" && !Array.isArray(val);
    exports2.hasRegexChars = (str) => REGEX_SPECIAL_CHARS.test(str);
    exports2.isRegexChar = (str) => str.length === 1 && exports2.hasRegexChars(str);
    exports2.escapeRegex = (str) => str.replace(REGEX_SPECIAL_CHARS_GLOBAL, "\\$1");
    exports2.toPosixSlashes = (str) => str.replace(REGEX_BACKSLASH, "/");
    exports2.removeBackslashes = (str) => {
      return str.replace(REGEX_REMOVE_BACKSLASH, (match) => {
        return match === "\\" ? "" : match;
      });
    };
    exports2.supportsLookbehinds = () => {
      const segs = process.version.slice(1).split(".").map(Number);
      if (segs.length === 3 && segs[0] >= 9 || segs[0] === 8 && segs[1] >= 10) {
        return true;
      }
      return false;
    };
    exports2.isWindows = (options) => {
      if (options && typeof options.windows === "boolean") {
        return options.windows;
      }
      return win32 === true || path4.sep === "\\";
    };
    exports2.escapeLast = (input, char, lastIdx) => {
      const idx = input.lastIndexOf(char, lastIdx);
      if (idx === -1) return input;
      if (input[idx - 1] === "\\") return exports2.escapeLast(input, char, idx - 1);
      return `${input.slice(0, idx)}\\${input.slice(idx)}`;
    };
    exports2.removePrefix = (input, state = {}) => {
      let output = input;
      if (output.startsWith("./")) {
        output = output.slice(2);
        state.prefix = "./";
      }
      return output;
    };
    exports2.wrapOutput = (input, state = {}, options = {}) => {
      const prepend = options.contains ? "" : "^";
      const append = options.contains ? "" : "$";
      let output = `${prepend}(?:${input})${append}`;
      if (state.negated === true) {
        output = `(?:^(?!${output}).*$)`;
      }
      return output;
    };
  }
});

// node_modules/picomatch/lib/scan.js
var require_scan = __commonJS({
  "node_modules/picomatch/lib/scan.js"(exports2, module2) {
    "use strict";
    var utils = require_utils();
    var {
      CHAR_ASTERISK,
      /* * */
      CHAR_AT,
      /* @ */
      CHAR_BACKWARD_SLASH,
      /* \ */
      CHAR_COMMA,
      /* , */
      CHAR_DOT,
      /* . */
      CHAR_EXCLAMATION_MARK,
      /* ! */
      CHAR_FORWARD_SLASH,
      /* / */
      CHAR_LEFT_CURLY_BRACE,
      /* { */
      CHAR_LEFT_PARENTHESES,
      /* ( */
      CHAR_LEFT_SQUARE_BRACKET,
      /* [ */
      CHAR_PLUS,
      /* + */
      CHAR_QUESTION_MARK,
      /* ? */
      CHAR_RIGHT_CURLY_BRACE,
      /* } */
      CHAR_RIGHT_PARENTHESES,
      /* ) */
      CHAR_RIGHT_SQUARE_BRACKET
      /* ] */
    } = require_constants();
    var isPathSeparator = (code) => {
      return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
    };
    var depth = (token) => {
      if (token.isPrefix !== true) {
        token.depth = token.isGlobstar ? Infinity : 1;
      }
    };
    var scan = (input, options) => {
      const opts = options || {};
      const length = input.length - 1;
      const scanToEnd = opts.parts === true || opts.scanToEnd === true;
      const slashes = [];
      const tokens = [];
      const parts = [];
      let str = input;
      let index = -1;
      let start = 0;
      let lastIndex = 0;
      let isBrace = false;
      let isBracket = false;
      let isGlob = false;
      let isExtglob = false;
      let isGlobstar = false;
      let braceEscaped = false;
      let backslashes = false;
      let negated = false;
      let negatedExtglob = false;
      let finished = false;
      let braces = 0;
      let prev;
      let code;
      let token = { value: "", depth: 0, isGlob: false };
      const eos = () => index >= length;
      const peek = () => str.charCodeAt(index + 1);
      const advance = () => {
        prev = code;
        return str.charCodeAt(++index);
      };
      while (index < length) {
        code = advance();
        let next;
        if (code === CHAR_BACKWARD_SLASH) {
          backslashes = token.backslashes = true;
          code = advance();
          if (code === CHAR_LEFT_CURLY_BRACE) {
            braceEscaped = true;
          }
          continue;
        }
        if (braceEscaped === true || code === CHAR_LEFT_CURLY_BRACE) {
          braces++;
          while (eos() !== true && (code = advance())) {
            if (code === CHAR_BACKWARD_SLASH) {
              backslashes = token.backslashes = true;
              advance();
              continue;
            }
            if (code === CHAR_LEFT_CURLY_BRACE) {
              braces++;
              continue;
            }
            if (braceEscaped !== true && code === CHAR_DOT && (code = advance()) === CHAR_DOT) {
              isBrace = token.isBrace = true;
              isGlob = token.isGlob = true;
              finished = true;
              if (scanToEnd === true) {
                continue;
              }
              break;
            }
            if (braceEscaped !== true && code === CHAR_COMMA) {
              isBrace = token.isBrace = true;
              isGlob = token.isGlob = true;
              finished = true;
              if (scanToEnd === true) {
                continue;
              }
              break;
            }
            if (code === CHAR_RIGHT_CURLY_BRACE) {
              braces--;
              if (braces === 0) {
                braceEscaped = false;
                isBrace = token.isBrace = true;
                finished = true;
                break;
              }
            }
          }
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_FORWARD_SLASH) {
          slashes.push(index);
          tokens.push(token);
          token = { value: "", depth: 0, isGlob: false };
          if (finished === true) continue;
          if (prev === CHAR_DOT && index === start + 1) {
            start += 2;
            continue;
          }
          lastIndex = index + 1;
          continue;
        }
        if (opts.noext !== true) {
          const isExtglobChar = code === CHAR_PLUS || code === CHAR_AT || code === CHAR_ASTERISK || code === CHAR_QUESTION_MARK || code === CHAR_EXCLAMATION_MARK;
          if (isExtglobChar === true && peek() === CHAR_LEFT_PARENTHESES) {
            isGlob = token.isGlob = true;
            isExtglob = token.isExtglob = true;
            finished = true;
            if (code === CHAR_EXCLAMATION_MARK && index === start) {
              negatedExtglob = true;
            }
            if (scanToEnd === true) {
              while (eos() !== true && (code = advance())) {
                if (code === CHAR_BACKWARD_SLASH) {
                  backslashes = token.backslashes = true;
                  code = advance();
                  continue;
                }
                if (code === CHAR_RIGHT_PARENTHESES) {
                  isGlob = token.isGlob = true;
                  finished = true;
                  break;
                }
              }
              continue;
            }
            break;
          }
        }
        if (code === CHAR_ASTERISK) {
          if (prev === CHAR_ASTERISK) isGlobstar = token.isGlobstar = true;
          isGlob = token.isGlob = true;
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_QUESTION_MARK) {
          isGlob = token.isGlob = true;
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_LEFT_SQUARE_BRACKET) {
          while (eos() !== true && (next = advance())) {
            if (next === CHAR_BACKWARD_SLASH) {
              backslashes = token.backslashes = true;
              advance();
              continue;
            }
            if (next === CHAR_RIGHT_SQUARE_BRACKET) {
              isBracket = token.isBracket = true;
              isGlob = token.isGlob = true;
              finished = true;
              break;
            }
          }
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (opts.nonegate !== true && code === CHAR_EXCLAMATION_MARK && index === start) {
          negated = token.negated = true;
          start++;
          continue;
        }
        if (opts.noparen !== true && code === CHAR_LEFT_PARENTHESES) {
          isGlob = token.isGlob = true;
          if (scanToEnd === true) {
            while (eos() !== true && (code = advance())) {
              if (code === CHAR_LEFT_PARENTHESES) {
                backslashes = token.backslashes = true;
                code = advance();
                continue;
              }
              if (code === CHAR_RIGHT_PARENTHESES) {
                finished = true;
                break;
              }
            }
            continue;
          }
          break;
        }
        if (isGlob === true) {
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
      }
      if (opts.noext === true) {
        isExtglob = false;
        isGlob = false;
      }
      let base = str;
      let prefix = "";
      let glob = "";
      if (start > 0) {
        prefix = str.slice(0, start);
        str = str.slice(start);
        lastIndex -= start;
      }
      if (base && isGlob === true && lastIndex > 0) {
        base = str.slice(0, lastIndex);
        glob = str.slice(lastIndex);
      } else if (isGlob === true) {
        base = "";
        glob = str;
      } else {
        base = str;
      }
      if (base && base !== "" && base !== "/" && base !== str) {
        if (isPathSeparator(base.charCodeAt(base.length - 1))) {
          base = base.slice(0, -1);
        }
      }
      if (opts.unescape === true) {
        if (glob) glob = utils.removeBackslashes(glob);
        if (base && backslashes === true) {
          base = utils.removeBackslashes(base);
        }
      }
      const state = {
        prefix,
        input,
        start,
        base,
        glob,
        isBrace,
        isBracket,
        isGlob,
        isExtglob,
        isGlobstar,
        negated,
        negatedExtglob
      };
      if (opts.tokens === true) {
        state.maxDepth = 0;
        if (!isPathSeparator(code)) {
          tokens.push(token);
        }
        state.tokens = tokens;
      }
      if (opts.parts === true || opts.tokens === true) {
        let prevIndex;
        for (let idx = 0; idx < slashes.length; idx++) {
          const n = prevIndex ? prevIndex + 1 : start;
          const i = slashes[idx];
          const value = input.slice(n, i);
          if (opts.tokens) {
            if (idx === 0 && start !== 0) {
              tokens[idx].isPrefix = true;
              tokens[idx].value = prefix;
            } else {
              tokens[idx].value = value;
            }
            depth(tokens[idx]);
            state.maxDepth += tokens[idx].depth;
          }
          if (idx !== 0 || value !== "") {
            parts.push(value);
          }
          prevIndex = i;
        }
        if (prevIndex && prevIndex + 1 < input.length) {
          const value = input.slice(prevIndex + 1);
          parts.push(value);
          if (opts.tokens) {
            tokens[tokens.length - 1].value = value;
            depth(tokens[tokens.length - 1]);
            state.maxDepth += tokens[tokens.length - 1].depth;
          }
        }
        state.slashes = slashes;
        state.parts = parts;
      }
      return state;
    };
    module2.exports = scan;
  }
});

// node_modules/picomatch/lib/parse.js
var require_parse = __commonJS({
  "node_modules/picomatch/lib/parse.js"(exports2, module2) {
    "use strict";
    var constants = require_constants();
    var utils = require_utils();
    var {
      MAX_LENGTH,
      POSIX_REGEX_SOURCE,
      REGEX_NON_SPECIAL_CHARS,
      REGEX_SPECIAL_CHARS_BACKREF,
      REPLACEMENTS
    } = constants;
    var expandRange = (args, options) => {
      if (typeof options.expandRange === "function") {
        return options.expandRange(...args, options);
      }
      args.sort();
      const value = `[${args.join("-")}]`;
      try {
        new RegExp(value);
      } catch (ex) {
        return args.map((v) => utils.escapeRegex(v)).join("..");
      }
      return value;
    };
    var syntaxError = (type, char) => {
      return `Missing ${type}: "${char}" - use "\\\\${char}" to match literal characters`;
    };
    var parse = (input, options) => {
      if (typeof input !== "string") {
        throw new TypeError("Expected a string");
      }
      input = REPLACEMENTS[input] || input;
      const opts = { ...options };
      const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
      let len = input.length;
      if (len > max) {
        throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
      }
      const bos = { type: "bos", value: "", output: opts.prepend || "" };
      const tokens = [bos];
      const capture = opts.capture ? "" : "?:";
      const win32 = utils.isWindows(options);
      const PLATFORM_CHARS = constants.globChars(win32);
      const EXTGLOB_CHARS = constants.extglobChars(PLATFORM_CHARS);
      const {
        DOT_LITERAL,
        PLUS_LITERAL,
        SLASH_LITERAL,
        ONE_CHAR,
        DOTS_SLASH,
        NO_DOT,
        NO_DOT_SLASH,
        NO_DOTS_SLASH,
        QMARK,
        QMARK_NO_DOT,
        STAR,
        START_ANCHOR
      } = PLATFORM_CHARS;
      const globstar = (opts2) => {
        return `(${capture}(?:(?!${START_ANCHOR}${opts2.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
      };
      const nodot = opts.dot ? "" : NO_DOT;
      const qmarkNoDot = opts.dot ? QMARK : QMARK_NO_DOT;
      let star = opts.bash === true ? globstar(opts) : STAR;
      if (opts.capture) {
        star = `(${star})`;
      }
      if (typeof opts.noext === "boolean") {
        opts.noextglob = opts.noext;
      }
      const state = {
        input,
        index: -1,
        start: 0,
        dot: opts.dot === true,
        consumed: "",
        output: "",
        prefix: "",
        backtrack: false,
        negated: false,
        brackets: 0,
        braces: 0,
        parens: 0,
        quotes: 0,
        globstar: false,
        tokens
      };
      input = utils.removePrefix(input, state);
      len = input.length;
      const extglobs = [];
      const braces = [];
      const stack = [];
      let prev = bos;
      let value;
      const eos = () => state.index === len - 1;
      const peek = state.peek = (n = 1) => input[state.index + n];
      const advance = state.advance = () => input[++state.index] || "";
      const remaining = () => input.slice(state.index + 1);
      const consume = (value2 = "", num = 0) => {
        state.consumed += value2;
        state.index += num;
      };
      const append = (token) => {
        state.output += token.output != null ? token.output : token.value;
        consume(token.value);
      };
      const negate = () => {
        let count = 1;
        while (peek() === "!" && (peek(2) !== "(" || peek(3) === "?")) {
          advance();
          state.start++;
          count++;
        }
        if (count % 2 === 0) {
          return false;
        }
        state.negated = true;
        state.start++;
        return true;
      };
      const increment = (type) => {
        state[type]++;
        stack.push(type);
      };
      const decrement = (type) => {
        state[type]--;
        stack.pop();
      };
      const push = (tok) => {
        if (prev.type === "globstar") {
          const isBrace = state.braces > 0 && (tok.type === "comma" || tok.type === "brace");
          const isExtglob = tok.extglob === true || extglobs.length && (tok.type === "pipe" || tok.type === "paren");
          if (tok.type !== "slash" && tok.type !== "paren" && !isBrace && !isExtglob) {
            state.output = state.output.slice(0, -prev.output.length);
            prev.type = "star";
            prev.value = "*";
            prev.output = star;
            state.output += prev.output;
          }
        }
        if (extglobs.length && tok.type !== "paren") {
          extglobs[extglobs.length - 1].inner += tok.value;
        }
        if (tok.value || tok.output) append(tok);
        if (prev && prev.type === "text" && tok.type === "text") {
          prev.value += tok.value;
          prev.output = (prev.output || "") + tok.value;
          return;
        }
        tok.prev = prev;
        tokens.push(tok);
        prev = tok;
      };
      const extglobOpen = (type, value2) => {
        const token = { ...EXTGLOB_CHARS[value2], conditions: 1, inner: "" };
        token.prev = prev;
        token.parens = state.parens;
        token.output = state.output;
        const output = (opts.capture ? "(" : "") + token.open;
        increment("parens");
        push({ type, value: value2, output: state.output ? "" : ONE_CHAR });
        push({ type: "paren", extglob: true, value: advance(), output });
        extglobs.push(token);
      };
      const extglobClose = (token) => {
        let output = token.close + (opts.capture ? ")" : "");
        let rest;
        if (token.type === "negate") {
          let extglobStar = star;
          if (token.inner && token.inner.length > 1 && token.inner.includes("/")) {
            extglobStar = globstar(opts);
          }
          if (extglobStar !== star || eos() || /^\)+$/.test(remaining())) {
            output = token.close = `)$))${extglobStar}`;
          }
          if (token.inner.includes("*") && (rest = remaining()) && /^\.[^\\/.]+$/.test(rest)) {
            const expression = parse(rest, { ...options, fastpaths: false }).output;
            output = token.close = `)${expression})${extglobStar})`;
          }
          if (token.prev.type === "bos") {
            state.negatedExtglob = true;
          }
        }
        push({ type: "paren", extglob: true, value, output });
        decrement("parens");
      };
      if (opts.fastpaths !== false && !/(^[*!]|[/()[\]{}"])/.test(input)) {
        let backslashes = false;
        let output = input.replace(REGEX_SPECIAL_CHARS_BACKREF, (m, esc, chars, first, rest, index) => {
          if (first === "\\") {
            backslashes = true;
            return m;
          }
          if (first === "?") {
            if (esc) {
              return esc + first + (rest ? QMARK.repeat(rest.length) : "");
            }
            if (index === 0) {
              return qmarkNoDot + (rest ? QMARK.repeat(rest.length) : "");
            }
            return QMARK.repeat(chars.length);
          }
          if (first === ".") {
            return DOT_LITERAL.repeat(chars.length);
          }
          if (first === "*") {
            if (esc) {
              return esc + first + (rest ? star : "");
            }
            return star;
          }
          return esc ? m : `\\${m}`;
        });
        if (backslashes === true) {
          if (opts.unescape === true) {
            output = output.replace(/\\/g, "");
          } else {
            output = output.replace(/\\+/g, (m) => {
              return m.length % 2 === 0 ? "\\\\" : m ? "\\" : "";
            });
          }
        }
        if (output === input && opts.contains === true) {
          state.output = input;
          return state;
        }
        state.output = utils.wrapOutput(output, state, options);
        return state;
      }
      while (!eos()) {
        value = advance();
        if (value === "\0") {
          continue;
        }
        if (value === "\\") {
          const next = peek();
          if (next === "/" && opts.bash !== true) {
            continue;
          }
          if (next === "." || next === ";") {
            continue;
          }
          if (!next) {
            value += "\\";
            push({ type: "text", value });
            continue;
          }
          const match = /^\\+/.exec(remaining());
          let slashes = 0;
          if (match && match[0].length > 2) {
            slashes = match[0].length;
            state.index += slashes;
            if (slashes % 2 !== 0) {
              value += "\\";
            }
          }
          if (opts.unescape === true) {
            value = advance();
          } else {
            value += advance();
          }
          if (state.brackets === 0) {
            push({ type: "text", value });
            continue;
          }
        }
        if (state.brackets > 0 && (value !== "]" || prev.value === "[" || prev.value === "[^")) {
          if (opts.posix !== false && value === ":") {
            const inner = prev.value.slice(1);
            if (inner.includes("[")) {
              prev.posix = true;
              if (inner.includes(":")) {
                const idx = prev.value.lastIndexOf("[");
                const pre = prev.value.slice(0, idx);
                const rest2 = prev.value.slice(idx + 2);
                const posix3 = POSIX_REGEX_SOURCE[rest2];
                if (posix3) {
                  prev.value = pre + posix3;
                  state.backtrack = true;
                  advance();
                  if (!bos.output && tokens.indexOf(prev) === 1) {
                    bos.output = ONE_CHAR;
                  }
                  continue;
                }
              }
            }
          }
          if (value === "[" && peek() !== ":" || value === "-" && peek() === "]") {
            value = `\\${value}`;
          }
          if (value === "]" && (prev.value === "[" || prev.value === "[^")) {
            value = `\\${value}`;
          }
          if (opts.posix === true && value === "!" && prev.value === "[") {
            value = "^";
          }
          prev.value += value;
          append({ value });
          continue;
        }
        if (state.quotes === 1 && value !== '"') {
          value = utils.escapeRegex(value);
          prev.value += value;
          append({ value });
          continue;
        }
        if (value === '"') {
          state.quotes = state.quotes === 1 ? 0 : 1;
          if (opts.keepQuotes === true) {
            push({ type: "text", value });
          }
          continue;
        }
        if (value === "(") {
          increment("parens");
          push({ type: "paren", value });
          continue;
        }
        if (value === ")") {
          if (state.parens === 0 && opts.strictBrackets === true) {
            throw new SyntaxError(syntaxError("opening", "("));
          }
          const extglob = extglobs[extglobs.length - 1];
          if (extglob && state.parens === extglob.parens + 1) {
            extglobClose(extglobs.pop());
            continue;
          }
          push({ type: "paren", value, output: state.parens ? ")" : "\\)" });
          decrement("parens");
          continue;
        }
        if (value === "[") {
          if (opts.nobracket === true || !remaining().includes("]")) {
            if (opts.nobracket !== true && opts.strictBrackets === true) {
              throw new SyntaxError(syntaxError("closing", "]"));
            }
            value = `\\${value}`;
          } else {
            increment("brackets");
          }
          push({ type: "bracket", value });
          continue;
        }
        if (value === "]") {
          if (opts.nobracket === true || prev && prev.type === "bracket" && prev.value.length === 1) {
            push({ type: "text", value, output: `\\${value}` });
            continue;
          }
          if (state.brackets === 0) {
            if (opts.strictBrackets === true) {
              throw new SyntaxError(syntaxError("opening", "["));
            }
            push({ type: "text", value, output: `\\${value}` });
            continue;
          }
          decrement("brackets");
          const prevValue = prev.value.slice(1);
          if (prev.posix !== true && prevValue[0] === "^" && !prevValue.includes("/")) {
            value = `/${value}`;
          }
          prev.value += value;
          append({ value });
          if (opts.literalBrackets === false || utils.hasRegexChars(prevValue)) {
            continue;
          }
          const escaped = utils.escapeRegex(prev.value);
          state.output = state.output.slice(0, -prev.value.length);
          if (opts.literalBrackets === true) {
            state.output += escaped;
            prev.value = escaped;
            continue;
          }
          prev.value = `(${capture}${escaped}|${prev.value})`;
          state.output += prev.value;
          continue;
        }
        if (value === "{" && opts.nobrace !== true) {
          increment("braces");
          const open = {
            type: "brace",
            value,
            output: "(",
            outputIndex: state.output.length,
            tokensIndex: state.tokens.length
          };
          braces.push(open);
          push(open);
          continue;
        }
        if (value === "}") {
          const brace = braces[braces.length - 1];
          if (opts.nobrace === true || !brace) {
            push({ type: "text", value, output: value });
            continue;
          }
          let output = ")";
          if (brace.dots === true) {
            const arr = tokens.slice();
            const range = [];
            for (let i = arr.length - 1; i >= 0; i--) {
              tokens.pop();
              if (arr[i].type === "brace") {
                break;
              }
              if (arr[i].type !== "dots") {
                range.unshift(arr[i].value);
              }
            }
            output = expandRange(range, opts);
            state.backtrack = true;
          }
          if (brace.comma !== true && brace.dots !== true) {
            const out = state.output.slice(0, brace.outputIndex);
            const toks = state.tokens.slice(brace.tokensIndex);
            brace.value = brace.output = "\\{";
            value = output = "\\}";
            state.output = out;
            for (const t of toks) {
              state.output += t.output || t.value;
            }
          }
          push({ type: "brace", value, output });
          decrement("braces");
          braces.pop();
          continue;
        }
        if (value === "|") {
          if (extglobs.length > 0) {
            extglobs[extglobs.length - 1].conditions++;
          }
          push({ type: "text", value });
          continue;
        }
        if (value === ",") {
          let output = value;
          const brace = braces[braces.length - 1];
          if (brace && stack[stack.length - 1] === "braces") {
            brace.comma = true;
            output = "|";
          }
          push({ type: "comma", value, output });
          continue;
        }
        if (value === "/") {
          if (prev.type === "dot" && state.index === state.start + 1) {
            state.start = state.index + 1;
            state.consumed = "";
            state.output = "";
            tokens.pop();
            prev = bos;
            continue;
          }
          push({ type: "slash", value, output: SLASH_LITERAL });
          continue;
        }
        if (value === ".") {
          if (state.braces > 0 && prev.type === "dot") {
            if (prev.value === ".") prev.output = DOT_LITERAL;
            const brace = braces[braces.length - 1];
            prev.type = "dots";
            prev.output += value;
            prev.value += value;
            brace.dots = true;
            continue;
          }
          if (state.braces + state.parens === 0 && prev.type !== "bos" && prev.type !== "slash") {
            push({ type: "text", value, output: DOT_LITERAL });
            continue;
          }
          push({ type: "dot", value, output: DOT_LITERAL });
          continue;
        }
        if (value === "?") {
          const isGroup = prev && prev.value === "(";
          if (!isGroup && opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            extglobOpen("qmark", value);
            continue;
          }
          if (prev && prev.type === "paren") {
            const next = peek();
            let output = value;
            if (next === "<" && !utils.supportsLookbehinds()) {
              throw new Error("Node.js v10 or higher is required for regex lookbehinds");
            }
            if (prev.value === "(" && !/[!=<:]/.test(next) || next === "<" && !/<([!=]|\w+>)/.test(remaining())) {
              output = `\\${value}`;
            }
            push({ type: "text", value, output });
            continue;
          }
          if (opts.dot !== true && (prev.type === "slash" || prev.type === "bos")) {
            push({ type: "qmark", value, output: QMARK_NO_DOT });
            continue;
          }
          push({ type: "qmark", value, output: QMARK });
          continue;
        }
        if (value === "!") {
          if (opts.noextglob !== true && peek() === "(") {
            if (peek(2) !== "?" || !/[!=<:]/.test(peek(3))) {
              extglobOpen("negate", value);
              continue;
            }
          }
          if (opts.nonegate !== true && state.index === 0) {
            negate();
            continue;
          }
        }
        if (value === "+") {
          if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            extglobOpen("plus", value);
            continue;
          }
          if (prev && prev.value === "(" || opts.regex === false) {
            push({ type: "plus", value, output: PLUS_LITERAL });
            continue;
          }
          if (prev && (prev.type === "bracket" || prev.type === "paren" || prev.type === "brace") || state.parens > 0) {
            push({ type: "plus", value });
            continue;
          }
          push({ type: "plus", value: PLUS_LITERAL });
          continue;
        }
        if (value === "@") {
          if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            push({ type: "at", extglob: true, value, output: "" });
            continue;
          }
          push({ type: "text", value });
          continue;
        }
        if (value !== "*") {
          if (value === "$" || value === "^") {
            value = `\\${value}`;
          }
          const match = REGEX_NON_SPECIAL_CHARS.exec(remaining());
          if (match) {
            value += match[0];
            state.index += match[0].length;
          }
          push({ type: "text", value });
          continue;
        }
        if (prev && (prev.type === "globstar" || prev.star === true)) {
          prev.type = "star";
          prev.star = true;
          prev.value += value;
          prev.output = star;
          state.backtrack = true;
          state.globstar = true;
          consume(value);
          continue;
        }
        let rest = remaining();
        if (opts.noextglob !== true && /^\([^?]/.test(rest)) {
          extglobOpen("star", value);
          continue;
        }
        if (prev.type === "star") {
          if (opts.noglobstar === true) {
            consume(value);
            continue;
          }
          const prior = prev.prev;
          const before = prior.prev;
          const isStart = prior.type === "slash" || prior.type === "bos";
          const afterStar = before && (before.type === "star" || before.type === "globstar");
          if (opts.bash === true && (!isStart || rest[0] && rest[0] !== "/")) {
            push({ type: "star", value, output: "" });
            continue;
          }
          const isBrace = state.braces > 0 && (prior.type === "comma" || prior.type === "brace");
          const isExtglob = extglobs.length && (prior.type === "pipe" || prior.type === "paren");
          if (!isStart && prior.type !== "paren" && !isBrace && !isExtglob) {
            push({ type: "star", value, output: "" });
            continue;
          }
          while (rest.slice(0, 3) === "/**") {
            const after = input[state.index + 4];
            if (after && after !== "/") {
              break;
            }
            rest = rest.slice(3);
            consume("/**", 3);
          }
          if (prior.type === "bos" && eos()) {
            prev.type = "globstar";
            prev.value += value;
            prev.output = globstar(opts);
            state.output = prev.output;
            state.globstar = true;
            consume(value);
            continue;
          }
          if (prior.type === "slash" && prior.prev.type !== "bos" && !afterStar && eos()) {
            state.output = state.output.slice(0, -(prior.output + prev.output).length);
            prior.output = `(?:${prior.output}`;
            prev.type = "globstar";
            prev.output = globstar(opts) + (opts.strictSlashes ? ")" : "|$)");
            prev.value += value;
            state.globstar = true;
            state.output += prior.output + prev.output;
            consume(value);
            continue;
          }
          if (prior.type === "slash" && prior.prev.type !== "bos" && rest[0] === "/") {
            const end = rest[1] !== void 0 ? "|$" : "";
            state.output = state.output.slice(0, -(prior.output + prev.output).length);
            prior.output = `(?:${prior.output}`;
            prev.type = "globstar";
            prev.output = `${globstar(opts)}${SLASH_LITERAL}|${SLASH_LITERAL}${end})`;
            prev.value += value;
            state.output += prior.output + prev.output;
            state.globstar = true;
            consume(value + advance());
            push({ type: "slash", value: "/", output: "" });
            continue;
          }
          if (prior.type === "bos" && rest[0] === "/") {
            prev.type = "globstar";
            prev.value += value;
            prev.output = `(?:^|${SLASH_LITERAL}|${globstar(opts)}${SLASH_LITERAL})`;
            state.output = prev.output;
            state.globstar = true;
            consume(value + advance());
            push({ type: "slash", value: "/", output: "" });
            continue;
          }
          state.output = state.output.slice(0, -prev.output.length);
          prev.type = "globstar";
          prev.output = globstar(opts);
          prev.value += value;
          state.output += prev.output;
          state.globstar = true;
          consume(value);
          continue;
        }
        const token = { type: "star", value, output: star };
        if (opts.bash === true) {
          token.output = ".*?";
          if (prev.type === "bos" || prev.type === "slash") {
            token.output = nodot + token.output;
          }
          push(token);
          continue;
        }
        if (prev && (prev.type === "bracket" || prev.type === "paren") && opts.regex === true) {
          token.output = value;
          push(token);
          continue;
        }
        if (state.index === state.start || prev.type === "slash" || prev.type === "dot") {
          if (prev.type === "dot") {
            state.output += NO_DOT_SLASH;
            prev.output += NO_DOT_SLASH;
          } else if (opts.dot === true) {
            state.output += NO_DOTS_SLASH;
            prev.output += NO_DOTS_SLASH;
          } else {
            state.output += nodot;
            prev.output += nodot;
          }
          if (peek() !== "*") {
            state.output += ONE_CHAR;
            prev.output += ONE_CHAR;
          }
        }
        push(token);
      }
      while (state.brackets > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "]"));
        state.output = utils.escapeLast(state.output, "[");
        decrement("brackets");
      }
      while (state.parens > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", ")"));
        state.output = utils.escapeLast(state.output, "(");
        decrement("parens");
      }
      while (state.braces > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "}"));
        state.output = utils.escapeLast(state.output, "{");
        decrement("braces");
      }
      if (opts.strictSlashes !== true && (prev.type === "star" || prev.type === "bracket")) {
        push({ type: "maybe_slash", value: "", output: `${SLASH_LITERAL}?` });
      }
      if (state.backtrack === true) {
        state.output = "";
        for (const token of state.tokens) {
          state.output += token.output != null ? token.output : token.value;
          if (token.suffix) {
            state.output += token.suffix;
          }
        }
      }
      return state;
    };
    parse.fastpaths = (input, options) => {
      const opts = { ...options };
      const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
      const len = input.length;
      if (len > max) {
        throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
      }
      input = REPLACEMENTS[input] || input;
      const win32 = utils.isWindows(options);
      const {
        DOT_LITERAL,
        SLASH_LITERAL,
        ONE_CHAR,
        DOTS_SLASH,
        NO_DOT,
        NO_DOTS,
        NO_DOTS_SLASH,
        STAR,
        START_ANCHOR
      } = constants.globChars(win32);
      const nodot = opts.dot ? NO_DOTS : NO_DOT;
      const slashDot = opts.dot ? NO_DOTS_SLASH : NO_DOT;
      const capture = opts.capture ? "" : "?:";
      const state = { negated: false, prefix: "" };
      let star = opts.bash === true ? ".*?" : STAR;
      if (opts.capture) {
        star = `(${star})`;
      }
      const globstar = (opts2) => {
        if (opts2.noglobstar === true) return star;
        return `(${capture}(?:(?!${START_ANCHOR}${opts2.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
      };
      const create = (str) => {
        switch (str) {
          case "*":
            return `${nodot}${ONE_CHAR}${star}`;
          case ".*":
            return `${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "*.*":
            return `${nodot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "*/*":
            return `${nodot}${star}${SLASH_LITERAL}${ONE_CHAR}${slashDot}${star}`;
          case "**":
            return nodot + globstar(opts);
          case "**/*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${ONE_CHAR}${star}`;
          case "**/*.*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "**/.*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${DOT_LITERAL}${ONE_CHAR}${star}`;
          default: {
            const match = /^(.*?)\.(\w+)$/.exec(str);
            if (!match) return;
            const source2 = create(match[1]);
            if (!source2) return;
            return source2 + DOT_LITERAL + match[2];
          }
        }
      };
      const output = utils.removePrefix(input, state);
      let source = create(output);
      if (source && opts.strictSlashes !== true) {
        source += `${SLASH_LITERAL}?`;
      }
      return source;
    };
    module2.exports = parse;
  }
});

// node_modules/picomatch/lib/picomatch.js
var require_picomatch = __commonJS({
  "node_modules/picomatch/lib/picomatch.js"(exports2, module2) {
    "use strict";
    var path4 = require("path");
    var scan = require_scan();
    var parse = require_parse();
    var utils = require_utils();
    var constants = require_constants();
    var isObject = (val) => val && typeof val === "object" && !Array.isArray(val);
    var picomatch = (glob, options, returnState = false) => {
      if (Array.isArray(glob)) {
        const fns = glob.map((input) => picomatch(input, options, returnState));
        const arrayMatcher = (str) => {
          for (const isMatch of fns) {
            const state2 = isMatch(str);
            if (state2) return state2;
          }
          return false;
        };
        return arrayMatcher;
      }
      const isState = isObject(glob) && glob.tokens && glob.input;
      if (glob === "" || typeof glob !== "string" && !isState) {
        throw new TypeError("Expected pattern to be a non-empty string");
      }
      const opts = options || {};
      const posix3 = utils.isWindows(options);
      const regex = isState ? picomatch.compileRe(glob, options) : picomatch.makeRe(glob, options, false, true);
      const state = regex.state;
      delete regex.state;
      let isIgnored = () => false;
      if (opts.ignore) {
        const ignoreOpts = { ...options, ignore: null, onMatch: null, onResult: null };
        isIgnored = picomatch(opts.ignore, ignoreOpts, returnState);
      }
      const matcher = (input, returnObject = false) => {
        const { isMatch, match, output } = picomatch.test(input, regex, options, { glob, posix: posix3 });
        const result = { glob, state, regex, posix: posix3, input, output, match, isMatch };
        if (typeof opts.onResult === "function") {
          opts.onResult(result);
        }
        if (isMatch === false) {
          result.isMatch = false;
          return returnObject ? result : false;
        }
        if (isIgnored(input)) {
          if (typeof opts.onIgnore === "function") {
            opts.onIgnore(result);
          }
          result.isMatch = false;
          return returnObject ? result : false;
        }
        if (typeof opts.onMatch === "function") {
          opts.onMatch(result);
        }
        return returnObject ? result : true;
      };
      if (returnState) {
        matcher.state = state;
      }
      return matcher;
    };
    picomatch.test = (input, regex, options, { glob, posix: posix3 } = {}) => {
      if (typeof input !== "string") {
        throw new TypeError("Expected input to be a string");
      }
      if (input === "") {
        return { isMatch: false, output: "" };
      }
      const opts = options || {};
      const format = opts.format || (posix3 ? utils.toPosixSlashes : null);
      let match = input === glob;
      let output = match && format ? format(input) : input;
      if (match === false) {
        output = format ? format(input) : input;
        match = output === glob;
      }
      if (match === false || opts.capture === true) {
        if (opts.matchBase === true || opts.basename === true) {
          match = picomatch.matchBase(input, regex, options, posix3);
        } else {
          match = regex.exec(output);
        }
      }
      return { isMatch: Boolean(match), match, output };
    };
    picomatch.matchBase = (input, glob, options, posix3 = utils.isWindows(options)) => {
      const regex = glob instanceof RegExp ? glob : picomatch.makeRe(glob, options);
      return regex.test(path4.basename(input));
    };
    picomatch.isMatch = (str, patterns, options) => picomatch(patterns, options)(str);
    picomatch.parse = (pattern, options) => {
      if (Array.isArray(pattern)) return pattern.map((p) => picomatch.parse(p, options));
      return parse(pattern, { ...options, fastpaths: false });
    };
    picomatch.scan = (input, options) => scan(input, options);
    picomatch.compileRe = (state, options, returnOutput = false, returnState = false) => {
      if (returnOutput === true) {
        return state.output;
      }
      const opts = options || {};
      const prepend = opts.contains ? "" : "^";
      const append = opts.contains ? "" : "$";
      let source = `${prepend}(?:${state.output})${append}`;
      if (state && state.negated === true) {
        source = `^(?!${source}).*$`;
      }
      const regex = picomatch.toRegex(source, options);
      if (returnState === true) {
        regex.state = state;
      }
      return regex;
    };
    picomatch.makeRe = (input, options = {}, returnOutput = false, returnState = false) => {
      if (!input || typeof input !== "string") {
        throw new TypeError("Expected a non-empty string");
      }
      let parsed = { negated: false, fastpaths: true };
      if (options.fastpaths !== false && (input[0] === "." || input[0] === "*")) {
        parsed.output = parse.fastpaths(input, options);
      }
      if (!parsed.output) {
        parsed = parse(input, options);
      }
      return picomatch.compileRe(parsed, options, returnOutput, returnState);
    };
    picomatch.toRegex = (source, options) => {
      try {
        const opts = options || {};
        return new RegExp(source, opts.flags || (opts.nocase ? "i" : ""));
      } catch (err) {
        if (options && options.debug === true) throw err;
        return /$^/;
      }
    };
    picomatch.constants = constants;
    module2.exports = picomatch;
  }
});

// node_modules/picomatch/index.js
var require_picomatch2 = __commonJS({
  "node_modules/picomatch/index.js"(exports2, module2) {
    "use strict";
    module2.exports = require_picomatch();
  }
});

// node_modules/readdirp/index.js
var require_readdirp = __commonJS({
  "node_modules/readdirp/index.js"(exports2, module2) {
    "use strict";
    var fs4 = require("fs");
    var { Readable } = require("stream");
    var sysPath = require("path");
    var { promisify } = require("util");
    var picomatch = require_picomatch2();
    var readdir = promisify(fs4.readdir);
    var stat = promisify(fs4.stat);
    var lstat = promisify(fs4.lstat);
    var realpath = promisify(fs4.realpath);
    var BANG = "!";
    var RECURSIVE_ERROR_CODE = "READDIRP_RECURSIVE_ERROR";
    var NORMAL_FLOW_ERRORS = /* @__PURE__ */ new Set(["ENOENT", "EPERM", "EACCES", "ELOOP", RECURSIVE_ERROR_CODE]);
    var FILE_TYPE = "files";
    var DIR_TYPE = "directories";
    var FILE_DIR_TYPE = "files_directories";
    var EVERYTHING_TYPE = "all";
    var ALL_TYPES = [FILE_TYPE, DIR_TYPE, FILE_DIR_TYPE, EVERYTHING_TYPE];
    var isNormalFlowError = (error) => NORMAL_FLOW_ERRORS.has(error.code);
    var [maj, min] = process.versions.node.split(".").slice(0, 2).map((n) => Number.parseInt(n, 10));
    var wantBigintFsStats = process.platform === "win32" && (maj > 10 || maj === 10 && min >= 5);
    var normalizeFilter = (filter) => {
      if (filter === void 0) return;
      if (typeof filter === "function") return filter;
      if (typeof filter === "string") {
        const glob = picomatch(filter.trim());
        return (entry) => glob(entry.basename);
      }
      if (Array.isArray(filter)) {
        const positive = [];
        const negative = [];
        for (const item of filter) {
          const trimmed = item.trim();
          if (trimmed.charAt(0) === BANG) {
            negative.push(picomatch(trimmed.slice(1)));
          } else {
            positive.push(picomatch(trimmed));
          }
        }
        if (negative.length > 0) {
          if (positive.length > 0) {
            return (entry) => positive.some((f) => f(entry.basename)) && !negative.some((f) => f(entry.basename));
          }
          return (entry) => !negative.some((f) => f(entry.basename));
        }
        return (entry) => positive.some((f) => f(entry.basename));
      }
    };
    var ReaddirpStream = class _ReaddirpStream extends Readable {
      static get defaultOptions() {
        return {
          root: ".",
          /* eslint-disable no-unused-vars */
          fileFilter: (path4) => true,
          directoryFilter: (path4) => true,
          /* eslint-enable no-unused-vars */
          type: FILE_TYPE,
          lstat: false,
          depth: 2147483648,
          alwaysStat: false
        };
      }
      constructor(options = {}) {
        super({
          objectMode: true,
          autoDestroy: true,
          highWaterMark: options.highWaterMark || 4096
        });
        const opts = { ..._ReaddirpStream.defaultOptions, ...options };
        const { root, type } = opts;
        this._fileFilter = normalizeFilter(opts.fileFilter);
        this._directoryFilter = normalizeFilter(opts.directoryFilter);
        const statMethod = opts.lstat ? lstat : stat;
        if (wantBigintFsStats) {
          this._stat = (path4) => statMethod(path4, { bigint: true });
        } else {
          this._stat = statMethod;
        }
        this._maxDepth = opts.depth;
        this._wantsDir = [DIR_TYPE, FILE_DIR_TYPE, EVERYTHING_TYPE].includes(type);
        this._wantsFile = [FILE_TYPE, FILE_DIR_TYPE, EVERYTHING_TYPE].includes(type);
        this._wantsEverything = type === EVERYTHING_TYPE;
        this._root = sysPath.resolve(root);
        this._isDirent = "Dirent" in fs4 && !opts.alwaysStat;
        this._statsProp = this._isDirent ? "dirent" : "stats";
        this._rdOptions = { encoding: "utf8", withFileTypes: this._isDirent };
        this.parents = [this._exploreDir(root, 1)];
        this.reading = false;
        this.parent = void 0;
      }
      async _read(batch) {
        if (this.reading) return;
        this.reading = true;
        try {
          while (!this.destroyed && batch > 0) {
            const { path: path4, depth, files = [] } = this.parent || {};
            if (files.length > 0) {
              const slice = files.splice(0, batch).map((dirent) => this._formatEntry(dirent, path4));
              for (const entry of await Promise.all(slice)) {
                if (this.destroyed) return;
                const entryType = await this._getEntryType(entry);
                if (entryType === "directory" && this._directoryFilter(entry)) {
                  if (depth <= this._maxDepth) {
                    this.parents.push(this._exploreDir(entry.fullPath, depth + 1));
                  }
                  if (this._wantsDir) {
                    this.push(entry);
                    batch--;
                  }
                } else if ((entryType === "file" || this._includeAsFile(entry)) && this._fileFilter(entry)) {
                  if (this._wantsFile) {
                    this.push(entry);
                    batch--;
                  }
                }
              }
            } else {
              const parent = this.parents.pop();
              if (!parent) {
                this.push(null);
                break;
              }
              this.parent = await parent;
              if (this.destroyed) return;
            }
          }
        } catch (error) {
          this.destroy(error);
        } finally {
          this.reading = false;
        }
      }
      async _exploreDir(path4, depth) {
        let files;
        try {
          files = await readdir(path4, this._rdOptions);
        } catch (error) {
          this._onError(error);
        }
        return { files, depth, path: path4 };
      }
      async _formatEntry(dirent, path4) {
        let entry;
        try {
          const basename3 = this._isDirent ? dirent.name : dirent;
          const fullPath = sysPath.resolve(sysPath.join(path4, basename3));
          entry = { path: sysPath.relative(this._root, fullPath), fullPath, basename: basename3 };
          entry[this._statsProp] = this._isDirent ? dirent : await this._stat(fullPath);
        } catch (err) {
          this._onError(err);
        }
        return entry;
      }
      _onError(err) {
        if (isNormalFlowError(err) && !this.destroyed) {
          this.emit("warn", err);
        } else {
          this.destroy(err);
        }
      }
      async _getEntryType(entry) {
        const stats = entry && entry[this._statsProp];
        if (!stats) {
          return;
        }
        if (stats.isFile()) {
          return "file";
        }
        if (stats.isDirectory()) {
          return "directory";
        }
        if (stats && stats.isSymbolicLink()) {
          const full = entry.fullPath;
          try {
            const entryRealPath = await realpath(full);
            const entryRealPathStats = await lstat(entryRealPath);
            if (entryRealPathStats.isFile()) {
              return "file";
            }
            if (entryRealPathStats.isDirectory()) {
              const len = entryRealPath.length;
              if (full.startsWith(entryRealPath) && full.substr(len, 1) === sysPath.sep) {
                const recursiveError = new Error(
                  `Circular symlink detected: "${full}" points to "${entryRealPath}"`
                );
                recursiveError.code = RECURSIVE_ERROR_CODE;
                return this._onError(recursiveError);
              }
              return "directory";
            }
          } catch (error) {
            this._onError(error);
          }
        }
      }
      _includeAsFile(entry) {
        const stats = entry && entry[this._statsProp];
        return stats && this._wantsEverything && !stats.isDirectory();
      }
    };
    var readdirp = (root, options = {}) => {
      let type = options.entryType || options.type;
      if (type === "both") type = FILE_DIR_TYPE;
      if (type) options.type = type;
      if (!root) {
        throw new Error("readdirp: root argument is required. Usage: readdirp(root, options)");
      } else if (typeof root !== "string") {
        throw new TypeError("readdirp: root argument must be a string. Usage: readdirp(root, options)");
      } else if (type && !ALL_TYPES.includes(type)) {
        throw new Error(`readdirp: Invalid type passed. Use one of ${ALL_TYPES.join(", ")}`);
      }
      options.root = root;
      return new ReaddirpStream(options);
    };
    var readdirpPromise = (root, options = {}) => {
      return new Promise((resolve, reject) => {
        const files = [];
        readdirp(root, options).on("data", (entry) => files.push(entry)).on("end", () => resolve(files)).on("error", (error) => reject(error));
      });
    };
    readdirp.promise = readdirpPromise;
    readdirp.ReaddirpStream = ReaddirpStream;
    readdirp.default = readdirp;
    module2.exports = readdirp;
  }
});

// node_modules/normalize-path/index.js
var require_normalize_path = __commonJS({
  "node_modules/normalize-path/index.js"(exports2, module2) {
    module2.exports = function(path4, stripTrailing) {
      if (typeof path4 !== "string") {
        throw new TypeError("expected path to be a string");
      }
      if (path4 === "\\" || path4 === "/") return "/";
      var len = path4.length;
      if (len <= 1) return path4;
      var prefix = "";
      if (len > 4 && path4[3] === "\\") {
        var ch = path4[2];
        if ((ch === "?" || ch === ".") && path4.slice(0, 2) === "\\\\") {
          path4 = path4.slice(2);
          prefix = "//";
        }
      }
      var segs = path4.split(/[/\\]+/);
      if (stripTrailing !== false && segs[segs.length - 1] === "") {
        segs.pop();
      }
      return prefix + segs.join("/");
    };
  }
});

// node_modules/anymatch/index.js
var require_anymatch = __commonJS({
  "node_modules/anymatch/index.js"(exports2, module2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var picomatch = require_picomatch2();
    var normalizePath = require_normalize_path();
    var BANG = "!";
    var DEFAULT_OPTIONS = { returnIndex: false };
    var arrify = (item) => Array.isArray(item) ? item : [item];
    var createPattern = (matcher, options) => {
      if (typeof matcher === "function") {
        return matcher;
      }
      if (typeof matcher === "string") {
        const glob = picomatch(matcher, options);
        return (string) => matcher === string || glob(string);
      }
      if (matcher instanceof RegExp) {
        return (string) => matcher.test(string);
      }
      return (string) => false;
    };
    var matchPatterns = (patterns, negPatterns, args, returnIndex) => {
      const isList = Array.isArray(args);
      const _path = isList ? args[0] : args;
      if (!isList && typeof _path !== "string") {
        throw new TypeError("anymatch: second argument must be a string: got " + Object.prototype.toString.call(_path));
      }
      const path4 = normalizePath(_path, false);
      for (let index = 0; index < negPatterns.length; index++) {
        const nglob = negPatterns[index];
        if (nglob(path4)) {
          return returnIndex ? -1 : false;
        }
      }
      const applied = isList && [path4].concat(args.slice(1));
      for (let index = 0; index < patterns.length; index++) {
        const pattern = patterns[index];
        if (isList ? pattern(...applied) : pattern(path4)) {
          return returnIndex ? index : true;
        }
      }
      return returnIndex ? -1 : false;
    };
    var anymatch = (matchers, testString, options = DEFAULT_OPTIONS) => {
      if (matchers == null) {
        throw new TypeError("anymatch: specify first argument");
      }
      const opts = typeof options === "boolean" ? { returnIndex: options } : options;
      const returnIndex = opts.returnIndex || false;
      const mtchers = arrify(matchers);
      const negatedGlobs = mtchers.filter((item) => typeof item === "string" && item.charAt(0) === BANG).map((item) => item.slice(1)).map((item) => picomatch(item, opts));
      const patterns = mtchers.filter((item) => typeof item !== "string" || typeof item === "string" && item.charAt(0) !== BANG).map((matcher) => createPattern(matcher, opts));
      if (testString == null) {
        return (testString2, ri = false) => {
          const returnIndex2 = typeof ri === "boolean" ? ri : false;
          return matchPatterns(patterns, negatedGlobs, testString2, returnIndex2);
        };
      }
      return matchPatterns(patterns, negatedGlobs, testString, returnIndex);
    };
    anymatch.default = anymatch;
    module2.exports = anymatch;
  }
});

// node_modules/is-extglob/index.js
var require_is_extglob = __commonJS({
  "node_modules/is-extglob/index.js"(exports2, module2) {
    module2.exports = function isExtglob(str) {
      if (typeof str !== "string" || str === "") {
        return false;
      }
      var match;
      while (match = /(\\).|([@?!+*]\(.*\))/g.exec(str)) {
        if (match[2]) return true;
        str = str.slice(match.index + match[0].length);
      }
      return false;
    };
  }
});

// node_modules/is-glob/index.js
var require_is_glob = __commonJS({
  "node_modules/is-glob/index.js"(exports2, module2) {
    var isExtglob = require_is_extglob();
    var chars = { "{": "}", "(": ")", "[": "]" };
    var strictCheck = function(str) {
      if (str[0] === "!") {
        return true;
      }
      var index = 0;
      var pipeIndex = -2;
      var closeSquareIndex = -2;
      var closeCurlyIndex = -2;
      var closeParenIndex = -2;
      var backSlashIndex = -2;
      while (index < str.length) {
        if (str[index] === "*") {
          return true;
        }
        if (str[index + 1] === "?" && /[\].+)]/.test(str[index])) {
          return true;
        }
        if (closeSquareIndex !== -1 && str[index] === "[" && str[index + 1] !== "]") {
          if (closeSquareIndex < index) {
            closeSquareIndex = str.indexOf("]", index);
          }
          if (closeSquareIndex > index) {
            if (backSlashIndex === -1 || backSlashIndex > closeSquareIndex) {
              return true;
            }
            backSlashIndex = str.indexOf("\\", index);
            if (backSlashIndex === -1 || backSlashIndex > closeSquareIndex) {
              return true;
            }
          }
        }
        if (closeCurlyIndex !== -1 && str[index] === "{" && str[index + 1] !== "}") {
          closeCurlyIndex = str.indexOf("}", index);
          if (closeCurlyIndex > index) {
            backSlashIndex = str.indexOf("\\", index);
            if (backSlashIndex === -1 || backSlashIndex > closeCurlyIndex) {
              return true;
            }
          }
        }
        if (closeParenIndex !== -1 && str[index] === "(" && str[index + 1] === "?" && /[:!=]/.test(str[index + 2]) && str[index + 3] !== ")") {
          closeParenIndex = str.indexOf(")", index);
          if (closeParenIndex > index) {
            backSlashIndex = str.indexOf("\\", index);
            if (backSlashIndex === -1 || backSlashIndex > closeParenIndex) {
              return true;
            }
          }
        }
        if (pipeIndex !== -1 && str[index] === "(" && str[index + 1] !== "|") {
          if (pipeIndex < index) {
            pipeIndex = str.indexOf("|", index);
          }
          if (pipeIndex !== -1 && str[pipeIndex + 1] !== ")") {
            closeParenIndex = str.indexOf(")", pipeIndex);
            if (closeParenIndex > pipeIndex) {
              backSlashIndex = str.indexOf("\\", pipeIndex);
              if (backSlashIndex === -1 || backSlashIndex > closeParenIndex) {
                return true;
              }
            }
          }
        }
        if (str[index] === "\\") {
          var open = str[index + 1];
          index += 2;
          var close = chars[open];
          if (close) {
            var n = str.indexOf(close, index);
            if (n !== -1) {
              index = n + 1;
            }
          }
          if (str[index] === "!") {
            return true;
          }
        } else {
          index++;
        }
      }
      return false;
    };
    var relaxedCheck = function(str) {
      if (str[0] === "!") {
        return true;
      }
      var index = 0;
      while (index < str.length) {
        if (/[*?{}()[\]]/.test(str[index])) {
          return true;
        }
        if (str[index] === "\\") {
          var open = str[index + 1];
          index += 2;
          var close = chars[open];
          if (close) {
            var n = str.indexOf(close, index);
            if (n !== -1) {
              index = n + 1;
            }
          }
          if (str[index] === "!") {
            return true;
          }
        } else {
          index++;
        }
      }
      return false;
    };
    module2.exports = function isGlob(str, options) {
      if (typeof str !== "string" || str === "") {
        return false;
      }
      if (isExtglob(str)) {
        return true;
      }
      var check = strictCheck;
      if (options && options.strict === false) {
        check = relaxedCheck;
      }
      return check(str);
    };
  }
});

// node_modules/glob-parent/index.js
var require_glob_parent = __commonJS({
  "node_modules/glob-parent/index.js"(exports2, module2) {
    "use strict";
    var isGlob = require_is_glob();
    var pathPosixDirname = require("path").posix.dirname;
    var isWin32 = require("os").platform() === "win32";
    var slash = "/";
    var backslash = /\\/g;
    var enclosure = /[\{\[].*[\}\]]$/;
    var globby = /(^|[^\\])([\{\[]|\([^\)]+$)/;
    var escaped = /\\([\!\*\?\|\[\]\(\)\{\}])/g;
    module2.exports = function globParent(str, opts) {
      var options = Object.assign({ flipBackslashes: true }, opts);
      if (options.flipBackslashes && isWin32 && str.indexOf(slash) < 0) {
        str = str.replace(backslash, slash);
      }
      if (enclosure.test(str)) {
        str += slash;
      }
      str += "a";
      do {
        str = pathPosixDirname(str);
      } while (isGlob(str) || globby.test(str));
      return str.replace(escaped, "$1");
    };
  }
});

// node_modules/braces/lib/utils.js
var require_utils2 = __commonJS({
  "node_modules/braces/lib/utils.js"(exports2) {
    "use strict";
    exports2.isInteger = (num) => {
      if (typeof num === "number") {
        return Number.isInteger(num);
      }
      if (typeof num === "string" && num.trim() !== "") {
        return Number.isInteger(Number(num));
      }
      return false;
    };
    exports2.find = (node, type) => node.nodes.find((node2) => node2.type === type);
    exports2.exceedsLimit = (min, max, step = 1, limit) => {
      if (limit === false) return false;
      if (!exports2.isInteger(min) || !exports2.isInteger(max)) return false;
      return (Number(max) - Number(min)) / Number(step) >= limit;
    };
    exports2.escapeNode = (block, n = 0, type) => {
      const node = block.nodes[n];
      if (!node) return;
      if (type && node.type === type || node.type === "open" || node.type === "close") {
        if (node.escaped !== true) {
          node.value = "\\" + node.value;
          node.escaped = true;
        }
      }
    };
    exports2.encloseBrace = (node) => {
      if (node.type !== "brace") return false;
      if (node.commas >> 0 + node.ranges >> 0 === 0) {
        node.invalid = true;
        return true;
      }
      return false;
    };
    exports2.isInvalidBrace = (block) => {
      if (block.type !== "brace") return false;
      if (block.invalid === true || block.dollar) return true;
      if (block.commas >> 0 + block.ranges >> 0 === 0) {
        block.invalid = true;
        return true;
      }
      if (block.open !== true || block.close !== true) {
        block.invalid = true;
        return true;
      }
      return false;
    };
    exports2.isOpenOrClose = (node) => {
      if (node.type === "open" || node.type === "close") {
        return true;
      }
      return node.open === true || node.close === true;
    };
    exports2.reduce = (nodes) => nodes.reduce((acc, node) => {
      if (node.type === "text") acc.push(node.value);
      if (node.type === "range") node.type = "text";
      return acc;
    }, []);
    exports2.flatten = (...args) => {
      const result = [];
      const flat = (arr) => {
        for (let i = 0; i < arr.length; i++) {
          const ele = arr[i];
          if (Array.isArray(ele)) {
            flat(ele);
            continue;
          }
          if (ele !== void 0) {
            result.push(ele);
          }
        }
        return result;
      };
      flat(args);
      return result;
    };
  }
});

// node_modules/braces/lib/stringify.js
var require_stringify = __commonJS({
  "node_modules/braces/lib/stringify.js"(exports2, module2) {
    "use strict";
    var utils = require_utils2();
    module2.exports = (ast, options = {}) => {
      const stringify = (node, parent = {}) => {
        const invalidBlock = options.escapeInvalid && utils.isInvalidBrace(parent);
        const invalidNode = node.invalid === true && options.escapeInvalid === true;
        let output = "";
        if (node.value) {
          if ((invalidBlock || invalidNode) && utils.isOpenOrClose(node)) {
            return "\\" + node.value;
          }
          return node.value;
        }
        if (node.value) {
          return node.value;
        }
        if (node.nodes) {
          for (const child of node.nodes) {
            output += stringify(child);
          }
        }
        return output;
      };
      return stringify(ast);
    };
  }
});

// node_modules/is-number/index.js
var require_is_number = __commonJS({
  "node_modules/is-number/index.js"(exports2, module2) {
    "use strict";
    module2.exports = function(num) {
      if (typeof num === "number") {
        return num - num === 0;
      }
      if (typeof num === "string" && num.trim() !== "") {
        return Number.isFinite ? Number.isFinite(+num) : isFinite(+num);
      }
      return false;
    };
  }
});

// node_modules/to-regex-range/index.js
var require_to_regex_range = __commonJS({
  "node_modules/to-regex-range/index.js"(exports2, module2) {
    "use strict";
    var isNumber = require_is_number();
    var toRegexRange = (min, max, options) => {
      if (isNumber(min) === false) {
        throw new TypeError("toRegexRange: expected the first argument to be a number");
      }
      if (max === void 0 || min === max) {
        return String(min);
      }
      if (isNumber(max) === false) {
        throw new TypeError("toRegexRange: expected the second argument to be a number.");
      }
      let opts = { relaxZeros: true, ...options };
      if (typeof opts.strictZeros === "boolean") {
        opts.relaxZeros = opts.strictZeros === false;
      }
      let relax = String(opts.relaxZeros);
      let shorthand = String(opts.shorthand);
      let capture = String(opts.capture);
      let wrap = String(opts.wrap);
      let cacheKey = min + ":" + max + "=" + relax + shorthand + capture + wrap;
      if (toRegexRange.cache.hasOwnProperty(cacheKey)) {
        return toRegexRange.cache[cacheKey].result;
      }
      let a = Math.min(min, max);
      let b = Math.max(min, max);
      if (Math.abs(a - b) === 1) {
        let result = min + "|" + max;
        if (opts.capture) {
          return `(${result})`;
        }
        if (opts.wrap === false) {
          return result;
        }
        return `(?:${result})`;
      }
      let isPadded = hasPadding(min) || hasPadding(max);
      let state = { min, max, a, b };
      let positives = [];
      let negatives = [];
      if (isPadded) {
        state.isPadded = isPadded;
        state.maxLen = String(state.max).length;
      }
      if (a < 0) {
        let newMin = b < 0 ? Math.abs(b) : 1;
        negatives = splitToPatterns(newMin, Math.abs(a), state, opts);
        a = state.a = 0;
      }
      if (b >= 0) {
        positives = splitToPatterns(a, b, state, opts);
      }
      state.negatives = negatives;
      state.positives = positives;
      state.result = collatePatterns(negatives, positives, opts);
      if (opts.capture === true) {
        state.result = `(${state.result})`;
      } else if (opts.wrap !== false && positives.length + negatives.length > 1) {
        state.result = `(?:${state.result})`;
      }
      toRegexRange.cache[cacheKey] = state;
      return state.result;
    };
    function collatePatterns(neg, pos, options) {
      let onlyNegative = filterPatterns(neg, pos, "-", false, options) || [];
      let onlyPositive = filterPatterns(pos, neg, "", false, options) || [];
      let intersected = filterPatterns(neg, pos, "-?", true, options) || [];
      let subpatterns = onlyNegative.concat(intersected).concat(onlyPositive);
      return subpatterns.join("|");
    }
    function splitToRanges(min, max) {
      let nines = 1;
      let zeros = 1;
      let stop = countNines(min, nines);
      let stops = /* @__PURE__ */ new Set([max]);
      while (min <= stop && stop <= max) {
        stops.add(stop);
        nines += 1;
        stop = countNines(min, nines);
      }
      stop = countZeros(max + 1, zeros) - 1;
      while (min < stop && stop <= max) {
        stops.add(stop);
        zeros += 1;
        stop = countZeros(max + 1, zeros) - 1;
      }
      stops = [...stops];
      stops.sort(compare);
      return stops;
    }
    function rangeToPattern(start, stop, options) {
      if (start === stop) {
        return { pattern: start, count: [], digits: 0 };
      }
      let zipped = zip(start, stop);
      let digits = zipped.length;
      let pattern = "";
      let count = 0;
      for (let i = 0; i < digits; i++) {
        let [startDigit, stopDigit] = zipped[i];
        if (startDigit === stopDigit) {
          pattern += startDigit;
        } else if (startDigit !== "0" || stopDigit !== "9") {
          pattern += toCharacterClass(startDigit, stopDigit, options);
        } else {
          count++;
        }
      }
      if (count) {
        pattern += options.shorthand === true ? "\\d" : "[0-9]";
      }
      return { pattern, count: [count], digits };
    }
    function splitToPatterns(min, max, tok, options) {
      let ranges = splitToRanges(min, max);
      let tokens = [];
      let start = min;
      let prev;
      for (let i = 0; i < ranges.length; i++) {
        let max2 = ranges[i];
        let obj = rangeToPattern(String(start), String(max2), options);
        let zeros = "";
        if (!tok.isPadded && prev && prev.pattern === obj.pattern) {
          if (prev.count.length > 1) {
            prev.count.pop();
          }
          prev.count.push(obj.count[0]);
          prev.string = prev.pattern + toQuantifier(prev.count);
          start = max2 + 1;
          continue;
        }
        if (tok.isPadded) {
          zeros = padZeros(max2, tok, options);
        }
        obj.string = zeros + obj.pattern + toQuantifier(obj.count);
        tokens.push(obj);
        start = max2 + 1;
        prev = obj;
      }
      return tokens;
    }
    function filterPatterns(arr, comparison, prefix, intersection, options) {
      let result = [];
      for (let ele of arr) {
        let { string } = ele;
        if (!intersection && !contains(comparison, "string", string)) {
          result.push(prefix + string);
        }
        if (intersection && contains(comparison, "string", string)) {
          result.push(prefix + string);
        }
      }
      return result;
    }
    function zip(a, b) {
      let arr = [];
      for (let i = 0; i < a.length; i++) arr.push([a[i], b[i]]);
      return arr;
    }
    function compare(a, b) {
      return a > b ? 1 : b > a ? -1 : 0;
    }
    function contains(arr, key, val) {
      return arr.some((ele) => ele[key] === val);
    }
    function countNines(min, len) {
      return Number(String(min).slice(0, -len) + "9".repeat(len));
    }
    function countZeros(integer, zeros) {
      return integer - integer % Math.pow(10, zeros);
    }
    function toQuantifier(digits) {
      let [start = 0, stop = ""] = digits;
      if (stop || start > 1) {
        return `{${start + (stop ? "," + stop : "")}}`;
      }
      return "";
    }
    function toCharacterClass(a, b, options) {
      return `[${a}${b - a === 1 ? "" : "-"}${b}]`;
    }
    function hasPadding(str) {
      return /^-?(0+)\d/.test(str);
    }
    function padZeros(value, tok, options) {
      if (!tok.isPadded) {
        return value;
      }
      let diff = Math.abs(tok.maxLen - String(value).length);
      let relax = options.relaxZeros !== false;
      switch (diff) {
        case 0:
          return "";
        case 1:
          return relax ? "0?" : "0";
        case 2:
          return relax ? "0{0,2}" : "00";
        default: {
          return relax ? `0{0,${diff}}` : `0{${diff}}`;
        }
      }
    }
    toRegexRange.cache = {};
    toRegexRange.clearCache = () => toRegexRange.cache = {};
    module2.exports = toRegexRange;
  }
});

// node_modules/fill-range/index.js
var require_fill_range = __commonJS({
  "node_modules/fill-range/index.js"(exports2, module2) {
    "use strict";
    var util = require("util");
    var toRegexRange = require_to_regex_range();
    var isObject = (val) => val !== null && typeof val === "object" && !Array.isArray(val);
    var transform = (toNumber) => {
      return (value) => toNumber === true ? Number(value) : String(value);
    };
    var isValidValue = (value) => {
      return typeof value === "number" || typeof value === "string" && value !== "";
    };
    var isNumber = (num) => Number.isInteger(+num);
    var zeros = (input) => {
      let value = `${input}`;
      let index = -1;
      if (value[0] === "-") value = value.slice(1);
      if (value === "0") return false;
      while (value[++index] === "0") ;
      return index > 0;
    };
    var stringify = (start, end, options) => {
      if (typeof start === "string" || typeof end === "string") {
        return true;
      }
      return options.stringify === true;
    };
    var pad = (input, maxLength, toNumber) => {
      if (maxLength > 0) {
        let dash = input[0] === "-" ? "-" : "";
        if (dash) input = input.slice(1);
        input = dash + input.padStart(dash ? maxLength - 1 : maxLength, "0");
      }
      if (toNumber === false) {
        return String(input);
      }
      return input;
    };
    var toMaxLen = (input, maxLength) => {
      let negative = input[0] === "-" ? "-" : "";
      if (negative) {
        input = input.slice(1);
        maxLength--;
      }
      while (input.length < maxLength) input = "0" + input;
      return negative ? "-" + input : input;
    };
    var toSequence = (parts, options, maxLen) => {
      parts.negatives.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
      parts.positives.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
      let prefix = options.capture ? "" : "?:";
      let positives = "";
      let negatives = "";
      let result;
      if (parts.positives.length) {
        positives = parts.positives.map((v) => toMaxLen(String(v), maxLen)).join("|");
      }
      if (parts.negatives.length) {
        negatives = `-(${prefix}${parts.negatives.map((v) => toMaxLen(String(v), maxLen)).join("|")})`;
      }
      if (positives && negatives) {
        result = `${positives}|${negatives}`;
      } else {
        result = positives || negatives;
      }
      if (options.wrap) {
        return `(${prefix}${result})`;
      }
      return result;
    };
    var toRange = (a, b, isNumbers, options) => {
      if (isNumbers) {
        return toRegexRange(a, b, { wrap: false, ...options });
      }
      let start = String.fromCharCode(a);
      if (a === b) return start;
      let stop = String.fromCharCode(b);
      return `[${start}-${stop}]`;
    };
    var toRegex = (start, end, options) => {
      if (Array.isArray(start)) {
        let wrap = options.wrap === true;
        let prefix = options.capture ? "" : "?:";
        return wrap ? `(${prefix}${start.join("|")})` : start.join("|");
      }
      return toRegexRange(start, end, options);
    };
    var rangeError = (...args) => {
      return new RangeError("Invalid range arguments: " + util.inspect(...args));
    };
    var invalidRange = (start, end, options) => {
      if (options.strictRanges === true) throw rangeError([start, end]);
      return [];
    };
    var invalidStep = (step, options) => {
      if (options.strictRanges === true) {
        throw new TypeError(`Expected step "${step}" to be a number`);
      }
      return [];
    };
    var fillNumbers = (start, end, step = 1, options = {}) => {
      let a = Number(start);
      let b = Number(end);
      if (!Number.isInteger(a) || !Number.isInteger(b)) {
        if (options.strictRanges === true) throw rangeError([start, end]);
        return [];
      }
      if (a === 0) a = 0;
      if (b === 0) b = 0;
      let descending = a > b;
      let startString = String(start);
      let endString = String(end);
      let stepString = String(step);
      step = Math.max(Math.abs(step), 1);
      let padded = zeros(startString) || zeros(endString) || zeros(stepString);
      let maxLen = padded ? Math.max(startString.length, endString.length, stepString.length) : 0;
      let toNumber = padded === false && stringify(start, end, options) === false;
      let format = options.transform || transform(toNumber);
      if (options.toRegex && step === 1) {
        return toRange(toMaxLen(start, maxLen), toMaxLen(end, maxLen), true, options);
      }
      let parts = { negatives: [], positives: [] };
      let push = (num) => parts[num < 0 ? "negatives" : "positives"].push(Math.abs(num));
      let range = [];
      let index = 0;
      while (descending ? a >= b : a <= b) {
        if (options.toRegex === true && step > 1) {
          push(a);
        } else {
          range.push(pad(format(a, index), maxLen, toNumber));
        }
        a = descending ? a - step : a + step;
        index++;
      }
      if (options.toRegex === true) {
        return step > 1 ? toSequence(parts, options, maxLen) : toRegex(range, null, { wrap: false, ...options });
      }
      return range;
    };
    var fillLetters = (start, end, step = 1, options = {}) => {
      if (!isNumber(start) && start.length > 1 || !isNumber(end) && end.length > 1) {
        return invalidRange(start, end, options);
      }
      let format = options.transform || ((val) => String.fromCharCode(val));
      let a = `${start}`.charCodeAt(0);
      let b = `${end}`.charCodeAt(0);
      let descending = a > b;
      let min = Math.min(a, b);
      let max = Math.max(a, b);
      if (options.toRegex && step === 1) {
        return toRange(min, max, false, options);
      }
      let range = [];
      let index = 0;
      while (descending ? a >= b : a <= b) {
        range.push(format(a, index));
        a = descending ? a - step : a + step;
        index++;
      }
      if (options.toRegex === true) {
        return toRegex(range, null, { wrap: false, options });
      }
      return range;
    };
    var fill = (start, end, step, options = {}) => {
      if (end == null && isValidValue(start)) {
        return [start];
      }
      if (!isValidValue(start) || !isValidValue(end)) {
        return invalidRange(start, end, options);
      }
      if (typeof step === "function") {
        return fill(start, end, 1, { transform: step });
      }
      if (isObject(step)) {
        return fill(start, end, 0, step);
      }
      let opts = { ...options };
      if (opts.capture === true) opts.wrap = true;
      step = step || opts.step || 1;
      if (!isNumber(step)) {
        if (step != null && !isObject(step)) return invalidStep(step, opts);
        return fill(start, end, 1, step);
      }
      if (isNumber(start) && isNumber(end)) {
        return fillNumbers(start, end, step, opts);
      }
      return fillLetters(start, end, Math.max(Math.abs(step), 1), opts);
    };
    module2.exports = fill;
  }
});

// node_modules/braces/lib/compile.js
var require_compile = __commonJS({
  "node_modules/braces/lib/compile.js"(exports2, module2) {
    "use strict";
    var fill = require_fill_range();
    var utils = require_utils2();
    var compile = (ast, options = {}) => {
      const walk = (node, parent = {}) => {
        const invalidBlock = utils.isInvalidBrace(parent);
        const invalidNode = node.invalid === true && options.escapeInvalid === true;
        const invalid = invalidBlock === true || invalidNode === true;
        const prefix = options.escapeInvalid === true ? "\\" : "";
        let output = "";
        if (node.isOpen === true) {
          return prefix + node.value;
        }
        if (node.isClose === true) {
          console.log("node.isClose", prefix, node.value);
          return prefix + node.value;
        }
        if (node.type === "open") {
          return invalid ? prefix + node.value : "(";
        }
        if (node.type === "close") {
          return invalid ? prefix + node.value : ")";
        }
        if (node.type === "comma") {
          return node.prev.type === "comma" ? "" : invalid ? node.value : "|";
        }
        if (node.value) {
          return node.value;
        }
        if (node.nodes && node.ranges > 0) {
          const args = utils.reduce(node.nodes);
          const range = fill(...args, { ...options, wrap: false, toRegex: true, strictZeros: true });
          if (range.length !== 0) {
            return args.length > 1 && range.length > 1 ? `(${range})` : range;
          }
        }
        if (node.nodes) {
          for (const child of node.nodes) {
            output += walk(child, node);
          }
        }
        return output;
      };
      return walk(ast);
    };
    module2.exports = compile;
  }
});

// node_modules/braces/lib/expand.js
var require_expand = __commonJS({
  "node_modules/braces/lib/expand.js"(exports2, module2) {
    "use strict";
    var fill = require_fill_range();
    var stringify = require_stringify();
    var utils = require_utils2();
    var append = (queue = "", stash = "", enclose = false) => {
      const result = [];
      queue = [].concat(queue);
      stash = [].concat(stash);
      if (!stash.length) return queue;
      if (!queue.length) {
        return enclose ? utils.flatten(stash).map((ele) => `{${ele}}`) : stash;
      }
      for (const item of queue) {
        if (Array.isArray(item)) {
          for (const value of item) {
            result.push(append(value, stash, enclose));
          }
        } else {
          for (let ele of stash) {
            if (enclose === true && typeof ele === "string") ele = `{${ele}}`;
            result.push(Array.isArray(ele) ? append(item, ele, enclose) : item + ele);
          }
        }
      }
      return utils.flatten(result);
    };
    var expand = (ast, options = {}) => {
      const rangeLimit = options.rangeLimit === void 0 ? 1e3 : options.rangeLimit;
      const walk = (node, parent = {}) => {
        node.queue = [];
        let p = parent;
        let q = parent.queue;
        while (p.type !== "brace" && p.type !== "root" && p.parent) {
          p = p.parent;
          q = p.queue;
        }
        if (node.invalid || node.dollar) {
          q.push(append(q.pop(), stringify(node, options)));
          return;
        }
        if (node.type === "brace" && node.invalid !== true && node.nodes.length === 2) {
          q.push(append(q.pop(), ["{}"]));
          return;
        }
        if (node.nodes && node.ranges > 0) {
          const args = utils.reduce(node.nodes);
          if (utils.exceedsLimit(...args, options.step, rangeLimit)) {
            throw new RangeError("expanded array length exceeds range limit. Use options.rangeLimit to increase or disable the limit.");
          }
          let range = fill(...args, options);
          if (range.length === 0) {
            range = stringify(node, options);
          }
          q.push(append(q.pop(), range));
          node.nodes = [];
          return;
        }
        const enclose = utils.encloseBrace(node);
        let queue = node.queue;
        let block = node;
        while (block.type !== "brace" && block.type !== "root" && block.parent) {
          block = block.parent;
          queue = block.queue;
        }
        for (let i = 0; i < node.nodes.length; i++) {
          const child = node.nodes[i];
          if (child.type === "comma" && node.type === "brace") {
            if (i === 1) queue.push("");
            queue.push("");
            continue;
          }
          if (child.type === "close") {
            q.push(append(q.pop(), queue, enclose));
            continue;
          }
          if (child.value && child.type !== "open") {
            queue.push(append(queue.pop(), child.value));
            continue;
          }
          if (child.nodes) {
            walk(child, node);
          }
        }
        return queue;
      };
      return utils.flatten(walk(ast));
    };
    module2.exports = expand;
  }
});

// node_modules/braces/lib/constants.js
var require_constants2 = __commonJS({
  "node_modules/braces/lib/constants.js"(exports2, module2) {
    "use strict";
    module2.exports = {
      MAX_LENGTH: 1e4,
      // Digits
      CHAR_0: "0",
      /* 0 */
      CHAR_9: "9",
      /* 9 */
      // Alphabet chars.
      CHAR_UPPERCASE_A: "A",
      /* A */
      CHAR_LOWERCASE_A: "a",
      /* a */
      CHAR_UPPERCASE_Z: "Z",
      /* Z */
      CHAR_LOWERCASE_Z: "z",
      /* z */
      CHAR_LEFT_PARENTHESES: "(",
      /* ( */
      CHAR_RIGHT_PARENTHESES: ")",
      /* ) */
      CHAR_ASTERISK: "*",
      /* * */
      // Non-alphabetic chars.
      CHAR_AMPERSAND: "&",
      /* & */
      CHAR_AT: "@",
      /* @ */
      CHAR_BACKSLASH: "\\",
      /* \ */
      CHAR_BACKTICK: "`",
      /* ` */
      CHAR_CARRIAGE_RETURN: "\r",
      /* \r */
      CHAR_CIRCUMFLEX_ACCENT: "^",
      /* ^ */
      CHAR_COLON: ":",
      /* : */
      CHAR_COMMA: ",",
      /* , */
      CHAR_DOLLAR: "$",
      /* . */
      CHAR_DOT: ".",
      /* . */
      CHAR_DOUBLE_QUOTE: '"',
      /* " */
      CHAR_EQUAL: "=",
      /* = */
      CHAR_EXCLAMATION_MARK: "!",
      /* ! */
      CHAR_FORM_FEED: "\f",
      /* \f */
      CHAR_FORWARD_SLASH: "/",
      /* / */
      CHAR_HASH: "#",
      /* # */
      CHAR_HYPHEN_MINUS: "-",
      /* - */
      CHAR_LEFT_ANGLE_BRACKET: "<",
      /* < */
      CHAR_LEFT_CURLY_BRACE: "{",
      /* { */
      CHAR_LEFT_SQUARE_BRACKET: "[",
      /* [ */
      CHAR_LINE_FEED: "\n",
      /* \n */
      CHAR_NO_BREAK_SPACE: "\xA0",
      /* \u00A0 */
      CHAR_PERCENT: "%",
      /* % */
      CHAR_PLUS: "+",
      /* + */
      CHAR_QUESTION_MARK: "?",
      /* ? */
      CHAR_RIGHT_ANGLE_BRACKET: ">",
      /* > */
      CHAR_RIGHT_CURLY_BRACE: "}",
      /* } */
      CHAR_RIGHT_SQUARE_BRACKET: "]",
      /* ] */
      CHAR_SEMICOLON: ";",
      /* ; */
      CHAR_SINGLE_QUOTE: "'",
      /* ' */
      CHAR_SPACE: " ",
      /*   */
      CHAR_TAB: "	",
      /* \t */
      CHAR_UNDERSCORE: "_",
      /* _ */
      CHAR_VERTICAL_LINE: "|",
      /* | */
      CHAR_ZERO_WIDTH_NOBREAK_SPACE: "\uFEFF"
      /* \uFEFF */
    };
  }
});

// node_modules/braces/lib/parse.js
var require_parse2 = __commonJS({
  "node_modules/braces/lib/parse.js"(exports2, module2) {
    "use strict";
    var stringify = require_stringify();
    var {
      MAX_LENGTH,
      CHAR_BACKSLASH,
      /* \ */
      CHAR_BACKTICK,
      /* ` */
      CHAR_COMMA,
      /* , */
      CHAR_DOT,
      /* . */
      CHAR_LEFT_PARENTHESES,
      /* ( */
      CHAR_RIGHT_PARENTHESES,
      /* ) */
      CHAR_LEFT_CURLY_BRACE,
      /* { */
      CHAR_RIGHT_CURLY_BRACE,
      /* } */
      CHAR_LEFT_SQUARE_BRACKET,
      /* [ */
      CHAR_RIGHT_SQUARE_BRACKET,
      /* ] */
      CHAR_DOUBLE_QUOTE,
      /* " */
      CHAR_SINGLE_QUOTE,
      /* ' */
      CHAR_NO_BREAK_SPACE,
      CHAR_ZERO_WIDTH_NOBREAK_SPACE
    } = require_constants2();
    var parse = (input, options = {}) => {
      if (typeof input !== "string") {
        throw new TypeError("Expected a string");
      }
      const opts = options || {};
      const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
      if (input.length > max) {
        throw new SyntaxError(`Input length (${input.length}), exceeds max characters (${max})`);
      }
      const ast = { type: "root", input, nodes: [] };
      const stack = [ast];
      let block = ast;
      let prev = ast;
      let brackets = 0;
      const length = input.length;
      let index = 0;
      let depth = 0;
      let value;
      const advance = () => input[index++];
      const push = (node) => {
        if (node.type === "text" && prev.type === "dot") {
          prev.type = "text";
        }
        if (prev && prev.type === "text" && node.type === "text") {
          prev.value += node.value;
          return;
        }
        block.nodes.push(node);
        node.parent = block;
        node.prev = prev;
        prev = node;
        return node;
      };
      push({ type: "bos" });
      while (index < length) {
        block = stack[stack.length - 1];
        value = advance();
        if (value === CHAR_ZERO_WIDTH_NOBREAK_SPACE || value === CHAR_NO_BREAK_SPACE) {
          continue;
        }
        if (value === CHAR_BACKSLASH) {
          push({ type: "text", value: (options.keepEscaping ? value : "") + advance() });
          continue;
        }
        if (value === CHAR_RIGHT_SQUARE_BRACKET) {
          push({ type: "text", value: "\\" + value });
          continue;
        }
        if (value === CHAR_LEFT_SQUARE_BRACKET) {
          brackets++;
          let next;
          while (index < length && (next = advance())) {
            value += next;
            if (next === CHAR_LEFT_SQUARE_BRACKET) {
              brackets++;
              continue;
            }
            if (next === CHAR_BACKSLASH) {
              value += advance();
              continue;
            }
            if (next === CHAR_RIGHT_SQUARE_BRACKET) {
              brackets--;
              if (brackets === 0) {
                break;
              }
            }
          }
          push({ type: "text", value });
          continue;
        }
        if (value === CHAR_LEFT_PARENTHESES) {
          block = push({ type: "paren", nodes: [] });
          stack.push(block);
          push({ type: "text", value });
          continue;
        }
        if (value === CHAR_RIGHT_PARENTHESES) {
          if (block.type !== "paren") {
            push({ type: "text", value });
            continue;
          }
          block = stack.pop();
          push({ type: "text", value });
          block = stack[stack.length - 1];
          continue;
        }
        if (value === CHAR_DOUBLE_QUOTE || value === CHAR_SINGLE_QUOTE || value === CHAR_BACKTICK) {
          const open = value;
          let next;
          if (options.keepQuotes !== true) {
            value = "";
          }
          while (index < length && (next = advance())) {
            if (next === CHAR_BACKSLASH) {
              value += next + advance();
              continue;
            }
            if (next === open) {
              if (options.keepQuotes === true) value += next;
              break;
            }
            value += next;
          }
          push({ type: "text", value });
          continue;
        }
        if (value === CHAR_LEFT_CURLY_BRACE) {
          depth++;
          const dollar = prev.value && prev.value.slice(-1) === "$" || block.dollar === true;
          const brace = {
            type: "brace",
            open: true,
            close: false,
            dollar,
            depth,
            commas: 0,
            ranges: 0,
            nodes: []
          };
          block = push(brace);
          stack.push(block);
          push({ type: "open", value });
          continue;
        }
        if (value === CHAR_RIGHT_CURLY_BRACE) {
          if (block.type !== "brace") {
            push({ type: "text", value });
            continue;
          }
          const type = "close";
          block = stack.pop();
          block.close = true;
          push({ type, value });
          depth--;
          block = stack[stack.length - 1];
          continue;
        }
        if (value === CHAR_COMMA && depth > 0) {
          if (block.ranges > 0) {
            block.ranges = 0;
            const open = block.nodes.shift();
            block.nodes = [open, { type: "text", value: stringify(block) }];
          }
          push({ type: "comma", value });
          block.commas++;
          continue;
        }
        if (value === CHAR_DOT && depth > 0 && block.commas === 0) {
          const siblings = block.nodes;
          if (depth === 0 || siblings.length === 0) {
            push({ type: "text", value });
            continue;
          }
          if (prev.type === "dot") {
            block.range = [];
            prev.value += value;
            prev.type = "range";
            if (block.nodes.length !== 3 && block.nodes.length !== 5) {
              block.invalid = true;
              block.ranges = 0;
              prev.type = "text";
              continue;
            }
            block.ranges++;
            block.args = [];
            continue;
          }
          if (prev.type === "range") {
            siblings.pop();
            const before = siblings[siblings.length - 1];
            before.value += prev.value + value;
            prev = before;
            block.ranges--;
            continue;
          }
          push({ type: "dot", value });
          continue;
        }
        push({ type: "text", value });
      }
      do {
        block = stack.pop();
        if (block.type !== "root") {
          block.nodes.forEach((node) => {
            if (!node.nodes) {
              if (node.type === "open") node.isOpen = true;
              if (node.type === "close") node.isClose = true;
              if (!node.nodes) node.type = "text";
              node.invalid = true;
            }
          });
          const parent = stack[stack.length - 1];
          const index2 = parent.nodes.indexOf(block);
          parent.nodes.splice(index2, 1, ...block.nodes);
        }
      } while (stack.length > 0);
      push({ type: "eos" });
      return ast;
    };
    module2.exports = parse;
  }
});

// node_modules/braces/index.js
var require_braces = __commonJS({
  "node_modules/braces/index.js"(exports2, module2) {
    "use strict";
    var stringify = require_stringify();
    var compile = require_compile();
    var expand = require_expand();
    var parse = require_parse2();
    var braces = (input, options = {}) => {
      let output = [];
      if (Array.isArray(input)) {
        for (const pattern of input) {
          const result = braces.create(pattern, options);
          if (Array.isArray(result)) {
            output.push(...result);
          } else {
            output.push(result);
          }
        }
      } else {
        output = [].concat(braces.create(input, options));
      }
      if (options && options.expand === true && options.nodupes === true) {
        output = [...new Set(output)];
      }
      return output;
    };
    braces.parse = (input, options = {}) => parse(input, options);
    braces.stringify = (input, options = {}) => {
      if (typeof input === "string") {
        return stringify(braces.parse(input, options), options);
      }
      return stringify(input, options);
    };
    braces.compile = (input, options = {}) => {
      if (typeof input === "string") {
        input = braces.parse(input, options);
      }
      return compile(input, options);
    };
    braces.expand = (input, options = {}) => {
      if (typeof input === "string") {
        input = braces.parse(input, options);
      }
      let result = expand(input, options);
      if (options.noempty === true) {
        result = result.filter(Boolean);
      }
      if (options.nodupes === true) {
        result = [...new Set(result)];
      }
      return result;
    };
    braces.create = (input, options = {}) => {
      if (input === "" || input.length < 3) {
        return [input];
      }
      return options.expand !== true ? braces.compile(input, options) : braces.expand(input, options);
    };
    module2.exports = braces;
  }
});

// node_modules/binary-extensions/binary-extensions.json
var require_binary_extensions = __commonJS({
  "node_modules/binary-extensions/binary-extensions.json"(exports2, module2) {
    module2.exports = [
      "3dm",
      "3ds",
      "3g2",
      "3gp",
      "7z",
      "a",
      "aac",
      "adp",
      "afdesign",
      "afphoto",
      "afpub",
      "ai",
      "aif",
      "aiff",
      "alz",
      "ape",
      "apk",
      "appimage",
      "ar",
      "arj",
      "asf",
      "au",
      "avi",
      "bak",
      "baml",
      "bh",
      "bin",
      "bk",
      "bmp",
      "btif",
      "bz2",
      "bzip2",
      "cab",
      "caf",
      "cgm",
      "class",
      "cmx",
      "cpio",
      "cr2",
      "cur",
      "dat",
      "dcm",
      "deb",
      "dex",
      "djvu",
      "dll",
      "dmg",
      "dng",
      "doc",
      "docm",
      "docx",
      "dot",
      "dotm",
      "dra",
      "DS_Store",
      "dsk",
      "dts",
      "dtshd",
      "dvb",
      "dwg",
      "dxf",
      "ecelp4800",
      "ecelp7470",
      "ecelp9600",
      "egg",
      "eol",
      "eot",
      "epub",
      "exe",
      "f4v",
      "fbs",
      "fh",
      "fla",
      "flac",
      "flatpak",
      "fli",
      "flv",
      "fpx",
      "fst",
      "fvt",
      "g3",
      "gh",
      "gif",
      "graffle",
      "gz",
      "gzip",
      "h261",
      "h263",
      "h264",
      "icns",
      "ico",
      "ief",
      "img",
      "ipa",
      "iso",
      "jar",
      "jpeg",
      "jpg",
      "jpgv",
      "jpm",
      "jxr",
      "key",
      "ktx",
      "lha",
      "lib",
      "lvp",
      "lz",
      "lzh",
      "lzma",
      "lzo",
      "m3u",
      "m4a",
      "m4v",
      "mar",
      "mdi",
      "mht",
      "mid",
      "midi",
      "mj2",
      "mka",
      "mkv",
      "mmr",
      "mng",
      "mobi",
      "mov",
      "movie",
      "mp3",
      "mp4",
      "mp4a",
      "mpeg",
      "mpg",
      "mpga",
      "mxu",
      "nef",
      "npx",
      "numbers",
      "nupkg",
      "o",
      "odp",
      "ods",
      "odt",
      "oga",
      "ogg",
      "ogv",
      "otf",
      "ott",
      "pages",
      "pbm",
      "pcx",
      "pdb",
      "pdf",
      "pea",
      "pgm",
      "pic",
      "png",
      "pnm",
      "pot",
      "potm",
      "potx",
      "ppa",
      "ppam",
      "ppm",
      "pps",
      "ppsm",
      "ppsx",
      "ppt",
      "pptm",
      "pptx",
      "psd",
      "pya",
      "pyc",
      "pyo",
      "pyv",
      "qt",
      "rar",
      "ras",
      "raw",
      "resources",
      "rgb",
      "rip",
      "rlc",
      "rmf",
      "rmvb",
      "rpm",
      "rtf",
      "rz",
      "s3m",
      "s7z",
      "scpt",
      "sgi",
      "shar",
      "snap",
      "sil",
      "sketch",
      "slk",
      "smv",
      "snk",
      "so",
      "stl",
      "suo",
      "sub",
      "swf",
      "tar",
      "tbz",
      "tbz2",
      "tga",
      "tgz",
      "thmx",
      "tif",
      "tiff",
      "tlz",
      "ttc",
      "ttf",
      "txz",
      "udf",
      "uvh",
      "uvi",
      "uvm",
      "uvp",
      "uvs",
      "uvu",
      "viv",
      "vob",
      "war",
      "wav",
      "wax",
      "wbmp",
      "wdp",
      "weba",
      "webm",
      "webp",
      "whl",
      "wim",
      "wm",
      "wma",
      "wmv",
      "wmx",
      "woff",
      "woff2",
      "wrm",
      "wvx",
      "xbm",
      "xif",
      "xla",
      "xlam",
      "xls",
      "xlsb",
      "xlsm",
      "xlsx",
      "xlt",
      "xltm",
      "xltx",
      "xm",
      "xmind",
      "xpi",
      "xpm",
      "xwd",
      "xz",
      "z",
      "zip",
      "zipx"
    ];
  }
});

// node_modules/binary-extensions/index.js
var require_binary_extensions2 = __commonJS({
  "node_modules/binary-extensions/index.js"(exports2, module2) {
    module2.exports = require_binary_extensions();
  }
});

// node_modules/is-binary-path/index.js
var require_is_binary_path = __commonJS({
  "node_modules/is-binary-path/index.js"(exports2, module2) {
    "use strict";
    var path4 = require("path");
    var binaryExtensions = require_binary_extensions2();
    var extensions = new Set(binaryExtensions);
    module2.exports = (filePath) => extensions.has(path4.extname(filePath).slice(1).toLowerCase());
  }
});

// node_modules/chokidar/lib/constants.js
var require_constants3 = __commonJS({
  "node_modules/chokidar/lib/constants.js"(exports2) {
    "use strict";
    var { sep } = require("path");
    var { platform } = process;
    var os = require("os");
    exports2.EV_ALL = "all";
    exports2.EV_READY = "ready";
    exports2.EV_ADD = "add";
    exports2.EV_CHANGE = "change";
    exports2.EV_ADD_DIR = "addDir";
    exports2.EV_UNLINK = "unlink";
    exports2.EV_UNLINK_DIR = "unlinkDir";
    exports2.EV_RAW = "raw";
    exports2.EV_ERROR = "error";
    exports2.STR_DATA = "data";
    exports2.STR_END = "end";
    exports2.STR_CLOSE = "close";
    exports2.FSEVENT_CREATED = "created";
    exports2.FSEVENT_MODIFIED = "modified";
    exports2.FSEVENT_DELETED = "deleted";
    exports2.FSEVENT_MOVED = "moved";
    exports2.FSEVENT_CLONED = "cloned";
    exports2.FSEVENT_UNKNOWN = "unknown";
    exports2.FSEVENT_FLAG_MUST_SCAN_SUBDIRS = 1;
    exports2.FSEVENT_TYPE_FILE = "file";
    exports2.FSEVENT_TYPE_DIRECTORY = "directory";
    exports2.FSEVENT_TYPE_SYMLINK = "symlink";
    exports2.KEY_LISTENERS = "listeners";
    exports2.KEY_ERR = "errHandlers";
    exports2.KEY_RAW = "rawEmitters";
    exports2.HANDLER_KEYS = [exports2.KEY_LISTENERS, exports2.KEY_ERR, exports2.KEY_RAW];
    exports2.DOT_SLASH = `.${sep}`;
    exports2.BACK_SLASH_RE = /\\/g;
    exports2.DOUBLE_SLASH_RE = /\/\//;
    exports2.SLASH_OR_BACK_SLASH_RE = /[/\\]/;
    exports2.DOT_RE = /\..*\.(sw[px])$|~$|\.subl.*\.tmp/;
    exports2.REPLACER_RE = /^\.[/\\]/;
    exports2.SLASH = "/";
    exports2.SLASH_SLASH = "//";
    exports2.BRACE_START = "{";
    exports2.BANG = "!";
    exports2.ONE_DOT = ".";
    exports2.TWO_DOTS = "..";
    exports2.STAR = "*";
    exports2.GLOBSTAR = "**";
    exports2.ROOT_GLOBSTAR = "/**/*";
    exports2.SLASH_GLOBSTAR = "/**";
    exports2.DIR_SUFFIX = "Dir";
    exports2.ANYMATCH_OPTS = { dot: true };
    exports2.STRING_TYPE = "string";
    exports2.FUNCTION_TYPE = "function";
    exports2.EMPTY_STR = "";
    exports2.EMPTY_FN = () => {
    };
    exports2.IDENTITY_FN = (val) => val;
    exports2.isWindows = platform === "win32";
    exports2.isMacos = platform === "darwin";
    exports2.isLinux = platform === "linux";
    exports2.isIBMi = os.type() === "OS400";
  }
});

// node_modules/chokidar/lib/nodefs-handler.js
var require_nodefs_handler = __commonJS({
  "node_modules/chokidar/lib/nodefs-handler.js"(exports2, module2) {
    "use strict";
    var fs4 = require("fs");
    var sysPath = require("path");
    var { promisify } = require("util");
    var isBinaryPath = require_is_binary_path();
    var {
      isWindows,
      isLinux,
      EMPTY_FN,
      EMPTY_STR,
      KEY_LISTENERS,
      KEY_ERR,
      KEY_RAW,
      HANDLER_KEYS,
      EV_CHANGE,
      EV_ADD,
      EV_ADD_DIR,
      EV_ERROR,
      STR_DATA,
      STR_END,
      BRACE_START,
      STAR
    } = require_constants3();
    var THROTTLE_MODE_WATCH = "watch";
    var open = promisify(fs4.open);
    var stat = promisify(fs4.stat);
    var lstat = promisify(fs4.lstat);
    var close = promisify(fs4.close);
    var fsrealpath = promisify(fs4.realpath);
    var statMethods = { lstat, stat };
    var foreach = (val, fn) => {
      if (val instanceof Set) {
        val.forEach(fn);
      } else {
        fn(val);
      }
    };
    var addAndConvert = (main, prop, item) => {
      let container = main[prop];
      if (!(container instanceof Set)) {
        main[prop] = container = /* @__PURE__ */ new Set([container]);
      }
      container.add(item);
    };
    var clearItem = (cont) => (key) => {
      const set = cont[key];
      if (set instanceof Set) {
        set.clear();
      } else {
        delete cont[key];
      }
    };
    var delFromSet = (main, prop, item) => {
      const container = main[prop];
      if (container instanceof Set) {
        container.delete(item);
      } else if (container === item) {
        delete main[prop];
      }
    };
    var isEmptySet = (val) => val instanceof Set ? val.size === 0 : !val;
    var FsWatchInstances = /* @__PURE__ */ new Map();
    function createFsWatchInstance(path4, options, listener, errHandler, emitRaw) {
      const handleEvent = (rawEvent, evPath) => {
        listener(path4);
        emitRaw(rawEvent, evPath, { watchedPath: path4 });
        if (evPath && path4 !== evPath) {
          fsWatchBroadcast(
            sysPath.resolve(path4, evPath),
            KEY_LISTENERS,
            sysPath.join(path4, evPath)
          );
        }
      };
      try {
        return fs4.watch(path4, options, handleEvent);
      } catch (error) {
        errHandler(error);
      }
    }
    var fsWatchBroadcast = (fullPath, type, val1, val2, val3) => {
      const cont = FsWatchInstances.get(fullPath);
      if (!cont) return;
      foreach(cont[type], (listener) => {
        listener(val1, val2, val3);
      });
    };
    var setFsWatchListener = (path4, fullPath, options, handlers) => {
      const { listener, errHandler, rawEmitter } = handlers;
      let cont = FsWatchInstances.get(fullPath);
      let watcher;
      if (!options.persistent) {
        watcher = createFsWatchInstance(
          path4,
          options,
          listener,
          errHandler,
          rawEmitter
        );
        return watcher.close.bind(watcher);
      }
      if (cont) {
        addAndConvert(cont, KEY_LISTENERS, listener);
        addAndConvert(cont, KEY_ERR, errHandler);
        addAndConvert(cont, KEY_RAW, rawEmitter);
      } else {
        watcher = createFsWatchInstance(
          path4,
          options,
          fsWatchBroadcast.bind(null, fullPath, KEY_LISTENERS),
          errHandler,
          // no need to use broadcast here
          fsWatchBroadcast.bind(null, fullPath, KEY_RAW)
        );
        if (!watcher) return;
        watcher.on(EV_ERROR, async (error) => {
          const broadcastErr = fsWatchBroadcast.bind(null, fullPath, KEY_ERR);
          cont.watcherUnusable = true;
          if (isWindows && error.code === "EPERM") {
            try {
              const fd = await open(path4, "r");
              await close(fd);
              broadcastErr(error);
            } catch (err) {
            }
          } else {
            broadcastErr(error);
          }
        });
        cont = {
          listeners: listener,
          errHandlers: errHandler,
          rawEmitters: rawEmitter,
          watcher
        };
        FsWatchInstances.set(fullPath, cont);
      }
      return () => {
        delFromSet(cont, KEY_LISTENERS, listener);
        delFromSet(cont, KEY_ERR, errHandler);
        delFromSet(cont, KEY_RAW, rawEmitter);
        if (isEmptySet(cont.listeners)) {
          cont.watcher.close();
          FsWatchInstances.delete(fullPath);
          HANDLER_KEYS.forEach(clearItem(cont));
          cont.watcher = void 0;
          Object.freeze(cont);
        }
      };
    };
    var FsWatchFileInstances = /* @__PURE__ */ new Map();
    var setFsWatchFileListener = (path4, fullPath, options, handlers) => {
      const { listener, rawEmitter } = handlers;
      let cont = FsWatchFileInstances.get(fullPath);
      let listeners = /* @__PURE__ */ new Set();
      let rawEmitters = /* @__PURE__ */ new Set();
      const copts = cont && cont.options;
      if (copts && (copts.persistent < options.persistent || copts.interval > options.interval)) {
        listeners = cont.listeners;
        rawEmitters = cont.rawEmitters;
        fs4.unwatchFile(fullPath);
        cont = void 0;
      }
      if (cont) {
        addAndConvert(cont, KEY_LISTENERS, listener);
        addAndConvert(cont, KEY_RAW, rawEmitter);
      } else {
        cont = {
          listeners: listener,
          rawEmitters: rawEmitter,
          options,
          watcher: fs4.watchFile(fullPath, options, (curr, prev) => {
            foreach(cont.rawEmitters, (rawEmitter2) => {
              rawEmitter2(EV_CHANGE, fullPath, { curr, prev });
            });
            const currmtime = curr.mtimeMs;
            if (curr.size !== prev.size || currmtime > prev.mtimeMs || currmtime === 0) {
              foreach(cont.listeners, (listener2) => listener2(path4, curr));
            }
          })
        };
        FsWatchFileInstances.set(fullPath, cont);
      }
      return () => {
        delFromSet(cont, KEY_LISTENERS, listener);
        delFromSet(cont, KEY_RAW, rawEmitter);
        if (isEmptySet(cont.listeners)) {
          FsWatchFileInstances.delete(fullPath);
          fs4.unwatchFile(fullPath);
          cont.options = cont.watcher = void 0;
          Object.freeze(cont);
        }
      };
    };
    var NodeFsHandler = class {
      /**
       * @param {import("../index").FSWatcher} fsW
       */
      constructor(fsW) {
        this.fsw = fsW;
        this._boundHandleError = (error) => fsW._handleError(error);
      }
      /**
       * Watch file for changes with fs_watchFile or fs_watch.
       * @param {String} path to file or dir
       * @param {Function} listener on fs change
       * @returns {Function} closer for the watcher instance
       */
      _watchWithNodeFs(path4, listener) {
        const opts = this.fsw.options;
        const directory = sysPath.dirname(path4);
        const basename3 = sysPath.basename(path4);
        const parent = this.fsw._getWatchedDir(directory);
        parent.add(basename3);
        const absolutePath = sysPath.resolve(path4);
        const options = { persistent: opts.persistent };
        if (!listener) listener = EMPTY_FN;
        let closer;
        if (opts.usePolling) {
          options.interval = opts.enableBinaryInterval && isBinaryPath(basename3) ? opts.binaryInterval : opts.interval;
          closer = setFsWatchFileListener(path4, absolutePath, options, {
            listener,
            rawEmitter: this.fsw._emitRaw
          });
        } else {
          closer = setFsWatchListener(path4, absolutePath, options, {
            listener,
            errHandler: this._boundHandleError,
            rawEmitter: this.fsw._emitRaw
          });
        }
        return closer;
      }
      /**
       * Watch a file and emit add event if warranted.
       * @param {Path} file Path
       * @param {fs.Stats} stats result of fs_stat
       * @param {Boolean} initialAdd was the file added at watch instantiation?
       * @returns {Function} closer for the watcher instance
       */
      _handleFile(file, stats, initialAdd) {
        if (this.fsw.closed) {
          return;
        }
        const dirname2 = sysPath.dirname(file);
        const basename3 = sysPath.basename(file);
        const parent = this.fsw._getWatchedDir(dirname2);
        let prevStats = stats;
        if (parent.has(basename3)) return;
        const listener = async (path4, newStats) => {
          if (!this.fsw._throttle(THROTTLE_MODE_WATCH, file, 5)) return;
          if (!newStats || newStats.mtimeMs === 0) {
            try {
              const newStats2 = await stat(file);
              if (this.fsw.closed) return;
              const at = newStats2.atimeMs;
              const mt = newStats2.mtimeMs;
              if (!at || at <= mt || mt !== prevStats.mtimeMs) {
                this.fsw._emit(EV_CHANGE, file, newStats2);
              }
              if (isLinux && prevStats.ino !== newStats2.ino) {
                this.fsw._closeFile(path4);
                prevStats = newStats2;
                this.fsw._addPathCloser(path4, this._watchWithNodeFs(file, listener));
              } else {
                prevStats = newStats2;
              }
            } catch (error) {
              this.fsw._remove(dirname2, basename3);
            }
          } else if (parent.has(basename3)) {
            const at = newStats.atimeMs;
            const mt = newStats.mtimeMs;
            if (!at || at <= mt || mt !== prevStats.mtimeMs) {
              this.fsw._emit(EV_CHANGE, file, newStats);
            }
            prevStats = newStats;
          }
        };
        const closer = this._watchWithNodeFs(file, listener);
        if (!(initialAdd && this.fsw.options.ignoreInitial) && this.fsw._isntIgnored(file)) {
          if (!this.fsw._throttle(EV_ADD, file, 0)) return;
          this.fsw._emit(EV_ADD, file, stats);
        }
        return closer;
      }
      /**
       * Handle symlinks encountered while reading a dir.
       * @param {Object} entry returned by readdirp
       * @param {String} directory path of dir being read
       * @param {String} path of this item
       * @param {String} item basename of this item
       * @returns {Promise<Boolean>} true if no more processing is needed for this entry.
       */
      async _handleSymlink(entry, directory, path4, item) {
        if (this.fsw.closed) {
          return;
        }
        const full = entry.fullPath;
        const dir = this.fsw._getWatchedDir(directory);
        if (!this.fsw.options.followSymlinks) {
          this.fsw._incrReadyCount();
          let linkPath;
          try {
            linkPath = await fsrealpath(path4);
          } catch (e) {
            this.fsw._emitReady();
            return true;
          }
          if (this.fsw.closed) return;
          if (dir.has(item)) {
            if (this.fsw._symlinkPaths.get(full) !== linkPath) {
              this.fsw._symlinkPaths.set(full, linkPath);
              this.fsw._emit(EV_CHANGE, path4, entry.stats);
            }
          } else {
            dir.add(item);
            this.fsw._symlinkPaths.set(full, linkPath);
            this.fsw._emit(EV_ADD, path4, entry.stats);
          }
          this.fsw._emitReady();
          return true;
        }
        if (this.fsw._symlinkPaths.has(full)) {
          return true;
        }
        this.fsw._symlinkPaths.set(full, true);
      }
      _handleRead(directory, initialAdd, wh, target, dir, depth, throttler) {
        directory = sysPath.join(directory, EMPTY_STR);
        if (!wh.hasGlob) {
          throttler = this.fsw._throttle("readdir", directory, 1e3);
          if (!throttler) return;
        }
        const previous = this.fsw._getWatchedDir(wh.path);
        const current = /* @__PURE__ */ new Set();
        let stream = this.fsw._readdirp(directory, {
          fileFilter: (entry) => wh.filterPath(entry),
          directoryFilter: (entry) => wh.filterDir(entry),
          depth: 0
        }).on(STR_DATA, async (entry) => {
          if (this.fsw.closed) {
            stream = void 0;
            return;
          }
          const item = entry.path;
          let path4 = sysPath.join(directory, item);
          current.add(item);
          if (entry.stats.isSymbolicLink() && await this._handleSymlink(entry, directory, path4, item)) {
            return;
          }
          if (this.fsw.closed) {
            stream = void 0;
            return;
          }
          if (item === target || !target && !previous.has(item)) {
            this.fsw._incrReadyCount();
            path4 = sysPath.join(dir, sysPath.relative(dir, path4));
            this._addToNodeFs(path4, initialAdd, wh, depth + 1);
          }
        }).on(EV_ERROR, this._boundHandleError);
        return new Promise(
          (resolve) => stream.once(STR_END, () => {
            if (this.fsw.closed) {
              stream = void 0;
              return;
            }
            const wasThrottled = throttler ? throttler.clear() : false;
            resolve();
            previous.getChildren().filter((item) => {
              return item !== directory && !current.has(item) && // in case of intersecting globs;
              // a path may have been filtered out of this readdir, but
              // shouldn't be removed because it matches a different glob
              (!wh.hasGlob || wh.filterPath({
                fullPath: sysPath.resolve(directory, item)
              }));
            }).forEach((item) => {
              this.fsw._remove(directory, item);
            });
            stream = void 0;
            if (wasThrottled) this._handleRead(directory, false, wh, target, dir, depth, throttler);
          })
        );
      }
      /**
       * Read directory to add / remove files from `@watched` list and re-read it on change.
       * @param {String} dir fs path
       * @param {fs.Stats} stats
       * @param {Boolean} initialAdd
       * @param {Number} depth relative to user-supplied path
       * @param {String} target child path targeted for watch
       * @param {Object} wh Common watch helpers for this path
       * @param {String} realpath
       * @returns {Promise<Function>} closer for the watcher instance.
       */
      async _handleDir(dir, stats, initialAdd, depth, target, wh, realpath) {
        const parentDir = this.fsw._getWatchedDir(sysPath.dirname(dir));
        const tracked = parentDir.has(sysPath.basename(dir));
        if (!(initialAdd && this.fsw.options.ignoreInitial) && !target && !tracked) {
          if (!wh.hasGlob || wh.globFilter(dir)) this.fsw._emit(EV_ADD_DIR, dir, stats);
        }
        parentDir.add(sysPath.basename(dir));
        this.fsw._getWatchedDir(dir);
        let throttler;
        let closer;
        const oDepth = this.fsw.options.depth;
        if ((oDepth == null || depth <= oDepth) && !this.fsw._symlinkPaths.has(realpath)) {
          if (!target) {
            await this._handleRead(dir, initialAdd, wh, target, dir, depth, throttler);
            if (this.fsw.closed) return;
          }
          closer = this._watchWithNodeFs(dir, (dirPath, stats2) => {
            if (stats2 && stats2.mtimeMs === 0) return;
            this._handleRead(dirPath, false, wh, target, dir, depth, throttler);
          });
        }
        return closer;
      }
      /**
       * Handle added file, directory, or glob pattern.
       * Delegates call to _handleFile / _handleDir after checks.
       * @param {String} path to file or ir
       * @param {Boolean} initialAdd was the file added at watch instantiation?
       * @param {Object} priorWh depth relative to user-supplied path
       * @param {Number} depth Child path actually targeted for watch
       * @param {String=} target Child path actually targeted for watch
       * @returns {Promise}
       */
      async _addToNodeFs(path4, initialAdd, priorWh, depth, target) {
        const ready = this.fsw._emitReady;
        if (this.fsw._isIgnored(path4) || this.fsw.closed) {
          ready();
          return false;
        }
        const wh = this.fsw._getWatchHelpers(path4, depth);
        if (!wh.hasGlob && priorWh) {
          wh.hasGlob = priorWh.hasGlob;
          wh.globFilter = priorWh.globFilter;
          wh.filterPath = (entry) => priorWh.filterPath(entry);
          wh.filterDir = (entry) => priorWh.filterDir(entry);
        }
        try {
          const stats = await statMethods[wh.statMethod](wh.watchPath);
          if (this.fsw.closed) return;
          if (this.fsw._isIgnored(wh.watchPath, stats)) {
            ready();
            return false;
          }
          const follow = this.fsw.options.followSymlinks && !path4.includes(STAR) && !path4.includes(BRACE_START);
          let closer;
          if (stats.isDirectory()) {
            const absPath = sysPath.resolve(path4);
            const targetPath = follow ? await fsrealpath(path4) : path4;
            if (this.fsw.closed) return;
            closer = await this._handleDir(wh.watchPath, stats, initialAdd, depth, target, wh, targetPath);
            if (this.fsw.closed) return;
            if (absPath !== targetPath && targetPath !== void 0) {
              this.fsw._symlinkPaths.set(absPath, targetPath);
            }
          } else if (stats.isSymbolicLink()) {
            const targetPath = follow ? await fsrealpath(path4) : path4;
            if (this.fsw.closed) return;
            const parent = sysPath.dirname(wh.watchPath);
            this.fsw._getWatchedDir(parent).add(wh.watchPath);
            this.fsw._emit(EV_ADD, wh.watchPath, stats);
            closer = await this._handleDir(parent, stats, initialAdd, depth, path4, wh, targetPath);
            if (this.fsw.closed) return;
            if (targetPath !== void 0) {
              this.fsw._symlinkPaths.set(sysPath.resolve(path4), targetPath);
            }
          } else {
            closer = this._handleFile(wh.watchPath, stats, initialAdd);
          }
          ready();
          this.fsw._addPathCloser(path4, closer);
          return false;
        } catch (error) {
          if (this.fsw._handleError(error)) {
            ready();
            return path4;
          }
        }
      }
    };
    module2.exports = NodeFsHandler;
  }
});

// node_modules/chokidar/lib/fsevents-handler.js
var require_fsevents_handler = __commonJS({
  "node_modules/chokidar/lib/fsevents-handler.js"(exports2, module2) {
    "use strict";
    var fs4 = require("fs");
    var sysPath = require("path");
    var { promisify } = require("util");
    var fsevents;
    try {
      fsevents = require("fsevents");
    } catch (error) {
      if (process.env.CHOKIDAR_PRINT_FSEVENTS_REQUIRE_ERROR) console.error(error);
    }
    if (fsevents) {
      const mtch = process.version.match(/v(\d+)\.(\d+)/);
      if (mtch && mtch[1] && mtch[2]) {
        const maj = Number.parseInt(mtch[1], 10);
        const min = Number.parseInt(mtch[2], 10);
        if (maj === 8 && min < 16) {
          fsevents = void 0;
        }
      }
    }
    var {
      EV_ADD,
      EV_CHANGE,
      EV_ADD_DIR,
      EV_UNLINK,
      EV_ERROR,
      STR_DATA,
      STR_END,
      FSEVENT_CREATED,
      FSEVENT_MODIFIED,
      FSEVENT_DELETED,
      FSEVENT_MOVED,
      // FSEVENT_CLONED,
      FSEVENT_UNKNOWN,
      FSEVENT_FLAG_MUST_SCAN_SUBDIRS,
      FSEVENT_TYPE_FILE,
      FSEVENT_TYPE_DIRECTORY,
      FSEVENT_TYPE_SYMLINK,
      ROOT_GLOBSTAR,
      DIR_SUFFIX,
      DOT_SLASH,
      FUNCTION_TYPE,
      EMPTY_FN,
      IDENTITY_FN
    } = require_constants3();
    var Depth = (value) => isNaN(value) ? {} : { depth: value };
    var stat = promisify(fs4.stat);
    var lstat = promisify(fs4.lstat);
    var realpath = promisify(fs4.realpath);
    var statMethods = { stat, lstat };
    var FSEventsWatchers = /* @__PURE__ */ new Map();
    var consolidateThreshhold = 10;
    var wrongEventFlags = /* @__PURE__ */ new Set([
      69888,
      70400,
      71424,
      72704,
      73472,
      131328,
      131840,
      262912
    ]);
    var createFSEventsInstance = (path4, callback) => {
      const stop = fsevents.watch(path4, callback);
      return { stop };
    };
    function setFSEventsListener(path4, realPath, listener, rawEmitter) {
      let watchPath = sysPath.extname(realPath) ? sysPath.dirname(realPath) : realPath;
      const parentPath = sysPath.dirname(watchPath);
      let cont = FSEventsWatchers.get(watchPath);
      if (couldConsolidate(parentPath)) {
        watchPath = parentPath;
      }
      const resolvedPath = sysPath.resolve(path4);
      const hasSymlink = resolvedPath !== realPath;
      const filteredListener = (fullPath, flags, info) => {
        if (hasSymlink) fullPath = fullPath.replace(realPath, resolvedPath);
        if (fullPath === resolvedPath || !fullPath.indexOf(resolvedPath + sysPath.sep)) listener(fullPath, flags, info);
      };
      let watchedParent = false;
      for (const watchedPath of FSEventsWatchers.keys()) {
        if (realPath.indexOf(sysPath.resolve(watchedPath) + sysPath.sep) === 0) {
          watchPath = watchedPath;
          cont = FSEventsWatchers.get(watchPath);
          watchedParent = true;
          break;
        }
      }
      if (cont || watchedParent) {
        cont.listeners.add(filteredListener);
      } else {
        cont = {
          listeners: /* @__PURE__ */ new Set([filteredListener]),
          rawEmitter,
          watcher: createFSEventsInstance(watchPath, (fullPath, flags) => {
            if (!cont.listeners.size) return;
            if (flags & FSEVENT_FLAG_MUST_SCAN_SUBDIRS) return;
            const info = fsevents.getInfo(fullPath, flags);
            cont.listeners.forEach((list) => {
              list(fullPath, flags, info);
            });
            cont.rawEmitter(info.event, fullPath, info);
          })
        };
        FSEventsWatchers.set(watchPath, cont);
      }
      return () => {
        const lst = cont.listeners;
        lst.delete(filteredListener);
        if (!lst.size) {
          FSEventsWatchers.delete(watchPath);
          if (cont.watcher) return cont.watcher.stop().then(() => {
            cont.rawEmitter = cont.watcher = void 0;
            Object.freeze(cont);
          });
        }
      };
    }
    var couldConsolidate = (path4) => {
      let count = 0;
      for (const watchPath of FSEventsWatchers.keys()) {
        if (watchPath.indexOf(path4) === 0) {
          count++;
          if (count >= consolidateThreshhold) {
            return true;
          }
        }
      }
      return false;
    };
    var canUse = () => fsevents && FSEventsWatchers.size < 128;
    var calcDepth = (path4, root) => {
      let i = 0;
      while (!path4.indexOf(root) && (path4 = sysPath.dirname(path4)) !== root) i++;
      return i;
    };
    var sameTypes = (info, stats) => info.type === FSEVENT_TYPE_DIRECTORY && stats.isDirectory() || info.type === FSEVENT_TYPE_SYMLINK && stats.isSymbolicLink() || info.type === FSEVENT_TYPE_FILE && stats.isFile();
    var FsEventsHandler = class {
      /**
       * @param {import('../index').FSWatcher} fsw
       */
      constructor(fsw) {
        this.fsw = fsw;
      }
      checkIgnored(path4, stats) {
        const ipaths = this.fsw._ignoredPaths;
        if (this.fsw._isIgnored(path4, stats)) {
          ipaths.add(path4);
          if (stats && stats.isDirectory()) {
            ipaths.add(path4 + ROOT_GLOBSTAR);
          }
          return true;
        }
        ipaths.delete(path4);
        ipaths.delete(path4 + ROOT_GLOBSTAR);
      }
      addOrChange(path4, fullPath, realPath, parent, watchedDir, item, info, opts) {
        const event = watchedDir.has(item) ? EV_CHANGE : EV_ADD;
        this.handleEvent(event, path4, fullPath, realPath, parent, watchedDir, item, info, opts);
      }
      async checkExists(path4, fullPath, realPath, parent, watchedDir, item, info, opts) {
        try {
          const stats = await stat(path4);
          if (this.fsw.closed) return;
          if (sameTypes(info, stats)) {
            this.addOrChange(path4, fullPath, realPath, parent, watchedDir, item, info, opts);
          } else {
            this.handleEvent(EV_UNLINK, path4, fullPath, realPath, parent, watchedDir, item, info, opts);
          }
        } catch (error) {
          if (error.code === "EACCES") {
            this.addOrChange(path4, fullPath, realPath, parent, watchedDir, item, info, opts);
          } else {
            this.handleEvent(EV_UNLINK, path4, fullPath, realPath, parent, watchedDir, item, info, opts);
          }
        }
      }
      handleEvent(event, path4, fullPath, realPath, parent, watchedDir, item, info, opts) {
        if (this.fsw.closed || this.checkIgnored(path4)) return;
        if (event === EV_UNLINK) {
          const isDirectory = info.type === FSEVENT_TYPE_DIRECTORY;
          if (isDirectory || watchedDir.has(item)) {
            this.fsw._remove(parent, item, isDirectory);
          }
        } else {
          if (event === EV_ADD) {
            if (info.type === FSEVENT_TYPE_DIRECTORY) this.fsw._getWatchedDir(path4);
            if (info.type === FSEVENT_TYPE_SYMLINK && opts.followSymlinks) {
              const curDepth = opts.depth === void 0 ? void 0 : calcDepth(fullPath, realPath) + 1;
              return this._addToFsEvents(path4, false, true, curDepth);
            }
            this.fsw._getWatchedDir(parent).add(item);
          }
          const eventName = info.type === FSEVENT_TYPE_DIRECTORY ? event + DIR_SUFFIX : event;
          this.fsw._emit(eventName, path4);
          if (eventName === EV_ADD_DIR) this._addToFsEvents(path4, false, true);
        }
      }
      /**
       * Handle symlinks encountered during directory scan
       * @param {String} watchPath  - file/dir path to be watched with fsevents
       * @param {String} realPath   - real path (in case of symlinks)
       * @param {Function} transform  - path transformer
       * @param {Function} globFilter - path filter in case a glob pattern was provided
       * @returns {Function} closer for the watcher instance
      */
      _watchWithFsEvents(watchPath, realPath, transform, globFilter) {
        if (this.fsw.closed || this.fsw._isIgnored(watchPath)) return;
        const opts = this.fsw.options;
        const watchCallback = async (fullPath, flags, info) => {
          if (this.fsw.closed) return;
          if (opts.depth !== void 0 && calcDepth(fullPath, realPath) > opts.depth) return;
          const path4 = transform(sysPath.join(
            watchPath,
            sysPath.relative(watchPath, fullPath)
          ));
          if (globFilter && !globFilter(path4)) return;
          const parent = sysPath.dirname(path4);
          const item = sysPath.basename(path4);
          const watchedDir = this.fsw._getWatchedDir(
            info.type === FSEVENT_TYPE_DIRECTORY ? path4 : parent
          );
          if (wrongEventFlags.has(flags) || info.event === FSEVENT_UNKNOWN) {
            if (typeof opts.ignored === FUNCTION_TYPE) {
              let stats;
              try {
                stats = await stat(path4);
              } catch (error) {
              }
              if (this.fsw.closed) return;
              if (this.checkIgnored(path4, stats)) return;
              if (sameTypes(info, stats)) {
                this.addOrChange(path4, fullPath, realPath, parent, watchedDir, item, info, opts);
              } else {
                this.handleEvent(EV_UNLINK, path4, fullPath, realPath, parent, watchedDir, item, info, opts);
              }
            } else {
              this.checkExists(path4, fullPath, realPath, parent, watchedDir, item, info, opts);
            }
          } else {
            switch (info.event) {
              case FSEVENT_CREATED:
              case FSEVENT_MODIFIED:
                return this.addOrChange(path4, fullPath, realPath, parent, watchedDir, item, info, opts);
              case FSEVENT_DELETED:
              case FSEVENT_MOVED:
                return this.checkExists(path4, fullPath, realPath, parent, watchedDir, item, info, opts);
            }
          }
        };
        const closer = setFSEventsListener(
          watchPath,
          realPath,
          watchCallback,
          this.fsw._emitRaw
        );
        this.fsw._emitReady();
        return closer;
      }
      /**
       * Handle symlinks encountered during directory scan
       * @param {String} linkPath path to symlink
       * @param {String} fullPath absolute path to the symlink
       * @param {Function} transform pre-existing path transformer
       * @param {Number} curDepth level of subdirectories traversed to where symlink is
       * @returns {Promise<void>}
       */
      async _handleFsEventsSymlink(linkPath, fullPath, transform, curDepth) {
        if (this.fsw.closed || this.fsw._symlinkPaths.has(fullPath)) return;
        this.fsw._symlinkPaths.set(fullPath, true);
        this.fsw._incrReadyCount();
        try {
          const linkTarget = await realpath(linkPath);
          if (this.fsw.closed) return;
          if (this.fsw._isIgnored(linkTarget)) {
            return this.fsw._emitReady();
          }
          this.fsw._incrReadyCount();
          this._addToFsEvents(linkTarget || linkPath, (path4) => {
            let aliasedPath = linkPath;
            if (linkTarget && linkTarget !== DOT_SLASH) {
              aliasedPath = path4.replace(linkTarget, linkPath);
            } else if (path4 !== DOT_SLASH) {
              aliasedPath = sysPath.join(linkPath, path4);
            }
            return transform(aliasedPath);
          }, false, curDepth);
        } catch (error) {
          if (this.fsw._handleError(error)) {
            return this.fsw._emitReady();
          }
        }
      }
      /**
       *
       * @param {Path} newPath
       * @param {fs.Stats} stats
       */
      emitAdd(newPath, stats, processPath, opts, forceAdd) {
        const pp = processPath(newPath);
        const isDir = stats.isDirectory();
        const dirObj = this.fsw._getWatchedDir(sysPath.dirname(pp));
        const base = sysPath.basename(pp);
        if (isDir) this.fsw._getWatchedDir(pp);
        if (dirObj.has(base)) return;
        dirObj.add(base);
        if (!opts.ignoreInitial || forceAdd === true) {
          this.fsw._emit(isDir ? EV_ADD_DIR : EV_ADD, pp, stats);
        }
      }
      initWatch(realPath, path4, wh, processPath) {
        if (this.fsw.closed) return;
        const closer = this._watchWithFsEvents(
          wh.watchPath,
          sysPath.resolve(realPath || wh.watchPath),
          processPath,
          wh.globFilter
        );
        this.fsw._addPathCloser(path4, closer);
      }
      /**
       * Handle added path with fsevents
       * @param {String} path file/dir path or glob pattern
       * @param {Function|Boolean=} transform converts working path to what the user expects
       * @param {Boolean=} forceAdd ensure add is emitted
       * @param {Number=} priorDepth Level of subdirectories already traversed.
       * @returns {Promise<void>}
       */
      async _addToFsEvents(path4, transform, forceAdd, priorDepth) {
        if (this.fsw.closed) {
          return;
        }
        const opts = this.fsw.options;
        const processPath = typeof transform === FUNCTION_TYPE ? transform : IDENTITY_FN;
        const wh = this.fsw._getWatchHelpers(path4);
        try {
          const stats = await statMethods[wh.statMethod](wh.watchPath);
          if (this.fsw.closed) return;
          if (this.fsw._isIgnored(wh.watchPath, stats)) {
            throw null;
          }
          if (stats.isDirectory()) {
            if (!wh.globFilter) this.emitAdd(processPath(path4), stats, processPath, opts, forceAdd);
            if (priorDepth && priorDepth > opts.depth) return;
            this.fsw._readdirp(wh.watchPath, {
              fileFilter: (entry) => wh.filterPath(entry),
              directoryFilter: (entry) => wh.filterDir(entry),
              ...Depth(opts.depth - (priorDepth || 0))
            }).on(STR_DATA, (entry) => {
              if (this.fsw.closed) {
                return;
              }
              if (entry.stats.isDirectory() && !wh.filterPath(entry)) return;
              const joinedPath = sysPath.join(wh.watchPath, entry.path);
              const { fullPath } = entry;
              if (wh.followSymlinks && entry.stats.isSymbolicLink()) {
                const curDepth = opts.depth === void 0 ? void 0 : calcDepth(joinedPath, sysPath.resolve(wh.watchPath)) + 1;
                this._handleFsEventsSymlink(joinedPath, fullPath, processPath, curDepth);
              } else {
                this.emitAdd(joinedPath, entry.stats, processPath, opts, forceAdd);
              }
            }).on(EV_ERROR, EMPTY_FN).on(STR_END, () => {
              this.fsw._emitReady();
            });
          } else {
            this.emitAdd(wh.watchPath, stats, processPath, opts, forceAdd);
            this.fsw._emitReady();
          }
        } catch (error) {
          if (!error || this.fsw._handleError(error)) {
            this.fsw._emitReady();
            this.fsw._emitReady();
          }
        }
        if (opts.persistent && forceAdd !== true) {
          if (typeof transform === FUNCTION_TYPE) {
            this.initWatch(void 0, path4, wh, processPath);
          } else {
            let realPath;
            try {
              realPath = await realpath(wh.watchPath);
            } catch (e) {
            }
            this.initWatch(realPath, path4, wh, processPath);
          }
        }
      }
    };
    module2.exports = FsEventsHandler;
    module2.exports.canUse = canUse;
  }
});

// node_modules/chokidar/index.js
var require_chokidar = __commonJS({
  "node_modules/chokidar/index.js"(exports2) {
    "use strict";
    var { EventEmitter: EventEmitter2 } = require("events");
    var fs4 = require("fs");
    var sysPath = require("path");
    var { promisify } = require("util");
    var readdirp = require_readdirp();
    var anymatch = require_anymatch().default;
    var globParent = require_glob_parent();
    var isGlob = require_is_glob();
    var braces = require_braces();
    var normalizePath = require_normalize_path();
    var NodeFsHandler = require_nodefs_handler();
    var FsEventsHandler = require_fsevents_handler();
    var {
      EV_ALL,
      EV_READY,
      EV_ADD,
      EV_CHANGE,
      EV_UNLINK,
      EV_ADD_DIR,
      EV_UNLINK_DIR,
      EV_RAW,
      EV_ERROR,
      STR_CLOSE,
      STR_END,
      BACK_SLASH_RE,
      DOUBLE_SLASH_RE,
      SLASH_OR_BACK_SLASH_RE,
      DOT_RE,
      REPLACER_RE,
      SLASH,
      SLASH_SLASH,
      BRACE_START,
      BANG,
      ONE_DOT,
      TWO_DOTS,
      GLOBSTAR,
      SLASH_GLOBSTAR,
      ANYMATCH_OPTS,
      STRING_TYPE,
      FUNCTION_TYPE,
      EMPTY_STR,
      EMPTY_FN,
      isWindows,
      isMacos,
      isIBMi
    } = require_constants3();
    var stat = promisify(fs4.stat);
    var readdir = promisify(fs4.readdir);
    var arrify = (value = []) => Array.isArray(value) ? value : [value];
    var flatten = (list, result = []) => {
      list.forEach((item) => {
        if (Array.isArray(item)) {
          flatten(item, result);
        } else {
          result.push(item);
        }
      });
      return result;
    };
    var unifyPaths = (paths_) => {
      const paths = flatten(arrify(paths_));
      if (!paths.every((p) => typeof p === STRING_TYPE)) {
        throw new TypeError(`Non-string provided as watch path: ${paths}`);
      }
      return paths.map(normalizePathToUnix);
    };
    var toUnix = (string) => {
      let str = string.replace(BACK_SLASH_RE, SLASH);
      let prepend = false;
      if (str.startsWith(SLASH_SLASH)) {
        prepend = true;
      }
      while (str.match(DOUBLE_SLASH_RE)) {
        str = str.replace(DOUBLE_SLASH_RE, SLASH);
      }
      if (prepend) {
        str = SLASH + str;
      }
      return str;
    };
    var normalizePathToUnix = (path4) => toUnix(sysPath.normalize(toUnix(path4)));
    var normalizeIgnored = (cwd = EMPTY_STR) => (path4) => {
      if (typeof path4 !== STRING_TYPE) return path4;
      return normalizePathToUnix(sysPath.isAbsolute(path4) ? path4 : sysPath.join(cwd, path4));
    };
    var getAbsolutePath = (path4, cwd) => {
      if (sysPath.isAbsolute(path4)) {
        return path4;
      }
      if (path4.startsWith(BANG)) {
        return BANG + sysPath.join(cwd, path4.slice(1));
      }
      return sysPath.join(cwd, path4);
    };
    var undef = (opts, key) => opts[key] === void 0;
    var DirEntry = class {
      /**
       * @param {Path} dir
       * @param {Function} removeWatcher
       */
      constructor(dir, removeWatcher) {
        this.path = dir;
        this._removeWatcher = removeWatcher;
        this.items = /* @__PURE__ */ new Set();
      }
      add(item) {
        const { items } = this;
        if (!items) return;
        if (item !== ONE_DOT && item !== TWO_DOTS) items.add(item);
      }
      async remove(item) {
        const { items } = this;
        if (!items) return;
        items.delete(item);
        if (items.size > 0) return;
        const dir = this.path;
        try {
          await readdir(dir);
        } catch (err) {
          if (this._removeWatcher) {
            this._removeWatcher(sysPath.dirname(dir), sysPath.basename(dir));
          }
        }
      }
      has(item) {
        const { items } = this;
        if (!items) return;
        return items.has(item);
      }
      /**
       * @returns {Array<String>}
       */
      getChildren() {
        const { items } = this;
        if (!items) return;
        return [...items.values()];
      }
      dispose() {
        this.items.clear();
        delete this.path;
        delete this._removeWatcher;
        delete this.items;
        Object.freeze(this);
      }
    };
    var STAT_METHOD_F = "stat";
    var STAT_METHOD_L = "lstat";
    var WatchHelper = class {
      constructor(path4, watchPath, follow, fsw) {
        this.fsw = fsw;
        this.path = path4 = path4.replace(REPLACER_RE, EMPTY_STR);
        this.watchPath = watchPath;
        this.fullWatchPath = sysPath.resolve(watchPath);
        this.hasGlob = watchPath !== path4;
        if (path4 === EMPTY_STR) this.hasGlob = false;
        this.globSymlink = this.hasGlob && follow ? void 0 : false;
        this.globFilter = this.hasGlob ? anymatch(path4, void 0, ANYMATCH_OPTS) : false;
        this.dirParts = this.getDirParts(path4);
        this.dirParts.forEach((parts) => {
          if (parts.length > 1) parts.pop();
        });
        this.followSymlinks = follow;
        this.statMethod = follow ? STAT_METHOD_F : STAT_METHOD_L;
      }
      checkGlobSymlink(entry) {
        if (this.globSymlink === void 0) {
          this.globSymlink = entry.fullParentDir === this.fullWatchPath ? false : { realPath: entry.fullParentDir, linkPath: this.fullWatchPath };
        }
        if (this.globSymlink) {
          return entry.fullPath.replace(this.globSymlink.realPath, this.globSymlink.linkPath);
        }
        return entry.fullPath;
      }
      entryPath(entry) {
        return sysPath.join(
          this.watchPath,
          sysPath.relative(this.watchPath, this.checkGlobSymlink(entry))
        );
      }
      filterPath(entry) {
        const { stats } = entry;
        if (stats && stats.isSymbolicLink()) return this.filterDir(entry);
        const resolvedPath = this.entryPath(entry);
        const matchesGlob = this.hasGlob && typeof this.globFilter === FUNCTION_TYPE ? this.globFilter(resolvedPath) : true;
        return matchesGlob && this.fsw._isntIgnored(resolvedPath, stats) && this.fsw._hasReadPermissions(stats);
      }
      getDirParts(path4) {
        if (!this.hasGlob) return [];
        const parts = [];
        const expandedPath = path4.includes(BRACE_START) ? braces.expand(path4) : [path4];
        expandedPath.forEach((path5) => {
          parts.push(sysPath.relative(this.watchPath, path5).split(SLASH_OR_BACK_SLASH_RE));
        });
        return parts;
      }
      filterDir(entry) {
        if (this.hasGlob) {
          const entryParts = this.getDirParts(this.checkGlobSymlink(entry));
          let globstar = false;
          this.unmatchedGlob = !this.dirParts.some((parts) => {
            return parts.every((part, i) => {
              if (part === GLOBSTAR) globstar = true;
              return globstar || !entryParts[0][i] || anymatch(part, entryParts[0][i], ANYMATCH_OPTS);
            });
          });
        }
        return !this.unmatchedGlob && this.fsw._isntIgnored(this.entryPath(entry), entry.stats);
      }
    };
    var FSWatcher = class extends EventEmitter2 {
      // Not indenting methods for history sake; for now.
      constructor(_opts) {
        super();
        const opts = {};
        if (_opts) Object.assign(opts, _opts);
        this._watched = /* @__PURE__ */ new Map();
        this._closers = /* @__PURE__ */ new Map();
        this._ignoredPaths = /* @__PURE__ */ new Set();
        this._throttled = /* @__PURE__ */ new Map();
        this._symlinkPaths = /* @__PURE__ */ new Map();
        this._streams = /* @__PURE__ */ new Set();
        this.closed = false;
        if (undef(opts, "persistent")) opts.persistent = true;
        if (undef(opts, "ignoreInitial")) opts.ignoreInitial = false;
        if (undef(opts, "ignorePermissionErrors")) opts.ignorePermissionErrors = false;
        if (undef(opts, "interval")) opts.interval = 100;
        if (undef(opts, "binaryInterval")) opts.binaryInterval = 300;
        if (undef(opts, "disableGlobbing")) opts.disableGlobbing = false;
        opts.enableBinaryInterval = opts.binaryInterval !== opts.interval;
        if (undef(opts, "useFsEvents")) opts.useFsEvents = !opts.usePolling;
        const canUseFsEvents = FsEventsHandler.canUse();
        if (!canUseFsEvents) opts.useFsEvents = false;
        if (undef(opts, "usePolling") && !opts.useFsEvents) {
          opts.usePolling = isMacos;
        }
        if (isIBMi) {
          opts.usePolling = true;
        }
        const envPoll = process.env.CHOKIDAR_USEPOLLING;
        if (envPoll !== void 0) {
          const envLower = envPoll.toLowerCase();
          if (envLower === "false" || envLower === "0") {
            opts.usePolling = false;
          } else if (envLower === "true" || envLower === "1") {
            opts.usePolling = true;
          } else {
            opts.usePolling = !!envLower;
          }
        }
        const envInterval = process.env.CHOKIDAR_INTERVAL;
        if (envInterval) {
          opts.interval = Number.parseInt(envInterval, 10);
        }
        if (undef(opts, "atomic")) opts.atomic = !opts.usePolling && !opts.useFsEvents;
        if (opts.atomic) this._pendingUnlinks = /* @__PURE__ */ new Map();
        if (undef(opts, "followSymlinks")) opts.followSymlinks = true;
        if (undef(opts, "awaitWriteFinish")) opts.awaitWriteFinish = false;
        if (opts.awaitWriteFinish === true) opts.awaitWriteFinish = {};
        const awf = opts.awaitWriteFinish;
        if (awf) {
          if (!awf.stabilityThreshold) awf.stabilityThreshold = 2e3;
          if (!awf.pollInterval) awf.pollInterval = 100;
          this._pendingWrites = /* @__PURE__ */ new Map();
        }
        if (opts.ignored) opts.ignored = arrify(opts.ignored);
        let readyCalls = 0;
        this._emitReady = () => {
          readyCalls++;
          if (readyCalls >= this._readyCount) {
            this._emitReady = EMPTY_FN;
            this._readyEmitted = true;
            process.nextTick(() => this.emit(EV_READY));
          }
        };
        this._emitRaw = (...args) => this.emit(EV_RAW, ...args);
        this._readyEmitted = false;
        this.options = opts;
        if (opts.useFsEvents) {
          this._fsEventsHandler = new FsEventsHandler(this);
        } else {
          this._nodeFsHandler = new NodeFsHandler(this);
        }
        Object.freeze(opts);
      }
      // Public methods
      /**
       * Adds paths to be watched on an existing FSWatcher instance
       * @param {Path|Array<Path>} paths_
       * @param {String=} _origAdd private; for handling non-existent paths to be watched
       * @param {Boolean=} _internal private; indicates a non-user add
       * @returns {FSWatcher} for chaining
       */
      add(paths_, _origAdd, _internal) {
        const { cwd, disableGlobbing } = this.options;
        this.closed = false;
        let paths = unifyPaths(paths_);
        if (cwd) {
          paths = paths.map((path4) => {
            const absPath = getAbsolutePath(path4, cwd);
            if (disableGlobbing || !isGlob(path4)) {
              return absPath;
            }
            return normalizePath(absPath);
          });
        }
        paths = paths.filter((path4) => {
          if (path4.startsWith(BANG)) {
            this._ignoredPaths.add(path4.slice(1));
            return false;
          }
          this._ignoredPaths.delete(path4);
          this._ignoredPaths.delete(path4 + SLASH_GLOBSTAR);
          this._userIgnored = void 0;
          return true;
        });
        if (this.options.useFsEvents && this._fsEventsHandler) {
          if (!this._readyCount) this._readyCount = paths.length;
          if (this.options.persistent) this._readyCount += paths.length;
          paths.forEach((path4) => this._fsEventsHandler._addToFsEvents(path4));
        } else {
          if (!this._readyCount) this._readyCount = 0;
          this._readyCount += paths.length;
          Promise.all(
            paths.map(async (path4) => {
              const res = await this._nodeFsHandler._addToNodeFs(path4, !_internal, 0, 0, _origAdd);
              if (res) this._emitReady();
              return res;
            })
          ).then((results) => {
            if (this.closed) return;
            results.filter((item) => item).forEach((item) => {
              this.add(sysPath.dirname(item), sysPath.basename(_origAdd || item));
            });
          });
        }
        return this;
      }
      /**
       * Close watchers or start ignoring events from specified paths.
       * @param {Path|Array<Path>} paths_ - string or array of strings, file/directory paths and/or globs
       * @returns {FSWatcher} for chaining
      */
      unwatch(paths_) {
        if (this.closed) return this;
        const paths = unifyPaths(paths_);
        const { cwd } = this.options;
        paths.forEach((path4) => {
          if (!sysPath.isAbsolute(path4) && !this._closers.has(path4)) {
            if (cwd) path4 = sysPath.join(cwd, path4);
            path4 = sysPath.resolve(path4);
          }
          this._closePath(path4);
          this._ignoredPaths.add(path4);
          if (this._watched.has(path4)) {
            this._ignoredPaths.add(path4 + SLASH_GLOBSTAR);
          }
          this._userIgnored = void 0;
        });
        return this;
      }
      /**
       * Close watchers and remove all listeners from watched paths.
       * @returns {Promise<void>}.
      */
      close() {
        if (this.closed) return this._closePromise;
        this.closed = true;
        this.removeAllListeners();
        const closers = [];
        this._closers.forEach((closerList) => closerList.forEach((closer) => {
          const promise = closer();
          if (promise instanceof Promise) closers.push(promise);
        }));
        this._streams.forEach((stream) => stream.destroy());
        this._userIgnored = void 0;
        this._readyCount = 0;
        this._readyEmitted = false;
        this._watched.forEach((dirent) => dirent.dispose());
        ["closers", "watched", "streams", "symlinkPaths", "throttled"].forEach((key) => {
          this[`_${key}`].clear();
        });
        this._closePromise = closers.length ? Promise.all(closers).then(() => void 0) : Promise.resolve();
        return this._closePromise;
      }
      /**
       * Expose list of watched paths
       * @returns {Object} for chaining
      */
      getWatched() {
        const watchList = {};
        this._watched.forEach((entry, dir) => {
          const key = this.options.cwd ? sysPath.relative(this.options.cwd, dir) : dir;
          watchList[key || ONE_DOT] = entry.getChildren().sort();
        });
        return watchList;
      }
      emitWithAll(event, args) {
        this.emit(...args);
        if (event !== EV_ERROR) this.emit(EV_ALL, ...args);
      }
      // Common helpers
      // --------------
      /**
       * Normalize and emit events.
       * Calling _emit DOES NOT MEAN emit() would be called!
       * @param {EventName} event Type of event
       * @param {Path} path File or directory path
       * @param {*=} val1 arguments to be passed with event
       * @param {*=} val2
       * @param {*=} val3
       * @returns the error if defined, otherwise the value of the FSWatcher instance's `closed` flag
       */
      async _emit(event, path4, val1, val2, val3) {
        if (this.closed) return;
        const opts = this.options;
        if (isWindows) path4 = sysPath.normalize(path4);
        if (opts.cwd) path4 = sysPath.relative(opts.cwd, path4);
        const args = [event, path4];
        if (val3 !== void 0) args.push(val1, val2, val3);
        else if (val2 !== void 0) args.push(val1, val2);
        else if (val1 !== void 0) args.push(val1);
        const awf = opts.awaitWriteFinish;
        let pw;
        if (awf && (pw = this._pendingWrites.get(path4))) {
          pw.lastChange = /* @__PURE__ */ new Date();
          return this;
        }
        if (opts.atomic) {
          if (event === EV_UNLINK) {
            this._pendingUnlinks.set(path4, args);
            setTimeout(() => {
              this._pendingUnlinks.forEach((entry, path5) => {
                this.emit(...entry);
                this.emit(EV_ALL, ...entry);
                this._pendingUnlinks.delete(path5);
              });
            }, typeof opts.atomic === "number" ? opts.atomic : 100);
            return this;
          }
          if (event === EV_ADD && this._pendingUnlinks.has(path4)) {
            event = args[0] = EV_CHANGE;
            this._pendingUnlinks.delete(path4);
          }
        }
        if (awf && (event === EV_ADD || event === EV_CHANGE) && this._readyEmitted) {
          const awfEmit = (err, stats) => {
            if (err) {
              event = args[0] = EV_ERROR;
              args[1] = err;
              this.emitWithAll(event, args);
            } else if (stats) {
              if (args.length > 2) {
                args[2] = stats;
              } else {
                args.push(stats);
              }
              this.emitWithAll(event, args);
            }
          };
          this._awaitWriteFinish(path4, awf.stabilityThreshold, event, awfEmit);
          return this;
        }
        if (event === EV_CHANGE) {
          const isThrottled = !this._throttle(EV_CHANGE, path4, 50);
          if (isThrottled) return this;
        }
        if (opts.alwaysStat && val1 === void 0 && (event === EV_ADD || event === EV_ADD_DIR || event === EV_CHANGE)) {
          const fullPath = opts.cwd ? sysPath.join(opts.cwd, path4) : path4;
          let stats;
          try {
            stats = await stat(fullPath);
          } catch (err) {
          }
          if (!stats || this.closed) return;
          args.push(stats);
        }
        this.emitWithAll(event, args);
        return this;
      }
      /**
       * Common handler for errors
       * @param {Error} error
       * @returns {Error|Boolean} The error if defined, otherwise the value of the FSWatcher instance's `closed` flag
       */
      _handleError(error) {
        const code = error && error.code;
        if (error && code !== "ENOENT" && code !== "ENOTDIR" && (!this.options.ignorePermissionErrors || code !== "EPERM" && code !== "EACCES")) {
          this.emit(EV_ERROR, error);
        }
        return error || this.closed;
      }
      /**
       * Helper utility for throttling
       * @param {ThrottleType} actionType type being throttled
       * @param {Path} path being acted upon
       * @param {Number} timeout duration of time to suppress duplicate actions
       * @returns {Object|false} tracking object or false if action should be suppressed
       */
      _throttle(actionType, path4, timeout) {
        if (!this._throttled.has(actionType)) {
          this._throttled.set(actionType, /* @__PURE__ */ new Map());
        }
        const action = this._throttled.get(actionType);
        const actionPath = action.get(path4);
        if (actionPath) {
          actionPath.count++;
          return false;
        }
        let timeoutObject;
        const clear = () => {
          const item = action.get(path4);
          const count = item ? item.count : 0;
          action.delete(path4);
          clearTimeout(timeoutObject);
          if (item) clearTimeout(item.timeoutObject);
          return count;
        };
        timeoutObject = setTimeout(clear, timeout);
        const thr = { timeoutObject, clear, count: 0 };
        action.set(path4, thr);
        return thr;
      }
      _incrReadyCount() {
        return this._readyCount++;
      }
      /**
       * Awaits write operation to finish.
       * Polls a newly created file for size variations. When files size does not change for 'threshold' milliseconds calls callback.
       * @param {Path} path being acted upon
       * @param {Number} threshold Time in milliseconds a file size must be fixed before acknowledging write OP is finished
       * @param {EventName} event
       * @param {Function} awfEmit Callback to be called when ready for event to be emitted.
       */
      _awaitWriteFinish(path4, threshold, event, awfEmit) {
        let timeoutHandler;
        let fullPath = path4;
        if (this.options.cwd && !sysPath.isAbsolute(path4)) {
          fullPath = sysPath.join(this.options.cwd, path4);
        }
        const now = /* @__PURE__ */ new Date();
        const awaitWriteFinish = (prevStat) => {
          fs4.stat(fullPath, (err, curStat) => {
            if (err || !this._pendingWrites.has(path4)) {
              if (err && err.code !== "ENOENT") awfEmit(err);
              return;
            }
            const now2 = Number(/* @__PURE__ */ new Date());
            if (prevStat && curStat.size !== prevStat.size) {
              this._pendingWrites.get(path4).lastChange = now2;
            }
            const pw = this._pendingWrites.get(path4);
            const df = now2 - pw.lastChange;
            if (df >= threshold) {
              this._pendingWrites.delete(path4);
              awfEmit(void 0, curStat);
            } else {
              timeoutHandler = setTimeout(
                awaitWriteFinish,
                this.options.awaitWriteFinish.pollInterval,
                curStat
              );
            }
          });
        };
        if (!this._pendingWrites.has(path4)) {
          this._pendingWrites.set(path4, {
            lastChange: now,
            cancelWait: () => {
              this._pendingWrites.delete(path4);
              clearTimeout(timeoutHandler);
              return event;
            }
          });
          timeoutHandler = setTimeout(
            awaitWriteFinish,
            this.options.awaitWriteFinish.pollInterval
          );
        }
      }
      _getGlobIgnored() {
        return [...this._ignoredPaths.values()];
      }
      /**
       * Determines whether user has asked to ignore this path.
       * @param {Path} path filepath or dir
       * @param {fs.Stats=} stats result of fs.stat
       * @returns {Boolean}
       */
      _isIgnored(path4, stats) {
        if (this.options.atomic && DOT_RE.test(path4)) return true;
        if (!this._userIgnored) {
          const { cwd } = this.options;
          const ign = this.options.ignored;
          const ignored = ign && ign.map(normalizeIgnored(cwd));
          const paths = arrify(ignored).filter((path5) => typeof path5 === STRING_TYPE && !isGlob(path5)).map((path5) => path5 + SLASH_GLOBSTAR);
          const list = this._getGlobIgnored().map(normalizeIgnored(cwd)).concat(ignored, paths);
          this._userIgnored = anymatch(list, void 0, ANYMATCH_OPTS);
        }
        return this._userIgnored([path4, stats]);
      }
      _isntIgnored(path4, stat2) {
        return !this._isIgnored(path4, stat2);
      }
      /**
       * Provides a set of common helpers and properties relating to symlink and glob handling.
       * @param {Path} path file, directory, or glob pattern being watched
       * @param {Number=} depth at any depth > 0, this isn't a glob
       * @returns {WatchHelper} object containing helpers for this path
       */
      _getWatchHelpers(path4, depth) {
        const watchPath = depth || this.options.disableGlobbing || !isGlob(path4) ? path4 : globParent(path4);
        const follow = this.options.followSymlinks;
        return new WatchHelper(path4, watchPath, follow, this);
      }
      // Directory helpers
      // -----------------
      /**
       * Provides directory tracking objects
       * @param {String} directory path of the directory
       * @returns {DirEntry} the directory's tracking object
       */
      _getWatchedDir(directory) {
        if (!this._boundRemove) this._boundRemove = this._remove.bind(this);
        const dir = sysPath.resolve(directory);
        if (!this._watched.has(dir)) this._watched.set(dir, new DirEntry(dir, this._boundRemove));
        return this._watched.get(dir);
      }
      // File helpers
      // ------------
      /**
       * Check for read permissions.
       * Based on this answer on SO: https://stackoverflow.com/a/11781404/1358405
       * @param {fs.Stats} stats - object, result of fs_stat
       * @returns {Boolean} indicates whether the file can be read
      */
      _hasReadPermissions(stats) {
        if (this.options.ignorePermissionErrors) return true;
        const md = stats && Number.parseInt(stats.mode, 10);
        const st = md & 511;
        const it = Number.parseInt(st.toString(8)[0], 10);
        return Boolean(4 & it);
      }
      /**
       * Handles emitting unlink events for
       * files and directories, and via recursion, for
       * files and directories within directories that are unlinked
       * @param {String} directory within which the following item is located
       * @param {String} item      base path of item/directory
       * @returns {void}
      */
      _remove(directory, item, isDirectory) {
        const path4 = sysPath.join(directory, item);
        const fullPath = sysPath.resolve(path4);
        isDirectory = isDirectory != null ? isDirectory : this._watched.has(path4) || this._watched.has(fullPath);
        if (!this._throttle("remove", path4, 100)) return;
        if (!isDirectory && !this.options.useFsEvents && this._watched.size === 1) {
          this.add(directory, item, true);
        }
        const wp = this._getWatchedDir(path4);
        const nestedDirectoryChildren = wp.getChildren();
        nestedDirectoryChildren.forEach((nested) => this._remove(path4, nested));
        const parent = this._getWatchedDir(directory);
        const wasTracked = parent.has(item);
        parent.remove(item);
        if (this._symlinkPaths.has(fullPath)) {
          this._symlinkPaths.delete(fullPath);
        }
        let relPath = path4;
        if (this.options.cwd) relPath = sysPath.relative(this.options.cwd, path4);
        if (this.options.awaitWriteFinish && this._pendingWrites.has(relPath)) {
          const event = this._pendingWrites.get(relPath).cancelWait();
          if (event === EV_ADD) return;
        }
        this._watched.delete(path4);
        this._watched.delete(fullPath);
        const eventName = isDirectory ? EV_UNLINK_DIR : EV_UNLINK;
        if (wasTracked && !this._isIgnored(path4)) this._emit(eventName, path4);
        if (!this.options.useFsEvents) {
          this._closePath(path4);
        }
      }
      /**
       * Closes all watchers for a path
       * @param {Path} path
       */
      _closePath(path4) {
        this._closeFile(path4);
        const dir = sysPath.dirname(path4);
        this._getWatchedDir(dir).remove(sysPath.basename(path4));
      }
      /**
       * Closes only file-specific watchers
       * @param {Path} path
       */
      _closeFile(path4) {
        const closers = this._closers.get(path4);
        if (!closers) return;
        closers.forEach((closer) => closer());
        this._closers.delete(path4);
      }
      /**
       *
       * @param {Path} path
       * @param {Function} closer
       */
      _addPathCloser(path4, closer) {
        if (!closer) return;
        let list = this._closers.get(path4);
        if (!list) {
          list = [];
          this._closers.set(path4, list);
        }
        list.push(closer);
      }
      _readdirp(root, opts) {
        if (this.closed) return;
        const options = { type: EV_ALL, alwaysStat: true, lstat: true, ...opts };
        let stream = readdirp(root, options);
        this._streams.add(stream);
        stream.once(STR_CLOSE, () => {
          stream = void 0;
        });
        stream.once(STR_END, () => {
          if (stream) {
            this._streams.delete(stream);
            stream = void 0;
          }
        });
        return stream;
      }
    };
    exports2.FSWatcher = FSWatcher;
    var watch2 = (paths, options) => {
      const watcher = new FSWatcher(options);
      watcher.add(paths);
      return watcher;
    };
    exports2.watch = watch2;
  }
});

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode7 = __toESM(require("vscode"));

// src/managers/configManager.ts
var vscode3 = __toESM(require("vscode"));
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));

// src/types/config.ts
var DEFAULT_FTP_CONFIG = {
  name: "My Server",
  host: "localhost",
  protocol: "ftp",
  port: 21,
  username: "username",
  password: "password",
  remotePath: "/",
  uploadOnSave: true,
  useTempFile: false,
  openSsh: false,
  watcher: {
    files: "**/*",
    autoUpload: true,
    autoDelete: false,
    ignoreCreate: false,
    ignoreUpdate: false,
    ignoreDelete: true
  },
  ignore: []
  // Initialize ignore list
};

// src/utils/logger.ts
var vscode = __toESM(require("vscode"));
var Logger = class _Logger {
  constructor() {
    this.outputChannel = vscode.window.createOutputChannel("Smart FTP Log");
  }
  static getInstance() {
    if (!_Logger.instance) {
      _Logger.instance = new _Logger();
    }
    return _Logger.instance;
  }
  // Log general information messages without prefix
  info(message) {
    const timestamp = (/* @__PURE__ */ new Date()).toLocaleString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }
  // Log error messages, keeping ERROR prefix for clarity
  error(message, error) {
    const timestamp = (/* @__PURE__ */ new Date()).toLocaleString();
    this.outputChannel.appendLine(`[${timestamp}] ERROR: ${message}`);
    if (error) {
      this.outputChannel.appendLine(`[${timestamp}] ERROR DETAILS: ${error.message}`);
      if (error.stack) {
        this.outputChannel.appendLine(`[${timestamp}] STACK: ${error.stack}`);
      }
    }
  }
  // Log warning messages, keeping WARN prefix for clarity
  warn(message) {
    const timestamp = (/* @__PURE__ */ new Date()).toLocaleString();
    this.outputChannel.appendLine(`[${timestamp}] WARN: ${message}`);
  }
  // Log success messages without prefix
  success(message) {
    const timestamp = (/* @__PURE__ */ new Date()).toLocaleString();
    if (message.startsWith("Uploaded:")) {
      this.outputChannel.appendLine(`[${timestamp}] SUCCESS: ${message}`);
    } else {
      this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }
  }
  show() {
    this.outputChannel.show();
  }
  dispose() {
    this.outputChannel.dispose();
  }
};

// src/utils/pathUtils.ts
var path = __toESM(require("path"));
var vscode2 = __toESM(require("vscode"));
var fs = __toESM(require("fs"));
var PathUtils = class {
  /**
   * Convert local file path to remote FTP path
   */
  static toRemotePath(localPath, workspaceRoot, remotePath) {
    const relativePath = path.relative(workspaceRoot, localPath);
    const normalizedPath = relativePath.replace(/\\/g, "/");
    return path.posix.join(remotePath, normalizedPath);
  }
  /**
   * Get workspace root path
   */
  static getWorkspaceRoot() {
    const workspaceFolders = vscode2.workspace.workspaceFolders;
    return workspaceFolders?.[0]?.uri.fsPath;
  }
  /**
   * Check if file is in workspace
   */
  static isInWorkspace(filePath) {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      return false;
    }
    return filePath.startsWith(workspaceRoot);
  }
  /**
   * Normalize path separators for FTP
   */
  static normalizeFtpPath(ftpPath) {
    return ftpPath.replace(/\\/g, "/").replace(/\/+/g, "/");
  }
  /**
   * Get directory path from file path
   */
  static getDirectoryPath(filePath) {
    return path.posix.dirname(filePath.replace(/\\/g, "/"));
  }
  /**
   * Get file extension
   */
  static getFileExtension(filePath) {
    return path.extname(filePath).toLowerCase();
  }
  /**
   * Check if file should be ignored based on patterns
   */
  static shouldIgnoreFile(filePath, ignorePatterns = []) {
    const fileName = path.basename(filePath);
    const defaultIgnores = [
      ".git",
      ".vscode",
      "node_modules",
      ".DS_Store",
      "Thumbs.db",
      ".env",
      "*.log",
      "smartftp.json"
      // Ignore the config file itself
    ];
    const allPatterns = [...defaultIgnores, ...ignorePatterns || []];
    const workspaceRoot = this.getWorkspaceRoot();
    const relativePath = workspaceRoot ? path.relative(workspaceRoot, filePath).replace(/\\/g, "/") : fileName;
    return allPatterns.some((pattern) => {
      if (!pattern) return false;
      if (fileName === pattern || relativePath === pattern) {
        return true;
      }
      if (pattern.includes("*")) {
        try {
          const regexPattern = pattern.replace(/\./g, "\\.").replace(/\*\*/g, ".+").replace(/\*/g, "[^/]*");
          const regex = new RegExp(`^${regexPattern}$`);
          return regex.test(fileName) || regex.test(relativePath);
        } catch (e) {
          console.error(`Invalid ignore pattern regex: ${pattern}`, e);
          return false;
        }
      }
      if (pattern.endsWith("/") && (relativePath + "/").startsWith(pattern)) {
        return true;
      }
      return false;
    });
  }
  /**
   * NEW: Check if a path is a directory
   */
  static isDirectory(fsPath) {
    try {
      return fs.statSync(fsPath).isDirectory();
    } catch (e) {
      return false;
    }
  }
  /**
   * NEW: Get the base name of a path
   */
  static basename(fsPath) {
    return path.basename(fsPath);
  }
};

// src/managers/configManager.ts
var ConfigManager = class _ConfigManager {
  // Delay in milliseconds (2 seconds)
  constructor() {
    this.config = null;
    this.configPath = null;
    this.logger = Logger.getInstance();
    this.configWatcher = null;
    this.onConfigChangedEmitter = new vscode3.EventEmitter();
    this.onConfigChanged = this.onConfigChangedEmitter.event;
    this.configReloadDebounceTimer = null;
    // Added for debounce
    this.CONFIG_RELOAD_DELAY = 2e3;
  }
  static getInstance() {
    if (!_ConfigManager.instance) {
      _ConfigManager.instance = new _ConfigManager();
    }
    return _ConfigManager.instance;
  }
  async initialize() {
    await this.loadConfig();
    this.setupConfigWatcher();
  }
  async createConfig() {
    const workspaceRoot = PathUtils.getWorkspaceRoot();
    if (!workspaceRoot) {
      this.logger.error("No workspace folder found. Please open a workspace first.");
      this.logger.show();
      return;
    }
    const configPath = path2.join(workspaceRoot, "smartftp.json");
    if (fs2.existsSync(configPath)) {
      const overwrite = await vscode3.window.showWarningMessage(
        "smartftp.json already exists. Do you want to overwrite it?",
        "Yes",
        "No"
      );
      if (overwrite !== "Yes") {
        return;
      }
    }
    try {
      const configContent = JSON.stringify(DEFAULT_FTP_CONFIG, null, 2);
      fs2.writeFileSync(configPath, configContent, "utf8");
      this.logger.success(`Created Smart FTP configuration file: ${configPath}`);
      this.logger.info("Smart FTP configuration file created successfully!");
      this.logger.show();
      const document = await vscode3.workspace.openTextDocument(configPath);
      await vscode3.window.showTextDocument(document);
      await this.loadConfig();
    } catch (error) {
      this.logger.error("Failed to create Smart FTP configuration file", error);
      this.logger.show();
    }
  }
  async loadConfig() {
    const workspaceRoot = PathUtils.getWorkspaceRoot();
    if (!workspaceRoot) {
      return null;
    }
    const configPath = path2.join(workspaceRoot, "smartftp.json");
    this.configPath = configPath;
    if (!fs2.existsSync(configPath)) {
      this.logger.info("No smartftp.json configuration file found");
      if (this.config !== null) {
        this.config = null;
        this.onConfigChangedEmitter.fire(null);
      }
      return null;
    }
    try {
      const configContent = fs2.readFileSync(configPath, "utf8");
      const parsedConfig = JSON.parse(configContent);
      if (!this.validateConfig(parsedConfig)) {
        throw new Error("Invalid configuration format");
      }
      if (JSON.stringify(this.config) !== JSON.stringify(parsedConfig)) {
        this.config = parsedConfig;
        this.logger.success(`Loaded Smart FTP configuration: ${parsedConfig.name || "Default"}`);
        this.onConfigChangedEmitter.fire(this.config);
      } else {
        this.logger.info("Configuration file reloaded, but no changes detected.");
      }
      return this.config;
    } catch (error) {
      this.logger.error("Failed to load Smart FTP configuration. Please check smartftp.json format.", error);
      this.logger.show();
      if (this.config !== null) {
        this.config = null;
        this.onConfigChangedEmitter.fire(null);
      }
      return null;
    }
  }
  validateConfig(config) {
    const required = ["host", "protocol", "port", "username", "password", "remotePath"];
    for (const field of required) {
      if (!(field in config) || config[field] === void 0 || config[field] === "") {
        if (field === "password" && config[field] === "") continue;
        this.logger.error(`Missing or empty required field in smartftp.json: ${field}`);
        return false;
      }
    }
    if (!["ftp", "sftp"].includes(config.protocol)) {
      this.logger.error('Protocol must be either "ftp" or "sftp" in smartftp.json');
      return false;
    }
    if (typeof config.port !== "number" || !Number.isInteger(config.port) || config.port <= 0 || config.port > 65535) {
      this.logger.error("Port must be an integer between 1 and 65535 in smartftp.json");
      return false;
    }
    return true;
  }
  setupConfigWatcher() {
    if (this.configWatcher) {
      this.configWatcher.dispose();
    }
    const workspaceRoot = PathUtils.getWorkspaceRoot();
    if (!workspaceRoot) {
      return;
    }
    const pattern = new vscode3.RelativePattern(workspaceRoot, "smartftp.json");
    this.configWatcher = vscode3.workspace.createFileSystemWatcher(pattern);
    this.configWatcher.onDidChange(() => {
      this.logger.info("Smart FTP configuration file change detected. Debouncing reload...");
      if (this.configReloadDebounceTimer) {
        clearTimeout(this.configReloadDebounceTimer);
      }
      this.configReloadDebounceTimer = setTimeout(() => {
        this.logger.info("Reloading Smart FTP configuration now...");
        this.loadConfig();
        this.configReloadDebounceTimer = null;
      }, this.CONFIG_RELOAD_DELAY);
    });
    this.configWatcher.onDidCreate(() => {
      this.logger.info("Smart FTP configuration file created, loading immediately...");
      if (this.configReloadDebounceTimer) {
        clearTimeout(this.configReloadDebounceTimer);
        this.configReloadDebounceTimer = null;
      }
      this.loadConfig();
    });
    this.configWatcher.onDidDelete(() => {
      this.logger.info("Smart FTP configuration file deleted");
      if (this.configReloadDebounceTimer) {
        clearTimeout(this.configReloadDebounceTimer);
        this.configReloadDebounceTimer = null;
      }
      if (this.config !== null) {
        this.config = null;
        this.onConfigChangedEmitter.fire(null);
      }
    });
  }
  getConfig() {
    return this.config;
  }
  hasConfig() {
    return this.config !== null;
  }
  dispose() {
    if (this.configWatcher) {
      this.configWatcher.dispose();
    }
    if (this.configReloadDebounceTimer) {
      clearTimeout(this.configReloadDebounceTimer);
    }
    this.onConfigChangedEmitter.dispose();
  }
};

// src/managers/ftpManager.ts
var vscode5 = __toESM(require("vscode"));
var import_basic_ftp = __toESM(require_dist());
var fs3 = __toESM(require("fs"));
var path3 = __toESM(require("path"));

// src/managers/statusManager.ts
var vscode4 = __toESM(require("vscode"));
var StatusManager = class _StatusManager {
  constructor() {
    this.logger = Logger.getInstance();
    this.connectionStatus = {
      connected: false,
      connecting: false
    };
    this.currentOperation = "none";
    this.operationText = "";
    this.statusBarItem = vscode4.window.createStatusBarItem(
      vscode4.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.name = "Smart FTP Status";
    this.statusBarItem.command = "smartftp.connect";
    this.updateStatusBar();
    this.statusBarItem.show();
  }
  static getInstance() {
    if (!_StatusManager.instance) {
      _StatusManager.instance = new _StatusManager();
    }
    return _StatusManager.instance;
  }
  updateConnectionStatus(status) {
    this.connectionStatus = status;
    if (this.currentOperation === "none") {
      this.updateStatusBar();
    }
    if (status.connected) {
      this.logger.success("Connected to FTP server");
    } else if (status.connecting) {
      this.logger.info("Connecting to FTP server...");
    } else if (status.error) {
      this.logger.error(`Connection failed: ${status.error}`);
      this.logger.show();
    }
  }
  updateStatusBar() {
    if (this.currentOperation !== "none") {
      this.statusBarItem.text = this.operationText;
      this.statusBarItem.color = void 0;
      this.statusBarItem.backgroundColor = void 0;
      this.statusBarItem.tooltip = this.operationText;
      this.statusBarItem.command = void 0;
      return;
    }
    if (this.connectionStatus.connected) {
      this.statusBarItem.text = "$(check) Smart FTP: Connected";
      this.statusBarItem.color = "#90EE90";
      this.statusBarItem.backgroundColor = void 0;
      this.statusBarItem.tooltip = `Smart FTP: Connected to ${this.connectionStatus.host || "server"}
Last connected: ${this.connectionStatus.lastConnected?.toLocaleString()}
Click to disconnect`;
      this.statusBarItem.command = "smartftp.disconnect";
    } else if (this.connectionStatus.connecting) {
      this.statusBarItem.text = "$(sync~spin) Smart FTP: Connecting...";
      this.statusBarItem.color = void 0;
      this.statusBarItem.backgroundColor = new vscode4.ThemeColor("statusBarItem.warningBackground");
      this.statusBarItem.tooltip = "Smart FTP: Connecting to server...";
      this.statusBarItem.command = void 0;
    } else {
      this.statusBarItem.text = "$(x) Smart FTP: Disconnected";
      this.statusBarItem.color = void 0;
      this.statusBarItem.backgroundColor = new vscode4.ThemeColor("statusBarItem.errorBackground");
      this.statusBarItem.tooltip = this.connectionStatus.error ? `Smart FTP: Connection Error: ${this.connectionStatus.error}
Click to connect` : "Smart FTP: Click to connect to server";
      this.statusBarItem.command = "smartftp.connect";
    }
  }
  // --- Upload Status --- 
  showUploadProgress(fileName, progress) {
    this.currentOperation = "upload";
    if (progress !== void 0) {
      this.operationText = `$(cloud-upload) Uploading ${fileName} (${Math.round(progress)}%)`;
    } else {
      this.operationText = `$(cloud-upload) Uploading ${fileName}...`;
    }
    this.updateStatusBar();
  }
  showUploadSuccess(fileName) {
    this.logger.success(`Uploaded: ${fileName}`);
    this.currentOperation = "none";
    this.operationText = "";
    this.updateStatusBar();
  }
  showUploadError(fileName, error) {
    this.logger.error(`Upload failed for ${fileName}: ${error}`);
    this.currentOperation = "none";
    this.operationText = "";
    this.updateStatusBar();
    this.logger.show();
  }
  // --- Sync Status --- 
  showSyncProgress(message) {
    this.currentOperation = "sync";
    this.operationText = `$(sync~spin) ${message}`;
    this.updateStatusBar();
  }
  showSyncSuccess(message) {
    this.logger.success(`Sync Success: ${message}`);
    this.currentOperation = "none";
    this.operationText = "";
    this.updateStatusBar();
  }
  showSyncError(message, error) {
    this.logger.error(`Sync Error: ${message}: ${error}`);
    this.currentOperation = "none";
    this.operationText = "";
    this.updateStatusBar();
    this.logger.show();
  }
  // --- Download Status --- 
  showDownloadProgress(message) {
    this.currentOperation = "download";
    this.operationText = `$(cloud-download) ${message}`;
    this.updateStatusBar();
  }
  showDownloadSuccess(message) {
    this.logger.success(`Download Success: ${message}`);
    this.currentOperation = "none";
    this.operationText = "";
    this.updateStatusBar();
  }
  showDownloadError(message, error) {
    this.logger.error(`Download Error: ${message}: ${error}`);
    this.currentOperation = "none";
    this.operationText = "";
    this.updateStatusBar();
    this.logger.show();
  }
  // --- General Notifications --- 
  showNotification(message, type = "info") {
    const displayMessage = message.startsWith("Connected to") || message.startsWith("Disconnected from") ? message.replace("FTP", "Smart FTP:") : `Smart FTP: ${message}`;
    if (message.startsWith("Connected to") || message.startsWith("Disconnected from")) {
    } else {
      switch (type) {
        case "info":
          this.logger.info(displayMessage);
          break;
        case "warning":
          this.logger.warn(displayMessage);
          vscode4.window.showWarningMessage(displayMessage);
          break;
        case "error":
          this.logger.error(displayMessage);
          vscode4.window.showErrorMessage(displayMessage);
          break;
      }
      if (type === "error" || type === "warning") {
        this.logger.show();
      }
    }
  }
  showOutputChannel() {
    this.logger.show();
  }
  dispose() {
    this.statusBarItem.dispose();
  }
};

// src/managers/ftpManager.ts
var FTPManager = class _FTPManager {
  // Combined flag for sync/download operations
  constructor() {
    this.client = null;
    this.config = null;
    this.logger = Logger.getInstance();
    this.statusManager = StatusManager.getInstance();
    this.connectionStatus = {
      connected: false,
      connecting: false
    };
    this.uploadQueue = [];
    this.isProcessingQueue = false;
    this.reconnectTimer = null;
    this.maxRetries = 3;
    this.retryDelay = 5e3;
    // 5 seconds
    this.isSyncingOrDownloading = false;
  }
  static getInstance() {
    if (!_FTPManager.instance) {
      _FTPManager.instance = new _FTPManager();
    }
    return _FTPManager.instance;
  }
  setConfig(config) {
    this.config = config;
    if (!config) {
      this.disconnect();
    }
  }
  isConnected() {
    return this.connectionStatus.connected && this.client !== null && !this.client.closed;
  }
  // Helper to check connection and handle errors/reconnects
  async checkConnection(operationName) {
    if (!this.isConnected()) {
      this.logger.warn(`Connection lost before ${operationName}. Attempting reconnect.`);
      this.connectionStatus.connected = false;
      this.statusManager.updateConnectionStatus({ ...this.connectionStatus, error: `Connection lost before ${operationName}` });
      const connected = await this.connect();
      if (!connected) {
        this.logger.error(`Reconnect failed. Cannot perform ${operationName}.`);
        return false;
      }
    }
    return true;
  }
  // Helper to handle common FTP errors and decide if reconnect is needed
  handleFTPError(error, operationContext) {
    const errorMessage = error.message;
    this.logger.error(`${operationContext} failed: ${errorMessage}`, error);
    if (error instanceof import_basic_ftp.FTPError && (error.code === 421 || error.code === 426 || error.code === 530)) {
      this.logger.warn(`FTPError ${error.code} during ${operationContext}. Assuming connection lost.`);
      this.connectionStatus.connected = false;
      this.statusManager.updateConnectionStatus({ ...this.connectionStatus, error: `Connection lost during ${operationContext} (Code ${error.code})` });
      this.scheduleReconnect();
    } else if (errorMessage.includes("ECONNRESET") || errorMessage.includes("timeout") || errorMessage.includes("Not connected") || errorMessage.includes("Connection closed")) {
      this.logger.warn(`Network error during ${operationContext}. Assuming connection lost.`);
      this.connectionStatus.connected = false;
      this.statusManager.updateConnectionStatus({ ...this.connectionStatus, error: `Connection lost during ${operationContext}` });
      this.scheduleReconnect();
    }
  }
  async connect() {
    if (!this.config) {
      this.logger.error("No FTP configuration found");
      return false;
    }
    if (this.connectionStatus.connecting) {
      this.logger.warn("Already connecting to FTP server");
      return false;
    }
    if (this.isConnected()) {
      this.logger.info("Already connected to FTP server");
      return true;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.connectionStatus = { connected: false, connecting: true };
    this.statusManager.updateConnectionStatus(this.connectionStatus);
    try {
      if (this.client && !this.client.closed) {
        this.logger.warn("Previous client was not closed. Attempting force close.");
        this.client.close();
      }
      this.client = new import_basic_ftp.Client(3e4);
      this.client.ftp.verbose = true;
      this.logger.info(`Connecting to ${this.config.host}:${this.config.port}...`);
      await this.client.access({
        host: this.config.host,
        port: this.config.port,
        user: this.config.username,
        password: this.config.password,
        secure: this.config.protocol === "sftp"
        // secureOptions: { rejectUnauthorized: false } // Add if needed for self-signed certs, but be cautious
      });
      if (this.client.closed) {
        throw new Error("Connection closed immediately after access.");
      }
      this.logger.info("Connection established, testing with list...");
      await this.client.list(this.config.remotePath);
      this.logger.info("List command successful.");
      this.connectionStatus = {
        connected: true,
        connecting: false,
        lastConnected: /* @__PURE__ */ new Date(),
        host: this.config.host
        // Assign host here
      };
      this.statusManager.updateConnectionStatus(this.connectionStatus);
      this.startHeartbeat();
      this.processUploadQueue();
      return true;
    } catch (error) {
      this.logger.error(`Connection failed: ${error.message}`, error);
      this.connectionStatus = {
        connected: false,
        connecting: false,
        error: error.message
      };
      this.statusManager.updateConnectionStatus(this.connectionStatus);
      if (this.client && !this.client.closed) {
        this.client.close();
      }
      this.client = null;
      this.scheduleReconnect();
      return false;
    }
  }
  async disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.client && !this.client.closed) {
      this.logger.info("Closing FTP client connection...");
      try {
        this.client.close();
        this.logger.info("FTP client closed.");
      } catch (error) {
        this.logger.warn(`Error closing FTP connection: ${error.message}`);
      }
    }
    this.client = null;
    if (this.connectionStatus.connected || this.connectionStatus.connecting) {
      this.connectionStatus = {
        connected: false,
        connecting: false
      };
      this.statusManager.updateConnectionStatus(this.connectionStatus);
      this.logger.info("Disconnected from FTP server");
    }
  }
  async uploadFile(localPath, remotePath) {
    if (this.isSyncingOrDownloading) {
      this.logger.info(`Upload skipped during sync/download: ${path3.basename(localPath)}`);
      return true;
    }
    if (!this.config) {
      this.logger.error("No FTP configuration found");
      return false;
    }
    if (!fs3.existsSync(localPath)) {
      this.logger.error(`Local file does not exist: ${localPath}`);
      return false;
    }
    if (!remotePath) {
      const workspaceRoot = PathUtils.getWorkspaceRoot();
      if (!workspaceRoot) {
        this.logger.error("No workspace root found");
        return false;
      }
      remotePath = PathUtils.toRemotePath(localPath, workspaceRoot, this.config.remotePath);
    }
    const fileName = path3.basename(localPath);
    if (PathUtils.shouldIgnoreFile(localPath, this.config.ignore)) {
      this.logger.info(`Ignoring file based on config: ${fileName}`);
      return true;
    }
    const uploadTask = {
      localPath,
      remotePath,
      retries: 0,
      timestamp: /* @__PURE__ */ new Date()
    };
    this.uploadQueue.push(uploadTask);
    this.logger.info(`Queued for upload: ${fileName}`);
    if (!this.isConnected()) {
      this.connect();
      return true;
    }
    this.processUploadQueue();
    return true;
  }
  async processUploadQueue() {
    if (this.isProcessingQueue || this.uploadQueue.length === 0) {
      return true;
    }
    if (!this.isConnected()) {
      this.logger.warn("Cannot process upload queue: Not connected.");
      this.connect();
      return false;
    }
    this.isProcessingQueue = true;
    let overallSuccess = true;
    while (this.uploadQueue.length > 0) {
      if (!this.isConnected()) {
        this.logger.warn("Connection lost during upload queue processing.");
        this.isProcessingQueue = false;
        this.connect();
        return false;
      }
      const task = this.uploadQueue.shift();
      const fileName = path3.basename(task.localPath);
      try {
        this.statusManager.showUploadProgress(fileName);
        const remoteDir = PathUtils.getDirectoryPath(task.remotePath);
        await this.ensureRemoteDirectory(remoteDir);
        if (!this.isConnected()) throw new Error("Connection lost before upload");
        this.logger.info(`Uploading ${task.localPath} to ${task.remotePath}`);
        await this.client.uploadFrom(task.localPath, task.remotePath);
        this.statusManager.showUploadSuccess(fileName);
      } catch (error) {
        task.retries++;
        this.handleFTPError(error, `Upload attempt ${task.retries} for ${fileName}`);
        if (task.retries < this.maxRetries && !this.client?.closed) {
          this.logger.warn(`Retrying upload for ${fileName} (${task.retries}/${this.maxRetries})`);
          this.uploadQueue.unshift(task);
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay / 2));
        } else {
          this.logger.error(`Upload failed permanently for ${fileName}: ${error.message}`);
          this.statusManager.showUploadError(fileName, error.message);
          overallSuccess = false;
        }
        if (this.client?.closed) {
          break;
        }
      }
    }
    this.isProcessingQueue = false;
    if (this.uploadQueue.length === 0) {
      this.statusManager.updateStatusBar();
    }
    return overallSuccess;
  }
  async deleteFile(remotePath) {
    const operation = "deleteFile";
    if (!await this.checkConnection(operation)) return false;
    if (!this.config) {
      this.logger.error("No FTP configuration found for deletion");
      return false;
    }
    const fileName = path3.basename(remotePath);
    this.logger.info(`Attempting to delete remote file: ${remotePath}`);
    try {
      await this.client.remove(remotePath);
      this.logger.success(`Successfully deleted remote file: ${fileName}`);
      return true;
    } catch (error) {
      if (error instanceof import_basic_ftp.FTPError && error.code === 550) {
        this.logger.warn(`Remote file not found or deletion failed (550): ${fileName}`);
        return true;
      } else {
        this.handleFTPError(error, `delete remote file ${fileName}`);
        return false;
      }
    }
  }
  async deleteDirectory(remotePath) {
    const operation = "deleteDirectory";
    if (!await this.checkConnection(operation)) return false;
    if (!this.config) {
      this.logger.error("No FTP configuration found for directory deletion");
      return false;
    }
    const dirName = path3.basename(remotePath);
    this.logger.info(`Attempting to delete remote directory recursively: ${remotePath}`);
    try {
      await this.client.removeDir(remotePath);
      this.logger.success(`Successfully deleted remote directory: ${dirName}`);
      return true;
    } catch (error) {
      if (error instanceof import_basic_ftp.FTPError && error.code === 550) {
        this.logger.warn(`Remote directory not found or deletion failed (550): ${dirName}`);
        return true;
      } else {
        this.handleFTPError(error, `delete remote directory ${dirName}`);
        return false;
      }
    }
  }
  // --- REVISED: Server-to-Local Sync Logic ---
  async syncServerToLocal(localFolderPath, remoteFolderPath) {
    const operation = "syncServerToLocal";
    if (this.isSyncingOrDownloading) {
      this.logger.warn("Sync/Download already in progress. Skipping new sync request.");
      vscode5.window.showWarningMessage("Another Sync or Download operation is already in progress.");
      return;
    }
    if (!await this.checkConnection(operation)) {
      this.statusManager.showSyncError(`Sync failed: ${path3.basename(localFolderPath)}`, "Connection failed");
      return;
    }
    if (!this.config) {
      this.logger.error("No FTP configuration found for sync");
      this.statusManager.showSyncError(`Sync failed: ${path3.basename(localFolderPath)}`, "No configuration");
      return;
    }
    this.isSyncingOrDownloading = true;
    this.logger.info(`Starting sync: Remote ${remoteFolderPath} -> Local ${localFolderPath}`);
    this.statusManager.showSyncProgress(`Syncing ${path3.basename(localFolderPath)}...`);
    try {
      await this._recursiveSync(localFolderPath, remoteFolderPath);
      this.logger.success(`Sync completed successfully for: ${localFolderPath}`);
      this.statusManager.showSyncSuccess(`Synced ${path3.basename(localFolderPath)}`);
    } catch (error) {
      this.logger.error(`Sync failed for ${localFolderPath}`, error);
      this.statusManager.showSyncError(`Sync failed: ${path3.basename(localFolderPath)}`, error.message);
    } finally {
      this.isSyncingOrDownloading = false;
      this.statusManager.updateStatusBar();
    }
  }
  async _recursiveSync(localFolderPath, remoteFolderPath) {
    if (!this.isConnected()) {
      throw new Error("Connection lost during recursive sync.");
    }
    this.logger.info(`_recursiveSync: Processing remote: ${remoteFolderPath}`);
    let remoteItems = [];
    try {
      remoteItems = await this.client.list(remoteFolderPath);
      this.logger.info(`_recursiveSync: Found ${remoteItems.length} items in ${remoteFolderPath}`);
    } catch (error) {
      if (error instanceof import_basic_ftp.FTPError && error.code === 550) {
        this.logger.warn(`_recursiveSync: Remote directory not found, skipping: ${remoteFolderPath}`);
        return;
      } else {
        this.handleFTPError(error, `list remote directory ${remoteFolderPath}`);
        throw error;
      }
    }
    try {
      await fs3.promises.mkdir(localFolderPath, { recursive: true });
    } catch (error) {
      this.logger.error(`_recursiveSync: Failed to create local directory ${localFolderPath}`, error);
      throw error;
    }
    let localItemStats = {};
    try {
      const files = await fs3.promises.readdir(localFolderPath, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path3.join(localFolderPath, file.name);
        if (PathUtils.shouldIgnoreFile(fullPath, this.config?.ignore)) continue;
        try {
          const stats = await fs3.promises.stat(fullPath);
          localItemStats[file.name] = {
            path: fullPath,
            isDirectory: file.isDirectory(),
            mtimeMs: stats.mtimeMs,
            size: stats.size
          };
        } catch (statError) {
          this.logger.warn(`_recursiveSync: Could not stat local item, skipping: ${fullPath}. Error: ${statError.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`_recursiveSync: Failed to read local directory ${localFolderPath}`, error);
      throw error;
    }
    for (const remoteItem of remoteItems) {
      if (!this.isConnected()) throw new Error("Connection lost during sync processing.");
      if (remoteItem.name === "." || remoteItem.name === "..") continue;
      const currentLocalPath = path3.join(localFolderPath, remoteItem.name);
      const currentRemotePath = path3.posix.join(remoteFolderPath, remoteItem.name);
      if (PathUtils.shouldIgnoreFile(currentLocalPath, this.config?.ignore)) {
        this.logger.info(`_recursiveSync: Ignoring ${currentRemotePath}`);
        continue;
      }
      const localStats = localItemStats[remoteItem.name];
      if (remoteItem.isDirectory) {
        this.logger.info(`_recursiveSync: Processing remote directory: ${currentRemotePath}`);
        if (!localStats || !localStats.isDirectory) {
          this.logger.info(`Sync: Creating local directory: ${currentLocalPath}`);
          try {
            await fs3.promises.mkdir(currentLocalPath, { recursive: true });
          } catch (mkdirError) {
            this.logger.error(`Sync: Failed to create local directory ${currentLocalPath}`, mkdirError);
            continue;
          }
        }
        await this._recursiveSync(currentLocalPath, currentRemotePath);
      } else if (remoteItem.isFile) {
        this.logger.info(`_recursiveSync: Processing remote file: ${currentRemotePath}`);
        let shouldDownload = false;
        let reason = "";
        if (!localStats) {
          shouldDownload = true;
          reason = "Local file missing";
        } else if (localStats.isDirectory) {
          this.logger.warn(`Sync: Local item is a directory, but remote is a file. Skipping: ${currentLocalPath}`);
          continue;
        } else {
          const remoteMtime = remoteItem.modifiedAt;
          if (!remoteMtime) {
            this.logger.warn(`Sync: Remote item has no modification time, cannot compare: ${currentRemotePath}. Downloading anyway.`);
            shouldDownload = true;
            reason = "Remote mtime missing";
          } else {
            const remoteMtimeMs = remoteMtime.getTime();
            const localMtimeMs = localStats.mtimeMs;
            const remoteSize = remoteItem.size;
            const localSize = localStats.size;
            const timeTolerance = 2e3;
            this.logger.info(`Sync Compare: ${remoteItem.name} | Remote mtime: ${remoteMtime.toISOString()} (${remoteMtimeMs}), Size: ${remoteSize} | Local mtime: ${new Date(localMtimeMs).toISOString()} (${localMtimeMs}), Size: ${localSize}`);
            if (remoteMtimeMs > localMtimeMs + timeTolerance) {
              shouldDownload = true;
              reason = `Remote file newer (mtime: ${remoteMtimeMs} > ${localMtimeMs + timeTolerance})`;
            } else if (remoteSize !== void 0 && remoteSize !== localSize) {
              shouldDownload = true;
              reason = `File sizes differ (remote: ${remoteSize}, local: ${localSize})`;
            } else {
              this.logger.info(`Sync: Local file is up-to-date or newer: ${currentLocalPath}`);
            }
          }
        }
        if (shouldDownload) {
          this.logger.info(`Sync: Downloading: ${currentRemotePath} -> ${currentLocalPath}. Reason: ${reason}`);
          try {
            await fs3.promises.mkdir(path3.dirname(currentLocalPath), { recursive: true });
            this.statusManager.showSyncProgress(`Downloading ${remoteItem.name}`);
            if (!this.isConnected()) throw new Error("Connection lost before download");
            await this.client.downloadTo(currentLocalPath, currentRemotePath);
            this.logger.success(`Sync: Downloaded ${currentRemotePath} to ${currentLocalPath}`);
          } catch (downloadError) {
            this.handleFTPError(downloadError, `download ${currentRemotePath} during sync`);
            this.logger.error(`Sync: Failed to download ${currentRemotePath}. Skipping file.`);
          }
        }
      } else {
        this.logger.warn(`Sync: Skipping unknown remote item type: ${remoteItem.name} (${remoteItem.type}) in ${remoteFolderPath}`);
      }
    }
    this.logger.info(`_recursiveSync: Finished processing remote: ${remoteFolderPath}`);
  }
  // --- END: REVISED Sync Logic ---
  // --- NEW: Download Remote Path Logic ---
  async downloadRemotePath(localFolderPath, remoteFolderPath) {
    const operation = "downloadRemotePath";
    if (this.isSyncingOrDownloading) {
      this.logger.warn("Sync/Download already in progress. Skipping new download request.");
      vscode5.window.showWarningMessage("Another Sync or Download operation is already in progress.");
      return;
    }
    if (!await this.checkConnection(operation)) {
      this.statusManager.showDownloadError(`Download failed: ${path3.basename(localFolderPath)}`, "Connection failed");
      return;
    }
    if (!this.config) {
      this.logger.error("No FTP configuration found for download");
      this.statusManager.showDownloadError(`Download failed: ${path3.basename(localFolderPath)}`, "No configuration");
      return;
    }
    this.isSyncingOrDownloading = true;
    this.logger.info(`Starting download: Remote ${remoteFolderPath} -> Local ${localFolderPath}`);
    this.statusManager.showDownloadProgress(`Downloading ${path3.basename(localFolderPath)}...`);
    try {
      this.logger.info(`Downloading remote directory ${remoteFolderPath} to local ${localFolderPath}`);
      await this.client.downloadToDir(localFolderPath, remoteFolderPath);
      this.logger.success(`Download completed successfully for: ${localFolderPath}`);
      this.statusManager.showDownloadSuccess(`Downloaded ${path3.basename(localFolderPath)}`);
    } catch (error) {
      this.handleFTPError(error, `download remote path ${remoteFolderPath}`);
      this.statusManager.showDownloadError(`Download failed: ${path3.basename(localFolderPath)}`, error.message);
    } finally {
      this.isSyncingOrDownloading = false;
      this.statusManager.updateStatusBar();
    }
  }
  // --- END: Download Remote Path Logic ---
  async ensureRemoteDirectory(remotePath) {
    const operation = "ensureRemoteDirectory";
    if (!await this.checkConnection(operation)) return;
    if (!this.client || !remotePath || remotePath === "/" || remotePath === ".") {
      return;
    }
    try {
      await this.client.ensureDir(remotePath);
    } catch (error) {
      this.handleFTPError(error, `ensure remote directory ${remotePath}`);
      throw error;
    }
  }
  scheduleReconnect() {
    if (this.connectionStatus.connecting || this.reconnectTimer) {
      return;
    }
    if (this.client === null && !this.connectionStatus.error) {
      return;
    }
    this.logger.info(`Scheduling reconnect in ${this.retryDelay / 1e3} seconds...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isConnected() && !this.connectionStatus.connecting) {
        this.logger.info("Attempting scheduled reconnect...");
        this.connect();
      } else {
        this.logger.info("Reconnect cancelled (already connected or connecting).");
      }
    }, this.retryDelay);
  }
  startHeartbeat() {
    this.logger.info("Heartbeat check: Not implemented (relying on operation errors/reconnect).");
  }
  dispose() {
    this.disconnect();
  }
};

// src/managers/fileWatcher.ts
var vscode6 = __toESM(require("vscode"));
var chokidar = __toESM(require_chokidar());
var FileWatcher = class _FileWatcher {
  constructor() {
    this.logger = Logger.getInstance();
    this.ftpManager = FTPManager.getInstance();
    this.config = null;
    this.fileWatcher = null;
    this.saveWatcher = null;
    this.isWatching = false;
    this.uploadDebounce = /* @__PURE__ */ new Map();
  }
  static getInstance() {
    if (!_FileWatcher.instance) {
      _FileWatcher.instance = new _FileWatcher();
    }
    return _FileWatcher.instance;
  }
  setConfig(config) {
    this.config = config;
    this.restart();
  }
  start() {
    if (!this.config || this.isWatching) {
      return;
    }
    const workspaceRoot = PathUtils.getWorkspaceRoot();
    if (!workspaceRoot) {
      this.logger.error("No workspace root found for file watching");
      return;
    }
    this.startFileSystemWatcher(workspaceRoot);
    this.startSaveWatcher();
    this.isWatching = true;
    this.logger.info(`Started file watching with pattern: ${this.config.watcher.files}`);
  }
  stop() {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
    if (this.saveWatcher) {
      this.saveWatcher.dispose();
      this.saveWatcher = null;
    }
    this.uploadDebounce.forEach((timeout) => clearTimeout(timeout));
    this.uploadDebounce.clear();
    this.isWatching = false;
    this.logger.info("Stopped file watching");
  }
  restart() {
    this.stop();
    if (this.config) {
      this.start();
    }
  }
  startFileSystemWatcher(workspaceRoot) {
    if (!this.config?.watcher.autoUpload && !this.config?.uploadOnSave) {
      this.logger.info("File watching disabled (autoUpload and uploadOnSave are false).");
      return;
    }
    const watchPattern = this.config.watcher.files || "**/*";
    const fullPattern = `${workspaceRoot}/${watchPattern}`;
    this.fileWatcher = chokidar.watch(fullPattern, {
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "**/.vscode/**",
        "**/smartftp.json",
        // Updated config filename
        "**/*.log",
        "**/.DS_Store",
        "**/Thumbs.db"
      ],
      ignoreInitial: true,
      persistent: true,
      followSymlinks: false
    });
    if (!this.config.watcher.ignoreCreate && this.config.watcher.autoUpload) {
      this.fileWatcher.on("add", (filePath) => {
        this.logger.info(`File created: ${filePath}`);
        this.debounceUpload(filePath, "create");
      });
    }
    if (!this.config.watcher.ignoreUpdate && this.config.watcher.autoUpload) {
      this.fileWatcher.on("change", (filePath) => {
        this.logger.info(`File changed: ${filePath}`);
        this.debounceUpload(filePath, "change");
      });
    }
    if (!this.config.watcher.ignoreDelete && this.config.watcher.autoDelete) {
      this.fileWatcher.on("unlink", (filePath) => {
        this.logger.info(`File deleted locally: ${filePath}`);
        this.handleFileDelete(filePath);
      });
    }
    if (!this.config.watcher.ignoreDelete && this.config.watcher.autoDelete) {
      this.fileWatcher.on("unlinkDir", (dirPath) => {
        this.logger.info(`Directory deleted locally: ${dirPath}`);
        this.handleDirectoryDelete(dirPath);
      });
    }
    this.fileWatcher.on("error", (error) => {
      this.logger.error("File watcher error", error);
    });
  }
  startSaveWatcher() {
    if (!this.config?.uploadOnSave) {
      return;
    }
    this.saveWatcher = vscode6.workspace.onDidSaveTextDocument((document) => {
      const filePath = document.fileName;
      if (!PathUtils.isInWorkspace(filePath)) {
        return;
      }
      if (PathUtils.shouldIgnoreFile(filePath)) {
        return;
      }
      this.logger.info(`File saved: ${filePath}`);
      const timeout = this.uploadDebounce.get(filePath);
      if (timeout) {
        clearTimeout(timeout);
        this.uploadDebounce.delete(filePath);
        this.logger.info(`Cleared debounced watcher upload for ${filePath} due to save event.`);
      }
      this.ftpManager.uploadFile(filePath);
    });
  }
  debounceUpload(filePath, event) {
    if (!PathUtils.isInWorkspace(filePath)) {
      return;
    }
    if (PathUtils.shouldIgnoreFile(filePath)) {
      return;
    }
    const existingTimeout = this.uploadDebounce.get(filePath);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    const timeout = setTimeout(() => {
      this.uploadDebounce.delete(filePath);
      this.logger.info(`Triggering debounced upload for: ${filePath}`);
      this.ftpManager.uploadFile(filePath);
    }, 1e3);
    this.uploadDebounce.set(filePath, timeout);
  }
  async handleFileDelete(filePath) {
    if (!this.config || !this.config.watcher.autoDelete) {
      return;
    }
    try {
      const workspaceRoot = PathUtils.getWorkspaceRoot();
      if (!workspaceRoot) {
        this.logger.error("Cannot determine workspace root for deletion.");
        return;
      }
      const remotePath = PathUtils.toRemotePath(filePath, workspaceRoot, this.config.remotePath);
      this.logger.info(`Auto-deleting remote file: ${remotePath}`);
      const success = await this.ftpManager.deleteFile(remotePath);
      if (!success) {
        this.logger.warn(`Auto-delete failed for remote file: ${remotePath}`);
      }
    } catch (error) {
      this.logger.error("Error during remote file deletion process", error);
    }
  }
  async handleDirectoryDelete(dirPath) {
    if (!this.config || !this.config.watcher.autoDelete) {
      return;
    }
    try {
      const workspaceRoot = PathUtils.getWorkspaceRoot();
      if (!workspaceRoot) {
        this.logger.error("Cannot determine workspace root for directory deletion.");
        return;
      }
      const remotePath = PathUtils.toRemotePath(dirPath, workspaceRoot, this.config.remotePath);
      this.logger.info(`Auto-deleting remote directory: ${remotePath}`);
      const success = await this.ftpManager.deleteDirectory(remotePath);
      if (!success) {
        this.logger.warn(`Auto-delete failed for remote directory: ${remotePath}`);
      }
    } catch (error) {
      this.logger.error("Error during remote directory deletion process", error);
    }
  }
  isActive() {
    return this.isWatching;
  }
  dispose() {
    this.stop();
  }
};

// src/extension.ts
var configManager;
var ftpManager;
var fileWatcher;
var statusManager;
var logger;
async function activate(context) {
  logger = Logger.getInstance();
  logger.info("Smart FTP extension is activating...");
  logger.show();
  configManager = ConfigManager.getInstance();
  ftpManager = FTPManager.getInstance();
  fileWatcher = FileWatcher.getInstance();
  statusManager = StatusManager.getInstance();
  await configManager.initialize();
  const initialConfig = configManager.getConfig();
  if (initialConfig) {
    logger.info(`Initial configuration loaded: ${initialConfig.name || "Default"}`);
    ftpManager.setConfig(initialConfig);
    fileWatcher.setConfig(initialConfig);
    ftpManager.connect();
  } else {
    logger.info("No initial configuration found.");
    logger.info("Welcome to Smart FTP! Create a configuration to get started.");
    logger.show();
    setTimeout(() => {
      vscode7.window.showInformationMessage(
        "Welcome to Smart FTP! Create a configuration to get started.",
        "Create Config"
      ).then((action) => {
        if (action === "Create Config") {
          vscode7.commands.executeCommand("smartftp.createConfig");
        }
      });
    }, 1e3);
  }
  configManager.onConfigChanged((config) => {
    ftpManager.setConfig(config);
    fileWatcher.setConfig(config);
    if (config) {
      logger.info(`Configuration updated/loaded: ${config.name || "Default"}`);
      if (!ftpManager.isConnected()) {
        ftpManager.connect();
      }
    } else {
      logger.info("Configuration removed or became invalid");
      ftpManager.disconnect();
    }
  });
  const commands2 = [
    vscode7.commands.registerCommand("smartftp.createConfig", async () => {
      await configManager.createConfig();
    }),
    vscode7.commands.registerCommand("smartftp.connect", async () => {
      if (!configManager.hasConfig()) {
        logger.warn("No FTP configuration found. Please create one first.");
        logger.show();
        const create = await vscode7.window.showInformationMessage(
          "No FTP configuration found. Would you like to create one?",
          "Create Config",
          "Cancel"
        );
        if (create === "Create Config") {
          await configManager.createConfig();
        }
        return;
      }
      await ftpManager.connect();
    }),
    vscode7.commands.registerCommand("smartftp.disconnect", async () => {
      await ftpManager.disconnect();
    }),
    vscode7.commands.registerCommand("smartftp.uploadFile", async (uri) => {
      let filePath;
      if (uri?.fsPath) {
        filePath = uri.fsPath;
      } else {
        const activeEditor = vscode7.window.activeTextEditor;
        if (!activeEditor) {
          logger.error("No file is currently open");
          logger.show();
          return;
        }
        filePath = activeEditor.document.fileName;
      }
      if (!PathUtils.isInWorkspace(filePath)) {
        logger.error("File must be within the workspace");
        logger.show();
        return;
      }
      await ftpManager.uploadFile(filePath);
    }),
    vscode7.commands.registerCommand("smartftp.uploadWorkspace", async () => {
      const workspaceRoot = PathUtils.getWorkspaceRoot();
      if (!workspaceRoot) {
        logger.error("No workspace folder found");
        logger.show();
        return;
      }
      const confirm = await vscode7.window.showWarningMessage(
        "This will upload all files in the workspace. Continue?",
        "Yes",
        "No"
      );
      if (confirm !== "Yes") return;
      try {
        const files = await vscode7.workspace.findFiles("**/*", "**/node_modules/**");
        let uploadCount = 0;
        for (const file of files) {
          if (!PathUtils.shouldIgnoreFile(file.fsPath, configManager.getConfig()?.ignore)) {
            await ftpManager.uploadFile(file.fsPath);
            uploadCount++;
          }
        }
        statusManager.showNotification(`${uploadCount} files queued for upload`);
      } catch (error) {
        logger.error("Failed to upload workspace", error);
        logger.show();
      }
    }),
    vscode7.commands.registerCommand("smartftp.showOutput", () => {
      statusManager.showOutputChannel();
    }),
    vscode7.commands.registerCommand("smartftp.toggleWatcher", () => {
      if (fileWatcher.isActive()) {
        fileWatcher.stop();
        statusManager.showNotification("File watcher stopped");
      } else {
        fileWatcher.start();
        statusManager.showNotification("File watcher started");
      }
    }),
    // UPDATED: Sync Remote Files to Local Command (No Warning)
    vscode7.commands.registerCommand("smartftp.syncServerToLocal", async (uri) => {
      if (!configManager.hasConfig()) {
        vscode7.window.showWarningMessage("No FTP configuration found. Please create one first.");
        return;
      }
      let localFolderPath;
      if (uri?.fsPath && PathUtils.isDirectory(uri.fsPath)) {
        localFolderPath = uri.fsPath;
      } else {
        vscode7.window.showWarningMessage("Please right-click a folder in the explorer to sync.");
        return;
      }
      const workspaceRoot = PathUtils.getWorkspaceRoot();
      if (!workspaceRoot || !localFolderPath.startsWith(workspaceRoot)) {
        vscode7.window.showErrorMessage("Selected folder must be within the current workspace.");
        return;
      }
      const config = configManager.getConfig();
      const remoteFolderPath = PathUtils.toRemotePath(localFolderPath, workspaceRoot, config.remotePath);
      logger.info(`Starting sync from server: ${remoteFolderPath} to local: ${localFolderPath}`);
      statusManager.showNotification(`Syncing remote files to ${PathUtils.basename(localFolderPath)}...`, "info");
      logger.show();
      try {
        await ftpManager.syncServerToLocal(localFolderPath, remoteFolderPath);
      } catch (error) {
        logger.error(`Sync command failed for ${localFolderPath}`, error);
      }
    })
    // REMOVED Download Remote Path Command
    // vscode.commands.registerCommand('smartftp.downloadRemotePath', ...)
  ];
  commands2.filter((cmd) => cmd !== void 0).forEach((command) => context.subscriptions.push(command));
  context.subscriptions.push(
    configManager,
    ftpManager,
    fileWatcher,
    statusManager,
    logger
  );
  context.subscriptions.push(
    vscode7.workspace.onDidChangeWorkspaceFolders(() => {
      logger.info("Workspace folders changed, reinitializing...");
      configManager.initialize();
    })
  );
  logger.info("Smart FTP extension activated successfully");
}
function deactivate() {
  logger?.info("Smart FTP extension is deactivating...");
  ftpManager?.disconnect();
  logger?.info("Smart FTP extension deactivated");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
/*! Bundled license information:

normalize-path/index.js:
  (*!
   * normalize-path <https://github.com/jonschlinkert/normalize-path>
   *
   * Copyright (c) 2014-2018, Jon Schlinkert.
   * Released under the MIT License.
   *)

is-extglob/index.js:
  (*!
   * is-extglob <https://github.com/jonschlinkert/is-extglob>
   *
   * Copyright (c) 2014-2016, Jon Schlinkert.
   * Licensed under the MIT License.
   *)

is-glob/index.js:
  (*!
   * is-glob <https://github.com/jonschlinkert/is-glob>
   *
   * Copyright (c) 2014-2017, Jon Schlinkert.
   * Released under the MIT License.
   *)

is-number/index.js:
  (*!
   * is-number <https://github.com/jonschlinkert/is-number>
   *
   * Copyright (c) 2014-present, Jon Schlinkert.
   * Released under the MIT License.
   *)

to-regex-range/index.js:
  (*!
   * to-regex-range <https://github.com/micromatch/to-regex-range>
   *
   * Copyright (c) 2015-present, Jon Schlinkert.
   * Released under the MIT License.
   *)

fill-range/index.js:
  (*!
   * fill-range <https://github.com/jonschlinkert/fill-range>
   *
   * Copyright (c) 2014-present, Jon Schlinkert.
   * Licensed under the MIT License.
   *)
*/
