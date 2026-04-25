import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Image, Edit, Trash, X, Check, Plus, Camera } from '../components/Icons';
import { Sheet, Toast, useConfirm, EmptyState, SkeletonPhotoGrid } from '../components/Shared';
import { api } from '../utils/api';
import { formatDate, groupBy, msg } from '../utils/helpers';
import { useApp } from '../App';

export default function GalleryPage({ trip, user, onBack, photos: propPhotos, setPhotos: propSetPhotos, refreshMedia }) {
  const { isDesktop, isAdmin, media: ctxMedia, setMedia: ctxSetMedia } = useApp();
  const photos = propPhotos || ctxMedia || [];
  const setPhotos = propSetPhotos || ctxSetMedia || (() => {});
  const isPrimary = !onBack; // true when this IS the photos tab (mobile)
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

  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [pendingFiles, setPendingFiles] = useState([]);
  const fileRef = useRef(null);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPendingFiles(prev => [...prev, ...files]);
    if (fileRef.current) fileRef.current.value = '';
  };
  const removePending = (idx) => setPendingFiles(prev => prev.filter((_, i) => i !== idx));
  const handleUpload = async () => {
    if (!pendingFiles.length) return;
    setUploading(true);
    setUploadProgress({ done: 0, total: pendingFiles.length });
    let uploaded = 0;
    for (const file of pendingFiles) {
      const fd = new FormData(); fd.append('file', file);
      try { await api.upload(`/api/trips/${trip.id}/media`, fd); uploaded++; } catch {}
      setUploadProgress({ done: uploaded, total: pendingFiles.length });
    }
    if (refreshMedia) await refreshMedia();
    setShowUpload(false); setUploading(false); setPendingFiles([]);
    showToast(`Uploaded ${uploaded} photo${uploaded !== 1 ? 's' : ''}`, 'success');
  };

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

  // Lightbox rendered via direct DOM manipulation to bypass all React/CSS stacking issues
  const lightboxRef = useRef(null);
  useEffect(() => {
    if (!viewingPhoto) {
      if (lightboxRef.current) {
        document.body.removeChild(lightboxRef.current);
        lightboxRef.current = null;
      }
      return;
    }

    if (!lightboxRef.current) {
      const el = document.createElement('div');
      el.id = 'gallery-lightbox';
      document.body.appendChild(el);
      lightboxRef.current = el;
    }

    const el = lightboxRef.current;
    const idx = photos.findIndex(p => p.id === viewingPhoto.id);
    const hasPrev = idx > 0;
    const hasNext = idx < photos.length - 1;

    el.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#000;z-index:999999;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:16px;';

    el.innerHTML = `
      <button id="lb-close" style="position:fixed;top:calc(14px + env(safe-area-inset-top, 0px));right:16px;width:48px;height:48px;border-radius:24px;background:rgba(255,255,255,0.3);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:999999;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <img src="${viewingPhoto.url}" alt="" style="max-width:92vw;max-height:70vh;object-fit:contain;border-radius:8px;display:block;" />
      <div style="margin-top:16px;text-align:center;">
        <div style="font-size:16px;font-weight:600;color:#fff;font-family:-apple-system,sans-serif;">${viewingPhoto.caption || 'Untitled'}</div>
        <div style="font-size:14px;color:rgba(255,255,255,0.5);margin-top:4px;font-family:-apple-system,sans-serif;">${viewingPhoto.uploaded_by_name || ''}${viewingPhoto.location ? ' · ' + viewingPhoto.location : ''}</div>
      </div>
      ${hasPrev ? `<button id="lb-prev" style="position:fixed;left:8px;top:50%;transform:translateY(-50%);width:48px;height:48px;border-radius:24px;background:rgba(255,255,255,0.3);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:999999;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>` : ''}
      ${hasNext ? `<button id="lb-next" style="position:fixed;right:8px;top:50%;transform:translateY(-50%);width:48px;height:48px;border-radius:24px;background:rgba(255,255,255,0.3);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:999999;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>` : ''}
    `;

    const onClose = () => setViewingPhoto(null);
    const onPrev = () => { if (hasPrev) setViewingPhoto(photos[idx - 1]); };
    const onNext = () => { if (hasNext) setViewingPhoto(photos[idx + 1]); };

    el.querySelector('#lb-close').addEventListener('click', onClose);
    el.addEventListener('click', (e) => { if (e.target === el) onClose(); });
    if (hasPrev) el.querySelector('#lb-prev').addEventListener('click', onPrev);
    if (hasNext) el.querySelector('#lb-next').addEventListener('click', onNext);

    return () => {
      // Cleanup listeners by replacing element content on next render
    };
  }, [viewingPhoto?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (lightboxRef.current) {
        document.body.removeChild(lightboxRef.current);
        lightboxRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ background: 'var(--bg)' }}>
      {!isDesktop && isPrimary && (
        <div className="topbar">
          <span className="topbar-title">Photos</span>
          <button className="btn-add" onClick={() => setShowUpload(true)}><Plus size={13} /> Upload</button>
        </div>
      )}
      {!isDesktop && !isPrimary && (
        <div className="topbar">
          <button className="topbar-back" onClick={onBack}><ChevronLeft size={16} /></button>
          <span className="topbar-title">Gallery</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }} style={{ background: 'none', border: 'none', fontSize: 13, color: selectMode ? 'var(--danger)' : 'var(--primary)', cursor: 'pointer', fontWeight: 500 }}>{selectMode ? 'Cancel' : 'Select'}</button>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{photos.length}</span>
          </div>
        </div>
      )}
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
                  {p.url ? <img src={p.thumbnail_url || p.url} alt={p.caption || ''} loading="lazy" /> : (
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
                    <div style={{ position: 'absolute', top: 6, right: 6 }}>
                      <button className="gallery-item-edit" style={{ position: 'static' }} onClick={e => { e.stopPropagation(); startEdit(p); }}><Edit size={12} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {photos.length === 0 && <EmptyState type="photos" title="No pics yet" message="Someone snap a photo before we forget everything." action="Upload photos" onAction={() => setShowUpload(true)} />}
      </div>

      {editingPhoto && (
        <Sheet onClose={() => setEditingPhoto(null)} title="Edit photo details">
          {editingPhoto.url && <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}><img src={editingPhoto.thumbnail_url || editingPhoto.url} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} /></div>}
          <div className="form-group"><label className="label">Caption</label><input className="form-input" value={editForm.caption} onChange={e => setEditForm(f => ({ ...f, caption: e.target.value }))} placeholder="What's in this photo?" /></div>
          <div className="form-group"><label className="label">Date taken</label><input className="form-input" type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} /></div>
          <div className="form-group"><label className="label">Location</label><input className="form-input" value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. West Bay Beach" /></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveEdit}>Save changes</button>
            {canEdit(editingPhoto) && <button className="btn btn-danger" style={{ flex: 0, width: 'auto', padding: '14px 16px' }} onClick={() => handleDelete(editingPhoto.id)}><Trash size={16} /></button>}
          </div>
        </Sheet>
      )}

      <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
      {showUpload && <Sheet onClose={() => { if (!uploading) { setShowUpload(false); setPendingFiles([]); } }} title="Upload photos">
        {uploading ? (
          <div style={{ padding: '12px 0' }}>
            <div style={{ fontSize: 15, color: 'var(--primary)', fontWeight: 500, marginBottom: 8 }}>{uploadProgress.done} of {uploadProgress.total} uploaded</div>
            <div style={{ width: '100%', height: 6, background: 'var(--surface-alt)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${uploadProgress.total ? (uploadProgress.done / uploadProgress.total) * 100 : 0}%`, height: '100%', background: 'var(--sage)', borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
          </div>
        ) : (
          <>
            <div className="upload-zone" style={{ marginBottom: 16, cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
              <Camera size={24} color="var(--text-muted)" />
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', marginTop: 6 }}>{pendingFiles.length > 0 ? 'Tap to add more' : 'Tap to select photos'}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>You can select multiple at once</div>
            </div>
            {pendingFiles.length > 0 && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 16 }}>
                  {pendingFiles.map((file, i) => (
                    <div key={i} style={{ position: 'relative', aspectRatio: 1, borderRadius: 8, overflow: 'hidden' }}>
                      <img src={URL.createObjectURL(file)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button onClick={() => removePending(i)} style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,.5)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <X size={12} color="#fff" />
                      </button>
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary" onClick={handleUpload}>Upload {pendingFiles.length} photo{pendingFiles.length !== 1 ? 's' : ''}</button>
              </>
            )}
          </>
        )}
      </Sheet>}

      {selectMode && selected.size > 0 && (
        <div style={{ position: 'fixed', bottom: 'calc(var(--nav-height) + var(--safe-bottom) + 12px)', left: '50%', transform: 'translateX(-50%)', background: 'var(--danger)', color: '#fff', borderRadius: 'var(--radius-pill)', padding: '12px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', gap: 8, zIndex: 40 }} onClick={handleBulkDelete}>
          <Trash size={16} /> Delete {selected.size} photo{selected.size !== 1 ? 's' : ''}
        </div>
      )}

      <Toast message={toast?.msg} type={toast?.type} />
    </div>
  );
}