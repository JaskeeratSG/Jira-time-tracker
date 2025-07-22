import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface WorkspaceFolder {
    uri: {
        fsPath: string;
    };
}

interface Workspace {
    workspaceFolders: WorkspaceFolder[] | undefined;
}

export class GitService {
    private workspace: Workspace;

    constructor() {
        // Use real vscode in extension, mock in tests
        if (process.env.NODE_ENV === 'test') {
            const mock = require('../test/mocks/vscode.mock');
            this.workspace = mock.workspace;
        } else {
            // Dynamically import vscode only when not in test environment
            const vscode = require('vscode');
            this.workspace = vscode.workspace;
        }
    }

    /**
     * Get the current branch name
     * @returns Promise<string> The current branch name
     */
    public async getBranchName(): Promise<string> {
        try {
            const workspaceFolders = this.workspace.workspaceFolders;
            if (!workspaceFolders) {
                throw new Error('No workspace folder found');
            }

            const { stdout } = await execAsync('git branch --show-current', {
                cwd: workspaceFolders[0].uri.fsPath
            });

            return stdout.trim();
        } catch (error) {
            throw new Error(`Failed to get branch name: ${(error as any).message}`);
        }
    }

    /**
     * Get a Git configuration value
     * @param key The Git config key to retrieve
     * @returns Promise<string> The configuration value
     */
    public async getConfig(key: string): Promise<string> {
        try {
            const { stdout } = await execAsync(`git config --get ${key}`);
            return stdout.trim();
        } catch (error) {
            throw new Error(`Failed to get git config ${key}: ${(error as any).message}`);
        }
    }

    /**
     * Get the current commit hash
     * @returns Promise<string> The current commit hash
     */
    public async getCurrentCommit(): Promise<string> {
        try {
            const { stdout } = await execAsync('git rev-parse HEAD');
            return stdout.trim();
        } catch (error) {
            throw new Error(`Failed to get current commit: ${(error as any).message}`);
        }
    }

    /**
     * Get the remote repository URL
     * @returns Promise<string> The remote repository URL
     */
    public async getRemoteUrl(): Promise<string> {
        try {
            const { stdout } = await execAsync('git config --get remote.origin.url');
            return stdout.trim();
        } catch (error) {
            throw new Error(`Failed to get remote URL: ${(error as any).message}`);
        }
    }

    /**
     * Get the user's email from Git config
     * @returns Promise<string> The user's email
     */
    public async getUserEmail(): Promise<string> {
        return this.getConfig('user.email');
    }

    /**
     * Get the user's name from Git config
     * @returns Promise<string> The user's name
     */
    public async getUserName(): Promise<string> {
        return this.getConfig('user.name');
    }

    /**
     * Extract JIRA ticket ID from branch name (supports various patterns)
     * @param branchName The branch name to extract from
     * @returns string | null The extracted JIRA ticket ID or null if not found
     */
    public extractTicketId(branchName: string): string | null {
        // Pattern 1: Jira-generated branches: SCRUM-2-implement-authentication
        let match = branchName.match(/^([A-Z]+-\d+)(?:-.*)?$/i);
        if (match) return match[1];
        
        // Pattern 2: Manual feature branches: feature/SCRUM-2 or feat/SCRUM-2-description
        match = branchName.match(/(?:feature|feat|fix|bugfix)\/([A-Z]+-\d+)(?:-.*)?/i);
        if (match) return match[1];
        
        // Pattern 3: Any branch containing ticket ID: any-prefix-SCRUM-2-any-suffix
        match = branchName.match(/.*?([A-Z]+-\d+).*?/i);
        if (match) return match[1];
        
        return null;
    }

    /**
     * Validate if a branch name contains a valid JIRA ticket ID
     * @param branchName The branch name to validate
     * @returns boolean Whether the branch name contains a valid ticket ID
     */
    public isValidBranchFormat(branchName: string): boolean {
        return this.extractTicketId(branchName) !== null;
    }

    /**
     * Extract project key from ticket ID
     * @param ticketId The ticket ID (e.g., "SCRUM-2")
     * @returns string | null The project key (e.g., "SCRUM") or null if invalid
     */
    public extractProjectKey(ticketId: string): string | null {
        const match = ticketId.match(/^([A-Z]+)-\d+$/i);
        return match ? match[1] : null;
    }

    /**
     * Get all Git-related information in one call
     * @returns Promise<GitInfo> Object containing all Git information
     */
    public async getAllGitInfo(): Promise<GitInfo> {
        const branchName = await this.getBranchName();
        const ticketId = this.extractTicketId(branchName);
        
        return {
            branchName,
            ticketId,
            isValidBranchFormat: this.isValidBranchFormat(branchName),
            userEmail: await this.getUserEmail(),
            userName: await this.getUserName(),
            remoteUrl: await this.getRemoteUrl(),
            currentCommit: await this.getCurrentCommit()
        };
    }
}

/**
 * Interface for Git information
 */
export interface GitInfo {
    branchName: string;
    ticketId: string | null;
    isValidBranchFormat: boolean;
    userEmail: string;
    userName: string;
    remoteUrl: string;
    currentCommit: string;
} 