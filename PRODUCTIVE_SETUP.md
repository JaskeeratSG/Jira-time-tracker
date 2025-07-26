# 🚀 JIRA + Productive Dual Time Logging Setup

## ✅ **What's New**

Your extension now supports **intelligent dual time logging**:
- ✅ **Primary**: Logs time to JIRA tickets  
- ✅ **Secondary**: Automatically syncs to Productive with **smart discovery**
- ✅ **Generic**: Works with **any project** you select, not hardcoded to specific projects
- ✅ **Intelligent**: Learns from your usage patterns and project history

## 🔧 **Setup Instructions**

### **Method 1: VS Code Settings Configuration (Recommended for Consistent Projects)**

If you typically work on the same projects, configure them for instant logging:

```json
{
  "jiraTimeTracker.productive.organizationId": "42335",
  "jiraTimeTracker.productive.apiToken": "YOUR_PRODUCTIVE_API_TOKEN",
  "jiraTimeTracker.productive.baseUrl": "https://api.productive.io/api/v2",
  "jiraTimeTracker.productive.defaultProjectId": "667206",
  "jiraTimeTracker.productive.defaultServiceId": "9231369",
  "jiraTimeTracker.productive.projectMapping": {
    "OT": "667206",
    "CTL": "667206",
    "DEV": "456789",
    "PROJ": "123456"
  }
}
```

### **Method 2: Smart Discovery (Works with Any Project)**

**No configuration needed!** The extension will automatically:
1. **Find your user** via organization membership
2. **Discover the right project** based on your Jira project selection
3. **Select the best service** using intelligent analysis:
   - **Your history**: If you've logged time before, uses your preferred service
   - **Project patterns**: If you're new, analyzes what services others use in this project
   - **Smart fallbacks**: Always finds a suitable service

### **Method 3: UI Authentication (Alternative)**

1. **Create `.env` file** in your project root:
```bash
PRODUCTIVE_ORGANIZATION_ID=42335
PRODUCTIVE_BASE_URL=https://api.productive.io/api/v2
```

2. **Use the extension's authentication UI**:
   - Open Jira Time Tracker sidebar
   - Fill in both JIRA and Productive credentials
   - Click "Sign In to Both Services"

## 🎯 **How It Works**

### **Intelligent Project Discovery**:
1. **Configured mapping** → Uses your project mapping (e.g., "OT" → CTL Communications)
2. **Exact name match** → "Office Test" matches "Office Test"
3. **Contains match** → "OT" matches "OT - Office Test"
4. **Word-based match** → "CTL" matches "CTL Communications"
5. **Fallback** → Shows available projects for manual selection

### **Smart Service Discovery**:
1. **Configured service** → Uses your defaultServiceId (instant)
2. **Your history** → If you've logged time before:
   - Single service → Uses it (HIGH confidence)
   - Multiple services → Uses most frequent (MEDIUM confidence)
3. **Project analysis** → If you're new to the project:
   - Single project service → Uses it (HIGH confidence)
   - Multiple services → Uses most popular (MEDIUM confidence)
4. **Fallback** → Uses any available service (LOW confidence)

### **Credential Priority**:
1. **VS Code settings** (most reliable)
2. **UI authentication** (fallback)
3. **Environment variables** (fallback)

## 🧪 **Example Scenarios**

### **Scenario 1: Experienced User**
- You've logged time to "CTL Communications" project before
- ✅ **Result**: Instantly uses your preferred service (e.g., "Backend - Engineer")

### **Scenario 2: New Project**
- You select "OT" project, but haven't logged time there
- ✅ **Discovery**: Finds "Office Test" project in Productive
- ✅ **Analysis**: Sees that project only uses "Frontend Development" service
- ✅ **Result**: Uses "Frontend Development" service automatically

### **Scenario 3: Complex Project**
- Multiple people use different services in the same project
- ✅ **Analysis**: Finds most commonly used service in that project
- ✅ **Result**: Suggests the popular service with MEDIUM confidence

## 🛠️ **Troubleshooting**

### **"Productive credentials not found"**:
- ✅ **Quick Fix**: Set up VS Code settings (Method 1)
- ⚠️ **Alternative**: Use UI authentication (Method 3)

### **"No matching project found"**:
- ✅ **The extension will show available projects**
- ✅ **Add project mapping** to VS Code settings for automatic matching
- 💡 **Example**: If you work on "SCRUM-123" tickets but the Productive project is called "Development Team", add:
  ```json
  "jiraTimeTracker.productive.projectMapping": {
    "SCRUM": "456789"  // Replace with actual Productive project ID
  }
  ```

### **"Service discovery failed"**:
- ✅ **Configure defaultServiceId** for instant service selection
- ✅ **Check permissions**: Ensure you can log time to the project
- 💡 **First time?** The extension will suggest the most appropriate service

### **Finding Your IDs**:

**Organization ID**: Check your Productive URL: `https://app.productive.io/YOUR_ORG_ID/projects`
**Project ID**: Click on a project, check the URL: `https://app.productive.io/42335/projects/XXXXXX`
**Service ID**: Contact your admin or check the console output when logging time

## ✨ **Key Features**

- ✅ **Works with ANY project**: No hardcoded project dependencies
- ✅ **Intelligent discovery**: Learns from usage patterns  
- ✅ **Multiple fallbacks**: Always finds a way to log time
- ✅ **Clear feedback**: Console shows exactly what's happening and why
- ✅ **Confidence scoring**: HIGH/MEDIUM/LOW confidence levels
- ✅ **First-time friendly**: Analyzes project patterns for new users

## 📊 **Discovery Intelligence Examples**

```
🔍 Project Discovery:
   ✅ "OT" → "Office Test" (exact match)
   ✅ "CTL" → "CTL Communications" (contains match)  
   ✅ "DevTeam" → "Development Team Project" (word match)

🛠️ Service Discovery:
   ✅ User history: "Backend - Engineer" (you always use this)
   ✅ Project pattern: "Frontend Development" (project uses only this)
   ✅ Popular choice: "Design Services" (most used in this project)
```

---

**Ready to test?** Just select any Jira project and log time - the extension will handle the rest! 🚀 