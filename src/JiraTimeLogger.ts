import * as vscode from 'vscode';
import { JiraService } from './services/JiraService';
import { AuthenticationService } from './services/AuthenticationService';
import { GitService } from './services/GitService';
import { getBranchName } from './utils/git';

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

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        this.jiraService = new JiraService();
        this.outputChannel = vscode.window.createOutputChannel('Jira Time Tracker - Productive Integration');
        this.updateStatusBar();
    }

    /**
     * Log message to both console and VS Code output channel
     */
    private log(message: string, showOutput: boolean = false): void {
        console.log(message);
        this.outputChannel.appendLine(message);
        if (showOutput) {
            this.outputChannel.show(true);
        }
    }

    /**
     * Show the output channel for debugging Productive integration
     */
    private showProductiveOutput(): void {
        this.outputChannel.appendLine('\n🔍 PRODUCTIVE INTEGRATION DEBUG OUTPUT');
        this.outputChannel.appendLine('═'.repeat(50));
        this.outputChannel.appendLine('Watch this output to see detailed Productive integration progress...');
        this.outputChannel.appendLine('═'.repeat(50));
        this.outputChannel.show(true);
    }

    updateJiraService(authService: AuthenticationService) {
        // Create a new JiraService with the authentication service
        (this as any).jiraService = new JiraService(authService);
    }

    async startTimer() {
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

    resumeTimer() {
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

    async finishAndLog() {
        this.log(`\n🚀 FINISH AND LOG - STARTING DUAL TIME LOGGING`, true);
        this.log(`═══════════════════════════════════════════════════════════`);
        
        this.stopTimer();
        const timeSpent = Math.round(this.elapsedTime / 1000 / 60); // Convert to minutes
        const ticketId = this.currentIssue || await this.getTicketFromBranch();
        
        this.log(`📊 Timer stopped. Time spent: ${timeSpent} minutes`);
        this.log(`🎯 Ticket ID: ${ticketId}`);
        
        if (ticketId) {
            try {
                this.log(`\n📊 Starting dual time logging (Jira + Productive)...`);
                // Use the enhanced logTime method that includes Productive integration
                await this.logTime(ticketId, timeSpent, `Time logged via VS Code extension`);
                vscode.window.showInformationMessage(`Time logged successfully: ${timeSpent} minutes to ${ticketId}`);
                this.resetTimer();
                this.currentIssue = null;
                this.log(`✅ Dual time logging completed successfully`);
            } catch (error:any) {
                this.log(`❌ Dual time logging failed: ${error.message}`);
                vscode.window.showErrorMessage(`Failed to log time: ${error.message}`);
            }
        } else {
            this.log(`❌ No ticket ID found for time logging`);
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

            this.log(`🚀 DUAL TIME LOGGING WORKFLOW`, true);
            this.log(`🎯 Jira Ticket: ${ticket}`);
            this.log(`⏰ Time: ${minutes} minutes`);
            this.log('='.repeat(50));

            // Step 1: Verify Jira ticket exists (following proven pattern)
            this.log('\n📊 Step 1: Verifying Jira ticket...');
            const ticketExists = await this.verifyJiraTicket(ticket);
            if (!ticketExists) {
                throw new Error(`Jira ticket ${ticket} not found or inaccessible`);
            }
            this.log(`✅ Jira ticket verified: ${ticket}`);

            // Step 2: Log time to JIRA (primary service - following proven pattern)
            this.log('\n📊 Step 2: Logging time to Jira...');
            await this.logTimeToJira(ticket, minutes, description);
            this.log(`✅ Jira time logged: ${minutes} minutes to ${ticket}`);

            // Step 3: Log time to Productive (secondary service - only if Jira succeeded)
            this.log('\n📊 Step 3: Logging time to Productive...');
            this.showProductiveOutput();
            let productiveSuccess = false;
            let productiveError = '';
            
            try {
                await this.logTimeToProductive(ticket, minutes, description);
                productiveSuccess = true;
                this.log(`✅ Productive time logged: ${minutes} minutes`);
            } catch (error: any) {
                productiveError = error.message;
                this.log(`❌ Productive logging failed: ${error.message}`);
                // Show output on error so user can see what went wrong
                this.outputChannel.show(true);
            }

            // Step 4: Final result message
            if (productiveSuccess) {
                this.log(`\n🎯 SUCCESS: Time logged successfully to both Jira and Productive: ${minutes} minutes`);
            } else {
                this.log(`\n⚠️ PARTIAL SUCCESS: Time logged to Jira successfully. Productive failed: ${productiveError}`);
            }

        } catch (error: any) {
            this.log(`❌ FAILED: Time logging failed: ${error.message}`);
            throw new Error(`Failed to log time: ${error.message}`);
        }
    }

    /**
     * Verify Jira ticket exists (following proven pattern from test)
     */
    private async verifyJiraTicket(ticketId: string): Promise<boolean> {
        try {
            this.log(`   🔍 Checking if ticket ${ticketId} exists...`);
            // Use jiraService to verify ticket exists
            const exists = await this.jiraService.verifyTicketExists(ticketId);
            if (exists) {
                this.log(`   ✅ Ticket found: ${ticketId}`);
            }
            return exists;
        } catch (error: any) {
            this.log(`   ❌ Ticket verification failed: ${error.message}`);
            
            if (error.message.includes('404')) {
                this.log(`   💡 Suggestion: Check if ticket ${ticketId} exists and you have access to it`);
            } else if (error.message.includes('401')) {
                this.log(`   💡 Suggestion: Check your Jira email and API token`);
            } else if (error.message.includes('403')) {
                this.log(`   💡 Suggestion: You may not have permission to view this ticket`);
            }
            return false;
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
    private async logTimeToProductive(jiraTicketId: string, timeMinutes: number, description?: string): Promise<void> {
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
            const projectInfo = await this.findProductiveProjectForCurrentWork(credentials);
            this.log(`   ✅ Project: ${projectInfo.name} (${projectInfo.id})`);
            
            // Step 4: Find service assigned to user for this project (PROVEN METHOD)
            this.log(`\n📊 Step 4: Finding appropriate service for user and project...`);
            const serviceInfo = await this.findServiceForUserProject(credentials, userInfo.personId, projectInfo.id);
            this.log(`   ✅ Service: ${serviceInfo.serviceName} (${serviceInfo.serviceId})`);
            this.log(`   ✅ Confidence: ${serviceInfo.confidence}`);
            
            // Step 5: Create time entry following EXACT test pattern
            this.log(`\n📊 Step 5: Creating time entry in Productive...`);
            const timeDescription = description || `${jiraTicketId}: Time logged via VS Code extension`;
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
            
            // Show output on error so user can see what went wrong
            this.outputChannel.show(true);
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
     * Find Productive project matching the selected project from dropdown (following test pattern)
     */
    private async findProductiveProjectForCurrentWork(credentials: { apiToken: string; organizationId: string; baseUrl: string }): Promise<{ id: string; name: string }> {
        const axios = require('axios');
        
        this.log(`   🔍 Finding project in Productive...`);
        this.log(`   📋 Selected Jira project: ${this.currentProject || 'None selected'}`);
        
        try {
            let projectKey = this.currentProject;
            
            // Step 1: Fetch all projects from Productive API
            this.log(`   📊 Fetching projects from Productive API...`);
            const projectsResponse = await axios.get(`${credentials.baseUrl}/projects?page[size]=100&page[number]=1`, {
                        headers: {
                            'Content-Type': 'application/vnd.api+json',
                            'X-Auth-Token': credentials.apiToken,
                            'X-Organization-Id': credentials.organizationId
                        }
                    });
                    
            const projects = projectsResponse.data.data;
            this.log(`   📊 Found ${projects.length} projects in Productive`);
            
            // Step 2: Create dynamic project mapping from API data
            const projectMapping: Record<string, string> = {};
            projects.forEach((project: any) => {
                const projectName = project.attributes.name;
                const projectId = project.id;
                
                // Create mapping for full project name
                projectMapping[projectName] = projectId;
            
                // Create mapping for project key (first word or acronym)
                const projectKey = projectName.split(' ')[0].toUpperCase();
                if (projectKey.length > 1) {
                    projectMapping[projectKey] = projectId;
                }
                
                // Create mapping for common abbreviations
                if (projectName.toLowerCase().includes('office test')) {
                    projectMapping['OT'] = projectId;
                }
                if (projectName.toLowerCase().includes('ctl')) {
                    projectMapping['CTL'] = projectId;
                }
            });
            
            this.log(`   📋 Dynamic project mapping created:`);
            Object.entries(projectMapping).forEach(([key, id]) => {
                this.log(`      ${key} → ${id}`);
            });
            
            // Step 3: Try to find matching project
            let targetProject = null;
            
            if (projectKey) {
                this.log(`   🔍 Looking for Productive project matching Jira project: ${projectKey}`);
                
                // Method 1: Direct mapping lookup
                if (projectMapping[projectKey]) {
                    const projectId = projectMapping[projectKey];
                    targetProject = projects.find((p: any) => p.id === projectId);
                    if (targetProject) {
                        this.log(`   ✅ Found direct mapping: ${projectKey} → ${targetProject.attributes.name}`);
                    }
                }
                
                // Method 2: Exact name match (case insensitive)
                if (!targetProject) {
                targetProject = projects.find((p: any) => {
                    const projectName = p.attributes.name.toLowerCase();
                        const jiraProject = projectKey!.toLowerCase();
                    return projectName === jiraProject;
                });
                
                if (targetProject) {
                        this.log(`   ✅ Found exact name match: ${targetProject.attributes.name}`);
                    }
                }
                
                // Method 3: Contains match
                if (!targetProject) {
                    targetProject = projects.find((p: any) => {
                        const projectName = p.attributes.name.toLowerCase();
                        const jiraProject = projectKey!.toLowerCase();
                        return projectName.includes(jiraProject) || jiraProject.includes(projectName.split(' ')[0].toLowerCase());
                    });
                    
                    if (targetProject) {
                        this.log(`   ✅ Found partial match: ${targetProject.attributes.name}`);
                    }
                }
                
                // Method 4: Word-based matching
                if (!targetProject) {
                        targetProject = projects.find((p: any) => {
                            const projectName = p.attributes.name.toLowerCase();
                        const jiraProjectWords = projectKey!.toLowerCase().split(/[-_\s]+/);
                            const productiveProjectWords = projectName.split(/[-_\s]+/);
                            
                            return jiraProjectWords.some(jiraWord => 
                                jiraWord.length > 1 && productiveProjectWords.some((prodWord: string) => 
                                    prodWord.includes(jiraWord) || jiraWord.includes(prodWord)
                                )
                            );
                        });
                        
                        if (targetProject) {
                            this.log(`   ✅ Found word-based match: ${targetProject.attributes.name}`);
                    }
                }
            }
            
            // Step 4: Fallback if no match found
            if (!targetProject) {
                this.log(`   ⚠️ No matching project found for "${projectKey || 'no selection'}"`);
                this.log(`   📋 Available projects in Productive:`);
                projects.slice(0, 10).forEach((project: any, index: number) => {
                    this.log(`      ${index + 1}. ${project.attributes.name} (${project.id})`);
                });
                
                if (projects.length > 10) {
                    this.log(`      ... and ${projects.length - 10} more projects`);
                }
                
                // Use the first active project as fallback
                if (projects.length > 0) {
                    targetProject = projects[0];
                    this.log(`   ⚠️ Using first available project as fallback: ${targetProject.attributes.name}`);
                } else {
                    throw new Error('No projects found in Productive');
                }
            }
            
            return {
                id: targetProject.id,
                name: targetProject.attributes.name
            };
            
        } catch (error: any) {
            throw new Error(`Failed to find Productive project: ${error.message}`);
        }
    }

    /**
     * Get Productive credentials from authenticated user (ENHANCED DEBUGGING)
     */
    private async getProductiveCredentials(): Promise<{ apiToken: string; organizationId: string; baseUrl: string } | null> {
        try {
            this.log('   🔍 Starting Productive credentials discovery...');
            
            // First try: Get from VS Code settings (preferred method for configured setups)
            const config = vscode.workspace.getConfiguration('jiraTimeTracker');
            const settingsApiToken = config.get<string>('productive.apiToken') || process.env.PRODUCTIVE_API_TOKEN;
            const settingsOrgId = config.get<string>('productive.organizationId') || process.env.PRODUCTIVE_ORGANIZATION_ID;
            const settingsBaseUrl = config.get<string>('productive.baseUrl') || process.env.PRODUCTIVE_BASE_URL || 'https://api.productive.io/api/v2';
            
            this.log(`   📋 VS Code Settings Check:`);
            this.log(`      API Token: ${settingsApiToken ? 'Found' : 'Missing'}`);
            this.log(`      Organization ID: ${settingsOrgId ? 'Found' : 'Missing'}`);
            this.log(`      Base URL: ${settingsBaseUrl}`);
            
            if (settingsApiToken && settingsOrgId) {
                this.log('   ✅ Using Productive credentials from VS Code settings');
                return {
                    apiToken: settingsApiToken,
                    organizationId: settingsOrgId,
                    baseUrl: settingsBaseUrl
                };
            }
            
            // Second try: Get from AuthenticationService (for UI-based authentication)
            this.log('   🔍 No VS Code settings found, trying AuthenticationService...');
            const jiraService = this.jiraService as any;
            if (!jiraService.authService) {
                this.log('⚠️ No auth service available for Productive integration');
                return null;
            }
            
            const authService = jiraService.authService;
            const currentUser = await authService.getCurrentUser();
            if (!currentUser) {
                this.log('⚠️ No current user found in AuthenticationService');
                return null;
            }
            
            this.log(`   📋 Current User: ${currentUser.email}`);
            const userCreds = await authService.getUserCredentials(currentUser.email);
            if (!userCreds?.productiveApiToken) {
                this.log('⚠️ No Productive API token found in user credentials');
                this.log(`   📋 Available credentials: ${JSON.stringify(Object.keys(userCreds || {}), null, 2)}`);
                return null;
            }
            
            this.log('   ✅ Using Productive credentials from AuthenticationService');
            return {
                apiToken: userCreds.productiveApiToken,
                organizationId: process.env.PRODUCTIVE_ORGANIZATION_ID || '42335',
                baseUrl: process.env.PRODUCTIVE_BASE_URL || 'https://api.productive.io/api/v2'
            };
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
        
        try {
            this.log('   🔍 Discovering best service for time logging...');
            
            // First, try to find previous time entries by this person for this project
            const userTimeEntriesResponse = await axios.get(`${credentials.baseUrl}/time_entries?filter[person_id]=${personId}&filter[project_id]=${projectId}&page[size]=10&include=service`, {
                headers: {
                    'Content-Type': 'application/vnd.api+json',
                    'X-Auth-Token': credentials.apiToken,
                    'X-Organization-Id': credentials.organizationId
                }
            });
            
            if (userTimeEntriesResponse.data.data.length > 0) {
                // Use the most recent service from user's previous entries
                const recentEntry = userTimeEntriesResponse.data.data[0];
                const serviceId = recentEntry.relationships.service.data.id;
                
                // Find service details in included data
                const serviceDetails = userTimeEntriesResponse.data.included?.find((item: any) => 
                    item.type === 'services' && item.id === serviceId
                );
                
                if (serviceDetails) {
                    return {
                        serviceId: serviceDetails.id,
                        serviceName: serviceDetails.attributes.name
                    };
                }
            }
            
            // Fallback: Get available services and use the first one
            this.log('   📊 No previous entries. Getting available services...');
            const servicesResponse = await axios.get(`${credentials.baseUrl}/services`, {
                headers: {
                    'Content-Type': 'application/vnd.api+json',
                    'X-Auth-Token': credentials.apiToken,
                    'X-Organization-Id': credentials.organizationId
                }
            });
            
            if (servicesResponse.data.data.length > 0) {
                const service = servicesResponse.data.data[0];
                return {
                    serviceId: service.id,
                    serviceName: service.attributes.name
                };
            }
            
            throw new Error('No services found');
        } catch (error: any) {
            throw new Error(`Failed to discover service: ${error.message}`);
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
        
        this.log(`   🛠️ Finding appropriate service for user and project...`);
        
        try {
            // First try: Check for configured default service ID in VS Code settings
            const config = vscode.workspace.getConfiguration('jiraTimeTracker');
            const defaultServiceId = config.get<string>('productive.defaultServiceId');
            
            if (defaultServiceId) {
                try {
                    this.log(`   🔍 Checking configured default service: ${defaultServiceId}`);
                    
                    // Verify the service exists and user has access
                    const serviceResponse = await axios.get(`${credentials.baseUrl}/services/${defaultServiceId}`, {
                        headers: {
                            'Content-Type': 'application/vnd.api+json',
                            'X-Auth-Token': credentials.apiToken,
                            'X-Organization-Id': credentials.organizationId
                        }
                    });
                    
                    const serviceName = serviceResponse.data.data.attributes.name;
                    this.log(`   ✅ Using configured default service: ${serviceName} (${defaultServiceId})`);
                    
                    return {
                        serviceId: defaultServiceId,
                        serviceName: serviceName,
                        confidence: 'HIGH (configured)'
                    };
                } catch (error) {
                    this.log(`   ⚠️ Configured service ${defaultServiceId} not accessible, falling back to discovery...`);
                }
            }
            
            this.log(`   🔍 No configured service found, starting intelligent service discovery...`);
            
            // Step 1: Check if user has logged time to this project before (existing user method)
            this.log(`   📊 Checking if user has logged time to this project before...`);
            const timeEntriesResponse = await axios.get(
                `${credentials.baseUrl}/time_entries?filter[person_id]=${personId}&filter[project_id]=${projectId}&page[size]=50&include=service`,
                {
                    headers: {
                        'Content-Type': 'application/vnd.api+json',
                        'X-Auth-Token': credentials.apiToken,
                        'X-Organization-Id': credentials.organizationId
                    }
                }
            );
            
            const timeEntries = timeEntriesResponse.data.data || [];
            this.log(`   📊 Found ${timeEntries.length} previous time entries by this user`);
            
            if (timeEntries.length > 0) {
                // User has logged time before - use historical analysis (PROVEN HIGH CONFIDENCE METHOD)
                this.log(`   ✅ User has previous time entries. Using historical analysis...`);
                
                const serviceIds = new Set(
                    timeEntries.map((entry: any) => entry.relationships?.service?.data?.id).filter(Boolean)
                );
                
                if (serviceIds.size === 1) {
                    // User always uses the same service - highest confidence
                    const serviceId = Array.from(serviceIds)[0] as string;
                    let serviceName = 'Unknown Service';
                    
                    if (timeEntriesResponse.data.included) {
                        const serviceData = timeEntriesResponse.data.included.find((inc: any) => 
                            inc.type === 'services' && inc.id === serviceId
                        );
                        if (serviceData) {
                            serviceName = serviceData.attributes.name;
                        }
                    }
                    
                    this.log(`   🎯 User consistently uses: ${serviceName} (${serviceId})`);
                    return {
                        serviceId: serviceId,
                        serviceName: serviceName,
                        confidence: 'HIGH (historical consistency)'
                    };
                } else if (serviceIds.size > 1) {
                    // User uses multiple services - find most frequent
                    const serviceCounts: { [key: string]: number } = {};
                    timeEntries.forEach((entry: any) => {
                        const serviceId = entry.relationships?.service?.data?.id;
                        if (serviceId) {
                            serviceCounts[serviceId] = (serviceCounts[serviceId] || 0) + 1;
                        }
                    });
                    
                    const mostUsedServiceId = Object.keys(serviceCounts).reduce((a, b) => 
                        serviceCounts[a] > serviceCounts[b] ? a : b
                    );
                    
                    let serviceName = 'Unknown Service';
                    if (timeEntriesResponse.data.included) {
                        const serviceData = timeEntriesResponse.data.included.find((inc: any) => 
                            inc.type === 'services' && inc.id === mostUsedServiceId
                        );
                        if (serviceData) {
                            serviceName = serviceData.attributes.name;
                        }
                    }
                    
                    this.log(`   🎯 User's most used service: ${serviceName} (${mostUsedServiceId})`);
                    return {
                        serviceId: mostUsedServiceId,
                        serviceName: serviceName,
                        confidence: 'MEDIUM (most used from history)'
                    };
                }
            }
            
            // Step 2: First-time user - analyze what services are used in this project
            this.log(`   ⚠️ User has no previous time entries. Analyzing project services for first-time user...`);
            
            const projectTimeEntriesResponse = await axios.get(
                `${credentials.baseUrl}/time_entries?filter[project_id]=${projectId}&page[size]=50&include=service`,
                {
                    headers: {
                        'Content-Type': 'application/vnd.api+json',
                        'X-Auth-Token': credentials.apiToken,
                        'X-Organization-Id': credentials.organizationId
                    }
                }
            );
            
            if (projectTimeEntriesResponse.data.data.length > 0) {
                this.log(`   📊 Found ${projectTimeEntriesResponse.data.data.length} time entries in this project`);
                
                // Extract unique services used in this project
                const serviceIds = new Set(
                    projectTimeEntriesResponse.data.data.map((entry: any) => entry.relationships?.service?.data?.id).filter(Boolean)
                );
                
                this.log(`   🎯 Found ${serviceIds.size} unique services used in this project`);
                
                // Get service details from included data
                if (projectTimeEntriesResponse.data.included) {
                    const serviceDetails = projectTimeEntriesResponse.data.included
                        .filter((item: any) => item.type === 'services')
                        .filter((service: any) => serviceIds.has(service.id));
                    
                    this.log('   🛠️ Services used in this project:');
                    serviceDetails.forEach((service: any) => {
                        this.log(`      • ${service.attributes.name} (${service.id})`);
                    });
                    
                    if (serviceDetails.length === 1) {
                        // Perfect! Project uses exactly one service
                        const service = serviceDetails[0];
                        this.log(`   ✅ Perfect! This project uses exactly one service: ${service.attributes.name}`);
                        return {
                            serviceId: service.id,
                            serviceName: service.attributes.name,
                            confidence: 'HIGH (project uses single service)'
                        };
                    } else if (serviceDetails.length > 1) {
                        // Multiple services - find most commonly used
                        const serviceCounts: { [key: string]: number } = {};
                        projectTimeEntriesResponse.data.data.forEach((entry: any) => {
                            const serviceId = entry.relationships?.service?.data?.id;
                            if (serviceId) {
                                serviceCounts[serviceId] = (serviceCounts[serviceId] || 0) + 1;
                            }
                        });
                        
                        const mostUsedServiceId = Object.keys(serviceCounts).reduce((a, b) => 
                            serviceCounts[a] > serviceCounts[b] ? a : b
                        );
                        
                        const mostUsedService = serviceDetails.find((s: any) => s.id === mostUsedServiceId);
                        
                        if (mostUsedService) {
                            this.log(`   🎯 Multiple services available. Suggesting most used: ${mostUsedService.attributes.name}`);
                            return {
                                serviceId: mostUsedService.id,
                                serviceName: mostUsedService.attributes.name,
                                confidence: 'MEDIUM (most used in project)'
                            };
                        }
                    }
                }
            }
            
            // Step 3: Fallback - no time entries in project, get any available service
            this.log(`   ⚠️ No time entries found in this project. Getting available services...`);
            
            const allServicesResponse = await axios.get(`${credentials.baseUrl}/services`, {
                headers: {
                    'Content-Type': 'application/vnd.api+json',
                    'X-Auth-Token': credentials.apiToken,
                    'X-Organization-Id': credentials.organizationId
                }
            });
            
            const allServices = allServicesResponse.data.data;
            if (allServices.length > 0) {
                const firstService = allServices[0];
                this.log(`   ⚠️ Using first available service as fallback: ${firstService.attributes.name}`);
                this.log(`   💡 Tip: Configure defaultServiceId in VS Code settings for reliable service selection`);
                
                return {
                    serviceId: firstService.id,
                    serviceName: firstService.attributes.name,
                    confidence: 'LOW (fallback service)'
                };
            }
            
            throw new Error('No services available in organization');
            
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
            const entryDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
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
            
            const userTimeEntries = userServicesResponse.data.data;
            const userServiceIds = new Set(
                userTimeEntries.map((entry: any) => entry.relationships?.service?.data?.id).filter(Boolean)
            );
            
            this.log(`   ✅ User has logged time with ${userServiceIds.size} different services`);
            if (userServiceIds.size > 0) {
                this.log(`   📋 User's services from time entries:`);
                Array.from(userServiceIds).forEach((serviceId: unknown, index: number) => {
                    const serviceIdStr = serviceId as string;
                    const serviceDetails = userServicesResponse.data.included?.find((item: any) => 
                        item.type === 'services' && item.id === serviceIdStr
                    );
                    const serviceName = serviceDetails?.attributes.name || 'Unknown';
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
            this.outputChannel.show(true);
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
        
        this.outputChannel.show(true);
    }
} 