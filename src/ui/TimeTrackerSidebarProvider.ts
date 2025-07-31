import * as vscode from 'vscode';
import { JiraTimeLogger } from '../JiraTimeLogger';
import { GitService } from '../services/GitService';
import { AuthenticationService, AuthenticatedUser } from '../services/AuthenticationService';
import { MainLayoutComponent } from './components/UIComponents';
import { BranchChangeService, BranchTicketInfo } from '../services/BranchChangeService';
import { createOutputChannel } from '../utils/outputChannel';

interface Project {
    key: string;
    name: string;
}

interface Issue {
    key: string;
    summary: string;
}

export class TimeTrackerSidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'jiraTimeTracker.sidebar';
    private _view?: vscode.WebviewView;
    private _timeLogger: JiraTimeLogger;
    private _outputChannel: vscode.OutputChannel;
    private _authService: AuthenticationService;
    private _branchChangeService?: BranchChangeService;

    constructor(
        private readonly _extensionUri: vscode.Uri, 
        timeLogger: JiraTimeLogger,
        private readonly _context: vscode.ExtensionContext
    ) {
        this._timeLogger = timeLogger;
        this._authService = new AuthenticationService(_context);
        this._outputChannel = createOutputChannel('Jira Time Tracker');
        // Removed initialization message
    }

    public setBranchChangeService(branchChangeService: BranchChangeService): void {
        this._branchChangeService = branchChangeService;
        this._setupBranchChangeMonitoring();
    }

    private _setupBranchChangeMonitoring(): void {
        if (!this._branchChangeService) {
            this._outputChannel.appendLine('⚠️ BranchChangeService not available for monitoring');
            return;
        }

        this._branchChangeService.onTicketAutoPopulated = (ticketInfo: BranchTicketInfo) => {
            this._outputChannel.appendLine(`🎯 Auto-populated ticket received: ${ticketInfo.ticketId}`);
            this._updateUIWithTicketInfo(ticketInfo);
        };

        this._outputChannel.appendLine('✅ Branch change monitoring set up');
    }

    private _updateUIWithTicketInfo(ticketInfo: BranchTicketInfo): void {
        this._outputChannel.appendLine(`🎯 Auto-populated ticket received: ${ticketInfo.ticketId}`);
        this._outputChannel.appendLine(`📝 Updating UI with ticket: ${ticketInfo.ticketId} (${ticketInfo.projectKey})`);
        
        // Send branch-info message to webview (same format as existing _loadBranchInfo)
        this._view?.webview.postMessage({
            type: 'branch-info',
            projectKey: ticketInfo.projectKey,
            issueKey: ticketInfo.ticketId
        });
        
        // Removed auto-populated ticket notification
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
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

            // Check authentication status on load
            this._checkAuthenticationOnLoad();

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
                            if (!this._timeLogger.hasElapsedTime()) {
                                this._showNotification('No time to submit', 'error');
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
                                this._outputChannel.appendLine('Found ' + projects.length + ' projects for user');
                                
                                // Send projects to webview
                                this._view?.webview.postMessage({
                                    type: 'projects',
                                    projects: projects
                                });
                                
                                // Removed project loaded notification
                            } catch (error: any) {
                                this._outputChannel.appendLine('Failed to load projects: ' + error.message);
                                if (error.response) {
                                    this._outputChannel.appendLine('JIRA API Error: ' + (error.response.data?.message || error.response.statusText || 'Unknown error'));
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
                            // Set the current project for Productive integration
                            this._timeLogger.setCurrentProject(data.projectKey);
                            this._outputChannel.appendLine(`Set current project to: ${data.projectKey}`);
                            
                            // For smart search, we don't need to load all issues initially
                            // Just send an empty issues array to enable the search input
                            this._outputChannel.appendLine(`Project ${data.projectKey} ready for smart search`);
                            
                            this._view?.webview.postMessage({
                                type: 'issues',
                                issues: []
                            });
                            
                            // Removed project loaded notification
                            break;
                        case 'searchIssues':
                            this._outputChannel.appendLine(`Searching issues for project: ${data.projectKey}, term: "${data.searchTerm}"`);
                            
                            try {
                                const searchResults = await this._timeLogger.jiraService.searchIssues(data.projectKey, data.searchTerm);
                                this._outputChannel.appendLine(`Search results: ${searchResults.length} issues found`);
                                this._view?.webview.postMessage({
                                    type: 'searchResults',
                                    issues: searchResults,
                                    searchTerm: data.searchTerm
                                });
                            } catch (error: any) {
                                this._outputChannel.appendLine(`Search failed: ${error.message}`);
                                this._view?.webview.postMessage({
                                    type: 'searchResults',
                                    issues: [],
                                    searchTerm: data.searchTerm,
                                    error: error.message
                                });
                            }
                            break;
                        case 'manualTimeLog':
                                                            this._outputChannel.appendLine(`Manual time log: ${data.timeSpent} minutes for ${data.issueKey}`);
                            try {
                                if (!data.issueKey || !data.timeSpent) {
                                    this._showNotification('Please select an issue and enter time', 'error');
                                    // Reset button state on error
                                    this._view?.webview.postMessage({
                                        type: 'manual-time-error'
                                    });
                                    return;
                                }
                                await this._timeLogger.logTime(data.issueKey, data.timeSpent);
                                // Removed manual time log success notification
                                
                                // Clear the input field and reset button on success
                                this._view?.webview.postMessage({
                                    type: 'clear-manual-input'
                                });
                            } catch (error: any) {
                                this._outputChannel.appendLine('Error logging manual time: ' + error.message);
                                this._showNotification(`Failed to log time: ${error.message}`, 'error');
                                
                                // Reset button state on error
                                this._view?.webview.postMessage({
                                    type: 'manual-time-error'
                                });
                            }
                            break;
                        case 'loadBranchInfo':
                            try {
                                const branchInfo = await this._timeLogger.getBranchTicketInfo();
                                if (branchInfo) {
                                    this._outputChannel.appendLine(`Branch info: ${branchInfo.projectKey}/${branchInfo.issueKey}`);
                                    this._view?.webview.postMessage({
                                        type: 'branch-info',
                                        projectKey: branchInfo.projectKey,
                                        issueKey: branchInfo.issueKey
                                    });
                                }
                            } catch (error: any) {
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
                        case 'signIn':
                            try {
                                this._outputChannel.appendLine('Processing dual authentication request...');
                                const { jiraEmail, jiraApiToken, jiraBaseUrl, productiveApiToken } = data;
                                
                                if (!jiraEmail || !jiraApiToken || !jiraBaseUrl || !productiveApiToken) {
                                    throw new Error('Please fill in all fields');
                                }

                                // Test both JIRA and Productive credentials
                                this._outputChannel.appendLine('Testing JIRA credentials...');
                                const authenticatedUser = await this._authService.authenticateUser({
                                    email: jiraEmail,
                                    apiToken: jiraApiToken,
                                    baseUrl: jiraBaseUrl,
                                    productiveApiToken: productiveApiToken
                                });

                                // Update the JiraService with the new authentication service
                                this._timeLogger.updateJiraService(this._authService);

                                this._outputChannel.appendLine(`User signed in: ${authenticatedUser.email}`);
                                this._showNotification(`Welcome ${authenticatedUser.displayName}! Both JIRA and Productive connected.`, 'success');
                                
                                // Send authentication status to webview
                                this._view?.webview.postMessage({
                                    type: 'authenticationStatus',
                                    isAuthenticated: true,
                                    user: authenticatedUser
                                });

                            } catch (error: any) {
                                this._outputChannel.appendLine('Sign in failed: ' + error.message);
                                this._showNotification(`Sign in failed: ${error.message}`, 'error');
                                this._view?.webview.postMessage({
                                    type: 'authenticationStatus',
                                    isAuthenticated: false,
                                    error: error.message
                                });
                            }
                            break;
                        case 'signOut':
                            try {
                                // Sign out current user
                                await this._authService.signOut();
                                this._outputChannel.appendLine('User signed out');
                                this._showNotification('Signed out successfully', 'info');
                                
                                this._view?.webview.postMessage({
                                    type: 'authenticationStatus',
                                    isAuthenticated: false
                                });
                            } catch (error: any) {
                                this._outputChannel.appendLine('Sign out error: ' + error.message);
                                this._showNotification(`Sign out error: ${error.message}`, 'error');
                            }
                            break;
                        // Removed switch and remove user handlers
                        case 'checkAuthStatus':
                            try {
                                const isAuthenticated = await this._authService.isAuthenticated();
                                if (isAuthenticated) {
                                    const activeUser = await this._authService.getActiveUser();
                                    this._view?.webview.postMessage({
                                        type: 'authenticationStatus',
                                        isAuthenticated: true,
                                        user: activeUser
                                    });
                                } else {
                                    this._view?.webview.postMessage({
                                        type: 'authenticationStatus',
                                        isAuthenticated: false
                                    });
                                }
                            } catch (error: any) {
                                this._outputChannel.appendLine('Auth status check failed: ' + error.message);
                            }
                            break;
                    }
                } catch (error: any) {
                    this._outputChannel.appendLine('Error handling message: ' + error.message);
                    this._showNotification(error.message, 'error');
                }
            });
        } catch (error: any) {
            this._outputChannel.appendLine('Error in resolveWebviewView: ' + error.message);
            vscode.window.showErrorMessage('Failed to initialize sidebar: ' + error.message);
        }
    }

    private _showNotification(message: string, type: 'success' | 'error' | 'info') {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'notification',
                message,
                notificationType: type
            });
        }
    }

    // Removed _sendUsersToWebview - no longer needed for single user approach

    private async _checkAuthenticationOnLoad() {
        try {
            const isAuthenticated = await this._authService.isAuthenticated();
            if (isAuthenticated) {
                const activeUser = await this._authService.getActiveUser();
                // Update the JiraService with the authentication service
                this._timeLogger.updateJiraService(this._authService);
                
                                    this._view?.webview.postMessage({
                        type: 'authenticationStatus',
                        isAuthenticated: true,
                        user: activeUser
                    });
                this._outputChannel.appendLine(`Authentication restored for user: ${activeUser?.email}`);
            } else {
                this._view?.webview.postMessage({
                    type: 'authenticationStatus',
                    isAuthenticated: false
                });
                this._outputChannel.appendLine('No authenticated user found');
            }
        } catch (error: any) {
            this._outputChannel.appendLine('Error checking authentication: ' + error.message);
        }
    }

    private _setUpInterval() {
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

    private async _loadBranchInfo() {
        try {
            this._outputChannel.appendLine('Loading branch info...');
            const branchInfo = await this._timeLogger.getBranchTicketInfo();
            
            // Note: GitService now requires JiraService and outputChannel
            // This functionality is deprecated in favor of BranchChangeService
            const gitEmail = '';
            
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
                    const projects = await this._timeLogger.jiraService.getProjectsByUserEmail(userEmail as string);
                    this._outputChannel.appendLine('Projects loaded in branch info: ' + JSON.stringify(projects, null, 2));
                    this._view?.webview.postMessage({
                        type: 'projects',
                        projects: projects
                    });

                    // Then load issues for the project
                    this._outputChannel.appendLine(`Loading issues for project ${branchInfo.projectKey}...`);
                    const paginatedResult = await this._timeLogger.jiraService.getProjectIssuesUnfilteredPaginated(branchInfo.projectKey, 1, 5);
                    this._outputChannel.appendLine(`Issues loaded for project ${branchInfo.projectKey}: ${paginatedResult.issues.length} issues (page 1 of ${Math.ceil(paginatedResult.total / 5)})`);
                    this._view?.webview.postMessage({
                        type: 'issues',
                        issues: paginatedResult.issues,
                        pagination: {
                            total: paginatedResult.total,
                            page: paginatedResult.page,
                            pageSize: paginatedResult.pageSize,
                            hasMore: paginatedResult.hasMore
                        }
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
        } catch (error: any) {
            this._outputChannel.appendLine('Error loading branch info: ' + error.message);
            this._showNotification('Failed to load branch info', 'error');
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Use the new component-based approach
        const mainLayout = new MainLayoutComponent();
        return mainLayout.render();
    }
}