import { useState, useEffect, useMemo, useCallback } from 'react';
import { Pin, ChevronRight, Link as LinkIcon, ThumbUp, Check, MapIcon, Navigation, Globe, Vote, Image, Calendar, Users, Settings } from '../components/Icons';
import { Avatar, useApp } from '../App';
import { SkeletonHome, WaveDivider } from '../components/Shared';
import { api } from '../utils/api';
import { formatDateRange, formatDate, formatTime12h } from '../utils/helpers';

// Analyze banner image brightness to decide text color
function useImageBrightness(url) {
  const [isDark, setIsDark] = useState(true); // default: assume dark image, use white text
  useEffect(() => {
    if (!url) { setIsDark(true); return; }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 80;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        // Sample bottom-left quadrant where text overlays
        const srcX = 0;
        const srcY = img.naturalHeight * 0.5;
        const srcW = img.naturalWidth * 0.5;
        const srcH = img.naturalHeight * 0.5;
        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        let total = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          count++;
        }
        const avg = total / count;
        setIsDark(avg < 140); // below 140 = dark image = use white text
      } catch { setIsDark(true); }
    };
    img.onerror = () => setIsDark(true);
    img.src = url;
  }, [url]);
  return isDark;
}

function HeroImage({ trip, bannerUrl, dayTitle, isDarkImage, isAdmin, navigate }) {
  const title = dayTitle || trip?.name || 'Gamjo';
  return (
    <div className="hero-image">
      {bannerUrl ? (
        <img src={bannerUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div className="hero-trees">
          <div className="hero-tree" style={{ left: -20, top: -45, width: 90, height: 115, borderRadius: '0 30px 0 0' }} />
          <div className="hero-tree" style={{ left: 35, top: -60, width: 45, height: 130, borderRadius: '0 15px 0 0' }} />
          <div className="hero-tree" style={{ right: -10, top: -35, width: 70, height: 105, borderRadius: '30px 0 0 0' }} />
          <div className="hero-tree" style={{ right: 45, top: -50, width: 35, height: 120, borderRadius: '12px 12px 0 0' }} />
          <div className="hero-tree" style={{ left: 130, top: -20, width: 25, height: 90, borderRadius: '8px 8px 0 0' }} />
        </div>
      )}
      <div className="hero-fade" style={{ background: isDarkImage
        ? 'linear-gradient(to top, rgba(10,18,28,.95) 0%, rgba(10,18,28,.7) 35%, rgba(10,18,28,.2) 65%, transparent 100%)'
        : 'linear-gradient(to top, rgba(255,255,255,.97) 0%, rgba(255,255,255,.75) 35%, rgba(255,255,255,.2) 65%, transparent 100%)'
      }} />
      {isAdmin && (
        <button className="hero-settings-btn" onClick={() => navigate('admin')} style={{
          background: isDarkImage ? 'rgba(0,0,0,.3)' : 'rgba(255,255,255,.6)',
        }}>
          <Settings size={18} color={isDarkImage ? '#fff' : 'var(--text)'} />
        </button>
      )}
      <div className="hero-content">
        <div className="hero-title" style={{ color: isDarkImage ? '#fff' : 'var(--text)', fontWeight: 700, textShadow: isDarkImage ? '0 2px 8px rgba(0,0,0,.5)' : 'none', marginBottom: 14 }}>{title}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: isDarkImage ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.5)', fontSize: 13, fontWeight: 500, textShadow: isDarkImage ? '0 1px 4px rgba(0,0,0,.5)' : 'none' }}><Pin size={14} /><span>{trip?.location || ''}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: isDarkImage ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.5)', fontSize: 13, fontWeight: 500, textShadow: isDarkImage ? '0 1px 4px rgba(0,0,0,.5)' : 'none' }}><Calendar size={14} /><span>{trip ? formatDateRange(trip.start_date, trip.end_date) : ''}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: isDarkImage ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.5)', fontSize: 13, fontWeight: 500, textShadow: isDarkImage ? '0 1px 4px rgba(0,0,0,.5)' : 'none' }}><Users size={14} /><span>{trip?.member_count || 0} travelers</span></div>
        </div>
      </div>
    </div>
  );
}

