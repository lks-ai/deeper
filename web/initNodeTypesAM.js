// This script initializes some example node types.
// It should be loaded after hierarchy.js and after the DOM is ready.

document.addEventListener("DOMContentLoaded", () => {
    if (!window.hierarchyEditor) {
      console.error("HierarchyEditor is not available.");
      return;
    }
  
    // Define node types.
    const nodeTypes = [
      {
        name: "location",
        label: "Location",
        color: "#3498db",
        schema: [
          { name: "coordinates", defaultValue: "" },
          { name: "population", defaultValue: "0" },
          { name: "climate", defaultValue: "temperate" }
        ]
      },
      {
        name: "character",
        label: "Character",
        color: "#2ecc71",
        schema: [
          { name: "age", defaultValue: "unknown" },
          { name: "role", defaultValue: "" }
        ]
      },
      {
        name: "item",
        label: "Item",
        color: "#f1c40f",
        schema: [
          { name: "weight", defaultValue: "0" },
          { name: "value", defaultValue: "0" }
        ]
      }
    ];
  
  // Add each node type.
  nodeTypes.forEach(typeData => {
    window.hierarchyEditor.addNodeType(typeData);
  });
  console.log("Initialized node types:", window.hierarchyEditor.getAllNodeTypes());

  // By default add a “dice” button.
  window.hierarchyEditor.addToolbarButton("🎲", (node) => {
    alert("Dice button clicked on " + (node.name || "node"));
  }, "Automatically Generate");
  
  // Add a custom toolbar button via the API.
  // This button (with icon "🔔") will trigger a callback.
  window.hierarchyEditor.addToolbarButton("🔔", (currentNode) => {
    alert("Custom toolbar button clicked on " + (currentNode.name || "node"));
  }, "Custom Notification Button");

  // Register a hook for when a node is created.
  window.hierarchyEditor.on("nodeCreated", (data) => {
    console.log("New node created:", data.node);
  });

  // Register a hook for when the edit form is submitted.
  window.hierarchyEditor.on("editFormSubmitted", (data) => {
    console.log("Edit form submitted for:", data.node);
  });

  // For demonstration, add a modular section below metadata.
  // This section will simply show a placeholder media banner.
  window.hierarchyEditor.addModularSection("mediaBanner", (currentNode) => {
    let div = document.createElement("div");
    div.style.marginTop = "20px";
    div.style.padding = "10px";
    div.style.border = "1px dashed #aaa";
    div.innerHTML = "<strong>Media Banner:</strong> (This is a placeholder for media content.)";
    return div;
  });

//   window.hierarchyEditor.addModularSection("mediaBanner", (currentNode) => {
//     let div = document.createElement("div");
//     div.style.marginTop = "20px";
//     div.style.padding = "10px";
//     div.style.border = "1px dashed #aaa";
//     div.innerHTML = "<strong>Media Banner:</strong> (This is a placeholder for media content.)";
//     return div;
//   });

  setTimeout(function(){
    hierarchyEditor.render();
  }, 0);
});