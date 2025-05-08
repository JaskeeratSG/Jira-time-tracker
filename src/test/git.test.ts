// Set test environment
process.env.NODE_ENV = 'test';

import { getBranchName } from '../utils/git';

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

// Run the tests
testGitBranch();

