/**
 * TracePanel — Execution history table
 *
 * Shows a scrollable table of all steps taken:
 * Step | Line | Instruction | Reg Changes | Mem Changes | Explanation
 */
import React, { useEffect, useRef } from 'react';
import type { TraceEntry } from '../hooks/useSimulator';

interface TracePanelProps {
  entries: TraceEntry[];
}

const TracePanel: React.FC<TracePanelProps> = ({ entries }) => {
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);

  // Scroll the trace TABLE BODY to its bottom — never scroll the page
  useEffect(() => {
    const wrap = tableBodyRef.current?.closest('.trace-table-wrap') as HTMLElement | null;
    if (wrap) wrap.scrollTop = wrap.scrollHeight;
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <div className="trace-panel">
        <div className="panel-header">
          <span className="panel-icon">📋</span>
          <span>Execution Trace</span>
        </div>
        <div className="trace-empty">
          No steps yet. Press Step or Run to build the trace.
        </div>
      </div>
    );
  }

  return (
    <div className="trace-panel">
      <div className="panel-header">
        <span className="panel-icon">📋</span>
        <span>Execution Trace</span>
        <span className="panel-badge">{entries.length} steps</span>
      </div>

      <div className="trace-table-wrap">
        <table className="trace-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Line</th>
              <th>Instruction</th>
              <th>Reg Changes</th>
              <th>Mem Changes</th>
              <th>Explanation</th>
            </tr>
          </thead>
          <tbody ref={tableBodyRef}>
            {entries.map(e => (
              <tr key={e.step} className={e.step === entries.length ? 'trace-row-latest' : ''}>
                <td className="trace-step">{e.step}</td>
                <td className="trace-line">{e.sourceLine}</td>
                <td className="trace-instr"><code>{e.instruction}</code></td>
                <td className="trace-regs">{e.regChanges || '—'}</td>
                <td className="trace-mem">{e.memChanges || '—'}</td>
                <td className="trace-expl">{e.explanation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TracePanel;
