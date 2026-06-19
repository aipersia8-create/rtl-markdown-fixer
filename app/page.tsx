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

/* ----- RTL Markdown Fixer core logic (do not break) ----- */
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
/* -------------------------------------------------------- */

/* ---------- Deep 3D neural network background ---------- */
// A feed-forward-style graph: columns of neurons connected by glowing synapses,
// with light "signal" pulses travelling along the edges. Deterministic so SSR
// matches client render. Each `variant` shifts the layout for layered depth.
//
// IMPORTANT (hydration): all geometry is pre-rounded to a fixed decimal precision
// as STRINGS at build time. Floating-point results from Math.sin can differ in the
// last digit between Node (V8 server) and the browser, which causes a hydration
// mismatch. Rounding once, up-front, guarantees identical server/client output.

// Round to 1 decimal place and stringify — deterministic across runtimes.
function f1(v: number) {
  return Math.round(v * 10) / 10 + "";
}

// Tone -> stroke/fill colour tokens.
const TONE_COLOR = ["#a78bfa", "#67e8f9", "#86efac"];
const TONE_SOFT = ["rgba(167,139,250,0.5)", "rgba(103,232,249,0.5)", "rgba(134,239,172,0.5)"];

type BuiltNeuron = { x: string; y: string; r: number; tone: 0 | 1 | 2 };
type BuiltNet = { neurons: BuiltNeuron[]; layers: BuiltNeuron[][] };

function buildNet(variant: number): BuiltNet {
  // Column x positions with subtle per-variant horizontal drift.
  const drift = variant * 70 - 70;
  const cols = [120, 250, 380, 510, 640, 750].map((x) => x + drift);
  // Neuron counts per column (denser in the middle).
  const counts = [4, 6, 8, 8, 6, 4];
  const seedStep = variant * 1000;

  const neurons: BuiltNeuron[] = [];
  const layers: BuiltNeuron[][] = [];

  cols.forEach((cx, ci) => {
    const n = counts[ci];
    const layer: BuiltNeuron[] = [];
    const span = 460;
    const start = (500 - span) / 2;
    for (let i = 0; i < n; i++) {
      // Pseudo-random but deterministic jitter on Y position + radius.
      const rnd = Math.abs(Math.sin((ci + 1) * 99.13 + (i + 1) * 53.17 + seedStep));
      const gap = span / (n + 1);
      const yRaw = start + gap * (i + 1) + (rnd - 0.5) * 26;
      const tone = ((ci + i + variant) % 3) as 0 | 1 | 2;
      const node: BuiltNeuron = {
        x: f1(cx),
        y: f1(yRaw),
        r: Math.round((3 + rnd * 2.4) * 10) / 10,
        tone
      };
      neurons.push(node);
      layer.push(node);
    }
    layers.push(layer);
  });

  return { neurons, layers };
}

// Pre-computed nets per variant (module-level so they are stable).
const NETS: BuiltNet[] = [buildNet(0), buildNet(1), buildNet(2)];

// Connect every neuron to a few neurons in the next column (deterministic).
function buildEdges(net: BuiltNet) {
  const edges: { a: BuiltNeuron; b: BuiltNeuron; tone: number }[] = [];
  for (let li = 0; li < net.layers.length - 1; li++) {
    const cur = net.layers[li];
    const next = net.layers[li + 1];
    cur.forEach((a, ai) => {
      next.forEach((b, bi) => {
        const rnd = Math.abs(Math.sin(li * 17.3 + ai * 7.7 + bi * 3.1));
        // Keep ~55% of possible connections for an organic, non-grid feel.
        if (rnd > 0.45) {
          edges.push({ a, b, tone: (li + ai) % 3 });
        }
      });
    });
  }
  return edges;
}
const EDGES = NETS.map(buildEdges);

