# Sophia (Deepr.wiki) API server
# github.com/lks-ai/deeper

import json
from os import listdir
from os.path import isfile, join
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from util import think, fetch_models, load_defaults

app = FastAPI()

"""
Today:
    finish sophia.getModels()
    add `agent` to options menu on nodes
        agents include models
            once agent is selected, it updates the config model and agent fields
    - loading and saving
    - prompt history
        add to the saved data!
    drag & drop
    - docker setup
    - hash based navigation - for node ids
        in server side, node id can be overwritten with uuid for uniqueness when saving
        make a UUID index which holds all entities that are saved
    copy/paste/duplicate branch
    - mouse scrolling on nav rows = horizontal scroll up and down
    - nicer markdown styling + check table formatting and other pieces
    templates for prowl scripts
        prompts / {template_name} / ...
        prompts/default will load first in stack, then the template name if used
        make UI part for this too on options panel: study, roleplay, etc. can be pre-built
        drop down option on the node form
    set defaults.yaml up to give default configs from the server, for different agents
        maybe make it a trickle tree over the prompts folder
    fix language integration
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

PATH = 'data/'

class ThinkRequest(BaseModel):
    prompt: str
    history: Optional[str] = None
    agent: Optional[str] = None
    model: Optional[str] = None
    language: Optional[str] = 'English'

@app.post("/think")
async def think_endpoint(request: ThinkRequest):
    try:
        result = await think((request.history or "") + request.prompt, request.model, request.language)
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
        print(data)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
from fastapi.staticfiles import StaticFiles

# Mount the "web" directory at the root.
# Endpoints defined above will override these routes.
app.mount("/", StaticFiles(directory="web", html=True), name="static")


# For local testing: run `python main.py` or `uvicorn main:app --host 0.0.0.0 --port 8123`
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8123)
