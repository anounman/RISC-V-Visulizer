/**
 * ExplanationPanel — Shows the human-friendly explanation for the last step
 */
import React from 'react';

interface ExplanationPanelProps {
  instruction: string | null;
  explanation: string | null;
  error?: string | null;
}

const ExplanationPanel: React.FC<ExplanationPanelProps> = ({
  instruction,
  explanation,
  error,
}) => {
  return (
    <div className="explanation-panel">
      <div className="panel-header">
        <span className="panel-icon">💡</span>
        <span>Explanation</span>
      </div>
      <div className="explanation-content">
        {error && (
          <div className="expl-error">
            <span className="expl-error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}
        {instruction && (
          <div className="expl-instruction">
            <span className="expl-label">Instruction:</span>
            <code className="expl-code">{instruction}</code>
          </div>
        )}
        {explanation ? (
          <p className="expl-text">{explanation}</p>
        ) : (
          <p className="expl-placeholder">
            Press <strong>Assemble</strong> then <strong>Step</strong> or <strong>Run</strong> to see explanations here.
          </p>
        )}
      </div>
    </div>
  );
};

export default ExplanationPanel;
