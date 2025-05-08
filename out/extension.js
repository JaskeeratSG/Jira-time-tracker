"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const JiraTimeLogger_1 = require("./JiraTimeLogger");
const CommandPanel_1 = require("./ui/CommandPanel");
const TimeTrackerSidebarProvider_1 = require("./ui/TimeTrackerSidebarProvider");
// Create output channel
let outputChannel;
function activate(context) {
    try {
        // Create output channel
        outputChannel = vscode.window.createOutputChannel('Jira Time Tracker');
        outputChannel.appendLine('Jira Time Tracker extension activated');
        outputChannel.show(true); // Force show the output channel
        const timeLogger = new JiraTimeLogger_1.JiraTimeLogger();
        outputChannel.appendLine('JiraTimeLogger instance created');
        // Register sidebar provider
        const sidebarProvider = new TimeTrackerSidebarProvider_1.TimeTrackerSidebarProvider(context.extensionUri, timeLogger);
        context.subscriptions.push(vscode.window.registerWebviewViewProvider(TimeTrackerSidebarProvider_1.TimeTrackerSidebarProvider.viewType, sidebarProvider));
        outputChannel.appendLine('Sidebar provider registered');
        let startTimer = vscode.commands.registerCommand('jira-time-logger.startTimer', () => {
            outputChannel.appendLine('Start timer command executed');
            timeLogger.startTimer();
        });
        let stopTimer = vscode.commands.registerCommand('jira-time-logger.stopTimer', () => {
            outputChannel.appendLine('Stop timer command executed');
            timeLogger.stopTimer();
        });
        let resumeTimer = vscode.commands.registerCommand('jira-time-logger.resumeTimer', () => {
            outputChannel.appendLine('Resume timer command executed');
            timeLogger.resumeTimer();
        });
        let finishAndLog = vscode.commands.registerCommand('jira-time-logger.finishAndLog', () => {
            outputChannel.appendLine('Finish and log command executed');
            timeLogger.finishAndLog();
        });
        let showCommandPanel = vscode.commands.registerCommand('jira-time-tracker.showCommandPanel', () => {
            outputChannel.appendLine('Show command panel command executed');
            CommandPanel_1.CommandPanel.show(context, timeLogger);
        });
        context.subscriptions.push(startTimer, stopTimer, resumeTimer, finishAndLog, showCommandPanel);
        context.subscriptions.push(outputChannel);
        outputChannel.appendLine('All commands registered successfully');
    }
    catch (error) {
        // If output channel is not available, try to show error in status bar
        vscode.window.showErrorMessage('Failed to initialize Jira Time Tracker: ' + error.message);
        console.error('Failed to initialize Jira Time Tracker:', error);
    }
}
exports.activate = activate;
function deactivate() {
    if (outputChannel) {
        outputChannel.appendLine('Jira Time Tracker extension deactivated');
        outputChannel.dispose();
    }
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map