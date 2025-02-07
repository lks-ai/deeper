// This script initializes some example node types.
// It should be loaded after hierarchy.js and after the DOM is ready.

/* Modal utility function */
function showModal(contentHtml) {
    // Create the overlay that covers the full page
    const overlay = document.createElement("div");
    overlay.className = 'modal-overlay';
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    overlay.style.display = "flex";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.zIndex = "10000";
  
    // Create the modal container
    const modalContainer = document.createElement("div");
    modalContainer.style.position = "relative";
    modalContainer.style.backgroundColor = "#fff";
    modalContainer.style.borderRadius = "8px";
    modalContainer.style.padding = "20px";
    modalContainer.style.boxShadow = "0 4px 10px rgba(0, 0, 0, 0.3)";
    modalContainer.style.width = "90%";
    modalContainer.style.height = "90%";
    // modalContainer.style.maxWidth = "90%";
    // modalContainer.style.maxHeight = "90%";
    modalContainer.style.overflowY = "auto";
  
    // Create the close button (a left arrow "<")
    const closeButton = document.createElement("button");
    closeButton.innerHTML = "↩";
    closeButton.style.position = "absolute";
    closeButton.style.top = "10px";
    closeButton.style.left = "10px";
    closeButton.style.fontSize = "24px";
    closeButton.style.background = "transparent";
    closeButton.style.border = "none";
    closeButton.style.cursor = "pointer";
    closeButton.style.color = "#333";
    closeButton.id = "close-button";
    closeButton.addEventListener("click", () => {
      document.body.removeChild(overlay);
    });
  
    // Append the close button to the modal container
    modalContainer.appendChild(closeButton);
  
    // Create a content container to hold your provided HTML
    const contentContainer = document.createElement("div");
    contentContainer.innerHTML = contentHtml;
    // Add top margin so that the close button doesn't overlap the content
    contentContainer.style.marginLeft = "3em";
    contentContainer.style.marginTop = "-1em";
    modalContainer.appendChild(contentContainer);
  
    // Add the modal container to the overlay and the overlay to the document body
    overlay.appendChild(modalContainer);
    document.body.appendChild(overlay);
}

function hideModal(){
    document.getElementById('close-button').click();
}
  

