"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/AuthContext";
import { MarkdownContent } from "@/components/chat/MarkdownContent";
import { CitationCard, type ChatCitation, type ChatSource } from "@/components/chat/CitationCard";
import { TokenCounter } from "@/components/chat/TokenCounter";
import { MessageActions } from "@/components/chat/MessageActions";
import { ThinkingDots } from "@/components/chat/ThinkingDots";
import { FollowUpSuggestions } from "@/components/chat/FollowUpSuggestions";
import styles from "./page.module.css";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  dbId?: string;
  sources?: ChatSource[];
  citations?: ChatCitation[];
  model?: string;
  streaming?: boolean;
  error?: string;
}

interface Conversation {
  id: string;
  title: string;
  first_message?: string;
  created_at: string;
  updated_at: string;
}

interface ChatFile {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
  file: File;
}

interface ModelOption {
  id: string;
  name: string;
  provider: string;
  best?: boolean;
}

interface SSEEvent {
  type?: string;
  token?: string;
  done?: boolean;
  error?: string;
  model?: string;
  sources?: ChatSource[];
  citations?: ChatCitation[];
}

interface AttachmentParsed {
  name: string;
  type: string;
  text_excerpt?: string;
  stats?: Record<string, unknown>;
  molecules?: Array<{ smiles?: string; title?: string }>;
}

const SUGGESTIONS_BY_COUNT = [
  [
    "Design a novel CDK4/6 inhibitor with improved selectivity",
    "Explain the mechanism of PROTAC-mediated degradation",
    "Compare binding affinities of known EGFR inhibitors",
  ],
  [
    "Suggest synthetic routes for this molecule: CC(C)Cc1ccc(C(C)C(=O)O)cc1",
    "Analyze ADMET properties of Ibuprofen",
    "What are the latest advances in molecular dynamics simulations?",
  ],
  [
    "How do I optimize a lead compound for better solubility?",
    "Explain molecular docking and its applications",
    "What is the role of AI in drug discovery?",
  ],
];

const getSuggestionIcon = (text: string) => {
  const t = text.toLowerCase();
  if (t.includes("design")) return "fa-solid fa-compass-drafting";
  if (t.includes("explain")) return "fa-regular fa-circle-question";
  if (t.includes("compare")) return "fa-solid fa-code-compare";
  if (t.includes("route") || t.includes("synthetic")) return "fa-solid fa-route";
  if (t.includes("analyze") || t.includes("admet")) return "fa-solid fa-magnifying-glass-chart";
  if (t.includes("advance") || t.includes("simulation")) return "fa-solid fa-arrow-trend-up";
  return "fa-regular fa-lightbulb";
};

const FILE_ICONS: Record<string, string> = {
  image: "fa-regular fa-image",
  pdf: "fa-solid fa-file-pdf",
  text: "fa-regular fa-file-lines",
  csv: "fa-solid fa-file-csv",
  "chemical/x-sdf": "fa-solid fa-flask",
  "chemical/x-pdb": "fa-solid fa-dna",
};

const PREFS_COOKIE = "molecraft_chat_prefs";
const PREFS_MAX_AGE = 60 * 60 * 24 * 365;

interface ChatPrefs {
  model?: string;
  sidebar?: boolean;
}

