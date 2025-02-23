# Sophia (Deepr.wiki) API server
# github.com/lks-ai/deeper

# Standard libs
import json
from os import listdir
from os.path import isfile, join

# FastAPI and middleware
from fastapi import FastAPI, HTTPException, status, Depends, Header
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.security import OAuth2PasswordBearer

# Typing
from pydantic import BaseModel
from typing import Optional, Dict

# Utility functions
from util import PATH, think, fetch_models, load_defaults

# Security and user accounts
import jwt
from jwt import PyJWTError
import traceback

app = FastAPI()

"""
TODO
    multimodal /think endpoint
    fix language integration
    workspaces for storage and given
        local file storage provider or supabase/external provider
        share namespace is now an 8 digit hex
        share is a token that points to workspace/tree
    definitely work on the login page!!!!
"""

# Add a CORS middleware with a lenient policy:
origins = ["*"]  # allows requests from all origins; for tighter security, list specific origins here.

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ThinkRequest(BaseModel):
    prompt: str
    history: Optional[str] = None
    agent: Optional[str] = None
    model: Optional[str] = None
    language: Optional[str] = 'English'

@app.post("/think")
async def think_endpoint(request: ThinkRequest):
    try:
        result = await think((request.history or "") + request.prompt, model=request.model, agent=request.agent, language=request.language)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
class SaveRequest(BaseModel):
    name: str
    data: dict

@app.get("/list")
async def get_data():
    """ Return the list of different saved trees """
    o = [f for f in listdir(PATH) if isfile(join(PATH, f))]
    return o

@app.get("/models")
async def get_data():
    """ Return the list of possibly selectable models """
    # should cache models based on the PROWL_VLLM_ENDPOINT
    try:
        o = await fetch_models()
        return o
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/defaults")
async def get_data():
    """ Return the list of possibly selectable models """
    # should cache models based on the PROWL_VLLM_ENDPOINT
    try:
        o = load_defaults()
        return o
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/save")
async def save_endpoint(request: SaveRequest):
    try:
        with open(f"{PATH}{request.name}.json", "w+") as f:
            json.dump(request.data, f)
        return {'success': True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/load/{name}")
async def load_endpoint(name: str):
    try:
        with open(f"{PATH}{name}.json", "r") as f:
            data = json.load(f)
        # print(data)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
from fastapi.staticfiles import StaticFiles


##########################################
# WebSocket support for live collaboration
##########################################

class StreamUser:
    def __init__(self, user_id: str, channel: str = None, name: str = 'anon', metadata: dict = None):
        self.id = user_id
        self.name = name
        self.channel = channel  # the user's current channel
        self.metadata = metadata or {}
        # Mapping from channel to a list of WebSocket connections.
        self.connections: dict[str, list[WebSocket]] = {}

    def add_connection(self, channel: str, websocket: WebSocket):
        if channel not in self.connections:
            self.connections[channel] = []
        if websocket not in self.connections[channel]:
            self.connections[channel].append(websocket)

    def remove_connection(self, channel: str, websocket: WebSocket):
        if channel in self.connections:
            if websocket in self.connections[channel]:
                self.connections[channel].remove(websocket)
            if not self.connections[channel]:
                del self.connections[channel]

    def has_connection(self, channel: str, websocket: WebSocket):
        return channel in self.connections and websocket in self.connections[channel]


class ConnectionManager:
    def __init__(self):
        # Channels: mapping channel name -> {"metadata": dict, "connections": {user_id: StreamUser}}
        self.channels: dict[str, dict] = {}
        self.users: dict[str, StreamUser] = {}
        # Map each websocket to the channel it’s currently in.
        self.websocket_channels: dict[WebSocket, str] = {}

    def get_user(self, user_id: str, channel: str = None, name: str = 'anon'):
        if user_id not in self.users:
            self.users[user_id] = StreamUser(user_id, channel=channel, metadata={})
        if channel is not None:
            self.users[user_id].channel = channel
        return self.users[user_id]

    async def connect(self, websocket: WebSocket, user_id: str, channel: str):
        print('connecting')
        # If this websocket is already assigned to a channel, disconnect it first.
        if websocket in self.websocket_channels:
            old_channel = self.websocket_channels[websocket]
            self.disconnect(websocket, user_id, old_channel)
        # Record the new channel for this websocket.
        self.websocket_channels[websocket] = channel

        user = self.get_user(user_id, channel=channel)
        print('adding', user.__dict__)
        user.add_connection(channel, websocket)
        print("User:", user.__dict__)

        if channel not in self.channels:
            self.channels[channel] = {"metadata": {}, "connections": {}}
        # Add or update the user's entry for this channel.
        self.channels[channel]["connections"][user_id] = user

    def disconnect(self, websocket: WebSocket, user_id: str, channel: str):
        if channel in self.channels:
            if user_id in self.channels[channel]['connections']:
                user = self.get_user(user_id)
                user.remove_connection(channel, websocket)
                if not user.connections.get(channel):
                    self.channels[channel]["connections"].pop(user_id, None)
            # Remove the websocket from our mapping.
            if websocket in self.websocket_channels:
                del self.websocket_channels[websocket]
            # Optionally, delete the channel if it has no connections.
            if not self.channels[channel]["connections"]:
                del self.channels[channel]

    async def broadcast(self, message: dict, sender: WebSocket, channel: str):
        print('Broadcasting on', channel, message)
        if "action" not in message:
            message["action"] = "unknown"
        if channel in self.channels:
            for uid, user in self.channels[channel]["connections"].items():
                if channel in user.connections:
                    to_remove = []
                    for connection in user.connections[channel]:
                        # print(connection.client_state)
                        if connection.client_state == WebSocketState.DISCONNECTED:
                            to_remove.append(connection)
                            continue
                        if connection != sender:
                            # print('sending', connection)
                            await connection.send_json(message)
                    for conn in to_remove:
                        del user.connections[channel][conn]

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

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    user_id = None
    channel = None
    try:
        await websocket.accept()
        # Expect the first message to be a "join_channel" action with userId and channel.
        join_data:dict = await websocket.receive_json()
        print(join_data)
        if join_data.get("action") != "join_channel":
            await websocket.close(code=1008)
            return
        user_id = join_data.get("userId")
        channel = join_data.get("channel")

        async def join_channel(user_id, channel):
            if not user_id or not channel:
                await websocket.close(code=1008)
                return
            await manager.connect(websocket, user_id, channel)
            # Optionally, broadcast a join message.
            await manager.broadcast({"action": "user_joined", "userId": user_id, "channel": channel},
                                    sender=websocket, channel=channel)

        await join_channel(user_id, channel)
        user = manager.get_user(user_id)
        while True:
            message = await websocket.receive_json()
            # Ensure each message has an "action" key.
            print(message)
            if "action" not in message:
                message["action"] = "unknown"
            # You can add logic here to handle specific actions (update, delete, etc.)
            action = message['action']
            if action == 'join_channel':
                print(f"JOINING CHANNEL {user_id}, {message['channel']}")
                await join_channel(user_id, message['channel'])
            else:
                await manager.broadcast(message, sender=websocket, channel=user.channel)
    except WebSocketDisconnect:
        user:StreamUser = manager.get_user(user_id)
        manager.disconnect(websocket, user_id, user.channel)
        user.remove_connection(channel, websocket)
        # Optionally, broadcast a disconnect message.
        await manager.broadcast({"action": "user_left", "userId": user_id, "channel": channel},
                                sender=websocket, channel=channel)
    except Exception as e:
        print("Error in websocket_endpoint:", e)
        traceback.print_exc()
        await websocket.close(code=1011)

# AUTH FUNCTIONALITY
# - auth service provider
# - auth storage provider
# - content storage provider
# - Or, none of that if using no jwt with an anon user

import os
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
SECRET_KEY = os.getenv('JWT_SECRET_KEY')
ALGORITHM = os.getenv('JWT_ALGORITHM')
JWT_UID_FIELD = os.getenv('JWT_UID_FIELD')

# Pydantic model for the auth request body.
class AuthRequest(BaseModel):
    use_oauth: bool = False  # If true, perform OAuth-style verification.
    token: Optional[str] = None  # Optional token sent in the body.

def get_token(token_from_body: Optional[str], auth_header: Optional[str]) -> str:
    """
    Returns the JWT token from the request body if provided; otherwise, extracts it from the Authorization header.
    """
    if token_from_body:
        return token_from_body
    if auth_header:
        scheme, _, token = auth_header.partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token scheme in header",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return token
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing token",
        headers={"WWW-Authenticate": "Bearer"},
    )

