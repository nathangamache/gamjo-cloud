import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Image, Edit, Trash, X, Check } from '../components/Icons';
import { Sheet, Toast, useConfirm, EmptyState, SkeletonPhotoGrid } from '../components/Shared';
import { api } from '../utils/api';
import { formatDate, groupBy } from '../utils/helpers';
import { useApp } from '../App';

export default function GalleryPage({ trip, user, onBack, photos: propPhotos, setPhotos: propSetPhotos, refreshMedia }) {
  const { isDesktop, isAdmin, media: ctxMedia, setMedia: ctxSetMedia } = useApp();
  const photos = propPhotos || ctxMedia || [];
  const setPhotos = propSetPhotos || ctxSetMedia || (() => {});
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  const [editingPhoto, setEditingPhoto] = useState(null);
  const [viewingPhoto, setViewingPhoto] = useState(null);
  const [editForm, setEditForm] = useState({ caption: '', date: '', location: '' });
  const [toast, setToast] = useState(null);
  const showToast = (text, type = 'info') => { setToast({ msg: text, type }); setTimeout(() => setToast(null), 2500); };
  const touchStart = useRef(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const confirm = useConfirm();

  const canEdit = (p) => isAdmin || p.uploaded_by === user?.id || p.user_id === user?.id;
  const grouped = groupBy(photos, p => p.date || 'Unknown');
  const colors = ['#5a8aaa', '#3D6E5A', '#B8845F', '#C4584A', '#1E3A5F', '#5B4A6F', '#4A6E80', '#8B6E4E'];

  const startEdit = (photo) => { if (!canEdit(photo)) return; setEditingPhoto(photo); setEditForm({ caption: photo.caption || '', date: photo.date || '', location: photo.location || '' }); };
  const saveEdit = async () => { if (!editingPhoto) return; try { await api.put(`/api/trips/${trip.id}/media/${editingPhoto.id}`, editForm); setPhotos(prev => prev.map(p => p.id === editingPhoto.id ? { ...p, ...editForm } : p)); setEditingPhoto(null); showToast('Saved', 'success'); } catch { showToast('Failed', 'error'); } };
  const handleDelete = async (id) => { if (!await confirm({ title: 'Delete this photo?', message: 'Gone forever. Probably for the best.', confirmText: 'Delete it', danger: true })) return; try { await api.delete(`/api/trips/${trip.id}/media/${id}`); setPhotos(prev => prev.filter(p => p.id !== id)); setEditingPhoto(null); setViewingPhoto(null); showToast('Deleted', 'success'); } catch { showToast('Failed', 'error'); } };

  const toggleSelect = (id) => setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!await confirm({ title: `Delete ${selected.size} photo${selected.size !== 1 ? 's' : ''}?`, message: 'This cannot be undone.', confirmText: 'Delete all', danger: true })) return;
    let deleted = 0;
    for (const id of selected) {
      try { await api.delete(`/api/trips/${trip.id}/media/${id}`); deleted++; } catch {}
    }
    if (refreshMedia) await refreshMedia();
    setSelected(new Set()); setSelectMode(false);
    showToast(`Deleted ${deleted} photo${deleted !== 1 ? 's' : ''}`, 'success');
  };

  const viewIdx = viewingPhoto ? photos.findIndex(p => p.id === viewingPhoto.id) : -1;
  const viewNext = () => { if (viewIdx < photos.length - 1) setViewingPhoto(photos[viewIdx + 1]); };
  const viewPrev = () => { if (viewIdx > 0) setViewingPhoto(photos[viewIdx - 1]); };

  return (
    <div style={{ background: 'var(--bg)' }}>
      {!isDesktop && <div className="topbar"><button className="topbar-back" onClick={onBack}><ChevronLeft size={16} /></button><span className="topbar-title">Gallery</span><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><button onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }} style={{ background: 'none', border: 'none', fontSize: 13, color: selectMode ? 'var(--danger)' : 'var(--primary)', cursor: 'pointer', fontWeight: 500 }}>{selectMode ? 'Cancel' : 'Select'}</button><span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{photos.length}</span></div></div>}
      {isDesktop && <div className="desk-header"><div className="desk-header-title">Gallery</div><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><button onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }} style={{ background: 'none', border: 'none', fontSize: 13, color: selectMode ? 'var(--danger)' : 'var(--primary)', cursor: 'pointer', fontWeight: 500 }}>{selectMode ? 'Cancel' : 'Select'}</button><span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{photos.length} photos</span></div></div>}

      <div style={{ padding: isDesktop ? '24px 32px' : '12px 12px' }}>
        {!ready && photos.length > 0 && <SkeletonPhotoGrid count={9} />}
        {ready && Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, datePhotos]) => (
          <div key={date}>
            <div style={{ padding: '12px 16px 6px', fontSize: 13, fontWeight: 500, color: 'var(--warm)', fontFamily: 'var(--font-serif)', letterSpacing: '0.01em' }}>{date === 'Unknown' ? 'No date' : formatDate(date)}</div>
            <div className="gallery-grid">
              {datePhotos.map((p, i) => (
                <div key={p.id} className="gallery-item" style={{ background: p.url ? undefined : colors[(p.id + i) % colors.length], cursor: 'pointer', outline: selected.has(p.id) ? '3px solid var(--primary)' : 'none', outlineOffset: -3 }}
                  onClick={() => selectMode ? toggleSelect(p.id) : p.url && setViewingPhoto(p)}>
                  {p.url ? <img src={p.url} alt={p.caption || ''} /> : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.7)' }}>
                      <Image size={20} /><span style={{ fontSize: 13, marginTop: 4 }}>{p.caption?.slice(0, 12)}</span>
                    </div>
                  )}
                  {selectMode && (
                    <div style={{ position: 'absolute', top: 6, left: 6, width: 24, height: 24, borderRadius: '50%', border: '2px solid #fff', background: selected.has(p.id) ? 'var(--primary)' : 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }}>
                      {selected.has(p.id) && <Check size={14} color="#fff" />}
                    </div>
                  )}
                  {!selectMode && canEdit(p) && (
                    <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4 }}>
                      <button className="gallery-item-edit" style={{ position: 'static' }} onClick={e => { e.stopPropagation(); startEdit(p); }}><Edit size={12} /></button>
                      <button className="gallery-item-edit" style={{ position: 'static', background: 'rgba(200,60,60,.5)' }} onClick={e => { e.stopPropagation(); handleDelete(p.id); }}><Trash size={12} /></button>
                    </div>
                  )}
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

      {viewingPhoto && createPortal(
        <div className="photo-lightbox" onClick={() => setViewingPhoto(null)}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: 800, padding: '0 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button onClick={() => setViewingPhoto(null)} style={{ position: 'fixed', top: 'calc(16px + env(safe-area-inset-top, 0px))', right: 16, width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,.2)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 310 }}><X size={22} color="#fff" /></button>
            <img src={viewingPhoto.url} alt={viewingPhoto.caption || ''} style={{ maxWidth: '92vw', maxHeight: '75vh', borderRadius: 8, objectFit: 'contain', touchAction: 'pan-y' }}
              onTouchStart={e => { touchStart.current = e.touches[0].clientX; }}
              onTouchEnd={e => { if (touchStart.current === null) return; const diff = e.changedTouches[0].clientX - touchStart.current; touchStart.current = null; if (Math.abs(diff) < 50) return; if (diff < 0) viewNext(); else viewPrev(); }}
              onError={e => { e.target.style.display = 'none'; }}
            />
            {viewIdx > 0 && <button onClick={viewPrev} style={{ position: 'fixed', top: '50%', left: 8, transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,.2)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 310 }}><ChevronLeft size={22} color="#fff" /></button>}
            {viewIdx < photos.length - 1 && <button onClick={viewNext} style={{ position: 'fixed', top: '50%', right: 8, transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,.2)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 310 }}><ChevronRight size={22} color="#fff" /></button>}
            <div style={{ marginTop: 12, textAlign: 'center', color: '#fff' }}>
              <div style={{ fontSize: 15, fontWeight: 500 }}>{viewingPhoto.caption || 'Untitled'}</div>
              <div style={{ fontSize: 13, opacity: .6, marginTop: 4 }}>{viewingPhoto.uploaded_by_name} {viewingPhoto.location ? `\u00b7 ${viewingPhoto.location}` : ''}</div>
            </div>
            {canEdit(viewingPhoto) && <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => { startEdit(viewingPhoto); setViewingPhoto(null); }} style={{ padding: '10px 18px', borderRadius: 10, background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}><Edit size={14} /> Edit</button>
              <button onClick={() => handleDelete(viewingPhoto.id)} style={{ padding: '10px 18px', borderRadius: 10, background: 'rgba(200,70,70,.3)', border: 'none', color: '#ff8888', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}><Trash size={14} /> Delete</button>
            </div>}
          </div>
        </div>,
        document.body
      )}

      {selectMode && selected.size > 0 && (
        <div style={{ position: 'fixed', bottom: 'calc(var(--nav-height) + var(--safe-bottom) + 12px)', left: '50%', transform: 'translateX(-50%)', background: 'var(--danger)', color: '#fff', borderRadius: 'var(--radius-pill)', padding: '12px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', gap: 8, zIndex: 40 }} onClick={handleBulkDelete}>
          <Trash size={16} /> Delete {selected.size} photo{selected.size !== 1 ? 's' : ''}
        </div>
      )}

      <Toast message={toast?.msg} type={toast?.type} />
    </div>
  );
}