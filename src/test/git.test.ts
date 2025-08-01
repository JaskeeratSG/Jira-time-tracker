// Set test environment
process.env.NODE_ENV = 'test';

import { getBranchName } from '../utils/git';
import 'dotenv/config';
import { GitService } from '../services/GitService';
import { JiraService } from '../services/JiraService';

async function testGitBranch() {
    try {
        console.log('Testing Git Branch functionality...');
        
        // Test 1: Get current branch name
        console.log('\nTest 1: Getting current branch name');
        const branchName = await getBranchName();
        console.log('Current branch:', branchName);

        // Test 2: Validate branch name format
        console.log('\nTest 2: Validating branch name format');
        const branchPattern = /^(feature|feat|fix)\/[A-Z]+-\d+/i;
        const isValidFormat = branchPattern.test(branchName);
        console.log('Is valid format:', isValidFormat);
        if (!isValidFormat) {
            console.log('Warning: Branch name does not match expected format (feature/PROJ-123)');
        }

        // Test 3: Extract ticket information
        console.log('\nTest 3: Extracting ticket information');
        const match = branchName.match(/(?:feature|feat|fix)\/([A-Z]+-\d+)/i);
        if (match) {
            const ticketId = match[1];
            console.log('Extracted ticket ID:', ticketId);
        } else {
            console.log('No ticket ID found in branch name');
        }

        console.log('\nGit branch tests completed!');
    } catch (error: any) {
        console.error('Error during git branch tests:', error.message);
    }
}

async function testGitAndJiraIntegration(email: string) {
    // Note: GitService now requires JiraService and outputChannel
    // const gitService = new GitService();
    const jiraService = new JiraService();
    
    try {
        // Test 1: Get Git User Email
        console.log('Testing getUserEmail...');
        // Note: GitService methods are deprecated
        // const userEmail = await gitService.getUserEmail();
        // Note: GitService methods are deprecated
        // console.log('User Email:', userEmail);

        // Note: GitService methods are deprecated
        // if (!userEmail) {
            console.log('No Git email configured. Cannot proceed with project filtering.');
            return;
        // }

        // Test 2: Get Projects for User Email
        // Note: GitService methods are deprecated
        // console.log('\nTesting getProjectsByUserEmail for:', userEmail);
        const userProjects = await jiraService.getProjectsByUserEmail(email);
        console.log('Projects associated with user email:', userProjects);

        if (userProjects.length === 0) {
            console.log('No projects found for the current user email.');
        } else {
            // Test 3: Get Issues for First Project
            const firstProject = userProjects[0] as { key: string };
            console.log(`\nTesting getProjectIssues for ${firstProject.key}...`);
            const issues = await jiraService.getProjectIssues(firstProject.key);
            console.log('Issues:', issues);
        }

        console.log('\nAll tests completed successfully!');
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run the tests
testGitBranch();
testGitAndJiraIntegration('jkchhabra4@gmail.com');

