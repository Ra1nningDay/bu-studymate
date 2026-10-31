"use client";

import { useEffect, useMemo } from "react";
import { BaseEdge, Background, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow, useNodesInitialized, useReactFlow, type Edge, type EdgeProps, type Node, type NodeProps } from "@xyflow/react";
import { BookOpen, GitBranch, Globe, Layers, Link2, List, MessageSquare, Search, Send, ShieldCheck, Sparkles, Ticket, type LucideIcon } from "lucide-react";
import { NODE_HEIGHT, NODE_WIDTH, stateLabel, workflowEdges, workflowNodes, type NodeRunInfo, type NodeState, type WorkflowIcon, type WorkflowNodeDef, type WorkflowRunState } from "@/src/presenters/agent-workflow.presenter";
import type { Point, WorkflowLayout } from "./workflow-layout";

const icons: Record<WorkflowIcon, LucideIcon> = {
  message: MessageSquare, shield: ShieldCheck, branch: GitBranch, search: Search, layers: Layers, list: List, sparkles: Sparkles,
  globe: Globe, link: Link2, book: BookOpen, ticket: Ticket, chat: MessageSquare, output: Send
};
const kindLabel: Record<WorkflowNodeDef["kind"], string> = {
  input: "Input", guard: "Guard", router: "Router", agent: "Agent", retrieval: "Retrieval", llm: "LLM", tool: "Tool", output: "Output"
};
const minimapColor: Record<NodeState, string> = {
  success: "#047857", fallback: "#b45309", failed: "#be123c", skipped: "#64748b", unknown: "#0369a1", unrecorded: "#94a3b8", idle: "#e2e8f0"
};

type NodeData = { def: WorkflowNodeDef; info: NodeRunInfo; dim: boolean; time: string | null };
type FlowNode = Node<NodeData, "step">;
type EdgeData = { points: Point[]; label?: string; labelAt: Point; active: boolean; dim: boolean };
type FlowEdge = Edge<EdgeData, "elk">;

function StepNode({ data, selected }: NodeProps<FlowNode>) {
  const Icon = icons[data.def.icon];
  const { state } = data.info;
  return <div className="wf-node" data-state={state} data-dim={data.dim} data-selected={selected} aria-label={`${data.def.label} · ${stateLabel[state]}`}>
    <Handle type="target" position={Position.Left} isConnectable={false} className="wf-handle" />
    <Icon aria-hidden="true" className="wf-node-icon" />
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold">{data.def.label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-[11px]"><span className="wf-badge">{stateLabel[state]}</span><span className="truncate opacity-80">{data.time ?? kindLabel[data.def.kind]}</span></p>
    </div>
    <Handle type="source" position={Position.Right} isConnectable={false} className="wf-handle" />
  </div>;
}

/** Draws the orthogonal route computed by ELK, rounding each bend. */
function ElkEdge({ data, markerEnd }: EdgeProps<FlowEdge>) {
  if (!data) return null;
  const radius = 8;
  const { points } = data;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length - 1; index++) {
    const previous = points[index - 1];
    const bend = points[index];
    const next = points[index + 1];
    const before = Math.min(radius, Math.hypot(bend.x - previous.x, bend.y - previous.y) / 2);
    const after = Math.min(radius, Math.hypot(next.x - bend.x, next.y - bend.y) / 2);
    const start = { x: bend.x - Math.sign(bend.x - previous.x) * before, y: bend.y - Math.sign(bend.y - previous.y) * before };
    const end = { x: bend.x + Math.sign(next.x - bend.x) * after, y: bend.y + Math.sign(next.y - bend.y) * after };
    path += ` L ${start.x} ${start.y} Q ${bend.x} ${bend.y} ${end.x} ${end.y}`;
  }
  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;
  return <>
    <BaseEdge path={path} markerEnd={markerEnd} className="wf-edge" style={{ stroke: data.active ? "#047857" : "#94a3b8", strokeWidth: data.active ? 2.5 : 1.5, opacity: data.dim ? 0.3 : 1 }} />
    {data.label && <text x={data.labelAt.x} y={data.labelAt.y - 6} textAnchor="middle" className="wf-edge-label" style={{ opacity: data.dim ? 0.35 : 1 }}>{data.label}</text>}
  </>;
}

const nodeTypes = { step: StepNode };
const edgeTypes = { elk: ElkEdge };

/** Zooms to the recorded path so a short run is readable; the Fit View control still shows everything. */
function AutoFit({ ids, resetKey }: { ids: string[]; resetKey: string }) {
  const { fitView } = useReactFlow();
  const ready = useNodesInitialized();
  useEffect(() => {
    if (ready) fitView({ nodes: ids.map(id => ({ id })), padding: 0.12, minZoom: 0.45, maxZoom: 1, duration: 200 });
    // ids is derived from resetKey; refit only when the run or view changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, resetKey]);
  return null;
}

export function WorkflowCanvas({ layout, run, mode, runKey, selectedId, onSelect }: {
  layout: WorkflowLayout;
  run: WorkflowRunState;
  mode: "run" | "architecture";
  runKey: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const trace = mode === "run";
  const focusIds = useMemo(() => trace ? workflowNodes.filter(def => run.nodes[def.id].state !== "idle").map(def => def.id) : workflowNodes.map(def => def.id), [run, trace]);
  const nodes = useMemo<FlowNode[]>(() => workflowNodes.map(def => {
    const info = run.nodes[def.id];
    return { id: def.id, type: "step", position: layout.positions[def.id], width: NODE_WIDTH, height: NODE_HEIGHT, selected: def.id === selectedId, draggable: false,
      data: { def, info: trace ? info : { ...info, state: "idle" }, dim: trace && info.state === "idle", time: trace && info.durationMs !== undefined ? `${info.durationMs.toLocaleString("en-US")} ms` : null } };
  }), [layout, run, trace, selectedId]);
  const edges = useMemo<FlowEdge[]>(() => workflowEdges.flatMap(edge => {
    const route = layout.routes[edge.id];
    if (!route) return [];
    const active = trace && run.edges[edge.id];
    return [{ id: edge.id, source: edge.from, target: edge.to, type: "elk", selectable: false, focusable: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: active ? "#047857" : "#94a3b8" },
      data: { points: route.points, label: edge.label, labelAt: route.label, active, dim: trace && !active } }];
  }), [layout, run, trace]);

  return <div className="wf-canvas" role="group" aria-label="แผนภาพ System Workflow">
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView fitViewOptions={{ padding: 0.08 }}
      minZoom={0.15} maxZoom={1.6} nodesDraggable={false} nodesConnectable={false} edgesFocusable={false} proOptions={{ hideAttribution: true }}
      onNodeClick={(_, node) => onSelect(node.id)}>
      <AutoFit ids={focusIds} resetKey={`${runKey}:${mode}`} />
      <Background gap={20} color="#e2e8f0" />
      <Controls showInteractive={false} position="bottom-left" aria-label="ควบคุมการซูม" />
      <MiniMap pannable zoomable ariaLabel="แผนที่ย่อ" nodeColor={node => minimapColor[(node.data as NodeData).info.state]} nodeStrokeWidth={2} />
    </ReactFlow>
  </div>;
}
