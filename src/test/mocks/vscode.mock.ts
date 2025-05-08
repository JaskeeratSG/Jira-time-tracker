export const workspace = {
    workspaceFolders: [{
        uri: {
            fsPath: process.cwd()
        }
    }]
};

export const window = {
    showErrorMessage: (message: string) => console.error(message),
    showInformationMessage: (message: string) => console.info(message),
    showWarningMessage: (message: string) => console.warn(message)
}; 