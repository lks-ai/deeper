class TreeVisualizer {
    /**
     * @param {HTMLCanvasElement} canvas - the canvas element to draw on.
     * @param {Object} treeData - the tree data object (with name, type, children, etc.).
     * @param {Object} options - additional options to control appearance and behavior.
     */
    constructor(canvas, treeData, options = {}) {
      // Set up canvas and context.
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
  
      // Save tree data.
      this.treeData = treeData;
  
      // Default options – you can override these when calling the constructor.
      this.options = Object.assign(
        {
          branchLength: 100,       // initial branch length (in scene units)
          branchScale: 0.7,        // each branch is 70% as long as its parent
          spreadAngle: Math.PI / 3, // angular spread for children (radians)
          nodeRadius: 8,           // node radius in screen (pixel) units (constant size)
          defaultColor: "#444",    // default color for hierarchical links
          highlightColor: "red",   // color for nodes in the current path
          pathColor: "blue",       // color for hierarchical links along the current path
          linkColor: "#aaa",       // color for additional (non-hierarchical) links
          typeColors: {
            default: "#444",
            special: "#2a9d8f",
            important: "#e76f51"
          },
          // Optionally supply an array of nodes that represent a “current path”
          currentPath: [],
          // Minimum separation (in scene units) required between nodes.
          minSeparation: 5
        },
        options
      );
  
      // Keep a reference to the current (highlighted) path.
      this.currentPath = this.options.currentPath;
  
      // Transformation parameters for panning/rotation/zoom.
      this.transform = {
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        rotation: 0
      };
  
      // For animated rearrangement.
      this.animating = false;
      this.animationStartTime = null;
      this.animationDuration = 0; // in milliseconds
  
      // Initially compute the layout positions (scene coordinates) for all nodes.
      this.computeLayout();
  
      // Initialize event listeners.
      this.initEvents();
  
      // Initial render.
      this.render();
    }
  
    /*–––––––––––––––––––––––––––––––––––––––––––––––––––––––
      LAYOUT FUNCTIONS
    –––––––––––––––––––––––––––––––––––––––––––––––––––––––––*/
  
    /**
     * Recursively computes positions for each node in the tree.
     * The root is positioned at (0,0) (scene coordinates) and its branch grows upward.
     * Writes each node’s position into node._position.
     * @param {Object} node - current node.
     * @param {number} x - x coordinate in scene space.
     * @param {number} y - y coordinate in scene space.
     * @param {number} angle - branch angle (radians).
     * @param {number} length - branch length.
     */
    layoutNode(node, x, y, angle, length, depth = 0) {
        // Set current position and record the generation depth.
        node._position = { x, y };
        node._depth = depth;
        
        if (!node.children || node.children.length === 0) return;
        
        const count = node.children.length;
        const spread = this.options.spreadAngle;
        
        // Look for a child that is on the current path.
        let mainPathIndex = -1;
        for (let i = 0; i < count; i++) {
          if (this.currentPath.includes(node.children[i])) {
            mainPathIndex = i;
            break;
          }
        }
        
        if (mainPathIndex !== -1) {
          // A child is selected. Force that child to be centered.
          const centerIndex = Math.floor(count / 2);
          const centerAngle = Math.PI / 2; // fixed center angle for the main path child
      
          // Build an array of "effective indices" so that the selected child gets the center slot.
          const effectiveIndices = [];
          let currentIndex = 0;
          for (let i = 0; i < count; i++) {
            if (i === mainPathIndex) {
              effectiveIndices.push(centerIndex);
            } else {
              if (i < mainPathIndex) {
                effectiveIndices.push(currentIndex);
                currentIndex++;
              } else {
                effectiveIndices.push(currentIndex + 1);
                currentIndex++;
              }
            }
          }
          
          // Now assign each child's angle based on its effective index.
          for (let i = 0; i < count; i++) {
            const childAngle = centerAngle - spread / 2 + (spread * effectiveIndices[i]) / (count - 1);
            const childX = x + length * Math.cos(childAngle);
            const childY = y - length * Math.sin(childAngle);
            this.layoutNode(node.children[i], childX, childY, childAngle, length * this.options.branchScale, depth + 1);
          }
        } else {
          // No child is on the current path; use the default even distribution.
          for (let i = 0; i < count; i++) {
            const childAngle = angle - spread / 2 + (spread * i) / (count - 1);
            const childX = x + length * Math.cos(childAngle);
            const childY = y - length * Math.sin(childAngle);
            this.layoutNode(node.children[i], childX, childY, childAngle, length * this.options.branchScale, depth + 1);
          }
        }
      }
                          
    /**
     * Computes the layout for the entire tree.
     */
    computeLayout() {
      this.layoutNode(this.treeData, 0, 0, Math.PI / 2, this.options.branchLength, 0);
    }
  
    /**
     * Recursively computes the target positions for each node (without affecting _position)
     * and stores them in node._targetPosition.
     * This uses the same algorithm as layoutNode.
     * @param {Object} node - current node.
     * @param {number} x - target x coordinate.
     * @param {number} y - target y coordinate.
     * @param {number} angle - branch angle.
     * @param {number} length - branch length.
     */
    computeTargetLayout(node, x, y, angle, length) {
      node._targetPosition = { x, y };
      if (!node.children || node.children.length === 0) return;
  
      const count = node.children.length;
      const spread = this.options.spreadAngle;
      node.children.forEach((child, i) => {
        let childAngle = angle;
        if (this.currentPath.includes(child)) {
          childAngle = Math.PI / 2;
        } else if (count > 1) {
          childAngle = angle - spread / 2 + (spread * i) / (count - 1);
        }
        const childX = x + length * Math.cos(childAngle);
        const childY = y - length * Math.sin(childAngle);
        this.computeTargetLayout(child, childX, childY, childAngle, length * this.options.branchScale);
      });
    }
  
    /**
     * Iteratively adjusts nodes’ target positions so that no two nodes are closer than minSeparation.
     * @param {Array} nodes - array of all nodes.
     * @param {number} minSeparation - minimum required separation (scene units).
     * @param {number} iterations - number of iterations for relaxation.
     */
resolveCollisions(nodes, minSeparation, iterations = 10) {
    // Use a generation limit (default 2 generations) to limit collision resolution scope.
    const generationLimit = this.options.collisionGenerationLimit || 5;
    for (let iter = 0; iter < iterations; iter++) {
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                let nodeA = nodes[i],
                nodeB = nodes[j];
                // Only resolve collisions for nodes within the generation limit.
                if (Math.abs(nodeA._depth - nodeB._depth) > generationLimit) continue;
                
                let dx = nodeB._targetPosition.x - nodeA._targetPosition.x;
                let dy = nodeB._targetPosition.y - nodeA._targetPosition.y;
                let dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < minSeparation && dist > 0) {
                    let overlap = minSeparation - dist;
                    // If both nodes are on the main path, do nothing.
                    if (this.currentPath.includes(nodeA) && this.currentPath.includes(nodeB)) {
                        continue;
                    } else if (this.currentPath.includes(nodeA)) {
                        // Only adjust nodeB (move it away from the fixed main path node).
                        let offsetX = (dx / dist) * overlap;
                        let offsetY = (dy / dist) * overlap;
                        nodeB._targetPosition.x += offsetX;
                        nodeB._targetPosition.y += offsetY;
                    } else if (this.currentPath.includes(nodeB)) {
                        // Only adjust nodeA.
                        let offsetX = (dx / dist) * overlap;
                        let offsetY = (dy / dist) * overlap;
                        nodeA._targetPosition.x -= offsetX;
                        nodeA._targetPosition.y -= offsetY;
                    } else {
                        // Neither node is on the main path; adjust both equally.
                        let offsetX = (dx / dist) * (overlap / 2);
                        let offsetY = (dy / dist) * (overlap / 2);
                        nodeA._targetPosition.x -= offsetX;
                        nodeA._targetPosition.y -= offsetY;
                        nodeB._targetPosition.x += offsetX;
                        nodeB._targetPosition.y += offsetY;
                    }
                }
            }
        }
    }
}

    /**
     * Initiates an animated rearrangement of the tree.
     * All nodes get new target positions (via computeTargetLayout and collision resolution)
     * and their _position values are interpolated toward these targets over the specified duration.
     * @param {number} duration - animation duration in milliseconds.
     */
    rearrange(duration = 2000) {
      // Save current positions.
      this.traverseNodes(this.treeData, (node) => {
        node._startPosition = { x: node._position.x, y: node._position.y };
      });
      // Compute new target positions.
      this.computeTargetLayout(this.treeData, 0, 0, Math.PI / 2, this.options.branchLength);
      // Resolve collisions globally.
      const allNodes = [];
      this.traverseNodes(this.treeData, (node) => {
        allNodes.push(node);
      });
      this.resolveCollisions(allNodes, this.options.minSeparation, 10);
  
      // Set animation parameters.
      this.animating = true;
      this.animationStartTime = null;
      this.animationDuration = duration;
      requestAnimationFrame(this.animateStep.bind(this));
    }
  
    /**
     * Recursively traverses the tree and applies callback to each node.
     * @param {Object} node - current node.
     * @param {Function} callback - function to call for each node.
     */
    traverseNodes(node, callback) {
      callback(node);
      if (node.children) {
        node.children.forEach((child) => this.traverseNodes(child, callback));
      }
    }
  
    /**
     * Called on each animation frame to update node positions.
     * @param {DOMHighResTimeStamp} timestamp
     */
    animateStep(timestamp) {
      if (!this.animationStartTime) this.animationStartTime = timestamp;
      let elapsed = timestamp - this.animationStartTime;
      let t = elapsed / this.animationDuration;
      if (t > 1) t = 1;
      // Linear interpolation for each node.
      this.traverseNodes(this.treeData, (node) => {
        if (!node._startPosition || !node._targetPosition) return;
        node._position.x =
          node._startPosition.x + (node._targetPosition.x - node._startPosition.x) * t;
        node._position.y =
          node._startPosition.y + (node._targetPosition.y - node._startPosition.y) * t;
      });
      this.render();
      if (t < 1) {
        requestAnimationFrame(this.animateStep.bind(this));
      } else {
        this.animating = false;
      }
    }
  
    /*–––––––––––––––––––––––––––––––––––––––––––––––––––––––
      RENDERING FUNCTIONS
    –––––––––––––––––––––––––––––––––––––––––––––––––––––––––*/
  
    /**
     * Main render routine.
     * It draws links, nodes, and labels in screen space so that their sizes remain constant.
     */
    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  
      // --- Draw Links in screen space ---
      this.drawTreeLinksScreen(this.treeData);
      //this.drawAdditionalLinksScreen(this.treeData);
  
      // --- Draw Nodes in screen space ---
      this.drawNodes(this.treeData);
  
      // --- Draw Labels for current path and nodes linked from its last node ---
      let labelNodes = [];
      if (this.currentPath && this.currentPath.length > 0) {
        labelNodes = labelNodes.concat(this.currentPath);
        const lastNode = this.currentPath[this.currentPath.length - 1];
        if (lastNode.links && Array.isArray(lastNode.links)) {
          lastNode.links.forEach((linkedNode) => {
            if (!labelNodes.includes(linkedNode)) {
              labelNodes.push(linkedNode);
            }
          });
        }
      }
      this.showLabels(labelNodes);
    }
  
    /**
     * Recursively draws hierarchical links in screen space.
     * @param {Object} node - current node.
     */
    drawTreeLinksScreen(node) {
      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => {
          const isOnPath = this.currentPath.includes(node) && this.currentPath.includes(child);
          const lineColor = isOnPath ? this.options.pathColor : this.options.defaultColor;
          const posA = this.sceneToScreen(node._position.x, node._position.y);
          const posB = this.sceneToScreen(child._position.x, child._position.y);
          this.drawLinkScreen(posA, posB, lineColor);
          this.drawTreeLinksScreen(child);
        });
      }
    }
  
    /**
     * Recursively draws additional links (non-hierarchical) in screen space.
     * @param {Object} node - current node.
     */
    drawAdditionalLinksScreen(node) {
      if (node.links && Array.isArray(node.links)) {
        node.links.forEach((targetNode) => {
          if (targetNode._position) {
            const posA = this.sceneToScreen(node._position.x, node._position.y);
            const posB = this.sceneToScreen(targetNode._position.x, targetNode._position.y);
            this.drawLinkScreen(posA, posB, this.options.linkColor);
          }
        });
      }
      if (node.children) {
        node.children.forEach((child) => this.drawAdditionalLinksScreen(child));
      }
    }
  
    /**
     * Draws a line between two screen-space points with constant line width.
     * @param {Object} posA - {x, y} start point (in screen coordinates).
     * @param {Object} posB - {x, y} end point (in screen coordinates).
     * @param {string} color - stroke color.
     */
    drawLinkScreen(posA, posB, color) {
      const ctx = this.ctx;
      ctx.save();
      ctx.lineWidth = 2; // constant thickness in pixels
      ctx.beginPath();
      ctx.moveTo(posA.x, posA.y);
      ctx.lineTo(posB.x, posB.y);
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.restore();
    }
  
    /**
     * Recursively draws nodes (in screen space) so that their sizes remain constant.
     * @param {Object} node - current node.
     */
    drawNodes(node) {
      this.drawNode(node);
      if (node.children) {
        node.children.forEach((child) => this.drawNodes(child));
      }
    }
  
    /**
     * Draws a single node as a circle (in screen space).
     * @param {Object} node - node to draw.
     */
    drawNode(node) {
      const pos = this.sceneToScreen(node._position.x, node._position.y);
      const ctx = this.ctx;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, this.options.nodeRadius, 0, 2 * Math.PI);
      const fillColor =
        this.options.typeColors[node.type] ||
        this.options.typeColors.default ||
        this.options.defaultColor;
      ctx.fillStyle = this.currentPath.includes(node)
        ? this.options.highlightColor
        : fillColor;
      ctx.fill();
    }
  
    /**
     * Draws labels for the given node or array of nodes in screen space.
     * @param {Object|Object[]} nodes - the node or nodes to label.
     */
    showLabels(nodes) {
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = "black";
      ctx.font = "12px sans-serif"; // constant font size
      if (!Array.isArray(nodes)) nodes = [nodes];
      nodes.forEach((node) => {
        if (node._position) {
          const pos = this.sceneToScreen(node._position.x, node._position.y);
          ctx.fillText(
            node.name,
            pos.x + this.options.nodeRadius + 2,
            pos.y - this.options.nodeRadius - 2
          );
        }
      });
      ctx.restore();
    }
  
    /**
     * Converts scene coordinates to screen coordinates.
     * @param {number} x - x coordinate in scene space.
     * @param {number} y - y coordinate in scene space.
     * @returns {Object} - {x, y} in screen coordinates.
     */
    sceneToScreen(x, y) {
      const cosR = Math.cos(this.transform.rotation);
      const sinR = Math.sin(this.transform.rotation);
      const sx =
        this.canvas.width / 2 +
        this.transform.offsetX +
        this.transform.scale * (x * cosR - y * sinR);
      const sy =
        this.canvas.height / 2 +
        this.transform.offsetY +
        this.transform.scale * (x * sinR + y * cosR);
      return { x: sx, y: sy };
    }
  
    /*–––––––––––––––––––––––––––––––––––––––––––––––––––––––
      INTERACTION FUNCTIONS
    –––––––––––––––––––––––––––––––––––––––––––––––––––––––––*/
  
    /**
     * Finds the path from the root node to the target node.
     * Returns an array [root, ..., target] if found, or null.
     * @param {Object} root - starting node.
     * @param {Object} target - node to find.
     * @returns {Object[]|null}
     */
    findPath(root, target) {
      if (root === target) return [root];
      if (root.children) {
        for (let child of root.children) {
          const subPath = this.findPath(child, target);
          if (subPath) return [root].concat(subPath);
        }
      }
      return null;
    }
  
    /**
     * Returns the first node whose scene position (node._position) contains the given point.
     * @param {number} x - x coordinate in scene space.
     * @param {number} y - y coordinate in scene space.
     * @param {Object} node - node to test.
     * @returns {Object|null} - the node if hit, or null.
     */
    findNodeAtPoint(x, y, node) {
      const hitRadius = this.options.nodeRadius + 3; // tolerance
      const dx = x - node._position.x;
      const dy = y - node._position.y;
      if (Math.sqrt(dx * dx + dy * dy) <= hitRadius) {
        return node;
      }
      if (node.children) {
        for (let child of node.children) {
          const found = this.findNodeAtPoint(x, y, child);
          if (found) return found;
        }
      }
      return null;
    }
  
    /**
     * Sets up event listeners for user interactions:
     * - Mouse drag to pan.
     * - Mouse wheel to zoom (centered on the mouse pointer).
     * - Arrow keys to rotate.
     * - Click/touch to change the current path (and trigger a rearrangement).
     */
    initEvents() {
      let isDragging = false;
      let lastX = 0,
        lastY = 0;
      const canvas = this.canvas;
  
      // Mouse drag for panning.
      canvas.addEventListener("mousedown", (e) => {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
      });
      window.addEventListener("mousemove", (e) => {
        if (isDragging) {
          const dx = e.clientX - lastX;
          const dy = e.clientY - lastY;
          lastX = e.clientX;
          lastY = e.clientY;
          this.transform.offsetX += dx;
          this.transform.offsetY += dy;
          this.render();
        }
      });
      window.addEventListener("mouseup", () => {
        isDragging = false;
      });
  
      // Mouse wheel for zooming (centered on mouse pointer).
      canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        const scaleFactor = 1.05;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        // Compute the scene point under the mouse (with current transform).
        const sceneBefore = this.screenToScene(mouseX, mouseY);
        let oldScale = this.transform.scale;
        if (e.deltaY < 0) {
          this.transform.scale *= scaleFactor;
        } else {
          this.transform.scale /= scaleFactor;
        }
        let newScale = this.transform.scale;
        // After scaling, adjust offset so that sceneBefore still maps to the same mouse position.
        const posAfter = this.sceneToScreen(sceneBefore.x, sceneBefore.y);
        const dx = mouseX - posAfter.x;
        const dy = mouseY - posAfter.y;
        this.transform.offsetX += dx;
        this.transform.offsetY += dy;
        this.render();
      });
  
      // Arrow keys for rotation.
      window.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft") {
          this.transform.rotation -= 0.1;
          this.render();
        } else if (e.key === "ArrowRight") {
          this.transform.rotation += 0.1;
          this.render();
        }
      });
  
      // Click (or touch) to select a node and change the current path.
      canvas.addEventListener("click", (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const scenePoint = this.screenToScene(mouseX, mouseY);
        const clickedNode = this.findNodeAtPoint(scenePoint.x, scenePoint.y, this.treeData);
        if (clickedNode) {
          const newPath = this.findPath(this.treeData, clickedNode);
          if (newPath) {
            this.currentPath = newPath;
            // Trigger animated rearrangement.
            this.rearrange(2000);
          }
        }
      });
  
      // Touch support.
      canvas.addEventListener("touchstart", (e) => {
        if (e.touches.length === 1) {
          const touch = e.touches[0];
          const rect = canvas.getBoundingClientRect();
          const touchX = touch.clientX - rect.left;
          const touchY = touch.clientY - rect.top;
          const scenePoint = this.screenToScene(touchX, touchY);
          const touchedNode = this.findNodeAtPoint(scenePoint.x, scenePoint.y, this.treeData);
          if (touchedNode) {
            const newPath = this.findPath(this.treeData, touchedNode);
            if (newPath) {
              this.currentPath = newPath;
              this.rearrange(500);
            }
          }
        }
      });
    }
  
    /**
     * Converts screen (canvas) coordinates to scene coordinates.
     * @param {number} x - x coordinate on canvas.
     * @param {number} y - y coordinate on canvas.
     * @returns {Object} - {x, y} in scene space.
     */
    screenToScene(x, y) {
      let sx = x - this.canvas.width / 2;
      let sy = y - this.canvas.height / 2;
      sx -= this.transform.offsetX;
      sy -= this.transform.offsetY;
      const cosR = Math.cos(this.transform.rotation);
      const sinR = Math.sin(this.transform.rotation);
      const rx = cosR * sx + sinR * sy;
      const ry = -sinR * sx + cosR * sy;
      return { x: rx / this.transform.scale, y: ry / this.transform.scale };
    }
  }
  