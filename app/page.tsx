"use client";

import React, { useRef, useState } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";

const sample = `English at the beginning نباید باعث شود کل جمله چپ‌به‌راست شود.

این یک متن فارسی است که وسطش API, React, Next.js, file/path/example.ts و email@example.com داریم.

فرمول inline: $E = mc^2$

فرمول بلاکی:

$$
\\int_0^1 x^2 dx = \\frac{1}{3}
$$

کد باید چپ‌به‌راست بماند:

\`\`\`ts
function greet(name: string) {
  return \`Hello \${name}\`;
}
\`\`\`

- آیتم فارسی با کلمه English
- لینک: https://example.com/docs/getting-started
`;

const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const ltrTokenRegex =
  /(```[\s\S]*?```|`[^`]*`|https?:\/\/[^\s]+|www\.[^\s]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|[A-Za-z]:\\[^\s]+|\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+|[A-Za-z][A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]{1,})/g;

function collectText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return collectText(node.props.children);
  }
  return "";
}

function dirFrom(children: React.ReactNode): "rtl" | "ltr" {
  return rtlRegex.test(collectText(children)) ? "rtl" : "ltr";
}

function prepareCopy(text: string) {
  return text.normalize("NFC").replace(ltrTokenRegex, (match) => `\u2066${match}\u2069`);
}

export default function Home() {
  const [markdown, setMarkdown] = useState(sample);
  const [toast, setToast] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setToast(`${label} کپی شد`);
    window.setTimeout(() => setToast(""), 1800);
  }

  const components: Components = {
    p: ({ children }) => <p dir={dirFrom(children)}>{children}</p>,
    li: ({ children }) => <li dir={dirFrom(children)}>{children}</li>,
    h1: ({ children }) => <h1 dir={dirFrom(children)}>{children}</h1>,
    h2: ({ children }) => <h2 dir={dirFrom(children)}>{children}</h2>,
    h3: ({ children }) => <h3 dir={dirFrom(children)}>{children}</h3>,
    blockquote: ({ children }) => <blockquote dir={dirFrom(children)}>{children}</blockquote>,
    a: ({ children, href }) => (
      <a href={href} dir="ltr" target="_blank" rel="noreferrer">
        {children}
      </a>
    ),
    code: ({ children, className }) => (
      <code className={className} dir="ltr">
        {children}
      </code>
    ),
    pre: ({ children }) => <pre dir="ltr">{children}</pre>
  };

  return (
    <main className="page">
      <div className="shell">
        <section className="hero">
          <span className="badge">RTL / Markdown / LaTeX / Code</span>
          <h1>مرتب‌ساز متن فارسی و عربی در خروجی هوش مصنوعی</h1>
          <p className="lead">
            متن خام را وارد کن؛ پیش‌نمایش، فارسی و عربی را راست‌به‌چپ نگه می‌دارد و کد،
            لینک، ایمیل، مسیر فایل، عبارت‌های انگلیسی و فرمول‌های ریاضی را چپ‌به‌راست و
            خوانا نمایش می‌دهد.
          </p>
        </section>

        <section className="grid">
          <div className="panel">
            <div className="panel-head">
              <h2 className="panel-title">متن ورودی</h2>
              <div className="actions">
                <button className="btn" onClick={() => setMarkdown(sample)}>نمونه</button>
                <button className="btn danger" onClick={() => setMarkdown("")}>پاک کردن</button>
              </div>
            </div>
            <textarea
              value={markdown}
              onChange={(event) => setMarkdown(event.target.value)}
              spellCheck={false}
              placeholder="متن فارسی/عربی، Markdown، کد یا فرمول را اینجا وارد کن..."
            />
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2 className="panel-title">خروجی تمیز</h2>
              <div className="actions">
                <button className="btn primary" onClick={() => copy(prepareCopy(markdown), "متن")}>
                  کپی متن
                </button>
                <button className="btn" onClick={() => copy(markdown, "Markdown")}>کپی Markdown</button>
                <button className="btn" onClick={() => copy(previewRef.current?.innerHTML ?? "", "HTML")}>
                  کپی HTML
                </button>
              </div>
            </div>

            <div className="preview" ref={previewRef}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeSanitize, rehypeKatex]}
                components={components}
              >
                {markdown}
              </ReactMarkdown>
            </div>
          </div>
        </section>

        <div className="toast">{toast}</div>
      </div>
    </main>
  );
}
