"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 自定义代码块渲染
          pre: ({ children }) => (
            <pre className="bg-muted/80 rounded-lg p-3 overflow-x-auto text-sm my-2">
              {children}
            </pre>
          ),
          // 自定义代码渲染
          code: ({ children, className }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-muted/80 px-1.5 py-0.5 rounded text-xs font-mono">
                  {children}
                </code>
              );
            }
            return (
              <code className={`font-mono ${className || ""}`}>
                {children}
              </code>
            );
          },
          // 自定义链接
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              {children}
            </a>
          ),
          // 自定义段落
          p: ({ children }) => (
            <p className="my-1 text-sm leading-relaxed">{children}</p>
          ),
          // 自定义标题
          h1: ({ children }) => (
            <h1 className="text-xl font-bold mt-2 mb-1">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-bold mt-2 mb-1">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold mt-1 mb-1">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold mt-1">{children}</h4>
          ),
          // 自定义列表
          ul: ({ children }) => (
            <ul className="list-disc list-inside my-1 space-y-0.5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside my-1 space-y-0.5">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-sm leading-relaxed">{children}</li>
          ),
          // 自定义引用
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/30 pl-3 my-2 italic text-muted-foreground text-sm">
              {children}
            </blockquote>
          ),
          // 自定义表格
          table: ({ children }) => (
            <table className="w-full border-collapse my-2 text-sm">{children}</table>
          ),
          th: ({ children }) => (
            <th className="border border-border bg-muted px-3 py-1 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-3 py-1">{children}</td>
          ),
          // 自定义强调
          strong: ({ children }) => (
            <strong className="font-semibold text-primary">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
          hr: () => <hr className="my-3 border-border" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
