# Git Branch Change Detection Implementation

## Overview

The Git Branch Change Detection system is a core feature of the Jira Time Tracker VS Code extension that automatically detects when users switch Git branches and performs automated actions like populating Jira ticket information and starting timers.

## Architecture

### Core Components

#### 1. GitService (`src/services/GitService.ts`)
**Primary responsibility:** Git repository detection and branch change monitoring

**Key Features:**
- **Hybrid Detection Strategy:**
  - **Primary:** Uses `vscode.git` extension API for event-driven detection
  - **Fallback:** File system watchers monitoring `.git/HEAD` files when Git API is unavailable
- **Multi-Repository Support:** Detects Git repos in workspace root, subfolders, and nested directories
- **Branch Change Events:** Fires callbacks when branches change in any detected repository

**Core Methods:**
```typescript
// Initialize Git extension and set up watchers
initializeGitExtension()
updateRepositoryWatchers()

// File system fallback for branch detection
setupFileSystemWatchers()
setupHeadFileWatcher(repoPath, headPath)
handleHeadFileChange(repoPath)

// Jira ticket discovery from branch names
findLinkedJiraTicket(branchName, repoPath)
```

#### 2. BranchChangeService (`src/services/BranchChangeService.ts`)
**Primary responsibility:** Orchestrates branch change automation and UI updates

**Key Features:**
- **Auto-population:** Updates Jira project/issue fields in the UI when branch changes
- **Auto-timer:** Automatically starts timer when switching to a Jira-linked branch
- **State Persistence:** Saves settings and last known branch across extension reloads
- **Commit Logging:** Automatically logs time when committing changes

**Core Methods:**
```typescript
// Main orchestration
initialize()
handleBranchChange(branchInfo)
handleCommit(commitMessage)

// UI and timer automation
autoPopulateTicketInfo(ticketInfo)
autoStartTimer(ticketInfo)
```

## Detection Flow

### 1. Repository Discovery
```
Extension Activation → GitService.initialize() → 
vscode.git API (if available) OR File System Watchers (fallback)
```

### 2. Branch Change Detection
```
User switches branch → Git updates .git/HEAD → 
File watcher fires → handleHeadFileChange() → 
Branch change detected → Callbacks notified
```

### 3. Automation Chain
```
Branch change → BranchChangeService.handleBranchChange() → 
Find Jira ticket → Auto-populate UI → Auto-start timer
```

## Technical Implementation Details

### Hybrid Detection Strategy

The system uses a two-tier approach for maximum compatibility:

#### Primary: vscode.git Extension API
- **Advantage:** Event-driven, efficient, native VS Code integration
- **Limitation:** May not work in all environments (e.g., Cursor, some multi-root setups)
- **Methods Used:**
  - `vscode.extensions.getExtension('vscode.git')`
  - `gitExtension.exports.gitAPI`
  - `gitAPI.repositories`
  - `repository.state.onDidChange`

#### Fallback: File System Watchers
- **Advantage:** Works in all environments, detects all Git repositories
- **Implementation:** Monitors `.git/HEAD` files directly
- **Events Monitored:**
  - `onDidChange` - File modification
  - `onDidCreate` - File creation (Git sometimes recreates HEAD files)
  - `onDidDelete` - File deletion (for debugging)

### Multi-Repository Support

The system scans the entire workspace to find all Git repositories:

```typescript
// Scans workspace folders and subfolders
discoverGitRepositories()
checkSubfoldersForGit(folderPath)
```

**Supported configurations:**
- Single repository in workspace root
- Multiple repositories in subfolders
- Nested repositories
- Multi-root workspace setups

### Jira Ticket Discovery

When a branch change is detected, the system attempts to find the linked Jira ticket:

1. **API Search:** Searches Jira API using the branch name as search text
2. **Pattern Extraction:** Falls back to extracting ticket ID from branch name patterns
3. **Verification:** Verifies the ticket exists in Jira before using it

**Example branch patterns supported:**
- `feature/PROJ-123-description`
- `bugfix/PROJ-456-bug-description`
- `hotfix/PROJ-789-urgent-fix`

## Configuration and Commands

### Auto-Feature Toggles

**Commands available:**
- `jira-time-tracker.toggle-auto-start` - Auto-start timer on branch switch
- `jira-time-tracker.toggle-auto-log` - Auto-log time on commit

**Settings persisted:**
- Auto-start timer setting
- Auto-log time setting
- Last known branch information

### Debug Commands

