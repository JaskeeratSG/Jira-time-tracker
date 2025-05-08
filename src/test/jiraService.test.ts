import 'dotenv/config';
process.env.NODE_ENV = 'test';

import { JiraService } from '../services/JiraService';

async function testJiraIntegration() {
    const jiraService = new JiraService();
    
    try {
        // Test 1: Get Projects
        console.log('Testing getProjects...');
        const projects = await jiraService.getProjects();
        console.log('Projects:', projects);

        if (projects.length > 0) {
            const firstProject = projects[0];
            
            // Test 2: Get Project Issues
            console.log(`\nTesting getProjectIssues for ${firstProject.key}...`);
            const issues = await jiraService.getProjectIssues(firstProject.key);
            console.log('Issues:', issues);

            if (issues.length > 0) {
                const firstIssue = issues[0];
                
                // Test 3: Verify Issue Exists
                console.log(`\nTesting verifyTicketExists for ${firstIssue.key}...`);
                const exists = await jiraService.verifyTicketExists(firstIssue.key);
                console.log('Issue exists:', exists);

                // Test 4: Log Time
                console.log(`\nTesting logTime for ${firstIssue.key}...`);
                const result = await jiraService.logTime(firstIssue.key, 30);
                console.log('Time logged:', result);
            }
        }

        console.log('\nAll tests completed successfully!');
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run the tests
testJiraIntegration(); 