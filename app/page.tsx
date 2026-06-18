"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";

type HistoryItem = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
};

const STORAGE_KEY = "persian-rtl-markdown-history-v2";

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

const rtlRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const ltrTokenRegex =
  /(```[\s\S]*?```|`[^`]*`|https?:\/\/[^\s]+|www\.[^\s]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|[A-Za-z]:\\[^\s]+|\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+|[A-Za-z][A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]{1,})/g;

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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

function makeTitle(content: string) {
  const line = content
    .split("\n")
    .map((item) => item.trim())
    .find(Boolean);

  if (!line) return "متن بدون عنوان";
  return line.length > 42 ? `${line.slice(0, 42)}...` : line;
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat("fa-IR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

export default function Home() {
  const [markdown, setMarkdown] = useState(sample);
  const [toast, setToast] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);

  const stats = useMemo(() => {
    const trimmed = markdown.trim();
    return {
      chars: markdown.length,
      lines: markdown ? markdown.split("\n").length : 0,
      words: trimmed ? trimmed.split(/\s+/).length : 0
    };
  }, [markdown]);

  const filteredHistory = useMemo(() => {
    const q = query.trim().toLowerCase();

    return history
      .filter((item) => {
        if (!q) return true;
        return item.title.toLowerCase().includes(q) || item.content.toLowerCase().includes(q);
      })
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
  }, [history, query]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setHistory(JSON.parse(saved) as HistoryItem[]);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 80)));
  }, [history]);

  useEffect(() => {
    const clean = markdown.trim();
    if (!clean) return;

    const timer = window.setTimeout(() => {
      const now = Date.now();

      setHistory((current) => {
        if (activeId) {
          return current.map((item) =>
            item.id === activeId
              ? {
                  ...item,
                  content: markdown,
                  updatedAt: now
                }
              : item
          );
        }

        const next: HistoryItem = {
          id: makeId(),
          title: makeTitle(markdown),
          content: markdown,
          createdAt: now,
          updatedAt: now,
          pinned: false
        };

        setActiveId(next.id);
        return [next, ...current].slice(0, 80);
      });
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [markdown, activeId]);

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setToast(`${label} کپی شد`);
    window.setTimeout(() => setToast(""), 1600);
  }

  function saveNow() {
    const now = Date.now();

    const next: HistoryItem = {
      id: makeId(),
      title: makeTitle(markdown),
      content: markdown,
      createdAt: now,
      updatedAt: now,
      pinned: false
    };

    setHistory((current) => [next, ...current].slice(0, 80));
    setActiveId(next.id);
    setToast("در تاریخچه ذخیره شد");
    window.setTimeout(() => setToast(""), 1600);
  }

  function openItem(item: HistoryItem) {
    setMarkdown(item.content);
    setActiveId(item.id);
    setHistoryOpen(false);
    setToast("از تاریخچه باز شد");
    window.setTimeout(() => setToast(""), 1400);
  }

  function deleteItem(id: string) {
    setHistory((current) => current.filter((item) => item.id !== id));
    if (activeId === id) setActiveId(null);
  }

  function togglePin(id: string) {
    setHistory((current) =>
      current.map((item) => (item.id === id ? { ...item, pinned: !item.pinned } : item))
    );
  }

  function startRename(item: HistoryItem) {
    setRenamingId(item.id);
    setRenameValue(item.title);
  }

  function finishRename(id: string) {
    const title = renameValue.trim() || "متن بدون عنوان";

    setHistory((current) =>
      current.map((item) =>
        item.id === id ? { ...item, title, updatedAt: Date.now() } : item
      )
    );

    setRenamingId(null);
    setRenameValue("");
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
      <div className="background" aria-hidden="true">
        <div className="grid-floor" />
        <div className="shape shape-1">{"{ }"}</div>
        <div className="shape shape-2">∑</div>
        <div className="shape shape-3">π</div>
        <div className="shape shape-4">AI</div>
        <div className="neural">
          <span className="node n1" />
          <span className="node n2" />
          <span className="node n3" />
          <span className="node n4" />
          <span className="line l1" />
          <span className="line l2" />
          <span className="line l3" />
        </div>
        <div className="float-code code-1">const direction = &quot;rtl&quot;</div>
        <div className="float-code code-2">E = mc²</div>
        <div className="float-code code-3">Markdown.render()</div>
      </div>

      <div className="shell">
        <section className="hero">
          <div className="hero-main">
            <span className="badge">Persian RTL • Markdown • LaTeX • Code</span>
            <h1>مرتب‌ساز متن فارسی برای خروجی هوش مصنوعی</h1>
            <p className="lead">
              متن فارسی را وارد کن و خروجی تمیز، خوانا و درست بگیر؛ کد، لینک، ایمیل،
              مسیر فایل، عبارت‌های انگلیسی و فرمول‌های ریاضی بدون به‌هم‌ریختگی چپ‌به‌راست
              نمایش داده می‌شوند.
            </p>

            <div className="hero-actions">
              <button className="btn primary" onClick={() => setHistoryOpen(true)}>
                باز کردن تاریخچه
              </button>
              <button className="btn" onClick={saveNow}>
                ذخیره فعلی
              </button>
            </div>
          </div>

          <div className="stats-card">
            <span>وضعیت متن</span>
            <strong>{stats.chars.toLocaleString("fa-IR")}</strong>
            <small>کاراکتر</small>
            <div>
              <b>{stats.lines.toLocaleString("fa-IR")} خط</b>
              <b>{stats.words.toLocaleString("fa-IR")} کلمه</b>
            </div>
          </div>
        </section>

        <section className="workspace">
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>متن ورودی</h2>
                <p>متن، Markdown، کد یا فرمول را اینجا قرار بده.</p>
              </div>

              <div className="actions">
                <button
                  className="btn"
                  onClick={() => {
                    setMarkdown(sample);
                    setActiveId(null);
                  }}
                >
                  نمونه
                </button>
                <button
                  className="btn danger"
                  onClick={() => {
                    setMarkdown("");
                    setActiveId(null);
                  }}
                >
                  پاک کردن
                </button>
              </div>
            </div>

            <textarea
              value={markdown}
              onChange={(event) => setMarkdown(event.target.value)}
              spellCheck={false}
              placeholder="متن فارسی، Markdown، کد یا فرمول را اینجا وارد کن..."
            />
          </div>

          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>خروجی تمیز</h2>
                <p>پیش‌نمایش زنده با جداسازی درست RTL و LTR.</p>
              </div>

              <div className="actions">
                <button className="btn primary" onClick={() => copy(prepareCopy(markdown), "متن")}>
                  کپی متن
                </button>
                <button className="btn" onClick={() => copy(markdown, "Markdown")}>
                  کپی Markdown
                </button>
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

      <button className="history-fab" onClick={() => setHistoryOpen(true)}>
        تاریخچه
        <span>{history.length.toLocaleString("fa-IR")}</span>
      </button>

      {historyOpen && (
        <button
          className="drawer-backdrop"
          onClick={() => setHistoryOpen(false)}
          aria-label="بستن تاریخچه"
        />
      )}

      <aside className={`drawer ${historyOpen ? "open" : ""}`} aria-hidden={!historyOpen}>
        <div className="drawer-head">
          <div>
            <h2>تاریخچه</h2>
            <p>ذخیره محلی روی همین مرورگر</p>
          </div>
          <button className="close-btn" onClick={() => setHistoryOpen(false)}>
            ×
          </button>
        </div>

        <div className="drawer-tools">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جستجو در تاریخچه..."
          />
          <button className="btn primary" onClick={saveNow}>
            ذخیره
          </button>
        </div>

        <div className="history-list">
          {filteredHistory.length === 0 ? (
            <div className="empty">
              هنوز چیزی در تاریخچه نیست یا نتیجه‌ای برای جستجو پیدا نشد.
            </div>
          ) : (
            filteredHistory.map((item) => (
              <article
                key={item.id}
                className={`history-item ${activeId === item.id ? "active" : ""}`}
              >
                <div className="history-content" onClick={() => openItem(item)}>
                  {renamingId === item.id ? (
                    <input
                      className="rename"
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") finishRename(item.id);
                        if (event.key === "Escape") setRenamingId(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <h3>{item.pinned ? "★ " : ""}{item.title}</h3>
                  )}
                  <p>{item.content.slice(0, 120)}</p>
                  <small>{formatDate(item.updatedAt)}</small>
                </div>

                <div className="history-actions">
                  {renamingId === item.id ? (
                    <button className="small-btn" onClick={() => finishRename(item.id)}>
                      ثبت
                    </button>
                  ) : (
                    <button className="small-btn" onClick={() => startRename(item)}>
                      نام
                    </button>
                  )}
                  <button className="small-btn" onClick={() => togglePin(item.id)}>
                    {item.pinned ? "برداشتن" : "پین"}
                  </button>
                  <button className="small-btn danger" onClick={() => deleteItem(item.id)}>
                    حذف
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </aside>
    </main>
  );
}
