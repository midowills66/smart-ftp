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
exports.StatusManager = void 0;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
class StatusManager {
    constructor() {
        this.logger = logger_1.Logger.getInstance();
        this.connectionStatus = {
            connected: false,
            connecting: false
        };
        this.currentOperation = 'none';
        this.operationText = '';
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.name = "Smart FTP Status";
        this.statusBarItem.command = 'smartftp.connect';
        this.updateStatusBar();
        this.statusBarItem.show();
    }
    static getInstance() {
        if (!StatusManager.instance) {
            StatusManager.instance = new StatusManager();
        }
        return StatusManager.instance;
    }
    updateConnectionStatus(status) {
        this.connectionStatus = status;
        // Only update status bar if no other operation is in progress
        if (this.currentOperation === 'none') {
            this.updateStatusBar();
        }
        // Log connection events regardless of ongoing operations
        if (status.connected) {
            this.logger.success('Connected to FTP server');
        }
        else if (status.connecting) {
            this.logger.info('Connecting to FTP server...');
        }
        else if (status.error) {
            this.logger.error(`Connection failed: ${status.error}`);
            this.logger.show();
        }
    }
    updateStatusBar() {
        // Prioritize showing operation status if one is active
        if (this.currentOperation !== 'none') {
            this.statusBarItem.text = this.operationText;
            // Use default colors during operations unless it's an error state related to the operation?
            // For now, keep default colors during operations.
            this.statusBarItem.color = undefined;
            this.statusBarItem.backgroundColor = undefined;
            this.statusBarItem.tooltip = this.operationText; // Simple tooltip during operation
            this.statusBarItem.command = undefined; // No command during operation
            return;
        }
        // Otherwise, show connection status
        if (this.connectionStatus.connected) {
            this.statusBarItem.text = '$(check) Smart FTP: Connected';
            this.statusBarItem.color = '#90EE90'; // Light Green
            this.statusBarItem.backgroundColor = undefined;
            this.statusBarItem.tooltip = `Smart FTP: Connected to ${this.connectionStatus.host || 'server'}\nLast connected: ${this.connectionStatus.lastConnected?.toLocaleString()}\nClick to disconnect`;
            this.statusBarItem.command = 'smartftp.disconnect';
        }
        else if (this.connectionStatus.connecting) {
            this.statusBarItem.text = '$(sync~spin) Smart FTP: Connecting...';
            this.statusBarItem.color = undefined;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            this.statusBarItem.tooltip = 'Smart FTP: Connecting to server...';
            this.statusBarItem.command = undefined;
        }
        else {
            this.statusBarItem.text = '$(x) Smart FTP: Disconnected';
            this.statusBarItem.color = undefined;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            this.statusBarItem.tooltip = this.connectionStatus.error ? `Smart FTP: Connection Error: ${this.connectionStatus.error}\nClick to connect` : 'Smart FTP: Click to connect to server';
            this.statusBarItem.command = 'smartftp.connect';
        }
    }
    // --- Upload Status --- 
    showUploadProgress(fileName, progress) {
        this.currentOperation = 'upload';
        if (progress !== undefined) {
            this.operationText = `$(cloud-upload) Uploading ${fileName} (${Math.round(progress)}%)`;
        }
        else {
            this.operationText = `$(cloud-upload) Uploading ${fileName}...`;
        }
        this.updateStatusBar();
    }
    showUploadSuccess(fileName) {
        this.logger.success(`Uploaded: ${fileName}`);
        // Check if queue is empty before resetting status?
        // For now, assume ftpManager calls updateStatusBar when queue is done.
        // If this was the last upload, reset status
        // if (ftpManager.isQueueEmpty()) { // Need a way to check this
        this.currentOperation = 'none';
        this.operationText = '';
        this.updateStatusBar();
        // }
    }
    showUploadError(fileName, error) {
        this.logger.error(`Upload failed for ${fileName}: ${error}`);
        // Reset status after showing error? Or keep showing error?
        // Let's reset to connection status after an error.
        this.currentOperation = 'none';
        this.operationText = '';
        this.updateStatusBar();
        this.logger.show();
    }
    // --- Sync Status --- 
    showSyncProgress(message) {
        this.currentOperation = 'sync';
        this.operationText = `$(sync~spin) ${message}`; // Use sync icon
        this.updateStatusBar();
    }
    showSyncSuccess(message) {
        this.logger.success(`Sync Success: ${message}`);
        this.currentOperation = 'none';
        this.operationText = '';
        this.updateStatusBar();
        // Optional: Show temporary success message?
        // vscode.window.setStatusBarMessage(`$(check) ${message}`, 5000); 
    }
    showSyncError(message, error) {
        this.logger.error(`Sync Error: ${message}: ${error}`);
        this.currentOperation = 'none';
        this.operationText = '';
        this.updateStatusBar();
        this.logger.show();
    }
    // --- Download Status --- 
    showDownloadProgress(message) {
        this.currentOperation = 'download';
        this.operationText = `$(cloud-download) ${message}`; // Use download icon
        this.updateStatusBar();
    }
    showDownloadSuccess(message) {
        this.logger.success(`Download Success: ${message}`);
        this.currentOperation = 'none';
        this.operationText = '';
        this.updateStatusBar();
        // Optional: Show temporary success message?
        // vscode.window.setStatusBarMessage(`$(check) ${message}`, 5000);
    }
    showDownloadError(message, error) {
        this.logger.error(`Download Error: ${message}: ${error}`);
        this.currentOperation = 'none';
        this.operationText = '';
        this.updateStatusBar();
        this.logger.show();
    }
    // --- General Notifications --- 
    showNotification(message, type = 'info') {
        const displayMessage = message.startsWith('Connected to') || message.startsWith('Disconnected from')
            ? message.replace('FTP', 'Smart FTP:')
            : `Smart FTP: ${message}`;
        if (message.startsWith('Connected to') || message.startsWith('Disconnected from')) {
            // Let connection status updates handle these implicitly via status bar
            // vscode.window.showInformationMessage(displayMessage);
        }
        else {
            switch (type) {
                case 'info':
                    this.logger.info(displayMessage);
                    // vscode.window.showInformationMessage(displayMessage);
                    break;
                case 'warning':
                    this.logger.warn(displayMessage);
                    vscode.window.showWarningMessage(displayMessage);
                    break;
                case 'error':
                    this.logger.error(displayMessage);
                    vscode.window.showErrorMessage(displayMessage);
                    break;
            }
            if (type === 'error' || type === 'warning') {
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
}
exports.StatusManager = StatusManager;
//# sourceMappingURL=statusManager.js.map