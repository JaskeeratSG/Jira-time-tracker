"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductiveService = void 0;
const axios_1 = require("axios");
const vscode = require("vscode");
class ProductiveService {
    constructor(outputChannel) {
        this.outputChannel = outputChannel;
    }
    /**
     * Set output channel for logging
     */
    setOutputChannel(outputChannel) {
        this.outputChannel = outputChannel;
    }
    /**
     * Log message to output channel if available
     */
    log(message) {
        // Check if logging is enabled via configuration
        const config = vscode.workspace.getConfiguration('jiraTimeTracker');
        const enableLogging = config.get('enableLogging', false);
        if (!enableLogging) {
            return; // Silent mode - no output
        }
        if (this.outputChannel) {
            this.outputChannel.appendLine(message);
        }
        console.log(message);
    }
    /**
     * Get essential Productive credentials from authenticated user or VS Code settings
     */
    getCredentials() {
        // First try: Get from authenticated user (if available)
        // Note: This method is called from ProductiveService which doesn't have access to auth service
        // The JiraTimeLogger handles the authenticated user priority
        const config = vscode.workspace.getConfiguration('jiraTimeTracker');
        // Only get essential API credentials from settings/environment
        const organizationId = config.get('productive.organizationId') || process.env.PRODUCTIVE_ORGANIZATION_ID;
        const apiToken = config.get('productive.apiToken') || process.env.PRODUCTIVE_API_TOKEN;
        const baseUrl = config.get('productive.baseUrl') || process.env.PRODUCTIVE_BASE_URL || 'https://api.productive.io/api/v2';
        if (!organizationId || !apiToken) {
            throw new Error('Productive credentials not configured. Please set organizationId and apiToken in settings or environment variables.');
        }
        return {
            organizationId,
            apiToken,
            baseUrl
        };
    }
    /**
     * Make authenticated request to Productive API
     */
    async makeRequest(endpoint, method = 'GET', data) {
        const credentials = this.getCredentials();
        const url = `${credentials.baseUrl}${endpoint}`;
        try {
            const response = await (0, axios_1.default)({
                method,
                url,
                headers: {
                    'Content-Type': 'application/vnd.api+json',
                    'X-Auth-Token': credentials.apiToken,
                    'X-Organization-Id': credentials.organizationId
                },
                data
            });
            return response.data;
        }
        catch (error) {
            if (error.response) {
                throw new Error(`Productive API Error: ${error.response.status} - ${error.response.data.message || error.message}`);
            }
            throw new Error(`Productive API Error: ${error.message}`);
        }
    }
    /**
     * Get authenticated user information
     */
    async getAuthenticatedUser() {
        try {
            const config = vscode.workspace.getConfiguration('jiraTimeTracker');
            const configuredPersonId = config.get('productive.personId') || process.env.PRODUCTIVE_PERSON_ID;
            // If person ID is configured, use it directly
            if (configuredPersonId) {
                console.log(`📋 Using configured person ID: ${configuredPersonId}`);
                const response = await this.makeRequest(`/people/${configuredPersonId}`);
                const person = response.data;
                return {
                    id: person.id,
                    name: person.attributes?.name || person.attributes?.first_name + ' ' + person.attributes?.last_name || 'Unknown',
                    email: person.attributes?.email,
                    active: person.attributes?.deactivated_at === null
                };
            }
            // Otherwise, get the first active user (API token owner should have access)
            console.log('📋 No person ID configured, using first active user...');
            const response = await this.makeRequest('/people');
            const people = response.data.map((person) => ({
                id: person.id,
                name: person.attributes?.name || person.attributes?.first_name + ' ' + person.attributes?.last_name || 'Unknown',
                email: person.attributes?.email,
                active: person.attributes?.deactivated_at === null
            }));
            const activeUsers = people.filter((person) => person.active);
            if (activeUsers.length === 0) {
                throw new Error('No active users found in organization');
            }
            const user = activeUsers[0];
            console.log(`📋 Using first active user: ${user.name} (${user.email})`);
            console.log(`   💡 To use a specific user, set productive.personId in settings or PRODUCTIVE_PERSON_ID=${user.id} in .env file`);
            return user;
        }
        catch (error) {
            throw new Error(`Failed to get authenticated user: ${error.message}`);
        }
    }
    /**
     * Get all projects from Productive
     */
    async getProjects() {
        try {
            const response = await this.makeRequest('/projects');
            return response.data.map((project) => ({
                id: project.id,
                name: project.attributes.name,
                client_id: project.relationships?.client?.data?.id
            }));
        }
        catch (error) {
            throw new Error(`Failed to fetch projects: ${error.message}`);
        }
    }
    /**
     * Get all available services from Productive
     */
    async getServices() {
        try {
            const response = await this.makeRequest('/services');
            return response.data.map((service) => ({
                id: service.id,
                name: service.attributes.name,
                description: service.attributes.description
            }));
        }
        catch (error) {
            throw new Error(`Failed to fetch services: ${error.message}`);
        }
    }
    /**
     * Get services assigned to authenticated user
     */
    async getMyServices() {
        try {
            const user = await this.getAuthenticatedUser();
            // Try different endpoint approaches for person services
            let response;
            try {
                // First try: person_services with filter
                response = await this.makeRequest(`/person_services?filter[person_id]=${user.id}`);
            }
            catch (error1) {
                try {
                    // Second try: direct person services endpoint
                    response = await this.makeRequest(`/people/${user.id}/services`);
                }
                catch (error2) {
                    // If both fail, return all services as fallback
                    console.log(`⚠️  Could not fetch user-specific services. Using all services as fallback.`);
                    const allServices = await this.getServices();
                    return allServices.map(service => ({
                        serviceId: service.id,
                        serviceName: service.name,
                        personId: user.id,
                        active: true
                    }));
                }
            }
            const allServices = await this.getServices();
            return response.data
                .filter((ps) => ps.attributes?.active !== false)
                .map((ps) => {
                const serviceId = ps.relationships?.service?.data?.id || ps.id;
                const service = allServices.find(s => s.id === serviceId);
                return {
                    serviceId: serviceId,
                    serviceName: service?.name || 'Unknown Service',
                    personId: user.id,
                    active: ps.attributes?.active !== false
                };
            });
        }
        catch (error) {
            throw new Error(`Failed to fetch my services: ${error.message}`);
        }
    }
    /**
     * Get comprehensive user information for authenticated user
     */
    async getMyUserInfo() {
        try {
            console.log('🔍 Fetching authenticated user information...');
            // Get user info and assigned services and all projects in parallel
            const [user, assignedServices, allProjects] = await Promise.all([
                this.getAuthenticatedUser(),
                this.getMyServices(),
                this.getProjects()
            ]);
            const userInfo = {
                personId: user.id,
                personName: user.name,
                personEmail: user.email,
                assignedServices,
                allProjects
            };
            console.log(`✅ Authenticated user info retrieved:`);
            console.log(`   👤 User: ${user.name} (${user.id})`);
            console.log(`   📧 Email: ${user.email}`);
            console.log(`   🛠️  Assigned Services: ${assignedServices.length}`);
            console.log(`   📂 Available Projects: ${allProjects.length}`);
            return userInfo;
        }
        catch (error) {
            throw new Error(`Failed to get authenticated user information: ${error.message}`);
        }
    }
    /**
     * Get dropdown options for projects
     */
    async getProjectOptions() {
        try {
            const projects = await this.getProjects();
            return projects.map(project => ({
                label: project.name,
                value: project.id
            }));
        }
        catch (error) {
            throw new Error(`Failed to get project options: ${error.message}`);
        }
    }
    /**
     * Get dropdown options for services assigned to authenticated user
     */
    async getMyServiceOptions() {
        try {
            const services = await this.getMyServices();
            return services.map(service => ({
                label: service.serviceName,
                value: service.serviceId
            }));
        }
        catch (error) {
            throw new Error(`Failed to get my service options: ${error.message}`);
        }
    }
    /**
     * Log time entry to Productive as authenticated user
     */
    async logMyTimeEntry(projectId, serviceId, timeMinutes, date, description, jiraTicketId) {
        try {
            this.log(`🚀 Starting Productive time entry creation...`);
            this.log(`📋 Parameters:`);
            this.log(`   📁 Project ID: ${projectId}`);
            this.log(`   🛠️  Service ID: ${serviceId}`);
            this.log(`   ⏰ Time: ${timeMinutes} minutes`);
            this.log(`   📅 Date: ${date || 'Today'}`);
            this.log(`   📝 Description: ${description || 'Auto-generated'}`);
            this.log(`   🎯 Jira Ticket: ${jiraTicketId || 'None'}`);
            const credentials = this.getCredentials();
            this.log(`✅ Productive credentials retrieved`);
            const user = await this.getAuthenticatedUser();
            this.log(`✅ Authenticated user: ${user.name} (${user.email})`);
            // Use local timezone instead of UTC
            const getLocalDateString = () => {
                const now = new Date();
                return now.getFullYear() + '-' +
                    String(now.getMonth() + 1).padStart(2, '0') + '-' +
                    String(now.getDate()).padStart(2, '0'); // YYYY-MM-DD in local timezone
            };
            const entryDate = date || getLocalDateString(); // YYYY-MM-DD format
            this.log(`📅 Using entry date: ${entryDate}`);
            const timeEntry = {
                data: {
                    type: 'time_entries',
                    attributes: {
                        date: entryDate,
                        time: timeMinutes,
                        note: description || 'Time logged via VS Code Jira Time Tracker',
                        track_method_id: 1,
                        overhead: false,
                        ...(jiraTicketId && {
                            jira_issue_id: jiraTicketId,
                            jira_organization: process.env.JIRA_BASE_URL || 'https://yourdomain.atlassian.net'
                        })
                    },
                    relationships: {
                        person: {
                            data: {
                                type: 'people',
                                id: user.id
                            }
                        },
                        project: {
                            data: {
                                type: 'projects',
                                id: projectId
                            }
                        },
                        service: {
                            data: {
                                type: 'services',
                                id: serviceId
                            }
                        },
                        organization: {
                            data: {
                                type: 'organizations',
                                id: credentials.organizationId
                            }
                        }
                    }
                }
            };
            this.log(`📤 Sending time entry to Productive API...`);
            const response = await this.makeRequest('/time_entries', 'POST', timeEntry);
            this.log(`✅ Time logged successfully to Productive:`);
            this.log(`   👤 User: ${user.name} (${user.email})`);
            this.log(`   📁 Project ID: ${projectId}`);
            this.log(`   🛠️  Service ID: ${serviceId}`);
            this.log(`   ⏰ Time: ${timeMinutes} minutes`);
            this.log(`   📝 Entry ID: ${response.data.id}`);
            this.log(`   📅 Date: ${entryDate}`);
            this.log(`   🎯 Jira Ticket: ${jiraTicketId || 'None'}`);
            return response.data;
        }
        catch (error) {
            this.log(`❌ Failed to log time to Productive: ${error.message}`);
            if (error.response) {
                this.log(`📋 API Status: ${error.response.status}`);
                this.log(`📋 API Response: ${JSON.stringify(error.response.data, null, 2)}`);
            }
            throw new Error(`Failed to log time to Productive: ${error.message}`);
        }
    }
    /**
     * Validate that authenticated user can log time to a specific project and service
     */
    async validateMyTimeLogRequest(projectId, serviceId) {
        try {
            const [user, assignedServices, projects] = await Promise.all([
                this.getAuthenticatedUser(),
                this.getMyServices(),
                this.getProjects()
            ]);
            const hasService = assignedServices.some(s => s.serviceId === serviceId);
            if (!hasService) {
                return { valid: false, message: `Service not assigned to user ${user.name}` };
            }
            const hasProject = projects.some(p => p.id === projectId);
            if (!hasProject) {
                return { valid: false, message: `Project not found: ${projectId}` };
            }
            return { valid: true, message: 'Validation successful' };
        }
        catch (error) {
            return { valid: false, message: `Validation error: ${error.message}` };
        }
    }
    /**
     * Get default project ID from settings
     */
    getDefaultProjectId() {
        const config = vscode.workspace.getConfiguration('jiraTimeTracker');
        return config.get('productive.defaultProjectId') || null;
    }
    /**
     * Map Jira project key to Productive project ID
     */
    mapJiraProjectToProductive(jiraProjectKey) {
        const config = vscode.workspace.getConfiguration('jiraTimeTracker');
        const mapping = config.get('productive.projectMapping') || {};
        return mapping[jiraProjectKey] || this.getDefaultProjectId();
    }
    /**
     * Log time to Productive (with automatic service discovery)
     */
    async logTime(projectId, timeInMinutes, date, note, ticketId) {
        try {
            // Get user's services and use the first available one
            const services = await this.getMyServices();
            if (services.length === 0) {
                throw new Error('No services available for user');
            }
            const serviceId = services[0].serviceId;
            // Use local timezone instead of UTC
            const getLocalDateString = (date) => {
                return date.getFullYear() + '-' +
                    String(date.getMonth() + 1).padStart(2, '0') + '-' +
                    String(date.getDate()).padStart(2, '0'); // YYYY-MM-DD in local timezone
            };
            const dateString = date ? getLocalDateString(date) : undefined;
            return this.logMyTimeEntry(projectId, serviceId, timeInMinutes, dateString, note, ticketId);
        }
        catch (error) {
            console.error('Error in logTime:', error);
            throw error;
        }
    }
}
exports.ProductiveService = ProductiveService;
//# sourceMappingURL=ProductiveService.js.map