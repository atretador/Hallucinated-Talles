import type { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { AiService } from '../services/aiService';
import { FileService } from '../services/fileService';
import { ImportService } from '../services/importService';
import { tokenUsageService, mcpClientManager } from './serverState';
import { resolveProjectTitle } from './utils';
import { generateId } from '../utils/idGenerator';
import { getActiveMcpServerIds } from '../services/settings';
import { mergeTools } from '../mcp/toolMerger';
import { toolDefinitions } from '../services/toolDefinitions';
import { setMcpToolCaller, executeToolCall } from '../services/toolExecutor';
import type { AiEffort, ImportState } from '../../shared/types';
import type { ChatCompletionMessageParam, ChatCompletionChunk } from 'openai/resources/chat/completions';

/**
 * SSE streaming endpoint for /api/import.
 * Imports a document file (PDF, DOCX, ODT, TXT) into a book with entity extraction.
 */
export async function handleImportStream(
  req: Request,
  res: Response,
  aiService: AiService,
): Promise<void> {
  const { bookName, filePath: inputFilePath, startPage, providerId, model, effort, chapterHints } = req.body;
  let { endPage } = req.body;

  // AI-configured guard
  if (!aiService.isConfigured()) {
    res.status(400).json({ success: false, error: 'AI service is not configured' });
    return;
  }

  if (!bookName || !inputFilePath) {
    res.status(400).json({ success: false, error: 'bookName and filePath are required' });
    return;
  }

  // File validation — check existence and extension
  const resolvedPath = path.resolve(inputFilePath);
  const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.odt', '.txt'];
  const ext = path.extname(resolvedPath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    res.status(400).json({ success: false, error: `Unsupported file extension: ${ext}. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}` });
    return;
  }
  let stats: fs.Stats;
  try {
    stats = fs.statSync(resolvedPath);
  } catch {
    res.status(400).json({ success: false, error: 'File not found' });
    return;
  }
  if (stats.isDirectory()) {
    res.status(400).json({ success: false, error: 'Path is a directory, not a file' });
    return;
  }

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send SSE keepalive pings every 15s
  const keepAliveInterval = setInterval(() => {
    try { res.write(': keepalive\n\n'); } catch { console.debug('[importStream] Connection closed'); /* connection closed */ }
  }, 15000);

  const abortController = new AbortController();
  let importAborted = false;
  const cleanup = () => {
    clearInterval(keepAliveInterval);
  };
  res.on('close', () => {
    importAborted = true;
    abortController.abort();
    cleanup();
  });
  res.on('error', () => {
    // Socket errors (ECONNRESET) — cleanup silently
  });

  let bookFileService: FileService | undefined;
  let importState: ImportState | undefined;

  try {
    // Parse the file
    const importService = new ImportService();
    res.write(`event: status\ndata: ${JSON.stringify({ status: 'parsing', message: 'Parsing file...' })}\n\n`);

    const parsedBook = await importService.parseFile(inputFilePath);

    // M1: Validate parsed book pages before proceeding
    if (!parsedBook.pages || parsedBook.pages.length === 0) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'No pages were found in the parsed file. The file may be empty or unreadable.' })}\n\n`);
      cleanup();
      res.end();
      return;
    }
    const effectiveStartPage = startPage || 1;
    if (effectiveStartPage > parsedBook.pages.length) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: `startPage (${effectiveStartPage}) exceeds total pages (${parsedBook.pages.length}).` })}\n\n`);
      cleanup();
      res.end();
      return;
    }
    // Clamp endPage to available pages to avoid silent skip
    if (endPage && endPage > parsedBook.pages.length) {
      endPage = parsedBook.pages.length;
    }

    // Check if book exists, create if not
    let bookId: string;
    try {
      const slugId = bookName.trim().replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '-').toLowerCase();
      const books = await FileService.listBooks(req.projectId);
      const existingBook = books.find(b => b === slugId);
      if (existingBook) {
        bookId = existingBook;
      } else {
        bookId = slugId;
        await FileService.createBook(req.projectId, bookId, bookName);
      }
    } catch {
      bookId = `book-${Date.now()}`;
      await FileService.createBook(req.projectId, bookId, bookName);
    }

    bookFileService = new FileService(req.projectId, bookId);

    // Save extracted settings
    await bookFileService.saveBookSettings(parsedBook.settings);
    res.write(`event: settings\ndata: ${JSON.stringify({ settings: parsedBook.settings, bookId })}\n\n`);

    // Check for existing import state to resume from
    const existingState = await bookFileService.getImportState();
    const canResume =
      existingState &&
      (existingState.status === 'failed' || existingState.status === 'processing') &&
      existingState.sourcePath === inputFilePath;

    if (canResume) {
      // Reuse existing import state — just update fields for the new run
      importState = {
        ...existingState,
        status: 'processing',
        currentPage: existingState.currentPage || 1,
        startPage: (existingState.currentPage || 0) + 1,
        endPage: endPage || existingState.endPage || parsedBook.totalPages,
        providerId: providerId || existingState.providerId || '',
        model: model || existingState.model || '',
        effort: (effort as AiEffort) || existingState.effort || 'medium',
        chapterHints: chapterHints ?? existingState.chapterHints,
        error: undefined,
        updatedAt: new Date().toISOString(),
      };
      await bookFileService.saveImportState(importState);
      res.write(`event: status\ndata: ${JSON.stringify({ status: 'resuming', message: `Resuming from page ${(existingState.currentPage || 0) + 1}` })}\n\n`);
    } else {
      // Create new import state
      importState = {
        id: `import-${Date.now()}`,
        bookId,
        filename: parsedBook.filename,
        sourcePath: inputFilePath,
        chapterHints: chapterHints || '',
        format: parsedBook.format,
        totalPages: parsedBook.totalPages,
        currentPage: startPage || 1,
        startPage: startPage || 1,
        endPage: endPage || parsedBook.totalPages,
        status: 'processing',
        providerId: providerId || '',
        model: model || '',
        effort: effort || 'medium',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await bookFileService.saveImportState(importState);
    }

    // Send progress events for each page
    const actualStartPage = importState.startPage || 1;
    const actualEndPage = importState.endPage || parsedBook.totalPages;
    const rangeTotalPages = actualEndPage - actualStartPage + 1;

    // Set active provider if specified in the request
    if (providerId && model) {
      aiService.setActiveProvider(providerId, model);
    }

    // Pre-flight: verify model server is reachable
    res.write(`event: status\ndata: ${JSON.stringify({ status: 'connecting' })}\n\n`);

    const probe = await aiService.checkConnection();
    if (!probe.ok) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: probe.error })}\n\n`);
      cleanup();
      res.end();
      return;
    }
    res.write(`event: status\ndata: ${JSON.stringify({ status: 'connected' })}\n\n`);

    const projectName = await resolveProjectTitle(req.projectId);

    // Load existing content (if any) as starting point for accumulation
    let accumulatedContent = '';
    try {
      accumulatedContent = await bookFileService.getBookContent();
    } catch {
      // content.html might not exist yet — start empty
    }

    const normalizeImportEntityName = (value: unknown): string => typeof value === 'string'
      ? value.trim().toLowerCase().replace(/\s+/g, ' ')
      : '';

    const importKnown = {
      characters: new Set<string>(),
      events: new Set<string>(),
      worldData: new Set<string>(),
      chapters: new Set<string>(),
    };

    const refreshImportKnown = async () => {
      const [metadata, structure] = await Promise.all([
        bookFileService!.getMetadata(),
        bookFileService!.getBookStructure(),
      ]);

      for (const character of metadata.characters) {
        const nameKey = normalizeImportEntityName(character.name);
        if (nameKey) importKnown.characters.add(nameKey);
        for (const alias of character.aliases) {
          const aliasKey = normalizeImportEntityName(alias);
          if (aliasKey) importKnown.characters.add(aliasKey);
        }
      }
      for (const event of metadata.events) {
        const key = normalizeImportEntityName(event.title);
        if (key) importKnown.events.add(key);
      }
      for (const worldEntry of metadata.worldData) {
        const key = normalizeImportEntityName(worldEntry.name);
        if (key) importKnown.worldData.add(key);
      }
      for (const item of structure.items) {
        if (item.type !== 'chapter') continue;
        const key = normalizeImportEntityName(item.title);
        if (key) importKnown.chapters.add(key);
      }
    };

    const isInvalidWorldDataName = (
      name: unknown,
      pendingCharacterNames = new Set<string>(),
      pendingChapterTitles = new Set<string>(),
    ) => {
      const key = normalizeImportEntityName(name);
      if (!key) return 'World data name is empty';
      if (key === normalizeImportEntityName(bookName)) return 'Book title is not world data';
      if (pendingCharacterNames.has(key)) return 'Character name is being added in this same batch; merge these details into that character on the next turn';
      if (importKnown.chapters.has(key) || pendingChapterTitles.has(key)) return 'Chapter title is not world data';
      return null;
    };

    await refreshImportKnown();

    const sanitizationWarnings: string[] = [];

    for (let page = actualStartPage; page <= actualEndPage; page++) {
      // Check if client disconnected
      if (importAborted) {
        importState.status = 'failed';
        importState.error = 'Client disconnected';
        importState.updatedAt = new Date().toISOString();
        await bookFileService.saveImportState(importState);
        cleanup();
        return;
      }

      const pageData = parsedBook.pages[page - 1];
      if (!pageData) continue;

      const rawPageText = pageData.content;

      const escapeHtml = (value: string) => value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

      const textToEditorHtml = (value: string) => value
        .split(/\n\n+/)
        .filter(p => p.trim())
        .map(p => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
        .join('');

      const interleaveImages = (html: string, imageRefs: string[]) => {
        if (imageRefs.length === 0) return html;
        if (!html) return imageRefs.join('');

        const paragraphs = html.split(/(?<=<\/p>)/).filter(p => p.trim());
        if (paragraphs.length === 0) return `${html}${imageRefs.join('')}`;

        const interval = paragraphs.length / (imageRefs.length + 1);
        const result: string[] = [];
        let imgIdx = 0;

        for (let p = 0; p < paragraphs.length; p++) {
          result.push(paragraphs[p]);
          const insertAt = Math.max(1, Math.round(interval * (imgIdx + 1)));
          if (p + 1 >= insertAt && imgIdx < imageRefs.length) {
            result.push(imageRefs[imgIdx]);
            imgIdx++;
          }
        }

        while (imgIdx < imageRefs.length) {
          result.push(imageRefs[imgIdx]);
          imgIdx++;
        }

        return result.join('');
      };

      // Disk/editor content is HTML. The LLM still receives raw text below.
      const pageTextHtml = parsedBook.format === 'pdf'
        ? textToEditorHtml(rawPageText)
        : rawPageText;

      // Extract embedded PDF images concurrently with LLM processing.
      const imageRefsPromise: Promise<string[]> = parsedBook.format === 'pdf'
        ? importService.extractPdfPageImages(inputFilePath, page)
            .then(async (images) => {
              const refs: string[] = [];
              for (let imgIdx = 0; imgIdx < images.length; imgIdx++) {
                const dataUrl = images[imgIdx];
                const dataUrlParts = dataUrl.split(',');
                const mimeType = dataUrlParts[0]?.match(/data:(.*?);/)?.[1] || 'image/png';
                const base64Data = dataUrlParts[1] || '';
                const imageBuffer = Buffer.from(base64Data, 'base64');

                const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? '.jpg' : '.png';
                const imageFilename = `page-${page}-img-${imgIdx}${ext}`;
                const imageGroupId = `_import_images`;
                const relativePath = await bookFileService!.saveImage(imageGroupId, imageFilename, imageBuffer);
                refs.push(`<img src="/${relativePath}" />`);
              }
              return refs;
            })
            .catch((err: unknown) => {
              console.error(`[Import] Failed to extract images for page ${page}:`, err);
              return [];
            })
        : Promise.resolve([]);

      // Send progress event
      if (!res.destroyed) {
        res.write(`event: progress\ndata: ${JSON.stringify({
          page: page - actualStartPage + 1,
          totalPages: rangeTotalPages,
          message: `Processing page ${page - actualStartPage + 1}/${rangeTotalPages}`,
          content: rawPageText,
        })}\n\n`);
      }

      // Phase 4 — Send page content to LLM agent for extraction
      let pageError: Error | null = null;
      let pageTimedOut = false;
      const firstChunkTimeoutSec = aiService.getSettings().firstChunkTimeoutSec ?? 300;

      try {
        // Build context for this page from existing metadata
        const metadata = await bookFileService.getMetadata();
        const characterSummary = metadata.characters.map(c => {
          const attrStr = c.attributes.length
            ? `\n    Attributes: ${c.attributes.map(a => `${a.key}: ${a.values.join(', ')}`).join('; ')}`
            : '';
          return `- ${c.name} (ID: ${c.id}${c.aliases.length ? `, aliases: ${c.aliases.join(', ')}` : ''}): ${c.description}${attrStr}`;
        }).join('\n');
        const eventSummary = metadata.events.map(e => {
          const charNames = e.characters.map(cid => {
            const ch = metadata.characters.find(c => c.id === cid);
            return ch ? ch.name : cid;
          });
          const charStr = charNames.length ? `\n    Characters: ${charNames.join(', ')}` : '';
          const consStr = e.consequences.length ? `\n    Consequences: ${e.consequences.join('; ')}` : '';
          return `- ${e.title} (ID: ${e.id}, type: ${e.type}): ${e.description}${charStr}${consStr}`;
        }).join('\n');
        const worldSummary = metadata.worldData.map(w =>
          `- ${w.name}: ${w.shortDescription} — ${w.content}`
        ).join('\n');
        const currentBookStructure = await bookFileService.getBookStructure();
        const chapterSummary = currentBookStructure.items
          .filter(item => item.type === 'chapter')
          .map(item => `- ${item.title} (ID: ${item.id})`)
          .join('\n');

        const systemPrompt = `You are reading page ${page} of "${bookName}" during an import process.

