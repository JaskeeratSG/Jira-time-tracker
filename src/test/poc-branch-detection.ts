// POC: Branch Change Detection
// This script tests different methods for detecting branch changes

import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

class BranchDetectionPOC {
    private lastKnownBranches: Map<string, string> = new Map();
    private callbacks: ((event: any) => void)[] = [];
    private pollingInterval?: NodeJS.Timeout;
    private fileWatchers: vscode.FileSystemWatcher[] = [];

    constructor() {
        console.log('🔧 Branch Detection POC initialized');
    }

    /**
     * Test Method 1: File System Watchers
     */
    async testFileSystemWatchers() {
        console.log('\n👁️ TEST 1: File System Watchers');
        console.log('═'.repeat(40));

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                console.log('❌ No workspace folders found');
                return false;
            }

            console.log(`📁 Found ${workspaceFolders.length} workspace folder(s)`);

            let watchersCreated = 0;

            for (const folder of workspaceFolders) {
                const gitHeadPath = path.join(folder.uri.fsPath, '.git', 'HEAD');
                
                if (fs.existsSync(gitHeadPath)) {
                    console.log(`✅ Git repository found: ${folder.uri.fsPath}`);
                    console.log(`📁 Watching: ${gitHeadPath}`);
                    
                    // Create file watcher
                    const watcher = vscode.workspace.createFileSystemWatcher(gitHeadPath);
                    
                    watcher.onDidChange(() => {
                        console.log(`🔄 HEAD file changed in: ${folder.uri.fsPath}`);
                        this.checkBranchChange(folder.uri.fsPath);
                    });
                    
                    watcher.onDidCreate(() => {
                        console.log(`➕ HEAD file created in: ${folder.uri.fsPath}`);
                    });
                    
                    watcher.onDidDelete(() => {
                        console.log(`➖ HEAD file deleted in: ${folder.uri.fsPath}`);
                    });
                    
                    this.fileWatchers.push(watcher);
                    watchersCreated++;
                    
                    // Get initial branch
                    const initialBranch = await this.getCurrentBranch(folder.uri.fsPath);
                    this.lastKnownBranches.set(folder.uri.fsPath, initialBranch);
                    console.log(`🌿 Initial branch: ${initialBranch}`);
                    
                } else {
                    console.log(`❌ Not a git repository: ${folder.uri.fsPath}`);
                }
            }

            console.log(`✅ Created ${watchersCreated} file watcher(s)`);
            console.log('💡 Try switching branches to test detection');
            
