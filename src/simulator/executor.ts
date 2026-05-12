/**
 * RISC-V CPU Executor
 *
 * Executes a single instruction and returns a StepResult containing:
 *   - The new register file
 *   - Memory changes
 *   - Human-readable explanation
 *   - Console output (for ecall)
 *   - The next PC
 *
 * The CPU state is immutable — this function takes a snapshot and
 * returns the next state, making step-by-step replay possible.
 */

import type { AssembledInstruction, AssembleResult } from './assembler';
import { STACK_TOP } from './assembler';
import { resolveRegister, REGISTER_COUNT } from './registers';
import { parseImmediate } from './parser';
import { buildExplanation } from './explainer';
import type { ExplainContext } from './explainer';

export interface CPUState {
  registers: number[];            // 32 registers, index 0-31
  memory: Map<number, number>;    // address → 32-bit word value
  pc: number;                     // Program counter (byte address)
  halted: boolean;
}

export interface MemoryChange {
  address: number;
  before: number;
  after: number;
}

export interface RegChange {
  index: number;
  name: string;
  before: number;
  after: number;
}

export interface StepResult {
  state: CPUState;                // New CPU state after this step
  instruction: AssembledInstruction;
  regChanges: RegChange[];
  memChanges: MemoryChange[];
  explanation: string;
  consoleOutput?: string;         // e.g. "17" from ecall print
  error?: string;                 // Runtime error message
}

/**
 * Create the initial CPU state from an assembled program.
 */
export function createInitialState(assembled: AssembleResult): CPUState {
  const registers = new Array<number>(REGISTER_COUNT).fill(0);

  // Set stack pointer to top of stack
  registers[2] = STACK_TOP; // sp = x2

  // Find the "main" label to set initial PC; fall back to first instruction
  const mainAddr = assembled.labelMap.get('main') ?? assembled.instructions[0]?.address ?? 0;

  const memory = new Map<number, number>(assembled.initialMemory);

  return {
    registers,
    memory,
    pc: mainAddr,
    halted: false,
  };
}

/**
 * Execute one instruction and return the resulting state + metadata.
 */
