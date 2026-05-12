/**
 * FlowTracer — Visual Execution Flow Graph
 *
 * Shows each executed instruction as a connected node on a horizontal
 * timeline. Different instruction types get distinct visual treatment:
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ 🔀 Execution Flow                                               │
 *   │                                                                  │
 *   │  [li] ──▶ [li] ──▶ [CALL] ──▶ [la] ──▶ [slli] ──▶ [add] ──▶   │
 *   │  a0:0     a1:2   ↓ swap    t0:addr   t1:0       t1:addr        │
 *   │                  └─────────────────────────────────────┘        │
 *   │                    FUNCTION: swap (depth 1)                     │
 *   │                  [la] ──▶ ◆ [beq] ──▶ [lw] ──▶ ...             │
 *   │                              TAKEN ↘                            │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * Node types:
 *   regular  → rectangle, purple
 *   load     → rectangle, blue (lw / lb / lh)
 *   store    → rectangle, amber (sw / sb / sh)
 *   branch   → diamond shape, green=TAKEN / red=NOT TAKEN
 *   call     → rounded rect, teal
 *   ret      → rounded rect, pink
 *   ecall    → rounded rect, orange
 */
import React, { useRef, useEffect } from 'react';
import type { TraceEntry } from '../hooks/useSimulator';

interface FlowTracerProps {
  entries: TraceEntry[];
}

/* ── Instruction classification ──────────────────────────────── */

type NodeKind =
  | 'regular'
  | 'load'
  | 'store'
  | 'branch-taken'
  | 'branch-nottaken'
  | 'call'
  | 'ret'
  | 'ecall'
  | 'jump';

function classifyInstruction(instr: string, explanation: string): NodeKind {
  const mnemonic = instr.trim().split(/\s+/)[0].toLowerCase();

  if (['ecall'].includes(mnemonic))                             return 'ecall';
  if (['ret'].includes(mnemonic))                               return 'ret';
  if (['call', 'jal'].includes(mnemonic) && !instr.includes('zero')) return 'call';
  if (['j', 'jr', 'jalr'].includes(mnemonic))                  return 'jump';
  if (['lw','lb','lh','lbu','lhu','ld'].includes(mnemonic))    return 'load';
  if (['sw','sb','sh','sd'].includes(mnemonic))                 return 'store';

  if (/^b/.test(mnemonic)) {
    // Detect taken/not-taken from the explanation text
    const expl = explanation.toLowerCase();
    if (expl.includes('not taken') || expl.includes('branch not'))
      return 'branch-nottaken';
    return 'branch-taken'; // default: if branch was in trace it ran; taken unless expl says otherwise
  }

  return 'regular';
}

/* ── Node metadata table ─────────────────────────────────────── */

interface NodeMeta {
  icon: string;
  label: string;
  colorVar: string;  // CSS variable or literal
  shape: 'rect' | 'diamond';
}

const NODE_META: Record<NodeKind, NodeMeta> = {
  'regular':         { icon: '⚡', label: 'OP',     colorVar: 'node-regular',  shape: 'rect' },
  'load':            { icon: '📥', label: 'LOAD',   colorVar: 'node-load',     shape: 'rect' },
  'store':           { icon: '📤', label: 'STORE',  colorVar: 'node-store',    shape: 'rect' },
  'branch-taken':    { icon: '◆',  label: 'BRANCH', colorVar: 'node-taken',    shape: 'diamond' },
  'branch-nottaken': { icon: '◆',  label: 'BRANCH', colorVar: 'node-nottaken', shape: 'diamond' },
  'call':            { icon: '📞', label: 'CALL',   colorVar: 'node-call',     shape: 'rect' },
  'ret':             { icon: '↩',  label: 'RET',    colorVar: 'node-ret',      shape: 'rect' },
  'ecall':           { icon: '🖨', label: 'ECALL',  colorVar: 'node-ecall',    shape: 'rect' },
  'jump':            { icon: '↗',  label: 'JUMP',   colorVar: 'node-jump',     shape: 'rect' },
};

/* ── Track call depth for grouping ──────────────────────────── */

