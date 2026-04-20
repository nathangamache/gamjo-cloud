import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Upload, Camera, Image, Edit, Trash, X, ChevronLeft, ChevronRight } from '../components/Icons';
import { Sheet, Toast, useConfirm, EmptyState, SkeletonPhotoGrid } from '../components/Shared';
import { api } from '../utils/api';
import { formatDate, groupBy, msg, t } from '../utils/helpers';
import { useApp } from '../App';

export default function PhotosPage({ trip, user, navigate, photos: propPhotos, setPhotos: propSetPhotos, refreshMedia }) {
  const { isDesktop, isAdmin, media: ctxMedia, setMedia: ctxSetMedia, dataLoaded } = useApp();
  const photos = propPhotos || ctxMedia || [];
  const setPhotos = propSetPhotos || ctxSetMedia || (() => {});
  const [showUpload, setShowUpload] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState(null);
  const [viewingPhoto, setViewingPhoto] = useState(null);
  const [editForm, setEditForm] = useState({ caption: '', date: '', location: '' });
  const [toast, setToast] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [pendingFiles, setPendingFiles] = useState([]);
  const fileRef = useRef(null);
  const showToast = (text, type = 'info') => { setToast({ msg: text, type }); setTimeout(() => setToast(null), 2500); };
  const confirm = useConfirm();

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
    showToast(msg('toasts.photoUploaded', { count: uploaded, s: uploaded !== 1 ? 's' : '', ies: uploaded !== 1 ? 'ies' : 'y' }, true), 'success');
  };

  const canEdit = (p) => isAdmin || p.uploaded_by === user?.id || p.user_id === user?.id;
  const startEdit = (photo) => { if (!canEdit(photo)) return; setEditingPhoto(photo); setEditForm({ caption: photo.caption || '', date: photo.date || '', location: photo.location || '' }); };
  const saveEdit = async () => { if (!editingPhoto) return; try { await api.put(`/api/trips/${trip.id}/media/${editingPhoto.id}`, editForm); setPhotos(prev => prev.map(p => p.id === editingPhoto.id ? { ...p, ...editForm } : p)); setEditingPhoto(null); showToast('Saved', 'success'); } catch { showToast('Failed', 'error'); } };
  const handleDelete = async (id) => { if (!await confirm({ title: 'Delete this photo?', message: 'Gone forever. Probably for the best.', confirmText: 'Delete it', danger: true })) return; try { await api.delete(`/api/trips/${trip.id}/media/${id}`); setPhotos(prev => prev.filter(p => p.id !== id)); setEditingPhoto(null); setViewingPhoto(null); showToast('Deleted', 'success'); } catch { showToast('Failed', 'error'); } };

  const viewNext = () => { const idx = photos.findIndex(p => p.id === viewingPhoto?.id); if (idx < photos.length - 1) setViewingPhoto(photos[idx + 1]); };
  const viewPrev = () => { const idx = photos.findIndex(p => p.id === viewingPhoto?.id); if (idx > 0) setViewingPhoto(photos[idx - 1]); };
  useEffect(() => {
    if (!viewingPhoto) return;
    const handler = (e) => { if (e.key === 'ArrowRight') viewNext(); else if (e.key === 'ArrowLeft') viewPrev(); else if (e.key === 'Escape') setViewingPhoto(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const grouped = groupBy(photos, p => p.date || 'Unknown');

  const touchStart = useRef(null);
  
  return (
    <div className="page-photos">
      {!isDesktop && <div className="topbar"><span className="topbar-title">Photos</span><button className="btn-add" onClick={() => setShowUpload(true)}><Plus size={13} /> Upload</button></div>}
      {isDesktop && <div className="desk-header"><div className="desk-header-title">Photos</div><span style={{ fontSize: 13, color: 'var(--text-muted)', marginRight: 12 }}>{photos.length} photos</span><button className="btn-add" onClick={() => setShowUpload(true)}><Plus size={13} /> Upload</button></div>}
      <div style={{ padding: isDesktop ? '24px 32px' : '10px 20px' }}>
        {!isDesktop && photos.length > 0 && <button className="btn btn-secondary" style={{ marginBottom: 12 }} onClick={() => navigate('gallery')}><Image size={15} /> View gallery grid</button>}
        {!dataLoaded && photos.length === 0 && <SkeletonPhotoGrid count={9} />}
        {dataLoaded && photos.length === 0 && <EmptyState type="photos" title={msg('emptyStates.photos.titles')} message={msg('emptyStates.photos.messages')} action="Upload photos" onAction={() => setShowUpload(true)} />}
        {isDesktop && photos.length > 0 ? (
          Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, datePhotos]) => (
            <div key={date}><div className="label" style={{ color: 'var(--warm)', marginBottom: 10, marginTop: 14 }}>{formatDate(date)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                {datePhotos.map((p, i) => (
                  <div key={p.id} style={{ aspectRatio: 1, borderRadius: 12, background: p.url ? undefined : `hsl(${(p.id * 67 + i * 30) % 360}, 40%, 55%)`, overflow: 'hidden', position: 'relative', cursor: 'pointer' }} onClick={() => p.url && setViewingPhoto(p)}>
                    {p.url ? <img src={p.url} alt={p.caption} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.7)' }}><Image size={24} /></div>}
                    {canEdit(p) && <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
                      <button onClick={e => { e.stopPropagation(); startEdit(p); }} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(0,0,0,.4)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Edit size={14} color="rgba(255,255,255,.9)" /></button>
                      <button onClick={e => { e.stopPropagation(); handleDelete(p.id); }} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(200,60,60,.5)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Trash size={14} color="rgba(255,255,255,.9)" /></button>
                    </div>}
                  </div>))}
              </div></div>))
        ) : photos.length > 0 && (
          Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, datePhotos]) => (
            <div key={date}><div className="label" style={{ color: 'var(--warm)', marginBottom: 6, marginTop: 14 }}>{formatDate(date)}</div>
              {datePhotos.map(p => (
                <div key={p.id} className="photo-item" style={{ cursor: p.url ? 'pointer' : undefined }} onClick={() => p.url && setViewingPhoto(p)}>
                  <div className="photo-thumb" style={{ background: p.url ? undefined : `hsl(${(p.id * 67) % 360}, 40%, 55%)` }}>{p.url ? <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Image size={20} />}</div>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 500, fontSize: 14 }}>{p.caption || 'Untitled'}</div><div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.uploaded_by_name || 'Someone'} {p.location ? `\u00b7 ${p.location}` : ''}</div></div>
                  {canEdit(p) && <div style={{ display: 'flex', gap: 4 }}><button className="photo-edit-btn" onClick={e => { e.stopPropagation(); startEdit(p); }}><Edit size={14} /></button><button className="photo-edit-btn" onClick={e => { e.stopPropagation(); handleDelete(p.id); }}><Trash size={14} /></button></div>}
                </div>))}</div>))
        )}
      </div>
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
      {editingPhoto && <Sheet onClose={() => setEditingPhoto(null)} title="Edit photo details">{editingPhoto.url && <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}><img src={editingPhoto.url} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} /></div>}<div className="form-group"><label className="label">Caption</label><input className="form-input" value={editForm.caption} onChange={e => setEditForm(f => ({ ...f, caption: e.target.value }))} placeholder="What's in this photo?" /></div><div className="form-group"><label className="label">Date taken</label><input className="form-input" type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} /></div><div className="form-group"><label className="label">Location</label><input className="form-input" value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. West Bay Beach" /></div><div style={{ display: 'flex', gap: 8 }}><button className="btn btn-primary" style={{ flex: 1 }} onClick={saveEdit}>Save changes</button><button className="btn btn-danger" style={{ flex: 0, width: 'auto', padding: '14px 16px' }} onClick={() => handleDelete(editingPhoto.id)}><Trash size={16} /></button></div></Sheet>}
      {viewingPhoto && createPortal(
        <div className="photo-lightbox" onClick={() => setViewingPhoto(null)}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: 800, padding: '0 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button onClick={() => setViewingPhoto(null)} style={{ position: 'fixed', top: 'calc(16px + env(safe-area-inset-top, 0px))', right: 16, width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,.2)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 310 }}><X size={22} color="#fff" /></button>
            <img src={viewingPhoto.url} alt={viewingPhoto.caption || ''} style={{ maxWidth: '92vw', maxHeight: '75vh', borderRadius: 8, objectFit: 'contain', touchAction: 'pan-y' }}
              onTouchStart={e => { touchStart.current = e.touches[0].clientX; }}
              onTouchEnd={e => { if (touchStart.current === null) return; const diff = e.changedTouches[0].clientX - touchStart.current; touchStart.current = null; if (Math.abs(diff) < 50) return; if (diff < 0) viewNext(); else viewPrev(); }}
              onError={e => { e.target.style.display = 'none'; }}
            />
            <div style={{ marginTop: 12, textAlign: 'center', color: '#fff' }}><div style={{ fontSize: 15, fontWeight: 500 }}>{viewingPhoto.caption || 'Untitled'}</div><div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginTop: 4 }}>{viewingPhoto.uploaded_by_name || 'Someone'}{viewingPhoto.date ? ` \u00b7 ${formatDate(viewingPhoto.date)}` : ''}{viewingPhoto.location ? ` \u00b7 ${viewingPhoto.location}` : ''}</div></div>
            {photos.findIndex(p => p.id === viewingPhoto.id) > 0 && <button onClick={viewPrev} style={{ position: 'fixed', top: '50%', left: 8, transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,.2)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 310 }}><ChevronLeft size={22} color="#fff" /></button>}
            {photos.findIndex(p => p.id === viewingPhoto.id) < photos.length - 1 && <button onClick={viewNext} style={{ position: 'fixed', top: '50%', right: 8, transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,.2)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 310 }}><ChevronRight size={22} color="#fff" /></button>}
            {canEdit(viewingPhoto) && <div style={{ marginTop: 12, display: 'flex', gap: 8 }}><button onClick={() => { startEdit(viewingPhoto); setViewingPhoto(null); }} style={{ padding: '10px 18px', borderRadius: 10, background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}><Edit size={14} /> Edit</button><button onClick={() => handleDelete(viewingPhoto.id)} style={{ padding: '10px 18px', borderRadius: 10, background: 'rgba(196,88,74,.3)', border: 'none', color: '#E8A099', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}><Trash size={14} /> Delete</button></div>}
          </div>
        </div>,
        document.body
      )}
      <Toast message={toast?.msg} type={toast?.type} />
    </div>
  );
}