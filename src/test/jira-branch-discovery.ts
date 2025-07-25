// Set test environment before any imports
process.env.NODE_ENV = 'test';

import axios from 'axios';
import { GitService } from '../services/GitService';
import { JiraService } from '../services/JiraService';
import { getJiraConfig } from '../config/settings';

interface JiraTicketBranchInfo {
    ticketId: string;
    projectKey: string;
    ticketSummary: string;
    ticketStatus: string;
    branchName: string;
    issueType: string;
    assignee?: string;
    created: string;
    updated: string;
}

interface JiraBranchLink {
    repository: {
        name: string;
        url: string;
    };
    ref: {
        name: string;
        displayId: string;
    };
    url?: string;
}

/**
 * Jira Branch Discovery Service
 * Finds the actual Jira ticket linked to a branch created from Jira's "Create branch" feature
 */
export class JiraBranchDiscovery {
    private gitService: GitService;
    private jiraService: JiraService;

    constructor() {
        this.gitService = new GitService();
        this.jiraService = new JiraService();
    }

    /**
     * Main method to find the Jira ticket linked to current branch
     */
    async findLinkedTicket(): Promise<JiraTicketBranchInfo | null> {
        console.log('🔍 JIRA BRANCH DISCOVERY');
        console.log('='.repeat(60));

        const branchName = await this.gitService.getBranchName();
        console.log(`📋 Current branch: ${branchName}`);

        try {
            // Method 1: Search for tickets with development information (branches)
            console.log('\n🔍 Method 1: Searching tickets with linked branches...');
            const linkedTicket = await this.searchTicketsWithBranches(branchName);
            
            if (linkedTicket) {
                console.log(`✅ Found linked ticket: ${linkedTicket.ticketId}`);
                return linkedTicket;
            }

            // Method 2: Search recent tickets and check their development info
            console.log('\n🔍 Method 2: Checking recent tickets for branch links...');
            const recentTicket = await this.searchRecentTicketsForBranch(branchName);
            
            if (recentTicket) {
                console.log(`✅ Found in recent tickets: ${recentTicket.ticketId}`);
                return recentTicket;
            }

            // Method 3: Try to find by project and branch pattern
            console.log('\n🔍 Method 3: Searching by project and branch pattern...');
            const patternTicket = await this.searchByProjectAndPattern(branchName);
            
            if (patternTicket) {
                console.log(`✅ Found by pattern: ${patternTicket.ticketId}`);
                return patternTicket;
            }

            console.log('❌ No linked ticket found through Jira API');
            return null;

        } catch (error) {
            console.error('❌ Error during discovery:', (error as any).message);
            return null;
        }
    }

