import json
from os import listdir
from os.path import isfile, join
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from util import think

app = FastAPI()

"""
Today:
    -*loading and saving
    - prompt history
        add to the saved data!
    drag & drop
    docker setup
    hash based navigation - for node ids
        in server side, node id can be overwritten with uuid for uniqueness when saving
    copy/paste/duplicate branch
    mouse scrolling on nav rows = horizontal scroll up and down
    - nicer markdown styling + check table formatting and other pieces
    templates for prowl scripts
        prompts / {template_name} / ...
        prompts/default will load first in stack, then the template name if used
        make UI part for this too on options panel: study, roleplay, etc. can be pre-built
        drop down option on the node form
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
    model: Optional[str] = None

@app.post("/think")
async def think_endpoint(request: ThinkRequest):
    try:
        result = await think(request.prompt, request.model)
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
    

# For local testing: run `python main.py` or `uvicorn main:app --host 0.0.0.0 --port 8123`
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8123)
