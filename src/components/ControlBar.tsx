/**
 * ControlBar — Execution controls + Panel Tab Toggles
 *
 * Tab buttons on the right open/close side panels in VS Code style:
 *   [📋 Registers]  [💡 Explanation]  [🖥 Console]  [📜 Trace]
 */
import React from 'react';

export type PanelTab = 'registers' | 'explanation' | 'console' | 'trace';

interface ControlBarProps {
  isRunning: boolean;
  isHalted: boolean;
  hasProgram: boolean;
  runSpeed: number;
  onAssemble: () => void;
  onRun: () => void;
  onStep: () => void;
  onPause: () => void;
  onReset: () => void;
  onSpeedChange: (ms: number) => void;
  currentStep: number;
  // Tab props
  activeTab: PanelTab | null;
  onTabToggle: (tab: PanelTab) => void;
}

const TABS: { id: PanelTab; icon: string; label: string }[] = [
  { id: 'registers',   icon: '📋', label: 'Registers'   },
  { id: 'explanation', icon: '💡', label: 'Explanation'  },
  { id: 'console',     icon: '🖥',  label: 'Console'     },
  { id: 'trace',       icon: '📜', label: 'Trace'        },
];

const ControlBar: React.FC<ControlBarProps> = ({
  isRunning, isHalted, hasProgram, runSpeed,
  onAssemble, onRun, onStep, onPause, onReset, onSpeedChange,
  currentStep, activeTab, onTabToggle,
}) => {
  const sliderValue = Math.round(101 - (runSpeed / 10));

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    onSpeedChange(Math.max(50, (101 - val) * 10));
  };

  return (
    <div className="control-bar">
      {/* ── Execution controls ── */}
      <div className="control-left">
        <button className="btn btn-primary" onClick={onAssemble} title="Assemble">
          ⚙ Assemble
        </button>

        <div className="control-divider" />

        {!isRunning ? (
          <button className="btn btn-success" onClick={onRun}
            disabled={!hasProgram || isHalted} title="Run">
            ▶ Run
          </button>
        ) : (
          <button className="btn btn-warning" onClick={onPause} title="Pause">
            ⏸ Pause
          </button>
        )}

        <button className="btn btn-info" onClick={onStep}
          disabled={!hasProgram || isHalted || isRunning} title="Step one instruction">
          ⏭ Step
        </button>

        <button className="btn btn-danger" onClick={onReset}
          disabled={!hasProgram} title="Reset">
          ↺ Reset
        </button>

        {hasProgram && (
          <span className="badge badge-step">Step #{currentStep}</span>
        )}
        {isHalted && <span className="badge badge-halted">HALTED</span>}
      </div>

      {/* ── Speed ── */}
      <div className="speed-control">
        <label className="speed-label">Speed</label>
        <input
          type="range" min={1} max={100} value={sliderValue}
          onChange={handleSlider} className="speed-slider"
          title={`${runSpeed}ms per step`}
        />
        <span className="speed-value">
          {runSpeed < 100 ? `${runSpeed}ms` : `${(runSpeed / 1000).toFixed(1)}s`}
        </span>
      </div>

      {/* ── Panel tabs (VS Code style) ── */}
      <div className="panel-tabs">
        <span className="panel-tabs-label">PANELS</span>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`panel-tab-btn ${activeTab === tab.id ? 'panel-tab-btn--active' : ''}`}
            onClick={() => onTabToggle(tab.id)}
            title={`Toggle ${tab.label} panel`}
          >
            <span className="panel-tab-icon">{tab.icon}</span>
            <span className="panel-tab-label">{tab.label}</span>
            {activeTab === tab.id && <span className="panel-tab-close">×</span>}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ControlBar;
