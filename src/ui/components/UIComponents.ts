// UI Components for Jira Time Tracker
// This provides a component-based approach while maintaining the same HTML output

export interface ComponentProps {
    [key: string]: any;
}

export abstract class BaseComponent {
    protected props: ComponentProps;

    constructor(props: ComponentProps = {}) {
        this.props = props;
    }

    abstract render(): string;
}

export class StylesComponent extends BaseComponent {
    render(): string {
        return `
            <style>
                body {
                    padding: 16px;
                    color: var(--vscode-foreground);
                    font-family: var(--vscode-font-family);
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    max-width: 100%;
                    box-sizing: border-box;
                }
                .timer {
                    font-size: 1.5em;
                    text-align: center;
                    margin: 8px 0;
                    font-family: monospace;
                }
                .button {
                    width: 40px;
                    height: 40px;
                    padding: 8px;
                    margin: 0;
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                    position: relative;
                }
                .button:hover {
                    background: var(--vscode-button-hoverBackground);
                    transform: translateY(-1px);
                }
                .button:active {
                    transform: translateY(0);
                }
                .button-icon {
                    font-size: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    height: 100%;
                }
                .button-tooltip {
                    position: absolute;
                    bottom: -30px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: var(--vscode-editorHoverWidget-background);
                    color: var(--vscode-editorHoverWidget-foreground);
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    white-space: nowrap;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                    pointer-events: none;
                    z-index: 1000;
                }
                .button:hover .button-tooltip {
                    opacity: 1;
                }
                .button-row {
                    display: flex;
                    gap: 8px;
                    margin: 8px 0;
                    justify-content: center;
                }
                .submit-button {
                    width: 100%;
                    padding: 8px 16px;
                    color: var(--vscode-button-foreground);
                    background: var(--vscode-button-background);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 600;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.2s ease;
                    margin: 8px 0;
                    box-sizing: border-box;
                }
                .submit-button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                .status {
                    text-align: center;
                    margin-bottom: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }
                .status-dot {
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                }
                .status-active {
                    background-color: #28a745;
                }
                .status-inactive {
                    background-color: #dc3545;
                }
                .select-container {
                    position: relative;
                    width: 100%;
                    max-width: 100%;
                    box-sizing: border-box;
                }
                .dropdown-select, select.dropdown-select {
                    width: 100%;
                    padding: 8px 12px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    font-size: 13px;
                    cursor: pointer;
                    box-sizing: border-box;
                    margin-bottom: 8px;
                    appearance: none;
                    background-image: url("data:image/svg+xml;charset=US-ASCII,<svg xmlns='http://www.w3.org/2000/svg' width='4' height='5'><path fill='%23666' d='M2 0L0 2h4zm0 5L0 3h4z'/></svg>");
                    background-repeat: no-repeat;
                    background-position: right 8px center;
                    background-size: 12px;
                }
                .dropdown-select:hover, select.dropdown-select:hover {
                    background: var(--vscode-input-background);
                    border-color: var(--vscode-focusBorder);
                }
                
                .dropdown-select:disabled, select.dropdown-select:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                .dropdown-options {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    max-height: 300px;
                    overflow-y: auto;
                    background: var(--vscode-dropdown-background);
                    border: 1px solid var(--vscode-dropdown-border);
                    border-radius: 4px;
                    z-index: 9999;
                    display: none;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                    margin-top: 4px;
                    opacity: 0;
                    transform: translateY(-10px);
                    transition: opacity 0.2s ease, transform 0.2s ease;
                    box-sizing: border-box;
                    width: 100%;
                }
                .dropdown-options.show {
                    display: block;
                    opacity: 1;
                    transform: translateY(0);
                }
                .dropdown-option {
                    padding: 8px 12px;
                    cursor: pointer;
                    font-size: 13px;
                    transition: all 0.2s ease;
                    border-bottom: 1px solid var(--vscode-dropdown-border);
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    box-sizing: border-box;
                    overflow: hidden;
                }
                .dropdown-option:last-child {
                    border-bottom: none;
                }
                .dropdown-option:hover {
                    background: var(--vscode-list-hoverBackground);
                }
                .dropdown-option.selected {
                    background: var(--vscode-list-activeSelectionBackground);
                    color: var(--vscode-list-activeSelectionForeground);
                }
                .dropdown-option strong {
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .dropdown-option span {
                    color: var(--vscode-descriptionForeground);
                    font-size: 12px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .notification-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1000;
                    width: 300px;
                }
                .notification {
                    padding: 12px 16px;
                    margin-bottom: 8px;
                    border-radius: 4px;
                    background: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.7s forwards;
                    border-left: 4px solid;
                    font-size: 13px;
                }
                .notification.success {
                    border-left-color: #28a745;
                }
                .notification.error {
                    border-left-color: #dc3545;
                }
                .notification.info {
                    border-left-color: #17a2b8;
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                .manual-time {
                    padding: 12px;
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    box-sizing: border-box;
                }
                .manual-time input {
                    width: 100%;
                    padding: 8px;
                    margin-bottom: 8px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    box-sizing: border-box;
                }
                .manual-time .button {
                    width: 100%;
                }
                .timer-section {
                    background: var(--vscode-editor-inactiveSelectionBackground);
                    padding: 12px;
                    border-radius: 4px;
                    box-sizing: border-box;
                }
                .section-title {
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    margin-bottom: 4px;
                }
                .section {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    width: 100%;
                    box-sizing: border-box;
                }
                .email-section {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 16px;
                    align-items: center;
                    padding: 12px;
                    background: var(--vscode-editor-inactiveSelectionBackground);
                    border-radius: 4px;
                    width: 100%;
                    box-sizing: border-box;
                }
                .email-input {
                    flex: 1;
                    min-width: 0;
                    padding: 8px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    font-size: 13px;
                }
                .auth-button {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 8px 12px;
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    white-space: nowrap;
                    user-select: none;
                    min-width: 120px;
                    text-align: center;
                }
                .auth-button:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }
                .auth-button .loader {
                    display: none;
                }
                .auth-button.loading .loader {
                    display: inline-block;
                }
                .auth-button.loading span {
                    display: none;
                }
                
                /* Authentication Section Styles */
                .auth-section {
                    background: var(--vscode-editor-inactiveSelectionBackground);
                    padding: 16px;
                    border-radius: 6px;
                    margin-bottom: 16px;
                }
                
                .current-user {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px;
                    background: var(--vscode-editor-background);
                    border-radius: 4px;
                    border: 1px solid var(--vscode-input-border);
                }
                
                .user-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                
                .user-name {
                    font-weight: 600;
                    color: var(--vscode-foreground);
                }
                
                .user-email {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                }
                
                .sign-in-form {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                
                .auth-input {
                    padding: 10px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    font-size: 13px;
                }
                
                .auth-input:focus {
                    outline: none;
                    border-color: var(--vscode-focusBorder);
                }
                
                .auth-help {
                    text-align: center;
                    margin-top: 8px;
                }
                
                .auth-help small {
                    color: var(--vscode-descriptionForeground);
                    font-size: 11px;
                }
                
                .auth-help a {
                    color: var(--vscode-textLink-foreground);
                    text-decoration: none;
                }
                
                .auth-help a:hover {
                    text-decoration: underline;
                }
                
                .secondary-button {
                    padding: 6px 12px;
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: background-color 0.2s ease;
                }
                
                .secondary-button:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                }
                
                .user-switcher {
                    margin-top: 16px;
                    padding-top: 16px;
                    border-top: 1px solid var(--vscode-input-border);
                }
                
                .section-subtitle {
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    margin-bottom: 8px;
                }
                
                .users-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-bottom: 12px;
                }
                
                .user-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 12px;
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .user-item:hover {
                    background: var(--vscode-list-hoverBackground);
                }
                
                .user-item.active {
                    background: var(--vscode-list-activeSelectionBackground);
                    color: var(--vscode-list-activeSelectionForeground);
                    border-color: var(--vscode-focusBorder);
                }
                
                .user-item-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                
                .user-item-name {
                    font-size: 13px;
                    font-weight: 500;
                }
                
                .user-item-email {
                    font-size: 11px;
                    opacity: 0.8;
                }
                
                .user-item-actions {
                    display: flex;
                    gap: 4px;
                }
                
                .icon-button {
                    width: 24px;
                    height: 24px;
                    padding: 0;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    border-radius: 3px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    transition: background-color 0.2s ease;
                }
                
                .icon-button:hover {
                    background: var(--vscode-toolbar-hoverBackground);
                }
            </style>
        `;
    }
}