document.addEventListener("DOMContentLoaded", () => {
    const sophia = {};
    sophia.promptHistory = [];
    sophia.treeName = '';

    if (!window.hierarchyEditor) {
      console.error("HierarchyEditor is not available.");
      return;
    }
  
    // Define node types.
    const nodeTypes = [
      {
        name: "knowledge",
        label: "Knowledge",
        color: "#3498db",
        schema: [
          { name: "user_request", defaultValue: "" },
          { name: "response", defaultValue: "" }
        ]
      }
    ];
  
  // Add each node type.
  nodeTypes.forEach(typeData => {
    window.hierarchyEditor.addNodeType(typeData);
  });
  console.log("Initialized node types:", window.hierarchyEditor.getAllNodeTypes());

  // Extra toolbar buttons
  window.hierarchyEditor.addToolbarButton("☰", (currentNode) => {
    showModal(`
        <h2>Options<br><small>${currentNode.name}</small></h2>
        <ul>
            <li>
              <label>Save</label><br><input type="text" id="save-name" value="${sophia.treeName}" placeholder="Tree Name">
              <div><button onclick="sophia.saveData(document.getElementById('save-name').value); hideModal();">Save</button></div>
            </li>
            <li>
              <label>Load</label><br><select id="load-select"><option value="">Select a tree...</option>${sophia.compileTreeSelect()}</select>
              <div>
                <button onclick="sophia.loadData(document.getElementById('load-select').value); hideModal();">Load</button> &nbsp;
                <button onclick="sophia.loadData(document.getElementById('load-select').value, true); hideModal();">Load as Root</button>
              </div>
            </li>
        </ul>
    `);
  }, "Options Menu");

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
    div.innerHTML = `
    <div id="chat-box"></div>
    <textarea type="text" id="message-input" placeholder="Explain something or ask a question..." style="height: 7em;"></textarea>
    <button id="send-btn" onclick="var e = document.getElementById('message-input'); window.sophia.send('` + currentNode.id + `', e.value); e.value='';">↻ Update</button>
    ${sophia.compilePromptHistory()}
    <button id="send-child-btn" onclick="var e = document.getElementById('message-input'); window.sophia.send('` + currentNode.id + `', e.value, createChild=true); e.value='';" class="right">↳ Add</button>
    `;
    return div;
  });

  hierarchyEditor.showMetadata = false;
  hierarchyEditor.markdownOptions = {
    // Either provide a function:
    // boldReplacer: function(text) { return '<a href="#">' + '<strong>' + text + '</strong>' + '</a>'; }
    // Or use prefix/suffix:
    boldReplacer: function(text){ return '<a href="#" onclick="window.sophia.send(\'n/a\', \'extrapolate about ' + text + '\', createChild=true)">' + text + '</a>';},
    // boldPrefix: '<a href="#" on>',
    // boldSuffix: '</a>'
  };
  hierarchyEditor.treeData.name = "Begin";
  hierarchyEditor.treeData.body = "*Begin the conversation by sending a message*";

  /*
  Sophia client stuff
  */

  sophia.compileContext = function(maxLevels=5, onChild=false){
    let l = hierarchyEditor.currentFocusPath;
    let n = l.length < maxLevels ? l.length: maxLevels;
    let off = l.length - n;
    if (!onChild) n--;
    if (n <= 0) return "";
    let o = [];
    o.push('## Conversation History')
    for (let i = 0; i < n; i++){
        let v = l[off + i];
        o.push("--- User:\n" + v.metadata.user_request + "\n\n--- Expert:\n" + v.metadata.response);
    }
    o.push('## Current User Request');
    return o.join("\n\n") + "\n\n";
  }

  sophia.compilePromptHistory = function(){
    if (typeof sophia.promptHistory === 'undefined') return '';
    o = [];
    var history = sophia.promptHistory;
    for (var i = 0; i < history.length; i++){
        let v = history[history.length - i - 1];
        o.push('<option onclick="document.getElementById(\'message-input\').value=this.value;">' + v + '</option>');
    }
    if (o.length == 0) o.push('<option value="">prompt history</option>');
    return '<select id="prompt-history">' + o.join("") + '</select>';
  }

  sophia.compileTreeSelect = async function(){
    try {
      const response = await fetch(`http://localhost:8123/list`);
      if (!response.ok) {
        throw new Error(`Error fetching data: ${response.status}`);
      }
      const data = await response.json();
      let o = [];
      const el = document.getElementById('load-select');
      for (let i = 0; i < data.length; i++){
        o.push(`<option>${data[i]}</option>`);
        const opt = document.createElement('option');
        let n = data[i].replace('.json', '');
        opt.value = n;
        opt.innerHTML = n;
        el.appendChild(opt);
      }
      let html = o.join("");
      
      return html;
    } catch (error) {
      console.error("Failed to load data:", error);
      throw error;
    }
  }

  sophia.send = function(nodeId, prompt, createChild=false) {
    let history = sophia.compileContext(maxLevels=5, onChild=createChild);
    sophia.promptHistory.push(prompt);
    const data = {
      prompt: history + prompt
    };
    let targetNode = null;
    if (!createChild){
      targetNode = hierarchyEditor.getCurrentNode();
      targetNode.name = "Thinking...";
    }else{
      let parentNode = hierarchyEditor.getCurrentNode();
      targetNode = hierarchyEditor.createNode("Thinking...", parentNode);
      parentNode.children.push(targetNode);
    }
    setTimeout(function(){
        hierarchyEditor.render();
        hierarchyEditor.breadcrumbRow.scrollBy(10024, 0);
        hierarchyEditor.childrenRow.scrollBy(10024, 0);
      }, 0);
  
    fetch('http://localhost:8123/think', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    .then(response => response.json())
    .then(result => {
      var response = result.response;
      var thoughts = result.thought;
      var request = result.user_request;
      console.log(thoughts);
      console.log(response);
      //outputEl.textContent = JSON.stringify(result, null, 2);
      console.log(targetNode);
      let typeData = hierarchyEditor.getNodeType(targetNode.type) || { label: "Node" };
      targetNode.metadata = result;
      targetNode.name = result.label;
      targetNode.body = result.response;
      setTimeout(function(){
        hierarchyEditor.render();
        hierarchyEditor.breadcrumbRow.scrollBy(1024, 0);
        hierarchyEditor.childrenRow.scrollBy(1024, 0);
      }, 0);
    })
    .catch(error => {
      console.log(`Error: ${error}`);
    });
  }

  sophia.saveData = function(name, globalScope=false){
    if (name.length == 0) return;
    const data = {name: name, data: hierarchyEditor.toJson(!globalScope ? hierarchyEditor.getCurrentNode(): null)};
    fetch('http://localhost:8123/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      .then(response => response.json())
      .then(result => {
        console.log(`Saved ${result}`);
      })
      .catch(error => {
        console.log(`Error: ${error}`);
      });
  }

  sophia.loadData = async function(name, globalScope=false){
    //return fetch(`http://localhost:8123/load/${encodeURIComponent(name)}`)
    try {
      const response = await fetch(`http://localhost:8123/load/${encodeURIComponent(name)}`);
      if (!response.ok) {
        throw new Error(`Error fetching data: ${response.status}`);
      }
      const data = await response.json();
      hierarchyEditor.fromJson(data, !globalScope ? hierarchyEditor.getCurrentNode(): null);
      setTimeout(function(){
        hierarchyEditor.render();
      }, 0);
          
    } catch (error) {
      console.error("Failed to load data:", error);
      throw error;
    }
  }

  window.sophia = sophia;

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