function HighlightedVote({ vote, onVote, members, userId }) {
  const [dismissed, setDismissed] = useState(false);
  const [justVoted, setJustVoted] = useState(false);

  if (!vote || dismissed) return null;

  // Check if this user already voted or dismissed this specific vote
  const storageKey = `vote-dismissed-${vote.id}-${userId}`;
  const alreadyDismissed = typeof window !== 'undefined' && sessionStorage.getItem(storageKey);
  if (alreadyDismissed || vote.user_voted) {
    if (!justVoted) return null;
  }

  const voterNames = Object.keys(vote.votes || {}).map(uid =>
    members?.find(m => (m.id || m.user_id) === uid)?.name?.split(' ')[0]
  ).filter(Boolean);
  const voteCount = vote.vote_count || Object.keys(vote.votes || {}).length || 0;

  const dateStr = vote.date ? formatDate(vote.date) : null;
  const timeStr = formatTime12h(vote.time);
  const whenStr = dateStr ? (timeStr ? `${dateStr} at ${timeStr}` : dateStr) : null;

  const handleVoteYes = async () => {
    await onVote(vote.id);
    setJustVoted(true);
    setTimeout(() => {
      sessionStorage.setItem(storageKey, '1');
      setDismissed(true);
    }, 1500);
  };

  const handleDismiss = () => {
    sessionStorage.setItem(storageKey, '1');
    setDismissed(true);
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #FDF6E7, #FFF8ED)', borderRadius: 'var(--radius)',
      padding: '18px 20px', marginBottom: 16, boxShadow: '0 2px 12px rgba(139, 112, 50, 0.12)',
      border: '1px solid var(--vote-border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Vote size={18} color="var(--vote-text)" />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--vote-text)', letterSpacing: '0.03em' }}>VOTE NEEDED</span>
      </div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>{vote.title}</div>
      {vote.description && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>{vote.description}</div>}
      {whenStr && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{whenStr}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: voterNames.length > 0 ? 10 : 0 }}>
        {!justVoted ? (
          <>
            <button onClick={handleVoteYes} style={{
              flex: 1, padding: '11px 0', borderRadius: 'var(--radius-sm)', border: 'none',
              background: 'var(--sage)', color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}><ThumbUp size={16} /> I'm in</button>
            <button onClick={handleDismiss} style={{
              flex: 1, padding: '11px 0', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--vote-border)', background: 'rgba(255,255,255,.6)',
              color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
            }}>Not for me</button>
          </>
        ) : (
          <div style={{ flex: 1, padding: '11px 0', textAlign: 'center', color: 'var(--sage)', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <Check size={16} /> You're in! {voteCount} {voteCount === 1 ? 'vote' : 'votes'}
          </div>
        )}
      </div>
      {voterNames.length > 0 && !justVoted && (
        <div style={{ fontSize: 13, color: 'var(--vote-text)' }}>
          {voterNames.join(', ')} {voterNames.length === 1 ? 'is' : 'are'} in
        </div>
      )}
    </div>
  );
}

