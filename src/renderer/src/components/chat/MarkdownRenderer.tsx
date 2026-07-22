import Markdown from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
}

/**
 * Renders markdown content with styling appropriate for chat bubbles.
 * Only used for assistant/agent messages — user messages stay plain text.
 */
export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <Markdown
      components={{
        h1: ({ children }) => (
          <h1 className="mb-2 mt-3 text-lg font-bold text-gray-100 first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-1.5 mt-2.5 text-base font-bold text-gray-100 first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-1 mt-2 text-sm font-bold text-gray-100 first:mt-0">
            {children}
          </h3>
        ),
        h4: ({ children }) => (
          <h4 className="mb-1 mt-2 text-sm font-semibold text-gray-200 first:mt-0">
            {children}
          </h4>
        ),
        p: ({ children }) => (
          <p className="mb-2 last:mb-0">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="mb-2 ml-4 list-disc space-y-0.5 last:mb-0">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2 ml-4 list-decimal space-y-0.5 last:mb-0">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="text-sm">{children}</li>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-gray-50">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-gray-200">{children}</em>
        ),
        code: ({ children, className }) => {
          // Inline code (no language class)
          if (!className) {
            return (
              <code className="rounded bg-gray-800/70 px-1.5 py-0.5 text-xs text-blue-300">
                {children}
              </code>
            );
          }
          // Code block with language
          return (
            <code className={className}>{children}</code>
          );
        },
        pre: ({ children }) => (
          <pre className="mb-2 overflow-x-auto rounded bg-gray-800/70 p-2.5 text-xs last:mb-0">
            {children}
          </pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-2 border-l-2 border-blue-500/50 pl-3 text-gray-400 italic last:mb-0">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-2 border-gray-600/50" />,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline hover:text-blue-300"
          >
            {children}
          </a>
        ),
      }}
    >
      {content}
    </Markdown>
  );
}
