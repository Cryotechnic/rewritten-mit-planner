import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { CHANGELOG, CURRENT_VERSION, type ChangeType, type ChangelogEntry } from '../data/changelog';

interface Props {
  onClose: () => void;
}

const TYPE_LABEL: Record<ChangeType, string> = {
  new:    'New',
  fix:    'Fix',
  change: 'Change',
  remove: 'Removed',
  hotfix: 'Hotfix'
};

const TYPE_STYLE: Record<ChangeType, React.CSSProperties> = {
  new:    { background: '#14532d', color: '#86efac', border: '1px solid #166534' },
  fix:    { background: '#713f12', color: '#fde68a', border: '1px solid #92400e' },
  change: { background: '#1e3a5f', color: '#93c5fd', border: '1px solid #1e40af' },
  remove: { background: '#3f1515', color: '#fca5a5', border: '1px solid #7f1d1d' },
  hotfix: {background: '#d0342c', color: '#e7e6e6', border: '1px solid #e7e6e6'}
};

interface ItemProps {
  entry: ChangelogEntry;
  isOpen: boolean;
  isLatest: boolean;
  onToggle: () => void;
}

function AccordionItem({ entry, isOpen, isLatest, onToggle }: ItemProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const innerRef   = useRef<HTMLDivElement>(null);
  const ready      = useRef(false);

  // Paint the correct initial state (no animation), then enable transitions on the next frame
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const inner   = innerRef.current;
    if (!wrapper || !inner) return;
    wrapper.style.height  = isOpen ? `${inner.scrollHeight}px` : '0px';
    wrapper.style.opacity = isOpen ? '1' : '0';
    requestAnimationFrame(() => {
      if (!wrapper) return;
      wrapper.style.transition = 'height 0.18s ease, opacity 0.2s ease';
      ready.current = true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate open/close after mount
  useEffect(() => {
    if (!ready.current) return;
    const wrapper = wrapperRef.current;
    const inner   = innerRef.current;
    if (!wrapper || !inner) return;
    wrapper.style.height  = isOpen ? `${inner.scrollHeight}px` : '0px';
    wrapper.style.opacity = isOpen ? '1' : '0';
  }, [isOpen]);

  return (
    <div style={{ borderBottom: '1px solid var(--border, #374151)' }}>
      {/* Header row */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{
          background: isLatest ? '#1d4ed8' : '#1f2937',
          color: isLatest ? '#bfdbfe' : '#6b7280',
          border: `1px solid ${isLatest ? '#2563eb' : '#374151'}`,
          fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
          letterSpacing: '0.04em', flexShrink: 0,
        }}>
          v{entry.version}
        </span>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text, #e5e7eb)', flex: 1 }}>{entry.title}</span>
        <span style={{ fontSize: 11, color: 'var(--text-dim, #6b7280)', flexShrink: 0 }}>{entry.date}</span>
        <span style={{
          fontSize: 10, color: 'var(--text-dim, #6b7280)', flexShrink: 0, marginLeft: 4,
          display: 'inline-block',
          transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 0.16s ease',
        }}>▼</span>
      </button>

      {/* Collapsible wrapper: animation driven via DOM ref only, no React style for animated props */}
      <div ref={wrapperRef} style={{ overflow: 'hidden' }}>
        <div ref={innerRef} style={{ paddingBottom: 24 }}>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {entry.changes.map((c, j) => (
              <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
                <span style={{
                  ...TYPE_STYLE[c.type],
                  fontSize: 10, fontWeight: 700, padding: '2px 0', borderRadius: 3,
                  whiteSpace: 'nowrap', flexShrink: 0, marginTop: 1,
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                  width: 52, textAlign: 'center', display: 'inline-block',
                  lineHeight: 1,
                }}>
                  {TYPE_LABEL[c.type]}
                </span>
                <span style={{ color: 'var(--text-dim, #d1d5db)', lineHeight: 1.5 }}>{c.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function ChangelogModal({ onClose }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set([CHANGELOG[0].version]));

  const toggle = (version: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version); else next.add(version);
      return next;
    });

  return (
    <div className="encounter-dialog-overlay" onClick={onClose}>
      <div
        className="encounter-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 className="encounter-dialog-title" style={{ margin: 0 }}>What's New</h2>
            <span style={{ fontSize: 12, color: 'var(--text-dim, #6b7280)' }}>v{CURRENT_VERSION}</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim, #9ca3af)', fontSize: 20, lineHeight: 1, padding: '2px 6px' }}
            title="Close"
          >×</button>
        </div>

        {/* Accordion */}
        <div style={{ overflowY: 'auto', overflowX: 'hidden', flex: 1, minHeight: 0 }}>
          {CHANGELOG.map((entry) => (
            <AccordionItem
              key={entry.version}
              entry={entry}
              isOpen={expanded.has(entry.version)}
              isLatest={entry.version === CHANGELOG[0].version}
              onToggle={() => toggle(entry.version)}
            />
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border, #374151)', paddingTop: 14 }}>
          <p style={{ margin: '0 0 10px', fontSize: 11, color: 'var(--text-dim, #6b7280)', lineHeight: 1.5 }}>
            This tool is a fan project and is not affiliated with Square Enix or FINAL FANTASY XIV.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="encounter-dialog-confirm" onClick={onClose} style={{ background: '#1d4ed8' }}>
              Got it!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
