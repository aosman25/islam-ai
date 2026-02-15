import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { useMemo } from 'react';
import { getTextDirection, getTextDirectionStyles } from '../utils/textDirection';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  isStreaming?: boolean;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '', isStreaming = false }) => {
  const textDir = useMemo(() => getTextDirection(content), [content]);
  const dirStyles = useMemo(() => getTextDirectionStyles(content), [content]);

  return (
    <div
      className={`markdown-content ${textDir === 'rtl' ? 'rtl' : ''} ${isStreaming ? 'typing-cursor' : ''} ${className}`}
      style={dirStyles}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
