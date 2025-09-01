import * as vscode from 'vscode';
import axios from 'axios';
import { JiraService } from './services/JiraService';
import { AuthenticationService } from './services/AuthenticationService';
import { GitService } from './services/GitService';
import { getBranchName } from './utils/git';
import { createOutputChannel } from './utils/outputChannel';
import { BranchTicketInfo } from './services/BranchChangeService';

export class JiraTimeLogger {
    private timer: NodeJS.Timeout | null = null;
    private startTime: number = 0;
    private elapsedTime: number = 0;
    private isRunning: boolean = false;
    private statusBarItem: vscode.StatusBarItem;
    public readonly jiraService: JiraService;
    private currentProject: string | null = null;
    private currentIssue: string | null = null;
    private outputChannel: vscode.OutputChannel;
    // Add callback for ticket updates
    private onTicketPopulated?: (ticketInfo: BranchTicketInfo) => void;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        this.jiraService = new JiraService();
        this.outputChannel = vscode.window.createOutputChannel('Jira Time Tracker - Logger');
        this.updateStatusBar();
    }

    /**
     * Log message to both console and VS Code output channel
     */
    /**
     * Check if logging is enabled via configuration
     */
    private isLoggingEnabled(): boolean {
        const config = vscode.workspace.getConfiguration('jiraTimeTracker');
        return config.get<boolean>('enableLogging', true); // Always enabled by default
    }

        private log(message: string, showOutput: boolean = false): void {
        // Always log to console and output channel
        console.log(message);
        this.outputChannel.appendLine(message);

        // Only show output channel when explicitly requested
        if (showOutput) {
            // this.outputChannel.show(true); // Disabled to prevent auto-opening
        }
    }

    /**
     * Show the output channel for debugging Productive integration
     */
    private showProductiveOutput(): void {
        // Only show output channel when explicitly requested
        // this.outputChannel.show(true); // Disabled to prevent auto-opening
    }

    updateJiraService(authService: AuthenticationService) {
        // Create a new JiraService with the authentication service
        (this as any).jiraService = new JiraService(authService);
    }

    /**
     * Set callback for when ticket information is populated
     */
    public setOnTicketPopulated(callback: (ticketInfo: BranchTicketInfo) => void): void {
        this.onTicketPopulated = callback;
    }

    async startTimer() {
        // Check authentication first
        if (!(await this.jiraService.isAuthenticated())) {
            vscode.window.showErrorMessage('User not authenticated. Please log in first.');
            return;
        }

        if (this.isRunning) {
            vscode.window.showWarningMessage('Timer is already running');
            return;
        }

        if (!this.currentIssue) {
            vscode.window.showErrorMessage('No JIRA ticket selected');
            return;
        }

        this.isRunning = true;
        this.startTime = Date.now() - this.elapsedTime;
        this.timer = setInterval(() => this.updateStatusBar(), 1000);
        this.updateStatusBar();
    }

    stopTimer() {
        if (!this.isRunning) return;
        
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.elapsedTime = Date.now() - this.startTime;
        this.isRunning = false;
        this.updateStatusBar();
    }

    async resumeTimer() {
        // Check authentication first
        if (!(await this.jiraService.isAuthenticated())) {
            vscode.window.showErrorMessage('User not authenticated. Please log in first.');
            return;
        }

        if (this.isRunning) {
            vscode.window.showWarningMessage('Timer is already running');
            return;
        }
        if (this.elapsedTime === 0) {
            vscode.window.showWarningMessage('No paused timer to resume');
            return;
        }
        this.startTimer();
    }

    /**
     * Check authentication and stop timer if user is not authenticated
     */
    public async checkAuthenticationAndStopTimerIfNeeded(): Promise<void> {
        try {
            if (!(await this.jiraService.isAuthenticated())) {
                if (this.isRunning) {
                    this.stopTimer();
                    vscode.window.showWarningMessage('Timer stopped: User not authenticated');
                }
            }
        } catch (error) {
            // If there's an error checking authentication, stop the timer for safety
            if (this.isRunning) {
                this.stopTimer();
                vscode.window.showWarningMessage('Timer stopped: Authentication check failed');
            }
        }
    }

    /**
     * Get the last commit message using git command
     */
    private async getLastCommitMessage(): Promise<string | null> {
        try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);
            
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                this.log('No workspace folder found for getting commit message');
                return null;
            }
            
            const { stdout } = await execAsync('git log -1 --pretty=format:"%s"', {
                cwd: workspaceFolder.uri.fsPath
            });
            
            const commitMessage = stdout.trim();
            this.log(`Last commit message: ${commitMessage}`);
            return commitMessage || null;
        } catch (error) {
            this.log(`Error getting last commit message: ${error}`);
            return null;
        }
    }

    /**
     * Auto-start timer when human file changes are detected
     */
    public async autoStartTimerOnFileChange(fileChangeEvent: any): Promise<void> {
        try {
            // Check if timer is already running
            if (this.isRunning) {
                this.log(`⏭️ Timer already running, skipping auto-start for file: ${fileChangeEvent.filePath}`);
                return;
            }

            // Check authentication
            if (!(await this.jiraService.isAuthenticated())) {
                this.log(`⚠️ User not authenticated, skipping auto-start for file: ${fileChangeEvent.filePath}`);
                return;
            }

            // Use the branch from the file change event
            const eventBranch = fileChangeEvent.branch;
            if (!eventBranch) {
                this.log(`⚠️ No branch information in file change event, skipping auto-start`);
                return;
            }

            // Find linked ticket for the current branch
            this.log(`🔍 Checking for linked ticket on branch: ${eventBranch}`);
            
            // Get the GitService from the BranchChangeService (if available)
            // For now, we'll use a simple approach to find the ticket
            const ticketKey = this.extractJiraTicketKey(eventBranch);
            
            if (ticketKey) {
                this.log(`🎯 Found ticket key in branch: ${ticketKey}`);
                
                try {
                    // Fetch ticket details from Jira
                    const credentials = await this.jiraService.getCurrentCredentials();
                    if (!credentials) {
                        this.log(`⚠️ No Jira credentials available`);
                        return;
                    }

                    const response = await axios.get(
                        `${credentials.baseUrl}/rest/api/2/issue/${ticketKey}`,
                        {
                            auth: {
                                username: credentials.email,
                                password: credentials.apiToken
                            },
                            headers: {
                                'Accept': 'application/json'
                            }
                        }
                    );

                    if (response.data) {
                        const ticketDetails = response.data;
                        const projectKey = ticketDetails.fields.project.key;
                        
                        this.log(`✅ Found linked ticket: ${ticketKey} (${projectKey})`);
                        
                        // Set the current issue and project
                        this.currentIssue = ticketKey;
                        this.currentProject = projectKey;
                        
                        // Create ticket info for UI update
                        const ticketInfo: BranchTicketInfo = {
                            ticketId: ticketKey,
                            projectKey: projectKey,
                            summary: ticketDetails.fields.summary
                        };
                        
                        // Trigger UI update callback if available
                        if (this.onTicketPopulated) {
                            this.onTicketPopulated(ticketInfo);
                        }
                        
                        // Start the timer
                        await this.startTimer();
                        
                        // Show notification
                        vscode.window.showInformationMessage(
                            `Timer auto-started for ${eventBranch} branch (Ticket: ${ticketKey})`,
                            'View Timer'
                        );
                    } else {
                        this.log(`⚠️ No ticket details found for: ${ticketKey}`);
                    }
                } catch (error: any) {
                    this.log(`❌ Error fetching ticket details for ${ticketKey}: ${error.message}`);
                }
            } else {
                this.log(`⚠️ No linked ticket found for branch: ${eventBranch}, keeping timer stopped`);
            }
        } catch (error) {
            this.log(`❌ Error in auto-start timer: ${error}`);
        }
    }

    /**
     * Extract Jira ticket key from branch name
     */
    private extractJiraTicketKey(branchName: string): string | null {
        this.log(`🔍 Extracting Jira ticket key from branch: "${branchName}"`);
        
        // Common patterns for Jira ticket keys in branch names
        const patterns = [
            {
                name: "Basic pattern with numbers",
                regex: /([A-Z0-9]+-\d+)/, 
                example: "CLUB59-234"
            },
            {
                name: "Feature branch pattern",
                regex: /(?:feature|bugfix|hotfix|release)\/([A-Z0-9]+-\d+)/i, 
                example: "feature/CLUB59-234"
            },
            {
                name: "Branch prefix pattern",
                regex: /(?:branch|b)\/([A-Z0-9]+-\d+)/i, 
                example: "branch/CLUB59-234"
            },
            {
                name: "Conventional commit pattern",
                regex: /(?:feat|fix|chore|task|story|bug)\/([A-Z0-9]+-\d+)/i, 
                example: "feat/CLUB59-234"
            },
            {
                name: "Any prefix pattern",
                regex: /(?:[a-zA-Z0-9_-]+)\/([A-Z0-9]+-\d+)/i, 
                example: "any-prefix/CLUB59-234"
            },
            {
                name: "Standalone pattern",
                regex: /^([A-Z0-9]+-\d+)$/i, 
                example: "CLUB59-234"
            }
        ];

        for (let i = 0; i < patterns.length; i++) {
            const pattern = patterns[i];
            const match = branchName.match(pattern?.regex);
            if (match) {
                this.log(`✅ Pattern ${i + 1} matched: "${match[1]}" from branch "${branchName}"`);
                return match[1]; // Return the captured ticket key
            } else {
                this.log(`❌ Pattern ${i + 1} did not match: ${pattern}`);
            }
        }

        this.log(`❌ No patterns matched for branch: "${branchName}"`);
        return null;
    }

    async finishAndLog() {
        // Check authentication first
        if (!(await this.jiraService.isAuthenticated())) {
            vscode.window.showErrorMessage('User not authenticated. Please log in first.');
            return;
        }

        this.log(`\nFINISH AND LOG - STARTING DUAL TIME LOGGING`, true);
        this.log(`═══════════════════════════════════════════════════════════`);
        
        this.stopTimer();
        const timeSpent = Math.round(this.elapsedTime / 1000 / 60); // Convert to minutes
        const ticketId = this.currentIssue || await this.getTicketFromBranch();
        
        this.log(`Timer stopped. Time spent: ${timeSpent} minutes`);
        this.log(`Ticket ID: ${ticketId}`);
        
        if (ticketId) {
            try {
                this.log(`\nStarting dual time logging (Jira + Productive)...`);
                
                // Get the last commit message for description
                const commitMessage = await this.getLastCommitMessage();
                const description = commitMessage || `Time logged via VS Code extension`;
                this.log(`Using description: ${description}`);
                
                // Use the enhanced logTime method that includes Productive integration
                await this.logTime(ticketId, timeSpent, description);
                
                // Show time logged notification
                vscode.window.showInformationMessage(`Time logged: ${timeSpent} minutes to ${ticketId}`);
                
                this.resetTimer();
                this.currentIssue = null;
                this.log(`Dual time logging completed successfully`);
            } catch (error:any) {
                this.log(`Dual time logging failed: ${error.message}`);
                vscode.window.showErrorMessage(`Failed to log time: ${error.message}`);
            }
        } else {
            this.log(`No ticket ID found for time logging`);
            vscode.window.showErrorMessage('No JIRA ticket selected for time logging');
        }
    }

    public resetTimer() {
        this.elapsedTime = 0;
        this.startTime = 0;
        this.isRunning = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.updateStatusBar();
    }

    private updateStatusBar() {
        const minutes = Math.floor(this.elapsedTime / 1000 / 60);
        const seconds = Math.floor((this.elapsedTime / 1000) % 60);
        this.statusBarItem.text = `$(clock) ${minutes}:${seconds.toString().padStart(2, '0')}`;
        this.statusBarItem.show();
        
        // Check authentication every 30 seconds (when seconds is 0 or 30)
        if (this.isRunning && (seconds === 0 || seconds === 30)) {
            this.checkAuthenticationAndStopTimerIfNeeded();
        }
    }

    private async getTicketId(): Promise<string | null> {
        // First, select a project
        const project = await this.selectProject();
        if (!project) return null;

        this.currentProject = project.key;

        const selection = await vscode.window.showQuickPick([
            'Get ticket from branch',
            'Select ticket from project',
            'Select from recent tickets'
        ], {
            placeHolder: 'How would you like to select the JIRA ticket?'
        });

        if (!selection) return null;

        switch (selection) {
            case 'Get ticket from branch':
                return this.getTicketFromBranchAndVerify();
            case 'Select ticket from project':
                return this.selectProjectTicket();
            case 'Select from recent tickets':
                return this.selectTicketManually();
            default:
                return null;
        }
    }

    private async selectProject(): Promise<{ key: string; name: string; } | null> {
        try {
            const projects = await this.jiraService.getProjects();
            const selected = await vscode.window.showQuickPick(
                projects.map(project => ({
                    label: project.key,
                    description: project.name,
                    project
                })),
                {
                    placeHolder: 'Select a JIRA project'
                }
            );
            return selected ? { key: selected.label, name: selected.description || '' } : null;
        } catch (error) {
            vscode.window.showErrorMessage('Failed to fetch JIRA projects');
            return null;
        }
    }

    private async selectProjectTicket(): Promise<string | null> {
        if (!this.currentProject) return null;

        try {
            const issues = await this.jiraService.getAllProjectIssuesUnfiltered(this.currentProject);
            const selected = await vscode.window.showQuickPick(
                issues.map(issue => ({
                    label: issue.key,
                    description: issue.summary
                })),
                {
                    placeHolder: `Select an issue from ${this.currentProject}`
                }
            );
            return selected ? selected.label : null;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to fetch issues for project ${this.currentProject}`);
            return null;
        }
    }

    private async getTicketFromBranchAndVerify(): Promise<string | null> {
        const ticketId = await this.getTicketFromBranch();
        if (!ticketId) {
            return this.selectProjectTicket();
        }

        try {
            const exists = await this.jiraService.verifyTicketExists(ticketId);
            if (exists) {
                return ticketId;
            }
            const retry = await vscode.window.showQuickPick(['Select from project', 'Cancel'], {
                placeHolder: `Ticket ${ticketId} not found in JIRA. Would you like to select from project?`
            });
            if (retry === 'Select from project') {
                return this.selectProjectTicket();
            }
        } catch (error) {
            vscode.window.showErrorMessage('Failed to verify ticket in JIRA');
        }
        return null;
    }

    private async selectTicketManually(): Promise<string | null> {
        try {
            const tickets = await this.jiraService.getRecentTickets();
            const selected = await vscode.window.showQuickPick(
                tickets.map(ticket => ({
                    label: ticket.key,
                    description: ticket.summary
                })),
                {
                    placeHolder: 'Select a JIRA ticket'
                }
            );
            return selected ? selected.label : null;
        } catch (error) {
            vscode.window.showErrorMessage('Failed to fetch JIRA tickets');
            return null;
        }
    }

    private async getTicketFromBranch(): Promise<string | null> {
        const branchName = await getBranchName();
        // Note: GitService now requires JiraService and outputChannel
        // This method is deprecated in favor of BranchChangeService
        return null;
    }

    public isTracking(): boolean {
        return this.isRunning;
    }

    public hasElapsedTime(): boolean {
        return this.elapsedTime > 0 || this.isRunning;
    }

    public getCurrentTrackedTime(): string {
        if (!this.startTime && !this.elapsedTime) {
            return '00:00:00';
        }

        let totalTime = this.elapsedTime;
        if (this.isRunning) {
            totalTime = Date.now() - this.startTime;
        }

        const hours = Math.floor(totalTime / (1000 * 60 * 60));
        const minutes = Math.floor((totalTime % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((totalTime % (1000 * 60)) / 1000);

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    public async getRecentTickets(): Promise<string[]> {
        // Implement this to return recent JIRA tickets
        // This could be stored in extension context or fetched from JIRA
        return [];
    }

    public async logTime(ticket: string, timeSpent: string | number, description?: string): Promise<void> {
        try {
            // Check authentication first
            if (!(await this.jiraService.isAuthenticated())) {
                throw new Error('User not authenticated. Please log in first.');
            }

            let minutes: number;
            
            if (typeof timeSpent === 'number') {
                // Already in minutes
                minutes = timeSpent;
            } else {
                // Convert time format (1h 30m) to minutes
                minutes = this.convertTimeToMinutes(timeSpent);
            }
            
            if (minutes <= 0) {
                throw new Error('Invalid time format. Please provide a positive number of minutes.');
            }

            this.log(`DUAL TIME LOGGING WORKFLOW`, true);
            this.log(`Jira Ticket: ${ticket}`);
            this.log(`Time: ${minutes} minutes`);
            this.log('='.repeat(50));

            // Step 1: Verify Jira ticket exists (following proven pattern)
            this.log('\nStep 1: Verifying Jira ticket...');
            const ticketInfo = await this.verifyJiraTicket(ticket);
            if (!ticketInfo.exists) {
                throw new Error(`Jira ticket ${ticket} not found or inaccessible`);
            }
            this.log(`Jira ticket verified: ${ticket}`);
            
            // Store project information for Productive lookup
            const jiraProjectName = ticketInfo.projectName;
            const jiraProjectKey = ticketInfo.projectKey;

            // Step 2: Log time to JIRA (primary service - following proven pattern)
            this.log('\nStep 2: Logging time to Jira...');
            await this.logTimeToJira(ticket, minutes, description);
            this.log(`Jira time logged: ${minutes} minutes to ${ticket}`);

            // Step 3: Log time to Productive (secondary service - only if Jira succeeded)
            this.log('\nStep 3: Logging time to Productive...');
            this.showProductiveOutput();
            let productiveSuccess = false;
            let productiveError = '';
            
            try {
                await this.logTimeToProductive(ticket, minutes, description, jiraProjectName);
                productiveSuccess = true;
                this.log(`Productive time logged: ${minutes} minutes`);
                // Output channel disabled for time logging
                // this.outputChannel.show(true);
            } catch (error: any) {
                productiveError = error.message;
                this.log(`Productive logging failed: ${error.message}`);
                // Output channel disabled for time logging
                // this.outputChannel.show(true);
            }

            // Step 4: Final result message
            if (productiveSuccess) {
                this.log(`\nSUCCESS: Time logged successfully to both Jira and Productive: ${minutes} minutes`);
            } else {
                this.log(`\nPARTIAL SUCCESS: Time logged to Jira successfully. Productive failed: ${productiveError}`);
            }

        } catch (error: any) {
            this.log(`FAILED: Time logging failed: ${error.message}`);
            throw new Error(`Failed to log time: ${error.message}`);
        }
    }

    /**
     * Verify Jira ticket exists (following proven pattern from test)
     */
    private async verifyJiraTicket(ticketId: string): Promise<{ exists: boolean; projectName?: string; projectKey?: string }> {
        try {
            this.log(`   🔍 Checking if ticket ${ticketId} exists...`);
            
            // Get ticket details including project information
            const credentials = await this.jiraService.getCurrentCredentials();
            const response = await axios.get(
                `${credentials.baseUrl}/rest/api/2/issue/${ticketId}`,
                {
                    auth: {
                        username: credentials.email,
                        password: credentials.apiToken
                    }
                }
            );
            
            if (response.status === 200) {
                const issue = response.data;
                const projectName = issue.fields.project.name?.trim() || '';
                const projectKey = issue.fields.project.key;
                
                this.log(`   ✅ Ticket found: ${ticketId}`);
                this.log(`   📋 Project: ${projectName} (${projectKey})`);
                
                return {
                    exists: true,
                    projectName: projectName,
                    projectKey: projectKey
                };
            }
            
            return { exists: false };
        } catch (error: any) {
            this.log(`   ❌ Ticket verification failed: ${error.message}`);
            
            if (error.message.includes('404')) {
                this.log(`   💡 Suggestion: Check if ticket ${ticketId} exists and you have access to it`);
            } else if (error.message.includes('401')) {
                this.log(`   💡 Suggestion: Check your Jira email and API token`);
            } else if (error.message.includes('403')) {
                this.log(`   💡 Suggestion: You may not have permission to view this ticket`);
            }
            return { exists: false };
        }
    }

    /**
     * Log time to Jira using worklog API (following proven pattern from test)
     */
    private async logTimeToJira(ticketId: string, timeMinutes: number, description?: string): Promise<void> {
        this.log(`   🔍 Logging time to Jira: ${timeMinutes} minutes to ${ticketId}`);
        // JiraService logTime method only takes ticketId and timeMinutes
        // The description is automatically added by the service
        await this.jiraService.logTime(ticketId, timeMinutes);
        this.log(`   ✅ Jira time logged successfully`);
    }

    /**
     * Log time to Productive following the EXACT proven pattern from successful test
     */
    private async logTimeToProductive(jiraTicketId: string, timeMinutes: number, description?: string, jiraProjectName?: string): Promise<void> {
        this.log(`\n📊 PRODUCTIVE INTEGRATION - ENHANCED DEBUGGING`);
        this.log(`═══════════════════════════════════════════════════════════`);
        this.log(`🎯 Ticket: ${jiraTicketId}`);
        this.log(`⏰ Time: ${timeMinutes} minutes`);
        this.log(`📝 Description: ${description || 'Auto-generated'}`);
        this.log(`═══════════════════════════════════════════════════════════`);
        
        try {
            // Step 1: Get Productive credentials from authenticated user
            this.log(`\n📊 Step 1: Getting Productive credentials...`);
            const credentials = await this.getProductiveCredentials();
            if (!credentials) {
                throw new Error('Productive credentials not found. Please sign in again.');
            }
            this.log(`   ✅ Productive API Token: ${credentials.apiToken ? 'Configured' : 'Missing'}`);
            this.log(`   ✅ Organization ID: ${credentials.organizationId}`);
            this.log(`   ✅ Base URL: ${credentials.baseUrl}`);
            
            // Step 2: Get authenticated user via organization membership (PROVEN METHOD)
            this.log(`\n📊 Step 2: Finding authenticated user via organization membership...`);
            const userInfo = await this.getAuthenticatedUserFromMembership(credentials);
            this.log(`   ✅ Authenticated User: ${userInfo.personName} (${userInfo.personId})`);
            this.log(`   ✅ Email: ${userInfo.email}`);
            
            // Step 3: Find project in Productive matching current project selection
            this.log(`\n📊 Step 3: Finding project in Productive...`);
            this.log(`   🔍 Searching for project: "${jiraProjectName || 'Unknown'}"`);
            
            let projectInfo: { id: string; name: string };
            try {
                projectInfo = await this.findProductiveProjectForCurrentWork(credentials, jiraProjectName);
            this.log(`   ✅ Project: ${projectInfo.name} (${projectInfo.id})`);
            } catch (projectError: any) {
                this.log(`   ⚠️ Project not found: ${projectError.message}`);
                this.log(`   🔄 Using fallback: logging time to previously used service...`);
                
                // Get previously used service as fallback
                const fallbackService = await this.getPreviouslyUsedService(credentials, userInfo.personId);
                if (!fallbackService) {
                    throw new Error('No project found and no fallback service available');
                }
                
                // Create a dummy project for fallback (using first available project)
                const fallbackProjectResponse = await require('axios').get(`${credentials.baseUrl}/projects?page[size]=1`, {
                    headers: {
                        'Content-Type': 'application/vnd.api+json',
                        'X-Auth-Token': credentials.apiToken,
                        'X-Organization-Id': credentials.organizationId
                    }
                });
                
                if (fallbackProjectResponse.data.data.length === 0) {
                    throw new Error('No projects available in Productive');
                }
                
                const fallbackProject = fallbackProjectResponse.data.data[0];
                projectInfo = { id: fallbackProject.id, name: fallbackProject.attributes.name };
                this.log(`   ⚠️ Using fallback project: ${projectInfo.name} (${projectInfo.id})`);
                this.log(`   ⚠️ Using fallback service: ${fallbackService.serviceName} (${fallbackService.serviceId})`);
                
                // Skip to time entry creation with fallback service
                const timeDescription = description || `${jiraTicketId}: Time logged via VS Code extension (FALLBACK - Project not found)`;
                this.log(`   📝 Using fallback description: ${timeDescription}`);
                await this.createProductiveTimeEntryExact(
                    credentials,
                    userInfo.personId,
                    projectInfo.id,
                    fallbackService.serviceId,
                    timeMinutes,
                    timeDescription,
                    jiraTicketId
                );
                
                this.log(`   ✅ Productive time logged (FALLBACK): ${timeMinutes} minutes to project ${projectInfo.name} with service ${fallbackService.serviceName}`);
                return;
            }
            
            // Step 4: Find service assigned to user for this project (PROVEN METHOD)
            this.log(`\n📊 Step 4: Finding appropriate service for user and project...`);
            const serviceInfo = await this.findServiceForUserProject(credentials, userInfo.personId, projectInfo.id);
            this.log(`   ✅ Service: ${serviceInfo.serviceName} (${serviceInfo.serviceId})`);
            this.log(`   ✅ Confidence: ${serviceInfo.confidence}`);
            
            // Step 5: Create time entry following EXACT test pattern
            this.log(`\n📊 Step 5: Creating time entry in Productive...`);
            // Use commit message as description if provided, otherwise fallback
            const timeDescription = description || `${jiraTicketId}: Time logged via VS Code extension`;
            this.log(`   📝 Using description: ${timeDescription}`);
            await this.createProductiveTimeEntryExact(
                credentials,
                userInfo.personId,
                projectInfo.id,
                serviceInfo.serviceId,
                timeMinutes,
                timeDescription,
                jiraTicketId
            );
            
            this.log(`   ✅ Productive time logged: ${timeMinutes} minutes to project ${projectInfo.name}`);
            
        } catch (error: any) {
            this.log(`   ❌ Productive integration failed: ${error.message}`);
            
            // Show essential error information only
            if (error.response) {
                this.log(`   📋 API Status: ${error.response.status}`);
                if (error.response.data?.errors) {
                    const errors = error.response.data.errors;
                    if (Array.isArray(errors)) {
                        errors.forEach((err: any, index: number) => {
                            this.log(`   📋 Error ${index + 1}: ${err.title || err.detail || 'Unknown error'}`);
                        });
                    }
                } else if (error.response.data?.message) {
                    this.log(`   📋 Error: ${error.response.data.message}`);
                }
            }
            
            // Show output on error so user can see what went wrong (only if logging is enabled)
            if (this.isLoggingEnabled()) {
                // this.outputChannel.show(true); // Disabled to prevent auto-opening
            }
            throw new Error(`Productive integration failed: ${error.message}`);
        }
    }

    /**
     * Get authenticated user via organization membership (ENHANCED DEBUGGING)
     */
    private async getAuthenticatedUserFromMembership(credentials: { apiToken: string; organizationId: string; baseUrl: string }): Promise<{ personId: string; personName: string; email: string }> {
        const axios = require('axios');
        
        this.log(`   🔍 Finding authenticated user via organization membership...`);
        this.log(`   📋 API URL: ${credentials.baseUrl}/organization_memberships`);
        this.log(`   📋 Headers: X-Auth-Token: ${credentials.apiToken ? 'Present' : 'Missing'}, X-Organization-Id: ${credentials.organizationId}`);
        
        try {
            // This endpoint returns the current user's membership - the membership ID IS the person ID!
            const membershipResponse = await axios.get(`${credentials.baseUrl}/organization_memberships`, {
                headers: {
                    'Content-Type': 'application/vnd.api+json',
                    'X-Auth-Token': credentials.apiToken,
                    'X-Organization-Id': credentials.organizationId
                }
            });
            
            this.log(`   📊 Found ${membershipResponse.data.data.length} organization membership(s)`);
            
            if (membershipResponse.data.data && membershipResponse.data.data.length > 0) {
                const membership = membershipResponse.data.data[0];
                const personId = membership.id; // The membership ID IS the person ID!
                
                this.log(`   🎯 Found person ID from membership ID: ${personId}`);
                
                // Get full person details
                this.log(`   🔍 Fetching person details for ID: ${personId}`);
                const personResponse = await axios.get(`${credentials.baseUrl}/people/${personId}`, {
                    headers: {
                        'Content-Type': 'application/vnd.api+json',
                        'X-Auth-Token': credentials.apiToken,
                        'X-Organization-Id': credentials.organizationId
                    }
                });
                
                const person = personResponse.data.data;
                this.log(`   📋 Person: ${person.attributes.name || `${person.attributes.first_name || ''} ${person.attributes.last_name || ''}`.trim()} (${person.attributes.email})`);
                
                return {
                    personId: person.id,
                    personName: person.attributes.name || `${person.attributes.first_name || ''} ${person.attributes.last_name || ''}`.trim(),
                    email: person.attributes.email
                };
            } else {
                throw new Error('No organization memberships found');
            }
        } catch (error: any) {
            this.log(`   ❌ Failed to get user from membership: ${error.message}`);
            if (error.response) {
                this.log(`   📋 API Error: ${error.response.status} - ${error.response.statusText}`);
                if (error.response.data?.errors) {
                    const errors = error.response.data.errors;
                    if (Array.isArray(errors)) {
                        errors.forEach((err: any, index: number) => {
                            this.log(`   📋 Error ${index + 1}: ${err.title || err.detail || 'Unknown error'}`);
                        });
                    }
                } else if (error.response.data?.message) {
                    this.log(`   📋 Error: ${error.response.data.message}`);
                }
            } else if (error.request) {
                this.log(`   📋 Network Error: Request failed`);
            }
            throw new Error(`Failed to get user from membership: ${error.message}`);
        }
    }

    /**
     * Find Productive project matching the selected project from dropdown using intelligent discovery
     */
    private async findProductiveProjectForCurrentWork(credentials: { apiToken: string; organizationId: string; baseUrl: string }, jiraProjectName?: string): Promise<{ id: string; name: string }> {
        const axios = require('axios');
        
        this.log(`   🔍 Finding project in Productive...`);
        
        try {
            // Use Jira project name if provided, otherwise fallback to current project
            let searchTerm = jiraProjectName || this.currentProject;
            
            if (!searchTerm) {
                throw new Error('No project name available for search');
            }
            
            // Clean the search term - trim whitespace and normalize
            const cleanSearchTerm = searchTerm.trim();
            this.log(`   🔍 Searching for Productive project matching: "${cleanSearchTerm}"`);
            
            // Search with pagination for exact and precise matches
            this.log(`   📊 Searching for project by name: ${cleanSearchTerm}`);
            let foundProject: any = null;
            let bestMatch: any = null;
            let bestMatchScore = 0;
            let page = 1;
            const pageSize = 50;
            
            while (page <= 10) { 
                this.log(`   📊 Searching page ${page}...`);
                
                const searchResponse = await axios.get(`${credentials.baseUrl}/projects?page[size]=${pageSize}&page[number]=${page}`, {
                        headers: {
                            'Content-Type': 'application/vnd.api+json',
                            'X-Auth-Token': credentials.apiToken,
                            'X-Organization-Id': credentials.organizationId
                        }
                    });
                    
                const projects = searchResponse.data.data;
                if (projects.length === 0) {
                    this.log(`   📊 No more projects found on page ${page}`);
                    break;
                }
                
                // PRIORITY 1: Check for exact match (case-insensitive, trimmed)
                const exactMatch = projects.find((p: any) => 
                    p.attributes.name.toLowerCase().trim() === cleanSearchTerm.toLowerCase()
                );
                
                if (exactMatch) {
                    foundProject = exactMatch;
                    this.log(`   ✅ Found exact match: ${foundProject.attributes.name} (${foundProject.id})`);
                    break;
                }
                
                // PRIORITY 2: Check for exact match with common variations
                const variations = [
                    cleanSearchTerm.toLowerCase(),
                    cleanSearchTerm.toLowerCase() + ' project',
                    cleanSearchTerm.toLowerCase() + ' app',
                    cleanSearchTerm.toLowerCase() + ' application',
                    'the ' + cleanSearchTerm.toLowerCase(),
                    cleanSearchTerm.toLowerCase() + ' test',
                    cleanSearchTerm.toLowerCase() + ' development'
                ];
                
                const variationMatch = projects.find((p: any) => {
                const projectName = p.attributes.name.toLowerCase().trim();
                    return variations.some(variation => projectName === variation);
                });
                
                if (variationMatch) {
                    foundProject = variationMatch;
                    this.log(`   ✅ Found variation match: ${foundProject.attributes.name} (${foundProject.id})`);
                    break;
                }
                
                // PRIORITY 3: Check for starts with (more precise than partial)
                const startsWithMatch = projects.find((p: any) => {
                    const projectName = p.attributes.name.toLowerCase().trim();
                    const jiraProject = cleanSearchTerm.toLowerCase();
                    return projectName.startsWith(jiraProject + ' ') || 
                           projectName.startsWith(jiraProject + '-') ||
                           projectName.startsWith(jiraProject + '_');
                });
                
                if (startsWithMatch) {
                    foundProject = startsWithMatch;
                    this.log(`   ✅ Found starts-with match: ${foundProject.attributes.name} (${foundProject.id})`);
                    break;
                }
                
                // PRIORITY 4: Enhanced similarity scoring for all projects
                projects.forEach((p: any) => {
                    const projectName = p.attributes.name.toLowerCase().trim();
                    const searchTermLower = cleanSearchTerm.toLowerCase();
                    
                    // Calculate similarity score
                    let score = 0;
                    
                    // Exact substring match (highest priority)
                    if (projectName.includes(searchTermLower)) {
                        score += 50;
                        
                        // Bonus for exact word match
                        const words = projectName.split(/\s+/);
                        const searchWords = searchTermLower.split(/\s+/);
                        const matchingWords = searchWords.filter(word => 
                            words.some((projectWord: string) => projectWord.includes(word))
                        );
                        score += matchingWords.length * 20;
                        
                        // Bonus for length similarity
                        const lengthDiff = Math.abs(projectName.length - searchTermLower.length);
                        if (lengthDiff <= 5) score += 10;
                        else if (lengthDiff <= 10) score += 5;
                    }
                    
                    // Enhanced word-based matching (NEW)
                    const projectWords = projectName.split(/\s+/);
                    const searchWords = searchTermLower.split(/\s+/);
                    
                    // Check for partial word matches (e.g., "chest" in "chest group ltd")
                    const partialMatches = searchWords.filter((searchWord: string) => 
                        projectWords.some((projectWord: string) => 
                            projectWord.includes(searchWord) || searchWord.includes(projectWord)
                        )
                    );
                    
                    if (partialMatches.length > 0) {
                        score += partialMatches.length * 25; // Increased from 15 to 25
                        
                        // Bonus for consecutive word matches
                        let consecutiveBonus = 0;
                        for (let i = 0; i < searchWords.length - 1; i++) {
                            const currentWord = searchWords[i];
                            const nextWord = searchWords[i + 1];
                            const currentIndex = projectWords.findIndex((pw: string) => 
                                pw.includes(currentWord) || currentWord.includes(pw)
                            );
                            const nextIndex = projectWords.findIndex((pw: string) => 
                                pw.includes(nextWord) || nextWord.includes(pw)
                            );
                            
                            if (currentIndex !== -1 && nextIndex !== -1 && 
                                Math.abs(nextIndex - currentIndex) <= 2) {
                                consecutiveBonus += 10;
                            }
                        }
                        score += consecutiveBonus;
                    }
                    
                    // Check for acronyms or abbreviations
                    const searchAcronym = searchWords.map((word: string) => word[0]).join('').toLowerCase();
                    const projectAcronym = projectWords.map((word: string) => word[0]).join('').toLowerCase();
                    if (searchAcronym === projectAcronym && searchAcronym.length >= 2) {
                        score += 30;
                    }
                    
                    // Check for common prefixes/suffixes
                    const commonPrefixes = ['the', 'new', 'old', 'big', 'small'];
                    const commonSuffixes = ['ltd', 'inc', 'corp', 'company', 'group'];
                    
                    if (commonPrefixes.some(prefix => 
                        projectName.startsWith(prefix + ' ') && searchTermLower.startsWith(prefix + ' ')
                    )) {
                        score += 15;
                    }
                    
                    if (commonSuffixes.some(suffix => 
                        projectName.endsWith(' ' + suffix) && searchTermLower.endsWith(' ' + suffix)
                    )) {
                        score += 15;
                    }
                    
                    // Update best match if this score is higher
                    if (score > bestMatchScore) {
                        bestMatchScore = score;
                        bestMatch = p;
                    }
                });
                
                page++;
            }
            
            // If we found an exact match, use it
            if (foundProject) {
                return { id: foundProject.id, name: foundProject.attributes.name };
            }
            
            // If we have a good similarity match, use it (lowered threshold)
            if (bestMatch && bestMatchScore >= 20) { // Lowered from 30 to 20
                this.log(`   ✅ Found best match (score: ${bestMatchScore}): ${bestMatch.attributes.name} (${bestMatch.id})`);
                return { id: bestMatch.id, name: bestMatch.attributes.name };
            }
            
            // If no match found, try to find any project with partial word match
            this.log(`   ⚠️ No good match found, looking for any partial match...`);
            
            // Search through all pages again for any partial match
            page = 1;
            let fallbackProject: any = null;
            let fallbackScore = 0;
            
            while (page <= 10) {
                const fallbackResponse = await axios.get(`${credentials.baseUrl}/projects?page[size]=${pageSize}&page[number]=${page}`, {
                    headers: {
                        'Content-Type': 'application/vnd.api+json',
                        'X-Auth-Token': credentials.apiToken,
                        'X-Organization-Id': credentials.organizationId
                    }
                });
                
                const fallbackProjects = fallbackResponse.data.data;
                if (fallbackProjects.length === 0) break;
                
                fallbackProjects.forEach((p: any) => {
                    const projectName = p.attributes.name.toLowerCase().trim();
                    const searchWords = cleanSearchTerm.toLowerCase().split(/\s+/);
                    
                    // Simple partial word matching for fallback
                    const partialMatches = searchWords.filter((word: string) => 
                        projectName.includes(word)
                    );
                    
                    const score = partialMatches.length * 10;
                    if (score > fallbackScore) {
                        fallbackScore = score;
                        fallbackProject = p;
                    }
                });
                
                page++;
            }
            
            // If we found any fallback project, use it
            if (fallbackProject && fallbackScore > 0) {
                this.log(`   ⚠️ Using fallback project (score: ${fallbackScore}): ${fallbackProject.attributes.name} (${fallbackProject.id})`);
                return { id: fallbackProject.id, name: fallbackProject.attributes.name };
            }
            
            // If still no match found, throw error
            throw new Error(`No matching project found for "${cleanSearchTerm}" in Productive`);
            
        } catch (error: any) {
            this.log(`   ❌ Error finding project: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get previously used service as fallback when no project is found
     */
    private async getPreviouslyUsedService(credentials: { apiToken: string; organizationId: string; baseUrl: string }, personId: string): Promise<{ serviceId: string; serviceName: string } | null> {
        try {
            this.log(`   🔍 Looking for previously used service as fallback...`);
            
            // Get recent time entries for the user to find the most recently used service
            const timeEntriesResponse = await require('axios').get(`${credentials.baseUrl}/time_entries?filter[person_id]=${personId}&page[size]=50&sort=-date`, {
                headers: {
                    'Content-Type': 'application/vnd.api+json',
                    'X-Auth-Token': credentials.apiToken,
                    'X-Organization-Id': credentials.organizationId
                }
            });
            
            const timeEntries = timeEntriesResponse.data.data;
            if (timeEntries.length === 0) {
                this.log(`   ⚠️ No time entries found for user`);
                return null;
            }
            
            // Find the most recent time entry with a service
            for (const entry of timeEntries) {
                if (entry.attributes.service_id) {
                    const serviceId = entry.attributes.service_id;
                    
                    // Get service details
                    const serviceResponse = await require('axios').get(`${credentials.baseUrl}/services/${serviceId}`, {
                        headers: {
                            'Content-Type': 'application/vnd.api+json',
                            'X-Auth-Token': credentials.apiToken,
                            'X-Organization-Id': credentials.organizationId
                        }
                    });
                    
                    const service = serviceResponse.data.data;
                    this.log(`   ✅ Found previously used service: ${service.attributes.name} (${service.id})`);
                    return { serviceId: service.id, serviceName: service.attributes.name };
                }
            }
            
            this.log(`   ⚠️ No service found in recent time entries`);
            return null;
            
        } catch (error: any) {
            this.log(`   ❌ Error getting previously used service: ${error.message}`);
            return null;
        }
    }

    /**
     * Get Productive credentials from authenticated user (ENHANCED DEBUGGING)
     */
    private async getProductiveCredentials(): Promise<{ apiToken: string; organizationId: string; baseUrl: string } | null> {
        try {
            this.log('   🔍 Starting Productive credentials discovery...');
            
            // First try: Get from AuthenticationService (for UI-based authentication) - PRIORITY
            this.log('   🔍 Checking AuthenticationService for current user...');
            const jiraService = this.jiraService as any;
            if (jiraService.authService) {
            const authService = jiraService.authService;
            const currentUser = await authService.getCurrentUser();
                if (currentUser) {
            this.log(`   📋 Current User: ${currentUser.email}`);
            const userCreds = await authService.getUserCredentials(currentUser.email);
                    if (userCreds?.productiveApiToken) {
                        this.log('   ✅ Using Productive credentials from authenticated user');
                        this.log(`   📋 User: ${currentUser.email}`);
                        this.log(`   📋 Productive API Token: ${userCreds.productiveApiToken ? 'Found' : 'Missing'}`);
                        
                        // Get Jira credentials from authenticated user
                        const jiraBaseUrl = userCreds.baseUrl;
                        const jiraEmail = userCreds.email;
                        const jiraApiToken = userCreds.apiToken;
                        
                        this.log(`   📋 Jira Base URL: ${jiraBaseUrl}`);
                        this.log(`   📋 Jira Email: ${jiraEmail}`);
                        this.log(`   📋 Jira API Token: ${jiraApiToken ? 'Found' : 'Missing'}`);
                        
                        // Keep organizationId and baseUrl from .env as intended
            return {
                apiToken: userCreds.productiveApiToken,
                organizationId: process.env.PRODUCTIVE_ORGANIZATION_ID || '42335',
                baseUrl: process.env.PRODUCTIVE_BASE_URL || 'https://api.productive.io/api/v2'
            };
                    } else {
                        this.log('⚠️ No Productive API token found in user credentials');
                        this.log(`   📋 Available credentials: ${JSON.stringify(Object.keys(userCreds || {}), null, 2)}`);
                    }
                } else {
                    this.log('⚠️ No current user found in AuthenticationService');
                }
            } else {
                this.log('⚠️ No auth service available for Productive integration');
            }
            
            this.log('❌ No authenticated user found with Productive credentials');
            return null;
        } catch (error) {
            this.log(`⚠️ Error getting Productive credentials: ${error}`);
            this.log(`   🔍 Full error details: ${JSON.stringify(error, null, 2)}`);
            return null;
        }
    }

    private async discoverProductiveUser(credentials: { apiToken: string; organizationId: string; baseUrl: string }): Promise<{ personId: string; personName: string; personEmail: string }> {
        const axios = require('axios');
        
        try {
            // Use organization_memberships to get person ID (the membership ID IS the person ID)
            this.log('   🔍 Getting person ID from organization memberships...');
            const membershipResponse = await axios.get(`${credentials.baseUrl}/organization_memberships`, {
                headers: {
                    'Content-Type': 'application/vnd.api+json',
                    'X-Auth-Token': credentials.apiToken,
                    'X-Organization-Id': credentials.organizationId
                }
            });
            
            if (membershipResponse.data && membershipResponse.data.data && membershipResponse.data.data.length > 0) {
                const membership = membershipResponse.data.data[0];
                const personId = membership.id; // The membership ID IS the person ID!
                
                // Get full person details
                const personResponse = await axios.get(`${credentials.baseUrl}/people/${personId}`, {
                    headers: {
                        'Content-Type': 'application/vnd.api+json',
                        'X-Auth-Token': credentials.apiToken,
                        'X-Organization-Id': credentials.organizationId
                    }
                });
                
                const person = personResponse.data.data;
                
                return {
                    personId: person.id,
                    personName: person.attributes.name || `${person.attributes.first_name || ''} ${person.attributes.last_name || ''}`.trim(),
                    personEmail: person.attributes.email
                };
            }
            
            throw new Error('No organization membership found');
        } catch (error: any) {
            throw new Error(`Failed to discover user: ${error.message}`);
        }
    }

    private async findProductiveProject(credentials: { apiToken: string; organizationId: string; baseUrl: string }, jiraTicketId: string): Promise<{ id: string; name: string }> {
        const axios = require('axios');
        
        try {
            this.log('   🔍 Finding suitable project...');
            const projectsResponse = await axios.get(`${credentials.baseUrl}/projects`, {
                headers: {
                    'Content-Type': 'application/vnd.api+json',
                    'X-Auth-Token': credentials.apiToken,
                    'X-Organization-Id': credentials.organizationId
                }
            });
            
            const projects = projectsResponse.data.data;
            
            // Look for a default or suitable project (you could enhance this logic)
            if (projects.length > 0) {
                const project = projects[0]; // Use first available project for now
                return {
                    id: project.id,
                    name: project.attributes.name
                };
            }
            
            throw new Error('No projects found in Productive');
        } catch (error: any) {
            throw new Error(`Failed to find project: ${error.message}`);
        }
    }

    private async discoverBestService(credentials: { apiToken: string; organizationId: string; baseUrl: string }, personId: string, projectId: string): Promise<{ serviceId: string; serviceName: string }> {
        const axios = require('axios');
        
        this.log(`   🛠️ Finding service for user and project...`);
        
        try {
            // Step 1: Check for configured default service (fastest)
            const config = vscode.workspace.getConfiguration('jiraTimeTracker');
            const defaultServiceId = config.get<string>('productive.defaultServiceId');
            
            if (defaultServiceId) {
                this.log(`   🔍 Using configured default service: ${defaultServiceId}`);
                return {
                    serviceId: defaultServiceId,
                    serviceName: 'Default Service'
                };
            }
            
            // Step 2: Get user's recent services (faster than full discovery)
            this.log(`   📊 Getting user's recent services...`);
            const recentServicesResponse = await axios.get(
                `${credentials.baseUrl}/time_entries?filter[person_id]=${personId}&page[size]=10&include=service`,
                {
                headers: {
                    'Content-Type': 'application/vnd.api+json',
                    'X-Auth-Token': credentials.apiToken,
                    'X-Organization-Id': credentials.organizationId
                }
                }
            );
            
            const recentEntries = recentServicesResponse.data.data || [];
            
            if (recentEntries.length > 0) {
                // Use the most recent service
                const mostRecentEntry = recentEntries[0];
                const serviceId = mostRecentEntry.relationships?.service?.data?.id;
                
                if (serviceId) {
                    let serviceName = 'Recent Service';
                    // Note: Service name not available in response, using ID
                    serviceName = `Service ${serviceId}`;
                    
                    this.log(`   ✅ Using most recent service: ${serviceName}`);
                    return { serviceId, serviceName };
                }
            }
            
            // Step 3: Fallback to first available service
            this.log(`   📊 Getting available services...`);
            const servicesResponse = await axios.get(`${credentials.baseUrl}/services?page[size]=10`, {
                headers: {
                    'Content-Type': 'application/vnd.api+json',
                    'X-Auth-Token': credentials.apiToken,
                    'X-Organization-Id': credentials.organizationId
                }
            });
            
            const services = servicesResponse.data.data;
            if (services.length > 0) {
                const fallbackService = services[0];
                this.log(`   ⚠️ Using fallback service: ${fallbackService.attributes.name}`);
                return {
                    serviceId: fallbackService.id,
                    serviceName: fallbackService.attributes.name
                };
            }
            
            throw new Error('No services found');
            
        } catch (error: any) {
            this.log(`   ❌ Error finding service: ${error.message}`);
            throw error;
        }
    }

    /**
     * Find service for user and project (EXACT test method)
     */
    private async findServiceForUserProject(
        credentials: { apiToken: string; organizationId: string; baseUrl: string },
        personId: string,
        projectId: string
    ): Promise<{ serviceId: string; serviceName: string; confidence: string }> {
        const axios = require('axios');
        
        this.log(`   🔍 Finding appropriate service for user and project...`);
        
        try {
            
            // Step 1: Check if user has logged time to this project before (existing user method)
            this.log(`   📊 Checking if user has logged time to this project before...`);
            let timeEntriesResponse = await axios.get(
                `${credentials.baseUrl}/time_entries?filter[person_id]=${personId}&filter[project_id]=${projectId}&page[size]=50&include=service`,
                {
                        headers: {
                            'Content-Type': 'application/vnd.api+json',
                            'X-Auth-Token': credentials.apiToken,
                            'X-Organization-Id': credentials.organizationId
                        }
                }
            );
                    
            let timeEntries = timeEntriesResponse.data.data || [];
            this.log(`   📊 API Response structure: ${JSON.stringify(Object.keys(timeEntriesResponse))}`);
            this.log(`   📊 Data type: ${typeof timeEntriesResponse.data}`);
            this.log(`   📊 Data keys: ${timeEntriesResponse.data ? Object.keys(timeEntriesResponse.data) : 'undefined'}`);
            this.log(`   📊 Found ${timeEntries.length} previous time entries by this user`);
            
            // Debug: Log the actual structure
            if (timeEntries.length > 0) {
                this.log(`   🔍 Sample entry structure:`);
                this.log(`   📋 Entry ID: ${timeEntries[0].id}`);
                this.log(`   📋 Date: ${timeEntries[0].attributes.date}`);
                this.log(`   📋 Time: ${timeEntries[0].attributes.time}`);
                this.log(`   📋 Note: ${timeEntries[0].attributes.note}`);
                this.log(`   📋 Service ID: ${timeEntries[0].relationships?.service?.data?.id}`);
                this.log(`   📋 Available relationships: ${Object.keys(timeEntries[0].relationships || {}).join(', ')}`);
            }
            
            // Approach 2: If no entries found, try without project filter (user's recent entries)
            if (timeEntries.length === 0) {
                try {
                    this.log(`   📊 Trying approach 2: User's recent entries without project filter...`);
                    const userEntriesResponse = await axios.get(
                        `${credentials.baseUrl}/time_entries?filter[person_id]=${personId}&page[size]=100&include=service`,
                {
                    headers: {
                        'Content-Type': 'application/vnd.api+json',
                        'X-Auth-Token': credentials.apiToken,
                        'X-Organization-Id': credentials.organizationId
                    }
                }
            );
                    const userEntries = userEntriesResponse.data.data || [];
                    this.log(`   📊 Approach 2: Found ${userEntries.length} user entries total`);
                    
                    // Note: Cannot filter by project since project relationship is not included
                    // Just use all user entries for service analysis
                    if (userEntries.length > 0) {
                        timeEntries = userEntries;
                        timeEntriesResponse = userEntriesResponse;
                        this.log(`   📊 Approach 2: Using all user entries for service analysis`);
                    }
                } catch (error: any) {
                    this.log(`   ⚠️ Approach 2 failed: ${error.message}`);
                }
            }
            
            if (timeEntries.length > 0) {
                // User has logged time before - use historical analysis (PROVEN HIGH CONFIDENCE METHOD)
                this.log(`   ✅ User has previous time entries. Using historical analysis...`);
                
                // Extract service IDs from the entries
                const serviceIds = new Set(
                    timeEntries.map((entry: any) => {
                        const serviceId = entry.relationships?.service?.data?.id;
                        if (serviceId) {
                            this.log(`   📋 Found service ID: ${serviceId} in entry ${entry.id}`);
                        }
                        return serviceId;
                    }).filter(Boolean)
                );
                
                this.log(`   📊 Unique service IDs found: ${Array.from(serviceIds).join(', ')}`);
                
                if (serviceIds.size > 0) {
                    // STEP 2: Test each service from history with real-time logging
                    this.log(`   🧪 Step 2: Testing services from your history with real-time logging...`);
                    
                    const servicesToTest = Array.from(serviceIds).map((serviceId: unknown) => ({
                        id: serviceId as string,
                        name: `Service ${serviceId as string}`,
                        source: 'history'
                    }));
                    
                    // Test each service from history
                    for (const service of servicesToTest) {
                        this.log(`   🧪 Testing service from history: ${service.name} (${service.id})`);
                        
                        try {
                            // Try to create a real time entry (1 minute test)
                            const testTimeEntry = {
                                data: {
                                    type: 'time_entries',
                                    attributes: {
                                        date: new Date().toISOString().split('T')[0],
                                        time: 1, // 1 minute test
                                        note: 'Service permission test from history',
                                        track_method_id: 1,
                                        overhead: false
                                    },
                                    relationships: {
                                        person: { data: { type: 'people', id: personId } },
                                        project: { data: { type: 'projects', id: projectId } },
                                        service: { data: { type: 'services', id: service.id } },
                                        organization: { data: { type: 'organizations', id: credentials.organizationId } }
                                    }
                                }
                            };
                            
                            const response = await axios.post(`${credentials.baseUrl}/time_entries`, testTimeEntry, {
                                headers: {
                                    'Content-Type': 'application/vnd.api+json',
                                    'X-Auth-Token': credentials.apiToken,
                                    'X-Organization-Id': credentials.organizationId
                                }
                            });
                            
                            if (response.status === 201) {
                                this.log(`   ✅ Service ${service.name} from history works! Permission verified.`);
                                
                                // Delete the test entry immediately
                                await axios.delete(`${credentials.baseUrl}/time_entries/${response.data.data.id}`, {
                                    headers: {
                                        'X-Auth-Token': credentials.apiToken,
                                        'X-Organization-Id': credentials.organizationId
                                    }
                                });
                                
                                return {
                                    serviceId: service.id,
                                    serviceName: service.name,
                                    confidence: 'HIGH (history + permission verified)'
                                };
                            }
                            
                        } catch (error: any) {
                            if (error.response?.status === 422) {
                                this.log(`   ❌ Service ${service.name} from history failed: ${error.response.data?.errors?.[0]?.title || 'Unknown error'}`);
                            } else {
                                this.log(`   ⚠️ Service ${service.name} from history error: ${error.message}`);
                            }
                            // Continue to next service from history
                        }
                    }
                    
                    this.log(`   ⚠️ All services from history failed. Moving to Step 3...`);
                }
            }
            
            // STEP 3: Fallback to testing all project services
            this.log(`   📊 Step 3: Testing all available services for this project...`);
            return await this.testAllProjectServices(credentials, personId, projectId);
            

            
        } catch (error: any) {
            throw new Error(`Service discovery failed: ${error.message}`);
        }
    }

    /**
     * Create Productive time entry following EXACT test pattern (ENHANCED DEBUGGING)
     */
    private async createProductiveTimeEntryExact(
        credentials: { apiToken: string; organizationId: string; baseUrl: string },
        personId: string,
        projectId: string,
        serviceId: string,
        timeMinutes: number,
        description: string,
        jiraTicketId: string
    ): Promise<void> {
        const axios = require('axios');
        
        try {
            // Use local timezone instead of UTC
            const now = new Date();
            const entryDate = now.getFullYear() + '-' + 
                            String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                            String(now.getDate()).padStart(2, '0'); // YYYY-MM-DD in local timezone
            this.log(`   💾 Creating time entry: ${timeMinutes} minutes on ${entryDate}...`);
            this.log(`   📋 API URL: ${credentials.baseUrl}/time_entries`);
            this.log(`   📋 Headers: X-Auth-Token: ${credentials.apiToken ? 'Present' : 'Missing'}, X-Organization-Id: ${credentials.organizationId}`);
            
            // Get Jira base URL for linking
            const jiraBaseUrl = await this.getJiraBaseUrl();
            this.log(`   📋 Jira Base URL for linking: ${jiraBaseUrl}`);
            
            // EXACT time entry structure from successful test
            const timeEntryData = {
                data: {
                    type: 'time_entries',
                    attributes: {
                        date: entryDate,
                        time: timeMinutes,
                        note: description,
                        track_method_id: 1, // Manual entry
                        overhead: false,
                        // Link to Jira (following successful test pattern)
                        jira_issue_id: jiraTicketId,
                        jira_organization: jiraBaseUrl
                    },
                    relationships: {
                        person: {
                            data: { type: 'people', id: personId }
                        },
                        project: {
                            data: { type: 'projects', id: projectId }
                        },
                        service: {
                            data: { type: 'services', id: serviceId }
                        },
                        organization: {
                            data: { type: 'organizations', id: credentials.organizationId }
                        }
                    }
                }
            };
            
            this.log(`   📤 Creating time entry with ${timeMinutes} minutes...`);
            
            const response = await axios.post(`${credentials.baseUrl}/time_entries`, timeEntryData, {
                headers: {
                    'Content-Type': 'application/vnd.api+json',
                    'X-Auth-Token': credentials.apiToken,
                    'X-Organization-Id': credentials.organizationId
                }
            });
            
            this.log(`   📋 Response Status: ${response.status}`);
            
            if (response.status === 201) {
                const entryId = response.data.data.id;
                const entryTime = response.data.data.attributes.time;
                const entryDate = response.data.data.attributes.date;
                
                this.log(`   ✅ Time entry created successfully!`);
                this.log(`   📋 Entry ID: ${entryId}`);
                this.log(`   📅 Date: ${entryDate}`);
                this.log(`   ⏰ Time: ${entryTime} minutes`);
                this.log(`   🔗 Linked to Jira: ${jiraTicketId}`);
            } else {
                throw new Error(`Unexpected response status: ${response.status}`);
            }
        } catch (error: any) {
            this.log(`   ❌ Failed to create time entry: ${error.message}`);
            if (error.response) {
                this.log(`   📋 API Error: ${error.response.status} - ${error.response.statusText}`);
                if (error.response.data?.errors) {
                    const errors = error.response.data.errors;
                    if (Array.isArray(errors)) {
                        errors.forEach((err: any, index: number) => {
                            this.log(`   📋 Error ${index + 1}: ${err.title || err.detail || 'Unknown error'}`);
                        });
                    }
                } else if (error.response.data?.message) {
                    this.log(`   📋 Error: ${error.response.data.message}`);
                }
                throw new Error(`Productive API error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`);
            } else if (error.request) {
                this.log(`   📋 Network Error: Request failed`);
                throw new Error(`Request failed: ${error.message}`);
            } else {
                throw new Error(`Failed to create time entry: ${error.message}`);
            }
        }
    }

    /**
     * Get Jira base URL for linking in Productive
     */
    private async getJiraBaseUrl(): Promise<string> {
        try {
            const jiraService = this.jiraService as any;
            const authService = jiraService.authService;
            if (!authService) return '';
            
            const currentUser = await authService.getCurrentUser();
            if (!currentUser) return '';
            
            return currentUser.baseUrl || '';
        } catch (error) {
            return '';
        }
    }

    private convertTimeToMinutes(timeSpent: string): number {
        // Remove any whitespace and convert to lowercase
        timeSpent = timeSpent.trim().toLowerCase();
        
        // Handle decimal hours (e.g., "1.5h" or "1.5")
        if (timeSpent.endsWith('h') || /^\d+\.\d+$/.test(timeSpent)) {
            const hours = parseFloat(timeSpent.replace('h', ''));
            if (isNaN(hours)) {
                throw new Error('Invalid time format. Please use format like "1h 30m" or "1.5h"');
            }
            return Math.round(hours * 60);
        }

        // Handle hours and minutes format (e.g., "1h 30m" or "1h30m")
        const hoursMatch = timeSpent.match(/(\d+)\s*h/);
        const minutesMatch = timeSpent.match(/(\d+)\s*m/);
        
        let totalMinutes = 0;
        
        if (hoursMatch) {
            const hours = parseInt(hoursMatch[1]);
            if (isNaN(hours)) {
                throw new Error('Invalid hours format. Please use format like "1h 30m"');
            }
            totalMinutes += hours * 60;
        }
        
        if (minutesMatch) {
            const minutes = parseInt(minutesMatch[1]);
            if (isNaN(minutes)) {
                throw new Error('Invalid minutes format. Please use format like "1h 30m"');
            }
            totalMinutes += minutes;
        }

        // If no valid format was found
        if (totalMinutes === 0) {
            throw new Error('Invalid time format. Please use format like "1h 30m", "1.5h", or "90m"');
        }

        return totalMinutes;
    }

    public async setCurrentIssue(issueKey: string) {
        this.currentIssue = issueKey;
    }

    public setCurrentProject(projectKey: string) {
        this.currentProject = projectKey;
        this.log(`📋 Current project set to: ${projectKey}`);
    }

    public isTimerRunning(): boolean {
        return this.isRunning;
    }

    public getCurrentTime(): string {
        return this.getCurrentTrackedTime();
    }

    public getElapsedMinutes(): number {
        let totalTime = this.elapsedTime;
        if (this.isRunning) {
            totalTime = Date.now() - this.startTime;
        }
        return Math.round(totalTime / 1000 / 60);
    }

    public async getBranchTicketInfo(): Promise<{ projectKey: string; issueKey: string } | null> {
        try {
            // Note: This method is deprecated in favor of BranchChangeService
            // GitService now requires JiraService and outputChannel
            this.log(`Branch ticket info method deprecated - use BranchChangeService instead`);
                return null;
        } catch (error) {
            console.error('Error getting branch ticket info:', error);
            return null;
        }
    }

    /**
     * Test Productive connectivity and show available resources (for debugging)
     */
    public async testProductiveConnection(): Promise<void> {
        this.log(`\n🔍 PRODUCTIVE CONNECTION TEST`, true);
        this.log(`═══════════════════════════════════════════════════════════`);
        
        try {
            // Step 1: Test credentials
            this.log(`\n📊 Step 1: Testing Productive credentials...`);
            const credentials = await this.getProductiveCredentials();
            if (!credentials) {
                throw new Error('Productive credentials not found');
            }
            this.log(`   ✅ Credentials found`);
            
            // Step 2: Test user authentication
            this.log(`\n📊 Step 2: Testing user authentication...`);
            const userInfo = await this.getAuthenticatedUserFromMembership(credentials);
            this.log(`   ✅ User authenticated: ${userInfo.personName} (${userInfo.personId})`);
            
            // Step 3: Test projects access
            this.log(`\n📊 Step 3: Testing projects access...`);
            const axios = require('axios');
            const projectsResponse = await axios.get(`${credentials.baseUrl}/projects?filter[archived]=false`, {
                headers: {
                    'Content-Type': 'application/vnd.api+json',
                    'X-Auth-Token': credentials.apiToken,
                    'X-Organization-Id': credentials.organizationId
                }
            });
            
            const projects = projectsResponse.data.data;
            this.log(`   ✅ Found ${projects.length} active projects`);
            this.log(`   📋 Available projects:`);
            projects.slice(0, 10).forEach((project: any, index: number) => {
                this.log(`      ${index + 1}. ${project.attributes.name} (${project.id})`);
            });
            if (projects.length > 10) {
                this.log(`      ... and ${projects.length - 10} more projects`);
            }
            
            // Step 4: Test services access
            this.log(`\n📊 Step 4: Testing services access...`);
            const servicesResponse = await axios.get(`${credentials.baseUrl}/services`, {
                headers: {
                    'Content-Type': 'application/vnd.api+json',
                    'X-Auth-Token': credentials.apiToken,
                    'X-Organization-Id': credentials.organizationId
                }
            });
            
            const services = servicesResponse.data.data;
            this.log(`   ✅ Found ${services.length} services`);
            this.log(`   📋 Available services:`);
            services.slice(0, 10).forEach((service: any, index: number) => {
                this.log(`      ${index + 1}. ${service.attributes.name} (${service.id})`);
            });
            if (services.length > 10) {
                this.log(`      ... and ${services.length - 10} more services`);
            }
            
            // Step 5: Test user's assigned services
            this.log(`\n📊 Step 5: Testing user's assigned services...`);
            const userServicesResponse = await axios.get(`${credentials.baseUrl}/time_entries?filter[person_id]=${userInfo.personId}&page[size]=10&include=service`, {
                headers: {
                    'Content-Type': 'application/vnd.api+json',
                    'X-Auth-Token': credentials.apiToken,
                    'X-Organization-Id': credentials.organizationId
                }
            });
            
            const userTimeEntries = userServicesResponse.data.data || [];
            const userServiceIds = new Set(
                userTimeEntries.map((entry: any) => entry.relationships?.service?.data?.id).filter(Boolean)
            );
            
            this.log(`   ✅ User has logged time with ${userServiceIds.size} different services`);
            if (userServiceIds.size > 0) {
                this.log(`   📋 User's services from time entries:`);
                Array.from(userServiceIds).forEach((serviceId: unknown, index: number) => {
                    const serviceIdStr = serviceId as string;
                                    // Note: Service name not available in response, using ID
                const serviceName = `Service ${serviceIdStr}`;
                    this.log(`      ${index + 1}. ${serviceName} (${serviceIdStr})`);
                });
            }
            
            this.log(`\n✅ PRODUCTIVE CONNECTION TEST PASSED`);
            this.log(`   🎯 Ready to log time to Productive`);
            
        } catch (error: any) {
            this.log(`\n❌ PRODUCTIVE CONNECTION TEST FAILED`);
            this.log(`   🔍 Error: ${error.message}`);
            if (error.response) {
                this.log(`   📋 API Error: ${error.response.status} - ${error.response.statusText}`);
                if (error.response.data?.errors) {
                    const errors = error.response.data.errors;
                    if (Array.isArray(errors)) {
                        errors.forEach((err: any, index: number) => {
                            this.log(`   📋 Error ${index + 1}: ${err.title || err.detail || 'Unknown error'}`);
                        });
                    }
                } else if (error.response.data?.message) {
                    this.log(`   📋 Error: ${error.response.data.message}`);
                }
            }
            
            // Show output on error (only if logging is enabled)
            if (this.isLoggingEnabled()) {
                // this.outputChannel.show(true); // Disabled to prevent auto-opening
            }
        }
    }

    /**
     * Show current VS Code settings for debugging
     */
    public showCurrentSettings(): void {
        this.log(`\n🔍 CURRENT VS CODE SETTINGS`, true);
        this.log(`═══════════════════════════════════════════════════════════`);
        
        const config = vscode.workspace.getConfiguration('jiraTimeTracker');
        
        // Jira settings
        this.log(`\n📊 JIRA SETTINGS:`);
        this.log(`   Base URL: ${config.get<string>('baseUrl') || 'Not configured'}`);
        this.log(`   Email: ${config.get<string>('email') || 'Not configured'}`);
        this.log(`   API Token: ${config.get<string>('apiToken') ? 'Configured' : 'Not configured'}`);
        
        // Productive settings
        this.log(`\n📊 PRODUCTIVE SETTINGS:`);
        this.log(`   Organization ID: ${config.get<string>('productive.organizationId') || 'Not configured'}`);
        this.log(`   API Token: ${config.get<string>('productive.apiToken') ? 'Configured' : 'Not configured'}`);
        this.log(`   Base URL: ${config.get<string>('productive.baseUrl') || 'https://api.productive.io/api/v2'}`);
        this.log(`   Person ID: ${config.get<string>('productive.personId') || 'Not configured'}`);
        this.log(`   Default Project ID: ${config.get<string>('productive.defaultProjectId') || 'Not configured'}`);
        this.log(`   Default Service ID: ${config.get<string>('productive.defaultServiceId') || 'Not configured'}`);
        
        const projectMapping = config.get<Record<string, string>>('productive.projectMapping') || {};
        this.log(`   Project Mapping: ${Object.keys(projectMapping).length > 0 ? JSON.stringify(projectMapping, null, 2) : 'Not configured'}`);
        
        // Environment variables
        this.log(`\n📊 ENVIRONMENT VARIABLES:`);
        this.log(`   PRODUCTIVE_ORGANIZATION_ID: ${process.env.PRODUCTIVE_ORGANIZATION_ID || 'Not set'}`);
        this.log(`   PRODUCTIVE_API_TOKEN: ${process.env.PRODUCTIVE_API_TOKEN ? 'Set' : 'Not set'}`);
        this.log(`   PRODUCTIVE_BASE_URL: ${process.env.PRODUCTIVE_BASE_URL || 'Not set'}`);
        this.log(`   PRODUCTIVE_PERSON_ID: ${process.env.PRODUCTIVE_PERSON_ID || 'Not set'}`);
        
        // Show output channel (only if logging is enabled)
        if (this.isLoggingEnabled()) {
            // this.outputChannel.show(true); // Disabled to prevent auto-opening
        }
    }

    /**
     * Get project services
     */
    private async getProjectServices(
        credentials: { apiToken: string; organizationId: string; baseUrl: string },
        projectId: string
    ): Promise<Array<{ id: string; attributes: { name: string; deleted_at: string | null; time_tracking_enabled: boolean } }>> {
        const axios = require('axios');
        
        try {
            // Method 1: Try project services endpoint
            const projectServicesResponse = await axios.get(
                `${credentials.baseUrl}/projects/${projectId}/services`,
                {
                    headers: {
                        'Content-Type': 'application/vnd.api+json',
                        'X-Auth-Token': credentials.apiToken,
                        'X-Organization-Id': credentials.organizationId
                    }
                }
            );
            
            if (projectServicesResponse.data.data) {
                this.log(`   ✅ Found ${projectServicesResponse.data.data.length} services for this project`);
                return projectServicesResponse.data.data;
            }
            
            // Method 2: Fallback to services with project filter
            const filteredServicesResponse = await axios.get(
                `${credentials.baseUrl}/services?filter[project_id]=${projectId}`,
                {
                    headers: {
                        'Content-Type': 'application/vnd.api+json',
                        'X-Auth-Token': credentials.apiToken,
                        'X-Organization-Id': credentials.organizationId
                    }
                }
            );
            
            if (filteredServicesResponse.data.data) {
                this.log(`   ✅ Found ${filteredServicesResponse.data.data.length} services for this project (filtered)`);
                return filteredServicesResponse.data.data;
            }
            
            // Method 3: Last resort - get all services but warn
            this.log(`   ⚠️ Could not get project-specific services, falling back to all services`);
            const allServicesResponse = await axios.get(`${credentials.baseUrl}/services`, {
                headers: {
                    'Content-Type': 'application/vnd.api+json',
                    'X-Auth-Token': credentials.apiToken,
                    'X-Organization-Id': credentials.organizationId
                }
            });
            
            return allServicesResponse.data.data;
            
        } catch (error: any) {
            this.log(`   ❌ Failed to get project services: ${error.message}`);
            throw error;
        }
    }

    /**
     * Test all project services (fallback method)
     */
    private async testAllProjectServices(
        credentials: { apiToken: string; organizationId: string; baseUrl: string },
        personId: string,
        projectId: string
    ): Promise<{ serviceId: string; serviceName: string; confidence: string }> {
        const axios = require('axios');
        
        try {
            // Get all available services for this project
            const projectServices = await this.getProjectServices(credentials, projectId);
            const availableServices = projectServices.filter(service => 
                service.attributes.deleted_at === null && 
                service.attributes.time_tracking_enabled
            );
            
            if (availableServices.length === 0) {
                throw new Error('No available services found for this project');
            }
            
            this.log(`   📊 Found ${availableServices.length} available services to test...`);
            
            // Test each service until we find one that works
            for (const service of availableServices) {
                this.log(`   🧪 Testing project service: ${service.attributes.name} (${service.id})`);
                
                try {
                    // Try to create a real time entry (1 minute test)
                    const testTimeEntry = {
                        data: {
                            type: 'time_entries',
                            attributes: {
                                date: new Date().toISOString().split('T')[0],
                                time: 1, // 1 minute test
                                note: 'Service permission test for project',
                                track_method_id: 1,
                                overhead: false
                            },
                            relationships: {
                                person: { data: { type: 'people', id: personId } },
                                project: { data: { type: 'projects', id: projectId } },
                                service: { data: { type: 'services', id: service.id } },
                                organization: { data: { type: 'organizations', id: credentials.organizationId } }
                            }
                        }
                    };
                    
                    const response = await axios.post(`${credentials.baseUrl}/time_entries`, testTimeEntry, {
                        headers: {
                            'Content-Type': 'application/vnd.api+json',
                            'X-Auth-Token': credentials.apiToken,
                            'X-Organization-Id': credentials.organizationId
                        }
                    });
                    
                    if (response.status === 201) {
                        this.log(`   ✅ Service ${service.attributes.name} works! Permission verified.`);
                        
                        // Delete the test entry immediately
                        await axios.delete(`${credentials.baseUrl}/time_entries/${response.data.data.id}`, {
                            headers: {
                                'X-Auth-Token': credentials.apiToken,
                                'X-Organization-Id': credentials.organizationId
                            }
                        });
                        
                        return {
                            serviceId: service.id,
                            serviceName: service.attributes.name,
                            confidence: 'MEDIUM (project service + permission verified)'
                        };
                    }
                    
                } catch (error: any) {
                    if (error.response?.status === 422) {
                        this.log(`   ❌ Service ${service.attributes.name} failed: ${error.response.data?.errors?.[0]?.title || 'Unknown error'}`);
                    } else {
                        this.log(`   ⚠️ Service ${service.attributes.name} error: ${error.message}`);
                    }
                    // Continue to next service
                }
            }
            
            throw new Error('No working services found for this project');
            
        } catch (error: any) {
            this.log(`   ❌ Project service testing failed: ${error.message}`);
            throw error;
        }
    }
} 