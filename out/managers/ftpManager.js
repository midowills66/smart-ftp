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
exports.FTPManager = void 0;
const vscode = __importStar(require("vscode"));
const basic_ftp_1 = require("basic-ftp");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("../utils/logger");
const pathUtils_1 = require("../utils/pathUtils");
const statusManager_1 = require("./statusManager");
class FTPManager {
    constructor() {
        this.client = null;
        this.config = null;
        this.logger = logger_1.Logger.getInstance();
        this.statusManager = statusManager_1.StatusManager.getInstance();
        this.connectionStatus = {
            connected: false,
            connecting: false
        };
        this.uploadQueue = [];
        this.isProcessingQueue = false;
        this.reconnectTimer = null;
        this.maxRetries = 3;
        this.retryDelay = 5000; // 5 seconds
        this.isSyncingOrDownloading = false; // Combined flag for sync/download operations
    }
    static getInstance() {
        if (!FTPManager.instance) {
            FTPManager.instance = new FTPManager();
        }
        return FTPManager.instance;
    }
    setConfig(config) {
        this.config = config;
        if (!config) {
            this.disconnect();
        }
    }
    isConnected() {
        // Check both internal status and client state
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
        // Check for specific error codes or messages indicating connection loss
        if (error instanceof basic_ftp_1.FTPError && (error.code === 421 || error.code === 426 || error.code === 530)) { // Service not available, Connection closed, Not logged in
            this.logger.warn(`FTPError ${error.code} during ${operationContext}. Assuming connection lost.`);
            this.connectionStatus.connected = false;
            this.statusManager.updateConnectionStatus({ ...this.connectionStatus, error: `Connection lost during ${operationContext} (Code ${error.code})` });
            this.scheduleReconnect();
        }
        else if (errorMessage.includes('ECONNRESET') || errorMessage.includes('timeout') || errorMessage.includes('Not connected') || errorMessage.includes('Connection closed')) {
            this.logger.warn(`Network error during ${operationContext}. Assuming connection lost.`);
            this.connectionStatus.connected = false;
            this.statusManager.updateConnectionStatus({ ...this.connectionStatus, error: `Connection lost during ${operationContext}` });
            this.scheduleReconnect();
        }
        // For other errors (like 550 Not Found), we don't necessarily need to reconnect.
    }
    async connect() {
        if (!this.config) {
            this.logger.error('No FTP configuration found');
            return false;
        }
        if (this.connectionStatus.connecting) {
            this.logger.warn('Already connecting to FTP server');
            return false;
        }
        // Avoid reconnecting if already connected and client is open
        if (this.isConnected()) {
            this.logger.info('Already connected to FTP server');
            return true;
        }
        // Clear any pending reconnect timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.connectionStatus = { connected: false, connecting: true };
        this.statusManager.updateConnectionStatus(this.connectionStatus);
        try {
            // Ensure previous client is closed before creating a new one
            if (this.client && !this.client.closed) {
                this.logger.warn('Previous client was not closed. Attempting force close.');
                this.client.close();
            }
            this.client = new basic_ftp_1.Client(30000); // 30 seconds timeout
            this.client.ftp.verbose = true; // Enable verbose logging for debugging
            // REMOVED .on listeners as they are not part of basic-ftp API
            this.logger.info(`Connecting to ${this.config.host}:${this.config.port}...`);
            await this.client.access({
                host: this.config.host,
                port: this.config.port,
                user: this.config.username,
                password: this.config.password,
                secure: this.config.protocol === 'sftp',
                // secureOptions: { rejectUnauthorized: false } // Add if needed for self-signed certs, but be cautious
            });
            // Check if client is still open after access()
            if (this.client.closed) {
                throw new Error('Connection closed immediately after access.');
            }
            this.logger.info('Connection established, testing with list...');
            await this.client.list(this.config.remotePath); // Test command
            this.logger.info('List command successful.');
            this.connectionStatus = {
                connected: true,
                connecting: false,
                lastConnected: new Date(),
                host: this.config.host // Assign host here
            };
            this.statusManager.updateConnectionStatus(this.connectionStatus);
            this.startHeartbeat();
            this.processUploadQueue(); // Process queue after successful connect
            return true;
        }
        catch (error) {
            this.logger.error(`Connection failed: ${error.message}`, error);
            this.connectionStatus = {
                connected: false,
                connecting: false,
                error: error.message
            };
            this.statusManager.updateConnectionStatus(this.connectionStatus);
            // Close the client if it exists and failed during connection
            if (this.client && !this.client.closed) {
                this.client.close();
            }
            this.client = null; // Ensure client is null on failure
            this.scheduleReconnect(); // Schedule reconnect on failure
            return false;
        }
    }
    async disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.client && !this.client.closed) {
            this.logger.info('Closing FTP client connection...');
            try {
                // No need to remove listeners as we don't add them
                this.client.close();
                this.logger.info('FTP client closed.');
            }
            catch (error) {
                this.logger.warn(`Error closing FTP connection: ${error.message}`);
            }
        }
        this.client = null; // Ensure client is null after disconnect
        if (this.connectionStatus.connected || this.connectionStatus.connecting) {
            this.connectionStatus = {
                connected: false,
                connecting: false
            };
            this.statusManager.updateConnectionStatus(this.connectionStatus);
            this.logger.info('Disconnected from FTP server');
        }
    }
    async uploadFile(localPath, remotePath) {
        if (this.isSyncingOrDownloading) {
            this.logger.info(`Upload skipped during sync/download: ${path.basename(localPath)}`);
            return true;
        }
        if (!this.config) {
            this.logger.error('No FTP configuration found');
            return false;
        }
        if (!fs.existsSync(localPath)) {
            this.logger.error(`Local file does not exist: ${localPath}`);
            return false;
        }
        if (!remotePath) {
            const workspaceRoot = pathUtils_1.PathUtils.getWorkspaceRoot();
            if (!workspaceRoot) {
                this.logger.error('No workspace root found');
                return false;
            }
            remotePath = pathUtils_1.PathUtils.toRemotePath(localPath, workspaceRoot, this.config.remotePath);
        }
        const fileName = path.basename(localPath);
        // Use global ignore patterns from config
        if (pathUtils_1.PathUtils.shouldIgnoreFile(localPath, this.config.ignore)) {
            this.logger.info(`Ignoring file based on config: ${fileName}`);
            return true;
        }
        const uploadTask = {
            localPath,
            remotePath,
            retries: 0,
            timestamp: new Date()
        };
        // Add to queue
        this.uploadQueue.push(uploadTask);
        this.logger.info(`Queued for upload: ${fileName}`);
        // If not connected, attempt connection (which will then process the queue)
        if (!this.isConnected()) {
            this.connect();
            return true; // Return true as it's queued
        }
        // If connected, trigger queue processing immediately
        this.processUploadQueue();
        return true; // Return true as it's queued or being processed
    }
    async processUploadQueue() {
        if (this.isProcessingQueue || this.uploadQueue.length === 0) {
            return true;
        }
        if (!this.isConnected()) {
            this.logger.warn('Cannot process upload queue: Not connected.');
            this.connect(); // Attempt to connect
            return false;
        }
        this.isProcessingQueue = true;
        let overallSuccess = true;
        while (this.uploadQueue.length > 0) {
            // Check connection at the start of each iteration
            if (!this.isConnected()) {
                this.logger.warn('Connection lost during upload queue processing.');
                this.isProcessingQueue = false;
                this.connect(); // Attempt reconnect
                return false; // Stop processing this round
            }
            const task = this.uploadQueue.shift();
            const fileName = path.basename(task.localPath);
            try {
                this.statusManager.showUploadProgress(fileName);
                const remoteDir = pathUtils_1.PathUtils.getDirectoryPath(task.remotePath);
                await this.ensureRemoteDirectory(remoteDir); // Ensure directory exists
                // Check connection again right before upload
                if (!this.isConnected())
                    throw new Error('Connection lost before upload');
                this.logger.info(`Uploading ${task.localPath} to ${task.remotePath}`);
                await this.client.uploadFrom(task.localPath, task.remotePath);
                this.statusManager.showUploadSuccess(fileName);
            }
            catch (error) {
                task.retries++;
                this.handleFTPError(error, `Upload attempt ${task.retries} for ${fileName}`);
                if (task.retries < this.maxRetries && !this.client?.closed) { // Only retry if connection seems okay
                    this.logger.warn(`Retrying upload for ${fileName} (${task.retries}/${this.maxRetries})`);
                    this.uploadQueue.unshift(task); // Add back to the front of the queue
                    // Add a small delay before retrying the same file
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay / 2));
                }
                else {
                    this.logger.error(`Upload failed permanently for ${fileName}: ${error.message}`);
                    this.statusManager.showUploadError(fileName, error.message);
                    overallSuccess = false;
                    // Do not re-queue if max retries reached or connection is closed
                }
                // If a connection error occurred, break the loop to allow reconnect
                if (this.client?.closed) {
                    break;
                }
            }
        }
        this.isProcessingQueue = false;
        // Update status bar only if queue is empty and no other operation is running
        if (this.uploadQueue.length === 0) {
            this.statusManager.updateStatusBar();
        }
        return overallSuccess;
    }
    async deleteFile(remotePath) {
        const operation = 'deleteFile';
        if (!await this.checkConnection(operation))
            return false;
        if (!this.config) {
            this.logger.error('No FTP configuration found for deletion');
            return false;
        }
        const fileName = path.basename(remotePath);
        this.logger.info(`Attempting to delete remote file: ${remotePath}`);
        try {
            await this.client.remove(remotePath);
            this.logger.success(`Successfully deleted remote file: ${fileName}`);
            return true;
        }
        catch (error) {
            // Handle 550 (Not Found) gracefully
            if (error instanceof basic_ftp_1.FTPError && error.code === 550) {
                this.logger.warn(`Remote file not found or deletion failed (550): ${fileName}`);
                return true; // Treat as success as the file is gone
            }
            else {
                this.handleFTPError(error, `delete remote file ${fileName}`);
                return false;
            }
        }
    }
    async deleteDirectory(remotePath) {
        const operation = 'deleteDirectory';
        if (!await this.checkConnection(operation))
            return false;
        if (!this.config) {
            this.logger.error('No FTP configuration found for directory deletion');
            return false;
        }
        const dirName = path.basename(remotePath);
        this.logger.info(`Attempting to delete remote directory recursively: ${remotePath}`);
        try {
            await this.client.removeDir(remotePath);
            this.logger.success(`Successfully deleted remote directory: ${dirName}`);
            return true;
        }
        catch (error) {
            // Handle 550 (Not Found) gracefully
            if (error instanceof basic_ftp_1.FTPError && error.code === 550) {
                this.logger.warn(`Remote directory not found or deletion failed (550): ${dirName}`);
                return true; // Treat as success as the directory is gone
            }
            else {
                this.handleFTPError(error, `delete remote directory ${dirName}`);
                return false;
            }
        }
    }
    // --- REVISED: Server-to-Local Sync Logic ---
    async syncServerToLocal(localFolderPath, remoteFolderPath) {
        const operation = 'syncServerToLocal';
        if (this.isSyncingOrDownloading) {
            this.logger.warn('Sync/Download already in progress. Skipping new sync request.');
            vscode.window.showWarningMessage('Another Sync or Download operation is already in progress.');
            return;
        }
        if (!await this.checkConnection(operation)) {
            this.statusManager.showSyncError(`Sync failed: ${path.basename(localFolderPath)}`, 'Connection failed');
            return;
        }
        if (!this.config) {
            this.logger.error('No FTP configuration found for sync');
            this.statusManager.showSyncError(`Sync failed: ${path.basename(localFolderPath)}`, 'No configuration');
            return;
        }
        this.isSyncingOrDownloading = true;
        this.logger.info(`Starting sync: Remote ${remoteFolderPath} -> Local ${localFolderPath}`);
        this.statusManager.showSyncProgress(`Syncing ${path.basename(localFolderPath)}...`);
        try {
            await this._recursiveSync(localFolderPath, remoteFolderPath);
            this.logger.success(`Sync completed successfully for: ${localFolderPath}`);
            this.statusManager.showSyncSuccess(`Synced ${path.basename(localFolderPath)}`);
        }
        catch (error) {
            // Error handling within _recursiveSync or here?
            // handleFTPError might have already triggered reconnect if needed.
            this.logger.error(`Sync failed for ${localFolderPath}`, error);
            this.statusManager.showSyncError(`Sync failed: ${path.basename(localFolderPath)}`, error.message);
        }
        finally {
            this.isSyncingOrDownloading = false;
            this.statusManager.updateStatusBar();
        }
    }
    async _recursiveSync(localFolderPath, remoteFolderPath) {
        // Check connection at the start of each recursive call
        if (!this.isConnected()) {
            throw new Error('Connection lost during recursive sync.');
        }
        this.logger.info(`_recursiveSync: Processing remote: ${remoteFolderPath}`);
        let remoteItems = [];
        try {
            remoteItems = await this.client.list(remoteFolderPath);
            this.logger.info(`_recursiveSync: Found ${remoteItems.length} items in ${remoteFolderPath}`);
        }
        catch (error) {
            if (error instanceof basic_ftp_1.FTPError && error.code === 550) {
                this.logger.warn(`_recursiveSync: Remote directory not found, skipping: ${remoteFolderPath}`);
                return; // Directory doesn't exist, nothing to sync from it
            }
            else {
                this.handleFTPError(error, `list remote directory ${remoteFolderPath}`);
                throw error; // Rethrow other errors
            }
        }
        // Ensure local directory exists
        try {
            await fs.promises.mkdir(localFolderPath, { recursive: true });
        }
        catch (error) {
            this.logger.error(`_recursiveSync: Failed to create local directory ${localFolderPath}`, error);
            throw error; // Cannot proceed if local dir creation fails
        }
        // Get local items for comparison
        let localItemStats = {};
        try {
            const files = await fs.promises.readdir(localFolderPath, { withFileTypes: true });
            for (const file of files) {
                const fullPath = path.join(localFolderPath, file.name);
                if (pathUtils_1.PathUtils.shouldIgnoreFile(fullPath, this.config?.ignore))
                    continue;
                try {
                    const stats = await fs.promises.stat(fullPath);
                    localItemStats[file.name] = {
                        path: fullPath,
                        isDirectory: file.isDirectory(),
                        mtimeMs: stats.mtimeMs,
                        size: stats.size
                    };
                }
                catch (statError) {
                    this.logger.warn(`_recursiveSync: Could not stat local item, skipping: ${fullPath}. Error: ${statError.message}`);
                }
            }
        }
        catch (error) {
            this.logger.error(`_recursiveSync: Failed to read local directory ${localFolderPath}`, error);
            throw error;
        }
        // Process remote items
        for (const remoteItem of remoteItems) {
            if (!this.isConnected())
                throw new Error('Connection lost during sync processing.');
            if (remoteItem.name === '.' || remoteItem.name === '..')
                continue;
            const currentLocalPath = path.join(localFolderPath, remoteItem.name);
            const currentRemotePath = path.posix.join(remoteFolderPath, remoteItem.name);
            if (pathUtils_1.PathUtils.shouldIgnoreFile(currentLocalPath, this.config?.ignore)) {
                this.logger.info(`_recursiveSync: Ignoring ${currentRemotePath}`);
                continue;
            }
            const localStats = localItemStats[remoteItem.name];
            if (remoteItem.isDirectory) {
                this.logger.info(`_recursiveSync: Processing remote directory: ${currentRemotePath}`);
                if (!localStats || !localStats.isDirectory) {
                    this.logger.info(`Sync: Creating local directory: ${currentLocalPath}`);
                    try {
                        await fs.promises.mkdir(currentLocalPath, { recursive: true });
                    }
                    catch (mkdirError) {
                        this.logger.error(`Sync: Failed to create local directory ${currentLocalPath}`, mkdirError);
                        continue; // Skip recursion if dir creation fails
                    }
                }
                await this._recursiveSync(currentLocalPath, currentRemotePath);
            }
            else if (remoteItem.isFile) {
                this.logger.info(`_recursiveSync: Processing remote file: ${currentRemotePath}`);
                let shouldDownload = false;
                let reason = '';
                if (!localStats) {
                    shouldDownload = true;
                    reason = 'Local file missing';
                }
                else if (localStats.isDirectory) {
                    this.logger.warn(`Sync: Local item is a directory, but remote is a file. Skipping: ${currentLocalPath}`);
                    continue;
                }
                else {
                    const remoteMtime = remoteItem.modifiedAt;
                    if (!remoteMtime) {
                        this.logger.warn(`Sync: Remote item has no modification time, cannot compare: ${currentRemotePath}. Downloading anyway.`);
                        shouldDownload = true;
                        reason = 'Remote mtime missing';
                    }
                    else {
                        const remoteMtimeMs = remoteMtime.getTime();
                        const localMtimeMs = localStats.mtimeMs;
                        const remoteSize = remoteItem.size;
                        const localSize = localStats.size;
                        // Add a tolerance for modification time comparison (e.g., 2 seconds)
                        const timeTolerance = 2000;
                        this.logger.info(`Sync Compare: ${remoteItem.name} | Remote mtime: ${remoteMtime.toISOString()} (${remoteMtimeMs}), Size: ${remoteSize} | Local mtime: ${new Date(localMtimeMs).toISOString()} (${localMtimeMs}), Size: ${localSize}`);
                        // Download if remote is significantly newer OR if sizes differ
                        if (remoteMtimeMs > localMtimeMs + timeTolerance) {
                            shouldDownload = true;
                            reason = `Remote file newer (mtime: ${remoteMtimeMs} > ${localMtimeMs + timeTolerance})`;
                        }
                        else if (remoteSize !== undefined && remoteSize !== localSize) {
                            shouldDownload = true;
                            reason = `File sizes differ (remote: ${remoteSize}, local: ${localSize})`;
                        }
                        else {
                            this.logger.info(`Sync: Local file is up-to-date or newer: ${currentLocalPath}`);
                        }
                    }
                }
                if (shouldDownload) {
                    this.logger.info(`Sync: Downloading: ${currentRemotePath} -> ${currentLocalPath}. Reason: ${reason}`);
                    try {
                        await fs.promises.mkdir(path.dirname(currentLocalPath), { recursive: true });
                        this.statusManager.showSyncProgress(`Downloading ${remoteItem.name}`);
                        // Check connection right before download
                        if (!this.isConnected())
                            throw new Error('Connection lost before download');
                        await this.client.downloadTo(currentLocalPath, currentRemotePath);
                        this.logger.success(`Sync: Downloaded ${currentRemotePath} to ${currentLocalPath}`);
                    }
                    catch (downloadError) {
                        this.handleFTPError(downloadError, `download ${currentRemotePath} during sync`);
                        // If connection lost, the error handler should trigger reconnect, and the outer loop will catch it.
                        // Don't rethrow here unless we want to abort the entire sync immediately.
                        this.logger.error(`Sync: Failed to download ${currentRemotePath}. Skipping file.`);
                    }
                }
            }
            else {
                this.logger.warn(`Sync: Skipping unknown remote item type: ${remoteItem.name} (${remoteItem.type}) in ${remoteFolderPath}`);
            }
        }
        this.logger.info(`_recursiveSync: Finished processing remote: ${remoteFolderPath}`);
    }
    // --- END: REVISED Sync Logic ---
    // --- NEW: Download Remote Path Logic ---
    async downloadRemotePath(localFolderPath, remoteFolderPath) {
        const operation = 'downloadRemotePath';
        if (this.isSyncingOrDownloading) {
            this.logger.warn('Sync/Download already in progress. Skipping new download request.');
            vscode.window.showWarningMessage('Another Sync or Download operation is already in progress.');
            return;
        }
        if (!await this.checkConnection(operation)) {
            this.statusManager.showDownloadError(`Download failed: ${path.basename(localFolderPath)}`, 'Connection failed');
            return;
        }
        if (!this.config) {
            this.logger.error('No FTP configuration found for download');
            this.statusManager.showDownloadError(`Download failed: ${path.basename(localFolderPath)}`, 'No configuration');
            return;
        }
        this.isSyncingOrDownloading = true;
        this.logger.info(`Starting download: Remote ${remoteFolderPath} -> Local ${localFolderPath}`);
        this.statusManager.showDownloadProgress(`Downloading ${path.basename(localFolderPath)}...`);
        try {
            // Use basic-ftp's downloadToDir which handles recursion and overwriting
            this.logger.info(`Downloading remote directory ${remoteFolderPath} to local ${localFolderPath}`);
            await this.client.downloadToDir(localFolderPath, remoteFolderPath);
            this.logger.success(`Download completed successfully for: ${localFolderPath}`);
            this.statusManager.showDownloadSuccess(`Downloaded ${path.basename(localFolderPath)}`);
        }
        catch (error) {
            this.handleFTPError(error, `download remote path ${remoteFolderPath}`);
            this.statusManager.showDownloadError(`Download failed: ${path.basename(localFolderPath)}`, error.message);
        }
        finally {
            this.isSyncingOrDownloading = false;
            this.statusManager.updateStatusBar(); // Reset status bar
        }
    }
    // --- END: Download Remote Path Logic ---
    async ensureRemoteDirectory(remotePath) {
        const operation = 'ensureRemoteDirectory';
        if (!await this.checkConnection(operation))
            return;
        if (!this.client || !remotePath || remotePath === '/' || remotePath === '.') {
            return;
        }
        try {
            // ensureDir handles nested directory creation
            await this.client.ensureDir(remotePath);
        }
        catch (error) {
            this.handleFTPError(error, `ensure remote directory ${remotePath}`);
            // Rethrow to signal failure to the calling function (e.g., upload)
            throw error;
        }
    }
    scheduleReconnect() {
        // Don't schedule if already connecting or another timer is set
        if (this.connectionStatus.connecting || this.reconnectTimer) {
            return;
        }
        // Don't schedule if disconnect was intentional (client is null)
        if (this.client === null && !this.connectionStatus.error) {
            return;
        }
        this.logger.info(`Scheduling reconnect in ${this.retryDelay / 1000} seconds...`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null; // Clear timer before attempting connect
            if (!this.isConnected() && !this.connectionStatus.connecting) { // Check again before connecting
                this.logger.info('Attempting scheduled reconnect...');
                this.connect();
            }
            else {
                this.logger.info('Reconnect cancelled (already connected or connecting).');
            }
        }, this.retryDelay);
    }
    startHeartbeat() {
        // Basic-ftp handles keep-alive implicitly for FTP. For SFTP it might be needed.
        // For now, rely on operations or reconnect logic to detect stale connections.
        this.logger.info('Heartbeat check: Not implemented (relying on operation errors/reconnect).');
    }
    dispose() {
        this.disconnect();
    }
}
exports.FTPManager = FTPManager;
//# sourceMappingURL=ftpManager.js.map