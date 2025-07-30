import * as vscode from 'vscode';
import { GitService, BranchChangeEvent, GitRepositoryInfo } from './GitService';
import { JiraTimeLogger } from '../JiraTimeLogger';
import { JiraService } from './JiraService';

export interface BranchTicketInfo {
    ticketId: string;
    projectKey: string;
    summary?: string;
    description?: string;
}

export interface AutoTimerState {
    autoStart: boolean;
    autoLog: boolean;
    lastBranchInfo?: {
        branch: string;
        ticketId: string;
        projectKey: string;
    };
}

export class BranchChangeService {
    private gitService: GitService;
    private jiraService: JiraService;
    private timeLogger: JiraTimeLogger;
    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private autoTimerState: AutoTimerState;
    private isInitialized = false;

    constructor(timeLogger: JiraTimeLogger, context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        this.timeLogger = timeLogger;
        this.context = context;
        this.outputChannel = outputChannel;
        this.jiraService = new JiraService();
        this.gitService = new GitService(this.jiraService, outputChannel);
        this.autoTimerState = this.loadAutoTimerState();
    }

    public async initialize(): Promise<void> {
        if (this.isInitialized) return;

        this.outputChannel.appendLine('🚀 Initializing Branch Change Service...');

        // Set up branch change monitoring
        this.setupBranchChangeMonitoring();

        // Perform initial branch check
        await this.performInitialBranchCheck();

        this.isInitialized = true;
        this.outputChannel.appendLine('✅ Branch Change Service initialized');
    }

    private setupBranchChangeMonitoring(): void {
        this.gitService.onBranchChange(async (event: BranchChangeEvent) => {
            await this.handleBranchChange(event);
        });
    }

    private async handleBranchChange(event: BranchChangeEvent): Promise<void> {
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
            } else {
                this.outputChannel.appendLine(`❌ No linked ticket found for branch: ${event.newBranch}`);
            }
        } catch (error) {
            this.outputChannel.appendLine(`❌ Error handling branch change: ${error}`);
        }
    }

    private async findLinkedTicketForBranch(branchName: string, repoPath?: string): Promise<BranchTicketInfo | null> {
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

    private extractProjectKey(ticketId: string): string | null {
        const match = ticketId.match(/^([A-Z]+)-\d+$/i);
        return match ? match[1] : null;
    }

    private async autoPopulateTicketInfo(ticketInfo: BranchTicketInfo): Promise<void> {
        try {
            this.outputChannel.appendLine(`📝 Auto-populating UI with ticket: ${ticketInfo.ticketId}`);
            
            // Set current project and issue in the time logger
            this.timeLogger.setCurrentProject(ticketInfo.projectKey);
            this.timeLogger.setCurrentIssue(ticketInfo.ticketId);
            
            this.outputChannel.appendLine(`✅ UI populated with project: ${ticketInfo.projectKey}, issue: ${ticketInfo.ticketId}`);
        } catch (error) {
            this.outputChannel.appendLine(`❌ Error auto-populating UI: ${error}`);
        }
    }

    private async autoStartTimer(ticketInfo: BranchTicketInfo): Promise<void> {
        try {
            if (this.timeLogger.isTimerRunning()) {
                this.outputChannel.appendLine('⏰ Timer already running, skipping auto-start');
                return;
            }

            this.outputChannel.appendLine(`⏰ Auto-starting timer for ticket: ${ticketInfo.ticketId}`);
            await this.timeLogger.startTimer();
            this.outputChannel.appendLine('✅ Timer started automatically');
        } catch (error) {
            this.outputChannel.appendLine(`❌ Error auto-starting timer: ${error}`);
        }
    }

    private async performInitialBranchCheck(): Promise<void> {
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
        } catch (error) {
            this.outputChannel.appendLine(`❌ Error in initial branch check: ${error}`);
        }
    }

    public async handleCommit(commitMessage: string): Promise<void> {
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
            await this.timeLogger.logTime(
                ticketInfo.ticketId,
                this.timeLogger.getCurrentTime(),
                commitMessage
            );

            this.outputChannel.appendLine('✅ Time logged successfully for commit');
        } catch (error) {
            this.outputChannel.appendLine(`❌ Error logging time for commit: ${error}`);
        }
    }

    public getCurrentBranchInfo(): { branch: string; ticketInfo?: BranchTicketInfo } | null {
        const branchInfo = this.gitService.getCurrentBranchInfo();
        if (!branchInfo) return null;

        return {
            branch: branchInfo.branch,
            ticketInfo: this.autoTimerState.lastBranchInfo ? {
                ticketId: this.autoTimerState.lastBranchInfo.ticketId,
                projectKey: this.autoTimerState.lastBranchInfo.projectKey
            } : undefined
        };
    }

    public updateAutoTimerSettings(settings: Partial<AutoTimerState>): void {
        this.autoTimerState = { ...this.autoTimerState, ...settings };
        this.saveAutoTimerState();
        this.outputChannel.appendLine(`⚙️ Auto-timer settings updated: ${JSON.stringify(settings)}`);
    }

    public getAutoTimerSettings(): AutoTimerState {
        return { ...this.autoTimerState };
    }

    private loadAutoTimerState(): AutoTimerState {
        const saved = this.context.workspaceState.get<AutoTimerState>('autoTimerState');
        return saved || {
            autoStart: true,
            autoLog: true
        };
    }

    private saveAutoTimerState(): void {
        this.context.workspaceState.update('autoTimerState', this.autoTimerState);
    }

    public dispose(): void {
        this.outputChannel.appendLine('🧹 Cleaning up Branch Change Service...');
        
        if (this.gitService) {
            this.gitService.dispose();
        }
        
        this.isInitialized = false;
        this.outputChannel.appendLine('✅ Branch Change Service cleaned up');
    }
} 