Your job — you MUST do ALL of these on EVERY page:
1. Extract ALL characters — appearance, personality, role, relationships, skills, inventory, backstory, anything the text reveals
2. Extract ALL events — what happened, who was involved, where, consequences, significance
3. Extract ALL world data — EVERY location, faction, organization, magic system, creature species, artifact, custom, historical event, or any world-building detail mentioned. This is MANDATORY, not optional.
4. Detect chapter boundaries — if this page starts a NEW chapter that does not already exist, call insertChapter with a descriptive title. Do NOT insert a chapter if the page continues the same chapter from the previous page or repeats an existing chapter heading.
5. For characters/events/world data that already exist, call addCharacter/addEvent/addWorldData again with NEW details only after checking the current lists — they will be merged automatically

NOTE: You do NOT need to write the page text — the server handles that automatically. Your job is ONLY entity extraction and chapter boundary detection.

EXISTING CHARACTERS:
${characterSummary || 'None yet'}

EXISTING EVENTS:
${eventSummary || 'None yet'}

EXISTING WORLD DATA:
${worldSummary || 'None yet'}

EXISTING CHAPTERS:
${chapterSummary || 'None yet'}

The user has provided the following additional instructions:
${chapterHints || '(none provided)'}
Follow these instructions as part of your analysis.

