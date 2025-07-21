# 🎨 UI Components - Component-Based Architecture

This directory contains reusable UI components for the Jira Time Tracker extension, providing a more readable and maintainable approach to building the webview interface.

## 📁 Structure

```
ui/components/
├── UIComponents.ts     # Main component definitions
└── README.md          # This file
```

## 🧩 Component Architecture

### **Base Component Class**
```typescript
abstract class BaseComponent {
    protected props: ComponentProps;
    constructor(props: ComponentProps = {}) { ... }
    abstract render(): string;
}
```

All components extend this base class and implement the `render()` method that returns HTML strings.

## 📦 Available Components

### **1. StylesComponent**
- **Purpose**: Contains all CSS styles for the interface
- **Usage**: `new StylesComponent().render()`
- **Output**: Complete `<style>` block with VS Code theme variables

### **2. NotificationComponent**
- **Purpose**: Creates the notification container
- **Usage**: `new NotificationComponent().render()`
- **Output**: `<div class="notification-container" id="notifications"></div>`

### **3. EmailSectionComponent** 
- **Purpose**: Email input and Load Projects button
- **Props**: 
  - `placeholder`: Input placeholder text
  - `buttonText`: Button text
- **Usage**: 
```typescript
new EmailSectionComponent({
    placeholder: "Enter your Jira email",
    buttonText: "Load Projects"
}).render()
```

### **4. DropdownComponent**
- **Purpose**: Reusable dropdown selector
- **Props**:
  - `id`: Element ID
  - `title`: Display title
  - `optionsId`: Options container ID
  - `onToggle`: Click handler function name
- **Usage**:
```typescript
new DropdownComponent({
    id: "projectSelect",
    title: "Select Project", 
    optionsId: "projectOptions",
    onToggle: "window.toggleDropdown('projectOptions')"
}).render()
```

### **5. ProjectIssueSelectionComponent**
- **Purpose**: Complete project/issue selection section
- **Composed of**: Two DropdownComponents + Clear button
- **Usage**: `new ProjectIssueSelectionComponent().render()`

### **6. TimerButtonComponent**
- **Purpose**: Individual timer control button
- **Props**:
  - `icon`: Button emoji/icon
  - `tooltip`: Hover tooltip text
  - `onClick`: Click handler function name
- **Usage**:
```typescript
new TimerButtonComponent({
    icon: "▶️",
    tooltip: "Start Timer",
    onClick: "window.handleStartTimer()"
}).render()
```

### **7. TimerSectionComponent**
- **Purpose**: Complete timer interface section
- **Composed of**: Status display + Timer + Control buttons
- **Usage**: `new TimerSectionComponent().render()`

### **8. ManualTimeLogComponent**
- **Purpose**: Manual time entry section
- **Usage**: `new ManualTimeLogComponent().render()`

### **9. JavaScriptComponent**
- **Purpose**: All client-side JavaScript functionality
- **Usage**: `new JavaScriptComponent().render()`
- **Contains**: Event handlers, message listeners, DOM manipulation

### **10. MainLayoutComponent**
- **Purpose**: Complete page layout orchestrator
- **Composed of**: All other components assembled into full HTML
- **Usage**: `new MainLayoutComponent().render()`

## 🔧 How to Use

### **In TimeTrackerSidebarProvider:**
```typescript
import { MainLayoutComponent } from './components/UIComponents';

private _getHtmlForWebview(webview: vscode.Webview): string {
    const mainLayout = new MainLayoutComponent();
    return mainLayout.render();
}
```

### **Creating Custom Components:**
```typescript
export class CustomComponent extends BaseComponent {
    render(): string {
        const { title, content } = this.props;
        return `
            <div class="custom-section">
                <h3>${title}</h3>
                <p>${content}</p>
            </div>
        `;
    }
}

// Usage
const custom = new CustomComponent({
    title: "My Title",
    content: "My content"
});
```

## ✅ Benefits

### **🔍 Readability**
- **Before**: 800+ line monolithic HTML string
- **After**: Small, focused components with clear responsibilities

### **🔧 Maintainability** 
- **Modular**: Each component handles one UI concern
- **Reusable**: Components can be used in multiple contexts
- **Testable**: Individual components can be unit tested

### **🎨 Flexibility**
- **Configurable**: Components accept props for customization
- **Composable**: Complex UIs built from simple components
- **Extensible**: Easy to add new components

### **📦 Organization**
- **Separation of Concerns**: Styles, structure, and logic separated
- **TypeScript**: Full type safety with props interfaces
- **Intellisense**: Better IDE support and autocompletion

## 🚀 Example Usage

```typescript
// Simple component usage
const emailSection = new EmailSectionComponent({
    placeholder: "your-email@company.com",
    buttonText: "Authenticate"
});

// Complex component composition
const timerButton = new TimerButtonComponent({
    icon: "⏸️",
    tooltip: "Pause Timer", 
    onClick: "window.handlePauseTimer()"
});

// Full layout generation
const layout = new MainLayoutComponent();
const htmlString = layout.render();
```

## 🔄 Backward Compatibility

- **✅ Same Output**: Components generate identical HTML to original
- **✅ Same Functionality**: All event handlers and IDs preserved
- **✅ Same Styling**: CSS classes and styles unchanged
- **✅ Same Behavior**: JavaScript functionality identical

The component-based approach provides better code organization without changing the end-user experience or breaking existing functionality. 