function computeCallDepths(entries: TraceEntry[]): number[] {
  const depths: number[] = [];
  let depth = 0;
  for (const e of entries) {
    const kind = classifyInstruction(e.instruction, e.explanation);
    if (kind === 'call') {
      depths.push(depth);
      depth++;
    } else if (kind === 'ret') {
      depth = Math.max(0, depth - 1);
      depths.push(depth);
    } else {
      depths.push(depth);
    }
  }
  return depths;
}

/* ── Parse reg changes for display ──────────────────────────── */

interface RegChange { name: string; before: string; after: string; }

function parseRegChanges(raw: string): RegChange[] {
  if (!raw) return [];
  return raw.split(',').map(s => {
    const [name, rest] = s.trim().split(':');
    const [before, after] = (rest ?? '').split('→');
    return { name: name?.trim() ?? '', before: before?.trim() ?? '', after: after?.trim() ?? '' };
  }).filter(r => r.name && r.after);
}

/* ── FlowTracer Component ────────────────────────────────────── */

const FlowTracer: React.FC<FlowTracerProps> = ({ entries }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll flow row to latest node (within the panel, not page)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [entries.length]);

  const callDepths = computeCallDepths(entries);
  const maxDepth = Math.max(0, ...callDepths);

  if (entries.length === 0) {
    return (
      <div className="flow-tracer">
        <div className="panel-header">
          <span className="panel-icon">🔀</span>
          <span>Execution Flow</span>
        </div>
        <div className="flow-empty">
          <span className="flow-empty-icon">⏸</span>
          Press <strong>Step</strong> or <strong>Run</strong> to see the execution flow.
        </div>
      </div>
    );
  }

  // Group entries by call depth "bands" for background shading
  const depthColors = ['transparent', 'rgba(34,211,238,0.04)', 'rgba(157,134,233,0.05)', 'rgba(74,222,128,0.04)'];

  return (
    <div className="flow-tracer">
      <div className="panel-header">
        <span className="panel-icon">🔀</span>
        <span>Execution Flow</span>
        <span className="panel-badge">{entries.length} steps</span>
        {maxDepth > 0 && (
          <span className="flow-depth-badge">
            {maxDepth} function call{maxDepth > 1 ? 's' : ''}
          </span>
        )}
        <span className="panel-hint">Scroll → to see full timeline</span>
      </div>

      {/* Depth legend */}
      {maxDepth > 0 && (
        <div className="flow-legend">
          <span className="flow-legend-item flow-legend-main">main</span>
          {Array.from({ length: maxDepth }, (_, i) => (
            <span key={i} className={`flow-legend-item flow-legend-depth-${i + 1}`}>
              depth {i + 1}
            </span>
          ))}
          <span className="flow-legend-sep">│</span>
          <span className="flow-legend-item flow-legend-kind call">📞 call</span>
          <span className="flow-legend-item flow-legend-kind ret">↩ ret</span>
          <span className="flow-legend-item flow-legend-kind taken">◆ branch taken</span>
          <span className="flow-legend-item flow-legend-kind nottaken">◆ not taken</span>
          <span className="flow-legend-item flow-legend-kind load">📥 load</span>
          <span className="flow-legend-item flow-legend-kind store">📤 store</span>
        </div>
      )}

      {/* Scrollable flow timeline */}
      <div className="flow-scroll" ref={scrollRef}>
        <div className="flow-timeline">
          {entries.map((entry, idx) => {
            const depth = callDepths[idx];
            const kind  = classifyInstruction(entry.instruction, entry.explanation);
            const meta  = NODE_META[kind];
            const regChanges = parseRegChanges(entry.regChanges);
            const isLatest = idx === entries.length - 1;
            const isBranch = kind === 'branch-taken' || kind === 'branch-nottaken';

            return (
              <React.Fragment key={entry.step}>
                {/* Depth band indicator (subtle background row) */}
                <div
                  className={`flow-node-wrap depth-${depth}`}
                  style={{ background: depthColors[depth] ?? depthColors[3] }}
                >
                  {/* Depth label for call/ret transition */}
                  {(kind === 'call' || kind === 'ret') && (
                    <div className={`flow-depth-label ${kind === 'call' ? 'flow-depth-enter' : 'flow-depth-exit'}`}>
                      {kind === 'call' ? `→ fn call (depth ${depth + 1})` : `← return (depth ${depth})` }
                    </div>
                  )}

                  {/* Step number */}
                  <div className="flow-step-num">#{entry.step}</div>

                  {/* The node */}
                  {isBranch ? (
                    <BranchNode
                      entry={entry}
                      kind={kind}
                      meta={meta}
                      regChanges={regChanges}
                      isLatest={isLatest}
                    />
                  ) : (
                    <RegularNode
                      entry={entry}
                      kind={kind}
                      meta={meta}
                      regChanges={regChanges}
                      isLatest={isLatest}
                    />
                  )}
                </div>

                {/* Arrow connector between nodes */}
                {idx < entries.length - 1 && (
                  <div className="flow-arrow">
                    <div className="flow-arrow-line" />
                    <div className="flow-arrow-head">▶</div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ── RegularNode ─────────────────────────────────────────────── */

interface NodeProps {
  entry: TraceEntry;
  kind: NodeKind;
  meta: NodeMeta;
  regChanges: RegChange[];
  isLatest: boolean;
}

const RegularNode: React.FC<NodeProps> = ({ entry, kind, meta, regChanges, isLatest }) => {
  const hasMemChange = !!entry.memChanges;

  return (
    <div className={`flow-node flow-node--${kind} ${isLatest ? 'flow-node--latest' : ''}`}>
      {/* Header: type badge + mnemonic */}
      <div className="flow-node-header">
        <span className="flow-node-icon">{meta.icon}</span>
        <span className="flow-node-kind">{meta.label}</span>
      </div>

      {/* Instruction text */}
      <div className="flow-node-instr">{entry.instruction}</div>

      {/* Register changes */}
      {regChanges.length > 0 && (
        <div className="flow-node-changes">
          {regChanges.map(rc => (
            <span key={rc.name} className="flow-reg-change">
              <span className="flow-reg-name">{rc.name}</span>
              <span className="flow-reg-arrow">→</span>
              <span className="flow-reg-val">{rc.after}</span>
            </span>
          ))}
        </div>
      )}

      {/* Memory change */}
      {hasMemChange && (
        <div className="flow-node-mem">
          <span className="flow-mem-icon">💾</span>
          <span className="flow-mem-text">{entry.memChanges}</span>
        </div>
      )}

      {/* Line number */}
      <div className="flow-node-line">L{entry.sourceLine}</div>

      {/* Glow on latest */}
      {isLatest && <div className="flow-node-latest-pulse" />}
    </div>
  );
};

/* ── BranchNode — diamond shape ─────────────────────────────── */

const BranchNode: React.FC<NodeProps> = ({ entry, kind, regChanges, isLatest }) => {
  const taken = kind === 'branch-taken';
  const mnemonic = entry.instruction.split(/\s+/)[0].toUpperCase();

  return (
    <div className={`flow-branch-wrap ${isLatest ? 'flow-node--latest' : ''}`}>
      {/* Diamond body */}
      <div className={`flow-diamond ${taken ? 'flow-diamond--taken' : 'flow-diamond--nottaken'}`}>
        <span className="flow-diamond-icon">◆</span>
        <span className="flow-diamond-mnem">{mnemonic}</span>
      </div>

      {/* Taken / not-taken badge */}
      <div className={`flow-branch-result ${taken ? 'flow-branch-taken' : 'flow-branch-nottaken'}`}>
        {taken ? '✓ TAKEN' : '✗ NOT TAKEN'}
      </div>

      {/* Instruction text */}
      <div className="flow-node-instr flow-branch-instr">{entry.instruction}</div>

      {/* Register changes */}
      {regChanges.length > 0 && (
        <div className="flow-node-changes">
          {regChanges.map(rc => (
            <span key={rc.name} className="flow-reg-change">
              <span className="flow-reg-name">{rc.name}</span>
              <span className="flow-reg-arrow">→</span>
              <span className="flow-reg-val">{rc.after}</span>
            </span>
          ))}
        </div>
      )}

      <div className="flow-node-line">L{entry.sourceLine}</div>
    </div>
  );
};

export default FlowTracer;
