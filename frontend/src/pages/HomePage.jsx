import { useState, useEffect, useMemo, useCallback } from 'react';
import { Pin, ChevronLeft, ChevronRight, Link as LinkIcon, ThumbUp, Check, MapIcon, Navigation, Globe, Vote, Image, Calendar, Users, Settings, Dollar, Trash, X } from '../components/Icons';
import { Avatar, useApp } from '../App';
import { SkeletonHome } from '../components/Shared';
import { api } from '../utils/api';
import { formatDateRange, formatDate, formatTime12h, t, pick, msg } from '../utils/helpers';
import config from '../config.json';

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

function HeroImage({ trip, bannerUrl, dayTitle, isDarkImage, isAdmin, navigate, theme, a11yMode }) {
  const title = dayTitle || trip?.name || 'GamJo';
  // In dark mode or a11y mode, always use light text (overlay makes bg dark enough)
  const useDark = (theme === 'dark' || a11yMode) ? true : isDarkImage;
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
      <div className="hero-fade" style={{ background: useDark
        ? 'linear-gradient(to top, rgba(10,18,28,.95) 0%, rgba(10,18,28,.7) 35%, rgba(10,18,28,.2) 65%, transparent 100%)'
        : 'linear-gradient(to top, rgba(255,255,255,.97) 0%, rgba(255,255,255,.75) 35%, rgba(255,255,255,.2) 65%, transparent 100%)'
      }} />
      {isAdmin && (
        <button className="hero-settings-btn" onClick={() => navigate('admin')} style={{
          background: useDark ? 'rgba(0,0,0,.3)' : 'rgba(255,255,255,.6)',
        }}>
          <Settings size={18} color={useDark ? '#fff' : 'var(--text)'} />
        </button>
      )}
      <button className="hero-back-btn" onClick={() => navigate('vacations')} style={{
        background: useDark ? 'rgba(0,0,0,.3)' : 'rgba(255,255,255,.6)',
      }}>
        <ChevronLeft size={18} color={useDark ? '#fff' : 'var(--text)'} />
      </button>
      <div className="hero-content">
        <div className="hero-title" style={{ color: useDark ? '#fff' : 'var(--text)', fontWeight: 700, textShadow: useDark ? '0 2px 8px rgba(0,0,0,.5)' : 'none', marginBottom: 14 }}>{title}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: useDark ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.5)', fontSize: 13, fontWeight: 500, textShadow: useDark ? '0 1px 4px rgba(0,0,0,.5)' : 'none' }}><Pin size={14} /><span>{trip?.location || ''}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: useDark ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.5)', fontSize: 13, fontWeight: 500, textShadow: useDark ? '0 1px 4px rgba(0,0,0,.5)' : 'none' }}><Calendar size={14} /><span>{trip ? formatDateRange(trip.start_date, trip.end_date) : ''}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: useDark ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.5)', fontSize: 13, fontWeight: 500, textShadow: useDark ? '0 1px 4px rgba(0,0,0,.5)' : 'none' }}><Users size={14} /><span>{trip?.member_count || 0} travelers</span></div>
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
    <div className="vote-spotlight-card" style={{
      borderRadius: 'var(--radius)',
      padding: '18px 20px', marginBottom: 16,
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
              border: '1px solid var(--vote-border)', background: 'var(--surface)',
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
      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

    // Check cache first (15 min TTL)
    const cacheKey = `weather_${trip.location}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < 15 * 60 * 1000) { setWeather(data); return; }
      } catch {}
    }

    const loc = encodeURIComponent(trip.location.split(',')[0].trim());
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
        const labels = { 0: 'Clear skies', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Foggy', 48: 'Dense fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers', 81: 'Heavy showers', 82: 'Downpour', 95: 'Thunderstorm', 96: 'Thunderstorm w/ hail', 99: 'Severe thunderstorm' };
        let condition = 'clear';
        if (code >= 95) condition = 'thunderstorm';
        else if (code >= 71 && code <= 77) condition = 'snow';
        else if (code >= 51 && code <= 82) condition = 'rain';
        else if (code >= 45 && code <= 48) condition = 'fog';
        else if (code === 3) condition = 'overcast';
        else if (code >= 1 && code <= 2) condition = 'partlyCloudy';
        const weatherData = { temp, label: labels[code] || 'Unknown', code, condition };
        setWeather(weatherData);
        try { sessionStorage.setItem(cacheKey, JSON.stringify({ data: weatherData, ts: Date.now() })); } catch {}
      })
      .catch(() => {});
  }, [trip?.location]);

  if (!weather) return null;

  // Combined temperature + condition commentary
  const wc = config.weatherCommentary;
  const temp = weather.temp;
  const cond = weather.condition;
  let commentary = '';
  if (cond === 'thunderstorm') commentary = pick(wc.thunderstorm);
  else if (cond === 'snow') commentary = pick(wc.snow);
  else if (cond === 'fog') commentary = pick(wc.fog);
  else if (cond === 'rain' && temp <= 50) commentary = pick(wc.rainCold);
  else if (cond === 'rain') commentary = pick(wc.rain);
  else if (temp >= 90) commentary = pick(wc.scorching);
  else if (temp >= 80 && (cond === 'clear' || cond === 'partlyCloudy')) commentary = pick(wc.hotClear);
  else if (temp >= 80) commentary = pick(wc.hot);
  else if (temp <= 40) commentary = pick(wc.freezing);
  else if (temp <= 55 && (cond === 'clear' || cond === 'partlyCloudy')) commentary = pick(wc.coolClear);
  else if (temp <= 55) commentary = pick(wc.cold);
  else if (temp >= 70 && cond === 'clear') commentary = pick(wc.perfectDay);
  else if (cond === 'overcast') commentary = pick(wc.overcast);
  else if (cond === 'partlyCloudy') commentary = pick(wc.partlyCloudy);
  else if (cond === 'clear') commentary = pick(wc.clear);
  else commentary = pick(wc.nice);

  // SVG weather icons using CSS variables
  const icons = {
    clear: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="6" fill="var(--warm)"/>
        <g stroke="var(--warm)" strokeWidth="2" strokeLinecap="round">
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="16" y1="26" x2="16" y2="30"/>
          <line x1="2" y1="16" x2="6" y2="16"/><line x1="26" y1="16" x2="30" y2="16"/>
          <line x1="6.1" y1="6.1" x2="8.9" y2="8.9"/><line x1="23.1" y1="23.1" x2="25.9" y2="25.9"/>
          <line x1="6.1" y1="25.9" x2="8.9" y2="23.1"/><line x1="23.1" y1="8.9" x2="25.9" y2="6.1"/>
        </g>
      </svg>
    ),
    partlyCloudy: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="12" cy="12" r="5" fill="var(--warm)"/>
        <g stroke="var(--warm)" strokeWidth="1.5" strokeLinecap="round">
          <line x1="12" y1="2" x2="12" y2="5"/><line x1="3" y1="12" x2="6" y2="12"/>
          <line x1="5" y1="5" x2="7" y2="7"/><line x1="19" y1="5" x2="17" y2="7"/>
        </g>
        <path d="M10 20C10 16.7 12.7 14 16 14C18.2 14 20.1 15.2 21 17C21.3 17 21.6 17 22 17C24.2 17 26 18.8 26 21C26 23.2 24.2 25 22 25H12C9.8 25 8 23.2 8 21C8 20.3 8.2 19.7 8.5 19.2" fill="var(--text-muted)" opacity=".5"/>
      </svg>
    ),
    overcast: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M8 22C8 18.7 10.7 16 14 16C16.2 16 18.1 17.2 19 19C19.3 19 19.6 19 20 19C22.2 19 24 20.8 24 23C24 25.2 22.2 27 20 27H10C7.8 27 6 25.2 6 23C6 22.3 6.2 21.7 6.5 21.2" fill="var(--text-muted)" opacity=".45"/>
        <path d="M12 18C12 14.7 14.7 12 18 12C20.2 12 22.1 13.2 23 15C23.3 15 23.6 15 24 15C26.2 15 28 16.8 28 19C28 21.2 26.2 23 24 23H14C11.8 23 10 21.2 10 19C10 18.3 10.2 17.7 10.5 17.2" fill="var(--text-muted)" opacity=".6"/>
      </svg>
    ),
    rain: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M10 16C10 12.7 12.7 10 16 10C18.2 10 20.1 11.2 21 13C21.3 13 21.6 13 22 13C24.2 13 26 14.8 26 17C26 19.2 24.2 21 22 21H12C9.8 21 8 19.2 8 17C8 16.3 8.2 15.7 8.5 15.2" fill="var(--primary)" opacity=".35"/>
        <g stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" opacity=".5">
          <line x1="12" y1="23" x2="11" y2="27"/><line x1="16" y1="23" x2="15" y2="28"/>
          <line x1="20" y1="23" x2="19" y2="27"/><line x1="24" y1="23" x2="23" y2="26"/>
        </g>
      </svg>
    ),
    thunderstorm: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M10 14C10 10.7 12.7 8 16 8C18.2 8 20.1 9.2 21 11C21.3 11 21.6 11 22 11C24.2 11 26 12.8 26 15C26 17.2 24.2 19 22 19H12C9.8 19 8 17.2 8 15C8 14.3 8.2 13.7 8.5 13.2" fill="var(--text-muted)" opacity=".55"/>
        <path d="M18 19L15 24H19L16 30" stroke="var(--warm)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <g stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" opacity=".4">
          <line x1="11" y1="21" x2="10" y2="25"/><line x1="22" y1="21" x2="21" y2="25"/>
        </g>
      </svg>
    ),
    snow: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M10 14C10 10.7 12.7 8 16 8C18.2 8 20.1 9.2 21 11C21.3 11 21.6 11 22 11C24.2 11 26 12.8 26 15C26 17.2 24.2 19 22 19H12C9.8 19 8 17.2 8 15C8 14.3 8.2 13.7 8.5 13.2" fill="var(--primary)" opacity=".25"/>
        <g fill="var(--primary)" opacity=".5">
          <circle cx="12" cy="23" r="1.5"/><circle cx="17" cy="22" r="1.5"/>
          <circle cx="22" cy="24" r="1.5"/><circle cx="14" cy="27" r="1.5"/>
          <circle cx="20" cy="27" r="1.5"/>
        </g>
      </svg>
    ),
    fog: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <g stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" opacity=".45">
          <line x1="6" y1="12" x2="26" y2="12"/><line x1="8" y1="17" x2="24" y2="17"/>
          <line x1="6" y1="22" x2="26" y2="22"/><line x1="10" y1="27" x2="22" y2="27"/>
        </g>
      </svg>
    ),
  };

  return (
    <div className="card mb-sm" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flexShrink: 0 }}>{icons[weather.condition] || icons.clear}</div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 16 }}>{weather.temp}{'\u00b0'}F &middot; {weather.label}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{commentary}</div>
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
    const s = { width: 20, height: 20, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
    if (a.action === 'created' && a.entity_type === 'expense') return <div style={{ ...s, background: 'var(--warm-light)' }}><Dollar size={12} color="var(--warm)" /></div>;
    if (a.action === 'deleted') return <div style={{ ...s, background: 'var(--danger-light)' }}><Trash size={12} color="var(--danger)" /></div>;
    if (a.action === 'created' && a.entity_type === 'itinerary') return <div style={{ ...s, background: 'var(--primary-light)' }}><Calendar size={12} color="var(--primary)" /></div>;
    if (a.action === 'restored') return <div style={{ ...s, background: 'var(--sage-light)' }}><Check size={12} color="var(--sage)" /></div>;
    return <div style={{ ...s, background: 'var(--surface-alt)' }}><Calendar size={12} color="var(--text-muted)" /></div>;
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="heading-serif md mb-sm">{headings.recentActivity}</div>
      <div className="card" style={{ padding: '4px 16px' }}>
        {activities.slice(0, 6).map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--surface-alt)', fontSize: 13 }}>
            <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }}>{actionIcon(a)}</span>
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
  const { isDesktop, isAdmin, expenses: ctxExpenses, itinerary: ctxItinerary, media: ctxMedia, refreshItinerary, dataLoaded, theme, a11yMode } = useApp();
  const expenses = propExpenses || ctxExpenses || [];
  const itineraryItems = propItinerary || ctxItinerary || [];
  const photos = propMedia || ctxMedia || [];

  const firstName = user?.name?.split(' ')[0] || 'friend';
  const isNewUser = expenses.filter(e => e.paid_by === user?.id || e.created_by === user?.id).length === 0
    && photos.filter(p => p.uploaded_by === user?.id || p.user_id === user?.id).length === 0;
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    const g = config.greetings;

    // New users get a welcoming neutral tone
    if (isNewUser && g.newUser) {
      return t(pick(g.newUser), { name: firstName });
    }

    // Determine trip status
    if (trip?.start_date && trip?.end_date) {
      const now = new Date();
      const start = new Date(trip.start_date + 'T00:00:00');
      const end = new Date(trip.end_date + 'T23:59:59');
      const msDay = 86400000;

      if (now < start) {
        // Pre-trip: use countdown greetings
        const days = Math.ceil((start - now) / msDay);
        return t(pick(g.preTrip), { name: firstName, days });
      }
      if (now > end) {
        // Post-trip: use post-vacation greetings
        return t(pick(g.postTrip), { name: firstName });
      }
    }

    // Active trip: use time-of-day greetings
    const pool = h >= 20 ? g.evening : h >= 16 ? g.lateAfternoon : h >= 11 ? g.earlyAfternoon : h >= 6 ? g.morning : h >= 3 ? g.middleOfNight : g.lateNight;
    return t(pick(pool), { name: firstName });
  }, [firstName, trip, isNewUser]);

  // Trip countdown / day counter
  const tripContext = useMemo(() => {
    if (!trip?.start_date || !trip?.end_date) return null;
    const now = new Date();
    const start = new Date(trip.start_date + 'T00:00:00');
    const end = new Date(trip.end_date + 'T23:59:59');
    const msDay = 86400000;
    const tc = config.tripContext;
    if (now < start) {
      const days = Math.ceil((start - now) / msDay);
      if (days === 1) return t(tc.tomorrow);
      if (days <= 3) return t(tc.soonDays, { days });
      if (days <= 7) return t(tc.weekAway, { days });
      return t(tc.farAway, { days });
    }
    if (now <= end) {
      const dayNum = Math.floor((now - start) / msDay) + 1;
      const totalDays = Math.floor((end - start) / msDay) + 1;
      if (dayNum === 1) return t(tc.dayOne);
      if (dayNum === totalDays) return t(tc.lastDay);
      return t(tc.midTrip, { day_num: dayNum, total_days: totalDays });
    }
    const daysSince = Math.floor((now - end) / msDay);
    if (daysSince <= 1) return t(tc.justHome);
    if (daysSince <= 7) return t(tc.postTrip, { days: daysSince });
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

  // Config-driven section headings (stable per mount)
  const [headings] = useState(() => ({
    whatsHappening: msg('headings.whatsHappening'),
    theSquad: msg('headings.theSquad'),
    recentActivity: msg('headings.recentActivity'),
  }));

  // Fun facts (expenses, photos, votes)
  const funFact = useMemo(() => {
    const getName = (id) => members.find(m => m.id === id || m.user_id === id)?.name?.split(' ')[0] || 'Someone';
    const ff = config.funFacts;
    const facts = [];

    // Expense facts
    if (expenses.length >= 2) {
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
      if (topPayer && total > 0) {
        const pct = Math.round((topPayer[1] / total) * 100);
        if (pct > 50) facts.push(t(pick(ff.topPayer), { name: getName(topPayer[0]), pct }));
      }
      if (topDayEntry) {
        const dayName = new Date(topDayEntry[0] + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
        facts.push(t(pick(ff.biggestDay), { day_name: dayName, amount: Math.round(topDayEntry[1]) }));
      }
      if (biggestExp && biggestExp.amount >= 50) facts.push(t(pick(ff.biggestExpense), { amount: Math.round(biggestExp.amount), title: biggestExp.title }));
      if (expenses.length >= 5) facts.push(t(pick(ff.expenseCount), { count: expenses.length }));
      const avg = total / expenses.length;
      if (avg > 20) facts.push(t(pick(ff.avgExpense), { amount: Math.round(avg) }));
    }

    // Photo facts
    if (photos.length >= 3) {
      facts.push(t(pick(ff.photoCount), { count: photos.length }));
      const uploaderCounts = {};
      photos.forEach(p => {
        const uid = p.uploaded_by || p.user_id;
        if (uid) uploaderCounts[uid] = (uploaderCounts[uid] || 0) + 1;
      });
      const topUploader = Object.entries(uploaderCounts).sort((a, b) => b[1] - a[1])[0];
      if (topUploader && topUploader[1] >= 3) {
        facts.push(t(pick(ff.topPhotographer), { name: getName(topUploader[0]), count: topUploader[1] }));
      }
    }

    // Vote facts
    if (itineraryItems.length >= 2) {
      const votedItems = itineraryItems.filter(i => (i.likes || 0) + (i.dislikes || 0) > 0);
      if (votedItems.length > 0) {
        const mostVoted = votedItems.sort((a, b) => (b.likes || 0) - (a.likes || 0))[0];
        if (mostVoted.likes >= 2) facts.push(t(pick(ff.mostVoted), { title: mostVoted.title, count: mostVoted.likes }));
      } else if (itineraryItems.length >= 3) {
        facts.push(t(pick(ff.noVotes), { count: itineraryItems.length }));
      }
    }

    return facts.length > 0 ? pick(facts) : null;
  }, [expenses, members, photos, itineraryItems]);

  // Pick a random banner (recalculates when trip changes)
  const [bannerSeed] = useState(() => Math.random());
  const [showOnboarding, setShowOnboarding] = useState(() => user?.onboarded === false);
  const [viewingMember, setViewingMember] = useState(null);
  const bannerUrl = useMemo(() => {
    if (!trip) return null;
    const pool = isDesktop
      ? (trip.desktop_banners?.length ? trip.desktop_banners : trip.mobile_banners || [])
      : (trip.mobile_banners?.length ? trip.mobile_banners : trip.desktop_banners || []);
    if (pool.length > 0) return pool[Math.floor(bannerSeed * pool.length)];
    return trip.banner_url || trip.hero_image_url || null;
  }, [trip?.id, trip?.desktop_banners?.length, trip?.mobile_banners?.length, isDesktop]);

  // Detect if banner image is dark or light for text contrast
  const isDarkImage = useImageBrightness(bannerUrl);
  const useDark = (theme === 'dark' || a11yMode) ? true : isDarkImage;

  const handleVote = async (id) => {
    try {
      await api.post(`/api/trips/${trip.id}/itinerary/${id}/vote`);
      if (refreshItinerary) await refreshItinerary();
    } catch {}
  };

  // Show skeleton while data is loading
  if (!dataLoaded) {
    return <div className="page-home" style={{ padding: '24px 20px' }}><SkeletonHome /></div>;
  }

  if (!trip) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div className="heading-serif lg" style={{ color: 'var(--primary)', marginBottom: 8 }}>GamJo</div>
        <div style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>No active trip right now. Time to plan the next one.</div>
        {isAdmin && <button className="btn btn-primary" style={{ maxWidth: 240, margin: '0 auto' }} onClick={() => navigate('admin')}>Create a vacation</button>}
      </div>
    );
  }

  // Desktop layout
  if (isDesktop) {
    return (
      <div className="page-home">
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
              background: useDark ? 'rgba(0,0,0,.3)' : 'rgba(255,255,255,.6)',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Settings size={18} color={useDark ? '#fff' : 'var(--text)'} />
            </button>
          )}
          <button onClick={() => navigate('vacations')} style={{
            position: 'absolute', top: 16, left: 16, zIndex: 5,
            width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: useDark ? 'rgba(0,0,0,.3)' : 'rgba(255,255,255,.6)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ChevronLeft size={18} color={useDark ? '#fff' : 'var(--text)'} />
          </button>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 200, background: useDark
            ? 'linear-gradient(to top, rgba(10,18,28,.9) 0%, rgba(10,18,28,.6) 35%, rgba(10,18,28,.15) 70%, transparent 100%)'
            : 'linear-gradient(to top, rgba(255,255,255,.95) 0%, rgba(255,255,255,.7) 35%, rgba(255,255,255,.15) 70%, transparent 100%)'
          }} />
          <div className="desk-hero-content">
            <div>
              <div style={{ fontSize: 48, fontWeight: 600, color: useDark ? '#fff' : 'var(--text)', fontFamily: 'var(--font-serif)', lineHeight: 1.05, textShadow: useDark ? '0 2px 8px rgba(0,0,0,.5)' : 'none', marginBottom: 14 }}>{todayDayTitle || trip.name}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, color: useDark ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.5)', textShadow: useDark ? '0 1px 4px rgba(0,0,0,.5)' : 'none' }}><Pin size={15} /> {trip.location}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, color: useDark ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.5)', textShadow: useDark ? '0 1px 4px rgba(0,0,0,.5)' : 'none' }}><Calendar size={15} /> {formatDateRange(trip.start_date, trip.end_date)}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, color: useDark ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.5)', textShadow: useDark ? '0 1px 4px rgba(0,0,0,.5)' : 'none' }}><Users size={15} /> {members.length} travelers</div>
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
              {showOnboarding && (
                <div className="card mb-md" style={{ border: '1px solid var(--primary-light)', background: 'var(--primary-light)' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--primary)', marginBottom: 8 }}>Welcome to GamJo</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
                    Here's the quick tour: use <strong>Itinerary</strong> to plan activities and vote on ideas. Track spending in <strong>Expenses</strong> and we'll handle the group splits. Drop your photos in <strong>Photos</strong> to share with the crew.
                  </div>
                  <button onClick={() => { setShowOnboarding(false); api.patch('/api/auth/me', { onboarded: true }).catch(() => {}); }} className="btn btn-primary" style={{ fontSize: 13, padding: '10px 18px' }}>Got it, let's go</button>
                </div>
              )}
              <div className="heading-serif md mb-sm">{headings.whatsHappening}</div>
              <TodayPlan items={todayEvents} navigate={navigate} />
              <WeatherCard trip={trip} />
              <ActivityFeed tripId={trip?.id} />
            </div>
            <div className="desk-side-col">
              <RentalCard trip={trip} />
              <PolaroidStrip photos={photos} navigate={navigate} />
              <div className="card mb-md trip-total-card" style={{ textAlign: 'center', border: 'none', padding: '28px 22px', color: '#fff' }}>
                <div className="trip-total-label" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Trip total</div>
                <div className="trip-total-amount" style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 400 }}>${stats.totalSpent}</div>
                <div className="trip-total-meta" style={{ fontSize: 13, marginTop: 6 }}>damage so far &middot; {stats.expenseCount} expenses</div>
              </div>
              {funFact && <div className="fun-fact-card">{funFact}</div>}
              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>{headings.theSquad}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))', gap: 6 }}>
                  {members.map(m => (
                    <div key={m.id || m.user_id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: m.avatar_url ? 'pointer' : 'default' }} onClick={() => m.avatar_url && setViewingMember(m)}>
                      <Avatar user={m} size="sm" />
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.2 }}>{m.name?.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="card mt-md" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate('vacations')}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--sage-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Globe size={18} color="var(--sage)" /></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500 }}>All vacations</div><div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Past, present, and future adventures</div></div><ChevronRight size={16} color="var(--text-muted)" />
          </div>
        </div>

        {/* Member photo lightbox */}
        {viewingMember && (
          <div className="sheet-backdrop" onClick={() => setViewingMember(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.85)', zIndex: 300 }}>
            <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: '90vw' }}>
              <button onClick={() => setViewingMember(null)} style={{ alignSelf: 'flex-end', width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={18} color="#fff" /></button>
              <img src={viewingMember.avatar_url} alt={viewingMember.name} style={{ width: 280, height: 280, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 8px 40px rgba(0,0,0,.4)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 600, color: '#fff' }}>{viewingMember.name}</div>
                {viewingMember.email && <div style={{ fontSize: 14, color: 'rgba(255,255,255,.6)', marginTop: 4 }}>{viewingMember.email}</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Mobile layout
  return (
    <div className="page-home">
      <HeroImage trip={trip} bannerUrl={bannerUrl} dayTitle={todayDayTitle} isDarkImage={isDarkImage} isAdmin={isAdmin} navigate={navigate} theme={theme} a11yMode={a11yMode} />
      <div className="hero-panel">
        <div style={{ fontSize: 15, marginBottom: 4 }}>{greeting}</div>
        {tripContext && <div style={{ fontSize: 13, color: 'var(--warm)', marginBottom: 14, fontWeight: 500 }}>{tripContext}</div>}
        {!tripContext && <div style={{ marginBottom: 14 }} />}
        <HighlightedVote vote={activeVote} onVote={handleVote} members={members} userId={user?.id} />
        {showOnboarding && (
          <div className="card mb-md" style={{ border: '1px solid var(--primary-light)', background: 'var(--primary-light)' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--primary)', marginBottom: 8 }}>Welcome to GamJo</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
              Here's the quick tour: use <strong>Itinerary</strong> to plan activities and vote on ideas. Track spending in <strong>Expenses</strong> and we'll handle the group splits. Drop your photos in <strong>Photos</strong> to share with the crew.
            </div>
            <button onClick={() => { setShowOnboarding(false); api.patch('/api/auth/me', { onboarded: true }).catch(() => {}); }} className="btn btn-primary" style={{ fontSize: 13, padding: '10px 18px' }}>Got it, let's go</button>
          </div>
        )}
        <RentalCard trip={trip} />

        <div className="heading-serif md mb-sm">{headings.whatsHappening}</div>
        <TodayPlan items={todayEvents} navigate={navigate} />

        <div className="stat-grid mb-sm">
          <div className="stat-card"><div className="stat-value">${stats.totalSpent}</div><div className="stat-label">damage so far</div></div>
          <div className="stat-card"><div className="stat-value">{stats.photoCount}</div><div className="stat-label">memories captured</div></div>
        </div>
        {funFact && <div className="fun-fact-card">{funFact}</div>}

        <PolaroidStrip photos={photos} navigate={navigate} />

        <WeatherCard trip={trip} />
        <ActivityFeed tripId={trip?.id} />

        <div className="heading-serif md mb-sm">{headings.theSquad}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 8, marginBottom: 16 }}>
          {members.map(m => (
            <div key={m.id || m.user_id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: m.avatar_url ? 'pointer' : 'default' }} onClick={() => m.avatar_url && setViewingMember(m)}>
              <Avatar user={m} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.2 }}>{m.name?.split(' ')[0]}</span>
            </div>
          ))}
        </div>

        {/* #31: Gallery link on mobile */}
        <div className="card mb-sm" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate('gallery')}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Image size={18} color="var(--primary)" /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500 }}>Photo gallery</div><div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{stats.photoCount} memories and counting</div></div><ChevronRight size={16} color="var(--text-muted)" />
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate('vacations')}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--sage-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Globe size={18} color="var(--sage)" /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500 }}>All vacations</div><div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Past, present, and future adventures</div></div><ChevronRight size={16} color="var(--text-muted)" />
        </div>
      </div>

      {/* Member photo lightbox */}
      {viewingMember && (
        <div className="sheet-backdrop" onClick={() => setViewingMember(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.85)', zIndex: 300 }}>
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: '90vw' }}>
            <button onClick={() => setViewingMember(null)} style={{ alignSelf: 'flex-end', width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={18} color="#fff" /></button>
            <img src={viewingMember.avatar_url} alt={viewingMember.name} style={{ width: 280, height: 280, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 8px 40px rgba(0,0,0,.4)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#fff' }}>{viewingMember.name}</div>
              {viewingMember.email && <div style={{ fontSize: 14, color: 'rgba(255,255,255,.6)', marginTop: 4 }}>{viewingMember.email}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}