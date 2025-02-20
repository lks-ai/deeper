class SophiaWebSocketClient {
    /**
     * @param {string} url - The WebSocket server URL (e.g. "ws://localhost:8123/ws")
     */
    constructor(url) {
      this.url = url;
      this.ws = null;
      // A map of event names to an array of callbacks.
      this.eventListeners = {};
    }
  
    /**
     * Connect to the WebSocket server.
     */
    connect() {
      this.ws = new WebSocket(this.url);
  
      this.ws.onopen = (event) => {
        this._emit("open", event);
      };
  
      this.ws.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch (e) {
          console.error("Error parsing WebSocket message:", event.data);
          return;
        }
        // Every message should have an "action" key.
        if (data.action) {
          this._emit(data.action, data);
        }
        // Also emit a generic "message" event.
        this._emit("message", data);
      };
  
      this.ws.onerror = (event) => {
        this._emit("error", event);
      };
  
      this.ws.onclose = (event) => {
        this._emit("close", event);
      };
    }
  
    /**
     * Disconnect from the WebSocket server.
     */
    disconnect() {
      if (this.ws) {
        this.ws.close();
      }
    }
  
    /**
     * Send a JSON message to the server.
     * @param {object} message - The message object to send.
     */
    send(message) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
      } else {
        console.warn("WebSocket is not open. Cannot send message.");
      }
    }
  
    /**
     * Register an event listener for a given event.
     * @param {string} eventName - The event name (e.g. "open", "update", "user_joined").
     * @param {function} callback - The callback to invoke with event data.
     */
    on(eventName, callback) {
      if (!this.eventListeners[eventName]) {
        this.eventListeners[eventName] = [];
      }
      this.eventListeners[eventName].push(callback);
    }
  
    /**
     * Unregister an event listener.
     * @param {string} eventName - The event name.
     * @param {function} callback - The callback to remove.
     */
    off(eventName, callback) {
      if (this.eventListeners[eventName]) {
        this.eventListeners[eventName] = this.eventListeners[eventName].filter(
          (cb) => cb !== callback
        );
      }
    }
  
    /**
     * Internal method to emit an event to all registered listeners.
     * @param {string} eventName - The event name.
     * @param {object} data - The data to pass to callbacks.
     */
    _emit(eventName, data) {
      if (this.eventListeners[eventName]) {
        this.eventListeners[eventName].forEach((callback) => callback(data));
      }
    }
}

// Example usage:
// const wsClient = new SophiaWebSocketClient("ws://localhost:8123/ws");
// wsClient.on("open", (e) => console.log("Connected", e));
// wsClient.on("update", (msg) => console.log("Update received", msg));
// wsClient.connect();
  