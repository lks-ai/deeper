# Sophia: Tree-of-Thought Editor

Sophia is a modular, production‑ready hierarchical content editor built with plain JavaScript. It enables you to create, edit, and manage tree‑structured content with rich features such as:

- **Node Types:** Define custom node types (with labels, colors, and metadata schemas) so that you can create “Worlds”, “Locations”, “Characters”, “Items”, etc.
- **Branch Operations:** Copy, cut, and paste entire branches (nodes with their children) with new node IDs automatically assigned.
- **Toolbar & Modular Sections:** Extend the node view with extra toolbar buttons (with custom icons and callbacks) and modular sections (for example, a media banner) that can be injected into the interface.
- **Hooks/Callbacks:** Listen for and respond to various events (e.g. node creation, edit form submission, branch operations) via a built‑in hook system.
- **Rich Content & Background Images:** Edit content using Markdown (which is rendered into HTML) and optionally set a background image for each node.
- **Responsive & Animated UI:** The interface automatically updates SVG connectors between breadcrumb and child nodes in real time (even when scrolling) to maintain clear visual relationships.

---

## File Structure

- **index.html**  
  The main HTML file that contains the application’s skeleton and links to the CSS and JavaScript files.

- **styles.css**  
  Contains all of the CSS used to style the editor (layout, colors, responsive behavior, etc.).

- **hierarchy.js**  
  The heart of the editor. This file implements:
  - The tree data structure and node management.
  - APIs for node creation, editing, and branch operations.
  - The toolbar system and modular sections.
  - A hook system to register callbacks for events.
  - Rendering logic for the breadcrumb trail, child nodes, node view/editor panel, and SVG connectors.
  
- **initNodeTypes.js**  
  A sample initialization script that demonstrates how to:
  - Define and add node types.
  - Add custom toolbar buttons.
  - Register hooks for events.
  - Add modular sections (e.g. a media banner).

---

## Getting Started

1. **Open the Application:**  
   Open `index.html` in your web browser. All required CSS and JavaScript files will load automatically.

2. **Explore the Interface:**  
   - The **Breadcrumb Trail** shows the ancestry of the currently selected node.
   - The **Children Row** displays child nodes and “Add” buttons for each defined node type.
   - The **Node View/Editor Panel** displays the currently selected node in view mode.  
     In view mode, you can edit the node’s name inline and click the toolbar buttons (such as the Edit button and any extra buttons you add). Switching to edit mode will display a full form to edit the node’s name, content (Markdown supported), and metadata.

3. **Modify or Extend:**  
   Use the browser console (or write your own scripts) to call the API functions on the global object `hierarchyEditor`.

---

## Programmatic Functionality

### 1. Node Management API

- **Add a Node**  
  ```js
  // Adds a new node under the node with id "node-3"
  hierarchyEditor.addNode("node-3", {
    name: "New Node",
    body: "Some **markdown** content",
    metadata: { key1: "value1" },
    image_url: "https://example.com/image.png",
    type: "location" // (if a node type with name "location" is defined)
  });
  ```
- **Edit a Node**  
  ```js
  // Edits node with id "node-5"
  hierarchyEditor.editNode("node-5", {
    name: "Updated Name",
    body: "Updated content with *markdown*",
    metadata: { key1: "new value" },
    image_url: null,
    type: "character"
  });
  ```
- **Get/Load Tree Data**  
  ```js
  // Retrieve the current tree data structure
  const tree = hierarchyEditor.getTreeData();

  // Load a new tree (completely replaces the current tree)
  hierarchyEditor.loadTreeData(newTreeData);
  ```

### 2. Node Types API

- **Add a Node Type**  
  ```js
  hierarchyEditor.addNodeType({
    name: "world",
    label: "World",
    color: "#3498db",
    schema: [
      { name: "population", defaultValue: "0" },
      { name: "climate", defaultValue: "temperate" }
    ]
  });
  ```
- **Get Node Type Information**  
  ```js
  const worldType = hierarchyEditor.getNodeType("world");
  console.log(worldType);
  ```
- **Get All Node Types**  
  ```js
  const allTypes = hierarchyEditor.getAllNodeTypes();
  console.log(allTypes);
  ```

