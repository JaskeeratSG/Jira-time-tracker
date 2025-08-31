import * as vscode from 'vscode';
import { GitService, BranchChangeEvent, GitRepositoryInfo, CommitEvent } from './GitService';
import { JiraTimeLogger } from '../JiraTimeLogger';
import { JiraService } from './JiraService';
import { AuthenticationService } from './AuthenticationService';

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
    private authService: AuthenticationService;
    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private autoTimerState: AutoTimerState;
    private isInitialized = false;
    public onTicketAutoPopulated?: (ticketInfo: BranchTicketInfo) => void;

    constructor(timeLogger: JiraTimeLogger, context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel, gitOutputChannel: vscode.OutputChannel, authService: AuthenticationService) {
        this.timeLogger = timeLogger;
        this.context = context;
        this.outputChannel = outputChannel;
        this.authService = authService;
        this.jiraService = new JiraService(this.authService);
        this.gitService = new GitService(this.jiraService, gitOutputChannel);
        this.autoTimerState = this.loadAutoTimerState();
    }

    public async initialize(): Promise<void> {
        if (this.isInitialized) return;

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

    private setupBranchChangeMonitoring(): void {
        this.gitService.onBranchChange(async (event: BranchChangeEvent) => {
            await this.handleBranchChange(event);
        });

        // Set up commit monitoring
        this.gitService.onCommitChange(async (event: CommitEvent) => {
            await this.handleCommit(event);
        });
    }

    private async handleBranchChange(event: BranchChangeEvent): Promise<void> {
        // Check authentication before processing
        const isAuthenticated = await this.authService.isAuthenticated();
        if (!isAuthenticated) {
            this.outputChannel.appendLine('User not authenticated. Skipping branch change processing.');
            return;
        }

        this.outputChannel.appendLine(`🔄 Processing branch change: ${event.oldBranch} → ${event.newBranch}`);
        
        // Clear processed commits for the new branch to ensure fresh processing
        this.gitService.clearProcessedCommits(event.workspacePath);
        this.outputChannel.appendLine(`🧹 Cleared processed commits for new branch: ${event.newBranch}`);
        
        // Set current user email for commit filtering
        try {
            const currentUser = await this.authService.getCurrentUser();
            if (currentUser) {
                this.gitService.setCurrentUserEmail(currentUser.email);
                this.outputChannel.appendLine(`🔐 Set current user email for commit filtering: ${currentUser.email}`);
            }
        } catch (error) {
            this.outputChannel.appendLine(`⚠️ Could not set current user email: ${error}`);
        }
        
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
            } else {
                this.outputChannel.appendLine(`❌ No linked ticket found for branch: ${event.newBranch}`);
            }
        } catch (error) {
            this.outputChannel.appendLine(`❌ Error handling branch change: ${error}`);
        }
    }

    private async findLinkedTicketForBranch(branchName: string, repoPath?: string): Promise<BranchTicketInfo | null> {
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

    private async autoPopulateTicketInfo(ticketInfo: BranchTicketInfo): Promise<void> {
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
        } catch (error) {
            this.outputChannel.appendLine(`❌ Error auto-populating UI: ${error}`);
        }
    }

    private async autoStartTimer(ticketInfo: BranchTicketInfo): Promise<void> {
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
        } catch (error) {
            this.outputChannel.appendLine(`❌ Error auto-starting timer: ${error}`);
        }
    }

    private async performInitialBranchCheck(): Promise<void> {
        try {
            // Check authentication before initial check
            const isAuthenticated = await this.authService.isAuthenticated();
            if (!isAuthenticated) {
                this.outputChannel.appendLine('User not authenticated. Skipping initial branch check.');
                return;
            }

            // Set current user email for commit filtering
            try {
                const currentUser = await this.authService.getCurrentUser();
                if (currentUser) {
                    this.gitService.setCurrentUserEmail(currentUser.email);
                    this.outputChannel.appendLine(`🔐 Set current user email for commit filtering: ${currentUser.email}`);
                }
            } catch (error) {
                this.outputChannel.appendLine(`⚠️ Could not set current user email: ${error}`);
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
        } catch (error) {
            this.outputChannel.appendLine(`❌ Error in initial branch check: ${error}`);
        }
    }

    public async handleCommit(event: CommitEvent): Promise<void> {
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
            await this.timeLogger.logTime(
                ticketInfo.ticketId,
                elapsedMinutes,
                event.commitMessage
            );
            this.outputChannel.appendLine('Time logged successfully for commit');
            
            // Show commit time logged notification
            vscode.window.showInformationMessage(`Time logged for commit: ${elapsedMinutes} minutes to ${ticketInfo.ticketId}`);
            
            // Reset the timer after successful logging
            this.timeLogger.stopTimer();
            this.timeLogger.resetTimer();
            this.outputChannel.appendLine('Timer reset after successful commit logging');
        } catch (error) {
            this.outputChannel.appendLine(`Error logging time for commit: ${error}`);
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
        this.outputChannel.appendLine(`Auto-timer settings updated: ${JSON.stringify(settings)}`);
    }

    public getAutoTimerSettings(): AutoTimerState {
        return { ...this.autoTimerState };
    }

    /**
     * Check authentication status and update service state
     */
    public async checkAuthenticationStatus(): Promise<void> {
        const isAuthenticated = await this.authService.isAuthenticated();
        
        if (!isAuthenticated && this.isInitialized) {
            this.outputChannel.appendLine('User not authenticated. Disabling branch change monitoring.');
            this.isInitialized = false;
            
            // Stop any running timers
            if (this.timeLogger.isTimerRunning()) {
                this.timeLogger.stopTimer();
                this.outputChannel.appendLine('Timer stopped due to authentication loss');
            }
        } else if (isAuthenticated && !this.isInitialized) {
            this.outputChannel.appendLine('User authenticated. Re-enabling branch change monitoring.');
            await this.initialize();
        }
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
        this.outputChannel.appendLine('Cleaning up Branch Change Service...');
        
        if (this.gitService) {
            this.gitService.dispose();
        }
        
        this.isInitialized = false;
        this.outputChannel.appendLine('Branch Change Service cleaned up');
    }
} 