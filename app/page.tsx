"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";

type ChatEntry = {
  id: string;
  pairId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

type Conversation = {
  id: string;
  title: string;
  userContent: string;
  assistantContent: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
};

const STORAGE_KEY = "persian-rtl-chat-history-v3";

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

const introMessage = `سلام! متن فارسی، Markdown، کد، لینک یا فرمولت را بفرست. من خروجی را طوری نمایش می‌دهم که فارسی راست‌به‌چپ بماند و بخش‌های فنی مثل code، URL، email و LaTeX درست چپ‌به‌راست دیده شوند.`;

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
  const firstLine = content
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) return "گفت‌وگوی بدون عنوان";
  return firstLine.length > 46 ? `${firstLine.slice(0, 46)}...` : firstLine;
}

function formatDate(value: number) {
  if (!value) return "";
  return new Intl.DateTimeFormat("fa-IR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

export default function Home() {
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [chatEntries, setChatEntries] = useState<ChatEntry[]>([
    {
      id: "intro",
      pairId: "intro",
      role: "assistant",
      content: introMessage,
      createdAt: 0
    }
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const latestAssistant = useMemo(() => {
    return [...chatEntries].reverse().find((entry) => entry.role === "assistant");
  }, [chatEntries]);

  const stats = useMemo(() => {
    const content = latestAssistant?.content ?? "";
    const trimmed = content.trim();

    return {
      chats: conversations.length,
      chars: content.length,
      lines: content ? content.split("\n").length : 0,
      words: trimmed ? trimmed.split(/\s+/).length : 0
    };
  }, [conversations.length, latestAssistant?.content]);

  const filteredConversations = useMemo(() => {
    const q = query.trim().toLowerCase();

    return conversations
      .filter((item) => {
        if (!q) return true;
        return (
          item.title.toLowerCase().includes(q) ||
          item.userContent.toLowerCase().includes(q) ||
          item.assistantContent.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
  }, [conversations, query]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setConversations(JSON.parse(saved) as Conversation[]);
    } catch {
      setConversations([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, 80)));
  }, [conversations]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatEntries]);

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setToast(`${label} کپی شد`);
    window.setTimeout(() => setToast(""), 1600);
  }

  function createAssistantOutput(input: string) {
    return input.trim();
  }

  function submitMessage(value?: string) {
    const clean = (value ?? draft).trim();
    if (!clean) return;

    const now = Date.now();
    const pairId = makeId();
    const assistantOutput = createAssistantOutput(clean);

    const userMessage: ChatEntry = {
      id: makeId(),
      pairId,
      role: "user",
      content: clean,
      createdAt: now
    };

    const assistantMessage: ChatEntry = {
      id: makeId(),
      pairId,
      role: "assistant",
      content: assistantOutput,
      createdAt: now
    };

    const conversation: Conversation = {
      id: pairId,
      title: makeTitle(clean),
      userContent: clean,
      assistantContent: assistantOutput,
      createdAt: now,
      updatedAt: now,
      pinned: false
    };

    setChatEntries((current) => {
      const withoutIntro =
        current.length === 1 && current[0]?.id === "intro" ? [] : current;
      return [...withoutIntro, userMessage, assistantMessage];
    });

    setConversations((current) => [conversation, ...current].slice(0, 80));
    setActiveConversationId(pairId);
    setDraft("");
    textareaRef.current?.focus();
  }

  function openSample() {
    setDraft(sample);
    textareaRef.current?.focus();
  }

  function clearChat() {
    setChatEntries([
      {
        id: "intro",
        pairId: "intro",
        role: "assistant",
        content: introMessage,
        createdAt: 0
      }
    ]);
    setActiveConversationId(null);
    setDraft("");
  }

  function openConversation(item: Conversation) {
    const created = item.updatedAt || item.createdAt;

    setChatEntries([
      {
        id: `${item.id}-user`,
        pairId: item.id,
        role: "user",
        content: item.userContent,
        createdAt: created
      },
      {
        id: `${item.id}-assistant`,
        pairId: item.id,
        role: "assistant",
        content: item.assistantContent,
        createdAt: created
      }
    ]);

    setActiveConversationId(item.id);
    setHistoryOpen(false);
    setToast("گفت‌وگو باز شد");
    window.setTimeout(() => setToast(""), 1400);
  }

  function deleteConversation(id: string) {
    setConversations((current) => current.filter((item) => item.id !== id));
    if (activeConversationId === id) setActiveConversationId(null);
  }

  function togglePin(id: string) {
    setConversations((current) =>
      current.map((item) => (item.id === id ? { ...item, pinned: !item.pinned } : item))
    );
  }

  function startRename(item: Conversation) {
    setRenamingId(item.id);
    setRenameValue(item.title);
  }

  function finishRename(id: string) {
    const title = renameValue.trim() || "گفت‌وگوی بدون عنوان";

    setConversations((current) =>
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
        <div className="aurora aurora-one" />
        <div className="aurora aurora-two" />
        <div className="aurora aurora-three" />
        <div className="grid-floor" />

        <div className="ring ring-one" />
        <div className="ring ring-two" />

        <div className="floating-chip chip-one">{"{ code }"}</div>
        <div className="floating-chip chip-two">∑x²</div>
        <div className="floating-chip chip-three">π</div>
        <div className="floating-chip chip-four">AI</div>
        <div className="floating-chip chip-five">RTL</div>

        <div className="neural-map">
          <span className="node node-a" />
          <span className="node node-b" />
          <span className="node node-c" />
          <span className="node node-d" />
          <span className="node node-e" />
          <span className="edge edge-1" />
          <span className="edge edge-2" />
          <span className="edge edge-3" />
          <span className="edge edge-4" />
        </div>

        <div className="code-line code-line-one">const output = fixBidi(input)</div>
        <div className="code-line code-line-two">E = mc²</div>
        <div className="code-line code-line-three">Markdown + LaTeX + Code</div>
      </div>

      <section className="app-shell">
        <header className="topbar">
          <div>
            <span className="eyebrow">Persian RTL Assistant</span>
            <h1>چت‌بات مرتب‌ساز متن فارسی</h1>
          </div>

          <div className="top-actions">
            <button className="btn ghost" onClick={() => setHistoryOpen(true)}>
              تاریخچه
              <span className="count">{conversations.length.toLocaleString("fa-IR")}</span>
            </button>
            <button className="btn ghost" onClick={clearChat}>
              پاک کردن گفتگو
            </button>
          </div>
        </header>

        <div className="status-strip">
          <div>
            <span>گفت‌وگوها</span>
            <strong>{stats.chats.toLocaleString("fa-IR")}</strong>
          </div>
          <div>
            <span>کاراکتر خروجی</span>
            <strong>{stats.chars.toLocaleString("fa-IR")}</strong>
          </div>
          <div>
            <span>خط</span>
            <strong>{stats.lines.toLocaleString("fa-IR")}</strong>
          </div>
          <div>
            <span>کلمه</span>
            <strong>{stats.words.toLocaleString("fa-IR")}</strong>
          </div>
        </div>

        <section className="chat-window" aria-live="polite">
          {chatEntries.map((entry) => (
            <article
              className={`message-row ${entry.role === "user" ? "from-user" : "from-assistant"}`}
              key={entry.id}
            >
              <div className="avatar">
                {entry.role === "user" ? "تو" : "RTL"}
              </div>

              <div className="message-bubble">
                <div className="message-meta">
                  <span>{entry.role === "user" ? "پیام تو" : "خروجی اصلاح‌شده"}</span>
                  {entry.createdAt ? <time>{formatDate(entry.createdAt)}</time> : null}
                </div>

                {entry.role === "user" ? (
                  <p className="user-text">{entry.content}</p>
                ) : (
                  <>
                    <div className="assistant-summary">
                      <span>Markdown</span>
                      <span>LaTeX</span>
                      <span>Code LTR</span>
                      <span>Persian RTL</span>
                    </div>

                    <div className="rendered-output" id={`render-${entry.id}`}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeSanitize, rehypeKatex]}
                        components={components}
                      >
                        {entry.content}
                      </ReactMarkdown>
                    </div>

                    <details className="raw-details">
                      <summary>نمایش متن خام اصلاح‌شده</summary>
                      <pre dir="rtl">{prepareCopy(entry.content)}</pre>
                    </details>

                    <div className="message-actions">
                      <button className="btn primary" onClick={() => copy(prepareCopy(entry.content), "متن")}>
                        کپی متن
                      </button>
                      <button className="btn" onClick={() => copy(entry.content, "Markdown")}>
                        کپی Markdown
                      </button>
                      <button
                        className="btn"
                        onClick={() =>
                          copy(
                            document.getElementById(`render-${entry.id}`)?.innerHTML ?? "",
                            "HTML"
                          )
                        }
                      >
                        کپی HTML
                      </button>
                    </div>
                  </>
                )}
              </div>
            </article>
          ))}
          <div ref={chatEndRef} />
        </section>

        <section className="composer-card">
          <div className="composer-head">
            <div>
              <h2>پیامت را بفرست</h2>
              <p>متن فارسی، Markdown، کد، لینک، ایمیل یا فرمول LaTeX را وارد کن.</p>
            </div>
            <button className="btn ghost" onClick={openSample}>
              نمونه
            </button>
          </div>

          <div className="composer">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  submitMessage();
                }
              }}
              spellCheck={false}
              placeholder="اینجا بنویس... برای ارسال سریع Ctrl + Enter بزن"
            />
            <button className="send-btn" onClick={() => submitMessage()}>
              ارسال
            </button>
          </div>

          <div className="toast">{toast}</div>
        </section>
      </section>

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
            <h2>تاریخچه گفت‌وگوها</h2>
            <p>همه چیز فقط روی همین مرورگر ذخیره می‌شود.</p>
          </div>
          <button className="close-btn" onClick={() => setHistoryOpen(false)}>
            ×
          </button>
        </div>

        <div className="drawer-tools">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جستجو در گفت‌وگوها..."
          />
          <button className="btn primary" onClick={() => setQuery("")}>
            پاک کردن جستجو
          </button>
        </div>

        <div className="history-list">
          {filteredConversations.length === 0 ? (
            <div className="empty-state">
              هنوز گفت‌وگویی ذخیره نشده یا نتیجه‌ای برای جستجو پیدا نشد.
            </div>
          ) : (
            filteredConversations.map((item) => (
              <article
                className={`history-card ${activeConversationId === item.id ? "active" : ""}`}
                key={item.id}
              >
                <div className="history-content" onClick={() => openConversation(item)}>
                  {renamingId === item.id ? (
                    <input
                      className="rename-input"
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

                  <p>{item.userContent.slice(0, 130)}</p>
                  <small>{formatDate(item.updatedAt)}</small>
                </div>

                <div className="history-actions">
                  {renamingId === item.id ? (
                    <button className="small-btn" onClick={() => finishRename(item.id)}>
                      ثبت
                    </button>
                  ) : (
                    <button className="small-btn" onClick={() => startRename(item)}>
                      تغییر نام
                    </button>
                  )}
                  <button className="small-btn" onClick={() => togglePin(item.id)}>
                    {item.pinned ? "برداشتن پین" : "پین"}
                  </button>
                  <button className="small-btn danger" onClick={() => deleteConversation(item.id)}>
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
