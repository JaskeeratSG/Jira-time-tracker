import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface ServiceDiscoveryResult {
    success: boolean;
    personId?: string;
    personName?: string;
    projectId?: string;
    projectName?: string;
    serviceId?: string;
    serviceName?: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    message: string;
    discoveryMethod: string;
}

class ImprovedServiceDiscovery {
    private config = {
        organizationId: process.env.PRODUCTIVE_ORGANIZATION_ID || '42335',
        apiToken: process.env.PRODUCTIVE_API_TOKEN || 'e77e94a9-f882-4ee2-8efe-db82dbe00750',
        baseUrl: process.env.PRODUCTIVE_BASE_URL || 'https://api.productive.io/api/v2'
    };

    async makeRequest(endpoint: string): Promise<any> {
        const url = `${this.config.baseUrl}${endpoint}`;
        try {
            const response = await axios({
                method: 'GET',
                url,
                headers: {
                    'Content-Type': 'application/vnd.api+json',
                    'X-Auth-Token': this.config.apiToken,
                    'X-Organization-Id': this.config.organizationId
                }
            });
            return response.data;
        } catch (error: any) {
            throw new Error(`${error.response?.status}: ${error.response?.statusText || error.message}`);
        }
    }

    /**
     * BETTER APPROACH 1: Use organization_memberships to find authenticated user
     * This should return only the current user's membership
     */
         async getAuthenticatedUserViaMembership(): Promise<{ id: string; name: string; email: string }> {
         console.log('🔍 Method 1: Finding authenticated user via organization membership...');
         
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
     * BETTER APPROACH 2: For first-time users, find services via project assignments
     * Instead of looking at time entries, look at what services are available in the project
     */
    async findServicesForFirstTimeUser(personId: string, projectId: string): Promise<{
        serviceId: string | null;
        serviceName: string | null;
        confidence: 'HIGH' | 'MEDIUM' | 'LOW';
        message: string;
        method: string;
    }> {
        console.log('🛠️  Finding services for first-time user...');
        
        // Method 1: Get all services and filter by project relationships
        try {
            console.log('   📊 Method 1: Analyzing all services for project availability...');
            
            const allServicesResponse = await this.makeRequest('/services');
            const allServices = allServicesResponse.data;
            
            console.log(`   📋 Found ${allServices.length} total services in organization`);
            
            // For each service, check if it's used in the target project
            const projectServices: any[] = [];
            
            // Check recent time entries in the project to see what services are being used
            const projectTimeEntriesResponse = await this.makeRequest(
                `/time_entries?filter[project_id]=${projectId}&page[size]=50&include=service`
            );
            
            if (projectTimeEntriesResponse.data.length > 0) {
                console.log(`   📊 Found ${projectTimeEntriesResponse.data.length} recent time entries in project`);
                
                // Extract unique services used in this project
                const serviceIds = new Set(
                    projectTimeEntriesResponse.data.map((entry: any) => entry.relationships.service.data.id)
                );
                
                console.log(`   🎯 Found ${serviceIds.size} unique services used in this project`);
                
                // Get service details from included data
                if (projectTimeEntriesResponse.included) {
                    const serviceDetails = projectTimeEntriesResponse.included
                        .filter((item: any) => item.type === 'services')
                        .filter((service: any) => serviceIds.has(service.id));
                    
                    console.log('   🛠️  Services used in this project:');
                    serviceDetails.forEach((service: any) => {
                        console.log(`      • ${service.attributes.name} (${service.id})`);
                        projectServices.push({
                            id: service.id,
                            name: service.attributes.name
                        });
                    });
                    
                    // For first-time users, suggest the most commonly used service
                    if (projectServices.length === 1) {
                        return {
                            serviceId: projectServices[0].id,
                            serviceName: projectServices[0].name,
                            confidence: 'HIGH',
                            message: `Perfect! This project uses exactly one service: ${projectServices[0].name}`,
                            method: 'Project service analysis'
                        };
                    } else if (projectServices.length > 1) {
                        // Find the most commonly used service
                        const serviceCounts: { [key: string]: number } = {};
                        projectTimeEntriesResponse.data.forEach((entry: any) => {
                            const serviceId = entry.relationships.service.data.id;
                            serviceCounts[serviceId] = (serviceCounts[serviceId] || 0) + 1;
                        });
                        
                        const mostUsedServiceId = Object.keys(serviceCounts).reduce((a, b) => 
                            serviceCounts[a] > serviceCounts[b] ? a : b
                        );
                        
                        const mostUsedService = projectServices.find(s => s.id === mostUsedServiceId);
                        
                        return {
                            serviceId: mostUsedService?.id || null,
                            serviceName: mostUsedService?.name || null,
                            confidence: 'MEDIUM',
                            message: `Multiple services available. Suggesting most used: ${mostUsedService?.name}`,
                            method: 'Most used service analysis'
                        };
                    }
                }
            }
            
            return {
                serviceId: null,
                serviceName: null,
                confidence: 'LOW',
                message: 'No time entries found in this project. Manual service selection needed.',
                method: 'No data available'
            };
            
        } catch (error: any) {
            return {
                serviceId: null,
                serviceName: null,
                confidence: 'LOW',
                message: `Service discovery failed: ${error.message}`,
                method: 'Error'
            };
        }
    }

    /**
     * IMPROVED MAIN DISCOVERY FUNCTION
     * Combines better authentication with first-time user support
     */
    async discoverServiceForProject(projectId: string): Promise<ServiceDiscoveryResult> {
        console.log('🚀 IMPROVED Service Discovery');
        console.log(`🎯 Project: ${projectId}`);
        console.log('='.repeat(50));

        try {
            // Step 1: Better authenticated user discovery
            const person = await this.getAuthenticatedUserViaMembership();
            console.log(`✅ Authenticated User: ${person.name} (${person.id})`);

            // Step 2: Get project details
            const projectResponse = await this.makeRequest(`/projects/${projectId}`);
            const project = projectResponse.data;
            console.log(`✅ Project: ${project.attributes.name} (${project.id})`);

            // Step 3: Try historical analysis first (existing approach)
            console.log('\n📊 Step 3: Checking if user has logged time before...');
            
            const timeEntriesResponse = await this.makeRequest(
                `/time_entries?filter[person_id]=${person.id}&filter[project_id]=${projectId}&page[size]=10&include=service`
            );

            if (timeEntriesResponse.data.length > 0) {
                // User has logged time before - use existing method
                console.log(`   ✅ Found ${timeEntriesResponse.data.length} previous time entries`);
                
                const serviceIds = new Set(
                    timeEntriesResponse.data.map((entry: any) => entry.relationships.service.data.id as string)
                );
                const uniqueServiceIds = Array.from(serviceIds);

                                 if (uniqueServiceIds.length === 1) {
                     const serviceId = uniqueServiceIds[0] as string;
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
                        success: true,
                        personId: person.id,
                        personName: person.name,
                        projectId: project.id,
                        projectName: project.attributes.name,
                        serviceId: serviceId,
                        serviceName: serviceName,
                        confidence: 'HIGH',
                        message: `Perfect! Found from ${timeEntriesResponse.data.length} previous time entries`,
                        discoveryMethod: 'Historical usage analysis'
                    };
                }
            } else {
                // First-time user - use new approach
                console.log('   ⚠️  No previous time entries found. User is logging time for first time.');
                console.log('\n🛠️  Step 4: First-time user service discovery...');
                
                const serviceResult = await this.findServicesForFirstTimeUser(person.id, projectId);
                
                return {
                    success: serviceResult.serviceId !== null,
                    personId: person.id,
                    personName: person.name,
                    projectId: project.id,
                    projectName: project.attributes.name,
                    serviceId: serviceResult.serviceId || undefined,
                    serviceName: serviceResult.serviceName || undefined,
                    confidence: serviceResult.confidence,
                    message: serviceResult.message,
                    discoveryMethod: serviceResult.method
                };
            }

            return {
                success: false,
                confidence: 'LOW',
                message: 'Service discovery completed but no clear service found',
                discoveryMethod: 'Incomplete analysis'
            };

        } catch (error: any) {
            return {
                success: false,
                confidence: 'LOW',
                message: `Discovery failed: ${error.message}`,
                discoveryMethod: 'Error'
            };
        }
    }

