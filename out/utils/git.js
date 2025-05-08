"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBranchName = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
let workspace;
// Use real vscode in extension, mock in tests
if (process.env.NODE_ENV === 'test') {
    const mock = require('../test/mocks/vscode.mock');
    workspace = mock.workspace;
}
else {
    const vscode = require('vscode');
    workspace = vscode.workspace;
}
async function getBranchName() {
    try {
        const workspaceFolders = workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('No workspace folder found');
        }
        const { stdout } = await execAsync('git branch --show-current', {
            cwd: workspaceFolders[0].uri.fsPath
        });
        return stdout.trim();
    }
    catch (error) {
        throw new Error(`Failed to get branch name: ${error.message}`);
    }
}
exports.getBranchName = getBranchName;
//# sourceMappingURL=git.js.map