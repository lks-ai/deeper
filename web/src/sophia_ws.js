class SophiaWebSocketClient {
  /**
   * @param {string} url - The WebSocket server URL (e.g. "wss://your.domain.com/ws")
   * @param {object} options - Optional configuration.
   *    options.maxInitialAttempts (default: 10)
   *    options.initialDelay (default: 5000 ms)
   *    options.secondaryDelay (default: 30000 ms)
   *    options.tertiaryDelay (default: 60000 ms)
   */
  constructor(url, options = {}) {
    this.url = url;
    this.ws = null;
    this.eventListeners = {};
    this.reconnectCount = 0;
    this.reconnectTimer = null;
    this.manualDisconnect = false;
    this.options = Object.assign(
      {
        maxInitialAttempts: 10,
        initialDelay: 5000,      // 5 seconds
        secondaryDelay: 30000,   // 30 seconds
        tertiaryDelay: 60000,    // 60 seconds
      },
      options
    );
  }

  /**
   * Initiate connection. Resets manualDisconnect flag.
   */
  connect() {
    this.manualDisconnect = false;
    this._connect();
  }

  /**
   * Internal method to connect.
   */
  _connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = (event) => {
      console.log("WebSocket connected");
      this.reconnectCount = 0; // reset on successful connection
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
      console.error("WebSocket error:", event);
      this._emit("error", event);
    };

    this.ws.onclose = (event) => {
      console.warn("WebSocket closed:", event);
      this._emit("close", event);
      if (!this.manualDisconnect) {
        this._attemptReconnect();
      }
    };
  }

  /**
   * Attempt to reconnect with increasing delays.
   */
  _attemptReconnect() {
    this.reconnectCount++;
    let delay;
    if (this.reconnectCount <= this.options.maxInitialAttempts) {
      delay = this.options.initialDelay;
    } else if (this.reconnectCount <= this.options.maxInitialAttempts + 10) {
      delay = this.options.secondaryDelay;
    } else {
      delay = this.options.tertiaryDelay;
    }
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectCount})`);
    this.reconnectTimer = setTimeout(() => {
      this._connect();
    }, delay);
  }

  /**
   * Disconnect manually. This prevents auto-reconnection.
   */
  disconnect() {
    this.manualDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
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
// const wsClient = new SophiaWebSocketClient("wss://your.domain.com/ws");
// wsClient.on("open", (e) => console.log("Connected", e));
// wsClient.on("update", (msg) => console.log("Update received", msg));
// wsClient.connect();
