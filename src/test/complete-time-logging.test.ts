import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { getJiraConfig } from '../config/settings';

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface AutoTimeLogResult {
    success: boolean;
    personId?: string;
    personName?: string;
    projectId?: string;
    projectName?: string;
    serviceId?: string;
    serviceName?: string;
    jiraTicketId?: string;
    timeMinutes: number;
    jiraLogSuccess: boolean;
    productiveLogSuccess: boolean;
    jiraError?: string;
    productiveError?: string;
    message: string;
    discoveryDetails: any;
}

class CompletTimeLoggingService {
    private config: {
        organizationId: string;
        apiToken: string;
        baseUrl: string;
        jiraEmail: string;
        jiraApiToken: string;
        jiraBaseUrl: string;
    };

    constructor() {
        const jiraConfig = getJiraConfig();
        
        this.config = {
            organizationId: process.env.PRODUCTIVE_ORGANIZATION_ID || '42335',
            apiToken: process.env.PRODUCTIVE_API_TOKEN || 'e77e94a9-f882-4ee2-8efe-db82dbe00750',
            baseUrl: process.env.PRODUCTIVE_BASE_URL || 'https://api.productive.io/api/v2',
            jiraEmail: jiraConfig.email || '',
            jiraApiToken: jiraConfig.apiToken || '',
            jiraBaseUrl: jiraConfig.baseUrl || ''
        };
    }

