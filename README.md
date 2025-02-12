# Deepr Wiki
*Local LLM driven Knowledge Tree with Tree-of-Thought capabilities*

Original Repo: [lks-ai/deeper](https://github.com/lks-ai/deeper)

**[Online Demo (Please behave)](http://deepr.wiki)**

## Benefits
- Great for study and research
- Makes knowledge easily portable and navegable
- Saves lots of time
- Enjoy privacy in a closed network

## Features
- Runs fully locally
- Make full trees of any type of content
- Easy to use intuitive and **mobile friendly** interface
- Use any LLM, Deeper adds **advanced reasoning capabilities** to it
- Preset to use OpenRouter but can use any OpenAI compatible endpoints
- Save and Load your Trees / Branches
- Easily repeat prompts with the prompt history

## Setup
Make sure you have your environment variables set up properly in a file called `.env` in the project root folder. Here is an example that hooks up Deepr wiki to OpenRouter, which you can also see in `placeholder.env`:
```.env
# Endpoint and model (any OpenAI compatible API)
PROWL_VLLM_ENDPOINT=https://openrouter.ai/api
PROWL_MODEL=qwen/qwen-2.5-7b-instruct
# This is for using hosted services that require an API key
PROWL_VENDOR_API_KEY= ... put your key ...
```

## Install
From the parent folder you want to install Deepr on.
```sh
git clone https://github.com/lks-ai/deeper.git
cd deeper
pip install -r requirements.txt
```

## Get Started
From the `deeper` folder you just installed
```sh
python serve.py
```
Then navigate your browser to `http://localhost:8123`


## TODO

### UI
- Swipe left and right: swipe through peers, or if all the way left, swipe to parent, all the way right on breadcrumb? swipe to first child
- ✅ Select which model to run (Agents)
- Control the agent prompts within the interface
    - Each agent has it's own folder in prompts with overrides
- ✅ Hash based navigation (browser history plus UX control URL<->UX)
- ✅ Nodes should have UUIDs
- ✅ Thought View Breakdown
- Download tree files
- Hash based loading with SQLite3 node id indexing
- User accounts and folders
- Node naming based on links (use a link metadata for quick search lookup)
- ✅ Remapping links and full concurrent body rewrite queue
- Multilinguality
- Multimodality with Drag & Drop for modal inputs
- Code block cleanup
    - Copy function for code blocks and full message markdown
- ✅ Fix prompt history selection on mobile
- ✅ Showing multiline metadata properly
- Some sort of Tree selector for modals
- ✅ Make `Update` button reference the current node's contents and the revision request (so it revises what is already there if something exists)
- JS based tree diff and maybe tregex?
- Some form of simplified RAG without too much overhead (ModernBERT?)
- ✅ Stop user from leaving page
- On serialization of hierarchyEditor, make it use parent.id instead of null
- ✅ Ability to select text and use that as the prompt
- Cross-Branch Easy linking

### SysOps
- ✅ Fixing HTTPS on the demo
- Finish SQLite3 ORM in back-end with tree diff and entity filesystem indexing

### Server-Side
- Search Capability for web search
- Browsing capability
- Agent Prompts for (coder, roleplayer, etc)
- Tree based Prompt templates (graft a branch, re-generate full branch with nulled bodies)
- Multi-directional rewriting
    - Gives ability to rewrite the content of a node based on the content of it's children
    - rewrite content based on peers
    - rewrite content based on sequential progression
    - rewr
- Mult-directional context stacking
    - currently it's just a straight path directly from the root to the leaf
    - could have a mode where it sequentially stacks any peer nodes before it
- Multimedia content
    - Making sure to safely allow html
- Auto-Agent Switching