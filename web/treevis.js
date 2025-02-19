function nextEven(num) {
  const remainder = num % 2;
  if (remainder === 1) {
    return num + 1;
  } else {
    return num;
  }
}

class TreeVisualizer {
  /**
   * @param {HTMLCanvasElement} canvas - the canvas element to draw on.
   * @param {Object} treeData - the tree data object.
   * @param {Object} options - additional options to control appearance and behavior.
   */
  constructor(canvas, treeData, options = {}) {
    // Set up canvas and context.
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    // Save tree data.
    this.treeData = treeData;

    // Default options.
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
        labels: {
          fillStyle: "#777",
          font: "12px sans-serif",
        },
        drawLinkGraph: false,
        animateTime: 500,
        // Optionally supply an array of nodes that represent the current path.
        currentPath: [],
        // Minimum separation (in scene units) required between nodes.
        minSeparation: 5,
        // Generation limit for collision resolution.
        collisionGenerationLimit: 5,
        callbacks: {}
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

    // Use a WeakMap to store computed layout info per node.
    // This prevents us from modifying your original data.
    this.nodeInfo = new WeakMap();

    // Initially compute the layout positions (scene coordinates) for all nodes.
    this.computeLayout();

    // Initialize event listeners.
    this.initEvents();

    if (this.currentPath && this.currentPath.length > 0) {
      // Rearrange immediately if a current path is provided.
      this.rearrange(this.options.animateTime);
    } else {
      this.render();
    }
  }

  /*–––––––––––––––––––––––––––––––––––––––––––––––––––––––
    LAYOUT FUNCTIONS
  –––––––––––––––––––––––––––––––––––––––––––––––––––––––––*/

