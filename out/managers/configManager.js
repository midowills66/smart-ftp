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
exports.ConfigManager = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("../types/config");
const logger_1 = require("../utils/logger");
const pathUtils_1 = require("../utils/pathUtils");
class ConfigManager {
    constructor() {
        this.config = null;
        this.configPath = null;
        this.logger = logger_1.Logger.getInstance();
        this.configWatcher = null;
        this.onConfigChangedEmitter = new vscode.EventEmitter();
        this.onConfigChanged = this.onConfigChangedEmitter.event;
        this.configReloadDebounceTimer = null; // Added for debounce
        this.CONFIG_RELOAD_DELAY = 2000; // Delay in milliseconds (2 seconds)
    }
    static getInstance() {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }
    async initialize() {
        await this.loadConfig();
        this.setupConfigWatcher();
    }
    async createConfig() {
        const workspaceRoot = pathUtils_1.PathUtils.getWorkspaceRoot();
        if (!workspaceRoot) {
            this.logger.error('No workspace folder found. Please open a workspace first.');
            this.logger.show();
            return;
        }
        const configPath = path.join(workspaceRoot, 'smartftp.json');
        if (fs.existsSync(configPath)) {
            const overwrite = await vscode.window.showWarningMessage('smartftp.json already exists. Do you want to overwrite it?', 'Yes', 'No');
            if (overwrite !== 'Yes') {
                return;
            }
        }
        try {
            const configContent = JSON.stringify(config_1.DEFAULT_FTP_CONFIG, null, 2);
            fs.writeFileSync(configPath, configContent, 'utf8');
            this.logger.success(`Created Smart FTP configuration file: ${configPath}`);
            this.logger.info('Smart FTP configuration file created successfully!');
            this.logger.show();
            // Open the config file for editing
            const document = await vscode.workspace.openTextDocument(configPath);
            await vscode.window.showTextDocument(document);
            // Load config immediately after creation
            await this.loadConfig();
        }
        catch (error) {
            this.logger.error('Failed to create Smart FTP configuration file', error);
            this.logger.show();
        }
    }
    async loadConfig() {
        const workspaceRoot = pathUtils_1.PathUtils.getWorkspaceRoot();
        if (!workspaceRoot) {
            return null;
        }
        const configPath = path.join(workspaceRoot, 'smartftp.json');
        this.configPath = configPath;
        if (!fs.existsSync(configPath)) {
            this.logger.info('No smartftp.json configuration file found');
            if (this.config !== null) { // Only fire event if config state changes
                this.config = null;
                this.onConfigChangedEmitter.fire(null);
            }
            return null;
        }
        try {
            const configContent = fs.readFileSync(configPath, 'utf8');
            const parsedConfig = JSON.parse(configContent);
            // Validate required fields
            if (!this.validateConfig(parsedConfig)) {
                throw new Error('Invalid configuration format');
            }
            // Check if config actually changed before firing event
            if (JSON.stringify(this.config) !== JSON.stringify(parsedConfig)) {
                this.config = parsedConfig;
                this.logger.success(`Loaded Smart FTP configuration: ${parsedConfig.name || 'Default'}`);
                this.onConfigChangedEmitter.fire(this.config);
            }
            else {
                this.logger.info('Configuration file reloaded, but no changes detected.');
            }
            return this.config;
        }
        catch (error) {
            this.logger.error('Failed to load Smart FTP configuration. Please check smartftp.json format.', error);
            this.logger.show();
            if (this.config !== null) { // Only fire event if config state changes
                this.config = null;
                this.onConfigChangedEmitter.fire(null);
            }
            return null;
        }
    }
    validateConfig(config) {
        // Allow 'name' to be optional or empty
        const required = ['host', 'protocol', 'port', 'username', 'password', 'remotePath'];
        for (const field of required) {
            if (!(field in config) || config[field] === undefined || config[field] === '') {
                // Allow empty password if explicitly set to empty string
                if (field === 'password' && config[field] === '')
                    continue;
                this.logger.error(`Missing or empty required field in smartftp.json: ${field}`);
                return false;
            }
        }
        if (!['ftp', 'sftp'].includes(config.protocol)) {
            this.logger.error('Protocol must be either "ftp" or "sftp" in smartftp.json');
            return false;
        }
        if (typeof config.port !== 'number' || !Number.isInteger(config.port) || config.port <= 0 || config.port > 65535) {
            this.logger.error('Port must be an integer between 1 and 65535 in smartftp.json');
            return false;
        }
        // Add more specific validation as needed (e.g., watcher properties)
        return true;
    }
    setupConfigWatcher() {
        if (this.configWatcher) {
            this.configWatcher.dispose();
        }
        const workspaceRoot = pathUtils_1.PathUtils.getWorkspaceRoot();
        if (!workspaceRoot) {
            return;
        }
        const pattern = new vscode.RelativePattern(workspaceRoot, 'smartftp.json');
        this.configWatcher = vscode.workspace.createFileSystemWatcher(pattern);
        this.configWatcher.onDidChange(() => {
            this.logger.info('Smart FTP configuration file change detected. Debouncing reload...');
            // Clear existing timer if there is one
            if (this.configReloadDebounceTimer) {
                clearTimeout(this.configReloadDebounceTimer);
            }
            // Set a new timer to reload after a delay
            this.configReloadDebounceTimer = setTimeout(() => {
                this.logger.info('Reloading Smart FTP configuration now...');
                this.loadConfig();
                this.configReloadDebounceTimer = null;
            }, this.CONFIG_RELOAD_DELAY);
        });
        this.configWatcher.onDidCreate(() => {
            this.logger.info('Smart FTP configuration file created, loading immediately...');
            // Clear any pending reload debounce timer if the file is recreated
            if (this.configReloadDebounceTimer) {
                clearTimeout(this.configReloadDebounceTimer);
                this.configReloadDebounceTimer = null;
            }
            this.loadConfig();
        });
        this.configWatcher.onDidDelete(() => {
            this.logger.info('Smart FTP configuration file deleted');
            // Clear any pending reload debounce timer
            if (this.configReloadDebounceTimer) {
                clearTimeout(this.configReloadDebounceTimer);
                this.configReloadDebounceTimer = null;
            }
            if (this.config !== null) { // Only fire event if config state changes
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
        if (this.configReloadDebounceTimer) { // Clear timer on dispose
            clearTimeout(this.configReloadDebounceTimer);
        }
        this.onConfigChangedEmitter.dispose();
    }
}
exports.ConfigManager = ConfigManager;
//# sourceMappingURL=configManager.js.map