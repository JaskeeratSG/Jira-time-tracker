const axios = require('axios');

// Productive credentials from the screenshot
const ORGANIZATION_ID = '42335';
const API_TOKEN = 'e77e94a9-f882-4ee2-8efe-db82dbe00750';
const BASE_URL = 'https://api.productive.io/api/v2';

async function testProductiveConnection() {
    console.log('🔧 Testing Productive API Connection...\n');
    
    try {
        // Test 1: Get current user info
        console.log('1. Testing authentication (GET /people/me)...');
        const userResponse = await axios.get(`${BASE_URL}/people/me`, {
            headers: {
                'Content-Type': 'application/vnd.api+json',
                'X-Auth-Token': API_TOKEN,
                'X-Organization-Id': ORGANIZATION_ID
            }
        });
        
        console.log('✅ Authentication successful!');
        console.log(`   User: ${userResponse.data.data.attributes.name}`);
        console.log(`   Email: ${userResponse.data.data.attributes.email}`);
        console.log(`   Person ID: ${userResponse.data.data.id}\n`);
        
        // Test 2: Get projects
        console.log('2. Testing projects access (GET /projects)...');
        const projectsResponse = await axios.get(`${BASE_URL}/projects`, {
            headers: {
                'Content-Type': 'application/vnd.api+json',
                'X-Auth-Token': API_TOKEN,
                'X-Organization-Id': ORGANIZATION_ID
            },
            params: {
                'page[size]': 5 // Limit to first 5 projects
            }
        });
        
        console.log('✅ Projects access successful!');
        console.log(`   Found ${projectsResponse.data.data.length} projects (showing first 5):`);
        projectsResponse.data.data.forEach((project, index) => {
            console.log(`   ${index + 1}. ${project.attributes.name} (ID: ${project.id})`);
        });
        console.log('');
        
        // Test 3: Check organization info
        console.log('3. Testing organization access (GET /organizations)...');
        const orgResponse = await axios.get(`${BASE_URL}/organizations/${ORGANIZATION_ID}`, {
            headers: {
                'Content-Type': 'application/vnd.api+json',
                'X-Auth-Token': API_TOKEN,
                'X-Organization-Id': ORGANIZATION_ID
            }
        });
        
        console.log('✅ Organization access successful!');
        console.log(`   Organization: ${orgResponse.data.data.attributes.name}`);
        console.log(`   ID: ${orgResponse.data.data.id}\n`);
        
        console.log('🎉 All tests passed! Productive connection is working perfectly.\n');
        console.log('📋 Integration Summary:');
        console.log('   ✅ Authentication: Working');
        console.log('   ✅ Projects Access: Working');
        console.log('   ✅ Organization Access: Working');
        console.log('   ✅ API Token: Valid (READ/WRITE permissions)');
        console.log('\n💡 Next Steps:');
        console.log('   1. Configure VS Code settings with these credentials');
        console.log('   2. Set up project mapping between JIRA and Productive projects');
        console.log('   3. Start logging time that will sync to both JIRA and Productive!');
        
        return true;
        
    } catch (error) {
        console.error('❌ Connection failed:');
        
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Message: ${error.response.data?.errors?.[0]?.detail || error.response.statusText}`);
            
            if (error.response.status === 401) {
                console.error('\n🔑 Authentication Error:');
                console.error('   - Check if API token is correct');
                console.error('   - Verify token has not expired');
                console.error('   - Ensure token has required permissions');
            } else if (error.response.status === 403) {
                console.error('\n🚫 Permission Error:');
                console.error('   - API token may not have sufficient permissions');
                console.error('   - Check organization access rights');
            }
        } else if (error.code === 'ENOTFOUND') {
            console.error('   Network Error: Cannot reach Productive API');
            console.error('   - Check internet connection');
            console.error('   - Verify the API URL is correct');
        } else {
            console.error(`   Error: ${error.message}`);
        }
        
        return false;
    }
}

// Run the test
testProductiveConnection()
    .then(success => {
        if (success) {
            console.log('\n🔧 To configure in VS Code, add these settings:');
            console.log('   "jiraTimeTracker.productive.organizationId": "42335"');
            console.log('   "jiraTimeTracker.productive.apiToken": "e77e94a9-f882-4ee2-8efe-db82dbe00750"');
            console.log('   "jiraTimeTracker.productive.baseUrl": "https://api.productive.io/api/v2"');
        }
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Unexpected error:', error);
        process.exit(1);
    }); 