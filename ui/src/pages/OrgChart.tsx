import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Link, useNavigate } from "@/lib/router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { agentsApi, type OrgNode } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { agentUrl } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { AgentIcon } from "../components/AgentIconPicker";
import { Download, Network, Upload } from "lucide-react";
import { AGENT_ROLE_LABELS, type Agent } from "@paperclipai/shared";

// Layout constants
const CARD_W = 200;
const CARD_H = 100;
const GAP_X = 32;
const GAP_Y = 80;
const PADDING = 60;

// ── Tree layout types ───────────────────────────────────────────────────

interface LayoutNode {
  id: string;
  name: string;
  role: string;
  status: string;
  x: number;
  y: number;
  children: LayoutNode[];
}

// ── Layout algorithm ────────────────────────────────────────────────────

/** Compute the width each subtree needs. */
function subtreeWidth(node: OrgNode): number {
  if (node.reports.length === 0) return CARD_W;
  const childrenW = node.reports.reduce((sum, c) => sum + subtreeWidth(c), 0);
  const gaps = (node.reports.length - 1) * GAP_X;
  return Math.max(CARD_W, childrenW + gaps);
}

/** Recursively assign x,y positions. */
function layoutTree(node: OrgNode, x: number, y: number): LayoutNode {
  const totalW = subtreeWidth(node);
  const layoutChildren: LayoutNode[] = [];

  if (node.reports.length > 0) {
    const childrenW = node.reports.reduce((sum, c) => sum + subtreeWidth(c), 0);
    const gaps = (node.reports.length - 1) * GAP_X;
    let cx = x + (totalW - childrenW - gaps) / 2;

    for (const child of node.reports) {
      const cw = subtreeWidth(child);
      layoutChildren.push(layoutTree(child, cx, y + CARD_H + GAP_Y));
      cx += cw + GAP_X;
    }
  }

  return {
    id: node.id,
    name: node.name,
    role: node.role,
    status: node.status,
    x: x + (totalW - CARD_W) / 2,
    y,
    children: layoutChildren,
  };
}

/** Layout all root nodes side by side. */
function layoutForest(roots: OrgNode[]): LayoutNode[] {
  if (roots.length === 0) return [];

  const totalW = roots.reduce((sum, r) => sum + subtreeWidth(r), 0);
  const gaps = (roots.length - 1) * GAP_X;
  let x = PADDING;
  const y = PADDING;

  const result: LayoutNode[] = [];
  for (const root of roots) {
    const w = subtreeWidth(root);
    result.push(layoutTree(root, x, y));
    x += w + GAP_X;
  }

  // Compute bounds and return
  return result;
}

/** Flatten layout tree to list of nodes. */
function flattenLayout(nodes: LayoutNode[]): LayoutNode[] {
  const result: LayoutNode[] = [];
  function walk(n: LayoutNode) {
    result.push(n);
    n.children.forEach(walk);
  }
  nodes.forEach(walk);
  return result;
}

/** Collect all parent→child edges. */
function collectEdges(nodes: LayoutNode[]): Array<{ parent: LayoutNode; child: LayoutNode }> {
  const edges: Array<{ parent: LayoutNode; child: LayoutNode }> = [];
  function walk(n: LayoutNode) {
    for (const c of n.children) {
      edges.push({ parent: n, child: c });
      walk(c);
    }
  }
  nodes.forEach(walk);
  return edges;
}

// ── Status dot colors (raw hex for SVG) ─────────────────────────────────

const adapterLabels: Record<string, string> = {
  claude_local: "Claude",
  codex_local: "Codex",
  gemini_local: "Gemini",
  opencode_local: "OpenCode",
  cursor: "Cursor",
  openclaw_gateway: "OpenClaw Gateway",
  process: "Process",
  http: "HTTP",
};

const statusDotColor: Record<string, string> = {
  running: "#22d3ee",
  active: "#4ade80",
  paused: "#facc15",
  idle: "#facc15",
  error: "#f87171",
  terminated: "#a3a3a3",
};
const defaultDotColor = "#a3a3a3";
const ORG_FONT_SCALE_STORAGE_KEY = "paperclip.org.fontScale";

