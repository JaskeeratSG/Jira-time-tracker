"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraBranchIntegration = void 0;
const jira_branch_discovery_1 = require("../test/jira-branch-discovery");
const JiraService_1 = require("./JiraService");
/**
 * Enhanced Jira Branch Integration
 * Integrates Jira branch discovery with the existing time logger
 */
class JiraBranchIntegration {
    constructor() {
        // Note: GitService now requires JiraService and outputChannel
        // This class is deprecated in favor of BranchChangeService
        this.jiraService = new JiraService_1.JiraService();
        this.branchDiscovery = new jira_branch_discovery_1.JiraBranchDiscovery();
    }
    /**
     * Enhanced method to get branch ticket info
     * First tries Jira's branch linking, then falls back to branch name parsing
     */
    async getEnhancedBranchTicketInfo() {
        try {
            console.log('🔍 Enhanced branch ticket discovery...');
            // Method 1: Try Jira branch discovery (for branches created from Jira)
            const jiraLinkedTicket = await this.branchDiscovery.findLinkedTicket();
            if (jiraLinkedTicket) {
                console.log(`✅ Found Jira-linked ticket: ${jiraLinkedTicket.ticketId}`);
                return {
                    projectKey: jiraLinkedTicket.projectKey,
                    issueKey: jiraLinkedTicket.ticketId
                };
            }
            // Method 2: Fallback to branch name extraction
            console.log('🔍 Falling back to branch name extraction...');
            // Note: GitService methods are deprecated in favor of BranchChangeService
            console.log('❌ GitService methods deprecated - use BranchChangeService instead');
            return null;
            // Note: This section is deprecated since GitService methods are not available
            console.log('❌ GitService methods deprecated - use BranchChangeService instead');
            return null;
        }
        catch (error) {
            console.error('❌ Error in enhanced branch ticket discovery:', error);
            return null;
        }
    }
    /**
     * Get detailed ticket information
     */
    async getDetailedTicketInfo() {
        try {
            // Try Jira branch discovery first
            let ticketInfo = await this.branchDiscovery.findLinkedTicket();
            // If not found, try direct branch lookup
            if (!ticketInfo) {
                ticketInfo = await this.branchDiscovery.findBranchDirectly();
            }
            return ticketInfo;
        }
        catch (error) {
            console.error('Error getting detailed ticket info:', error);
            return null;
        }
    }
    /**
     * Quick method to get just the ticket ID for automation
     */
    async getTicketForAutomation() {
        const ticketInfo = await this.getEnhancedBranchTicketInfo();
        return ticketInfo?.issueKey || null;
    }
    /**
     * Display discovery results in a simple format
     */
    async displaySimpleResults() {
        const ticketInfo = await this.getDetailedTicketInfo();
        if (ticketInfo) {
            console.log('🎯 TICKET FOUND FOR AUTOMATION:');
            console.log(`   Ticket: ${ticketInfo.ticketId}`);
            console.log(`   Project: ${ticketInfo.projectKey}`);
            console.log(`   Summary: ${ticketInfo.ticketSummary}`);
            console.log(`   Status: ${ticketInfo.ticketStatus}`);
        }
        else {
            console.log('❌ No ticket found for current branch');
        }
    }
}
exports.JiraBranchIntegration = JiraBranchIntegration;
//# sourceMappingURL=JiraBranchIntegration.js.map