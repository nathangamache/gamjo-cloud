import { useState, useEffect, createContext, useContext, useCallback, useMemo } from 'react';
import { Home, Dollar, Camera, User, Shield, Globe, LogOut, Calendar } from './components/Icons';
import { useAuth } from './hooks/useAuth';
import { useConfirm } from './components/Shared';
import { api } from './utils/api';
import { getTripStatus, msg } from './utils/helpers';
import LoginPage from './pages/LoginPage';
import VerifyPage from './pages/VerifyPage';
import NotFoundPage from './pages/NotFoundPage';
import HomePage from './pages/HomePage';
import ItineraryPage from './pages/ItineraryPage';
import ExpensesPage from './pages/ExpensesPage';
import PhotosPage from './pages/PhotosPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import GlobalAdminPage from './pages/GlobalAdminPage';
import VacationsPage from './pages/VacationsPage';
import GalleryPage from './pages/GalleryPage';
import './index.css';
const AppContext = createContext();
export const useApp = () => useContext(AppContext);
const AVATAR_COLORS = ['#1E3A5F','#B8845F','#7A9E8E','#C4584A','#5B4A6F','#3D6E5A','#8B6E4E','#4A6E80','#6E5B3D','#804A5A','#3D5A6E','#6E804A','#5A3D4A'];
export function getAvatarColor(id) {
  const num = typeof id === 'number' ? id : parseInt(String(id).replace(/\D/g, '') || '0', 10);
  return AVATAR_COLORS[num % AVATAR_COLORS.length];
}
export function getInitials(name) {
  if (!name) return '?';
  const p = name.trim().split(' ');
  return p.length > 1 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}
