"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { InfiniteCanvas } from "@/components/canvas/InfiniteCanvas";
import { CanvasNode, type NodeType } from "@/components/canvas/CanvasNode";
import { CausalEdge, type CausalLink } from "@/components/canvas/CausalEdge";
import { AgentIndicator } from "@/components/canvas/AgentIndicator";
import { AmbientContextBar } from "@/components/canvas/AmbientContextBar";
import { SmartQuery } from "@/components/query/SmartQuery";
import { ActionWheel } from "@/components/query/ActionWheel";
import { AdaptivePanel } from "@/components/layout/AdaptivePanel";
import { TimelineScrubber } from "@/components/canvas/TimelineScrubber";
import HolographicMolecule from "@/components/molecule/HolographicMolecule";
import { DegradationRing } from "@/components/molecule/DegradationRing";
import { CommentThread } from "@/components/canvas/CommentThread";
import { CursorGhost } from "@/components/canvas/CursorGhost";

import { MoleculeDetailsPanel } from "@/components/molecule/MoleculeDetailsPanel";
import type { MoleculeData } from "@/components/molecule/MoleculeCard";
import { useWorkflowLearning } from "@/hooks/useWorkflowLearning";
import { useCanvasPersistence } from "@/hooks/useCanvasPersistence";
import styles from "./page.module.css";

export interface APIMolecule {
  id: string;
  smiles: string;
  name: string;
  formula: string;
  affinity: number;
  ciLow: number;
  ciHigh: number;
  validationMethod: string;
  molWeight: number;
  logP: number;
  hbDonors: number;
  hbAcceptors: number;
  qed: number;
  saScore: number;
  isSaved: boolean;
}

interface SourceInfo {
  name: string;
  status: string;
  resultCount: number;
  message: string;
}

export interface WorkspaceNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  label: string;
  smiles?: string;
  moleculeData?: APIMolecule;
}

const COLS = 4;
const COL_WIDTH = 280;
const ROW_HEIGHT = 340;
const START_X = 150;
const START_Y = 150;

const AGENTS: Array<{ id: string; name: string; color: string }> = [
  { id: "chembl", name: "ChEMBL", color: "var(--accent-primary)" },
  { id: "pubmed", name: "PubMed", color: "var(--accent-success)" },
  { id: "pubchem", name: "PubChem", color: "var(--accent-warning)" },
  { id: "uniprot", name: "UniProt", color: "#8B5CF6" },
];

