'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import type { DebtNode, GraphLink } from '@/types';
import { scoreColor } from '@/lib/utils';
import { useViewMode } from '@/contexts/ViewModeContext';

interface HeatMapProps {
  nodes: DebtNode[];
  links: GraphLink[];
  selectedId: string | null;
  onSelect: (node: DebtNode | null) => void;
  width?: number;
  height?: number;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  debt_score: number;
  security_score: number;
  security_weighted_score: number;
  has_critical_security: boolean;
  vulnerability_count: number;
  exploitability_score: number;
  security_risk_level: DebtNode['security_risk_level'];
  symbol_name: string;
  file_path: string;
  blast_radius: number;
  owasp_categories: string[];
  cwe_categories: string[];
  security_findings: DebtNode['security_findings'];
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export function HeatMap({
  nodes,
  links,
  selectedId,
  onSelect,
  width = 800,
  height = 600,
}: HeatMapProps) {
  const { mode } = useViewMode();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<any>(null);

  const render = useCallback(() => {
    if (!containerRef.current || nodes.length === 0) return;

    const container = containerRef.current;
    const w = container.clientWidth || width;
    const h = container.clientHeight || height;

    d3.select(container).selectAll('svg').remove();

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', w)
      .attr('height', h)
      .attr('viewBox', [0, 0, w, h]);

    svgRef.current = svg.node();

    // Ensure custom HTML tooltip container exists
    let tooltip = d3.select(container).select<HTMLDivElement>('.graph-tooltip');
    if (tooltip.empty()) {
      tooltip = d3.select(container)
        .append('div')
        .attr('class', 'graph-tooltip opacity-0 hidden');
    }

    const g = svg.append('g');

    // Add glowing filter definitions for the nodes (Requirement 5)
    const defs = svg.append('defs');
    const glowFilter = defs.append('filter')
      .attr('id', 'node-glow')
      .attr('x', '-100%')
      .attr('y', '-100%')
      .attr('width', '300%')
      .attr('height', '300%');

    glowFilter.append('feGaussianBlur')
      .attr('stdDeviation', '6')
      .attr('result', 'blur');

    const feMerge = glowFilter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'blur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const securityGlow = defs.append('filter')
      .attr('id', 'security-glow')
      .attr('x', '-120%')
      .attr('y', '-120%')
      .attr('width', '340%')
      .attr('height', '340%');

    securityGlow.append('feGaussianBlur')
      .attr('stdDeviation', '4')
      .attr('result', 'blur');

    const securityMerge = securityGlow.append('feMerge');
    securityMerge.append('feMergeNode').attr('in', 'blur');
    securityMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Standard node drop-shadow to make nodes pop and feel 3D (Requirement: visible nodes)
    const shadowFilter = defs.append('filter')
      .attr('id', 'node-shadow')
      .attr('x', '-30%')
      .attr('y', '-30%')
      .attr('width', '160%')
      .attr('height', '160%');

    shadowFilter.append('feDropShadow')
      .attr('dx', '0')
      .attr('dy', '3')
      .attr('stdDeviation', '4')
      .attr('flood-color', '#3d2f22')
      .attr('flood-opacity', '0.14');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);
    zoomRef.current = zoom;

    const simNodes: SimNode[] = nodes.map((n) => ({
      id: n.id,
      debt_score: n.debt_score,
      security_score: n.security_score ?? 0,
      security_weighted_score: n.security_weighted_score ?? 0,
      has_critical_security: n.has_critical_security ?? false,
      vulnerability_count: n.vulnerability_count ?? 0,
      exploitability_score: n.exploitability_score ?? 0,
      security_risk_level: n.security_risk_level ?? 'none',
      symbol_name: n.symbol_name,
      file_path: n.file_path,
      blast_radius: n.blast_radius,
      owasp_categories: n.owasp_categories ?? [],
      cwe_categories: n.cwe_categories ?? [],
      security_findings: n.security_findings ?? [],
      // Re-initialize coordinates to let D3 calculate a perfectly balanced centered layout
      x: undefined,
      y: undefined,
    }));

    const nodeIds = new Set(simNodes.map((n) => n.id));
    const simLinks = links
      .filter((l) => nodeIds.has(l.source as string) && nodeIds.has(l.target as string))
      .map((l) => ({
        source: l.source as string,
        target: l.target as string,
        weight: l.weight,
      }));

    const simulation = d3
      .forceSimulation(simNodes)
      .force(
        'link',
        d3
          .forceLink(simLinks)
          .id((d) => (d as SimNode).id)
          .distance(90)
          .strength(0.35)
      )
      .force('charge', d3.forceManyBody().strength(-220))
      .force('x', d3.forceX(w / 2).strength(0.18)) // Gravity to center horizontally
      .force('y', d3.forceY(h / 2).strength(0.18)) // Gravity to center vertically, removing blank space
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collision', d3.forceCollide().radius((d) => radius(d as SimNode, selectedId) + 6));

    // Dynamic bold link edges (Requirement: clearly visible graph edges)
    const link = g
      .append('g')
      .attr('stroke', 'rgba(140, 98, 57, 0.48)') // Richer, darker caramel-brown
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke-width', (d) => Math.sqrt(d.weight) * 0.4 + 1.25) // Bold, visible width
      .attr('stroke-dasharray', '5,3') // Highly visible dashing pattern
      .attr('opacity', 0.95); // High opacity for absolute clarity

    // Dynamic Concentric Rings for Selected Node under node groups
    let glowCircle1: any;
    let glowCircle2: any;
    if (selectedId) {
      glowCircle1 = g.append('circle')
        .attr('fill', 'none')
        .attr('stroke', 'rgba(176, 122, 77, 0.35)')
        .attr('stroke-width', 2.5)
        .attr('opacity', 0.8)
        .attr('class', 'glow-pulse');

      glowCircle2 = g.append('circle')
        .attr('fill', 'none')
        .attr('stroke', 'rgba(176, 122, 77, 0.15)')
        .attr('stroke-width', 1.25)
        .attr('opacity', 0.5)
        .attr('class', 'glow-pulse');
    }

    const dragBehavior = d3
      .drag<SVGCircleElement, SimNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    const node = g
      .append('g')
      .selectAll<SVGCircleElement, SimNode>('circle')
      .data(simNodes)
      .join('circle')
      .attr('r', (d) => radius(d, selectedId))
      .attr('fill', (d) => scoreColor(d.debt_score))
      .attr('stroke', (d) => {
        if (d.has_critical_security) return d.security_risk_level === 'critical' ? '#8f1d1d' : '#d85b2b';
        return d.id === selectedId ? '#8c6239' : 'rgba(107, 91, 77, 0.72)'; // Bold warm-espresso border
      })
      .attr('stroke-width', (d) => {
        if (d.has_critical_security) return d.id === selectedId ? 5 : 3.5;
        return d.id === selectedId ? 4.5 : 2.25; // Double outline thickness for boldness
      })
      .attr('stroke-dasharray', (d) => (d.has_critical_security && d.security_risk_level === 'critical' ? '5,3' : null))
      .attr('opacity', (d) => (d.id === selectedId ? 1 : 0.95)) // Maximum boldness opacity
      .attr('filter', (d) => {
        if (d.has_critical_security) return 'url(#security-glow)';
        return d.id === selectedId ? 'url(#node-glow)' : 'url(#node-shadow)'; // Soft 3D drop-shadow
      })
      .attr('class', (d) => {
        const classes = [] as string[];
        if (d.has_critical_security) classes.push('security-critical-node');
        if (d.has_critical_security && d.security_risk_level === 'critical') classes.push('security-collapsed-node');
        return classes.join(' ');
      })
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        const full = nodes.find((n) => n.id === d.id) ?? null;
        onSelect(full);
      })
      .on('mouseover', function (event, d) {
        // Hover zoom
        d3.select(this)
          .transition()
          .duration(150)
          .attr('r', radius(d, selectedId) * 1.25)
          .attr('opacity', 1)
          .attr('stroke-width', 4)
          .attr('filter', d.has_critical_security ? 'url(#security-glow)' : 'url(#node-glow)');

        // Connection Highlighting (Focus + Context)
        const connectedNodeIds = new Set<string>();
        connectedNodeIds.add(d.id);
        simLinks.forEach((l) => {
          const sId = typeof l.source === 'object' ? (l.source as SimNode).id : l.source;
          const tId = typeof l.target === 'object' ? (l.target as SimNode).id : l.target;
          if (sId === d.id) connectedNodeIds.add(tId);
          if (tId === d.id) connectedNodeIds.add(sId);
        });

        // Dim non-connected nodes and links
        node.transition().duration(150).style('opacity', (n) => connectedNodeIds.has(n.id) ? 1 : 0.15);
        link.transition().duration(150)
          .style('opacity', (l) => {
            const sId = typeof l.source === 'object' ? (l.source as SimNode).id : l.source;
            const tId = typeof l.target === 'object' ? (l.target as SimNode).id : l.target;
            return (sId === d.id || tId === d.id) ? 1 : 0.12;
          })
          .attr('stroke', (l) => {
            const sId = typeof l.source === 'object' ? (l.source as SimNode).id : l.source;
            const tId = typeof l.target === 'object' ? (l.target as SimNode).id : l.target;
            return (sId === d.id || tId === d.id) ? '#b07b4f' : 'rgba(140, 98, 57, 0.48)';
          });

        // Populate and position Custom Tooltip
        tooltip.style('display', 'block')
          .transition()
          .duration(100)
          .style('opacity', 1);

        const topOwasp = d.owasp_categories?.[0] ?? 'None';
        const riskBadgeColor = d.has_critical_security 
          ? 'bg-rose-100 text-rose-800 border-rose-200' 
          : 'bg-[#efe8de]/50 text-[#6b5b4d] border-[rgba(176,123,79,0.12)]';

        const contentHtml = `
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-3">
              <span class="font-extrabold text-slate-800 truncate max-w-[150px] text-sm">${d.symbol_name}</span>
              <span class="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${riskBadgeColor}">
                ${(d.security_risk_level || 'Safe').toUpperCase()}
              </span>
            </div>
            <p class="text-[10px] text-slate-400 font-mono truncate max-w-[220px]">${d.file_path}</p>
            
            <div class="border-t border-[rgba(176,123,79,0.08)] my-2 pt-2 space-y-1.5">
              <div class="flex justify-between items-center text-[10px] font-bold text-slate-500">
                <span>Technical Debt Score</span>
                <span class="font-mono text-[#b07b4f] font-extrabold">${d.debt_score.toFixed(1)}/100</span>
              </div>
              <div class="h-1.5 w-full bg-[#f5efe7] rounded-full overflow-hidden border border-[rgba(176,123,79,0.06)] shadow-inner">
                <div class="h-full bg-gradient-to-r from-[#b07b4f] to-[#8c6239] rounded-full" style="width: ${d.debt_score}%"></div>
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] font-bold text-slate-500 pt-1">
              <div>Vulnerabilities: <span class="text-slate-800 font-extrabold font-mono">${d.vulnerability_count}</span></div>
              <div>Exploitability: <span class="text-slate-800 font-extrabold font-mono">${Math.round(d.exploitability_score)}%</span></div>
              <div class="col-span-2 text-[9px] text-slate-400 font-semibold truncate">Top Category: <span class="text-[#b07b4f] font-bold">${topOwasp}</span></div>
            </div>
          </div>
        `;
        tooltip.html(contentHtml);
      })
      .on('mousemove', function (event) {
        const [x, y] = d3.pointer(event, container);
        tooltip
          .style('left', (x + 15) + 'px')
          .style('top', (y - 15) + 'px');
      })
      .on('mouseout', function (event, d) {
        const isSelected = d.id === selectedId;
        d3.select(this)
          .transition()
          .duration(150)
          .attr('r', radius(d, selectedId))
          .attr('opacity', isSelected ? 1 : 0.95)
          .attr('stroke-width', d.has_critical_security ? 3.5 : isSelected ? 4.5 : 2.25)
          .attr('filter', d.has_critical_security ? 'url(#security-glow)' : isSelected ? 'url(#node-glow)' : 'url(#node-shadow)');

        // Revert other nodes and links opacity
        node.transition().duration(150).style('opacity', (n) => n.id === selectedId ? 1 : 0.95);
        link.transition().duration(150)
          .style('opacity', 0.95)
          .attr('stroke', 'rgba(140, 98, 57, 0.48)');

        // Hide custom tooltip
        tooltip.transition()
          .duration(100)
          .style('opacity', 0)
          .on('end', () => tooltip.style('display', 'none'));
      });