            return watchersCreated > 0;
            
        } catch (error) {
            console.log(`❌ Error setting up file watchers: ${error}`);
            return false;
        }
    }

    /**
     * Test Method 2: Polling
     */
    async testPolling() {
        console.log('\n⏰ TEST 2: Polling Method');
        console.log('═'.repeat(40));

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                console.log('❌ No workspace folders found');
                return false;
            }

            console.log(`📁 Found ${workspaceFolders.length} workspace folder(s)`);
            console.log('⏰ Starting polling (every 3 seconds)...');

            // Initial check
            await this.checkAllRepositories();

            // Start polling
            this.pollingInterval = setInterval(async () => {
                await this.checkAllRepositories();
            }, 3000);

            console.log('✅ Polling started');
            console.log('💡 Try switching branches to test detection');
            
            return true;
            
        } catch (error) {
            console.log(`❌ Error setting up polling: ${error}`);
            return false;
        }
    }

    /**
     * Test Method 3: Git Extension API (VS Code only)
     */
    async testGitExtensionAPI() {
        console.log('\n🔧 TEST 3: Git Extension API');
        console.log('═'.repeat(40));

        try {
            const gitExtension = vscode.extensions.getExtension('vscode.git');
            
            if (!gitExtension) {
                console.log('❌ Git extension not available');
                return false;
            }

            if (!gitExtension.isActive) {
                console.log('❌ Git extension not active');
                return false;
            }

            const gitAPI = gitExtension.exports;
            if (!gitAPI) {
                console.log('❌ Git API not available');
                return false;
            }

            console.log(`✅ Git extension found and active`);
            console.log(`📁 Repositories: ${gitAPI.repositories?.length || 0}`);

            if (gitAPI.repositories) {
                gitAPI.repositories.forEach((repo: any, index: number) => {
                    console.log(`   📁 Repository ${index + 1}: ${repo.rootUri.fsPath}`);
                    console.log(`   🌿 Branch: ${repo.state.head?.name || 'unknown'}`);
                    
                    // Set up state change listener
                    const disposable = repo.state.onDidChange(() => {
                        console.log(`🔄 Repository state changed: ${repo.rootUri.fsPath}`);
                        console.log(`🌿 New branch: ${repo.state.head?.name || 'unknown'}`);
                    });
                    
                    // Store disposable for cleanup
                    (repo as any)._branchChangeDisposable = disposable;
                });
            }

            console.log('✅ Git extension API listeners set up');
            console.log('💡 Try switching branches to test detection');
            
            return true;
            
        } catch (error) {
            console.log(`❌ Error testing Git extension API: ${error}`);
            return false;
        }
    }

    /**
     * Check all repositories for branch changes
     */
    private async checkAllRepositories(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        for (const folder of workspaceFolders) {
            await this.checkBranchChange(folder.uri.fsPath);
        }
    }

    /**
     * Check for branch change in a specific repository
     */
    private async checkBranchChange(repoPath: string): Promise<void> {
        try {
            const currentBranch = await this.getCurrentBranch(repoPath);
            const lastKnownBranch = this.lastKnownBranches.get(repoPath);

            if (lastKnownBranch && lastKnownBranch !== currentBranch) {
                // Branch changed!
                console.log(`🔄 Branch changed in ${repoPath}: ${lastKnownBranch} → ${currentBranch}`);
                
                const event = {
                    workspacePath: repoPath,
                    oldBranch: lastKnownBranch,
                    newBranch: currentBranch,
                    timestamp: Date.now()
                };

                // Update the last known branch
                this.lastKnownBranches.set(repoPath, currentBranch);

                // Notify callbacks
                this.callbacks.forEach(callback => {
                    try {
                        callback(event);
                    } catch (error) {
                        console.error('Error in branch change callback:', error);
                    }
                });
            }
        } catch (error) {
            // Skip folders that are not git repositories
            console.log(`⚠️  Not a git repository: ${repoPath}`);
        }
    }

    /**
     * Get current branch for a repository
     */
    private async getCurrentBranch(repoPath: string): Promise<string> {
        try {
            const { stdout } = await execAsync('git branch --show-current', { cwd: repoPath });
            return stdout.trim() || 'unknown';
        } catch (error) {
            throw new Error(`Failed to get branch for ${repoPath}: ${error}`);
        }
    }

    /**
     * Register callback for branch changes
     */
    onBranchChange(callback: (event: any) => void): void {
        this.callbacks.push(callback);
        console.log(`📝 Registered branch change callback (total: ${this.callbacks.length})`);
    }

    /**
     * Cleanup resources
     */
    dispose(): void {
        console.log('🧹 Cleaning up Branch Detection POC...');
        
        // Clear polling
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = undefined;
        }

        // Clear file watchers
        this.fileWatchers.forEach(watcher => watcher.dispose());
        this.fileWatchers = [];

        console.log('✅ Branch Detection POC cleaned up');
    }
}

// Run the POC
async function runBranchDetectionPOC() {
    const poc = new BranchDetectionPOC();
    
    try {
        console.log('🧪 BRANCH DETECTION POC');
        console.log('═'.repeat(60));

        // Register callback
        poc.onBranchChange((event) => {
            console.log(`🎉 Branch change detected: ${event.oldBranch} → ${event.newBranch}`);
            console.log(`   Repository: ${event.workspacePath}`);
            console.log(`   Timestamp: ${new Date(event.timestamp).toISOString()}`);
        });

        // Test 1: File System Watchers
        const fileWatchersWork = await poc.testFileSystemWatchers();
        
        // Test 2: Polling
        const pollingWorks = await poc.testPolling();
        
        // Test 3: Git Extension API
        const gitExtensionWorks = await poc.testGitExtensionAPI();

        console.log('\n📊 Test Results:');
        console.log(`   File Watchers: ${fileWatchersWork ? '✅' : '❌'}`);
        console.log(`   Polling: ${pollingWorks ? '✅' : '❌'}`);
        console.log(`   Git Extension API: ${gitExtensionWorks ? '✅' : '❌'}`);

        console.log('\n✅ Branch Detection POC completed!');
        console.log('💡 Try switching branches to test the detection methods');
        console.log('⏰ This will run for 60 seconds, then clean up...');

        // Clean up after 60 seconds
        setTimeout(() => {
            poc.dispose();
            console.log('🧹 POC cleanup completed');
        }, 60000);

    } catch (error) {
        console.error('❌ Branch Detection POC failed:', error);
        poc.dispose();
    }
}

// Run if called directly
if (require.main === module) {
    runBranchDetectionPOC().catch(console.error);
}

export { BranchDetectionPOC, runBranchDetectionPOC }; 