export function executeStep(
  state: CPUState,
  assembled: AssembleResult,
): StepResult | null {
  // Find the instruction at the current PC
  const instr = assembled.instructions.find(i => i.address === state.pc);
  if (!instr) {
    return null; // No instruction at this PC — halt
  }

  // Take immutable snapshot of registers before execution
  const regsBefore = [...state.registers];
  const newRegs = [...state.registers];
  const newMem = new Map(state.memory);
  let nextPc = state.pc + 4; // default: advance by one instruction (4 bytes)
  let halted = false;
  let consoleOutput: string | undefined;
  let error: string | undefined;
  const memChanges: MemoryChange[] = [];

  // ----- Helper: resolve a register name to its index -----
  const regIdx = (name: string): number => {
    const idx = resolveRegister(name);
    if (idx < 0) throw new Error(`Unknown register: "${name}"`);
    return idx;
  };

  // ----- Helper: read register value -----
  const readReg = (name: string): number => newRegs[regIdx(name)];

  // ----- Helper: write register value (zero stays 0) -----
  const writeReg = (name: string, value: number) => {
    const idx = regIdx(name);
    if (idx === 0) return; // x0/zero is always 0
    newRegs[idx] = value | 0; // coerce to signed 32-bit
  };

  // ----- Helper: parse immediate operand -----
  const imm = (token: string): number => {
    const n = parseImmediate(token);
    if (n === null) throw new Error(`Invalid immediate: "${token}"`);
    return n;
  };

  // ----- Helper: resolve offset(reg) → address -----
  const resolveAddr = (offsetReg: string): number => {
    const match = offsetReg.match(/^(-?\d+)\((\w+)\)$/);
    if (!match) throw new Error(`Invalid address format: "${offsetReg}"`);
    const offset = parseInt(match[1], 10);
    const base = readReg(match[2]);
    return base + offset;
  };

  // ----- Helper: read word from memory -----
  const memRead = (addr: number): number => newMem.get(addr) ?? 0;

  // ----- Helper: write word to memory -----
  const memWrite = (addr: number, value: number) => {
    const before = memRead(addr);
    newMem.set(addr, value | 0);
    memChanges.push({ address: addr, before, after: value | 0 });
  };

  // ----- Helper: resolve a label to its address -----
  const resolveLabel = (label: string): number => {
    const addr = assembled.labelMap.get(label);
    if (addr === undefined) throw new Error(`Undefined label: "${label}"`);
    return addr;
  };

  try {
    const { op, args } = instr;

    switch (op) {
      // ---- Loads ----
      case 'li': {
        // li rd, imm  → pseudo for addi rd, zero, imm (or lui+addi for large)
        writeReg(args[0], imm(args[1]));
        break;
      }
      case 'la': {
        // la rd, label → load address of label
        writeReg(args[0], resolveLabel(args[1]));
        break;
      }
      case 'lw': {
        // lw rd, offset(rs1) → rd = Memory[rs1 + offset]
        const addr = resolveAddr(args[1]);
        writeReg(args[0], memRead(addr));
        break;
      }

      // ---- Stores ----
      case 'sw': {
        // sw rs2, offset(rs1) → Memory[rs1 + offset] = rs2
        const addr = resolveAddr(args[1]);
        memWrite(addr, readReg(args[0]));
        break;
      }

      // ---- Arithmetic ----
      case 'add': {
        writeReg(args[0], readReg(args[1]) + readReg(args[2]));
        break;
      }
      case 'addi': {
        writeReg(args[0], readReg(args[1]) + imm(args[2]));
        break;
      }
      case 'sub': {
        writeReg(args[0], readReg(args[1]) - readReg(args[2]));
        break;
      }
      case 'mul': {
        writeReg(args[0], Math.imul(readReg(args[1]), readReg(args[2])));
        break;
      }
      case 'div': {
        const divisor = readReg(args[2]);
        writeReg(args[0], divisor !== 0 ? Math.trunc(readReg(args[1]) / divisor) : 0);
        break;
      }

      // ---- Shifts ----
      case 'slli': {
        // Shift left by immediate — equivalent to × 2^imm
        writeReg(args[0], readReg(args[1]) << imm(args[2]));
        break;
      }
      case 'srli': {
        // Shift right logical (zero-fill) by immediate
        writeReg(args[0], readReg(args[1]) >>> imm(args[2]));
        break;
      }
      case 'srai': {
        // Shift right arithmetic (sign-fill) by immediate
        writeReg(args[0], readReg(args[1]) >> imm(args[2]));
        break;
      }

      // ---- Bitwise ----
      case 'and':  writeReg(args[0], readReg(args[1]) & readReg(args[2])); break;
      case 'or':   writeReg(args[0], readReg(args[1]) | readReg(args[2])); break;
      case 'xor':  writeReg(args[0], readReg(args[1]) ^ readReg(args[2])); break;
      case 'andi': writeReg(args[0], readReg(args[1]) & imm(args[2])); break;
      case 'ori':  writeReg(args[0], readReg(args[1]) | imm(args[2])); break;
      case 'xori': writeReg(args[0], readReg(args[1]) ^ imm(args[2])); break;

      // ---- Compare ----
      case 'slt':  writeReg(args[0], readReg(args[1]) < readReg(args[2]) ? 1 : 0); break;
      case 'sltu': writeReg(args[0], (readReg(args[1]) >>> 0) < (readReg(args[2]) >>> 0) ? 1 : 0); break;
      case 'slti': writeReg(args[0], readReg(args[1]) < imm(args[2]) ? 1 : 0); break;

      // ---- Pseudo-instructions ----
      case 'mv': {
        // mv rd, rs1 → addi rd, rs1, 0
        writeReg(args[0], readReg(args[1]));
        break;
      }
      case 'neg': {
        writeReg(args[0], -readReg(args[1]));
        break;
      }
      case 'not': {
        writeReg(args[0], ~readReg(args[1]));
        break;
      }
      case 'seqz': {
        writeReg(args[0], readReg(args[1]) === 0 ? 1 : 0);
        break;
      }
      case 'snez': {
        writeReg(args[0], readReg(args[1]) !== 0 ? 1 : 0);
        break;
      }
      case 'nop': {
        // No operation — just advance PC
        break;
      }

      // ---- Branches ----
      case 'beq': {
        if (readReg(args[0]) === readReg(args[1])) nextPc = resolveLabel(args[2]);
        break;
      }
      case 'bne': {
        if (readReg(args[0]) !== readReg(args[1])) nextPc = resolveLabel(args[2]);
        break;
      }
      case 'blt': {
        if (readReg(args[0]) < readReg(args[1])) nextPc = resolveLabel(args[2]);
        break;
      }
      case 'bge': {
        if (readReg(args[0]) >= readReg(args[1])) nextPc = resolveLabel(args[2]);
        break;
      }
      case 'beqz': {
        if (readReg(args[0]) === 0) nextPc = resolveLabel(args[1]);
        break;
      }
      case 'bnez': {
        if (readReg(args[0]) !== 0) nextPc = resolveLabel(args[1]);
        break;
      }
      case 'bltz': {
        if (readReg(args[0]) < 0) nextPc = resolveLabel(args[1]);
        break;
      }
      case 'bgez': {
        if (readReg(args[0]) >= 0) nextPc = resolveLabel(args[1]);
        break;
      }
      case 'bgtz': {
        if (readReg(args[0]) > 0) nextPc = resolveLabel(args[1]);
        break;
      }
      case 'blez': {
        if (readReg(args[0]) <= 0) nextPc = resolveLabel(args[1]);
        break;
      }

      // ---- Jumps ----
      case 'j': {
        // Unconditional jump — pseudo for jal zero, label
        nextPc = resolveLabel(args[0]);
        break;
      }
      case 'jal': {
        // jal rd, label → rd = PC+4; PC = label
        writeReg(args[0], state.pc + 4);
        nextPc = resolveLabel(args[1]);
        break;
      }
      case 'jalr': {
        // jalr rd, offset(rs1) — or jalr rd, rs1, offset
        if (args[1]?.includes('(')) {
          const addr = resolveAddr(args[1]);
          writeReg(args[0], state.pc + 4);
          nextPc = addr & ~1;
        } else {
          // jalr rd, rs1, imm form
          const base = readReg(args[1]);
          const offset = args[2] ? imm(args[2]) : 0;
          writeReg(args[0], state.pc + 4);
          nextPc = (base + offset) & ~1;
        }
        break;
      }
      case 'call': {
        // call label → auipc ra, ...; jalr ra, ra, ...  (simplified)
        // Saves return address in ra, jumps to label
        newRegs[1] = state.pc + 4; // ra = x1
        nextPc = resolveLabel(args[0]);
        break;
      }
      case 'ret': {
        // ret → jalr zero, ra, 0
        nextPc = newRegs[1]; // jump to ra
        break;
      }

      // ---- System calls ----
      case 'ecall': {
        const a0 = readReg('a0');
        const a1 = readReg('a1');

        if (a0 === 1) {
          // Print integer
          consoleOutput = String(a1);
        } else if (a0 === 4) {
          // Print string — simplified: just note it
          consoleOutput = `[string at 0x${(a1 >>> 0).toString(16)}]`;
        } else if (a0 === 10) {
          // Exit
          halted = true;
        } else {
          consoleOutput = `[ecall ${a0} not implemented]`;
        }
        break;
      }

      default: {
        error = `Unimplemented instruction: "${op}"`;
        break;
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  // x0/zero must always be 0
  newRegs[0] = 0;

  // Build register change list
  const regChanges: RegChange[] = [];
  for (let i = 0; i < REGISTER_COUNT; i++) {
    if (newRegs[i] !== regsBefore[i]) {
      regChanges.push({
        index: i,
        name: getRegNameLocal(i),
        before: regsBefore[i],
        after: newRegs[i],
      });
    }
  }

  const newState: CPUState = {
    registers: newRegs,
    memory: newMem,
    pc: halted ? state.pc : nextPc,
    halted,
  };

  // Build explanation
  const explainCtx: ExplainContext = {
    op: instr.op,
    args: instr.args,
    regsBefore,
    regsAfter: newRegs,
    memChanges,
    labelMap: assembled.labelMap,
    memoryLabels: assembled.memoryLabels,
  };
  const explanation = buildExplanation(explainCtx);

  return {
    state: newState,
    instruction: instr,
    regChanges,
    memChanges,
    explanation,
    consoleOutput,
    error,
  };
}

function getRegNameLocal(idx: number): string {
  const names = [
    'zero','ra','sp','gp','tp',
    't0','t1','t2','s0','s1',
    'a0','a1','a2','a3','a4','a5','a6','a7',
    's2','s3','s4','s5','s6','s7','s8','s9','s10','s11',
    't3','t4','t5','t6',
  ];
  return names[idx] ?? `x${idx}`;
}
