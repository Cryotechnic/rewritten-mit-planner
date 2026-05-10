import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import EncounterDialog from './EncounterDialog';
import { generateShareId, pushPlan } from '../lib/planSync';

export default function PlanTabBar() {
  const { plans, activePlanId, setActivePlan, addPlan, removePlan, renamePlan, shareId, clientId, setShareId } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [joinInput, setJoinInput] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const canRemove = Object.keys(plans).length > 1;

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  const startRename = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditName(name);
  };

  const commitRename = () => {
    if (editingId && editName.trim()) renamePlan(editingId, editName.trim());
    setEditingId(null);
  };

  const handleShare = async () => {
    const id = generateShareId();
    await pushPlan(id, plans, activePlanId, clientId);
    setShareId(id);
  };

  const handleJoin = () => {
    const id = joinInput.trim().toUpperCase();
    if (id.length === 6) { setShareId(id); setShowJoinInput(false); setJoinInput(''); }
  };

  const handleCopy = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('join', shareId!);
    navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="plan-tab-bar">
      {Object.values(plans).map((plan) => (
        <div
          key={plan.id}
          className={`plan-tab ${plan.id === activePlanId ? 'active' : ''}`}
          onClick={() => { if (editingId !== plan.id) setActivePlan(plan.id); }}
          onDoubleClick={(e) => startRename(plan.id, plan.name, e)}
          title="Double-click to rename"
        >
          {editingId === plan.id ? (
            <input
              ref={inputRef}
              className="plan-tab-rename"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setEditingId(null);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="plan-tab-name">{plan.name || <em style={{ opacity: 0.5 }}>Untitled</em>}</span>
          )}
          {canRemove && (
            <button
              className="plan-tab-close"
              onClick={(e) => { e.stopPropagation(); removePlan(plan.id); }}
              title="Close plan"
            >×</button>
          )}
          <button
            className="plan-tab-rename-btn"
            onClick={(e) => { e.stopPropagation(); setRenamingId(plan.id); }}
            title="Rename plan"
          >✎</button>
        </div>
      ))}
      <button className="plan-tab-add" onClick={() => setShowDialog(true)} title="New plan">+</button>

      {/* Sync controls */}
      <div className="sync-controls">
        {shareId ? (
          <>
            <span className="sync-badge sync-active" title={`Syncing — session: ${shareId}`}>
              <span className="sync-dot" />
              {shareId}
            </span>
            <button className="sync-btn" onClick={handleCopy} title="Copy join link">
              {copied ? '✓ Copied' : 'Copy link'}
            </button>

          </>
        ) : showJoinInput ? (
          <>
            <input
              className="sync-join-input"
              placeholder="Code (e.g. X4K9MQ)"
              value={joinInput}
              maxLength={6}
              onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); if (e.key === 'Escape') setShowJoinInput(false); }}
              autoFocus
            />
            <button className="sync-btn" onClick={handleJoin}>Join</button>
            <button className="sync-btn sync-btn-stop" onClick={() => setShowJoinInput(false)}>✕</button>
          </>
        ) : (
          <>
            <button className="sync-btn" onClick={handleShare} title="Share this plan and start syncing">Share</button>
            <button className="sync-btn" onClick={() => setShowJoinInput(true)} title="Join an existing session">Join</button>
          </>
        )}
      </div>

      {showDialog && (
        <EncounterDialog
          mode="new"
          onConfirm={(encounterName) => { addPlan(encounterName); setShowDialog(false); }}
          onCancel={() => setShowDialog(false)}
        />
      )}
      {renamingId && (
        <EncounterDialog
          mode="rename"
          initialValue={plans[renamingId]?.name ?? ''}
          onConfirm={(encounterName) => { renamePlan(renamingId, encounterName); setRenamingId(null); }}
          onCancel={() => setRenamingId(null)}
        />
      )}
    </div>
  );
}

