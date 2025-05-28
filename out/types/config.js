"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_FTP_CONFIG = void 0;
// Updated default config with placeholders for publishing
exports.DEFAULT_FTP_CONFIG = {
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
    ignore: [] // Initialize ignore list
};
//# sourceMappingURL=config.js.map