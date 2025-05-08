import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let workspace: any;

// Use real vscode in extension, mock in tests
if (process.env.NODE_ENV === 'test') {
    const mock = require('../test/mocks/vscode.mock');
    workspace = mock.workspace;
} else {
    const vscode = require('vscode');
    workspace = vscode.workspace;
}

export async function getBranchName(): Promise<string> {
    try {
        const workspaceFolders = workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('No workspace folder found');
        }

        const { stdout } = await execAsync('git branch --show-current', {
            cwd: workspaceFolders[0].uri.fsPath
        });

        return stdout.trim();
    } catch (error) {
        throw new Error(`Failed to get branch name: ${(error as any).message}`);
    }
} 