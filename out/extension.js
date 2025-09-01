"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const JiraTimeLogger_1 = require("./JiraTimeLogger");
const AuthenticationService_1 = require("./services/AuthenticationService");
const TimeTrackerSidebarProvider_1 = require("./ui/TimeTrackerSidebarProvider");
const BranchChangeService_1 = require("./services/BranchChangeService");
// import { GitService, CommitEvent } from './services/GitService';
const outputChannel_1 = require("./utils/outputChannel");
let outputChannel;
// POC: Environment Detection
// async function runEnvironmentPOC() {
//     outputChannel.appendLine('🔍 ENVIRONMENT DETECTION POC');
//     outputChannel.appendLine('═'.repeat(60));
//     const capabilities = {
//         // VS Code API
//         hasVSCodeAPI: typeof vscode !== 'undefined',
//         hasWorkspaceAPI: typeof vscode.workspace !== 'undefined',
//         hasWindowAPI: typeof vscode.window !== 'undefined',
//         // Workspace
//         hasWorkspaceFolders: !!vscode.workspace.workspaceFolders,
//         workspaceFolderCount: vscode.workspace.workspaceFolders?.length || 0,
//         // Extensions
//         hasExtensionsAPI: typeof vscode.extensions !== 'undefined',
//         hasGitExtension: !!vscode.extensions.getExtension('vscode.git'),
//         // File System
//         hasFileSystemAPI: typeof vscode.workspace.createFileSystemWatcher === 'function',
//         hasFileSystemAPI2: typeof vscode.workspace.fs !== 'undefined',
//         // Commands
//         hasCommandsAPI: typeof vscode.commands !== 'undefined',
//     };
//     try {
//         const gitExtension = vscode.extensions.getExtension('vscode.git');
//         if (gitExtension) {
//             outputChannel.appendLine('   ✅ Git extension found');
//             outputChannel.appendLine(`   📦 Extension ID: ${gitExtension.id}`);
//             outputChannel.appendLine(`   📦 Extension Name: ${gitExtension.packageJSON?.displayName || 'Unknown'}`);
//             outputChannel.appendLine(`   📦 Extension Version: ${gitExtension.packageJSON?.version || 'Unknown'}`);
//             outputChannel.appendLine(`   📦 Is Active: ${gitExtension.isActive}`);
//             if (gitExtension.isActive) {
//                 const gitAPI = gitExtension.exports;
//                 outputChannel.appendLine(`   📦 Git API Available: ${!!gitAPI}`);
//                 if (gitAPI) {
//                     outputChannel.appendLine(`   📦 Repositories Count: ${gitAPI.repositories?.length || 0}`);
//                     if (gitAPI.repositories) {
//                         gitAPI.repositories.forEach((repo: any, index: number) => {
//                             outputChannel.appendLine(`   📁 Repository ${index + 1}: ${repo.rootUri.fsPath}`);
//                             outputChannel.appendLine(`   🌿 Branch: ${repo.state.head?.name || 'unknown'}`);
//                         });
//                     }
//                 }
//             }
//         } else {
//             outputChannel.appendLine('   ❌ Git extension not found');
//         }
//     } catch (error) {
//         outputChannel.appendLine(`   ❌ Error detecting Git extension: ${error}`);
//     }
//     return capabilities;
// }
// // POC: Branch Detection
// class BranchDetectionPOC {
//     private lastKnownBranches: Map<string, string> = new Map();
//     private callbacks: ((event: any) => void)[] = [];
//     private pollingInterval?: NodeJS.Timeout;
//     private fileWatchers: vscode.FileSystemWatcher[] = [];
//     constructor() {
//         outputChannel.appendLine('🔧 Branch Detection POC initialized');
//     }
//     async testFileSystemWatchers() {
//         outputChannel.appendLine('\n👁️ TEST 1: File System Watchers');
//         outputChannel.appendLine('═'.repeat(40));
//         try {
//             const workspaceFolders = vscode.workspace.workspaceFolders;
//             if (!workspaceFolders) {
//                 outputChannel.appendLine('❌ No workspace folders found');
//                 return false;
//             }
//             outputChannel.appendLine(`📁 Found ${workspaceFolders.length} workspace folder(s)`);
//             let watchersCreated = 0;
//             for (const folder of workspaceFolders) {
//                 const gitHeadPath = require('path').join(folder.uri.fsPath, '.git', 'HEAD');
//                 if (require('fs').existsSync(gitHeadPath)) {
//                     outputChannel.appendLine(`✅ Git repository found: ${folder.uri.fsPath}`);
//                     outputChannel.appendLine(`📁 Watching: ${gitHeadPath}`);
//                     // Create file watcher
//                     const watcher = vscode.workspace.createFileSystemWatcher(gitHeadPath);
//                     watcher.onDidChange(() => {
//                         outputChannel.appendLine(`🔄 HEAD file changed in: ${folder.uri.fsPath}`);
//                         this.checkBranchChange(folder.uri.fsPath);
//                     });
//                     watcher.onDidCreate(() => {
//                         outputChannel.appendLine(`➕ HEAD file created in: ${folder.uri.fsPath}`);
//                     });
//                     watcher.onDidDelete(() => {
//                         outputChannel.appendLine(`➖ HEAD file deleted in: ${folder.uri.fsPath}`);
//                     });
//                     this.fileWatchers.push(watcher);
//                     watchersCreated++;
//                     // Get initial branch
//                     const initialBranch = await this.getCurrentBranch(folder.uri.fsPath);
//                     this.lastKnownBranches.set(folder.uri.fsPath, initialBranch);
//                     outputChannel.appendLine(`🌿 Initial branch: ${initialBranch}`);
//                 } else {
//                     outputChannel.appendLine(`❌ Not a git repository: ${folder.uri.fsPath}`);
//                 }
//             }
//             outputChannel.appendLine(`✅ Created ${watchersCreated} file watcher(s)`);
//             outputChannel.appendLine('💡 Try switching branches to test detection');
//             return watchersCreated > 0;
//         } catch (error) {
//             outputChannel.appendLine(`❌ Error setting up file watchers: ${error}`);
//             return false;
//         }
//     }
//     async testPolling() {
//         outputChannel.appendLine('\n⏰ TEST 2: Polling Method');
//         outputChannel.appendLine('═'.repeat(40));
//         try {
//             const workspaceFolders = vscode.workspace.workspaceFolders;
//             if (!workspaceFolders) {
//                 outputChannel.appendLine('❌ No workspace folders found');
//                 return false;
//             }
//             outputChannel.appendLine(`📁 Found ${workspaceFolders.length} workspace folder(s)`);
//             outputChannel.appendLine('⏰ Starting polling (every 3 seconds)...');
//             // Initial check
//             await this.checkAllRepositories();
//             // Start polling
//             this.pollingInterval = setInterval(async () => {
//                 await this.checkAllRepositories();
//             }, 3000);
//             outputChannel.appendLine('✅ Polling started');
//             outputChannel.appendLine('💡 Try switching branches to test detection');
//             return true;
//         } catch (error) {
//             outputChannel.appendLine(`❌ Error setting up polling: ${error}`);
//             return false;
//         }
//     }
//     async testGitExtensionAPI() {
//         outputChannel.appendLine('\n🔧 TEST 3: Git Extension API');
//         outputChannel.appendLine('═'.repeat(40));
//         try {
//             const gitExtension = vscode.extensions.getExtension('vscode.git');
//             if (!gitExtension) {
//                 outputChannel.appendLine('❌ Git extension not available');
//                 return false;
//             }
//             if (!gitExtension.isActive) {
//                 outputChannel.appendLine('❌ Git extension not active');
//                 return false;
//             }
//             const gitAPI = gitExtension.exports;
//             if (!gitAPI) {
//                 outputChannel.appendLine('❌ Git API not available');
//                 return false;
//             }
//             outputChannel.appendLine(`✅ Git extension found and active`);
//             outputChannel.appendLine(`📁 Repositories: ${gitAPI.repositories?.length || 0}`);
//             if (gitAPI.repositories) {
//                 gitAPI.repositories.forEach((repo: any, index: number) => {
//                     outputChannel.appendLine(`   📁 Repository ${index + 1}: ${repo.rootUri.fsPath}`);
//                     outputChannel.appendLine(`   🌿 Branch: ${repo.state.head?.name || 'unknown'}`);
//                     // Set up state change listener
//                     const disposable = repo.state.onDidChange(() => {
//                         outputChannel.appendLine(`🔄 Repository state changed: ${repo.rootUri.fsPath}`);
//                         outputChannel.appendLine(`🌿 New branch: ${repo.state.head?.name || 'unknown'}`);
//                     });
//                     // Store disposable for cleanup
//                     (repo as any)._branchChangeDisposable = disposable;
//                 });
//             }
//             outputChannel.appendLine('✅ Git extension API listeners set up');
//             outputChannel.appendLine('💡 Try switching branches to test detection');
//             return true;
//         } catch (error) {
//             outputChannel.appendLine(`❌ Error testing Git extension API: ${error}`);
//             return false;
//         }
//     }
//     private async checkAllRepositories(): Promise<void> {
//         const workspaceFolders = vscode.workspace.workspaceFolders;
//         if (!workspaceFolders) {
//             return;
//         }
//         for (const folder of workspaceFolders) {
//             await this.checkBranchChange(folder.uri.fsPath);
//         }
//     }
//     private async checkBranchChange(repoPath: string): Promise<void> {
//         try {
//             const currentBranch = await this.getCurrentBranch(repoPath);
//             const lastKnownBranch = this.lastKnownBranches.get(repoPath);
//             if (lastKnownBranch && lastKnownBranch !== currentBranch) {
//                 // Branch changed!
//                 outputChannel.appendLine(`🔄 Branch changed in ${repoPath}: ${lastKnownBranch} → ${currentBranch}`);
//                 const event = {
//                     workspacePath: repoPath,
//                     oldBranch: lastKnownBranch,
//                     newBranch: currentBranch,
//                     timestamp: Date.now()
//                 };
//                 // Update the last known branch
//                 this.lastKnownBranches.set(repoPath, currentBranch);
//                 // Notify callbacks
//                 this.callbacks.forEach(callback => {
//                     try {
//                         callback(event);
//                     } catch (error) {
//                         outputChannel.appendLine(`Error in branch change callback: ${error}`);
//                     }
//                 });
//             }
//         } catch (error) {
//             // Skip folders that are not git repositories
//             outputChannel.appendLine(`⚠️  Not a git repository: ${repoPath}`);
//         }
//     }
//     private async getCurrentBranch(repoPath: string): Promise<string> {
//         try {
//             const { exec } = require('child_process');
//             const { promisify } = require('util');
//             const execAsync = promisify(exec);
//             const { stdout } = await execAsync('git branch --show-current', { cwd: repoPath });
//             return stdout.trim() || 'unknown';
//         } catch (error) {
//             throw new Error(`Failed to get branch for ${repoPath}: ${error}`);
//         }
//     }
//     onBranchChange(callback: (event: any) => void): void {
//         this.callbacks.push(callback);
//         outputChannel.appendLine(`📝 Registered branch change callback (total: ${this.callbacks.length})`);
//     }
//     dispose(): void {
//         outputChannel.appendLine('🧹 Cleaning up Branch Detection POC...');
//         // Clear polling
//         if (this.pollingInterval) {
//             clearInterval(this.pollingInterval);
//             this.pollingInterval = undefined;
//         }
//         // Clear file watchers
//         this.fileWatchers.forEach(watcher => watcher.dispose());
//         this.fileWatchers = [];
//         outputChannel.appendLine('✅ Branch Detection POC cleaned up');
//     }
// }
// async function runBranchDetectionPOC() {
//     const poc = new BranchDetectionPOC();
//     try {
//         outputChannel.appendLine('🧪 BRANCH DETECTION POC');
//         outputChannel.appendLine('═'.repeat(60));
//         // Register callback
//         poc.onBranchChange((event) => {
//             outputChannel.appendLine(`🎉 Branch change detected: ${event.oldBranch} → ${event.newBranch}`);
//             outputChannel.appendLine(`   Repository: ${event.workspacePath}`);
//             outputChannel.appendLine(`   Timestamp: ${new Date(event.timestamp).toISOString()}`);
//         });
//         // Test 1: File System Watchers
//         const fileWatchersWork = await poc.testFileSystemWatchers();
//         // Test 2: Polling
//         const pollingWorks = await poc.testPolling();
//         // Test 3: Git Extension API
//         const gitExtensionWorks = await poc.testGitExtensionAPI();
//         outputChannel.appendLine('\n📊 Test Results:');
//         outputChannel.appendLine(`   File Watchers: ${fileWatchersWork ? '✅' : '❌'}`);
//         outputChannel.appendLine(`   Polling: ${pollingWorks ? '✅' : '❌'}`);
//         outputChannel.appendLine(`   Git Extension API: ${gitExtensionWorks ? '✅' : '❌'}`);
//         outputChannel.appendLine('\n✅ Branch Detection POC completed!');
//         outputChannel.appendLine('💡 Try switching branches to test the detection methods');
//         outputChannel.appendLine('⏰ This will run for 60 seconds, then clean up...');
//         // Clean up after 60 seconds
//         setTimeout(() => {
//             poc.dispose();
//             outputChannel.appendLine('🧹 POC cleanup completed');
//         }, 60000);
//     } catch (error) {
//         outputChannel.appendLine(`❌ Branch Detection POC failed: ${error}`);
//         poc.dispose();
//     }
// }
function activate(context) {
    try {
        // Create output channel
        outputChannel = (0, outputChannel_1.createOutputChannel)('Jira Time Tracker - Main');
        outputChannel.appendLine('Jira Time Tracker extension activated');
        // Removed outputChannel.show(true) to prevent extension host issues
        // Create AuthenticationService first
        const authService = new AuthenticationService_1.AuthenticationService(context);
        const timeLogger = new JiraTimeLogger_1.JiraTimeLogger();
        // Update JiraTimeLogger with the authentication service
        timeLogger.updateJiraService(authService);
        outputChannel.appendLine('JiraTimeLogger instance created');
        // Initialize Branch Change Service
        const branchChangeOutputChannel = (0, outputChannel_1.createOutputChannel)('Jira Time Tracker - Branch Detection');
        const gitOutputChannel = (0, outputChannel_1.createOutputChannel)('Jira Time Tracker - Git Service');
        const branchChangeService = new BranchChangeService_1.BranchChangeService(timeLogger, context, branchChangeOutputChannel, gitOutputChannel, authService);
        // Connect JiraTimeLogger to BranchChangeService for UI updates
        timeLogger.setOnTicketPopulated((ticketInfo) => {
            if (branchChangeService.onTicketAutoPopulated) {
                branchChangeService.onTicketAutoPopulated(ticketInfo);
            }
        });
        // Connect file change events to auto-start timer
        branchChangeService.getGitService().onFileChange(async (fileChangeEvent) => {
            outputChannel.appendLine(`📝 File change detected: ${fileChangeEvent.filePath} on branch: ${fileChangeEvent.branch}`);
            try {
                await timeLogger.autoStartTimerOnFileChange(fileChangeEvent);
            }
            catch (error) {
                outputChannel.appendLine(`❌ Error handling file change event: ${error}`);
            }
        });
        // Auto-initialize branch detection on extension activation with error handling
        branchChangeService.initialize().then(() => {
            outputChannel.appendLine('✅ Branch detection auto-initialized successfully');
        }).catch((error) => {
            outputChannel.appendLine(`❌ Error auto-initializing branch detection: ${error}`);
            // Don't crash the extension host on initialization errors
            console.error('Branch detection initialization failed:', error);
        });
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-tracker.initialize-branch-detection', async () => {
        //         try {
        //             await branchChangeService.initialize();
        //             vscode.window.showInformationMessage('Branch detection initialized!');
        //         } catch (error) {
        //             outputChannel.appendLine(`Error initializing branch detection: ${error}`);
        //             vscode.window.showErrorMessage(`Failed to initialize branch detection: ${error}`);
        //         }
        //     })
        // );
        // Register the sidebar provider
        const sidebarProvider = new TimeTrackerSidebarProvider_1.TimeTrackerSidebarProvider(context.extensionUri, timeLogger, context, authService);
        // Connect BranchChangeService to the sidebar provider
        sidebarProvider.setBranchChangeService(branchChangeService);
        context.subscriptions.push(vscode.window.registerWebviewViewProvider(TimeTrackerSidebarProvider_1.TimeTrackerSidebarProvider.viewType, sidebarProvider));
        // Register commands
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-logger.startTimer', async () => {
        //         try {
        //             await timeLogger.startTimer();
        //             outputChannel.appendLine('Timer started');
        //             // Removed success notification
        //         } catch (error) {
        //             outputChannel.appendLine(`Error starting timer: ${error}`);
        //             vscode.window.showErrorMessage(`Failed to start timer: ${error}`);
        //         }
        //     })
        // );
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-logger.stopTimer', async () => {
        //         try {
        //             await timeLogger.stopTimer();
        //             outputChannel.appendLine('Timer stopped');
        //             // Removed success notification
        //         } catch (error) {
        //             outputChannel.appendLine(`Error stopping timer: ${error}`);
        //             vscode.window.showErrorMessage(`Failed to stop timer: ${error}`);
        //         }
        //     })
        // );
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-logger.resumeTimer', async () => {
        //         try {
        //             await timeLogger.resumeTimer();
        //             outputChannel.appendLine('Timer resumed');
        //             // Removed success notification
        //         } catch (error) {
        //             outputChannel.appendLine(`Error resuming timer: ${error}`);
        //             vscode.window.showErrorMessage(`Failed to resume timer: ${error}`);
        //         }
        //     })
        // );
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-logger.finishAndLog', async () => {
        //         try {
        //             await timeLogger.finishAndLog();
        //             outputChannel.appendLine('Time logged successfully');
        //             // Removed success notification
        //         } catch (error) {
        //             outputChannel.appendLine(`Error logging time: ${error}`);
        //             vscode.window.showErrorMessage(`Failed to log time: ${error}`);
        //         }
        //     })
        // );
        // // Add command to show output channel for Productive time logging debugging
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-tracker.show-productive-logs', async () => {
        //         try {
        //             outputChannel.show(true);
        //             outputChannel.appendLine('📊 Productive Time Logging Debug Output');
        //             outputChannel.appendLine('═'.repeat(60));
        //             outputChannel.appendLine('Use this output channel to monitor Productive time logging.');
        //             outputChannel.appendLine('The channel will automatically show when time is being logged to Productive.');
        //             vscode.window.showInformationMessage('Productive logging debug output channel opened!');
        //         } catch (error) {
        //             outputChannel.appendLine(`Error showing Productive logs: ${error}`);
        //             vscode.window.showErrorMessage(`Failed to show Productive logs: ${error}`);
        //         }
        //     })
        // );
        // // Add test commands for output channel functionality
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-tracker.test-output-channel', async () => {
        //         try {
        //             const { testOutputChannel } = await import('./test/output-channel-test');
        //             await testOutputChannel();
        //         } catch (error) {
        //             outputChannel.appendLine(`Error testing output channel: ${error}`);
        //             vscode.window.showErrorMessage(`Failed to test output channel: ${error}`);
        //         }
        //     })
        // );
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-tracker.test-error-logging', async () => {
        //         try {
        //             const { testErrorLogging } = await import('./test/output-channel-test');
        //             await testErrorLogging();
        //         } catch (error) {
        //             outputChannel.appendLine(`Error testing error logging: ${error}`);
        //             vscode.window.showErrorMessage(`Failed to test error logging: ${error}`);
        //         }
        // );
        // Add command to check Productive credentials being used
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-tracker.check-productive-credentials', async () => {
        //         try {
        //             outputChannel.show(true);
        //             outputChannel.appendLine('🔍 Checking Productive Credentials Source');
        //             outputChannel.appendLine('═'.repeat(60));
        //             // Check VS Code settings
        //             const config = vscode.workspace.getConfiguration('jiraTimeTracker');
        //             const settingsApiToken = config.get<string>('productive.apiToken');
        //             const settingsOrgId = config.get<string>('productive.organizationId');
        //             outputChannel.appendLine('📋 VS Code Settings:');
        //             outputChannel.appendLine(`   API Token: ${settingsApiToken ? 'Configured' : 'Not configured'}`);
        //             outputChannel.appendLine(`   Organization ID: ${settingsOrgId || 'Not configured'}`);
        //             // Check authenticated user
        //             const jiraService = timeLogger.jiraService as any;
        //             if (jiraService.authService) {
        //                 const currentUser = await jiraService.authService.getCurrentUser();
        //                 if (currentUser) {
        //                     outputChannel.appendLine(`\n📋 Authenticated User: ${currentUser.email}`);
        //                     const userCreds = await jiraService.authService.getUserCredentials(currentUser.email);
        //                     if (userCreds?.productiveApiToken) {
        //                         outputChannel.appendLine('   ✅ Productive API Token: Found in user credentials');
        //                     } else {
        //                         outputChannel.appendLine('   ❌ Productive API Token: Not found in user credentials');
        //                     }
        //                 } else {
        //                     outputChannel.appendLine('\n📋 Authenticated User: None');
        //                 }
        //             } else {
        //                 outputChannel.appendLine('\n📋 Authentication Service: Not available');
        //             }
        //             // Check environment variables
        //             outputChannel.appendLine('\n📋 Environment Variables:');
        //             outputChannel.appendLine(`   PRODUCTIVE_API_TOKEN: ${process.env.PRODUCTIVE_API_TOKEN ? 'Set' : 'Not set'}`);
        //             outputChannel.appendLine(`   PRODUCTIVE_ORGANIZATION_ID: ${process.env.PRODUCTIVE_ORGANIZATION_ID || 'Not set'}`);
        //             outputChannel.appendLine('\n💡 Priority Order:');
        //             outputChannel.appendLine('   1. Authenticated user credentials (highest priority)');
        //             outputChannel.appendLine('   2. VS Code settings');
        //             outputChannel.appendLine('   3. Environment variables');
        //             vscode.window.showInformationMessage('Productive credentials check completed! Check output channel.');
        //         } catch (error) {
        //             outputChannel.appendLine(`Error checking Productive credentials: ${error}`);
        //             vscode.window.showErrorMessage(`Failed to check Productive credentials: ${error}`);
        //         }
        //     })
        // );
        // POC Test Commands
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-tracker.poc-environment', async () => {
        //         try {
        //             outputChannel.appendLine('Running Environment POC...');
        //             outputChannel.show(true);
        //             // Clear output
        //             outputChannel.clear();
        //             // Run the POC
        //             const capabilities = await runEnvironmentPOC();
        //             outputChannel.appendLine('Environment POC completed!');
        //             vscode.window.showInformationMessage('Environment POC completed! Check output channel for results.');
        //         } catch (error) {
        //             outputChannel.appendLine(`Environment POC failed: ${error}`);
        //             vscode.window.showErrorMessage(`Environment POC failed: ${error}`);
        //         }
        //     })
        // );
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-tracker.poc-branch-detection', async () => {
        //         try {
        //             outputChannel.appendLine('Running Branch Detection POC...');
        //             outputChannel.show(true);
        //             // Clear output
        //             outputChannel.clear();
        //             // Run the POC
        //             await runBranchDetectionPOC();
        //             outputChannel.appendLine('Branch Detection POC completed!');
        //             vscode.window.showInformationMessage('Branch Detection POC completed! Check output channel for results.');
        //         } catch (error) {
        //             outputChannel.appendLine(`Branch Detection POC failed: ${error}`);
        //             vscode.window.showErrorMessage(`Branch Detection POC failed: ${error}`);
        //         }
        //     })
        // );
        // // Branch Change Service Commands
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-tracker.toggle-auto-start', async () => {
        //         try {
        //             const settings = branchChangeService.getAutoTimerSettings();
        //             const newAutoStart = !settings.autoStart;
        //             branchChangeService.updateAutoTimerSettings({ autoStart: newAutoStart });
        //             const message = newAutoStart ? 'Auto-start timer enabled!' : 'Auto-start timer disabled!';
        //             vscode.window.showInformationMessage(message);
        //         } catch (error) {
        //             outputChannel.appendLine(`Error toggling auto-start: ${error}`);
        //             vscode.window.showErrorMessage(`Failed to toggle auto-start: ${error}`);
        //         }
        //     })
        // );
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-tracker.toggle-auto-log', async () => {
        //         try {
        //             const settings = branchChangeService.getAutoTimerSettings();
        //             const newAutoLog = !settings.autoLog;
        //             branchChangeService.updateAutoTimerSettings({ autoLog: newAutoLog });
        //             const message = newAutoLog ? 'Auto-log on commit enabled!' : 'Auto-log on commit disabled!';
        //             vscode.window.showInformationMessage(message);
        //         } catch (error) {
        //             outputChannel.appendLine(`Error toggling auto-log: ${error}`);
        //             vscode.window.showErrorMessage(`Failed to toggle auto-log: ${error}`);
        //         }
        //     })
        // );
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-tracker.show-branch-info', async () => {
        //         try {
        //             const branchInfo = branchChangeService.getCurrentBranchInfo();
        //             if (branchInfo) {
        //                 const message = `Current branch: ${branchInfo.branch}${branchInfo.ticketInfo ? `\nLinked ticket: ${branchInfo.ticketInfo.ticketId} (${branchInfo.ticketInfo.projectKey})` : '\nNo linked ticket found'}`;
        //                 vscode.window.showInformationMessage(message);
        //             } else {
        //                 vscode.window.showInformationMessage('No branch information available');
        //             }
        //         } catch (error) {
        //             outputChannel.appendLine(`Error showing branch info: ${error}`);
        //             vscode.window.showErrorMessage(`Failed to show branch info: ${error}`);
        //         }
        //     })
        // );
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-tracker.manual-commit-log', async () => {
        //         try {
        //             const commitMessage = await vscode.window.showInputBox({
        //                 prompt: 'Enter commit message for time logging',
        //                 placeHolder: 'e.g., Fixed authentication bug'
        //             });
        //             if (commitMessage) {
        //                 // Create a mock CommitEvent for manual commit logging
        //                 const mockCommitEvent = {
        //                     workspacePath: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
        //                     branch: 'manual-commit',
        //                     commitHash: 'manual',
        //                     commitMessage: commitMessage,
        //                     timestamp: Date.now()
        //                 };
        //                 await branchChangeService.handleCommit(mockCommitEvent);
        //                 // Removed success notification
        //             }
        //         } catch (error) {
        //             outputChannel.appendLine(`Error logging time for commit: ${error}`);
        //             vscode.window.showErrorMessage(`Failed to log time for commit: ${error}`);
        //         }
        //     })
        // );
        // Debug command to test current branch info
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-tracker.debug-branch-info', async () => {
        //         try {
        //             const branchInfo = branchChangeService.getCurrentBranchInfo();
        //             if (branchInfo) {
        //                 const message = `Current branch: ${branchInfo.branch}${branchInfo.ticketInfo ? `\nLinked ticket: ${branchInfo.ticketInfo.ticketId} (${branchInfo.ticketInfo.projectKey})` : '\nNo linked ticket found'}`;
        //                 outputChannel.appendLine(`🔍 DEBUG: ${message}`);
        //                 vscode.window.showInformationMessage(message);
        //             } else {
        //                 outputChannel.appendLine('🔍 DEBUG: No branch info available');
        //                 vscode.window.showInformationMessage('No branch info available');
        //             }
        //         } catch (error) {
        //             outputChannel.appendLine(`Error getting branch info: ${error}`);
        //             vscode.window.showErrorMessage(`Failed to get branch info: ${error}`);
        //         }
        //     })
        // );
        // Debug command to force Git extension activation
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-tracker.force-git-activation', async () => {
        //         try {
        //             outputChannel.appendLine('🔄 Forcing Git extension activation...');
        //             // Try to activate the Git extension
        //             const gitExtension = vscode.extensions.getExtension('vscode.git');
        //             if (gitExtension) {
        //                 if (!gitExtension.isActive) {
        //                     await gitExtension.activate();
        //                     outputChannel.appendLine('✅ Git extension activated successfully');
        //                 } else {
        //                     outputChannel.appendLine('✅ Git extension already active');
        //                 }
        //                 // Re-initialize GitService
        //                 const gitService = (branchChangeService as any).gitService;
        //                 if (gitService) {
        //                     gitService.initializeGitExtension();
        //                     outputChannel.appendLine('🔄 GitService re-initialized');
        //                 }
        //                 vscode.window.showInformationMessage('Git extension activated!');
        //             } else {
        //                 outputChannel.appendLine('❌ Git extension not found');
        //                 vscode.window.showErrorMessage('Git extension not found');
        //             }
        //         } catch (error) {
        //             outputChannel.appendLine(`Error activating Git extension: ${error}`);
        //             vscode.window.showErrorMessage(`Failed to activate Git extension: ${error}`);
        //         }
        //     })
        // );
        // // Debug command to check Git repository status
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-tracker.check-git-status', async () => {
        //         try {
        //             outputChannel.appendLine('🔍 Checking Git repository status...');
        //             // Check current workspace
        //             const workspaceFolders = vscode.workspace.workspaceFolders;
        //             if (workspaceFolders) {
        //                 outputChannel.appendLine(`📁 Workspace folders: ${workspaceFolders.length}`);
        //                 workspaceFolders.forEach((folder, index) => {
        //                     outputChannel.appendLine(`  ${index + 1}. ${folder.uri.fsPath}`);
        //                 });
        //             } else {
        //                 outputChannel.appendLine('⚠️ No workspace folders found');
        //             }
        //             // Check if we're in a Git repository
        //             const gitExtension = vscode.extensions.getExtension('vscode.git');
        //             if (gitExtension && gitExtension.isActive) {
        //                 const gitAPI = gitExtension.exports;
        //                 if (gitAPI && gitAPI.repositories) {
        //                     outputChannel.appendLine(`📊 Git repositories found: ${gitAPI.repositories.length}`);
        //                     gitAPI.repositories.forEach((repo: any, index: number) => {
        //                         const repoPath = repo.rootUri.fsPath;
        //                         const currentBranch = repo.state?.head?.name || 'unknown';
        //                         outputChannel.appendLine(`  ${index + 1}. ${repoPath} → ${currentBranch}`);
        //                     });
        //                 } else {
        //                     outputChannel.appendLine('⚠️ Git API not available');
        //                 }
        //             } else {
        //                 outputChannel.appendLine('⚠️ Git extension not active');
        //             }
        //             vscode.window.showInformationMessage('Git status check completed!');
        //         } catch (error) {
        //             outputChannel.appendLine(`Error checking Git status: ${error}`);
        //             vscode.window.showErrorMessage(`Failed to check Git status: ${error}`);
        //         }
        //     })
        // );
        // // Debug command to refresh Git repositories
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-tracker.refresh-git-repos', async () => {
        //         try {
        //             outputChannel.appendLine('🔄 Refreshing Git repositories...');
        //             const gitService = (branchChangeService as any).gitService;
        //             if (gitService) {
        //                 await gitService.discoverGitRepositories();
        //                 gitService.updateRepositoryWatchers();
        //                 outputChannel.appendLine('✅ Git repositories refreshed');
        //             } else {
        //                 outputChannel.appendLine('❌ GitService not available');
        //             }
        //             vscode.window.showInformationMessage('Git repositories refreshed!');
        //         } catch (error) {
        //             outputChannel.appendLine(`Error refreshing Git repositories: ${error}`);
        //             vscode.window.showErrorMessage(`Failed to refresh Git repositories: ${error}`);
        //         }
        //     })
        // );
        // // Debug command to test file watchers
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-tracker.debug-file-watchers', () => {
        //         try {
        //             const gitService = (branchChangeService as any).gitService;
        //             if (gitService) {
        //                 gitService.debugFileWatchers();
        //                 vscode.window.showInformationMessage('File watchers info logged to output channel');
        //             } else {
        //                 outputChannel.appendLine('❌ GitService not available');
        //                 vscode.window.showErrorMessage('GitService not available');
        //             }
        //         } catch (error) {
        //             outputChannel.appendLine(`Error debugging file watchers: ${error}`);
        //             vscode.window.showErrorMessage(`Failed to debug file watchers: ${error}`);
        //         }
        //     })
        // );
        // // Debug command to manually read HEAD files
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-tracker.debug-head-files', async () => {
        //         try {
        //             const gitService = (branchChangeService as any).gitService;
        //             if (gitService) {
        //                 await gitService.debugHeadFiles();
        //                 vscode.window.showInformationMessage('HEAD files info logged to output channel');
        //             } else {
        //                 outputChannel.appendLine('❌ GitService not available');
        //                 vscode.window.showErrorMessage('GitService not available');
        //             }
        //         } catch (error) {
        //             outputChannel.appendLine(`Error debugging HEAD files: ${error}`);
        //             vscode.window.showErrorMessage(`Failed to debug HEAD files: ${error}`);
        //         }
        //     })
        // );
        // // Debug command to manually trigger HEAD file change handler
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-tracker.debug-trigger-head-change', async () => {
        //         try {
        //             const gitService = (branchChangeService as any).gitService;
        //             if (gitService) {
        //                 await gitService.debugTriggerHeadFileChange();
        //                 vscode.window.showInformationMessage('HEAD file change handler triggered');
        //             } else {
        //                 outputChannel.appendLine('❌ GitService not available');
        //                 vscode.window.showErrorMessage('GitService not available');
        //             }
        //         } catch (error) {
        //             outputChannel.appendLine(`Error triggering HEAD file change: ${error}`);
        //             vscode.window.showErrorMessage(`Failed to trigger HEAD file change: ${error}`);
        //         }
        //     })
        // );
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-tracker.debug-commit', async () => {
        //         try {
        //             const commitMessage = 'Test commit message';
        //             outputChannel.appendLine(`🧪 Testing commit handling with message: ${commitMessage}`);
        //             // Create a mock CommitEvent for debug testing
        //             const mockCommitEvent = {
        //                 workspacePath: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
        //                 branch: 'debug-test',
        //                 commitHash: 'debug',
        //                 commitMessage: commitMessage,
        //                 timestamp: Date.now()
        //             };
        //             await branchChangeService.handleCommit(mockCommitEvent);
        //             vscode.window.showInformationMessage('Commit test completed!');
        //         } catch (error) {
        //             outputChannel.appendLine(`Error testing commit: ${error}`);
        //             vscode.window.showErrorMessage(`Failed to test commit: ${error}`);
        //         }
        //     })
        // );
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-tracker.debug-git-state', async () => {
        //         try {
        //             outputChannel.appendLine('🔍 Debugging Git state...');
        //             const gitService = (branchChangeService as any).gitService;
        //             if (gitService) {
        //                 gitService.debugCurrentBranch();
        //                 const repos = gitService.getAllRepositories();
        //                 outputChannel.appendLine(`📁 Found ${repos.length} repositories:`);
        //                 repos.forEach((repo: any, index: number) => {
        //                     outputChannel.appendLine(`  ${index + 1}. ${repo.path} - Branch: ${repo.branch} - Commit: ${repo.lastCommit?.substring(0, 8) || 'none'}`);
        //                 });
        //             }
        //             vscode.window.showInformationMessage('Git state debug completed!');
        //         } catch (error) {
        //             outputChannel.appendLine(`Error debugging Git state: ${error}`);
        //             vscode.window.showErrorMessage(`Failed to debug Git state: ${error}`);
        //         }
        //     })
        // );
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-tracker.debug-trigger-commit', async () => {
        //         try {
        //             outputChannel.appendLine('🧪 Manually triggering commit event...');
        //             const gitService = (branchChangeService as any).gitService;
        //             if (gitService) {
        //                 await gitService.debugTriggerCommit();
        //             }
        //             vscode.window.showInformationMessage('Manual commit trigger completed!');
        //         } catch (error) {
        //             outputChannel.appendLine(`Error triggering commit: ${error}`);
        //             vscode.window.showErrorMessage(`Failed to trigger commit: ${error}`);
        //         }
        //     })
        // );
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-tracker.test-extension', () => {
        //         outputChannel.appendLine('✅ Extension test command executed successfully!');
        //         outputChannel.appendLine(`📅 Current time: ${new Date().toISOString()}`);
        //         outputChannel.appendLine(`🔧 Extension version: 0.0.5`);
        //         vscode.window.showInformationMessage('Extension test completed! Check output panel.');
        //     })
        // );
        // // Debug commands
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-tracker.debugTriggerCommit', async () => {
        //         outputChannel.appendLine('🔧 Debug: Triggering manual commit event...');
        //         const mockEvent: CommitEvent = {
        //             workspacePath: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
        //             branch: 'test-branch',
        //             commitHash: 'test-commit',
        //             commitMessage: 'Test commit message',
        //             timestamp: Date.now()
        //         };
        //         await branchChangeService.handleCommit(mockEvent);
        //     })
        // );
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-tracker.debugTriggerHeadChange', async () => {
        //         outputChannel.appendLine('🔧 Debug: Triggering HEAD file change...');
        //         const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        //         if (workspacePath) {
        //             // Get the GitService instance from BranchChangeService
        //             const gitService = (branchChangeService as any).gitService;
        //             if (gitService) {
        //                 await gitService.debugTriggerHeadFileChange(workspacePath);
        //             } else {
        //                 outputChannel.appendLine('❌ GitService not available');
        //             }
        //         } else {
        //             outputChannel.appendLine('❌ No workspace folder found');
        //         }
        //     })
        // );
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-tracker.debugGitStatus', async () => {
        //         outputChannel.appendLine('🔧 Debug: Checking Git status...');
        //         const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        //         if (workspacePath) {
        //             // Get the GitService instance from BranchChangeService
        //             const gitService = (branchChangeService as any).gitService;
        //             if (gitService) {
        //                 gitService.debugCurrentBranch();
        //                 gitService.debugFileWatchers();
        //                 await gitService.debugHeadFiles();
        //             } else {
        //                 outputChannel.appendLine('❌ GitService not available');
        //             }
        //         } else {
        //             outputChannel.appendLine('❌ No workspace folder found');
        //         }
        //     })
        // );
        // context.subscriptions.push(
        //     vscode.commands.registerCommand('jira-time-tracker.debugPeriodicCheck', async () => {
        //         outputChannel.appendLine('🔧 Debug: Testing periodic commit check...');
        //         const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        //         if (workspacePath) {
        //             // Get the GitService instance from BranchChangeService
        //             const gitService = (branchChangeService as any).gitService;
        //             if (gitService) {
        //                 // Manually trigger a commit check
        //                 const currentCommit = await gitService.getCurrentCommitFromFile(workspacePath);
        //                 const lastKnownCommit = gitService.lastKnownCommits?.get(workspacePath);
        //                 outputChannel.appendLine(`📝 Current commit: ${currentCommit}`);
        //                 outputChannel.appendLine(`📝 Last known commit: ${lastKnownCommit}`);
        //                 outputChannel.appendLine(`📝 Commits different: ${currentCommit !== lastKnownCommit}`);
        //             } else {
        //                 outputChannel.appendLine('❌ GitService not available');
        //             }
        //         } else {
        //             outputChannel.appendLine('❌ No workspace folder found');
        //         }
        //     })
        // );
        // Toggle logging command
        context.subscriptions.push(vscode.commands.registerCommand('jira-time-tracker.toggle-logging', async () => {
            try {
                const config = vscode.workspace.getConfiguration('jiraTimeTracker');
                const currentLogging = config.get('enableLogging', false);
                const newLogging = !currentLogging;
                await config.update('enableLogging', newLogging, vscode.ConfigurationTarget.Global);
                const status = newLogging ? 'enabled' : 'disabled';
                vscode.window.showInformationMessage(`Jira Time Tracker logging ${status}`);
                if (outputChannel) {
                    outputChannel.appendLine(`🔧 Logging ${status} via command`);
                }
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to toggle logging: ${error}`);
            }
        }));
        // Show logging status command
        context.subscriptions.push(vscode.commands.registerCommand('jira-time-tracker.show-logging-status', async () => {
            try {
                const config = vscode.workspace.getConfiguration('jiraTimeTracker');
                const currentLogging = config.get('enableLogging', false);
                const status = currentLogging ? 'enabled' : 'disabled';
                vscode.window.showInformationMessage(`Jira Time Tracker logging is currently ${status}`);
                if (outputChannel) {
                    outputChannel.appendLine(`🔧 Current logging status: ${status}`);
                }
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to get logging status: ${error}`);
            }
        }));
        // outputChannel.appendLine('Extension activated successfully');
    }
    catch (error) {
        vscode.window.showErrorMessage('Failed to initialize Jira Time Tracker: ' + error.message);
        console.error('Failed to initialize Jira Time Tracker:', error);
    }
}
exports.activate = activate;
function deactivate() {
    try {
        console.log('Extension deactivated');
        if (outputChannel) {
            outputChannel.appendLine('Extension deactivated');
        }
    }
    catch (error) {
        console.error('Error during extension deactivation:', error);
    }
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map