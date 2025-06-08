import axios from 'axios';
import { getJiraConfig } from '../config/settings';

interface JiraProject {
    id: string;
    key: string;
    name: string;
}

interface JiraIssue {
    key: string;
    fields: {
        summary: string;
        project: {
            key: string;
            name: string;
        };
    };
}

export class JiraService {
    private config = getJiraConfig();

    async logTime(ticketId: string, timeSpentMinutes: number) {
        const endpoint = `/rest/api/2/issue/${ticketId}/worklog`;
        
        if (!this.config.email || !this.config.apiToken) {
            throw new Error('JIRA credentials not configured. Please set them in settings.');
        }

        try {
            const response = await axios.post(
                `${this.config.baseUrl}${endpoint}`,
                {
                    timeSpentSeconds: timeSpentMinutes * 60,
                    comment: 'Time logged via VS Code extension'
                },
                {
                    auth: {
                        username: this.config.email,
                        password: this.config.apiToken
                    },
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error:any) {
            throw new Error(`Failed to log time: ${error.message}`);
        }
    }

    async verifyTicketExists(ticketId: string): Promise<boolean> {
        try {
            const response = await axios.get(
                `${this.config.baseUrl}/rest/api/2/issue/${ticketId}`,
                {
                    auth: {
                        username: (this.config.email as string),
                        password: (this.config.apiToken as string)
                    }
                }
            );
            return response.status === 200;
        } catch (error:any) {
            // If issue is not found, Jira returns 404
            if (error.response && error.response.status === 404) {
                return false;
            }
            throw error;
        }
    }

    async getRecentTickets(): Promise<Array<{ key: string; summary: string; }>> {
        try {
            // JQL query to get recent tickets assigned to the user
            const jql = encodeURIComponent('assignee = currentUser() ORDER BY updated DESC');
            const response = await axios.get(
                `${this.config.baseUrl}/rest/api/2/search?jql=${jql}&fields=summary&maxResults=10`,
                {
                    auth: {
                        username: (this.config.email as string),
                        password: (this.config.apiToken as string)
                    }
                }
            );

            return response.data.issues.map((issue: any) => ({
                key: issue.key,
                summary: issue.fields.summary
            }));
        } catch (error) {
            console.error('Failed to fetch recent tickets:', error);
            throw new Error('Failed to fetch recent tickets from JIRA');
        }
    }

    async getProjects(): Promise<JiraProject[]> {
        if (!this.config.email || !this.config.apiToken) {
            throw new Error('JIRA credentials not configured. Please set them in settings.');
        }

        try {
            const response = await axios.get(
                `${this.config.baseUrl}/rest/api/2/project`,
                {
                    auth: {
                        username: this.config.email as string,
                        password: this.config.apiToken as string
                    }
                }
            );
            return response.data.map((project: any) => ({
                id: project.id,
                key: project.key,
                name: project.name
            }));
        } catch (error: any) {
            console.error('Failed to fetch projects:', error);
            if (error.response) {
                console.error('JIRA API Response:', error.response.data);
                throw new Error(`Failed to fetch projects: ${error.response.data.message || error.message}`);
            }
            throw new Error('Failed to fetch projects from JIRA');
        }
    }

    async getProjectIssues(projectKey: string): Promise<Array<{ key: string; summary: string; }>> {
        if (!this.config.email || !this.config.apiToken) {
            throw new Error('JIRA credentials not configured. Please set them in settings.');
        }

        try {
            const jql = `project = "${projectKey}" AND issuetype in (Bug, Story, Task) ORDER BY created DESC`;
            const response = await this._makeRequest(`/rest/api/2/search?jql=${encodeURIComponent(jql)}`);
            return response.issues.map((issue: any) => ({
                key: issue.key,
                summary: issue.fields.summary
            }));
        } catch (error: any) {
            console.error('Failed to fetch project issues:', error);
            throw new Error(`Failed to fetch issues for project ${projectKey}`);
        }
    }

    async getProjectsByUserEmail(email: string): Promise<JiraProject[]> {
        if (!this.config.email || !this.config.apiToken) {
            throw new Error('JIRA credentials not configured. Please set them in settings.');
        }

        try {
            // First get all projects
            const allProjects = await this.getProjects();
            console.log('All projects loaded:', allProjects);
            
            // Then filter projects where the user has issues assigned
            const jql = `assignee = "${email}" ORDER BY updated DESC`;
            const response = await this._makeRequest(`/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=project`);
            console.log('User issues response:', response);
            
            // Get unique project keys from the issues
            const projectKeys = new Set(response.issues.map((issue: any) => issue.fields.project.key));
            console.log('Project keys found:', Array.from(projectKeys));
            
            // Filter the original projects list to only include projects where the user has issues
            const filteredProjects = allProjects.filter(project => projectKeys.has(project.key));
            console.log('Filtered projects:', filteredProjects);
            
            return filteredProjects;
        } catch (error: any) {
            console.error('Failed to fetch projects for user:', error);
            if (error.response) {
                console.error('JIRA API Response:', error.response.data);
                throw new Error(`Failed to fetch projects: ${error.response.data.message || error.message}`);
            }
            throw new Error('Failed to fetch projects for user from JIRA');
        }
    }

    private async _makeRequest(endpoint: string) {
        try {
            const response = await axios.get(
                `${this.config.baseUrl}${endpoint}`,
                {
                    auth: {
                        username: this.config.email as string,
                        password: this.config.apiToken as string
                    }
                }
            );
            return response.data;
        } catch (error: any) {
            console.error('Failed to make request:', error);
            throw new Error('Failed to make request to JIRA');
        }
    }
} 