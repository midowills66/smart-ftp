"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileWatcher = void 0;
const vscode = __importStar(require("vscode"));
const chokidar = __importStar(require("chokidar"));
const logger_1 = require("../utils/logger");
const pathUtils_1 = require("../utils/pathUtils");
const ftpManager_1 = require("./ftpManager");
class FileWatcher {
    constructor() {
        this.logger = logger_1.Logger.getInstance();
        this.ftpManager = ftpManager_1.FTPManager.getInstance();
        this.config = null;
        this.fileWatcher = null;
        this.saveWatcher = null;
        this.isWatching = false;
        this.uploadDebounce = new Map();
    }
    static getInstance() {
        if (!FileWatcher.instance) {
            FileWatcher.instance = new FileWatcher();
        }
        return FileWatcher.instance;
    }
    setConfig(config) {
        this.config = config;
        this.restart();
    }
    start() {
        if (!this.config || this.isWatching) {
            return;
        }
        const workspaceRoot = pathUtils_1.PathUtils.getWorkspaceRoot();
        if (!workspaceRoot) {
            this.logger.error('No workspace root found for file watching');
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
        // Clear any pending debounced uploads
        this.uploadDebounce.forEach(timeout => clearTimeout(timeout));
        this.uploadDebounce.clear();
        this.isWatching = false;
        this.logger.info('Stopped file watching');
    }
    restart() {
        this.stop();
        if (this.config) {
            this.start();
        }
    }
    startFileSystemWatcher(workspaceRoot) {
        // Check if watching is enabled at all (autoUpload implies watching)
        if (!this.config?.watcher.autoUpload && !this.config?.uploadOnSave) {
            this.logger.info('File watching disabled (autoUpload and uploadOnSave are false).');
            return;
        }
        const watchPattern = this.config.watcher.files || '**/*';
        const fullPattern = `${workspaceRoot}/${watchPattern}`;
        this.fileWatcher = chokidar.watch(fullPattern, {
            ignored: [
                '**/node_modules/**',
                '**/.git/**',
                '**/.vscode/**',
                '**/smartftp.json',
                '**/*.log',
                '**/.DS_Store',
                '**/Thumbs.db'
            ],
            ignoreInitial: true,
            persistent: true,
            followSymlinks: false
        });
        // Handle file creation
        if (!this.config.watcher.ignoreCreate && this.config.watcher.autoUpload) {
            this.fileWatcher.on('add', (filePath) => {
                this.logger.info(`File created: ${filePath}`);
                this.debounceUpload(filePath, 'create');
            });
        }
        // Handle file modification
        if (!this.config.watcher.ignoreUpdate && this.config.watcher.autoUpload) {
            this.fileWatcher.on('change', (filePath) => {
                this.logger.info(`File changed: ${filePath}`);
                this.debounceUpload(filePath, 'change');
            });
        }
        // Handle file deletion
        if (!this.config.watcher.ignoreDelete && this.config.watcher.autoDelete) {
            this.fileWatcher.on('unlink', (filePath) => {
                this.logger.info(`File deleted locally: ${filePath}`);
                this.handleFileDelete(filePath);
            });
        }
        // Handle directory creation (no action needed, files inside will trigger 'add')
        // if (!this.config.watcher.ignoreCreate) {
        //   this.fileWatcher.on('addDir', (dirPath: string) => {
        //     this.logger.info(`Directory created: ${dirPath}`);
        //     // Optionally: Create directory on remote if needed, though file uploads handle this
        //   });
        // }
        // Handle directory deletion
        if (!this.config.watcher.ignoreDelete && this.config.watcher.autoDelete) {
            this.fileWatcher.on('unlinkDir', (dirPath) => {
                this.logger.info(`Directory deleted locally: ${dirPath}`);
                this.handleDirectoryDelete(dirPath);
            });
        }
        this.fileWatcher.on('error', (error) => {
            this.logger.error('File watcher error', error);
        });
    }
    startSaveWatcher() {
        if (!this.config?.uploadOnSave) {
            return;
        }
        this.saveWatcher = vscode.workspace.onDidSaveTextDocument((document) => {
            const filePath = document.fileName;
            if (!pathUtils_1.PathUtils.isInWorkspace(filePath)) {
                return;
            }
            if (pathUtils_1.PathUtils.shouldIgnoreFile(filePath)) {
                return;
            }
            this.logger.info(`File saved: ${filePath}`);
            // Clear any pending debounced upload for this file to avoid duplicates
            const timeout = this.uploadDebounce.get(filePath);
            if (timeout) {
                clearTimeout(timeout);
                this.uploadDebounce.delete(filePath);
                this.logger.info(`Cleared debounced watcher upload for ${filePath} due to save event.`);
            }
            // Upload immediately on save
            this.ftpManager.uploadFile(filePath);
        });
    }
    debounceUpload(filePath, event) {
        if (!pathUtils_1.PathUtils.isInWorkspace(filePath)) {
            return;
        }
        if (pathUtils_1.PathUtils.shouldIgnoreFile(filePath)) {
            return;
        }
        // Clear existing timeout for this file
        const existingTimeout = this.uploadDebounce.get(filePath);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }
        // Set new timeout (debounce for 1 second)
        const timeout = setTimeout(() => {
            this.uploadDebounce.delete(filePath);
            // --- FIX for Upload-on-Save Bug --- 
            // Removed the check that skipped upload if uploadOnSave was true.
            // The save handler already clears the debounce timer, preventing duplicates from the save itself.
            // This allows watcher events (e.g., external changes) to still trigger uploads.
            // if (this.config?.uploadOnSave && event === 'change') { ... }
            // --- End FIX ---
            this.logger.info(`Triggering debounced upload for: ${filePath}`);
            this.ftpManager.uploadFile(filePath);
        }, 1000);
        this.uploadDebounce.set(filePath, timeout);
    }
    async handleFileDelete(filePath) {
        // Check if autoDelete is enabled in config
        if (!this.config || !this.config.watcher.autoDelete) {
            return;
        }
        try {
            const workspaceRoot = pathUtils_1.PathUtils.getWorkspaceRoot();
            if (!workspaceRoot) {
                this.logger.error('Cannot determine workspace root for deletion.');
                return;
            }
            const remotePath = pathUtils_1.PathUtils.toRemotePath(filePath, workspaceRoot, this.config.remotePath);
            this.logger.info(`Auto-deleting remote file: ${remotePath}`);
            const success = await this.ftpManager.deleteFile(remotePath);
            if (!success) {
                this.logger.warn(`Auto-delete failed for remote file: ${remotePath}`);
            }
        }
        catch (error) {
            this.logger.error('Error during remote file deletion process', error);
        }
    }
    async handleDirectoryDelete(dirPath) {
        // Check if autoDelete is enabled in config
        if (!this.config || !this.config.watcher.autoDelete) {
            return;
        }
        try {
            const workspaceRoot = pathUtils_1.PathUtils.getWorkspaceRoot();
            if (!workspaceRoot) {
                this.logger.error('Cannot determine workspace root for directory deletion.');
                return;
            }
            const remotePath = pathUtils_1.PathUtils.toRemotePath(dirPath, workspaceRoot, this.config.remotePath);
            this.logger.info(`Auto-deleting remote directory: ${remotePath}`);
            const success = await this.ftpManager.deleteDirectory(remotePath);
            if (!success) {
                this.logger.warn(`Auto-delete failed for remote directory: ${remotePath}`);
            }
        }
        catch (error) {
            this.logger.error('Error during remote directory deletion process', error);
        }
    }
    isActive() {
        return this.isWatching;
    }
    dispose() {
        this.stop();
    }
}
exports.FileWatcher = FileWatcher;
//# sourceMappingURL=fileWatcher.js.map