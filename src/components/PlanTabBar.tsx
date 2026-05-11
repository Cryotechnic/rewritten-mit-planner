import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import EncounterDialog from './EncounterDialog';
import { generateShareId, pushPlan } from '../lib/planSync';
import { t } from '../i18n';

export default function PlanTabBar() {
  const { plans, activePlanId, setActivePlan, addPlan, removePlan, renamePlan, shareId, clientId, setShareId, maxHP, tankHP, encounterLevel, language, writeToken } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedView, setCopiedView] = useState(false);
  const [joinInput, setJoinInput] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
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
    await pushPlan(id, plans, activePlanId, clientId, { maxHP, tankHP, encounterLevel });
    setShareId(id);
  };

  const handleJoin = () => {
    const id = joinInput.trim().toUpperCase();
    if (id.length === 6) { setShareId(id); setShowJoinInput(false); setJoinInput(''); }
  };

  const handleRegen = async () => {
    const id = generateShareId();
    await pushPlan(id, plans, activePlanId, clientId, { maxHP, tankHP, encounterLevel });
    setShareId(id);
    setShowRegenConfirm(false);
  };

  const handleCopy = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('join', shareId!);
    const href = writeToken ? `${url.toString()}#t=${writeToken}` : url.toString();
    navigator.clipboard.writeText(href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyView = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', shareId!);
    navigator.clipboard.writeText(url.toString());
    setCopiedView(true);
    setTimeout(() => setCopiedView(false), 2000);
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
          <button className="sync-btn" onClick={handleCopy} title={t('btnCopyLink', language)}>
              {copied ? t('btnCopied', language) : t('btnCopyLink', language)}
            </button>
            <button className="sync-btn" style={{ color: '#67e8f9' }} onClick={handleCopyView} title="Copy view-only link">
              {copiedView ? 'Copied!' : 'View-only link'}
            </button>
            <button className="sync-btn" onClick={() => setShowRegenConfirm(true)} title={t('btnRegen', language)}>{t('btnRegen', language)}</button>

          </>
        ) : showJoinInput ? (
          <>
            <input
              className="sync-join-input"
              placeholder={t('joinPlaceholder', language)}
              value={joinInput}
              maxLength={6}
              onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); if (e.key === 'Escape') setShowJoinInput(false); }}
              autoFocus
            />
            <button className="sync-btn" onClick={handleJoin}>{t('btnJoin', language)}</button>
            <button className="sync-btn sync-btn-stop" onClick={() => setShowJoinInput(false)}>✕</button>
          </>
        ) : (
          <>
            <button className="sync-btn" onClick={handleShare} title={t('btnShare', language)}>{t('btnShare', language)}</button>
            <button className="sync-btn" onClick={() => setShowJoinInput(true)} title={t('btnJoin', language)}>{t('btnJoin', language)}</button>
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
      {showRegenConfirm && (
        <div className="encounter-dialog-overlay" onClick={() => setShowRegenConfirm(false)}>
          <div className="encounter-dialog" onClick={(e) => e.stopPropagation()}>
            <h2 className="encounter-dialog-title" style={{ color: '#f87171' }}>{t('regenTitle', language)}</h2>
            <p style={{ margin: '0 0 16px', color: 'var(--text-dim, #9ca3af)', fontSize: 14 }}>
              {t('regenDesc', language)} <strong style={{ color: '#fca5a5' }}>{t('regenWarn', language)}</strong>
            </p>
            <div className="encounter-dialog-actions">
              <button className="encounter-dialog-cancel" onClick={() => setShowRegenConfirm(false)}>{t('btnCancel', language)}</button>
              <button className="encounter-dialog-confirm" style={{ background: '#dc2626' }} onClick={handleRegen}>{t('btnRefresh', language)}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

