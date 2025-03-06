from prowl import ProwlStack, prowl
import re

PATH = 'data/'

models = [
    'qwen/qwen-2.5-7b-instruct',
    'mistralai/mixtral-8x7b-instruct',
]

# util for main

def fix_markdown_bold(md_text: str) -> str:
    """
    Fix markdown list items where the colon is mistakenly inside the bold markers.
    Example:
      Input:  "- **First Item:** Lorem ipsum dolor"
      Output: "- **First Item**: Lorem ipsum dolor"
    """
    # This regex looks for a pattern: **text:** and replaces it with **text**:
    fixed_text = re.sub(r'(\*\*[^*]+):(\*\*)', r'\1\2:', md_text)
    return fixed_text

def remove_list_blank_lines(markdown_text: str) -> str:
    """
    Removes blank lines that occur between Markdown list items,
    while leaving other blank lines untouched.
    
    Args:
        markdown_text (str): The input Markdown text.
        
    Returns:
        str: The Markdown text with blank lines within lists removed.
    """
    lines = markdown_text.splitlines()

    # Helper to determine if a line is a Markdown list item.
    def is_list_item(line: str) -> bool:
        # Match unordered list markers (-, *, +) or ordered list (digits followed by a dot)
        return bool(re.match(r'^\s*([-+*]|\d+\.)\s+', line))
    
    new_lines = []
    total_lines = len(lines)
    
    for i, line in enumerate(lines):
        if line.strip() == '':
            # It's a blank line; check the previous and next non-blank lines.
            prev_line = None
            next_line = None
            
            # Look backward for the previous non-empty line.
            j = i - 1
            while j >= 0:
                if lines[j].strip():
                    prev_line = lines[j]
                    break
                j -= 1
            
            # Look forward for the next non-empty line.
            j = i + 1
            while j < total_lines:
                if lines[j].strip():
                    next_line = lines[j]
                    break
                j += 1

            # If both surrounding lines are list items, skip this blank line.
            if prev_line and next_line and is_list_item(prev_line) and is_list_item(next_line):
                continue
            else:
                new_lines.append(line)
        else:
            new_lines.append(line)
    
    return "\n".join(new_lines)


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
        stack = ProwlStack(folder=folders, silent=True) #, stream_level=prowl.StreamLevel.VARIABLE, variable_event=stop_early)
        r:prowl.Return = await stack.run(['identity', 'input', 'think'], inputs={'user_request': prompt}, model=model, stops=['</think>', '\n\n'])
        # TODO Introduce early stopping based on streaming
        d = r.get()
        thoughts = r.var('thought').hist()
        d['thought'] = "\n".join([v['value'] for v in thoughts])
        r:prowl.Return = await stack.run(['output'], prefix=r.completion, model=model, inputs={'language': language}, stops=['</reply>'])
        d.update(r.get())
        d['response'] = remove_list_blank_lines(fix_markdown_bold(d['response']))
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