// A handful of long paths through consecutive columns for travelling signals.
function signalPaths(variant: number) {
  const net = NETS[variant];
  const paths: { d: string; tone: number; dur: number; delay: number }[] = [];
  const starts = [0, 1, 2];
  starts.forEach((rowSeed, idx) => {
    const pts: string[] = [];
    let curIdx = rowSeed % net.layers[0].length;
    net.layers.forEach((layer, li) => {
      curIdx = (curIdx + li) % layer.length;
      const node = layer[curIdx];
      pts.push(`${li === 0 ? "M" : "L"}${node.x},${node.y}`);
    });
    paths.push({
      d: pts.join(" "),
      tone: (rowSeed + variant) % 3,
      dur: 7 + idx * 2.5 + variant,
      delay: -(idx * 2.1 + variant)
    });
  });
  return paths;
}

function SynapseLayer({ variant = 1 }: { variant?: number }) {
  const v = Math.max(0, Math.min(2, variant - 1));
  const edges = EDGES[v];
  const { neurons } = NETS[v];
  const paths = signalPaths(v);
  const uid = `b${v}`;

  return (
    <>
      <defs>
        <linearGradient id={`edge-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={TONE_SOFT[0]} />
          <stop offset="50%" stopColor={TONE_SOFT[1]} />
          <stop offset="100%" stopColor={TONE_SOFT[2]} />
        </linearGradient>
        <filter id={`glow-${uid}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Synapses */}
      <g stroke={`url(#edge-${uid})`} strokeWidth={0.8} fill="none" opacity={0.6}>
        {edges.map((e, i) => (
          <line
            key={`e${i}`}
            x1={e.a.x}
            y1={e.a.y}
            x2={e.b.x}
            y2={e.b.y}
          />
        ))}
      </g>

      {/* Travelling signal pulses along multi-column paths */}
      <g filter={`url(#glow-${uid})`}>
        {paths.map((p, i) => (
          <circle key={`s${i}`} r={3} fill={TONE_COLOR[p.tone]}>
            <animateMotion
              dur={`${p.dur}s`}
              begin={`${p.delay}s`}
              repeatCount="indefinite"
              path={p.d}
              rotate="auto"
            />
            <animate
              attributeName="opacity"
              values="0;1;1;0"
              keyTimes="0;0.12;0.85;1"
              dur={`${p.dur}s`}
              begin={`${p.delay}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
      </g>

      {/* Neurons with a slow breathing pulse */}
      <g filter={`url(#glow-${uid})`}>
        {neurons.map((n, i) => {
          const rStr = n.r + "";
          const haloStr = Math.round(n.r * 2.4 * 10) / 10 + "";
          const pulseStr = Math.round((n.r + 1.1) * 10) / 10 + "";
          return (
            <g key={`n${i}`}>
              <circle cx={n.x} cy={n.y} r={haloStr} fill={TONE_COLOR[n.tone]} opacity={0.16}>
                <animate
                  attributeName="opacity"
                  values="0.08;0.26;0.08"
                  dur={`${4 + (i % 5)}s`}
                  repeatCount="indefinite"
                />
              </circle>
              <circle cx={n.x} cy={n.y} r={rStr} fill={TONE_COLOR[n.tone]} className={`neu tone-${n.tone}`}>
                <animate
                  attributeName="r"
                  values={`${rStr};${pulseStr};${rStr}`}
                  dur={`${3.5 + (i % 4)}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          );
        })}
      </g>
    </>
  );
}

/* ---------- Inline SVG icons (lightweight, crisp) ---------- */
type IconProps = { className?: string; style?: React.CSSProperties };

function IconHistory({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconTrash({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}
function IconSparkles({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.8 4.8L18.6 9.6 13.8 11.4 12 16.2 10.2 11.4 5.4 9.6l4.8-1.8z" />
      <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z" />
    </svg>
  );
}
function IconCopy({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}
function IconCheck({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
function IconCode({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 18l6-6-6-6" />
      <path d="M8 6l-6 6 6 6" />
    </svg>
  );
}
function IconSend({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}
function IconPin({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 17v5" />
      <path d="M9 10.5V4h6v6.5l3 3.5H6l3-3.5z" />
    </svg>
  );
}
function IconSearch({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}
/* ----------------------------------------------------------- */

const CAPABILITIES = ["Markdown", "LaTeX", "Code LTR", "Persian RTL"];

export default function Home() {
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
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

  function flashToast(message: string, duration = 1700) {
    setToast(message);
    window.setTimeout(() => setToast(""), duration);
  }

  async function copyValue(value: string, label: string, id?: string) {
    try {
      await navigator.clipboard.writeText(value);
      flashToast(`${label} کپی شد`);
      if (id) {
        setCopiedId(id);
        window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1600);
      }
    } catch {
      flashToast("کپی ناموفق بود");
    }
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
    flashToast("گفت‌وگو پاک شد", 1300);
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
    flashToast("گفت‌وگو باز شد", 1300);
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

  const isEmpty = chatEntries.length === 0;

  return (
    <main className="page">
      <div className="background" aria-hidden="true">
        {/* Base deep gradient + ambient glows + readability vignette */}
        <div className="bg-base" />
        <div className="aurora aurora-one" />
        <div className="aurora aurora-two" />
        <div className="aurora aurora-three" />

        {/* Deep neural network — 3D layer stack (back → front), each tilted in perspective.
            Layered Z creates real depth; light pulses travel along the synapses. */}
        <svg className="net net-back" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice">
          <SynapseLayer />
        </svg>
        <svg className="net net-mid" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice">
          <SynapseLayer variant={2} />
        </svg>
        <svg className="net net-front" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice">
          <SynapseLayer variant={3} />
        </svg>
      </div>

      <section className="app-shell">
        {/* ---------- TOPBAR ---------- */}
        <header className="topbar">
          <div className="brand">
            <div className="brand-logo" aria-hidden="true">RTL</div>
            <div>
              <span className="eyebrow">
                <span className="dot" />
                Persian RTL Assistant
              </span>
              <h1>چت‌بات مرتب‌ساز متن فارسی</h1>
            </div>
          </div>

          <div className="top-actions">
            <button className="btn ghost" onClick={() => setHistoryOpen(true)}>
              <IconHistory className="ico" />
              تاریخچه
              <span className="count">{conversations.length.toLocaleString("fa-IR")}</span>
            </button>
            <button className="btn ghost" onClick={clearChat}>
              <IconTrash className="ico" />
              پاک کردن گفتگو
            </button>
          </div>
        </header>

        {/* ---------- STATUS ---------- */}
        <div className="status-strip">
          <div className="stat">
            <span>گفت‌وگوها</span>
            <strong>{stats.chats.toLocaleString("fa-IR")}</strong>
          </div>
          <div className="stat">
            <span>کاراکتر خروجی</span>
            <strong>{stats.chars.toLocaleString("fa-IR")}</strong>
          </div>
          <div className="stat">
            <span>خط</span>
            <strong>{stats.lines.toLocaleString("fa-IR")}</strong>
          </div>
          <div className="stat">
            <span>کلمه</span>
            <strong>{stats.words.toLocaleString("fa-IR")}</strong>
          </div>
        </div>

        {/* ---------- CHAT ---------- */}
        <section className="chat-window" aria-live="polite">
          {isEmpty ? (
            <div className="chat-empty">
              <div className="emoji">👋</div>
              <h3>گفت‌وگوی خودت را شروع کن</h3>
              <p>
                یک متن فارسی، کد، لینک یا فرمول LaTeX بفرست تا با حفظ راست‌چین بودن فارسی و
                چپ‌چین ماندن بخش‌های فنی، خروجی تمیز و خوانا تحویل بگیری.
              </p>
            </div>
          ) : (
            chatEntries.map((entry) => (
              <article
                className={`message-row ${entry.role === "user" ? "from-user" : "from-assistant"}`}
                key={entry.id}
              >
                <div className="avatar">
                  {entry.role === "user" ? "تو" : "RTL"}
                </div>

                <div className="message-bubble">
                  <div className="message-meta">
                    <span className="role-tag">
                      {entry.role === "user" ? "🧑‍💻 پیام تو" : "✨ خروجی اصلاح‌شده"}
                    </span>
                    {entry.createdAt ? <time>{formatDate(entry.createdAt)}</time> : null}
                  </div>

                  {entry.role === "user" ? (
                    <p className="user-text">{entry.content}</p>
                  ) : (
                    <>
                      <div className="assistant-summary">
                        {CAPABILITIES.map((cap) => (
                          <span key={cap}>{cap}</span>
                        ))}
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
                        <button
                          className={`copy-btn ${copiedId === entry.id ? "copied" : ""}`}
                          onClick={() => copyValue(prepareCopy(entry.content), "متن", entry.id)}
                          title="کپی متن با کاراکترهای جهت‌دار (پیشنهادی)"
                        >
                          {copiedId === entry.id ? (
                            <IconCheck className="ico" />
                          ) : (
                            <IconCopy className="ico" />
                          )}
                          {copiedId === entry.id ? "کپی شد" : "کپی متن"}
                        </button>
                        <button
                          className="copy-btn"
                          onClick={() => copyValue(entry.content, "Markdown")}
                          title="کپی متن خام Markdown"
                        >
                          <IconCode className="ico" />
                          کپی Markdown
                        </button>
                        <button
                          className="copy-btn"
                          onClick={() =>
                            copyValue(
                              document.getElementById(`render-${entry.id}`)?.innerHTML ?? "",
                              "HTML"
                            )
                          }
                          title="کپی خروجی HTML رندرشده"
                        >
                          <IconCode className="ico" />
                          کپی HTML
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </article>
            ))
          )}
          <div ref={chatEndRef} />
        </section>

        {/* ---------- COMPOSER (compact chat input) ---------- */}
        <section className="composer" aria-label="جعبه پیام">
          <button
            className="composer-tool"
            onClick={openSample}
            title="درج متن نمونه"
            aria-label="درج متن نمونه"
          >
            <IconSparkles className="ico" />
          </button>

          <textarea
            ref={textareaRef}
            className="composer-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                submitMessage();
              }
            }}
            rows={1}
            spellCheck={false}
            placeholder="متن فارسی، کد، لینک یا فرمول LaTeX... (Ctrl + Enter برای ارسال)"
          />

          <button
            className="send-btn"
            onClick={() => submitMessage()}
            disabled={!draft.trim()}
            aria-label="ارسال"
            title="ارسال (Ctrl + Enter)"
          >
            <IconSend className="send-ico" />
          </button>
        </section>
      </section>

      {/* ---------- TOAST ---------- */}
      <div className={`toast ${toast ? "show" : ""}`} role="status">
        <IconCheck className="ico" />
        {toast}
      </div>

      {/* ---------- HISTORY DRAWER ---------- */}
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
          <button className="close-btn" onClick={() => setHistoryOpen(false)} aria-label="بستن">
            ×
          </button>
        </div>

          <div className="drawer-tools">
            <div style={{ position: "relative" }}>
              <IconSearch
                className="ico"
                style={{
                  position: "absolute",
                  insetInlineStart: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "16px",
                  height: "16px",
                  color: "var(--muted)",
                  pointerEvents: "none"
                }}
              />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جستجو در گفت‌وگوها..."
              style={{ paddingInlineStart: "38px" }}
            />
          </div>
          <button className="btn primary" onClick={() => setQuery("")}>
            پاک کردن جستجو
          </button>
        </div>

        <div className="history-list">
          {filteredConversations.length === 0 ? (
            <div className="empty-state">
              <div className="empty-ico">
                <IconHistory />
              </div>
              <strong>
                {query ? "نتیجه‌ای پیدا نشد" : "هنوز گفت‌وگویی ذخیره نشده"}
              </strong>
              <span>
                {query
                  ? "عبارت دیگری را امتحان کن."
                  : "اولین پیامت را بفرست تا اینجا ذخیره شود."}
              </span>
            </div>
          ) : (
            filteredConversations.map((item) => (
              <article
                className={`history-card ${activeConversationId === item.id ? "active" : ""} ${item.pinned ? "pinned" : ""}`}
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
                    <h3>
                      {item.pinned && <span className="pin-mark">📌</span>}
                      {item.title}
                    </h3>
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
                  <button
                    className="small-btn"
                    onClick={() => togglePin(item.id)}
                    title={item.pinned ? "برداشتن پین" : "پین کردن"}
                  >
                    {item.pinned ? "برداشتن پین" : "📌 پین"}
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
