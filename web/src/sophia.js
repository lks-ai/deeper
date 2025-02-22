//Sophia: (Deepr.wiki)
// github.com/lks-ai/deeper
// author: github.com/newsbubbles

// This script initializes some example node types.
// It should be loaded after hierarchy.js and after the DOM is ready.

const HOST = window.location.protocol + "//" + window.location.host;

/* Utility functions */

function showModal(contentHtml, closeCallback=null) {
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
      if (closeCallback) closeCallback();
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
function oneUpEffect(element, direction='up') {
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
  if (direction == 'up'){
    clone.style.transform = "translateY(-4em)";
  } else if (direction == 'left'){
    clone.style.transform = "translateX(-4em)";
  } else if (direction == 'right'){
    clone.style.transform = "translateX(4em)";
  }
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

function extractHashLinksFromMarkdown(markdownText) {
  // Regex matches markdown links of the form: [Label](#uuid)
  // where uuid is of the standard format: 8-4-4-4-12 hex characters.
  const regex = /\[[^\]]+\]\(#([0-9a-z\-]+)\)/gi;
  const uuids = [];
  let match;
  while ((match = regex.exec(markdownText)) !== null) {
    uuids.push(match[1]);
  }
  return uuids;
}

document.addEventListener("DOMContentLoaded", () => {
    const sophia = {};
    sophia.dirty = false;
    sophia.promptHistory = [];
    sophia.treeName = '';
    sophia.defaults = null;
    sophia.language = 'English';
    sophia._agentConfig = null;

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

  window.hierarchyEditor.addToolbarButton("🌳", (currentNode) => {
    setTimeout(function(){
      const canvas = document.getElementById('treeView');
      const parent = canvas.parentElement;
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height - 64;
      let typeColors = {};
      nodeTypes.forEach((type) => {
        typeColors[type.name] = type.color;
      });
      const visualizer = new TreeVisualizer(canvas, hierarchyEditor.treeData, {
        branchLength: 120,
        branchScale: 0.618033989,
        spreadAngle: Math.PI / 2,
        nodeRadius: 8,
        defaultColor: "#888888",
        highlightColor: "#fff",
        pathColor: "#eee",
        linkColor: "#8b67bf",
        typeColors: typeColors,
        labels: {
          fillStyle: "#eee",
          font: "12px sans-serif",
        },
        drawLinkGraph: true,
        callbacks: {
          click: (node) => {
            hierarchyEditor.navigateToNodeById(node.id);
            hierarchyEditor.breadcrumbRow.scrollBy(10024, 0);
          }
        },
        currentPath: window.hierarchyEditor.currentFocusPath
      });
      window.treeVisualizer = visualizer;
    }, 200);

    showModal(`
        <h2>Tree View<br><small>${hierarchyEditor.treeData.name}</small></h2>
        <canvas id="treeView" width="600" height="600"></canvas>
    `, closeCallback=function(){
      window.treeVisualizer = null;
    });
  }, "Tree View");

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
    sophia.sendUpdate(data.node, {name: data.node.name, body: data.node.body, metadata: data.node.metadata});
  });

  // Hook for swiping left
  window.hierarchyEditor.on("navigateRight", (data) => {
    oneUpEffect(hierarchyEditor.nodeEditor, 'left');
  });

  // Hook for swiping right
  window.hierarchyEditor.on("navigateLeft", (data) => {
    oneUpEffect(hierarchyEditor.nodeEditor, 'right');
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

    div.addEventListener('dragenter', function(event) {
      hovered(event);
    });
    
    div.addEventListener('dragleave', function(event) {
      setDefault(event);
    });
    
    div.addEventListener('dragover',  function(event) {
      hovered(event);
    });
    
    div.addEventListener('drop',  function(event) {
      setDefault(event);
      handleDrop(event);
    });
    
    function hovered (e) {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.classList.add('hovered');
    }  
    
    function setDefault (e) {
      e.currentTarget.classList.remove('hovered');
    }

    function handleDrop(event){
      // Attach file as part of a multipart form (only one file at a time for now)
      console.log(`Dropped: ${event}`);
      console.log(event);
      event.preventDefault();
    }

    return div;
  });

  hierarchyEditor.showMetadata = false;
  hierarchyEditor.markdownOptions = {
    // Either provide a function:
    // boldReplacer: function(text) { return '<a href="#">' + '<strong>' + text + '</strong>' + '</a>'; }
    // Or use prefix/suffix:
    boldReplacer: function(text){ 
      let node = hierarchyEditor.getCurrentNode();
      text = trim(text, '":\'').replace("'", "\\'");
      return `<a href="javascript:void(0)" onclick=" oneUpEffect(this); window.sophia.send('${node.id}', '${text}', createChild=true, label='${text}');"><strong>${text}</strong></a>`;
    },
    // boldPrefix: '<a href="#" on>',
    // boldSuffix: '</a>'
  };

  hierarchyEditor.title = "DeepR";
  hierarchyEditor.treeData.name = "DeepR.wiki";
  hierarchyEditor.treeData.id = window.nav.getId();
  hierarchyEditor.treeData.body = `Use thinking AI to quickly build a wiki on anything. Great for **research**, **taxonomies**, **mind mapping** and **note taking**.
  [GitHub](https://github.com/lks-ai/deeper) | [By LKS](https://lks.ltd)

  *Begin the conversation by sending a message about the root topic, [checking our guide](#share-DeepR) or clicking one of the bold links*
  `;

  /*
  Sophia client stuff
  */

  // Initialize the websockets client
  // TODO needs to now send actions from this userId to sophia.client upon
  //  encoding or rewriting a node
  //  any time the body is changed
  //  perhaps make a hierarchyEditor.update function and route everythign through that?
  //  perhaps not and just send a message immediately
  //  needs to change the channel to whatever channel that is the root ID of the tree
  //  user can be given by SSO or just a random user ID
  sophia.user = {name: localStorage.getItem('userName') || 'anon', id: window.nav.getId()};
  //sophia.

  /**
   * Attempts to automatically log in the user based on the JWT stored in localStorage.
   * Uses the OAuth verification flow.
   * If successful, updates localStorage with userId and additional fields (image_url, userName)
   * and returns a Promise that resolves to true. Otherwise, returns false.
   */
  sophia.autoLogin = function() {
    return new Promise((resolve) => {
      const jwt = localStorage.getItem('jwt');
      if (!jwt) {
        console.log("No JWT found in localStorage.");
        resolve(false);
        return;
      }
      
      // Use the OAuth verification flow (set useOAuth to true).
      AuthManager.verify(jwt, true)
        .then((userData) => {
          // Update localStorage with server-verified user data.
          sophia.user.id = userData.id;
          if (userData.name) sophia.user.name = userData.name;
          localStorage.setItem('userId', userData.id);
          if (userData.image_url) {
            localStorage.setItem('image_url', userData.image_url);
          }
          if (userData.name) {
            localStorage.setItem('userName', userData.name);
          }
          console.log("Auto login successful:", userData);
          resolve(true);
        })
        .catch((error) => {
          console.error("Auto login failed:", error);
          // Clear invalid tokens and user data.
          localStorage.removeItem('jwt');
          localStorage.removeItem('userId');
          localStorage.removeItem('image_url');
          localStorage.removeItem('userName');
          resolve(false);
        });
    });
  }

  sophia.isLoggedIn = function(){
    const jwt = localStorage.getItem('jwt');
    if (jwt) return true; else return false;
  }

  sophia.logOut = function(){
    localStorage.removeItem('jwt');
    localStorage.removeItem('userId');
    localStorage.removeItem('image_url');
    localStorage.removeItem('userName');
    window.location.reload();
  }
  
  //
  //  Websocket Client for realtime colab
  //

  const wsClient = new SophiaWebSocketClient(`${window.location.protocol == 'https:' ? 'wss': 'ws'}://${window.location.host}/ws`);
  wsClient.on("open", (e) => {
    console.log("Connected", e);
    sophia.joinChannel(hierarchyEditor.treeData.id);
  });
  wsClient.on("update", (msg) => {
    console.log("Update received", msg);
    // get the node from the ID
    // get the update
    let node = hierarchyEditor.findNodeById(hierarchyEditor.treeData, msg.nodeId);
    if (node){
      console.log(`node found: ${node.id}`);
      for (let key in msg.fields){
        if (msg.fields.hasOwnProperty(key)){
          let v = msg.fields[key];
          node[key] = v;
        }
      }
      sophia.updateLinks(node);
      if (node == hierarchyEditor.getCurrentNode()){
        hierarchyEditor.render();
      }else{
        hierarchyEditor.renderTop();
      }
      sophia.updateTreeVisualizer();
    }
  });
  wsClient.on("create", (msg) => {
    console.log("Create received", msg);
    // get parent id
    // create child from parent just like in send
    let parentNode = hierarchyEditor.findNodeById(hierarchyEditor.treeData, msg.parentId);
    if (parentNode){
      let targetNode = hierarchyEditor.createNode(msg.fields.name, parentNode, type=msg.fields.type);
      targetNode = {...targetNode, ...msg.fields};
      targetNode.id = msg.nodeId;
      parentNode.children.push(targetNode);
      sophia.updateLinks(parentNode);
      hierarchyEditor.renderTop();
      sophia.updateTreeVisualizer();
    }

  });
  wsClient.on("user_joined", (msg) => {
    console.log("User joined", msg)
  });
  wsClient.on("user_update", (msg) => {
    console.log("User updated their data", msg)
  });
  sophia.client = wsClient;

  sophia.joinChannel = function(channel){
    const data = {
      action: 'join_channel',
      userId: sophia.user.id,
      channel: channel
    };
    console.log("join", data);
    sophia.client.send(data);
  }

  sophia.sendCreate = function(node){
    let data = {
      action: 'create',
      userId: sophia.user.id,
      nodeId: node.id,
      parentId: node.parent.id,
      fields: {
        name: node.name,
        type: node.type,
        metadata: node.metadata
      }
    };
    sophia.client.send(data);
  }

  sophia.sendUpdate = function(node, fields={}){
    // fields is a diff of what has changed in the structure of a node
    let data = {
      action: 'update',
      userId: sophia.user.id,
      nodeId: node.id,
      fields: fields
    };
    sophia.client.send(data);
  }

  sophia.updateUser = function(fields={}){
    let data = {
      action: 'user_update',
      userId: sophia.user.id,
      fields: fields
    };
    sophia.client.send(data);
  }

  sophia.sendSyncRequest = function(){
    let data = {
      action: 'fullsync',
      userId: sophia.user.id,
    };
    sophia.client.send(data);
  }

  hierarchyEditor.on('rewritten', (node) => {
    sophia.sendUpdate(node, {
      'body': node.body,
    });
  });

  hierarchyEditor.on('renamed', (node) => {
    sophia.sendUpdate(node, {name: node.name});
  });

  sophia.updateTreeVisualizer = function(){
    // Updates the tree visualizer if it is showing on the client
    if (!window.treeVisualizer) return;
    window.treeVisualizer.treeData = hierarchyEditor.treeData;
    window.treeVisualizer.computeLayout();
    window.treeVisualizer.rearrange();
    window.treeVisualizer.render();
  }

  /* Functional sophia client that edits structure */

  sophia.formatContextEntry = function(node){
    let user_name = hierarchyEditor.getConfigValue(node, 'user_name');
    let agent_name = hierarchyEditor.getConfigValue(node, 'agent_name');
    if (node.metadata.hasOwnProperty('user_request')){
      return `--- ${user_name}:\n${node.metadata.user_request || ""}\n\n--- ${agent_name}: ${node.name}\n${node.body}`;
    }else{
      return `--- Content: ${node.name}\n${node.body}`;
    }
  }

  sophia.updateLinks = function(node){
    // synchronizes the links from the node's body into a "links" field in nodes
    let uuids = extractHashLinksFromMarkdown(node.body);
    node.links = [];
    for (let i = 0; i < uuids.length; i++){
      let n = hierarchyEditor.findNodeById(hierarchyEditor.treeData, uuids[i]);
      if (n) node.links.push(n);
    }
  }

  sophia.traverseBranch = function(node, callback) {
    if (!node) return;
    callback(node);
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => sophia.traverseBranch(child, callback));
    }
  }
  
  sophia.compileLinkRecall = function(node){
    // Gets a list of all links from a node body and compiles a 
    if (!node) return '';
    let o = [];

    const results = extractHashLinksFromMarkdown(node.body);
    results.forEach((uuid) => {
      let n = hierarchyEditor.findNodeById(hierarchyEditor.treeData, uuid);
      if (n){
        o.push(sophia.formatContextEntry(n));
      }
    });
    return o;
  }

  sophia.encodeLink = function(nodes, tags, target){
    // given a list of nodes, any tag string and a target node, queue link rewrites
    if (typeof(tags) === 'string') tags = [tags, tags.toLowerCase()];
    tags.forEach((tag)=>{
      hierarchyEditor.queueRewrite(
        nodes,
        `**${tag}**`,
        `[${tag}](#${target.id})`  
      );
    });
    // update the links (for visualization and graph functionalities)
    for (let i = 0; i < nodes.length; i++)
      sophia.updateLinks(nodes[i]);
  }

  sophia.mutualizeLinks = function(node, depthAncestors=2, depthAunts=1, depthCousins=0){
      // Perform peer and ancestor rewrites using the targetNode.metadata.tag to make them link here.
      // start with any ancestors `depthAncestors` generations back
      const ancestors = hierarchyEditor.getAncestors(node, depthAncestors);
      // Get related aunt nodes for ancestors `depthPeer` generations back
      let aunts = [];
      let cousins = [];
      for (let i = 0; i < depthAunts && i < ancestors.length; i++){
        let ns = hierarchyEditor.getPeers(ancestors[i]);
        if (ns){
          aunts.push(...ns);
          if (i < depthCousins){
            for (let a = 0; a < ns.length; a++){
              let aunt = ns[a];
              if (aunt.children) cousins.push(...aunt.children);
            }
          }
        }
      }
      // Concat to all peers, ancestors and aunts
      let contexts = [...hierarchyEditor.getPeers(node, true), ...ancestors, ...aunts];
      // Encode node link in all contexts
      if (node.metadata.tag){
        let tag = node.metadata.tag;
        sophia.encodeLink(contexts, tag, node);
        
      }
      // Reverse rewrite context nodes that came later than targetNode such that they point to target node
      for (let i = 0; i < contexts.length; i++){
        let peer = contexts[i];
        if (peer.metadata.tag){
          let tag = peer.metadata.tag;
          let contexts = [node];
          sophia.encodeLink(contexts, tag, peer);
        }
      }
  }

  sophia.compileContext = function(config, maxLevels=5, onChild=false){
    let l = hierarchyEditor.currentFocusPath;
    let n = l.length < maxLevels ? l.length: maxLevels;
    let off = l.length - n;
    let last = l[l.length - 1];
    if (!onChild) n--; // omit current entry if it is an update
    // if (n <= 0) return "";
    let o = [];
    o.push('## Conversation History')
    // Compile the history by entry from [off - n] to off - 1
    for (let i = 0; i < n; i++){
        let node = l[off + i];
        o.push(sophia.formatContextEntry(node));
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
    let o = [];
    var history = sophia.promptHistory;
    o.push('<option value="">prompt history</option>');
    for (var i = 0; i < history.length; i++){
        let v = history[history.length - i - 1];
        o.push('<option>' + v + '</option>');
    }
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
    sophia._agentConfig = null;
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
      sophia.sendUpdate(targetNode, {name: targetNode.name});
    }else{
      targetNode = hierarchyEditor.createNode("Thinking...", parentNode, type=newNodeType);
      parentNode.children.push(targetNode);
      // Using targetNode, replace the original **bold** with a markdown link to the node.id from the original node
      if (label) {
        targetNode.metadata.tag = trim(label, ':*#,.-');
        sophia.encodeLink([parentNode], label, targetNode);
      }
      sophia.sendCreate(targetNode);
    }
    let typeData = hierarchyEditor.getNodeType(targetNode.type) || { label: "Node" };
    
    // Include any agent config which was set in Node options
    let acfg = sophia.getAgentConfig(); // get once
    if (acfg){
      targetNode.config = acfg;
      data.agent = config.agent;
      sophia.sendUpdate(targetNode, {config: targetNode.config});
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
      delete result['user_request'];
      targetNode.metadata = {...targetNode.metadata, ...result};
      if (createChild || targetNode.metadata['user_request'] === 'undefined'){
        // if creating a child, just set user_request to the prompt
        targetNode.metadata.user_request = prompt;
      }
      
      // Set other fields
      let cleanName = result.label.replace('Knowledge Label:', '')
      targetNode.name = trim(cleanName, '- ');
      targetNode.body = result.response;
      sophia.sendUpdate(targetNode, {name: targetNode.name, body: targetNode.body, metadata: targetNode.metadata});

      sophia.mutualizeLinks(targetNode);

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
      sophia.traverseBranch(hierarchyEditor.treeData, sophia.updateLinks);
      sophia.joinChannel(hierarchyEditor.treeData.id);
      setTimeout(function(){
        hierarchyEditor.render();
      }, 0);
      // setTimeout(function(){
      //   RHEmbed.loadTreeData(hierarchyEditor.treeData);
      // }, 100);
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

  // TODO RHEmbed hybrid search

  // sophia.query = function(queryText, topN) {
  //   topN = topN || 5;
  //   // Compute the current guidance epsilon based on tree size.
  //   var epsilon = RHEmbed.utils.computeGuidanceEpsilon();
  //   if (epsilon > 0) {
  //     console.log("Using distribution-based search results. Guidance epsilon:", epsilon.toFixed(3));
  //     // Return distribution-based results.
  //     return RHEmbed.Query.queryNodesDistribution(queryText, topN);
  //   } else {
  //     console.log("Using model-based search results.");
  //     // Return model-based (embedding cosine similarity) results.
  //     return RHEmbed.Query.queryNodes(queryText, topN);
  //   }
  // }
  
  // Expose sophia to the window scope
  window.sophia = sophia;

  // HASH BASED NAV

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
  window.addEventListener('hashchange', async function(event) {
    await sophia._loadFromHash();
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

  // Attempt to automatically log in and set interface elements
  sophia.autoLogin().then((isLoggedIn) => {
    if (isLoggedIn) {
      // For example, update the user badge with the stored image_url.
      const imageUrl = localStorage.getItem('image_url');
      if (imageUrl) {
        const userBadge = document.getElementById('userBadge');
        if (userBadge) {
          userBadge.src = imageUrl;
        }
      }
      console.log("User is logged in.");
      // TODO Here we can also do stuff making sure `user` is set to the userId etc.
      hierarchyEditor.addToolbarButton('👤', ()=>{
        showModal(`
          <h2><span id="title-username">${sophia.user.name}</span><br><small>Account Settings</small></h2>
          <ul>
            <li>
              <label>User Name</label>
              <input type="text" placeholder="username" value="${sophia.user.name}" onchange="sophia.user.name=this.value; document.getElementById('title-username').innerHTML=this.value;" onkeyup="this.onchange()">
            </li>
            <li>
              <label>Session</label>
              <button onclick="sophia.logOut()">Log Out</button>
            </li>
          </ul>
        `,
        function(){
          // onclose function
          localStorage.setItem('userName', sophia.user.name);
          sophia.updateUser({name: sophia.user.name});
        });
      }, `Account: ${sophia.user.name}`);
      hierarchyEditor.render();
    } else {
      console.log("User is not logged in.");
      // Optionally, trigger UI changes for guests.
      hierarchyEditor.addToolbarButton('👤', ()=>{
        window.location.href=`${window.location.origin}/login`;
      }, 'Log In');
      hierarchyEditor.render();
    }

    // Connect websocket client
    sophia.client.connect();

  });



});