export default function WorkspacePage() {
  const [nodes, setNodes] = useState<WorkspaceNode[]>([]);
  const [links, setLinks] = useState<CausalLink[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [actionWheelPos, setActionWheelPos] = useState<{ x: number; y: number } | null>(null);
  const [actionWheelVisible, setActionWheelVisible] = useState(false);
  const [showAdmet, setShowAdmet] = useState(false);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showFeed, setShowFeed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [admetNodeId, setAdmetNodeId] = useState<string | null>(null);
  const [detailMolecule, setDetailMolecule] = useState<APIMolecule | null>(null);
  const [layoutSuggestion, setLayoutSuggestion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [whisperOpen, setWhisperOpen] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [inferenceTrail, setInferenceTrail] = useState<string[]>([]);
  const [showTrail, setShowTrail] = useState(false);
  const { preferences, recordAction, suggestLayout, setLayout } = useWorkflowLearning();
  const canvasPersistence = useCanvasPersistence();
  const gridCursor = useRef({ col: 0, row: 0 });
  const whisperRef = useRef<HTMLInputElement>(null);
  const previousQueryRef = useRef("");

  /* ─── restore from persistence on mount ─── */
  useEffect(() => {
    (async () => {
      const snapshot = canvasPersistence.restore();
      if (snapshot && snapshot.nodes.length > 0) {
        setNodes(snapshot.nodes);
        setLinks(snapshot.links);
        setLastQuery(snapshot.query);
        setIsGenerating(false);
        setIsLoading(false);
        return;
      }
      const timer = setTimeout(() => setIsLoading(false), 800);
      return () => clearTimeout(timer);
    })();
  }, [canvasPersistence]);

  /* ─── persist on change ─── */
  useEffect(() => {
    if (!isLoading && nodes.length > 0) {
      canvasPersistence.save(nodes, links, lastQuery);
    }
  }, [nodes, links, lastQuery, isLoading, canvasPersistence]);

  /* ─── keyboard shortcut for whisper ─── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setWhisperOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (whisperOpen && whisperRef.current) {
      whisperRef.current.focus();
    }
  }, [whisperOpen]);

  const nextGridPosition = useCallback(() => {
    const c = gridCursor.current.col;
    const r = gridCursor.current.row;
    const x = START_X + c * COL_WIDTH;
    const y = START_Y + r * ROW_HEIGHT;
    gridCursor.current.col += 1;
    if (gridCursor.current.col >= COLS) {
      gridCursor.current.col = 0;
      gridCursor.current.row += 1;
    }
    return { x, y };
  }, []);

  const addNode = useCallback((type: NodeType, label: string, smiles?: string, moleculeData?: APIMolecule) => {
    const id = `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const pos = nextGridPosition();
    const newNode: WorkspaceNode = { id, type, x: pos.x, y: pos.y, label, smiles, moleculeData };
    setNodes((prev) => [...prev, newNode]);
    return id;
  }, [nextGridPosition]);

  const generateLinks = useCallback((queryNodeId: string, sourceNames: string[], moleculeIds: string[]) => {
    const newLinks: CausalLink[] = [];

    for (const molId of moleculeIds) {
      newLinks.push({
        sourceId: queryNodeId,
        targetId: molId,
        label: "generated",
        strength: 0.85,
        type: "generated",
      });
    }

    const sourceNodes = nodes.filter((n) => sourceNames.includes(n.label));
    for (const src of sourceNodes) {
      for (const molId of moleculeIds) {
        newLinks.push({
          sourceId: src.id,
          targetId: molId,
          label: "sourced",
          strength: 0.5,
          type: "sourced",
        });
      }
    }

    setLinks((prev) => [...prev, ...newLinks]);
  }, [nodes]);

  const handleQuery = useCallback(async (query: string) => {
    setError(null);
    setIsGenerating(true);
    setGenerationProgress("Interpreting query...");
    setLastQuery(query);
    setInferenceTrail([]);
    previousQueryRef.current = query;

    const queryNodeId = addNode("query", `"${query}"`);

    setNodes([]);
    setLinks([]);
    gridCursor.current = { col: 0, row: 0 };

    try {
      setGenerationProgress("Running RAG & generative pipeline...");
      const resp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (resp.status === 401) {
        throw new Error("Session expired. Please log in again.");
      }
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || "Generation service unavailable");
      }

      const data = await resp.json();
      const mols: APIMolecule[] = data.molecules || [];
      const sources: SourceInfo[] = data.sources || [];

      // capture inference trail from response
      if (data.inference_trail) {
        setInferenceTrail(data.inference_trail);
      } else {
        setInferenceTrail([
          `Interpreting: "${query}"`,
          `Searching ${sources.length} sources...`,
          sources.map((s) => `${s.name}: ${s.status}`).join(", "),
          `Generated ${mols.length} candidate molecules`,
        ]);
      }

      setGenerationProgress(`Got ${mols.length} candidates, placing on canvas...`);

      const molIds: string[] = [];

      for (const src of sources) {
        if (src.status === "done" || src.status === "cached") {
          addNode("target", src.name);
        }
      }

      for (const mol of mols) {
        const id = addNode("molecule", mol.name || "Candidate", mol.smiles, mol);
        molIds.push(id);
      }

      const suggestion = suggestLayout(mols.length);
      if (suggestion) setLayoutSuggestion(suggestion);

      if (mols.length === 0) {
        setError("No molecules generated. Try a different target.");
      } else {
        generateLinks(queryNodeId, sources.map((s) => s.name), molIds);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
      setGenerationProgress("");
    }
  }, [addNode, suggestLayout, generateLinks]);

  /* ─── ambient whisper submit ─── */
  const handleWhisperSubmit = useCallback((input: string) => {
    setWhisperOpen(false);
    const trimmed = input.trim().replace(/^\//, "");
    if (!trimmed) return;

    if (selectedNode) {
      const node = nodes.find((n) => n.id === selectedNode);
      if (node?.moleculeData) {
        if (trimmed.toLowerCase().includes("admet") || trimmed.toLowerCase().includes("property")) {
          setShowAdmet(true);
          setAdmetNodeId(selectedNode);
          recordAction("view_admet", selectedNode);
          return;
        }
        if (trimmed.toLowerCase().includes("similar")) {
          handleQuery(`similar to ${node.smiles}`);
          return;
        }
        if (trimmed.toLowerCase().includes("detail")) {
          setDetailMolecule(node.moleculeData);
          setShowDetails(true);
          return;
        }
      }
    }

    if (trimmed.toLowerCase().startsWith("generate ") || trimmed.toLowerCase().startsWith("find ")) {
      const subQuery = trimmed.replace(/^(generate|find)\s+/i, "");
      handleQuery(subQuery);
      return;
    }

    if (trimmed.toLowerCase() === "clear") {
      setNodes([]);
      setLinks([]);
      canvasPersistence.clear();
      return;
    }

    if (trimmed.toLowerCase() === "reset view") {
      window.dispatchEvent(new CustomEvent("reset-canvas-view"));
      return;
    }

    handleQuery(trimmed);
  }, [selectedNode, nodes, handleQuery, recordAction, canvasPersistence]);

  const handleNodeSelect = useCallback((id: string) => {
    setSelectedNode(id);
    const node = nodes.find((n) => n.id === id);
    if (node?.moleculeData) {
      recordAction("view_details", id);
      setDetailMolecule(node.moleculeData);
      setShowDetails(true);
    }
  }, [nodes, recordAction]);

  const handleNodeMove = useCallback((id: string, x: number, y: number) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));
  }, []);

  const handleNodeContext = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedNode(id);
    setActionWheelPos({ x: e.clientX, y: e.clientY });
    setActionWheelVisible(true);
  }, []);

  const handleDetailClose = useCallback(() => {
    setShowDetails(false);
    setDetailMolecule(null);
  }, []);

  const selectedNodeData = nodes.find((n) => n.id === selectedNode);

  const toMoleculeData = (api: APIMolecule): MoleculeData => ({
    id: api.id,
    smiles: api.smiles,
    name: api.name,
    formula: api.formula,
    affinity: api.affinity,
    unit: "nM",
    ciLow: api.ciLow,
    ciHigh: api.ciHigh,
    validationMethod: api.validationMethod,
    molWeight: api.molWeight,
    logP: api.logP,
    hbDonors: api.hbDonors,
    hbAcceptors: api.hbAcceptors,
    qed: api.qed,
    saScore: api.saScore,
    isSaved: api.isSaved,
  });

  const nodePositions = new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }]));

  /* ─── agent states for source-type nodes ─── */
  const nodeAgentMap = useCallback((node: WorkspaceNode) => {
    if (node.type !== "target") return null;
    const agent = AGENTS.find((a) => a.name === node.label);
    if (!agent) return null;
    return {
      id: agent.id,
      name: agent.name,
      color: agent.color,
      status: "done" as const,
      activity: `${node.label} results available`,
    };
  }, []);

  const wheelActions = [
    {
      id: "details",
      label: "Details",
      icon: "📋",
      action: () => {
        if (selectedNodeData?.moleculeData) {
          setDetailMolecule(selectedNodeData.moleculeData);
          setShowDetails(true);
        }
        setActionWheelVisible(false);
        recordAction("view_details", selectedNode || "");
      },
    },
    ...(selectedNodeData?.moleculeData ? [{
      id: "admet",
      label: "ADMET",
      icon: "📊",
      action: () => {
        setShowAdmet(true);
        setAdmetNodeId(selectedNode);
        recordAction("view_admet", selectedNode || "");
        setActionWheelVisible(false);
      },
    }] : []),
    {
      id: "similar",
      label: "Similar",
      icon: "🔗",
      action: () => {
        if (selectedNodeData?.smiles) {
          handleQuery(`similar to ${selectedNodeData.smiles}`);
        }
        setActionWheelVisible(false);
      },
    },
    {
      id: "trail",
      label: "Inference",
      icon: "⟳",
      action: () => {
        setShowTrail((t) => !t);
        setActionWheelVisible(false);
      },
    },
    {
      id: "pin",
      label: "Pin",
      icon: "📌",
      action: () => {
        recordAction("pin_molecule", selectedNode || "");
        setActionWheelVisible(false);
      },
    },
  ];

  if (isLoading) return null;

  return (
    <div className={styles.workspace}>
      <div className={styles.topBar}>
        <div className={styles.brand}>
          <img src="/logo.png" alt="MoleCraft Logo" className={styles.logo} />
          <span className={styles.brandText}>MoleCraft <span className={styles.v5}>v5</span></span>
        </div>

        <div className={styles.queryArea}>
          <SmartQuery onQuery={handleQuery} />
        </div>

        <div className={styles.actions}>
          {preferences.showLiveFeeds && (
            <button
              className={`${styles.actionBtn} ${showFeed ? styles.active : ""}`}
              onClick={() => setShowFeed(!showFeed)}
              title="Live Feeds"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="2" fill="currentColor"/>
                <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="0.5" opacity="0.25"/>
              </svg>
            </button>
          )}
          <button
            className={`${styles.actionBtn} ${showTimeline ? styles.active : ""}`}
            onClick={() => setShowTimeline(!showTimeline)}
            title="Toggle timeline"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="7" width="3" height="2" rx="0.5" fill="currentColor"/>
              <rect x="6.5" y="4" width="3" height="8" rx="0.5" fill="currentColor"/>
              <rect x="11" y="1" width="3" height="14" rx="0.5" fill="currentColor"/>
            </svg>
          </button>
          {nodes.length > 0 && (
            <button
              className={styles.actionBtn}
              onClick={() => {
                setShowTrail((t) => !t);
              }}
              title={showTrail ? "Hide inference trail" : "Show inference trail"}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
                <circle cx="13" cy="4" r="1.5" fill="var(--accent-primary)"/>
                <circle cx="10" cy="8" r="1.5" fill="var(--accent-success)"/>
                <circle cx="12" cy="12" r="1.5" fill="var(--accent-warning)"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className={`${styles.mainArea} ${showDetails ? styles.withDetails : ""}`}>
        <div className={styles.canvasArea}>
          <InfiniteCanvas
            onCanvasClick={() => { setSelectedNode(null); setActionWheelVisible(false); }}
            overlay={
              <>
                <ActionWheel
                  actions={wheelActions}
                  visible={actionWheelVisible}
                  position={actionWheelPos || { x: 0, y: 0 }}
                  onClose={() => setActionWheelVisible(false)}
                />

                <AdaptivePanel
                  title="ADMET Profile"
                  visible={showAdmet}
                  onClose={() => setShowAdmet(false)}
                  position="left"
                >
                  {admetNodeId && (() => {
                    const n = nodes.find((nd) => nd.id === admetNodeId);
                    const d = n?.moleculeData;
                    return d ? (
                      <div className={styles.admetPanel}>
                        <HolographicMolecule smiles={d.smiles} width={200} height={200} />
                        <div className={styles.admetGrid}>
                          <div className={styles.admetRow}>
                            <span className={styles.admetLabel}>MW</span>
                            <span className={styles.admetValue}>{d.molWeight} g/mol</span>
                          </div>
                          <div className={styles.admetRow}>
                            <span className={styles.admetLabel}>LogP</span>
                            <span className={styles.admetValue}>{d.logP}</span>
                          </div>
                          <div className={styles.admetRow}>
                            <span className={styles.admetLabel}>H-Bond Acceptors</span>
                            <span className={styles.admetValue}>{d.hbAcceptors}</span>
                          </div>
                          <div className={styles.admetRow}>
                            <span className={styles.admetLabel}>H-Bond Donors</span>
                            <span className={styles.admetValue}>{d.hbDonors}</span>
                          </div>
                          <div className={styles.admetRow}>
                            <span className={styles.admetLabel}>QED</span>
                            <span className={styles.admetValue}>{d.qed}</span>
                          </div>
                          <div className={styles.admetRow}>
                            <span className={styles.admetLabel}>SA Score</span>
                            <span className={styles.admetValue}>{d.saScore}</span>
                          </div>
                          <div className={styles.admetRow}>
                            <span className={styles.admetLabel}>Affinity</span>
                            <span className={styles.admetValue}>{d.affinity} nM</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.emptyPanel}>Select a molecule to view ADMET</div>
                    );
                  })()}
                </AdaptivePanel>

                <AdaptivePanel
                  title="Live Feeds"
                  visible={showFeed}
                  onClose={() => setShowFeed(false)}
                  position="left"
                  width={260}
                >
                  <div className={styles.feedList}>
                    {["ChEMBL", "PubMed", "PubChem"].map((src) => (
                      <div key={src} className={styles.feedItem}>
                        <span className={styles.feedName}>{src}</span>
                        <span className={styles.feedStatus}>● Live</span>
                      </div>
                    ))}
                  </div>
                </AdaptivePanel>

                {/* inference trail panel */}
                <AdaptivePanel
                  title="Inference Trail"
                  visible={showTrail}
                  onClose={() => setShowTrail(false)}
                  position="right"
                  width={280}
                >
                  <div className={styles.trailList}>
                    {inferenceTrail.length > 0 ? (
                      inferenceTrail.map((step, i) => (
                        <div key={i} className={styles.trailStep}>
                          <span className={styles.trailDot} />
                          <span className={styles.trailText}>{step}</span>
                        </div>
                      ))
                    ) : (
                      <div className={styles.emptyPanel}>
                        Run a query to see the inference trail
                      </div>
                    )}
                  </div>
                </AdaptivePanel>

                {/* ambient whisper modal */}
                {whisperOpen && (
                  <div className={styles.whisperOverlay} onClick={() => setWhisperOpen(false)}>
                    <div className={styles.whisperModal} onClick={(e) => e.stopPropagation()}>
                      <div className={styles.whisperHeader}>
                        <kbd>/</kbd> ambient command
                        <span className={styles.whisperHint}>Tab to autocomplete · Esc to dismiss</span>
                      </div>
                      <input
                        ref={whisperRef}
                        className={styles.whisperInput}
                        type="text"
                        placeholder={
                          selectedNodeData?.moleculeData
                            ? `Ask about ${selectedNodeData.label} (admet, similar, details...)`
                            : 'Type "generate COX-2 inhibitors", "clear", "reset view"...'
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleWhisperSubmit(e.currentTarget.value);
                          } else if (e.key === "Escape") {
                            setWhisperOpen(false);
                          }
                        }}
                      />
                      <div className={styles.whisperSuggestions}>
                        <span>Try:</span>
                        {selectedNodeData?.moleculeData ? (
                          <>
                            <button className={styles.whisperChip} onClick={() => handleWhisperSubmit("admet")}>admet</button>
                            <button className={styles.whisperChip} onClick={() => handleWhisperSubmit("similar")}>similar</button>
                            <button className={styles.whisperChip} onClick={() => handleWhisperSubmit("details")}>details</button>
                          </>
                        ) : (
                          <>
                            <button className={styles.whisperChip} onClick={() => handleWhisperSubmit("clear")}>clear</button>
                            <button className={styles.whisperChip} onClick={() => handleWhisperSubmit("reset view")}>reset view</button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <CursorGhost
                  userName="You"
                  color="var(--accent-primary)"
                  x={200}
                  y={300}
                  label="exploring"
                />
              </>
            }
          >
            {nodes.length === 0 && !isGenerating && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <path d="M24 6L28 16L38 18L30 26L32 38L24 32L16 38L18 26L10 18L20 16L24 6Z" fill="var(--accent-primary)" fillOpacity="0.15" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className={styles.emptyTitle}>No molecules yet</p>
                <p className={styles.emptySub}>Type a target or disease in the search bar above</p>
                <p className={styles.emptyTip}>Press <kbd>/</kbd> for ambient commands</p>
                <div className={styles.emptyExamples}>
                  <span>Try: COX-2 inhibitors · EGFR · BRAF V600E · JAK</span>
                </div>
              </div>
            )}

            {/* causal edges layer */}
            {nodes.length > 1 && links.length > 0 && (
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}>
                <CausalEdge
                  links={links}
                  nodePositions={nodePositions}
                  viewport={{ x: 0, y: 0, scale: 1 }}
                />
              </div>
            )}

            {nodes.map((node) => {
              const agent = nodeAgentMap(node);
              return (
                <div
                  key={node.id}
                  style={{ position: "absolute", left: 0, top: 0 }}
                  onContextMenu={(e) => handleNodeContext(e, node.id)}
                >
                  <CanvasNode
                    node={{
                      id: node.id,
                      type: node.type,
                      x: node.x,
                      y: node.y,
                      label: node.label,
                      content: node.smiles ? (
                        <div className={styles.canvasNodeContent}>
                          <HolographicMolecule smiles={node.smiles} width={160} height={140} />
                          {node.moleculeData && (
                            <div className={styles.nodeMeta}>
                              <span className={styles.smilesLabel}>{node.smiles}</span>
                              <div className={styles.nodeBadges}>
                                <span className={styles.badgeAffinity}>{node.moleculeData.affinity} nM</span>
                                <DegradationRing
                                  smiles={node.smiles}
                                  stability={Math.round(Math.max(30, Math.min(100, 100 - node.moleculeData.affinity * 0.08)))}
                                  size={32}
                                />
                              </div>
                              <div className={styles.nodeProps}>
                                <span className={styles.nodeProp}>MW {node.moleculeData.molWeight}</span>
                                <span className={styles.nodeProp}>LogP {node.moleculeData.logP}</span>
                                <span className={styles.nodeProp}>QED {node.moleculeData.qed}</span>
                              </div>
                            </div>
                          )}
                          <CommentThread moleculeName={node.label} />
                        </div>
                      ) : undefined,
                    }}
                    isSelected={selectedNode === node.id}
                    onSelect={handleNodeSelect}
                    onMove={handleNodeMove}
                    scale={1}
                  />
                  {agent && (
                    <AgentIndicator
                      agents={[agent]}
                      nodeX={node.x}
                      nodeY={node.y}
                    />
                  )}
                </div>
              );
            })}

            {isGenerating && (
              <div className={styles.generatingOverlay}>
                <div className={styles.generatingSpinner} />
                <span className={styles.generatingText}>{generationProgress}</span>
              </div>
            )}
          </InfiniteCanvas>

          {/* ambient context bar sits outside canvas transform so it's fixed */}
          <AmbientContextBar
            nodeCount={nodes.length}
            selectedNodeLabel={selectedNodeData?.label || null}
            selectedNodeType={selectedNodeData?.type || null}
            selectedMolecule={selectedNodeData?.moleculeData ? {
              id: selectedNodeData.id,
              name: selectedNodeData.label,
              affinity: selectedNodeData.moleculeData.affinity,
              smiles: selectedNodeData.moleculeData.smiles,
            } : null}
            generationProgress={generationProgress}
            isGenerating={isGenerating}
            onOpenWhisper={() => setWhisperOpen(true)}
          />
        </div>

        {showDetails && detailMolecule && (
          <MoleculeDetailsPanel
            key={detailMolecule.id}
            molecule={toMoleculeData(detailMolecule)}
            onClose={handleDetailClose}
          />
        )}
      </div>

      <div className={styles.bottomBar}>
        {error && (
          <div className={styles.errorBar}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M7 4.5V7.5M7 9V9.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span className={styles.errorText}>{error}</span>
            <button className={styles.errorDismiss} onClick={() => setError(null)}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        )}
        {showTimeline && <TimelineScrubber totalHours={24} />}
      </div>

      {layoutSuggestion && (
        <div className={styles.suggestion}>
          <span>{layoutSuggestion}</span>
          <button className={styles.suggestionAction} onClick={() => { setLayout("matrix"); setLayoutSuggestion(null); }}>Switch</button>
          <button className={styles.suggestionDismiss} onClick={() => setLayoutSuggestion(null)}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