def verify_jwt_oauth(token: str = Depends(oauth2_scheme)) -> Optional[str]:
    #print('JWT Decode:', token)
    #logger.info(f'Token: {token}')
    try:
        payload = jwt.decode(token, 
            SECRET_KEY, 
            algorithms=[ALGORITHM],
            audience='authenticated',
        )
        user_id: str = payload.get(JWT_UID_FIELD)
        #logger.info(f'Payload: {payload}')
        if user_id is None:
            #logger.error('JWT Error: NoUID')
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user_id
    except Exception as e:
        #logger.error(f'JWT Error: {e}')
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials: " + repr(e),
            headers={"WWW-Authenticate": "Bearer"},
        )

def verify_jwt_default(token: str) -> str:
    """
    Verifies the token using default settings (no audience check).
    Returns the user_id if valid.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: Optional[str] = payload.get(JWT_UID_FIELD)
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials: missing user id",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user_id
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials (default): " + repr(e),
            headers={"WWW-Authenticate": "Bearer"},
        )

@app.post("/auth")
async def auth_endpoint(auth_req: AuthRequest, authorization: Optional[str] = Header(None)):
    """
    Verifies the JWT token using one of two methods, based on the 'use_oauth' flag in the request body.
    If successful, returns the user information derived solely from the token.
    """
    token = get_token(auth_req.token, authorization)
    if auth_req.use_oauth:
        user_id = verify_jwt_oauth(token)
        method_used = "oauth"
    else:
        user_id = verify_jwt_default(token)
        method_used = "default"

    return {"user": {"id": user_id}, "method": method_used}

from fastapi.responses import HTMLResponse

@app.get("/login", response_class=HTMLResponse)
async def serve_login():
    
    # Get the Supabase URL and anon key from environment variables.
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY')
    
    # Read the static HTML file.
    with open('web/supabase.html', 'r') as f:
        html = f.read()
    
    # Replace placeholders in the HTML.
    html = html.replace('[[SUPABASE_ANON_KEY_HERE]]', SUPABASE_ANON_KEY)
    html = html.replace('[[SUPABASE_URL_HERE]]', SUPABASE_URL)
    
    return HTMLResponse(content=html)

########################################
#### STATIC MOUNT: KEEP THIS AT THE END!
########################################

# Add GZipMiddleware for responses larger than 1000 bytes (adjust as needed)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Mount the "web" directory at the root.
# Endpoints defined above will override these routes.
app.mount("/", StaticFiles(directory="web", html=True), name="static")



# For local testing: run `python main.py` or `uvicorn main:app --host 0.0.0.0 --port 8123`
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8123)