function getInitialOrgFontScale(): number {
  try {
    const raw = localStorage.getItem(ORG_FONT_SCALE_STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    if (Number.isFinite(parsed)) {
      return Math.min(1.35, Math.max(0.8, parsed));
    }
  } catch {
    // ignore storage errors
  }
  return 1;
}

function extractAgentModel(agent: Agent | undefined): string | null {
  if (!agent) return null;
  const model = agent.adapterConfig?.model;
  if (typeof model === "string" && model.trim().length > 0) {
    return model.trim();
  }
  return null;
}

// ── Main component ──────────────────────────────────────────────────────

export function OrgChart() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();

  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(new Set());
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [fontScale, setFontScale] = useState<number>(() => getInitialOrgFontScale());

  const { data: orgTree, isLoading } = useQuery({
    queryKey: queryKeys.org(selectedCompanyId!),
    queryFn: () => agentsApi.org(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentMap = useMemo(() => {
    const m = new Map<string, Agent>();
    for (const a of agents ?? []) m.set(a.id, a);
    return m;
  }, [agents]);

  useEffect(() => {
    setBreadcrumbs([{ label: "Org Chart" }]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    localStorage.setItem(ORG_FONT_SCALE_STORAGE_KEY, String(fontScale));
  }, [fontScale]);

  // Layout computation
  const layout = useMemo(() => layoutForest(orgTree ?? []), [orgTree]);
  const allNodes = useMemo(() => flattenLayout(layout), [layout]);
  const edges = useMemo(() => collectEdges(layout), [layout]);

  // Compute SVG bounds
  const bounds = useMemo(() => {
    if (allNodes.length === 0) return { width: 800, height: 600 };
    let maxX = 0, maxY = 0;
    for (const n of allNodes) {
      maxX = Math.max(maxX, n.x + CARD_W);
      maxY = Math.max(maxY, n.y + CARD_H);
    }
    return { width: maxX + PADDING, height: maxY + PADDING };
  }, [allNodes]);

  // Pan & zoom state
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Center the chart on first load
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (hasInitialized.current || allNodes.length === 0 || !containerRef.current) return;
    hasInitialized.current = true;

    const container = containerRef.current;
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;

    // Fit chart to container
    const scaleX = (containerW - 40) / bounds.width;
    const scaleY = (containerH - 40) / bounds.height;
    const fitZoom = Math.min(scaleX, scaleY, 1);

    const chartW = bounds.width * fitZoom;
    const chartH = bounds.height * fitZoom;

    setZoom(fitZoom);
    setPan({
      x: (containerW - chartW) / 2,
      y: (containerH - chartH) / 2,
    });
  }, [allNodes, bounds]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Don't drag if clicking a card
    const target = e.target as HTMLElement;
    if (target.closest("[data-org-card]")) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
  }, [dragging]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(Math.max(zoom * factor, 0.2), 2);

    // Zoom toward mouse position
    const scale = newZoom / zoom;
    setPan({
      x: mouseX - scale * (mouseX - pan.x),
      y: mouseY - scale * (mouseY - pan.y),
    });
    setZoom(newZoom);
  }, [zoom, pan]);

  if (!selectedCompanyId) {
    return <EmptyState icon={Network} message="Select a company to view the org chart." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="org-chart" />;
  }

  if (orgTree && orgTree.length === 0) {
    return <EmptyState icon={Network} message="No organizational hierarchy defined." />;
  }

  return (
    <div className="flex flex-col h-full">
    <div className="mb-2 flex items-center justify-start gap-2 shrink-0">
      <Link to="/company/import">
        <Button variant="outline" size="sm">
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          Import company
        </Button>
      </Link>
      <Link to="/company/export">
        <Button variant="outline" size="sm">
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export company
        </Button>
      </Link>
    </div>
    <div
      ref={containerRef}
      className="w-full flex-1 min-h-0 overflow-hidden relative bg-muted/20 border border-border rounded-lg"
      style={{ cursor: dragging ? "grabbing" : "grab" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Zoom controls */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-md border border-border bg-background/95 px-2 py-1.5 text-xs backdrop-blur">
        <span className="text-muted-foreground">Text</span>
        <input
          type="range"
          min={0.8}
          max={1.35}
          step={0.05}
          value={fontScale}
          onChange={(e) => setFontScale(Number(e.target.value))}
          aria-label="Org chart text size"
        />
        <button
          className="rounded border border-border px-1.5 py-0.5 hover:bg-accent transition-colors"
          onClick={() => setFontScale(1)}
          title="Reset text size"
        >
          Reset
        </button>
      </div>

      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
        <button
          className="w-7 h-7 flex items-center justify-center bg-background border border-border rounded text-sm hover:bg-accent transition-colors"
          onClick={() => {
            const newZoom = Math.min(zoom * 1.2, 2);
            const container = containerRef.current;
            if (container) {
              const cx = container.clientWidth / 2;
              const cy = container.clientHeight / 2;
              const scale = newZoom / zoom;
              setPan({ x: cx - scale * (cx - pan.x), y: cy - scale * (cy - pan.y) });
            }
            setZoom(newZoom);
          }}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          className="w-7 h-7 flex items-center justify-center bg-background border border-border rounded text-sm hover:bg-accent transition-colors"
          onClick={() => {
            const newZoom = Math.max(zoom * 0.8, 0.2);
            const container = containerRef.current;
            if (container) {
              const cx = container.clientWidth / 2;
              const cy = container.clientHeight / 2;
              const scale = newZoom / zoom;
              setPan({ x: cx - scale * (cx - pan.x), y: cy - scale * (cy - pan.y) });
            }
            setZoom(newZoom);
          }}
          aria-label="Zoom out"
        >
          &minus;
        </button>
        <button
          className="w-7 h-7 flex items-center justify-center bg-background border border-border rounded text-[10px] hover:bg-accent transition-colors"
          onClick={() => {
            if (!containerRef.current) return;
            const cW = containerRef.current.clientWidth;
            const cH = containerRef.current.clientHeight;
            const scaleX = (cW - 40) / bounds.width;
            const scaleY = (cH - 40) / bounds.height;
            const fitZoom = Math.min(scaleX, scaleY, 1);
            const chartW = bounds.width * fitZoom;
            const chartH = bounds.height * fitZoom;
            setZoom(fitZoom);
            setPan({ x: (cW - chartW) / 2, y: (cH - chartH) / 2 });
          }}
          title="Fit to screen"
          aria-label="Fit chart to screen"
        >
          Fit
        </button>
      </div>

      {/* SVG layer for edges */}
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{
          width: "100%",
          height: "100%",
        }}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {edges.map(({ parent, child }) => {
            const x1 = parent.x + CARD_W / 2;
            const y1 = parent.y + CARD_H;
            const x2 = child.x + CARD_W / 2;
            const y2 = child.y;
            const midY = (y1 + y2) / 2;

            return (
              <path
                key={`${parent.id}-${child.id}`}
                d={`M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`}
                fill="none"
                stroke="var(--border)"
                strokeWidth={1.5}
              />
            );
          })}
        </g>
      </svg>

      {/* Selection info bar */}
      {selectedAgentIds.size > 0 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 bg-background border border-border rounded-lg px-4 py-2 shadow-lg flex items-center gap-3">
          <span className="text-sm font-medium">{selectedAgentIds.size} selected</span>
          <button
            className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
            onClick={() => setShowBulkMenu(!showBulkMenu)}
          >
            Bulk Edit
          </button>
          <button
            className="px-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setSelectedAgentIds(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      {/* Bulk edit menu */}
      {showBulkMenu && selectedAgentIds.size > 0 && (
        <BulkEditMenu
          selectedAgentIds={Array.from(selectedAgentIds)}
          companyId={selectedCompanyId!}
          onClose={() => setShowBulkMenu(false)}
          onSuccess={() => {
            setSelectedAgentIds(new Set());
            setShowBulkMenu(false);
          }}
        />
      )}

      {/* Card layer */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {allNodes.map((node) => {
          const agent = agentMap.get(node.id);
          const dotColor = statusDotColor[node.status] ?? defaultDotColor;
          const modelName = extractAgentModel(agent);

          return (
            <div
              key={node.id}
              data-org-card
              className={`absolute rounded-lg shadow-sm hover:shadow-md transition-[box-shadow,border-color,background-color] duration-150 cursor-pointer select-none border-2 ${
                selectedAgentIds.has(node.id)
                  ? "bg-primary/10 border-primary"
                  : "bg-card border-border hover:border-foreground/20"
              }`}
              style={{
                left: node.x,
                top: node.y,
                width: CARD_W,
                minHeight: CARD_H,
              }}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  // Multi-select with Ctrl/Cmd
                  const newSelected = new Set(selectedAgentIds);
                  if (newSelected.has(node.id)) {
                    newSelected.delete(node.id);
                  } else {
                    newSelected.add(node.id);
                  }
                  setSelectedAgentIds(newSelected);
                } else if (selectedAgentIds.size > 0) {
                  // If already in selection mode, toggle selection
                  const newSelected = new Set(selectedAgentIds);
                  if (newSelected.has(node.id)) {
                    newSelected.delete(node.id);
                  } else {
                    newSelected.add(node.id);
                  }
                  setSelectedAgentIds(newSelected);
                } else {
                  // Normal click - navigate to agent
                  navigate(agent ? agentUrl(agent) : `/agents/${node.id}`);
                }
              }}
            >
              <div className="flex items-center px-4 py-3 gap-3">
                {/* Agent icon + status dot */}
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                    <AgentIcon icon={agent?.icon} className="h-4.5 w-4.5 text-foreground/70" />
                  </div>
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card"
                    style={{ backgroundColor: dotColor }}
                  />
                </div>
                {/* Name + role + adapter type */}
                <div className="flex flex-col items-start min-w-0 flex-1">
                  <span className="font-semibold text-foreground leading-tight" style={{ fontSize: `${0.875 * fontScale}rem` }}>
                    {node.name}
                  </span>
                  <span className="text-muted-foreground leading-tight mt-0.5" style={{ fontSize: `${0.6875 * fontScale}rem` }}>
                    {agent?.title ?? roleLabel(node.role)}
                  </span>
                  {agent && (
                    <span className="text-muted-foreground/60 font-mono leading-tight mt-1" style={{ fontSize: `${0.625 * fontScale}rem` }}>
                      {adapterLabels[agent.adapterType] ?? agent.adapterType}
                    </span>
                  )}
                  {modelName && (
                    <span className="text-muted-foreground/60 font-mono leading-tight mt-0.5 truncate max-w-full" style={{ fontSize: `${0.625 * fontScale}rem` }} title={modelName}>
                      {modelName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </div>
  );
}

const roleLabels: Record<string, string> = AGENT_ROLE_LABELS;

function roleLabel(role: string): string {
  return roleLabels[role] ?? role;
}

// ── Bulk Edit Menu Component ────────────────────────────────────────────

interface BulkEditMenuProps {
  selectedAgentIds: string[];
  companyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function BulkEditMenu({ selectedAgentIds, companyId, onClose, onSuccess }: BulkEditMenuProps) {
  const [selectedAdapter, setSelectedAdapter] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  
  const queryClient = useQuery({
    queryKey: queryKeys.agents.list(companyId),
  });

  const AVAILABLE_ADAPTERS = [
    { type: "claude_local", label: "Claude Local" },
    { type: "codex_local", label: "Codex Local" },
    { type: "cursor_local", label: "Cursor Local" },
    { type: "opencode_local", label: "OpenCode Local" },
    { type: "pi_local", label: "Pi Local" },
  ];

  // Fetch models for selected adapter
  const { data: adapterModels = [], isLoading: modelsLoading } = useQuery({
    queryKey: selectedAdapter ? queryKeys.agents.adapterModels(companyId, selectedAdapter) : ["disabled"],
    queryFn: () => selectedAdapter ? agentsApi.adapterModels(companyId, selectedAdapter) : Promise.resolve([]),
    enabled: Boolean(selectedAdapter),
  });

  const updateMutation = useMutation({
    mutationFn: (data: {
      agentIds: string[];
      adapterType?: string;
      runtimeConfig?: Record<string, unknown>;
    }) => agentsApi.batchUpdate(companyId, data),
    onSuccess: () => {
      queryClient.refetch();
      onSuccess();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Update failed");
    },
  });

  const handleUpdate = () => {
    if (!selectedAdapter) {
      setError("Please select an adapter");
      return;
    }

    const payload: any = {
      agentIds: selectedAgentIds,
      adapterType: selectedAdapter,
    };

    if (selectedModel) {
      payload.runtimeConfig = { model: selectedModel };
    }

    updateMutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center pointer-events-auto">
      <div className="bg-background rounded-lg border border-border p-6 w-96 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">Bulk Edit Agents</h2>

        <div className="space-y-4">
          {/* Adapter select */}
          <div>
            <label className="block text-sm font-medium mb-2">Adapter</label>
            <select
              value={selectedAdapter}
              onChange={(e) => {
                setSelectedAdapter(e.target.value);
                setSelectedModel("");
                setError(null);
              }}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
            >
              <option value="">Select adapter...</option>
              {AVAILABLE_ADAPTERS.map((adapter) => (
                <option key={adapter.type} value={adapter.type}>
                  {adapter.label}
                </option>
              ))}
            </select>
          </div>

          {/* Model select - only show if adapter is selected */}
          {selectedAdapter && (
            <div>
              <label className="block text-sm font-medium mb-2">Model (Optional)</label>
              {modelsLoading ? (
                <div className="w-full px-3 py-2 border border-border rounded-md bg-muted text-sm text-muted-foreground">
                  Loading models...
                </div>
              ) : adapterModels.length > 0 ? (
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    setSelectedModel(e.target.value);
                    setError(null);
                  }}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                >
                  <option value="">Select model (optional)...</option>
                  {adapterModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="w-full px-3 py-2 border border-border rounded-md bg-muted text-sm text-muted-foreground">
                  No models available for this adapter
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && <div className="text-sm text-destructive mt-4">{error}</div>}

        {/* Actions */}
        <div className="flex gap-2 mt-6">
          <button
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors text-sm disabled:opacity-50"
            onClick={handleUpdate}
            disabled={updateMutation.isPending || !selectedAdapter || modelsLoading}
          >
            {updateMutation.isPending ? "Updating..." : `Update ${selectedAgentIds.length} Agents`}
          </button>
          <button
            className="px-4 py-2 border border-border rounded hover:bg-muted transition-colors text-sm"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
