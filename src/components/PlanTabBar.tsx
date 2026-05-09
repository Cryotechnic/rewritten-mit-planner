import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import EncounterDialog from './EncounterDialog';

export default function PlanTabBar() {
  const { plans, activePlanId, setActivePlan, addPlan, removePlan, renamePlan } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
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