  /**
   * Recursively computes positions for each node in the tree.
   * Computed values (position and depth) are stored in the WeakMap.
   * @param {Object} node - current node.
   * @param {number} x - x coordinate in scene space.
   * @param {number} y - y coordinate in scene space.
   * @param {number} angle - branch angle (radians).
   * @param {number} length - branch length.
   * @param {number} depth - current depth (default 0).
   */
  layoutNode(node, x, y, angle, length, depth = 0) {
    let info = this.nodeInfo.get(node) || {};
    info.position = { x, y };
    info.depth = depth;
    this.nodeInfo.set(node, info);

    if (!node.children || node.children.length === 0) return;

    let count = node.children.length;
    // Use an even number for distribution if more than one child.
    const effectiveCount = count > 1 ? nextEven(count) : count;
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
      if (count === 1) {
        // Only one child: simply use the parent's angle.
        const childAngle = angle;
        const childX = x + length * Math.cos(childAngle);
        const childY = y - length * Math.sin(childAngle);
        this.layoutNode(
          node.children[0],
          childX,
          childY,
          childAngle,
          length * this.options.branchScale,
          depth + 1
        );
      } else {
        // Multiple children: force the main path child to be centered.
        const centerIndex = effectiveCount / 2;
        const centerAngle = Math.PI / 2; // fixed center angle for the main path child
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
        for (let i = 0; i < count; i++) {
          const childAngle =
            centerAngle - spread / 2 + (spread * effectiveIndices[i]) / (effectiveCount - 1);
          const childX = x + length * Math.cos(childAngle);
          const childY = y - length * Math.sin(childAngle);
          this.layoutNode(
            node.children[i],
            childX,
            childY,
            childAngle,
            length * this.options.branchScale,
            depth + 1
          );
        }
      }
    } else {
      // No child on the current path.
      if (count === 1) {
        const childAngle = angle;
        const childX = x + length * Math.cos(childAngle);
        const childY = y - length * Math.sin(childAngle);
        this.layoutNode(
          node.children[0],
          childX,
          childY,
          childAngle,
          length * this.options.branchScale,
          depth + 1
        );
      } else {
        for (let i = 0; i < count; i++) {
          const childAngle = angle - spread / 2 + (spread * i) / (effectiveCount - 1);
          const childX = x + length * Math.cos(childAngle);
          const childY = y - length * Math.sin(childAngle);
          this.layoutNode(
            node.children[i],
            childX,
            childY,
            childAngle,
            length * this.options.branchScale,
            depth + 1
          );
        }
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
   * Recursively computes the target positions for each node and stores them in the WeakMap.
   * @param {Object} node - current node.
   * @param {number} x - target x coordinate.
   * @param {number} y - target y coordinate.
   * @param {number} angle - branch angle.
   * @param {number} length - branch length.
   */
  computeTargetLayout(node, x, y, angle, length) {
    let info = this.nodeInfo.get(node) || {};
    info.targetPosition = { x, y };
    this.nodeInfo.set(node, info);

    if (!node.children || node.children.length === 0) return;

    let count = node.children.length;
    const effectiveCount = count > 1 ? nextEven(count) : count;
    const spread = this.options.spreadAngle;

    if (count === 1) {
      const childAngle = angle;
      const childX = x + length * Math.cos(childAngle);
      const childY = y - length * Math.sin(childAngle);
      this.computeTargetLayout(
        node.children[0],
        childX,
        childY,
        childAngle,
        length * this.options.branchScale
      );
    } else {
      node.children.forEach((child, i) => {
        let childAngle = angle;
        if (this.currentPath.includes(child)) {
          childAngle = Math.PI / 2;
        } else {
          childAngle = angle - spread / 2 + (spread * i) / (effectiveCount - 1);
        }
        const childX = x + length * Math.cos(childAngle);
        const childY = y - length * Math.sin(childAngle);
        this.computeTargetLayout(child, childX, childY, childAngle, length * this.options.branchScale);
      });
    }
  }

  /**
   * Iteratively adjusts nodes’ target positions so that no two nodes are closer than minSeparation.
   * Only nodes within a specified generation difference are adjusted.
   * @param {Array} nodes - array of all nodes.
   * @param {number} minSeparation - minimum required separation (scene units).
   * @param {number} iterations - number of iterations for relaxation.
   */
  resolveCollisions(nodes, minSeparation, iterations = 10) {
    const generationLimit = this.options.collisionGenerationLimit || 5;
    for (let iter = 0; iter < iterations; iter++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          let nodeA = nodes[i],
              nodeB = nodes[j];
          let infoA = this.nodeInfo.get(nodeA) || {};
          let infoB = this.nodeInfo.get(nodeB) || {};
          const depthA = infoA.depth;
          const depthB = infoB.depth;
          if (Math.abs(depthA - depthB) > generationLimit) continue;
          let dx = infoB.targetPosition.x - infoA.targetPosition.x;
          let dy = infoB.targetPosition.y - infoA.targetPosition.y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minSeparation && dist > 0) {
            let overlap = minSeparation - dist;
            if (this.currentPath.includes(nodeA) && this.currentPath.includes(nodeB)) {
              continue;
            } else if (this.currentPath.includes(nodeA)) {
              let offsetX = (dx / dist) * overlap;
              let offsetY = (dy / dist) * overlap;
              infoB.targetPosition.x += offsetX;
              infoB.targetPosition.y += offsetY;
              this.nodeInfo.set(nodeB, infoB);
            } else if (this.currentPath.includes(nodeB)) {
              let offsetX = (dx / dist) * overlap;
              let offsetY = (dy / dist) * overlap;
              infoA.targetPosition.x -= offsetX;
              infoA.targetPosition.y -= offsetY;
              this.nodeInfo.set(nodeA, infoA);
            } else {
              let offsetX = (dx / dist) * (overlap / 2);
              let offsetY = (dy / dist) * (overlap / 2);
              infoA.targetPosition.x -= offsetX;
              infoA.targetPosition.y -= offsetY;
              infoB.targetPosition.x += offsetX;
              infoB.targetPosition.y += offsetY;
              this.nodeInfo.set(nodeA, infoA);
              this.nodeInfo.set(nodeB, infoB);
            }
          }
        }
      }
    }
  }

  /**
   * Initiates an animated rearrangement of the tree.
   * Computes new target positions (with collision resolution) and then interpolates the current positions toward them.
   * @param {number} duration - animation duration in milliseconds.
   */
  rearrange(duration = 2000) {
    // Save current positions as start positions.
    this.traverseNodes(this.treeData, (node) => {
      let info = this.nodeInfo.get(node) || {};
      info.startPosition = info.position ? { ...info.position } : { x: 0, y: 0 };
      this.nodeInfo.set(node, info);
    });
    // Compute new target positions.
    this.computeTargetLayout(this.treeData, 0, 0, Math.PI / 2, this.options.branchLength);
    // Gather all nodes.
    const allNodes = [];
    this.traverseNodes(this.treeData, (node) => {
      allNodes.push(node);
    });
    // Resolve collisions.
    this.resolveCollisions(allNodes, this.options.minSeparation, 10);

    // Set up animation.
    this.animating = true;
    this.animationStartTime = null;
    this.animationDuration = duration;
    requestAnimationFrame(this.animateStep.bind(this));
  }

  /**
   * Recursively traverses the tree and applies a callback to each node.
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
    this.traverseNodes(this.treeData, (node) => {
      let info = this.nodeInfo.get(node) || {};
      if (!info.startPosition || !info.targetPosition) return;
      info.position = {
        x: info.startPosition.x + (info.targetPosition.x - info.startPosition.x) * t,
        y: info.startPosition.y + (info.targetPosition.y - info.startPosition.y) * t
      };
      this.nodeInfo.set(node, info);
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
   * It clears the canvas and then draws hierarchical links, nodes, and labels in screen space.
   */
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // --- Draw hierarchical links in screen space ---
    this.drawTreeLinksScreen(this.treeData);
    // Optionally, draw additional links:
    if (this.options.drawLinkGraph)
      this.drawAdditionalLinksScreen(this.treeData);

    // --- Draw nodes in screen space ---
    this.drawNodes(this.treeData);

    // --- Draw labels for nodes on the current path and linked nodes ---
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

    // *** Redraw currentPath nodes on top ***
    if (this.currentPath && this.currentPath.length > 0) {
      this.currentPath.forEach((node) => {
        this.drawNode(node);
      });
    }
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
        let infoA = this.nodeInfo.get(node);
        let infoB = this.nodeInfo.get(child);
        if (!infoA || !infoA.position || !infoB || !infoB.position) return;
        const posA = this.sceneToScreen(infoA.position.x, infoA.position.y);
        const posB = this.sceneToScreen(infoB.position.x, infoB.position.y);
        this.drawLinkScreen(posA, posB, lineColor);
        this.drawTreeLinksScreen(child);
      });
    }
  }

  /**
   * Recursively draws additional (non-hierarchical) links in screen space.
   * @param {Object} node - current node.
   */
  drawAdditionalLinksScreen(node) {
    if (node.links && Array.isArray(node.links)) {
      node.links.forEach((targetNode) => {
        let infoA = this.nodeInfo.get(node);
        let infoB = this.nodeInfo.get(targetNode);
        if (!infoA || !infoA.position || !infoB || !infoB.position) return;
        const posA = this.sceneToScreen(infoA.position.x, infoA.position.y);
        const posB = this.sceneToScreen(infoB.position.x, infoB.position.y);
        this.drawLinkScreen(posA, posB, this.options.linkColor);
      });
    }
    if (node.children) {
      node.children.forEach((child) => this.drawAdditionalLinksScreen(child));
    }
  }

  /**
   * Draws a line between two points in screen space with a constant line width.
   * @param {Object} posA - {x, y} start point (screen coordinates).
   * @param {Object} posB - {x, y} end point (screen coordinates).
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
   * Recursively draws nodes in screen space so that their sizes remain constant.
   * @param {Object} node - current node.
   */
  drawNodes(node) {
    this.drawNode(node);
    if (node.children) {
      node.children.forEach((child) => this.drawNodes(child));
    }
  }

  /**
   * Draws a single node (as a circle) in screen space.
   * @param {Object} node - node to draw.
   */
  drawNode(node) {
    let info = this.nodeInfo.get(node);
    if (!info || !info.position) return;
    const pos = this.sceneToScreen(info.position.x, info.position.y);
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
   * @param {Object|Object[]} nodes - the node(s) to label.
   */
  showLabels(nodes) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = this.options.labels.fillStyle;
    ctx.font = this.options.labels.font; // constant font size
    if (!Array.isArray(nodes)) nodes = [nodes];
    nodes.forEach((node) => {
      let info = this.nodeInfo.get(node);
      if (!info || !info.position) return;
      const pos = this.sceneToScreen(info.position.x, info.position.y);
      ctx.fillText(
        node.name,
        pos.x + this.options.nodeRadius + 2,
        pos.y - this.options.nodeRadius - 2
      );
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
   * Returns the first node whose scene position (from nodeInfo) contains the given point.
   * @param {number} x - x coordinate in scene space.
   * @param {number} y - y coordinate in scene space.
   * @param {Object} node - node to test.
   * @returns {Object|null} - the node if hit, or null.
   */
  findNodeAtPoint(x, y, node) {
    let info = this.nodeInfo.get(node);
    if (!info || !info.position) return null;
    const hitRadius = this.options.nodeRadius + 3; // tolerance
    const dx = x - info.position.x;
    const dy = y - info.position.y;
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
    const canvas = this.canvas;
    let isDragging = false;
    let lastX = 0, lastY = 0;
    let wasDragging = false; // For desktop: to suppress click if dragging occurred
  
    // --- Desktop Mouse Events ---
    canvas.addEventListener("mousedown", (e) => {
      isDragging = true;
      wasDragging = false;
      lastX = e.clientX;
      lastY = e.clientY;
    });
  
    window.addEventListener("mousemove", (e) => {
      if (isDragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        // If movement is more than a threshold, mark as dragging.
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          wasDragging = true;
        }
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
  
    canvas.addEventListener("click", (e) => {
      if (wasDragging) {
        wasDragging = false;
        return; // Don't treat this as a click on a node.
      }
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const scenePoint = this.screenToScene(mouseX, mouseY);
      const clickedNode = this.findNodeAtPoint(scenePoint.x, scenePoint.y, this.treeData);
      if (clickedNode) {
        const newPath = this.findPath(this.treeData, clickedNode);
        if (newPath) {
          this.currentPath = newPath;
          this.rearrange(this.options.animateTime);
          // Optionally recenter on the clicked node if implemented.
          if (typeof this.recenterOnNode === "function") {
            this.recenterOnNode(clickedNode);
          }
        }
        if (this.options.callbacks.hasOwnProperty("click")) {
          const cfunc = this.options.callbacks.click;
          setTimeout(() => {
            cfunc(clickedNode);
          }, 0);
        }
      }
    });
  
    // Mouse wheel for zooming (centered on mouse pointer).
    canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        const scaleFactor = 1.05;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const sceneBefore = this.screenToScene(mouseX, mouseY);
        if (e.deltaY < 0) {
          this.transform.scale *= scaleFactor;
        } else {
          this.transform.scale /= scaleFactor;
        }
        const posAfter = this.sceneToScreen(sceneBefore.x, sceneBefore.y);
        const dx = mouseX - posAfter.x;
        const dy = mouseY - posAfter.y;
        this.transform.offsetX += dx;
        this.transform.offsetY += dy;
        this.render();
    });

    // --- Mobile Touch Events ---
    let isTouchPanning = false;
    let isPinching = false;
    let lastTouchX = 0, lastTouchY = 0;
    let initialPinchDistance = 0;
    let initialPinchCenter = { x: 0, y: 0 };
    let initialScale = this.transform.scale;
  
    canvas.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        // Start panning with one finger.
        isTouchPanning = true;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        // Start pinch-zoom.
        isPinching = true;
        isTouchPanning = false;
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        initialPinchDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        initialPinchCenter = {
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2
        };
        initialScale = this.transform.scale;
      }
    });
  
    canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      if (isTouchPanning && e.touches.length === 1) {
        const touch = e.touches[0];
        const dx = touch.clientX - lastTouchX;
        const dy = touch.clientY - lastTouchY;
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
        this.transform.offsetX += dx;
        this.transform.offsetY += dy;
        this.render();
      } else if (isPinching && e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        const pinchCenter = {
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2
        };
        const scaleChange = currentDistance / initialPinchDistance;
        this.transform.scale = initialScale * scaleChange;
        // Adjust offset so that the pinch center remains at the same screen position.
        const sceneBefore = this.screenToScene(pinchCenter.x, pinchCenter.y);
        const posAfter = this.sceneToScreen(sceneBefore.x, sceneBefore.y);
        const dx = pinchCenter.x - posAfter.x;
        const dy = pinchCenter.y - posAfter.y;
        this.transform.offsetX += dx;
        this.transform.offsetY += dy;
        this.render();
      }
    });
  
    canvas.addEventListener("touchend", (e) => {
      if (e.touches.length === 0) {
        isTouchPanning = false;
        isPinching = false;
      } else if (e.touches.length === 1) {
        // If a pinch ends but one finger remains, restart panning.
        isPinching = false;
        isTouchPanning = true;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
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
