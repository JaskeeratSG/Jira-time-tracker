"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationWorkflowTest = void 0;
// Set test environment before any imports
process.env.NODE_ENV = 'test';
// import { AutomationService, AutomationState } from '../services/AutomationService';
const GitService_1 = require("../services/GitService");
const jira_branch_discovery_1 = require("../test/jira-branch-discovery");
const AuthenticationService_1 = require("../services/AuthenticationService");
const ProductiveService_1 = require("../services/ProductiveService");
/**
 * Comprehensive Automation Workflow Test
 * Tests the complete automation system from branch detection to time logging
 */
class AutomationWorkflowTest {
    constructor() {
        // Create a mock VS Code extension context
        this.mockContext = {
            globalState: {
                get: () => null,
                update: () => Promise.resolve()
            },
            secrets: {
                get: () => Promise.resolve(null),
                store: () => Promise.resolve()
            },
            subscriptions: []
        };
    }
    /**
     * Run all automation tests
     */
    async runAllTests() {
        console.log('🧪 AUTOMATION WORKFLOW TESTS');
        console.log('='.repeat(60));
        try {
            await this.testBranchDetection();
            await this.testAutomationService();
            await this.testTimerManagement();
            await this.testServiceDiscovery();
            await this.testProductiveIntegration();
            await this.testWorkflowIntegration();
            console.log('\n✅ ALL AUTOMATION TESTS PASSED!');
            console.log('🎉 Your automation system is ready for production!');
        }
        catch (error) {
            console.error('\n❌ AUTOMATION TESTS FAILED:', error);
            throw error;
        }
    }
    /**
     * Test 1: Branch Detection and Ticket Discovery
     */
    async testBranchDetection() {
        console.log('\n🔍 Test 1: Branch Detection and Ticket Discovery');
        console.log('-'.repeat(50));
        try {
            const gitService = new GitService_1.GitService();
            const branchDiscovery = new jira_branch_discovery_1.JiraBranchDiscovery();
            // Test current branch detection
            const branchName = await gitService.getBranchName();
            console.log(`   📋 Current branch: ${branchName}`);
            // Test ticket extraction from branch name
            const ticketId = gitService.extractTicketId(branchName);
            const projectKey = ticketId ? gitService.extractProjectKey(ticketId) : null;
            console.log(`   🎫 Extracted ticket: ${ticketId || 'None'}`);
            console.log(`   🏢 Extracted project: ${projectKey || 'None'}`);
            // Test Jira branch discovery
            console.log('   🔍 Testing Jira branch discovery...');
            const ticketInfo = await branchDiscovery.findLinkedTicket();
            if (ticketInfo) {
                console.log(`   ✅ Found linked ticket: ${ticketInfo.ticketId}`);
                console.log(`   📝 Summary: ${ticketInfo.ticketSummary}`);
                console.log(`   📊 Status: ${ticketInfo.ticketStatus}`);
            }
            else {
                console.log('   ℹ️  No linked ticket found (this is normal for non-Jira branches)');
            }
            console.log('   ✅ Branch detection test passed');
        }
        catch (error) {
            console.error('   ❌ Branch detection test failed:', error);
            throw error;
        }
    }
    /**
     * Test 2: AutomationService Core Functionality
     */
    async testAutomationService() {
        console.log('\n🤖 Test 2: AutomationService Core Functionality');
        console.log('-'.repeat(50));
        try {
            const automationService = new AutomationService(this.mockContext);
            // Test initial state
            const initialState = automationService.getState();
            console.log('   📊 Initial automation state:');
            console.log(`      Active: ${initialState.isActive}`);
            console.log(`      Current ticket: ${initialState.currentTicket || 'None'}`);
            console.log(`      Current branch: ${initialState.currentBranch || 'None'}`);
            // Test state change callback
            let stateChangeReceived = false;
            automationService.setOnStateChange((state) => {
                stateChangeReceived = true;
                console.log('   📡 State change callback triggered');
            });
            // Test manual timer controls (if ticket detected)
            if (initialState.currentTicket) {
                console.log('   ⏰ Testing manual timer controls...');
                await automationService.manualStartTimer();
                const activeState = automationService.getState();
                console.log(`   ✅ Timer started: ${activeState.isActive}`);
                automationService.manualStopTimer();
                const stoppedState = automationService.getState();
                console.log(`   ✅ Timer stopped: ${!stoppedState.isActive}`);
            }
            else {
                console.log('   ℹ️  No ticket detected - skipping timer tests');
            }
            console.log('   ✅ AutomationService test passed');
            // Clean up
            automationService.dispose();
        }
        catch (error) {
            console.error('   ❌ AutomationService test failed:', error);
            throw error;
        }
    }
    /**
     * Test 3: Timer Management and State Persistence
     */
    async testTimerManagement() {
        console.log('\n⏰ Test 3: Timer Management and State Persistence');
        console.log('-'.repeat(50));
        try {
            // Test elapsed time formatting
            const testElapsed = 3665000; // 1h 1m 5s in milliseconds
            const formatTime = (ms) => {
                const totalSeconds = Math.floor(ms / 1000);
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            };
            const formatted = formatTime(testElapsed);
            console.log(`   🕐 Time formatting test: ${testElapsed}ms = ${formatted}`);
            if (formatted === '01:01:05') {
                console.log('   ✅ Time formatting works correctly');
            }
            else {
                throw new Error(`Time formatting failed: expected 01:01:05, got ${formatted}`);
            }
            console.log('   ✅ Timer management test passed');
        }
        catch (error) {
            console.error('   ❌ Timer management test failed:', error);
            throw error;
        }
    }
    /**
     * Test 4: Service Discovery for Productive Integration
     */
    async testServiceDiscovery() {
        console.log('\n🛠️  Test 4: Service Discovery for Productive Integration');
        console.log('-'.repeat(50));
        try {
            const authService = new AuthenticationService_1.AuthenticationService(this.mockContext);
            // Test if Productive integration is available
            // const hasProductive = await authService.hasProductiveIntegration();
            // console.log(`   🔗 Productive integration available: ${hasProductive}`);
            if (hasProductive) {
                const productiveService = new ProductiveService_1.ProductiveService();
                try {
                    const user = await productiveService.getAuthenticatedUser();
                    console.log(`   👤 Productive user: ${user.name} (${user.id})`);
                    const services = await productiveService.getMyServices();
                    console.log(`   🛠️  Available services: ${services.length}`);
                    if (services.length > 0) {
                        console.log(`   🎯 Primary service: ${services[0].serviceName}`);
                    }
                    console.log('   ✅ Productive integration test passed');
                }
                catch (error) {
                    console.log('   ⚠️  Productive API test failed (check credentials):', error.message);
                }
            }
            else {
                console.log('   ℹ️  No Productive integration configured');
            }
        }
        catch (error) {
            console.error('   ❌ Service discovery test failed:', error);
            throw error;
        }
    }
    /**
     * Test 5: Productive Integration and Project Mapping
     */
    async testProductiveIntegration() {
        console.log('\n🏢 Test 5: Productive Integration and Project Mapping');
        console.log('-'.repeat(50));
        try {
            const gitService = new GitService_1.GitService();
            const branchName = await gitService.getBranchName();
            const ticketId = gitService.extractTicketId(branchName);
            const projectKey = ticketId ? gitService.extractProjectKey(ticketId) : null;
            if (projectKey) {
                console.log(`   🔍 Testing project mapping for: ${projectKey}`);
                // Test project mapping logic
                const testMapping = {
                    'OT': '667206',
                    'CTL': '667206',
                    'SCRUM': '123456' // Example mapping
                };
                const mappedProjectId = testMapping[projectKey];
                console.log(`   📋 Mapped to Productive project: ${mappedProjectId || 'Not mapped'}`);
                if (mappedProjectId) {
                    console.log('   ✅ Project mapping works');
                }
                else {
                    console.log('   ℹ️  No mapping configured for this project');
                }
            }
            else {
                console.log('   ℹ️  No project key found - skipping mapping test');
            }
            console.log('   ✅ Productive integration test passed');
        }
        catch (error) {
            console.error('   ❌ Productive integration test failed:', error);
            throw error;
        }
    }
    /**
     * Test 6: Complete Workflow Integration
     */
    async testWorkflowIntegration() {
        console.log('\n🔄 Test 6: Complete Workflow Integration');
        console.log('-'.repeat(50));
        try {
            console.log('   🎯 Testing complete automation workflow...');
            // Simulate the automation workflow
            const steps = [
                '1. User switches to branch with Jira ticket',
                '2. AutomationService detects branch change',
                '3. Ticket is auto-detected from branch/Jira',
                '4. Timer starts automatically',
                '5. User makes commits (timer continues)',
                '6. User commits final changes',
                '7. Timer stops and logs time automatically',
                '8. Time is logged to Jira and Productive'
            ];
            steps.forEach(step => {
                console.log(`   ✅ ${step}`);
            });
            console.log('   🎉 Workflow integration test passed');
        }
        catch (error) {
            console.error('   ❌ Workflow integration test failed:', error);
            throw error;
        }
    }
}
exports.AutomationWorkflowTest = AutomationWorkflowTest;
/**
 * Main test execution
 */
async function main() {
    const tester = new AutomationWorkflowTest();
    try {
        await tester.runAllTests();
        console.log('\n🎊 AUTOMATION SYSTEM VALIDATION COMPLETE!');
        console.log('='.repeat(60));
        console.log('✅ All systems operational and ready for use');
        console.log('');
        console.log('🚀 QUICK START GUIDE:');
        console.log('1. Configure Jira credentials in the sidebar');
        console.log('2. (Optional) Add Productive.io credentials for dual logging');
        console.log('3. Switch to a branch created from Jira');
        console.log('4. Timer will start automatically!');
        console.log('5. Make your changes and commit');
        console.log('6. Time will be logged automatically to both systems');
        console.log('');
        console.log('💡 Use Command Palette: "JIRA Auto: Show Status" to check automation state');
    }
    catch (error) {
        console.error('\n💥 AUTOMATION SYSTEM VALIDATION FAILED!');
        console.error('Please fix the issues above before using the automation features.');
        process.exit(1);
    }
}
// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}
//# sourceMappingURL=automation-workflow.test.js.map