export class NotificationComponent extends BaseComponent {
    render(): string {
        return `<div class="notification-container" id="notificationContainer"></div>`;
    }
}

export class AuthenticationSectionComponent extends BaseComponent {
    render(): string {
        return `
            <div class="auth-section">
                <div class="section-title">🔐 Authentication</div>
                
                <!-- Current User Display -->
                <div id="currentUserDisplay" class="current-user" style="display: none;">
                    <div class="user-info">
                        <span class="user-name" id="currentUserName">Not signed in</span>
                        <span class="user-email" id="currentUserEmail"></span>
                    </div>
                    <button id="signOutBtn" class="secondary-button">Sign Out</button>
                </div>

                <!-- Sign In Form -->
                <div id="signInForm" class="sign-in-form">
                    <input type="url" id="jiraUrlInput" class="auth-input" placeholder="JIRA URL (e.g., https://company.atlassian.net)" required>
                    <input type="email" id="emailInput" class="auth-input" placeholder="Your JIRA email (auto-detecting from git...)" required>
                    <input type="password" id="apiTokenInput" class="auth-input" placeholder="API Token" required>
                    <button id="signInBtn" class="auth-button" type="button">
                        <div class="loader"></div>
                        <span>Sign In</span>
                    </button>
                    <div class="auth-help">
                        <small>Need an API token? <a href="#" onclick="window.openApiTokenHelp()">Get one here</a></small>
                    </div>
                </div>

                <!-- User Switcher -->
                <div id="userSwitcher" class="user-switcher" style="display: none;">
                    <div class="section-subtitle">Switch User</div>
                    <div id="usersList" class="users-list"></div>
                    <button id="addUserBtn" class="secondary-button">+ Add Another User</button>
                </div>
                
                <!-- Load Projects Button -->
                <div id="loadProjectsSection" style="display: none;">
                    <button id="loadProjectsBtn" class="auth-button" type="button" style="width: 100%; margin-top: 12px;">
                        <div class="loader"></div>
                        <span>Load Projects</span>
                    </button>
                </div>
            </div>
        `;
    }
}