function TodayPlan({ items, navigate }) {
  if (!items || items.length === 0) return (
    <div className="card mb-md" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
      Nothing left on the schedule. Grab a drink and relax. Check the <span style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 500 }} onClick={() => navigate('itinerary')}>full itinerary</span>.
    </div>
  );
  const openMaps = (loc, mode) => {
    if (!loc) return;
    const q = encodeURIComponent(loc);
    if (mode === 'directions') window.open(`https://maps.google.com/maps/dir/?api=1&destination=${q}`, '_blank');
    else window.open(`https://maps.google.com/maps/search/?api=1&query=${q}`, '_blank');
  };
  return (
    <>
      {items.map(item => (
        <div key={item.id} className="card mb-sm" style={{ cursor: 'pointer' }} onClick={() => navigate('itinerary')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 15 }}>{item.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
                {formatTime12h(item.time)}{item.description ? ` \u00b7 ${item.description.slice(0, 60)}` : ''}
              </div>
            </div>
            {item.status === 'final' && <span className="badge badge-confirmed"><Check size={10} /> Confirmed</span>}
          </div>
          {item.location && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }} onClick={e => e.stopPropagation()}>
              <button className="btn-sm btn-ghost" onClick={() => openMaps(item.location, 'search')} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--primary-light)', color: 'var(--primary)', border: 'none' }}>
                <MapIcon size={14} /> Map
              </button>
              <button className="btn-sm btn-ghost" onClick={() => openMaps(item.location, 'directions')} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Navigation size={14} /> Directions
              </button>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function RentalCard({ trip }) {
  if (!trip?.rental_url) return null;
  return (
    <div className="card mb-md" style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => window.open(trip.rental_url, '_blank')}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, var(--primary-light), #d4dfe8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LinkIcon size={18} color="var(--primary)" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, fontSize: 14 }}>{trip.rental_title || 'View Rental'}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>View rental listing</div>
      </div>
      <ChevronRight size={16} color="var(--text-muted)" />
    </div>
  );
}

function PolaroidStrip({ photos, navigate }) {
  const recent = photos.filter(p => p.url).slice(-4).reverse();
  if (recent.length === 0) return null;
  const rotations = [-2.5, 1.5, -1, 2];
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="heading-serif md mb-sm">Recent snaps</div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8, WebkitOverflowScrolling: 'touch' }}>
        {recent.map((p, i) => (
          <div key={p.id} onClick={() => navigate('gallery')} style={{
            flexShrink: 0, width: 120, background: 'var(--surface)', borderRadius: 8,
            boxShadow: 'var(--shadow-md)', padding: '6px 6px 8px', cursor: 'pointer',
            transform: `rotate(${rotations[i % 4]}deg)`, transition: 'transform 0.2s',
          }}>
            <img src={p.url} alt="" style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Weather Card (Open-Meteo, free, no API key) ──
function WeatherCard({ trip }) {
  const [weather, setWeather] = useState(null);
  useEffect(() => {
    if (!trip?.location) return;
    const loc = encodeURIComponent(trip.location);
    fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${loc}&count=1`)
      .then(r => r.json())
      .then(geo => {
        if (!geo.results?.[0]) return;
        const { latitude, longitude } = geo.results[0];
        return fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=fahrenheit&forecast_days=1`);
      })
      .then(r => r?.json())
      .then(data => {
        if (!data?.current) return;
        const code = data.current.weather_code;
        const temp = Math.round(data.current.temperature_2m);
        const labels = { 0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Foggy', 48: 'Fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Showers', 81: 'Showers', 82: 'Heavy showers', 95: 'Thunderstorm' };
        setWeather({ temp, label: labels[code] || 'Unknown', code });
      })
      .catch(() => {});
  }, [trip?.location]);

  if (!weather) return null;
  const isNice = weather.code <= 3;

  return (
    <div className="card mb-sm" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 28, lineHeight: 1 }}>{isNice ? '\u2600\uFE0F' : weather.code >= 61 ? '\u{1F327}\uFE0F' : '\u2601\uFE0F'}</div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 16 }}>{weather.temp}\u00b0F</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{weather.label} in {trip?.location}</div>
      </div>
    </div>
  );
}

