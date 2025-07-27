import * as vscode from 'vscode';
import { JiraTimeLogger } from '../JiraTimeLogger';

export class CommandPanel {
    private static readonly viewType = 'jiraTimeTracker.commandPanel';
    private static currentPanel: CommandPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _timeLogger: JiraTimeLogger;
    private _updateInterval: NodeJS.Timer | undefined;

    private constructor(panel: vscode.WebviewPanel, timeLogger: JiraTimeLogger) {
        this._panel = panel;
        this._timeLogger = timeLogger;
        
        this._panel.webview.html = this._getWebviewContent();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        
        // Set up interval to update timer
        this._updateInterval = setInterval(() => {
            this._updateStatus();
        }, 1000);

        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'startTracking':
                        await vscode.commands.executeCommand('jira-time-logger.startTimer');
                        break;
                    case 'stopTracking':
                        await vscode.commands.executeCommand('jira-time-logger.stopTimer');
                        break;
                    case 'resumeTracking':
                        await vscode.commands.executeCommand('jira-time-logger.resumeTimer');
                        break;
                    case 'submitTime':
                        await vscode.commands.executeCommand('jira-time-logger.finishAndLog');
                        break;
                    case 'manualTimeSubmit':
                        if (message.timeSpent && message.ticket) {
                            try {
                                await this._timeLogger.logTime(message.ticket, message.timeSpent);
                                vscode.window.showInformationMessage(`Time logged successfully for ${message.ticket}`);
                                // Clear the input fields after successful submission
                                this._panel.webview.postMessage({
                                    type: 'clear-manual-inputs'
                                });
                            } catch (error) {
                                vscode.window.showErrorMessage(`Failed to log time: ${error}`);
                            }
                        } else {
                            vscode.window.showErrorMessage('Please provide both ticket and time spent');
                        }
                        break;
                    case 'loadProjectIssues':
                        try {
                            // For smart search, we don't need to load all issues initially
                            this._panel.webview.postMessage({
                                type: 'issues-update',
                                issues: []
                            });
                        } catch (error) {
                            vscode.window.showErrorMessage(`Failed to load project: ${error}`);
                        }
                        break;
                }
                await this._updateStatus();
            },
            null,
            this._disposables
        );
    }

    private async _updateStatus() {
        const isTracking = this._timeLogger.isTracking();
        const currentTime = this._timeLogger.getCurrentTrackedTime();
        const recentTickets = await this._timeLogger.getRecentTickets();
        const projects = await this._timeLogger.jiraService.getProjects();

        this._panel.webview.postMessage({
            type: 'status-update',
            isTracking,
            currentTime,
            recentTickets,
            projects
        });
    }

    public static show(context: vscode.ExtensionContext, timeLogger: JiraTimeLogger) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (CommandPanel.currentPanel) {
            CommandPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            CommandPanel.viewType,
            'Jira Time Tracker',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        CommandPanel.currentPanel = new CommandPanel(panel, timeLogger);
    }

    private _getWebviewContent() {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Jira Time Tracker</title>
            <style>
                body {
                    padding: 20px;
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    font-family: var(--vscode-font-family);
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                }
                .status-container {
                    margin: 20px 0;
                    padding: 10px;
                    border-radius: 4px;
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                }
                .timer {
                    font-size: 2em;
                    text-align: center;
                    margin: 10px 0;
                }
                .button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    margin: 5px;
                    cursor: pointer;
                    border-radius: 4px;
                }
                .button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .button-container {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    margin: 20px 0;
                }
                .manual-input {
                    margin: 20px 0;
                    padding: 15px;
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                }
                .input-field {
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    padding: 5px;
                    margin: 5px 0;
                    width: 100%;
                }
                .recent-tickets {
                    margin: 20px 0;
                }
                .ticket-item {
                    padding: 8px;
                    margin: 4px 0;
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    border-radius: 4px;
                    cursor: pointer;
                }
                .status-indicator {
                    display: inline-block;
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    margin-right: 10px;
                }
                .status-active {
                    background-color: #28a745;
                }
                .status-inactive {
                    background-color: #dc3545;
                }
                .select-field {
                    background: var(--vscode-dropdown-background);
                    color: var(--vscode-dropdown-foreground);
                    border: 1px solid var(--vscode-dropdown-border);
                    padding: 5px;
                    margin: 5px 0;
                    width: 100%;
                }
                .form-group {
                    margin-bottom: 15px;
                }
                .form-group label {
                    display: block;
                    margin-bottom: 5px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>Jira Time Tracker</h2>
                
                <div class="status-container">
                    <div>
                        Status: 
                        <span class="status-indicator" id="statusIndicator"></span>
                        <span id="statusText">Inactive</span>
                    </div>
                    <div class="timer" id="timer">00:00:00</div>
                </div>

                <div class="button-container">
                    <button class="button" onclick="startTracking()">Start Tracking</button>
                    <button class="button" onclick="stopTracking()">Stop Tracking</button>
                    <button class="button" onclick="resumeTracking()">Resume Tracking</button>
                    <button class="button" onclick="submitTime()">Submit Time</button>
                </div>

                <div class="manual-input">
                    <h3>Time Entry</h3>
                    <div class="form-group">
                        <label for="projectSelect">Project:</label>
                        <select id="projectSelect" class="select-field" onchange="loadProjectIssues()">
                            <option value="">Select Project</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="issueSelect">Issue:</label>
                        <select id="issueSelect" class="select-field">
                            <option value="">Select Issue</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="timeInput">Time Spent:</label>
                        <input type="text" id="timeInput" class="input-field" placeholder="Time (e.g., 1h 30m)">
                    </div>
                    <button class="button" onclick="submitManualTime()">Log Time</button>
                </div>

                <div class="recent-tickets">
                    <h3>Recent Tickets</h3>
                    <div id="ticketsList"></div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                let isTracking = false;
                let currentProjects = [];
                let currentIssues = [];

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.type) {
                        case 'status-update':
                            updateStatus(message.isTracking, message.currentTime);
                            updateRecentTickets(message.recentTickets);
                            if (message.projects) {
                                updateProjects(message.projects);
                            }
                            break;
                        case 'issues-update':
                            updateIssues(message.issues);
                            break;
                        case 'clear-manual-inputs':
                            document.getElementById('timeInput').value = '';
                            document.getElementById('issueSelect').value = '';
                            break;
                    }
                });

                function updateProjects(projects) {
                    currentProjects = projects;
                    const select = document.getElementById('projectSelect');
                    select.innerHTML = '<option value="">Select Project</option>' +
                        projects.map(project => 
                            \`<option value="\${project.key}">\${project.key} - \${project.name}</option>\`
                        ).join('');
                }

                function updateIssues(issues) {
                    currentIssues = issues;
                    const select = document.getElementById('issueSelect');
                    select.innerHTML = '<option value="">Select Issue</option>' +
                        issues.map(issue => 
                            \`<option value="\${issue.key}">\${issue.key} - \${issue.summary}</option>\`
                        ).join('');
                }

                async function loadProjectIssues() {
                    const projectKey = document.getElementById('projectSelect').value;
                    if (projectKey) {
                        vscode.postMessage({ 
                            command: 'loadProjectIssues',
                            projectKey
                        });
                    }
                }

                function submitManualTime() {
                    const issueKey = document.getElementById('issueSelect').value;
                    const timeSpent = document.getElementById('timeInput').value;
                    if (issueKey && timeSpent) {
                        vscode.postMessage({ 
                            command: 'manualTimeSubmit',
                            ticket: issueKey,
                            timeSpent: timeSpent
                        });
                    }
                }

                function updateStatus(tracking, time) {
                    isTracking = tracking;
                    const indicator = document.getElementById('statusIndicator');
                    const statusText = document.getElementById('statusText');
                    const timer = document.getElementById('timer');
                    
                    indicator.className = 'status-indicator ' + (tracking ? 'status-active' : 'status-inactive');
                    statusText.textContent = tracking ? 'Active' : 'Inactive';
                    timer.textContent = time || '00:00:00';
                }

                function updateRecentTickets(tickets) {
                    const ticketsList = document.getElementById('ticketsList');
                    ticketsList.innerHTML = tickets.map(ticket => 
                        \`<div class="ticket-item" onclick="selectTicket('\${ticket}')">\${ticket}</div>\`
                    ).join('');
                }

                function selectTicket(ticket) {
                    document.getElementById('ticketInput').value = ticket;
                }

                function startTracking() {
                    vscode.postMessage({ command: 'startTracking' });
                }

                function stopTracking() {
                    vscode.postMessage({ command: 'stopTracking' });
                }

                function resumeTracking() {
                    vscode.postMessage({ command: 'resumeTracking' });
                }

                function submitTime() {
                    vscode.postMessage({ command: 'submitTime' });
                }
            </script>
        </body>
        </html>`;
    }

    public dispose() {
        if (this._updateInterval) {
            clearInterval(this._updateInterval);
        }
        CommandPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
} 