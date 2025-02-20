(function(){
    "use strict";
    
    /** 
    * A simple markdown-to-HTML converter.
    * Supports headings, bold, italic, inline code, and newlines.
    */
    function markdownToHtml(mdText, options) {
        if (!mdText) return "";
        
        return Markdown.render(mdText, options);
    }
    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\%%CODEBLOCK_0%%amp;');
    }
    function replaceAllCaseInsensitiveRegex(str, searchValue, replacementValue) {
        const esv = escapeRegExp(searchValue);
        const regex = new RegExp(esv, 'gi'); // 'g' for global, 'i' for case-insensitive
        return str.replaceAll(regex, replacementValue);
    }
      
    
    class Nav {
        setHash(hash) {
            if (history.pushState) {
                history.pushState(null, null, `#${hash}`);
            } else {
                location.hash = `#${hash}`;
            }
        }
        
        goHash(hash, scroll=true) {
            // Navigate to the given hash
            // Should be used in HierarchyEditor to go show a specific node
            return;
        }
        
        getId() {
            // Create an array of 16 random bytes
            const bytes = crypto.getRandomValues(new Uint8Array(16));
          
            // Per RFC 4122:
            // - Set the 4 most significant bits of byte 6 to 0100, indicating version 4.
            // - Set the 2 most significant bits of byte 8 to 10, indicating the variant.
            bytes[6] = (bytes[6] & 0x0f) | 0x40;
            bytes[8] = (bytes[8] & 0x3f) | 0x80;
          
            // Convert each byte to a two-digit hexadecimal string.
            const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0'));
          
            // Format the UUID string: 8-4-4-4-12
            return [
              hex.slice(0, 4).join(''),   // 4 bytes = 8 hex digits
              hex.slice(4, 6).join(''),   // 2 bytes = 4 hex digits
              hex.slice(6, 8).join(''),   // 2 bytes = 4 hex digits (includes version)
              hex.slice(8, 10).join(''),  // 2 bytes = 4 hex digits (includes variant)
              hex.slice(10, 16).join('')  // 6 bytes = 12 hex digits
            ].join('-');
        }
          
    }
    window.nav = new Nav();
    /**
    * HierarchyEditor manages the tree data, its rendering, and provides a programmatic API.
    * New features:
    * - Nodes now have a "type" property.
    * - Branch copy, cut, and paste.
    * - Toolbar buttons (with extra configurable buttons).
    * - Modular sections in node view.
    * - Hook endpoints for various events.
    */
    class HierarchyEditor {
        constructor(containerId) {
            this.container = document.getElementById(containerId);
            if (!this.container) {
                throw new Error("Container element not found");
            }
            // Basic Config
            this.title = "Hierarchy";
            
            // Key UI elements.
            this.bgImageDiv    = this.container.querySelector("#bgImage");
            this.svgOverlay    = this.container.querySelector("#svgOverlay");
            this.breadcrumbRow = this.container.querySelector("#breadcrumbRow");
            this.childrenRow   = this.container.querySelector("#childrenRow");
            this.nodeEditor    = this.container.querySelector("#nodeEditor");
            
            // Initialize tree with a root node.
            this.nodeIdCounter = 0;
            this.treeData = this.createNode("Root", null);
            this.currentFocusPath = [this.treeData];
            
            // Editor mode: "view" or "edit".
            this.nodeEditorMode = "view";
            this.showMetadata = true;
            this.markdownOptions = {};
            this.config = {}; // config override options to place in the tree (trickle down)
            this.currentConfig = {};  // the condig as calculated by focus path
            
            // Clipboard for branch copy/cut.
            this.clipboard = null;
            this.clipboardAction = null; // "copy" or "cut"
            
            // Toolbar buttons (each: {icon, callback, tooltip}).
            this.toolbarButtons = [];
            
            // Modular sections for node view.
            // Each section is {id, render: function(currentNode) -> HTMLElement or HTML string}
            this.modularSections = [];
            
            // Hook system: map event names to arrays of callbacks.
            this.hooks = {};
            
            // Rewrite Queue for Rewriting the body of nodes and not hitting race conditions ;)
            this.rewriteQueue = [];
            
            // Node types (an object keyed by type name).
            this.nodeTypes = {};
            
            // this.render();
            
            // Update SVG connectors on window resize.
            window.addEventListener("resize", () => this.updateConnections());
            this.setupScrollListeners();
        }
        
        /* ---------------- Hook System ---------------- */
        on(eventName, callback) {
            if (!this.hooks[eventName]) {
                this.hooks[eventName] = [];
            }
            this.hooks[eventName].push(callback);
        }
        off(eventName, callback) {
            if (!this.hooks[eventName]) return;
            this.hooks[eventName] = this.hooks[eventName].filter(cb => cb !== callback);
        }
        triggerHook(eventName, data) {
            if (this.hooks[eventName]) {
                this.hooks[eventName].forEach(cb => cb(data));
            }
        }
        
        /* ---------------- Toolbar API ---------------- */
        addToolbarButton(icon, callback, tooltip) {
            this.toolbarButtons.push({ icon, callback, tooltip });
        }
        removeToolbarButton(icon) {
            this.toolbarButtons = this.toolbarButtons.filter(btn => btn.icon !== icon);
        }
        
        /* ---------------- Modular Sections API ---------------- */
        addModularSection(id, renderFunction) {
            // renderFunction: function(currentNode) returns HTMLElement or HTML string.
            this.modularSections.push({ id, render: renderFunction });
        }
        removeModularSection(id) {
            this.modularSections = this.modularSections.filter(sec => sec.id !== id);
        }
        
        /* ---------------- Node Type API ---------------- */
        addNodeType(typeData) {
            if (!typeData.name) return;
            this.nodeTypes[typeData.name] = typeData;
        }
        getNodeType(typeName) {
            return this.nodeTypes[typeName];
        }
        getAllNodeTypes() {
            return Object.values(this.nodeTypes);
        }
        
        /* ---------------- Branch Operations ---------------- */
        copyBranch(nodeId) {
            let node = this.findNodeById(this.treeData, nodeId);
            if (!node) return;
            // Deep clone branch (without parent pointers).
            this.clipboard = this._cloneBranch(node, /* assignNewIds */ false);
            this.clipboardAction = "copy";
            this.triggerHook("branchCopied", { node });
        }
        cutBranch(nodeId) {
            let node = this.findNodeById(this.treeData, nodeId);
            if (!node || !node.parent) return;
            this.clipboard = this._cloneBranch(node, false);
            this.clipboardAction = "cut";
            // Remove the node from its parent.
            this.removeNodeFromTree(node, node.parent);
            this.triggerHook("branchCut", { node });
            this.render();
        }
        pasteBranch(targetParentId) {
            if (!this.clipboard) return;
            let targetParent = this.findNodeById(this.treeData, targetParentId);
            if (!targetParent) return;
            // Clone the clipboard branch and assign new IDs.
            let newBranch = this._cloneBranch(this.clipboard, true, targetParent);
            targetParent.children.push(newBranch);
            // If it was a cut operation, clear the clipboard.
            if (this.clipboardAction === "cut") {
                this.clipboard = null;
                this.clipboardAction = null;
            }
            this.triggerHook("branchPasted", { targetParent, newBranch });
            this.render();
        }
        _cloneBranch(node, assignNewIds, newParent = null) {
            // Create a shallow copy; if assignNewIds is true, assign new IDs recursively.
            let cloned = {
                id: assignNewIds ? "node-" + (this.nodeIdCounter++) : node.id,
                content: node.content,
                name: node.name,
                body: node.body,
                metadata: Object.assign({}, node.metadata),
                image_url: node.image_url,
                media: node.media,
                type: node.type,
                config: node.config,
                parent: newParent,
                children: []
            };
            node.children.forEach(child => {
                cloned.children.push(this._cloneBranch(child, assignNewIds, cloned));
            });
            return cloned;
        }
        
        /* ---------------- Rendering Helpers ---------------- */
        setupScrollListeners() {
            const updateOnScroll = () => {
                if (!this.scrollTicking) {
                    window.requestAnimationFrame(() => {
                        this.updateConnections();
                        this.scrollTicking = false;
                    });
                    this.scrollTicking = true;
                }
            };
            this.breadcrumbRow.addEventListener("scroll", updateOnScroll);
            this.childrenRow.addEventListener("scroll", updateOnScroll);
        }
        
        getCurrentNode(){
            return this.currentFocusPath[this.currentFocusPath.length - 1];
        }

        getPeers(node, includeSelf=false){
            if (node.parent){
                if (!includeSelf){
                    return node.parent.children - [node];
                }else{
                    return node.parent.children;
                }
            }
            return [];
        }

        getAncestors(node, generations=1, includeSelf=false){
            let c = 0;
            let o = [];
            let parent = node;
            while (parent.parent && c < generations){
                o.push(parent.parent);
                parent = parent.parent;
                c++;
            }
            return o;
        }
        
        getNodeTypeData(node){
            return this.getNodeType(node.type) || { label: "Node" };
        }
        
        getCurrentConfig() {
            // Gets the config as a trickle-down composite
            let curConfig = this.config;
            this.currentFocusPath.forEach((node, index) => {
                curConfig = {...curConfig, ...node.config};
            });
            this.currentConfig = curConfig;
            return curConfig;
        }

        getConfigValue(node, key){
            let parent = node;
            while (parent){
                if (parent.hasOwnProperty('config')){
                    if (parent.config.hasOwnProperty(key)){
                        return parent.config[key];
                    }
                }
                parent = parent.parent;
            }
            return null;
        }
        
        render(from=null) {
            // Update background image if current node has an image_url.
            let currentNode = this.currentFocusPath[this.currentFocusPath.length - 1];
            if (currentNode.image_url) {
                this.bgImageDiv.style.backgroundImage = `url(${currentNode.image_url})`;
            } else {
                this.bgImageDiv.style.backgroundImage = "";
            }
            this.renderBreadcrumb();
            this.renderChildren();
            if (from == null || from == this.getCurrentNode()){
                this.renderNodeEditor();
            }
            this.updateConnections();
            window.nav.setHash(currentNode.id);
            document.title = `${currentNode.name} - ${this.title}`;
        }

        renderBreadcrumb() {
            this.breadcrumbRow.innerHTML = "";
            this.currentFocusPath.forEach((node, index) => {
                let crumb = document.createElement("div");
                crumb.className = "breadcrumb-item";
                crumb.innerText = node.name || node.content;
                if (index === this.currentFocusPath.length - 1) {
                    crumb.classList.add("active");
                }
                crumb.addEventListener("click", () => {
                    if (index < this.currentFocusPath.length - 1) {
                        this.currentFocusPath = this.currentFocusPath.slice(0, index + 1);
                        this.nodeEditorMode = "view";
                        this.render();
                    }
                });
                this.breadcrumbRow.appendChild(crumb);
                if (index < this.currentFocusPath.length - 1) {
                    let arrow = document.createElement("span");
                    arrow.innerText = "➜";
                    this.breadcrumbRow.appendChild(arrow);
                }
            });
        }
        
        renderChildren() {
            this.childrenRow.innerHTML = "";
            let currentParent = this.currentFocusPath[this.currentFocusPath.length - 1];
            currentParent.children.forEach(childNode => {
                let card = document.createElement("div");
                card.className = "node-card";
                card.setAttribute("data-node-id", childNode.id);
                
                // Editable name.
                let contentDiv = document.createElement("div");
                contentDiv.contentEditable = "true";
                contentDiv.innerText = childNode.name || childNode.content;
                contentDiv.style.outline = "none";
                contentDiv.addEventListener("blur", () => {
                    childNode.name = contentDiv.innerText.trim() || "New Node";
                    this.renderBreadcrumb();
                });
                card.appendChild(contentDiv);
                
                // Clicking the card sets focus.
                card.addEventListener("click", (e) => {
                    if (e.target.classList.contains("remove-btn")) return;
                    this.currentFocusPath.push(childNode);
                    this.nodeEditorMode = "view";
                    this.render();
                });
                
                // Remove button.
                let typeData = this.getNodeType(childNode.type) || { label: "Node" };
                let removeBtn = document.createElement("button");
                removeBtn.innerText = "✖";
                removeBtn.className = "remove-btn";
                removeBtn.title = "Remove " + typeData.label;
                removeBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (!childNode.parent) return;
                    this.removeNodeFromTree(childNode, childNode.parent);
                    let idx = this.currentFocusPath.findIndex(n => n.id === childNode.id);
                    if (idx > -1) {
                        this.currentFocusPath = this.currentFocusPath.slice(0, idx);
                    }
                    this.triggerHook('nodeRemoved', {node: childNode});
                    this.render();
                });
                card.appendChild(removeBtn);
                this.childrenRow.appendChild(card);
            });
            
            // If node types are defined, render one "Add {label}" button per type.
            if (Object.keys(this.nodeTypes).length > 0) {
                Object.keys(this.nodeTypes).forEach(typeName => {
                    let typeData = this.nodeTypes[typeName];
                    let addTypeBtn = document.createElement("button");
                    addTypeBtn.innerText = "Add " + typeData.label;
                    addTypeBtn.style.padding = "10px 15px";
                    addTypeBtn.style.border = "2px dashed " + typeData.color;
                    addTypeBtn.style.borderRadius = "8px";
                    //addTypeBtn.style.background = "#e9f7ef";
                    addTypeBtn.style.cursor = "pointer";
                    addTypeBtn.addEventListener("click", () => {
                        let currentParent = this.currentFocusPath[this.currentFocusPath.length - 1];
                        let newNode = this.createNode("New " + typeData.label, currentParent, type=typeData.name);
                        // newNode.type = typeData.name;
                        // Prepopulate metadata from the type schema.
                        if (Array.isArray(typeData.schema)) {
                            typeData.schema.forEach(metaDef => {
                                newNode.metadata[metaDef.name] = metaDef.defaultValue;
                            });
                        }
                        currentParent.children.push(newNode);
                        this.currentFocusPath.push(newNode);
                        this.nodeEditorMode = "view";
                        this.triggerHook("nodeCreated", { node: newNode });
                        this.render();
                        setTimeout(() => {
                            let viewerNameInput = this.nodeEditor.querySelector("input[type='text']");
                            if (viewerNameInput) {
                                viewerNameInput.focus();
                                viewerNameInput.select();
                            }
                            this.breadcrumbRow.scrollBy(1024, 0);
                        }, 0);
                    });
                    this.childrenRow.appendChild(addTypeBtn);
                });
            } else {
                // Fallback if no node types defined.
                let addChildBtn = document.createElement("button");
                addChildBtn.innerText = "+ Add Child";
                addChildBtn.style.padding = "10px 15px";
                addChildBtn.style.border = "2px dashed #28a745";
                addChildBtn.style.borderRadius = "8px";
                //addChildBtn.style.background = "#e9f7ef";
                addChildBtn.style.cursor = "pointer";
                addChildBtn.addEventListener("click", () => {
                    let currentParent = this.currentFocusPath[this.currentFocusPath.length - 1];
                    let newNode = this.createNode("New Node", currentParent);
                    currentParent.children.push(newNode);
                    this.currentFocusPath.push(newNode);
                    this.nodeEditorMode = "view";
                    this.triggerHook("nodeCreated", { node: newNode });
                    this.render();
                    setTimeout(() => {
                        let viewerNameInput = this.nodeEditor.querySelector("input[type='text']");
                        if (viewerNameInput) {
                            viewerNameInput.focus();
                            viewerNameInput.select();
                        }
                    }, 0);
                });
                this.childrenRow.appendChild(addChildBtn);
            }
        }
        
        renderNodeEditor() {
            this.nodeEditor.innerHTML = "";
            if (this.nodeEditorMode === "view") {
                this.renderNodeViewer();
            } else if (this.nodeEditorMode === "edit") {
                this.renderNodeEditorForm();
            }
        }
        
        renderNodeViewer() {
            let currentNode = this.currentFocusPath[this.currentFocusPath.length - 1];
            let typeData = this.getNodeType(currentNode.type) || { label: "Node" };
            let viewerContainer = document.createElement("div");
            viewerContainer.style.position = "relative";
            
            // Toolbar: Edit button...
            let editBtn = document.createElement("button");
            editBtn.innerText = "✎";
            //editBtn.style.position = "absolute";
            //editBtn.style.top = "0";
            //editBtn.style.right = "40px";
            editBtn.className = "toolbar-btn";
            editBtn.title = "Edit " + typeData.label;
            editBtn.addEventListener("click", () => {
                this.nodeEditorMode = "edit";
                this.render();
            });
            viewerContainer.appendChild(editBtn);
            
            // Toolbar: Extra buttons 
            this.toolbarButtons.forEach(btnData => {
                let btn = document.createElement("button");
                btn.innerText = btnData.icon;
                btn.className = "toolbar-btn";
                btn.title = btnData.tooltip;
                btn.addEventListener("click", () => {
                    btnData.callback(currentNode);
                    this.triggerHook("toolbarButtonClicked", { node: currentNode, button: btnData.icon });
                });
                // Append next to the edit button.
                viewerContainer.appendChild(btn);
            });
            
            // Node Name (editable inline)
            let nameLabel = document.createElement("label");
            nameLabel.innerText = typeData.label;
            viewerContainer.appendChild(nameLabel);
            let nameInput = document.createElement("input");
            nameInput.type = "text";
            nameInput.className = "node-title"
            nameInput.value = currentNode.name || currentNode.content;
            nameInput.addEventListener("input", () => {
                currentNode.name = nameInput.value;
                this.renderBreadcrumb();
                this.updateConnections();
            });
            viewerContainer.appendChild(nameInput);
            
            // Node body rendered as markdown.
            // let bodyLabel = document.createElement("label");
            // bodyLabel.innerText = "Content:";
            // bodyLabel.style.marginTop = "15px";
            // viewerContainer.appendChild(bodyLabel);
            if (typeof currentNode.body !== "undefined"){
                if (currentNode.body.length > 0){
                    let contentDiv = document.createElement("div");
                    contentDiv.innerHTML = markdownToHtml(currentNode.body, this.markdownOptions);
                    contentDiv.style.marginTop = "5px";
                    viewerContainer.appendChild(contentDiv);
                }
            }
            
            // Metadata display.
            if (Object.keys(currentNode.metadata).length > 0 && this.showMetadata){
                let metaDiv = document.createElement("div");
                metaDiv.style.marginTop = "20px";
                let metaTitle = document.createElement("h4");
                metaTitle.innerText = "Metadata";
                metaDiv.appendChild(metaTitle);
                let metaList = document.createElement("ul");
                for (let key in currentNode.metadata) {
                    let li = document.createElement("li");
                    li.innerHTML = `<strong>${key}:</strong> ${currentNode.metadata[key]}`;
                    metaList.appendChild(li);
                }
                metaDiv.appendChild(metaList);
                viewerContainer.appendChild(metaDiv);
            }
            
            // Modular sections (e.g. media banner, custom HTML, etc.)
            this.modularSections.forEach(section => {
                let rendered = section.render(currentNode);
                if (typeof rendered === "string") {
                    let div = document.createElement("div");
                    div.innerHTML = rendered;
                    viewerContainer.appendChild(div);
                } else if (rendered instanceof HTMLElement) {
                    viewerContainer.appendChild(rendered);
                }
            });
            
            this.nodeEditor.appendChild(viewerContainer);
        }
        
        renderNodeEditorForm() {
            let currentNode = this.currentFocusPath[this.currentFocusPath.length - 1];
            let typeData = this.getNodeType(currentNode.type) || { label: "Node" };
            
            let title = document.createElement("h3");
            title.innerText = "Edit " + typeData.label;
            this.nodeEditor.appendChild(title);
            
            // Node Name field.
            let nameLabel = document.createElement("label");
            nameLabel.innerText = typeData.label + " Name:";
            this.nodeEditor.appendChild(nameLabel);
            let nameInput = document.createElement("input");
            nameInput.type = "text";
            nameInput.value = currentNode.name || currentNode.content;
            nameInput.addEventListener("input", () => {
                currentNode.name = nameInput.value;
                this.renderBreadcrumb();
            });
            this.nodeEditor.appendChild(nameInput);
            
            // Rich content editor.
            let bodyLabel = document.createElement("label");
            bodyLabel.innerHTML = "Content <small>(Markdown supported)</small>";
            this.nodeEditor.appendChild(bodyLabel);
            let bodyEditor = document.createElement("textarea");
            //bodyEditor.contentEditable = "true";
            bodyEditor.value = currentNode.body;
            bodyEditor.style.border = "1px solid #ccc";
            bodyEditor.style.padding = "10px";
            bodyEditor.style.minHeight = "12em";
            bodyEditor.style.borderRadius = "4px";
            bodyEditor.addEventListener("blur", () => {
                currentNode.body = bodyEditor.value;
            });
            this.nodeEditor.appendChild(bodyEditor);
            
            // Metadata section.
            let metadataLabel = document.createElement("label");
            metadataLabel.innerHTML = "Metadata <small>(key-value pairs)</small>";
            this.nodeEditor.appendChild(metadataLabel);
            let metadataSection = document.createElement("div");
            metadataSection.id = "metadataSection";
            let metadataList = document.createElement("ul");
            metadataList.id = "metadataList";
            Object.keys(currentNode.metadata).forEach(key => {
                let li = this.createMetadataListItem(key, currentNode.metadata[key], currentNode);
                metadataList.appendChild(li);
            });
            metadataSection.appendChild(metadataList);
            let addMetaBtn = document.createElement("button");
            addMetaBtn.innerText = "Add Metadata";
            addMetaBtn.style.padding = "5px 10px";
            addMetaBtn.style.marginTop = "10px";
            addMetaBtn.addEventListener("click", () => {
                let newKey = "";
                let newValue = "";
                currentNode.metadata[newKey] = newValue;
                let li = this.createMetadataListItem(newKey, newValue, currentNode);
                metadataList.appendChild(li);
            });
            metadataSection.appendChild(addMetaBtn);
            this.nodeEditor.appendChild(metadataSection);
            
            // "Done" button to exit edit mode.
            let doneBtn = document.createElement("button");
            doneBtn.innerText = "Done";
            doneBtn.style.padding = "10px 15px";
            doneBtn.style.marginTop = "15px";
            doneBtn.addEventListener("click", () => {
                this.nodeEditorMode = "view";
                this.triggerHook("editFormSubmitted", { node: currentNode });
                this.render();
            });
            this.nodeEditor.appendChild(doneBtn);
        }
        
        createMetadataListItem(key, value, currentNode) {
            let multiline = value.includes('\n');
            let li = document.createElement("li");
            let keyInput = document.createElement("input");
            keyInput.type = "text";
            keyInput.placeholder = "Key";
            keyInput.value = key;
            keyInput.addEventListener("input", () => {
                if (keyInput.value !== key) {
                    let currentValue = currentNode.metadata[key];
                    delete currentNode.metadata[key];
                    currentNode.metadata[keyInput.value] = currentValue;
                    key = keyInput.value;
                }
            });
            li.appendChild(keyInput);
            let valueInput = null;
            if (multiline){
                valueInput = document.createElement("textarea");
                valueInput.style.height = '4em';
            }else{
                valueInput = document.createElement("input");
                valueInput.type = "text";
            }
            valueInput.placeholder = "Value";
            valueInput.value = value;
            valueInput.addEventListener("input", () => {
                currentNode.metadata[key] = valueInput.value;
            });

            li.appendChild(valueInput);

            let removeMetaBtn = document.createElement("button");
            removeMetaBtn.innerText = "✖";
            removeMetaBtn.className = "metadata-remove-btn";
            removeMetaBtn.addEventListener("click", () => {
                delete currentNode.metadata[key];
                li.remove();
            });
            li.appendChild(removeMetaBtn);
            return li;
        }
        
        updateConnections() {
            while (this.svgOverlay.firstChild) {
                this.svgOverlay.removeChild(this.svgOverlay.firstChild);
            }
            let breadcrumbItems = this.breadcrumbRow.querySelectorAll(".breadcrumb-item");
            if (breadcrumbItems.length === 0) return;
            let activeCrumb = breadcrumbItems[breadcrumbItems.length - 1];
            let startRect = activeCrumb.getBoundingClientRect();
            let containerRect = this.container.getBoundingClientRect();
            let startX = startRect.left - containerRect.left + startRect.width / 2;
            let startY = startRect.top - containerRect.top + startRect.height;
            let childrenCards = this.childrenRow.querySelectorAll(".node-card");
            childrenCards.forEach(card => {
                let cardRect = card.getBoundingClientRect();
                let endX = cardRect.left - containerRect.left + cardRect.width / 2;
                let endY = cardRect.top - containerRect.top;
                let controlY1 = startY + 40;
                let controlY2 = endY - 40;
                let pathString = `M ${startX} ${startY} C ${startX} ${controlY1}, ${endX} ${controlY2}, ${endX} ${endY}`;
                let path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("d", pathString);
                path.setAttribute("stroke", "#888");
                path.setAttribute("stroke-width", "2");
                path.setAttribute("fill", "none");
                this.svgOverlay.appendChild(path);
            });
        }
        
        /* ---------------- Programmatic API Methods ---------------- */
        loadTreeData(data, parent=null) {
            if (parent == null){
                this.treeData = data;
            }else{
                parent.children.push(data);
            }
            this.currentFocusPath = [this.treeData];
            this.render();
        }
        getTreeData() {
            return this.treeData;
        }
        toJson(parent=null, toString=false){
            const treeData = parent || this.treeData;
            function cloneWithoutParent(node) {
                const { id, content, name, body, metadata, image_url, media, type, config, children } = node;
                return {
                    id,
                    content,
                    name,
                    body,
                    metadata,
                    image_url,
                    media,
                    type,
                    config,
                    children: children.map(child => cloneWithoutParent(child))
                };
            }
            if (toString){
                return JSON.stringify(cloneWithoutParent(treeData));
            }else{
                return cloneWithoutParent(treeData);
            }
        }
        fromJson(jsonString, parent=null){
            const data = jsonString;
            // Recursively add parent pointers to each node.
            function addParentReferences(node, parent = null) {
                node.parent = parent;
                if (node.children && node.children.length) {
                    node.children.forEach(child => addParentReferences(child, node));
                }
            }
            addParentReferences(data, null);
            this.loadTreeData(data, parent);
            //this.render();
        }
        addNode(parentId, nodeData = {}) {
            let parentNode = this.findNodeById(this.treeData, parentId);
            if (!parentNode) return null;
            let newNode = this.createNode(nodeData.name || "New Node", parentNode);
            newNode.body = nodeData.body || "";
            newNode.metadata = nodeData.metadata || {};
            newNode.image_url = nodeData.image_url || null;
            newNode.type = nodeData.type || null;
            newNode.config = nodeData.config; //parentNode.config || this.config;
            parentNode.children.push(newNode);
            this.render();
            return newNode;
        }
        editNode(nodeId, newData = {}) {
            let node = this.findNodeById(this.treeData, nodeId);
            if (!node) return false;
            node.name = newData.name || node.name;
            node.body = (newData.body !== undefined) ? newData.body : node.body;
            node.metadata = newData.metadata || node.metadata;
            node.image_url = newData.image_url || node.image_url;
            node.media = newData.media || node.media;
            node.config = {...node.config, ...newData.config};
            node.type = newData.type || node.type;
            this.render();
            return true;
        }
        findNodeById(node, id) {
            if (node.id === id) return node;
            for (let child of node.children) {
                let found = this.findNodeById(child, id);
                if (found) return found;
            }
            return null;
        }
        _findPathToNode(node, id) {
            if (node.id === id) {
                return [node];
            }
            for (let child of node.children) {
                let result = this._findPathToNode(child, id);
                if (result) {
                    return [node, ...result];
                }
            }
            return null;
        }
        
        /**
        * Navigates the hierarchy so that the current focus path is updated to the path
        * from the root to the node with the specified id. If the node is found, the UI is
        * re-rendered.
        *
        * @param {string} id - The id of the node to navigate to.
        */
        navigateToNodeById(id, currentNode=null) {
            const path = this._findPathToNode(currentNode ? currentNode: this.treeData, id);
            if (path) {
                this.currentFocusPath = path;
                this.render();
            } else {
                console.error(`Node with id "${id}" not found.`);
            }
        }
        /**
         * Navigate left:
         * - If the current node has a previous sibling, focus that sibling.
         * - Otherwise, focus the parent.
         */
        navigateLeft() {
            if (this.currentFocusPath.length <= 1) return; // at root, nothing to do

            const current = this.currentFocusPath[this.currentFocusPath.length - 1];
            const parent = this.currentFocusPath[this.currentFocusPath.length - 2];
            const siblings = parent.children;
            const index = siblings.indexOf(current);

            if (index > 0) {
                // Focus the previous sibling.
                const newFocusPath = this.currentFocusPath.slice(0, -1);
                newFocusPath.push(siblings[index - 1]);
                this.currentFocusPath = newFocusPath;
            } else {
                // No previous sibling; move up to the parent.
                this.currentFocusPath.pop();
            }
            this.triggerHook('navigateLeft', current);
            this.render();
        }

        /**
         * Navigate right:
         * - If the current node has a next sibling, focus that sibling.
         * - Otherwise, do nothing.
         */
        navigateRight() {
            if (this.currentFocusPath.length <= 1) return; // at root, nothing to do

            const current = this.currentFocusPath[this.currentFocusPath.length - 1];
            const parent = this.currentFocusPath[this.currentFocusPath.length - 2];
            const siblings = parent.children;
            const index = siblings.indexOf(current);

            if (index < siblings.length - 1) {
                const newFocusPath = this.currentFocusPath.slice(0, -1);
                newFocusPath.push(siblings[index + 1]);
                this.currentFocusPath = newFocusPath;
                this.triggerHook('navigateRight', current);
                this.render();
            }
        }

        /**
         * Navigate down:
         * - If the current node has children, focus its first child.
         * - Otherwise, find the next node in a depth-first (DFS) order and focus it.
         */
        navigateDown() {
            const current = this.currentFocusPath[this.currentFocusPath.length - 1];
            if (current.children && current.children.length > 0) {
                // If there are children, navigate to the first child.
                this.currentFocusPath.push(current.children[0]);
                this.triggerHook('navigateDown', current);
                this.render();
            } else {
                // Otherwise, find the next node in DFS order.
                const next = this._getNextNode(current);
                if (next) {
                    // Update the focus path to the path leading from the root to the next node.
                    const newPath = this._findPathToNode(this.treeData, next.id);
                    if (newPath) {
                        this.currentFocusPath = newPath;
                        this.triggerHook('navigateDown', current);
                        this.render();
                    }
                }
            }
        }

        /**
         * Helper: Returns the next node in depth-first order after the given node.
         * Looks for a next sibling, or climbs the tree until a next sibling is found.
         * Returns null if none exists.
         *
         * @param {object} node - The current node.
         * @returns {object|null} - The next node in DFS order, or null.
         */
        _getNextNode(node) {
            if (node.parent) {
            const siblings = node.parent.children;
            const index = siblings.indexOf(node);
            if (index < siblings.length - 1) {
                // Next sibling exists.
                return siblings[index + 1];
            } else {
                // No next sibling, move up and try to find a parent's next sibling.
                let current = node.parent;
                while (current) {
                if (current.parent) {
                    const parentSiblings = current.parent.children;
                    const currentIndex = parentSiblings.indexOf(current);
                    if (currentIndex < parentSiblings.length - 1) {
                    return parentSiblings[currentIndex + 1];
                    }
                    current = current.parent;
                } else {
                    break;
                }
                }
            }
            }
            return null;
        }

        /**** Node creation and destruction ****/
        
        // Create a new node. (Each node now has a "type" and an "image_url" property.)
        createNode(content = "New Node", parent = null, type = null) {
            return {
                id: window.nav.getId(), //"node-" + (this.nodeIdCounter++),
                content: content,   // legacy text content
                name: content,      // display name (may be markdown formatted)
                body: "",           // rich content body (markdown supported)
                metadata: {},       // flat JSON object
                image_url: null,    // optional background image URL
                media: [],          // optional list of media objects
                type: type,         // node type identifier (if set)
                config: {},
                parent: parent,
                children: [],
            };
        }
        
        removeNodeFromTree(node, parentNode) {
            if (!parentNode) return;
            parentNode.children = parentNode.children.filter(child => child.id !== node.id);
        }

        /**** Node rewriting ****/
        
        // Body Rewrite queue and node link dereferencing
        queueRewrite(node, fromStr, toStr) {
            // Queues a rewrite operation on a given node's body.
            this.rewriteQueue.push({ node, fromStr, toStr });
            // Process the queue asynchronously to avoid race conditions.
            setTimeout(() => this.processRewriteQueue(), 0);
        }
        
        /**
        * Processes all queued rewrite operations.
        * Each queued item is applied by replacing fromStr with toStr
        * in the node.body string.
        */
        processRewriteQueue() {
            while (this.rewriteQueue.length > 0) {
                let { node, fromStr, toStr } = this.rewriteQueue.shift();
                if (!node.length) node = [node];
                for (let i = 0; i < node.length; i++){
                    let n = node[i];
                    if (n && typeof n.body === "string") {
                        //n.body = replaceAllCaseInsensitiveRegex(n.body, fromStr, toStr)
                        n.body = n.body.replaceAll(fromStr, toStr);
                    }
                }
            }
        }
        
        dereference(targetId) {
            // Create a regex to match links of the form [label](#targetId)
            const regex = new RegExp(`\\[([^\\]]+)\\]\\(#${targetId}\\)`, "g");
          
            // Recursively traverse the tree and update node.body if it exists.
            const traverse = (node) => {
              if (node.body && typeof node.body === "string") {
                node.body = node.body.replace(regex, "**$1**");
              }
              if (node.children && node.children.length > 0) {
                node.children.forEach(child => traverse(child));
              }
            };
          
            traverse(this.treeData);
            // Optionally re-render the UI.
            this.render();
          }
                  
    }
    
    // Initialize the editor when DOM is ready.
    document.addEventListener("DOMContentLoaded", () => {
        window.hierarchyEditor = new HierarchyEditor("treeHierarchy");
        window.hierarchyEditor.childrenRow.addEventListener('wheel', (event) => {
            window.hierarchyEditor.childrenRow.scrollBy(event.deltaY * 5, 0);
            event.preventDefault();
        });
        window.hierarchyEditor.breadcrumbRow.addEventListener('wheel', (event) => {
            window.hierarchyEditor.breadcrumbRow.scrollBy(event.deltaY * 5, 0);
            event.preventDefault();
        });
    });

    document.addEventListener("DOMContentLoaded", function() {
        const nodeEditor = document.getElementById("nodeEditor");
        let touchStartX = 0;
        let touchStartY = 0;
        let touchEndX = 0;
        let touchEndY = 0;
        let touchStartTime = 0;
        let touchEndTime = 0;
        const threshold = 30; // Minimum swipe distance (in pixels)
        const maxDuration = 300; // Maximum duration (in ms) for a fast swipe
            
        // Set up touch start listener
        nodeEditor.addEventListener("touchstart", function(e) {
          const touch = e.changedTouches[0];
          touchStartX = touch.screenX;
          touchStartY = touch.screenY;
          touchStartTime = Date.now();
        }, false);
      
        // Set up touch end listener
        nodeEditor.addEventListener("touchend", function(e) {
          const touch = e.changedTouches[0];
          touchEndX = touch.screenX;
          touchEndY = touch.screenY;
          touchEndTime = Date.now();
          handleGesture();
        }, false);
      
        // Determine swipe direction and call appropriate navigation function
        function handleGesture() {
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            const duration = touchEndTime - touchStartTime;
        
            // Only process fast swipes
            if (duration > maxDuration) {
                console.log("Swipe too slow, ignoring.");
                return;
            }
              // Determine the dominant swipe direction.
            if (Math.abs(deltaX) >= Math.abs(deltaY)) {
              // Horizontal swipe is dominant
              if (deltaX > threshold) {
                // Swipe right detected
                window.hierarchyEditor.navigateLeft();
              } else if (deltaX < -threshold) {
                // Swipe left detected
                window.hierarchyEditor.navigateRight();
              }
            } else {
              // Vertical swipe is dominant
              if (deltaY > threshold) {
                // Swipe down detected; trigger only if scrolled to the bottom
                const scrollPosition = window.innerHeight + window.scrollY;
                const totalHeight = document.documentElement.scrollHeight;
                if (scrollPosition >= totalHeight - threshold) {
                  window.hierarchyEditor.navigateDown();
                }
              } else if (deltaY < -threshold) {
                // Swipe up detected; call navigateUp if available
                const scrollPosition = window.innerHeight + window.scrollY;
                if (scrollPosition <= 0){
                    if (typeof window.hierarchyEditor.navigateUp === "function") {
                        window.hierarchyEditor.navigateUp();
                    }
                }
              }
            }
        }
    });
      

    window.HierarchyEditor = HierarchyEditor;
    window.Nav = Nav;
})();