function readPrefs(): ChatPrefs {
  try {
    const match = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${PREFS_COOKIE}=`));
    if (!match) return {};
    return JSON.parse(decodeURIComponent(match.slice(PREFS_COOKIE.length + 1))) as ChatPrefs;
  } catch {
    return {};
  }
}

function writePrefs(prefs: ChatPrefs) {
  document.cookie = `${PREFS_COOKIE}=${encodeURIComponent(JSON.stringify(prefs))}; path=/; max-age=${PREFS_MAX_AGE}; samesite=lax`;
}

export default function ChatPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyMessages, setBusyMessages] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [files, setFiles] = useState<ChatFile[]>([]);
  const [parsing, setParsing] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [dragging, setDragging] = useState(false);
  const [lastDoneIndex, setLastDoneIndex] = useState(-1);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setModelPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/models");
      if (res.ok) {
        const data = await res.json();
        const modelList = (data.models ?? []) as ModelOption[];
        if (modelList.length > 0) {
          setModels(modelList);
          const prefs = readPrefs();
          const saved = modelList.find((m) => m.id === prefs.model);
          const defaultM = saved || modelList.find((m) => m.best) || modelList[0];
          if (defaultM) setSelectedModel(defaultM.id);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    const prefs = readPrefs();
    if (typeof prefs.sidebar === "boolean") {
      setSidebarOpen(prefs.sidebar);
    }
  }, []);

  useEffect(() => {
    writePrefs({ model: selectedModel || undefined, sidebar: sidebarOpen });
  }, [selectedModel, sidebarOpen]);

  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/chat");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations);
      }
    } catch {}
  };

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      Promise.all([fetchConversations(), fetchModels()]).finally(() => {
        if (!cancelled) setInitialLoading(false);
      });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [fetchModels]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const fetchMessages = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/chat/${convId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
        setLastDoneIndex(
          Math.max(
            -1,
            data.messages.findIndex((m: Message, i: number, arr: Message[]) =>
              m.role === "assistant" && !m.streaming && i === arr.length - 1
            )
          )
        );
      }
    } catch {}
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;

    for (const file of Array.from(selected)) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setFiles((prev) => [
          ...prev,
          {
            id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl: ev.target?.result as string,
            file,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const addFilesFromList = (list: FileList | null) => {
    if (!list) return;
    handleFileSelect({ target: { files: list, value: "" } } as unknown as React.ChangeEvent<HTMLInputElement>);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const stopGeneration = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setLoading(false);
    setBusyMessages(new Set());
  };

  const persistAssistant = useCallback(async (conversationId: string, content: string) => {
    try {
      await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, role: "assistant", content }),
      });
    } catch {}
  }, []);

  const streamAsk = useCallback(async (
    conversationId: string,
    query: string,
    assistantMsgId: string,
    regenerate = false
  ) => {
    const makeController = () => {
      const controller = new AbortController();
      abortRef.current = controller;
      return controller;
    };

    setLoading(true);
    setBusyMessages((prev) => new Set(prev).add(assistantMsgId));

    const patchAssistant = (partial: Partial<Message>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsgId ? { ...m, ...partial } : m))
      );
    };

    const appendToken = (tok: string) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, content: m.content + tok } : m
        )
      );
    };

    let accumulatedText = "";

    const attempt = async (route: string): Promise<boolean> => {
      const controller = makeController();
      try {
        const res = await fetch(route, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            conversationId,
            model: selectedModel,
            stream: true,
            regenerate,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) return false;

        const contentType = res.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          try {
            const json = await res.json();
            const answer: string | undefined = json?.answer;
            if (answer && answer.trim()) {
              accumulatedText = answer;
              patchAssistant({
                content: answer,
                model: json?.model || undefined,
                sources: json?.sources as ChatSource[] | undefined,
                citations: json?.citations as ChatCitation[] | undefined,
                streaming: false,
              });
              return true;
            }
          } catch {}
          return false;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let gotTokens = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done || controller.signal.aborted) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() || "";

          for (const event of events) {
            const line = event.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            try {
              const evt = JSON.parse(payload) as SSEEvent;
              if (evt.type === "meta") {
                patchAssistant({
                  model: evt.model,
                  sources: evt.sources,
                  citations: evt.citations,
                });
              } else if (evt.type === "token" && evt.token) {
                gotTokens = true;
                accumulatedText += evt.token;
                appendToken(evt.token);
              } else if (evt.type === "error") {
                if (!gotTokens) return false;
                patchAssistant({
                  content: (accumulatedText ? accumulatedText + "\n\n" : "") + `Error: ${evt.error}`,
                  streaming: false,
                });
              }
            } catch {}
          }
        }

        if (controller.signal.aborted) {
          patchAssistant({ streaming: false });
          return true;
        }
        if (!gotTokens) return false;

        patchAssistant({ streaming: false });
        return true;
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") return false;
        throw e;
      }
    };

    try {
      let ok = await attempt("/api/chat/ask");
      if (!ok) {
        ok = await attempt("/api/chat/groq");
      }
      if (!ok) {
        patchAssistant({
          content: accumulatedText || "Sorry, the model service is unavailable. Please try again.",
          error: "request_failed",
          streaming: false,
        });
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        patchAssistant({
          content: accumulatedText || "Sorry, something went wrong while streaming the response.",
          streaming: false,
        });
      }
    } finally {
      patchAssistant({ streaming: false });
      if (accumulatedText) {
        await persistAssistant(conversationId, accumulatedText);
      }
      abortRef.current = null;
      setBusyMessages(new Set());
      setLoading(false);
      const doneIdx = messagesRef.current.findIndex((m) => m.id === assistantMsgId);
      if (doneIdx >= 0) setLastDoneIndex(doneIdx);
      fetchConversations();
    }
  }, [selectedModel, persistAssistant]);

  const buildAttachmentText = (parsed: AttachmentParsed[]): string => {
    const parts: string[] = [];
    for (const p of parsed) {
      const smi = (p.molecules ?? []).map((m: { smiles?: string }) => m.smiles).filter(Boolean);
      if (p.type === "sdf") {
        const titles = (p.molecules ?? []).map((m: { title?: string }) => m.title).filter(Boolean);
        parts.push(`SDF file "${p.name}" — ${p.stats?.compound_count ?? 0} compounds (${(p.stats?.smiles_extracted ?? 0)} with SMILES): ${titles.slice(0, 8).join(", ")}${titles.length > 8 ? "…" : ""}${smi.length ? ` — SMILES: ${smi.slice(0, 10).join("; ")}` : ""}`);
      } else if (p.type === "pdb") {
        const chains = (p.stats?.chains as string[] | undefined) ?? [];
        parts.push(`PDB file "${p.name}" — ${p.stats?.atom_count ?? 0} atoms, chains ${chains.join(",")}`);
      } else if (p.type === "smiles") {
        parts.push(`SMILES file "${p.name}" — ${p.stats?.smiles_count ?? 0} molecules: ${smi.slice(0, 20).join("; ")}${smi.length > 20 ? "…" : ""}`);
      } else if (p.type === "pdf") {
        parts.push(`PDF file "${p.name}" — extracted ${p.stats?.char_count ?? 0} chars of text${p.text_excerpt ? `:\n${p.text_excerpt.slice(0, 1500)}` : ""}`);
      } else {
        parts.push(`File "${p.name}"${p.text_excerpt ? `:\n${p.text_excerpt.slice(0, 1500)}` : ""}`);
      }
    }
    return parts.join("\n\n");
  };

  const handleSubmit = async () => {
    const text = input.trim();
    if ((!text && files.length === 0) || loading || parsing) return;

    let convId = activeConvId;

    if (!convId) {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: text ? text.slice(0, 60) : "File upload" }),
        });
        if (!res.ok) return;
        const data = await res.json();
        convId = data.conversation.id;
        setActiveConvId(convId);
        setConversations((prev) => [data.conversation, ...prev]);
      } catch {
        return;
      }
    }

    let attachmentText = "";
    if (files.length > 0) {
      setParsing(true);
      setLoading(true);
      try {
        const formData = new FormData();
        for (const f of files) {
          formData.append("files", f.file, f.name);
        }
        const res = await fetch("/api/chat/upload", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          attachmentText = buildAttachmentText(data.attachments ?? []);
        }
      } catch {}
      setParsing(false);
    }

    const fullContent = [
      attachmentText ? `[Attached file analysis]\n${attachmentText}` : "",
      text,
      files.length > 0 && !attachmentText ? `[Attached: ${files.map((f) => f.name).join(", ")}]` : "",
    ]
      .filter((s) => s.trim().length > 0)
      .join("\n\n");

    if (!fullContent.trim()) return;

    const savedText = text;

    setInput("");
    setFiles([]);
    setLoading(true);

    const userMsgId = `m-${Date.now()}`;
    const userMsg: Message = {
      id: userMsgId,
      role: "user",
      content: fullContent,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId, role: "user", content: fullContent }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === userMsgId ? { ...m, dbId: data.message.id } : m))
        );
      }
    } catch {}

    const assistantMsgId = `a-${Date.now()}`;
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
      streaming: true,
    };
    setMessages((prev) => [...prev, assistantMsg]);

    if (!convId) return;
    await streamAsk(convId, savedText || fullContent, assistantMsgId);
  };

  const handleRegenerate = useCallback(async (index: number) => {
    if (loading) return;
    const msgs = messages;
    const assistant = msgs[index];
    const user = [...msgs.slice(0, index)].reverse().find((m) => m.role === "user");
    if (!assistant || !user || !activeConvId) return;

    setLoading(true);
    setMessages((prev) =>
      prev.map((m) => (m.id === assistant.id ? { ...m, content: "", streaming: true, error: undefined } : m))
    );
    await streamAsk(activeConvId, user.content, assistant.id, true);
  }, [messages, loading, activeConvId, streamAsk]);

  const handleEdit = useCallback((msg: Message) => {
    setEditingMsg(msg);
    setInput(msg.content);
    inputRef.current?.focus();
    const textarea = inputRef.current;
    if (textarea) {
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  }, []);

  const saveEdit = async () => {
    if (!editingMsg || !activeConvId) {
      setEditingMsg(null);
      return;
    }
    const content = input.trim();
    if (!content) {
      setEditingMsg(null);
      setInput("");
      return;
    }

    setLoading(true);

    const assistantMsgId = `a-${Date.now()}`;

    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === editingMsg.id);
      if (idx < 0) return prev;
      const branch = prev.slice(0, idx + 1).map((m) =>
        m.id === editingMsg.id ? { ...m, content } : m
      );
      const assistantMsg: Message = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
        streaming: true,
      };
      return [...branch, assistantMsg];
    });

    try {
      await fetch("/api/chat/message", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConvId,
          messageId: editingMsg.dbId || editingMsg.id,
          content,
        }),
      });
    } catch {}

    setInput("");
    setEditingMsg(null);

    await streamAsk(activeConvId, content, assistantMsgId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (editingMsg) {
        saveEdit();
      } else {
        handleSubmit();
      }
    }
  };

  const newConversation = useCallback(() => {
    setActiveConvId(null);
    setMessages([]);
    setLoading(false);
    setInput("");
    setFiles([]);
    setEditingMsg(null);
    setLastDoneIndex(-1);
    inputRef.current?.focus();
  }, []);

  const deleteConversation = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/chat/${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvId === id) {
        setActiveConvId(null);
        setMessages([]);
      }
    } catch {}
  }, [activeConvId]);

  const selectConversation = useCallback(async (id: string) => {
    setActiveConvId(id);
    setMessages([]);
    setLoading(false);
    await fetchMessages(id);
  }, [fetchMessages]);

  const pickFollowUp = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  const hasMessages = messages.length > 0;
  const showSend = (input.trim().length > 0 || files.length > 0) && !parsing;

  const sidebar = useMemo(() => (
    <aside className={`${styles.historySidebar} ${sidebarOpen ? "" : styles.historyCollapsed}`}>
      <div className={styles.historyHeader}>
        <span className={styles.historyBrand}>
          <img src="/logo.png" className={styles.historyBrandImg} alt="MoleCraft" />
          <span className={styles.historyBrandText}>&nbsp;</span>
        </span>
        <button className={styles.toggleBtn} onClick={() => setSidebarOpen(!sidebarOpen)} title={sidebarOpen ? "Close sidebar" : "Open sidebar"}>
          <i className={`fa-solid ${sidebarOpen ? "fa-chevron-left" : "fa-chevron-right"}`}></i>
        </button>
      </div>

      <div className={styles.historyActions}>
        <button className={styles.newChatBtn} onClick={newConversation}>
          <i className="fa-regular fa-square-plus"></i> New chat
        </button>
      </div>

      <div className={styles.historyList}>
        <p className={styles.historySectionTitle}>Recent</p>
        {conversations.length === 0 && (
          <p className={styles.noHistory}>
            <i className="fa-solid fa-comment-slash" style={{ marginRight: "6px", opacity: 0.6 }}></i>
            No conversations yet
          </p>
        )}
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={`${styles.historyItem} ${activeConvId === conv.id ? styles.historyItemActive : ""}`}
            onClick={() => selectConversation(conv.id)}
          >
            <i className="fa-regular fa-message"></i>
            <span className={styles.historyItemTitle}>{conv.title}</span>
            <button
              className={styles.deleteBtn}
              onClick={(e) => deleteConversation(e, conv.id)}
              title="Delete"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        ))}
      </div>

      <div className={styles.historyFooter}>
        <div className={styles.modelPicker} ref={modelPickerRef}>
          <button
            className={styles.modelPickerBtn}
            onClick={() => setModelPickerOpen(!modelPickerOpen)}
          >
            <i className="fa-solid fa-bolt"></i>
            <span className={styles.modelPickerName}>
              {models.find((m) => m.id === selectedModel)?.name || (editingMsg ? "Editing..." : "Groq")}
            </span>
            <i className="fa-solid fa-chevron-down"></i>
          </button>
          {modelPickerOpen && (
            <div className={styles.modelPickerDropdown}>
              {models.map((m) => (
                <button
                  key={m.id}
                  className={`${styles.modelOption} ${m.id === selectedModel ? styles.modelOptionActive : ""}`}
                  onClick={() => { setSelectedModel(m.id); setModelPickerOpen(false); }}
                >
                  <span className={styles.modelOptionName}>
                    {m.name}
                    {m.best && <span className={styles.modelBestBadge}>Best</span>}
                  </span>
                  {m.id === selectedModel && <i className="fa-solid fa-check"></i>}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className={styles.historyUser}>{user?.display_name || "Researcher"}</span>
      </div>
    </aside>
  ), [conversations, activeConvId, sidebarOpen, deleteConversation, selectConversation, models, selectedModel, modelPickerOpen, editingMsg, newConversation, user]);

  const messageList = useMemo(() => (
    <div className={styles.messagesContainer}>
      <div className={styles.messages}>
        {messages.map((msg, index) => {
          const busy = busyMessages.has(msg.id);
          const isUser = msg.role === "user";
          const showFollowUps = !isUser && !msg.streaming && !!msg.content && !msg.error && index === messages.length - 1 && index === lastDoneIndex;
          return (
            <div
              key={msg.id}
              className={`${styles.message} ${isUser ? styles.messageUser : styles.messageAI}`}
              style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
            >
              {!isUser && (
                <div className={`${styles.msgAvatar} ${msg.streaming ? styles.msgAvatarThinking : ""}`}>
                  <img src="/logo.png" className={styles.msgAvatarImg} alt="AI" />
                  {msg.streaming && <span className={styles.avatarPing}></span>}
                </div>
              )}
              <div className={styles.msgBubble}>
                <div className={`${styles.msgBody} ${isUser ? styles.msgBodyUser : ""} ${msg.streaming && msg.content ? styles.streamingBody : ""}`}>
                  {msg.content ? (
                    <MarkdownContent content={msg.content} />
                  ) : msg.streaming ? (
                    <ThinkingDots />
                  ) : msg.error ? (
                    <p className={styles.msgError}>{msg.error}</p>
                  ) : ("")}
                  {(msg.sources || msg.citations) && !isUser && (
                    <CitationCard
                      sources={msg.sources || []}
                      citations={msg.citations || []}
                      loading={msg.streaming}
                    />
                  )}
                </div>
                <div className={styles.msgMeta}>
                  <span className={styles.msgTime}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {!isUser && msg.model ? ` · ${msg.model}` : ""}
                  </span>
                  <span className={styles.msgActions}>
                    <MessageActions
                      isUser={isUser}
                      content={msg.content}
                      busy={busy || !!msg.streaming}
                      onRegenerate={!isUser ? () => handleRegenerate(index) : undefined}
                      onEdit={isUser ? () => handleEdit(msg) : undefined}
                    />
                  </span>
                </div>
                {showFollowUps && <FollowUpSuggestions seed={index + 1} onPick={pickFollowUp} />}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  ), [messages, busyMessages, lastDoneIndex, handleRegenerate, handleEdit]);

  const tokenMessages = useMemo(
    () => messages.filter((m) => m.role === "user" || (m.role === "assistant" && !m.streaming)),
    [messages]
  );

  const fileIcon = (f: ChatFile) => {
    if (f.name.endsWith(".sdf") || f.name.endsWith(".mol")) return "fa-solid fa-flask";
    if (f.name.endsWith(".pdb")) return "fa-solid fa-dna";
    if (f.type.startsWith("image/")) return FILE_ICONS.image;
    if (f.type === "application/pdf") return FILE_ICONS.pdf;
    if (f.type === "text/csv" || f.type === "text/tsv") return FILE_ICONS.csv;
    return FILE_ICONS.text;
  };

  const inputAreaContent = (
    <>
      {files.length > 0 && (
        <div className={styles.filePreviews}>
          {files.map((f) => (
            <div key={f.id} className={styles.fileChip}>
              <i className={fileIcon(f)}></i>
              <span className={styles.fileChipName}>{f.name}</span>
              <span className={styles.fileChipSize}>{Math.round(f.size / 1024)} KB</span>
              <button className={styles.fileChipRemove} onClick={() => removeFile(f.id)} title="Remove file">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          ))}
        </div>
      )}
      {editingMsg && (
        <div className={styles.editBanner}>
          <i className="fa-solid fa-pen"></i>
          <span>Editing your message — sending will branch the conversation</span>
          <button className={styles.editCancel} onClick={() => { setEditingMsg(null); setInput(""); }}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}
      <textarea
        ref={inputRef}
        className={styles.inputField}
        placeholder={editingMsg ? "Edit your message..." : "Message MoleCraft…"}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
      />
      <div className={styles.inputToolbar}>
        <div className={styles.inputToolbarLeft}>
          <button className={styles.inputActionBtn} onClick={() => fileInputRef.current?.click()} title="Attach file">
            <i className="fa-solid fa-paperclip"></i>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.pdf,.csv,.tsv,.png,.jpg,.jpeg,.gif,.smiles,.smi,.sdf,.mol,.pdb"
            className={styles.hiddenInput}
            onChange={handleFileSelect}
          />
          <span className={styles.inputHint}>Enter to send · Shift+Enter for new line · Ctrl+K to focus</span>
        </div>
        <div className={styles.inputActionsRight}>
          <TokenCounter messages={tokenMessages} input={loading ? "" : input} />
          {editingMsg ? (
            <button className={styles.sendBtn} onClick={saveEdit} title="Save edit">
              <i className="fa-solid fa-check"></i>
            </button>
          ) : parsing ? (
            <button className={styles.sendBtn} onClick={stopGeneration} title="Parsing files...">
              <i className="fa-solid fa-spinner fa-spin"></i>
            </button>
          ) : loading ? (
            <button className={styles.stopBtn} onClick={stopGeneration} title="Stop generating">
              <i className="fa-solid fa-stop"></i>
            </button>
          ) : showSend ? (
            <button className={styles.sendBtn} onClick={handleSubmit} title="Send message">
              <i className="fa-solid fa-arrow-up"></i>
            </button>
          ) : (
            <button className={styles.sendBtnDisabled} title="Type a message or attach a file" disabled>
              <i className="fa-solid fa-arrow-up"></i>
            </button>
          )}
        </div>
      </div>
    </>
  );

  const inputShell = (variant: "footer" | "welcome") => (
    <div
      className={`${variant === "welcome" ? styles.welcomeInputBox : styles.inputBox} ${dragging ? styles.dropActive : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        addFilesFromList(e.dataTransfer.files);
      }}
    >
      {dragging && (
        <div className={styles.dropOverlay}>
          <i className="fa-solid fa-cloud-arrow-up"></i>
          <span>Drop files to attach</span>
        </div>
      )}
      {inputAreaContent}
    </div>
  );

  return (
    <div className={styles.page}>
      {initialLoading ? (
        <div className={styles.initialLoader}>
          <div className={styles.initialLogo}><img src="/logo.png" alt="MoleCraft" /></div>
          <span className={styles.initialLabel}>Warming up the lab…</span>
        </div>
      ) : (
        <>
          {sidebar}
          <div className={styles.chatArea}>
            {hasMessages ? (
              <>
                <header className={styles.chatHeader}>
                  {!sidebarOpen && (
                    <button className={styles.openSidebarBtn} onClick={() => setSidebarOpen(true)} title="Open sidebar">
                      <i className="fa-solid fa-bars"></i>
                    </button>
                  )}
                  <span className={styles.headerModelChip} title="Model">
                    <i className="fa-solid fa-bolt"></i>
                    {models.find((m) => m.id === selectedModel)?.name || "Groq"}
                  </span>
                  <div className={styles.chatHeaderSpacer} />
                  <button className={styles.editBtn} onClick={newConversation} title="New chat">
                    <i className="fa-regular fa-pen-to-square"></i>
                  </button>
                </header>

                {messageList}

                <div className={styles.inputFooter}>
                  {inputShell("footer")}
                  <p className={styles.footerNote}>MoleCraft can make mistakes. Verify critical chemistry in the lab.</p>
                </div>
              </>
            ) : (
              <>
                <header className={styles.chatHeader}>
                  {!sidebarOpen && (
                    <button className={styles.openSidebarBtn} onClick={() => setSidebarOpen(true)} title="Open sidebar">
                      <i className="fa-solid fa-bars"></i>
                    </button>
                  )}
                  <div className={styles.chatHeaderSpacer} />
                  <button className={styles.editBtn} onClick={newConversation} title="New chat">
                    <i className="fa-regular fa-pen-to-square"></i>
                  </button>
                </header>

                <div className={styles.welcomeArea}>
                  <div className={styles.welcomeBadge}>MoleCraft AI · Groq powered</div>
                  <h1 className={styles.welcomeTitle}>
                    Hello, <span className={styles.welcomeName}>{user?.display_name || "Researcher"}</span>
                  </h1>
                  <p className={styles.welcomeSubtitle}>Design molecules, mine the literature, accelerate discovery.</p>

                  {inputShell("welcome")}

                  <div className={styles.suggestions}>
                    {SUGGESTIONS_BY_COUNT.flat().slice(0, 6).map((s, i) => (
                      <button
                        key={i}
                        className={styles.suggestionChip}
                        onClick={() => {
                          setInput(s);
                          inputRef.current?.focus();
                        }}
                        style={{ animationDelay: `${i * 70}ms` }}
                      >
                        <i className={getSuggestionIcon(s)}></i>
                        <span>{s}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <footer className={styles.chatFooter} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}