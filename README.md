
```json
{
    "jiraTimeTracker.jiraUrl": "https://your-domain.atlassian.net",
    "jiraTimeTracker.jiraUsername": "your-email@example.com",
    "jiraTimeTracker.jiraApiToken": "your-jira-api-token",
    "jiraTimeTracker.productiveApiToken": "your-productive-api-token",
    "jiraTimeTracker.productiveCompanyId": "your-productive-company-id",
    "jiraTimeTracker.productiveUserId": "your-productive-user-id",
    "jiraTimeTracker.autoTimer": true,
    "jiraTimeTracker.autoLogging": false,
    "jiraTimeTracker.enableOutputChannels": false
}
```

### Settings Explanation

- **jiraUrl**: Your Jira instance URL
- **jiraUsername**: Your Jira email address
- **jiraApiToken**: Your Jira API token
- **productiveApiToken**: Your Productive API token
- **productiveCompanyId**: Your Productive company ID
- **productiveUserId**: Your Productive user ID
- **autoTimer**: Automatically start timer when switching to a Jira branch
- **autoLogging**: Automatically log time when committing
- **enableOutputChannels**: Enable/disable debug output channels (set to `false` to reduce noise)
