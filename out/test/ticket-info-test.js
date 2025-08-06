"use strict";
// Test file for Ticket Info functionality
// This demonstrates how the ticket info component works
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTicketInfoTests = exports.TicketInfoTest = void 0;
const vscode = require("vscode");
class TicketInfoTest {
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Ticket Info Test');
    }
    async testTicketInfoDisplay() {
        this.outputChannel.appendLine('🧪 Testing Ticket Info Display...');
        // Simulate ticket info data
        const mockTicketInfo = {
            ticketId: 'PROJ-123',
            projectKey: 'PROJ',
            summary: 'Implement new feature for user authentication',
            status: 'In Progress',
            description: 'This ticket involves implementing a new authentication system that supports OAuth 2.0 and JWT tokens. The implementation should include:\n\n- User registration and login\n- Password reset functionality\n- Session management\n- Security best practices'
        };
        this.outputChannel.appendLine(`📋 Mock Ticket Info:`);
        this.outputChannel.appendLine(`   Ticket ID: ${mockTicketInfo.ticketId}`);
        this.outputChannel.appendLine(`   Project: ${mockTicketInfo.projectKey}`);
        this.outputChannel.appendLine(`   Summary: ${mockTicketInfo.summary}`);
        this.outputChannel.appendLine(`   Status: ${mockTicketInfo.status}`);
        this.outputChannel.appendLine(`   Description: ${mockTicketInfo.description.substring(0, 100)}...`);
        // Simulate sending to webview
        this.outputChannel.appendLine('📤 Sending ticket info to webview...');
        // In a real scenario, this would be sent to the webview
        // this._view?.webview.postMessage({
        //     type: 'ticket-info',
        //     ...mockTicketInfo
        // });
        this.outputChannel.appendLine('✅ Ticket info test completed');
        this.outputChannel.show();
    }
    async testBranchChangeDetection() {
        this.outputChannel.appendLine('🌿 Testing Branch Change Detection...');
        // Simulate branch change
        const oldBranch = 'main';
        const newBranch = 'feature/PROJ-123-user-auth';
        this.outputChannel.appendLine(`Branch changed: ${oldBranch} → ${newBranch}`);
        // Extract ticket key from branch name
        const ticketKey = this.extractTicketKey(newBranch);
        if (ticketKey) {
            this.outputChannel.appendLine(`🎯 Extracted ticket key: ${ticketKey}`);
            this.outputChannel.appendLine('📋 Would fetch ticket details from Jira...');
        }
        else {
            this.outputChannel.appendLine('❌ No ticket key found in branch name');
        }
        this.outputChannel.appendLine('✅ Branch change test completed');
    }
    extractTicketKey(branchName) {
        // Common patterns for Jira ticket keys in branch names
        const patterns = [
            /([A-Z]+-\d+)/,
            /(?:feature|bugfix|hotfix|release)\/([A-Z]+-\d+)/i,
            /(?:branch|b)\/([A-Z]+-\d+)/i,
            /(?:feat|fix|chore)\/([A-Z]+-\d+)/i,
            /(?:task|story|bug)\/([A-Z]+-\d+)/i // task/PROJECT-123
        ];
        for (const pattern of patterns) {
            const match = branchName.match(pattern);
            if (match) {
                return match[1]; // Return the captured ticket key
            }
        }
        return null;
    }
}
exports.TicketInfoTest = TicketInfoTest;
// Export for use in other test files
function runTicketInfoTests() {
    const test = new TicketInfoTest();
    test.testTicketInfoDisplay();
    test.testBranchChangeDetection();
}
exports.runTicketInfoTests = runTicketInfoTests;
//# sourceMappingURL=ticket-info-test.js.map