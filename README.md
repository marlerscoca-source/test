# 🍽️ Mise en Place — Culinary School Editor

A beautiful desktop text editor built for culinary schools. Features a live Markdown editor with culinary autosuggestions, a glossary tooltip system, and an integrated AI assistant.

## Features

- **Project management** — Create new projects on disk with Year 1 / Year 2 folder templates, or open existing project folders
- **Autosave** — All changes are saved to disk automatically 1 second after your last keystroke, no manual saves needed
- **Markdown editor** — CodeMirror 6 with full Markdown syntax highlighting and live preview
- **Culinary autosuggestions** — Type any culinary term (e.g. `brun`, `hollan`, `mise`) and get intelligent autocomplete suggestions from `data/autosuggestions.yaml`
- **Glossary tooltips** — Hover over any culinary term in the preview pane to see its Wikipedia-style definition popup, powered by `data/culinary_terms.yaml`
- **Split / Edit / Preview views** — Toggle between editor-only, split, and preview-only modes
- **AI Chat** — Integrated Chef AI assistant powered by Claude (requires an Anthropic API key)
- **File explorer** — Full project tree with context menus for create, rename, and delete operations

## Requirements

- Node.js 18+ 
- npm 9+

## Installation

```bash
# Clone or copy this folder, then:
cd mise-en-place
npm install
```

## Running in development

```bash
npm run dev
```

This starts the Vite dev server and Electron simultaneously.

## Building for distribution

```bash
npm run build
```

## Customising autosuggestions

Edit `data/autosuggestions.yaml` to add or remove autocomplete words:

```yaml
words:
  - word: "your culinary term"
    category: technique
```

## Customising the glossary

Edit `data/culinary_terms.yaml` to add or modify hover definitions:

```yaml
terms:
  - word: "your term"
    category: "Category"
    definition: >
      Your full definition here. This will appear as a tooltip
      when hovering over the term in the preview pane.
```

## AI Chat setup

Click the ⚙️ icon in the chat panel and enter your Anthropic API key (`sk-ant-...`).  
The key is stored locally in your browser's localStorage — it never leaves your machine.

Get an API key at [console.anthropic.com](https://console.anthropic.com).

## Project structure created on disk

When you create a new project, the following structure is written to the selected folder:

```
YourProjectName/
├── Year1/
│   ├── Lessons/
│   │   └── Work.md          ← Pre-filled lesson template
│   └── PracticalWork/
│       └── README.md
└── Year2/
    ├── Lessons/
    │   └── Work.md          ← Pre-filled lesson template
    └── PracticalWork/
        └── README.md
```

## Tech stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 31 |
| UI framework | React 18 + Vite |
| Editor | CodeMirror 6 (@uiw/react-codemirror) |
| Markdown render | react-markdown + remark-gfm |
| Data files | YAML (parsed with the `yaml` package) |
| AI | Anthropic Claude API |
