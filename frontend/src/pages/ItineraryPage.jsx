import { useState, useMemo } from 'react';
import { Plus, ThumbUp, ThumbDown, Lock, Check, Pin, Navigation, Trash, Edit } from '../components/Icons';
import { Sheet, Toast, useConfirm, LoadingButton, SkeletonItinerary } from '../components/Shared';
import { api } from '../utils/api';
import { formatDate, formatTime12h } from '../utils/helpers';
import { useApp } from '../App';

export default function ItineraryPage({ trip, user, items: propItems, setItems: propSetItems, refreshItinerary }) {
  const { isAdmin, isDesktop, itinerary: ctxItems, setItinerary: ctxSetItems, setTrip, members, dataLoaded } = useApp();
  const items = propItems || ctxItems || [];
  const setItems = propSetItems || ctxSetItems || (() => {});
  const refresh = refreshItinerary || (async () => {});
  const confirm = useConfirm();
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(null);
  const [showDayTitle, setShowDayTitle] = useState(null); // { date, title } or null
  const [dayTitleInput, setDayTitleInput] = useState('');
  const [toast, setToast] = useState(null);
  const [voterTip, setVoterTip] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', date: '', time: '', location: '' });
  const [editForm, setEditForm] = useState({ title: '', description: '', date: '', time: '', location: '' });

  const showToast = (msg, type = 'info') => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };

  const dayTitles = trip?.day_titles || {};

  // Generate every date of the trip
  const tripDates = useMemo(() => {
    if (!trip?.start_date || !trip?.end_date) return [];
    const dates = [];
    const cur = new Date(trip.start_date + 'T12:00:00');
    const end = new Date(trip.end_date + 'T12:00:00');
    while (cur <= end) {
      dates.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }, [trip?.start_date, trip?.end_date]);

  // Group items by date, sorted by time within each day
  const itemsByDate = useMemo(() => {
    const map = {};
    [...items].sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time && !b.time) return -1;
      if (!a.time && b.time) return 1;
      return 0;
    }).forEach(item => {
      const d = item.date || 'No date';
      if (!map[d]) map[d] = [];
      map[d].push(item);
    });
    return map;
  }, [items]);

  // All dates to render: trip dates + any "No date" items
  const allDates = useMemo(() => {
    const dates = [...tripDates];
    if (itemsByDate['No date']?.length) dates.push('No date');
    return dates;
  }, [tripDates, itemsByDate]);

  const openAddForDate = (date) => {
    setForm({ title: '', description: '', date: date === 'No date' ? '' : date, time: '', location: '' });
    setShowAdd(true);
  };

  const handleVote = async (id, voteType = true) => { try { await api.post(`/api/trips/${trip.id}/itinerary/${id}/vote`, { vote: voteType }); await refresh(); } catch { showToast('Vote failed', 'error'); } };
  const handleLock = async (id) => { try { await api.put(`/api/trips/${trip.id}/itinerary/${id}`, { status: 'final' }); await refresh(); showToast('Locked in. No backing out.', 'success'); } catch { showToast('Failed', 'error'); } };
  const handleUnlock = async (id) => { try { await api.put(`/api/trips/${trip.id}/itinerary/${id}`, { status: 'voting' }); await refresh(); showToast('Back up for debate', 'success'); } catch { showToast('Failed', 'error'); } };
  const handleDelete = async (id) => { if (!await confirm({ title: 'Cut this from the lineup?', message: 'It had a good run.', confirmText: 'Cut it', danger: true })) return; try { await api.delete(`/api/trips/${trip.id}/itinerary/${id}`); setItems(prev => prev.filter(i => i.id !== id)); showToast('Gone. Poof.', 'success'); } catch { showToast('Failed', 'error'); } };
  const handleAdd = async () => {
    if (!form.title || !form.date || !form.time) { showToast('Title, date, and time are required', 'error'); return; }
    setSubmitting(true);
    const addedDate = form.date;
    try {
      await api.post(`/api/trips/${trip.id}/itinerary`, { ...form, status: 'proposed' }); await refresh();
      setForm({ title: '', description: '', date: '', time: '', location: '' }); setShowAdd(false); showToast('Added!', 'success');
      // Scroll to the day section where item was added
      setTimeout(() => {
        const el = document.getElementById(`day-${addedDate}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } catch { showToast('Failed', 'error'); }
    setSubmitting(false);
  };
  const openEdit = (item) => { setShowEdit(item); setEditForm({ title: item.title || '', description: item.description || '', date: item.date || '', time: item.time || '', location: item.location || '' }); };
  const handleSaveEdit = async () => {
    if (!showEdit || !editForm.title || !editForm.date || !editForm.time) { showToast('Title, date, and time are required', 'error'); return; }
    setSubmitting(true);
    try { await api.put(`/api/trips/${trip.id}/itinerary/${showEdit.id}`, editForm); await refresh(); setShowEdit(null); showToast('Updated!', 'success'); } catch { showToast('Failed', 'error'); }
    setSubmitting(false);
  };
  const openMaps = (loc) => { if (loc) window.open(`https://maps.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`, '_blank'); };
  const statusBadge = (status) => { const map = { final: ['Confirmed', 'badge-confirmed'], voting: ['Voting', 'badge-voting'], proposed: ['Proposed', 'badge-proposed'] }; const [label, cls] = map[status] || map.proposed; return <span className={`badge ${cls}`}>{status === 'final' && <Check size={10} />} {label}</span>; };

  const getVoterNames = (item, type = 'like') => {
    const users = type === 'like' ? (item.like_users || {}) : (item.dislike_users || {});
    return Object.keys(users).map(uid =>
      (members || []).find(m => (m.id || m.user_id) === uid)?.name?.split(' ')[0]
    ).filter(Boolean);
  };

  // Day title handlers (stored on trip, not as itinerary items)
  const openDayTitle = (date) => {
    setShowDayTitle({ date });
    setDayTitleInput(dayTitles[date] || '');
  };
  const saveDayTitle = async () => {
    if (!showDayTitle) return;
    try {
      const res = await api.put(`/api/trips/${trip.id}/day-title`, { date: showDayTitle.date, title: dayTitleInput.trim() });
      if (res.data?.day_titles && setTrip) setTrip(prev => ({ ...prev, day_titles: res.data.day_titles }));
      setShowDayTitle(null);
      showToast(dayTitleInput.trim() ? 'Day title saved' : 'Day title removed', 'success');
    } catch { showToast('Failed to save', 'error'); }
  };
  const deleteDayTitle = async (date) => {
    try {
      const res = await api.put(`/api/trips/${trip.id}/day-title`, { date, title: '' });
      if (res.data?.day_titles && setTrip) setTrip(prev => ({ ...prev, day_titles: res.data.day_titles }));
      showToast('Day title cleared', 'success');
    } catch { showToast('Failed', 'error'); }
  };

  return (
    <div>
      {!isDesktop && <div className="topbar"><span className="topbar-title">Itinerary</span><button className="btn-add" onClick={() => openAddForDate(tripDates[0] || '')}><Plus size={13} /> Add</button></div>}
      {isDesktop && <div className="desk-header"><div className="desk-header-title">Itinerary</div><button className="btn-add" onClick={() => openAddForDate(tripDates[0] || '')}><Plus size={13} /> Add item</button></div>}
      <div style={{ padding: isDesktop ? '24px 32px' : '6px 20px' }}>
        {!dataLoaded && items.length === 0 && <SkeletonItinerary days={3} />}
        {(dataLoaded || items.length > 0) && allDates.map(date => {
          const dateItems = itemsByDate[date] || [];
          const title = date !== 'No date' ? dayTitles[date] : null;
          return (
            <div key={date} id={`day-${date}`} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span className="label" style={{ color: 'var(--warm)' }}>{date === 'No date' ? date : formatDate(date)}</span>
                  {title && <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 500, color: 'var(--primary)' }}>— {title}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isAdmin && date !== 'No date' && !title && (
                    <button onClick={() => openDayTitle(date)} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--primary)', cursor: 'pointer', fontWeight: 500 }}>
                      + Day title
                    </button>
                  )}
                  {isAdmin && date !== 'No date' && title && (
                    <>
                      <button className="icon-btn" onClick={() => openDayTitle(date)} aria-label="Edit day title"><Edit size={14} color="var(--text-muted)" /></button>
                      <button className="icon-btn" onClick={() => deleteDayTitle(date)} aria-label="Delete day title"><Trash size={14} color="var(--text-muted)" /></button>
                    </>
                  )}
                </div>
              </div>
              {dateItems.map(item => {
                const likeCount = item.likes || 0;
                const dislikeCount = item.dislikes || 0;
                const userVote = item.user_vote; // 'like', 'dislike', or null
                const likeVoters = getVoterNames(item, 'like');
                const dislikeVoters = getVoterNames(item, 'dislike');
                const showLikeTip = voterTip === `${item.id}-like`;
                const showDislikeTip = voterTip === `${item.id}-dislike`;
                return (
              <div key={item.id} className={`card itin-card card-accent-${item.status === 'final' ? 'confirmed' : item.status === 'voting' ? 'voting' : 'proposed'}`} style={{ marginBottom: 8, cursor: 'pointer', ...(item.pushed ? { background: 'linear-gradient(135deg, #FFFCF5, #FFF8ED)', boxShadow: '0 2px 12px rgba(139, 112, 50, 0.12), inset 0 0 0 1px var(--vote-border)' } : {}) }} onClick={() => openEdit(item)}>
                {item.pushed && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--vote-text)', letterSpacing: '0.04em', marginBottom: 6, textTransform: 'uppercase' }}>Vote spotlight</div>}
                <div className="itin-card-row" onClick={e => e.stopPropagation()}>
                  <div className="itin-card-info">
                    <span className="itin-card-title" style={{ fontWeight: 500, fontSize: 15 }}>{item.title}</span>
                    {item.time && <span className="itin-card-time" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatTime12h(item.time)}</span>}
                    {item.description && <span className="itin-card-desc" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.description}</span>}
                    {item.location && <span className="itin-card-loc" onClick={() => openMaps(item.location)} style={{ fontSize: 13, color: 'var(--primary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Pin size={12} />{item.location}</span>}
                  </div>
                  <div className="itin-card-actions">
                    {statusBadge(item.status)}
                    {item.status !== 'final' && isAdmin && <button className="btn-sm btn-ghost" style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }} onClick={() => handleLock(item.id)}><Lock size={13} /> Lock</button>}
                    {item.status === 'final' && isAdmin && <button className="btn-sm btn-ghost" style={{ borderColor: 'var(--warm)', color: 'var(--warm)' }} onClick={() => handleUnlock(item.id)}><Lock size={13} /> Unlock</button>}
                    <button className="icon-btn" onClick={e => { e.stopPropagation(); openEdit(item); }} aria-label="Edit item"><Edit size={16} color="var(--text-muted)" /></button>
                    {isAdmin && <button className="icon-btn" onClick={e => { e.stopPropagation(); handleDelete(item.id); }} aria-label="Delete item"><Trash size={16} color="var(--text-muted)" /></button>}
                  </div>
                </div>
                {/* Reaction chips */}
                {item.status !== 'final' && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                    {/* Like chip */}
                    <button
                      onClick={() => handleVote(item.id, true)}
                      onMouseEnter={() => likeVoters.length > 0 && setVoterTip(`${item.id}-like`)}
                      onMouseLeave={() => setVoterTip(null)}
                      className="reaction-chip"
                      aria-label={`Like${likeCount > 0 ? `, ${likeCount} votes` : ''}`}
                      style={{
                        position: 'relative',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 24,
                        fontSize: 14, fontWeight: 500, cursor: 'pointer',
                        border: userVote === 'like' ? '1.5px solid var(--sage)' : '1.5px solid var(--border)',
                        background: userVote === 'like' ? 'var(--sage-light)' : 'var(--surface)',
                        color: userVote === 'like' ? 'var(--sage)' : 'var(--text-muted)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <ThumbUp size={18} />
                      {likeCount > 0 && <span>{likeCount}</span>}
                      {showLikeTip && likeVoters.length > 0 && (
                        <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 6, padding: '6px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--text)', color: '#fff', fontSize: 13, whiteSpace: 'nowrap', zIndex: 10, boxShadow: 'var(--shadow-lg)', pointerEvents: 'none' }}>
                          {likeVoters.join(', ')}
                        </div>
                      )}
                    </button>
                    {/* Dislike chip */}
                    <button
                      onClick={() => handleVote(item.id, false)}
                      onMouseEnter={() => dislikeVoters.length > 0 && setVoterTip(`${item.id}-dislike`)}
                      onMouseLeave={() => setVoterTip(null)}
                      className="reaction-chip"
                      aria-label={`Dislike${dislikeCount > 0 ? `, ${dislikeCount} votes` : ''}`}
                      style={{
                        position: 'relative',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 24,
                        fontSize: 14, fontWeight: 500, cursor: 'pointer',
                        border: userVote === 'dislike' ? '1.5px solid var(--danger)' : '1.5px solid var(--border)',
                        background: userVote === 'dislike' ? 'var(--danger-light)' : 'var(--surface)',
                        color: userVote === 'dislike' ? 'var(--danger)' : 'var(--text-muted)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <ThumbDown size={18} />
                      {dislikeCount > 0 && <span>{dislikeCount}</span>}
                      {showDislikeTip && dislikeVoters.length > 0 && (
                        <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 6, padding: '6px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--text)', color: '#fff', fontSize: 13, whiteSpace: 'nowrap', zIndex: 10, boxShadow: 'var(--shadow-lg)', pointerEvents: 'none' }}>
                          {dislikeVoters.join(', ')}
                        </div>
                      )}
                    </button>
                  </div>
                )}
              </div>
                );
              })}
              <button className="btn-dashed" onClick={() => openAddForDate(date)} style={{ marginTop: dateItems.length > 0 ? 4 : 0 }}>
                <Plus size={14} /> Add item
              </button>
              {dateItems.length === 0 && (
                <div style={{ padding: '4px 0', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>Nothing planned yet</div>
              )}
            </div>
          );
        })}
      </div>
      {showAdd && <Sheet onClose={() => setShowAdd(false)} title="Add to itinerary">
        <div className="form-group"><label className="label">What are we doing? <span style={{ color: 'var(--danger)' }}>*</span></label><input className="form-input" placeholder="e.g. Happy hour, Kayaks, Nap time" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} aria-required="true" autoFocus /></div>
        <div className="form-group"><label className="label">Details</label><textarea className="form-input" placeholder="What will everyone be doing?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
            <label className="label">Date <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input className="form-input" type="date" min={trip?.start_date || ''} max={trip?.end_date || ''} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} aria-required="true" />
            {form.date && <div style={{ fontSize: 13, color: 'var(--warm)', marginTop: 4 }}>{formatDate(form.date)}</div>}
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
            <label className="label">Time <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input className="form-input" type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} aria-required="true" />
            {form.time && <div style={{ fontSize: 13, color: 'var(--warm)', marginTop: 4 }}>{formatTime12h(form.time)}</div>}
          </div>
        </div>
        <div className="form-group"><label className="label">Location (optional)</label><input className="form-input" placeholder="e.g. Sleeping Bear Dunes" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
        <LoadingButton loading={submitting} onClick={handleAdd}>Add to itinerary</LoadingButton>
      </Sheet>}
      {showEdit && <Sheet onClose={() => setShowEdit(null)} title={`Edit: ${showEdit.title}`}>
        <div className="form-group"><label className="label">Title <span style={{ color: 'var(--danger)' }}>*</span></label><input className="form-input" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} aria-required="true" /></div>
        <div className="form-group"><label className="label">Details</label><textarea className="form-input" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} /></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
            <label className="label">Date <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input className="form-input" type="date" min={trip?.start_date || ''} max={trip?.end_date || ''} value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} aria-required="true" />
            {editForm.date && <div style={{ fontSize: 13, color: 'var(--warm)', marginTop: 4 }}>{formatDate(editForm.date)}</div>}
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
            <label className="label">Time <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input className="form-input" type="time" value={editForm.time} onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))} aria-required="true" />
            {editForm.time && <div style={{ fontSize: 13, color: 'var(--warm)', marginTop: 4 }}>{formatTime12h(editForm.time)}</div>}
          </div>
        </div>
        <div className="form-group"><label className="label">Location</label><input className="form-input" value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Sleeping Bear Dunes" /></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <LoadingButton loading={submitting} onClick={handleSaveEdit} style={{ flex: 1 }}><Check size={14} /> Save changes</LoadingButton>
          {isAdmin && <button className="btn btn-danger" style={{ flex: 0, width: 'auto', padding: '15px 18px' }} onClick={() => { handleDelete(showEdit.id); setShowEdit(null); }} aria-label="Delete item"><Trash size={16} /></button>}
        </div>
      </Sheet>}
      {showDayTitle && <Sheet onClose={() => setShowDayTitle(null)} title={`Day title for ${formatDate(showDayTitle.date)}`}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Give this day a name. Go big or go home.</div>
        <div className="form-group">
          <label className="label">Title</label>
          <input className="form-input" placeholder="e.g. Lake Day, Send It Sunday, Recovery Day" value={dayTitleInput} onChange={e => setDayTitleInput(e.target.value)} autoFocus />
        </div>
        <button className="btn btn-primary" onClick={saveDayTitle}><Check size={14} /> Save</button>
      </Sheet>}
      <Toast message={toast?.msg} type={toast?.type} />
    </div>
  );
}