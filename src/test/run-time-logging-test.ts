#!/usr/bin/env ts-node

import { CompletTimeLoggingService } from './complete-time-logging.test';

async function main() {
    console.log('🚀 Starting Complete Time Logging Test');
    console.log('=====================================\n');

    const service = new CompletTimeLoggingService();
    
    const args = process.argv.slice(2);
    const command = args[0] || 'help';

    switch (command) {
        case 'discovery':
            console.log('Running discovery test only (no actual time logging)...\n');
            await service.testDiscoveryOnly();
            break;
            
        case 'full':
            console.log('Running full test with actual time logging...\n');
            console.log('⚠️  WARNING: This will log actual time to Jira and Productive!');
            console.log('Make sure you want to proceed...\n');
            await service.testCompleteTimeLogging();
            break;
            
        case 'help':
        default:
            console.log('Available commands:');
            console.log('  discovery - Test discovery only (safe, no time logging)');
            console.log('  full      - Test complete flow with actual time logging');
            console.log('\nExamples:');
            console.log('  npm run test:time-logging discovery');
            console.log('  npm run test:time-logging full');
            console.log('\nNote: Make sure your .env file is configured with:');
            console.log('  PRODUCTIVE_ORGANIZATION_ID=your_org_id');
            console.log('  PRODUCTIVE_API_TOKEN=your_api_token');
            console.log('  JIRA_EMAIL=your_jira_email');
            console.log('  JIRA_API_TOKEN=your_jira_token');
            console.log('  JIRA_BASE_URL=your_jira_url');
            break;
    }
}

main().catch(console.error); 