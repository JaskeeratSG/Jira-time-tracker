import * as vscode from 'vscode';
import { JiraTimeLogger } from './JiraTimeLogger';
import { CommandPanel } from './ui/CommandPanel';
import { TimeTrackerSidebarProvider } from './ui/TimeTrackerSidebarProvider';

// Create output channel
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    try {
        // Create output channel
        outputChannel = vscode.window.createOutputChannel('Jira Time Tracker');
        outputChannel.appendLine('Jira Time Tracker extension activated');
        outputChannel.show(true); // Force show the output channel
        
        const timeLogger = new JiraTimeLogger();
        outputChannel.appendLine('JiraTimeLogger instance created');

        // Register sidebar provider
        const sidebarProvider = new TimeTrackerSidebarProvider(context.extensionUri, timeLogger);
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(
                TimeTrackerSidebarProvider.viewType,
                sidebarProvider
            )
        );
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
            CommandPanel.show(context, timeLogger);
        });

        context.subscriptions.push(startTimer, stopTimer, resumeTimer, finishAndLog, showCommandPanel);
        context.subscriptions.push(outputChannel);
        
        outputChannel.appendLine('All commands registered successfully');
    } catch (error) {
        // If output channel is not available, try to show error in status bar
        vscode.window.showErrorMessage('Failed to initialize Jira Time Tracker: ' + (error as Error).message);
        console.error('Failed to initialize Jira Time Tracker:', error);
    }
}

export function deactivate() {
    if (outputChannel) {
        outputChannel.appendLine('Jira Time Tracker extension deactivated');
        outputChannel.dispose();
    }
} 