    /**
     * Test the improved discovery system
     */
    async testImprovedDiscovery(): Promise<void> {
        console.log('🧪 Testing Improved Service Discovery System');
        console.log('='.repeat(70));

        const testProject = '667206'; // CTL Communications
        
        const result = await this.discoverServiceForProject(testProject);

        console.log('\n📊 IMPROVED DISCOVERY RESULT:');
        console.log('='.repeat(40));
        console.log(`✅ Success: ${result.success}`);
        console.log(`🎯 Confidence: ${result.confidence}`);
        console.log(`📋 Method: ${result.discoveryMethod}`);
        console.log(`💬 Message: ${result.message}`);
        
        if (result.success) {
            console.log('\n🎯 CONFIGURATION FOR VS CODE:');
            console.log(`   "jiraTimeTracker.productive.personId": "${result.personId}"`);
            console.log(`   "jiraTimeTracker.productive.defaultProjectId": "${result.projectId}"`);
            console.log(`   "jiraTimeTracker.productive.defaultServiceId": "${result.serviceId}"`);
            
            console.log('\n📋 HUMAN READABLE:');
            console.log(`   👤 Person: ${result.personName}`);
            console.log(`   📁 Project: ${result.projectName}`);
            console.log(`   🛠️  Service: ${result.serviceName}`);
        }

        console.log('\n🎯 IMPROVEMENTS MADE:');
        console.log('  ✅ 1. Better auth: Uses /organization_memberships (no user traversal)');
        console.log('  ✅ 2. First-time support: Analyzes project services when no history');
        console.log('  ✅ 3. Confidence scoring: HIGH/MEDIUM/LOW based on data quality');
        console.log('  ✅ 4. Method tracking: Shows how the service was discovered');
    }
}

// Run the test
const improvedDiscovery = new ImprovedServiceDiscovery();
improvedDiscovery.testImprovedDiscovery().catch(console.error); 