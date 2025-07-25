"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitEventMonitor = void 0;
const vscode = require("vscode");
const path = require("path");
const GitService_1 = require("./GitService");
/**
 * Git Event Monitor Service
 * Monitors git repository for branch switches and commits to trigger automatic time logging
 */
class GitEventMonitor {
    constructor() {
        this.listeners = [];
        this.currentBranch = null;
        this.watcherDisposable = null;
        this.monitoringActive = false;
        this.workspaceRoot = null;
        this.gitService = new GitService_1.GitService();
        this.initializeMonitoring();
    }
    /**
     * Start monitoring git events
     */
    async startMonitoring() {
        if (this.monitoringActive) {
            console.log('📊 Git monitoring already active');
            return;
        }
        try {
            console.log('🔍 Starting Git event monitoring...');
            // Get workspace root
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                console.log('⚠️  No workspace folder found');
                return;
            }
            this.workspaceRoot = workspaceFolders[0].uri.fsPath;
            // Get current branch as baseline
            this.currentBranch = await this.gitService.getBranchName();
            console.log(`📋 Current branch: ${this.currentBranch}`);
            // Set up file system watchers for git changes
            this.setupFileWatchers();
            // Set up workspace change listener
            this.setupWorkspaceListener();
            this.monitoringActive = true;
            console.log('✅ Git monitoring started successfully');
        }
        catch (error) {
            console.error('❌ Failed to start git monitoring:', error);
        }
    }
    /**
     * Stop monitoring git events
     */
    stopMonitoring() {
        if (!this.monitoringActive)
            return;
        console.log('🛑 Stopping Git event monitoring...');
        if (this.watcherDisposable) {
            this.watcherDisposable.dispose();
            this.watcherDisposable = null;
        }
        this.monitoringActive = false;
        console.log('✅ Git monitoring stopped');
    }
    /**
     * Add event listener
     */
    addListener(listener) {
        this.listeners.push(listener);
    }
    /**
     * Remove event listener
     */
    removeListener(listener) {
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }
    /**
     * Initialize monitoring setup
     */
    async initializeMonitoring() {
        // Start monitoring when extension activates
        await this.startMonitoring();
    }
    /**
     * Set up file system watchers for git changes
     */
    setupFileWatchers() {
        if (!this.workspaceRoot)
            return;
        // Watch for changes to .git/HEAD (branch switches)
        const gitHeadPath = path.join(this.workspaceRoot, '.git', 'HEAD');
        const gitRefsPath = path.join(this.workspaceRoot, '.git', 'refs', 'heads');
        // Create file system watcher
        const pattern = new vscode.RelativePattern(this.workspaceRoot, '{.git/HEAD,.git/refs/heads/**,.git/COMMIT_EDITMSG}');
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        // Listen for file changes
        watcher.onDidChange((uri) => this.handleGitFileChange(uri));
        watcher.onDidCreate((uri) => this.handleGitFileChange(uri));
        this.watcherDisposable = watcher;
    }
    /**
     * Set up workspace change listener
     */
    setupWorkspaceListener() {
        // Listen for workspace folder changes
        vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
            if (event.added.length > 0 || event.removed.length > 0) {
                console.log('📁 Workspace changed, reinitializing git monitoring...');
                this.stopMonitoring();
                await this.startMonitoring();
            }
        });
    }
    /**
     * Handle git file changes
     */
    async handleGitFileChange(uri) {
        try {
            const fileName = path.basename(uri.fsPath);
            if (fileName === 'HEAD') {
                // Branch switch detected
                await this.checkForBranchSwitch();
            }
            else if (fileName === 'COMMIT_EDITMSG') {
                // Commit detected
                await this.checkForCommit();
            }
        }
        catch (error) {
            console.error('❌ Error handling git file change:', error);
        }
    }
    /**
     * Check for branch switch
     */
    async checkForBranchSwitch() {
        try {
            const newBranch = await this.gitService.getBranchName();
            if (newBranch !== this.currentBranch) {
                console.log(`🌿 Branch switch detected: ${this.currentBranch} → ${newBranch}`);
                const event = {
                    type: 'branch_switch',
                    branchName: newBranch,
                    previousBranch: this.currentBranch || undefined,
                    timestamp: new Date()
                };
                // Update current branch
                const previousBranch = this.currentBranch;
                this.currentBranch = newBranch;
                // Notify listeners
                await this.notifyListeners('onBranchSwitch', event);
            }
        }
        catch (error) {
            console.error('❌ Error checking branch switch:', error);
        }
    }
    /**
     * Check for commit
     */
    async checkForCommit() {
        try {
            // Get latest commit info
            const commitHash = await this.gitService.getCurrentCommit();
            const commitMessage = await this.getLatestCommitMessage();
            console.log(`📝 Commit detected: ${commitHash.substring(0, 8)} - "${commitMessage}"`);
            const event = {
                type: 'commit',
                branchName: this.currentBranch || 'unknown',
                commitMessage,
                commitHash,
                timestamp: new Date()
            };
            // Notify listeners
            await this.notifyListeners('onCommit', event);
        }
        catch (error) {
            console.error('❌ Error checking commit:', error);
        }
    }
    /**
     * Get latest commit message
     */
    async getLatestCommitMessage() {
        try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);
            const { stdout } = await execAsync('git log -1 --pretty=format:"%s"', {
                cwd: this.workspaceRoot
            });
            return stdout.trim();
        }
        catch (error) {
            console.error('❌ Error getting commit message:', error);
            return 'Unknown commit message';
        }
    }
    /**
     * Notify all listeners of an event
     */
    async notifyListeners(method, event) {
        for (const listener of this.listeners) {
            try {
                await listener[method](event);
            }
            catch (error) {
                console.error(`❌ Error in git event listener (${method}):`, error);
            }
        }
    }
    /**
     * Get current branch name
     */
    getCurrentBranch() {
        return this.currentBranch;
    }
    /**
     * Check if monitoring is active
     */
    isMonitoring() {
        return this.monitoringActive;
    }
    /**
     * Force check for changes (useful for testing)
     */
    async forceCheck() {
        await this.checkForBranchSwitch();
    }
    /**
     * Dispose of resources
     */
    dispose() {
        this.stopMonitoring();
        this.listeners = [];
    }
}
exports.GitEventMonitor = GitEventMonitor;
//# sourceMappingURL=GitEventMonitor.js.map