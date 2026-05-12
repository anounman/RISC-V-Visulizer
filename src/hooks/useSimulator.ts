/**
 * useSimulator — Central React hook for the RISC-V simulator
 *
 * Manages:
 *   - Source code
 *   - Assembled program (instructions + memory layout)
 *   - Current CPU state
 *   - Step history / trace
 *   - Auto-run timer
 *   - Console output
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { parseAssembly } from '../simulator/parser';
import { assemble } from '../simulator/assembler';
import type { AssembleResult } from '../simulator/assembler';
import { createInitialState, executeStep } from '../simulator/executor';
import type { CPUState, StepResult } from '../simulator/executor';

export interface TraceEntry {
  step: number;
  sourceLine: number;
  instruction: string;
  regChanges: string;
  memChanges: string;
  explanation: string;
}

export interface SimulatorState {
  // Source & assembly
  source: string;
  assembled: AssembleResult | null;
  assembleErrors: string[];

  // Execution state
  cpuState: CPUState | null;
  currentStep: number;
  isRunning: boolean;
  isHalted: boolean;

  // Current step info
  currentInstruction: string | null;
  currentExplanation: string | null;
  currentSourceLine: number | null; // 1-indexed line that is highlighted

  // History
  trace: TraceEntry[];
  consoleLines: string[];

  // Auto-run speed (ms between steps)
  runSpeed: number;

  // Changed registers/memory (for highlight)
  lastChangedRegs: number[];  // register indices
  lastChangedMem: number[];   // addresses
}

const DEFAULT_SPEED = 600; // ms

export interface SimulatorActions {
  setSource: (src: string) => void;
  assemble_: () => void;
  step: () => void;
  run: () => void;
  pause: () => void;
  reset: () => void;
  setRunSpeed: (ms: number) => void;
}

export function useSimulator(initialSource: string) {
  const [state, setState] = useState<SimulatorState>({
    source: initialSource,
    assembled: null,
    assembleErrors: [],
    cpuState: null,
    currentStep: 0,
    isRunning: false,
    isHalted: false,
    currentInstruction: null,
    currentExplanation: null,
    currentSourceLine: null,
    trace: [],
    consoleLines: [],
    runSpeed: DEFAULT_SPEED,
    lastChangedRegs: [],
    lastChangedMem: [],
  });

  const runTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep latest state accessible inside timer callback without stale closures
  const stateRef = useRef(state);
  stateRef.current = state;

  // ---------------------------------------------------------------
  // Assemble the source code
  // ---------------------------------------------------------------
  const assemble_ = useCallback(() => {
    const parsed = parseAssembly(stateRef.current.source);
    const assembled = assemble(parsed);

    if (assembled.instructions.length === 0) {
      setState(s => ({
        ...s,
        assembled: null,
        assembleErrors: ['No instructions found. Make sure you have a .text section.'],
        cpuState: null,
        currentSourceLine: null,
      }));
      return;
    }

    const initialCpu = createInitialState(assembled);

    // Find what source line the first instruction corresponds to
    const firstInstr = assembled.instructions.find(i => i.address === initialCpu.pc);

    setState(s => ({
      ...s,
      assembled,
      assembleErrors: assembled.errors,
      cpuState: initialCpu,
      currentStep: 0,
      isHalted: false,
      currentInstruction: firstInstr?.raw ?? null,
      currentExplanation: null,
      currentSourceLine: firstInstr?.sourceLine ?? null,
      trace: [],
      consoleLines: [],
      lastChangedRegs: [],
      lastChangedMem: [],
    }));
  }, []);

  // ---------------------------------------------------------------
  // Execute one step
  // ---------------------------------------------------------------
  const step = useCallback(() => {
    const s = stateRef.current;
    if (!s.assembled || !s.cpuState || s.isHalted) return;

    const result: StepResult | null = executeStep(s.cpuState, s.assembled);

    if (!result) {
      // PC went out of bounds — halt
      setState(prev => ({ ...prev, isHalted: true, isRunning: false }));
      if (runTimerRef.current) clearInterval(runTimerRef.current);
      return;
    }

    // Find the next instruction's source line (for highlighting AFTER this step)
    const nextInstr = s.assembled.instructions.find(i => i.address === result.state.pc);

    // Build trace entry
    const traceEntry: TraceEntry = {
      step: s.currentStep + 1,
      sourceLine: result.instruction.sourceLine,
      instruction: result.instruction.raw,
      regChanges: result.regChanges.map(r => `${r.name}: ${r.before}→${r.after}`).join(', '),
      memChanges: result.memChanges.map(m => `[0x${(m.address>>>0).toString(16)}]: ${m.before}→${m.after}`).join(', '),
      explanation: result.explanation,
    };

    // Append console output
    const newConsoleLines = result.consoleOutput !== undefined
      ? [...s.consoleLines, result.consoleOutput]
      : s.consoleLines;

    const willHalt = result.state.halted;

    setState(prev => ({
      ...prev,
      cpuState: result.state,
      currentStep: prev.currentStep + 1,
      isHalted: willHalt,
      isRunning: willHalt ? false : prev.isRunning,
      currentInstruction: willHalt ? result.instruction.raw : (nextInstr?.raw ?? null),
      currentExplanation: result.explanation,
      currentSourceLine: willHalt
        ? result.instruction.sourceLine
        : (nextInstr?.sourceLine ?? null),
      trace: [...prev.trace, traceEntry],
      consoleLines: newConsoleLines,
      lastChangedRegs: result.regChanges.map(r => r.index),
      lastChangedMem: result.memChanges.map(m => m.address),
    }));

    if (willHalt && runTimerRef.current) {
      clearInterval(runTimerRef.current);
      runTimerRef.current = null;
    }
  }, []);

  // ---------------------------------------------------------------
  // Run (auto-step at runSpeed interval)
  // ---------------------------------------------------------------
  const run = useCallback(() => {
    if (stateRef.current.isHalted || !stateRef.current.assembled) return;
    if (runTimerRef.current) return; // Already running

    setState(s => ({ ...s, isRunning: true }));

    runTimerRef.current = setInterval(() => {
      if (stateRef.current.isHalted || !stateRef.current.isRunning) {
        clearInterval(runTimerRef.current!);
        runTimerRef.current = null;
        return;
      }
      step();
    }, stateRef.current.runSpeed);
  }, [step]);

  // ---------------------------------------------------------------
  // Pause
  // ---------------------------------------------------------------
  const pause = useCallback(() => {
    if (runTimerRef.current) {
      clearInterval(runTimerRef.current);
      runTimerRef.current = null;
    }
    setState(s => ({ ...s, isRunning: false }));
  }, []);

  // ---------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------
  const reset = useCallback(() => {
    if (runTimerRef.current) {
      clearInterval(runTimerRef.current);
      runTimerRef.current = null;
    }
    const s = stateRef.current;
    if (!s.assembled) {
      // Re-assemble from scratch
      assemble_();
      return;
    }
    const initialCpu = createInitialState(s.assembled);
    const firstInstr = s.assembled.instructions.find(i => i.address === initialCpu.pc);
    setState(prev => ({
      ...prev,
      cpuState: initialCpu,
      currentStep: 0,
      isRunning: false,
      isHalted: false,
      currentInstruction: firstInstr?.raw ?? null,
      currentExplanation: null,
      currentSourceLine: firstInstr?.sourceLine ?? null,
      trace: [],
      consoleLines: [],
      lastChangedRegs: [],
      lastChangedMem: [],
    }));
  }, [assemble_]);

  // ---------------------------------------------------------------
  // Update source (triggers re-assembly only when user edits)
  // ---------------------------------------------------------------
  const setSource = useCallback((src: string) => {
    setState(s => ({ ...s, source: src }));
  }, []);

  const setRunSpeed = useCallback((ms: number) => {
    setState(s => ({ ...s, runSpeed: ms }));
    // Restart timer with new speed if currently running
    if (runTimerRef.current) {
      clearInterval(runTimerRef.current);
      runTimerRef.current = null;
      // Will re-start on next `run()` call, or re-start immediately:
      run();
    }
  }, [run]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (runTimerRef.current) clearInterval(runTimerRef.current);
    };
  }, []);

  return {
    state,
    actions: { setSource, assemble_, step, run, pause, reset, setRunSpeed },
  };
}
