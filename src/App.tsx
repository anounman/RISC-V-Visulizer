/**
 * App — RISC-V Simulator with fully resizable panels
 *
 * Layout (all splits are drag-resizable):
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │ Header                                                   │
 * ├──────────────────────────────────────────────────────────┤
 * │ ControlBar                                               │
 * ├──────────────[↔ drag]───────────────────────────────────┤
 * │ Memory Visualizer  ║  Editor                            │
 * │ (resizable width)  ║  [↕ drag]                          │
 * │                    ║  Registers + Explanation + Console  │
 * ├──────────────[↕ drag]───────────────────────────────────┤
 * │ Execution Flow Tracer (resizable height)                 │
 * ├──────────────[↕ drag]───────────────────────────────────┤
 * │ Execution Trace Table (resizable height)                 │
 * └──────────────────────────────────────────────────────────┘
 */
import React, { useEffect } from 'react';
import CodeEditor       from './components/Editor';
import ControlBar       from './components/ControlBar';
import RegisterPanel    from './components/RegisterPanel';
import MemoryVisualizer from './components/MemoryVisualizer';
import ExplanationPanel from './components/ExplanationPanel';
import FlowTracer       from './components/FlowTracer';
import TracePanel       from './components/TracePanel';
import ConsolePanel     from './components/ConsolePanel';
import { useSimulator } from './hooks/useSimulator';
import { useResize }    from './hooks/useResize';
import { DEFAULT_PROGRAM } from './defaultProgram';

const HEADER_H  = 52;
const CONTROL_H = 48;

const App: React.FC = () => {
  const { state, actions } = useSimulator(DEFAULT_PROGRAM);

  useEffect(() => {
    actions.assemble_();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const registers    = state.cpuState?.registers ?? new Array(32).fill(0);
  const memory       = state.cpuState?.memory    ?? new Map();
  const memoryLabels = state.assembled?.memoryLabels ?? [];

  // ── Resize handles ───────────────────────────────────────────
  // 1. Horizontal: Memory (left) ↔ Editor+Panels (right)
  const lrSplit = useResize(
    Math.round(window.innerWidth * 0.45),
    'horizontal', 220, window.innerWidth - 280,
  );

  // 2. Vertical (right column): Editor ↕ Panels
  const editorPanelSplit = useResize(
    Math.round((window.innerHeight - HEADER_H - CONTROL_H) * 0.52),
    'vertical', 120, window.innerHeight - HEADER_H - CONTROL_H - 120,
  );

  // 3. Vertical: Workspace ↕ FlowTracer
  const workspaceFlowSplit = useResize(220, 'vertical', 80, 420);

  // 4. Vertical: FlowTracer ↕ TraceTable
  const flowTraceSplit = useResize(180, 'vertical', 60, 380);

  const workspaceH = `calc(100vh - ${HEADER_H}px - ${CONTROL_H}px - ${workspaceFlowSplit.size}px - ${flowTraceSplit.size}px - 8px)`;

  return (
    <div className="app">

      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-left">
          <span className="header-logo">⚙</span>
          <span className="header-title">RISC-V Sim</span>
          <span className="header-sub">Educational RISC-V Simulator</span>
        </div>
        <div className="header-right">
          {state.isHalted  && <span className="header-badge halted">HALTED</span>}
          {state.isRunning && <span className="header-badge running">● RUNNING</span>}
          {state.assembled && !state.isRunning && !state.isHalted && (
            <span className="header-badge ready">READY</span>
          )}
          {!state.assembled && (
            <span className="header-badge idle">IDLE — Press Assemble</span>
          )}
          <a className="header-link" href="https://github.com/riscv/riscv-isa-manual"
            target="_blank" rel="noopener noreferrer">ISA Spec ↗</a>
        </div>
      </header>

      {/* ── Control Bar ── */}
      <ControlBar
        isRunning={state.isRunning}
        isHalted={state.isHalted}
        hasProgram={!!state.assembled}
        runSpeed={state.runSpeed}
        onAssemble={actions.assemble_}
        onRun={actions.run}
        onStep={actions.step}
        onPause={actions.pause}
        onReset={actions.reset}
        onSpeedChange={actions.setRunSpeed}
        currentStep={state.currentStep}
      />

      {/* ── Main workspace (resizable left/right) ── */}
      <div className="workspace" style={{ height: workspaceH }}>

        {/* LEFT — Memory Visualizer */}
        <div className="workspace-memory" style={{ width: lrSplit.size }}>
          <div className="panel-header sticky-header">
            <span className="panel-icon">💾</span>
            <span>Memory Visualizer</span>
            {state.lastChangedMem.length > 0 && (
              <span className="panel-badge changed-badge">
                {state.lastChangedMem.length} write{state.lastChangedMem.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="workspace-memory-scroll">
            <MemoryVisualizer
              memory={memory}
              memoryLabels={memoryLabels}
              registers={registers}
              changedAddresses={state.lastChangedMem}
            />
          </div>
        </div>

        {/* ↔ Horizontal drag handle */}
        <div
          className="resize-handle resize-handle--col"
          onMouseDown={lrSplit.onMouseDown}
          title="Drag to resize"
        />

        {/* RIGHT — Editor + Panels stacked */}
        <div className="workspace-right">

          {/* Editor */}
          <div className="workspace-editor" style={{ height: editorPanelSplit.size }}>
            <CodeEditor
              value={state.source}
              onChange={actions.setSource}
              highlightLine={state.currentSourceLine}
            />
          </div>

          {/* ↕ Vertical drag handle (editor / panels) */}
          <div
            className="resize-handle resize-handle--row"
            onMouseDown={editorPanelSplit.onMouseDown}
            title="Drag to resize"
          />

          {/* Bottom panels */}
          <div className="workspace-panels">
            <RegisterPanel
              registers={registers}
              changedIndices={state.lastChangedRegs}
              memoryLabels={memoryLabels}
            />
            <ExplanationPanel
              instruction={state.currentInstruction}
              explanation={state.currentExplanation}
            />
            <ConsolePanel
              lines={state.consoleLines}
              assembleErrors={state.assembleErrors}
            />
          </div>
        </div>
      </div>

      {/* ↕ Drag handle: workspace ↕ FlowTracer */}
      <div
        className="resize-handle resize-handle--row resize-handle--full"
        onMouseDown={workspaceFlowSplit.onMouseDown}
        title="Drag to resize"
      />

      {/* ── Execution Flow Tracer ── */}
      <div className="flow-row" style={{ height: workspaceFlowSplit.size }}>
        <FlowTracer entries={state.trace} />
      </div>

      {/* ↕ Drag handle: FlowTracer ↕ TraceTable */}
      <div
        className="resize-handle resize-handle--row resize-handle--full"
        onMouseDown={flowTraceSplit.onMouseDown}
        title="Drag to resize"
      />

      {/* ── Execution Trace Table ── */}
      <div className="trace-row" style={{ height: flowTraceSplit.size }}>
        <TracePanel entries={state.trace} />
      </div>

     </div>
  );
};

export default App;
