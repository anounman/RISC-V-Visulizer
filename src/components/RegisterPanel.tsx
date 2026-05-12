/**
 * RegisterPanel — Shows all 32 RISC-V registers
 *
 * Smart pointer detection:
 *   A register is shown as a pointer ONLY if its value is a word-aligned
 *   address that falls inside a known .data label's address range.
 *
 *   a0 = 0  → shown as 0 (just a number, NOT a pointer)
 *   t0 = 0x10010000 → shown as "→ numbers[0]" (IS a pointer)
 */
import React from 'react';
import { INDEX_TO_ABI } from '../simulator/registers';
import type { MemoryLabel } from '../simulator/assembler';

interface RegisterPanelProps {
  registers: number[];
  changedIndices: number[];
  memoryLabels: MemoryLabel[];
}

// Same ABI name list used in MemoryVisualizer for consistency
const GROUPS = [
  { name: 'Special',    indices: [0, 1, 2, 3, 4] },
  { name: 'Temporaries', indices: [5, 6, 7, 28, 29, 30, 31] },
  { name: 'Saved',      indices: [8, 9, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27] },
  { name: 'Arguments',  indices: [10, 11, 12, 13, 14, 15, 16, 17] },
];

/**
 * Determine if a register value is a genuine data pointer.
 * Returns "label[i]" string or null.
 */
function resolvePointer(value: number, memoryLabels: MemoryLabel[]): string | null {
  if (value === 0) return null; // 0 is never a pointer to our data
  for (const ml of memoryLabels) {
    const end = ml.baseAddress + ml.wordCount * 4;
    if (value >= ml.baseAddress && value < end && (value - ml.baseAddress) % 4 === 0) {
      const idx = (value - ml.baseAddress) / 4;
      return `${ml.label}[${idx}]`;
    }
  }
  return null;
}

const RegisterPanel: React.FC<RegisterPanelProps> = ({
  registers,
  changedIndices,
  memoryLabels,
}) => {
  const changedSet = new Set(changedIndices);
  const hex = (n: number) => `0x${(n >>> 0).toString(16).padStart(8, '0')}`;

  return (
    <div className="register-panel">
      <div className="panel-header">
        <span className="panel-icon">🗂</span>
        <span>Registers</span>
        {changedIndices.length > 0 && (
          <span className="panel-badge changed-badge">
            {changedIndices.length} changed
          </span>
        )}
      </div>

      <div className="register-groups">
        {GROUPS.map(group => (
          <div key={group.name} className="reg-group">
            <div className="reg-group-title">{group.name}</div>
            {group.indices.map(idx => {
              const name = INDEX_TO_ABI[idx];
              const value = registers[idx] ?? 0;
              const isChanged = changedSet.has(idx);
              // Only show pointer annotation if value is actually a data address
              const ptr = resolvePointer(value, memoryLabels);

              return (
                <div
                  key={idx}
                  className={`reg-row ${isChanged ? 'reg-changed' : ''}`}
                >
                  <span className="reg-name">{name}</span>
                  <span className="reg-hex">{hex(value)}</span>
                  <span className="reg-dec">{value | 0}</span>
                  {ptr && (
                    <span className="reg-ptr">→ {ptr}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RegisterPanel;
