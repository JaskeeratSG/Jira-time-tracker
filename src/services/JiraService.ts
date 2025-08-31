import axios from 'axios';
import { AuthenticationService, UserCredentials } from './AuthenticationService';
import { SearchService, SearchResult } from './SearchService';

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
    private authService: AuthenticationService | null = null;

    constructor(authService?: AuthenticationService) {
        this.authService = authService || null;
    }

    /**
     * Check if user is authenticated
     */
    public async isAuthenticated(): Promise<boolean> {
        if (this.authService) {
            return await this.authService.isAuthenticated();
        }
        return false;
    }

    /**
     * Get current user credentials (from auth service only)
     */
    public async getCurrentCredentials(): Promise<UserCredentials> {
        // Only get from authentication service - no fallback to hardcoded credentials
        if (this.authService) {
            const credentials = await this.authService.getActiveUserCredentials();
            if (credentials) {
                return credentials;
            }
        }
            
        // No fallback - user must be authenticated
        throw new Error('No JIRA credentials found. Please sign in to continue.');
    }

    async logTime(ticketId: string, timeSpentMinutes: number) {
        const endpoint = `/rest/api/2/issue/${ticketId}/worklog`;
        const credentials = await this.getCurrentCredentials();

        try {
            const response = await axios.post(
                `${credentials.baseUrl}${endpoint}`,
                {
                    timeSpentSeconds: timeSpentMinutes * 60,
                    comment: `Time logged via VS Code extension by ${credentials.email}`
                },
                {
                    auth: {
                        username: credentials.email,
                        password: credentials.apiToken
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
        const credentials = await this.getCurrentCredentials();
        try {
            const response = await axios.get(
                `${credentials.baseUrl}/rest/api/2/issue/${ticketId}`,
                {
                    auth: {
                        username: credentials.email,
                        password: credentials.apiToken
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
        const credentials = await this.getCurrentCredentials();
        try {
            // JQL query to get recent tickets assigned to the user
            const jql = encodeURIComponent('assignee = currentUser() ORDER BY updated DESC');
            const response = await axios.get(
                `${credentials.baseUrl}/rest/api/2/search?jql=${jql}&fields=summary&maxResults=10`,
                {
                    auth: {
                        username: credentials.email,
                        password: credentials.apiToken
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
        const credentials = await this.getCurrentCredentials();

        try {
            const response = await axios.get(
                `${credentials.baseUrl}/rest/api/2/project`,
                {
                    auth: {
                        username: credentials.email,
                        password: credentials.apiToken
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

    async getProjectIssues(projectKey: string, maxResults: number = 50): Promise<Array<{ key: string; summary: string; }>> {
        const credentials = await this.getCurrentCredentials();

        try {
            const jql = `project = "${projectKey}" AND issuetype in (Bug, Story, Task, Sub-task, Epic, Improvement, New Feature, Technical task, Research, Documentation, Design, Testing) ORDER BY created DESC`;
            const response = await this._makeRequest(`/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=summary,issuetype,parent`, credentials);
            
            return response.issues.map((issue: any) => {
                let summary = issue.fields.summary;
                // Add parent information for subtasks
                if (issue.fields.issuetype && issue.fields.issuetype.name === 'Sub-task' && issue.fields.parent) {
                    summary = `${summary} (Parent: ${issue.fields.parent.key})`;
                }
                return {
                key: issue.key,
                    summary: summary
                };
            });
        } catch (error: any) {
            console.error('Failed to fetch project issues:', error);
            throw new Error(`Failed to fetch issues for project ${projectKey}`);
        }
    }

    async getAllProjectIssues(projectKey: string): Promise<Array<{ key: string; summary: string; }>> {
        const credentials = await this.getCurrentCredentials();
        const allIssues: Array<{ key: string; summary: string; }> = [];
        let startAt = 0;
        const maxResults = 100; // Jira's maximum per request
        let hasMore = true;

        try {
            while (hasMore) {
                const jql = `project = "${projectKey}" AND issuetype in (Bug, Story, Task, Sub-task, Epic, Improvement, New Feature, Technical task, Research, Documentation, Design, Testing) ORDER BY created DESC`;
                const response = await this._makeRequest(
                    `/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&startAt=${startAt}&fields=summary,issuetype,parent`, 
                    credentials
                );
                
                const issues = response.issues.map((issue: any) => {
                    let summary = issue.fields.summary;
                    // Add parent information for subtasks
                    if (issue.fields.issuetype && issue.fields.issuetype.name === 'Sub-task' && issue.fields.parent) {
                        summary = `${summary} (Parent: ${issue.fields.parent.key})`;
                    }
                    return {
                        key: issue.key,
                        summary: summary
                    };
                });
                
                allIssues.push(...issues);
                
                // Check if there are more issues to fetch
                hasMore = response.issues.length === maxResults;
                startAt += maxResults;
            }
            
            return allIssues;
        } catch (error: any) {
            console.error('Failed to fetch all project issues:', error);
            throw new Error(`Failed to fetch all issues for project ${projectKey}`);
        }
    }

    async searchIssues(projectKey: string, searchTerm: string): Promise<Array<{ key: string; summary: string; }>> {
        const credentials = await this.getCurrentCredentials();
        const maxResults = 100; // Increased for better search coverage

        try {
            // If search term is empty, return recent issues
            if (!searchTerm || searchTerm.trim() === '') {
                const jql = `project = "${projectKey}" ORDER BY updated DESC`;
                const response = await this._makeRequest(
                    `/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=summary,issuetype,parent`, 
                    credentials
                );
                
                const issues = response.issues.map((issue: any) => {
                    let summary = issue.fields.summary;
                    // Add parent information for subtasks
                    if (issue.fields.issuetype && issue.fields.issuetype.name === 'Sub-task' && issue.fields.parent) {
                        summary = `${summary} (Parent: ${issue.fields.parent.key})`;
                    }
                    return {
                        key: issue.key,
                        summary: summary
                    };
                });
                
                console.log(`Recent issues: ${issues.length} issues found for project ${projectKey}`);
                return issues;
            }

            // For search terms, use a broader JQL query to get more candidates
            const jql = `project = "${projectKey}" ORDER BY updated DESC`;
            const response = await this._makeRequest(
                `/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=summary,issuetype,parent`, 
                credentials
            );
            
            const allIssues = response.issues.map((issue: any) => {
                let summary = issue.fields.summary;
                // Add parent information for subtasks
                if (issue.fields.issuetype && issue.fields.issuetype.name === 'Sub-task' && issue.fields.parent) {
                    summary = `${summary} (Parent: ${issue.fields.parent.key})`;
                }
                return {
                    key: issue.key,
                    summary: summary
                };
            });

            // Use SearchService for client-side filtering
            const searchService = new SearchService();
            const searchResults = searchService.searchIssues(allIssues, searchTerm);
            
            // Convert SearchResult back to simple format
            const filteredIssues = searchResults.map((result: SearchResult) => ({
                key: result.key,
                summary: result.summary
            }));
            
            console.log(`Search results: ${filteredIssues.length} issues found for term "${searchTerm}" in project ${projectKey}`);
            return filteredIssues;
        } catch (error: any) {
            console.error('Failed to search issues:', error);
            throw new Error(`Failed to search issues for project ${projectKey}`);
        }
    }

    async getAllProjectIssuesUnfiltered(projectKey: string): Promise<Array<{ key: string; summary: string; }>> {
        const credentials = await this.getCurrentCredentials();
        const allIssues: Array<{ key: string; summary: string; }> = [];
        let startAt = 0;
        const maxResults = 100; // Jira's maximum per request
        let hasMore = true;

        try {
            while (hasMore) {
                // No issuetype filter - get ALL issue types
                const jql = `project = "${projectKey}" ORDER BY created DESC`;
                const response = await this._makeRequest(
                    `/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&startAt=${startAt}&fields=summary,issuetype,parent`, 
                    credentials
                );
                
                const issues = response.issues.map((issue: any) => {
                    let summary = issue.fields.summary;
                    // Add parent information for subtasks
                    if (issue.fields.issuetype && issue.fields.issuetype.name === 'Sub-task' && issue.fields.parent) {
                        summary = `${summary} (Parent: ${issue.fields.parent.key})`;
                    }
                    return {
                        key: issue.key,
                        summary: summary
                    };
                });
                
                allIssues.push(...issues);
                
                // Check if there are more issues to fetch
                hasMore = response.issues.length === maxResults;
                startAt += maxResults;
            }
            
            return allIssues;
        } catch (error: any) {
            console.error('Failed to fetch all project issues (unfiltered):', error);
            throw new Error(`Failed to fetch all issues for project ${projectKey}`);
        }
    }

    async getProjectIssuesPaginated(projectKey: string, page: number = 1, pageSize: number = 5): Promise<{
        issues: Array<{ key: string; summary: string; }>;
        total: number;
        page: number;
        pageSize: number;
        hasMore: boolean;
    }> {
        const credentials = await this.getCurrentCredentials();
        const startAt = (page - 1) * pageSize;

        try {
            // First get total count
            const countJql = `project = "${projectKey}" ORDER BY created DESC`;
            const countResponse = await this._makeRequest(
                `/rest/api/2/search?jql=${encodeURIComponent(countJql)}&maxResults=1&fields=key`, 
                credentials
            );
            const total = countResponse.total;

            // Then get paginated results
            const jql = `project = "${projectKey}" ORDER BY created DESC`;
            const response = await this._makeRequest(
                `/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${pageSize}&startAt=${startAt}&fields=summary,issuetype,parent`, 
                credentials
            );
            
            const issues = response.issues.map((issue: any) => {
                let summary = issue.fields.summary;
                // Add parent information for subtasks
                if (issue.fields.issuetype && issue.fields.issuetype.name === 'Sub-task' && issue.fields.parent) {
                    summary = `${summary} (Parent: ${issue.fields.parent.key})`;
                }
                return {
                    key: issue.key,
                    summary: summary
                };
            });

            const hasMore = startAt + pageSize < total;

            return {
                issues,
                total,
                page,
                pageSize,
                hasMore
            };
        } catch (error: any) {
            console.error('Failed to fetch paginated project issues:', error);
            throw new Error(`Failed to fetch paginated issues for project ${projectKey}`);
        }
    }

    async getProjectIssuesUnfilteredPaginated(projectKey: string, page: number = 1, pageSize: number = 5): Promise<{
        issues: Array<{ key: string; summary: string; }>;
        total: number;
        page: number;
        pageSize: number;
        hasMore: boolean;
    }> {
        const credentials = await this.getCurrentCredentials();
        const startAt = (page - 1) * pageSize;

        try {
            // First get total count
            const countJql = `project = "${projectKey}" ORDER BY created DESC`;
            const countResponse = await this._makeRequest(
                `/rest/api/2/search?jql=${encodeURIComponent(countJql)}&maxResults=1&fields=key`, 
                credentials
            );
            const total = countResponse.total;

            // Then get paginated results
            const jql = `project = "${projectKey}" ORDER BY created DESC`;
            const response = await this._makeRequest(
                `/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${pageSize}&startAt=${startAt}&fields=summary,issuetype,parent`, 
                credentials
            );
            
            const issues = response.issues.map((issue: any) => {
                let summary = issue.fields.summary;
                // Add parent information for subtasks
                if (issue.fields.issuetype && issue.fields.issuetype.name === 'Sub-task' && issue.fields.parent) {
                    summary = `${summary} (Parent: ${issue.fields.parent.key})`;
                }
                return {
                    key: issue.key,
                    summary: summary
                };
            });

            const hasMore = startAt + pageSize < total;

            return {
                issues,
                total,
                page,
                pageSize,
                hasMore
            };
        } catch (error: any) {
            console.error('Failed to fetch paginated project issues (unfiltered):', error);
            throw new Error(`Failed to fetch paginated issues for project ${projectKey}`);
        }
    }

    async getProjectsByUserEmail(email: string): Promise<JiraProject[]> {
        const credentials = await this.getCurrentCredentials();

        try {
            // First get all projects
            const allProjects = await this.getProjects();
            
            // Then filter projects where the user has issues assigned
            const jql = `assignee = "${email}" ORDER BY updated DESC`;
            const response = await this._makeRequest(`/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=project`, credentials);
            
            // Get unique project keys from the issues
            const projectKeys = new Set(response.issues.map((issue: any) => issue.fields.project.key));
            
            // Filter the original projects list to only include projects where the user has issues
            const filteredProjects = allProjects.filter(project => projectKeys.has(project.key));
            
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

    private async _makeRequest(endpoint: string, credentials?: UserCredentials) {
        const creds = credentials || await this.getCurrentCredentials();
        try {
            const response = await axios.get(
                `${creds.baseUrl}${endpoint}`,
                {
                    auth: {
                        username: creds.email,
                        password: creds.apiToken
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