**Troubleshooting commands:**
- `jira-time-tracker.debug-branch-info` - Show current branch info
- `jira-time-tracker.debug-file-watchers` - List active file watchers
- `jira-time-tracker.debug-head-files` - Read current HEAD files
- `jira-time-tracker.debug-trigger-head-change` - Manually trigger branch change handler
- `jira-time-tracker.force-git-activation` - Force Git extension activation
- `jira-time-tracker.refresh-git-repos` - Re-scan for Git repositories

## Error Handling and Fallbacks

### Common Issues and Solutions

#### 1. Git Extension Not Active
**Symptom:** "Git extension not active" in output
**Solution:** 
- Automatic retry mechanism in `initializeGitExtension()`
- Manual activation via "Debug: Force Git Extension Activation" command

#### 2. No Repositories Found
**Symptom:** "No Git repositories found in workspace"
**Solution:**
- Automatic fallback to file system scanning
- Manual refresh via "Debug: Refresh Git Repositories" command

#### 3. API Methods Missing
**Symptom:** "TypeError: gitAPI.method is not a function"
**Solution:**
- Explicit checks before calling API methods
- Graceful degradation to file system watchers

#### 4. File Watcher Not Firing
**Symptom:** Branch changes not detected automatically
**Solution:**
- Debug commands to verify watcher setup
- Manual trigger commands for testing

## State Persistence

The system maintains state across extension reloads using `context.workspaceState`:

```typescript
interface AutoTimerState {
    autoStart: boolean;
    autoLog: boolean;
    lastBranchInfo?: {
        branchName: string;
        repoPath: string;
        ticketId?: string;
    };
}
```

## Integration Points

### UI Integration
- **TimeTrackerSidebarProvider:** Receives branch change events and updates UI
- **Webview Communication:** Posts `branch-change` messages to webview

### Timer Integration
- **JiraTimeLogger:** Provides timer control methods
- **Auto-start:** Automatically starts timer when switching to Jira-linked branch
- **Auto-log:** Logs time with commit message as description

### Jira Integration
- **JiraService:** Searches and verifies Jira tickets
- **Ticket Discovery:** Finds tickets linked to branch names
- **Time Logging:** Logs time to discovered tickets

## Performance Considerations

### Efficiency Optimizations
- **Event-driven:** Uses VS Code events instead of polling
- **Selective Watching:** Only watches `.git/HEAD` files, not entire repositories
- **Lazy Initialization:** Git extension initialized only when needed

### Memory Management
- **Proper Disposal:** All watchers and disposables cleaned up on extension deactivation
- **Callback Management:** Proper registration and removal of event callbacks

## Testing and Debugging

### Debug Output
All operations are logged to the VS Code output channel for debugging:
- Repository discovery
- File watcher setup
- Branch change detection
- Jira ticket discovery
- UI updates

### Manual Testing
Use the debug commands to test individual components:
1. `debug-branch-info` - Verify current branch detection
2. `debug-file-watchers` - Check watcher setup
3. `debug-head-files` - Read current HEAD file contents
4. `debug-trigger-head-change` - Manually test branch change handler

## Future Enhancements

### Potential Improvements
1. **Smart Branch Pattern Recognition:** AI-powered branch name analysis
2. **Commit Message Analysis:** Extract ticket references from commit messages
3. **Multi-Ticket Support:** Handle branches with multiple ticket references
4. **Custom Branch Patterns:** User-configurable branch naming patterns
5. **Performance Monitoring:** Track detection accuracy and performance metrics

### Extension Points
The modular architecture allows for easy extension:
- New detection methods can be added to `GitService`
- New automation actions can be added to `BranchChangeService`
- New UI integrations can be added to the webview communication system

## Troubleshooting Guide

### Branch Changes Not Detected
1. Check output channel for error messages
2. Run `debug-branch-info` to verify current branch
3. Run `debug-file-watchers` to check watcher setup
4. Run `debug-head-files` to verify HEAD file contents
5. Try `debug-trigger-head-change` to test handler manually

### Auto-Features Not Working
1. Verify auto-features are enabled via toggle commands
2. Check Jira service connectivity
3. Verify ticket discovery is working
4. Check timer service availability

### Performance Issues
1. Check for excessive file watchers
2. Verify proper disposal of resources
3. Monitor output channel for repeated operations
4. Consider reducing workspace scope if needed

---

*This documentation covers the complete Git branch change detection implementation as of version 0.0.5 of the Jira Time Tracker extension.* 