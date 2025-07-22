"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraService = void 0;
const axios_1 = require("axios");
const settings_1 = require("../config/settings");
class JiraService {
    constructor(authService) {
        this.authService = null;
        this.authService = authService || null;
    }
    /**
     * Get current user credentials (from auth service or fallback to settings)
     */
    async getCurrentCredentials() {
        // Try to get from authentication service first
        if (this.authService) {
            const credentials = await this.authService.getActiveUserCredentials();
            if (credentials) {
                return credentials;
            }
            // Fallback to settings if no authenticated user
            const fallback = this.authService.getFallbackCredentials();
            if (fallback) {
                return fallback;
            }
        }
        // Legacy fallback - get from settings
        const config = (0, settings_1.getJiraConfig)();
        if (!config.email || !config.apiToken || !config.baseUrl) {
            throw new Error('No JIRA credentials found. Please sign in or configure settings.');
        }
        return {
            email: config.email,
            apiToken: config.apiToken,
            baseUrl: config.baseUrl
        };
    }
    async logTime(ticketId, timeSpentMinutes) {
        const endpoint = `/rest/api/2/issue/${ticketId}/worklog`;
        const credentials = await this.getCurrentCredentials();
        try {
            const response = await axios_1.default.post(`${credentials.baseUrl}${endpoint}`, {
                timeSpentSeconds: timeSpentMinutes * 60,
                comment: `Time logged via VS Code extension by ${credentials.email}`
            }, {
                auth: {
                    username: credentials.email,
                    password: credentials.apiToken
                },
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        }
        catch (error) {
            throw new Error(`Failed to log time: ${error.message}`);
        }
    }
    async verifyTicketExists(ticketId) {
        const credentials = await this.getCurrentCredentials();
        try {
            const response = await axios_1.default.get(`${credentials.baseUrl}/rest/api/2/issue/${ticketId}`, {
                auth: {
                    username: credentials.email,
                    password: credentials.apiToken
                }
            });
            return response.status === 200;
        }
        catch (error) {
            // If issue is not found, Jira returns 404
            if (error.response && error.response.status === 404) {
                return false;
            }
            throw error;
        }
    }
    async getRecentTickets() {
        const credentials = await this.getCurrentCredentials();
        try {
            // JQL query to get recent tickets assigned to the user
            const jql = encodeURIComponent('assignee = currentUser() ORDER BY updated DESC');
            const response = await axios_1.default.get(`${credentials.baseUrl}/rest/api/2/search?jql=${jql}&fields=summary&maxResults=10`, {
                auth: {
                    username: credentials.email,
                    password: credentials.apiToken
                }
            });
            return response.data.issues.map((issue) => ({
                key: issue.key,
                summary: issue.fields.summary
            }));
        }
        catch (error) {
            console.error('Failed to fetch recent tickets:', error);
            throw new Error('Failed to fetch recent tickets from JIRA');
        }
    }
    async getProjects() {
        const credentials = await this.getCurrentCredentials();
        try {
            const response = await axios_1.default.get(`${credentials.baseUrl}/rest/api/2/project`, {
                auth: {
                    username: credentials.email,
                    password: credentials.apiToken
                }
            });
            return response.data.map((project) => ({
                id: project.id,
                key: project.key,
                name: project.name
            }));
        }
        catch (error) {
            console.error('Failed to fetch projects:', error);
            if (error.response) {
                console.error('JIRA API Response:', error.response.data);
                throw new Error(`Failed to fetch projects: ${error.response.data.message || error.message}`);
            }
            throw new Error('Failed to fetch projects from JIRA');
        }
    }
    async getProjectIssues(projectKey) {
        const credentials = await this.getCurrentCredentials();
        try {
            const jql = `project = "${projectKey}" AND issuetype in (Bug, Story, Task) ORDER BY created DESC`;
            const response = await this._makeRequest(`/rest/api/2/search?jql=${encodeURIComponent(jql)}`, credentials);
            return response.issues.map((issue) => ({
                key: issue.key,
                summary: issue.fields.summary
            }));
        }
        catch (error) {
            console.error('Failed to fetch project issues:', error);
            throw new Error(`Failed to fetch issues for project ${projectKey}`);
        }
    }
    async getProjectsByUserEmail(email) {
        const credentials = await this.getCurrentCredentials();
        try {
            // First get all projects
            const allProjects = await this.getProjects();
            console.log('All projects loaded:', allProjects);
            // Then filter projects where the user has issues assigned
            const jql = `assignee = "${email}" ORDER BY updated DESC`;
            const response = await this._makeRequest(`/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=project`, credentials);
            console.log('User issues response:', response);
            // Get unique project keys from the issues
            const projectKeys = new Set(response.issues.map((issue) => issue.fields.project.key));
            console.log('Project keys found:', Array.from(projectKeys));
            // Filter the original projects list to only include projects where the user has issues
            const filteredProjects = allProjects.filter(project => projectKeys.has(project.key));
            console.log('Filtered projects:', filteredProjects);
            return filteredProjects;
        }
        catch (error) {
            console.error('Failed to fetch projects for user:', error);
            if (error.response) {
                console.error('JIRA API Response:', error.response.data);
                throw new Error(`Failed to fetch projects: ${error.response.data.message || error.message}`);
            }
            throw new Error('Failed to fetch projects for user from JIRA');
        }
    }
    async _makeRequest(endpoint, credentials) {
        const creds = credentials || await this.getCurrentCredentials();
        try {
            const response = await axios_1.default.get(`${creds.baseUrl}${endpoint}`, {
                auth: {
                    username: creds.email,
                    password: creds.apiToken
                }
            });
            return response.data;
        }
        catch (error) {
            console.error('Failed to make request:', error);
            throw new Error('Failed to make request to JIRA');
        }
    }
}
exports.JiraService = JiraService;
//# sourceMappingURL=JiraService.js.map