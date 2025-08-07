"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraTimeLogger = void 0;
const vscode = require("vscode");
const axios_1 = require("axios");
const JiraService_1 = require("./services/JiraService");
const git_1 = require("./utils/git");
class JiraTimeLogger {
    constructor() {
        this.timer = null;
        this.startTime = 0;
        this.elapsedTime = 0;
        this.isRunning = false;
        this.currentProject = null;
        this.currentIssue = null;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        this.jiraService = new JiraService_1.JiraService();
        this.outputChannel = vscode.window.createOutputChannel('Jira Time Tracker');
        this.updateStatusBar();
    }
    /**
     * Log message to both console and VS Code output channel
     */
    /**
     * Check if logging is enabled via configuration
     */
    isLoggingEnabled() {
        const config = vscode.workspace.getConfiguration('jiraTimeTracker');
        return config.get('enableLogging', false);
    }
    log(message, showOutput = false) {
        // Check if logging is enabled via configuration
        if (!this.isLoggingEnabled()) {
            return; // Silent mode - no output
        }
        console.log(message);
        this.outputChannel.appendLine(message);
        if (showOutput) {
            this.outputChannel.show(true);
        }
    }
    /**
     * Show the output channel for debugging Productive integration
     */
    showProductiveOutput() {
        if (!this.isLoggingEnabled()) {
            return; // Silent mode - don't show output channel
        }
        this.outputChannel.show(true);
    }
    updateJiraService(authService) {
        // Create a new JiraService with the authentication service
        this.jiraService = new JiraService_1.JiraService(authService);
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
        if (!this.isRunning)
            return;
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
    /**
     * Get the last commit message using git command
     */
    async getLastCommitMessage() {
        try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                this.log('❌ No workspace folder found for getting commit message');
                return null;
            }
            const { stdout } = await execAsync('git log -1 --pretty=format:"%s"', {
                cwd: workspaceFolder.uri.fsPath
            });
            const commitMessage = stdout.trim();
            this.log(`📝 Last commit message: ${commitMessage}`);
            return commitMessage || null;
        }
        catch (error) {
            this.log(`❌ Error getting last commit message: ${error}`);
            return null;
        }
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
                // Get the last commit message for description
                const commitMessage = await this.getLastCommitMessage();
                const description = commitMessage || `Time logged via VS Code extension`;
                this.log(`📝 Using description: ${description}`);
                // Use the enhanced logTime method that includes Productive integration
                await this.logTime(ticketId, timeSpent, description);
                // Show time logged notification
                vscode.window.showInformationMessage(`✅ Time logged: ${timeSpent} minutes to ${ticketId}`);
                this.resetTimer();
                this.currentIssue = null;
                this.log(`✅ Dual time logging completed successfully`);
            }
            catch (error) {
                this.log(`❌ Dual time logging failed: ${error.message}`);
                vscode.window.showErrorMessage(`❌ Failed to log time: ${error.message}`);
            }
        }
        else {
            this.log(`❌ No ticket ID found for time logging`);
            vscode.window.showErrorMessage('❌ No JIRA ticket selected for time logging');
        }
    }
    resetTimer() {
        this.elapsedTime = 0;
        this.startTime = 0;
        this.isRunning = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.updateStatusBar();
    }
    updateStatusBar() {
        const minutes = Math.floor(this.elapsedTime / 1000 / 60);
        const seconds = Math.floor((this.elapsedTime / 1000) % 60);
        this.statusBarItem.text = `$(clock) ${minutes}:${seconds.toString().padStart(2, '0')}`;
        this.statusBarItem.show();
    }
    async getTicketId() {
        // First, select a project
        const project = await this.selectProject();
        if (!project)
            return null;
        this.currentProject = project.key;
        const selection = await vscode.window.showQuickPick([
            'Get ticket from branch',
            'Select ticket from project',
            'Select from recent tickets'
        ], {
            placeHolder: 'How would you like to select the JIRA ticket?'
        });
        if (!selection)
            return null;
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
    async selectProject() {
        try {
            const projects = await this.jiraService.getProjects();
            const selected = await vscode.window.showQuickPick(projects.map(project => ({
                label: project.key,
                description: project.name,
                project
            })), {
                placeHolder: 'Select a JIRA project'
            });
            return selected ? { key: selected.label, name: selected.description || '' } : null;
        }
        catch (error) {
            vscode.window.showErrorMessage('Failed to fetch JIRA projects');
            return null;
        }
    }
    async selectProjectTicket() {
        if (!this.currentProject)
            return null;
        try {
            const issues = await this.jiraService.getAllProjectIssuesUnfiltered(this.currentProject);
            const selected = await vscode.window.showQuickPick(issues.map(issue => ({
                label: issue.key,
                description: issue.summary
            })), {
                placeHolder: `Select an issue from ${this.currentProject}`
            });
            return selected ? selected.label : null;
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to fetch issues for project ${this.currentProject}`);
            return null;
        }
    }
    async getTicketFromBranchAndVerify() {
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
        }
        catch (error) {
            vscode.window.showErrorMessage('Failed to verify ticket in JIRA');
        }
        return null;
    }
    async selectTicketManually() {
        try {
            const tickets = await this.jiraService.getRecentTickets();
            const selected = await vscode.window.showQuickPick(tickets.map(ticket => ({
                label: ticket.key,
                description: ticket.summary
            })), {
                placeHolder: 'Select a JIRA ticket'
            });
            return selected ? selected.label : null;
        }
        catch (error) {
            vscode.window.showErrorMessage('Failed to fetch JIRA tickets');
            return null;
        }
    }
    async getTicketFromBranch() {
        const branchName = await (0, git_1.getBranchName)();
        // Note: GitService now requires JiraService and outputChannel
        // This method is deprecated in favor of BranchChangeService
        return null;
    }
    isTracking() {
        return this.isRunning;
    }
    hasElapsedTime() {
        return this.elapsedTime > 0 || this.isRunning;
    }
    getCurrentTrackedTime() {
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
    async getRecentTickets() {
        // Implement this to return recent JIRA tickets
        // This could be stored in extension context or fetched from JIRA
        return [];
    }
    async logTime(ticket, timeSpent, description) {
        try {
            let minutes;
            if (typeof timeSpent === 'number') {
                // Already in minutes
                minutes = timeSpent;
            }
            else {
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
            const ticketInfo = await this.verifyJiraTicket(ticket);
            if (!ticketInfo.exists) {
                throw new Error(`Jira ticket ${ticket} not found or inaccessible`);
            }
            this.log(`✅ Jira ticket verified: ${ticket}`);
            // Store project information for Productive lookup
            const jiraProjectName = ticketInfo.projectName;
            const jiraProjectKey = ticketInfo.projectKey;
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
                await this.logTimeToProductive(ticket, minutes, description, jiraProjectName);
                productiveSuccess = true;
                this.log(`✅ Productive time logged: ${minutes} minutes`);
                // Output channel disabled for time logging
                // this.outputChannel.show(true);
            }
            catch (error) {
                productiveError = error.message;
                this.log(`❌ Productive logging failed: ${error.message}`);
                // Output channel disabled for time logging
                // this.outputChannel.show(true);
            }
            // Step 4: Final result message
            if (productiveSuccess) {
                this.log(`\n🎯 SUCCESS: Time logged successfully to both Jira and Productive: ${minutes} minutes`);
            }
            else {
                this.log(`\n⚠️ PARTIAL SUCCESS: Time logged to Jira successfully. Productive failed: ${productiveError}`);
            }
        }
        catch (error) {
            this.log(`❌ FAILED: Time logging failed: ${error.message}`);
            throw new Error(`Failed to log time: ${error.message}`);
        }
    }
    /**
     * Verify Jira ticket exists (following proven pattern from test)
     */
    async verifyJiraTicket(ticketId) {
        try {
            this.log(`   🔍 Checking if ticket ${ticketId} exists...`);
            // Get ticket details including project information
            const credentials = await this.jiraService.getCurrentCredentials();
            const response = await axios_1.default.get(`${credentials.baseUrl}/rest/api/2/issue/${ticketId}`, {
                auth: {
                    username: credentials.email,
                    password: credentials.apiToken
                }
            });
            if (response.status === 200) {
                const issue = response.data;
                const projectName = issue.fields.project.name;
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
        }
        catch (error) {
            this.log(`   ❌ Ticket verification failed: ${error.message}`);
            if (error.message.includes('404')) {
                this.log(`   💡 Suggestion: Check if ticket ${ticketId} exists and you have access to it`);
            }
            else if (error.message.includes('401')) {
                this.log(`   💡 Suggestion: Check your Jira email and API token`);
            }
            else if (error.message.includes('403')) {
                this.log(`   💡 Suggestion: You may not have permission to view this ticket`);
            }
            return { exists: false };
        }
    }
    /**
     * Log time to Jira using worklog API (following proven pattern from test)
     */
    async logTimeToJira(ticketId, timeMinutes, description) {
        this.log(`   🔍 Logging time to Jira: ${timeMinutes} minutes to ${ticketId}`);
        // JiraService logTime method only takes ticketId and timeMinutes
        // The description is automatically added by the service
        await this.jiraService.logTime(ticketId, timeMinutes);
        this.log(`   ✅ Jira time logged successfully`);
    }
    /**
     * Log time to Productive following the EXACT proven pattern from successful test
     */
    async logTimeToProductive(jiraTicketId, timeMinutes, description, jiraProjectName) {
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
            const projectInfo = await this.findProductiveProjectForCurrentWork(credentials, jiraProjectName);
            this.log(`   ✅ Project: ${projectInfo.name} (${projectInfo.id})`);
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
            await this.createProductiveTimeEntryExact(credentials, userInfo.personId, projectInfo.id, serviceInfo.serviceId, timeMinutes, timeDescription, jiraTicketId);
            this.log(`   ✅ Productive time logged: ${timeMinutes} minutes to project ${projectInfo.name}`);
        }
        catch (error) {
            this.log(`   ❌ Productive integration failed: ${error.message}`);
            // Show essential error information only
            if (error.response) {
                this.log(`   📋 API Status: ${error.response.status}`);
                if (error.response.data?.errors) {
                    const errors = error.response.data.errors;
                    if (Array.isArray(errors)) {
                        errors.forEach((err, index) => {
                            this.log(`   📋 Error ${index + 1}: ${err.title || err.detail || 'Unknown error'}`);
                        });
                    }
                }
                else if (error.response.data?.message) {
                    this.log(`   📋 Error: ${error.response.data.message}`);
                }
            }
            // Show output on error so user can see what went wrong (only if logging is enabled)
            if (this.isLoggingEnabled()) {
                this.outputChannel.show(true);
            }
            throw new Error(`Productive integration failed: ${error.message}`);
        }
    }
    /**
     * Get authenticated user via organization membership (ENHANCED DEBUGGING)
     */
    async getAuthenticatedUserFromMembership(credentials) {
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
            }
            else {
                throw new Error('No organization memberships found');
            }
        }
        catch (error) {
            this.log(`   ❌ Failed to get user from membership: ${error.message}`);
            if (error.response) {
                this.log(`   📋 API Error: ${error.response.status} - ${error.response.statusText}`);
                if (error.response.data?.errors) {
                    const errors = error.response.data.errors;
                    if (Array.isArray(errors)) {
                        errors.forEach((err, index) => {
                            this.log(`   📋 Error ${index + 1}: ${err.title || err.detail || 'Unknown error'}`);
                        });
                    }
                }
                else if (error.response.data?.message) {
                    this.log(`   📋 Error: ${error.response.data.message}`);
                }
            }
            else if (error.request) {
                this.log(`   📋 Network Error: Request failed`);
            }
            throw new Error(`Failed to get user from membership: ${error.message}`);
        }
    }
    /**
     * Find Productive project matching the selected project from dropdown (following test pattern)
     */
    async findProductiveProjectForCurrentWork(credentials, jiraProjectName) {
        const axios = require('axios');
        this.log(`   🔍 Finding project in Productive...`);
        try {
            // Use Jira project name if provided, otherwise fallback to current project
            let searchTerm = jiraProjectName || this.currentProject;
            if (!searchTerm) {
                throw new Error('No project name available for search');
            }
            this.log(`   🔍 Searching for Productive project matching: "${searchTerm}"`);
            // Step 1: Check for configured project mapping (FASTEST)
            const config = vscode.workspace.getConfiguration('jiraTimeTracker');
            const projectMapping = config.get('productive.projectMapping') || {};
            const projectNameMapping = config.get('productive.projectNameMapping') || {};
            if (projectMapping[searchTerm]) {
                const mappedProjectId = projectMapping[searchTerm];
                this.log(`   ✅ Found configured mapping: ${searchTerm} -> ${mappedProjectId}`);
                // Verify the mapped project exists
                try {
                    const projectResponse = await axios.get(`${credentials.baseUrl}/projects/${mappedProjectId}`, {
                        headers: {
                            'Content-Type': 'application/vnd.api+json',
                            'X-Auth-Token': credentials.apiToken,
                            'X-Organization-Id': credentials.organizationId
                        }
                    });
                    const project = projectResponse.data.data;
                    this.log(`   ✅ Mapped project verified: ${project.attributes.name} (${project.id})`);
                    return { id: project.id, name: project.attributes.name };
                }
                catch (error) {
                    this.log(`   ⚠️ Configured project ${mappedProjectId} not found, will search manually`);
                }
            }
            // Step 1.5: Check for project name mapping (e.g., "OT" -> "office test")
            if (projectNameMapping[searchTerm]) {
                const mappedProjectName = projectNameMapping[searchTerm];
                this.log(`   🔍 Found name mapping: ${searchTerm} -> "${mappedProjectName}"`);
                // Search for the mapped project name
                const nameSearchResponse = await axios.get(`${credentials.baseUrl}/projects?filter[name]=${encodeURIComponent(mappedProjectName)}&page[size]=10`, {
                    headers: {
                        'Content-Type': 'application/vnd.api+json',
                        'X-Auth-Token': credentials.apiToken,
                        'X-Organization-Id': credentials.organizationId
                    }
                });
                const nameMatches = nameSearchResponse.data.data;
                if (nameMatches.length > 0) {
                    const matchedProject = nameMatches[0];
                    this.log(`   ✅ Found project by name mapping: ${matchedProject.attributes.name} (${matchedProject.id})`);
                    return { id: matchedProject.id, name: matchedProject.attributes.name };
                }
            }
            // Step 2: Search with pagination for exact and precise matches
            this.log(`   📊 Searching for project by name: ${searchTerm}`);
            let foundProject = null;
            let page = 1;
            const pageSize = 50;
            while (!foundProject && page <= 10) { // Limit to 10 pages to avoid infinite loop
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
                // PRIORITY 1: Check for exact match (case-insensitive)
                const exactMatch = projects.find((p) => p.attributes.name.toLowerCase() === searchTerm?.toLowerCase());
                if (exactMatch) {
                    foundProject = exactMatch;
                    this.log(`   ✅ Found exact match: ${foundProject.attributes.name} (${foundProject.id})`);
                    break;
                }
                // PRIORITY 2: Check for exact match with common variations
                const variations = [
                    searchTerm.toLowerCase(),
                    searchTerm.toLowerCase() + ' project',
                    searchTerm.toLowerCase() + ' app',
                    searchTerm.toLowerCase() + ' application',
                    'the ' + searchTerm.toLowerCase(),
                    searchTerm.toLowerCase() + ' test',
                    searchTerm.toLowerCase() + ' development'
                ];
                const variationMatch = projects.find((p) => {
                    const projectName = p.attributes.name.toLowerCase();
                    return variations.some(variation => projectName === variation);
                });
                if (variationMatch) {
                    foundProject = variationMatch;
                    this.log(`   ✅ Found variation match: ${foundProject.attributes.name} (${foundProject.id})`);
                    break;
                }
                // PRIORITY 3: Check for starts with (more precise than partial)
                const startsWithMatch = projects.find((p) => {
                    const projectName = p.attributes.name.toLowerCase();
                    const jiraProject = searchTerm?.toLowerCase();
                    return projectName.startsWith(jiraProject + ' ') ||
                        projectName.startsWith(jiraProject + '-') ||
                        projectName.startsWith(jiraProject + '_');
                });
                if (startsWithMatch) {
                    foundProject = startsWithMatch;
                    this.log(`   ✅ Found starts-with match: ${foundProject.attributes.name} (${foundProject.id})`);
                    break;
                }
                // PRIORITY 4: Check for contains (last resort - more restrictive)
                const containsMatch = projects.find((p) => {
                    const projectName = p.attributes.name.toLowerCase();
                    const jiraProject = searchTerm?.toLowerCase() || '';
                    // Only match if the project name contains the Jira key AND is reasonably close in length
                    return projectName.includes(jiraProject) &&
                        projectName.length < jiraProject.length + 15; // Limit to reasonable matches
                });
                if (containsMatch) {
                    foundProject = containsMatch;
                    this.log(`   ⚠️ Found contains match: ${foundProject.attributes.name} (${foundProject.id})`);
                    break;
                }
                page++;
            }
            if (foundProject) {
                return { id: foundProject.id, name: foundProject.attributes.name };
            }
            // Step 3: If no match found, offer to configure mapping
            this.log(`   ⚠️ No project found for "${searchTerm}". Would you like to configure a mapping?`);
            const action = await vscode.window.showQuickPick([
                'Search all projects',
                'Configure project mapping',
                'Use first available project'
            ], {
                placeHolder: 'Choose an action'
            });
            if (action === 'Configure project mapping') {
                // Get all projects for selection
                this.log(`   📊 Getting all projects for mapping configuration...`);
                const allProjectsResponse = await axios.get(`${credentials.baseUrl}/projects?page[size]=200`, {
                    headers: {
                        'Content-Type': 'application/vnd.api+json',
                        'X-Auth-Token': credentials.apiToken,
                        'X-Organization-Id': credentials.organizationId
                    }
                });
                const allProjects = allProjectsResponse.data.data;
                const projectOptions = allProjects.map((project) => ({
                    label: project.attributes.name,
                    description: `ID: ${project.id}`,
                    detail: project
                }));
                const selected = await vscode.window.showQuickPick(projectOptions, {
                    placeHolder: `Select Productive project for Jira project "${searchTerm}"`
                });
                if (selected) {
                    const selectedProject = selected.detail;
                    this.log(`   ✅ User selected: ${selected.label} (${selectedProject.id})`);
                    // Save the mapping
                    projectMapping[searchTerm] = selectedProject.id;
                    await config.update('productive.projectMapping', projectMapping, vscode.ConfigurationTarget.Global);
                    this.log(`   💾 Saved mapping: ${searchTerm} -> ${selectedProject.id}`);
                    return { id: selectedProject.id, name: selected.label };
                }
            }
            else if (action === 'Search all projects') {
                // Get first available project as fallback
                const fallbackResponse = await axios.get(`${credentials.baseUrl}/projects?page[size]=1`, {
                    headers: {
                        'Content-Type': 'application/vnd.api+json',
                        'X-Auth-Token': credentials.apiToken,
                        'X-Organization-Id': credentials.organizationId
                    }
                });
                if (fallbackResponse.data.data.length > 0) {
                    const fallbackProject = fallbackResponse.data.data[0];
                    this.log(`   ⚠️ Using fallback: ${fallbackProject.attributes.name} (${fallbackProject.id})`);
                    return { id: fallbackProject.id, name: fallbackProject.attributes.name };
                }
            }
            throw new Error('No projects found in Productive');
        }
        catch (error) {
            this.log(`   ❌ Error finding project: ${error.message}`);
            throw error;
        }
    }
    /**
     * Get Productive credentials from authenticated user (ENHANCED DEBUGGING)
     */
    async getProductiveCredentials() {
        try {
            this.log('   🔍 Starting Productive credentials discovery...');
            // First try: Get from AuthenticationService (for UI-based authentication) - PRIORITY
            this.log('   🔍 Checking AuthenticationService for current user...');
            const jiraService = this.jiraService;
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
                        return {
                            apiToken: userCreds.productiveApiToken,
                            organizationId: process.env.PRODUCTIVE_ORGANIZATION_ID || '42335',
                            baseUrl: process.env.PRODUCTIVE_BASE_URL || 'https://api.productive.io/api/v2'
                        };
                    }
                    else {
                        this.log('⚠️ No Productive API token found in user credentials');
                        this.log(`   📋 Available credentials: ${JSON.stringify(Object.keys(userCreds || {}), null, 2)}`);
                    }
                }
                else {
                    this.log('⚠️ No current user found in AuthenticationService');
                }
            }
            else {
                this.log('⚠️ No auth service available for Productive integration');
            }
            this.log('❌ No authenticated user found with Productive credentials');
            return null;
        }
        catch (error) {
            this.log(`⚠️ Error getting Productive credentials: ${error}`);
            this.log(`   🔍 Full error details: ${JSON.stringify(error, null, 2)}`);
            return null;
        }
    }
    async discoverProductiveUser(credentials) {
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
        }
        catch (error) {
            throw new Error(`Failed to discover user: ${error.message}`);
        }
    }
    async findProductiveProject(credentials, jiraTicketId) {
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
        }
        catch (error) {
            throw new Error(`Failed to find project: ${error.message}`);
        }
    }
    async discoverBestService(credentials, personId, projectId) {
        const axios = require('axios');
        this.log(`   🛠️ Finding service for user and project...`);
        try {
            // Step 1: Check for configured default service (fastest)
            const config = vscode.workspace.getConfiguration('jiraTimeTracker');
            const defaultServiceId = config.get('productive.defaultServiceId');
            if (defaultServiceId) {
                this.log(`   🔍 Using configured default service: ${defaultServiceId}`);
                return {
                    serviceId: defaultServiceId,
                    serviceName: 'Default Service'
                };
            }
            // Step 2: Get user's recent services (faster than full discovery)
            this.log(`   📊 Getting user's recent services...`);
            const recentServicesResponse = await axios.get(`${credentials.baseUrl}/time_entries?filter[person_id]=${personId}&page[size]=10&include=service`, {
                headers: {
                    'Content-Type': 'application/vnd.api+json',
                    'X-Auth-Token': credentials.apiToken,
                    'X-Organization-Id': credentials.organizationId
                }
            });
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
        }
        catch (error) {
            this.log(`   ❌ Error finding service: ${error.message}`);
            throw error;
        }
    }
    /**
     * Find service for user and project (EXACT test method)
     */
    async findServiceForUserProject(credentials, personId, projectId) {
        const axios = require('axios');
        this.log(`   🛠️ Finding appropriate service for user and project...`);
        try {
            // Step 1: Check if user has logged time to this project before (existing user method)
            this.log(`   📊 Checking if user has logged time to this project before...`);
            let timeEntriesResponse = await axios.get(`${credentials.baseUrl}/time_entries?filter[person_id]=${personId}&filter[project_id]=${projectId}&page[size]=50&include=service`, {
                headers: {
                    'Content-Type': 'application/vnd.api+json',
                    'X-Auth-Token': credentials.apiToken,
                    'X-Organization-Id': credentials.organizationId
                }
            });
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
                    const userEntriesResponse = await axios.get(`${credentials.baseUrl}/time_entries?filter[person_id]=${personId}&page[size]=100&include=service`, {
                        headers: {
                            'Content-Type': 'application/vnd.api+json',
                            'X-Auth-Token': credentials.apiToken,
                            'X-Organization-Id': credentials.organizationId
                        }
                    });
                    const userEntries = userEntriesResponse.data.data || [];
                    this.log(`   📊 Approach 2: Found ${userEntries.length} user entries total`);
                    // Note: Cannot filter by project since project relationship is not included
                    // Just use all user entries for service analysis
                    if (userEntries.length > 0) {
                        timeEntries = userEntries;
                        timeEntriesResponse = userEntriesResponse;
                        this.log(`   📊 Approach 2: Using all user entries for service analysis`);
                    }
                }
                catch (error) {
                    this.log(`   ⚠️ Approach 2 failed: ${error.message}`);
                }
            }
            if (timeEntries.length > 0) {
                // User has logged time before - use historical analysis (PROVEN HIGH CONFIDENCE METHOD)
                this.log(`   ✅ User has previous time entries. Using historical analysis...`);
                // Extract service IDs from the entries
                const serviceIds = new Set(timeEntries.map((entry) => {
                    const serviceId = entry.relationships?.service?.data?.id;
                    if (serviceId) {
                        this.log(`   📋 Found service ID: ${serviceId} in entry ${entry.id}`);
                    }
                    return serviceId;
                }).filter(Boolean));
                this.log(`   📊 Unique service IDs found: ${Array.from(serviceIds).join(', ')}`);
                if (serviceIds.size === 1) {
                    // User always uses the same service - highest confidence
                    const serviceId = Array.from(serviceIds)[0];
                    let serviceName = 'Unknown Service';
                    // Note: Service name not available in response, using ID
                    serviceName = `Service ${serviceId}`;
                    this.log(`   🎯 User consistently uses: ${serviceName} (${serviceId})`);
                    return {
                        serviceId: serviceId,
                        serviceName: serviceName,
                        confidence: 'HIGH (historical consistency)'
                    };
                }
                else if (serviceIds.size > 1) {
                    // User uses multiple services - find most frequent
                    const serviceCounts = {};
                    timeEntries.forEach((entry) => {
                        const serviceId = entry.relationships?.service?.data?.id;
                        if (serviceId) {
                            serviceCounts[serviceId] = (serviceCounts[serviceId] || 0) + 1;
                        }
                    });
                    const mostUsedServiceId = Object.keys(serviceCounts).reduce((a, b) => serviceCounts[a] > serviceCounts[b] ? a : b);
                    let serviceName = 'Unknown Service';
                    // Note: Service name not available in response, using ID
                    serviceName = `Service ${mostUsedServiceId}`;
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
            const projectTimeEntriesResponse = await axios.get(`${credentials.baseUrl}/time_entries?filter[project_id]=${projectId}&page[size]=50&include=service`, {
                headers: {
                    'Content-Type': 'application/vnd.api+json',
                    'X-Auth-Token': credentials.apiToken,
                    'X-Organization-Id': credentials.organizationId
                }
            });
            if (projectTimeEntriesResponse.data.data && projectTimeEntriesResponse.data.data.length > 0) {
                this.log(`   📊 Found ${projectTimeEntriesResponse.data.data.length} time entries in this project`);
                // Extract unique services used in this project
                const serviceIds = new Set(projectTimeEntriesResponse.data.data.map((entry) => entry.relationships?.service?.data?.id).filter(Boolean));
                this.log(`   🎯 Found ${serviceIds.size} unique services used in this project`);
                // Note: Service details not available in response, using IDs
                this.log('   🛠️ Services used in this project:');
                Array.from(serviceIds).forEach((serviceId) => {
                    const serviceIdStr = serviceId;
                    this.log(`      • Service ${serviceIdStr} (${serviceIdStr})`);
                });
                if (serviceIds.size === 1) {
                    // Perfect! Project uses exactly one service
                    const serviceId = Array.from(serviceIds)[0];
                    this.log(`   ✅ Perfect! This project uses exactly one service: Service ${serviceId}`);
                    return {
                        serviceId: serviceId,
                        serviceName: `Service ${serviceId}`,
                        confidence: 'HIGH (project uses single service)'
                    };
                }
                else if (serviceIds.size > 1) {
                    // Multiple services - find most commonly used
                    const serviceCounts = {};
                    projectTimeEntriesResponse.data.forEach((entry) => {
                        const serviceId = entry.relationships?.service?.data?.id;
                        if (serviceId) {
                            serviceCounts[serviceId] = (serviceCounts[serviceId] || 0) + 1;
                        }
                    });
                    const mostUsedServiceId = Object.keys(serviceCounts).reduce((a, b) => serviceCounts[a] > serviceCounts[b] ? a : b);
                    this.log(`   🎯 Multiple services available. Suggesting most used: Service ${mostUsedServiceId}`);
                    return {
                        serviceId: mostUsedServiceId,
                        serviceName: `Service ${mostUsedServiceId}`,
                        confidence: 'MEDIUM (most used in project)'
                    };
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
        }
        catch (error) {
            throw new Error(`Service discovery failed: ${error.message}`);
        }
    }
    /**
     * Create Productive time entry following EXACT test pattern (ENHANCED DEBUGGING)
     */
    async createProductiveTimeEntryExact(credentials, personId, projectId, serviceId, timeMinutes, description, jiraTicketId) {
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
                        track_method_id: 1,
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
            }
            else {
                throw new Error(`Unexpected response status: ${response.status}`);
            }
        }
        catch (error) {
            this.log(`   ❌ Failed to create time entry: ${error.message}`);
            if (error.response) {
                this.log(`   📋 API Error: ${error.response.status} - ${error.response.statusText}`);
                if (error.response.data?.errors) {
                    const errors = error.response.data.errors;
                    if (Array.isArray(errors)) {
                        errors.forEach((err, index) => {
                            this.log(`   📋 Error ${index + 1}: ${err.title || err.detail || 'Unknown error'}`);
                        });
                    }
                }
                else if (error.response.data?.message) {
                    this.log(`   📋 Error: ${error.response.data.message}`);
                }
                throw new Error(`Productive API error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`);
            }
            else if (error.request) {
                this.log(`   📋 Network Error: Request failed`);
                throw new Error(`Request failed: ${error.message}`);
            }
            else {
                throw new Error(`Failed to create time entry: ${error.message}`);
            }
        }
    }
    /**
     * Get Jira base URL for linking in Productive
     */
    async getJiraBaseUrl() {
        try {
            const jiraService = this.jiraService;
            const authService = jiraService.authService;
            if (!authService)
                return '';
            const currentUser = await authService.getCurrentUser();
            if (!currentUser)
                return '';
            return currentUser.baseUrl || '';
        }
        catch (error) {
            return '';
        }
    }
    convertTimeToMinutes(timeSpent) {
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
    async setCurrentIssue(issueKey) {
        this.currentIssue = issueKey;
    }
    setCurrentProject(projectKey) {
        this.currentProject = projectKey;
        this.log(`📋 Current project set to: ${projectKey}`);
    }
    isTimerRunning() {
        return this.isRunning;
    }
    getCurrentTime() {
        return this.getCurrentTrackedTime();
    }
    getElapsedMinutes() {
        let totalTime = this.elapsedTime;
        if (this.isRunning) {
            totalTime = Date.now() - this.startTime;
        }
        return Math.round(totalTime / 1000 / 60);
    }
    async getBranchTicketInfo() {
        try {
            // Note: This method is deprecated in favor of BranchChangeService
            // GitService now requires JiraService and outputChannel
            this.log(`Branch ticket info method deprecated - use BranchChangeService instead`);
            return null;
        }
        catch (error) {
            console.error('Error getting branch ticket info:', error);
            return null;
        }
    }
    /**
     * Test Productive connectivity and show available resources (for debugging)
     */
    async testProductiveConnection() {
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
            projects.slice(0, 10).forEach((project, index) => {
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
            services.slice(0, 10).forEach((service, index) => {
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
            const userServiceIds = new Set(userTimeEntries.map((entry) => entry.relationships?.service?.data?.id).filter(Boolean));
            this.log(`   ✅ User has logged time with ${userServiceIds.size} different services`);
            if (userServiceIds.size > 0) {
                this.log(`   📋 User's services from time entries:`);
                Array.from(userServiceIds).forEach((serviceId, index) => {
                    const serviceIdStr = serviceId;
                    // Note: Service name not available in response, using ID
                    const serviceName = `Service ${serviceIdStr}`;
                    this.log(`      ${index + 1}. ${serviceName} (${serviceIdStr})`);
                });
            }
            this.log(`\n✅ PRODUCTIVE CONNECTION TEST PASSED`);
            this.log(`   🎯 Ready to log time to Productive`);
        }
        catch (error) {
            this.log(`\n❌ PRODUCTIVE CONNECTION TEST FAILED`);
            this.log(`   🔍 Error: ${error.message}`);
            if (error.response) {
                this.log(`   📋 API Error: ${error.response.status} - ${error.response.statusText}`);
                if (error.response.data?.errors) {
                    const errors = error.response.data.errors;
                    if (Array.isArray(errors)) {
                        errors.forEach((err, index) => {
                            this.log(`   📋 Error ${index + 1}: ${err.title || err.detail || 'Unknown error'}`);
                        });
                    }
                }
                else if (error.response.data?.message) {
                    this.log(`   📋 Error: ${error.response.data.message}`);
                }
            }
            // Show output on error (only if logging is enabled)
            if (this.isLoggingEnabled()) {
                this.outputChannel.show(true);
            }
        }
    }
    /**
     * Show current VS Code settings for debugging
     */
    showCurrentSettings() {
        this.log(`\n🔍 CURRENT VS CODE SETTINGS`, true);
        this.log(`═══════════════════════════════════════════════════════════`);
        const config = vscode.workspace.getConfiguration('jiraTimeTracker');
        // Jira settings
        this.log(`\n📊 JIRA SETTINGS:`);
        this.log(`   Base URL: ${config.get('baseUrl') || 'Not configured'}`);
        this.log(`   Email: ${config.get('email') || 'Not configured'}`);
        this.log(`   API Token: ${config.get('apiToken') ? 'Configured' : 'Not configured'}`);
        // Productive settings
        this.log(`\n📊 PRODUCTIVE SETTINGS:`);
        this.log(`   Organization ID: ${config.get('productive.organizationId') || 'Not configured'}`);
        this.log(`   API Token: ${config.get('productive.apiToken') ? 'Configured' : 'Not configured'}`);
        this.log(`   Base URL: ${config.get('productive.baseUrl') || 'https://api.productive.io/api/v2'}`);
        this.log(`   Person ID: ${config.get('productive.personId') || 'Not configured'}`);
        this.log(`   Default Project ID: ${config.get('productive.defaultProjectId') || 'Not configured'}`);
        this.log(`   Default Service ID: ${config.get('productive.defaultServiceId') || 'Not configured'}`);
        const projectMapping = config.get('productive.projectMapping') || {};
        this.log(`   Project Mapping: ${Object.keys(projectMapping).length > 0 ? JSON.stringify(projectMapping, null, 2) : 'Not configured'}`);
        // Environment variables
        this.log(`\n📊 ENVIRONMENT VARIABLES:`);
        this.log(`   PRODUCTIVE_ORGANIZATION_ID: ${process.env.PRODUCTIVE_ORGANIZATION_ID || 'Not set'}`);
        this.log(`   PRODUCTIVE_API_TOKEN: ${process.env.PRODUCTIVE_API_TOKEN ? 'Set' : 'Not set'}`);
        this.log(`   PRODUCTIVE_BASE_URL: ${process.env.PRODUCTIVE_BASE_URL || 'Not set'}`);
        this.log(`   PRODUCTIVE_PERSON_ID: ${process.env.PRODUCTIVE_PERSON_ID || 'Not set'}`);
        // Show output channel (only if logging is enabled)
        if (this.isLoggingEnabled()) {
            this.outputChannel.show(true);
        }
    }
}
exports.JiraTimeLogger = JiraTimeLogger;
//# sourceMappingURL=JiraTimeLogger.js.map