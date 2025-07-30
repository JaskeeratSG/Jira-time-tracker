"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchChangeService = void 0;
const GitService_1 = require("./GitService");
const JiraService_1 = require("./JiraService");
class BranchChangeService {
    constructor(timeLogger, context, outputChannel) {
        this.isInitialized = false;
        this.timeLogger = timeLogger;
        this.context = context;
        this.outputChannel = outputChannel;
        this.jiraService = new JiraService_1.JiraService();
        this.gitService = new GitService_1.GitService(this.jiraService, outputChannel);
        this.autoTimerState = this.loadAutoTimerState();
    }
    async initialize() {
        if (this.isInitialized)
            return;
        this.outputChannel.appendLine('🚀 Initializing Branch Change Service...');
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
    }
    async handleBranchChange(event) {
        this.outputChannel.appendLine(`🔄 Processing branch change: ${event.oldBranch} → ${event.newBranch}`);
        try {
            // Find linked Jira ticket for the new branch
            const ticketInfo = await this.findLinkedTicketForBranch(event.newBranch, event.workspacePath);
            if (ticketInfo) {
                this.outputChannel.appendLine(`✅ Found linked ticket: ${ticketInfo.ticketId} (${ticketInfo.projectKey})`);
                // Update state
                this.autoTimerState.lastBranchInfo = {
                    branch: event.newBranch,
                    ticketId: ticketInfo.ticketId,
                    projectKey: ticketInfo.projectKey
                };
                this.saveAutoTimerState();
                // Auto-populate UI
                await this.autoPopulateTicketInfo(ticketInfo);
                // Auto-start timer if enabled
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
        // Try to find ticket using GitService
        const ticketId = await this.gitService.findLinkedJiraTicket(branchName, repoPath);
        if (ticketId) {
            // Extract project key from ticket ID
            const projectKey = this.extractProjectKey(ticketId);
            if (projectKey) {
                return {
                    ticketId,
                    projectKey,
                    summary: `Work on ${ticketId}`,
                    description: `Time logged for branch: ${branchName}`
                };
            }
        }
        return null;
    }
    extractProjectKey(ticketId) {
        const match = ticketId.match(/^([A-Z]+)-\d+$/i);
        return match ? match[1] : null;
    }
    async autoPopulateTicketInfo(ticketInfo) {
        try {
            this.outputChannel.appendLine(`📝 Auto-populating UI with ticket: ${ticketInfo.ticketId}`);
            // Set current project and issue in the time logger
            this.timeLogger.setCurrentProject(ticketInfo.projectKey);
            this.timeLogger.setCurrentIssue(ticketInfo.ticketId);
            this.outputChannel.appendLine(`✅ UI populated with project: ${ticketInfo.projectKey}, issue: ${ticketInfo.ticketId}`);
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error auto-populating UI: ${error}`);
        }
    }
    async autoStartTimer(ticketInfo) {
        try {
            if (this.timeLogger.isTimerRunning()) {
                this.outputChannel.appendLine('⏰ Timer already running, skipping auto-start');
                return;
            }
            this.outputChannel.appendLine(`⏰ Auto-starting timer for ticket: ${ticketInfo.ticketId}`);
            await this.timeLogger.startTimer();
            this.outputChannel.appendLine('✅ Timer started automatically');
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error auto-starting timer: ${error}`);
        }
    }
    async performInitialBranchCheck() {
        try {
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
    async handleCommit(commitMessage) {
        if (!this.autoTimerState.autoLog) {
            this.outputChannel.appendLine('📝 Auto-logging disabled, skipping commit log');
            return;
        }
        if (!this.timeLogger.isTimerRunning()) {
            this.outputChannel.appendLine('⏰ Timer not running, skipping commit log');
            return;
        }
        try {
            const currentBranchInfo = this.gitService.getCurrentBranchInfo();
            if (!currentBranchInfo) {
                this.outputChannel.appendLine('❌ No current branch info available');
                return;
            }
            const ticketInfo = await this.findLinkedTicketForBranch(currentBranchInfo.branch, currentBranchInfo.path);
            if (!ticketInfo) {
                this.outputChannel.appendLine('❌ No linked ticket found for current branch');
                return;
            }
            this.outputChannel.appendLine(`📝 Logging time for commit: ${commitMessage}`);
            // Log time using the commit message as description
            await this.timeLogger.logTime(ticketInfo.ticketId, this.timeLogger.getCurrentTime(), commitMessage);
            this.outputChannel.appendLine('✅ Time logged successfully for commit');
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error logging time for commit: ${error}`);
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
        this.outputChannel.appendLine(`⚙️ Auto-timer settings updated: ${JSON.stringify(settings)}`);
    }
    getAutoTimerSettings() {
        return { ...this.autoTimerState };
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
        this.outputChannel.appendLine('🧹 Cleaning up Branch Change Service...');
        if (this.gitService) {
            this.gitService.dispose();
        }
        this.isInitialized = false;
        this.outputChannel.appendLine('✅ Branch Change Service cleaned up');
    }
}
exports.BranchChangeService = BranchChangeService;
//# sourceMappingURL=BranchChangeService.js.map