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
exports.PathUtils = void 0;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs")); // Import fs for isDirectory
class PathUtils {
    /**
     * Convert local file path to remote FTP path
     */
    static toRemotePath(localPath, workspaceRoot, remotePath) {
        const relativePath = path.relative(workspaceRoot, localPath);
        // Always use forward slashes for remote paths
        const normalizedPath = relativePath.replace(/\\/g, '/');
        return path.posix.join(remotePath, normalizedPath);
    }
    /**
     * Get workspace root path
     */
    static getWorkspaceRoot() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
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
        return ftpPath.replace(/\\/g, '/').replace(/\/+/g, '/');
    }
    /**
     * Get directory path from file path
     */
    static getDirectoryPath(filePath) {
        // Use path.posix.dirname for remote paths which use forward slashes
        return path.posix.dirname(filePath.replace(/\\/g, '/'));
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
            '.git',
            '.vscode',
            'node_modules',
            '.DS_Store',
            'Thumbs.db',
            '.env',
            '*.log',
            'smartftp.json' // Ignore the config file itself
        ];
        const allPatterns = [...defaultIgnores, ...(ignorePatterns || [])]; // Ensure ignorePatterns is array
        // Check against basename and full path relative to workspace root
        const workspaceRoot = this.getWorkspaceRoot();
        const relativePath = workspaceRoot ? path.relative(workspaceRoot, filePath).replace(/\\/g, '/') : fileName;
        return allPatterns.some(pattern => {
            if (!pattern)
                return false; // Skip empty patterns
            // Simple name match
            if (fileName === pattern || relativePath === pattern) {
                return true;
            }
            // Glob matching (basic)
            if (pattern.includes('*')) {
                try {
                    // Convert glob to regex (simple conversion)
                    const regexPattern = pattern
                        .replace(/\./g, '\\.') // Escape dots
                        .replace(/\*\*/g, '.+') // Match multiple directories
                        .replace(/\*/g, '[^/]*'); // Match anything except slash
                    const regex = new RegExp(`^${regexPattern}$`);
                    return regex.test(fileName) || regex.test(relativePath);
                }
                catch (e) {
                    console.error(`Invalid ignore pattern regex: ${pattern}`, e);
                    return false;
                }
            }
            // Directory check
            if (pattern.endsWith('/') && (relativePath + '/').startsWith(pattern)) {
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
        }
        catch (e) {
            // If stat fails (e.g., path doesn't exist), it's not a directory
            return false;
        }
    }
    /**
     * NEW: Get the base name of a path
     */
    static basename(fsPath) {
        return path.basename(fsPath);
    }
}
exports.PathUtils = PathUtils;
//# sourceMappingURL=pathUtils.js.map