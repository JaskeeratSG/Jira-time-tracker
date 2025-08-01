"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJiraConfig = exports.settings = void 0;
const dotenv = require("dotenv");
const path = require("path");
// Load .env file from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
let vscode;
try {
    vscode = require('vscode');
}
catch (e) {
    // Running outside of VS Code
    vscode = null;
}
const getConfiguration = () => {
    if (!vscode) {
        // When running tests or outside VS Code
        return {
            get: (key) => {
                switch (key) {
                    case 'jiraBaseUrl': return process.env.JIRA_BASE_URL;
                    case 'jiraEmail': return process.env.JIRA_EMAIL;
                    case 'jiraApiToken': return process.env.JIRA_API_TOKEN;
                    default: return undefined;
                }
            }
        };
    }
    return vscode.workspace.getConfiguration('jiraTimeTracker');
};
exports.settings = {
    get jiraUrl() {
        return getConfiguration().get('jiraUrl', '');
    },
    get jiraUsername() {
        return getConfiguration().get('jiraUsername', '');
    },
    get jiraApiToken() {
        return getConfiguration().get('jiraApiToken', '');
    },
    get productiveApiToken() {
        return getConfiguration().get('productiveApiToken', '');
    },
    get productiveCompanyId() {
        return getConfiguration().get('productiveCompanyId', '');
    },
    get productiveUserId() {
        return getConfiguration().get('productiveUserId', '');
    },
    get autoTimer() {
        return getConfiguration().get('autoTimer', false);
    },
    get autoLogging() {
        return getConfiguration().get('autoLogging', false);
    },
    get enableOutputChannels() {
        return getConfiguration().get('enableOutputChannels', false);
    }
};
function getJiraConfig() {
    // First try to get from .env, fall back to VS Code settings if not found
    return {
        baseUrl: process.env.JIRA_BASE_URL || getConfiguration().get('jiraBaseUrl'),
        email: process.env.JIRA_EMAIL || getConfiguration().get('jiraEmail'),
        apiToken: process.env.JIRA_API_TOKEN || getConfiguration().get('jiraApiToken')
    };
}
exports.getJiraConfig = getJiraConfig;
//# sourceMappingURL=settings.js.map