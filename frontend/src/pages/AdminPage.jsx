import { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Mail, Users, Trash, Vote, ChevronRight, Send, Camera, Check } from '../components/Icons';
import { Sheet, Toast, useConfirm, SkeletonAdmin } from '../components/Shared';
import { api } from '../utils/api';
import { parseFraction, formatPct, pctToFractionStr, getTripStatusLabel, formatDate, formatTime12h } from '../utils/helpers';
import { Avatar, useApp } from '../App';

export default function AdminPage({ trip, members, groups: propGroups, setMembers, setGroups: setParentGroups, setTrip, navigate, initialTab, onTabChange }) {
  const { isDesktop, groups: ctxGroups, expenses: ctxExpenses, itinerary: ctxItinerary, media: ctxMedia, dataLoaded } = useApp();
  const allExpenses = ctxExpenses || [];
  const allItinerary = ctxItinerary || [];
  const allMedia = ctxMedia || [];
  const groups = propGroups || ctxGroups || [];
  const setGroups = setParentGroups || (() => {});
  const confirm = useConfirm();
  const [tab, setTabState] = useState(initialTab || 0);
  const setTab = (t) => { setTabState(t); if (onTabChange) onTabChange(t); };
  const [showInvite, setShowInvite] = useState(false);
  const [showPushVote, setShowPushVote] = useState(false);
  const [selectedVoteItem, setSelectedVoteItem] = useState(null);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showEditGroup, setShowEditGroup] = useState(null);
  const [showEditUser, setShowEditUser] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteMode, setInviteMode] = useState('pick'); // 'pick' | 'new'
  const [toast, setToast] = useState(null);
  const [emailMenu, setEmailMenu] = useState(null); // userId when open
  const [banners, setBanners] = useState({ desktop: [], mobile: [] });
  const desktopBannerRef = useRef(null);
  const mobileBannerRef = useRef(null);
  const userPhotoRef = useRef(null);

  const [groupForm, setGroupForm] = useState({ name: '', percentage: '' });
  // Enhanced edit user form with all fields
  const [editUserForm, setEditUserForm] = useState({ name: '', email: '', role: 'member', group_id: null, is_payer: false });
  const [tripForm, setTripForm] = useState({
    name: trip?.name || '', location: trip?.location || '',
    start_date: trip?.start_date || '', end_date: trip?.end_date || '',
    rental_url: trip?.rental_url || '', rental_title: trip?.rental_title || '',
  });

  const showToast = (msg, type = 'info') => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };

  useEffect(() => {
    if (trip) {
      setTripForm({
        name: trip.name || '', location: trip.location || '',
        start_date: trip.start_date || '', end_date: trip.end_date || '',
        rental_url: trip.rental_url || '', rental_title: trip.rental_title || '',
      });
      // Fetch banners
      api.get(`/api/trips/${trip.id}/banners`).then(r => {
        if (r.data) setBanners({ desktop: r.data.desktop || [], mobile: r.data.mobile || [] });
      }).catch(() => {
        // Fall back to trip object arrays if endpoint doesn't exist yet
        setBanners({
          desktop: trip.desktop_banners || [],
          mobile: trip.mobile_banners || [],
        });
      });
    }
  }, [trip?.id]);

  const refreshGroups = async () => {
    if (!trip?.id) return;
    try { const r = await api.get(`/api/trips/${trip.id}/groups`); setGroups(Array.isArray(r.data) ? r.data : []); } catch {}
  };
  const refreshMembers = async () => {
    if (!trip?.id) return;
    try { const r = await api.get(`/api/trips/${trip.id}/members`); if (Array.isArray(r.data)) setMembers(r.data); } catch {}
  };

  // ── People actions ──
  const openInvite = async () => {
    setShowInvite(true);
    setInviteMode('pick');
    setInviteSearch('');
    setInviteEmail('');
    setInviteName('');
    try {
      const r = await api.get(`/api/admin/${trip.id}/all-users`);
      setAllUsers(Array.isArray(r.data) ? r.data : []);
    } catch { setAllUsers([]); }
  };
  const handleAddExistingUser = async (u) => {
    try {
      await api.post(`/api/admin/${trip.id}/invite`, { email: u.email, name: u.name });
      await refreshMembers();
      // Refresh the all-users list to update in_trip status
      try { const r = await api.get(`/api/admin/${trip.id}/all-users`); setAllUsers(Array.isArray(r.data) ? r.data : []); } catch {}
      showToast(`${u.name || u.email} added`, 'success');
    } catch { showToast('Failed to add', 'error'); }
  };
  const handleInviteNew = async () => {
    if (!inviteEmail.includes('@')) return;
    try {
      await api.post(`/api/admin/${trip.id}/invite`, { email: inviteEmail, name: inviteName });
      await refreshMembers();
      showToast('Invite sent', 'success');
    } catch { showToast('Failed to send invite', 'error'); }
    setInviteEmail(''); setInviteName(''); setShowInvite(false);
  };
  const emailTypes = [
    { key: 'login_code', label: 'Login code', desc: 'Sends a 6-digit login code' },
    { key: 'trip_invite', label: 'Trip invite', desc: 'Notifies them about this trip' },
    { key: 'welcome', label: 'Welcome email', desc: 'How-to-get-started guide' },
  ];
  const handleSendEmail = async (userId, emailType) => {
    const member = members.find(m => (m.id || m.user_id) === userId);
    const typeName = emailTypes.find(t => t.key === emailType)?.label || emailType;
    if (!await confirm({ title: `Send ${typeName}?`, message: `Send a ${typeName.toLowerCase()} email to ${member?.name || member?.email || 'this user'}?`, confirmText: 'Send it' })) return;
    setEmailMenu(null);
    try {
      await api.post(`/api/admin/${trip.id}/send-email`, { user_id: userId, email_type: emailType });
      showToast(`${typeName} sent`, 'success');
    } catch { showToast('Failed to send email', 'error'); }
  };
  const handleRemoveUser = async (userId) => {
    if (!await confirm({ title: 'Remove member?', message: 'Remove this person from the trip?', confirmText: 'Remove', danger: true })) return;
    try { await api.delete(`/api/admin/${trip.id}/users/${userId}`); setMembers(prev => prev.filter(m => (m.id || m.user_id) !== userId)); showToast('Removed', 'success'); } catch { showToast('Failed to remove', 'error'); }
  };

  // Enhanced edit user: open with all fields populated
  const openEditUser = (m) => {
    const uid = m.id || m.user_id;
    // Find which group this user belongs to
    let userGroupId = null;
    let userIsPayer = false;
    for (const g of groups) {
      const gm = g.members?.find(gm => gm.user_id === uid);
      if (gm) {
        userGroupId = g.id;
        userIsPayer = gm.is_payer;
        break;
      }
    }
    setShowEditUser(m);
    setEditUserForm({
      name: m.name || '',
      email: m.email || '',
      role: m.role || 'member',
      group_id: userGroupId,
      is_payer: userIsPayer,
    });
  };

  // Save all user edits at once
  const handleSaveUser = async () => {
    if (!showEditUser) return;
    const uid = showEditUser.id || showEditUser.user_id;
    try {
      // 1. Update name, email, and role
      await api.put(`/api/admin/${trip.id}/users/${uid}`, {
        name: editUserForm.name,
        email: editUserForm.email,
        role: editUserForm.role,
      });

      // 2. Update group assignment if changed
      const currentGroupId = (() => {
        for (const g of groups) {
          if (g.members?.some(gm => gm.user_id === uid)) return g.id;
        }
        return null;
      })();

      if (editUserForm.group_id && editUserForm.group_id !== currentGroupId) {
        await api.post(`/api/admin/${trip.id}/groups/${editUserForm.group_id}/members`, {
          user_id: uid,
          is_payer: editUserForm.is_payer,
        });
      } else if (editUserForm.group_id && editUserForm.group_id === currentGroupId) {
        // Same group but maybe payer status changed
        await api.put(`/api/admin/${trip.id}/groups/${editUserForm.group_id}/members/${uid}`, {
          is_payer: editUserForm.is_payer,
        });
      }

      await refreshMembers();
      await refreshGroups();
      showToast('Updated', 'success');
    } catch { showToast('Failed to update', 'error'); }
    setShowEditUser(null);
  };

  // Upload photo for a user being edited
  const handleUserPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !showEditUser) return;
    const fd = new FormData(); fd.append('file', file);
    const uid = showEditUser.id || showEditUser.user_id;
    try {
      await api.upload(`/api/admin/${trip.id}/users/${uid}/photo`, fd);
      showToast('Photo uploaded', 'success');
    } catch {
      showToast('Photo upload not available yet', 'error');
    }
    if (userPhotoRef.current) userPhotoRef.current.value = '';
  };

  // ── Group actions ──
  const handleAddGroup = async () => {
    if (!groupForm.name || !groupForm.percentage) return;
    try { await api.post(`/api/admin/${trip.id}/groups`, { name: groupForm.name, percentage: parseFraction(groupForm.percentage) }); await refreshGroups(); showToast('Group added', 'success'); } catch { showToast('Failed to add group', 'error'); }
    setGroupForm({ name: '', percentage: '' }); setShowAddGroup(false);
  };
  const openEditGroup = (g) => { setShowEditGroup(g); setGroupForm({ name: g.name, percentage: pctToFractionStr(g.percentage) }); };
  const handleSaveGroup = async () => {
    if (!showEditGroup) return;
    try { await api.put(`/api/admin/${trip.id}/groups/${showEditGroup.id}`, { name: groupForm.name, percentage: parseFraction(groupForm.percentage) }); await refreshGroups(); showToast('Group updated', 'success'); } catch { showToast('Failed to update', 'error'); }
    setShowEditGroup(null); setGroupForm({ name: '', percentage: '' });
  };
  const handleDeleteGroup = async (gid) => {
    if (!await confirm({ title: 'Delete group?', message: 'Delete this group? Members will be unassigned.', confirmText: 'Delete', danger: true })) return;
    try { await api.delete(`/api/admin/${trip.id}/groups/${gid}`); await refreshGroups(); showToast('Group deleted', 'success'); } catch { showToast('Failed to delete', 'error'); }
  };
  const handleTogglePayer = async (groupId, userId, currentlyPayer) => {
    try {
      await api.put(`/api/admin/${trip.id}/groups/${groupId}/members/${userId}`, { is_payer: !currentlyPayer });
      await refreshGroups();
      showToast(currentlyPayer ? 'Payer removed' : 'Set as payer', 'success');
    } catch { showToast('Failed to update payer', 'error'); }
  };

  // ── Vote ──
  const handlePushVote = async (item) => {
    const isCurrentlyPushed = item.pushed;
    try {
      await api.put(`/api/trips/${trip.id}/itinerary/${item.id}`, {
        status: isCurrentlyPushed ? item.status : 'voting',
        pushed: !isCurrentlyPushed,
      });
      if (refreshItinerary) await refreshItinerary();
      showToast(isCurrentlyPushed ? 'Vote removed from spotlight.' : 'The people have been summoned.', 'success');
    } catch { showToast('Failed to update vote', 'error'); }
    setShowPushVote(false);
  };
  const refreshItinerary = useApp().refreshItinerary;

  // ── Trip settings ──
  const handleSaveTripSettings = async () => {
    try {
      const res = await api.put(`/api/trips/${trip.id}`, tripForm);
      if (res.data && setTrip) setTrip(res.data);
      showToast('Trip settings saved', 'success');
    } catch { showToast('Failed to save', 'error'); }
  };
  // A15: Delete trip
  const handleDeleteTrip = async () => {
    if (!await confirm({ title: 'Delete this trip?', message: 'This will permanently remove all expenses, photos, itinerary items, and groups. This cannot be undone.', confirmText: 'Delete everything', danger: true })) return;
    if (!await confirm({ title: 'Are you absolutely sure?', message: `This will permanently delete "${trip.name}" and all of its data.`, confirmText: 'Yes, delete forever', danger: true })) return;
    try {
      await api.delete(`/api/admin/${trip.id}`);
      showToast('Trip deleted', 'success');
      if (navigate) navigate('vacations');
    } catch { showToast('Failed to delete trip', 'error'); }
  };
  // A17: Duplicate trip
  const handleDuplicateTrip = async () => {
    if (!await confirm({ title: 'Run it back?', message: `Create a copy of "${trip.name}" for next year?`, confirmText: 'Duplicate' })) return;
    try {
      const res = await api.post(`/api/admin/${trip.id}/duplicate`, { name: `${trip.name} ${new Date().getFullYear() + 1}` });
      showToast(`Trip duplicated: ${res.data?.name}`, 'success');
      setTimeout(() => navigate('home'), 500);
    } catch { showToast('Failed to duplicate', 'error'); }
  };
  const handleBannerUpload = async (e, bannerType) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('banner_type', bannerType);
    try {
      const res = await api.upload(`/api/trips/${trip.id}/banners`, fd);
      if (res.data?.url) {
        setBanners(prev => ({
          ...prev,
          [bannerType]: [...prev[bannerType], res.data.url]
        }));
      }
      showToast(`${bannerType === 'desktop' ? 'Desktop' : 'Mobile'} banner uploaded`, 'success');
    } catch { showToast('Upload failed', 'error'); }
    if (desktopBannerRef.current) desktopBannerRef.current.value = '';
    if (mobileBannerRef.current) mobileBannerRef.current.value = '';
  };
  const handleDeleteBanner = async (url, bannerType) => {
    if (!await confirm({ title: 'Remove banner?', message: 'Remove this banner photo?', confirmText: 'Remove', danger: true })) return;
    try {
      await api.delete(`/api/trips/${trip.id}/banners`, { url, banner_type: bannerType });
      setBanners(prev => ({
        ...prev,
        [bannerType]: prev[bannerType].filter(u => u !== url)
      }));
      showToast('Banner removed', 'success');
    } catch { showToast('Failed to remove', 'error'); }
  };

  const tabNames = ['Overview', `People (${members.length})`, `Groups (${groups.length})`, 'Trip'];
  const ActionBtn = ({ icon: Icon, label, danger, onClick }) => (
    <span onClick={onClick} style={{ padding: '6px 12px', borderRadius: 10, border: 'none', fontSize: 13, color: danger ? 'var(--danger)' : 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--surface)', cursor: 'pointer', boxShadow: '0 1px 4px rgba(140,120,100,0.08)' }}>
      <Icon size={12} /> {label}
    </span>
  );

  const EmailMenuBtn = ({ userId }) => {
    const isOpen = emailMenu === userId;
    const btnRef = useRef(null);
    const [dropUp, setDropUp] = useState(false);
    const member = members.find(m => (m.id || m.user_id) === userId);
    useEffect(() => {
      if (isOpen && btnRef.current && isDesktop) {
        const rect = btnRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        setDropUp(spaceBelow < 160);
      }
    }, [isOpen]);

    const menuContent = (
      <>
        {!isDesktop && <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', padding: '12px 14px 6px', borderBottom: '1px solid var(--surface-alt)' }}>Send email to {member?.name || 'user'}</div>}
        {emailTypes.map(et => (
          <div key={et.key} onClick={() => handleSendEmail(userId, et.key)} style={{ padding: '12px 14px', cursor: 'pointer', transition: 'background 0.1s', fontSize: 14 }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-alt)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div style={{ fontWeight: 500, color: 'var(--text)' }}>{et.label}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{et.desc}</div>
          </div>
        ))}
        {!isDesktop && <div onClick={() => setEmailMenu(null)} style={{ padding: '12px 14px', cursor: 'pointer', textAlign: 'center', fontSize: 14, color: 'var(--text-muted)', borderTop: '1px solid var(--surface-alt)', marginTop: 4 }}>Cancel</div>}
      </>
    );

    return (
      <span ref={btnRef} style={{ position: 'relative', display: 'inline-block' }}>
        <span onClick={() => setEmailMenu(isOpen ? null : userId)} style={{ padding: '6px 12px', borderRadius: 10, border: 'none', fontSize: 13, color: isOpen ? 'var(--primary)' : 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4, background: isOpen ? 'var(--primary-light)' : 'var(--surface)', cursor: 'pointer', boxShadow: '0 1px 4px rgba(140,120,100,0.08)' }}>
          <Mail size={12} /> Email
        </span>
        {isOpen && (
          <>
            <div onClick={() => setEmailMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 49, background: isDesktop ? 'transparent' : 'rgba(0,0,0,0.3)' }} />
            {isDesktop ? (
              <div style={{ position: 'absolute', right: 0, background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', zIndex: 50, minWidth: 220, padding: '6px 0', border: '1px solid var(--border)', ...(dropUp ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 4 }) }}>
                {menuContent}
              </div>
            ) : (
              <div style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', background: 'var(--surface)', borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.2)', zIndex: 50, width: 'min(300px, calc(100vw - 48px))', padding: '6px 0', overflow: 'hidden' }}>
                {menuContent}
              </div>
            )}
          </>
        )}
      </span>
    );
  };

  // Helper to get user's group name
  const getUserGroup = (uid) => {
    for (const g of groups) {
      if (g.members?.some(gm => gm.user_id === uid)) return g.name;
    }
    return null;
  };

  if (!dataLoaded) return <div className="page-admin"><SkeletonAdmin /></div>;

  return (
    <div className="page-admin">
      {!isDesktop && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 20px 8px' }}>
          <span style={{ fontSize: 18, fontWeight: 600, flex: 1 }}>Admin</span>
          <button className="btn-add" onClick={openInvite}><Plus size={13} /> Invite</button>
        </div>
      )}
      {isDesktop && (
        <div className="desk-header">
          <div className="desk-header-title">Admin</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-add" onClick={openInvite}><Plus size={13} /> Invite</button>
            <button className="btn-add" style={{ background: 'var(--vote-bg)', color: 'var(--vote-text)', border: '1px solid var(--vote-border)', boxShadow: '0 1px 4px rgba(140,120,100,0.08)' }} onClick={() => setShowPushVote(true)}><Vote size={13} /> Push a vote</button>
          </div>
        </div>
      )}

      <div style={{ padding: isDesktop ? '24px 32px' : '0 20px' }}>
        <div className="tab-bar mb-md">{tabNames.map((t, i) => <button key={i} className={`tab-bar-item ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>{t}</button>)}</div>

        {/* ── Overview Tab ── */}
        {tab === 0 && (
          <div>
            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
              <div className="card" style={{ textAlign: 'center', padding: 16 }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--primary)' }}>{members.length}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Members</div>
              </div>
              <div className="card" style={{ textAlign: 'center', padding: 16 }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--warm)' }}>${allExpenses.reduce((s, e) => s + (e.amount || 0), 0).toFixed(0)}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Total spent</div>
              </div>
              <div className="card" style={{ textAlign: 'center', padding: 16 }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--sage)' }}>{allExpenses.length}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Expenses</div>
              </div>
              <div className="card" style={{ textAlign: 'center', padding: 16 }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--primary)' }}>{allMedia.length}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Photos</div>
              </div>
            </div>

            {/* Groups summary */}
            <div className="heading-serif md mb-sm">Groups</div>
            {groups.length === 0 && <div className="card mb-md" style={{ color: 'var(--text-muted)', fontSize: 13 }}>No groups created yet. Go to the Groups tab to set them up.</div>}
            {groups.map(g => {
              const settled = (trip?.settled_groups || []).includes(String(g.id));
              return (
                <div key={g.id} className="card mb-sm" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{g.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{g.members?.length || 0} members, {Number(g.percentage || 0).toFixed(1)}% share</div>
                  </div>
                  {settled ? <span style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--sage-light)', color: 'var(--sage)', fontSize: 13, fontWeight: 500 }}>Settled</span> : <span style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--vote-bg)', color: 'var(--vote-text)', fontSize: 13, fontWeight: 500 }}>Unsettled</span>}
                </div>
              );
            })}

            {/* Members without a group */}
            {(() => {
              const groupedUserIds = new Set(groups.flatMap(g => (g.members || []).map(m => m.user_id)));
              const ungrouped = members.filter(m => !groupedUserIds.has(m.id || m.user_id));
              if (ungrouped.length === 0) return null;
              return (
                <div style={{ marginTop: 16 }}>
                  <div className="heading-serif md mb-sm" style={{ color: 'var(--danger)' }}>Unassigned members</div>
                  <div className="card" style={{ padding: '12px 16px' }}>
                    {ungrouped.map(m => (
                      <div key={m.id || m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                        <Avatar user={m} size="sm" />
                        <span style={{ fontSize: 13 }}>{m.name || m.email}</span>
                      </div>
                    ))}
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>These members need to be added to a group in the Groups tab.</div>
                  </div>
                </div>
              );
            })()}

            {/* Itinerary summary */}
            <div style={{ marginTop: 16 }}>
              <div className="heading-serif md mb-sm">Itinerary</div>
              <div className="card" style={{ display: 'flex', gap: 20 }}>
                <div><div style={{ fontSize: 20, fontWeight: 600, color: 'var(--sage)' }}>{allItinerary.filter(i => i.status === 'final').length}</div><div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Confirmed</div></div>
                <div><div style={{ fontSize: 20, fontWeight: 600, color: 'var(--vote-text)' }}>{allItinerary.filter(i => i.status === 'voting').length}</div><div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Voting</div></div>
                <div><div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-muted)' }}>{allItinerary.filter(i => i.status === 'proposed').length}</div><div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Proposed</div></div>
              </div>
            </div>
          </div>
        )}

        {/* ── People Tab ── */}
        {tab === 1 && (
          isDesktop ? (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data-table">
                <thead><tr><th>Person</th><th>Email</th><th>Group</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
                <tbody>{[...members].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(m => (
                  <tr key={m.id || m.user_id}>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar user={m} size="sm" /><span style={{ fontWeight: 500 }}>{m.name}</span></div></td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{m.email}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{m.group_name || getUserGroup(m.id || m.user_id) || '-'}</td>
                    <td style={{ textAlign: 'right' }}><div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <ActionBtn icon={Edit} label="Edit" onClick={() => openEditUser(m)} />
                      <EmailMenuBtn userId={m.id || m.user_id} />
                      <ActionBtn icon={Trash} label="Remove" danger onClick={() => handleRemoveUser(m.id || m.user_id)} />
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : (
            <>
              {[...members].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(m => (
                <div key={m.id || m.user_id} className="card mb-sm">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Avatar user={m} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{m.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{m.email}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 1 }}>{m.group_name || getUserGroup(m.id || m.user_id) || 'No group'}{m.is_payer ? ' \u00b7 Payer' : ''}</div>
                    </div>
                    </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    <ActionBtn icon={Edit} label="Edit" onClick={() => openEditUser(m)} />
                    <EmailMenuBtn userId={m.id || m.user_id} />
                    <ActionBtn icon={Trash} label="Remove" danger onClick={() => handleRemoveUser(m.id || m.user_id)} />
                  </div>
                </div>
              ))}
              {(() => {
                const pushed = allItinerary.find(i => i.pushed);
                return (
                  <div className="card mt-md" style={{ background: 'linear-gradient(135deg, var(--vote-bg), #FFF8ED)', border: 'none', boxShadow: '0 1px 4px rgba(140,120,100,0.08)', cursor: 'pointer' }} onClick={() => setShowPushVote(true)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Vote size={18} color="var(--vote-text)" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--vote-text)' }}>Push a vote</div>
                        {pushed ? (
                          <div style={{ fontSize: 13, color: '#A89050' }}>Active: <strong>{pushed.title}</strong></div>
                        ) : (
                          <div style={{ fontSize: 13, color: '#A89050' }}>Highlight an item on everyone's home page</div>
                        )}
                      </div>
                      <ChevronRight size={16} color="#A89050" />
                    </div>
                  </div>
                );
              })()}
            </>
          )
        )}

        {/* ── Groups Tab ── */}
        {tab === 2 && (
          <>
            {groups.map(g => (
              <div key={g.id} className="card mb-sm">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div><div style={{ fontWeight: 500, fontSize: 14 }}>{g.name}</div><div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatPct(g.percentage)} &middot; {g.members?.length || 0} members</div></div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <span onClick={() => openEditGroup(g)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', cursor: 'pointer' }}><Edit size={13} color="var(--text-secondary)" /></span>
                    <span onClick={() => handleDeleteGroup(g.id)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--danger-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', cursor: 'pointer' }}><Trash size={13} color="var(--danger)" /></span>
                  </div>
                </div>
                {[...(g.members || [])].sort((a, b) => {
                  const nameA = (members.find(x => (x.id || x.user_id) === a.user_id)?.name || '').toLowerCase();
                  const nameB = (members.find(x => (x.id || x.user_id) === b.user_id)?.name || '').toLowerCase();
                  return nameA.localeCompare(nameB);
                }).map((m) => {
                  const member = members.find(x => (x.id || x.user_id) === m.user_id);
                  return member ? (
                    <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                      <Avatar user={member} size="sm" />
                      <div style={{ flex: 1, fontSize: 13 }}>{member.name}</div>
                      <span onClick={() => handleTogglePayer(g.id, m.user_id, m.is_payer)} style={{ fontSize: 13, padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: m.is_payer ? 'var(--sage-light)' : 'var(--surface-alt)', color: m.is_payer ? 'var(--sage)' : 'var(--text-muted)', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}>{m.is_payer ? 'Payer' : 'Set payer'}</span>
                    </div>
                  ) : null;
                })}
              </div>
            ))}
            <button className="btn btn-primary mt-sm" onClick={() => { setGroupForm({ name: '', percentage: '' }); setShowAddGroup(true); }}><Plus size={14} /> Add group</button>
            {groups.length > 0 && (() => {
              const total = groups.reduce((s, g) => s + (g.percentage || 0), 0);
              const isGood = Math.abs(total - 100) < 0.01;
              return (
                <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: isGood ? 'var(--sage-light)' : 'var(--vote-bg)', color: isGood ? 'var(--sage)' : 'var(--vote-text)', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {isGood && <Check size={14} />}
                  Total: {formatPct(total)}
                  {!isGood && <span style={{ marginLeft: 4 }}>(should be 100%)</span>}
                </div>
              );
            })()}
          </>
        )}

        {/* ── Trip Settings Tab ── */}
        {tab === 3 && (
          <div className="card">
            <div className="form-group"><label className="label">Trip name</label><input className="form-input" value={tripForm.name} onChange={e => setTripForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="form-group"><label className="label">Location</label><input className="form-input" value={tripForm.location} onChange={e => setTripForm(f => ({ ...f, location: e.target.value }))} /></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: 140 }}><label className="label">Start date</label><input className="form-input" type="date" value={tripForm.start_date} onChange={e => setTripForm(f => ({ ...f, start_date: e.target.value }))} /></div>
              <div className="form-group" style={{ flex: 1, minWidth: 140 }}><label className="label">End date</label><input className="form-input" type="date" value={tripForm.end_date} onChange={e => setTripForm(f => ({ ...f, end_date: e.target.value }))} /></div>
            </div>
            <div className="form-group"><label className="label">Rental URL</label><input className="form-input" value={tripForm.rental_url} onChange={e => setTripForm(f => ({ ...f, rental_url: e.target.value }))} placeholder="https://vrbo.com/..." /></div>
            <div className="form-group"><label className="label">Rental title</label><input className="form-input" value={tripForm.rental_title} onChange={e => setTripForm(f => ({ ...f, rental_title: e.target.value }))} placeholder="Lakefront Cottage" /></div>
            <div className="form-group">
              <label className="label">Desktop banner images</label>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Landscape photos work best (16:9). A random image is shown each time someone visits.</div>
              <input ref={desktopBannerRef} type="file" accept="image/*" onChange={e => handleBannerUpload(e, 'desktop')} style={{ display: 'none' }} />
              {banners.desktop.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                  {banners.desktop.map((url, i) => (
                    <div key={i} style={{ position: 'relative', aspectRatio: '16/9', borderRadius: 8, overflow: 'hidden', background: 'var(--surface-alt)' }}>
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button onClick={() => handleDeleteBanner(url, 'desktop')} style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,.5)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Trash size={11} color="#fff" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="upload-zone" style={{ cursor: 'pointer', padding: '14px 16px' }} onClick={() => desktopBannerRef.current?.click()}>
                <Camera size={20} color="var(--text-muted)" />
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginTop: 4 }}>Add desktop banner{banners.desktop.length > 0 ? ` (${banners.desktop.length} uploaded)` : ''}</div>
              </div>
            </div>
            <div className="form-group">
              <label className="label">Mobile banner images</label>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Portrait or square photos work best (3:4). Shown on phones and small screens.</div>
              <input ref={mobileBannerRef} type="file" accept="image/*" onChange={e => handleBannerUpload(e, 'mobile')} style={{ display: 'none' }} />
              {banners.mobile.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
                  {banners.mobile.map((url, i) => (
                    <div key={i} style={{ position: 'relative', aspectRatio: '3/4', borderRadius: 8, overflow: 'hidden', background: 'var(--surface-alt)' }}>
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button onClick={() => handleDeleteBanner(url, 'mobile')} style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,.5)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Trash size={11} color="#fff" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="upload-zone" style={{ cursor: 'pointer', padding: '14px 16px' }} onClick={() => mobileBannerRef.current?.click()}>
                <Camera size={20} color="var(--text-muted)" />
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginTop: 4 }}>Add mobile banner{banners.mobile.length > 0 ? ` (${banners.mobile.length} uploaded)` : ''}</div>
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleSaveTripSettings}><Check size={15} /> Save trip settings</button>
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" style={{ fontSize: 13, flex: 1 }} onClick={handleDuplicateTrip}>Duplicate trip for next year</button>
              <button className="btn btn-danger" style={{ fontSize: 13, flex: 1 }} onClick={handleDeleteTrip}>Delete trip</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Sheets ── */}
      {showInvite && (
        <Sheet onClose={() => setShowInvite(false)} title="Add someone to this trip">
          {/* Tab: Pick existing or Create new */}
          <div className="pill-group" style={{ marginBottom: 16 }}>
            <button className={`pill ${inviteMode === 'pick' ? 'active' : ''}`} onClick={() => setInviteMode('pick')}>Existing member</button>
            <button className={`pill ${inviteMode === 'new' ? 'active' : ''}`} onClick={() => setInviteMode('new')}>New person</button>
          </div>

          {inviteMode === 'pick' && (
            <>
              <input className="form-input" placeholder="Search by name or email..." value={inviteSearch} onChange={e => setInviteSearch(e.target.value)} autoFocus style={{ marginBottom: 12 }} />
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {allUsers
                  .filter(u => {
                    if (u.in_trip) return false;
                    if (!inviteSearch) return true;
                    const q = inviteSearch.toLowerCase();
                    return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
                  })
                  .map(u => (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: '1px solid var(--border)', marginBottom: 6, background: 'var(--surface)' }} onClick={() => handleAddExistingUser(u)}>
                      <Avatar user={u} size="sm" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{u.name || 'No name'}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                      </div>
                      <Plus size={14} color="var(--sage)" />
                    </div>
                  ))
                }
                {allUsers.filter(u => !u.in_trip).length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Everyone is already in this trip</div>}
                {inviteSearch && allUsers.filter(u => !u.in_trip && ((u.name || '').toLowerCase().includes(inviteSearch.toLowerCase()) || (u.email || '').toLowerCase().includes(inviteSearch.toLowerCase()))).length === 0 && allUsers.filter(u => !u.in_trip).length > 0 && (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No matches. <span style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 500 }} onClick={() => { setInviteMode('new'); setInviteEmail(inviteSearch.includes('@') ? inviteSearch : ''); }}>Create a new person instead</span></div>
                )}
              </div>
              {/* Show who's already in the trip */}
              {allUsers.filter(u => u.in_trip).length > 0 && (
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Already in this trip</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {allUsers.filter(u => u.in_trip).map(u => (
                      <span key={u.id} style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--surface-alt)', fontSize: 13, color: 'var(--text-secondary)' }}>{u.name || u.email}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {inviteMode === 'new' && (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Create a new account and add them to this trip. They'll get a login code via email.</div>
              <div className="form-group"><label className="label">Email</label><input className="form-input" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="person@email.com" autoFocus /></div>
              <div className="form-group"><label className="label">Name</label><input className="form-input" value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Their full name" /></div>
              <button className="btn btn-primary" onClick={handleInviteNew}><Send size={15} /> Create and invite</button>
            </>
          )}
        </Sheet>
      )}
      {showPushVote && (
        <Sheet onClose={() => setShowPushVote(false)} title="Push a vote">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Pick an item to highlight at the top of everyone's home page. Tap it again to remove the spotlight.</div>
          {(() => {
            const pushable = allItinerary.filter(i => i.status !== 'final');
            const currentPushed = pushable.find(i => i.pushed);
            if (pushable.length === 0) {
              return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No itinerary items to vote on. Add items in the Itinerary tab first.</div>;
            }
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {currentPushed && (
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--vote-text)', marginBottom: 4 }}>Currently highlighted</div>
                )}
                {pushable.sort((a, b) => (b.pushed ? 1 : 0) - (a.pushed ? 1 : 0)).map(item => (
                  <div key={item.id} onClick={() => handlePushVote(item)} style={{
                    padding: '14px 16px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: item.pushed ? 'linear-gradient(135deg, var(--vote-bg), #FFF8ED)' : 'var(--surface)',
                    border: item.pushed ? '1.5px solid var(--vote-border)' : '1.5px solid transparent',
                    boxShadow: 'var(--shadow-sm)',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: 14, color: item.pushed ? 'var(--vote-text)' : 'var(--text)' }}>{item.title}</div>
                      {item.date && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{formatDate(item.date)}{item.time ? ` at ${formatTime12h(item.time)}` : ''}</div>}
                    </div>
                    {item.pushed ? (
                      <span style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 500 }}>Remove</span>
                    ) : (
                      <Vote size={16} color="var(--text-muted)" />
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </Sheet>
      )}
      {showAddGroup && (
        <Sheet onClose={() => setShowAddGroup(false)} title="Add expense group">
          <div className="form-group"><label className="label">Group name</label><input className="form-input" value={groupForm.name} onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Gamache Family" autoFocus /></div>
          <div className="form-group"><label className="label">Percentage share</label><input className="form-input" value={groupForm.percentage} onChange={e => setGroupForm(f => ({ ...f, percentage: e.target.value }))} placeholder="e.g. 1/3 or 50" /></div>
          <button className="btn btn-primary" onClick={handleAddGroup}><Plus size={14} /> Add group</button>
        </Sheet>
      )}
      {showEditGroup && (
        <Sheet onClose={() => setShowEditGroup(null)} title={`Edit ${showEditGroup.name}`}>
          <div className="form-group"><label className="label">Group name</label><input className="form-input" value={groupForm.name} onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="form-group"><label className="label">Percentage share</label><input className="form-input" value={groupForm.percentage} onChange={e => setGroupForm(f => ({ ...f, percentage: e.target.value }))} placeholder="e.g. 1/3 or 50" /></div>
          <button className="btn btn-primary" onClick={handleSaveGroup}><Check size={14} /> Save changes</button>
        </Sheet>
      )}

      {/* ── Comprehensive Edit Person Sheet ── */}
      {showEditUser && (
        <Sheet onClose={() => setShowEditUser(null)} title={`Edit ${showEditUser.name}`}>
          {/* Avatar + photo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, padding: '12px 16px', background: 'var(--surface-alt)', borderRadius: 'var(--radius)' }}>
            <div style={{ position: 'relative' }}>
              <Avatar user={showEditUser} size="lg" />
              <button onClick={() => userPhotoRef.current?.click()} style={{ position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: '50%', background: 'var(--primary)', border: '2px solid var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Camera size={10} color="#fff" />
              </button>
            </div>
            <div>
              <div style={{ fontWeight: 500, fontSize: 15 }}>{showEditUser.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{showEditUser.email}</div>
            </div>
          </div>
          <input ref={userPhotoRef} type="file" accept="image/*" onChange={handleUserPhotoUpload} style={{ display: 'none' }} />

          {/* Name */}
          <div className="form-group">
            <label className="label">Name</label>
            <input className="form-input" value={editUserForm.name} onChange={e => setEditUserForm(f => ({ ...f, name: e.target.value }))} />
          </div>

          {/* Email */}
          <div className="form-group">
            <label className="label">Email</label>
            <input className="form-input" type="email" value={editUserForm.email} onChange={e => setEditUserForm(f => ({ ...f, email: e.target.value }))} />
          </div>

          {/* Role */}
          {/* Group assignment */}
          <div className="form-group">
            <label className="label">Family / Expense group</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {groups.map(g => (
                <div key={g.id} onClick={() => setEditUserForm(f => ({ ...f, group_id: g.id }))} style={{ padding: '10px 14px', borderRadius: 10, border: editUserForm.group_id === g.id ? '1.5px solid var(--sage)' : '1px solid var(--border)', background: editUserForm.group_id === g.id ? 'var(--sage-light)' : 'var(--surface)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{g.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatPct(g.percentage)} share</div>
                  </div>
                  {editUserForm.group_id === g.id && <Check size={14} color="var(--sage)" />}
                </div>
              ))}
              {groups.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 10 }}>No groups created yet. Add one in the Groups tab first.</div>}
            </div>
          </div>

          {/* Payer toggle (only if a group is selected) */}
          {editUserForm.group_id && (
            <div className="form-group">
              <label className="label">Payer status</label>
              <div onClick={() => setEditUserForm(f => ({ ...f, is_payer: !f.is_payer }))} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}>
                <div style={{ width: 44, height: 24, borderRadius: 12, padding: 2, background: editUserForm.is_payer ? 'var(--sage)' : 'var(--border)', transition: 'background 0.2s', display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'transform 0.2s', transform: editUserForm.is_payer ? 'translateX(20px)' : 'translateX(0)' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{editUserForm.is_payer ? 'This person is a payer' : 'Not a payer'}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Payers are responsible for paying their group's share</div>
                </div>
              </div>
            </div>
          )}

          <button className="btn btn-primary" onClick={handleSaveUser}><Check size={14} /> Save all changes</button>
        </Sheet>
      )}

      <Toast message={toast?.msg} type={toast?.type} />
    </div>
  );
}