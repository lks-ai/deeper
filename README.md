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
- Use any LLM, Deepr adds **advanced reasoning capabilities** to it
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

## TODO
- Swipe left and right: swipe through peers, or if all the way left, swipe to parent, all the way right on breadcrumb? swipe to first child
- Select which model to run and which endpoint to point to
- Control the System prompt within the interface
- ✅ Hash based navigation (browser history plus UX control URL<->UX)
- ✅ Nodes should have UUIDs
- Download tree files
- User accounts and folders
- Node naming based on links
- Remapping links back to existing nodes as hrefs
- Multilinguality
- Multimodality with Drag & Drop
- Code block cleanup
- Copy function for code blocks and full message markdown
- Fix prompt history selection on mobile
- Fixing HTTPS on the demo
- Showing multiline metadata properly
- Some sort of Tree selector for modals
- Make `Update` button reference the current node's contents and the revision request (so it revises what is already there if something exists)
- JS based tree diff and maybe tregex?
- Some form of simplified RAG without too much overhead (ModernBERT?)
- ✅ Stop user from leaving page
- On serialization of hierarchyEditor, make it use parent.id instead of null
- Finish SQLite3 ORM in back-end with tree diff and entity filesystem indexing