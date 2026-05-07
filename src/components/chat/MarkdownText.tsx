import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Streamed markdown renderer for assistant messages.
 * Re-parses on each text update; react-markdown handles partial input
 * gracefully (incomplete tables, half-closed code fences, etc.). Memoized
 * so a turn's earlier blocks don't re-render when only the latest block
 * is growing.
 */
function MarkdownTextImpl({ text }: { text: string }) {
  return (
    <div className="md-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // No raw HTML; treat ambiguous nodes as text. Safe by default.
        skipHtml
        components={{
          a: ({ href, children, ...rest }) => (
            <a href={href} target="_blank" rel="noreferrer" {...rest}>
              {children}
            </a>
          ),
          code: ({ className, children, ...rest }: any) => {
            const inline = !(className && className.startsWith('language-'))
            if (inline) {
              return <code className="md-code-inline" {...rest}>{children}</code>
            }
            return (
              <code className={className} {...rest}>
                {children}
              </code>
            )
          },
          pre: ({ children, ...rest }) => (
            <pre className="md-code-block" {...rest}>{children}</pre>
          ),
          table: ({ children, ...rest }) => (
            <div className="md-table-wrap">
              <table className="md-table" {...rest}>{children}</table>
            </div>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

export const MarkdownText = memo(MarkdownTextImpl)
