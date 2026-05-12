/**
 * ConsolePanel — Shows ecall output and errors
 */
import React from 'react';

interface ConsolePanelProps {
  lines: string[];
  assembleErrors: string[];
}

const ConsolePanel: React.FC<ConsolePanelProps> = ({ lines, assembleErrors }) => {
  return (
    <div className="console-panel">
      <div className="panel-header">
        <span className="panel-icon">🖥</span>
        <span>Console Output</span>
        {lines.length > 0 && (
          <span className="panel-badge">{lines.length} line{lines.length > 1 ? 's' : ''}</span>
        )}
      </div>
      <div className="console-content">
        {assembleErrors.length > 0 && (
          <div className="console-errors">
            {assembleErrors.map((e, i) => (
              <div key={i} className="console-error-line">⚠ {e}</div>
            ))}
          </div>
        )}
        {lines.length === 0 && assembleErrors.length === 0 ? (
          <span className="console-placeholder">
            Program output will appear here (ecall a0=1 prints integers).
          </span>
        ) : (
          lines.map((l, i) => (
            <div key={i} className="console-output-line">
              <span className="console-prompt">{'>'}</span>
              <span className="console-text">{l}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ConsolePanel;