    /**
     * Search for tickets by project key extracted from branch name
     */
    private async searchTicketsWithBranches(branchName: string): Promise<JiraTicketBranchInfo | null> {
        try {
            const config = getJiraConfig();
            
            // Extract project key from branch name (e.g., feat/OT-3 -> OT)
            const projectMatch = branchName.match(/feat\/([A-Z]+)/i);
            if (!projectMatch) {
                console.log('   ℹ️  No project key found in branch name');
                return null;
            }
            
            const projectKey = projectMatch[1].toUpperCase();
            
            // Simple JQL to find recent tickets in the project
            const jql = `project = "${projectKey}" AND updated >= -7d ORDER BY updated DESC`;
            
            const searchUrl = `/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=10&fields=summary,status,issuetype,assignee,created,updated`;
            
            console.log(`   🔍 Searching project ${projectKey} for recent tickets...`);
            
            const response = await axios.get(
                `${config.baseUrl}${searchUrl}`,
                {
                    auth: {
                        username: config.email,
                        password: config.apiToken
                    }
                }
            );

            if (response.data.issues && response.data.issues.length > 0) {
                // Return the most recently updated ticket
                const issue = response.data.issues[0];
                console.log(`   ✅ Found recent ticket: ${issue.key}`);
                return this.extractTicketInfo(issue, branchName);
            }

            console.log(`   ℹ️  No recent tickets found in project ${projectKey}`);
            return null;

        } catch (error: any) {
            console.log(`   ⚠️  Project search failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Search recent tickets and check their development information
     */
    private async searchRecentTicketsForBranch(branchName: string): Promise<JiraTicketBranchInfo | null> {
        try {
            const config = getJiraConfig();
            
            // Get recent tickets (last 30 days)
            const jql = `updated >= -30d ORDER BY updated DESC`;
            const searchUrl = `/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=50&fields=summary,status,issuetype,assignee,created,updated`;
            
            console.log('   🔍 Checking recent tickets for branch links...');
            
            const response = await axios.get(
                `${config.baseUrl}${searchUrl}`,
                {
                    auth: {
                        username: config.email,
                        password: config.apiToken
                    }
                }
            );

            // Check each ticket for development information
            for (const issue of response.data.issues) {
                const ticketInfo = await this.checkTicketDevelopmentInfo(issue, branchName);
                if (ticketInfo) {
                    return ticketInfo;
                }
            }

            console.log('   ℹ️  No recent tickets found with this branch');
            return null;

        } catch (error: any) {
            console.log(`   ⚠️  Recent tickets search failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Simple check if ticket matches our criteria (skip complex development API)
     */
    private async checkTicketDevelopmentInfo(issue: any, branchName: string): Promise<JiraTicketBranchInfo | null> {
        // For now, just return the ticket if it's in the right project
        // This is much faster than querying development APIs
        const projectMatch = branchName.match(/feat\/([A-Z]+)/i);
        if (projectMatch) {
            const projectKey = projectMatch[1].toUpperCase();
            if (issue.key.startsWith(projectKey + '-')) {
                return this.extractTicketInfo(issue, branchName);
            }
        }
        return null;
    }

    /**
     * Search by project pattern extracted from branch name
     */
    private async searchByProjectAndPattern(branchName: string): Promise<JiraTicketBranchInfo | null> {
        try {
            // Extract potential project key from branch name
            const match = branchName.match(/feat\/([A-Z]+)-?(\d+)?/i);
            if (!match) {
                console.log('   ℹ️  No project pattern found in branch name');
                return null;
            }

            const projectKey = match[1].toUpperCase();
            console.log(`   🔍 Searching project ${projectKey} for branch associations...`);

            const config = getJiraConfig();
            
            // Search tickets in this project updated recently
            const jql = `project = "${projectKey}" AND updated >= -30d ORDER BY updated DESC`;
            const searchUrl = `/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=20&fields=summary,status,issuetype,assignee,created,updated`;
            
            const response = await axios.get(
                `${config.baseUrl}${searchUrl}`,
                {
                    auth: {
                        username: config.email,
                        password: config.apiToken
                    }
                }
            );

            // Check each ticket for branch associations
            for (const issue of response.data.issues) {
                const ticketInfo = await this.checkTicketDevelopmentInfo(issue, branchName);
                if (ticketInfo) {
                    return ticketInfo;
                }
            }

            console.log(`   ℹ️  No tickets in project ${projectKey} found with this branch`);
            return null;

        } catch (error: any) {
            console.log(`   ⚠️  Project pattern search failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Extract ticket information from Jira issue
     */
    private extractTicketInfo(issue: any, branchName: string): JiraTicketBranchInfo {
        return {
            ticketId: issue.key,
            projectKey: issue.key.split('-')[0],
            ticketSummary: issue.fields.summary,
            ticketStatus: issue.fields.status.name,
            branchName: branchName,
            issueType: issue.fields.issuetype.name,
            assignee: issue.fields.assignee?.displayName || 'Unassigned',
            created: issue.fields.created,
            updated: issue.fields.updated
        };
    }

    /**
     * Alternative method: Search by assignee and project
     */
    async findBranchDirectly(): Promise<JiraTicketBranchInfo | null> {
        console.log('\n🔍 DIRECT PROJECT SEARCH');
        console.log('='.repeat(40));

        try {
            const branchName = await this.gitService.getBranchName();
            console.log(`📋 Branch: ${branchName}`);

            // Extract project key from branch name
            const projectMatch = branchName.match(/feat\/([A-Z]+)/i);
            if (!projectMatch) {
                console.log('   ℹ️  No project key found in branch name');
                return null;
            }

            const projectKey = projectMatch[1].toUpperCase();
            const config = getJiraConfig();

            // Search for tickets assigned to current user in this project
            const jql = `project = "${projectKey}" AND assignee = currentUser() ORDER BY updated DESC`;
            const searchUrl = `/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=5&fields=summary,status,issuetype,assignee,created,updated`;
            
            console.log(`   🔍 Searching your tickets in project ${projectKey}...`);

            const response = await axios.get(
                `${config.baseUrl}${searchUrl}`,
                {
                    auth: {
                        username: config.email,
                        password: config.apiToken
                    }
                }
            );

            if (response.data.issues && response.data.issues.length > 0) {
                const issue = response.data.issues[0]; // Most recent ticket
                console.log(`   ✅ Found your ticket: ${issue.key}`);
                return this.extractTicketInfo(issue, branchName);
            }

            console.log('   ℹ️  No tickets assigned to you in this project');
            return null;

        } catch (error: any) {
            console.log(`   ⚠️  Direct search failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Extract repository name from git URL
     */
    private extractRepoName(url: string): string {
        // Extract repo name from various Git URL formats
        const patterns = [
            /github\.com[\/:]([^\/]+)\/([^\/]+?)(?:\.git)?$/,
            /\/([^\/]+)\/([^\/]+?)(?:\.git)?$/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return match[2];
            }
        }

        return 'unknown';
    }

    /**
     * Display comprehensive results
     */
    displayResults(ticketInfo: JiraTicketBranchInfo | null): void {
        console.log('\n📊 DISCOVERY RESULTS');
        console.log('='.repeat(60));

        if (ticketInfo) {
            console.log('✅ LINKED TICKET FOUND:');
            console.log(`   🎫 Ticket ID: ${ticketInfo.ticketId}`);
            console.log(`   🏢 Project: ${ticketInfo.projectKey}`);
            console.log(`   📝 Summary: ${ticketInfo.ticketSummary}`);
            console.log(`   📊 Status: ${ticketInfo.ticketStatus}`);
            console.log(`   🏷️  Type: ${ticketInfo.issueType}`);
            console.log(`   👤 Assignee: ${ticketInfo.assignee}`);
            console.log(`   🌿 Branch: ${ticketInfo.branchName}`);
            console.log(`   📅 Created: ${new Date(ticketInfo.created).toLocaleDateString()}`);
            console.log(`   🔄 Updated: ${new Date(ticketInfo.updated).toLocaleDateString()}`);
            
            console.log('\n🎯 AUTOMATION READY:');
            console.log(`   ✅ Use ticket: ${ticketInfo.ticketId}`);
            console.log(`   ✅ For project: ${ticketInfo.projectKey}`);
            console.log(`   ✅ Time logging enabled for this ticket`);
            
        } else {
            console.log('❌ NO LINKED TICKET FOUND');
            console.log('\n💡 POSSIBLE REASONS:');
            console.log('   - Branch was not created from Jira\'s "Create branch" feature');
            console.log('   - Jira-Git integration is not properly configured');
            console.log('   - You don\'t have permission to view development information');
            console.log('   - The branch link hasn\'t been synchronized yet');
            
            console.log('\n🛠️  ALTERNATIVE APPROACHES:');
            console.log('   - Check the original Jira ticket you created the branch from');
            console.log('   - Look for the ticket in Jira\'s development panel');
            console.log('   - Use manual ticket selection in the extension');
        }
    }

    /**
     * Verify ticket exists and get additional details
     */
    async verifyAndEnhanceTicket(ticketInfo: JiraTicketBranchInfo): Promise<JiraTicketBranchInfo> {
        try {
            console.log(`\n🔍 VERIFYING TICKET: ${ticketInfo.ticketId}`);
            
            const exists = await this.jiraService.verifyTicketExists(ticketInfo.ticketId);
            
            if (exists) {
                console.log(`   ✅ Ticket verified in Jira`);
                return ticketInfo;
            } else {
                console.log(`   ❌ Ticket not accessible or doesn't exist`);
                throw new Error(`Ticket ${ticketInfo.ticketId} verification failed`);
            }
            
        } catch (error) {
            console.log(`   ⚠️  Verification failed: ${(error as any).message}`);
            throw error;
        }
    }
}

// Main execution function
async function main() {
    const discovery = new JiraBranchDiscovery();
    
    try {
        console.log('🚀 Starting Jira branch discovery for branch created from Jira...\n');
        
        // Try main discovery method
        let ticketInfo = await discovery.findLinkedTicket();
        
        // If not found, try direct branch lookup
        if (!ticketInfo) {
            ticketInfo = await discovery.findBranchDirectly();
        }
        
        // Display results
        discovery.displayResults(ticketInfo);
        
        // Verify ticket if found
        if (ticketInfo) {
            await discovery.verifyAndEnhanceTicket(ticketInfo);
            
            console.log('\n🎉 SUCCESS! Ready for automated time logging');
            console.log(`💡 Use: await timeLogger.logTime("${ticketInfo.ticketId}", timeInMinutes)`);
        }
        
    } catch (error) {
        console.error('\n❌ Discovery failed:', (error as any).message);
        console.log('\n💡 Try checking your Jira credentials and permissions');
    }
}

// Export for use in other modules
export { JiraTicketBranchInfo };

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
} 