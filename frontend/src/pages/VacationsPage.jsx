import { useState, useEffect } from 'react';
import { ChevronLeft, Plus } from '../components/Icons';
import { Sheet, Toast, EmptyState, SkeletonVacationList } from '../components/Shared';
import { api } from '../utils/api';
import { formatDateRange, daysUntil, groupBy, msg } from '../utils/helpers';
import { useApp } from '../App';

export default function VacationsPage({ onBack, navigate, openTrip }) {
  const { isAdmin, isDesktop, trip: currentTrip } = useApp();
  const [trips, setTrips] = useState([]);
  const [tripsLoaded, setTripsLoaded] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', location: '', start_date: '', end_date: '' });
  const [toast, setToast] = useState(null);
  const showToast = (text, type = 'info') => { setToast({ msg: text, type }); setTimeout(() => setToast(null), 2500); };

  useEffect(() => { api.get('/api/trips').then(r => { setTrips(Array.isArray(r.data) ? r.data : []); setTripsLoaded(true); }).catch(() => setTripsLoaded(true)); }, []);

  const now = new Date();
  const upcoming = trips.filter(t => !t.end_date || new Date(t.end_date + 'T23:59:59') >= now).sort((a, b) => new Date(a.start_date || '2099') - new Date(b.start_date || '2099'));
  const past = trips.filter(t => t.end_date && new Date(t.end_date + 'T23:59:59') < now);
  const pastByYear = groupBy(past, t => t.start_date?.slice(0, 4) || 'Unknown');

  const handleSelectTrip = (trip) => {
    // If already viewing this trip, just go to its home page
    if (currentTrip && String(currentTrip.id) === String(trip.id)) {
      navigate('trip-home');
      return;
    }
    if (openTrip) openTrip(trip);
    else navigate('home');
  };

  const handleCreateTrip = async () => {
    if (!createForm.name) return;
    try {
      const res = await api.post('/api/trips', createForm);
      if (res.data) { setTrips(prev => [...prev, res.data]); handleSelectTrip(res.data); }
      setShowCreate(false);
      setCreateForm({ name: '', location: '', start_date: '', end_date: '' });
      showToast('Vacation created!', 'success');
    } catch { showToast('Failed to create vacation', 'error'); }
  };

  const TripCard = ({ trip: t, idx, compact }) => {
    const days = daysUntil(t.start_date);
    const cardBanner = (() => {
      const pool = t.desktop_banners?.length ? t.desktop_banners : [];
      if (pool.length > 0) return pool[0];
      return t.banner_url || null;
    })();
    return (
      <div className="vacation-card" style={{ marginBottom: 12, cursor: 'pointer', borderRadius: 16, overflow: 'hidden' }} onClick={() => handleSelectTrip(t)}>
        <div style={{ position: 'relative', height: compact ? 100 : 140, background: cardBanner ? `url(${cardBanner}) center/cover` : `linear-gradient(135deg, #1d3550, #3a6a8c)` }}>
          {/* Gradient overlay for text readability */}
          <div className="vacation-card-fade" />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: compact ? '10px 16px' : '14px 18px' }}>
            <div style={{ fontWeight: 600, fontSize: compact ? 15 : 17, color: 'var(--text)', lineHeight: 1.2 }}>{t.name}</div>
            <div style={{ fontSize: compact ? 11 : 12, color: 'var(--text-secondary)', marginTop: 2 }}>{t.location} &middot; {formatDateRange(t.start_date, t.end_date)}</div>
          </div>
        </div>
        <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: 'none', background: 'var(--surface)' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t.member_count || 0} travelers</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {days !== null && days > 0 && days <= 7 && <span style={{ padding: '4px 12px', borderRadius: 12, background: 'var(--warm-light)', color: 'var(--warm)', fontSize: 13, fontWeight: 600 }}>{days} days!</span>}
            {days !== null && days > 7 && <span style={{ padding: '4px 12px', borderRadius: 12, background: 'var(--primary-light)', color: 'var(--primary)', fontSize: 13, fontWeight: 500 }}>{days} days away</span>}
            {days !== null && days === 0 && <span style={{ padding: '4px 12px', borderRadius: 12, background: 'var(--sage-light)', color: 'var(--sage)', fontSize: 13, fontWeight: 600 }}>Today!</span>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="page-vacations">
      {!isDesktop && (
        <div className="topbar">
          <span className="topbar-title">Vacations</span>
          {isAdmin && <button className="btn-add" onClick={() => setShowCreate(true)}><Plus size={13} /> New</button>}
        </div>
      )}
      {isDesktop && (
        <div className="desk-header">
          <div className="desk-header-title">Vacations</div>
          {isAdmin && <button className="btn-add" onClick={() => setShowCreate(true)}><Plus size={13} /> Create vacation</button>}
        </div>
      )}

      <div style={{ padding: isDesktop ? '24px 32px' : '16px 20px' }}>
        {upcoming.length > 0 && (
          <><div className="heading-serif md mb-sm">Upcoming</div>{upcoming.map((t, i) => <TripCard key={t.id} trip={t} idx={i} />)}</>
        )}
        {Object.keys(pastByYear).length > 0 && (
          <><div className="heading-serif md mb-sm" style={{ marginTop: 24 }}>Past vacations</div>
            {Object.entries(pastByYear).sort(([a], [b]) => b.localeCompare(a)).map(([year, yearTrips]) => (
              <div key={year}><div className="label" style={{ color: 'var(--warm)', marginBottom: 8 }}>{year}</div>{yearTrips.map((t, i) => <TripCard key={t.id} trip={t} idx={i + 2} compact />)}</div>
            ))}
          </>
        )}
        {!tripsLoaded && <SkeletonVacationList count={2} />}
        {tripsLoaded && trips.length === 0 && (
          isAdmin
            ? <EmptyState type="vacations" title={msg('emptyStates.vacations.titles')} message={msg('emptyStates.vacations.messages')} action="Let's go" onAction={() => setShowCreate(true)} />
            : <EmptyState type="vacations" title={msg('emptyStates.vacations.titles')} message={msg('emptyStates.vacations.messages')} />
        )}
      </div>

      {showCreate && (
        <Sheet onClose={() => setShowCreate(false)} title="Create a new vacation">
          <div className="form-group"><label className="label">Vacation name</label><input className="form-input" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Traverse City 2026" autoFocus /></div>
          <div className="form-group"><label className="label">Location</label><input className="form-input" value={createForm.location} onChange={e => setCreateForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Traverse City, Michigan" /></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="form-group" style={{ flex: 1 }}><label className="label">Start date</label><input className="form-input" type="date" value={createForm.start_date} onChange={e => setCreateForm(f => ({ ...f, start_date: e.target.value }))} /></div>
            <div className="form-group" style={{ flex: 1 }}><label className="label">End date</label><input className="form-input" type="date" value={createForm.end_date} onChange={e => setCreateForm(f => ({ ...f, end_date: e.target.value }))} /></div>
          </div>
          <button className="btn btn-primary" onClick={handleCreateTrip}><Plus size={14} /> Create vacation</button>
        </Sheet>
      )}
      <Toast message={toast?.msg} type={toast?.type} />
    </div>
  );
}