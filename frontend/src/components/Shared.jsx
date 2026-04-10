import { useEffect, useCallback, useState, createContext, useContext, useRef } from 'react';
import { X, Check, Trash } from './Icons';

export function Sheet({ onClose, title, children }) {
  const handleEsc = useCallback((e) => { if (e.key === 'Escape') onClose(); }, [onClose]);
  useEffect(() => {
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handleEsc); document.body.style.overflow = ''; };
  }, [handleEsc]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" onClick={onClose} style={{ cursor: 'pointer' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          {title && <div className="sheet-title" style={{ marginBottom: 0 }}>{title}</div>}
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'var(--surface-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginLeft: 'auto' }} aria-label="Close">
            <X size={16} color="var(--text-secondary)" />
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// Loading button - shows spinner and disables during async action
export function LoadingButton({ onClick, loading, disabled, children, className = 'btn btn-primary', style, ...props }) {
  return (
    <button
      className={className}
      style={{ ...style, opacity: loading || disabled ? 0.7 : 1, pointerEvents: loading || disabled ? 'none' : 'auto' }}
      onClick={onClick}
      disabled={loading || disabled}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Working...</>
      ) : children}
    </button>
  );
}

export function Loading({ text = 'Loading...' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, color: 'var(--text-secondary)' }}>
      <div className="spinner" />
      <div style={{ fontSize: 14, marginTop: 12 }}>{text}</div>
    </div>
  );
}

export function Toast({ message, type = 'info' }) {
  if (!message) return null;
  const bg = type === 'error' ? 'var(--danger)' : type === 'success' ? 'var(--sage)' : 'var(--text)';
  return <div className="toast" style={{ background: bg }}>{message}</div>;
}

// ── Global Confirm Dialog System ──
const ConfirmContext = createContext(null);
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback((opts) => {
    const options = typeof opts === 'string' ? { message: opts } : opts;
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialog(options);
    });
  }, []);

  const handleConfirm = () => { resolveRef.current?.(true); setDialog(null); };
  const handleCancel = () => { resolveRef.current?.(false); setDialog(null); };

  useEffect(() => {
    if (!dialog) return;
    const h = (e) => { if (e.key === 'Escape') handleCancel(); if (e.key === 'Enter') handleConfirm(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [dialog]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} onClick={handleCancel}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--surface)', borderRadius: 16, padding: '28px 24px 20px',
            maxWidth: 360, width: 'calc(100% - 48px)',
            boxShadow: '0 20px 60px rgba(0,0,0,.2), 0 2px 12px rgba(0,0,0,.1)',
            animation: 'confirmIn .15s ease-out',
          }}>
            {dialog.title && (
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500, marginBottom: 10, color: dialog.danger ? 'var(--danger)' : 'var(--text)' }}>
                {dialog.title}
              </div>
            )}
            <div style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 24 }}>
              {dialog.message}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={handleCancel} style={{
                padding: '12px 20px', borderRadius: 10, border: '0.5px solid var(--border)',
                background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 15,
                fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}>
                {dialog.cancelText || 'Cancel'}
              </button>
              <button onClick={handleConfirm} style={{
                padding: '12px 20px', borderRadius: 10, border: 'none',
                background: dialog.danger ? 'var(--danger)' : 'var(--primary)',
                color: '#fff', fontSize: 15, fontWeight: 500, cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}>
                {dialog.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

// ── Warm Empty State Illustrations ──
const illustrations = {
  photos: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="18" width="56" height="44" rx="6" stroke="#B8845F" strokeWidth="2" fill="none" />
      <circle cx="30" cy="35" r="6" stroke="#B8845F" strokeWidth="1.5" fill="#F3ECE4" />
      <path d="M12 52 L30 38 L42 48 L52 40 L68 52" stroke="#3D6E5A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M56 22 L60 18 L64 22" stroke="#B8845F" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  ),
  expenses: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="20" width="48" height="40" rx="4" stroke="#B8845F" strokeWidth="2" fill="none" />
      <line x1="16" y1="32" x2="64" y2="32" stroke="#B8845F" strokeWidth="1.5" />
      <circle cx="40" cy="46" r="8" stroke="#3D6E5A" strokeWidth="1.5" fill="#E4EDE8" />
      <text x="40" y="50" textAnchor="middle" fontSize="10" fontWeight="600" fill="#3D6E5A">$</text>
    </svg>
  ),
  itinerary: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="18" y="14" width="44" height="52" rx="4" stroke="#B8845F" strokeWidth="2" fill="none" />
      <line x1="28" y1="14" x2="28" y2="10" stroke="#B8845F" strokeWidth="2" strokeLinecap="round" />
      <line x1="52" y1="14" x2="52" y2="10" stroke="#B8845F" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="26" x2="62" y2="26" stroke="#B8845F" strokeWidth="1.5" />
      <circle cx="32" cy="38" r="3" fill="#3D6E5A" />
      <line x1="38" y1="38" x2="54" y2="38" stroke="#E8E2D8" strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="48" r="3" fill="#E8E2D8" />
      <line x1="38" y1="48" x2="50" y2="48" stroke="#E8E2D8" strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="58" r="3" fill="#E8E2D8" />
      <line x1="38" y1="58" x2="48" y2="58" stroke="#E8E2D8" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  vacations: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="28" width="40" height="28" rx="4" stroke="#B8845F" strokeWidth="2" fill="none" />
      <path d="M30 28 V22 H50 V28" stroke="#B8845F" strokeWidth="2" fill="none" strokeLinejoin="round" />
      <line x1="20" y1="38" x2="60" y2="38" stroke="#B8845F" strokeWidth="1.5" />
      <circle cx="40" cy="38" r="4" fill="#3D6E5A" />
      <path d="M24 64 C28 58, 36 54, 40 54 C44 54, 52 58, 56 64" stroke="#3D6E5A" strokeWidth="1.5" fill="#E4EDE8" strokeLinecap="round" />
    </svg>
  ),
};