export class EmailSectionComponent extends BaseComponent {
    render(): string {
        const { placeholder = "Enter your Jira email", buttonText = "Load Projects" } = this.props;
        
        return `
            <div class="email-section">
                <input type="email" id="emailInput" class="email-input" placeholder="${placeholder}">
                <button id="loadProjectsBtn" class="auth-button" type="button">
                    <div class="loader"></div>
                    <span>${buttonText}</span>
                </button>
            </div>
        `;
    }
}

export class DropdownComponent extends BaseComponent {
    render(): string {
        const { 
            id, 
            title = "Select Option", 
            optionsId,
            onToggle 
        } = this.props;
        
        return `
            <div class="select-container">
                <div class="dropdown-select" id="${id}" onclick="${onToggle}">
                    <span>${title}</span>
                    <span>▼</span>
                </div>
                <div class="dropdown-options" id="${optionsId}"></div>
            </div>
        `;
    }
}

export class ProjectIssueSelectionComponent extends BaseComponent {
    render(): string {
        return `
            <div class="section">
                <div class="section-title">Project & Issue</div>
                <select id="projectSelect" class="dropdown-select" onchange="onProjectChange()" disabled>
                    <option value="">Select Project</option>
                </select>
                <select id="issueSelect" class="dropdown-select" disabled>
                    <option value="">Select Issue</option>
                </select>
                <button class="submit-button" onclick="clearAll()">
                    <span>Clear All</span>
                </button>
            </div>
        `;
    }
}

