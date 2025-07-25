import axios from 'axios';
import * as vscode from 'vscode';

export interface ProductiveCredentials {
    organizationId: string;
    apiToken: string;
    baseUrl: string;
}

export interface ProductiveProject {
    id: string;
    name: string;
    client_id?: string;
}

export interface ProductiveServiceItem {
    id: string;
    name: string;
    description?: string;
}

export interface ProductivePerson {
    id: string;
    name: string;
    email: string;
    active: boolean;
}

export interface PersonService {
    serviceId: string;
    serviceName: string;
    personId: string;
    active: boolean;
}

export interface ProductiveUserInfo {
    personId: string;
    personName: string;
    personEmail: string;
    assignedServices: PersonService[];
    allProjects: ProductiveProject[];
}

export interface ProductiveTimeEntry {
    person_id: string;
    project_id: string;
    service_id?: string;
    date: string; // YYYY-MM-DD format
    time: number; // Time in minutes
    note?: string;
}

export class ProductiveService {
    
    constructor() {}

    /**
     * Get essential Productive credentials from VS Code settings or environment variables
     */
    private getCredentials(): ProductiveCredentials {
        const config = vscode.workspace.getConfiguration('jiraTimeTracker');
        
        // Only get essential API credentials
        const organizationId = config.get<string>('productive.organizationId') || process.env.PRODUCTIVE_ORGANIZATION_ID;
        const apiToken = config.get<string>('productive.apiToken') || process.env.PRODUCTIVE_API_TOKEN;
        const baseUrl = config.get<string>('productive.baseUrl') || process.env.PRODUCTIVE_BASE_URL || 'https://api.productive.io/api/v2';

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
    private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' = 'GET', data?: any) {
        const credentials = this.getCredentials();
        const url = `${credentials.baseUrl}${endpoint}`;

        try {
            const response = await axios({
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
        } catch (error: any) {
            if (error.response) {
                throw new Error(`Productive API Error: ${error.response.status} - ${error.response.data.message || error.message}`);
            }
            throw new Error(`Productive API Error: ${error.message}`);
        }
    }

    /**
     * Get authenticated user information
     */
    public async getAuthenticatedUser(): Promise<ProductivePerson> {
        try {
            const config = vscode.workspace.getConfiguration('jiraTimeTracker');
            const configuredPersonId = config.get<string>('productive.personId') || process.env.PRODUCTIVE_PERSON_ID;
            
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
            const people = response.data.map((person: any) => ({
                id: person.id,
                name: person.attributes?.name || person.attributes?.first_name + ' ' + person.attributes?.last_name || 'Unknown',
                email: person.attributes?.email,
                active: person.attributes?.deactivated_at === null
            }));

            const activeUsers = people.filter((person: any) => person.active);
            if (activeUsers.length === 0) {
                throw new Error('No active users found in organization');
            }

            const user = activeUsers[0];
            console.log(`📋 Using first active user: ${user.name} (${user.email})`);
            console.log(`   💡 To use a specific user, set productive.personId in settings or PRODUCTIVE_PERSON_ID=${user.id} in .env file`);
            
            return user;
        } catch (error: any) {
            throw new Error(`Failed to get authenticated user: ${error.message}`);
        }
    }

    /**
     * Get all projects from Productive
     */
    public async getProjects(): Promise<ProductiveProject[]> {
        try {
            const response = await this.makeRequest('/projects');
            return response.data.map((project: any) => ({
                id: project.id,
                name: project.attributes.name,
                client_id: project.relationships?.client?.data?.id
            }));
        } catch (error: any) {
            throw new Error(`Failed to fetch projects: ${error.message}`);
        }
    }

    /**
     * Get all available services from Productive
     */
    public async getServices(): Promise<ProductiveServiceItem[]> {
        try {
            const response = await this.makeRequest('/services');
            return response.data.map((service: any) => ({
                id: service.id,
                name: service.attributes.name,
                description: service.attributes.description
            }));
        } catch (error: any) {
            throw new Error(`Failed to fetch services: ${error.message}`);
        }
    }

    /**
     * Get services assigned to authenticated user
     */
    public async getMyServices(): Promise<PersonService[]> {
        try {
            const user = await this.getAuthenticatedUser();
            
            // Try different endpoint approaches for person services
            let response;
            try {
                // First try: person_services with filter
                response = await this.makeRequest(`/person_services?filter[person_id]=${user.id}`);
            } catch (error1) {
                try {
                    // Second try: direct person services endpoint
                    response = await this.makeRequest(`/people/${user.id}/services`);
                } catch (error2) {
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
                .filter((ps: any) => ps.attributes?.active !== false)
                .map((ps: any) => {
                    const serviceId = ps.relationships?.service?.data?.id || ps.id;
                    const service = allServices.find(s => s.id === serviceId);
                    return {
                        serviceId: serviceId,
                        serviceName: service?.name || 'Unknown Service',
                        personId: user.id,
                        active: ps.attributes?.active !== false
                    };
                });
        } catch (error: any) {
            throw new Error(`Failed to fetch my services: ${error.message}`);
        }
    }

    /**
     * Get comprehensive user information for authenticated user
     */
    public async getMyUserInfo(): Promise<ProductiveUserInfo> {
        try {
            console.log('🔍 Fetching authenticated user information...');
            
            // Get user info and assigned services and all projects in parallel
            const [user, assignedServices, allProjects] = await Promise.all([
                this.getAuthenticatedUser(),
                this.getMyServices(),
                this.getProjects()
            ]);

            const userInfo: ProductiveUserInfo = {
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
        } catch (error: any) {
            throw new Error(`Failed to get authenticated user information: ${error.message}`);
        }
    }

    /**
     * Get dropdown options for projects
     */
    public async getProjectOptions(): Promise<{ label: string; value: string }[]> {
        try {
            const projects = await this.getProjects();
            return projects.map(project => ({
                label: project.name,
                value: project.id
            }));
        } catch (error: any) {
            throw new Error(`Failed to get project options: ${error.message}`);
        }
    }

    /**
     * Get dropdown options for services assigned to authenticated user
     */
    public async getMyServiceOptions(): Promise<{ label: string; value: string }[]> {
        try {
            const services = await this.getMyServices();
            return services.map(service => ({
                label: service.serviceName,
                value: service.serviceId
            }));
        } catch (error: any) {
            throw new Error(`Failed to get my service options: ${error.message}`);
        }
    }

    /**
     * Log time entry to Productive as authenticated user
     */
    public async logMyTimeEntry(
        projectId: string,
        serviceId: string,
        timeMinutes: number,
        date?: string,
        description?: string,
        jiraTicketId?: string
    ): Promise<any> {
        try {
            const credentials = this.getCredentials();
            const user = await this.getAuthenticatedUser();
            const entryDate = date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

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

            const response = await this.makeRequest('/time_entries', 'POST', timeEntry);
            
            console.log(`✅ Time logged successfully:`);
            console.log(`   👤 User: ${user.name} (${user.email})`);
            console.log(`   📁 Project ID: ${projectId}`);
            console.log(`   🛠️  Service ID: ${serviceId}`);
            console.log(`   ⏰ Time: ${timeMinutes} minutes`);
            console.log(`   📝 Entry ID: ${response.data.id}`);

            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to log time to Productive: ${error.message}`);
        }
    }

    /**
     * Validate that authenticated user can log time to a specific project and service
     */
    public async validateMyTimeLogRequest(
        projectId: string,
        serviceId: string
    ): Promise<{ valid: boolean; message: string }> {
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
        } catch (error: any) {
            return { valid: false, message: `Validation error: ${error.message}` };
        }
    }

    /**
     * Get default project ID from settings
     */
    public getDefaultProjectId(): string | null {
        const config = vscode.workspace.getConfiguration('jiraTimeTracker');
        return config.get<string>('productive.defaultProjectId') || null;
    }

    /**
     * Map Jira project key to Productive project ID
     */
    public mapJiraProjectToProductive(jiraProjectKey: string): string | null {
        const config = vscode.workspace.getConfiguration('jiraTimeTracker');
        const mapping = config.get<Record<string, string>>('productive.projectMapping') || {};
        return mapping[jiraProjectKey] || this.getDefaultProjectId();
    }

    /**
     * Log time to Productive (with automatic service discovery)
     */
    public async logTime(
        projectId: string,
        timeInMinutes: number,
        date?: Date,
        note?: string,
        ticketId?: string
    ): Promise<any> {
        try {
            // Get user's services and use the first available one
            const services = await this.getMyServices();
            
            if (services.length === 0) {
                throw new Error('No services available for user');
            }

            const serviceId = services[0].serviceId;
            const dateString = date ? date.toISOString().split('T')[0] : undefined;

            return this.logMyTimeEntry(projectId, serviceId, timeInMinutes, dateString, note, ticketId);
        } catch (error) {
            console.error('Error in logTime:', error);
            throw error;
        }
    }
} 