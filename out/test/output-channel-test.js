"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testErrorLogging = exports.testOutputChannel = void 0;
const vscode = require("vscode");
const outputChannel_1 = require("../utils/outputChannel");
/**
 * Test the output channel functionality for Productive time logging
 */
async function testOutputChannel() {
    const outputChannel = (0, outputChannel_1.createOutputChannel)('Productive Time Logging Test');
    outputChannel.appendLine('🧪 Testing Output Channel for Productive Time Logging');
    outputChannel.appendLine('═'.repeat(60));
    // Test basic logging
    outputChannel.appendLine('📊 Step 1: Basic logging test');
    outputChannel.appendLine('✅ Output channel is working');
    // Test Productive-like logging
    outputChannel.appendLine('\n📊 Step 2: Productive time logging simulation');
    outputChannel.appendLine('🚀 Starting Productive time entry creation...');
    outputChannel.appendLine('📋 Parameters:');
    outputChannel.appendLine('   📁 Project ID: 667206');
    outputChannel.appendLine('   🛠️  Service ID: 9231369');
    outputChannel.appendLine('   ⏰ Time: 30 minutes');
    outputChannel.appendLine('   📅 Date: Today');
    outputChannel.appendLine('   📝 Description: Test time entry');
    outputChannel.appendLine('   🎯 Jira Ticket: TEST-123');
    outputChannel.appendLine('\n✅ Productive credentials retrieved');
    outputChannel.appendLine('✅ Authenticated user: John Doe (john@example.com)');
    outputChannel.appendLine('📅 Using entry date: 2024-01-15');
    outputChannel.appendLine('\n📤 Sending time entry to Productive API...');
    outputChannel.appendLine('✅ Time logged successfully to Productive:');
    outputChannel.appendLine('   👤 User: John Doe (john@example.com)');
    outputChannel.appendLine('   📁 Project ID: 667206');
    outputChannel.appendLine('   🛠️  Service ID: 9231369');
    outputChannel.appendLine('   ⏰ Time: 30 minutes');
    outputChannel.appendLine('   📝 Entry ID: 12345');
    outputChannel.appendLine('   📅 Date: 2024-01-15');
    outputChannel.appendLine('   🎯 Jira Ticket: TEST-123');
    outputChannel.appendLine('\n🎉 Output channel test completed successfully!');
    outputChannel.appendLine('You can now use this output channel to monitor Productive time logging.');
    // Show the output channel
    outputChannel.show(true);
    vscode.window.showInformationMessage('Output channel test completed! Check the output panel.');
}
exports.testOutputChannel = testOutputChannel;
/**
 * Test error logging
 */
async function testErrorLogging() {
    const outputChannel = (0, outputChannel_1.createOutputChannel)('Productive Error Logging Test');
    outputChannel.appendLine('🧪 Testing Error Logging for Productive Time Logging');
    outputChannel.appendLine('═'.repeat(60));
    outputChannel.appendLine('📊 Simulating Productive API error...');
    outputChannel.appendLine('❌ Failed to log time to Productive: Invalid project ID');
    outputChannel.appendLine('📋 API Status: 400');
    outputChannel.appendLine('📋 API Response: {');
    outputChannel.appendLine('  "errors": [');
    outputChannel.appendLine('    {');
    outputChannel.appendLine('      "title": "Invalid project",');
    outputChannel.appendLine('      "detail": "Project with ID 999999 not found"');
    outputChannel.appendLine('    }');
    outputChannel.appendLine('  ]');
    outputChannel.appendLine('}');
    outputChannel.appendLine('\n🎉 Error logging test completed!');
    outputChannel.appendLine('This shows how errors will be displayed in the output channel.');
    // Show the output channel
    outputChannel.show(true);
    vscode.window.showInformationMessage('Error logging test completed! Check the output panel.');
}
exports.testErrorLogging = testErrorLogging;
//# sourceMappingURL=output-channel-test.js.map