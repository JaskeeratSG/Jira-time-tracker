import * as vscode from 'vscode';

// Create a completely silent output channel that does absolutely nothing
const createSilentOutputChannel = (name: string): vscode.OutputChannel => ({
    name,
    append: () => {},
    appendLine: () => {},
    clear: () => {},
    show: () => {},
    hide: () => {},
    replace: () => {},
    dispose: () => {}
});

// Create output channel - DISABLED for time logging
export const createOutputChannel = (name: string): vscode.OutputChannel => {
    // Output channels are completely disabled for time logging
    return createSilentOutputChannel(name);
}; 