export class TimerButtonComponent extends BaseComponent {
    render(): string {
        const { icon, tooltip, onClick } = this.props;
        
        return `
            <button class="button" onclick="${onClick}">
                <span class="button-icon">${icon}</span>
                <span class="button-tooltip">${tooltip}</span>
            </button>
        `;
    }
}

export class TimerSectionComponent extends BaseComponent {
    render(): string {
        return `
            <div class="section">
                <div class="section-title">Timer</div>
                <div class="timer-section">
                    <div class="status">
                        <span class="status-dot" id="statusDot"></span>
                        <span id="statusText">Inactive</span>
                    </div>
                    <div class="timer" id="timeDisplay">00:00:00</div>
                    
                    <div class="button-row">
                        <button id="startBtn" class="button" onclick="startTimer()">
                            <span class="button-icon">▶️</span>
                            <span class="button-tooltip">Start Timer</span>
                        </button>
                        <button id="stopBtn" class="button" onclick="stopTimer()" style="display: none;">
                            <span class="button-icon">⏹️</span>
                            <span class="button-tooltip">Stop Timer</span>
                        </button>
                        <button id="resumeBtn" class="button" onclick="resumeTimer()">
                            <span class="button-icon">⏯️</span>
                            <span class="button-tooltip">Resume Timer</span>
                        </button>
                    </div>

                    <button id="submitBtn" class="submit-button" onclick="submitTime()" style="display: none;">
                        <span>Submit Time</span>
                    </button>
                </div>
            </div>
        `;
    }
}

export class ManualTimeLogComponent extends BaseComponent {
    render(): string {
        return `
            <div class="section">
                <div class="section-title">Manual Time Log</div>
                <div class="manual-time">
                    <input type="text" id="manualTimeInput" placeholder="Enter time (e.g., 5h, 30m, 1h 30m, 1.5h)">
                    <button class="button" onclick="submitManualTime()">Log Manual Time</button>
                </div>
            </div>
        `;
    }
}

