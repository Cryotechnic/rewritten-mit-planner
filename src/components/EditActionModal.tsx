import React from 'react';
import { useStore } from '../store';
import type { Action } from '../types';
import { formatTime } from '../calc';

interface Props {
  phaseIdx: number;
  action: Action;           // original (unoverridden) action
  displayAction: Action;    // merged action with current overrides applied
  onClose: () => void;
}

const DAMAGE_TYPES = ['Magic', 'Physical', 'hide'];

function parseTime(str: string): number | null {
  const trimmed = str.trim();
  const match = trimmed.match(/^(-?)(\d+):(\d+(?:\.\d*)?)$/);
  if (!match) return null;
  const neg = match[1] === '-';
  const m = parseInt(match[2], 10);
  const s = parseFloat(match[3]);
  const total = m * 60 + s;
  return neg ? -total : total;
}

export default function EditActionModal({ phaseIdx, action, displayAction, onClose }: Props) {
  const { setActionOverride, resetActionOverride } = useStore();

  const [name, setName] = React.useState(displayAction.name ?? '');
  const [timeStr, setTimeStr] = React.useState(formatTime(displayAction.timeSec));
  const [type, setType] = React.useState(displayAction.type ?? 'Magic');
  const [damage, setDamage] = React.useState(String(displayAction.damageHit ?? ''));
  const [timeError, setTimeError] = React.useState(false);

  const isModified =
    name !== (action.name ?? '') ||
    parseTime(timeStr) !== action.timeSec ||
    type !== (action.type ?? 'Magic') ||
    (damage === '' ? null : Number(damage)) !== action.damageHit;

  function handleSave() {
    const parsedTime = parseTime(timeStr);
    if (timeStr !== '' && parsedTime === null) {
      setTimeError(true);
      return;
    }
    setTimeError(false);
    setActionOverride(phaseIdx, action.row, {
      name: name || undefined,
      timeSec: parsedTime ?? undefined,
      type: type || undefined,
      damageHit: damage !== '' ? Number(damage) : null,
    });
    onClose();
  }

  function handleReset() {
    resetActionOverride(phaseIdx, action.row);
    onClose();
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && !e.shiftKey) handleSave();
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick} onKeyDown={handleKeyDown}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Edit Action">
        <div className="modal-header">
          <span className="modal-title">Edit Action</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          <label className="modal-field">
            <span>Name</span>
            <input
              className="modal-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={action.name ?? ''}
              autoFocus
            />
          </label>

          <label className="modal-field">
            <span>Time <span className="modal-hint">(M:SS.s, e.g. -0:20.0)</span></span>
            <input
              className={`modal-input ${timeError ? 'input-error' : ''}`}
              value={timeStr}
              onChange={(e) => { setTimeStr(e.target.value); setTimeError(false); }}
              placeholder={formatTime(action.timeSec)}
            />
            {timeError && <span className="error-msg">Invalid format — use M:SS.s</span>}
          </label>

          <label className="modal-field">
            <span>Damage Type</span>
            <select
              className="modal-input modal-select"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {DAMAGE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>

          <label className="modal-field">
            <span>Damage (pre-mit)</span>
            <input
              className="modal-input"
              type="number"
              min={0}
              value={damage}
              onChange={(e) => setDamage(e.target.value)}
              placeholder={String(action.damageHit ?? 0)}
            />
          </label>
        </div>

        <div className="modal-footer">
          <button
            className="modal-btn reset"
            onClick={handleReset}
            disabled={!isModified}
            title="Restore original spreadsheet values"
          >
            Reset to default
          </button>
          <div className="modal-footer-right">
            <button className="modal-btn cancel" onClick={onClose}>Cancel</button>
            <button className="modal-btn save" onClick={handleSave}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