// Decorative wave SVG
export function WaveDivider() {
  return (
    <svg width="100%" height="16" viewBox="0 0 400 16" fill="none" preserveAspectRatio="none" style={{ display: 'block', margin: '8px 0', opacity: 0.5 }}>
      <path d="M0 8 Q25 3 50 8 Q75 13 100 8 Q125 3 150 8 Q175 13 200 8 Q225 3 250 8 Q275 13 300 8 Q325 3 350 8 Q375 13 400 8" stroke="#E8E2D8" strokeWidth="1" fill="none"/>
    </svg>
  );
}

// Lake scene decoration for empty states
function LakeDecor() {
  return (
    <svg width="200" height="36" viewBox="0 0 200 36" fill="none" style={{ display: 'block', margin: '16px auto 0', opacity: 0.6 }}>
      <path d="M0 24 Q16 18 32 24 Q48 30 64 24 Q80 18 96 24 Q112 30 128 24 Q144 18 160 24 Q176 30 192 24 L200 24" stroke="#1E3A5F" strokeWidth="1.2" fill="none" opacity=".5"/>
      <path d="M10 28 Q30 22 50 28 Q70 34 90 28 Q110 22 130 28 Q150 34 170 28 Q190 22 200 28" stroke="#3D6E5A" strokeWidth="1" fill="none" opacity=".35"/>
      <path d="M90 14L100 6L110 14Z" fill="#B8845F" opacity=".3"/>
      <path d="M85 16L115 16L112 22L88 22Z" fill="#1E3A5F" opacity=".25"/>
    </svg>
  );
}

export function EmptyState({ type = 'photos', title, message, action, onAction }) {
  return (
    <div style={{ textAlign: 'center', padding: '36px 20px' }}>
      <div style={{ marginBottom: 16, opacity: 0.9 }}>{illustrations[type] || illustrations.photos}</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>{title}</div>
      {message && <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: action ? 16 : 0 }}>{message}</div>}
      {action && onAction && <button className="btn btn-primary" style={{ maxWidth: 220, margin: '0 auto' }} onClick={onAction}>{action}</button>}
      <LakeDecor />
    </div>
  );
}

// ── Skeleton Loaders ──
function SkeletonLine({ width = '100%', height = 14, style }) {
  return <div className="skeleton" style={{ width, height, borderRadius: 6, ...style }} />;
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="skeleton-card">
      <SkeletonLine width="65%" height={16} style={{ marginBottom: 10 }} />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <SkeletonLine key={i} width={i === 0 ? '90%' : '40%'} height={12} style={{ marginBottom: 6 }} />
      ))}
    </div>
  );
}

