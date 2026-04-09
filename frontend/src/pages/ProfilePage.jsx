import { useState, useRef, useMemo } from 'react';
import { ChevronRight, Camera, LogOut, Check, Dollar, ThumbUp, Image } from '../components/Icons';
import { Sheet, Toast, WaveDivider } from '../components/Shared';
import { Avatar, useApp } from '../App';
import { api } from '../utils/api';
import { formatMoney } from '../utils/helpers';

export default function ProfilePage({ user, trip, members, groups: propGroups, onLogout }) {
  const { isAdmin, groups: ctxGroups, setUser, expenses: ctxExpenses, itinerary: ctxItinerary, media: ctxMedia } = useApp();
  const groups = propGroups || ctxGroups || [];
  const expenses = ctxExpenses || [];
  const itinerary = ctxItinerary || [];
  const media = ctxMedia || [];
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ name: user?.name || '', email: user?.email || '' });
  const [toast, setToast] = useState(null);
  const fileRef = useRef(null);

  const showToast = (msg, type = 'info') => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };

  // #20: Find user's group from the groups array
  const myGroup = groups.find(g => g.members?.some(m => m.user_id === user?.id));

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    try {
      await api.upload('/api/auth/me/photo', fd);
      showToast('Photo updated. Reload to see changes.', 'success');
    } catch {
      showToast('Profile photo upload is not available yet', 'error');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSaveProfile = async () => {
    try {
      const res = await api.put('/api/auth/me', { name: editForm.name });
      // C7: Update user in context so sidebar/greeting refresh immediately
      if (res.data && setUser) setUser(res.data);
      showToast('Profile updated', 'success');
      setShowEdit(false);
    } catch {
      showToast('Could not save changes', 'error');
      setShowEdit(false);
    }
  };

  return (
    <div style={{ background: 'var(--bg)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px 20px' }}>
        <div className="avatar-upload">
          <Avatar user={user} size="xl" />
          <button className="avatar-upload-btn" onClick={() => fileRef.current?.click()}><Camera size={10} /></button>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              <div className="card" style={{ textAlign: 'center', padding: '14px 12px' }}>
                <Dollar size={18} color="var(--warm)" />
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 400, color: 'var(--warm)', marginTop: 4 }}>
                  {formatMoney(expenses.filter(e => e.paid_by === user?.id).reduce((s, e) => s + (e.amount || 0), 0))}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>I've paid</div>
              </div>
              <div className="card" style={{ textAlign: 'center', padding: '14px 12px' }}>
                <Dollar size={18} color="var(--primary)" />
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 400, color: 'var(--primary)', marginTop: 4 }}>
                  {expenses.filter(e => e.paid_by === user?.id).length}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>my expenses</div>
              </div>
              <div className="card" style={{ textAlign: 'center', padding: '14px 12px' }}>
                <ThumbUp size={18} color="var(--sage)" />
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 400, color: 'var(--sage)', marginTop: 4 }}>
                  {itinerary.filter(i => i.user_vote === 'like' || (i.votes && i.votes[user?.id])).length}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>votes cast</div>
              </div>
              <div className="card" style={{ textAlign: 'center', padding: '14px 12px' }}>
                <Image size={18} color="var(--primary)" />
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 400, color: 'var(--primary)', marginTop: 4 }}>
                  {media.filter(p => p.uploaded_by === user?.id || p.user_id === user?.id).length}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>photos shared</div>
              </div>
            </div>
            <WaveDivider />
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

        <button className="btn btn-danger" onClick={onLogout}><LogOut size={16} /> Sign out</button>
      </div>

      {showEdit && (
        <Sheet onClose={() => setShowEdit(false)} title="Edit profile">
          <div className="form-group"><label className="label">Name</label><input className="form-input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Your name" /></div>
          <div className="form-group"><label className="label">Email</label><input className="form-input" type="email" value={editForm.email} disabled style={{ opacity: 0.6 }} /><div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Email can only be changed by an admin</div></div>
          <div className="form-group"><label className="label">Profile photo</label><div className="upload-zone" style={{ cursor: 'pointer' }} onClick={() => fileRef.current?.click()}><Camera size={20} color="var(--text-muted)" /><div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Tap to change your photo</div></div></div>
          <button className="btn btn-primary" onClick={handleSaveProfile}><Check size={15} /> Save changes</button>
        </Sheet>
      )}

      <Toast message={toast?.msg} type={toast?.type} />
    </div>
  );
}