# 🔍 Productive Time Logging Debug Guide

## Overview

The Jira Time Tracker extension now includes comprehensive output channel logging for Productive time logging. This allows you to monitor and debug the Productive integration in real-time.

## 🚀 How to Use

### 1. Automatic Output Channel Display

The output channel will automatically show when:
- ✅ **Successful Productive time logging** - Shows detailed success information
- ❌ **Failed Productive time logging** - Shows detailed error information and API responses
- 🔍 **Manual debugging** - When you run debug commands

### 2. Credential Priority

The extension uses the following priority order for Productive credentials:

1. **Authenticated User Credentials** (highest priority)
   - Uses the currently logged-in user's Productive API token
   - This ensures you're using your own credentials, not someone else's

2. **VS Code Settings** (fallback)
   - Uses credentials configured in VS Code settings
   - Only used if no authenticated user is found

3. **Environment Variables** (lowest priority)
   - Uses `PRODUCTIVE_API_TOKEN` and `PRODUCTIVE_ORGANIZATION_ID`
   - Only used if no other credentials are available

### 2. Manual Commands

You can use these commands to access the output channel:

#### Show Productive Logs
```
Command: jira-time-tracker.show-productive-logs
Title: Show Productive Time Logging Debug Output
```
Opens the output channel and shows instructions for monitoring Productive time logging.

#### Test Output Channel
```
Command: jira-time-tracker.test-output-channel
Title: Test: Output Channel Functionality
```
Runs a simulation of Productive time logging to test the output channel functionality.

#### Test Error Logging
```
Command: jira-time-tracker.test-error-logging
Title: Test: Error Logging in Output Channel
```
Simulates a Productive API error to test error logging functionality.

#### Check Productive Credentials
```
Command: jira-time-tracker.check-productive-credentials
Title: Check Productive Credentials Source
```
Shows which credentials are being used and their source (authenticated user vs settings).

## 📊 What You'll See in the Output Channel

### Successful Time Logging
```
🚀 Starting Productive time entry creation...
📋 Parameters:
   📁 Project ID: 667206
   🛠️  Service ID: 9231369
   ⏰ Time: 30 minutes
   📅 Date: Today
   📝 Description: Test time entry
   🎯 Jira Ticket: TEST-123

✅ Productive credentials retrieved
✅ Authenticated user: John Doe (john@example.com)
📅 Using entry date: 2024-01-15

📤 Sending time entry to Productive API...
✅ Time logged successfully to Productive:
   👤 User: John Doe (john@example.com)
   📁 Project ID: 667206
   🛠️  Service ID: 9231369
   ⏰ Time: 30 minutes
   📝 Entry ID: 12345
   📅 Date: 2024-01-15
   🎯 Jira Ticket: TEST-123
```

### Error Logging
```
❌ Failed to log time to Productive: Invalid project ID
📋 API Status: 400
📋 API Response: {
  "errors": [
    {
      "title": "Invalid project",
      "detail": "Project with ID 999999 not found"
    }
  ]
}
```

## 🔧 Troubleshooting

### Common Issues and Solutions

1. **No output channel appears**
   - Make sure you're running the latest version of the extension
   - Try the test commands to verify output channel functionality

2. **Productive time logging fails silently**
   - Check the output channel for detailed error messages
   - Verify your Productive credentials in VS Code settings

3. **API errors**
   - The output channel will show the full API response
   - Check the status code and error details
   - Verify project IDs and service IDs are correct

### Debugging Steps

1. **Run the test commands** to verify output channel functionality
2. **Check your Productive settings** in VS Code settings
3. **Monitor the output channel** during time logging
4. **Look for specific error messages** in the API response

## 📋 Settings to Check

Make sure these settings are configured in VS Code:

```json
{
  "jiraTimeTracker.productive.organizationId": "YOUR_ORG_ID",
  "jiraTimeTracker.productive.apiToken": "YOUR_API_TOKEN",
  "jiraTimeTracker.productive.baseUrl": "https://api.productive.io/api/v2",
  "jiraTimeTracker.productive.defaultProjectId": "YOUR_PROJECT_ID"
}
```

## 🎯 Quick Start

1. Open VS Code Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run `Show Productive Time Logging Debug Output`
3. Log time to a Jira ticket
4. Watch the output channel for detailed logging information

The output channel will help you understand exactly what's happening during Productive time logging and quickly identify any issues. 