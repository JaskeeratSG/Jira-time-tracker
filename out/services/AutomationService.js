"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationService = void 0;
const vscode = require("vscode");
const path = require("path");
const GitService_1 = require("./GitService");
const jira_branch_discovery_1 = require("../test/jira-branch-discovery");
const JiraService_1 = require("./JiraService");
const ProductiveService_1 = require("./ProductiveService");
const AuthenticationService_1 = require("./AuthenticationService");
/**
 * Comprehensive Automation Service
 * Handles automatic time logging based on git events
 */
class AutomationService {
    constructor(context) {
        this.gitWatchers = []; // Change to array for multiple watchers
        this.timerInterval = null;
        // Event emitter for UI updates
        this.onStateChangeCallback = null;
        this.context = context;
        this.gitService = new GitService_1.GitService();
        this.branchDiscovery = new jira_branch_discovery_1.JiraBranchDiscovery();
        this.jiraService = new JiraService_1.JiraService();
        this.productiveService = new ProductiveService_1.ProductiveService();
        this.authService = new AuthenticationService_1.AuthenticationService(context);
        // Initialize automation state
        this.automationState = {
            isActive: false,
            currentTicket: null,
            currentProject: null,
            currentBranch: null,
            currentWorkspacePath: null,
            timerStartTime: null,
            elapsedTime: 0,
            lastCommitHash: null,
            autoStarted: false
        };
        // Create status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.command = 'jiraTimeTracker.showAutomationStatus';
        this.updateStatusBar();
        this.statusBarItem.show();
        this.initialize();
    }
    /**
     * Initialize the automation service
     */
    async initialize() {
        try {
            console.log('🤖 Initializing Automation Service...');
            // Load previous state if available
            await this.loadState();
            // Set up git monitoring
            await this.setupGitMonitoring();
            // Check current branch on startup
            await this.checkCurrentBranch();
            // Start timer interval for UI updates
            this.startTimerInterval();
            console.log('✅ Automation Service initialized successfully');
        }
        catch (error) {
            console.error('❌ Error initializing Automation Service:', error);
            vscode.window.showErrorMessage('Failed to initialize automation service');
        }
    }
    /**
     * Set up git monitoring for branch changes and commits
     */
    async setupGitMonitoring() {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                throw new Error('No workspace folder found');
            }
            // Watch for git HEAD changes (branch switches) in all workspace folders
            workspaceFolders.forEach(folder => {
                const gitPath = path.join(folder.uri.fsPath, '.git');
                // Check if this folder has a git repository
                if (!require('fs').existsSync(gitPath)) {
                    console.log(`⚠️  No git repository found in ${folder.name}`);
                    return;
                }
                const headPath = path.join(gitPath, 'HEAD');
                const headWatcher = vscode.workspace.createFileSystemWatcher(headPath);
                this.gitWatchers.push(headWatcher);
                headWatcher.onDidChange(async () => {
                    console.log(`🔄 Git HEAD changed in ${folder.name} - branch switch detected`);
                    await this.handleBranchChange(folder.uri.fsPath);
                });
                // Watch for commits (index changes)
                const indexPath = path.join(gitPath, 'index');
                const indexWatcher = vscode.workspace.createFileSystemWatcher(indexPath);
                this.gitWatchers.push(indexWatcher);
                indexWatcher.onDidChange(async () => {
                    console.log(`📝 Git index changed in ${folder.name} - potential commit detected`);
                    await this.handlePotentialCommit(folder.uri.fsPath);
                });
                console.log(`👀 Git monitoring set up for ${folder.name}`);
            });
            console.log('👀 Git monitoring set up successfully for all workspace folders');
        }
        catch (error) {
            console.error('❌ Error setting up git monitoring:', error);
        }
    }
    /**
     * Handle branch change event
     */
    async handleBranchChange(workspacePath) {
        try {
            // Small delay to ensure git operations are complete
            setTimeout(async () => {
                const newBranch = await this.gitService.getBranchName(workspacePath);
                if (newBranch !== this.automationState.currentBranch || workspacePath !== this.automationState.currentWorkspacePath) {
                    console.log(`🌿 Branch changed: ${this.automationState.currentBranch} → ${newBranch} (in ${path.basename(workspacePath)})`);
                    // Stop current timer if active and auto-started
                    if (this.automationState.isActive && this.automationState.autoStarted) {
                        await this.stopAndLogTime('Branch switch - time logged automatically');
                    }
                    // Update branch and workspace
                    this.automationState.currentBranch = newBranch;
                    this.automationState.currentWorkspacePath = workspacePath;
                    // Try to auto-detect ticket for new branch
                    await this.autoDetectAndStartTimer(newBranch, workspacePath);
                    this.saveState();
                    this.notifyStateChange();
                }
            }, 500);
        }
        catch (error) {
            console.error('❌ Error handling branch change:', error);
        }
    }
    /**
     * Handle potential commit event
     */
    async handlePotentialCommit(workspacePath) {
        try {
            // Small delay to ensure commit is complete
            setTimeout(async () => {
                const currentCommit = await this.gitService.getCurrentCommit(workspacePath);
                if (currentCommit !== this.automationState.lastCommitHash) {
                    console.log(`📝 Commit detected: ${currentCommit.substring(0, 8)} (in ${path.basename(workspacePath)})`);
                    // Stop timer and log time if active and auto-started
                    if (this.automationState.isActive && this.automationState.autoStarted) {
                        // Get commit message for description
                        const commitMessage = await this.getLastCommitMessage(workspacePath);
                        await this.stopAndLogTime(commitMessage || 'Commit - time logged automatically');
                    }
                    this.automationState.lastCommitHash = currentCommit;
                    this.saveState();
                    this.notifyStateChange();
                }
            }, 1000);
        }
        catch (error) {
            console.error('❌ Error handling commit:', error);
        }
    }
    /**
     * Auto-detect ticket from branch and start timer
     */
    async autoDetectAndStartTimer(branchName, workspacePath) {
        try {
            console.log(`🔍 Auto-detecting ticket for branch: ${branchName} (in ${path.basename(workspacePath)})`);
            // Try to find linked ticket using workspace-specific discovery
            const ticketInfo = await this.branchDiscovery.findLinkedTicket(workspacePath);
            if (ticketInfo) {
                console.log(`✅ Found ticket: ${ticketInfo.ticketId}`);
                this.automationState.currentTicket = ticketInfo.ticketId;
                this.automationState.currentProject = ticketInfo.projectKey;
                this.automationState.currentWorkspacePath = workspacePath;
                // Auto-start timer
                await this.startTimer(true);
                // Show notification
                vscode.window.showInformationMessage(`🤖 Auto-detected ${ticketInfo.ticketId}: ${ticketInfo.ticketSummary}. Timer started!`, 'Stop Timer').then(selection => {
                    if (selection === 'Stop Timer') {
                        this.stopTimer();
                    }
                });
            }
            else {
                console.log('❌ No ticket found for branch');
                // Try fallback: extract ticket from branch name
                const extractedTicket = this.gitService.extractTicketId(branchName);
                if (extractedTicket) {
                    console.log(`🔍 Extracted ticket from branch name: ${extractedTicket}`);
                    this.automationState.currentTicket = extractedTicket;
                    this.automationState.currentProject = this.gitService.extractProjectKey(extractedTicket);
                    this.automationState.currentWorkspacePath = workspacePath;
                    // Auto-start timer
                    await this.startTimer(true);
                    vscode.window.showInformationMessage(`🤖 Auto-detected ${extractedTicket} from branch name. Timer started!`, 'Stop Timer').then(selection => {
                        if (selection === 'Stop Timer') {
                            this.stopTimer();
                        }
                    });
                }
                else {
                    // Clear current ticket
                    this.automationState.currentTicket = null;
                    this.automationState.currentProject = null;
                    // Show suggestion
                    vscode.window.showInformationMessage(`Branch ${branchName} - no linked ticket found. Use manual selection for time tracking.`);
                }
            }
        }
        catch (error) {
            console.error('❌ Error in auto-detection:', error);
        }
    }
    /**
     * Start timer
     */
    async startTimer(autoStarted = false) {
        if (this.automationState.isActive) {
            console.log('⚠️  Timer already active');
            return;
        }
        if (!this.automationState.currentTicket) {
            throw new Error('No ticket selected for time tracking');
        }
        this.automationState.isActive = true;
        this.automationState.timerStartTime = new Date();
        this.automationState.autoStarted = autoStarted;
        this.automationState.elapsedTime = 0;
        const mode = autoStarted ? '🤖 Auto' : '👤 Manual';
        console.log(`⏰ Timer started (${mode}) for ticket: ${this.automationState.currentTicket}`);
        if (!autoStarted) {
            vscode.window.showInformationMessage(`Timer started for ${this.automationState.currentTicket}`);
        }
        this.updateStatusBar();
        this.saveState();
        this.notifyStateChange();
    }
    /**
     * Stop timer
     */
    stopTimer() {
        if (!this.automationState.isActive) {
            console.log('⚠️  Timer not active');
            return;
        }
        if (this.automationState.timerStartTime) {
            this.automationState.elapsedTime += Date.now() - this.automationState.timerStartTime.getTime();
        }
        this.automationState.isActive = false;
        this.automationState.timerStartTime = null;
        console.log(`⏹️  Timer stopped. Elapsed: ${this.formatElapsedTime()}`);
        this.updateStatusBar();
        this.saveState();
        this.notifyStateChange();
    }
    /**
     * Stop timer and log time automatically
     */
    async stopAndLogTime(description) {
        if (!this.automationState.isActive || !this.automationState.currentTicket) {
            return;
        }
        // Calculate final elapsed time
        this.stopTimer();
        const timeMinutes = Math.round(this.automationState.elapsedTime / (1000 * 60));
        if (timeMinutes < 1) {
            console.log('⚠️  Less than 1 minute elapsed, not logging');
            vscode.window.showInformationMessage('Timer stopped (less than 1 minute elapsed)');
            return;
        }
        console.log(`📊 Auto-logging ${timeMinutes} minutes to ticket: ${this.automationState.currentTicket}`);
        try {
            // Log to Jira
            await this.jiraService.logTime(this.automationState.currentTicket, timeMinutes);
            console.log(`✅ Logged to Jira: ${timeMinutes}m`);
            // Log to Productive if configured
            const hasProductive = await this.authService.hasProductiveIntegration();
            if (hasProductive) {
                await this.logToProductive(timeMinutes, description);
            }
            const message = hasProductive
                ? `✅ Auto-logged ${timeMinutes}m to ${this.automationState.currentTicket} (Jira + Productive)`
                : `✅ Auto-logged ${timeMinutes}m to ${this.automationState.currentTicket} (Jira)`;
            vscode.window.showInformationMessage(message);
            // Reset timer state
            this.resetTimerState();
        }
        catch (error) {
            console.error('❌ Error auto-logging time:', error);
            vscode.window.showErrorMessage(`Failed to auto-log time: ${error.message}`);
        }
    }
    /**
     * Log time to Productive with service discovery
     */
    async logToProductive(timeMinutes, description) {
        try {
            if (!this.automationState.currentProject || !this.automationState.currentTicket) {
                throw new Error('Missing project or ticket information');
            }
            // Get user info
            const user = await this.productiveService.getAuthenticatedUser();
            // Map project to Productive project ID
            const productiveProjectId = await this.getProductiveProjectId(this.automationState.currentProject);
            if (!productiveProjectId) {
                throw new Error(`No Productive project mapping found for ${this.automationState.currentProject}`);
            }
            // Discover appropriate service
            const serviceResult = await this.discoverUserService(user.id, productiveProjectId);
            if (!serviceResult.serviceId) {
                throw new Error(`Service discovery failed: ${serviceResult.message}`);
            }
            // Log time to Productive
            await this.productiveService.logTime(productiveProjectId, timeMinutes, undefined, // Use today's date
            `${this.automationState.currentTicket}: ${description}`, this.automationState.currentTicket);
            console.log(`✅ Logged to Productive: ${timeMinutes}m (Service: ${serviceResult.serviceName})`);
        }
        catch (error) {
            console.error('❌ Productive logging failed:', error);
            // Don't throw - Jira logging should still succeed
        }
    }
    /**
     * Discover appropriate service for user in project
     */
    async discoverUserService(personId, projectId) {
        try {
            // Try to get user's services for this project
            const userServices = await this.productiveService.getMyServices();
            if (userServices.length > 0) {
                // Use first available service
                return {
                    serviceId: userServices[0].serviceId,
                    serviceName: userServices[0].serviceName,
                    confidence: 'HIGH',
                    message: 'Using user\'s primary service'
                };
            }
            // Fallback: get all services and use first one
            const allServices = await this.productiveService.getServices();
            if (allServices.length > 0) {
                return {
                    serviceId: allServices[0].id,
                    serviceName: allServices[0].name,
                    confidence: 'LOW',
                    message: 'Using fallback service'
                };
            }
            return {
                serviceId: null,
                serviceName: null,
                confidence: 'LOW',
                message: 'No services found'
            };
        }
        catch (error) {
            return {
                serviceId: null,
                serviceName: null,
                confidence: 'LOW',
                message: `Service discovery error: ${error.message}`
            };
        }
    }
    /**
     * Get Productive project ID for Jira project
     */
    async getProductiveProjectId(jiraProjectKey) {
        try {
            // Check workspace configuration for project mapping
            const config = vscode.workspace.getConfiguration('jiraTimeTracker');
            const projectMapping = config.get('productive.projectMapping') || {};
            if (projectMapping[jiraProjectKey]) {
                return projectMapping[jiraProjectKey];
            }
            // Try to find project by name matching
            const projects = await this.productiveService.getProjects();
            const matchingProject = projects.find(p => p.name.toLowerCase().includes(jiraProjectKey.toLowerCase()) ||
                jiraProjectKey.toLowerCase().includes(p.name.toLowerCase()));
            return matchingProject?.id || null;
        }
        catch (error) {
            console.error('Error getting Productive project ID:', error);
            return null;
        }
    }
    /**
     * Check current branch on startup
     */
    async checkCurrentBranch() {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                console.log('⚠️  No workspace folders found');
                return;
            }
            // Check all workspace folders for git repositories
            for (const folder of workspaceFolders) {
                const gitPath = path.join(folder.uri.fsPath, '.git');
                if (!require('fs').existsSync(gitPath)) {
                    console.log(`⚠️  No git repository found in ${folder.name}`);
                    continue;
                }
                try {
                    const currentBranch = await this.gitService.getBranchName(folder.uri.fsPath);
                    console.log(`📋 Current branch in ${folder.name}: ${currentBranch}`);
                    // Don't auto-start on startup, just detect
                    const ticketInfo = await this.branchDiscovery.findLinkedTicket(folder.uri.fsPath);
                    if (ticketInfo) {
                        // Use the first workspace that has a valid ticket
                        this.automationState.currentBranch = currentBranch;
                        this.automationState.currentTicket = ticketInfo.ticketId;
                        this.automationState.currentProject = ticketInfo.projectKey;
                        this.automationState.currentWorkspacePath = folder.uri.fsPath;
                        console.log(`✅ Detected ticket: ${ticketInfo.ticketId} (${ticketInfo.ticketSummary}) in ${folder.name}`);
                        // Show notification without auto-starting
                        vscode.window.showInformationMessage(`🎯 Detected ${ticketInfo.ticketId}: ${ticketInfo.ticketSummary} in ${folder.name}`, 'Start Timer').then(selection => {
                            if (selection === 'Start Timer') {
                                this.startTimer(false);
                            }
                        });
                        break; // Stop after finding first valid ticket
                    }
                }
                catch (folderError) {
                    console.log(`⚠️  Error checking ${folder.name}:`, folderError.message);
                }
            }
            this.updateStatusBar();
            this.saveState();
            this.notifyStateChange();
        }
        catch (error) {
            console.error('❌ Error checking current branch:', error);
        }
    }
    /**
     * Get last commit message
     */
    async getLastCommitMessage(workspacePath) {
        try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);
            const { stdout } = await execAsync('git log -1 --pretty=format:"%s"', {
                cwd: workspacePath
            });
            return stdout.trim();
        }
        catch (error) {
            console.error('Error getting commit message:', error);
            return null;
        }
    }
    /**
     * Reset timer state
     */
    resetTimerState() {
        this.automationState.isActive = false;
        this.automationState.timerStartTime = null;
        this.automationState.elapsedTime = 0;
        this.automationState.autoStarted = false;
        this.updateStatusBar();
        this.saveState();
        this.notifyStateChange();
    }
    /**
     * Format elapsed time
     */
    formatElapsedTime() {
        const totalMs = this.automationState.isActive && this.automationState.timerStartTime
            ? this.automationState.elapsedTime + (Date.now() - this.automationState.timerStartTime.getTime())
            : this.automationState.elapsedTime;
        const totalSeconds = Math.floor(totalMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    /**
     * Update status bar
     */
    updateStatusBar() {
        if (!this.automationState.currentTicket) {
            this.statusBarItem.text = '🤖 Auto-Track: No ticket';
            this.statusBarItem.tooltip = 'Switch to a branch with a linked Jira ticket to enable auto-tracking';
            return;
        }
        const time = this.formatElapsedTime();
        const status = this.automationState.isActive ? '▶️' : '⏸️';
        const mode = this.automationState.autoStarted ? '🤖' : '👤';
        this.statusBarItem.text = `${status} ${mode} ${this.automationState.currentTicket} ${time}`;
        this.statusBarItem.tooltip = this.automationState.isActive
            ? `Auto-tracking time for ${this.automationState.currentTicket} (${this.automationState.autoStarted ? 'Auto-started' : 'Manual'})`
            : `Ready to track ${this.automationState.currentTicket} (Click to start)`;
    }
    /**
     * Start timer update interval
     */
    startTimerInterval() {
        this.timerInterval = setInterval(() => {
            if (this.automationState.isActive) {
                this.updateStatusBar();
                this.notifyStateChange();
            }
        }, 1000);
    }
    /**
     * Save automation state
     */
    saveState() {
        this.context.globalState.update('automationState', this.automationState);
    }
    /**
     * Load automation state
     */
    async loadState() {
        const savedState = this.context.globalState.get('automationState');
        if (savedState) {
            this.automationState = { ...this.automationState, ...savedState };
            // Don't restore active timer state on startup
            this.automationState.isActive = false;
            this.automationState.timerStartTime = null;
            console.log('📋 Loaded previous automation state');
        }
    }
    /**
     * Set state change callback for UI updates
     */
    setOnStateChange(callback) {
        this.onStateChangeCallback = callback;
    }
    /**
     * Notify state change
     */
    notifyStateChange() {
        if (this.onStateChangeCallback) {
            this.onStateChangeCallback(this.automationState);
        }
    }
    /**
     * Get current automation state
     */
    getState() {
        return { ...this.automationState };
    }
    /**
     * Manual timer control methods
     */
    async manualStartTimer(ticketId) {
        if (ticketId) {
            // Try to get ticket info
            const ticketInfo = await this.branchDiscovery.findLinkedTicket();
            if (ticketInfo && ticketInfo.ticketId === ticketId) {
                this.automationState.currentTicket = ticketInfo.ticketId;
                this.automationState.currentProject = ticketInfo.projectKey;
            }
            else {
                this.automationState.currentTicket = ticketId;
                this.automationState.currentProject = ticketId.split('-')[0];
            }
        }
        await this.startTimer(false);
    }
    manualStopTimer() {
        this.stopTimer();
    }
    async manualSubmitTime(description) {
        if (!this.automationState.currentTicket) {
            throw new Error('No ticket selected');
        }
        await this.stopAndLogTime(description || 'Manual time submission');
    }
    /**
     * Clear auto-detected ticket
     */
    clearAutoDetection() {
        this.automationState.currentTicket = null;
        this.automationState.currentProject = null;
        if (this.automationState.isActive && this.automationState.autoStarted) {
            this.stopTimer();
        }
        this.updateStatusBar();
        this.saveState();
        this.notifyStateChange();
    }
    /**
     * Dispose automation service
     */
    dispose() {
        this.gitWatchers.forEach(watcher => watcher.dispose());
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        this.statusBarItem.dispose();
        console.log('🛑 Automation Service disposed');
    }
}
exports.AutomationService = AutomationService;
//# sourceMappingURL=AutomationService.js.map