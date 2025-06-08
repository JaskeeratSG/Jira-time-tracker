"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeTrackerSidebarProvider = void 0;
const vscode = require("vscode");
const GitService_1 = require("../services/GitService");
class TimeTrackerSidebarProvider {
    constructor(_extensionUri, timeLogger) {
        this._extensionUri = _extensionUri;
        this._timeLogger = timeLogger;
        this._outputChannel = vscode.window.createOutputChannel('Jira Time Tracker');
        this._outputChannel.appendLine('TimeTrackerSidebarProvider initialized');
    }
    resolveWebviewView(webviewView, context, _token) {
        try {
            this._view = webviewView;
            this._outputChannel.appendLine('Sidebar view resolved');
            this._outputChannel.show(true); // Force show the output channel
            webviewView.webview.options = {
                enableScripts: true,
                localResourceRoots: [this._extensionUri]
            };
            webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
            this._outputChannel.appendLine('Webview HTML content set');
            this._setUpInterval();
            this._outputChannel.appendLine('Interval set up');
            // Load branch info immediately when sidebar loads
            this._loadBranchInfo();
            this._outputChannel.appendLine('Branch info loading initiated');
            webviewView.webview.onDidReceiveMessage(async (data) => {
                this._outputChannel.appendLine('Message received: ' + JSON.stringify(data, null, 2));
                try {
                    switch (data.type) {
                        case 'startTimer':
                            const issueKey = data.issueKey;
                            this._outputChannel.appendLine(`Starting timer for issue: ${issueKey}`);
                            await this._timeLogger.setCurrentIssue(issueKey);
                            await vscode.commands.executeCommand('jira-time-logger.startTimer');
                            this._showNotification(`Timer started for issue ${issueKey}`, 'success');
                            break;
                        case 'stopTimer':
                            this._outputChannel.appendLine('Stopping timer');
                            await vscode.commands.executeCommand('jira-time-logger.stopTimer');
                            this._showNotification('Timer stopped successfully!', 'info');
                            break;
                        case 'resumeTimer':
                            this._outputChannel.appendLine('Resuming timer');
                            await vscode.commands.executeCommand('jira-time-logger.resumeTimer');
                            this._showNotification('Timer resumed!', 'success');
                            break;
                        case 'submitTime':
                            if (!this._timeLogger.isTracking()) {
                                this._showNotification('No active timer to submit', 'error');
                                return;
                            }
                            this._outputChannel.appendLine('Submitting time');
                            await vscode.commands.executeCommand('jira-time-logger.finishAndLog');
                            this._showNotification('Time logged successfully!', 'success');
                            break;
                        case 'loadProjects':
                            try {
                                const email = data.email;
                                this._outputChannel.appendLine('Starting to load projects for email: ' + email);
                                // Validate email
                                if (!email) {
                                    this._outputChannel.appendLine('Error: No email provided');
                                    throw new Error('Please enter your Jira email');
                                }
                                // Get projects filtered by the user's email
                                this._outputChannel.appendLine('Calling getProjectsByUserEmail...');
                                const projects = await this._timeLogger.jiraService.getProjectsByUserEmail(email);
                                this._outputChannel.appendLine('Projects loaded successfully: ' + JSON.stringify(projects, null, 2));
                                // Send projects to webview
                                this._outputChannel.appendLine('Sending projects to webview...');
                                this._view?.webview.postMessage({
                                    type: 'projects',
                                    projects: projects
                                });
                                if (projects.length === 0) {
                                    this._outputChannel.appendLine('No projects found for user');
                                    this._showNotification('No projects assigned to this user', 'error');
                                }
                                else {
                                    this._outputChannel.appendLine(`Found ${projects.length} projects for user`);
                                    this._showNotification(`Projects loaded for ${email}`, 'success');
                                }
                            }
                            catch (error) {
                                this._outputChannel.appendLine('Failed to load projects: ' + error.message);
                                if (error.response) {
                                    this._outputChannel.appendLine('JIRA API Response: ' + JSON.stringify(error.response.data, null, 2));
                                }
                                this._showNotification('Failed to load projects: ' + error.message, 'error');
                                // Reset the button state
                                this._view?.webview.postMessage({
                                    type: 'load-failed'
                                });
                            }
                            break;
                        case 'loadIssues':
                            this._outputChannel.appendLine(`Loading issues for project: ${data.projectKey}`);
                            const issues = await this._timeLogger.jiraService.getProjectIssues(data.projectKey);
                            this._outputChannel.appendLine(`Issues loaded for project ${data.projectKey}: ` + JSON.stringify(issues, null, 2));
                            this._view?.webview.postMessage({
                                type: 'issues',
                                issues: issues
                            });
                            this._showNotification(`Issues loaded for project ${data.projectKey}`, 'info');
                            break;
                        case 'manualTimeLog':
                            this._outputChannel.appendLine('Manual time log received: ' + JSON.stringify(data, null, 2));
                            try {
                                if (!data.issueKey || !data.timeSpent) {
                                    this._showNotification('Please select an issue and enter time', 'error');
                                    return;
                                }
                                await this._timeLogger.logTime(data.issueKey, data.timeSpent);
                                this._showNotification(`Manually logged ${data.timeSpent} to ${data.issueKey}`, 'success');
                                // Clear the input field
                                this._view?.webview.postMessage({
                                    type: 'clear-manual-input'
                                });
                            }
                            catch (error) {
                                this._outputChannel.appendLine('Error logging manual time: ' + error.message);
                                this._showNotification(error.message, 'error');
                            }
                            break;
                        case 'loadBranchInfo':
                            try {
                                const branchInfo = await this._timeLogger.getBranchTicketInfo();
                                if (branchInfo) {
                                    this._outputChannel.appendLine('Branch info loaded: ' + JSON.stringify(branchInfo, null, 2));
                                    this._view?.webview.postMessage({
                                        type: 'branch-info',
                                        projectKey: branchInfo.projectKey,
                                        issueKey: branchInfo.issueKey
                                    });
                                    this._showNotification(`Loaded ticket from branch: ${branchInfo.issueKey}`, 'info');
                                }
                            }
                            catch (error) {
                                this._outputChannel.appendLine('Error loading branch info: ' + error.message);
                                this._showNotification('Failed to load branch info', 'error');
                            }
                            break;
                        case 'git-email':
                            this._view?.webview.postMessage({
                                type: 'git-email',
                                email: data.email
                            });
                            break;
                    }
                }
                catch (error) {
                    this._outputChannel.appendLine('Error handling message: ' + error.message);
                    this._showNotification(error.message, 'error');
                }
            });
        }
        catch (error) {
            this._outputChannel.appendLine('Error in resolveWebviewView: ' + error.message);
            vscode.window.showErrorMessage('Failed to initialize sidebar: ' + error.message);
        }
    }
    _showNotification(message, type) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'notification',
                message,
                notificationType: type
            });
        }
    }
    _setUpInterval() {
        setInterval(() => {
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'update',
                    time: this._timeLogger.getCurrentTrackedTime(),
                    isTracking: this._timeLogger.isTracking()
                });
            }
        }, 1000);
    }
    async _loadBranchInfo() {
        try {
            this._outputChannel.appendLine('Loading branch info...');
            const branchInfo = await this._timeLogger.getBranchTicketInfo();
            // Get Git email
            const gitService = new GitService_1.GitService();
            const gitEmail = await gitService.getUserEmail();
            // Send Git email to webview
            this._view?.webview.postMessage({
                type: 'git-email',
                email: gitEmail
            });
            if (branchInfo) {
                // Get projects for the current user's email
                const config = vscode.workspace.getConfiguration('jiraTimeTracker');
                const userEmail = config.get('jiraEmail');
                if (userEmail) {
                    this._outputChannel.appendLine('Loading projects for user email...');
                    const projects = await this._timeLogger.jiraService.getProjectsByUserEmail(userEmail);
                    this._outputChannel.appendLine('Projects loaded in branch info: ' + JSON.stringify(projects, null, 2));
                    this._view?.webview.postMessage({
                        type: 'projects',
                        projects: projects
                    });
                    // Then load issues for the project
                    this._outputChannel.appendLine(`Loading issues for project ${branchInfo.projectKey}...`);
                    const issues = await this._timeLogger.jiraService.getProjectIssues(branchInfo.projectKey);
                    this._outputChannel.appendLine(`Issues loaded for project ${branchInfo.projectKey}: ` + JSON.stringify(issues, null, 2));
                    this._view?.webview.postMessage({
                        type: 'issues',
                        issues: issues
                    });
                    // Finally set the selected values
                    this._view?.webview.postMessage({
                        type: 'branch-info',
                        projectKey: branchInfo.projectKey,
                        issueKey: branchInfo.issueKey
                    });
                    this._showNotification(`Loaded ticket from branch: ${branchInfo.issueKey}`, 'info');
                }
            }
        }
        catch (error) {
            this._outputChannel.appendLine('Error loading branch info: ' + error.message);
            this._showNotification('Failed to load branch info', 'error');
        }
    }
    _getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    padding: 16px;
                    color: var(--vscode-foreground);
                    font-family: var(--vscode-font-family);
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    max-width: 100%;
                    box-sizing: border-box;
                }
                .timer {
                    font-size: 1.5em;
                    text-align: center;
                    margin: 8px 0;
                    font-family: monospace;
                }
                .button {
                    width: 40px;
                    height: 40px;
                    padding: 8px;
                    margin: 0;
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                    position: relative;
                }
                .button:hover {
                    background: var(--vscode-button-hoverBackground);
                    transform: translateY(-1px);
                }
                .button:active {
                    transform: translateY(0);
                }
                .button-icon {
                    font-size: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    height: 100%;
                }
                .button-tooltip {
                    position: absolute;
                    bottom: -30px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: var(--vscode-editorHoverWidget-background);
                    color: var(--vscode-editorHoverWidget-foreground);
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    white-space: nowrap;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                    pointer-events: none;
                    z-index: 1000;
                }
                .button:hover .button-tooltip {
                    opacity: 1;
                }
                .button-row {
                    display: flex;
                    gap: 8px;
                    margin: 8px 0;
                    justify-content: center;
                }
                .submit-button {
                    width: 100%;
                    padding: 8px 16px;
                    color: var(--vscode-button-foreground);
                    background: var(--vscode-button-background);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 600;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.2s ease;
                    margin: 8px 0;
                    box-sizing: border-box;
                }
                .submit-button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                .status {
                    text-align: center;
                    margin-bottom: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }
                .status-dot {
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                }
                .status-active {
                    background-color: #28a745;
                }
                .status-inactive {
                    background-color: #dc3545;
                }
                .select-container {
                    position: relative;
                    width: 100%;
                    max-width: 100%;
                    box-sizing: border-box;
                }
                .dropdown-select {
                    width: 100%;
                    padding: 8px 12px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    font-size: 13px;
                    position: relative;
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    user-select: none;
                    box-sizing: border-box;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .dropdown-select:hover {
                    background: var(--vscode-input-background);
                    border-color: var(--vscode-focusBorder);
                }
                .dropdown-options {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    max-height: 300px;
                    overflow-y: auto;
                    background: var(--vscode-dropdown-background);
                    border: 1px solid var(--vscode-dropdown-border);
                    border-radius: 4px;
                    z-index: 9999;
                    display: none;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                    margin-top: 4px;
                    opacity: 0;
                    transform: translateY(-10px);
                    transition: opacity 0.2s ease, transform 0.2s ease;
                    box-sizing: border-box;
                    width: 100%;
                }
                .dropdown-options.show {
                    display: block;
                    opacity: 1;
                    transform: translateY(0);
                }
                .dropdown-option {
                    padding: 8px 12px;
                    cursor: pointer;
                    font-size: 13px;
                    transition: all 0.2s ease;
                    border-bottom: 1px solid var(--vscode-dropdown-border);
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    box-sizing: border-box;
                    overflow: hidden;
                }
                .dropdown-option:last-child {
                    border-bottom: none;
                }
                .dropdown-option:hover {
                    background: var(--vscode-list-hoverBackground);
                }
                .dropdown-option.selected {
                    background: var(--vscode-list-activeSelectionBackground);
                    color: var(--vscode-list-activeSelectionForeground);
                }
                .dropdown-option strong {
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .dropdown-option span {
                    color: var(--vscode-descriptionForeground);
                    font-size: 12px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .notification-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1000;
                    width: 300px;
                }
                .notification {
                    padding: 12px 16px;
                    margin-bottom: 8px;
                    border-radius: 4px;
                    background: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.7s forwards;
                    border-left: 4px solid;
                    font-size: 13px;
                }
                .notification.success {
                    border-left-color: #28a745;
                }
                .notification.error {
                    border-left-color: #dc3545;
                }
                .notification.info {
                    border-left-color: #17a2b8;
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                .manual-time {
                    padding: 12px;
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    box-sizing: border-box;
                }
                .manual-time input {
                    width: 100%;
                    padding: 8px;
                    margin-bottom: 8px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    box-sizing: border-box;
                }
                .manual-time .button {
                    width: 100%;
                }
                .timer-section {
                    background: var(--vscode-editor-inactiveSelectionBackground);
                    padding: 12px;
                    border-radius: 4px;
                    box-sizing: border-box;
                }
                .section-title {
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    margin-bottom: 4px;
                }
                .section {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    width: 100%;
                    box-sizing: border-box;
                }
                .email-section {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 16px;
                    align-items: center;
                    padding: 12px;
                    background: var(--vscode-editor-inactiveSelectionBackground);
                    border-radius: 4px;
                    width: 100%;
                    box-sizing: border-box;
                }
                
                .email-input {
                    flex: 1;
                    min-width: 0; /* Prevents flex item from overflowing */
                    padding: 8px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    font-size: 13px;
                }
                
                .auth-button {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 8px 12px;
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    white-space: nowrap;
                    user-select: none;
                    min-width: 120px;
                    text-align: center;
                }
                
                .auth-button:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }

                .auth-button .loader {
                    display: none;
                }

                .auth-button.loading .loader {
                    display: inline-block;
                }

                .auth-button.loading span {
                    display: none;
                }
            </style>
            <script>
                const vscode = acquireVsCodeApi();
                let allProjects = [];
                let allIssues = [];
                let isTracking = false;
                let isPaused = false;

                window.toggleDropdown = function(id) {
                    const dropdown = document.getElementById(id);
                    if (!dropdown) return;

                    // Hide other dropdowns
                    if (id === 'projectOptions') {
                        hideDropdown('issueOptions');
                    } else {
                        hideDropdown('projectOptions');
                    }

                    // Show all items initially
                    if (id === 'projectOptions') {
                        const projectOptions = document.getElementById('projectOptions');
                        if (projectOptions) {
                            projectOptions.innerHTML = allProjects.map(project => 
                                \`<div class="dropdown-option" onclick="window.selectProject('\${project.key}')">
                                    <strong>\${project.key}</strong>
                                    <span>\${project.name}</span>
                                </div>\`
                            ).join('');
                        }
                    } else if (id === 'issueOptions') {
                        const issueOptions = document.getElementById('issueOptions');
                        if (issueOptions) {
                            issueOptions.innerHTML = allIssues.map(issue => 
                                \`<div class="dropdown-option" onclick="window.selectIssue('\${issue.key}')">
                                    <strong>\${issue.key}</strong>
                                    <span>\${issue.summary}</span>
                                </div>\`
                            ).join('');
                        }
                    }

                    // Toggle dropdown visibility
                    if (dropdown.style.display === 'block') {
                        dropdown.classList.remove('show');
                        setTimeout(() => {
                            dropdown.style.display = 'none';
                        }, 200);
                    } else {
                        dropdown.style.display = 'block';
                        dropdown.offsetHeight; // Force a reflow
                        dropdown.classList.add('show');
                    }
                };

                window.hideDropdown = function(id) {
                    const dropdown = document.getElementById(id);
                    if (dropdown) {
                        dropdown.classList.remove('show');
                        setTimeout(() => {
                            dropdown.style.display = 'none';
                        }, 200);
                    }
                };

                window.selectProject = function(projectKey) {
                    const projectSelect = document.getElementById('projectSelect');
                    const project = allProjects.find(p => p.key === projectKey);
                    if (project && projectSelect) {
                        projectSelect.innerHTML = \`<span>\${project.key} - \${project.name}</span><span>▼</span>\`;
                        hideDropdown('projectOptions');
                        
                        // Clear issue selection when project changes
                        const issueSelect = document.getElementById('issueSelect');
                        if (issueSelect) {
                            issueSelect.innerHTML = '<span>Select Issue</span><span>▼</span>';
                        }
                        allIssues = []; // Clear issues array
                        
                        // Load issues for the selected project
                        vscode.postMessage({ type: 'loadIssues', projectKey });
                        showNotification(\`Loading issues for project: \${project.name}\`, 'info');
                    }
                };

                window.selectIssue = function(issueKey) {
                    const issueSelect = document.getElementById('issueSelect');
                    const issue = allIssues.find(i => i.key === issueKey);
                    if (issue && issueSelect) {
                        issueSelect.innerHTML = \`<span>\${issue.key} - \${issue.summary}</span><span>▼</span>\`;
                        hideDropdown('issueOptions');
                        showNotification(\`Selected issue: \${issue.key}\`, 'info');
                    }
                };

                window.handleManualTimeLog = function() {
                    const timeSpent = document.getElementById('manualTimeInput').value;
                    const issueKey = document.getElementById('issueSelect')?.textContent?.split(' - ')[0];
                    
                    if (!issueKey || issueKey === 'Select Issue') {
                        showNotification('Please select an issue first', 'error');
                        return;
                    }
                    if (!timeSpent) {
                        showNotification('Please enter time to log', 'error');
                        return;
                    }
                    
                    vscode.postMessage({ 
                        type: 'manualTimeLog',
                        issueKey: issueKey,
                        timeSpent: timeSpent
                    });
                };

                window.handleStartTimer = function() {
                    const issueKey = document.getElementById('issueSelect')?.textContent?.split(' - ')[0];
                    if (!issueKey || issueKey === 'Select Issue') {
                        showNotification('Please select an issue first', 'error');
                        return;
                    }
                    if (isTracking) {
                        showNotification('Timer is already running', 'error');
                        return;
                    }
                    vscode.postMessage({ type: 'startTimer', issueKey });
                };

                window.handleStopTimer = function() {
                    if (!isTracking) {
                        showNotification('No active timer to stop', 'error');
                        return;
                    }
                    vscode.postMessage({ type: 'stopTimer' });
                };

                window.handleResumeTimer = function() {
                    if (isTracking) {
                        showNotification('Timer is already running', 'error');
                        return;
                    }
                    if (!isPaused) {
                        showNotification('No paused timer to resume', 'error');
                        return;
                    }
                    vscode.postMessage({ type: 'resumeTimer' });
                };

                window.handleSubmitTime = function() {
                    const issueKey = document.getElementById('issueSelect')?.textContent?.split(' - ')[0];
                    if (!issueKey || issueKey === 'Select Issue') {
                        showNotification('Please select an issue first', 'error');
                        return;
                    }
                    if (!isTracking && !isPaused) {
                        showNotification('No active timer to submit', 'error');
                        return;
                    }
                    vscode.postMessage({ type: 'submitTime' });
                };

                function updateButtonStates() {
                    const startButton = document.querySelector('button[onclick="window.handleStartTimer()"]');
                    const stopButton = document.querySelector('button[onclick="window.handleStopTimer()"]');
                    const resumeButton = document.querySelector('button[onclick="window.handleResumeTimer()"]');
                    const submitButton = document.querySelector('button[onclick="window.handleSubmitTime()"]');

                    if (startButton) {
                        startButton.disabled = isTracking;
                        startButton.style.opacity = isTracking ? '0.5' : '1';
                    }
                    if (stopButton) {
                        stopButton.disabled = !isTracking;
                        stopButton.style.opacity = !isTracking ? '0.5' : '1';
                    }
                    if (resumeButton) {
                        resumeButton.disabled = isTracking || !isPaused;
                        resumeButton.style.opacity = (isTracking || !isPaused) ? '0.5' : '1';
                    }
                    if (submitButton) {
                        submitButton.disabled = !isTracking && !isPaused;
                        submitButton.style.opacity = (!isTracking && !isPaused) ? '0.5' : '1';
                    }
                }

                function showNotification(message, type) {
                    const container = document.getElementById('notifications');
                    if (!container) return;
                    
                    const notification = document.createElement('div');
                    notification.className = \`notification \${type}\`;
                    notification.innerHTML = \`
                        <span class="button-icon">\${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
                        <span>\${message}</span>
                    \`;
                    
                    container.appendChild(notification);
                    setTimeout(() => notification.remove(), 3000);
                }

                window.addEventListener('message', event => {
                    const message = event.data;
                    console.log('Received message:', message);
                    
                    switch (message.type) {
                        case 'projects':
                            console.log('Received projects:', message.projects);
                            allProjects = message.projects;
                            
                            // Reset button state
                            const loadProjectsBtn = document.getElementById('loadProjectsBtn');
                            if (loadProjectsBtn) {
                                loadProjectsBtn.disabled = false;
                                loadProjectsBtn.classList.remove('loading');
                            }
                            
                            // Update project dropdown
                            const projectOptions = document.getElementById('projectOptions');
                            if (projectOptions) {
                                if (allProjects.length === 0) {
                                    projectOptions.innerHTML = '<div class="dropdown-option">No projects available</div>';
                                } else {
                                    projectOptions.innerHTML = allProjects.map(project => 
                                        \`<div class="dropdown-option" onclick="window.selectProject('\${project.key}')">
                                            <strong>\${project.key}</strong>
                                            <span>\${project.name}</span>
                                        </div>\`
                                    ).join('');
                                }
                            }
                            
                            // Clear issue selection
                            const issueSelect = document.getElementById('issueSelect');
                            if (issueSelect) {
                                issueSelect.innerHTML = '<span>Select Issue</span><span>▼</span>';
                            }
                            allIssues = [];
                            break;
                        case 'load-failed':
                            // Reset button state
                            const btn = document.getElementById('loadProjectsBtn');
                            if (btn) {
                                btn.disabled = false;
                                btn.classList.remove('loading');
                            }
                            break;
                        case 'issues':
                            allIssues = message.issues;
                            const issueOptions = document.getElementById('issueOptions');
                            if (issueOptions) {
                                issueOptions.innerHTML = allIssues.map(issue => 
                                    \`<div class="dropdown-option" onclick="window.selectIssue('\${issue.key}')">
                                        <strong>\${issue.key}</strong>
                                        <span>\${issue.summary}</span>
                                    </div>\`
                                ).join('');
                            }
                            showNotification(\`Loaded \${allIssues.length} issues\`, 'success');
                            break;
                        case 'update':
                            const timer = document.getElementById('timer');
                            const statusDot = document.getElementById('statusDot');
                            const statusText = document.getElementById('statusText');
                            if (timer) timer.textContent = message.time;
                            if (statusDot) statusDot.className = 'status-dot ' + (message.isTracking ? 'status-active' : 'status-inactive');
                            if (statusText) statusText.textContent = message.isTracking ? 'Active' : 'Inactive';
                            isTracking = message.isTracking;
                            isPaused = !isTracking && message.time !== '00:00:00';
                            updateButtonStates();
                            break;
                        case 'notification':
                            showNotification(message.message, message.notificationType);
                            break;
                        case 'branch-info':
                            if (message.projectKey && message.issueKey) {
                                const projectSelect = document.getElementById('projectSelect');
                                const issueSelect = document.getElementById('issueSelect');
                                if (projectSelect && issueSelect) {
                                    projectSelect.innerHTML = \`\${message.projectKey}\`;
                                    issueSelect.innerHTML = \`\${message.issueKey}\`;
                                }
                            }
                            break;
                        case 'clear-manual-input':
                            const manualInput = document.getElementById('manualTimeInput');
                            if (manualInput) manualInput.value = '';
                            break;
                        case 'git-email':
                            const emailInput = document.getElementById('emailInput');
                            if (emailInput && message.email) {
                                emailInput.value = message.email;
                            }
                            break;
                    }
                });

                document.addEventListener('click', (e) => {
                    const target = e.target;
                    const selectContainer = target.closest('.select-container');
                    const dropdownOption = target.closest('.dropdown-option');
                    
                    if (!selectContainer && !dropdownOption) {
                        hideDropdown('projectOptions');
                        hideDropdown('issueOptions');
                    }
                });

                // Load projects immediately when the webview is ready
                vscode.postMessage({ type: 'loadProjects' });
                // Initialize button states
                updateButtonStates();

                document.addEventListener('DOMContentLoaded', function() {
                    const loadProjectsBtn = document.getElementById('loadProjectsBtn');
                    if (loadProjectsBtn) {
                        loadProjectsBtn.addEventListener('click', function() {
                            const email = document.getElementById('emailInput').value;
                            console.log('Load Projects button clicked with email:', email);
                            
                            if (!email) {
                                console.log('No email provided');
                                showNotification('Please enter your Jira email', 'error');
                                return;
                            }
                            
                            // Show loading state
                            console.log('Setting button to loading state');
                            loadProjectsBtn.disabled = true;
                            loadProjectsBtn.classList.add('loading');
                            
                            // Send message to extension
                            console.log('Sending loadProjects message to extension');
                            vscode.postMessage({ 
                                type: 'loadProjects',
                                email: email
                            });
                        });
                    }
                });
            </script>
        </head>
        <body>
            <div class="notification-container" id="notifications"></div>
            
            <div class="email-section">
                <input type="email" id="emailInput" class="email-input" placeholder="Enter your Jira email">
                <button id="loadProjectsBtn" class="auth-button" type="button">
                    <div class="loader"></div>
                    <span>Load Projects</span>
                </button>
            </div>
            
            <div class="section">
                <div class="section-title">Project & Issue</div>
                <div class="select-container">
                    <div class="dropdown-select" id="projectSelect" onclick="window.toggleDropdown('projectOptions')">
                        <span>Select Project</span>
                        <span>▼</span>
                    </div>
                    <div class="dropdown-options" id="projectOptions"></div>
                </div>
                
                <div class="select-container">
                    <div class="dropdown-select" id="issueSelect" onclick="window.toggleDropdown('issueOptions')">
                        <span>Select Issue</span>
                        <span>▼</span>
                    </div>
                    <div class="dropdown-options" id="issueOptions"></div>
                </div>

                <button class="submit-button" onclick="window.clearAll()">
                    <span>Clear All</span>
                </button>
            </div>

            <div class="section">
                <div class="section-title">Timer</div>
                <div class="timer-section">
                    <div class="status">
                        <span class="status-dot" id="statusDot"></span>
                        <span id="statusText">Inactive</span>
                    </div>
                    <div class="timer" id="timer">00:00:00</div>
                    
                    <div class="button-row">
                        <button class="button" onclick="window.handleStartTimer()">
                            <span class="button-icon">▶️</span>
                            <span class="button-tooltip">Start Timer</span>
                        </button>
                        <button class="button" onclick="window.handleStopTimer()">
                            <span class="button-icon">⏹️</span>
                            <span class="button-tooltip">Stop Timer</span>
                        </button>
                        <button class="button" onclick="window.handleResumeTimer()">
                            <span class="button-icon">⏯️</span>
                            <span class="button-tooltip">Resume Timer</span>
                        </button>
                    </div>

                    <button class="submit-button" onclick="window.handleSubmitTime()">
                        <span>Submit Time</span>
                    </button>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Manual Time Log</div>
                <div class="manual-time">
                    <input type="text" id="manualTimeInput" placeholder="Enter time (e.g., 1h 30m)">
                    <button class="button" onclick="window.handleManualTimeLog()">Log Manual Time</button>
                </div>
            </div>
        </body>
        </html>`;
    }
}
exports.TimeTrackerSidebarProvider = TimeTrackerSidebarProvider;
TimeTrackerSidebarProvider.viewType = 'jiraTimeTracker.sidebar';
//# sourceMappingURL=TimeTrackerSidebarProvider.js.map