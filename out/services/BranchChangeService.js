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
            this.outputChannel.appendLine(`🔍 [DEBUG] Entering findLinkedTicketForBranch for branch: ${event.newBranch}`);
            const ticketInfo = await this.findLinkedTicketForBranch(event.newBranch, event.workspacePath);
            this.outputChannel.appendLine(`🔍 [DEBUG] findLinkedTicketForBranch result: ${JSON.stringify(ticketInfo)}`);
            if (ticketInfo) {
                this.outputChannel.appendLine(`✅ Found linked ticket: ${ticketInfo.ticketId} (${ticketInfo.projectKey})`);
                this.autoTimerState.lastBranchInfo = {
                    branch: event.newBranch,
                    ticketId: ticketInfo.ticketId,
                    projectKey: ticketInfo.projectKey
                };
                this.saveAutoTimerState();
                this.outputChannel.appendLine(`📝 [DEBUG] Starting auto-populate for ticket: ${ticketInfo.ticketId}`);
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
        this.outputChannel.appendLine(`🔍 [DEBUG] findLinkedTicketForBranch called with branchName: ${branchName}, repoPath: ${repoPath}`);
        const ticketResult = await this.gitService.findLinkedJiraTicket(branchName, repoPath);
        this.outputChannel.appendLine(`🔍 [DEBUG] gitService.findLinkedJiraTicket result: ${JSON.stringify(ticketResult)}`);
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