"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/AuthContext";
import { MarkdownContent } from "@/components/chat/MarkdownContent";
import { CitationCard, type ChatCitation, type ChatSource } from "@/components/chat/CitationCard";
import { TokenCounter } from "@/components/chat/TokenCounter";
import { MessageActions } from "@/components/chat/MessageActions";
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
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

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
          const defaultM = modelList.find((m) => m.best) || modelList[0];
          if (defaultM) setSelectedModel(defaultM.id);
        }
      }
    } catch {}
  }, []);

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
    const controller = new AbortController();
    abortRef.current = controller;
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

    try {
      const res = await fetch("/api/chat/ask", {
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

      if (!res.ok || !res.body) {
        patchAssistant({
          content: "Sorry, the model service is unavailable. Please try again.",
          error: "request_failed",
          streaming: false,
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
              accumulatedText += evt.token;
              appendToken(evt.token);
            } else if (evt.type === "error") {
              patchAssistant({
                content: (accumulatedText ? accumulatedText + "\n\n" : "") + `Error: ${evt.error}`,
                streaming: false,
              });
            }
          } catch {}
        }
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
    await streamAsk(convId, fullContent, assistantMsgId);
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

    // Local branch: truncate everything after the edited message.
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

  const newConversation = () => {
    setActiveConvId(null);
    setMessages([]);
    setLoading(false);
    setInput("");
    setFiles([]);
    setEditingMsg(null);
    inputRef.current?.focus();
  };

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

  const hasMessages = messages.length > 0;
  const showSend = (input.trim().length > 0 || files.length > 0) && !parsing;

  const sidebar = useMemo(() => (
    <aside className={`${styles.historySidebar} ${sidebarOpen ? "" : styles.historyCollapsed}`}>
      <div className={styles.historyHeader}>
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
    </aside>
  ), [conversations, activeConvId, sidebarOpen, deleteConversation, selectConversation]);

  const messageList = useMemo(() => (
    <div className={styles.messagesContainer}>
      <div className={styles.messages}>
        {messages.map((msg, index) => {
          const busy = busyMessages.has(msg.id);
          const isUser = msg.role === "user";
          return (
            <div key={msg.id} className={`${styles.message} ${isUser ? styles.messageUser : styles.messageAI}`}>
              {!isUser && (
                <div className={`${styles.msgAvatar} ${msg.streaming ? styles.msgAvatarThinking : ""}`}>
                  <img src="/logo.png" className={styles.msgAvatarImg} alt="AI" />
                </div>
              )}
              <div className={styles.msgBubble}>
                <div className={`${styles.msgBody} ${msg.streaming ? styles.streamingBody : ""}`}>
                  {msg.content ? (
                    <MarkdownContent content={msg.content} />
                  ) : msg.streaming ? (
                    <div className={styles.thinkingText}>
                      {editingMsg ? "Searching & reasoning..." : "Thinking..."}
                    </div>
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
                {msg.streaming && <span className={styles.streamCursor}></span>}
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
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  ), [messages, busyMessages, editingMsg, handleRegenerate, handleEdit]);

  const tokenMessages = useMemo(
    () => messages.filter((m) => m.role === "user" || (m.role === "assistant" && !m.streaming)),
    [messages]
  );

  const inputAreaContent = (
    <>
      {files.length > 0 && (
        <div className={styles.filePreviews}>
          {files.map((f) => (
            <div key={f.id} className={styles.fileChip}>
              <i className={f.type.startsWith("image/") ? "fa-regular fa-image" : "fa-regular fa-file"}></i>
              <span className={styles.fileChipName}>{f.name}</span>
              <button className={styles.fileChipRemove} onClick={() => removeFile(f.id)}>
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
        placeholder={editingMsg ? "Edit your message..." : "Write a message..."}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
      />
      <div className={styles.inputToolbar}>
        <div className={styles.inputToolbarLeft}>
          <button className={styles.inputActionBtn} onClick={() => fileInputRef.current?.click()} title="Attach file">
            <i className="fa-regular fa-plus"></i>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.pdf,.csv,.tsv,.png,.jpg,.jpeg,.gif,.smiles,.smi,.sdf,.mol,.pdb"
            className={styles.hiddenInput}
            onChange={handleFileSelect}
          />
        </div>
        <div className={styles.inputActionsRight}>
          <TokenCounter messages={tokenMessages} input={loading ? "" : input} />
          <div className={styles.modelPicker} ref={modelPickerRef}>
            <button
              className={styles.modelPickerBtn}
              onClick={() => setModelPickerOpen(!modelPickerOpen)}
            >
              <span>{models.find((m) => m.id === selectedModel)?.name || (editingMsg ? "Editing..." : "Groq")}</span>
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
          {editingMsg ? (
            <button className={styles.sendBtn} onClick={saveEdit} title="Save edit">
              <i className="fa-solid fa-check"></i>
            </button>
          ) : parsing ? (
            <button className={styles.sendBtn} onClick={stopGeneration} title="Parsing files...">
              <i className="fa-solid fa-spinner fa-spin"></i>
            </button>
          ) : loading ? (
            <button className={styles.stopBtn} onClick={stopGeneration} title="Stop">
              <i className="fa-solid fa-square"></i>
            </button>
          ) : showSend ? (
            <button className={styles.sendBtn} onClick={handleSubmit} title="Send">
              <i className="fa-solid fa-arrow-up"></i>
            </button>
          ) : (
            <>
              <button className={styles.micBtn} title="Voice input">
                <i className="fa-solid fa-microphone"></i>
              </button>
              <div className={styles.waveformIcon} title="Voice feedback">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className={styles.page}>
      {initialLoading ? (
        <div className={styles.initialLoader}>
          <div className={`${styles.spinnerCircle} ${styles.spinnerCircleLarge}`} />
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
                  <div className={styles.chatHeaderSpacer} />
                  <button className={styles.editBtn} onClick={newConversation} title="New chat">
                    <i className="fa-regular fa-pen-to-square"></i>
                  </button>
                </header>

                {messageList}

                <div className={styles.inputFooter}>
                  <div className={styles.inputBox}>{inputAreaContent}</div>
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
                  <h1 className={styles.welcomeTitle}>
                    What&apos;s the vibe, <span className={styles.welcomeName}>{user?.display_name || "Researcher"}</span>?
                  </h1>

                  <div className={styles.welcomeInputBox}>{inputAreaContent}</div>

                  <div className={styles.suggestions}>
                    {SUGGESTIONS_BY_COUNT.flat().slice(0, 6).map((s, i) => (
                      <button
                        key={i}
                        className={styles.suggestionChip}
                        onClick={() => {
                          setInput(s);
                          inputRef.current?.focus();
                        }}
                      >
                        <i className={getSuggestionIcon(s)} style={{ fontSize: '11px', color: '#7C3AED' }}></i>
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