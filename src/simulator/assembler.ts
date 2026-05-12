/**
 * RISC-V Assembler
 *
 * Takes a ParseResult and lays out:
 *   1. Data memory starting at DATA_BASE (0x10010000)
 *   2. An ordered instruction list with addresses starting at TEXT_BASE (0x00400000)
 *   3. A label → address map for branches and la/call
 *   4. An address → DataItem map for memory panel display
 *
 * Memory is word-addressed (each word = 4 bytes).
 */

import type { ParseResult } from './parser';

export const DATA_BASE = 0x10010000; // Start of data segment
export const TEXT_BASE = 0x00400000; // Start of text segment
export const STACK_TOP  = 0x7ffffffc; // Initial stack pointer

export interface AssembledInstruction {
  address: number;             // Byte address in text segment
  sourceIndex: number;         // Index into ParseResult.instructions[]
  sourceLine: number;          // 1-indexed source line
  raw: string;                 // Original assembly text
  op: string;
  args: string[];
  label?: string;              // Label that begins at this instruction
}

export interface MemoryLabel {
  label: string;
  baseAddress: number;         // Byte address of first word
  words: number[];             // Initial values
  wordCount: number;
}

export interface AssembleResult {
  instructions: AssembledInstruction[];
  labelMap: Map<string, number>;    // label → byte address (text or data)
  memoryLabels: MemoryLabel[];      // Data segment metadata (for display)
  initialMemory: Map<number, number>; // address → initial word value
  errors: string[];
}

export function assemble(parsed: ParseResult): AssembleResult {
  const errors: string[] = [...parsed.errors];
  const labelMap = new Map<string, number>();
  const memoryLabels: MemoryLabel[] = [];
  const initialMemory = new Map<number, number>();

  // ----------------------------------------------------------------
  // 1. Lay out DATA segment
  // ----------------------------------------------------------------
  let dataAddr = DATA_BASE;
  for (const item of parsed.dataItems) {
    if (item.directive.kind === 'word') {
      const baseAddr = dataAddr;
      const values = item.directive.values;

      // Register the label pointing at the first word
      labelMap.set(item.label, baseAddr);

      // Write each word into initial memory
      for (let i = 0; i < values.length; i++) {
        initialMemory.set(dataAddr, values[i]);
        dataAddr += 4; // words are 4 bytes apart
      }

      memoryLabels.push({
        label: item.label,
        baseAddress: baseAddr,
        words: values,
        wordCount: values.length,
      });
    }
  }

  // ----------------------------------------------------------------
  // 2. Lay out TEXT segment — first pass: assign addresses & labels
  // ----------------------------------------------------------------
  const instructions: AssembledInstruction[] = [];

  // First, assign addresses
  let textAddr = TEXT_BASE;
  for (let i = 0; i < parsed.instructions.length; i++) {
    const pi = parsed.instructions[i];
    instructions.push({
      address: textAddr,
      sourceIndex: i,
      sourceLine: pi.sourceLine,
      raw: pi.raw,
      op: pi.op,
      args: pi.args,
      label: pi.label,
    });
    if (pi.label) {
      labelMap.set(pi.label, textAddr);
    }
    textAddr += 4; // each instruction is 4 bytes
  }

  return { instructions, labelMap, memoryLabels, initialMemory, errors };
}
