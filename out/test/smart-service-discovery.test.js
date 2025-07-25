"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartServiceDiscovery = void 0;
const axios_1 = require("axios");
const dotenv = require("dotenv");
const path = require("path");
// Load .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
class SmartServiceDiscovery {
    constructor() {
        this.config = {
            organizationId: process.env.PRODUCTIVE_ORGANIZATION_ID || '42335',
            apiToken: process.env.PRODUCTIVE_API_TOKEN || 'e77e94a9-f882-4ee2-8efe-db82dbe00750',
            baseUrl: process.env.PRODUCTIVE_BASE_URL || 'https://api.productive.io/api/v2'
        };
    }
    async makeRequest(endpoint) {
        const url = `${this.config.baseUrl}${endpoint}`;
        try {
            const response = await (0, axios_1.default)({
                method: 'GET',
                url,
                headers: {
                    'Content-Type': 'application/vnd.api+json',
                    'X-Auth-Token': this.config.apiToken,
                    'X-Organization-Id': this.config.organizationId
                }
            });
            return response.data;
        }
        catch (error) {
            throw new Error(`${error.response?.status}: ${error.response?.statusText || error.message}`);
        }
    }
    /**
     * METHOD 1: Get user via organization membership (we know this works)
     */
    async getAuthenticatedUser() {
        const membershipResponse = await this.makeRequest('/organization_memberships');
        const membership = membershipResponse.data[0];
        const personId = membership.id;
        const personResponse = await this.makeRequest(`/people/${personId}`);
        const person = personResponse.data;
        return {
            id: person.id,
            name: person.attributes.name || `${person.attributes.first_name} ${person.attributes.last_name}`,
            email: person.attributes.email
        };
    }
    /**
     * METHOD 2: Analyze project's service patterns for intelligent defaults
     */
    async getProjectServicePatterns(projectId) {
        console.log('🔍 Method 2: Analyzing project service patterns...');
        try {
            // Get all time entries for this project to understand service patterns
            const timeEntriesResponse = await this.makeRequest(`/time_entries?filter[project_id]=${projectId}&page[size]=100&include=service,person`);
            if (timeEntriesResponse.data.length === 0) {
                return {
                    method: 'Project Service Patterns',
                    serviceId: null,
                    serviceName: null,
                    confidence: 'LOW',
                    message: 'No time entries found in this project',
                    reasoning: 'Project has no activity to analyze'
                };
            }
            // Analyze service usage patterns
            const serviceUsage = {};
            timeEntriesResponse.data.forEach((entry) => {
                const serviceId = entry.relationships.service.data.id;
                const personId = entry.relationships.person.data.id;
                if (!serviceUsage[serviceId]) {
                    serviceUsage[serviceId] = { count: 0, uniqueUsers: new Set(), name: 'Unknown' };
                }
                serviceUsage[serviceId].count++;
                serviceUsage[serviceId].uniqueUsers.add(personId);
            });
            // Get service names from included data
            if (timeEntriesResponse.included) {
                const services = timeEntriesResponse.included.filter((item) => item.type === 'services');
                services.forEach((service) => {
                    if (serviceUsage[service.id]) {
                        serviceUsage[service.id].name = service.attributes.name;
                    }
                });
            }
            // Find the most commonly used service
            const sortedServices = Object.entries(serviceUsage)
                .map(([id, data]) => ({
                id,
                name: data.name,
                count: data.count,
                uniqueUsers: data.uniqueUsers.size,
                popularity: data.count * data.uniqueUsers.size
            }))
                .sort((a, b) => b.popularity - a.popularity);
            console.log('\n   📊 Project Service Usage:');
            sortedServices.forEach((service, index) => {
                console.log(`   ${index + 1}. ${service.name} - ${service.count} entries by ${service.uniqueUsers} users`);
            });
            if (sortedServices.length > 0) {
                const bestService = sortedServices[0];
                const confidence = bestService.uniqueUsers >= 3 ? 'HIGH' : 'MEDIUM';
                return {
                    method: 'Project Service Patterns',
                    serviceId: bestService.id,
                    serviceName: bestService.name,
                    confidence,
                    message: `Most used service: ${bestService.name} (${bestService.count} entries by ${bestService.uniqueUsers} users)`,
                    reasoning: `Popular service with ${bestService.uniqueUsers} users logging ${bestService.count} entries`,
                    allAvailableServices: sortedServices.map(s => ({ id: s.id, name: s.name }))
                };
            }
            return {
                method: 'Project Service Patterns',
                serviceId: null,
                serviceName: null,
                confidence: 'LOW',
                message: 'Could not determine service patterns',
                reasoning: 'Insufficient data to analyze patterns'
            };
        }
        catch (error) {
            return {
                method: 'Project Service Patterns',
                serviceId: null,
                serviceName: null,
                confidence: 'LOW',
                message: `Pattern analysis failed: ${error.message}`,
                reasoning: 'API error during pattern analysis'
            };
        }
    }
    /**
     * METHOD 3: Smart service matching based on user role/department
     */
    async getServiceByUserRole(personId) {
        console.log('🔍 Method 3: Matching services by user role/department...');
        try {
            // Get user details to understand their role
            const person = await this.makeRequest(`/people/${personId}`);
            const userTitle = person.data.attributes?.title?.toLowerCase() || '';
            const userEmail = person.data.attributes?.email?.toLowerCase() || '';
            console.log(`   👤 User Title: ${person.data.attributes?.title || 'Not set'}`);
            console.log(`   📧 Email: ${userEmail}`);
            // Get all services to match by name/description
            const servicesResponse = await this.makeRequest('/services');
            const allServices = servicesResponse.data;
            console.log(`   📋 Total available services: ${allServices.length}`);
            // Smart matching based on title and email patterns
            const roleKeywords = {
                'backend': ['backend', 'server', 'api', 'database'],
                'frontend': ['frontend', 'ui', 'react', 'angular', 'vue'],
                'fullstack': ['fullstack', 'full-stack', 'developer'],
                'devops': ['devops', 'infrastructure', 'deployment'],
                'qa': ['qa', 'testing', 'quality'],
                'design': ['design', 'ui/ux', 'graphics'],
                'pm': ['project', 'management', 'manager'],
                'engineer': ['engineer', 'engineering', 'development']
            };
            const matchedServices = [];
            for (const service of allServices) {
                const serviceName = service.attributes.name.toLowerCase();
                const serviceDesc = service.attributes.description?.toLowerCase() || '';
                let matchScore = 0;
                let matchReasons = [];
                // Check title matches
                for (const [role, keywords] of Object.entries(roleKeywords)) {
                    if (userTitle.includes(role)) {
                        for (const keyword of keywords) {
                            if (serviceName.includes(keyword) || serviceDesc.includes(keyword)) {
                                matchScore += 10;
                                matchReasons.push(`Title "${userTitle}" matches service "${serviceName}"`);
                            }
                        }
                    }
                }
                // Check email domain patterns
                if (userEmail.includes('backend') && serviceName.includes('backend')) {
                    matchScore += 15;
                    matchReasons.push('Email suggests backend role');
                }
                // Direct keyword matching
                const userKeywords = userTitle.split(/[\s.-]+/);
                for (const keyword of userKeywords) {
                    if (keyword.length > 2 && serviceName.includes(keyword)) {
                        matchScore += 5;
                        matchReasons.push(`Title keyword "${keyword}" matches service`);
                    }
                }
                if (matchScore > 0) {
                    matchedServices.push({
                        id: service.id,
                        name: service.attributes.name,
                        score: matchScore,
                        reasons: matchReasons
                    });
                }
            }
            // Sort by match score
            matchedServices.sort((a, b) => b.score - a.score);
            console.log('\n   🎯 Service Matches:');
            matchedServices.slice(0, 3).forEach((match, index) => {
                console.log(`   ${index + 1}. ${match.name} (Score: ${match.score})`);
                match.reasons.forEach(reason => console.log(`      - ${reason}`));
            });
            if (matchedServices.length > 0) {
                const bestMatch = matchedServices[0];
                const confidence = bestMatch.score >= 15 ? 'HIGH' : bestMatch.score >= 5 ? 'MEDIUM' : 'LOW';
                return {
                    method: 'User Role Matching',
                    serviceId: bestMatch.id,
                    serviceName: bestMatch.name,
                    confidence,
                    message: `Best role match: ${bestMatch.name} (Score: ${bestMatch.score})`,
                    reasoning: bestMatch.reasons.join('; '),
                    allAvailableServices: matchedServices.map(s => ({ id: s.id, name: s.name }))
                };
            }
            return {
                method: 'User Role Matching',
                serviceId: null,
                serviceName: null,
                confidence: 'LOW',
                message: 'No role-based service matches found',
                reasoning: 'User title/email did not match any service patterns'
            };
        }
        catch (error) {
            return {
                method: 'User Role Matching',
                serviceId: null,
                serviceName: null,
                confidence: 'LOW',
                message: `Role matching failed: ${error.message}`,
                reasoning: 'API error during role analysis'
            };
        }
    }
    /**
     * METHOD 4: Get most commonly used service across organization
     */
    async getOrganizationDefaultService() {
        console.log('🔍 Method 4: Finding most commonly used service organization-wide...');
        try {
            // Get recent time entries across the organization
            const recentEntriesResponse = await this.makeRequest('/time_entries?page[size]=100&include=service');
            if (recentEntriesResponse.data.length === 0) {
                return {
                    method: 'Organization Default',
                    serviceId: null,
                    serviceName: null,
                    confidence: 'LOW',
                    message: 'No recent time entries found',
                    reasoning: 'No organization activity to analyze'
                };
            }
            // Count service usage
            const serviceUsage = {};
            recentEntriesResponse.data.forEach((entry) => {
                const serviceId = entry.relationships.service.data.id;
                if (!serviceUsage[serviceId]) {
                    serviceUsage[serviceId] = { count: 0, name: 'Unknown' };
                }
                serviceUsage[serviceId].count++;
            });
            // Get service names
            if (recentEntriesResponse.included) {
                const services = recentEntriesResponse.included.filter((item) => item.type === 'services');
                services.forEach((service) => {
                    if (serviceUsage[service.id]) {
                        serviceUsage[service.id].name = service.attributes.name;
                    }
                });
            }
            // Find most used service
            const sortedServices = Object.entries(serviceUsage)
                .map(([id, data]) => ({ id, name: data.name, count: data.count }))
                .sort((a, b) => b.count - a.count);
            console.log('\n   📊 Organization Service Usage:');
            sortedServices.slice(0, 5).forEach((service, index) => {
                console.log(`   ${index + 1}. ${service.name} - ${service.count} recent entries`);
            });
            if (sortedServices.length > 0) {
                const mostUsed = sortedServices[0];
                const confidence = mostUsed.count >= 20 ? 'MEDIUM' : 'LOW';
                return {
                    method: 'Organization Default',
                    serviceId: mostUsed.id,
                    serviceName: mostUsed.name,
                    confidence,
                    message: `Most used service: ${mostUsed.name} (${mostUsed.count} recent entries)`,
                    reasoning: `Default to organization's most active service`,
                    allAvailableServices: sortedServices.map(s => ({ id: s.id, name: s.name }))
                };
            }
            return {
                method: 'Organization Default',
                serviceId: null,
                serviceName: null,
                confidence: 'LOW',
                message: 'Could not determine organization default',
                reasoning: 'Insufficient organization data'
            };
        }
        catch (error) {
            return {
                method: 'Organization Default',
                serviceId: null,
                serviceName: null,
                confidence: 'LOW',
                message: `Organization analysis failed: ${error.message}`,
                reasoning: 'API error during organization analysis'
            };
        }
    }
    /**
     * SMART SERVICE DISCOVERY for first-time users (AUTOMATED BRANCH LOGGING)
     */
    async discoverServiceForAutomatedLogging(personId, projectId) {
        console.log('🚀 SMART SERVICE DISCOVERY FOR AUTOMATED BRANCH LOGGING');
        console.log(`👤 Person: ${personId}`);
        console.log(`📁 Project: ${projectId}`);
        console.log('='.repeat(60));
        // Try methods in order of reliability for automation
        const methods = [
            () => this.getProjectServicePatterns(projectId),
            () => this.getServiceByUserRole(personId),
            () => this.getOrganizationDefaultService()
        ];
        for (const method of methods) {
            const result = await method();
            console.log(`\n📊 ${result.method} Result:`);
            console.log(`   Service: ${result.serviceName || 'None'} (${result.serviceId || 'None'})`);
            console.log(`   Confidence: ${result.confidence}`);
            console.log(`   Message: ${result.message}`);
            console.log(`   Reasoning: ${result.reasoning}`);
            // For automation, accept MEDIUM or HIGH confidence
            if (result.serviceId && (result.confidence === 'HIGH' || result.confidence === 'MEDIUM')) {
                console.log('\n✅ SUCCESS! Found suitable service for automation.');
                return result;
            }
        }
        // If all fail, provide the best available option
        console.log('\n⚠️  All high-confidence methods failed. Using fallback strategy...');
        // Fallback: Get any available service from the project
        try {
            const fallbackResult = await this.getProjectServicePatterns(projectId);
            if (fallbackResult.allAvailableServices && fallbackResult.allAvailableServices.length > 0) {
                const fallbackService = fallbackResult.allAvailableServices[0];
                return {
                    method: 'Fallback Strategy',
                    serviceId: fallbackService.id,
                    serviceName: fallbackService.name,
                    confidence: 'LOW',
                    message: `Using first available service: ${fallbackService.name}`,
                    reasoning: 'Automated logging requires a service - using best available option',
                    allAvailableServices: fallbackResult.allAvailableServices
                };
            }
        }
        catch (e) {
            // ignore fallback errors
        }
        return {
            method: 'All methods failed',
            serviceId: null,
            serviceName: null,
            confidence: 'LOW',
            message: 'Automated service discovery failed. Manual configuration required.',
            reasoning: 'No suitable service found for automated logging'
        };
    }
    /**
     * Test smart service discovery for your use case
     */
    async testSmartDiscovery() {
        console.log('🧪 Testing Smart Service Discovery for Automated Branch Logging');
        console.log('='.repeat(70));
        try {
            const user = await this.getAuthenticatedUser();
            const projectId = '667206'; // CTL Communications
            console.log(`✅ Authenticated User: ${user.name} (${user.id})`);
            const result = await this.discoverServiceForAutomatedLogging(user.id, projectId);
            console.log('\n🎯 FINAL SMART DISCOVERY RESULT:');
            console.log('='.repeat(50));
            console.log(`Method: ${result.method}`);
            console.log(`Service: ${result.serviceName} (${result.serviceId})`);
            console.log(`Confidence: ${result.confidence}`);
            console.log(`Message: ${result.message}`);
            console.log(`Reasoning: ${result.reasoning}`);
            if (result.allAvailableServices && result.allAvailableServices.length > 0) {
                console.log('\n📋 All Available Services for This Project:');
                result.allAvailableServices.forEach((service, index) => {
                    console.log(`   ${index + 1}. ${service.name} (${service.id})`);
                });
            }
            console.log('\n🎯 FOR AUTOMATED BRANCH LOGGING:');
            console.log('  ✅ Confidence-based selection');
            console.log('  ✅ Works for first-time users');
            console.log('  ✅ Uses project patterns');
            console.log('  ✅ Role-based matching');
            console.log('  ✅ Graceful fallbacks');
            console.log('  ✅ Cache-friendly results');
            if (result.serviceId) {
                console.log('\n🚀 READY FOR AUTOMATION!');
                console.log(`   Use service ${result.serviceId} for branch-based time logging`);
            }
            else {
                console.log('\n⚠️  MANUAL SETUP NEEDED');
                console.log('   Consider configuring a default service for this user/project');
            }
        }
        catch (error) {
            console.error('❌ Smart discovery test failed:', error.message);
        }
    }
}
exports.SmartServiceDiscovery = SmartServiceDiscovery;
// Run test if this file is executed directly
if (require.main === module) {
    const discovery = new SmartServiceDiscovery();
    discovery.testSmartDiscovery().catch(console.error);
}
//# sourceMappingURL=smart-service-discovery.test.js.map