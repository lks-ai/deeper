from prowl import ProwlStack, prowl

PATH = 'data/'

models = [
    'qwen/qwen-2.5-7b-instruct',
    'mistralai/mixtral-8x7b-instruct',
]

# Main function

async def think(prompt:str, model=None, agent=None, language='English'):
    def stop_early(var:prowl.Variable):
        if var.name == 'stop_now':
            if "y" in var.value.lower():
                return False
    folders = ["prompts/"]
    # load agent folder prompts (will auto-override)
    if agent is not None:
        folders.append(f"prompts/{agent}/")
        defaults:dict = load_defaults()
        agent_:dict = defaults['agents'].get(agent)
        if agent_ is not None:
            model = agent_.get('model') or model
    model = model or models[0]
    try:
        stack = ProwlStack(folder=folders, silent=False) #, stream_level=prowl.StreamLevel.VARIABLE, variable_event=stop_early)
        r:prowl.Return = await stack.run(['identity', 'input', 'think'], inputs={'user_request': prompt}, model=model, stops=['</think>', '\n\n'])
        # TODO Introduce early stopping based on streaming
        d = r.get()
        thoughts = r.var('thought').hist()
        d['thought'] = "\n".join([v['value'] for v in thoughts])
        r:prowl.Return = await stack.run(['output'], prefix=r.completion, model=model, inputs={'language': language}, stops=['</reply>'])
        d.update(r.get())
        return d
    except Exception as e:
        print(e)
        raise

# Support functions
import os
import aiohttp

async def fetch_models() -> dict:
    base_url = os.getenv('PROWL_VLLM_ENDPOINT')
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{base_url}/models") as response:
                response.raise_for_status()
                return await response.json()
    except Exception as e:
        print(e)
        raise

import yaml
def load_defaults() -> dict:
    with open("defaults.yaml") as stream:
        try:
            return yaml.safe_load(stream)
        except yaml.YAMLError as exc:
            print(exc)
            raise

