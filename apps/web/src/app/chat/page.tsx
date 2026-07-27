"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/AuthContext";
import styles from "./page.module.css";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
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
}

interface ModelOption {
  id: string;
  name: string;
  provider: string;
  best?: boolean;
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

const getProviderIcon = (provider: string) => {
  const p = provider.toLowerCase();
  if (p.includes("openai")) return "fa-solid fa-sparkles";
  if (p.includes("anthropic")) return "fa-solid fa-brain";
  if (p.includes("google")) return "fa-solid fa-gem";
  if (p.includes("meta")) return "fa-solid fa-infinity";
  if (p.includes("deepseek")) return "fa-solid fa-compass";
  if (p.includes("mistral")) return "fa-solid fa-wind";
  if (p.includes("qwen")) return "fa-solid fa-robot";
  if (p.includes("sakana")) return "fa-solid fa-fish";
  return "fa-solid fa-microchip";
};

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [files, setFiles] = useState<ChatFile[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState("qwen3-fast:latest");
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchConversations(), fetchModels()]).finally(() => setInitialLoading(false));
  }, []);

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
        if (data.models?.length > 0) {
          setModels(data.models);
          const defaultM = data.models.find((m: any) => m.best) || data.models[0];
          if (defaultM) {
            setSelectedModel(defaultM.id);
          }
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
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

  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/chat");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations);
      }
    } catch {}
  };

  const fetchMessages = async (convId: string) => {
    try {
      const res = await fetch(`/api/chat/${convId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
      }
    } catch {}
  };

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
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    const text = input.trim();
    if ((!text && files.length === 0) || loading) return;

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

    const fullContent = files.length > 0
      ? text
        ? text + `\n\n[Attached: ${files.map((f) => f.name).join(", ")}]`
        : `[Attached: ${files.map((f) => f.name).join(", ")}]`
      : text;

    setInput("");
    setFiles([]);
    setLoading(true);

    const controller = new AbortController();
    setAbortController(controller);

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: fullContent,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId, role: "user", content: fullContent }),
      });
    } catch {}

    try {
      const res = await fetch("/api/chat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: fullContent, model: selectedModel }),
        signal: controller.signal,
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data.answer;

        const msgRes = await fetch("/api/chat/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: convId, role: "assistant", content: reply }),
        });

        if (msgRes.ok) {
          const msgData = await msgRes.json();
          const assistantMsg: Message = {
            id: msgData.message.id,
            role: "assistant",
            content: reply,
            created_at: msgData.message.created_at,
          };
          setMessages((prev) => [...prev, assistantMsg]);
        }
      }
    } catch {
      if (!controller.signal.aborted) {
        console.error("Chat ask error");
      }
    }

    setAbortController(null);
    setLoading(false);
    fetchConversations();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const newConversation = () => {
    setActiveConvId(null);
    setMessages([]);
    setLoading(false);
    setInput("");
    setFiles([]);
    inputRef.current?.focus();
  };

  const deleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/chat/${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvId === id) {
        setActiveConvId(null);
        setMessages([]);
      }
    } catch {}
  };

  const selectConversation = async (id: string) => {
    setActiveConvId(id);
    setMessages([]);
    setLoading(false);
    await fetchMessages(id);
  };

  const hasMessages = messages.length > 0;
  const showSend = input.trim().length > 0 || files.length > 0;

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
  ), [conversations, activeConvId, sidebarOpen]);

  const messageList = useMemo(() => (
    <div className={styles.messagesContainer}>
      <div className={styles.messages}>
        {messages.map((msg) => (
          <div key={msg.id} className={`${styles.message} ${msg.role === "user" ? styles.messageUser : styles.messageAI}`}>
            {msg.role === "assistant" && (
              <div className={styles.msgAvatar}>
                <img src="/logo.png" className={styles.msgAvatarImg} alt="AI" />
              </div>
            )}
            <div className={styles.msgBubble}>
              <p className={styles.msgContent}>{msg.content}</p>
              <p className={styles.msgTime}>
                {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
        {loading && (
          <div className={`${styles.message} ${styles.messageAI}`}>
            <div className={`${styles.msgAvatar} ${styles.msgAvatarThinking}`}>
              <img src="/logo.png" className={styles.msgAvatarImg} alt="AI" />
            </div>
            <div className={styles.msgBubble}>
              <div className={styles.thinkingText}>Thinking...</div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  ), [messages, loading]);

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
                  <div className={styles.inputBox}>
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
                    <textarea
                      ref={inputRef}
                      className={styles.inputField}
                      placeholder="Write a message..."
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
                          accept=".txt,.pdf,.csv,.png,.jpg,.jpeg,.gif,.smiles,.sdf,.mol"
                          className={styles.hiddenInput}
                          onChange={handleFileSelect}
                        />
                      </div>
                      <div className={styles.inputActionsRight}>
                        <div className={styles.modelPicker} ref={modelPickerRef}>
                          <button
                            className={styles.modelPickerBtn}
                            onClick={() => setModelPickerOpen(!modelPickerOpen)}
                          >
                            <span>{models.find((m) => m.id === selectedModel)?.name || "GPT-4o Mini"}</span>
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
                        {loading ? (
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
                  </div>
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
                    What's the vibe, <span className={styles.welcomeName}>{user?.display_name || "Researcher"}</span>?
                  </h1>

                  <div className={styles.welcomeInputBox}>
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
                    <textarea
                      ref={inputRef}
                      className={styles.inputField}
                      placeholder="Write a message..."
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
                          accept=".txt,.pdf,.csv,.png,.jpg,.jpeg,.gif,.smiles,.sdf,.mol"
                          className={styles.hiddenInput}
                          onChange={handleFileSelect}
                        />
                      </div>
                      <div className={styles.inputActionsRight}>
                        <div className={styles.modelPicker} ref={modelPickerRef}>
                          <button
                            className={styles.modelPickerBtn}
                            onClick={() => setModelPickerOpen(!modelPickerOpen)}
                          >
                            <span>{models.find((m) => m.id === selectedModel)?.name || "GPT-4o Mini"}</span>
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
                        {loading ? (
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
                  </div>

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
