# Deepr Wiki
**Local LLM-driven Knowledge Tree with Tree-of-Thought Capabilities**

[![Online Demo](https://img.shields.io/badge/Online-Demo-blue)](http://deepr.wiki)  
Original Repo: [lks-ai/deeper](https://github.com/lks-ai/deeper)

---

## Overview

Deepr Wiki is a local knowledge management tool driven by large language models. It allows you to build, navigate, and reason over full trees of knowledge with advanced tree-of-thought capabilities. It’s designed for study, research, and personal knowledge management—all while keeping your data local for enhanced privacy.

---

## Benefits

- **Enhanced Research & Study:** Quickly navigate and explore your knowledge base.
- **Portability:** Organize and export knowledge trees easily.
- **Time-Saving:** Automates parts of your reasoning process.
- **Privacy:** All data runs locally in a closed network.
- **LLM-Enhanced:** Add advanced reasoning to any OpenAI-compatible language model.

---

## Features

- **Fully Local Execution:** Runs entirely on your machine.
- **Flexible Tree Structures:** Create full trees with any type of content.
- **Intuitive, Mobile-Friendly UI:** Designed for both desktop and mobile users.
- **LLM Integration:** Easily plug in any LLM; by default uses OpenRouter but supports any OpenAI-compatible endpoint.
- **Save & Load:** Persist your trees and branches.
- **Prompt History:** Quickly repeat prompts with easy access to prompt history.
- **Tree Graph Visualization:** Visual representation of your knowledge structure.
- **Code Block & Markdown Enhancements:** Includes copy functions and cleanup for code blocks.
- **User-Friendly Navigation:** Hash-based navigation, UUIDs for nodes, and smooth mobile interactions.
- **Cross-Branch Linking:** Easily link related branches.
- **Auto-Revisions & Peer Updates:** Features for automated branch editing and content-based rewrites.
- **Privacy & Security:** No data leaves your local network.

---

## Setup

### Environment Variables

Create a `.env` file in the project root to configure your API endpoints and keys. For example, to use OpenRouter:

```dotenv
# LLM API (any OpenAI-compatible API)

PROWL_VLLM_ENDPOINT=https://openrouter.ai/api
PROWL_MODEL=qwen/qwen-2.5-7b-instruct
# For hosted services that require an API key:
PROWL_VENDOR_API_KEY=sk...

## AUTH

# For User Accounts managed by Auth providers like supabase/firebase
JWT_SECRET_KEY=za1O...
JWT_ALGORITHM=HS256
JWT_UID_FIELD=sub

# For Supabase Auth
SUPABASE_URL=https://{supabase_project_id}.supabase.co
SUPABASE_ANON_KEY=ey...

```

You can refer to `placeholder.env` for a sample configuration.

---

## Installation

Clone the repository and install the dependencies. These steps work on Linux, macOS, and Windows (using a terminal or Command Prompt).

```sh
git clone https://github.com/lks-ai/deeper.git
cd deeper
pip install -r requirements.txt
```

---

## Getting Started

After installing, start the server by running:

```sh
python serve.py
```

Then open your browser and navigate to [http://0.0.0.0:8123](http://0.0.0.0:8123).

---

## Roadmap / TODO

Below is a list of planned features and improvements. Checkmarks (✅) indicate completed items.

### UI Enhancements
- ✅ Swipe left/right: Navigate among peers and between parent/child nodes.
- ✅ Model selection (Agents).
- in-UI agent prompt controls.
- ✅ Hash-based navigation (syncs browser history with UX).
- ✅ Nodes assigned UUIDs.
- ✅ Thought View Breakdown.
- ✅ Download tree files.
- ✅ Share link functionality via hash-based loading.
- User accounts and folder management.
- Node tagging and quick search.
- ✅ Remapping links and concurrent body rewrite queue.
- Multilingual support.
- ✅ Download to Document
- Upload and Extract Document Structure
- Drag & Drop multimodality for modal inputs.
- ✅ Code block cleanup with copy function.
- ✅ Fix prompt history selection on mobile.
- ✅ Properly display multiline metadata.
- Tree selector widget for branch selection.
- Context toolbar functions
    - Move
    - Copy/Paste
- Main toolbar functions
    - Regenerate Branch (special paste that uses a copied branch) 
- ✅ Update button to reference current node's content for revision.
- JS-based tree diff and tregex integration.
- ✅ Prevent user from leaving the page accidentally.
- Use parent.id on hierarchyEditor serialization.
- ✅ Enable text selection to trigger prompts.
- Cross-branch linking (add select box for branches).
- ✅ Write config to the root node on save.
- ✅ Multi-directional rewriting (based on children/peers).
- Automated branch editing (simple and content-based rewriting).
- ✅ Link-based RAG (LRAG?) for context recall.
- ✅ Reverse rewrites on peers (asynchronous editing).
- ✅ Branch Traversal for branch templates
- Filtered path search for agents (only return nodes of condition)
- Agent *Workers*: agents for each node can further think and refine their content based on changing context
- Audio input, Document input: with the ability to chunk/summarize and then organize that into a tree
- Auto-Propagation and Auto-Growth: respectively having it modify a message through a branch to the leaves or having it self-reply (either naively or using an LLM task)
- ✅ Showing who else is in the tree

### Server-Side Enhancements
- Web search capability.
- Integrated web browser tool.
- Finish Agent prompts for various roles (coder, roleplayer, etc.).
- Tree-based prompt templates (for grafting or regeneration).
- Multi-directional context stacking (beyond the simple root-to-leaf path).
- Safe handling of multimedia/HTML content.
- Auto-agent switching.
- ✅ User Accounts.
- ✅ WebSockets for collaboration and background processing.
- Add sockets buffer for "syncing from load" on a client who's late to the party
- ✅ Pypandoc based Export (Tree -> Docx) and (Docx -> Tree)**
- Workspaces based storage for user colaboration and sharing
    - includes user permissions, visibility, etc. for each tree

---

## Contributing

Contributions are welcome! Please open an issue or submit a pull request with your improvements or bug fixes.

