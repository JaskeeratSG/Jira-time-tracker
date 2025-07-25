"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = require("axios");
// Configuration
const PRODUCTIVE_CONFIG = {
    organizationId: '42335',
    apiToken: 'e77e94a9-f882-4ee2-8efe-db82dbe00750',
    baseUrl: 'https://api.productive.io/api/v2',
    personId: '934317'
};
// Standalone ProductiveService for testing
class ProductiveService {
    constructor(config) {
        this.config = config;
    }
    async makeRequest(endpoint, method = 'GET', data = null) {
        const url = `${this.config.baseUrl}${endpoint}`;
        try {
            const response = await (0, axios_1.default)({
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
        }
        catch (error) {
            if (error.response) {
                let errorMessage = `Productive API Error: ${error.response.status}`;
                if (error.response.data?.errors) {
                    const errors = error.response.data.errors.map((err) => `${err.title}: ${err.detail}`).join('; ');
                    errorMessage += ` - ${errors}`;
                }
                else {
                    errorMessage += ` - ${error.response.data.message || error.message}`;
                }
                throw new Error(errorMessage);
            }
            throw new Error(`Productive API Error: ${error.message}`);
        }
    }
    async getAuthenticatedUser() {
        const personId = this.config.personId;
        if (personId) {
            const response = await this.makeRequest(`/people/${personId}`);
            const person = response.data;
            return {
                id: person.id,
                name: person.attributes?.name || person.attributes?.first_name + ' ' + person.attributes?.last_name || 'Unknown',
                email: person.attributes?.email,
                active: person.attributes?.deactivated_at === null
            };
        }
        throw new Error('No person ID configured');
    }
    async logMyTimeEntry(projectId, serviceId, timeMinutes, date, description, jiraTicketId) {
        const user = await this.getAuthenticatedUser();
        const timeEntryData = {
            data: {
                type: 'time_entries',
                attributes: {
                    date: date,
                    time: timeMinutes,
                    note: description || '',
                    jira_issue_id: jiraTicketId || '',
                    jira_organization: 'studiographene.atlassian.net'
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
                    }
                }
            }
        };
        return await this.makeRequest('/time_entries', 'POST', timeEntryData);
    }
}
async function testProductiveIntegration() {
    console.log('🧪 Productive Integration Test');
    console.log('Testing the working Backend Engineer service (9231369) for CTL project...\n');
    try {
        const productiveService = new ProductiveService(PRODUCTIVE_CONFIG);
        // Step 1: Get all projects to find CTL project
        console.log('📋 Step 1: Finding CTL project...');
        const projectsResponse = await productiveService.makeRequest('/projects');
        const projects = projectsResponse.data.map((project) => ({
            id: project.id,
            name: project.attributes.name,
            code: project.attributes.code
        }));
        console.log(`✅ Found ${projects.length} projects`);
        // Look for CTL project variations
        const ctlProject = projects.find(p => p.name.toLowerCase().includes('ctl') ||
            p.code?.toLowerCase().includes('ctl') ||
            p.name.toLowerCase().includes('communications'));
        if (ctlProject) {
            console.log(`🎯 Found CTL project: ${ctlProject.name} (${ctlProject.id})`);
        }
        // Step 2: Analyze existing time entries to verify the working service (9231369)
        console.log('\n📋 Step 2: Analyzing existing time entries to verify Backend Engineer service...');
        try {
            const timeEntriesResponse = await productiveService.makeRequest(`/time_entries?filter[person_id]=934317&filter[project_id]=667206&page[size]=5&include=service`);
            if (timeEntriesResponse.data.length > 0) {
                console.log(`✅ Found ${timeEntriesResponse.data.length} existing time entries`);
                // Analyze entries to confirm service 9231369
                let foundBackendService = false;
                timeEntriesResponse.data.forEach((entry, index) => {
                    console.log(`\n   Entry ${index + 1}:`);
                    console.log(`   📅 Date: ${entry.attributes.date}`);
                    console.log(`   ⏱️  Time: ${entry.attributes.time} minutes`);
                    console.log(`   🎯 Service ID: ${entry.relationships.service.data.id}`);
                    // Find service details in included data
                    if (timeEntriesResponse.included) {
                        const serviceData = timeEntriesResponse.included.find((inc) => inc.type === 'services' && inc.id === entry.relationships.service.data.id);
                        if (serviceData) {
                            console.log(`   🏷️  Service Name: ${serviceData.attributes.name}`);
                            if (serviceData.id === '9231369') {
                                console.log(`   ✅ CONFIRMED: Backend Engineer service (9231369) in use!`);
                                foundBackendService = true;
                            }
                        }
                    }
                });
                if (foundBackendService) {
                    console.log(`\n📋 Step 3: Testing Backend Engineer service (9231369)...`);
                    await testBackendEngineerService(productiveService);
                }
                else {
                    console.log(`\n⚠️  Backend Engineer service (9231369) not found in recent entries`);
                }
            }
            else {
                console.log('❌ No existing time entries found for analysis');
            }
        }
        catch (error) {
            console.log(`❌ Could not access time entries: ${error.message}`);
        }
    }
    catch (error) {
        console.log(`❌ Test failed: ${error.message}`);
    }
}
async function testBackendEngineerService(productiveService) {
    try {
        console.log(`🧪 Testing Backend Engineer service (9231369)...`);
        const result = await productiveService.logMyTimeEntry('667206', // CTL Communications project
        '9231369', // Backend Engineer service
        60, // 1 hour
        '2025-07-24', // Current working date
        'VS Code Extension Integration Test - Backend Engineer Service', 'CTL-TEST');
        console.log(`✅ SUCCESS! Backend Engineer service works perfectly!`);
        console.log(`📋 Entry ID: ${result.data.id}`);
        console.log(`\n🎯 CONFIRMED WORKING CONFIGURATION:`);
        console.log(`   Service ID: 9231369`);
        console.log(`   Service Name: Backend - Engineer`);
        console.log(`   Project: CTL Communications (667206)`);
        console.log(`   Person: Jaskeerat Chhabra (934317)`);
        console.log(`\n✅ VS Code Extension is ready with these settings!`);
        return '9231369';
    }
    catch (error) {
        console.log(`❌ Backend Engineer service failed: ${error.message}`);
        return null;
    }
}
// Run the integration test
testProductiveIntegration().catch(console.error);
//# sourceMappingURL=productive-integration.test.js.map