    node.call(dragBehavior);

    const criticalRing = g
      .append('g')
      .selectAll('circle')
      .data(simNodes.filter((d) => d.has_critical_security))
      .join('circle')
      .attr('fill', 'none')
      .attr('stroke', (d) => (d.security_risk_level === 'critical' ? '#8f1d1d' : '#d85b2b'))
      .attr('stroke-width', 2.5)
      .attr('opacity', 0.75)
      .attr('stroke-dasharray', (d) => (d.security_risk_level === 'critical' ? '6,4' : '3,3'))
      .attr('class', 'security-warning-ring');

    const criticalMarker = g
      .append('g')
      .selectAll('text')
      .data(simNodes.filter((d) => d.has_critical_security))
      .join('text')
      .text((d) => (d.security_risk_level === 'critical' ? '⚠' : '!'))
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .attr('font-size', 12)
      .attr('font-weight', 900)
      .attr('fill', '#8f1d1d')
      .attr('pointer-events', 'none')
      .attr('class', 'security-critical-marker');

    const label = g
      .append('g')
      .selectAll('text')
      .data(simNodes.filter((d) => d.debt_score >= 60))
      .join('text')
      .text((d) => mode === 'business' ? businessLabel(d) : d.symbol_name)
      .attr('font-size', 9.5)
      .attr('font-weight', '650')
      .attr('fill', '#6b5b4d') // Secondary warm brown text
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => -radius(d, selectedId) - 6)
      .style('pointer-events', 'none');

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => getLinkNode(d.source).x || 0)
        .attr('y1', (d) => getLinkNode(d.source).y || 0)
        .attr('x2', (d) => getLinkNode(d.target).x || 0)
        .attr('y2', (d) => getLinkNode(d.target).y || 0);

      node.attr('cx', (d) => d.x || 0).attr('cy', (d) => d.y || 0);
      label.attr('x', (d) => d.x || 0).attr('y', (d) => d.y || 0);

      criticalRing
        .attr('cx', (d) => d.x || 0)
        .attr('cy', (d) => d.y || 0)
        .attr('r', (d) => radius(d, selectedId) + 7);

      criticalMarker
        .attr('x', (d) => d.x || 0)
        .attr('y', (d) => (d.y || 0) - radius(d, selectedId) - 2);

      if (selectedId && glowCircle1 && glowCircle2) {
        const sel = simNodes.find(n => n.id === selectedId);
        if (sel) {
          const baseR = radius(sel, selectedId);
          glowCircle1.attr('cx', sel.x || 0).attr('cy', sel.y || 0).attr('r', baseR + 8);
          glowCircle2.attr('cx', sel.x || 0).attr('cy', sel.y || 0).attr('r', baseR + 18);
        }
      }
    });

    svg.on('click', () => onSelect(null));
  }, [nodes, links, selectedId, onSelect, width, height, mode]);

  useEffect(() => {
    render();
    const handleResize = () => render();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [render]);

  return (
    <div
      ref={containerRef}
      className="graph-container w-full h-full min-h-[480px] bg-[#efe8de] border border-[rgba(176,123,79,0.22)] shadow-inner rounded-[30px] overflow-hidden relative"
    >
      {/* Dynamic Ambient Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(176,122,77,0.08),transparent_65%)] pointer-events-none" />

      {/* Floating Graph Controls Stacked Vertically Top-Right */}
      <div className="absolute top-5 right-5 flex flex-col gap-1 z-20">
        <button
          onClick={() => {
            if (svgRef.current && zoomRef.current) {
              d3.select(svgRef.current).transition().duration(200).call(zoomRef.current.scaleBy, 1.35);
            }
          }}
          className="w-10 h-10 flex items-center justify-center bg-[#fffdf9]/95 hover:bg-[#f7f2ec] text-[#6b5b4d] font-bold text-lg rounded-xl border border-[rgba(176,122,77,0.14)] shadow-sm hover:shadow transition-all active:scale-95"
          title="Zoom In"
        >
          ＋
        </button>
        <button
          onClick={() => {
            if (svgRef.current && zoomRef.current) {
              d3.select(svgRef.current).transition().duration(200).call(zoomRef.current.scaleBy, 0.75);
            }
          }}
          className="w-10 h-10 flex items-center justify-center bg-[#fffdf9]/95 hover:bg-[#f7f2ec] text-[#6b5b4d] font-bold text-lg rounded-xl border border-[rgba(176,122,77,0.14)] shadow-sm hover:shadow transition-all active:scale-95"
          title="Zoom Out"
        >
          －
        </button>
        <button
          onClick={() => {
            if (svgRef.current && zoomRef.current) {
              d3.select(svgRef.current).transition().duration(250).call(zoomRef.current.transform, d3.zoomIdentity);
            }
          }}
          className="w-10 h-10 flex items-center justify-center bg-[#fffdf9]/95 hover:bg-[#f7f2ec] text-[#6b5b4d] font-bold text-sm rounded-xl border border-[rgba(176,122,77,0.14)] shadow-sm hover:shadow transition-all active:scale-95"
          title="Reset Zoom"
        >
          ⟲
        </button>
      </div>

      {/* Floating Graph Legend Bottom-Left */}
      <div className="absolute bottom-5 left-5 flex flex-wrap items-center gap-4 bg-[#fffdf9]/95 backdrop-blur px-5 py-3 rounded-full border border-[rgba(176,122,77,0.14)] shadow-md z-20 text-xs font-semibold text-[#6b5b4d]">
        <span className="text-[10px] uppercase tracking-wider text-[#8f8175] font-extrabold mr-1">
          {mode === 'business' ? 'Risk Zones:' : 'Debt Score:'}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#93ab68] inline-block shadow-sm" />
          <span>0 - 10</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#f1c04e] inline-block shadow-sm" />
          <span>11 - 25</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#f0a03c] inline-block shadow-sm" />
          <span>26 - 50</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#e16a4f] inline-block shadow-sm" />
          <span>51 - 100</span>
        </div>
      </div>
    </div>
  );
}

