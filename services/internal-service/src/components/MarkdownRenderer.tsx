import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { useMemo } from 'react';
import { getTextDirection, getTextDirectionStyles } from '../utils/textDirection';
import type { SourceData } from '../types/services';
import { CitationRenderer, stripIncompleteCitation } from './CitationRenderer';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  isStreaming?: boolean;
  sources?: SourceData[];
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '', isStreaming = false, sources }) => {
  const textDir = useMemo(() => getTextDirection(content), [content]);
  const dirStyles = useMemo(() => getTextDirectionStyles(content), [content]);

  // Strip incomplete trailing citation during streaming to avoid flicker
  const displayContent = useMemo(() => {
    if (isStreaming) {
      return stripIncompleteCitation(content).clean;
    }
    return content;
  }, [content, isStreaming]);

  const hasCitations = sources && sources.length > 0;

  return (
    <div
      className={`markdown-content ${textDir === 'rtl' ? 'rtl' : ''} ${isStreaming ? 'typing-cursor' : ''} ${className}`}
      style={dirStyles}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={hasCitations ? {
          p: ({ children }) => (
            <p>
              {processChildren(children, sources, isStreaming)}
            </p>
          ),
          li: ({ children }) => (
            <li>
              {processChildren(children, sources, isStreaming)}
            </li>
          ),
        } : undefined}
      >
        {displayContent}
      </ReactMarkdown>
    </div>
  );
};

// Process children nodes, replacing string nodes that contain citations with CitationRenderer
function processChildren(children: React.ReactNode, sources: SourceData[], isStreaming: boolean): React.ReactNode {
  if (!Array.isArray(children)) {
    if (typeof children === 'string') {
      return <CitationRenderer text={children} sources={sources} isStreaming={isStreaming} />;
    }
    return children;
  }

  return children.map((child, i) => {
    if (typeof child === 'string') {
      return <CitationRenderer key={i} text={child} sources={sources} isStreaming={isStreaming} />;
    }
    return child;
  });
}
