/**
 * RISC-V Register Name Mapping
 *
 * Maps ABI names (zero, ra, sp, ..., t0-t6, s0-s11, a0-a7) and
 * numeric names (x0-x31) to their register index (0-31).
 */

export const REGISTER_COUNT = 32;

// ABI name → register index
const ABI_MAP: Record<string, number> = {
  zero: 0,
  ra: 1,
  sp: 2,
  gp: 3,
  tp: 4,
  t0: 5,
  t1: 6,
  t2: 7,
  s0: 8,
  fp: 8, // fp is an alias for s0
  s1: 9,
  a0: 10,
  a1: 11,
  a2: 12,
  a3: 13,
  a4: 14,
  a5: 15,
  a6: 16,
  a7: 17,
  s2: 18,
  s3: 19,
  s4: 20,
  s5: 21,
  s6: 22,
  s7: 23,
  s8: 24,
  s9: 25,
  s10: 26,
  s11: 27,
  t3: 28,
  t4: 29,
  t5: 30,
  t6: 31,
};

// Also add x0-x31 mappings
for (let i = 0; i < 32; i++) {
  ABI_MAP[`x${i}`] = i;
}

/**
 * Resolve a register name (ABI or numeric) to its index 0–31.
 * Returns -1 if the name is not recognized.
 */
export function resolveRegister(name: string): number {
  const lower = name.toLowerCase().trim();
  if (lower in ABI_MAP) return ABI_MAP[lower];
  return -1;
}

/**
 * Human-readable ABI name for a register index.
 * e.g. 1 → "ra", 10 → "a0"
 */
export const INDEX_TO_ABI: string[] = [
  'zero', 'ra', 'sp', 'gp', 'tp',
  't0', 't1', 't2',
  's0', 's1',
  'a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7',
  's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11',
  't3', 't4', 't5', 't6',
];

export function getRegName(index: number): string {
  return INDEX_TO_ABI[index] ?? `x${index}`;
}
