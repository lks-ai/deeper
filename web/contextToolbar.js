// Wrap everything in an IIFE to avoid polluting the global scope
document.addEventListener("DOMContentLoaded", () => {

    // Hold a reference to the current toolbar (if any)
    let toolbarElement = null;
    let justShown = false;
  
    /**
     * Creates and displays a toolbar overlay at the given (x, y) position.
     * @param {number} x - The x coordinate (in pixels) for the toolbar.
     * @param {number} y - The y coordinate (in pixels) for the toolbar.
     * @param {Array} buttons - An array of button definitions, each being an object
     *                          with a "label" and a "callback" function.
     */
    function showToolbarOverlay(x, y, buttons, text) {
      // Remove any existing toolbar
      if (toolbarElement) {
        toolbarElement.remove();
        toolbarElement = null;
      }
  
      // Create the toolbar container
      toolbarElement = document.createElement('div');
      // Basic styling – you can also add a CSS class instead.
      Object.assign(toolbarElement.style, {
        position: 'absolute',
        top: y + 'px',
        left: x + 'px',
        backgroundColor: 'rgba(128,128,128,0.5)',
        border: '1px solid #ccc',
        padding: '5px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
        zIndex: 1000,
        borderRadius: '4px'
      });
  
      // Create each button and add to the toolbar
      buttons.forEach(btn => {
        const button = document.createElement('button');
        button.innerText = btn.label;
        // Optional: Style the button (or use a CSS class)
        button.style.marginRight = '5px';
        button.style.cursor = 'pointer';
        // When clicking a button, prevent the click from bubbling up (which might hide the toolbar)
        button.addEventListener('click', function(e) {
          e.stopPropagation();
          btn.callback(text);
          toolbarElement.remove();
          toolbarElement = null;
        });
        toolbarElement.appendChild(button);
      });
  
      // Append the toolbar to the document body
      document.body.appendChild(toolbarElement);
  
      // Close the toolbar when clicking anywhere else in the document.
      justShown = true;
      setTimeout(function(){
        document.addEventListener('click', hideToolbarOnClickOutside);
      }, 30);
    }
  
    /**
     * Hides the toolbar if a click occurs outside of it.
     */
    function hideToolbarOnClickOutside(event) {
      if (justShown){
        justShown = false;
        return;
      }
      if (toolbarElement && !toolbarElement.contains(event.target)) {
        toolbarElement.remove();
        toolbarElement = null;
        document.removeEventListener('click', hideToolbarOnClickOutside);
      }
    }
  
    /**
     * Handles the end of a text selection event.
     * Computes the selection’s position, creates a toolbar with some test buttons,
     * and displays the toolbar overlay.
     */
    function handleSelectionEnd(event) {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      console.log(`Selection ended. You selected: "${selectedText}"`);
  
      // If there is no text selected, remove any existing toolbar and exit.
      if (!selectedText) {
        if (toolbarElement) {
          toolbarElement.remove();
          toolbarElement = null;
        }
        return;
      }
  
      // Try to get the bounding rectangle of the first range in the selection.
      let rect;
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        rect = range.getBoundingClientRect();
      }
  
      // Fallback: if no rectangle could be determined, use the event's mouse coordinates.
      let x = event.clientX;
      let y = event.clientY;
      if (rect) {
        // Position the toolbar just below the selection. Adding window.scroll offsets
        // to account for scrolling.
        x = rect.left + window.scrollX;
        y = rect.bottom + window.scrollY + 5; // 5px vertical offset
      }
  
      // Adjust for mobile if necessary (here we check for touch support).
      const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      if (isMobile) {
        // For mobile, you might prefer more vertical spacing.
        y = rect.bottom + window.scrollY + 10;
      }
  
      // Define toolbar buttons.
      // The first test button shows a simple alert. You can add more buttons here.
      const buttons = [
        {
          label: '↳ Add',
          callback: function(label) {
            console.log(`${label} was used in callback`);
            hierarchyEditor.getCurrentNode().body = hierarchyEditor.getCurrentNode().body.replace(label,`**${label}**`);
            sophia.send(hierarchyEditor.getCurrentNode().id, label, createChild=true, label=label);
          }
        }
        // More buttons can be added, e.g.:
        // {
        //   label: 'Bold',
        //   callback: function() { /* Your bold formatting logic */ }
        // }
      ];
  
      // Display the toolbar overlay at the computed (x, y) position.
      showToolbarOverlay(x, y, buttons, selectedText);
    }
  
    // Attach event listeners for selection end events.
    // If the browser supports the "selectionend" event use it; otherwise, fallback to "mouseup".
    if ('onselectionend' in document) {
      window.hierarchyEditor.nodeEditor.addEventListener('selectionend', handleSelectionEnd);
    } else {
      window.hierarchyEditor.nodeEditor.addEventListener('mouseup', handleSelectionEnd);
    }
});
  