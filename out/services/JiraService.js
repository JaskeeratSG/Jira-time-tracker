"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraService = void 0;
const axios_1 = require("axios");
const settings_1 = require("../config/settings");
class JiraService {
    constructor() {
        this.config = (0, settings_1.getJiraConfig)();
    }
    async logTime(ticketId, timeSpentMinutes) {
        const endpoint = `/rest/api/2/issue/${ticketId}/worklog`;
        if (!this.config.email || !this.config.apiToken) {
            throw new Error('JIRA credentials not configured. Please set them in settings.');
        }
        try {
            const response = await axios_1.default.post(`${this.config.baseUrl}${endpoint}`, {
                timeSpentSeconds: timeSpentMinutes * 60,
                comment: 'Time logged via VS Code extension'
            }, {
                auth: {
                    username: this.config.email,
                    password: this.config.apiToken
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
        try {
            const response = await axios_1.default.get(`${this.config.baseUrl}/rest/api/2/issue/${ticketId}`, {
                auth: {
                    username: this.config.email,
                    password: this.config.apiToken
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
        try {
            // JQL query to get recent tickets assigned to the user
            const jql = encodeURIComponent('assignee = currentUser() ORDER BY updated DESC');
            const response = await axios_1.default.get(`${this.config.baseUrl}/rest/api/2/search?jql=${jql}&fields=summary&maxResults=10`, {
                auth: {
                    username: this.config.email,
                    password: this.config.apiToken
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
        try {
            const response = await axios_1.default.get(`${this.config.baseUrl}/rest/api/2/project`, {
                auth: {
                    username: this.config.email,
                    password: this.config.apiToken
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
            throw new Error('Failed to fetch projects from JIRA');
        }
    }
    async getProjectIssues(projectKey) {
        if (!this.config.email || !this.config.apiToken) {
            throw new Error('JIRA credentials not configured. Please set them in settings.');
        }
        try {
            const jql = `project = "${projectKey}" AND issuetype in (Bug, Story, Task) ORDER BY created DESC`;
            const response = await this._makeRequest(`/rest/api/2/search?jql=${encodeURIComponent(jql)}`);
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
    async _makeRequest(endpoint) {
        try {
            const response = await axios_1.default.get(`${this.config.baseUrl}${endpoint}`, {
                auth: {
                    username: this.config.email,
                    password: this.config.apiToken
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