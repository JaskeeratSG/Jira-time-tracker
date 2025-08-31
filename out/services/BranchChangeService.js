"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchChangeService = void 0;
const vscode = require("vscode");
const GitService_1 = require("./GitService");
const JiraService_1 = require("./JiraService");
class BranchChangeService {
    constructor(timeLogger, context, outputChannel, gitOutputChannel, authService) {
        this.isInitialized = false;
        this.timeLogger = timeLogger;
        this.context = context;
        this.outputChannel = outputChannel;
        this.authService = authService;
        this.jiraService = new JiraService_1.JiraService(this.authService);
        this.gitService = new GitService_1.GitService(this.jiraService, gitOutputChannel);
        this.autoTimerState = this.loadAutoTimerState();
    }
    async initialize() {
        if (this.isInitialized)
            return;
        this.outputChannel.appendLine('🚀 Initializing Branch Change Service...');
        // Check authentication first
        const isAuthenticated = await this.authService.isAuthenticated();
        if (!isAuthenticated) {
            this.outputChannel.appendLine('User not authenticated. Branch change monitoring disabled.');
            return;
        }
        // Set up branch change monitoring
        this.setupBranchChangeMonitoring();
        // Perform initial branch check
        await this.performInitialBranchCheck();
        this.isInitialized = true;
        this.outputChannel.appendLine('✅ Branch Change Service initialized');
    }
    setupBranchChangeMonitoring() {
        this.gitService.onBranchChange(async (event) => {
            await this.handleBranchChange(event);
        });
        // Set up commit monitoring
        this.gitService.onCommitChange(async (event) => {
            await this.handleCommit(event);
        });
    }
    async handleBranchChange(event) {
        // Check authentication before processing
        const isAuthenticated = await this.authService.isAuthenticated();
        if (!isAuthenticated) {
            this.outputChannel.appendLine('User not authenticated. Skipping branch change processing.');
            return;
        }
        this.outputChannel.appendLine(`🔄 Processing branch change: ${event.oldBranch} → ${event.newBranch}`);
        try {
            const ticketInfo = await this.findLinkedTicketForBranch(event.newBranch, event.workspacePath);
            if (ticketInfo) {
                this.outputChannel.appendLine(`✅ Found linked ticket: ${ticketInfo.ticketId} (${ticketInfo.projectKey})`);
                this.autoTimerState.lastBranchInfo = {
                    branch: event.newBranch,
                    ticketId: ticketInfo.ticketId,
                    projectKey: ticketInfo.projectKey
                };
                this.saveAutoTimerState();
                await this.autoPopulateTicketInfo(ticketInfo);
                if (this.autoTimerState.autoStart) {
                    await this.autoStartTimer(ticketInfo);
                }
            }
            else {
                this.outputChannel.appendLine(`❌ No linked ticket found for branch: ${event.newBranch}`);
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error handling branch change: ${error}`);
        }
    }
    async findLinkedTicketForBranch(branchName, repoPath) {
        const ticketResult = await this.gitService.findLinkedJiraTicket(branchName, repoPath);
        if (ticketResult) {
            return {
                ticketId: ticketResult.ticketId,
                projectKey: ticketResult.projectKey,
                summary: ticketResult.summary,
                description: `Time logged for branch: ${branchName}`
            };
        }
        return null;
    }
    async autoPopulateTicketInfo(ticketInfo) {
        try {
            // Check authentication before populating
            const isAuthenticated = await this.authService.isAuthenticated();
            if (!isAuthenticated) {
                this.outputChannel.appendLine('User not authenticated. Skipping ticket population.');
                return;
            }
            this.outputChannel.appendLine(`📝 Auto-populating UI with ticket: ${ticketInfo.ticketId}`);
            // Set current project and issue in the time logger
            this.timeLogger.setCurrentProject(ticketInfo.projectKey);
            this.timeLogger.setCurrentIssue(ticketInfo.ticketId);
            this.outputChannel.appendLine(`✅ UI populated with project: ${ticketInfo.projectKey}, issue: ${ticketInfo.ticketId}`);
            // Notify UI about the auto-populated ticket
            if (this.onTicketAutoPopulated) {
                this.onTicketAutoPopulated(ticketInfo);
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error auto-populating UI: ${error}`);
        }
    }
    async autoStartTimer(ticketInfo) {
        try {
            // Check authentication before starting timer
            const isAuthenticated = await this.authService.isAuthenticated();
            if (!isAuthenticated) {
                this.outputChannel.appendLine('User not authenticated. Skipping auto-start timer.');
                return;
            }
            if (this.timeLogger.isTimerRunning()) {
                this.outputChannel.appendLine('Timer already running, skipping auto-start');
                return;
            }
            this.outputChannel.appendLine(`⏰ Auto-starting timer for ticket: ${ticketInfo.ticketId}`);
            // Set the current issue before starting the timer
            this.timeLogger.setCurrentIssue(ticketInfo.ticketId);
            this.timeLogger.setCurrentProject(ticketInfo.projectKey);
            await this.timeLogger.startTimer();
            this.outputChannel.appendLine('✅ Timer started automatically');
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error auto-starting timer: ${error}`);
        }
    }
    async performInitialBranchCheck() {
        try {
            // Check authentication before initial check
            const isAuthenticated = await this.authService.isAuthenticated();
            if (!isAuthenticated) {
                this.outputChannel.appendLine('User not authenticated. Skipping initial branch check.');
                return;
            }
            const currentBranchInfo = this.gitService.getCurrentBranchInfo();
            if (currentBranchInfo) {
                this.outputChannel.appendLine(`🌿 Initial branch check: ${currentBranchInfo.branch}`);
                const ticketInfo = await this.findLinkedTicketForBranch(currentBranchInfo.branch, currentBranchInfo.path);
                if (ticketInfo) {
                    this.outputChannel.appendLine(`✅ Found initial ticket: ${ticketInfo.ticketId}`);
                    await this.autoPopulateTicketInfo(ticketInfo);
                }
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error in initial branch check: ${error}`);
        }
    }
    async handleCommit(event) {
        // Check authentication before processing commit
        const isAuthenticated = await this.authService.isAuthenticated();
        if (!isAuthenticated) {
            this.outputChannel.appendLine('User not authenticated. Skipping commit processing.');
            return;
        }
        if (!this.autoTimerState.autoLog) {
            this.outputChannel.appendLine('Auto-logging disabled, skipping commit log');
            return;
        }
        if (!this.timeLogger.isTimerRunning()) {
            this.outputChannel.appendLine('Timer not running, skipping commit log');
            return;
        }
        try {
            this.outputChannel.appendLine(`Processing commit from repository: ${event.workspacePath}`);
            this.outputChannel.appendLine(`Commit message: ${event.commitMessage}`);
            this.outputChannel.appendLine(`Branch: ${event.branch}`);
            // Use the branch from the commit event instead of getting current branch info
            const ticketInfo = await this.findLinkedTicketForBranch(event.branch, event.workspacePath);
            if (!ticketInfo) {
                this.outputChannel.appendLine('No linked ticket found for commit branch');
                return;
            }
            this.outputChannel.appendLine(`Logging time for commit: ${event.commitMessage}`);
            this.outputChannel.appendLine(`Ticket: ${ticketInfo.ticketId} (${ticketInfo.projectKey})`);
            // Get the elapsed time in minutes for logging
            const elapsedMinutes = this.timeLogger.getElapsedMinutes();
            this.outputChannel.appendLine(`Elapsed time: ${elapsedMinutes} minutes`);
            // Log time using the commit message as description
            await this.timeLogger.logTime(ticketInfo.ticketId, elapsedMinutes, event.commitMessage);
            this.outputChannel.appendLine('Time logged successfully for commit');
            // Show commit time logged notification
            vscode.window.showInformationMessage(`Time logged for commit: ${elapsedMinutes} minutes to ${ticketInfo.ticketId}`);
            // Reset the timer after successful logging
            this.timeLogger.stopTimer();
            this.timeLogger.resetTimer();
            this.outputChannel.appendLine('Timer reset after successful commit logging');
        }
        catch (error) {
            this.outputChannel.appendLine(`Error logging time for commit: ${error}`);
        }
    }
    getCurrentBranchInfo() {
        const branchInfo = this.gitService.getCurrentBranchInfo();
        if (!branchInfo)
            return null;
        return {
            branch: branchInfo.branch,
            ticketInfo: this.autoTimerState.lastBranchInfo ? {
                ticketId: this.autoTimerState.lastBranchInfo.ticketId,
                projectKey: this.autoTimerState.lastBranchInfo.projectKey
            } : undefined
        };
    }
    updateAutoTimerSettings(settings) {
        this.autoTimerState = { ...this.autoTimerState, ...settings };
        this.saveAutoTimerState();
        this.outputChannel.appendLine(`Auto-timer settings updated: ${JSON.stringify(settings)}`);
    }
    getAutoTimerSettings() {
        return { ...this.autoTimerState };
    }
    /**
     * Check authentication status and update service state
     */
    async checkAuthenticationStatus() {
        const isAuthenticated = await this.authService.isAuthenticated();
        if (!isAuthenticated && this.isInitialized) {
            this.outputChannel.appendLine('User not authenticated. Disabling branch change monitoring.');
            this.isInitialized = false;
            // Stop any running timers
            if (this.timeLogger.isTimerRunning()) {
                this.timeLogger.stopTimer();
                this.outputChannel.appendLine('Timer stopped due to authentication loss');
            }
        }
        else if (isAuthenticated && !this.isInitialized) {
            this.outputChannel.appendLine('User authenticated. Re-enabling branch change monitoring.');
            await this.initialize();
        }
    }
    loadAutoTimerState() {
        const saved = this.context.workspaceState.get('autoTimerState');
        return saved || {
            autoStart: true,
            autoLog: true
        };
    }
    saveAutoTimerState() {
        this.context.workspaceState.update('autoTimerState', this.autoTimerState);
    }
    dispose() {
        this.outputChannel.appendLine('Cleaning up Branch Change Service...');
        if (this.gitService) {
            this.gitService.dispose();
        }
        this.isInitialized = false;
        this.outputChannel.appendLine('Branch Change Service cleaned up');
    }
}
exports.BranchChangeService = BranchChangeService;
//# sourceMappingURL=BranchChangeService.js.map