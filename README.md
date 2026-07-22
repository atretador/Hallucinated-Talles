# Hallucinated Talles

> AI-powered writing studio for authors — organize chapters, characters, events, and world data with intelligent assistance.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](package.json)
[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron)](https://electronjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)

## Features

### Rich Text Editor
- WYSIWYG editing powered by TipTap with page-based manuscript view
- Formatting toolbar (bold, italic, headings, lists, blockquotes)
- Chapter tree with collapsible acts and chapters
- Auto-save, font size picker, and zoom control
- Page-based pagination with visual page breaks

### AI-Powered Chat
- Streaming chat with real-time token-by-token display
- Thinking/reasoning display for chain-of-thought models
- Tool call visualization with inline results
- Pending edit accept/reject workflow with diff viewer
- Commit timeline tracking all AI-made changes
- Session management (create, switch, fork, archive, delete)
- Task queue for long-running autonomous work

### AI Inline Editing
- Select text in editor → AI rewrites, tweaks, or removes inline
- Diff viewer for proposed changes with accept/reject per edit

### Character Management
- Full character profiles with name, aliases, description
- Grouped attributes (personality, skills, inventory, etc.)
- Character timeline with appearances and impact tracking
- Character relations (ally, enemy, family, mentor, romantic)
- Story points with significance ratings
- Introduction tracking (first appearance)

### Event Tracking
- Story events with type classification (major, minor, background)
- In-story chronological timestamps
- Character associations and text location tracking
- Consequences tracking and sort order management

### World Data
- Unlimited world-building entries (locations, factions, lore, artifacts, magic systems)
- Categories: place, organization, faction, culture, artifact, system, lore, species, resource, technology, magic, cultivation
- Key-value attributes, aliases, tags, and rich content

### Cross-Entity Relations
- First-class relations between any entity types
- Relation types: ally, enemy, affected_by, located_in, member_of, owns, heard_of
- Labels, descriptions, and tags per relation

### Story Planner
- Visual node-graph canvas (React Flow + Dagre auto-layout)
- Node types: Chapter, Scene, Beat, Note
- Edge types: follows, causes, conflicts, resolves
- Node statuses: draft, in_progress, complete, cut
- AI generation from plan (generates chapters from plan nodes)

### Import & Export
- **Import**: PDF, DOCX, ODT, TXT with AI-powered entity extraction
- **Export**: PDF (custom page size, margins, fonts, covers) and plain text
- Book covers with front/back images (A4 at 300 DPI)

### Writing Skills
- Markdown-based skill definitions with YAML frontmatter
- Three scopes: built-in, global, project-local
- Toggle active skills per session
- Skills inject instructions into AI system prompt

### Sub-Agents
- User-defined specialized AI agents with custom system prompts
- Default + fallback model chains
- Delegated task execution from main agent
- Configurable iteration limits and per-session run tracking

### MCP (Model Context Protocol)
- Connect to external MCP servers via stdio transport
- Tool discovery, namespacing, and automatic reconnection
- Unified tool merging for OpenAI function calling

### Token Usage Analytics
- KPI cards: total tokens, avg tokens/session, cache hit rate
- Usage over time and model distribution charts
- Detailed token table with filtering by date, model, project, source

### Multi-Language Support
| Language | Code |
|----------|------|
| English | `en` |
| Español | `es` |
| Português (Brasil) | `pt-BR` |
| 简体中文 | `zh-CN` |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Electron 33 |
| Bundler | electron-vite 5, Vite 8 |
| Frontend | React 19, TypeScript 6 |
| Styling | Tailwind CSS 4 |
| State | Zustand 5 + Zundo (undo/redo) |
| Editor | TipTap 3 |
| Graph | @xyflow/react 12 + Dagre |
| Charts | Recharts 3 |
| AI | OpenAI SDK 6 (compatible with Ollama, OpenRouter, DeepSeek, etc.) |
| MCP | @modelcontextprotocol/sdk 1.29 |
| PDF | pdf-parse 2 (import), Electron printToPDF (export) |
| DOCX | mammoth + Turndown |
| i18n | i18next 26 + react-i18next 17 |
| Backend | Express 4 (embedded in main process) |
| Testing | Vitest + Testing Library |
| Linting | Oxlint |
| Formatting | Prettier |
| Packaging | electron-builder 25 |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- npm 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/atretador/Hallucinated-Talles.git
cd Hallucinated-Talles

# Install dependencies
npm install
```

### Development

```bash
# Start the development server
npm run dev
```

This launches the Electron app with hot module replacement.

### Building

```bash
# Build for production
npm run build

# Package for distribution
npm run package
```

Output will be in the `release/` directory:
- **macOS**: `.dmg`
- **Windows**: NSIS installer (`.exe`)
- **Linux**: `.AppImage`

## Project Structure

```
story_teller/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # App entry, window creation, IPC
│   │   ├── menu.ts              # Native menu
│   │   ├── mcp/                 # MCP client integration
│   │   ├── server/              # Embedded Express API server
│   │   ├── services/            # Backend services (AI, import, export, etc.)
│   │   └── utils/               # Utilities
│   ├── preload/                 # Context bridge (IPC)
│   ├── renderer/                # Frontend (React)
│   │   └── src/
│   │       ├── App.tsx          # Root component
│   │       ├── stores/          # Zustand state slices
│   │       ├── components/      # UI components
│   │       ├── editor/          # TipTap extensions
│   │       ├── hooks/           # Custom React hooks
│   │       ├── api/             # API client modules
│   │       └── utils/           # Frontend utilities
│   └── shared/                  # Shared types & constants
├── landing-page/                # Marketing website
├── build/                       # App icons
└── package.json
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run start` | Start the packaged app |
| `npm run test` | Run tests |
| `npm run lint` | Lint with Oxlint |
| `npm run format` | Format with Prettier |
| `npm run package` | Package for distribution |

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style (Prettier + Oxlint)
- Write tests for new features when applicable
- Update documentation if changing public APIs
- Keep commits focused and well-described

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Electron](https://electronjs.org) - Cross-platform desktop framework
- [React](https://react.dev) - UI library
- [TipTap](https://tiptap.dev) - Rich text editor
- [React Flow](https://reactflow.dev) - Node-based graphs
- [OpenAI](https://openai.com) - AI API compatibility
- [Model Context Protocol](https://modelcontextprotocol.io) - MCP integration
