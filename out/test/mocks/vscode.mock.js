"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.window = exports.workspace = void 0;
exports.workspace = {
    workspaceFolders: [{
            uri: {
                fsPath: process.cwd()
            }
        }]
};
exports.window = {
    showErrorMessage: (message) => console.error(message),
    showInformationMessage: (message) => console.info(message),
    showWarningMessage: (message) => console.warn(message)
};
//# sourceMappingURL=vscode.mock.js.map