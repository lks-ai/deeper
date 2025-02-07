# Deepr Wiki
*Local LLM driven Knowledge Tree with Tree-of-Thought capabilities*

Original Repo: [lks-ai/deeper](https://github.com/lks-ai/deeper)

## Features
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