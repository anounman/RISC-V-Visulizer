/**
 * MemoryVisualizer — Rich visual memory model with Register Pointer Views
 *
 * ─────────────────────────────────────────────────────────────────────
 * CORE EDUCATIONAL CONCEPTS SHOWN:
 *
 *  1. The real memory object (e.g. "numbers" array) is shown at the top.
 *
 *  2. When a register holds an address that falls inside that array,
 *     we show a "Register Pointer View" — a view *into* the same memory
 *     from the register's entry point.
 *
 *     This is NOT a copy. The register stores one number (an address).
 *     The view is purely visual — it shows which cells are reachable
 *     by doing lw/sw relative to that register.
 *
 *  3. Smart pointer detection:
 *       a0 = 0    → NOT a pointer (0 is a plain number / index)
 *       t0 = 0x10010000 → IS a pointer (equals numbers[0])
 *       t2 = 0x10010008 → IS a pointer (equals numbers[2])
 * ─────────────────────────────────────────────────────────────────────
 */
import React from 'react';
import type { MemoryLabel } from '../simulator/assembler';

interface MemoryVisualizerProps {
  memory: Map<number, number>;
  memoryLabels: MemoryLabel[];
  registers: number[];
  changedAddresses: number[];
}

const ABI_NAMES = [
  'zero','ra','sp','gp','tp',
  't0','t1','t2','s0','s1',
  'a0','a1','a2','a3','a4','a5','a6','a7',
  's2','s3','s4','s5','s6','s7','s8','s9','s10','s11',
  't3','t4','t5','t6',
];

// Unique colors for each pointer register
const PTR_COLORS = [
  '#9D86E9', '#22d3ee', '#4ade80', '#f472b6',
  '#fb923c', '#a78bfa', '#34d399', '#f87171',
  '#60a5fa', '#fbbf24',
];

const HEX8 = (n: number) => `0x${(n >>> 0).toString(16).padStart(8, '0')}`;
const HEX  = (n: number) => `0x${(n >>> 0).toString(16).toUpperCase()}`;

export interface PointerInfo {
  regIndex: number;
  regName: string;
  address: number;       // exact address the register holds
  labelName: string;     // which data label it points into
  wordIndex: number;     // index within that label (0-based)
  color: string;
}

/** Build list of registers that are genuine pointers into .data */
function buildPointers(registers: number[], memoryLabels: MemoryLabel[]): PointerInfo[] {
  const result: PointerInfo[] = [];
  let ci = 0;
  for (let ri = 0; ri < registers.length; ri++) {
    const val = registers[ri];
    if (val === 0) continue; // 0 is never a data pointer
    for (const ml of memoryLabels) {
      const end = ml.baseAddress + ml.wordCount * 4;
      if (val >= ml.baseAddress && val < end && (val - ml.baseAddress) % 4 === 0) {
        result.push({
          regIndex: ri,
          regName: ABI_NAMES[ri],
          address: val,
          labelName: ml.label,
          wordIndex: (val - ml.baseAddress) / 4,
          color: PTR_COLORS[ci % PTR_COLORS.length],
        });
        ci++;
        break;
      }
    }
  }
  return result;
}

/* ═══════════════════════════════════════════════════════════════════ */

