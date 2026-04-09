import { useState } from 'react';
import { ChevronLeft, Image, Edit, Trash, X } from '../components/Icons';
import { Sheet, Toast, useConfirm, EmptyState } from '../components/Shared';
import { api } from '../utils/api';
import { formatDate, groupBy } from '../utils/helpers';
import { useApp } from '../App';

export default function GalleryPage({ trip, user, onBack, photos: propPhotos, setPhotos: propSetPhotos, refreshMedia }) {
  const { isDesktop, isAdmin, media: ctxMedia, setMedia: ctxSetMedia } = useApp();
  const photos = propPhotos || ctxMedia || [];
  const setPhotos = propSetPhotos || ctxSetMedia || (() => {});
  const [editingPhoto, setEditingPhoto] = useState(null);
  const [viewingPhoto, setViewingPhoto] = useState(null);
  const [editForm, setEditForm] = useState({ caption: '', date: '', location: '' });
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'info') => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };
  const confirm = useConfirm();

  const canEdit = (p) => isAdmin || p.uploaded_by === user?.id || p.user_id === user?.id;
  const grouped = groupBy(photos, p => p.date || 'Unknown');
  const colors = ['#5a8aaa', '#3D6E5A', '#B8845F', '#C4584A', '#1E3A5F', '#5B4A6F', '#4A6E80', '#8B6E4E'];

  const startEdit = (photo) => { if (!canEdit(photo)) return; setEditingPhoto(photo); setEditForm({ caption: photo.caption || '', date: photo.date || '', location: photo.location || '' }); };
  const saveEdit = async () => { if (!editingPhoto) return; try { await api.put(`/api/trips/${trip.id}/media/${editingPhoto.id}`, editForm); setPhotos(prev => prev.map(p => p.id === editingPhoto.id ? { ...p, ...editForm } : p)); setEditingPhoto(null); showToast('Saved', 'success'); } catch { showToast('Failed', 'error'); } };
  const handleDelete = async (id) => { if (!await confirm({ title: 'Delete this photo?', message: 'Gone forever. Probably for the best.', confirmText: 'Delete it', danger: true })) return; try { await api.delete(`/api/trips/${trip.id}/media/${id}`); setPhotos(prev => prev.filter(p => p.id !== id)); setEditingPhoto(null); setViewingPhoto(null); showToast('Deleted', 'success'); } catch { showToast('Failed', 'error'); } };

  const viewIdx = viewingPhoto ? photos.findIndex(p => p.id === viewingPhoto.id) : -1;
  const viewNext = () => { if (viewIdx < photos.length - 1) setViewingPhoto(photos[viewIdx + 1]); };
  const viewPrev = () => { if (viewIdx > 0) setViewingPhoto(photos[viewIdx - 1]); };

  return (
    <div style={{ background: 'var(--bg)' }}>
      {!isDesktop && <div className="topbar"><button className="topbar-back" onClick={onBack}><ChevronLeft size={16} /></button><span className="topbar-title">Gallery</span><span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{photos.length} photos</span></div>}
      {isDesktop && <div className="desk-header"><div className="desk-header-title">Gallery</div><span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{photos.length} photos</span></div>}

      <div style={{ padding: isDesktop ? '24px 32px' : '6px 4px' }}>
        {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, datePhotos]) => (
          <div key={date}>
            <div style={{ padding: '12px 16px 6px', fontSize: 13, fontWeight: 500, color: 'var(--warm)', fontFamily: 'var(--font-serif)', letterSpacing: '0.01em' }}>{formatDate(date)}</div>
            <div className="gallery-grid">
              {datePhotos.map((p, i) => (
                <div key={p.id} className="gallery-item" style={{ background: p.url ? undefined : colors[(p.id + i) % colors.length], cursor: p.url ? 'pointer' : undefined }} onClick={() => p.url && setViewingPhoto(p)}>
                  {p.url ? <img src={p.url} alt={p.caption || ''} /> : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.7)' }}>
                      <Image size={20} /><span style={{ fontSize: 13, marginTop: 4 }}>{p.caption?.slice(0, 12)}</span>
                    </div>
                  )}
                  {canEdit(p) && <button className="gallery-item-edit" onClick={e => { e.stopPropagation(); startEdit(p); }}><Edit size={12} /></button>}
                </div>
              ))}
            </div>
          </div>
        ))}
        {photos.length === 0 && <EmptyState type="photos" title="No pics yet" message="Someone snap a photo before we forget everything." />}
      </div>

      {editingPhoto && (
        <Sheet onClose={() => setEditingPhoto(null)} title="Edit photo details">
          <div className="form-group"><label className="label">Caption</label><input className="form-input" value={editForm.caption} onChange={e => setEditForm(f => ({ ...f, caption: e.target.value }))} placeholder="What's in this photo?" /></div>
          <div className="form-group"><label className="label">Date taken</label><input className="form-input" type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} /></div>
          <div className="form-group"><label className="label">Location</label><input className="form-input" value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. West Bay Beach" /></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveEdit}>Save changes</button>
            {canEdit(editingPhoto) && <button className="btn btn-danger" style={{ flex: 0, width: 'auto', padding: '14px 16px' }} onClick={() => handleDelete(editingPhoto.id)}><Trash size={16} /></button>}
          </div>
        </Sheet>
      )}

      {viewingPhoto && (
        <div className="sheet-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.92)' }} onClick={() => setViewingPhoto(null)}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button onClick={() => setViewingPhoto(null)} style={{ position: 'absolute', top: -12, right: -12, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}><X size={18} color="#fff" /></button>
            <img src={viewingPhoto.url} alt={viewingPhoto.caption} style={{ maxWidth: '92vw', maxHeight: '78vh', borderRadius: 8, objectFit: 'contain' }} />
            {viewIdx > 0 && <button onClick={viewPrev} style={{ position: 'absolute', top: '50%', left: -20, transform: 'translateY(-50%)', width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={20} color="#fff" /></button>}
            {viewIdx < photos.length - 1 && <button onClick={viewNext} style={{ position: 'absolute', top: '50%', right: -20, transform: 'translateY(-50%)', width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={20} color="#fff" /></button>}
            <div style={{ marginTop: 10, textAlign: 'center', color: '#fff' }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{viewingPhoto.caption || 'Untitled'}</div>
              <div style={{ fontSize: 13, opacity: .6, marginTop: 2 }}>{viewingPhoto.uploaded_by_name} {viewingPhoto.location ? `\u00b7 ${viewingPhoto.location}` : ''}</div>
            </div>
            {canEdit(viewingPhoto) && <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => { startEdit(viewingPhoto); setViewingPhoto(null); }} style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Edit size={12} /> Edit</button>
              <button onClick={() => handleDelete(viewingPhoto.id)} style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(200,70,70,.3)', border: 'none', color: '#ff8888', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Trash size={12} /> Delete</button>
            </div>}
          </div>
        </div>
      )}

      <Toast message={toast?.msg} type={toast?.type} />
    </div>
  );
}