CRITICAL RULES:
- MANDATORY LOOKUP-FIRST WORKFLOW: On every page, your FIRST assistant response must call ONLY these lookup tools: getCharacters, getEvents, getWorldData, and getBookStructure. Do not call addCharacter, addEvent, addWorldData, or insertChapter in the same response as those lookups. Wait for the lookup results, then decide what to add or merge.
- Use the lookup results from this page, not memory alone. Entities may have been added earlier in this import, and the get* tools return the current processing state.
- Before addCharacter: compare against getCharacters results by exact name and aliases. If it already exists, call addCharacter only with genuinely new details so it merges; do not create a second spelling variant.
- Before addEvent: compare against getEvents results by title and meaning. If it is the same event, call addEvent only with new details so it merges; do not create a duplicate event title.
- Before addWorldData: compare against getWorldData, getCharacters, and getBookStructure. NEVER add world data whose name matches a character name/alias, the book title, or a chapter title.
- Before insertChapter: compare against getBookStructure chapter titles. NEVER create a chapter with the same normalized title as an existing chapter, including repeated running headers like "Chapter 1".
- Be VERY detailed. Extract every piece of information about characters: personality traits, physical appearance, skills, fears, motivations, relationships, role in story, inventory, backstory details — anything the text reveals.
- For events: describe what happened in detail, who was involved (by character ID if known), where it happened, what resulted from it, and whether it's a major/minor/background event.
- For world data: EVERY location, faction, organization, magic system, creature, artifact, custom, or world-building detail MUST be registered with addWorldData. If the page mentions any place, group, system, or lore — call addWorldData. Use "category" to classify (place, organization, faction, artifact, lore, etc.). Use "attributes" for compact structured facts. Use "aliases" for alternative names. Use "tags" for filtering. content has no length limit. This is NOT optional. PROHIBITED: Do NOT create world data entries for the book title, chapter titles, character names, or any paraphrase/derivative of them. The book title "${bookName}" and all chapter titles are NEVER world data — even if described as "the setting" or "the world". World data is ONLY for in-universe locations, factions, systems, and lore that exist within the story.
- For relations: Use addRelation to capture connections between entities. If the text says "A trusts B", "X hates Y", "Organization Z opposes Character W", "Village V was affected by Event E" — create a relation. Use getRelations first to avoid duplicates. Use descriptive types (ally, enemy, hostility, trust, affected_by, member_of, etc.) and clear descriptions.
- NEVER invent information. Only extract what is explicitly stated or clearly implied in the text.
- Duplicate detection is automatic as a fallback, but you MUST still do lookup-first and avoid redundant add/create calls when there are no new details.
- If you see a character/event/world data you've seen before, call the add function only when this page adds NEW details — they will be merged automatically.
- Extract ALL characters, events, and world data from this page — be comprehensive. Do not skip any entity type.
- Only call insertChapter when a NEW chapter clearly starts — not for every page
- Do NOT call appendToContent or editContent — the server writes page content automatically`;

        const userMessage = `Page ${page} content:\n\n${rawPageText}`;

        // Prepare messages for LLM
        const messages: ChatCompletionMessageParam[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ];

        // Verify AI is configured
        const config = aiService?.getConfig();
        if (!config) {
          throw new Error('AI not configured');
        }

        let iterations = 0;
        const maxIterations = 5; // Limit tool call iterations per page
        const pageStartTime = Date.now();
        const iterationUsages: NonNullable<ChatCompletionChunk['usage']>[] = [];
        let streamedCompletionChars = 0;
        let streamActiveMs = 0;
        let lastTokenUpdateAt = 0;
        const estimateCompletionTokens = () => Math.max(1, Math.ceil(streamedCompletionChars / 4));

        while (iterations < maxIterations) {
          iterations++;

          // First-chunk timeout to detect stuck model server
          let firstChunkReceived = false;
          const firstChunkTimeout = setTimeout(() => {
            if (!firstChunkReceived) {
              console.error(`[Import] First chunk timeout (${firstChunkTimeoutSec}s)`);
              pageTimedOut = true;
              if (!res.destroyed) {
                res.write(`event: page_error\ndata: ${JSON.stringify({
                  page,
                  error: `Model server did not respond within ${firstChunkTimeoutSec}s. Check that the model server is running and the model name is correct.`,
                })}\n\n`);
              }
              abortController.abort();
            }
          }, firstChunkTimeoutSec * 1000);

          const activeMcpIds = new Set(getActiveMcpServerIds());
          const externalMcpTools = mcpClientManager.getAllTools(activeMcpIds);
          const { tools: mergedTools, lookup: mcpLookup } = mergeTools(toolDefinitions, externalMcpTools);
          setMcpToolCaller((name, args) => mcpClientManager.callTool(name, args), mcpLookup);
          const stream = aiService.chatStream(
            messages,
            mergedTools,
            abortController.signal,
            effort || 'medium',
          );

          let content = '';
          const toolCallsAcc = new Map<number, { id: string; name: string; args: string }>();
          let iterationUsage: ChatCompletionChunk['usage'] | null = null;

          const streamStartedAt = Date.now();
          try {
            for await (const chunk of stream) {
              if (!firstChunkReceived) {
                firstChunkReceived = true;
                clearTimeout(firstChunkTimeout);
              }
              const delta = chunk.choices[0]?.delta;
              let chunkCompletionChars = 0;

              if (delta?.content) {
                content += delta.content;
                chunkCompletionChars += delta.content.length;
              }

              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index;
                  if (!toolCallsAcc.has(idx)) {
                    toolCallsAcc.set(idx, { id: '', name: '', args: '' });
                  }
                  const existing = toolCallsAcc.get(idx)!;
                  if (tc.id) {
                    existing.id = tc.id;
                    chunkCompletionChars += tc.id.length;
                  }
                  if (tc.function?.name) {
                    existing.name = tc.function.name;
                    chunkCompletionChars += tc.function.name.length;
                  }
                  if (tc.function?.arguments) {
                    existing.args += tc.function.arguments;
                    chunkCompletionChars += tc.function.arguments.length;
                  }
                }
              }

              if (chunkCompletionChars > 0) {
                streamedCompletionChars += chunkCompletionChars;
              }

              // Send periodic token updates for live tk/s display
              const now = Date.now();
              if (chunkCompletionChars > 0 && now - lastTokenUpdateAt > 1000 && !res.destroyed) {
                lastTokenUpdateAt = now;
                const elapsedMs = streamActiveMs + (now - streamStartedAt);
                res.write(`event: token_update\ndata: ${JSON.stringify({
                  page: page - actualStartPage + 1,
                  completionTokens: estimateCompletionTokens(),
                  durationMs: Math.max(1, elapsedMs),
                })}\n\n`);
              }

              if (chunk.usage) {
                iterationUsage = chunk.usage;
              }
            }
          } finally {
            streamActiveMs += Date.now() - streamStartedAt;
            clearTimeout(firstChunkTimeout);
          }

          if (streamedCompletionChars > 0 && !res.destroyed) {
            res.write(`event: token_update\ndata: ${JSON.stringify({
              page: page - actualStartPage + 1,
              completionTokens: estimateCompletionTokens(),
              durationMs: Math.max(1, streamActiveMs),
            })}\n\n`);
          }

          if (iterationUsage) {
            iterationUsages.push(iterationUsage);
          }

          // If no tool calls, we're done with this page
          if (toolCallsAcc.size === 0) {
            break;
          }

          const parsedToolCalls = Array.from(toolCallsAcc.values()).map((call) => {
            let parsedArgs: Record<string, unknown>;
            try {
              parsedArgs = JSON.parse(call.args);
            } catch {
              parsedArgs = {};
            }
            return { ...call, parsedArgs };
          });

          const pendingCharacterNames = new Set(
            parsedToolCalls
              .filter(call => call.name === 'addCharacter')
              .map(call => normalizeImportEntityName(call.parsedArgs.name))
              .filter(Boolean),
          );
          const pendingChapterTitles = new Set(
            parsedToolCalls
              .filter(call => call.name === 'insertChapter')
              .map(call => normalizeImportEntityName(call.parsedArgs.title))
              .filter(Boolean),
          );

          // Build assistant message with tool calls for the API
          messages.push({
            role: 'assistant',
            content: content || null,
            tool_calls: parsedToolCalls.map((call) => ({
              id: call.id,
              type: 'function' as const,
              function: {
                name: call.name,
                arguments: call.args,
              },
            })),
          });

          // Execute each tool call
          for (const tc of parsedToolCalls) {
            const args = tc.parsedArgs;

            try {
              const skippedToolResult = (reason: string, extra: Record<string, unknown> = {}) => {
                const result = {
                  skipped: true,
                  reason,
                  instruction: 'Use the current lookup results and call the correct merge/add tool on your next turn if this page contains new details. Do not repeat the skipped tool call unchanged.',
                  ...extra,
                };
                messages.push({
                  role: 'tool',
                  tool_call_id: tc.id,
                  content: JSON.stringify(result),
                });
              };

              if (tc.name === 'insertChapter' || tc.name === 'createChapter') {
                const titleKey = normalizeImportEntityName(args.title);
                if (!titleKey) {
                  skippedToolResult('Chapter title is empty');
                  continue;
                }
                if (importKnown.chapters.has(titleKey)) {
                  skippedToolResult(`Chapter '${args.title as string}' already exists`, {
                    instruction: `Use the existing chapter '${args.title as string}'. Do not call insertChapter for repeated headers or duplicate chapter titles.`,
                  });
                  continue;
                }
              }

              if (tc.name === 'addWorldData') {
                const invalidReason = isInvalidWorldDataName(args.name, pendingCharacterNames, pendingChapterTitles);
                if (invalidReason) {
                  skippedToolResult(invalidReason, {
                    name: args.name,
                    instruction: pendingCharacterNames.has(normalizeImportEntityName(args.name))
                      ? `Merge these details into character '${args.name as string}' after the addCharacter call has completed. Do not create world data for this name.`
                      : 'Extract the actual in-universe place, faction, artifact, system, creature, or lore item instead. Do not create world data for book titles, chapter titles, or character names.',
                  });
                  continue;
                }
              }

              const execResult = await executeToolCall(
                tc.name,
                args,
                bookFileService,
                importState.bookId,
              );

              // Track chapter creation — insert heading into accumulated content
              if ((tc.name === 'insertChapter' || tc.name === 'createChapter') && execResult.commitChange?.type === 'create') {
                const result = execResult.result as Record<string, unknown>;
                if (result?.id && result?.title) {
                  const chapterHeading = `<h1 data-chapter-id="${result.id}">${result.title}</h1>`;
                  accumulatedContent += (accumulatedContent ? '\n\n' : '') + chapterHeading;
                }
              }

              if (execResult.commitChange?.entityType === 'character') {
                const key = normalizeImportEntityName(execResult.commitChange.entityName || args.name);
                if (key) importKnown.characters.add(key);
              } else if (execResult.commitChange?.entityType === 'event') {
                const key = normalizeImportEntityName(execResult.commitChange.entityName || args.title);
                if (key) importKnown.events.add(key);
              } else if (execResult.commitChange?.entityType === 'worldData') {
                const key = normalizeImportEntityName(execResult.commitChange.entityName || args.name);
                if (key) importKnown.worldData.add(key);
              } else if (execResult.commitChange?.entityType === 'chapter') {
                const key = normalizeImportEntityName(execResult.commitChange.entityName || args.title);
                if (key && execResult.commitChange.type === 'create') importKnown.chapters.add(key);
              }

              messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: JSON.stringify(execResult.result),
              });

              // Send entity event for tracking
              if (execResult.commitChange && ['addCharacter', 'addEvent', 'createChapter', 'insertChapter', 'addWorldData'].includes(tc.name)) {
                if (!res.destroyed) {
                  const actionType = execResult.commitChange?.type === 'edit' ? 'merged' : 'created';
                  const entityType = execResult.commitChange.entityType === 'worldData'
                    ? 'world'
                    : execResult.commitChange.entityType;
                  res.write(`event: entity\ndata: ${JSON.stringify({
                    type: entityType,
                    action: actionType,
                    name: execResult.commitChange.entityName || (args.name || args.title) as string,
                  })}\n\n`);
                }
              }
            } catch (error) {
              messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: `Error: ${error instanceof Error ? error.message : String(error)}`,
              });
            }
          }
        }

        // Append page content to accumulated document (no LLM needed).
        const imageRefs = await imageRefsPromise;
        const storageContent = interleaveImages(pageTextHtml, imageRefs);
        if (storageContent) {
          accumulatedContent += (accumulatedContent ? '\n\n' : '') + storageContent;
        }

        // Record token usage for this page
        const pageDurationMs = Date.now() - pageStartTime;
        const usageTotals = iterationUsages.reduce(
          (totals, usage) => ({
            promptTokens: totals.promptTokens + (usage.prompt_tokens ?? 0),
            completionTokens: totals.completionTokens + (usage.completion_tokens ?? 0),
            totalTokens: totals.totalTokens + (usage.total_tokens ?? 0),
            cachedTokens: totals.cachedTokens + (usage.prompt_tokens_details?.cached_tokens ?? 0),
          }),
          { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0 },
        );

        if (iterationUsages.length > 0) {
          tokenUsageService.addRecord({
            id: generateId('usage'),
            timestamp: new Date().toISOString(),
            sessionId: importState!.id,
            projectId: req.projectId,
            projectName,
            bookId: importState!.bookId,
            source: 'import',
            providerId: aiService.getSettings().activeProviderId,
            model: importState!.model,
            promptTokens: usageTotals.promptTokens,
            completionTokens: usageTotals.completionTokens,
            totalTokens: usageTotals.totalTokens || usageTotals.promptTokens + usageTotals.completionTokens,
            cachedTokens: usageTotals.cachedTokens,
            iterationCount: iterations,
            durationMs: pageDurationMs,
          }).catch((err: unknown) => console.error('[TokenUsage] Failed to record import usage:', err));
        } else if (streamedCompletionChars > 0) {
          // Provider didn't return usage — estimate from content length (~4 chars/token)
          const estimateTokens = (text: string) => Math.max(1, Math.ceil(text.length / 4));
          const promptText = messages.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
          const promptTokens = estimateTokens(promptText);
          const completionTokens = estimateCompletionTokens();

          tokenUsageService.addRecord({
            id: generateId('usage'),
            timestamp: new Date().toISOString(),
            sessionId: importState!.id,
            projectId: req.projectId,
            projectName,
            bookId: importState!.bookId,
            source: 'import',
            providerId: aiService.getSettings().activeProviderId,
            model: importState!.model,
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            cachedTokens: 0,
            iterationCount: iterations,
            durationMs: pageDurationMs,
          }).catch((err: unknown) => console.error('[TokenUsage] Failed to record estimated import usage:', err));
        }

        // Send page_complete event with token stats for tk/s display
        if (!res.destroyed) {
          const completionTokens = usageTotals.completionTokens || (streamedCompletionChars > 0 ? estimateCompletionTokens() : 0);
          res.write(`event: page_complete\ndata: ${JSON.stringify({
            page: page - actualStartPage + 1,
            completionTokens,
            durationMs: Math.max(1, streamActiveMs || pageDurationMs),
          })}\n\n`);
        }
      } catch (error) {
        pageError = error as Error;
        console.error(`[Import] Page ${page} LLM error:`, error);
      }

      if (pageError) {
        const errorMessage = pageTimedOut
          ? `Model server did not respond within ${firstChunkTimeoutSec}s. Check that the model server is running and the model name is correct.`
          : pageError.message;

        if (!res.destroyed) {
          res.write(`event: page_error\ndata: ${JSON.stringify({ page, error: errorMessage })}\n\n`);
        }

        // Track failed page in importState
        if (!importState.failedPages) {
          importState.failedPages = [];
        }
        importState.failedPages.push(page);
        importState.updatedAt = new Date().toISOString();
        await bookFileService.saveImportState(importState);

        // On first-chunk timeout, break the entire import
        if (pageTimedOut) {
          importState.status = 'failed';
          importState.error = errorMessage;
          importState.updatedAt = new Date().toISOString();
          await bookFileService.saveImportState(importState);
          break;
        }

        // Skip currentPage update — continue to next page
        continue;
      }

      // Update import state (only on success)
      importState.currentPage = page;
      importState.updatedAt = new Date().toISOString();
      await bookFileService.saveImportState(importState);
    }

    // Save accumulated content as single document
    if (accumulatedContent) {
      try {
        await bookFileService.saveBookContent(accumulatedContent);
      } catch (err) {
        console.error('[Import] Failed to save document content:', err);
      }
    }

    // Complete
    importState.status = 'completed';
    importState.updatedAt = new Date().toISOString();
    await bookFileService.saveImportState(importState);

    // Write sanitization report if there were any warnings
    let warningReportPath: string | undefined;
    if (sanitizationWarnings.length > 0 && bookFileService) {
      warningReportPath = await bookFileService.writeSanitizationReport(sanitizationWarnings);
    }

    res.write(`event: complete\ndata: ${JSON.stringify({
      summary: `Imported ${parsedBook.totalPages} pages`,
      bookId,
      totalPages: parsedBook.totalPages,
      warnings: sanitizationWarnings,
      warningReportPath,
    })}\n\n`);

  } catch (error) {
    console.error('[Import] Error:', error);

    // Update import state to failed
    try {
      if (importState && bookFileService) {
        importState.status = 'failed';
        importState.error = error instanceof Error ? error.message : String(error);
        importState.updatedAt = new Date().toISOString();
        await bookFileService.saveImportState(importState);
      }
    } catch {
      console.debug('[importStream] Cleanup failed');
      // Best-effort cleanup
    }

    if (!res.destroyed) {
      res.write(`event: error\ndata: ${JSON.stringify({
        error: error instanceof Error ? error.message : String(error)
      })}\n\n`);
    }
  } finally {
    cleanup();
    res.end();
  }
}
