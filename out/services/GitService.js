"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitService = void 0;
const vscode = require("vscode");
const axios_1 = require("axios"); // Added for direct Jira API calls
const path = require("path"); // Added for path.join
class GitService {
    constructor(jiraService, outputChannel) {
        this.jiraService = jiraService;
        this.repositories = new Map(); // Using any for vscode.Git since it's not exported
        this.callbacks = [];
        this.commitCallbacks = [];
        this.lastKnownBranches = new Map();
        this.lastKnownCommits = new Map();
        this.fileWatchers = new Map();
        this.headFileWatchers = new Map(); // Added for debug logging
        this.outputChannel = outputChannel;
        this.initializeGitExtension();
    }
    initializeGitExtension() {
        try {
            this.outputChannel.appendLine('🔧 Initializing Git extension...');
            const gitExtension = vscode.extensions.getExtension('vscode.git');
            if (gitExtension) {
                this.outputChannel.appendLine(`📦 Git extension found: ${gitExtension.id}`);
                this.outputChannel.appendLine(`📦 Git extension active: ${gitExtension.isActive}`);
                if (gitExtension.isActive) {
                    this.gitExtension = gitExtension;
                    this.outputChannel.appendLine('✅ Git extension initialized');
                    this.setupRepositoryWatchers();
                    this.setupActiveEditorTracking();
                }
                else {
                    this.outputChannel.appendLine('⚠️ Git extension not active, retrying in 2 seconds...');
                    // Retry after a delay
                    setTimeout(() => {
                        this.outputChannel.appendLine('🔄 Retrying Git extension initialization...');
                        this.initializeGitExtension();
                    }, 2000);
                }
            }
            else {
                this.outputChannel.appendLine('❌ Git extension not found');
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error initializing Git extension: ${error}`);
        }
    }
    async discoverGitRepositories() {
        try {
            this.outputChannel.appendLine('🔍 Manually discovering Git repositories...');
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                this.outputChannel.appendLine('⚠️ No workspace folders found');
                return;
            }
            for (const folder of workspaceFolders) {
                this.outputChannel.appendLine(`📁 Checking folder: ${folder.uri.fsPath}`);
                // Check if this folder is a Git repository
                const gitPath = vscode.Uri.joinPath(folder.uri, '.git');
                try {
                    await vscode.workspace.fs.stat(gitPath);
                    this.outputChannel.appendLine(`✅ Found Git repository: ${folder.uri.fsPath}`);
                }
                catch {
                    // Check subfolders for Git repositories
                    try {
                        const entries = await vscode.workspace.fs.readDirectory(folder.uri);
                        for (const entry of entries) {
                            if (entry[1] === vscode.FileType.Directory) {
                                const subFolderPath = vscode.Uri.joinPath(folder.uri, entry[0]);
                                const subGitPath = vscode.Uri.joinPath(subFolderPath, '.git');
                                try {
                                    await vscode.workspace.fs.stat(subGitPath);
                                    this.outputChannel.appendLine(`✅ Found Git repository in subfolder: ${subFolderPath.fsPath}`);
                                }
                                catch {
                                    // Not a Git repository
                                }
                            }
                        }
                    }
                    catch (error) {
                        this.outputChannel.appendLine(`❌ Error reading folder ${folder.uri.fsPath}: ${error}`);
                    }
                }
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error discovering Git repositories: ${error}`);
        }
    }
    async setupFileSystemWatchers() {
        this.outputChannel.appendLine('🔍 Setting up file system watchers...');
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            this.outputChannel.appendLine('⚠️ No workspace folders found');
            return;
        }
        for (const folder of workspaceFolders) {
            await this.setupWatcherForFolder(folder.uri.fsPath);
        }
        // Initialize last known commits for all repositories
        await this.initializeLastKnownCommits();
    }
    async initializeLastKnownCommits() {
        this.outputChannel.appendLine('🔍 Initializing last known commits...');
        for (const [repoPath, _] of this.headFileWatchers) {
            try {
                const currentCommit = await this.getCurrentCommitFromFile(repoPath);
                if (currentCommit) {
                    this.lastKnownCommits.set(repoPath, currentCommit);
                    this.outputChannel.appendLine(`✅ Initialized last known commit for ${repoPath}: ${currentCommit}`);
                }
            }
            catch (error) {
                this.outputChannel.appendLine(`❌ Error initializing commit for ${repoPath}: ${error}`);
            }
        }
    }
    async setupWatcherForFolder(folderPath) {
        // Check if this folder is a Git repository
        const gitHeadPath = vscode.Uri.joinPath(vscode.Uri.file(folderPath), '.git', 'HEAD');
        try {
            // Check if .git/HEAD exists
            await vscode.workspace.fs.stat(gitHeadPath);
            this.outputChannel.appendLine(`✅ Setting up watcher for Git repository: ${folderPath}`);
            this.setupHeadFileWatcher(folderPath);
        }
        catch {
            // Check subfolders for Git repositories
            await this.checkSubfoldersForGit(folderPath);
        }
    }
    async checkSubfoldersForGit(folderPath) {
        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(folderPath));
            for (const entry of entries) {
                if (entry[1] === vscode.FileType.Directory) {
                    const subFolderPath = vscode.Uri.joinPath(vscode.Uri.file(folderPath), entry[0]);
                    const subGitHeadPath = vscode.Uri.joinPath(subFolderPath, '.git', 'HEAD');
                    try {
                        await vscode.workspace.fs.stat(subGitHeadPath);
                        this.outputChannel.appendLine(`✅ Setting up watcher for Git repository in subfolder: ${subFolderPath.fsPath}`);
                        this.setupHeadFileWatcher(subFolderPath.fsPath);
                    }
                    catch {
                        // Not a Git repository
                    }
                }
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error reading subfolders in ${folderPath}: ${error}`);
        }
    }
    setupHeadFileWatcher(repoPath) {
        const headFilePath = path.join(repoPath, '.git', 'HEAD');
        this.outputChannel.appendLine(`🔍 [HEAD WATCHER] Setting up watcher for: ${headFilePath}`);
        const watcher = vscode.workspace.createFileSystemWatcher(headFilePath);
        watcher.onDidChange((uri) => {
            this.outputChannel.appendLine(`🔍 [HEAD WATCHER] HEAD file changed: ${uri.fsPath}`);
            this.handleHeadFileChange(repoPath);
        });
        watcher.onDidCreate((uri) => {
            this.outputChannel.appendLine(`🔍 [HEAD WATCHER] HEAD file created: ${uri.fsPath}`);
            this.handleHeadFileChange(repoPath);
        });
        this.headFileWatchers.set(repoPath, watcher);
        this.outputChannel.appendLine(`✅ [HEAD WATCHER] Watcher set up for ${repoPath}`);
        // Also watch the objects directory for new commits
        this.setupObjectsWatcher(repoPath);
    }
    setupObjectsWatcher(repoPath) {
        const objectsPath = path.join(repoPath, '.git', 'objects');
        this.outputChannel.appendLine(`🔍 [OBJECTS WATCHER] Setting up watcher for: ${objectsPath}`);
        // Watch for new files in the objects directory (new commits)
        const watcher = vscode.workspace.createFileSystemWatcher(path.join(objectsPath, '**'));
        watcher.onDidCreate((uri) => {
            this.outputChannel.appendLine(`🔍 [OBJECTS WATCHER] New object created: ${uri.fsPath}`);
            // Check if this is a commit object
            if (uri.fsPath.includes('/objects/') && !uri.fsPath.includes('/pack/')) {
                this.outputChannel.appendLine(`🔍 [OBJECTS WATCHER] Potential new commit detected`);
                this.handleHeadFileChange(repoPath);
            }
        });
        this.outputChannel.appendLine(`✅ [OBJECTS WATCHER] Objects watcher set up for ${repoPath}`);
        // Also set up a periodic check for new commits
        this.setupPeriodicCommitCheck(repoPath);
    }
    setupPeriodicCommitCheck(repoPath) {
        this.outputChannel.appendLine(`🔍 [PERIODIC CHECK] Setting up periodic commit check for: ${repoPath}`);
        // Check for new commits every 5 seconds
        const interval = setInterval(async () => {
            try {
                const currentCommit = await this.getCurrentCommitFromFile(repoPath);
                const lastKnownCommit = this.lastKnownCommits.get(repoPath);
                if (currentCommit && lastKnownCommit && currentCommit !== lastKnownCommit) {
                    this.outputChannel.appendLine(`🔍 [PERIODIC CHECK] New commit detected: ${currentCommit} (was: ${lastKnownCommit})`);
                    // Get commit message using the simpler method
                    const commitMessage = await this.getLastCommitMessage(repoPath);
                    const currentBranch = await this.getCurrentBranchFromFile(repoPath);
                    if (currentBranch) {
                        const commitEvent = {
                            workspacePath: repoPath,
                            branch: currentBranch,
                            commitHash: currentCommit,
                            commitMessage: commitMessage || `Commit ${currentCommit.substring(0, 8)}`,
                            timestamp: Date.now()
                        };
                        this.outputChannel.appendLine(`📝 [PERIODIC CHECK] Triggering commit event: ${commitEvent.commitMessage}`);
                        this.commitCallbacks.forEach(callback => callback(commitEvent));
                    }
                    // Update last known commit
                    this.lastKnownCommits.set(repoPath, currentCommit);
                }
            }
            catch (error) {
                this.outputChannel.appendLine(`❌ [PERIODIC CHECK] Error checking commits: ${error}`);
            }
        }, 5000); // Check every 5 seconds
        // Store the interval for cleanup
        this.outputChannel.appendLine(`✅ [PERIODIC CHECK] Periodic commit check set up for ${repoPath}`);
    }
    async getCurrentBranchFromFile(repoPath) {
        try {
            const headPath = vscode.Uri.joinPath(vscode.Uri.file(repoPath), '.git', 'HEAD');
            const headContent = await vscode.workspace.fs.readFile(headPath);
            const headText = Buffer.from(headContent).toString('utf8').trim();
            // Parse the HEAD file content
            if (headText.startsWith('ref: refs/heads/')) {
                return headText.replace('ref: refs/heads/', '');
            }
            else {
                return 'detached';
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error reading HEAD file for ${repoPath}: ${error}`);
            return 'unknown';
        }
    }
    async handleHeadFileChange(repoPath) {
        this.outputChannel.appendLine(`🔍 [HEAD CHANGE] Processing HEAD file change for: ${repoPath}`);
        try {
            // Get current branch and commit
            const currentBranch = await this.getCurrentBranchFromFile(repoPath);
            const currentCommit = await this.getCurrentCommitFromFile(repoPath);
            this.outputChannel.appendLine(`🔍 [HEAD CHANGE] Current branch: ${currentBranch}, commit: ${currentCommit}`);
            const lastKnownBranch = this.lastKnownBranches.get(repoPath);
            const lastKnownCommit = this.lastKnownCommits.get(repoPath);
            this.outputChannel.appendLine(`🔍 [HEAD CHANGE] Last known branch: ${lastKnownBranch}, commit: ${lastKnownCommit}`);
            // Check for branch change (including initial branch detection)
            if (lastKnownBranch && lastKnownBranch !== currentBranch) {
                this.outputChannel.appendLine(`🔄 Branch changed in ${repoPath}: ${lastKnownBranch} → ${currentBranch}`);
                const event = {
                    workspacePath: repoPath,
                    oldBranch: lastKnownBranch,
                    newBranch: currentBranch,
                    timestamp: Date.now()
                };
                this.lastKnownBranches.set(repoPath, currentBranch);
                this.callbacks.forEach(callback => {
                    try {
                        this.outputChannel.appendLine(`🔄 Notifying branch change callback...`);
                        callback(event);
                    }
                    catch (error) {
                        this.outputChannel.appendLine(`Error in branch change callback: ${error}`);
                    }
                });
            }
            else if (!lastKnownBranch && currentBranch !== 'unknown') {
                // This is the initial branch detection - treat it as a branch change
                this.outputChannel.appendLine(`🔄 Initial branch detected in ${repoPath}: ${currentBranch}`);
                const event = {
                    workspacePath: repoPath,
                    oldBranch: 'unknown',
                    newBranch: currentBranch,
                    timestamp: Date.now()
                };
                this.lastKnownBranches.set(repoPath, currentBranch);
                this.callbacks.forEach(callback => {
                    try {
                        this.outputChannel.appendLine(`🔄 Notifying initial branch change callback...`);
                        callback(event);
                    }
                    catch (error) {
                        this.outputChannel.appendLine(`Error in initial branch change callback: ${error}`);
                    }
                });
            }
            // Check for commit change
            if (lastKnownCommit && lastKnownCommit !== currentCommit && currentCommit !== 'unknown') {
                this.outputChannel.appendLine(`📝 New commit detected in ${repoPath}: ${lastKnownCommit} → ${currentCommit}`);
                await this.checkForNewCommit(repoPath, currentBranch);
            }
            // Initialize commit tracking if not previously tracked
            if (!lastKnownCommit && currentCommit !== 'unknown') {
                this.lastKnownCommits.set(repoPath, currentCommit);
                this.outputChannel.appendLine(`📝 Initialized commit tracking for ${repoPath}: ${currentCommit}`);
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error handling HEAD file change for ${repoPath}: ${error}`);
        }
    }
    async checkForNewCommit(repoPath, currentBranch) {
        try {
            this.outputChannel.appendLine(`🔍 [COMMIT DEBUG] Checking for new commit in ${repoPath}`);
            const currentCommit = await this.getCurrentCommitFromFile(repoPath);
            const lastKnownCommit = this.lastKnownCommits.get(repoPath);
            this.outputChannel.appendLine(`🔍 [COMMIT DEBUG] Current commit: ${currentCommit}, Last known: ${lastKnownCommit}`);
            if (lastKnownCommit && lastKnownCommit !== currentCommit && currentCommit !== 'unknown') {
                this.outputChannel.appendLine(`📝 New commit detected in ${repoPath}: ${lastKnownCommit} → ${currentCommit}`);
                const commitMessage = await this.getLastCommitMessage(repoPath);
                const event = {
                    workspacePath: repoPath,
                    branch: currentBranch,
                    commitHash: currentCommit,
                    commitMessage: commitMessage || `Commit ${currentCommit.substring(0, 8)}`,
                    timestamp: Date.now()
                };
                this.lastKnownCommits.set(repoPath, currentCommit);
                this.outputChannel.appendLine(`📝 Triggering commit callbacks for ${repoPath}...`);
                this.commitCallbacks.forEach(callback => {
                    try {
                        this.outputChannel.appendLine(`📝 Notifying commit callback...`);
                        callback(event);
                    }
                    catch (error) {
                        this.outputChannel.appendLine(`Error in commit callback: ${error}`);
                    }
                });
            }
            else if (currentCommit !== 'unknown') {
                this.lastKnownCommits.set(repoPath, currentCommit);
                this.outputChannel.appendLine(`📝 Initialized commit tracking for ${repoPath}: ${currentCommit}`);
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error checking for new commit in ${repoPath}: ${error}`);
        }
    }
    async getCurrentCommitFromFile(repoPath) {
        try {
            const headFilePath = path.join(repoPath, '.git', 'HEAD');
            const headContent = await vscode.workspace.fs.readFile(vscode.Uri.file(headFilePath));
            const headText = Buffer.from(headContent).toString('utf8').trim();
            // If HEAD points to a branch, read the commit hash from the branch file
            if (headText.startsWith('ref: refs/heads/')) {
                const branchName = headText.replace('ref: refs/heads/', '');
                const branchFilePath = path.join(repoPath, '.git', 'refs', 'heads', branchName);
                const branchContent = await vscode.workspace.fs.readFile(vscode.Uri.file(branchFilePath));
                return Buffer.from(branchContent).toString('utf8').trim();
            }
            else {
                // HEAD points directly to a commit hash
                return headText;
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error reading commit from file for ${repoPath}: ${error}`);
            return '';
        }
    }
    async getCommitMessageFromFile(repoPath, commitHash) {
        try {
            // Read the commit object from the Git objects directory
            const objectPath = vscode.Uri.joinPath(vscode.Uri.file(repoPath), '.git', 'objects', commitHash.substring(0, 2), commitHash.substring(2));
            const objectContent = await vscode.workspace.fs.readFile(objectPath);
            const objectText = Buffer.from(objectContent).toString('utf8');
            // Parse the commit object to extract the message
            // Git commit objects have a specific format
            const lines = objectText.split('\n');
            let inMessage = false;
            const messageLines = [];
            for (const line of lines) {
                if (line === '') {
                    inMessage = true;
                    continue;
                }
                if (inMessage) {
                    messageLines.push(line);
                }
            }
            return messageLines.join('\n') || `Commit ${commitHash.substring(0, 8)}`;
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error reading commit message for ${commitHash}: ${error}`);
            return `Commit ${commitHash.substring(0, 8)}`;
        }
    }
    setupRepositoryWatchers() {
        if (!this.gitExtension?.exports)
            return;
        const gitAPI = this.gitExtension.exports;
        // Set up initial repositories
        this.updateRepositoryWatchers();
        // Listen for repository changes (add/remove folders) - only if available
        if (gitAPI.onDidChangeRepositories) {
            this.repositoryChangeDisposable = gitAPI.onDidChangeRepositories(() => {
                this.outputChannel.appendLine('🔄 Repositories changed, updating watchers...');
                this.updateRepositoryWatchers();
            });
        }
        else {
            this.outputChannel.appendLine('⚠️ Git API does not support onDidChangeRepositories');
        }
    }
    async updateRepositoryWatchers() {
        if (!this.gitExtension?.exports) {
            this.outputChannel.appendLine('❌ Git extension exports not available');
            return;
        }
        const gitAPI = this.gitExtension.exports;
        this.outputChannel.appendLine(`🔍 Git API available, repositories count: ${gitAPI.repositories?.length || 0}`);
        // Check if we're in a Git repository
        if (!gitAPI.repositories || gitAPI.repositories.length === 0) {
            this.outputChannel.appendLine('⚠️ No Git repositories found in workspace');
            this.outputChannel.appendLine('💡 Make sure you have opened a folder that contains a Git repository');
            // Try to manually discover Git repositories
            this.discoverGitRepositories();
            // Set up file system watchers as fallback
            await this.setupFileSystemWatchers();
            return;
        }
        this.repositories.clear();
        gitAPI.repositories.forEach((repo, index) => {
            const repoPath = repo.rootUri.fsPath;
            this.repositories.set(repoPath, repo);
            this.outputChannel.appendLine(`📁 Monitoring repository ${index + 1}: ${repoPath}`);
            // Set up repository state change listener
            if (repo.state && repo.state.onDidChange) {
                const disposable = repo.state.onDidChange(() => {
                    this.outputChannel.appendLine(`🔄 Repository state changed: ${repoPath}`);
                    this.handleRepositoryStateChange(repo);
                });
                this.outputChannel.appendLine(`✅ Set up state change listener for: ${repoPath}`);
            }
            else {
                this.outputChannel.appendLine(`⚠️ Repository ${repoPath} has no state change listener`);
            }
            const currentBranch = repo.state?.head?.name || 'unknown';
            this.lastKnownBranches.set(repoPath, currentBranch);
            this.outputChannel.appendLine(`🌿 Initial branch for ${repoPath}: ${currentBranch}`);
        });
        // Set up repository change listener if available
        if (gitAPI.onDidChangeRepositories) {
            this.repositoryChangeDisposable = gitAPI.onDidChangeRepositories(() => {
                this.outputChannel.appendLine('🔄 Repositories changed, updating watchers...');
                this.updateRepositoryWatchers();
            });
        }
        else {
            this.outputChannel.appendLine('⚠️ Git API does not support onDidChangeRepositories');
        }
    }
    handleRepositoryStateChange(repo) {
        const repoPath = repo.rootUri.fsPath;
        const newBranch = repo.state.head?.name || 'unknown';
        const newCommit = repo.state.head?.commit || 'unknown';
        const lastKnownBranch = this.lastKnownBranches.get(repoPath);
        const lastKnownCommit = this.lastKnownCommits.get(repoPath);
        this.outputChannel.appendLine(`🔍 State change detected for ${repoPath}: branch=${lastKnownBranch || 'none'} → ${newBranch}, commit=${lastKnownCommit || 'none'} → ${newCommit}`);
        // Check for branch change (including initial branch detection)
        if (lastKnownBranch && lastKnownBranch !== newBranch) {
            this.outputChannel.appendLine(`🔄 Branch changed in ${repoPath}: ${lastKnownBranch} → ${newBranch}`);
            const event = {
                workspacePath: repoPath,
                oldBranch: lastKnownBranch,
                newBranch: newBranch,
                timestamp: Date.now(),
                repository: repo
            };
            // Update the last known branch
            this.lastKnownBranches.set(repoPath, newBranch);
            // Notify callbacks
            this.callbacks.forEach(callback => {
                try {
                    this.outputChannel.appendLine(`🔄 Notifying branch change callback...`);
                    callback(event);
                }
                catch (error) {
                    this.outputChannel.appendLine(`Error in branch change callback: ${error}`);
                }
            });
        }
        else if (!lastKnownBranch && newBranch !== 'unknown') {
            // This is the initial branch detection - treat it as a branch change
            this.outputChannel.appendLine(`🔄 Initial branch detected in ${repoPath}: ${newBranch}`);
            const event = {
                workspacePath: repoPath,
                oldBranch: 'unknown',
                newBranch: newBranch,
                timestamp: Date.now(),
                repository: repo
            };
            // Update the last known branch
            this.lastKnownBranches.set(repoPath, newBranch);
            // Notify callbacks
            this.callbacks.forEach(callback => {
                try {
                    this.outputChannel.appendLine(`🔄 Notifying initial branch change callback...`);
                    callback(event);
                }
                catch (error) {
                    this.outputChannel.appendLine(`Error in initial branch change callback: ${error}`);
                }
            });
        }
        // Check for commit change (new commit on same branch or initial commit)
        if (lastKnownCommit && lastKnownCommit !== newCommit && newCommit !== 'unknown') {
            this.outputChannel.appendLine(`📝 New commit detected in ${repoPath}: ${lastKnownCommit} → ${newCommit}`);
            // Get commit message (this would require additional Git API calls)
            // For now, we'll use a placeholder and get the actual message when needed
            const commitMessage = `Commit ${newCommit.substring(0, 8)}`;
            const event = {
                workspacePath: repoPath,
                branch: newBranch,
                commitHash: newCommit,
                commitMessage: commitMessage,
                timestamp: Date.now(),
                repository: repo
            };
            // Update the last known commit
            this.lastKnownCommits.set(repoPath, newCommit);
            // Notify commit callbacks
            this.commitCallbacks.forEach(callback => {
                try {
                    this.outputChannel.appendLine(`📝 Notifying commit callback...`);
                    callback(event);
                }
                catch (error) {
                    this.outputChannel.appendLine(`Error in commit callback: ${error}`);
                }
            });
        }
        // Initialize commit tracking if not previously tracked
        if (!lastKnownCommit && newCommit !== 'unknown') {
            this.lastKnownCommits.set(repoPath, newCommit);
            this.outputChannel.appendLine(`📝 Initialized commit tracking for ${repoPath}: ${newCommit.substring(0, 8)}`);
        }
    }
    setupActiveEditorTracking() {
        // Track active editor changes to identify which repository is active
        this.activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                const activeRepo = this.getRepositoryForUri(editor.document.uri);
                if (activeRepo) {
                    this.outputChannel.appendLine(`📝 Active file in repository: ${activeRepo.rootUri.fsPath}`);
                }
            }
        });
    }
    getRepositoryForUri(uri) {
        if (!this.gitExtension?.exports)
            return undefined;
        const gitAPI = this.gitExtension.exports;
        // Check if getRepository method exists
        if (gitAPI.getRepository) {
            return gitAPI.getRepository(uri);
        }
        else {
            // Fallback: find repository by checking if URI is within any known repository
            for (const [repoPath, repo] of this.repositories) {
                if (uri.fsPath.startsWith(repoPath)) {
                    return repo;
                }
            }
            return undefined;
        }
    }
    getActiveRepository() {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            return this.getRepositoryForUri(activeEditor.document.uri);
        }
        return undefined;
    }
    getCurrentBranch(repoPath) {
        if (repoPath) {
            const repo = this.repositories.get(repoPath);
            return repo?.state.head?.name || 'unknown';
        }
        // Get from active repository
        const activeRepo = this.getActiveRepository();
        return activeRepo?.state.head?.name || 'unknown';
    }
    getCurrentBranchInfo(repoPath) {
        const repo = repoPath ? this.repositories.get(repoPath) : this.getActiveRepository();
        if (!repo)
            return undefined;
        return {
            path: repo.rootUri.fsPath,
            branch: repo.state.head?.name || 'unknown',
            remoteUrl: this.getRemoteUrl(repo),
            lastCommit: repo.state.head?.commit
        };
    }
    getRemoteUrl(repo) {
        // Try to get remote URL from Git extension
        const remotes = repo.state.remotes;
        if (remotes && remotes.length > 0) {
            const origin = remotes.find((r) => r.name === 'origin');
            return origin?.fetchUrl || origin?.pushUrl;
        }
        return undefined;
    }
    async findLinkedJiraTicket(branchName, repoPath) {
        this.outputChannel.appendLine(`🔍 Searching for Jira ticket linked to branch: ${branchName}`);
        // Method 1: Extract Jira ticket key from branch name and fetch directly from Jira API
        const ticketKey = this.extractJiraTicketKey(branchName);
        if (ticketKey) {
            this.outputChannel.appendLine(`🎯 Extracted Jira ticket key from branch: ${ticketKey}`);
            try {
                // Fetch full ticket details directly from Jira REST API
                const ticketDetails = await this.fetchTicketDetails(ticketKey);
                if (ticketDetails) {
                    this.outputChannel.appendLine(`✅ SUCCESS: Found linked Jira ticket for branch "${branchName}"`);
                    this.outputChannel.appendLine(`   🎫 Ticket: ${ticketDetails.key}`);
                    this.outputChannel.appendLine(`   📋 Project: ${ticketDetails.fields.project.key} - ${ticketDetails.fields.project.name}`);
                    this.outputChannel.appendLine(`   📝 Summary: ${ticketDetails.fields.summary}`);
                    this.outputChannel.appendLine(`   🏷️ Issue Type: ${ticketDetails.fields.issuetype.name}`);
                    this.outputChannel.appendLine(`   📊 Status: ${ticketDetails.fields.status.name}`);
                    this.outputChannel.appendLine(`   🔗 Branch-Ticket Relationship: DIRECT LINK (Created from Jira)`);
                    return {
                        ticketId: ticketDetails.key,
                        projectKey: ticketDetails.fields.project.key,
                        summary: ticketDetails.fields.summary,
                        status: ticketDetails.fields.status.name
                    };
                }
            }
            catch (error) {
                this.outputChannel.appendLine(`❌ Error fetching ticket ${ticketKey} from Jira: ${error}`);
            }
        }
        else {
            this.outputChannel.appendLine(`❌ No Jira ticket key found in branch name: ${branchName}`);
            this.outputChannel.appendLine(`   💡 Tip: Create branches using Jira's "Create Branch" feature for automatic linking`);
        }
        this.outputChannel.appendLine(`❌ No linked Jira ticket found for branch: ${branchName}`);
        return null;
    }
    extractJiraTicketKey(branchName) {
        this.outputChannel.appendLine(`🔍 Extracting Jira ticket key from branch: "${branchName}"`);
        // Common patterns for Jira ticket keys in branch names
        const patterns = [
            /([A-Z]+-\d+)/,
            /(?:feature|bugfix|hotfix|release)\/([A-Z]+-\d+)/i,
            /(?:branch|b)\/([A-Z]+-\d+)/i,
            /(?:feat|fix|chore)\/([A-Z]+-\d+)/i,
            /(?:task|story|bug)\/([A-Z]+-\d+)/i // task/PROJECT-123
        ];
        for (let i = 0; i < patterns.length; i++) {
            const pattern = patterns[i];
            const match = branchName.match(pattern);
            if (match) {
                this.outputChannel.appendLine(`✅ Pattern ${i + 1} matched: "${match[1]}" from branch "${branchName}"`);
                return match[1]; // Return the captured ticket key
            }
            else {
                this.outputChannel.appendLine(`❌ Pattern ${i + 1} did not match: ${pattern}`);
            }
        }
        this.outputChannel.appendLine(`❌ No patterns matched for branch: "${branchName}"`);
        return null;
    }
    async fetchTicketDetails(ticketKey) {
        this.outputChannel.appendLine(`🔍 Fetching ticket details for: ${ticketKey}`);
        const credentials = await this.jiraService.getCurrentCredentials();
        if (!credentials) {
            this.outputChannel.appendLine(`❌ No Jira credentials found`);
            throw new Error('No Jira credentials configured');
        }
        this.outputChannel.appendLine(`🔍 Using Jira base URL: ${credentials.baseUrl}`);
        this.outputChannel.appendLine(`🔍 Using email: ${credentials.email}`);
        try {
            const response = await axios_1.default.get(`${credentials.baseUrl}/rest/api/3/issue/${ticketKey}`, {
                auth: {
                    username: credentials.email,
                    password: credentials.apiToken
                },
                headers: {
                    'Accept': 'application/json'
                }
            });
            if (response.status === 200) {
                this.outputChannel.appendLine(`✅ Successfully fetched ticket: ${ticketKey}`);
                return response.data;
            }
            else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error fetching ticket ${ticketKey}: ${error.message}`);
            if (error.response?.status === 404) {
                throw new Error(`Ticket ${ticketKey} not found in Jira`);
            }
            else if (error.response?.status === 401) {
                throw new Error(`Authentication failed - check your Jira credentials`);
            }
            else {
                throw new Error(`Failed to fetch ticket: ${error.message}`);
            }
        }
    }
    onBranchChange(callback) {
        this.callbacks.push(callback);
        this.outputChannel.appendLine(`📝 Registered branch change callback (total: ${this.callbacks.length})`);
    }
    offBranchChange(callback) {
        const index = this.callbacks.indexOf(callback);
        if (index > -1) {
            this.callbacks.splice(index, 1);
            this.outputChannel.appendLine(`📝 Unregistered branch change callback (total: ${this.callbacks.length})`);
        }
    }
    onCommitChange(callback) {
        this.commitCallbacks.push(callback);
        this.outputChannel.appendLine(`📝 Registered commit change callback (total: ${this.commitCallbacks.length})`);
    }
    offCommitChange(callback) {
        const index = this.commitCallbacks.indexOf(callback);
        if (index > -1) {
            this.commitCallbacks.splice(index, 1);
            this.outputChannel.appendLine(`📝 Unregistered commit change callback (total: ${this.commitCallbacks.length})`);
        }
    }
    getAllRepositories() {
        const repos = [];
        this.repositories.forEach((repo, path) => {
            repos.push({
                path: path,
                branch: repo.state.head?.name || 'unknown',
                remoteUrl: this.getRemoteUrl(repo),
                lastCommit: repo.state.head?.commit
            });
        });
        return repos;
    }
    dispose() {
        this.outputChannel.appendLine('🧹 Cleaning up GitService...');
        if (this.activeEditorDisposable) {
            this.activeEditorDisposable.dispose();
        }
        if (this.repositoryChangeDisposable) {
            this.repositoryChangeDisposable.dispose();
        }
        // Dispose of file watchers
        this.fileWatchers.forEach(watcher => {
            watcher.dispose();
        });
        this.fileWatchers.clear();
        this.repositories.clear();
        this.lastKnownBranches.clear();
        this.callbacks = [];
        this.outputChannel.appendLine('✅ GitService cleaned up');
    }
    // Debug method to manually check current branch
    debugCurrentBranch() {
        this.outputChannel.appendLine('🔍 Debug: Checking current branch...');
        if (!this.gitExtension?.exports) {
            this.outputChannel.appendLine('❌ Git extension exports not available');
            return;
        }
        const gitAPI = this.gitExtension.exports;
        this.outputChannel.appendLine(`📊 Git API repositories count: ${gitAPI.repositories?.length || 0}`);
        if (gitAPI.repositories && gitAPI.repositories.length > 0) {
            gitAPI.repositories.forEach((repo, index) => {
                const repoPath = repo.rootUri.fsPath;
                const currentBranch = repo.state.head?.name || 'unknown';
                this.outputChannel.appendLine(`📁 Repo ${index + 1}: ${repoPath} → Branch: ${currentBranch}`);
            });
        }
        else {
            this.outputChannel.appendLine('⚠️ No repositories found in Git API');
        }
    }
    // Debug method to test file watchers
    debugFileWatchers() {
        this.outputChannel.appendLine('🔍 Debug: Checking file watchers...');
        this.outputChannel.appendLine(`📊 Active file watchers: ${this.fileWatchers.size}`);
        this.fileWatchers.forEach((watcher, repoPath) => {
            this.outputChannel.appendLine(`📁 Watcher for: ${repoPath}`);
        });
        this.outputChannel.appendLine('🔍 Debug: Checking last known branches...');
        this.lastKnownBranches.forEach((branch, repoPath) => {
            this.outputChannel.appendLine(`🌿 ${repoPath}: ${branch}`);
        });
    }
    // Debug method to manually read HEAD files
    async debugHeadFiles() {
        this.outputChannel.appendLine('🔍 Debug: Reading HEAD files...');
        for (const [repoPath, _] of this.fileWatchers) {
            try {
                const currentBranch = await this.getCurrentBranchFromFile(repoPath);
                const lastKnownBranch = this.lastKnownBranches.get(repoPath);
                this.outputChannel.appendLine(`📁 ${repoPath}:`);
                this.outputChannel.appendLine(`   Last known: ${lastKnownBranch || 'none'}`);
                this.outputChannel.appendLine(`   Current: ${currentBranch}`);
                if (lastKnownBranch && lastKnownBranch !== currentBranch) {
                    this.outputChannel.appendLine(`   ⚠️ Branch mismatch detected!`);
                }
            }
            catch (error) {
                this.outputChannel.appendLine(`❌ Error reading HEAD for ${repoPath}: ${error}`);
            }
        }
    }
    // Debug method to manually trigger HEAD file change handler
    async debugTriggerHeadFileChange(repoPath) {
        this.outputChannel.appendLine('🔍 Debug: Manually triggering HEAD file change handler...');
        if (repoPath) {
            this.outputChannel.appendLine(`📁 Triggering for specific repo: ${repoPath}`);
            await this.handleHeadFileChange(repoPath);
        }
        else {
            this.outputChannel.appendLine(`📁 Triggering for all watched repos...`);
            for (const [watchedRepoPath, _] of this.fileWatchers) {
                this.outputChannel.appendLine(`📁 Triggering for: ${watchedRepoPath}`);
                await this.handleHeadFileChange(watchedRepoPath);
            }
        }
    }
    async debugTriggerCommit(repoPath) {
        try {
            this.outputChannel.appendLine('🧪 Manually triggering commit event...');
            // Use file watchers instead of Git API
            if (repoPath) {
                this.outputChannel.appendLine(`📁 Triggering for specific repo: ${repoPath}`);
                if (this.fileWatchers.has(repoPath)) {
                    const currentBranch = await this.getCurrentBranchFromFile(repoPath);
                    const currentCommit = await this.getCurrentCommitFromFile(repoPath);
                    const commitMessage = await this.getLastCommitMessage(repoPath);
                    this.outputChannel.appendLine(`  Branch: ${currentBranch}, Commit: ${currentCommit.substring(0, 8)}`);
                    const event = {
                        workspacePath: repoPath,
                        branch: currentBranch,
                        commitHash: currentCommit,
                        commitMessage: commitMessage || `Commit ${currentCommit.substring(0, 8)}`,
                        timestamp: Date.now()
                    };
                    this.outputChannel.appendLine(`📝 Triggering commit callbacks...`);
                    this.commitCallbacks.forEach(callback => {
                        try {
                            callback(event);
                        }
                        catch (error) {
                            this.outputChannel.appendLine(`Error in manual commit callback: ${error}`);
                        }
                    });
                }
                else {
                    this.outputChannel.appendLine(`❌ No file watcher found for: ${repoPath}`);
                }
            }
            else {
                this.outputChannel.appendLine(`📁 Triggering for all watched repos...`);
                for (const [watchedRepoPath, _] of this.fileWatchers) {
                    this.outputChannel.appendLine(`📁 Triggering for: ${watchedRepoPath}`);
                    const currentBranch = await this.getCurrentBranchFromFile(watchedRepoPath);
                    const currentCommit = await this.getCurrentCommitFromFile(watchedRepoPath);
                    const commitMessage = await this.getLastCommitMessage(watchedRepoPath);
                    this.outputChannel.appendLine(`  Branch: ${currentBranch}, Commit: ${currentCommit.substring(0, 8)}`);
                    const event = {
                        workspacePath: watchedRepoPath,
                        branch: currentBranch,
                        commitHash: currentCommit,
                        commitMessage: commitMessage || `Commit ${currentCommit.substring(0, 8)}`,
                        timestamp: Date.now()
                    };
                    this.outputChannel.appendLine(`📝 Triggering commit callbacks...`);
                    this.commitCallbacks.forEach(callback => {
                        try {
                            callback(event);
                        }
                        catch (error) {
                            this.outputChannel.appendLine(`Error in manual commit callback: ${error}`);
                        }
                    });
                }
            }
            this.outputChannel.appendLine('✅ Manual commit trigger completed');
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error triggering commit: ${error}`);
        }
    }
    /**
     * Get the last commit message using git command
     */
    async getLastCommitMessage(repoPath) {
        try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);
            // Use provided repoPath or get current workspace
            const workingDir = repoPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workingDir) {
                this.outputChannel.appendLine('❌ No workspace folder found for getting commit message');
                return null;
            }
            const { stdout } = await execAsync('git log -1 --pretty=format:"%s"', {
                cwd: workingDir
            });
            const commitMessage = stdout.trim();
            this.outputChannel.appendLine(`📝 Last commit message: ${commitMessage}`);
            return commitMessage || null;
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error getting last commit message: ${error}`);
            return null;
        }
    }
}
exports.GitService = GitService;
//# sourceMappingURL=GitService.js.map