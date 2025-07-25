"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomaticTimeLogger = void 0;
const vscode = require("vscode");
const GitEventMonitor_1 = require("./GitEventMonitor");
const jira_branch_discovery_1 = require("../test/jira-branch-discovery");
const JiraService_1 = require("./JiraService");
const ProductiveService_1 = require("./ProductiveService");
const AuthenticationService_1 = require("./AuthenticationService");
const JiraTimeLogger_1 = require("../JiraTimeLogger");
/**
 * Automatic Time Logger Service
 * Orchestrates automatic time logging based on git events
 */
class AutomaticTimeLogger {
    constructor(context) {
        this.timerInterval = null;
        // Event emitter for UI updates
        this.onStateChange = null;
        // Initialize services
        this.gitEventMonitor = new GitEventMonitor_1.GitEventMonitor();
        this.jiraBranchDiscovery = new jira_branch_discovery_1.JiraBranchDiscovery();
        this.jiraService = new JiraService_1.JiraService();
        this.productiveService = new ProductiveService_1.ProductiveService();
        this.authService = new AuthenticationService_1.AuthenticationService(context);
        this.timeLogger = new JiraTimeLogger_1.JiraTimeLogger();
        // Initialize state
        this.timerState = {
            isActive: false,
            currentTicket: null,
            currentProject: null,
            startTime: null,
            branchName: null,
            elapsedTime: 0,
            lastActivity: new Date()
        };
        // Load settings
        this.settings = this.loadSettings();
        // Register as git event listener
        this.gitEventMonitor.addListener(this);
        // Start timer update interval
        this.startTimerInterval();
        console.log('🤖 Automatic Time Logger initialized');
    }
    /**
     * Start the automatic time logging system
     */
    async start() {
        console.log('🚀 Starting Automatic Time Logger...');
        try {
            // Check if user is authenticated
            if (!(await this.authService.isAuthenticated())) {
                console.log('⚠️  User not authenticated, automatic logging disabled');
                this.showNotification('Please sign in to enable automatic time logging', 'warning');
                return;
            }
            // Initialize current state from current branch
            await this.initializeFromCurrentBranch();
            console.log('✅ Automatic Time Logger started successfully');
            this.showNotification('Automatic time logging is now active', 'success');
        }
        catch (error) {
            console.error('❌ Failed to start automatic time logger:', error);
            this.showNotification('Failed to start automatic time logging', 'error');
        }
    }
    /**
     * Stop the automatic time logging system
     */
    stop() {
        console.log('🛑 Stopping Automatic Time Logger...');
        // Stop active timer if running
        if (this.timerState.isActive) {
            this.stopTimer();
        }
        // Remove from git event listener
        this.gitEventMonitor.removeListener(this);
        // Stop timer interval
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        console.log('✅ Automatic Time Logger stopped');
    }
    /**
     * Git Event Listener Implementation
     */
    async onBranchSwitch(event) {
        console.log(`🌿 Branch switch detected: ${event.previousBranch} → ${event.branchName}`);
        // Stop timer on previous branch if active
        if (this.timerState.isActive && this.settings.autoStopOnCommit) {
            await this.stopAndLogTimer('Branch switched');
        }
        // Start timer on new branch if enabled
        if (this.settings.autoStartOnBranchSwitch) {
            await this.handleBranchSwitch(event.branchName);
        }
    }
    async onCommit(event) {
        console.log(`📝 Commit detected: "${event.commitMessage}"`);
        // Stop timer and log time if active
        if (this.timerState.isActive && this.settings.autoStopOnCommit) {
            await this.stopAndLogTimer(event.commitMessage || 'Code commit');
        }
    }
    async onRepositoryChange(event) {
        console.log('📁 Repository change detected');
        // Reinitialize from current branch
        await this.initializeFromCurrentBranch();
    }
    /**
     * Handle branch switch and ticket discovery
     */
    async handleBranchSwitch(branchName) {
        try {
            console.log(`🔍 Discovering ticket for branch: ${branchName}`);
            // Find ticket linked to this branch
            const ticketInfo = await this.discoverTicketForBranch(branchName);
            if (ticketInfo) {
                console.log(`✅ Found ticket: ${ticketInfo.ticketId} for ${branchName}`);
                // Update state
                this.timerState.currentTicket = ticketInfo.ticketId;
                this.timerState.currentProject = ticketInfo.projectKey;
                this.timerState.branchName = branchName;
                // Start timer if auto-start is enabled
                if (this.settings.enableAutoStart) {
                    await this.startTimer();
                }
                this.showNotification(`Auto-detected ticket: ${ticketInfo.ticketId} - ${ticketInfo.ticketSummary}`, 'success');
                // Notify UI of state change
                this.notifyStateChange();
            }
            else {
                console.log(`❌ No ticket found for branch: ${branchName}`);
                this.showNotification(`No ticket found for branch: ${branchName}`, 'warning');
            }
        }
        catch (error) {
            console.error('❌ Error handling branch switch:', error);
            this.showNotification('Failed to auto-detect ticket for branch', 'error');
        }
    }
    /**
     * Discover ticket for a given branch
     */
    async discoverTicketForBranch(branchName) {
        try {
            // Try Jira branch discovery first
            let ticketInfo = await this.jiraBranchDiscovery.findLinkedTicket();
            // If not found, try direct branch lookup
            if (!ticketInfo) {
                ticketInfo = await this.jiraBranchDiscovery.findBranchDirectly();
            }
            return ticketInfo;
        }
        catch (error) {
            console.error('❌ Error discovering ticket:', error);
            return null;
        }
    }
    /**
     * Start the timer
     */
    async startTimer() {
        if (this.timerState.isActive) {
            console.log('⚠️  Timer already active');
            return;
        }
        this.timerState.isActive = true;
        this.timerState.startTime = new Date();
        this.timerState.lastActivity = new Date();
        console.log(`⏰ Timer started for ticket: ${this.timerState.currentTicket}`);
        this.showNotification(`Timer started for ${this.timerState.currentTicket}`, 'info');
        this.notifyStateChange();
    }
    /**
     * Stop the timer
     */
    stopTimer() {
        if (!this.timerState.isActive) {
            console.log('⚠️  Timer not active');
            return;
        }
        this.timerState.isActive = false;
        // Calculate elapsed time
        if (this.timerState.startTime) {
            this.timerState.elapsedTime += Date.now() - this.timerState.startTime.getTime();
        }
        console.log(`⏹️  Timer stopped. Elapsed: ${this.formatElapsedTime()}`);
        this.showNotification(`Timer stopped. Time: ${this.formatElapsedTime()}`, 'info');
        this.notifyStateChange();
    }
    /**
     * Stop timer and log time to Jira and Productive
     */
    async stopAndLogTimer(description) {
        if (!this.timerState.isActive || !this.timerState.currentTicket) {
            console.log('⚠️  No active timer to log');
            return;
        }
        // Calculate final elapsed time
        this.stopTimer();
        const timeMinutes = Math.round(this.timerState.elapsedTime / (1000 * 60));
        if (timeMinutes < 1) {
            console.log('⚠️  Less than 1 minute elapsed, not logging');
            this.showNotification('Timer stopped (less than 1 minute)', 'info');
            return;
        }
        console.log(`📊 Logging ${timeMinutes} minutes to ticket: ${this.timerState.currentTicket}`);
        try {
            // Log to Jira
            await this.logTimeToJira(this.timerState.currentTicket, timeMinutes, description);
            // Log to Productive with service fallback
            await this.logTimeToProductive(this.timerState.currentTicket, this.timerState.currentProject, timeMinutes, description);
            this.showNotification(`✅ Logged ${timeMinutes}m to ${this.timerState.currentTicket}`, 'success');
            // Reset timer state
            this.resetTimerState();
        }
        catch (error) {
            console.error('❌ Error logging time:', error);
            this.showNotification('Failed to log time automatically', 'error');
        }
    }
    /**
     * Log time to Jira
     */
    async logTimeToJira(ticketId, timeMinutes, description) {
        try {
            await this.jiraService.logTime(ticketId, timeMinutes);
            console.log(`✅ Time logged to Jira: ${ticketId} - ${timeMinutes}m`);
        }
        catch (error) {
            console.error('❌ Failed to log time to Jira:', error);
            throw error;
        }
    }
    /**
     * Log time to Productive with service fallback
     */
    async logTimeToProductive(ticketId, projectKey, timeMinutes, description) {
        try {
            // Get Productive credentials
            const productiveCredentials = await this.authService.getProductiveCredentials();
            if (!productiveCredentials) {
                console.log('⚠️  No Productive credentials, skipping Productive logging');
                return;
            }
            // Map Jira project to Productive project
            const productiveProjectId = this.productiveService.mapJiraProjectToProductive(projectKey);
            if (!productiveProjectId) {
                console.log(`⚠️  No Productive project mapping for ${projectKey}`);
                return;
            }
            // Get user services with fallback
            const serviceId = await this.findAvailableService();
            if (!serviceId) {
                console.log('⚠️  No available service found in Productive');
                return;
            }
            // Log time with ticket reference
            const fullDescription = `${ticketId}: ${description}`;
            await this.productiveService.logMyTimeEntry(productiveProjectId, serviceId, timeMinutes, undefined, // Use today's date
            fullDescription);
            console.log(`✅ Time logged to Productive: ${projectKey} - ${timeMinutes}m`);
        }
        catch (error) {
            console.error('❌ Failed to log time to Productive:', error);
            // Don't throw - Productive logging is secondary
        }
    }
    /**
     * Find available service with fallback logic
     */
    async findAvailableService() {
        try {
            const userServices = await this.productiveService.getMyServices();
            if (userServices.length === 0) {
                console.log('⚠️  No services assigned to user');
                return null;
            }
            // Try services in order of preference
            for (const service of userServices) {
                if (service.active) {
                    console.log(`✅ Using service: ${service.serviceName} (${service.serviceId})`);
                    return service.serviceId;
                }
            }
            // If no active service, use the first one
            const fallbackService = userServices[0];
            console.log(`⚠️  Using fallback service: ${fallbackService.serviceName}`);
            return fallbackService.serviceId;
        }
        catch (error) {
            console.error('❌ Error finding available service:', error);
            return null;
        }
    }
    /**
     * Initialize state from current branch
     */
    async initializeFromCurrentBranch() {
        try {
            const currentBranch = this.gitEventMonitor.getCurrentBranch();
            if (!currentBranch) {
                console.log('⚠️  No current branch detected');
                return;
            }
            console.log(`🔍 Initializing from current branch: ${currentBranch}`);
            // Don't auto-start on initialization, just discover the ticket
            const ticketInfo = await this.discoverTicketForBranch(currentBranch);
            if (ticketInfo) {
                this.timerState.currentTicket = ticketInfo.ticketId;
                this.timerState.currentProject = ticketInfo.projectKey;
                this.timerState.branchName = currentBranch;
                console.log(`✅ Current ticket: ${ticketInfo.ticketId}`);
                this.showNotification(`Current ticket: ${ticketInfo.ticketId} - ${ticketInfo.ticketSummary}`, 'info');
                this.notifyStateChange();
            }
        }
        catch (error) {
            console.error('❌ Error initializing from current branch:', error);
        }
    }
    /**
     * Start timer update interval
     */
    startTimerInterval() {
        this.timerInterval = setInterval(() => {
            if (this.timerState.isActive) {
                // Update elapsed time for UI
                this.notifyStateChange();
            }
        }, 1000);
    }
    /**
     * Reset timer state
     */
    resetTimerState() {
        this.timerState.isActive = false;
        this.timerState.startTime = null;
        this.timerState.elapsedTime = 0;
        this.timerState.lastActivity = new Date();
        this.notifyStateChange();
    }
    /**
     * Format elapsed time for display
     */
    formatElapsedTime() {
        const totalMs = this.timerState.isActive && this.timerState.startTime
            ? this.timerState.elapsedTime + (Date.now() - this.timerState.startTime.getTime())
            : this.timerState.elapsedTime;
        const totalSeconds = Math.floor(totalMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    /**
     * Load settings from VS Code configuration
     */
    loadSettings() {
        const config = vscode.workspace.getConfiguration('jiraTimeTracker.automation');
        return {
            enableAutoStart: config.get('enableAutoStart', true),
            enableAutoStop: config.get('enableAutoStop', true),
            autoStartOnBranchSwitch: config.get('autoStartOnBranchSwitch', true),
            autoStopOnCommit: config.get('autoStopOnCommit', true),
            serviceFallbackEnabled: config.get('serviceFallbackEnabled', true),
            showUINotifications: config.get('showUINotifications', true)
        };
    }
    /**
     * Show notification to user
     */
    showNotification(message, type) {
        if (!this.settings.showUINotifications)
            return;
        switch (type) {
            case 'success':
                vscode.window.showInformationMessage(`🤖 ${message}`);
                break;
            case 'error':
                vscode.window.showErrorMessage(`🤖 ${message}`);
                break;
            case 'warning':
                vscode.window.showWarningMessage(`🤖 ${message}`);
                break;
            case 'info':
                vscode.window.showInformationMessage(`🤖 ${message}`);
                break;
        }
    }
    /**
     * Set state change callback for UI updates
     */
    setOnStateChange(callback) {
        this.onStateChange = callback;
    }
    /**
     * Notify UI of state changes
     */
    notifyStateChange() {
        if (this.onStateChange) {
            this.onStateChange({ ...this.timerState });
        }
    }
    /**
     * Get current state
     */
    getState() {
        return { ...this.timerState };
    }
    /**
     * Get formatted time for display
     */
    getFormattedTime() {
        return this.formatElapsedTime();
    }
    /**
     * Manual start timer (for UI)
     */
    async manualStartTimer() {
        if (!this.timerState.currentTicket) {
            this.showNotification('No ticket detected for current branch', 'warning');
            return;
        }
        await this.startTimer();
    }
    /**
     * Manual stop timer (for UI)
     */
    manualStopTimer() {
        this.stopTimer();
    }
    /**
     * Manual submit time (for UI)
     */
    async manualSubmitTime(description) {
        await this.stopAndLogTimer(description || 'Manual time submission');
    }
    /**
     * Clear current ticket (for UI)
     */
    clearCurrentTicket() {
        this.resetTimerState();
        this.timerState.currentTicket = null;
        this.timerState.currentProject = null;
        this.timerState.branchName = null;
        this.notifyStateChange();
    }
    /**
     * Update settings
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        console.log('⚙️  Automation settings updated:', this.settings);
    }
    /**
     * Dispose of resources
     */
    dispose() {
        this.stop();
    }
}
exports.AutomaticTimeLogger = AutomaticTimeLogger;
//# sourceMappingURL=AutomaticTimeLogger.js.map