// ── Activity Feed ──
function ActivityFeed({ tripId }) {
  const [activities, setActivities] = useState([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!tripId) return;
    api.get(`/api/trips/${tripId}/activity?limit=8`)
      .then(r => { setActivities(Array.isArray(r.data) ? r.data : []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [tripId]);

  if (!loaded || activities.length === 0) return null;

  const timeAgo = (iso) => {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const actionIcon = (a) => {
    if (a.action === 'created' && a.entity_type === 'expense') return '\uD83D\uDCB0';
    if (a.action === 'deleted') return '\uD83D\uDDD1\uFE0F';
    if (a.action === 'created' && a.entity_type === 'itinerary') return '\uD83D\uDCC5';
    if (a.action === 'restored') return '\u267B\uFE0F';
    return '\uD83D\uDD14';
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="heading-serif md mb-sm">Recent activity</div>
      <div className="card" style={{ padding: '4px 16px' }}>
        {activities.slice(0, 6).map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--surface-alt)', fontSize: 13 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{actionIcon(a)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 500 }}>{a.user_name?.split(' ')[0]}</span>{' '}
              <span style={{ color: 'var(--text-secondary)' }}>{a.summary}</span>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>{timeAgo(a.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// #29: Vacation status indicator

export default function HomePage({ trip, members, user, navigate, expenses: propExpenses, itinerary: propItinerary, media: propMedia }) {
  const { isDesktop, isAdmin, expenses: ctxExpenses, itinerary: ctxItinerary, media: ctxMedia, refreshItinerary, dataLoaded } = useApp();
  const expenses = propExpenses || ctxExpenses || [];
  const itineraryItems = propItinerary || ctxItinerary || [];
  const photos = propMedia || ctxMedia || [];

  const firstName = user?.name?.split(' ')[0] || 'friend';
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    const morning = [
      `Morning, ${firstName}. Coffee first, plans later.`,
      `Rise and shine, ${firstName}`,
      `Good morning, ${firstName}. Who's making breakfast?`,
    ];
    const earlyAfternoon = [
      `Good afternoon, ${firstName}`,
      `Hey ${firstName}. What's the move?`,
      `Afternoon, ${firstName}. Nap or adventure?`,
    ];
    const lateAfternoon = [
      `It's 5 o'clock somewhere. Oh wait, it is here too.`,
      `${firstName}, the sun's going down and the drinks are going up.`,
      `Happy hour, ${firstName}. You've earned it.`,
    ];
    const evening = [
      `Evening, ${firstName}. It's officially cocktail hour.`,
      `Good evening, ${firstName}. Who's pouring?`,
      `Cheers, ${firstName}. What are we drinking?`,
    ];
    const lateNight = [
      `Still up, ${firstName}? Hydrate.`,
      `${firstName}. Water. Now.`,
      `It's late, ${firstName}. One more won't hurt... right?`,
    ];
    const pool = h < 6 ? lateNight : h < 12 ? morning : h < 17 ? earlyAfternoon : h < 19 ? lateAfternoon : h < 23 ? evening : lateNight;
    return pool[Math.floor(Math.random() * pool.length)];
  }, [firstName]);

  // Trip countdown / day counter
  const tripContext = useMemo(() => {
    if (!trip?.start_date || !trip?.end_date) return null;
    const now = new Date();
    const start = new Date(trip.start_date + 'T00:00:00');
    const end = new Date(trip.end_date + 'T23:59:59');
    const msDay = 86400000;
    if (now < start) {
      const days = Math.ceil((start - now) / msDay);
      if (days === 1) return "Tomorrow's the day! Bags packed?";
      if (days <= 3) return `${days} days out. Don't forget the sunscreen.`;
      if (days <= 7) return `${days} days until we're outta here`;
      return `${days} days to go. Start the countdown.`;
    }
    if (now <= end) {
      const dayNum = Math.floor((now - start) / msDay) + 1;
      const totalDays = Math.floor((end - start) / msDay) + 1;
      if (dayNum === 1) return "Day 1. Let's make it count!";
      if (dayNum === totalDays) return `Last day. Make it a good one.`;
      return `Day ${dayNum} of ${totalDays}`;
    }
    const daysSince = Math.floor((now - end) / msDay);
    if (daysSince <= 1) return "Just got home. Reality hits different.";
    if (daysSince <= 7) return `${daysSince} days since vacation. Withdrawal symptoms kicking in yet?`;
    return null;
  }, [trip]);

  // Derive today's day title and today's events separately
  const today = new Date().toISOString().split('T')[0];
  const todayDayTitle = (trip?.day_titles || {})[today] || null;
  const todayEvents = useMemo(() => {
    const events = itineraryItems.filter(i => i.date === today);
    const nowH = new Date().getHours();
    const nowM = new Date().getMinutes();
    return events.filter(e => {
      if (!e.time) return true;
      const [h, m] = e.time.split(':').map(Number);
      return h > nowH || (h === nowH && m >= nowM);
    }).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  }, [itineraryItems, today]);
  const activeVote = useMemo(() => itineraryItems.find(i => i.status === 'voting' && i.pushed), [itineraryItems]);
  const stats = useMemo(() => ({
    totalSpent: expenses.reduce((s, e) => s + (e.amount || 0), 0).toFixed(0),
    expenseCount: expenses.length,
    photoCount: photos.length,
  }), [expenses, photos]);

  // Fun expense fact
  const funFact = useMemo(() => {
    if (expenses.length < 2) return null;
    const getName = (id) => members.find(m => m.id === id || m.user_id === id)?.name?.split(' ')[0] || 'Someone';
    const payerTotals = {};
    let biggestDay = {}, biggestExp = null;
    expenses.forEach(e => {
      payerTotals[e.paid_by] = (payerTotals[e.paid_by] || 0) + (e.amount || 0);
      if (e.date) biggestDay[e.date] = (biggestDay[e.date] || 0) + (e.amount || 0);
      if (!biggestExp || (e.amount || 0) > (biggestExp.amount || 0)) biggestExp = e;
    });
    const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const topPayer = Object.entries(payerTotals).sort((a, b) => b[1] - a[1])[0];
    const topDayEntry = Object.entries(biggestDay).sort((a, b) => b[1] - a[1])[0];
    const facts = [];
    if (topPayer && total > 0) {
      const pct = Math.round((topPayer[1] / total) * 100);
      if (pct > 50) facts.push(`${getName(topPayer[0])} is carrying ${pct}% of the tab. Legend.`);
    }
    if (topDayEntry) {
      const dayName = new Date(topDayEntry[0] + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
      facts.push(`Biggest day: ${dayName} ($${Math.round(topDayEntry[1])}). What happened?`);
    }
    if (biggestExp && biggestExp.amount >= 50) facts.push(`Biggest single expense: $${Math.round(biggestExp.amount)} on "${biggestExp.title}".`);
    if (expenses.length >= 5) facts.push(`${expenses.length} expenses and counting. The receipts don't lie.`);
    const avg = total / expenses.length;
    if (avg > 20) facts.push(`Average expense: $${Math.round(avg)}. That's a lot of appetizers.`);
    return facts.length > 0 ? facts[Math.floor(Math.random() * facts.length)] : null;
  }, [expenses, members]);

  // Pick a random banner on mount (changes on each page load, not a rotator)
  const [bannerUrl] = useState(() => {
    if (!trip) return null;
    const pool = isDesktop
      ? (trip.desktop_banners?.length ? trip.desktop_banners : trip.mobile_banners || [])
      : (trip.mobile_banners?.length ? trip.mobile_banners : trip.desktop_banners || []);
    if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)];
    return trip.banner_url || trip.hero_image_url || null;
  });

  // Detect if banner image is dark or light for text contrast
  const isDarkImage = useImageBrightness(bannerUrl);

  const handleVote = async (id) => {
    try {
      await api.post(`/api/trips/${trip.id}/itinerary/${id}/vote`);
      if (refreshItinerary) await refreshItinerary();
    } catch {}
  };

  if (!trip) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div className="heading-serif lg" style={{ color: 'var(--primary)', marginBottom: 8 }}>Gamjo</div>
        <div style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>No active trip right now. Time to plan the next one.</div>
        {isAdmin && <button className="btn btn-primary" style={{ maxWidth: 240, margin: '0 auto' }} onClick={() => navigate('admin')}>Create a vacation</button>}
      </div>
    );
  }

  // Desktop layout
  if (isDesktop) {
    return (
      <div>
        <div className="desk-hero">
          {bannerUrl ? <img src={bannerUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : (
            <>
              <div style={{ position: 'absolute', left: 0, top: 100, width: 120, height: 180, background: '#122236', borderRadius: '0 40px 0 0' }} />
              <div style={{ position: 'absolute', left: 60, top: 80, width: 60, height: 200, background: '#182d45', borderRadius: '0 20px 0 0' }} />
              <div style={{ position: 'absolute', right: 0, top: 110, width: 100, height: 170, background: '#122236', borderRadius: '40px 0 0 0' }} />
            </>
          )}
          {isAdmin && (
            <button className="hero-settings-btn" onClick={() => navigate('admin')} style={{
              zIndex: 5,
              width: 38, height: 38, borderRadius: '50%',
              background: isDarkImage ? 'rgba(0,0,0,.3)' : 'rgba(255,255,255,.6)',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Settings size={18} color={isDarkImage ? '#fff' : 'var(--text)'} />
            </button>
          )}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 200, background: isDarkImage
            ? 'linear-gradient(to top, rgba(10,18,28,.9) 0%, rgba(10,18,28,.6) 35%, rgba(10,18,28,.15) 70%, transparent 100%)'
            : 'linear-gradient(to top, rgba(255,255,255,.95) 0%, rgba(255,255,255,.7) 35%, rgba(255,255,255,.15) 70%, transparent 100%)'
          }} />
          <div className="desk-hero-content">
            <div>
              <div style={{ fontSize: 48, fontWeight: 600, color: isDarkImage ? '#fff' : 'var(--text)', fontFamily: 'var(--font-serif)', lineHeight: 1.05, textShadow: isDarkImage ? '0 2px 8px rgba(0,0,0,.5)' : 'none', marginBottom: 14 }}>{todayDayTitle || trip.name}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, color: isDarkImage ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.5)', textShadow: isDarkImage ? '0 1px 4px rgba(0,0,0,.5)' : 'none' }}><Pin size={15} /> {trip.location}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, color: isDarkImage ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.5)', textShadow: isDarkImage ? '0 1px 4px rgba(0,0,0,.5)' : 'none' }}><Calendar size={15} /> {formatDateRange(trip.start_date, trip.end_date)}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, color: isDarkImage ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.5)', textShadow: isDarkImage ? '0 1px 4px rgba(0,0,0,.5)' : 'none' }}><Users size={15} /> {members.length} travelers</div>
              </div>
            </div>
          </div>
        </div>
        <div className="desk-content">
          <div className="desk-two-col">
            <div className="desk-main-col">
              <div style={{ fontSize: 15, marginBottom: 4 }}>{greeting}</div>
              {tripContext && <div style={{ fontSize: 13, color: 'var(--warm)', marginBottom: 14, fontWeight: 500 }}>{tripContext}</div>}
              {!tripContext && <div style={{ marginBottom: 14 }} />}
              <HighlightedVote vote={activeVote} onVote={handleVote} members={members} userId={user?.id} />
              <div className="heading-serif md mb-sm">What's happening</div>
              <TodayPlan items={todayEvents} navigate={navigate} />
              <WeatherCard trip={trip} />
              <ActivityFeed tripId={trip?.id} />
            </div>
            <div className="desk-side-col">
              <RentalCard trip={trip} />
              <PolaroidStrip photos={photos} navigate={navigate} />
              <div className="card mb-md" style={{ textAlign: 'center', background: 'linear-gradient(135deg, #FDF6E7, #F9E8D0)', border: 'none' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 400, color: 'var(--warm)' }}>${stats.totalSpent}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>damage so far &middot; {stats.expenseCount} expenses</div>
                {funFact && <div style={{ fontSize: 13, color: 'var(--warm)', fontStyle: 'italic', marginTop: 8 }}>{funFact}</div>}
              </div>
              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>The squad</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))', gap: 6 }}>
                  {members.map(m => (
                    <div key={m.id || m.user_id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <Avatar user={m} size="sm" />
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.2 }}>{m.name?.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="card mt-md" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate('vacations')}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, var(--sage-light), #D4E8DC)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Globe size={18} color="var(--sage)" /></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500 }}>All vacations</div><div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Past, present, and future adventures</div></div><ChevronRight size={16} color="var(--text-muted)" />
          </div>
        </div>
      </div>
    );
  }

  // Mobile layout
  return (
    <div>
      <HeroImage trip={trip} bannerUrl={bannerUrl} dayTitle={todayDayTitle} isDarkImage={isDarkImage} isAdmin={isAdmin} navigate={navigate} />
      <div className="hero-panel">
        {!dataLoaded && members.length === 0 ? <SkeletonHome /> : <>
        <div style={{ fontSize: 15, marginBottom: 4 }}>{greeting}</div>
        {tripContext && <div style={{ fontSize: 13, color: 'var(--warm)', marginBottom: 14, fontWeight: 500 }}>{tripContext}</div>}
        {!tripContext && <div style={{ marginBottom: 14 }} />}
        <HighlightedVote vote={activeVote} onVote={handleVote} members={members} userId={user?.id} />
        <RentalCard trip={trip} />

        <div className="heading-serif md mb-sm">What's happening</div>
        <TodayPlan items={todayEvents} navigate={navigate} />

        <div className="stat-grid mb-sm">
          <div className="stat-card"><div className="stat-value">${stats.totalSpent}</div><div className="stat-label">damage so far</div></div>
          <div className="stat-card"><div className="stat-value">{stats.photoCount}</div><div className="stat-label">memories captured</div></div>
        </div>
        {funFact && <div style={{ fontSize: 13, color: 'var(--warm)', fontStyle: 'italic', marginBottom: 16, paddingLeft: 2 }}>{funFact}</div>}

        <PolaroidStrip photos={photos} navigate={navigate} />

        <WeatherCard trip={trip} />
        <ActivityFeed tripId={trip?.id} />

        <div className="heading-serif md mb-sm">The squad</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 8, marginBottom: 16 }}>
          {members.map(m => (
            <div key={m.id || m.user_id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <Avatar user={m} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.2 }}>{m.name?.split(' ')[0]}</span>
            </div>
          ))}
        </div>

        {/* #31: Gallery link on mobile */}
        <div className="card mb-sm" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate('gallery')}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, var(--primary-light), #D6E4F0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Image size={18} color="var(--primary)" /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500 }}>Photo gallery</div><div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{stats.photoCount} memories and counting</div></div><ChevronRight size={16} color="var(--text-muted)" />
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate('vacations')}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, var(--sage-light), #D4E8DC)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Globe size={18} color="var(--sage)" /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500 }}>All vacations</div><div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Past, present, and future adventures</div></div><ChevronRight size={16} color="var(--text-muted)" />
        </div>
        </>}
      </div>
    </div>
  );
}