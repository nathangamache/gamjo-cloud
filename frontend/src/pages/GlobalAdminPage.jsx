import { useState, useEffect, useRef } from 'react';
import { Edit, Trash, Camera, Check, Plus, ChevronRight, X } from '../components/Icons';
import { Sheet, Toast, useConfirm } from '../components/Shared';
import { api } from '../utils/api';
import { Avatar, useApp } from '../App';

export default function GlobalAdminPage() {
  const { isDesktop } = useApp();
  const [users, setUsers] = useState([]);
  const [showEdit, setShowEdit] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '' });
  const [toast, setToast] = useState(null);
  const photoRef = useRef(null);
  const showToast = (msg, type = 'info') => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };
  const confirm = useConfirm();

  const fetchUsers = async () => {
    try {
      const r = await api.get('/api/global-admin/users');
      setUsers(Array.isArray(r.data) ? r.data : []);
    } catch {}
  };

  useEffect(() => { fetchUsers(); }, []);

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
  });

  const openEdit = (u) => {
    setShowEdit(u);
    setEditForm({ name: u.name || '', email: u.email || '' });
  };

  const handleSave = async () => {
    if (!showEdit) return;
    try {
      await api.put(`/api/global-admin/users/${showEdit.id}`, editForm);
      await fetchUsers();
      setShowEdit(null);
      showToast('Updated', 'success');
    } catch (e) {
      showToast(e.message || 'Failed to update', 'error');
    }
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !showEdit) return;
    const fd = new FormData(); fd.append('file', file);
    try {
      await api.upload(`/api/global-admin/users/${showEdit.id}/photo`, fd);
      await fetchUsers();
      showToast('Photo updated', 'success');
    } catch { showToast('Failed', 'error'); }
    if (photoRef.current) photoRef.current.value = '';
  };

  const handleDelete = async (u) => {
    if (!await confirm({ title: 'Delete user?', message: `Delete ${u.name || u.email}? This removes them from all vacations permanently.`, confirmText: 'Delete user', danger: true })) return;
    try {
      await api.delete(`/api/global-admin/users/${u.id}`);
      await fetchUsers();
      showToast('User deleted', 'success');
    } catch { showToast('Failed to delete', 'error'); }
  };

  const handleCreate = async () => {
    if (!createForm.email.includes('@')) return;
    try {
      // Use the invite endpoint on a trip? No - just create the user directly
      // For now, create via the first trip the admin has
      showToast('User accounts are created when they are invited to a vacation', 'info');
      setShowCreate(false);
    } catch {}
  };

  return (
    <div style={{ background: 'var(--bg)' }}>
      {!isDesktop && (
        <div className="topbar">
          <span className="topbar-title">People</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{users.length} accounts</span>
        </div>
      )}
      {isDesktop && (
        <div className="desk-header">
          <div className="desk-header-title">People</div>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{users.length} accounts across all vacations</span>
        </div>
      )}

      <div style={{ padding: isDesktop ? '24px 32px' : '0 20px' }}>
        <input className="form-input" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 16 }} />

        {isDesktop ? (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead><tr><th>Person</th><th>Email</th><th>Vacations</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
              <tbody>{filtered.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar user={u} size="sm" />
                      <span style={{ fontWeight: 500 }}>{u.name || 'No name'}</span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{u.email}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {u.trips?.map(t => (
                        <span key={t.trip_id} style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--surface-alt)', fontSize: 13, color: 'var(--text-secondary)' }}>
                          {t.trip_name}
                        </span>
                      ))}
                      {(!u.trips || u.trips.length === 0) && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>No vacations</span>}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button onClick={() => openEdit(u)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}><Edit size={12} /> Edit</button>
                      <button onClick={() => handleDelete(u)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--danger-light)', background: 'var(--surface)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--danger)' }}><Trash size={12} /> Delete</button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
            {filtered.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>{search ? 'No matches' : 'No users yet'}</div>}
          </div>
        ) : (
          <>
            {filtered.map(u => (
              <div key={u.id} className="card mb-sm" onClick={() => openEdit(u)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <Avatar user={u} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{u.name || 'No name'}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{u.email}</div>
                  </div>
                  <ChevronRight size={16} color="var(--text-muted)" />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {u.trips?.map(t => (
                    <span key={t.trip_id} style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--surface-alt)', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {t.trip_name}
                    </span>
                  ))}
                  {(!u.trips || u.trips.length === 0) && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>No vacations</span>}
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>{search ? 'No matches' : 'No users yet'}</div>}
          </>
        )}
      </div>

      {/* Edit user sheet */}
      {showEdit && (
        <Sheet onClose={() => setShowEdit(null)} title={`Edit ${showEdit.name || 'User'}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, padding: '12px 16px', background: 'var(--surface-alt)', borderRadius: 'var(--radius)' }}>
            <div style={{ position: 'relative' }}>
              <Avatar user={showEdit} size="lg" />
              <button onClick={() => photoRef.current?.click()} style={{ position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: '50%', background: 'var(--primary)', border: '2px solid var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Camera size={10} color="#fff" />
              </button>
            </div>
            <div>
              <div style={{ fontWeight: 500, fontSize: 15 }}>{showEdit.name || 'No name'}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{showEdit.email}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                {showEdit.trips?.length || 0} vacation{showEdit.trips?.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />

          <div className="form-group">
            <label className="label">Name</label>
            <input className="form-input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="label">Email</label>
            <input className="form-input" type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
          </div>

          {/* Show which vacations this user belongs to */}
          {showEdit.trips?.length > 0 && (
            <div className="form-group">
              <label className="label">Vacations</label>
              {showEdit.trips.map(t => (
                <div key={t.trip_id} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{t.trip_name}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}><Check size={14} /> Save changes</button>
            <button className="btn btn-danger" style={{ flex: 0, width: 'auto', padding: '14px 16px' }} onClick={() => { handleDelete(showEdit); setShowEdit(null); }}><Trash size={16} /></button>
          </div>
        </Sheet>
      )}

      <Toast message={toast?.msg} type={toast?.type} />
    </div>
  );
}