    async makeRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: any): Promise<any> {
        const url = `${this.config.baseUrl}${endpoint}`;
        try {
            const response = await axios({
                method,
                url,
                headers: {
                    'Content-Type': 'application/vnd.api+json',
                    'X-Auth-Token': this.config.apiToken,
                    'X-Organization-Id': this.config.organizationId
                },
                data
            });
            return response.data;
        } catch (error: any) {
            throw new Error(`${error.response?.status}: ${error.response?.statusText || error.message}`);
        }
    }

    async makeJiraRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: any): Promise<any> {
        const url = `${this.config.jiraBaseUrl}${endpoint}`;
        try {
            const response = await axios({
                method,
                url,
                auth: {
                    username: this.config.jiraEmail,
                    password: this.config.jiraApiToken
                },
                headers: {
                    'Content-Type': 'application/json'
                },
                data
            });
            return response.data;
        } catch (error: any) {
            throw new Error(`Jira API Error: ${error.response?.status} - ${error.response?.statusText || error.message}`);
        }
    }

    /**
     * Get authenticated user via organization membership API
     */
    async getAuthenticatedUser(): Promise<{ id: string; name: string; email: string }> {
        console.log('🔍 Finding authenticated user via organization membership...');
        
        try {
            // This endpoint returns the current user's membership
            const membershipResponse = await this.makeRequest('/organization_memberships');
            
            if (membershipResponse.data && membershipResponse.data.length > 0) {
                console.log(`   📊 Found ${membershipResponse.data.length} organization membership(s)`);
                
                // The membership ID IS the person ID!
                const membership = membershipResponse.data[0];
                const personId = membership.id;
                
                console.log(`   🎯 Found person ID from membership ID: ${personId}`);
                
                // Get full person details
                const personResponse = await this.makeRequest(`/people/${personId}`);
                const person = personResponse.data;
                
                return {
                    id: person.id,
                    name: person.attributes.name || `${person.attributes.first_name} ${person.attributes.last_name}`,
                    email: person.attributes.email
                };
            }
            
            throw new Error('No organization membership found');
            
        } catch (error: any) {
            throw new Error(`Membership method failed: ${error.message}`);
        }
    }

    /**
     * Find CTL-communications project in Productive
     */
    async findCTLProject(): Promise<{ id: string; name: string } | null> {
        console.log('🔍 Finding CTL-communications project...');
        
        try {
            const projectsResponse = await this.makeRequest('/projects');
            const projects = projectsResponse.data;
            
            // Look for CTL-communications (case insensitive)
            const ctlProject = projects.find((project: any) => 
                project.attributes.name.toLowerCase().includes('ctl') && 
                project.attributes.name.toLowerCase().includes('communication')
            );
            
            if (ctlProject) {
                console.log(`   ✅ Found CTL project: ${ctlProject.attributes.name} (${ctlProject.id})`);
                return {
                    id: ctlProject.id,
                    name: ctlProject.attributes.name
                };
            }
            
            // If exact match not found, show available projects
            console.log('   ⚠️  CTL-communications not found. Available projects:');
            projects.forEach((project: any) => {
                console.log(`      • ${project.attributes.name} (${project.id})`);
            });
            
            return null;
            
        } catch (error: any) {
            throw new Error(`Failed to find CTL project: ${error.message}`);
        }
    }

    /**
     * Find appropriate service for user and project
     */
    async findServiceForProject(personId: string, projectId: string): Promise<{
        serviceId: string | null;
        serviceName: string | null;
        confidence: 'HIGH' | 'MEDIUM' | 'LOW';
        message: string;
    }> {
        console.log('🛠️  Finding appropriate service for user and project...');
        
        try {
            // First check if user has logged time to this project before
            const timeEntriesResponse = await this.makeRequest(
                `/time_entries?filter[person_id]=${personId}&filter[project_id]=${projectId}&page[size]=10&include=service`
            );

            if (timeEntriesResponse.data.length > 0) {
                console.log(`   📊 Found ${timeEntriesResponse.data.length} previous time entries`);
                
                const serviceIds = new Set(
                    timeEntriesResponse.data.map((entry: any) => entry.relationships.service.data.id)
                );
                
                if (serviceIds.size === 1) {
                    const serviceId = Array.from(serviceIds)[0] as string;
                    let serviceName = 'Unknown Service';
                    
                    if (timeEntriesResponse.included) {
                        const serviceData = timeEntriesResponse.included.find((inc: any) => 
                            inc.type === 'services' && inc.id === serviceId
                        );
                        if (serviceData) {
                            serviceName = serviceData.attributes.name;
                        }
                    }

                    return {
                        serviceId,
                        serviceName,
                        confidence: 'HIGH',
                        message: `Perfect! Found from ${timeEntriesResponse.data.length} previous time entries`
                    };
                }
            }

            // If no previous entries, analyze what services are used in this project
            console.log('   📊 No previous entries. Analyzing project services...');
            
            const projectTimeEntriesResponse = await this.makeRequest(
                `/time_entries?filter[project_id]=${projectId}&page[size]=50&include=service`
            );
            
            if (projectTimeEntriesResponse.data.length > 0) {
                // Extract unique services used in this project
                const serviceIds = new Set(
                    projectTimeEntriesResponse.data.map((entry: any) => entry.relationships.service.data.id)
                );
                
                console.log(`   🎯 Found ${serviceIds.size} unique services used in this project`);
                
                if (projectTimeEntriesResponse.included) {
                    const serviceDetails = projectTimeEntriesResponse.included
                        .filter((item: any) => item.type === 'services')
                        .filter((service: any) => serviceIds.has(service.id));
                    
                    if (serviceDetails.length === 1) {
                        return {
                            serviceId: serviceDetails[0].id,
                            serviceName: serviceDetails[0].attributes.name,
                            confidence: 'MEDIUM',
                            message: `This project uses exactly one service: ${serviceDetails[0].attributes.name}`
                        };
                    } else if (serviceDetails.length > 1) {
                        // Find the most commonly used service
                        const serviceCounts: { [key: string]: number } = {};
                        projectTimeEntriesResponse.data.forEach((entry: any) => {
                            const serviceId = entry.relationships.service.data.id;
                            serviceCounts[serviceId] = (serviceCounts[serviceId] || 0) + 1;
                        });
                        
                        const mostUsedServiceId = Object.keys(serviceCounts).reduce((a, b) => 
                            serviceCounts[a] > serviceCounts[b] ? a : b
                        );
                        
                        const mostUsedService = serviceDetails.find((s: any) => s.id === mostUsedServiceId);
                        
                        return {
                            serviceId: mostUsedService?.id || null,
                            serviceName: mostUsedService?.attributes?.name || null,
                            confidence: 'MEDIUM',
                            message: `Multiple services available. Suggesting most used: ${mostUsedService?.attributes?.name}`
                        };
                    }
                }
            }
            
            return {
                serviceId: null,
                serviceName: null,
                confidence: 'LOW',
                message: 'No time entries found in this project. Manual service selection needed.'
            };
            
        } catch (error: any) {
            return {
                serviceId: null,
                serviceName: null,
                confidence: 'LOW',
                message: `Service discovery failed: ${error.message}`
            };
        }
    }

    /**
     * Verify Jira ticket exists
     */
    async verifyJiraTicket(ticketId: string): Promise<boolean> {
        try {
            console.log(`   🔍 Checking if ticket ${ticketId} exists...`);
            const response = await this.makeJiraRequest(`/rest/api/2/issue/${ticketId}`);
            console.log(`   ✅ Ticket found: ${response.fields?.summary || 'No summary'}`);
            return true;
        } catch (error: any) {
            console.log(`   ❌ Ticket verification failed: ${error.message}`);
            
            if (error.message.includes('404')) {
                console.log(`   💡 Suggestion: Check if ticket ${ticketId} exists and you have access to it`);
                return false;
            } else if (error.message.includes('401')) {
                console.log(`   💡 Suggestion: Check your Jira email and API token`);
                return false;
            } else if (error.message.includes('403')) {
                console.log(`   💡 Suggestion: You may not have permission to view this ticket`);
                return false;
            }
            
            throw error;
        }
    }

    /**
     * Log time to Jira
     */
    async logTimeToJira(ticketId: string, timeMinutes: number): Promise<void> {
        const timeData = {
            timeSpentSeconds: timeMinutes * 60,
            comment: `Time logged via VS Code extension by ${this.config.jiraEmail}`
        };

        await this.makeJiraRequest(`/rest/api/2/issue/${ticketId}/worklog`, 'POST', timeData);
    }

    /**
     * Log time to Productive
     */
    async logTimeToProductive(
        personId: string,
        projectId: string,
        serviceId: string,
        timeMinutes: number,
        description: string,
        jiraTicketId?: string
    ): Promise<void> {
        const entryDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

        const timeEntry = {
            data: {
                type: 'time_entries',
                attributes: {
                    date: entryDate,
                    time: timeMinutes,
                    note: description,
                    track_method_id: 1,
                    overhead: false,
                    ...(jiraTicketId && {
                        jira_issue_id: jiraTicketId,
                        jira_organization: this.config.jiraBaseUrl
                    })
                },
                relationships: {
                    person: {
                        data: {
                            type: 'people',
                            id: personId
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
                            id: this.config.organizationId
                        }
                    }
                }
            }
        };

        await this.makeRequest('/time_entries', 'POST', timeEntry);
    }

    /**
     * Complete auto time logging workflow
     */
    async autoLogTime(
        jiraTicketId: string,
        timeMinutes: number,
        description?: string
    ): Promise<AutoTimeLogResult> {
        console.log('🚀 COMPLETE AUTO TIME LOGGING');
        console.log(`🎯 Jira Ticket: ${jiraTicketId}`);
        console.log(`⏰ Time: ${timeMinutes} minutes`);
        console.log('='.repeat(50));

        const result: AutoTimeLogResult = {
            success: false,
            jiraTicketId,
            timeMinutes,
            jiraLogSuccess: false,
            productiveLogSuccess: false,
            message: '',
            discoveryDetails: {}
        };

        try {
            // Validate configuration
            if (!this.config.jiraEmail || !this.config.jiraApiToken || !this.config.jiraBaseUrl) {
                result.message = 'Jira credentials not configured. Please set them in VS Code settings or .env file';
                console.log('\n❌ Missing Jira Configuration:');
                console.log(`   Base URL: ${this.config.jiraBaseUrl || '(not set)'}`);
                console.log(`   Email: ${this.config.jiraEmail || '(not set)'}`);
                console.log(`   API Token: ${this.config.jiraApiToken ? '(set)' : '(not set)'}`);
                return result;
            }

            console.log('\n🔧 Using Jira Configuration:');
            console.log(`   Base URL: ${this.config.jiraBaseUrl}`);
            console.log(`   Email: ${this.config.jiraEmail}`);
            console.log(`   API Token: ${this.config.jiraApiToken ? '(configured)' : '(missing)'}`);
            console.log();

            // Step 1: Get authenticated user
            console.log('\n📊 Step 1: Finding authenticated user...');
            const person = await this.getAuthenticatedUser();
            result.personId = person.id;
            result.personName = person.name;
            console.log(`✅ Authenticated User: ${person.name} (${person.id})`);

            // Step 2: Find CTL project
            console.log('\n📊 Step 2: Finding CTL-communications project...');
            const project = await this.findCTLProject();
            if (!project) {
                result.message = 'CTL-communications project not found in Productive';
                return result;
            }
            result.projectId = project.id;
            result.projectName = project.name;
            console.log(`✅ Project: ${project.name} (${project.id})`);

            // Step 3: Find appropriate service
            console.log('\n📊 Step 3: Finding appropriate service...');
            const serviceResult = await this.findServiceForProject(person.id, project.id);
            result.serviceId = serviceResult.serviceId || undefined;
            result.serviceName = serviceResult.serviceName || undefined;
            result.discoveryDetails = {
                serviceConfidence: serviceResult.confidence,
                serviceMessage: serviceResult.message
            };

            if (!serviceResult.serviceId) {
                result.message = `Service discovery failed: ${serviceResult.message}`;
                return result;
            }

            console.log(`✅ Service: ${serviceResult.serviceName} (${serviceResult.serviceId})`);
            console.log(`   Confidence: ${serviceResult.confidence}`);

            // Step 4: Verify Jira ticket exists
            console.log('\n📊 Step 4: Verifying Jira ticket...');
            const ticketExists = await this.verifyJiraTicket(jiraTicketId);
            if (!ticketExists) {
                result.message = `Jira ticket ${jiraTicketId} not found`;
                return result;
            }
            console.log(`✅ Jira ticket verified: ${jiraTicketId}`);

            // Step 5: Log time to Jira
            console.log('\n📊 Step 5: Logging time to Jira...');
            try {
                await this.logTimeToJira(jiraTicketId, timeMinutes);
                result.jiraLogSuccess = true;
                console.log(`✅ Jira time logged: ${timeMinutes} minutes to ${jiraTicketId}`);
            } catch (error: any) {
                result.jiraError = error.message;
                console.log(`❌ Jira logging failed: ${error.message}`);
            }

            // Step 6: Log time to Productive (only if Jira succeeded)
            if (result.jiraLogSuccess) {
                console.log('\n📊 Step 6: Logging time to Productive...');
                try {
                    const timeDescription = description || `${jiraTicketId}: Time logged via VS Code extension`;
                    
                    await this.logTimeToProductive(
                        person.id,
                        project.id,
                        serviceResult.serviceId!,
                        timeMinutes,
                        timeDescription,
                        jiraTicketId
                    );
                    
                    result.productiveLogSuccess = true;
                    console.log(`✅ Productive time logged: ${timeMinutes} minutes to project ${project.name}`);
                } catch (error: any) {
                    result.productiveError = error.message;
                    console.log(`❌ Productive logging failed: ${error.message}`);
                }
            }

            // Determine overall success
            result.success = result.jiraLogSuccess;

            if (result.jiraLogSuccess && result.productiveLogSuccess) {
                result.message = `Time logged successfully to both Jira and Productive: ${timeMinutes} minutes`;
            } else if (result.jiraLogSuccess && !result.productiveLogSuccess) {
                result.message = `Time logged to Jira successfully. Productive failed: ${result.productiveError}`;
            } else {
                result.message = `Time logging failed: ${result.jiraError}`;
            }

            return result;

        } catch (error: any) {
            result.message = `Auto time logging failed: ${error.message}`;
            return result;
        }
    }

    /**
     * Test the complete auto time logging system
     */
    async testCompleteTimeLogging(): Promise<void> {
        console.log('🧪 Testing Complete Auto Time Logging System');
        console.log('='.repeat(70));

        // Test parameters
        const testJiraTicket = 'CTL-2149'; // Replace with actual ticket
        const testTimeMinutes = 30;
        const testDescription = 'Testing auto time logging integration';

        try {
            const result = await this.autoLogTime(testJiraTicket, testTimeMinutes, testDescription);

            console.log('\n📊 COMPLETE TIME LOGGING RESULT:');
            console.log('='.repeat(50));
            console.log(`✅ Overall Success: ${result.success}`);
            console.log(`🎯 Jira Success: ${result.jiraLogSuccess}`);
            console.log(`🛠️  Productive Success: ${result.productiveLogSuccess}`);
            console.log(`💬 Message: ${result.message}`);
            
            if (result.success) {
                console.log('\n🎯 LOGGED TIME DETAILS:');
                console.log(`   👤 Person: ${result.personName} (${result.personId})`);
                console.log(`   📁 Project: ${result.projectName} (${result.projectId})`);
                console.log(`   🛠️  Service: ${result.serviceName} (${result.serviceId})`);
                console.log(`   🎫 Jira Ticket: ${result.jiraTicketId}`);
                console.log(`   ⏰ Time: ${result.timeMinutes} minutes`);
                
                console.log('\n📋 VS CODE CONFIGURATION FOUND:');
                console.log(`   "jiraTimeTracker.productive.personId": "${result.personId}"`);
                console.log(`   "jiraTimeTracker.productive.defaultProjectId": "${result.projectId}"`);
                console.log(`   "jiraTimeTracker.productive.defaultServiceId": "${result.serviceId}"`);
            }

            if (result.jiraError) {
                console.log(`\n❌ Jira Error: ${result.jiraError}`);
            }
            
            if (result.productiveError) {
                console.log(`\n⚠️  Productive Error: ${result.productiveError}`);
            }

            console.log('\n🎯 FEATURES DEMONSTRATED:');
            console.log('  ✅ 1. Automatic user discovery via organization_memberships');
            console.log('  ✅ 2. CTL-communications project discovery');
            console.log('  ✅ 3. Intelligent service selection based on usage history');
            console.log('  ✅ 4. Dual time logging to Jira and Productive');
            console.log('  ✅ 5. Proper error handling and fallbacks');
            console.log('  ✅ 6. Configuration generation for VS Code settings');

        } catch (error: any) {
            console.error('❌ Test failed:', error.message);
        }
    }

    /**
     * Test just the discovery components without logging time
     */
    async testDiscoveryOnly(): Promise<void> {
        console.log('🧪 Testing Discovery Components Only');
        console.log('='.repeat(70));

        try {
            // Test user discovery
            console.log('\n1️⃣  Testing User Discovery...');
            const person = await this.getAuthenticatedUser();
            console.log(`   ✅ Found user: ${person.name} (${person.id})`);

            // Test project discovery
            console.log('\n2️⃣  Testing Project Discovery...');
            const project = await this.findCTLProject();
            if (project) {
                console.log(`   ✅ Found project: ${project.name} (${project.id})`);
            } else {
                console.log(`   ❌ CTL-communications project not found`);
                return;
            }

            // Test service discovery
            console.log('\n3️⃣  Testing Service Discovery...');
            const serviceResult = await this.findServiceForProject(person.id, project.id);
            console.log(`   Service ID: ${serviceResult.serviceId}`);
            console.log(`   Service Name: ${serviceResult.serviceName}`);
            console.log(`   Confidence: ${serviceResult.confidence}`);
            console.log(`   Message: ${serviceResult.message}`);

            console.log('\n✅ Discovery test completed successfully!');
            console.log('\n📋 VS CODE CONFIGURATION:');
            console.log(`   "jiraTimeTracker.productive.personId": "${person.id}"`);
            console.log(`   "jiraTimeTracker.productive.defaultProjectId": "${project.id}"`);
            if (serviceResult.serviceId) {
                console.log(`   "jiraTimeTracker.productive.defaultServiceId": "${serviceResult.serviceId}"`);
            }

        } catch (error: any) {
            console.error('❌ Discovery test failed:', error.message);
        }
    }
}

// Export for use in other files
export { CompletTimeLoggingService, AutoTimeLogResult };

// Run tests if this file is executed directly
if (require.main === module) {
    const service = new CompletTimeLoggingService();
    
    const args = process.argv.slice(2);
    const command = args[0] || 'full';

    switch (command) {
        case 'discovery':
            service.testDiscoveryOnly().catch(console.error);
            break;
        case 'full':
        default:
            service.testCompleteTimeLogging().catch(console.error);
            break;
    }
} 