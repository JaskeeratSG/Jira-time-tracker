# Ticket Info Feature

## Overview

The Ticket Info feature automatically displays Jira ticket information when you switch to a branch that contains a Jira ticket key. This provides immediate context about the work you're about to do without having to manually look up ticket details.

## Features

### 🎫 Automatic Ticket Detection
- Automatically detects Jira ticket keys in branch names
- Supports common branch naming patterns:
  - `PROJECT-123` (direct ticket key)
  - `feature/PROJECT-123` (feature branch)
  - `bugfix/PROJECT-123` (bug fix branch)
  - `hotfix/PROJECT-123` (hot fix branch)
  - `release/PROJECT-123` (release branch)
  - `feat/PROJECT-123` (conventional commits)
  - `fix/PROJECT-123` (conventional commits)
  - `chore/PROJECT-123` (conventional commits)

### 📋 Rich Ticket Information Display
- **Ticket Key**: The Jira ticket identifier (e.g., `PROJ-123`)
- **Summary**: The ticket's title/summary
- **Project**: The project the ticket belongs to
- **Status**: Current status of the ticket (e.g., "In Progress", "To Do", "Done")
- **Description**: Full description of the ticket (if available)

### 🎨 Sleek UI Design
- Modern card-based design that fits with VS Code's theme
- Smooth animations when ticket info appears/disappears
- Responsive layout that adapts to different screen sizes
- Uses VS Code's native color scheme variables

### 🔗 Quick Actions
- **Open in Jira**: Opens the ticket directly in your Jira instance
- **Copy Key**: Copies the ticket key to clipboard for easy sharing

## How It Works

### 1. Branch Change Detection
When you switch branches, the extension:
1. Detects the branch change event
2. Extracts any Jira ticket key from the branch name
3. Fetches detailed ticket information from Jira API

### 2. Ticket Information Fetching
The extension makes an authenticated API call to Jira to get:
- Ticket summary and description
- Current status
- Project information
- Any other relevant metadata

### 3. UI Updates
The ticket information is displayed in a dedicated section in the sidebar:
- Shows immediately when a ticket is detected
- Hides when no ticket is found or when switching to branches without tickets
- Updates in real-time as you switch between branches

## Usage

### Automatic Detection
The feature works automatically - no configuration needed! Simply:
1. Switch to a branch with a Jira ticket key in the name
2. The ticket information will appear in the sidebar
3. Use the action buttons to interact with the ticket

### Manual Testing
You can test the feature by:
1. Creating a branch with a Jira ticket key (e.g., `feature/PROJ-123`)
2. Switching to that branch
3. Checking the sidebar for ticket information

## Technical Implementation

### Components
- **TicketInfoComponent**: Renders the ticket information UI
- **GitService**: Detects branch changes and extracts ticket keys
- **JiraService**: Fetches ticket details from Jira API
- **TimeTrackerSidebarProvider**: Coordinates the display and updates

### Message Flow
1. `GitService` detects branch change
2. `BranchChangeService` extracts ticket key and fetches details
3. `TimeTrackerSidebarProvider` sends ticket info to webview
4. `TicketInfoComponent` displays the information

### API Integration
- Uses Jira REST API v2 for fetching ticket details
- Authenticates using stored credentials
- Handles errors gracefully with fallback information

## Configuration

No additional configuration is required beyond your existing Jira authentication setup. The feature uses the same credentials as the time tracking functionality.

## Error Handling

The feature includes robust error handling:
- **Network errors**: Shows basic ticket info without details
- **Authentication errors**: Prompts user to sign in
- **Invalid ticket keys**: Gracefully handles non-existent tickets
- **API rate limits**: Respects Jira API limits

## Future Enhancements

Potential improvements could include:
- Caching ticket information to reduce API calls
- Support for multiple ticket keys in branch names
- Integration with time tracking to auto-start timers
- Custom ticket field display options
- Offline mode with cached ticket data

## Troubleshooting

### Ticket Info Not Appearing
1. Check that your branch name contains a valid Jira ticket key
2. Verify you're authenticated with Jira
3. Check the output channel for error messages

### Incorrect Ticket Information
1. Ensure the ticket exists in your Jira instance
2. Verify you have access to the ticket
3. Check that your Jira credentials are correct

### Performance Issues
- The feature makes one API call per branch switch
- Consider using branch names that don't change frequently
- API calls are cached briefly to avoid duplicate requests 