### 3. Branch Operations API

- **Copy a Branch**  
  ```js
  // Copy the branch starting at node with id "node-5"
  hierarchyEditor.copyBranch("node-5");
  ```
- **Cut a Branch**  
  ```js
  // Cut (remove) the branch starting at node with id "node-5" (only works if node has a parent)
  hierarchyEditor.cutBranch("node-5");
  ```
- **Paste a Branch**  
  ```js
  // Paste the branch stored in the clipboard under the node with id "node-2"
  hierarchyEditor.pasteBranch("node-2");
  ```
  *Note:* Pasted branches will be deep‑cloned and assigned new node IDs to avoid duplication.

### 4. Toolbar API

- **Add a Toolbar Button**  
  ```js
  hierarchyEditor.addToolbarButton("🔔", (currentNode) => {
    console.log("Custom toolbar button clicked on", currentNode);
    // Your custom code here.
  }, "Custom Notification Button");
  ```
- **Remove a Toolbar Button**  
  ```js
  hierarchyEditor.removeToolbarButton("🔔");
  ```

### 5. Modular Sections API

Modular sections allow you to inject custom HTML or components into the node view (below the metadata section).

- **Add a Modular Section**  
  ```js
  hierarchyEditor.addModularSection("mediaBanner", (currentNode) => {
    const div = document.createElement("div");
    div.style.marginTop = "20px";
    div.style.padding = "10px";
    div.style.border = "1px dashed #aaa";
    div.innerHTML = "<strong>Media Banner:</strong> (This is a placeholder for media content.)";
    return div;
  });
  ```
- **Remove a Modular Section**  
  ```js
  hierarchyEditor.removeModularSection("mediaBanner");
  ```

### 6. Hooks / Callback System

Use the hook system to register callbacks for events at various points in the application.

- **Register a Hook**  
  ```js
  hierarchyEditor.on("nodeCreated", (data) => {
    console.log("A new node was created:", data.node);
  });

  hierarchyEditor.on("editFormSubmitted", (data) => {
    console.log("Edit form submitted for:", data.node);
  });

  hierarchyEditor.on("toolbarButtonClicked", (data) => {
    console.log("Toolbar button clicked:", data.button, "on", data.node);
  });
  ```
- **Unregister a Hook**  
  ```js
  // To remove a previously registered callback:
  hierarchyEditor.off("nodeCreated", yourCallbackFunction);
  ```

**Predefined Hook Events:**
- `nodeCreated` – Triggered when a new node is created.
- `editFormSubmitted` – Triggered when the edit form is submitted.
- `toolbarButtonClicked` – Triggered when a toolbar button is clicked.
- `branchCopied` – Triggered when a branch is copied.
- `branchCut` – Triggered when a branch is cut.
- `branchPasted` – Triggered when a branch is pasted.

---

## Using the Codebase

1. **Setup:**  
   - Clone or download the repository.
   - Open `index.html` in a modern browser.
   - Modify `initNodeTypes.js` to change the default node types, toolbar buttons, and hooks as desired.

2. **Development:**  
   - All styles are in `styles.css`.
   - The core logic and APIs are in `hierarchy.js`.  
     Read through this file to understand how rendering, event hooks, and APIs work.
   - Use your browser’s developer console to interact with the global `hierarchyEditor` object.

3. **Extending the Functionality:**  
   - **Add New Node Types:** Use the Node Types API to register new types and update the “Add” buttons accordingly.
   - **Create Custom Toolbar Buttons:** Use the Toolbar API to add buttons with your own icons and callbacks.
   - **Inject Custom UI Components:** Use the Modular Sections API to add custom sections (e.g. media banners, charts, etc.) into the node view.
   - **Hook Into Events:** Register hooks to listen for events such as node creation or edit form submissions, and perform custom logic (e.g., saving to a server, analytics, etc.).

---

## Summary

The Sophia Tree-of-Thought Editor provides a flexible and modular interface for hierarchical content editing with a rich programmatic API. Whether you need to manage complex tree structures with custom node types, extend the UI with extra toolbar buttons and modular sections, or integrate with external services via hooks and callbacks, this codebase is designed to be easily extended and integrated.

Happy coding!