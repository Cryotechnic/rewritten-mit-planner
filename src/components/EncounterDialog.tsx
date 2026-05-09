import { useState, useRef, useEffect } from 'react';

interface Props {
  mode: 'oobe' | 'new' | 'rename';
  initialValue?: string;
  onConfirm: (encounterName: string) => void;
  onCancel?: () => void;
}

export default function EncounterDialog({ mode, initialValue = '', onConfirm, onCancel }: Props) {
  const [name, setName] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const confirm = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') confirm();
    if (e.key === 'Escape' && onCancel) onCancel();
  };

  return (
    <div className="encounter-dialog-overlay" onClick={mode === 'oobe' ? undefined : onCancel}>
      <div className="encounter-dialog" onClick={(e) => e.stopPropagation()}>
        {mode === 'oobe' ? (
          <>
            <h2 className="encounter-dialog-title">Welcome</h2>
            <p className="encounter-dialog-desc">Name your first encounter to get started.</p>
          </>
        ) : mode === 'rename' ? (
          <h2 className="encounter-dialog-title">Rename Plan</h2>
        ) : (
          <h2 className="encounter-dialog-title">New Plan</h2>
        )}
        <label className="encounter-dialog-label">Encounter Name</label>
        <input
          ref={inputRef}
          className="encounter-dialog-input"
          placeholder="e.g. The Unending Coil of Bahamut"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKey}
        />
        <div className="encounter-dialog-actions">
          {mode === 'new' && (
            <button className="encounter-dialog-cancel" onClick={onCancel}>Cancel</button>
          )}
          <button
            className="encounter-dialog-confirm"
            onClick={confirm}
            disabled={!name.trim()}
          >
            {mode === 'oobe' ? 'Get Started' : mode === 'rename' ? 'Rename' : 'Create Plan'}
          </button>
        </div>
      </div>
    </div>
  );
}
