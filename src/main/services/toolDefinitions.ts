import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export const toolDefinitions: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'readContent',
      description: 'Read the full document content',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
    {
      type: 'function',
      function: {
        name: 'editContent',
        description: 'Replace the ENTIRE document content with new HTML. RISK: overwrites everything — all existing content is lost. Use only for full rewrites or when other tools are insufficient. Content must be HTML. Use <p> for paragraphs (double newline between paragraphs), <br> for line breaks within paragraphs, <strong> for bold, <em> for italic, <h1>/<h2> for headings, <blockquote> for quotes, <ul>/<ol>/<li> for lists.',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'New HTML content for the entire document. Wrap paragraphs in <p> tags. Example: <p>First paragraph.</p><p>Second paragraph.</p>' },
          },
          required: ['content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'editRange',
        description: 'Find and replace a specific text segment in the document. RISK: low — only the matched text is changed, surrounding content is preserved. Use empty find string to insert content at the end. The replacement MUST be HTML — wrap each paragraph in <p> tags. Example: <p>First paragraph.</p><p>Second paragraph.</p>',
        parameters: {
          type: 'object',
          properties: {
            find: { type: 'string', description: 'The exact text to find and replace (must match content in the document exactly, including HTML tags). Use empty string to insert content at the end.' },
            replace: { type: 'string', description: 'The replacement HTML text. Wrap each paragraph in <p> tags. Example: <p>First paragraph.</p><p>Second paragraph.</p>' },
          },
          required: ['find', 'replace'],
        },
      },
    },
  {
    type: 'function',
    function: {
      name: 'getCharacters',
      description: 'List all characters with their descriptions',
      parameters: {
        type: 'object',
        properties: {
          bookId: { type: 'string', description: 'Optional target book ID. Required if there is no active current book.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'addCharacter',
      description: 'Create a new character',
      parameters: {
        type: 'object',
        properties: {
          bookId: { type: 'string', description: 'Optional target book ID. Required if there is no active current book.' },
          name: { type: 'string', description: 'The character name' },
          description: { type: 'string', description: 'A description of the character' },
          attributes: {
            type: 'array',
            description: 'Optional key-value attribute groups (e.g., skills, inventory, personality traits)',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string', description: 'Attribute group name (e.g., "Skills", "Inventory", "Personality")' },
                values: { type: 'array', items: { type: 'string' }, description: 'List of values in this group' },
              },
              required: ['key', 'values'],
            },
          },
        },
        required: ['name', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchContent',
      description: 'Search across the full document content for a query string. Returns matching sections with preview snippets and total matches across the book.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listBooks',
      description: 'List all books in the current project. Returns book IDs and titles.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getProjectStructure',
      description: 'Get the current project structure: project name plus all books with their IDs and titles. Use this before createBook when the user may be referring to an existing book.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createBook',
      description: 'Create one new book in the current project. If a book with the same title already exists, returns that existing book instead of creating a duplicate. Returns a book ID; pass that bookId to book-scoped tools.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The book title' },
          description: { type: 'string', description: 'Optional description of the book' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getBookStructure',
      description:
        'Get the full book structure (chapters and pages). Pass bookId to get a specific book, or omit for the current book.',
      parameters: {
        type: 'object',
        properties: {
          bookId: {
            type: 'string',
            description: 'Optional book ID. If omitted, returns the current book.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getCharacter',
      description: 'Get full details of a specific character by ID',
      parameters: {
        type: 'object',
        properties: {
          characterId: { type: 'string' },
        },
        required: ['characterId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getEvents',
      description: 'List all events, optionally filtered by type',
      parameters: {
        type: 'object',
        properties: {
          bookId: { type: 'string', description: 'Optional target book ID. Required if there is no active current book.' },
          filter: { type: 'string', description: 'Filter by event type: major, minor, or background' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'addEvent',
      description: 'Create a new story event',
      parameters: {
        type: 'object',
        properties: {
          bookId: { type: 'string', description: 'Optional target book ID. Required if there is no active current book.' },
          title: { type: 'string' },
          description: { type: 'string' },
          eventType: { type: 'string', enum: ['major', 'minor', 'background'] },
          timestamp: { type: 'string', description: 'In-story chronological time' },
          characters: { type: 'array', items: { type: 'string' }, description: 'Character IDs involved' },
          locations: {
            type: 'array',
            description: 'Text locations in the book where this event occurs. Each has pageId, startLine, endLine.',
            items: {
              type: 'object',
              properties: {
                pageId: { type: 'string' },
                startLine: { type: 'number' },
                endLine: { type: 'number' },
              },
              required: ['pageId', 'startLine', 'endLine'],
            },
          },
        },
        required: ['title', 'description', 'eventType'],
      },
    },
  },
  {
    type: 'function',
    function: {
        name: 'appendToContent',
        description: 'Append HTML content to the END of the document. RISK: minimal — existing content is never modified, only new content is added. Use <p> for paragraphs.',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'HTML content to append. Wrap paragraphs in <p> tags.' },
        },
        required: ['content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'editCharacter',
      description: 'Update an existing character\'s name, description, or attributes',
      parameters: {
        type: 'object',
        properties: {
          characterId: { type: 'string', description: 'The character ID to update' },
          name: { type: 'string', description: 'New name (optional)' },
          description: { type: 'string', description: 'New description (optional)' },
          attributes: {
            type: 'array',
            description: 'Replace all attribute groups with this list (optional)',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string', description: 'Attribute group name' },
                values: { type: 'array', items: { type: 'string' }, description: 'List of values in this group' },
              },
              required: ['key', 'values'],
            },
          },
        },
        required: ['characterId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteCharacter',
      description: 'Delete a character by ID',
      parameters: {
        type: 'object',
        properties: {
          characterId: { type: 'string', description: 'The character ID to delete' },
        },
        required: ['characterId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'editEvent',
      description: 'Update an existing event\'s title, description, or type',
      parameters: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'The event ID to update' },
          title: { type: 'string', description: 'New title (optional)' },
          description: { type: 'string', description: 'New description (optional)' },
          eventType: { type: 'string', enum: ['major', 'minor', 'background'], description: 'New type (optional)' },
          locations: {
            type: 'array',
            description: 'Text locations in the book where this event occurs. Each has pageId, startLine, endLine.',
            items: {
              type: 'object',
              properties: {
                pageId: { type: 'string' },
                startLine: { type: 'number' },
                endLine: { type: 'number' },
              },
              required: ['pageId', 'startLine', 'endLine'],
            },
          },
        },
        required: ['eventId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteEvent',
      description: 'Delete an event by ID',
      parameters: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'The event ID to delete' },
        },
        required: ['eventId'],
      },
    },
  },
  {
    type: 'function',
    function: {
        name: 'deleteChapter',
        description: 'Remove a chapter heading from the document by matching its title text. RISK: medium — removes the heading element; content under it is not deleted but may become orphaned.',
      parameters: {
        type: 'object',
        properties: {
          chapterTitle: { type: 'string', description: 'The exact title text of the chapter heading to remove (e.g., "Chapter 1: The Beginning")' },
        },
        required: ['chapterTitle'],
      },
    },
  },
  {
    type: 'function',
    function: {
        name: 'insertChapter',
        description: 'Insert a chapter heading marker at the current position in the document. RISK: low — adds a heading without modifying existing content. Creates a formatted chapter heading (e.g., "# Chapter Title").',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The chapter title text' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getPlan',
      description: 'Returns the full plan model with all nodes and edges',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getPlanNode',
      description: 'Returns a single plan node by its ID',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'The node ID to retrieve' },
        },
        required: ['nodeId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'addPlanNode',
      description: 'Creates a new plan node (chapter/scene/beat/note). Use this for story planning/outlining; pass bookId when planning a newly created or selected book.',
      parameters: {
        type: 'object',
        properties: {
          bookId: { type: 'string', description: 'Optional target book ID. Required if there is no active current book.' },
          type: { type: 'string', enum: ['chapter', 'scene', 'beat', 'note'], description: 'Node type' },
          label: { type: 'string', description: 'Display label for the node' },
          description: { type: 'string', description: 'Optional description' },
          status: { type: 'string', enum: ['draft', 'in_progress', 'complete', 'cut'], description: 'Node status (default: draft)' },
          level: { type: 'string', enum: ['act', 'chapter'], description: 'Hierarchical level for chapter type nodes' },
          subplotId: { type: 'string', description: 'Subplot ID for grouping beat type nodes' },
          x: { type: 'number', description: 'Optional X position in the canvas. Omit to auto-place in a non-overlapping lane.' },
          y: { type: 'number', description: 'Optional Y position in the canvas. Omit to auto-place in a non-overlapping lane.' },
        },
        required: ['type', 'label'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updatePlanNode',
      description: 'Partially updates an existing plan node',
      parameters: {
        type: 'object',
        properties: {
          bookId: { type: 'string', description: 'Optional target book ID. Required if there is no active current book.' },
          nodeId: { type: 'string', description: 'The node ID to update' },
          label: { type: 'string', description: 'New label' },
          description: { type: 'string', description: 'New description' },
          status: { type: 'string', enum: ['draft', 'in_progress', 'complete', 'cut'], description: 'New status' },
          level: { type: 'string', enum: ['act', 'chapter'], description: 'New level' },
          subplotId: { type: 'string', description: 'New subplot ID' },
          notes: { type: 'string', description: 'Free-form notes' },
          characters: { type: 'array', items: { type: 'string' }, description: 'Character IDs involved' },
        },
        required: ['nodeId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deletePlanNode',
      description: 'Deletes a plan node and all edges connected to it',
      parameters: {
        type: 'object',
        properties: {
          bookId: { type: 'string', description: 'Optional target book ID. Required if there is no active current book.' },
          nodeId: { type: 'string', description: 'The node ID to delete' },
        },
        required: ['nodeId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'connectPlanNodes',
      description: 'Creates a directed edge between two plan nodes',
      parameters: {
        type: 'object',
        properties: {
          bookId: { type: 'string', description: 'Optional target book ID. Required if there is no active current book.' },
          sourceId: { type: 'string', description: 'The source node ID' },
          targetId: { type: 'string', description: 'The target node ID' },
          type: { type: 'string', enum: ['follows', 'causes', 'conflicts', 'resolves'], description: 'Edge type (default: follows)' },
          label: { type: 'string', description: 'Optional edge label' },
        },
        required: ['sourceId', 'targetId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'disconnectPlanNodes',
      description: 'Removes an edge between plan nodes by edge ID',
      parameters: {
        type: 'object',
        properties: {
          bookId: { type: 'string', description: 'Optional target book ID. Required if there is no active current book.' },
          edgeId: { type: 'string', description: 'The edge ID to remove' },
        },
        required: ['edgeId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createTask',
      description: 'Create a task in the task queue for long-running autonomous work. Use this to break down complex requests into trackable steps.',
      parameters: {
        type: 'object',
        properties: {
          displayName: { type: 'string', description: 'Short label shown in the task list (e.g. "Rename characters")' },
          content: { type: 'string', description: 'Full description of what needs to be done' },
        },
        required: ['displayName', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'completeTask',
      description: 'Mark a task as completed after finishing it',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'The task ID to mark as completed' },
        },
        required: ['taskId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getTasks',
      description: 'Get the current task list with statuses',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delegateToSubAgent',
      description: 'Delegate a task to a sub-agent that runs autonomously in the background with its own model and system prompt. Returns a runId immediately. Use getSubAgentResult later to check on it. Give the sub-agent a creative name (human name, fantasy name, whatever fits).',
      parameters: {
        type: 'object',
        properties: {
          subAgentId: { type: 'string', description: 'The sub-agent ID to delegate to' },
          task: { type: 'string', description: 'The task description for the sub-agent to execute' },
          agentName: { type: 'string', description: 'A creative name for this agent instance (e.g. "Elena", "Shadow Scribe", "Captain Quill"). Any name you choose.' },
          context: {
            type: 'array',
            description: 'What context to pass to the sub-agent. Only include what\'s needed to avoid bloating the prompt.',
            items: {
              type: 'string',
              enum: ['bookStructure', 'characters', 'events', 'plan', 'worldData'],
            },
          },
        },
        required: ['subAgentId', 'task'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listSubAgents',
      description: 'List all configured sub-agents with their names and descriptions',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getSubAgentResult',
      description: 'Get the result of a sub-agent run by its runId. Returns the run status, result text, and messages.',
      parameters: {
        type: 'object',
        properties: {
          runId: { type: 'string', description: 'The run ID returned by delegateToSubAgent' },
        },
        required: ['runId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'awaitSubAgentResult',
      description: 'Wait for a sub-agent run to complete and get its result. Use this after delegateToSubAgent when you need the result before continuing. Blocks until the sub-agent finishes.',
      parameters: {
        type: 'object',
        properties: {
          runId: { type: 'string', description: 'The run ID returned by delegateToSubAgent' },
        },
        required: ['runId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getWorldData',
      description: 'List all world data entries (locations, factions, lore, magic systems, etc.)',
      parameters: {
        type: 'object',
        properties: {
          bookId: { type: 'string', description: 'Optional target book ID. Required if there is no active current book.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getWorldDataEntry',
      description: 'Get full details of a specific world data entry by ID',
      parameters: {
        type: 'object',
        properties: {
          worldDataId: { type: 'string', description: 'The world data entry ID' },
        },
        required: ['worldDataId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'addWorldData',
      description: 'Create a new world data entry (location, faction, magic system, lore, etc.)',
      parameters: {
        type: 'object',
        properties: {
          bookId: { type: 'string', description: 'Optional target book ID. Required if there is no active current book.' },
          name: { type: 'string', description: 'Name of the world data entry' },
          shortDescription: { type: 'string', description: 'Brief description for list previews' },
          content: { type: 'string', description: 'Detailed content (no length limit)' },
          category: { type: 'string', description: 'Category like \'place\', \'organization\', \'faction\', \'artifact\', \'lore\', etc.' },
          attributes: { type: 'array', description: 'Key-value attributes like {key: \'Population\', value: \'1200\'}', items: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key', 'value'] } },
          aliases: { type: 'array', description: 'Alternative names', items: { type: 'string' } },
          tags: { type: 'array', description: 'Tags for filtering', items: { type: 'string' } },
        },
        required: ['name', 'shortDescription', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'editWorldData',
      description: 'Update an existing world data entry',
      parameters: {
        type: 'object',
        properties: {
          worldDataId: { type: 'string', description: 'The world data entry ID to update' },
          name: { type: 'string', description: 'New name (optional)' },
          shortDescription: { type: 'string', description: 'New short description (optional)' },
          content: { type: 'string', description: 'New content (optional)' },
          category: { type: 'string', description: 'New category (optional)' },
          attributes: { type: 'array', description: 'New key-value attributes (optional)', items: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key', 'value'] } },
          aliases: { type: 'array', description: 'New aliases (optional)', items: { type: 'string' } },
          tags: { type: 'array', description: 'New tags (optional)', items: { type: 'string' } },
        },
        required: ['worldDataId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteWorldData',
      description: 'Delete a world data entry by ID',
      parameters: {
        type: 'object',
        properties: {
          worldDataId: { type: 'string', description: 'The world data entry ID to delete' },
        },
        required: ['worldDataId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'addRelation',
      description: 'Create a relation between two entities (character\u2194character, character\u2194event, worldData\u2194event, etc.)',
      parameters: {
        type: 'object',
        properties: {
          bookId: { type: 'string', description: 'Optional target book ID' },
          fromType: { type: 'string', enum: ['character', 'event', 'worldData', 'page', 'chapter'], description: 'Source entity type' },
          fromId: { type: 'string', description: 'Source entity ID' },
          toType: { type: 'string', enum: ['character', 'event', 'worldData', 'page', 'chapter'], description: 'Target entity type' },
          toId: { type: 'string', description: 'Target entity ID' },
          type: { type: 'string', description: 'Relation type, e.g. "ally", "enemy", "affected_by", "located_in", "member_of", "owns", "heard_of"' },
          label: { type: 'string', description: 'Short human-readable label for the relation (optional)' },
          description: { type: 'string', description: 'Description of the relation' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Tags for filtering (optional)' },
        },
        required: ['fromType', 'fromId', 'toType', 'toId', 'type', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'editRelation',
      description: 'Update an existing relation',
      parameters: {
        type: 'object',
        properties: {
          relationId: { type: 'string', description: 'The relation ID to update' },
          type: { type: 'string', description: 'New relation type (optional)' },
          label: { type: 'string', description: 'New label (optional)' },
          description: { type: 'string', description: 'New description (optional)' },
          tags: { type: 'array', items: { type: 'string' }, description: 'New tags (optional)' },
        },
        required: ['relationId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteRelation',
      description: 'Delete a relation by ID',
      parameters: {
        type: 'object',
        properties: {
          relationId: { type: 'string', description: 'The relation ID to delete' },
        },
        required: ['relationId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getRelations',
      description: 'List all relations in the current book',
      parameters: {
        type: 'object',
        properties: {
          bookId: { type: 'string', description: 'Optional target book ID' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getEntityRelations',
      description: 'Get all relations involving a specific entity (outgoing and incoming)',
      parameters: {
        type: 'object',
        properties: {
          entityType: { type: 'string', enum: ['character', 'event', 'worldData', 'page', 'chapter'], description: 'Entity type' },
          entityId: { type: 'string', description: 'Entity ID' },
        },
        required: ['entityType', 'entityId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchRelations',
      description: 'Search relations by type, description, or entity name',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listSkills',
      description: 'List all writing skills with their names and short descriptions. Use this to find a skill that matches the current task before implementing yourself.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getSkill',
      description: 'Get the full instructions of a specific writing skill by its ID. Call this after listSkills to load the skill\'s instructions before executing a task it covers.',
      parameters: {
        type: 'object',
        properties: {
          skillId: { type: 'string', description: 'The skill ID' },
        },
        required: ['skillId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createSkill',
      description: 'Create a new writing skill when the user describes a writing style, genre approach, or repeatable workflow. Name max 48 chars, description max 128 chars.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Short skill name (max 48 chars)' },
          description: { type: 'string', description: 'Brief summary of what this skill does (max 128 chars)' },
          instructions: { type: 'string', description: 'Full instructions the agent should follow when this skill is active' },
        },
        required: ['name', 'instructions'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createSubAgent',
      description: 'Create a new sub-agent when the user wants a specialized autonomous agent for a recurring task. Name max 48 chars, description max 128 chars. The sub-agent gets its own model and system prompt.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Short agent name (max 48 chars)' },
          description: { type: 'string', description: 'Brief summary of what this agent does (max 128 chars)' },
          systemPrompt: { type: 'string', description: 'Full system prompt defining the agent\'s role and behavior' },
        },
        required: ['name', 'description', 'systemPrompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateSkill',
      description: 'Update an existing writing skill. Pass only the fields to change.',
      parameters: {
        type: 'object',
        properties: {
          skillId: { type: 'string', description: 'The skill ID to update' },
          name: { type: 'string', description: 'New name (max 48 chars)' },
          description: { type: 'string', description: 'New description (max 128 chars)' },
          instructions: { type: 'string', description: 'New instructions' },
        },
        required: ['skillId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteSkill',
      description: 'Delete a writing skill by ID.',
      parameters: {
        type: 'object',
        properties: {
          skillId: { type: 'string', description: 'The skill ID to delete' },
        },
        required: ['skillId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateSubAgent',
      description: 'Update an existing sub-agent. Pass only the fields to change.',
      parameters: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: 'The agent ID to update' },
          name: { type: 'string', description: 'New name (max 48 chars)' },
          description: { type: 'string', description: 'New description (max 128 chars)' },
          systemPrompt: { type: 'string', description: 'New system prompt' },
        },
        required: ['agentId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteSubAgent',
      description: 'Delete a sub-agent by ID.',
      parameters: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: 'The agent ID to delete' },
        },
        required: ['agentId'],
      },
    },
  },
];
