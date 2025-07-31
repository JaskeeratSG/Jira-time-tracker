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

// Create output channel - COMPLETELY DISABLED
export const createOutputChannel = (name: string): vscode.OutputChannel => {
    // Output channels are completely disabled - no messages at all
    return createSilentOutputChannel(name);
}; 