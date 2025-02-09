//Sophia: (Deepr.wiki)
// github.com/lks-ai/deeper

// This script initializes some example node types.
// It should be loaded after hierarchy.js and after the DOM is ready.

const HOST = window.location.protocol + "//" + window.location.host;

/* Utility functions */

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

// For use when clicking bold links to give it some rizz
function oneUpEffect(element) {
  // Get the bounding rectangle of the clicked element.
  const rect = element.getBoundingClientRect();

  // Clone the element.
  const clone = element.cloneNode(true);

  // Set up the clone's styles for absolute positioning and animation.
  clone.style.position = "absolute";
  clone.style.left = rect.left + "px";
  clone.style.top = (rect.top + window.scrollY) + "px";
  clone.style.margin = "0";
  clone.style.pointerEvents = "none";
  clone.style.opacity = "1";
  // Apply a transition for both transform and opacity.
  clone.style.transition = "transform 0.8s ease-out, opacity 0.8s ease-out";

  // Append the clone to the body.
  document.body.appendChild(clone);

  // Force reflow so the browser registers the initial styles.
  void clone.offsetWidth;

  // Animate: move the clone upward and fade it out.
  clone.style.transform = "translateY(-4em)";
  clone.style.opacity = "0";

  // Once the animation is complete, remove the clone from the DOM.
  clone.addEventListener("transitionend", () => {
    clone.remove();
  });
}