const MemoryVisualizer: React.FC<MemoryVisualizerProps> = ({
  memory, memoryLabels, registers, changedAddresses,
}) => {
  const changedSet = new Set(changedAddresses);
  const allPointers = buildPointers(registers, memoryLabels);

  if (memoryLabels.length === 0) {
    return (
      <div className="mem-viz-empty">
        <span className="mem-viz-empty-icon">💾</span>
        <span>No data segment — assemble a program to see memory here.</span>
      </div>
    );
  }

  return (
    <div className="mem-viz-root">
      {memoryLabels.map(label => {
        // Pointers that point INTO this label
        const labelPtrs = allPointers.filter(p => p.labelName === label.label);

        // Build address→pointers map for badge rendering
        const addrToPtrs = new Map<number, PointerInfo[]>();
        for (const p of labelPtrs) {
          const list = addrToPtrs.get(p.address) ?? [];
          list.push(p);
          addrToPtrs.set(p.address, list);
        }

        return (
          <div key={label.label} className="data-label-section">
            {/* ── Ground truth memory array ── */}
            <DataLabelBlock
              label={label}
              memory={memory}
              changedSet={changedSet}
              addrToPtrs={addrToPtrs}
            />

            {/* ── Register Pointer Views (one per pointer) ── */}
            {labelPtrs.length > 0 && (
              <div className="ptr-views-section">
                <div className="ptr-views-section-title">
                  <span className="ptr-views-section-icon">📌</span>
                  Register Pointer Views
                  <span className="ptr-views-not-copy">
                    NOT copies — each register holds an address into the same memory
                  </span>
                </div>
                <div className="ptr-views-list">
                  {labelPtrs.map(ptr => (
                    <RegisterPointerView
                      key={ptr.regName}
                      ptr={ptr}
                      label={label}
                      memory={memory}
                      changedSet={changedSet}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ── DataLabelBlock — the actual memory array ─────────────────────── */

interface DataLabelBlockProps {
  label: MemoryLabel;
  memory: Map<number, number>;
  changedSet: Set<number>;
  addrToPtrs: Map<number, PointerInfo[]>;
}

const DataLabelBlock: React.FC<DataLabelBlockProps> = ({
  label, memory, changedSet, addrToPtrs,
}) => (
  <div className="data-label-block">
    {/* Header */}
    <div className="data-label-header">
      <span className="data-label-tag">array</span>
      <span className="data-label-name">{label.label}</span>
      <span className="data-label-base">{HEX8(label.baseAddress)}</span>
      <span className="data-label-size">
        {label.wordCount} words × 4 bytes = {label.wordCount * 4} bytes
      </span>
    </div>

    {/* Cells */}
    <div className="data-cells-row">
      {Array.from({ length: label.wordCount }, (_, i) => {
        const addr = label.baseAddress + i * 4;
        const val  = memory.get(addr) ?? 0;
        const ptrs = addrToPtrs.get(addr) ?? [];
        return (
          <MemoryCell
            key={i}
            index={i}
            addr={addr}
            baseAddr={label.baseAddress}
            value={val}
            isChanged={changedSet.has(addr)}
            pointers={ptrs}
          />
        );
      })}
    </div>
  </div>
);

/* ── MemoryCell ────────────────────────────────────────────────────── */

interface MemoryCellProps {
  index: number;
  addr: number;
  baseAddr: number;
  value: number;
  isChanged: boolean;
  pointers: PointerInfo[];
}

const MemoryCell: React.FC<MemoryCellProps> = ({
  index, addr, baseAddr, value, isChanged, pointers,
}) => {
  const offset = addr - baseAddr;
  const hasPtr = pointers.length > 0;

  return (
    <div
      className={`mem-cell-viz ${isChanged ? 'mem-cell-viz--changed' : ''} ${hasPtr ? 'mem-cell-viz--pointed' : ''}`}
      style={hasPtr ? {
        borderColor: pointers[0].color,
        boxShadow: `0 0 14px ${pointers[0].color}44`,
      } : undefined}
    >
      {/* Pointer badges */}
      <div className="mem-cell-ptrs">
        {pointers.map(p => (
          <span key={p.regName} className="mem-cell-ptr-badge"
            style={{ background: p.color + '28', color: p.color, border: `1px solid ${p.color}66` }}>
            {p.regName}
          </span>
        ))}
      </div>

      {hasPtr && (
        <div className="mem-cell-arrow" style={{ color: pointers[0].color }}>▼</div>
      )}

      <div className={`mem-cell-value-big ${isChanged ? 'mem-cell-value-changed' : ''}`}>
        {value}
      </div>
      <div className="mem-cell-index-label">[{index}]</div>
      <div className="mem-cell-addr-info">
        <span className="mem-cell-offset">+{HEX(offset)}</span>
      </div>

      {isChanged && <div className="mem-cell-flash" />}
    </div>
  );
};

/* ── RegisterPointerView — the key new feature ─────────────────────── */
/**
 * Shows a visual "view" into the memory from the register's perspective.
 *
 * Layout:
 *  ┌──────────────────────────────────────────────────────┐
 *  │  🔖 t0  =  0x10010000  →  numbers  (base/start)     │
 *  │     Register holds: address only (NOT the array)     │
 *  │                                                      │
 *  │  Memory visible from t0 (lw t0, 0(t0) reads [0]):   │
 *  │  ┌─────╔═════╤═════╤═════╤═════╤═════╗             │
 *  │  │ ... ║  25 │  4  │  17 │  2  │  5  ║ ...         │
 *  │  │     ║ [0] │ [1] │ [2] │ [3] │ [4] ║             │
 *  │  └─────╚═════╧═════╧═════╧═════╧═════╝             │
 *  │         ↑ t0 entry point                            │
 *  └──────────────────────────────────────────────────────┘
 */
interface RegisterPointerViewProps {
  ptr: PointerInfo;
  label: MemoryLabel;
  memory: Map<number, number>;
  changedSet: Set<number>;
}

const RegisterPointerView: React.FC<RegisterPointerViewProps> = ({
  ptr, label, memory, changedSet,
}) => {
  const isBase = ptr.wordIndex === 0;
  const offsetDesc = isBase
    ? 'base — points to the start of the array'
    : `offset +${HEX((ptr.wordIndex) * 4)} — entry at index [${ptr.wordIndex}]`;

  // Cells after the pointer's entry point (the "accessible" slice)
  const visibleCount = label.wordCount - ptr.wordIndex;

  return (
    <div
      className="ptr-view-card"
      style={{ borderColor: ptr.color + '55', boxShadow: `0 0 20px ${ptr.color}15` }}
    >
      {/* Card header */}
      <div className="ptr-view-header" style={{ borderBottomColor: ptr.color + '40' }}>
        {/* Register chip */}
        <span
          className="ptr-view-reg-chip"
          style={{ background: ptr.color + '20', color: ptr.color, border: `1.5px solid ${ptr.color}70` }}
        >
          {ptr.regName}
        </span>

        {/* Equals sign + address */}
        <span className="ptr-view-eq">=</span>
        <span className="ptr-view-addr">{HEX8(ptr.address)}</span>

        {/* Arrow */}
        <span className="ptr-view-arrow" style={{ color: ptr.color }}>→</span>

        {/* What it points to */}
        <span className="ptr-view-target">
          <span className="ptr-view-label-name" style={{ color: ptr.color }}>
            {label.label}
          </span>
          <span className="ptr-view-offset-desc">[{ptr.wordIndex}]  — {offsetDesc}</span>
        </span>
      </div>

      {/* Educational callout */}
      <div className="ptr-view-callout">
        <span className="ptr-view-callout-icon">💡</span>
        <span>
          <strong>{ptr.regName}</strong> holds one value: the address{' '}
          <code>{HEX8(ptr.address)}</code>.
          It does <strong>not</strong> store the array — it is a pointer.
          Using <code>lw rd, 0({ptr.regName})</code> reads{' '}
          <strong>{label.label}[{ptr.wordIndex}]</strong>.
          Increment by 4 to reach the next word.
        </span>
      </div>

      {/* Memory view strip */}
      <div className="ptr-view-body">
        {/* "... before" indicator (only if not at base) */}
        {ptr.wordIndex > 0 && (
          <div className="ptr-view-before">
            <span className="ptr-view-ellipsis">←</span>
            <span className="ptr-view-before-label">
              {ptr.wordIndex} word{ptr.wordIndex > 1 ? 's' : ''} before this pointer
            </span>
          </div>
        )}

        {/* The cells from the pointer onward */}
        <div className="ptr-view-cells-wrap">
          {/* Entry marker line */}
          <div className="ptr-view-entry-marker" style={{ color: ptr.color }}>
            <span className="ptr-view-entry-line" style={{ background: ptr.color }} />
            <span className="ptr-view-entry-label" style={{ color: ptr.color }}>
              {ptr.regName} entry point
            </span>
            <span className="ptr-view-entry-line" style={{ background: ptr.color + '30' }} />
          </div>

          <div className="data-cells-row ptr-view-cells">
            {Array.from({ length: visibleCount }, (_, j) => {
              const absIndex = ptr.wordIndex + j;
              const addr = label.baseAddress + absIndex * 4;
              const val  = memory.get(addr) ?? 0;
              const isFirst = j === 0; // the cell the register directly points at

              return (
                <div
                  key={j}
                  className={`mem-cell-viz ptr-view-cell ${isFirst ? 'ptr-view-cell--entry' : ''} ${changedSet.has(addr) ? 'mem-cell-viz--changed' : ''}`}
                  style={isFirst ? {
                    borderColor: ptr.color,
                    boxShadow: `0 0 16px ${ptr.color}55`,
                  } : undefined}
                >
                  {/* Pointer marker on entry cell */}
                  <div className="mem-cell-ptrs">
                    {isFirst && (
                      <span
                        className="mem-cell-ptr-badge"
                        style={{ background: ptr.color + '28', color: ptr.color, border: `1px solid ${ptr.color}66` }}
                      >
                        {ptr.regName}
                      </span>
                    )}
                  </div>

                  {isFirst && (
                    <div className="mem-cell-arrow" style={{ color: ptr.color }}>▼</div>
                  )}

                  <div className={`mem-cell-value-big ${changedSet.has(addr) ? 'mem-cell-value-changed' : ''}`}>
                    {val}
                  </div>

                  {/* Relative offset (0(t0), 4(t0), etc.) */}
                  <div className="mem-cell-index-label ptr-view-rel-index">
                    [{absIndex}]
                  </div>
                  <div className="mem-cell-addr-info">
                    <span className="mem-cell-offset ptr-view-rel-offset">
                      {j === 0 ? `0(${ptr.regName})` : `${j * 4}(${ptr.regName})`}
                    </span>
                  </div>

                  {changedSet.has(addr) && <div className="mem-cell-flash" />}
                </div>
              );
            })}

            {/* "... after" indicator */}
            <div className="ptr-view-after">
              <span className="ptr-view-ellipsis">→</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { buildPointers };
export default MemoryVisualizer;
