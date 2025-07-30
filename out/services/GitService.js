"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitService = void 0;
const vscode = require("vscode");
class GitService {
    constructor(jiraService, outputChannel) {
        this.jiraService = jiraService;
        this.repositories = new Map(); // Using any for vscode.Git since it's not exported
        this.callbacks = [];
        this.lastKnownBranches = new Map();
        this.fileWatchers = new Map();
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
        try {
            this.outputChannel.appendLine('📁 Setting up file system watchers for Git repositories...');
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                this.outputChannel.appendLine('⚠️ No workspace folders found');
                return;
            }
            for (const folder of workspaceFolders) {
                await this.setupWatcherForFolder(folder.uri.fsPath);
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error setting up file system watchers: ${error}`);
        }
    }
    async setupWatcherForFolder(folderPath) {
        // Check if this folder is a Git repository
        const gitHeadPath = vscode.Uri.joinPath(vscode.Uri.file(folderPath), '.git', 'HEAD');
        try {
            // Check if .git/HEAD exists
            await vscode.workspace.fs.stat(gitHeadPath);
            this.outputChannel.appendLine(`✅ Setting up watcher for Git repository: ${folderPath}`);
            this.setupHeadFileWatcher(folderPath, gitHeadPath);
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
                        this.setupHeadFileWatcher(subFolderPath.fsPath, subGitHeadPath);
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
    setupHeadFileWatcher(repoPath, headPath) {
        this.outputChannel.appendLine(`🔧 Setting up HEAD file watcher for: ${repoPath}`);
        this.outputChannel.appendLine(`📁 HEAD file path: ${headPath.fsPath}`);
        // Create a file system watcher for the HEAD file
        const watcher = vscode.workspace.createFileSystemWatcher(headPath.fsPath);
        // Store the current branch
        this.getCurrentBranchFromFile(repoPath).then(currentBranch => {
            this.lastKnownBranches.set(repoPath, currentBranch);
            this.outputChannel.appendLine(`🌿 Initial branch for ${repoPath}: ${currentBranch}`);
        });
        // Watch for changes to the HEAD file
        watcher.onDidChange(() => {
            this.outputChannel.appendLine(`📝 HEAD file changed for repository: ${repoPath}`);
            this.outputChannel.appendLine(`🔍 Calling handleHeadFileChange for: ${repoPath}`);
            this.handleHeadFileChange(repoPath);
        });
        // Also watch for creation and deletion events for debugging
        watcher.onDidCreate(() => {
            this.outputChannel.appendLine(`📝 HEAD file created for repository: ${repoPath}`);
            this.outputChannel.appendLine(`🔍 Calling handleHeadFileChange for: ${repoPath} (from create event)`);
            this.handleHeadFileChange(repoPath);
        });
        watcher.onDidDelete(() => {
            this.outputChannel.appendLine(`📝 HEAD file deleted for repository: ${repoPath}`);
        });
        this.fileWatchers.set(repoPath, watcher);
        this.outputChannel.appendLine(`✅ File watcher set up for: ${repoPath}`);
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
        try {
            const newBranch = await this.getCurrentBranchFromFile(repoPath);
            const lastKnownBranch = this.lastKnownBranches.get(repoPath);
            this.outputChannel.appendLine(`🔍 HEAD file change detected for ${repoPath}: ${lastKnownBranch || 'none'} → ${newBranch}`);
            if (lastKnownBranch && lastKnownBranch !== newBranch) {
                this.outputChannel.appendLine(`🔄 Branch changed in ${repoPath}: ${lastKnownBranch} → ${newBranch}`);
                const event = {
                    workspacePath: repoPath,
                    oldBranch: lastKnownBranch,
                    newBranch: newBranch,
                    timestamp: Date.now()
                };
                // Update the last known branch
                this.lastKnownBranches.set(repoPath, newBranch);
                // Notify callbacks
                this.callbacks.forEach(callback => {
                    try {
                        callback(event);
                    }
                    catch (error) {
                        this.outputChannel.appendLine(`Error in branch change callback: ${error}`);
                    }
                });
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error handling HEAD file change for ${repoPath}: ${error}`);
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
        const lastKnownBranch = this.lastKnownBranches.get(repoPath);
        this.outputChannel.appendLine(`🔍 State change detected for ${repoPath}: ${lastKnownBranch || 'none'} → ${newBranch}`);
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
                    callback(event);
                }
                catch (error) {
                    this.outputChannel.appendLine(`Error in branch change callback: ${error}`);
                }
            });
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
        // Method 1: Try to find ticket in Jira by searching for the branch name
        try {
            const searchResults = await this.jiraService.searchIssues('', `text ~ "${branchName}"`);
            if (searchResults && searchResults.length > 0) {
                this.outputChannel.appendLine(`✅ Found ${searchResults.length} potential tickets`);
                // Return the first match for now (could be improved with better matching logic)
                return searchResults[0].key;
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`⚠️ Error searching Jira: ${error}`);
        }
        // Method 2: Extract ticket ID from branch name using common patterns
        const ticketPatterns = [
            /(?:feature|bugfix|hotfix|release)\/([A-Z]+-\d+)/i,
            /([A-Z]+-\d+)/,
            /(?:branch|b)\/([A-Z]+-\d+)/i
        ];
        for (const pattern of ticketPatterns) {
            const match = branchName.match(pattern);
            if (match) {
                const ticketId = match[1];
                this.outputChannel.appendLine(`🎯 Extracted ticket ID from branch name: ${ticketId}`);
                // Verify the ticket exists in Jira
                try {
                    const exists = await this.jiraService.verifyTicketExists(ticketId);
                    if (exists) {
                        this.outputChannel.appendLine(`✅ Ticket ${ticketId} verified in Jira`);
                        return ticketId;
                    }
                    else {
                        this.outputChannel.appendLine(`❌ Ticket ${ticketId} not found in Jira`);
                    }
                }
                catch (error) {
                    this.outputChannel.appendLine(`⚠️ Error verifying ticket ${ticketId}: ${error}`);
                }
            }
        }
        this.outputChannel.appendLine(`❌ No linked Jira ticket found for branch: ${branchName}`);
        return null;
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
}
exports.GitService = GitService;
//# sourceMappingURL=GitService.js.map