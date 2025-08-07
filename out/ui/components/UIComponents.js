"use strict";
// UI Components for Jira Time Tracker
// This provides a component-based approach while maintaining the same HTML output
Object.defineProperty(exports, "__esModule", { value: true });
exports.MainLayoutComponent = exports.JavaScriptComponent = exports.TicketInfoComponent = exports.ManualTimeLogComponent = exports.TimerSectionComponent = exports.TimerButtonComponent = exports.ProjectIssueSelectionComponent = exports.DropdownComponent = exports.EmailSectionComponent = exports.AuthenticationSectionComponent = exports.NotificationComponent = exports.StylesComponent = exports.BaseComponent = void 0;
class BaseComponent {
    constructor(props = {}) {
        this.props = props;
    }
}
exports.BaseComponent = BaseComponent;
class StylesComponent extends BaseComponent {
    render() {
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
                    display: none;
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
                    display: none;
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
                
                .auth-section-title {
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    margin-bottom: 8px;
                    padding-bottom: 4px;
                    border-bottom: 1px solid var(--vscode-input-border);
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
                .project-issue-selection{
                   display:none;
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
                
                .service-section {
                    margin-bottom: 16px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid var(--vscode-input-border);
                }
                
                .service-section:last-child {
                    border-bottom: none;
                    margin-bottom: 0;
                }
                
                .service-title {
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    margin-bottom: 8px;
                }
                
                .auth-note {
                    font-size: 10px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 4px;
                    display: block;
                }
                
                /* Pagination Controls */
                .pagination-controls {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    margin-top: 8px;
                    padding: 8px;
                    background: var(--vscode-input-background);
                    border-radius: 4px;
                    border: 1px solid var(--vscode-input-border);
                }
                
                .pagination-btn {
                    padding: 4px 8px;
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: 1px solid var(--vscode-button-border);
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 11px;
                    transition: all 0.2s ease;
                }
                
                .pagination-btn:hover:not(:disabled) {
                    background: var(--vscode-button-hoverBackground);
                }
                
                .pagination-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                .page-info {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    min-width: 80px;
                    text-align: center;
                }
                
                /* Smart Search Styles */
                .smart-search-container {
                    position: relative;
                    margin-bottom: 8px;
                }
                
                .smart-search-input {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    font-size: 13px;
                    box-sizing: border-box;
                    transition: border-color 0.2s ease;
                }
                
                .smart-search-input:focus {
                    outline: none;
                    border-color: var(--vscode-focusBorder);
                }
                
                .smart-search-input:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                
                .search-results {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: var(--vscode-dropdown-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                    z-index: 1000;
                    max-height: 300px;
                    overflow: hidden;
                }
                
                .search-results-list {
                    max-height: 250px;
                    overflow-y: auto;
                }
                
                .search-result-item {
                    padding: 8px 12px;
                    cursor: pointer;
                    font-size: 12px;
                    border-bottom: 1px solid var(--vscode-input-border);
                    transition: background-color 0.2s ease;
                }
                
                .search-result-item:hover {
                    background: var(--vscode-list-hoverBackground);
                }
                
                .search-result-item.selected {
                    background: var(--vscode-list-activeSelectionBackground);
                    color: var(--vscode-list-activeSelectionForeground);
                }
                
                .no-results-message {
                    padding: 12px;
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                    font-size: 12px;
                }
                
                .search-highlight {
                    background: var(--vscode-textPreformat-background);
                    padding: 1px 2px;
                    border-radius: 2px;
                }
                
                /* Ticket Info Component Styles */
                .ticket-info-section {
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 16px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    transition: all 0.3s ease;
                }
                
                .ticket-info-header {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    margin-bottom: 16px;
                }
                
                .ticket-icon {
                    font-size: 24px;
                    flex-shrink: 0;
                }
                
                .ticket-title {
                    flex: 1;
                    min-width: 0;
                }
                
                .ticket-key {
                    font-size: 16px;
                    font-weight: 700;
                    color: var(--vscode-foreground);
                    margin-bottom: 4px;
                    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
                }
                
                .ticket-summary {
                    font-size: 14px;
                    color: var(--vscode-descriptionForeground);
                    line-height: 1.4;
                    word-wrap: break-word;
                }
                
                .ticket-details {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-bottom: 16px;
                }
                
                .ticket-project, .ticket-status {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 12px;
                    background: var(--vscode-editor-inactiveSelectionBackground);
                    border-radius: 4px;
                }
                
                .ticket-description {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                
                .label {
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--vscode-descriptionForeground);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .value {
                    font-size: 13px;
                    color: var(--vscode-foreground);
                    font-weight: 500;
                }
                
                .description-content {
                    background: var(--vscode-editor-inactiveSelectionBackground);
                    padding: 12px;
                    border-radius: 4px;
                    font-size: 13px;
                    line-height: 1.5;
                    color: var(--vscode-foreground);
                    max-height: 120px;
                    overflow-y: auto;
                    white-space: pre-wrap;
                    position: relative;
                }
                
                .description-content.truncated::after {
                    content: "...";
                    position: absolute;
                    bottom: 8px;
                    right: 12px;
                    background: var(--vscode-editor-inactiveSelectionBackground);
                    padding: 0 4px;
                    color: var(--vscode-descriptionForeground);
                    font-size: 12px;
                    font-weight: 600;
                    border-radius: 2px;
                }
                
                .description-content.truncated {
                    mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
                    -webkit-mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
                }
                
                .ticket-actions {
                    display: flex;
                    gap: 8px;
                    justify-content: flex-start;
                }
                
                .action-button {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 12px;
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                    text-decoration: none;
                }
                
                .action-button:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                    transform: translateY(-1px);
                }
                
                .action-icon {
                    font-size: 14px;
                }
                
                .close-ticket-btn {
                    background: var(--vscode-errorForeground) !important;
                    color: var(--vscode-errorBackground) !important;
                }
                
                .close-ticket-btn:hover {
                    background: var(--vscode-errorForeground) !important;
                    opacity: 0.8;
                }
                
                /* Animation for ticket info appearance */
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                .ticket-info-section.show {
                    animation: slideDown 0.3s ease;
                }
            </style>
        `;
    }
}
exports.StylesComponent = StylesComponent;
class NotificationComponent extends BaseComponent {
    render() {
        return `<div class="notification-container" id="notificationContainer"></div>`;
    }
}
exports.NotificationComponent = NotificationComponent;
class AuthenticationSectionComponent extends BaseComponent {
    render() {
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
                    <div class="service-section">
                        <div class="service-title">📋 JIRA Configuration</div>
                        <input type="url" id="jiraUrlInput" class="auth-input" placeholder="JIRA URL (e.g., https://company.atlassian.net)" required>
                        <input type="email" id="emailInput" class="auth-input" placeholder="Your JIRA email (auto-detecting from git...)" required>
                        <input type="password" id="jiraApiTokenInput" class="auth-input" placeholder="JIRA API Token" required>
                    </div>
                    
                    <div class="service-section">
                        <div class="service-title">🛠️ Productive Configuration</div>
                        <input type="password" id="productiveApiTokenInput" class="auth-input" placeholder="Productive API Token" required>
                        <small class="auth-note">Organization configured</small>
                    </div>
                    
                    <button id="signInBtn" class="auth-button" type="button">
                        <div class="loader"></div>
                        <span>Sign In to Both Services</span>
                    </button>
                    <div class="auth-help">
                        <small>
                            <a href="#" onclick="window.openJiraTokenHelp()">Get JIRA API token</a> | 
                            <a href="#" onclick="window.openProductiveTokenHelp()">Get Productive API token</a>
                        </small>
                    </div>
                </div>

                <!-- Removed multi-user switcher for simplicity -->
                
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
exports.AuthenticationSectionComponent = AuthenticationSectionComponent;
class EmailSectionComponent extends BaseComponent {
    render() {
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
exports.EmailSectionComponent = EmailSectionComponent;
class DropdownComponent extends BaseComponent {
    render() {
        const { id, title = "Select Option", optionsId, onToggle } = this.props;
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
exports.DropdownComponent = DropdownComponent;
class ProjectIssueSelectionComponent extends BaseComponent {
    render() {
        return `
            <div class="section">
            <div class="project-issue-selection">
                <div class="section-title">Project & Issue</div>
                <select id="projectSelect" class="dropdown-select" onchange="onProjectChange()" disabled>
                    <option value="">Select Project</option>
                </select>
                                 <div class="smart-search-container">
                    <input type="text" id="issueSearchInput" class="smart-search-input" placeholder="Search by issue key (PROJECT-1234) or summary text..." disabled>
                    <div id="searchResults" class="search-results" style="display: none;">
                        <div id="searchResultsList" class="search-results-list"></div>
                    </div>
                </div>
                                 <!-- Pagination controls removed for smart search - not needed -->
                <button class="submit-button" onclick="clearAll()">
                    <span>Clear All</span>
                </button>
             </div>
            </div>
        `;
    }
}
exports.ProjectIssueSelectionComponent = ProjectIssueSelectionComponent;
class TimerButtonComponent extends BaseComponent {
    render() {
        const { icon, tooltip, onClick } = this.props;
        return `
            <button class="button" onclick="${onClick}">
                <span class="button-icon">${icon}</span>
                <span class="button-tooltip">${tooltip}</span>
            </button>
        `;
    }
}
exports.TimerButtonComponent = TimerButtonComponent;
class TimerSectionComponent extends BaseComponent {
    render() {
        return `
            <div class="section">
                <!-- <div class="section-title">Timer</div> -->
                <div class="status">
                    <span id="statusText">Inactive</span>
                    <span class="status-dot" id="statusDot"></span>
                </div>
                <div class="timer-section">
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
exports.TimerSectionComponent = TimerSectionComponent;
class ManualTimeLogComponent extends BaseComponent {
    render() {
        return `
            <div class="section">
                <!-- <div class="section-title">Manual Time Log</div> -->
                <div class="manual-time">
                    <input type="text" id="manualTimeInput" placeholder="Enter time (e.g., 5h, 30m, 1h 30m, 1.5h)">
                    <button class="button" onclick="submitManualTime()">Log Manual Time</button>
                </div>
            </div>
        `;
    }
}
exports.ManualTimeLogComponent = ManualTimeLogComponent;
class TicketInfoComponent extends BaseComponent {
    render() {
        return `
            <div id="ticketInfo" class="ticket-info-section" style="display: none;">
                <div class="ticket-info-header">
                    <div class="ticket-icon">🎫</div>
                    <div class="ticket-title">
                        <div class="ticket-key" id="ticketKey"></div>
                        <div class="ticket-summary" id="ticketSummary"></div>
                    </div>
                </div>
                <div class="ticket-details">
                    <div class="ticket-project">
                        <span class="label">Project:</span>
                        <span id="ticketProject" class="value"></span>
                    </div>
                    <div class="ticket-status">
                        <span class="label">Status:</span>
                        <span id="ticketStatus" class="value"></span>
                    </div>
                    <div class="ticket-description" id="ticketDescription">
                        <span class="label">Description:</span>
                        <div class="description-content" id="ticketDescriptionContent"></div>
                    </div>
                </div>
                <div class="ticket-actions">
                    <button class="action-button" id="openInJiraBtn" title="Open in Jira">
                        <span class="action-icon">🔗</span>
                        Open in Jira
                    </button>
                    <button class="action-button" id="copyTicketKeyBtn" title="Copy Ticket Key">
                        <span class="action-icon">📋</span>
                        Copy Key
                    </button>
                    <button class="action-button close-ticket-btn" id="closeTicketBtn" title="Close Ticket Info" style="display: none;">
                        <span class="action-icon">✕</span>
                        Close
                    </button>
                </div>
            </div>
        `;
    }
}
exports.TicketInfoComponent = TicketInfoComponent;
class JavaScriptComponent extends BaseComponent {
    render() {
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
                            const jiraApiToken = document.getElementById('jiraApiTokenInput').value.trim();
                            const productiveApiToken = document.getElementById('productiveApiTokenInput').value.trim();
                            
                            if (!jiraUrl || !email || !jiraApiToken || !productiveApiToken) {
                                showNotification('Please fill in all fields', 'error');
                                return;
                            }
                            
                            // Show loading state
                            signInBtn.disabled = true;
                            signInBtn.classList.add('loading');
                            
                            vscode.postMessage({
                                type: 'signIn',
                                jiraBaseUrl: jiraUrl,
                                jiraEmail: email,
                                jiraApiToken: jiraApiToken,
                                productiveApiToken: productiveApiToken
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
                    
                    // Removed add user button handler
                }
                
                function checkAuthenticationStatus() {
                    vscode.postMessage({ type: 'checkAuthStatus' });
                }
                
                function updateAuthenticationUI(authData) {
                    const currentUserDisplay = document.getElementById('currentUserDisplay');
                    const signInForm = document.getElementById('signInForm');
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
                        if (loadProjectsSection) loadProjectsSection.style.display = 'block';
                        
                        // Clear sign in form
                        clearSignInForm();
                        
                        // Don't auto-load projects - let user click the button when needed
                        // showNotification('Signed in successfully! Click "Load Projects" to start.', 'success');
                    } else {
                        // Show sign in form and clear everything
                        if (currentUserDisplay) currentUserDisplay.style.display = 'none';
                        if (signInForm) signInForm.style.display = 'flex';
                        if (loadProjectsSection) loadProjectsSection.style.display = 'none';
                        
                        // Clear all dropdowns and selections
                        clearAll();
                        
                        // Show error if provided
                        if (authData.error) {
                            showNotification(authData.error, 'error');
                        }
                    }
                }
                
                // Removed complex multi-user list management
                
                // Removed switch and remove user functions
                
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
                
                function openProductiveTokenHelp() {
                    showNotification('Generate API token at: Productive → Settings → API tokens → Personal access tokens', 'info');
                }
                
                // Make functions available globally
                window.openApiTokenHelp = openApiTokenHelp;
                window.openProductiveTokenHelp = openProductiveTokenHelp;
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
                        // Removed usersList handler
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
                            
                            updateButtonStates(message.isTracking, message.time);
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
                                
                                // Note: Backend already sends notification for projects loaded
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
                            
                            // Enable smart search input when issues are loaded
                            const searchInput = document.getElementById('issueSearchInput');
                            
                            if (searchInput) {
                                searchInput.disabled = false;
                                searchInput.focus(); // Focus the input for immediate typing
                            }
                            
                            // Note: Backend already sends notification for project loaded
                            break;
                        case 'searchResults':
                            console.log('Received search results:', message.issues);
                            console.log('Search term:', message.searchTerm);
                            
                            if (message.error) {
                                console.error('Search error:', message.error);
                                showNotification('Search failed: ' + message.error, 'error');
                                showNoResultsMessage('Search failed');
                            } else {
                                showSearchResults(message.issues, message.searchTerm);
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
                            
                            if (projectSelect2 && message.projectKey) {
                                // Set project if it exists in dropdown
                                const projectOption = projectSelect2.querySelector(\`option[value="\${message.projectKey}"]\`);
                                if (projectOption) {
                                    projectSelect2.value = message.projectKey;
                                    // Trigger change event to load issues
                                    projectSelect2.dispatchEvent(new Event('change'));
                                }
                            }
                            
                            // Set issue in smart search after a short delay to allow issues to load
                            if (message.issueKey) {
                                setTimeout(() => {
                                    const searchInput = document.getElementById('issueSearchInput');
                                    if (searchInput) {
                                        searchInput.value = message.issueKey;
                                        selectedIssueKey = message.issueKey;
                                        // Note: Backend already sends notification for branch info
                                    }
                                }, 1000);
                            }
                            break;
                        case 'ticket-info':
                            console.log('Received ticket info:', message);
                            if (message.ticketId === null) {
                                // Clear ticket info
                                clearTicketInfo();
                            } else {
                                updateTicketInfo(message);
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
                    
                    if (!selectedIssueKey) {
                        showNotification('Please search and select an issue first', 'error');
                        return;
                    }
                    
                    vscode.postMessage({ 
                        type: 'startTimer',
                        issueKey: selectedIssueKey
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

                function updateButtonStates(isTracking = false, currentTime = '00:00:00') {
                    const startBtn = document.getElementById('startBtn');
                    const stopBtn = document.getElementById('stopBtn');
                    const resumeBtn = document.getElementById('resumeBtn');
                    const submitBtn = document.getElementById('submitBtn');
                    const closeTicketBtn = document.getElementById('closeTicketBtn');

                    if (startBtn) startBtn.style.display = isTracking ? 'none' : 'inline-block';
                    if (stopBtn) stopBtn.style.display = isTracking ? 'inline-block' : 'none';
                    if (resumeBtn) resumeBtn.style.display = isTracking ? 'none' : 'inline-block';
                    
                    // Show submit button only if timer is running OR there's elapsed time to submit
                    const hasElapsedTime = currentTime && currentTime !== '00:00:00';
                    const shouldShowSubmit = isTracking || hasElapsedTime;
                    if (submitBtn) submitBtn.style.display = shouldShowSubmit ? 'inline-block' : 'none';
                    
                    // Show close ticket button only when timer is inactive
                    if (closeTicketBtn) {
                        closeTicketBtn.style.display = isTracking ? 'none' : 'inline-block';
                    }
                }

                // Project selection handler
                function onProjectChange() {
                    if (!isAuthenticated) {
                        showNotification('Please sign in first', 'error');
                        return;
                    }
                    
                    const projectSelect = document.getElementById('projectSelect');
                    const projectKey = projectSelect ? projectSelect.value : '';
                    
                    // Update current project key for smart search
                    currentProjectKey = projectKey;
                    
                    if (projectKey) {
                        // Reset smart search when changing projects
                        
                        // Disable smart search until issues are loaded
                        const searchInput = document.getElementById('issueSearchInput');
                        
                        if (searchInput) {
                            searchInput.disabled = true;
                            searchInput.value = '';
                        }
                        
                        // Hide any existing search results
                        hideSearchResults();
                        
                        vscode.postMessage({
                            type: 'loadIssues',
                            projectKey: projectKey
                        });
                    } else {
                        // Reset smart search
                        const searchInput = document.getElementById('issueSearchInput');
                        
                        if (searchInput) {
                            searchInput.disabled = true;
                            searchInput.value = '';
                        }
                        
                        // Hide search results
                        hideSearchResults();
                    }
                }

                // Manual time logging
                function submitManualTime() {
                    if (!isAuthenticated) {
                        showNotification('Please sign in first', 'error');
                        return;
                    }
                    
                    const timeInput = document.getElementById('manualTimeInput');
                    const timeSpent = timeInput ? timeInput.value.trim() : '';
                    
                    if (!selectedIssueKey) {
                        showNotification('Please search and select an issue first', 'error');
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
                        issueKey: selectedIssueKey,
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

                // Smart search variables
                let selectedIssueKey = '';
                let searchTimeout = null;
                let currentProjectKey = '';



                // Smart Search Functions
                function initializeSmartSearch() {
                    const searchInput = document.getElementById('issueSearchInput');
                    
                    if (searchInput) {
                        searchInput.addEventListener('input', onSmartSearchInput);
                        searchInput.addEventListener('keydown', onSearchKeyDown);
                        console.log('Smart search initialized');
                    }
                }

                function onSmartSearchInput() {
                    const searchInput = document.getElementById('issueSearchInput');
                    const searchTerm = searchInput ? searchInput.value.trim() : '';
                    
                    console.log('Smart search input:', searchTerm);
                    
                    // Clear previous timeout
                    if (searchTimeout) {
                        clearTimeout(searchTimeout);
                    }
                    
                    // Hide results if search is empty
                    if (searchTerm === '') {
                        hideSearchResults();
                        return;
                    }
                    
                    // Show searching indicator for any non-empty search
                    showNoResultsMessage('🔍 Searching...');
                    
                    // Debounce search requests (300ms delay)
                    searchTimeout = setTimeout(() => {
                        performSearch(searchTerm);
                    }, 300);
                }
                
                function performSearch(searchTerm) {
                    if (!currentProjectKey) {
                        showNoResultsMessage('❌ Please select a project first');
                        return;
                    }
                    
                    console.log('Sending search request for:', searchTerm);
                    vscode.postMessage({
                        type: 'searchIssues',
                        projectKey: currentProjectKey,
                        searchTerm: searchTerm
                    });
                }

                function onSearchKeyDown(event) {
                    const searchResults = document.getElementById('searchResults');
                    const resultItems = searchResults ? searchResults.querySelectorAll('.search-result-item') : [];
                    const selectedItem = searchResults ? searchResults.querySelector('.search-result-item.selected') : null;
                    
                    switch (event.key) {
                        case 'ArrowDown':
                            event.preventDefault();
                            navigateSearchResults(1, resultItems, selectedItem);
                            break;
                        case 'ArrowUp':
                            event.preventDefault();
                            navigateSearchResults(-1, resultItems, selectedItem);
                            break;
                        case 'Enter':
                            event.preventDefault();
                            if (selectedItem) {
                                selectSearchResult(selectedItem);
                            }
                            break;
                        case 'Escape':
                            event.preventDefault();
                            hideSearchResults();
                            break;
                    }
                }

                function navigateSearchResults(direction, resultItems, selectedItem) {
                    if (resultItems.length === 0) return;
                    
                    let nextIndex = 0;
                    if (selectedItem) {
                        const currentIndex = Array.from(resultItems).indexOf(selectedItem);
                        nextIndex = (currentIndex + direction + resultItems.length) % resultItems.length;
                    }
                    
                    // Remove previous selection
                    resultItems.forEach(item => item.classList.remove('selected'));
                    
                    // Add new selection
                    resultItems[nextIndex].classList.add('selected');
                    resultItems[nextIndex].scrollIntoView({ block: 'nearest' });
                }

                function selectSearchResult(resultItem) {
                    const issueKey = resultItem.getAttribute('data-key');
                    const issueSummary = resultItem.getAttribute('data-summary');
                    
                    if (issueKey && issueSummary) {
                        selectedIssueKey = issueKey;
                        
                        // Update search input with selected issue
                        const searchInput = document.getElementById('issueSearchInput');
                        if (searchInput) {
                            searchInput.value = issueKey;
                        }
                        
                        console.log('Selected issue:', issueKey, issueSummary);
                        showNotification('Selected: ' + issueKey, 'success');
                        
                        // Hide search results
                        hideSearchResults();
                    }
                }

                function showSearchResults(issues, searchTerm) {
                    const searchResults = document.getElementById('searchResults');
                    const searchResultsList = document.getElementById('searchResultsList');
                    
                    if (!searchResults || !searchResultsList) return;
                    
                    if (issues.length === 0) {
                        showNoResultsMessage('No issues found');
                        return;
                    }
                    
                    searchResultsList.innerHTML = '';
                    issues.forEach(issue => {
                        const resultItem = document.createElement('div');
                        resultItem.className = 'search-result-item';
                        resultItem.setAttribute('data-key', issue.key);
                        resultItem.setAttribute('data-summary', issue.summary);
                        resultItem.onclick = () => selectSearchResult(resultItem);
                        
                        // Highlight the search term
                        let displayText = issue.summary + ' (' + issue.key + ')';
                        if (searchTerm) {
                            displayText = highlightSearchTerm(displayText, searchTerm);
                        }
                        
                        resultItem.innerHTML = displayText;
                        searchResultsList.appendChild(resultItem);
                    });
                    
                    searchResults.style.display = 'block';
                }

                function showNoResultsMessage(message) {
                    const searchResults = document.getElementById('searchResults');
                    const searchResultsList = document.getElementById('searchResultsList');
                    
                    if (searchResults && searchResultsList) {
                        searchResultsList.innerHTML = '<div class="no-results-message">' + message + '</div>';
                        searchResults.style.display = 'block';
                    }
                }

                function hideSearchResults() {
                    const searchResults = document.getElementById('searchResults');
                    if (searchResults) {
                        searchResults.style.display = 'none';
                    }
                }

                function highlightSearchTerm(text, searchTerm) {
                    if (!searchTerm) return text;
                    
                    const lowerText = text.toLowerCase();
                    const lowerSearch = searchTerm.toLowerCase();
                    const index = lowerText.indexOf(lowerSearch);
                    
                    if (index === -1) return text;
                    
                    const before = text.substring(0, index);
                    const match = text.substring(index, index + searchTerm.length);
                    const after = text.substring(index + searchTerm.length);
                    
                    return before + '<span class="search-highlight">' + match + '</span>' + after;
                }

                // Ticket Info Functions
                function updateTicketInfo(ticketData) {
                    const ticketInfoSection = document.getElementById('ticketInfo');
                    const ticketKey = document.getElementById('ticketKey');
                    const ticketSummary = document.getElementById('ticketSummary');
                    const ticketProject = document.getElementById('ticketProject');
                    const ticketStatus = document.getElementById('ticketStatus');
                    const ticketDescription = document.getElementById('ticketDescription');
                    const ticketDescriptionContent = document.getElementById('ticketDescriptionContent');
                    
                    if (!ticketInfoSection) return;
                    
                    if (ticketData && ticketData.ticketId) {
                        // Update ticket information
                        if (ticketKey) ticketKey.textContent = ticketData.ticketId;
                        if (ticketSummary) ticketSummary.textContent = ticketData.summary || 'No summary available';
                        if (ticketProject) ticketProject.textContent = ticketData.projectKey || 'Unknown Project';
                        if (ticketStatus) ticketStatus.textContent = ticketData.status || 'Unknown Status';
                        
                        // Handle description
                        if (ticketDescriptionContent) {
                            if (ticketData.description) {
                                const description = ticketData.description;
                                ticketDescriptionContent.textContent = description;
                                
                                // Check if description is too long and needs truncation
                                if (description.length > 300) {
                                    // Truncate to 300 characters and add ellipsis
                                    const truncatedText = description.substring(0, 300);
                                    ticketDescriptionContent.textContent = truncatedText;
                                    ticketDescriptionContent.classList.add('truncated');
                                    
                                    // Add "Show more" functionality
                                    const showMoreBtn = document.createElement('button');
                                    showMoreBtn.className = 'action-button';
                                    showMoreBtn.innerHTML = '<span class="action-icon">📖</span>Show More';
                                    showMoreBtn.onclick = () => {
                                        ticketDescriptionContent.textContent = description;
                                        ticketDescriptionContent.classList.remove('truncated');
                                        showMoreBtn.remove();
                                        
                                        // Add "Show less" button
                                        const showLessBtn = document.createElement('button');
                                        showLessBtn.className = 'action-button';
                                        showLessBtn.innerHTML = '<span class="action-icon">📖</span>Show Less';
                                        showLessBtn.onclick = () => {
                                            ticketDescriptionContent.textContent = truncatedText;
                                            ticketDescriptionContent.classList.add('truncated');
                                            showLessBtn.remove();
                                            ticketDescriptionContent.parentNode.appendChild(showMoreBtn);
                                        };
                                        ticketDescriptionContent.parentNode.appendChild(showLessBtn);
                                    };
                                    
                                    // Add show more button to ticket actions
                                    const ticketActions = document.querySelector('.ticket-actions');
                                    if (ticketActions) {
                                        ticketActions.appendChild(showMoreBtn);
                                    }
                                } else {
                                    ticketDescriptionContent.classList.remove('truncated');
                                }
                                
                                if (ticketDescription) ticketDescription.style.display = 'flex';
                            } else {
                                if (ticketDescription) ticketDescription.style.display = 'none';
                            }
                        }
                        
                        // Show the ticket info section with animation
                        ticketInfoSection.style.display = 'block';
                        setTimeout(() => {
                            ticketInfoSection.classList.add('show');
                        }, 10);
                        
                        // Set up action buttons
                        setupTicketActionButtons(ticketData);
                        
                        // Show close button if timer is inactive
                        const closeTicketBtn = document.getElementById('closeTicketBtn');
                        if (closeTicketBtn) {
                            // Check if timer is currently tracking
                            const statusText = document.getElementById('statusText');
                            const isTracking = statusText && statusText.textContent === 'Active';
                            closeTicketBtn.style.display = isTracking ? 'none' : 'inline-block';
                        }
                        
                        console.log('Ticket info updated:', ticketData);
                    } else {
                        // Hide the ticket info section
                        ticketInfoSection.style.display = 'none';
                        ticketInfoSection.classList.remove('show');
                    }
                }
                
                // Function to clear ticket info
                function clearTicketInfo() {
                    const ticketInfoSection = document.getElementById('ticketInfo');
                    if (ticketInfoSection) {
                        ticketInfoSection.style.display = 'none';
                        ticketInfoSection.classList.remove('show');
                    }
                }
                
                function setupTicketActionButtons(ticketData) {
                    const openInJiraBtn = document.getElementById('openInJiraBtn');
                    const copyTicketKeyBtn = document.getElementById('copyTicketKeyBtn');
                    const closeTicketBtn = document.getElementById('closeTicketBtn');
                    
                    if (openInJiraBtn) {
                        openInJiraBtn.onclick = () => {
                            if (ticketData.ticketId) {
                                vscode.postMessage({
                                    type: 'openInJira',
                                    ticketId: ticketData.ticketId
                                });
                            }
                        };
                    }
                    
                    if (copyTicketKeyBtn) {
                        copyTicketKeyBtn.onclick = () => {
                            if (ticketData.ticketId) {
                                navigator.clipboard.writeText(ticketData.ticketId).then(() => {
                                    showNotification('Ticket key copied to clipboard', 'success');
                                }).catch(() => {
                                    showNotification('Failed to copy ticket key', 'error');
                                });
                            }
                        };
                    }
                    
                    if (closeTicketBtn) {
                        closeTicketBtn.onclick = () => {
                            // Hide the ticket info section
                            const ticketInfoSection = document.getElementById('ticketInfo');
                            if (ticketInfoSection) {
                                ticketInfoSection.style.display = 'none';
                                ticketInfoSection.classList.remove('show');
                            }
                            
                            // Clear any existing show more/less buttons
                            const existingShowButtons = document.querySelectorAll('.action-button[onclick*="Show"]');
                            existingShowButtons.forEach(btn => btn.remove());
                            
                            showNotification('Ticket info closed', 'info');
                        };
                    }
                    
                    // Clear any existing show more/less buttons
                    const existingShowButtons = document.querySelectorAll('.action-button[onclick*="Show"]');
                    existingShowButtons.forEach(btn => btn.remove());
                }

                // Initialize everything
                updateButtonStates();

                document.addEventListener('DOMContentLoaded', function() {
                    setupAuthenticationHandlers();
                    checkAuthenticationStatus();
                    loadGitEmail();
                    initializeSmartSearch();
                    
                    // Update legacy load projects button to work with authentication
                    const loadProjectsBtn = document.getElementById('loadProjectsBtn');
                    if (loadProjectsBtn) {
                        loadProjectsBtn.addEventListener('click', loadProjectsForUser);
                    }
                    
                    // Request current ticket info from extension
                    vscode.postMessage({ type: 'getCurrentTicketInfo' });
                });
            </script>
        `;
    }
}
exports.JavaScriptComponent = JavaScriptComponent;
class MainLayoutComponent extends BaseComponent {
    render() {
        const styles = new StylesComponent();
        const notifications = new NotificationComponent();
        const authSection = new AuthenticationSectionComponent();
        const ticketInfo = new TicketInfoComponent();
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
            ${ticketInfo.render()}
            ${projectIssueSelection.render()}
            ${timerSection.render()}
            ${manualTimeLog.render()}
            ${javascript.render()}
        </body>
        </html>`;
    }
}
exports.MainLayoutComponent = MainLayoutComponent;
//# sourceMappingURL=UIComponents.js.map