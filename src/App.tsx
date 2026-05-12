/**
 * App — RISC-V Simulator · Multi-Tab Layout
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ Header                                                      │
 * ├─────────────────────────────────────────────────────────────┤
 * │ ControlBar  [Assemble][Run][Step]…  [📋 Registers][💡]…    │
 * ├──────────────────────┬───────────────────┬──────────────────┤
 * │                      │                   │  Active Tab      │
 * │  Memory Visualizer   │   Code Editor     │  (Registers /    │
 * │  (left, resizable)   │   (center)        │   Explanation /  │
 * │                      │                   │   Console /      │
 * │                      │                   │   Trace)         │
 * ├──────────────────────┴───────────────────┴──────────────────┤
 * │  Execution Flow (full width, horizontal timeline)           │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Tabs behave like VS Code column panels:
 *  - Click a tab button in the control bar → opens as right column
 *  - Click again → closes (editor fills the space)
 *  - Only one tab open at a time
 */
import React, { useEffect, useState } from 'react';
import CodeEditor       from './components/Editor';
import ControlBar       from './components/ControlBar';
import type { PanelTab } from './components/ControlBar';
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

  // Which right-side tab panel is open (null = closed)
  const [activeTab, setActiveTab] = useState<PanelTab | null>('registers');

  const toggleTab = (tab: PanelTab) =>
    setActiveTab(prev => (prev === tab ? null : tab));

  useEffect(() => {
    actions.assemble_();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const registers    = state.cpuState?.registers ?? new Array(32).fill(0);
  const memory       = state.cpuState?.memory    ?? new Map();
  const memoryLabels = state.assembled?.memoryLabels ?? [];

  /* ── Resize handles ─────────────────────────────────────────── */

  // Memory column width (left)
  const memSplit = useResize(
    Math.round(window.innerWidth * 0.32),
    'horizontal', 180, window.innerWidth - 520,
  );

  // Tab panel width (right, only relevant when a tab is open)
  const tabSplit = useResize(
    Math.round(window.innerWidth * 0.28),
    'horizontal', 220, window.innerWidth - 400,
  );

  // Workspace vs Flow row height split
  const flowSplit = useResize(180, 'vertical', 80, 420);

  const workspaceH = `calc(100vh - ${HEADER_H}px - ${CONTROL_H}px - ${flowSplit.size}px - 5px)`;

  /* ── Tab content renderer ───────────────────────────────────── */
  const renderTabContent = () => {
    switch (activeTab) {
      case 'registers':
        return (
          <RegisterPanel
            registers={registers}
            changedIndices={state.lastChangedRegs}
            memoryLabels={memoryLabels}
          />
        );
      case 'explanation':
        return (
          <ExplanationPanel
            instruction={state.currentInstruction}
            explanation={state.currentExplanation}
          />
        );
      case 'console':
        return (
          <ConsolePanel
            lines={state.consoleLines}
            assembleErrors={state.assembleErrors}
          />
        );
      case 'trace':
        return <TracePanel entries={state.trace} />;
      default:
        return null;
    }
  };

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

      {/* ── Control Bar + Tab buttons ── */}
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
        activeTab={activeTab}
        onTabToggle={toggleTab}
      />

      {/* ── Main workspace: 3 resizable columns ── */}
      <div className="workspace" style={{ height: workspaceH }}>

        {/* LEFT — Memory Visualizer */}
        <div className="workspace-memory" style={{ width: memSplit.size }}>
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

        {/* ↔ Drag handle: Memory | Editor */}
        <div className="resize-handle resize-handle--col" onMouseDown={memSplit.onMouseDown} />

        {/* CENTER — Code Editor (fills all remaining space) */}
        <div className="workspace-editor-center">
          <CodeEditor
            value={state.source}
            onChange={actions.setSource}
            highlightLine={state.currentSourceLine}
          />
        </div>

        {/* ↔ Drag handle: Editor | Tab panel (only when tab is open) */}
        {activeTab && (
          <div className="resize-handle resize-handle--col" onMouseDown={tabSplit.onMouseDown} />
        )}

        {/* RIGHT — Active Tab Panel */}
        {activeTab && (
          <div className="workspace-tab-panel" style={{ width: tabSplit.size }}>
            {/* Tab strip header */}
            <div className="tab-panel-header">
              <div className="tab-panel-tabs">
                {(['registers','explanation','console','trace'] as PanelTab[]).map(t => (
                  activeTab === t && (
                    <div key={t} className="tab-panel-active-tab">
                      {t === 'registers'   && '📋 Registers'}
                      {t === 'explanation' && '💡 Explanation'}
                      {t === 'console'     && '🖥 Console'}
                      {t === 'trace'       && '📜 Trace'}
                      <button
                        className="tab-panel-close-btn"
                        onClick={() => setActiveTab(null)}
                        title="Close panel"
                      >×</button>
                    </div>
                  )
                ))}
              </div>
            </div>
            {/* Panel content */}
            <div className="tab-panel-content">
              {renderTabContent()}
            </div>
          </div>
        )}

      </div>

      {/* ↕ Drag handle: workspace | Flow */}
      <div
        className="resize-handle resize-handle--row resize-handle--full"
        onMouseDown={flowSplit.onMouseDown}
      />

      {/* ── Execution Flow (always visible, full width) ── */}
      <div className="flow-row" style={{ height: flowSplit.size }}>
        <FlowTracer entries={state.trace} />
      </div>

    </div>
  );
};

export default App;
