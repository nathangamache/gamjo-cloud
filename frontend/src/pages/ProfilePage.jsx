import { useState, useRef, useMemo } from 'react';
import { ChevronRight, Camera, LogOut, Check, Dollar, ThumbUp, Image } from '../components/Icons';
import { Sheet, Toast, SkeletonProfile } from '../components/Shared';
import { Avatar, useApp } from '../App';
import { api } from '../utils/api';
import { formatMoney, msg } from '../utils/helpers';

export default function ProfilePage({ user, trip, members, groups: propGroups, onLogout }) {
  const { isAdmin, isDesktop, groups: ctxGroups, setUser, expenses: ctxExpenses, itinerary: ctxItinerary, media: ctxMedia, dataLoaded, theme, toggleTheme, reduceMotion, toggleReduceMotion } = useApp();
  const groups = propGroups || ctxGroups || [];
  const expenses = ctxExpenses || [];
  const itinerary = ctxItinerary || [];
  const media = ctxMedia || [];
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ name: user?.name || '', email: user?.email || '' });
  const [toast, setToast] = useState(null);
  const fileRef = useRef(null);

  const showToast = (text, type = 'info') => { setToast({ msg: text, type }); setTimeout(() => setToast(null), 2500); };

  // #20: Find user's group from the groups array
  const myGroup = groups.find(g => g.members?.some(m => m.user_id === user?.id));

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    try {
      const res = await api.upload('/api/auth/me/photo', fd);
      const data = res.data;
      if (data && setUser) {
        setUser(prev => ({ ...prev, avatar_url: data.avatar_url }));
      }
      showToast('Photo updated!', 'success');
    } catch {
      showToast('Failed to upload photo', 'error');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSaveProfile = async () => {
    try {
      const res = await api.put('/api/auth/me', { name: editForm.name });
      // C7: Update user in context so sidebar/greeting refresh immediately
      if (res.data && setUser) setUser(res.data);
      showToast(msg('toasts.profileUpdated', {}, true), 'success');
      setShowEdit(false);
    } catch {
      showToast('Could not save changes', 'error');
      setShowEdit(false);
    }
  };

  if (!dataLoaded) return <div className="page-profile"><SkeletonProfile /></div>;

  return (
    <div className="page-profile">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px 20px' }}>
        <div className="avatar-upload" onClick={() => fileRef.current?.click()} style={{ cursor: 'pointer' }}>
          <Avatar user={user} size="xl" />
          <button className="avatar-upload-btn" onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}><Camera size={10} /></button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
        <div style={{ fontSize: 18, fontWeight: 600, marginTop: 10 }}>{user?.name}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{user?.email}</div>
      </div>

      <div style={{ padding: '0 20px' }}>
        {/* Per-vacation stats */}
        {trip && (
          <>
            <div className="heading-serif md mb-sm">My trip stats</div>
            <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr 1fr 1fr' : '1fr 1fr', gap: 8, marginBottom: 16, alignItems: 'stretch' }}>
              {[
                { icon: <Dollar size={16} color="var(--warm)" />, value: formatMoney(expenses.filter(e => e.paid_by === user?.id).reduce((s, e) => s + (e.amount || 0), 0)), label: "I've paid" },
                { icon: <Dollar size={16} color="var(--primary)" />, value: expenses.filter(e => e.paid_by === user?.id).length, label: 'my expenses' },
                { icon: <ThumbUp size={16} color="var(--sage)" />, value: itinerary.filter(i => i.user_vote === 'like' || (i.votes && i.votes[user?.id])).length, label: 'votes cast' },
                { icon: <Image size={16} color="var(--primary)" />, value: media.filter(p => p.uploaded_by === user?.id || p.user_id === user?.id).length, label: 'photos shared' },
              ].map((s, i) => (
                <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', margin: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 400, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {trip && myGroup && (
          <>
            <div className="heading-serif md mb-sm">My group</div>
            <div className="card mb-lg">
              <div style={{ fontWeight: 500, fontSize: 15 }}>{myGroup.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2, marginBottom: 12 }}>{Number(myGroup.percentage || 0).toFixed(2)}% of shared expenses</div>
              {[...(myGroup.members || [])].sort((a, b) => {
                const nameA = (members.find(x => x.id === a.user_id || x.user_id === a.user_id)?.name || '').toLowerCase();
                const nameB = (members.find(x => x.id === b.user_id || x.user_id === b.user_id)?.name || '').toLowerCase();
                return nameA.localeCompare(nameB);
              }).map((m) => {
                const member = members.find(x => x.id === m.user_id || x.user_id === m.user_id);
                if (!member) return null;
                return (
                  <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                    <Avatar user={member} size="sm" />
                    <div style={{ flex: 1, fontSize: 13 }}>{member.name}</div>
                    {m.is_payer && <span style={{ fontSize: 13, padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--sage-light)', color: 'var(--sage)', fontWeight: 500 }}>Payer</span>}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="card mb-lg" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => { setEditForm({ name: user?.name || '', email: user?.email || '' }); setShowEdit(true); }}>
          <span style={{ fontSize: 14 }}>Edit profile</span><ChevronRight size={15} color="var(--text-muted)" />
        </div>

        <div className="card mb-lg" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14 }}>Dark mode</span>
          <button onClick={toggleTheme} style={{
            width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', padding: 2,
            background: theme === 'dark' ? 'var(--primary)' : 'var(--border)',
            transition: 'background 0.2s', position: 'relative',
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', background: '#fff',
              transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
              transform: theme === 'dark' ? 'translateX(20px)' : 'translateX(0)',
            }} />
          </button>
        </div>

        <div className="card mb-lg" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 14 }}>Reduce motion</span>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Turn off animations</div>
          </div>
          <button onClick={toggleReduceMotion} style={{
            width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', padding: 2,
            background: reduceMotion ? 'var(--primary)' : 'var(--border)',
            transition: 'background 0.2s', position: 'relative',
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', background: '#fff',
              transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
              transform: reduceMotion ? 'translateX(20px)' : 'translateX(0)',
            }} />
          </button>
        </div>

        <button className="btn btn-danger" style={{ marginBottom: 40 }} onClick={onLogout}><LogOut size={16} /> Sign out</button>
      </div>

      {showEdit && (
        <Sheet onClose={() => setShowEdit(false)} title="Edit profile">
          <div className="form-group"><label className="label">Name</label><input className="form-input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Your name" /></div>
          <div className="form-group"><label className="label">Email</label><input className="form-input" type="email" value={editForm.email} disabled style={{ opacity: 0.6 }} /><div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Email can only be changed by an admin</div></div>
          <div className="form-group"><label className="label">Profile photo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
              <Avatar user={user} size="lg" />
              <div style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 500 }}>Tap to change photo</div>
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleSaveProfile}><Check size={15} /> Save changes</button>
        </Sheet>
      )}

      <Toast message={toast?.msg} type={toast?.type} />
    </div>
  );
}