/**
 * RISC-V Instruction Explainer
 *
 * Generates human-friendly explanations for each executed instruction.
 * These are shown in the Explanation Panel and the Trace table.
 */



export interface ExplainContext {
  op: string;
  args: string[];
  // Register values BEFORE execution
  regsBefore: number[];
  // Register values AFTER execution
  regsAfter: number[];
  // Memory changes: { address, before, after }[]
  memChanges: { address: number; before: number; after: number }[];
  // For pointer resolution
  labelMap: Map<string, number>;
  memoryLabels: Array<{ label: string; baseAddress: number; wordCount: number }>;
}

/**
 * Find which label+index a given address maps to.
 * e.g. 0x10010004 → "numbers[1]"
 */
export function resolveAddressLabel(
  address: number,
  memoryLabels: Array<{ label: string; baseAddress: number; wordCount: number }>,
): string | null {
  for (const ml of memoryLabels) {
    if (address >= ml.baseAddress && address < ml.baseAddress + ml.wordCount * 4) {
      const idx = (address - ml.baseAddress) / 4;
      return `${ml.label}[${idx}]`;
    }
  }
  return null;
}

export function buildExplanation(ctx: ExplainContext): string {
  const { op, args, regsBefore, regsAfter, memoryLabels } = ctx;

  // Helper: value before/after for a register by name
  const before = (name: string) => {
    const idx = getRegIndexByName(name);
    return idx >= 0 ? regsBefore[idx] : 0;
  };
  const after = (name: string) => {
    const idx = getRegIndexByName(name);
    return idx >= 0 ? regsAfter[idx] : 0;
  };
  const hex = (n: number) => `0x${(n >>> 0).toString(16).padStart(8, '0')}`;

  switch (op) {
    case 'li': {
      const [rd, imm] = args;
      return `li ${rd}, ${imm}: Load immediate ${imm} into ${rd}. ` +
        `${rd} is now ${after(rd)} (${hex(after(rd))}). ` +
        `Use "li" to set a register to a constant value.`;
    }
    case 'la': {
      const [rd, label] = args;
      const addr = after(rd);
      const lbl = resolveAddressLabel(addr, memoryLabels);
      return `la ${rd}, ${label}: Load the ADDRESS of the label "${label}" into ${rd}. ` +
        `${rd} = ${hex(addr)}${lbl ? ` → ${lbl}` : ''}. ` +
        `This is a pointer — ${rd} now holds where "${label}" lives in memory, not the value at that location.`;
    }
    case 'lw': {
      const [rd, offsetReg] = args;
      // Find what address was loaded from
      const loadAddr = parseOffsetArg(offsetReg, regsBefore);
      const lbl = resolveAddressLabel(loadAddr, memoryLabels);
      return `lw ${rd}, ${offsetReg}: Load Word from memory address ${hex(loadAddr)}${lbl ? ` (${lbl})` : ''} into ${rd}. ` +
        `${rd} is now ${after(rd)}. ` +
        `"lw" reads 4 bytes (one word) from memory. The address comes from ${offsetReg.replace(/.*\(/, '').replace(')', '')} + offset.`;
    }
    case 'sw': {
      const [rs2, offsetReg] = args;
      const storeAddr = parseOffsetArg(offsetReg, regsBefore);
      const lbl = resolveAddressLabel(storeAddr, memoryLabels);
      return `sw ${rs2}, ${offsetReg}: Store Word — write ${rs2} (= ${before(rs2)}) to memory address ${hex(storeAddr)}${lbl ? ` (${lbl})` : ''}. ` +
        `"sw" copies 4 bytes from a register into memory. ` +
        `Think of it as: MEM[${hex(storeAddr)}] ← ${before(rs2)}.`;
    }
    case 'add': {
      const [rd, rs1, rs2] = args;
      return `add ${rd}, ${rs1}, ${rs2}: ${rd} = ${rs1} + ${rs2} = ${before(rs1)} + ${before(rs2)} = ${after(rd)}. ` +
        `Integer addition of two registers.`;
    }
    case 'addi': {
      const [rd, rs1, imm] = args;
      return `addi ${rd}, ${rs1}, ${imm}: ${rd} = ${rs1} + ${imm} = ${before(rs1)} + ${imm} = ${after(rd)}. ` +
        `Add immediate — adds a constant to a register. Often used to adjust addresses or counters.`;
    }
    case 'sub': {
      const [rd, rs1, rs2] = args;
      return `sub ${rd}, ${rs1}, ${rs2}: ${rd} = ${rs1} - ${rs2} = ${before(rs1)} - ${before(rs2)} = ${after(rd)}.`;
    }
    case 'slli': {
      const [rd, rs1, imm] = args;
      const shiftAmt = parseInt(imm, 10);
      const mult = Math.pow(2, shiftAmt);
      return `slli ${rd}, ${rs1}, ${imm}: Shift Left Logical Immediate. ` +
        `${rd} = ${rs1} << ${imm} = ${before(rs1)} × ${mult} = ${after(rd)}. ` +
        `Shifting left by ${imm} is the same as multiplying by ${mult}. ` +
        `This is commonly used to convert an array index into a byte offset: index × 4 = byte offset for word arrays.`;
    }
    case 'srli': {
      const [rd, rs1, imm] = args;
      const div = Math.pow(2, parseInt(imm, 10));
      return `srli ${rd}, ${rs1}, ${imm}: Shift Right Logical Immediate. ` +
        `${rd} = ${rs1} >> ${imm} = ${before(rs1)} ÷ ${div} = ${after(rd)} (integer division, no sign extension).`;
    }
    case 'mv': {
      const [rd, rs1] = args;
      return `mv ${rd}, ${rs1}: Copy the value of ${rs1} (= ${before(rs1)}) into ${rd}. ` +
        `This is a pseudo-instruction that expands to addi ${rd}, ${rs1}, 0.`;
    }
    case 'beq': {
      const [rs1, rs2, label] = args;
      const taken = before(rs1) === before(rs2);
      return `beq ${rs1}, ${rs2}, ${label}: Branch if ${rs1} == ${rs2}. ` +
        `${rs1}=${before(rs1)}, ${rs2}=${before(rs2)}. ` +
        `Branch is ${taken ? 'TAKEN → jumping to ' + label : 'NOT taken → continuing'}.`;
    }
    case 'bne': {
      const [rs1, rs2, label] = args;
      const taken = before(rs1) !== before(rs2);
      return `bne ${rs1}, ${rs2}, ${label}: Branch if ${rs1} ≠ ${rs2}. ` +
        `${rs1}=${before(rs1)}, ${rs2}=${before(rs2)}. ` +
        `Branch is ${taken ? 'TAKEN → jumping to ' + label : 'NOT taken → continuing'}.`;
    }
    case 'blt': {
      const [rs1, rs2, label] = args;
      const taken = before(rs1) < before(rs2);
      return `blt ${rs1}, ${rs2}, ${label}: Branch if ${rs1} < ${rs2} (signed). ` +
        `${rs1}=${before(rs1)}, ${rs2}=${before(rs2)}. ` +
        `Branch is ${taken ? 'TAKEN → jumping to ' + label : 'NOT taken → continuing'}.`;
    }
    case 'bge': {
      const [rs1, rs2, label] = args;
      const taken = before(rs1) >= before(rs2);
      return `bge ${rs1}, ${rs2}, ${label}: Branch if ${rs1} ≥ ${rs2} (signed). ` +
        `${rs1}=${before(rs1)}, ${rs2}=${before(rs2)}. ` +
        `Branch is ${taken ? 'TAKEN → jumping to ' + label : 'NOT taken → continuing'}.`;
    }
    case 'j': {
      const [label] = args;
      return `j ${label}: Unconditional jump to label "${label}". ` +
        `This is a pseudo-instruction for "jal zero, ${label}". The program counter is set to the address of "${label}".`;
    }
    case 'call': {
      const [label] = args;
      return `call ${label}: Call subroutine at "${label}". ` +
        `The return address is saved in ra (x1), then the PC is set to "${label}". ` +
        `ra = ${hex(after('ra'))}. After the subroutine runs, use "ret" to come back here.`;
    }
    case 'ret': {
      return `ret: Return from subroutine. ` +
        `Sets PC = ra (return address = ${hex(before('ra'))}). ` +
        `This is a pseudo-instruction for "jalr zero, ra, 0". Execution continues where "call" was invoked.`;
    }
    case 'ecall': {
      const a0Val = before('a0');
      if (a0Val === 1) {
        return `ecall: Environment call. a0=1 → print integer. a1=${before('a1')} is printed to the console.`;
      } else if (a0Val === 10) {
        return `ecall: Environment call. a0=10 → program exit. The simulation stops here.`;
      }
      return `ecall: Environment call with a0=${a0Val}. Not implemented in this simulator.`;
    }
    default:
      return `${op} ${args.join(', ')}: Instruction executed.`;
  }
}

// Helper: parse "offset(reg)" → numeric address
function parseOffsetArg(arg: string, regs: number[]): number {
  const match = arg.match(/^(-?\d+)\((\w+)\)$/);
  if (!match) return 0;
  const offset = parseInt(match[1], 10);
  const regIdx = getRegIndexByName(match[2]);
  return (regIdx >= 0 ? regs[regIdx] : 0) + offset;
}

// Local helper to get reg index by ABI name (to avoid circular dep)
function getRegIndexByName(name: string): number {
  const map: Record<string, number> = {
    zero:0,ra:1,sp:2,gp:3,tp:4,
    t0:5,t1:6,t2:7,s0:8,fp:8,s1:9,
    a0:10,a1:11,a2:12,a3:13,a4:14,a5:15,a6:16,a7:17,
    s2:18,s3:19,s4:20,s5:21,s6:22,s7:23,s8:24,s9:25,s10:26,s11:27,
    t3:28,t4:29,t5:30,t6:31,
  };
  const lower = name.toLowerCase();
  if (lower in map) return map[lower];
  if (lower.startsWith('x')) return parseInt(lower.slice(1), 10);
  return -1;
}