export function SkeletonExpenseList({ count = 5 }) {
  return (
    <div className="card" style={{ padding: '0 16px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: i < count - 1 ? '1px solid var(--surface-alt)' : 'none' }}>
          <div className="skeleton skeleton-avatar" />
          <div style={{ flex: 1 }}>
            <SkeletonLine width="55%" height={14} style={{ marginBottom: 6 }} />
            <SkeletonLine width="35%" height={12} />
          </div>
          <SkeletonLine width={60} height={16} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonItinerary({ days = 3 }) {
  return (
    <>
      {Array.from({ length: days }).map((_, d) => (
        <div key={d} style={{ marginBottom: 20 }}>
          <SkeletonLine width={120} height={13} style={{ marginBottom: 10 }} />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="skeleton-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <SkeletonLine width="50%" height={15} />
                <SkeletonLine width={70} height={13} />
              </div>
              <SkeletonLine width="30%" height={12} />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

export function SkeletonPhotoGrid({ count = 6 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={{ aspectRatio: 1, borderRadius: 12 }} />
      ))}
    </div>
  );
}

export function SkeletonHome() {
  return (
    <div style={{ padding: '16px 20px' }}>
      <SkeletonLine width="60%" height={18} style={{ marginBottom: 6 }} />
      <SkeletonLine width="40%" height={13} style={{ marginBottom: 20 }} />
      <SkeletonLine width={130} height={16} style={{ marginBottom: 10 }} />
      <SkeletonCard lines={2} />
      <div style={{ marginTop: 16 }}>
        <SkeletonLine width={100} height={16} style={{ marginBottom: 10 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="skeleton" style={{ flex: 1, height: 70, borderRadius: 'var(--radius)' }} />
          <div className="skeleton" style={{ flex: 1, height: 70, borderRadius: 'var(--radius)' }} />
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <SkeletonLine width={90} height={16} style={{ marginBottom: 10 }} />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 56 }}>
              <div className="skeleton skeleton-avatar" style={{ width: 36, height: 36 }} />
              <SkeletonLine width={40} height={12} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SkeletonVacationList({ count = 3 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ marginBottom: 12, borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div className="skeleton" style={{ height: 140, borderRadius: 0 }} />
          <div style={{ padding: '12px 16px', background: 'var(--surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SkeletonLine width={90} height={13} />
            <SkeletonLine width={70} height={24} style={{ borderRadius: 12 }} />
          </div>
        </div>
      ))}
    </>
  );
}

export function SkeletonProfile() {
  return (
    <div style={{ padding: '24px 20px' }}>
      {/* Avatar area */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
        <div className="skeleton" style={{ width: 72, height: 72, borderRadius: '50%' }} />
        <SkeletonLine width={120} height={16} style={{ marginTop: 12 }} />
        <SkeletonLine width={160} height={12} style={{ marginTop: 6 }} />
      </div>
      {/* Trip stats */}
      <SkeletonLine width={100} height={16} style={{ marginBottom: 10 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 10 }} />
            <div>
              <SkeletonLine width={60} height={16} style={{ marginBottom: 4 }} />
              <SkeletonLine width={50} height={11} />
            </div>
          </div>
        ))}
      </div>
      {/* Group section */}
      <SkeletonLine width={80} height={16} style={{ marginBottom: 10 }} />
      <div className="skeleton-card">
        <SkeletonLine width="50%" height={14} style={{ marginBottom: 8 }} />
        <SkeletonLine width="35%" height={12} style={{ marginBottom: 14 }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
            <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%' }} />
            <SkeletonLine width={90} height={12} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonAdmin() {
  return (
    <div style={{ padding: '16px 20px' }}>
      {/* Section heading */}
      <SkeletonLine width={80} height={16} style={{ marginBottom: 12 }} />
      {/* Member list */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--surface-alt)' }}>
          <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%' }} />
          <div style={{ flex: 1 }}>
            <SkeletonLine width="45%" height={14} style={{ marginBottom: 4 }} />
            <SkeletonLine width="60%" height={11} />
          </div>
          <SkeletonLine width={60} height={24} style={{ borderRadius: 12 }} />
        </div>
      ))}
      {/* Groups section */}
      <SkeletonLine width={110} height={16} style={{ marginTop: 24, marginBottom: 12 }} />
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="skeleton-card" style={{ marginBottom: 8 }}>
          <SkeletonLine width="40%" height={14} style={{ marginBottom: 6 }} />
          <SkeletonLine width="25%" height={12} />
        </div>
      ))}
      {/* Trip settings */}
      <SkeletonLine width={100} height={16} style={{ marginTop: 24, marginBottom: 12 }} />
      <div className="skeleton-card">
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <SkeletonLine width="48%" height={38} style={{ borderRadius: 10 }} />
          <SkeletonLine width="48%" height={38} style={{ borderRadius: 10 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <SkeletonLine width="48%" height={38} style={{ borderRadius: 10 }} />
          <SkeletonLine width="48%" height={38} style={{ borderRadius: 10 }} />
        </div>
      </div>
    </div>
  );
}