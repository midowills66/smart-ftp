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
exports.Logger = void 0;
const vscode = __importStar(require("vscode"));
class Logger {
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel("Smart FTP Log");
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    // Log general information messages without prefix
    info(message) {
        const timestamp = new Date().toLocaleString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }
    // Log error messages, keeping ERROR prefix for clarity
    error(message, error) {
        const timestamp = new Date().toLocaleString();
        this.outputChannel.appendLine(`[${timestamp}] ERROR: ${message}`);
        if (error) {
            // Use the same timestamp for related error details
            this.outputChannel.appendLine(`[${timestamp}] ERROR DETAILS: ${error.message}`);
            if (error.stack) {
                this.outputChannel.appendLine(`[${timestamp}] STACK: ${error.stack}`);
            }
        }
    }
    // Log warning messages, keeping WARN prefix for clarity
    warn(message) {
        const timestamp = new Date().toLocaleString();
        this.outputChannel.appendLine(`[${timestamp}] WARN: ${message}`);
    }
    // Log success messages without prefix
    success(message) {
        const timestamp = new Date().toLocaleString();
        // Keep SUCCESS prefix for upload confirmation as per user example
        if (message.startsWith('Uploaded:')) {
            this.outputChannel.appendLine(`[${timestamp}] SUCCESS: ${message}`);
        }
        else {
            this.outputChannel.appendLine(`[${timestamp}] ${message}`);
        }
    }
    show() {
        this.outputChannel.show();
    }
    dispose() {
        this.outputChannel.dispose();
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map