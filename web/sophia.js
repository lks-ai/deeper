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
    modalContainer.className = "modal-container";
  
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
    sophia.dirty = false;
    sophia.promptHistory = [];
    sophia.treeName = '';
    sophia.defaults = null;
    sophia.language = 'English';
    sophia._agentConfig = {};

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
    let shareLink = `${HOST}/#share-${encodeURI(sophia.treeName)}`;
    showModal(`
        <h2>Branch Options<br><small>${currentNode.name}</small></h2>
        <ul>
            <li>
              <label>Agent</label><br>
              <select id="agent" onchange="sophia.setAgentConfig(this.value);">${sophia.compileAgentSelect()}</select>
            </li>
            <li>
              <label>Download</label><br>
              <div>
                <button onclick="sophia.download(document.getElementById('save-name').value); hideModal();" title="Saves currently selected branch as a tree">Download Branch</button> &nbsp;
                <button onclick="sophia.download(document.getElementById('save-name').value, true); hideModal();" title="Saves entire tree">Download Root</button>
              </div>
            </li>
            <li>
              <label>Save</label><br><input type="text" id="save-name" value="${sophia.treeName}" placeholder="Tree Name">
              <div>
                <button onclick="sophia.saveData(document.getElementById('save-name').value); hideModal();" title="Saves currently selected branch as a tree">Save Branch</button> &nbsp;
                <button onclick="sophia.saveData(document.getElementById('save-name').value, true); hideModal();" title="Saves entire tree">Save Root</button>
              </div>
              <div id="share-link" style="margin-top: 1em;">
                <label>Share Link</label><span class="inline-code">${shareLink}</span>
              <div>
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

  // Thought Section
  window.hierarchyEditor.addModularSection("thoughtSection", (currentNode) => {
    if (!currentNode.metadata.thought) return;
    // Create the container div for the entire section
    let container = document.createElement("div");
    container.style.marginTop = "20px";
    container.style.padding = "10px";
  
    // Create the header bar
    let header = document.createElement("div");
    header.style.backgroundColor = "rgba(128,128,128,0.4)";
    header.style.cursor = "pointer";
    header.style.padding = "10px";
    header.style.display = "flex";
    header.style.alignItems = "center";
  
    // Create the toggle icon (initially a right-pointing arrow)
    let toggleIcon = document.createElement("span");
    toggleIcon.textContent = "▶";
    toggleIcon.style.marginRight = "8px";
  
    // Create the header text element
    let headerText = document.createElement("span");
    headerText.textContent = "Thoughts";
  
    // Append the icon and text to the header
    header.appendChild(toggleIcon);
    header.appendChild(headerText);
  
    // Create the content container (initially hidden)
    let content = document.createElement("div");
    content.style.display = "none"; // Hide by default
    content.style.padding = "10px";
    // Here you can insert your actual thoughts content; for now, we use a placeholder.
    let thoughts = currentNode.metadata.thought.split('\n');
    content.innerHTML = thoughts.map((thought) => {
      return `<div style="padding: 1em">${thought}</div>`;
    }).join('');
  
    // Add click event to toggle the content visibility and change the arrow
    header.addEventListener("click", function() {
      if (content.style.display === "none") {
        // Show the content and update the icon to a down caret
        content.style.display = "block";
        toggleIcon.textContent = "▼";
      } else {
        // Hide the content and revert the icon back to a right arrow
        content.style.display = "none";
        toggleIcon.textContent = "▶";
      }
    });
  
    // Append the header and content divs to the main container
    container.appendChild(header);
    container.appendChild(content);
  
    // Return the container so it gets added to the page
    return container;
  });

  // Chat Form
  window.hierarchyEditor.addModularSection("chatSection", (currentNode) => {
    let div = document.createElement("div");
    div.className = 'chat-container';

    div.innerHTML = `
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
      return `<a href="javascript:void(0)" onclick=" oneUpEffect(this); window.sophia.send('${node.id}', '${text}', createChild=true, label='${text}');"><strong>${text}</strong></a>`;
    },
    // boldPrefix: '<a href="#" on>',
    // boldSuffix: '</a>'
  };

  // Set up tree configuration for the default research agent (more agents provided by server API)
  // hierarchyEditor.config = {
  //   'model': 'qwen/qwen-2.5-7b-instruct',
  //   'agent': 'research',
  //   'agent_name': 'Expert',
  //   'user_name': 'Request',
  // };
  // hierarchyEditor.treeData.config = hierarchyEditor.config;

  hierarchyEditor.title = "DeepR";
  hierarchyEditor.treeData.name = "DeepR.wiki";
  hierarchyEditor.treeData.id = window.nav.getId();
  hierarchyEditor.treeData.body = `Use thinking AI to quickly build a wiki on anything. Great for **research**, **taxonomies**, **mind mapping** and **note taking**.
  [GitHub](https://github.com/lks-ai/deeper) | [By LKS](https://lks.ltd)

  *Begin the conversation by sending a message about the root topic or clicking one of the bold links*
  `;

  /*
  Sophia client stuff
  */

  sophia.compileContext = function(config, maxLevels=5, onChild=false){
    let l = hierarchyEditor.currentFocusPath;
    let n = l.length < maxLevels ? l.length: maxLevels;
    let off = l.length - n;
    let last = l[l.length - 1];
    if (!onChild) n--; // omit current entry if it an update
    // if (n <= 0) return "";
    let o = [];
    o.push('## Conversation History')
    // Compile the history by entry from [off - n] to off - 1
    for (let i = 0; i < n; i++){
        let v = l[off + i];
        if (v.metadata.hasOwnProperty('user_request')){
          o.push(`--- ${config.user_name}:\n${v.metadata.user_request || ""}\n\n--- ${config.agent_name}: ${v.name}\n${v.body}`);
        }else{
          o.push(`--- Content: ${v.name}\n${v.body}`);
        }
    }
    // If we are updating, and body.length > 0 then include a block for rewriting the request
    let justStarting = n <= 0 && !sophia.dirty
    if (!onChild && last.body.length > 0 && !justStarting){
      let v = last;
      o.push(`--- Current Content: ${v.name}\n${v.body}`);
      o.push('## Rewrite Content Request');
    }else{
      o.push('## Current Request');
    }
    return o.join("\n\n") + "\n\n";
  }

  sophia.compilePromptHistory = function(){
    if (typeof sophia.promptHistory === 'undefined') return '';
    o = [];
    var history = sophia.promptHistory;
    for (var i = 0; i < history.length; i++){
        let v = history[history.length - i - 1];
        o.push('<option>' + v + '</option>');
    }
    if (o.length == 0) o.push('<option value="">prompt history</option>');
    return '<select id="prompt-history" onchange="document.getElementById(\'message-input\').value=this.value;">' + o.join("") + '</select>';
  }

  sophia.compileAgentSelect = function(){
    let o = [];
    let curAgent = hierarchyEditor.getCurrentConfig().agent;
    for (let config in sophia.defaults.agents){
      let selected = config == curAgent ? ' selected': '';
      o.push(`<option value="${config}"${selected}>${config}</option>`);
    }
    return o.join("");
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

  sophia.getModels = async function(){
    try {
      const response = await fetch(`${HOST}/models`);
      if (!response.ok) {
        throw new Error(`Error fetching data: ${response.status}`);
      }
      const data = await response.json();
      sophia.models = data;          
    } catch (error) {
      console.error("Failed to fetch models:", error);
      throw error;
    }
  }

  sophia.getDefaults = async function(){
    try {
      const response = await fetch(`${HOST}/defaults`);
      if (!response.ok) {
        throw new Error(`Error fetching data: ${response.status}`);
      }
      const data = await response.json();
      sophia.defaults = data;          
    } catch (error) {
      console.error("Failed to fetch models:", error);
      throw error;
    }
  }

  sophia.setAgentConfig = function(config_name){
    // set once
    sophia._agentConfig = sophia.defaults.agents[config_name];
    sophia._agentConfig.agent = config_name;
  }

  sophia.getAgentConfig = function(){
    // get once
    let r = sophia._agentConfig;
    sophia._agentConfig = {};
    return r;
  }

  sophia.send = function(nodeId, prompt, createChild=false, label=null) {
    // Working data
    let targetNode = null;
    let parentNode = hierarchyEditor.getCurrentNode();
    let config = hierarchyEditor.getCurrentConfig();
    const newNodeType = config.node_type || parentNode.type || nodeTypes[0];

    // Set up prompt
    prompt = trim(prompt, ':*#,.-');
    let history = sophia.compileContext(config, maxLevels=80, onChild=createChild);
    sophia.promptHistory.push(prompt);
    const data = {
      history: history,
      prompt: prompt,
      //model: config.model,
      language: sophia.language,
      agent: config.agent,
    };

    // Pre-fetch interface setup
    if (!createChild){
      targetNode = parentNode;
      targetNode.name = "Thinking...";
    }else{
      targetNode = hierarchyEditor.createNode("Thinking...", parentNode, type=newNodeType);
      parentNode.children.push(targetNode);
      // Using targetNode, replace the original **bold** with a markdown link to the node.id from the original node
      if (label) {
        targetNode.metadata.tag = trim(label, ':*#,.-');
        hierarchyEditor.queueRewrite(
          [parentNode],
          `**${label}**`,
          `[${label}](#${targetNode.id})`
        );
      }
    }
    let typeData = hierarchyEditor.getNodeType(targetNode.type) || { label: "Node" };
    
    // Include any agent config which was set in Node options
    let acfg = sophia.getAgentConfig(); // get once
    if (acfg.hasOwnProperty('agent')){
      targetNode.config = acfg;
      data.agent = config.agent;
    }

    setTimeout(function(){
        hierarchyEditor.render();
        hierarchyEditor.breadcrumbRow.scrollBy(10024, 0);
        hierarchyEditor.childrenRow.scrollBy(10024, 0);
      }, 0);

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
      
      // Update metadata
      targetNode.metadata = {...targetNode.metadata, ...result};
      targetNode.metadata.user_request = prompt;

      // Set other fields
      let cleanName = result.label.replace('Knowledge Label:', '')
      targetNode.name = trim(cleanName, '- ');
      targetNode.body = result.response;

      // Perform peer rewrites using the targetNode.metadata.tag to make them link here.
      if (targetNode.metadata.tag){
        let tag = targetNode.metadata.tag;
        hierarchyEditor.queueRewrite(
          hierarchyEditor.getPeers(targetNode, true),
          `**${tag}**`,
          `[${tag}](#${targetNode.id})`
        );
      }

      // Set the interface as "touched"
      sophia.dirty = true;

      // Asynchronously make the interface do stuff
      setTimeout(function(){
        hierarchyEditor.render(from=targetNode);
        hierarchyEditor.breadcrumbRow.scrollBy(1024, 0);
        hierarchyEditor.childrenRow.scrollBy(1024, 0);
      }, 0);
      if (targetNode == hierarchyEditor.getCurrentNode()) window.scrollTo(0, 0);
    })
    .catch(error => {
      console.log(`Error: ${error}`);
    });
  }

  sophia.saveData = function(name, globalScope=false){
    if (name.length == 0) return;
    sophia.treeName = name;
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
      sophia.dirty = true;
      setTimeout(function(){
        hierarchyEditor.render();
      }, 0);
          
    } catch (error) {
      console.error("Failed to load data:", error);
      throw error;
    }
  }

  sophia.download = function(name, globalScope = false) {
    if (!name || name.length === 0) return;
  
    // Get the data as JSON string.
    const dataObj = hierarchyEditor.toJson(!globalScope ? hierarchyEditor.getCurrentNode() : null);
    const jsonData = JSON.stringify(dataObj, null, 2); // Optional pretty-printing
  
    // Create a Blob from the JSON data.
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
  
    // Create an invisible anchor element and trigger a download.
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.json`;
    document.body.appendChild(a);
    a.click();
  
    // Clean up.
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Expose sophia to the window scope
  window.sophia = sophia;

  // Load with shares on hash
  sophia._loadFromHash = async function(){
    const hash = window.location.hash;
    if (hash) {
      const decoded = decodeURIComponent(hash.slice(1)); // remove the '#' and decode
      if (decoded.startsWith("share-")) {
        const shareName = decoded.substring("share-".length);
        await sophia.loadData(shareName, globalScope=true);
      }
    }
  }

  // Render the editor for the first time
  sophia._loadFromHash();
  hierarchyEditor.render();

  // Hash navigation management
  window.addEventListener('hashchange', function(event) {
    sophia._loadFromHash();
    // Navigate the hierarchy to the new node by Id
    let parts = event.newURL.split('#', 2);
    hierarchyEditor.navigateToNodeById(parts[1]);
    hierarchyEditor.breadcrumbRow.scrollBy(1024, 0);
  });

  // Make sure they really want to leave
  window.onbeforeunload = function() {
    return "";
  }

  setTimeout(async function(){
    await sophia.getDefaults();
    hierarchyEditor.config = sophia.defaults.agents.research;
    hierarchyEditor.treeData.config = hierarchyEditor.config;
  }, 0);

});