function radius(d: SimNode, selectedId: string | null): number {
  const base = Math.max(6, Math.min(24, 6 + d.blast_radius * 0.35 + d.debt_score * 0.08 + (d.has_critical_security ? 1.5 : 0)));
  if (d.id === selectedId) return base * 1.35; // Selected node is 35% larger
  return base;
}

function getLinkNode(endpoint: SimNode | string): SimNode {
  if (typeof endpoint === 'string') {
    return {
      id: endpoint,
      debt_score: 0,
      security_score: 0,
      security_weighted_score: 0,
      has_critical_security: false,
      vulnerability_count: 0,
      exploitability_score: 0,
      security_risk_level: 'none',
      symbol_name: '',
      file_path: '',
      blast_radius: 0,
      owasp_categories: [],
      cwe_categories: [],
      security_findings: [],
    } as SimNode;
  }
  return endpoint;
}

function businessLabel(node: SimNode): string {
  if (node.has_critical_security && node.security_risk_level === 'critical') return 'Critical Business Risk';
  if (node.security_score >= 75 || node.vulnerability_count >= 3) return 'Unsafe Module';
  if (node.blast_radius >= 8) return 'Risk Zone';
  if (node.security_findings.length > 0) return 'Customer Exposure';
  return 'High Failure Probability';
}
