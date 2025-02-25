# ws.py

import asyncio
from fastapi import WebSocket
from fastapi.websockets import WebSocketState
from typing import Dict

# ---------------------------
# WebSocket support for live collaboration
# ---------------------------

class StreamUser:
    def __init__(self, user_id: str, channel: str = None, name: str = 'anon', metadata: dict = None):
        self.id = user_id
        self.name = name
        self.channel = channel  # current channel
        self.metadata = metadata or {}
        # Mapping: channel -> list of WebSocket connections
        self.connections: Dict[str, list[WebSocket]] = {}
        # Mapping: channel -> dict mapping each connection to its state data.
        self.connection_states: Dict[str, dict] = {}
        
    def data(self, channel:str, websocket:WebSocket):
        return {
            'id': self.id,
            'name': self.name,
            'metadata': self.metadata,
            'state': self.get_connection_state(channel, websocket)
        }

    def add_connection(self, channel: str, websocket: WebSocket, state: dict = None):
        if channel not in self.connections:
            self.connections[channel] = []
            self.connection_states[channel] = {}
        if websocket not in self.connections[channel]:
            self.connections[channel].append(websocket)
            self.connection_states[channel][websocket] = state or {}

    def remove_connection(self, channel: str, websocket: WebSocket):
        if channel in self.connections and websocket in self.connections[channel]:
            self.connections[channel].remove(websocket)
            if websocket in self.connection_states[channel]:
                del self.connection_states[channel][websocket]
            if not self.connections[channel]:
                del self.connections[channel]
                del self.connection_states[channel]

    def update_connection_state(self, channel: str, websocket: WebSocket, state_update: dict):
        """Update the state dictionary for a specific connection in a channel."""
        if channel in self.connection_states and websocket in self.connection_states[channel]:
            self.connection_states[channel][websocket].update(state_update)
    
    def get_connection_state(self, channel: str, websocket: WebSocket) -> dict:
        """Return the current state for the specified connection."""
        if channel in self.connection_states:
            return self.connection_states[channel].get(websocket, {})
        return {}

class ConnectionManager:
    def __init__(self):
        # Channels: mapping channel name -> {"metadata": dict, "connections": {user_id: StreamUser}}
        self.channels: dict[str, dict] = {}
        self.users: dict[str, StreamUser] = {}
        # Mapping each WebSocket to the channel it’s in.
        self.websocket_channels: dict[WebSocket, str] = {}
        # Async queue for broadcast messages.
        self.broadcast_queue: asyncio.Queue = asyncio.Queue()

    async def get_user(self, user_id: str, channel: str = None, name: str = 'anon'):
        if user_id not in self.users:
            self.users[user_id] = StreamUser(user_id, channel=channel, name=name)
        if channel is not None:
            self.users[user_id].channel = channel
        return self.users[user_id]

    async def connect(self, websocket: WebSocket, user_id: str, channel: str, state: dict = None):
        # Disconnect previous assignment if necessary.
        if websocket in self.websocket_channels:
            old_channel = self.websocket_channels[websocket]
            self.disconnect(websocket, user_id, old_channel)
        self.websocket_channels[websocket] = channel

        user = await self.get_user(user_id, channel=channel)
        user.add_connection(channel, websocket, state)
        
        if channel not in self.channels:
            self.channels[channel] = {"metadata": {}, "connections": {}}
        self.channels[channel]["connections"][user_id] = user

    def disconnect(self, websocket: WebSocket, user_id: str, channel: str):
        if channel in self.channels:
            if user_id in self.channels[channel]['connections']:
                user = self.users.get(user_id)
                if user:
                    user.remove_connection(channel, websocket)
                    if channel not in user.connections:
                        self.channels[channel]["connections"].pop(user_id, None)
            if websocket in self.websocket_channels:
                del self.websocket_channels[websocket]
            if channel in self.channels and not self.channels[channel]["connections"]:
                del self.channels[channel]

    def get_users(self, channel: str, websocket:WebSocket):
        if channel in self.channels and self.channels[channel]['connections']:
            # Optionally include connection state per user for a specific channel.
            o = [{
                'id': user.id,
                'name': user.name,
                'metadata': user.metadata,
                'state': user.get_connection_state(channel, websocket)  # Aggregated state for the channel
            } for user in self.channels[channel]['connections'].values()]
            print(o)
            return o
        return []

    def update_user(self, message: dict, user_id: str):
        user = self.users.get(user_id)
        if user:
            user.__dict__.update(message.get('fields', {}))

    async def broadcast_to_user_channels(self, sender: WebSocket, user_id: str, message: dict):
        user: StreamUser = self.users.get(user_id)
        if user:
            for channel in user.connections.keys():
                await self.broadcast(message, sender, channel)

    # async def broadcast_users(self, channel: str):
    #     users = self.get_users(channel)
    #     if users:
    #         await self.broadcast({'users': users, 'action': 'list_users'}, sender=None, channel=channel)

    async def broadcast(self, message: dict, sender: WebSocket, channel: str = None):
        """
        Instead of sending immediately, put the message into an async queue.
        """
        channel = channel or message.get('channel', None)
        if channel is None:
            return
        await self.broadcast_queue.put({
            "message": message,
            "sender": sender,
            "channel": channel
        })

    async def process_queue(self):
        """
        Background task to process and send all broadcast messages.
        """
        while True:
            item = await self.broadcast_queue.get()
            message = item["message"]
            sender = item["sender"]
            channel = item["channel"]

            if "action" not in message:
                message["action"] = "unknown"

            if channel in self.channels:
                for uid, user in self.channels[channel]["connections"].items():
                    if channel in user.connections:
                        to_remove = []
                        for connection in user.connections[channel]:
                            if connection.client_state == WebSocketState.DISCONNECTED:
                                to_remove.append(connection)
                                continue
                            if connection != sender:
                                try:
                                    await connection.send_json(message)
                                except Exception as e:
                                    print("Error sending message:", e)
                        for conn in to_remove:
                            user.remove_connection(channel, conn)
            self.broadcast_queue.task_done()

    def create_channel(self, channel: str, metadata: dict = None):
        if channel not in self.channels:
            self.channels[channel] = {"metadata": metadata or {}, "connections": {}}
        else:
            raise Exception("Channel already exists")

    def update_channel(self, channel: str, metadata: dict):
        if channel in self.channels:
            self.channels[channel]["metadata"] = metadata
        else:
            raise Exception("Channel does not exist")

    def delete_channel(self, channel: str):
        if channel in self.channels:
            del self.channels[channel]

    def get_channel(self, channel: str):
        return self.channels.get(channel)

    def list_channels(self):
        return list(self.channels.keys())