export class JavaScriptComponent extends BaseComponent {
    render(): string {
        return `
            <script>
                const vscode = acquireVsCodeApi();
                let currentUser = null;
                let isAuthenticated = false;
                
                // Notification system
                function showNotification(message, type = 'info') {
                    const container = document.getElementById('notificationContainer');
                    const notification = document.createElement('div');
                    notification.className = \`notification notification-\${type}\`;
                    notification.innerHTML = \`
                        <span>\${message}</span>
                        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
                    \`;
                    container.appendChild(notification);
                    
                    // Auto-remove after 5 seconds
                    setTimeout(() => {
                        if (notification.parentElement) {
                            notification.remove();
                        }
                    }, 5000);
                }

                // Authentication handlers
                function setupAuthenticationHandlers() {
                    // Sign in form
                    const signInBtn = document.getElementById('signInBtn');
                    if (signInBtn) {
                        signInBtn.addEventListener('click', function() {
                            const jiraUrl = document.getElementById('jiraUrlInput').value.trim();
                            const email = document.getElementById('emailInput').value.trim();
                            const apiToken = document.getElementById('apiTokenInput').value.trim();
                            
                            if (!jiraUrl || !email || !apiToken) {
                                showNotification('Please fill in all fields', 'error');
                                return;
                            }
                            
                            // Show loading state
                            signInBtn.disabled = true;
                            signInBtn.classList.add('loading');
                            
                            vscode.postMessage({
                                type: 'signIn',
                                baseUrl: jiraUrl,
                                email: email,
                                apiToken: apiToken
                            });
                        });
                    }
                    
                    // Sign out button
                    const signOutBtn = document.getElementById('signOutBtn');
                    if (signOutBtn) {
                        signOutBtn.addEventListener('click', function() {
                            vscode.postMessage({ type: 'signOut' });
                        });
                    }
                    
                    // Add user button
                    const addUserBtn = document.getElementById('addUserBtn');
                    if (addUserBtn) {
                        addUserBtn.addEventListener('click', function() {
                            showSignInForm();
                        });
                    }
                }
                
                function checkAuthenticationStatus() {
                    vscode.postMessage({ type: 'checkAuthStatus' });
                }
                
                function updateAuthenticationUI(authData) {
                    const currentUserDisplay = document.getElementById('currentUserDisplay');
                    const signInForm = document.getElementById('signInForm');
                    const userSwitcher = document.getElementById('userSwitcher');
                    const loadProjectsSection = document.getElementById('loadProjectsSection');
                    const signInBtn = document.getElementById('signInBtn');
                    
                    // Reset sign in button state
                    if (signInBtn) {
                        signInBtn.disabled = false;
                        signInBtn.classList.remove('loading');
                    }
                    
                    isAuthenticated = authData.isAuthenticated;
                    currentUser = authData.user;
                    
                    if (authData.isAuthenticated && authData.user) {
                        // Show current user info
                        const userNameEl = document.getElementById('currentUserName');
                        const userEmailEl = document.getElementById('currentUserEmail');
                        
                        if (userNameEl) userNameEl.textContent = authData.user.displayName;
                        if (userEmailEl) userEmailEl.textContent = authData.user.email;
                        
                        if (currentUserDisplay) currentUserDisplay.style.display = 'flex';
                        if (signInForm) signInForm.style.display = 'none';
                        if (userSwitcher) userSwitcher.style.display = 'block';
                        if (loadProjectsSection) loadProjectsSection.style.display = 'block';
                        
                        // Clear sign in form
                        clearSignInForm();
                        
                        // Auto-load projects for the authenticated user
                        setTimeout(() => loadProjectsForUser(), 1000);
                    } else {
                        // Show sign in form
                        if (currentUserDisplay) currentUserDisplay.style.display = 'none';
                        if (signInForm) signInForm.style.display = 'flex';
                        if (userSwitcher) userSwitcher.style.display = 'none';
                        if (loadProjectsSection) loadProjectsSection.style.display = 'none';
                        
                        // Show error if provided
                        if (authData.error) {
                            showNotification(authData.error, 'error');
                        }
                    }
                }
                
                function updateUsersList(users) {
                    const usersList = document.getElementById('usersList');
                    if (!usersList) return;
                    
                    usersList.innerHTML = '';
                    
                    users.forEach(user => {
                        const userItem = document.createElement('div');
                        userItem.className = \`user-item \${user.isActive ? 'active' : ''}\`;
                        userItem.innerHTML = \`
                            <div class="user-item-info">
                                <div class="user-item-name">\${user.displayName}</div>
                                <div class="user-item-email">\${user.email}</div>
                            </div>
                            <div class="user-item-actions">
                                \${!user.isActive ? '<button class="icon-button" onclick="switchUser(\\'' + user.email + '\\')">↻</button>' : ''}
                                <button class="icon-button" onclick="removeUser('\\'' + user.email + '\\')" title="Remove user">×</button>
                            </div>
                        \`;
                        
                        if (!user.isActive) {
                            userItem.addEventListener('click', () => switchUser(user.email));
                        }
                        
                        usersList.appendChild(userItem);
                    });
                }
                
                function switchUser(email) {
                    vscode.postMessage({
                        type: 'switchUser',
                        email: email
                    });
                }
                
                function removeUser(email) {
                    if (confirm(\`Remove user \${email}?\`)) {
                        vscode.postMessage({
                            type: 'removeUser',
                            email: email
                        });
                    }
                }
                
                function showSignInForm() {
                    const signInForm = document.getElementById('signInForm');
                    const userSwitcher = document.getElementById('userSwitcher');
                    
                    if (signInForm) signInForm.style.display = 'flex';
                    if (userSwitcher) userSwitcher.style.display = 'none';
                }
                
                function clearSignInForm() {
                    const inputs = ['jiraUrlInput', 'emailInput', 'apiTokenInput'];
                    inputs.forEach(id => {
                        const input = document.getElementById(id);
                        if (input) input.value = '';
                    });
                }
                
                function openApiTokenHelp() {
                    // This would open the JIRA API token help page
                    showNotification('Generate API token at: Your JIRA → Account Settings → Security → API tokens', 'info');
                }
                
                // Make functions available globally
                window.openApiTokenHelp = openApiTokenHelp;
                window.startTimer = startTimer;
                window.stopTimer = stopTimer;
                window.resumeTimer = resumeTimer;
                window.submitTime = submitTime;
                window.submitManualTime = submitManualTime;
                window.onProjectChange = onProjectChange;
                window.clearAll = clearAll;
                
                // Clear all selections
                function clearAll() {
                    const projectSelect = document.getElementById('projectSelect');
                    const issueSelect = document.getElementById('issueSelect');
                    
                    if (projectSelect) {
                        projectSelect.value = '';
                        projectSelect.disabled = false;
                    }
                    if (issueSelect) {
                        issueSelect.innerHTML = '<option value="">Select Issue</option>';
                        issueSelect.disabled = true;
                    }
                }

                // Message handling from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    console.log('Received message:', message);
                    
                    switch (message.type) {
                        case 'notification':
                            showNotification(message.message, message.notificationType);
                            break;
                        case 'authenticationStatus':
                            updateAuthenticationUI(message);
                            break;
                        case 'usersList':
                            updateUsersList(message.users);
                            break;
                        case 'update':
                            const timeSpan = document.getElementById('timeDisplay');
                            const statusText = document.getElementById('statusText');
                            const statusDot = document.getElementById('statusDot');

                            if (timeSpan) {
                                timeSpan.textContent = message.time;
                            }
                            
                            if (statusText && statusDot) {
                                if (message.isTracking) {
                                    statusText.textContent = 'Active';
                                    statusDot.className = 'status-dot status-active';
                                } else {
                                    statusText.textContent = 'Inactive';
                                    statusDot.className = 'status-dot status-inactive';
                                }
                            }
                            
                            updateButtonStates(message.isTracking);
                            break;
                        case 'projects':
                            console.log('Received projects:', message.projects);
                            const projectSelect = document.getElementById('projectSelect');
                            if (projectSelect) {
                                projectSelect.innerHTML = '<option value="">Select Project</option>';
                                message.projects.forEach(project => {
                                    const option = document.createElement('option');
                                    option.value = project.key;
                                    option.textContent = \`\${project.name} (\${project.key})\`;
                                    projectSelect.appendChild(option);
                                });
                                projectSelect.disabled = false;
                                
                                // Reset issues dropdown
                                const issueSelect = document.getElementById('issueSelect');
                                if (issueSelect) {
                                    issueSelect.innerHTML = '<option value="">Select Issue</option>';
                                    issueSelect.disabled = true;
                                }
                                
                                showNotification(\`Loaded \${message.projects.length} projects\`, 'success');
                            }
                            
                            // Reset button state
                            const loadBtn = document.getElementById('loadProjectsBtn');
                            if (loadBtn) {
                                loadBtn.disabled = false;
                                loadBtn.classList.remove('loading');
                            }
                            break;
                        case 'issues':
                            console.log('Received issues:', message.issues);
                            const issueSelect = document.getElementById('issueSelect');
                            if (issueSelect) {
                                issueSelect.innerHTML = '<option value="">Select Issue</option>';
                                message.issues.forEach(issue => {
                                    const option = document.createElement('option');
                                    option.value = issue.key;
                                    option.textContent = \`\${issue.summary} (\${issue.key})\`;
                                    issueSelect.appendChild(option);
                                });
                                issueSelect.disabled = false;
                                
                                showNotification(\`Loaded \${message.issues.length} issues\`, 'success');
                            }
                            break;
                        case 'load-failed':
                            const loadProjectsBtn = document.getElementById('loadProjectsBtn');
                            if (loadProjectsBtn) {
                                loadProjectsBtn.disabled = false;
                                loadProjectsBtn.classList.remove('loading');
                            }
                            break;
                        case 'clear-manual-input':
                            const manualTimeInput = document.getElementById('manualTimeInput');
                            if (manualTimeInput) {
                                manualTimeInput.value = '';
                            }
                            
                            // Reset button state
                            const manualTimeBtn = document.querySelector('.manual-time .button');
                            if (manualTimeBtn) {
                                manualTimeBtn.disabled = false;
                                manualTimeBtn.textContent = 'Log Manual Time';
                            }
                            break;
                        case 'branch-info':
                            console.log('Received branch info:', message);
                            const projectSelect2 = document.getElementById('projectSelect');
                            const issueSelect2 = document.getElementById('issueSelect');
                            
                            if (projectSelect2 && message.projectKey) {
                                // Set project if it exists in dropdown
                                const projectOption = projectSelect2.querySelector(\`option[value="\${message.projectKey}"]\`);
                                if (projectOption) {
                                    projectSelect2.value = message.projectKey;
                                    // Trigger change event to load issues
                                    projectSelect2.dispatchEvent(new Event('change'));
                                }
                            }
                            
                            // Set issue after a short delay to allow issues to load
                            if (issueSelect2 && message.issueKey) {
                                setTimeout(() => {
                                    const issueOption = issueSelect2.querySelector(\`option[value="\${message.issueKey}"]\`);
                                    if (issueOption) {
                                        issueSelect2.value = message.issueKey;
                                    }
                                }, 500);
                            }
                            break;
                        case 'git-email':
                            // Pre-fill the authentication email field with git email if not signed in
                            if (!isAuthenticated) {
                                const emailInput = document.getElementById('emailInput');
                                if (emailInput && message.email) {
                                    emailInput.value = message.email;
                                    emailInput.placeholder = \`Git email detected: \${message.email}\`;
                                    console.log('Populated git email:', message.email);
                                    
                                    // Show helpful notification
                                    showNotification(\`Git email auto-detected: \${message.email}\`, 'info');
                                }
                            }
                            break;
                        case 'manual-time-error':
                            // Reset button state on error
                            const manualTimeBtnError = document.querySelector('.manual-time .button');
                            if (manualTimeBtnError) {
                                manualTimeBtnError.disabled = false;
                                manualTimeBtnError.textContent = 'Log Manual Time';
                            }
                            break;
                    }
                });

                // Button event handlers
                function startTimer() {
                    if (!isAuthenticated) {
                        showNotification('Please sign in first', 'error');
                        return;
                    }
                    
                    const issueSelect = document.getElementById('issueSelect');
                    const issueKey = issueSelect ? issueSelect.value : '';
                    
                    if (!issueKey) {
                        showNotification('Please select an issue first', 'error');
                        return;
                    }
                    
                    vscode.postMessage({ 
                        type: 'startTimer',
                        issueKey: issueKey
                    });
                }

                function stopTimer() {
                    vscode.postMessage({ type: 'stopTimer' });
                }

                function resumeTimer() {
                    vscode.postMessage({ type: 'resumeTimer' });
                }

                function submitTime() {
                    vscode.postMessage({ type: 'submitTime' });
                }

                function updateButtonStates(isTracking = false) {
                    const startBtn = document.getElementById('startBtn');
                    const stopBtn = document.getElementById('stopBtn');
                    const resumeBtn = document.getElementById('resumeBtn');
                    const submitBtn = document.getElementById('submitBtn');

                    if (startBtn) startBtn.style.display = isTracking ? 'none' : 'inline-block';
                    if (stopBtn) stopBtn.style.display = isTracking ? 'inline-block' : 'none';
                    if (resumeBtn) resumeBtn.style.display = isTracking ? 'none' : 'inline-block';
                    if (submitBtn) submitBtn.style.display = isTracking ? 'inline-block' : 'none';
                }

                // Project selection handler
                function onProjectChange() {
                    if (!isAuthenticated) {
                        showNotification('Please sign in first', 'error');
                        return;
                    }
                    
                    const projectSelect = document.getElementById('projectSelect');
                    const projectKey = projectSelect ? projectSelect.value : '';
                    
                    if (projectKey) {
                        vscode.postMessage({
                            type: 'loadIssues',
                            projectKey: projectKey
                        });
                    } else {
                        // Reset issues dropdown
                        const issueSelect = document.getElementById('issueSelect');
                        if (issueSelect) {
                            issueSelect.innerHTML = '<option value="">Select Issue</option>';
                            issueSelect.disabled = true;
                        }
                    }
                }

                // Manual time logging
                function submitManualTime() {
                    if (!isAuthenticated) {
                        showNotification('Please sign in first', 'error');
                        return;
                    }
                    
                    const issueSelect = document.getElementById('issueSelect');
                    const timeInput = document.getElementById('manualTimeInput');
                    
                    const issueKey = issueSelect ? issueSelect.value : '';
                    const timeSpent = timeInput ? timeInput.value.trim() : '';
                    
                    if (!issueKey) {
                        showNotification('Please select an issue first', 'error');
                        return;
                    }
                    
                    if (!timeSpent) {
                        showNotification('Please enter time (e.g., 5h, 30m, 1h 30m, 1.5h)', 'error');
                        return;
                    }
                    
                    // Show loading state
                    const manualTimeBtn = document.querySelector('.manual-time .button');
                    if (manualTimeBtn) {
                        manualTimeBtn.disabled = true;
                        manualTimeBtn.textContent = 'Logging...';
                    }
                    
                    vscode.postMessage({
                        type: 'manualTimeLog',
                        issueKey: issueKey,
                        timeSpent: timeSpent
                    });
                }

                // Load projects for authenticated user
                function loadProjectsForUser() {
                    if (!isAuthenticated || !currentUser) {
                        showNotification('Please sign in first', 'error');
                        return;
                    }
                    
                    const loadBtn = document.getElementById('loadProjectsBtn');
                    if (loadBtn) {
                        loadBtn.disabled = true;
                        loadBtn.classList.add('loading');
                    }
                    
                    vscode.postMessage({
                        type: 'loadProjects',
                        email: currentUser.email
                    });
                }

                // Load git email on startup
                function loadGitEmail() {
                    vscode.postMessage({ type: 'loadBranchInfo' });
                }

                // Initialize everything
                updateButtonStates();

                document.addEventListener('DOMContentLoaded', function() {
                    setupAuthenticationHandlers();
                    checkAuthenticationStatus();
                    loadGitEmail();
                    
                    // Update legacy load projects button to work with authentication
                    const loadProjectsBtn = document.getElementById('loadProjectsBtn');
                    if (loadProjectsBtn) {
                        loadProjectsBtn.addEventListener('click', loadProjectsForUser);
                    }
                });
            </script>
        `;
    }
}

export class MainLayoutComponent extends BaseComponent {
    render(): string {
        const styles = new StylesComponent();
        const notifications = new NotificationComponent();
        const authSection = new AuthenticationSectionComponent();
        const projectIssueSelection = new ProjectIssueSelectionComponent();
        const timerSection = new TimerSectionComponent();
        const manualTimeLog = new ManualTimeLogComponent();
        const javascript = new JavaScriptComponent();

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${styles.render()}
        </head>
        <body>
            ${notifications.render()}
            ${authSection.render()}
            ${projectIssueSelection.render()}
            ${timerSection.render()}
            ${manualTimeLog.render()}
            ${javascript.render()}
        </body>
        </html>`;
    }
} 