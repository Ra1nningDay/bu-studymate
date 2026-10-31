import ELK, { type ElkExtendedEdge, type ElkNode } from "elkjs/lib/elk.bundled.js";
import { NODE_HEIGHT, NODE_WIDTH, workflowEdges, workflowNodes } from "@/src/presenters/agent-workflow.presenter";

export type Point = { x: number; y: number };
export type WorkflowLayout = {
  positions: Record<string, Point>;
  routes: Record<string, { points: Point[]; label: Point }>;
  width: number;
  height: number;
};

/** The topology is fixed by source, so the layout is computed once and reused for every run. */
export async function layoutWorkflow(): Promise<WorkflowLayout> {
  const input: ElkNode = {
    id: "workflow",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.padding": "[top=24,left=24,bottom=24,right=24]",
      "elk.spacing.nodeNode": "28",
      "elk.spacing.edgeNode": "18",
      "elk.layered.spacing.nodeNodeBetweenLayers": "52",
      "elk.layered.spacing.edgeEdgeBetweenLayers": "14",
      "elk.layered.spacing.edgeNodeBetweenLayers": "18",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP"
    },
    children: workflowNodes.map(node => ({ id: node.id, width: NODE_WIDTH, height: NODE_HEIGHT })),
    edges: workflowEdges.map(edge => ({ id: edge.id, sources: [edge.from], targets: [edge.to] }))
  };
  const graph = await new ELK().layout(input);

  const positions: WorkflowLayout["positions"] = {};
  graph.children?.forEach(child => { positions[child.id] = { x: child.x ?? 0, y: child.y ?? 0 }; });
  const routes: WorkflowLayout["routes"] = {};
  (graph.edges as ElkExtendedEdge[] | undefined)?.forEach(edge => {
    const section = edge.sections?.[0];
    if (!section) return;
    const points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];
    // Put the label on the longest horizontal run so it does not sit on a bend.
    let best = 0;
    let label = points[0];
    for (let index = 1; index < points.length; index++) {
      const length = Math.abs(points[index].x - points[index - 1].x);
      if (length > best) { best = length; label = { x: (points[index].x + points[index - 1].x) / 2, y: points[index].y }; }
    }
    routes[edge.id] = { points, label };
  });
  return { positions, routes, width: graph.width ?? 0, height: graph.height ?? 0 };
}
