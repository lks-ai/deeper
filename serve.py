# Sophia (Deepr.wiki) API server
# github.com/lks-ai/deeper

# Standard libs
import json
import asyncio
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

from ws import ConnectionManager, StreamUser

from contextlib import asynccontextmanager
manager = ConnectionManager()

# Assume 'manager' is already defined and contains process_queue.
@asynccontextmanager
async def lifespan(app):
    # Startup: start the background task for processing the broadcast queue.
    task = asyncio.create_task(manager.process_queue())
    try:
        yield  # Application is now running.
    finally:
        # Shutdown: cancel the background task.
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

app = FastAPI(lifespan=lifespan)

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

# Websockets endpoint
    
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    user_id = None
    channel_join = None
    try:
        await websocket.accept()
        # The first message should be a join_channel action
        join_data: dict = await websocket.receive_json()
        if join_data.get("action") != "join_channel":
            await websocket.close(code=1008)
            return
        user_id = join_data.get("userId")
        channel_join = join_data.get("channel")
        if not user_id or not channel_join:
            await websocket.close(code=1008)
            return

        async def join_channel(user_id, channel):
            await manager.connect(websocket, user_id, channel)
            # Queue a join message to notify others.
            user:StreamUser = await manager.get_user(user_id)
            await manager.broadcast({
                "action": "user_joined",
                "userId": user_id,
                "channel": channel,
                "userData": user.data(channel, websocket),
            }, sender=websocket, channel=channel)

        await join_channel(user_id, channel_join)
        while True:
            message:dict = await websocket.receive_json()
            if "action" not in message:
                message["action"] = "unknown"
            action = message["action"]
            channel = message.get("channel")
            if action == "join_channel":
                # Allow a user to join another channel.
                if channel:
                    await join_channel(user_id, channel)
                    users = manager.get_users(channel, websocket)
                    await websocket.send_json({'action': 'list_users', 'users': users})
            elif action == "user_update":
                manager.update_user(message, user_id)
                await manager.broadcast_to_user_channels(websocket, user_id, message)
            elif action == "list_users":
                users = manager.get_users(channel, websocket)
                await websocket.send_json({'action': 'list_users', 'users': users})
            elif action == "user_state":
                user = await manager.get_user(user_id)
                user.update_connection_state(channel, websocket, message['fields'])
                await manager.broadcast(message, sender=websocket, channel=channel)
            else:
                # Default broadcast: send to current channel.
                await manager.broadcast(message, sender=websocket, channel=channel)
    except WebSocketDisconnect:
        user = manager.users.get(user_id)
        if user:
            manager.disconnect(websocket, user_id, user.channel)
        await manager.broadcast({
            "action": "user_left",
            "userId": user_id,
            "channel": channel_join
        }, sender=websocket, channel=channel_join)
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
from fastapi.staticfiles import StaticFiles

# Add GZipMiddleware for responses larger than 1000 bytes (adjust as needed)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Mount the "web" directory at the root.
# Endpoints defined above will override these routes.
app.mount("/", StaticFiles(directory="web", html=True), name="static")


# For local testing: run `python main.py` or `uvicorn main:app --host 0.0.0.0 --port 8123`
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8123)
