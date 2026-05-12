/**
 * RISC-V Assembly Parser
 *
 * Parses a raw assembly string into a structured representation:
 *   - dataItems: variables declared in .data (e.g. `.word` arrays)
 *   - instructions: parsed instructions from .text
 *   - labels: line labels that map to instruction or data locations
 *
 * This is NOT a full assembler — it produces an AST that the
 * assembler.ts then turns into memory and an instruction list.
 */

export type DataDirective =
  | { kind: 'word'; values: number[] }
  | { kind: 'byte'; values: number[] }
  | { kind: 'asciiz'; value: string };

export interface DataItem {
  label: string;
  directive: DataDirective;
  sourceLine: number; // 1-indexed original line number
}

export interface ParsedInstruction {
  raw: string;        // Original trimmed text e.g. "lw t0, 0(t1)"
  op: string;         // Opcode e.g. "lw"
  args: string[];     // Operand tokens e.g. ["t0", "0(t1)"]
  label?: string;     // Label on same line (if any) e.g. "main"
  sourceLine: number; // 1-indexed original source line number
}

export interface ParseResult {
  dataItems: DataItem[];
  instructions: ParsedInstruction[];
  errors: string[];
}

// Remove comments (#...) and trim
function stripComment(line: string): string {
  const idx = line.indexOf('#');
  return idx >= 0 ? line.slice(0, idx).trim() : line.trim();
}

// Split operands by comma, but keep e.g. "0(t1)" intact
function splitArgs(raw: string): string[] {
  return raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

export function parseAssembly(source: string): ParseResult {
  const lines = source.split('\n');
  const dataItems: DataItem[] = [];
  const instructions: ParsedInstruction[] = [];
  const errors: string[] = [];

  // Sections: 'none' | 'data' | 'text'
  let section: 'none' | 'data' | 'text' = 'none';

  // Pending label (a label can appear on its own line before an instruction)
  let pendingLabel: string | undefined;

  // Current data label (for associating .word etc. under a label)
  let currentDataLabel: string | undefined;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineNum = lineIdx + 1;
    const raw = lines[lineIdx];
    const stripped = stripComment(raw);

    if (stripped === '') continue; // blank / comment-only line

    // ----- Directives -----
    if (stripped.startsWith('.data')) {
      section = 'data';
      continue;
    }
    if (stripped.startsWith('.text')) {
      section = 'text';
      continue;
    }
    if (stripped.startsWith('.globl') || stripped.startsWith('.global')) {
      // Just skip — we handle labels via their position
      continue;
    }

    // ----- Label detection -----
    // A label is anything ending with ':'
    const labelMatch = stripped.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)?$/);
    if (labelMatch) {
      const lbl = labelMatch[1];
      const rest = labelMatch[2]?.trim() ?? '';

      if (section === 'data') {
        currentDataLabel = lbl;
        // If there's something after the label on the same line, re-process it
        if (rest) {
          processDataLine(rest, lbl, lineNum, dataItems, errors);
          currentDataLabel = undefined;
        }
      } else {
        // In text section — save the label; it will attach to the next instruction
        pendingLabel = lbl;
        if (rest) {
          // Instruction on same line as label
          addInstruction(rest, pendingLabel, lineNum, instructions, errors);
          pendingLabel = undefined;
        }
      }
      continue;
    }

    // ----- Data section directives (.word etc.) -----
    if (section === 'data') {
      processDataLine(stripped, currentDataLabel, lineNum, dataItems, errors);
      currentDataLabel = undefined;
      continue;
    }

    // ----- Text section instructions -----
    if (section === 'text' || section === 'none') {
      addInstruction(stripped, pendingLabel, lineNum, instructions, errors);
      pendingLabel = undefined;
    }
  }

  return { dataItems, instructions, errors };
}

function processDataLine(
  line: string,
  label: string | undefined,
  lineNum: number,
  dataItems: DataItem[],
  errors: string[],
) {
  if (line.startsWith('.word')) {
    const rest = line.slice('.word'.length).trim();
    const parts = rest.split(',').map(s => s.trim()).filter(Boolean);
    const values: number[] = [];
    for (const p of parts) {
      const n = parseImmediate(p);
      if (n === null) {
        errors.push(`Line ${lineNum}: Invalid .word value "${p}"`);
        values.push(0);
      } else {
        values.push(n);
      }
    }
    dataItems.push({
      label: label ?? `__data_${lineNum}`,
      directive: { kind: 'word', values },
      sourceLine: lineNum,
    });
  }
  // (extend here for .byte, .asciiz etc. in the future)
}

function addInstruction(
  raw: string,
  label: string | undefined,
  lineNum: number,
  instructions: ParsedInstruction[],
  errors: string[],
) {
  const [opPart, ...rest] = raw.split(/\s+/);
  const op = opPart.toLowerCase();
  const argStr = rest.join(' ');
  const args = splitArgs(argStr);

  // Very basic opcode validation
  const knownOps = new Set([
    'li', 'la', 'lw', 'sw', 'add', 'addi', 'sub',
    'slli', 'srli', 'mv', 'beq', 'bne', 'blt', 'bge',
    'j', 'call', 'ret', 'ecall', 'nop',
    // pseudo-instructions sometimes seen:
    'mul', 'div', 'rem', 'and', 'or', 'xor', 'andi', 'ori', 'xori',
    'slt', 'slti', 'sltu', 'sra', 'srai', 'neg', 'not', 'seqz', 'snez',
    'bgtz', 'bltz', 'bgez', 'blez', 'bnez', 'beqz',
    'jalr', 'jal',
  ]);

  if (!knownOps.has(op)) {
    errors.push(`Line ${lineNum}: Unknown opcode "${op}" (ignored)`);
    // Still add it so line numbers stay intact
  }

  instructions.push({ raw, op, args, label, sourceLine: lineNum });
}

/**
 * Parse an integer literal: decimal, hex (0x...), or binary (0b...).
 * Returns null if unparseable.
 */
export function parseImmediate(token: string): number | null {
  const t = token.trim();
  if (t.startsWith('0x') || t.startsWith('0X')) {
    const n = parseInt(t.slice(2), 16);
    return isNaN(n) ? null : n;
  }
  if (t.startsWith('0b') || t.startsWith('0B')) {
    const n = parseInt(t.slice(2), 2);
    return isNaN(n) ? null : n;
  }
  const n = parseInt(t, 10);
  return isNaN(n) ? null : n;
}
