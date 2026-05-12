/**
 * MemoryPanel — Visual representation of the data segment
 *
 * Features:
 *   - Shows each .data label as a named array
 *   - Shows addresses, values (dec + hex)
 *   - Highlights cells that were changed in the last step (lw/sw)
 *   - Shows pointer arrows from registers that point into this cell
 *   - Stack viewer showing recent stack frames
 */
import React from 'react';
import type { MemoryLabel } from '../simulator/assembler';
import { INDEX_TO_ABI } from '../simulator/registers';

interface MemoryPanelProps {
  memory: Map<number, number>;
  memoryLabels: MemoryLabel[];
  registers: number[];           // For pointer arrows
  changedAddresses: number[];    // Addresses changed in last step
}

const MemoryPanel: React.FC<MemoryPanelProps> = ({
  memory,
  memoryLabels,
  registers,
  changedAddresses,
}) => {
  const changedSet = new Set(changedAddresses);
  const hex = (n: number) => `0x${(n >>> 0).toString(16).padStart(8, '0')}`;

  // Build a map: address → list of register names pointing there
  const pointerMap = new Map<number, string[]>();
  for (let i = 0; i < registers.length; i++) {
    const val = registers[i];
    if (val === 0) continue;
    // Check if this register value matches any word-aligned memory address
    // (exact address match — register points to a memory cell)
    const existing = pointerMap.get(val) ?? [];
    existing.push(INDEX_TO_ABI[i] ?? `x${i}`);
    pointerMap.set(val, existing);
  }

  // Stack panel: show last 8 stack words
  const STACK_TOP = 0x7ffffffc;
  const stackEntries: { addr: number; val: number }[] = [];
  for (let i = 0; i < 16; i++) {
    const addr = STACK_TOP - i * 4;
    const val = memory.get(addr);
    if (val !== undefined) {
      stackEntries.push({ addr, val });
    }
  }

  return (
    <div className="memory-panel">
      <div className="panel-header">
        <span className="panel-icon">💾</span>
        <span>Memory</span>
        {changedAddresses.length > 0 && (
          <span className="panel-badge changed-badge">
            {changedAddresses.length} write{changedAddresses.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="memory-content">
        {/* Data segment labels */}
        {memoryLabels.length === 0 && (
          <div className="mem-empty">No data segment. Assemble a program first.</div>
        )}

        {memoryLabels.map(label => (
          <div key={label.label} className="mem-label-block">
            <div className="mem-label-name">
              <span className="mem-label-badge">DATA</span>
              <span className="mem-label-title">{label.label}</span>
              <span className="mem-label-addr">{hex(label.baseAddress)}</span>
            </div>

            <div className="mem-cells">
              {Array.from({ length: label.wordCount }, (_, i) => {
                const addr = label.baseAddress + i * 4;
                const val = memory.get(addr) ?? 0;
                const isChanged = changedSet.has(addr);
                const ptrs = pointerMap.get(addr) ?? [];

                return (
                  <div
                    key={addr}
                    className={`mem-cell ${isChanged ? 'mem-cell-changed' : ''} ${ptrs.length > 0 ? 'mem-cell-pointed' : ''}`}
                  >
                    {/* Pointer arrows */}
                    {ptrs.length > 0 && (
                      <div className="mem-ptr-arrows">
                        {ptrs.map(r => (
                          <span key={r} className="mem-ptr-badge">
                            {r} →
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mem-cell-index">[{i}]</div>
                    <div className="mem-cell-addr">{hex(addr)}</div>
                    <div className="mem-cell-value">
                      <span className="mem-val-dec">{val}</span>
                      <span className="mem-val-hex">{hex(val)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Stack viewer */}
        {stackEntries.length > 0 && (
          <div className="mem-label-block">
            <div className="mem-label-name">
              <span className="mem-label-badge" style={{ background: '#7c3aed' }}>STACK</span>
              <span className="mem-label-title">Stack</span>
              <span className="mem-label-addr">sp = {hex(registers[2] ?? 0)}</span>
            </div>
            <div className="mem-cells">
              {stackEntries.map(({ addr, val }) => {
                const isChanged = changedSet.has(addr);
                const ptrs = pointerMap.get(addr) ?? [];
                const isSP = (registers[2] ?? 0) === addr;

                return (
                  <div
                    key={addr}
                    className={`mem-cell ${isChanged ? 'mem-cell-changed' : ''} ${isSP ? 'mem-cell-sp' : ''}`}
                  >
                    {ptrs.length > 0 && (
                      <div className="mem-ptr-arrows">
                        {ptrs.map(r => (
                          <span key={r} className="mem-ptr-badge">{r} →</span>
                        ))}
                      </div>
                    )}
                    {isSP && <div className="mem-sp-tag">← sp</div>}
                    <div className="mem-cell-index">stack</div>
                    <div className="mem-cell-addr">{hex(addr)}</div>
                    <div className="mem-cell-value">
                      <span className="mem-val-dec">{val}</span>
                      <span className="mem-val-hex">{hex(val)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemoryPanel;
