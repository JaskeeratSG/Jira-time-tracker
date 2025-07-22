"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraTimeLogger = void 0;
const vscode = require("vscode");
const JiraService_1 = require("./services/JiraService");
const GitService_1 = require("./services/GitService");
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
        this.updateStatusBar();
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
    async finishAndLog() {
        this.stopTimer();
        const timeSpent = Math.round(this.elapsedTime / 1000 / 60); // Convert to minutes
        const ticketId = this.currentIssue || await this.getTicketFromBranch();
        if (ticketId) {
            try {
                await this.jiraService.logTime(ticketId, timeSpent);
                vscode.window.showInformationMessage(`Time logged successfully: ${timeSpent} minutes to ${ticketId}`);
                this.resetTimer();
                this.currentIssue = null;
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to log time: ${error.message}`);
            }
        }
    }
    resetTimer() {
        this.elapsedTime = 0;
        this.startTime = 0;
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
            const issues = await this.jiraService.getProjectIssues(this.currentProject);
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
        const gitService = new GitService_1.GitService();
        return gitService.extractTicketId(branchName);
    }
    isTracking() {
        return this.isRunning;
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
    async logTime(ticket, timeSpent) {
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
            // Log time using JiraService
            await this.jiraService.logTime(ticket, minutes);
        }
        catch (error) {
            throw new Error(`Failed to log time: ${error.message}`);
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
    async getBranchTicketInfo() {
        try {
            const branchName = await (0, git_1.getBranchName)();
            const gitService = new GitService_1.GitService();
            // Extract ticket ID from any branch pattern
            const ticketId = gitService.extractTicketId(branchName);
            if (!ticketId) {
                console.log('No ticket ID found in branch name:', branchName);
                return null;
            }
            // Extract project key from ticket ID
            const projectKey = gitService.extractProjectKey(ticketId);
            if (!projectKey) {
                console.log('Invalid ticket ID format:', ticketId);
                return null;
            }
            // Verify the ticket exists in Jira
            const exists = await this.jiraService.verifyTicketExists(ticketId);
            if (exists) {
                console.log('Branch ticket info found:', { projectKey, issueKey: ticketId });
                return { projectKey, issueKey: ticketId };
            }
            else {
                console.log('Ticket not found in Jira:', ticketId);
                return null;
            }
        }
        catch (error) {
            console.error('Error getting branch ticket info:', error);
            return null;
        }
    }
}
exports.JiraTimeLogger = JiraTimeLogger;
//# sourceMappingURL=JiraTimeLogger.js.map