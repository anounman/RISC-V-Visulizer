/**
 * ControlBar — Run / Step / Pause / Reset buttons + speed slider
 */
import React from 'react';

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
}

const ControlBar: React.FC<ControlBarProps> = ({
  isRunning,
  isHalted,
  hasProgram,
  runSpeed,
  onAssemble,
  onRun,
  onStep,
  onPause,
  onReset,
  onSpeedChange,
  currentStep,
}) => {
  // Convert ms → slider value (invert: low ms = fast = high slider)
  const sliderValue = Math.round(101 - (runSpeed / 10));

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    const ms = (101 - val) * 10; // 10ms – 1000ms
    onSpeedChange(Math.max(50, ms));
  };

  return (
    <div className="control-bar">
      <div className="control-left">
        <button
          className="btn btn-primary"
          onClick={onAssemble}
          title="Parse and assemble the program"
        >
          ⚙ Assemble
        </button>

        <div className="control-divider" />

        {!isRunning ? (
          <button
            className="btn btn-success"
            onClick={onRun}
            disabled={!hasProgram || isHalted}
            title="Run program automatically"
          >
            ▶ Run
          </button>
        ) : (
          <button
            className="btn btn-warning"
            onClick={onPause}
            title="Pause execution"
          >
            ⏸ Pause
          </button>
        )}

        <button
          className="btn btn-info"
          onClick={onStep}
          disabled={!hasProgram || isHalted || isRunning}
          title="Execute one instruction"
        >
          ⏭ Step
        </button>

        <button
          className="btn btn-danger"
          onClick={onReset}
          disabled={!hasProgram}
          title="Reset to start"
        >
          ↺ Reset
        </button>
      </div>

      <div className="control-right">
        {isHalted && (
          <span className="badge badge-halted">HALTED</span>
        )}
        {hasProgram && (
          <span className="badge badge-step">Step #{currentStep}</span>
        )}

        <div className="speed-control">
          <label className="speed-label">Speed</label>
          <input
            type="range"
            min={1}
            max={100}
            value={sliderValue}
            onChange={handleSlider}
            className="speed-slider"
            title={`${runSpeed}ms per step`}
          />
          <span className="speed-value">
            {runSpeed < 100 ? `${runSpeed}ms` : `${(runSpeed / 1000).toFixed(1)}s`}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ControlBar;