function trim (s, c) {
  // Trims s (string) of any c (characters) wrapping s
  if (c === "]") c = "\\]";
  if (c === "^") c = "\\^";
  if (c === "\\") c = "\\\\";
  return s.replace(new RegExp(
    "^[" + c + "]+|[" + c + "]+$", "g"
  ), "");
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
        <h2>Branch Options<br><small>${currentNode.name}</small></h2>
        <ul>
            <li>
              <label>Save</label><br><input type="text" id="save-name" value="${sophia.treeName}" placeholder="Tree Name">
              <div>
                <button onclick="sophia.saveData(document.getElementById('save-name').value); hideModal();" title="Saves currently selected branch as a tree">Save Branch</button> &nbsp;
                <button onclick="sophia.saveData(document.getElementById('save-name').value, true); hideModal();" title="Saves entire tree">Save Root</button>
              </div>
            </li>
            <li>
              <label>Load</label><br><select id="load-select"><option value="">Select a tree...</option>${sophia.compileTreeSelect()}</select>
              <div>
                <button onclick="sophia.loadData(document.getElementById('load-select').value); hideModal();" title="Load to a sub-branch of current branch">Load to Branch</button> &nbsp;
                <button onclick="sophia.loadData(document.getElementById('load-select').value, true); hideModal();" title="Load as entire tree">Load to Root</button>
              </div>
            </li>
        </ul>
    `);
  }, "Options Menu");

  // Register a hook for when a node is created.
  window.hierarchyEditor.on("nodeCreated", (data) => {
    console.log("New node created:", data.node);
  });

  // Register a hook for when a node is removed.
  window.hierarchyEditor.on("nodeRemoved", (data) => {
    console.log("Node removed:", data.node);
    // removes all [label](#uuid) references turning them back to **label**
    // hierarchyEditor.dereference(data.node);
    hierarchyEditor.dereference(data.node.id);
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
    boldReplacer: function(text){ 
      let node = hierarchyEditor.getCurrentNode();
      return `<a href="javascript:void(0)" onclick=" oneUpEffect(this); window.sophia.send('${node.id}', 'expand ${text}', createChild=true, label='${text}');"><strong>${text}</strong></a>`;
    },
    // boldPrefix: '<a href="#" on>',
    // boldSuffix: '</a>'
  };
  hierarchyEditor.title = "DeepR";
  hierarchyEditor.treeData.name = "DeepR.wiki";
  hierarchyEditor.treeData.id = window.nav.getId();
  hierarchyEditor.treeData.body = `Use thinking AI to quickly build a wiki on anything. Great for research, taxonomies, mind mapping and note taking.
  [GitHub](https://github.com/lks-ai/deeper) | [By LKS](https://lks.ltd)

  *Begin the conversation by sending a message about the root topic*
  `;

  /*
  Sophia client stuff
  */

  sophia.compileContext = function(maxLevels=5, onChild=false){
    let l = hierarchyEditor.currentFocusPath;
    let n = l.length < maxLevels ? l.length: maxLevels;
    let off = l.length - n;
    let last = l[l.length - 1];
    if (!onChild) n--; // omit current entry if it an update
    if (n <= 0) return "";
    let o = [];
    o.push('## Conversation History')
    // Compile the history by entry from [off - n] to off - 1
    for (let i = 0; i < n; i++){
        let v = l[off + i];
        if (v.metadata.hasOwnProperty('user_request')){
          o.push(`--- User:\n${v.metadata.user_request || ""}\n\n--- Expert: ${v.name}\n${v.body}`);
        }else{
          o.push(`--- Content: ${v.name}\n${v.body}`);
        }
    }
    // If we are updating, and body.length > 0 then include a block for rewriting the request
    if (!onChild && last.body.length > 0){
      let v = last;
      o.push(`--- Current Content: ${v.name}\n${v.body}`);
      o.push('## Rewrite Content Request');
    }else{
      o.push('## Current User Request');
    }
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
      const response = await fetch(`${HOST}/list`);
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

  sophia.send = function(nodeId, prompt, createChild=false, label=null) {
    // Set up prompt
    prompt = trim(prompt, ':*#');
    let history = sophia.compileContext(maxLevels=80, onChild=createChild);
    sophia.promptHistory.push(prompt);
    const data = {
      prompt: history + prompt
    };

    // Pre-fetch interface setup
    let targetNode = null;
    let parentNode = hierarchyEditor.getCurrentNode();
    if (!createChild){
      targetNode = parentNode;
      targetNode.name = "Thinking...";
    }else{
      targetNode = hierarchyEditor.createNode("Thinking...", parentNode);
      parentNode.children.push(targetNode);
      // Using targetNode, replace the original **bold** with a markdown link to the node.id from the original node
      if (label) {
        hierarchyEditor.queueRewrite(
          parentNode,
          `**${label}**`,
          `[${label}](#${targetNode.id})`
        );
      }
      
    }
    setTimeout(function(){
        hierarchyEditor.render();
        hierarchyEditor.breadcrumbRow.scrollBy(10024, 0);
        hierarchyEditor.childrenRow.scrollBy(10024, 0);
      }, 0);

    // TODO Store the `label` in sophia.index for lookup and link overwrite?
    //  or use a way to link to the replies
    //  maps {label: nodeId}

    // Perform the fetch
    fetch(`${HOST}/think`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    .then(response => response.json())
    .then(result => {
      // Change the interface accordingly after receiving result
      var response = result.response;
      var thoughts = result.thought;
      var request = result.user_request;
      let typeData = hierarchyEditor.getNodeType(targetNode.type) || { label: "Node" };
      // Set metadata
      targetNode.metadata = result;
      targetNode.metadata.user_request = prompt;
      // Set other fields
      targetNode.name = result.label;
      targetNode.body = result.response;
      // Asynchronously make the interface do stuff
      setTimeout(function(){
        hierarchyEditor.render();
        hierarchyEditor.breadcrumbRow.scrollBy(1024, 0);
        hierarchyEditor.childrenRow.scrollBy(1024, 0);
      }, 0);
      window.scrollTo(0, 0);
    })
    .catch(error => {
      console.log(`Error: ${error}`);
    });
  }

  sophia.saveData = function(name, globalScope=false){
    if (name.length == 0) return;
    const data = {name: name, data: hierarchyEditor.toJson(!globalScope ? hierarchyEditor.getCurrentNode(): null)};
    fetch(`${HOST}/save`, {
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
    try {
      const response = await fetch(`${HOST}/load/${encodeURIComponent(name)}`);
      if (!response.ok) {
        throw new Error(`Error fetching data: ${response.status}`);
      }
      const data = await response.json();
      hierarchyEditor.fromJson(data, !globalScope ? hierarchyEditor.getCurrentNode(): null);
      sophia.treeName = name;
      setTimeout(function(){
        hierarchyEditor.render();
      }, 0);
          
    } catch (error) {
      console.error("Failed to load data:", error);
      throw error;
    }
  }

  window.sophia = sophia;

  hierarchyEditor.render();

  // Hash navigation management
  window.addEventListener('hashchange', function(event) {
    console.log('The hash has changed!');
    console.log('Old URL:', event.oldURL);
    console.log('New URL:', event.newURL);
    // Navigate the hierarchy to the new node by Id
    let parts = event.newURL.split('#', 2);
    hierarchyEditor.navigateToNodeById(parts[1]);
    hierarchyEditor.breadcrumbRow.scrollBy(1024, 0);
  });

  // Make sure they really want to leave
  window.onbeforeunload = function() {
    return "";
  }
});