export function Avatar({ user, size = '', className = '' }) {
  const s = { sm: 'sm', lg: 'lg', xl: 'xl' }[size] || '';
  const photo = user?.avatar_url;
  return (
    <div className={`avatar ${s} ${className}`} style={{ background: getAvatarColor(user?.id || 0) }}>
      {photo ? <img src={photo} alt={user?.name || ''} /> : getInitials(user?.name || user?.email || '?')}
    </div>
  );
}
function parseRoute() {
  const p = window.location.pathname;
  if (p === '/verify') return { tripId: null, page: 'verify', adminTab: 0 };
  if (p === '/profile') return { tripId: null, page: 'profile', adminTab: 0 };
  if (p === '/' || p === '/home') return { tripId: null, page: 'home', adminTab: 0 };
  if (p === '/vacations') return { tripId: null, page: 'vacations', adminTab: 0 };
  if (p === '/admin') return { tripId: null, page: 'global-admin', adminTab: 0 };
  const m = p.match(/^\/vacation\/([a-f0-9-]+)(?:\/(.*))?$/);
  if (m) {
    const tripId = m[1];
    const rest = m[2] || '';
    if (!rest || rest === '') return { tripId, page: 'trip-home', adminTab: 0 };
    if (rest === 'itinerary') return { tripId, page: 'itinerary', adminTab: 0 };
    if (rest === 'expenses') return { tripId, page: 'expenses', adminTab: 0 };
    if (rest === 'photos') return { tripId, page: 'photos', adminTab: 0 };
    if (rest === 'gallery') return { tripId, page: 'gallery', adminTab: 0 };
    if (rest === 'profile') return { tripId, page: 'trip-profile', adminTab: 0 };
    if (rest === 'admin' || rest === 'admin/overview') return { tripId, page: 'admin', adminTab: 0 };
    if (rest === 'admin/people') return { tripId, page: 'admin', adminTab: 1 };
    if (rest === 'admin/groups') return { tripId, page: 'admin', adminTab: 2 };
    if (rest === 'admin/trip') return { tripId, page: 'admin', adminTab: 3 };
    return { tripId: null, page: '404', adminTab: 0 };
  }
  return { tripId: null, page: '404', adminTab: 0 };
}
function buildPath(page, tripId, adminTab) {
  if (!tripId) {
    if (page === 'home') return '/';
    if (page === 'vacations') return '/vacations';
    if (page === 'profile') return '/profile';
    if (page === 'global-admin') return '/admin';
    return '/';
  }
  const base = `/vacation/${tripId}`;
  if (page === 'trip-home' || page === 'home') return base;
  if (page === 'admin') return `${base}/admin/${['overview', 'people', 'groups', 'trip'][adminTab || 0]}`;
  if (page === 'trip-profile') return `${base}/profile`;
  return `${base}/${page}`;
}
function isTripNear(trip) {
  if (!trip?.end_date) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(trip.start_date + 'T00:00:00');
  const grace = new Date(trip.end_date + 'T23:59:59');
  grace.setDate(grace.getDate() + 30);
  return today >= start && today <= grace;
}
function isTripCurrent(trip) {
  if (!trip?.start_date || !trip?.end_date) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(trip.start_date + 'T00:00:00');
  const end = new Date(trip.end_date + 'T23:59:59');
  return today >= start && today <= end;
}
const NAV_ITEMS = [
  { id: 'trip-home', label: 'Home', icon: Home },
  { id: 'itinerary', label: 'Itinerary', icon: Calendar },
  { id: 'expenses', label: 'Expenses', icon: Dollar },
  { id: 'photos', label: 'Photos', icon: Camera },
  { id: 'trip-profile', label: 'Profile', icon: User },
];
const HOME_NAV = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'global-admin', label: 'Admin', icon: Shield, adminOnly: true },
];
function MobileNav({ tab, navigate, isAdmin, isGlobalAdmin, inTrip }) {
  const items = (inTrip ? NAV_ITEMS.filter(i => !i.adminOnly || isAdmin) : HOME_NAV.filter(i => !i.adminOnly || isGlobalAdmin));
  return (
    <nav className="mobile-nav">
      {items.map(item => (
        <button key={item.id} className={`mobile-nav-item ${(tab === item.id || (item.id === 'trip-home' && tab === 'home')) ? 'active' : ''}`} onClick={() => navigate(item.id)}>
          <item.icon size={22} /><span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
function DesktopSidebar({ tab, navigate, user, isAdmin, isGlobalAdmin, onLogout, inTrip }) {
  const items = (inTrip ? NAV_ITEMS.filter(i => !i.adminOnly || isAdmin) : HOME_NAV.filter(i => !i.adminOnly || isGlobalAdmin));
  return (
    <aside className="desktop-sidebar">
      <div className="sidebar-logo">GamJo</div>
      <div className="sidebar-user">
        <Avatar user={user} />
        <div><div className="sidebar-user-name">{user?.name || 'User'}</div></div>
      </div>
      <nav className="sidebar-nav">
        {items.map(item => (
          <button key={item.id} className={`sidebar-nav-item ${(tab === item.id || (item.id === 'trip-home' && tab === 'home')) ? 'active' : ''}`} onClick={() => navigate(item.id)}>
            <item.icon size={20} /><span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        {inTrip && (
          <>
            {isAdmin && (
              <button className={`sidebar-nav-item ${tab === 'admin' ? 'active' : ''}`} onClick={() => navigate('admin')}>
                <Shield size={18} /><span style={{ fontSize: 13 }}>Trip settings</span>
              </button>
            )}
            <button className={`sidebar-nav-item ${tab === 'vacations' ? 'active' : ''}`} onClick={() => navigate('vacations')}>
              <Globe size={18} /><span style={{ fontSize: 13 }}>All vacations</span>
            </button>
          </>
        )}
        <button className="sidebar-nav-item" style={{ color: 'var(--danger)' }} onClick={onLogout}>
          <LogOut size={18} /><span style={{ fontSize: 13 }}>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
export default function App() {
  const { user, loading, login, logout, setUser } = useAuth();
  const confirm = useConfirm();
  const initRoute = parseRoute();
  const [page, setPage] = useState(initRoute.page);
  const [adminTab, setAdminTab] = useState(initRoute.adminTab);
  const [urlTripId, setUrlTripId] = useState(initRoute.tripId);
  const [trip, setTrip] = useState(null);
  const [allTrips, setAllTrips] = useState([]);
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [itinerary, setItinerary] = useState([]);
  const [media, setMedia] = useState([]);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [theme, setThemeState] = useState(() => localStorage.getItem('gamjo-theme') || 'light');
  const [reduceMotion, setReduceMotionState] = useState(() => localStorage.getItem('gamjo-reduce-motion') === 'true');
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setThemeState(next);
    localStorage.setItem('gamjo-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };
  const toggleReduceMotion = () => {
    const next = !reduceMotion;
    setReduceMotionState(next);
    localStorage.setItem('gamjo-reduce-motion', String(next));
    document.documentElement.setAttribute('data-reduce-motion', String(next));
  };
  // Apply on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-reduce-motion', String(reduceMotion));
  }, []);
  const activeTrip = trip && isTripCurrent(trip);
  const singleActiveTrip = activeTrip && allTrips.filter(t => isTripCurrent(t)).length === 1;
  const inTrip = !!trip && (
    ['trip-home', 'itinerary', 'expenses', 'photos', 'gallery', 'trip-profile', 'admin'].includes(page)
    || (page === 'home' && singleActiveTrip)
  );
  const loadTripData = useCallback(async (tripId, currentUser) => {
    const u = currentUser || user;
    const [memRes, grpRes, expRes, itinRes, mediaRes] = await Promise.all([
      api.get(`/api/trips/${tripId}/members`).catch(() => ({ data: [] })),
      api.get(`/api/trips/${tripId}/groups`).catch(() => ({ data: [] })),
      api.get(`/api/trips/${tripId}/expenses`).catch(() => ({ data: [] })),
      api.get(`/api/trips/${tripId}/itinerary`).catch(() => ({ data: [] })),
      api.get(`/api/trips/${tripId}/media`).catch(() => ({ data: [] })),
    ]);
    const mems = Array.isArray(memRes.data) ? memRes.data : [];
    setMembers(mems);
    setGroups(Array.isArray(grpRes.data) ? grpRes.data : []);
    setExpenses(Array.isArray(expRes.data) ? expRes.data : []);
    setItinerary(Array.isArray(itinRes.data) ? itinRes.data : []);
    setMedia(Array.isArray(mediaRes.data) ? mediaRes.data : []);
    const me = mems.find(m => m.user_id === u?.id || m.id === u?.id || m.email === u?.email);
    const adminOnTrip = me?.role === 'admin';
    setIsAdmin(adminOnTrip);
    if (adminOnTrip) setIsGlobalAdmin(true);
    return mems;
  }, [user]);
  const refreshExpenses = useCallback(async () => { if (!trip?.id) return; const r = await api.get(`/api/trips/${trip.id}/expenses`).catch(() => ({ data: [] })); setExpenses(Array.isArray(r.data) ? r.data : []); }, [trip?.id]);
  const refreshItinerary = useCallback(async () => { if (!trip?.id) return; const r = await api.get(`/api/trips/${trip.id}/itinerary`).catch(() => ({ data: [] })); setItinerary(Array.isArray(r.data) ? r.data : []); }, [trip?.id]);
  const refreshMedia = useCallback(async () => { if (!trip?.id) return; const r = await api.get(`/api/trips/${trip.id}/media`).catch(() => ({ data: [] })); setMedia(Array.isArray(r.data) ? r.data : []); }, [trip?.id]);
  const refreshMembers = useCallback(async () => { if (!trip?.id) return; const r = await api.get(`/api/trips/${trip.id}/members`).catch(() => ({ data: [] })); setMembers(Array.isArray(r.data) ? r.data : []); }, [trip?.id]);
  const refreshGroups = useCallback(async () => { if (!trip?.id) return; const r = await api.get(`/api/trips/${trip.id}/groups`).catch(() => ({ data: [] })); setGroups(Array.isArray(r.data) ? r.data : []); }, [trip?.id]);
  const navigate = useCallback((targetPage, opts) => {
    const aTab = targetPage === 'admin' ? (opts?.adminTab ?? adminTab) : 0;
    const tid = (targetPage === 'home' || targetPage === 'profile' || targetPage === 'vacations' || targetPage === 'global-admin') ? null : trip?.id;
    const path = buildPath(targetPage, tid, aTab);
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setPage(targetPage);
    if (targetPage === 'admin') setAdminTab(aTab);
    window.scrollTo(0, 0);
  }, [adminTab, trip?.id]);
  const openTrip = useCallback(async (selectedTrip) => {
    setTrip(selectedTrip);
    await loadTripData(selectedTrip.id);
    const path = buildPath('trip-home', selectedTrip.id);
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setPage('trip-home');
    window.scrollTo(0, 0);
  }, [loadTripData]);
  const handleLogout = useCallback(async () => {
    if (!await confirm({ title: msg('confirms.signOut.titles', {}, true), message: msg('confirms.signOut.messages', {}, true), confirmText: msg('confirms.signOut.confirmText', {}, true), danger: true })) return;
    try { await logout(); } catch {}
    window.history.pushState({}, '', '/');
    window.location.reload();
  }, [logout, confirm]);
  useEffect(() => {
    const h = () => { const r = parseRoute(); setPage(r.page); setAdminTab(r.adminTab); };
    window.addEventListener('popstate', h);
    return () => window.removeEventListener('popstate', h);
  }, []);
  useEffect(() => { const h = () => setIsDesktop(window.innerWidth >= 768); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h); }, []);
  useEffect(() => {
    if (!user) return;
    api.get('/api/global-admin/check').then(r => {
      if (r.data?.is_global_admin) setIsGlobalAdmin(true);
    }).catch(() => {});
    api.get('/api/trips').then(async (res) => {
      const trips = Array.isArray(res.data) ? res.data : [];
      setAllTrips(trips);
      if (trips.length > 0) {
        let targetTrip = urlTripId ? trips.find(t => String(t.id) === urlTripId) : null;
        if (!targetTrip) {
          const current = trips.find(t => { const s = getTripStatus(t); return s === 'active'; });
          const upcoming = trips.find(t => getTripStatus(t) === 'upcoming');
          targetTrip = current || upcoming || trips[0];
        }
        setTrip(targetTrip);
        await loadTripData(targetTrip.id, user);
      }
      setDataLoaded(true);
    }).catch(err => { console.error('Failed to fetch trips:', err); setDataLoaded(true); });
  }, [user]);
  if (loading) return <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><div className="heading-serif lg" style={{ color: 'var(--primary)' }}>GamJo</div></div>;
  if (window.location.pathname === '/verify') return <VerifyPage />;
  if (!user) {
    const p = window.location.pathname;
    if (p === '/' || p === '/home') return <LoginPage />;
    return <NotFoundPage />;
  }
  if (page === '404') return <NotFoundPage />;
  const renderPage = () => {
    switch (page) {
      case 'home':
        if (trip && allTrips) {
          const activeNear = allTrips.filter(t => isTripCurrent(t));
          if (activeNear.length === 1) {
            return <HomePage trip={trip} members={members} user={user} navigate={navigate} expenses={expenses} itinerary={itinerary} media={media} />;
          }
        }
        return <VacationsPage navigate={navigate} openTrip={openTrip} />;
      case 'vacations':
        return <VacationsPage navigate={navigate} openTrip={openTrip} />;
      case 'global-admin':
        return <GlobalAdminPage />;
      case 'trip-home':
        return <HomePage trip={trip} members={members} user={user} navigate={navigate} expenses={expenses} itinerary={itinerary} media={media} />;
      case 'itinerary':
        return <ItineraryPage trip={trip} user={user} items={itinerary} setItems={setItinerary} refreshItinerary={refreshItinerary} />;
      case 'expenses':
        return <ExpensesPage trip={trip} user={user} members={members} groups={groups} expenses={expenses} setExpenses={setExpenses} refreshExpenses={refreshExpenses} />;
      case 'photos':
        return <PhotosPage trip={trip} user={user} navigate={navigate} photos={media} setPhotos={setMedia} refreshMedia={refreshMedia} />;
      case 'gallery':
        return <GalleryPage trip={trip} user={user} onBack={() => navigate('photos')} photos={media} setPhotos={setMedia} refreshMedia={refreshMedia} />;
      case 'profile':
        return <ProfilePage user={user} trip={null} members={[]} groups={[]} onLogout={handleLogout} />;
      case 'trip-profile':
        return <ProfilePage user={user} trip={trip} members={members} groups={groups} onLogout={handleLogout} />;
      case 'admin':
        return <AdminPage trip={trip} members={members} groups={groups} setMembers={setMembers} setGroups={setGroups} setTrip={setTrip} navigate={navigate} initialTab={adminTab} onTabChange={(t) => { setAdminTab(t); const path = buildPath('admin', trip?.id, t); if (window.location.pathname !== path) window.history.pushState({}, '', path); }} />;
      default: return <NotFoundPage />;
    }
  };
  return (
    <AppContext.Provider value={{ user, setUser, trip, allTrips, members, groups, expenses, itinerary, media, isAdmin, isGlobalAdmin, isDesktop, inTrip, dataLoaded, theme, toggleTheme, reduceMotion, toggleReduceMotion, navigate, openTrip, setTrip, setMembers, setGroups, setExpenses, setItinerary, setMedia, refreshExpenses, refreshItinerary, refreshMedia, refreshMembers, refreshGroups }}>
      <div className="app">
        {isDesktop && <DesktopSidebar tab={page} navigate={navigate} user={user} isAdmin={isAdmin} isGlobalAdmin={isGlobalAdmin} onLogout={handleLogout} inTrip={inTrip} />}
        <div className="page-content">{renderPage()}</div>
        {!isDesktop && <MobileNav tab={page} navigate={navigate} isAdmin={isAdmin} isGlobalAdmin={isGlobalAdmin} inTrip={inTrip} />}
      </div>
    </AppContext.Provider>
  );
}