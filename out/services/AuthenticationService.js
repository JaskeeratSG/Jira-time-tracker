"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthenticationService = void 0;
const vscode = require("vscode");
class AuthenticationService {
    constructor(context) {
        this.STORAGE_KEY = 'jiraTimeTracker.users';
        this.ACTIVE_USER_KEY = 'jiraTimeTracker.activeUser';
        this.context = context;
    }
    /**
     * Authenticate a user with their JIRA credentials
     */
    async authenticateUser(credentials) {
        try {
            // Verify credentials by making a test API call
            const userInfo = await this.verifyCredentials(credentials);
            // Store credentials securely
            await this.storeUserCredentials(credentials);
            // Create authenticated user object
            const authenticatedUser = {
                email: credentials.email,
                displayName: userInfo.displayName || credentials.email,
                baseUrl: credentials.baseUrl,
                isActive: true,
                lastUsed: new Date(),
                hasProductiveAccess: userInfo.hasProductiveAccess
            };
            // Set as active user
            await this.setActiveUser(authenticatedUser);
            return authenticatedUser;
        }
        catch (error) {
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }
    /**
     * Verify user credentials by calling both JIRA and Productive APIs
     */
    async verifyCredentials(credentials) {
        const axios = require('axios');
        try {
            // Test JIRA API access
            console.log('Verifying JIRA credentials...');
            const jiraResponse = await axios.get(`${credentials.baseUrl}/rest/api/2/myself`, {
                auth: {
                    username: credentials.email,
                    password: credentials.apiToken
                },
                timeout: 10000
            });
            const jiraResult = {
                displayName: jiraResponse.data.displayName || jiraResponse.data.name,
                accountId: jiraResponse.data.accountId
            };
            // Test Productive API access if token provided
            let hasProductiveAccess = false;
            if (credentials.productiveApiToken) {
                try {
                    console.log('Verifying Productive credentials...');
                    // Get Productive config from environment
                    const productiveOrgId = process.env.PRODUCTIVE_ORGANIZATION_ID || '42335';
                    const productiveBaseUrl = process.env.PRODUCTIVE_BASE_URL || 'https://api.productive.io/api/v2';
                    const productiveResponse = await axios.get(`${productiveBaseUrl}/organization_memberships`, {
                        headers: {
                            'Content-Type': 'application/vnd.api+json',
                            'X-Auth-Token': credentials.productiveApiToken,
                            'X-Organization-Id': productiveOrgId
                        },
                        timeout: 10000
                    });
                    if (productiveResponse.data && productiveResponse.data.data && productiveResponse.data.data.length > 0) {
                        hasProductiveAccess = true;
                        console.log('✅ Productive credentials verified');
                    }
                }
                catch (productiveError) {
                    console.log('⚠️ Productive verification failed:', productiveError.message);
                    // Don't fail the whole auth process - JIRA is primary
                }
            }
            return {
                ...jiraResult,
                hasProductiveAccess
            };
        }
        catch (error) {
            if (error.response?.status === 401) {
                throw new Error('Invalid email or API token');
            }
            else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                throw new Error('Cannot connect to JIRA server. Please check the URL');
            }
            else {
                throw new Error(`Authentication error: ${error.message}`);
            }
        }
    }
    /**
     * Store user credentials securely
     */
    async storeUserCredentials(credentials) {
        const existingUsers = await this.getStoredUsers();
        // Update existing user or add new one
        const userIndex = existingUsers.findIndex(u => u.email === credentials.email);
        if (userIndex >= 0) {
            existingUsers[userIndex] = credentials;
        }
        else {
            existingUsers.push(credentials);
        }
        await this.context.secrets.store(this.STORAGE_KEY, JSON.stringify(existingUsers));
    }
    /**
     * Get all stored user credentials
     */
    async getStoredUsers() {
        const stored = await this.context.secrets.get(this.STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    }
    /**
     * Get stored users for display (without sensitive data)
     */
    async getUsers() {
        const users = await this.getStoredUsers();
        const activeUser = await this.getActiveUser();
        return users.map(user => ({
            email: user.email,
            displayName: user.displayName || user.email,
            baseUrl: user.baseUrl,
            isActive: activeUser?.email === user.email,
            lastUsed: new Date() // You could store this separately for real last used dates
        }));
    }
    /**
     * Set active user
     */
    async setActiveUser(user) {
        await this.context.globalState.update(this.ACTIVE_USER_KEY, user);
    }
    /**
     * Get currently active user
     */
    async getActiveUser() {
        return this.context.globalState.get(this.ACTIVE_USER_KEY, null);
    }
    /**
     * Get credentials for active user
     */
    async getActiveUserCredentials() {
        const activeUser = await this.getActiveUser();
        if (!activeUser) {
            return null;
        }
        const users = await this.getStoredUsers();
        return users.find(u => u.email === activeUser.email) || null;
    }
    /**
     * Get credentials for specific user by email
     */
    async getUserCredentials(email) {
        const users = await this.getStoredUsers();
        return users.find(u => u.email === email) || null;
    }
    /**
     * Get current user (alias for getActiveUser for consistency)
     */
    async getCurrentUser() {
        return this.getActiveUser();
    }
    /**
     * Switch to a different user
     */
    async switchUser(email) {
        const users = await this.getStoredUsers();
        const user = users.find(u => u.email === email);
        if (!user) {
            throw new Error(`User ${email} not found`);
        }
        // Verify credentials are still valid
        try {
            const userInfo = await this.verifyCredentials(user);
            const authenticatedUser = {
                email: user.email,
                displayName: userInfo.displayName || user.email,
                baseUrl: user.baseUrl,
                isActive: true,
                lastUsed: new Date()
            };
            await this.setActiveUser(authenticatedUser);
            return authenticatedUser;
        }
        catch (error) {
            throw new Error(`Failed to switch to user ${email}: ${error.message}`);
        }
    }
    /**
     * Remove a user
     */
    async removeUser(email) {
        const users = await this.getStoredUsers();
        const filteredUsers = users.filter(u => u.email !== email);
        await this.context.secrets.store(this.STORAGE_KEY, JSON.stringify(filteredUsers));
        // If removed user was active, clear active user
        const activeUser = await this.getActiveUser();
        if (activeUser?.email === email) {
            await this.context.globalState.update(this.ACTIVE_USER_KEY, null);
        }
    }
    /**
     * Sign out current user
     */
    async signOut() {
        await this.context.globalState.update(this.ACTIVE_USER_KEY, null);
    }
    /**
     * Check if user is authenticated
     */
    async isAuthenticated() {
        const activeUser = await this.getActiveUser();
        return activeUser !== null;
    }
    /**
     * Get fallback credentials from VS Code settings (for backward compatibility)
     */
    getFallbackCredentials() {
        const config = vscode.workspace.getConfiguration('jiraTimeTracker');
        const baseUrl = config.get('baseUrl');
        const email = config.get('email');
        const apiToken = config.get('apiToken');
        if (baseUrl && email && apiToken) {
            return {
                baseUrl,
                email,
                apiToken
            };
        }
        return null;
    }
}
exports.AuthenticationService = AuthenticationService;
//# sourceMappingURL=AuthenticationService.js.map