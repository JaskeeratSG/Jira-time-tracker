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
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                this.outputChannel.appendLine('⚠️ No workspace folders found');
                return;
            }
            for (const folder of workspaceFolders) {
                const gitPath = vscode.Uri.joinPath(folder.uri, '.git');
                try {
                    await vscode.workspace.fs.stat(gitPath);
                    this.outputChannel.appendLine(`✅ Found Git repository: ${folder.uri.fsPath}`);
                }
                catch {
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
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            this.outputChannel.appendLine('⚠️ No workspace folders found');
            return;
        }
        for (const folder of workspaceFolders) {
            await this.setupWatcherForFolder(folder.uri.fsPath);
        }
        await this.initializeLastKnownCommits();
    }
    async initializeLastKnownCommits() {
        for (const [repoPath, _] of this.headFileWatchers) {
            try {
                const currentCommit = await this.getCurrentCommitFromFile(repoPath);
                if (currentCommit) {
                    this.lastKnownCommits.set(repoPath, currentCommit);
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
        const headFilePath = vscode.Uri.joinPath(vscode.Uri.file(repoPath), '.git', 'HEAD');
        const watcher = vscode.workspace.createFileSystemWatcher(headFilePath.fsPath);
        watcher.onDidChange(async (uri) => {
            await this.handleHeadFileChange(repoPath);
        });
        watcher.onDidCreate(async (uri) => {
            await this.handleHeadFileChange(repoPath);
        });
        this.headFileWatchers.set(repoPath, watcher);
    }
    setupObjectsWatcher(repoPath) {
        const objectsPath = vscode.Uri.joinPath(vscode.Uri.file(repoPath), '.git', 'objects');
        const watcher = vscode.workspace.createFileSystemWatcher(path.join(objectsPath.fsPath, '**'));
        watcher.onDidCreate(async (uri) => {
            await this.handleHeadFileChange(repoPath);
        });
        this.fileWatchers.set(repoPath, watcher);
    }
    setupPeriodicCommitCheck(repoPath) {
        // Check for new commits every 30 seconds
        const interval = setInterval(async () => {
            try {
                const currentCommit = await this.getCurrentCommitFromFile(repoPath);
                const lastKnownCommit = this.lastKnownCommits.get(repoPath);
                if (currentCommit && lastKnownCommit && currentCommit !== lastKnownCommit) {
                    const commitMessage = await this.getCommitMessageFromFile(repoPath, currentCommit);
                    this.outputChannel.appendLine(`📝 [PERIODIC CHECK] New commit detected: ${currentCommit} (was: ${lastKnownCommit})`);
                    this.outputChannel.appendLine(`📝 Last commit message: ${commitMessage}`);
                    this.outputChannel.appendLine(`📝 [PERIODIC CHECK] Triggering commit event: ${commitMessage}`);
                    const event = {
                        workspacePath: repoPath,
                        branch: this.lastKnownBranches.get(repoPath) || 'unknown',
                        commitHash: currentCommit,
                        commitMessage: commitMessage || 'No message',
                        timestamp: Date.now()
                    };
                    this.outputChannel.appendLine(`📝 Processing commit from repository: ${repoPath}`);
                    this.outputChannel.appendLine(`📝 Commit message: ${event.commitMessage}`);
                    this.outputChannel.appendLine(`📝 Branch: ${event.branch}`);
                    this.commitCallbacks.forEach(callback => {
                        try {
                            callback(event);
                        }
                        catch (error) {
                            this.outputChannel.appendLine(`Error in commit callback: ${error}`);
                        }
                    });
                    this.lastKnownCommits.set(repoPath, currentCommit);
                }
            }
            catch (error) {
                this.outputChannel.appendLine(`❌ Error in periodic commit check: ${error}`);
            }
        }, 30000);
        // Store the interval for cleanup
        this.fileWatchers.set(`${repoPath}_periodic`, { dispose: () => clearInterval(interval) });
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
            const currentBranch = await this.getCurrentBranchFromFile(repoPath);
            const currentCommit = await this.getCurrentCommitFromFile(repoPath);
            const lastKnownBranch = this.lastKnownBranches.get(repoPath);
            const lastKnownCommit = this.lastKnownCommits.get(repoPath);
            if (currentBranch && currentBranch !== lastKnownBranch) {
                this.outputChannel.appendLine(`🔄 Branch changed in ${repoPath}: ${lastKnownBranch || 'none'} → ${currentBranch}`);
                this.outputChannel.appendLine(`🔄 Notifying branch change callback...`);
                const event = {
                    workspacePath: repoPath,
                    oldBranch: lastKnownBranch || 'none',
                    newBranch: currentBranch,
                    timestamp: Date.now()
                };
                this.lastKnownBranches.set(repoPath, currentBranch);
                this.outputChannel.appendLine(`🔄 Processing branch change: ${event.oldBranch} → ${event.newBranch}`);
                this.callbacks.forEach(callback => {
                    try {
                        callback(event);
                    }
                    catch (error) {
                        this.outputChannel.appendLine(`Error in branch change callback: ${error}`);
                    }
                });
            }
            if (currentCommit && currentCommit !== lastKnownCommit) {
                this.outputChannel.appendLine(`📝 New commit detected in ${repoPath}: ${lastKnownCommit || 'none'} → ${currentCommit}`);
                this.lastKnownCommits.set(repoPath, currentCommit);
                await this.checkForNewCommit(repoPath, currentBranch || 'unknown');
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error handling HEAD file change: ${error}`);
        }
    }
    async checkForNewCommit(repoPath, currentBranch) {
        try {
            const lastKnownCommit = this.lastKnownCommits.get(repoPath);
            if (!lastKnownCommit) {
                return;
            }
            const currentCommit = await this.getCurrentCommitFromFile(repoPath);
            if (currentCommit && currentCommit !== lastKnownCommit) {
                const commitMessage = await this.getCommitMessageFromFile(repoPath, currentCommit);
                this.outputChannel.appendLine(`📝 Last commit message: ${commitMessage}`);
                this.outputChannel.appendLine(`📝 Triggering commit callbacks for ${repoPath}...`);
                const event = {
                    workspacePath: repoPath,
                    branch: currentBranch,
                    commitHash: currentCommit,
                    commitMessage: commitMessage || 'No message',
                    timestamp: Date.now()
                };
                this.outputChannel.appendLine(`📝 Notifying commit callback...`);
                this.commitCallbacks.forEach(callback => {
                    try {
                        callback(event);
                    }
                    catch (error) {
                        this.outputChannel.appendLine(`Error in commit callback: ${error}`);
                    }
                });
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error checking for new commit: ${error}`);
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
                this.updateRepositoryWatchers();
            });
        }
    }
    async updateRepositoryWatchers() {
        if (!this.gitExtension?.exports) {
            this.outputChannel.appendLine('❌ Git extension exports not available');
            return;
        }
        const gitAPI = this.gitExtension.exports;
        // Check if we're in a Git repository
        if (!gitAPI.repositories || gitAPI.repositories.length === 0) {
            this.outputChannel.appendLine('⚠️ No Git repositories found in workspace');
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
            // Set up repository state change listener
            if (repo.state && repo.state.onDidChange) {
                const disposable = repo.state.onDidChange(() => {
                    this.handleRepositoryStateChange(repo);
                });
            }
            const currentBranch = repo.state?.head?.name || 'unknown';
            this.lastKnownBranches.set(repoPath, currentBranch);
            this.outputChannel.appendLine(`🌿 Initial branch for ${repoPath}: ${currentBranch}`);
        });
        // Set up repository change listener if available
        if (gitAPI.onDidChangeRepositories) {
            this.repositoryChangeDisposable = gitAPI.onDidChangeRepositories(() => {
                this.updateRepositoryWatchers();
            });
        }
    }
    handleRepositoryStateChange(repo) {
        try {
            const repoPath = repo.rootUri.fsPath;
            const newBranch = repo.state?.head?.name || 'unknown';
            const newCommit = repo.state?.head?.commit || 'unknown';
            const lastKnownBranch = this.lastKnownBranches.get(repoPath);
            const lastKnownCommit = this.lastKnownCommits.get(repoPath);
            if (newBranch !== lastKnownBranch || newCommit !== lastKnownCommit) {
                if (newBranch !== lastKnownBranch) {
                    this.outputChannel.appendLine(`🔄 Branch changed in ${repoPath}: ${lastKnownBranch || 'none'} → ${newBranch}`);
                    const event = {
                        workspacePath: repoPath,
                        oldBranch: lastKnownBranch || 'none',
                        newBranch: newBranch,
                        timestamp: Date.now(),
                        repository: repo
                    };
                    this.lastKnownBranches.set(repoPath, newBranch);
                    this.callbacks.forEach(callback => {
                        try {
                            callback(event);
                        }
                        catch (error) {
                            this.outputChannel.appendLine(`Error in branch change callback: ${error}`);
                        }
                    });
                }
                if (newCommit !== lastKnownCommit) {
                    this.lastKnownCommits.set(repoPath, newCommit);
                }
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error handling repository state change: ${error}`);
        }
    }
    setupActiveEditorTracking() {
        // Track active editor changes to identify which repository is active
        this.activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                const activeRepo = this.getRepositoryForUri(editor.document.uri);
                if (activeRepo) {
                    // Repository tracking active
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
        try {
            const ticketKey = this.extractJiraTicketKey(branchName);
            if (!ticketKey) {
                return null;
            }
            const ticketDetails = await this.fetchTicketDetails(ticketKey);
            const projectKey = ticketDetails.fields.project.key;
            const summary = ticketDetails.fields.summary;
            const status = ticketDetails.fields.status?.name;
            this.outputChannel.appendLine(`✅ SUCCESS: Found linked Jira ticket for branch "${branchName}"`);
            this.outputChannel.appendLine(`   🎫 Ticket: ${ticketKey}`);
            this.outputChannel.appendLine(`   📋 Project: ${projectKey} - ${ticketDetails.fields.project.name}`);
            this.outputChannel.appendLine(`   📝 Summary: ${summary}`);
            this.outputChannel.appendLine(`   🏷️ Issue Type: ${ticketDetails.fields.issuetype.name}`);
            this.outputChannel.appendLine(`   📊 Status: ${status}`);
            this.outputChannel.appendLine(`   🔗 Branch-Ticket Relationship: DIRECT LINK (Created from Jira)`);
            return {
                ticketId: ticketKey,
                projectKey: projectKey,
                summary: summary,
                status: status
            };
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error finding linked Jira ticket: ${error.message}`);
            return null;
        }
    }
    extractJiraTicketKey(branchName) {
        // Enhanced patterns for Jira ticket keys in branch names
        // Now supports numbers and special characters in project keys like CLUB59-234
        const patterns = [
            {
                name: "Basic pattern with numbers",
                regex: /([A-Z0-9]+-\d+)/,
                example: "CLUB59-234"
            },
            {
                name: "Feature branch pattern",
                regex: /(?:feature|bugfix|hotfix|release)\/([A-Z0-9]+-\d+)/i,
                example: "feature/CLUB59-234"
            },
            {
                name: "Branch prefix pattern",
                regex: /(?:branch|b)\/([A-Z0-9]+-\d+)/i,
                example: "branch/CLUB59-234"
            },
            {
                name: "Conventional commit pattern",
                regex: /(?:feat|fix|chore|task|story|bug)\/([A-Z0-9]+-\d+)/i,
                example: "feat/CLUB59-234"
            },
            {
                name: "Any prefix pattern",
                regex: /(?:[a-zA-Z0-9_-]+)\/([A-Z0-9]+-\d+)/i,
                example: "any-prefix/CLUB59-234"
            },
            {
                name: "Standalone pattern",
                regex: /^([A-Z0-9]+-\d+)$/i,
                example: "CLUB59-234"
            }
        ];
        for (let i = 0; i < patterns.length; i++) {
            const pattern = patterns[i];
            const match = branchName.match(pattern.regex);
            if (match) {
                this.outputChannel.appendLine(`✅ Found Jira ticket: ${match[1]} in branch "${branchName}"`);
                return match[1]; // Return the captured ticket key
            }
        }
        this.outputChannel.appendLine(`❌ No Jira ticket found in branch: "${branchName}"`);
        return null;
    }
    async fetchTicketDetails(ticketKey) {
        const credentials = await this.jiraService.getCurrentCredentials();
        if (!credentials) {
            this.outputChannel.appendLine(`❌ No Jira credentials found`);
            throw new Error('No Jira credentials configured');
        }
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