import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Receipt, Dollar, Trash, Edit, X, Check, Image, Users } from '../components/Icons';
import { Sheet, Toast, useConfirm, EmptyState, LoadingButton, SkeletonExpenseList } from '../components/Shared';
import { api } from '../utils/api';
import { formatDate, formatMoney, formatPct, getTripStatus, msg } from '../utils/helpers';
import { Avatar, useApp } from '../App';

const CATEGORIES = ['Food & Drink', 'Activities', 'Gas & Transport', 'Groceries', 'Supplies', 'Lodging', 'Other'];

export default function ExpensesPage({ trip, user, members, groups: propGroups, expenses: propExpenses, setExpenses: propSetExpenses, refreshExpenses }) {
  const { isAdmin, isDesktop, groups: ctxGroups, expenses: ctxExpenses, setExpenses: ctxSetExpenses, dataLoaded } = useApp();
  const groups = propGroups || ctxGroups || [];
  const expenses = propExpenses || ctxExpenses || [];
  const setExpenses = propSetExpenses || ctxSetExpenses || (() => {});
  const [tab, setTab] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [showSplits, setShowSplits] = useState(false);
  const [showEdit, setShowEdit] = useState(null);
  const [showReceipt, setShowReceipt] = useState(null);
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const receiptRef = useRef(null);
  const editReceiptRef = useRef(null);
  const [receiptFile, setReceiptFile] = useState(null);
  const [settledGroups, setSettledGroups] = useState(trip?.settled_groups || []);
  const confirm = useConfirm();

  const defaultForm = () => ({ title: '', amount: '', paid_by: user?.id || '', date: new Date().toISOString().split('T')[0], notes: '', category: '', group_ids: groups.map(g => g.id) });
  const [form, setForm] = useState(defaultForm);
  const [editForm, setEditForm] = useState({ title: '', amount: '', paid_by: '', date: '', notes: '', category: '', group_ids: [] });

  const showToast = (text, type = 'info') => { setToast({ msg: text, type }); setTimeout(() => setToast(null), 2500); };

  useEffect(() => { setForm(f => ({ ...f, group_ids: groups.map(g => g.id), paid_by: f.paid_by || user?.id || (members[0]?.id) || '' })); }, [groups, members, user?.id]);

  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const myExpenses = expenses.filter(e => e.paid_by === user?.id);
  const myTotal = myExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const getName = (id) => members.find(m => m.id === id || m.user_id === id)?.name || 'Unknown';

  // Per-person spending breakdown
  const perPerson = useMemo(() => {
    const map = {};
    members.forEach(m => { map[m.id || m.user_id] = { name: m.name, total: 0, count: 0 }; });
    expenses.forEach(e => { if (map[e.paid_by]) { map[e.paid_by].total += e.amount || 0; map[e.paid_by].count++; } });
    return Object.values(map).filter(p => p.count > 0).sort((a, b) => b.total - a.total);
  }, [expenses, members]);

  // Per-day totals
  const perDay = useMemo(() => {
    const map = {};
    expenses.forEach(e => {
      const d = e.date || 'No date';
      if (!map[d]) map[d] = 0;
      map[d] += e.amount || 0;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [expenses]);

  const myGroup = groups.find(g => g.members?.some(m => m.user_id === user?.id));
  const myGroupTotal = useMemo(() => {
    if (!myGroup) return 0;
    const payerIds = myGroup.members?.filter(m => m.is_payer).map(m => m.user_id) || [];
    return expenses.filter(e => payerIds.includes(e.paid_by)).reduce((s, e) => s + (e.amount || 0), 0);
  }, [expenses, myGroup]);

  // C6: filter expenses for "My group" tab
  const myGroupExpenses = useMemo(() => {
    if (!myGroup) return [];
    const memberIds = myGroup.members?.map(m => m.user_id) || [];
    return expenses.filter(e => memberIds.includes(e.paid_by));
  }, [expenses, myGroup]);

  // Balance calculation
  const balances = useMemo(() => {
    if (!groups.length) return [];
    const groupTotals = {}, payerTotals = {};
    groups.forEach(g => { groupTotals[g.id] = 0; });
    members.forEach(m => { payerTotals[m.id || m.user_id] = 0; });
    expenses.forEach(exp => {
      payerTotals[exp.paid_by] = (payerTotals[exp.paid_by] || 0) + (exp.amount || 0);
      const eg = exp.group_ids ? groups.filter(g => exp.group_ids.includes(g.id)) : groups;
      const tp = eg.reduce((s, g) => s + (g.percentage || 0), 0) || 100;
      eg.forEach(g => { groupTotals[g.id] = (groupTotals[g.id] || 0) + (exp.amount || 0) * ((g.percentage || 0) / tp); });
    });
    return groups.map(g => {
      const owed = groupTotals[g.id] || 0;
      // Count payments from ALL members in this group, not just designated payers
      const memberIds = g.members?.map(m => m.user_id) || [];
      const paid = memberIds.reduce((s, pid) => s + (payerTotals[pid] || 0), 0);
      return { ...g, owed: Math.round(owed * 100) / 100, paid: Math.round(paid * 100) / 100, balance: Math.round((paid - owed) * 100) / 100 };
    });
  }, [expenses, groups, members]);

  // S1: Settlement instructions (who pays whom)
  const settlements = useMemo(() => {
    const debtors = balances.filter(b => b.balance < 0).map(b => ({ ...b, remaining: Math.abs(b.balance) }));
    const creditors = balances.filter(b => b.balance > 0).map(b => ({ ...b, remaining: b.balance }));
    const transfers = [];
    for (const d of debtors) {
      for (const c of creditors) {
        if (d.remaining <= 0 || c.remaining <= 0) continue;
        const amt = Math.min(d.remaining, c.remaining);
        if (amt > 0.01) {
          transfers.push({ from: d.name, to: c.name, amount: Math.round(amt * 100) / 100 });
          d.remaining -= amt;
          c.remaining -= amt;
        }
      }
    }
    return transfers;
  }, [balances]);

  const handleAdd = async () => {
    if (!form.title || !form.amount) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/api/trips/${trip.id}/expenses`, { ...form, amount: parseFloat(form.amount) });
      if (receiptFile && res.data?.id) {
        const fd = new FormData(); fd.append('file', receiptFile);
        try { await api.upload(`/api/trips/${trip.id}/expenses/${res.data.id}/receipt`, fd); } catch {}
      }
      if (refreshExpenses) await refreshExpenses();
      setForm(defaultForm()); setReceiptFile(null); setShowAdd(false);
      showToast(msg('toasts.expenseAdded', {}, true), 'success');
    } catch { showToast('Failed to add expense', 'error'); }
    setSubmitting(false);
  };

  // C1/A5: Edit expense
  const openEdit = (e) => {
    if (!isAdmin && e.paid_by !== user?.id && e.created_by !== user?.id) return;
    setShowEdit(e);
    setEditForm({ title: e.title, amount: String(e.amount || ''), paid_by: e.paid_by, date: e.date || '', notes: e.notes || '', category: e.category || '', group_ids: e.group_ids || groups.map(g => g.id) });
  };
  const handleSaveEdit = async () => {
    if (!showEdit || !editForm.title || !editForm.amount) return;
    setSubmitting(true);
    try {
      await api.put(`/api/trips/${trip.id}/expenses/${showEdit.id}`, { ...editForm, amount: parseFloat(editForm.amount) });
      if (refreshExpenses) await refreshExpenses();
      setShowEdit(null);
      showToast(msg('toasts.expenseUpdated', {}, true), 'success');
    } catch { showToast('Failed to update', 'error'); }
    setSubmitting(false);
  };

  const handleDelete = async (id) => {
    if (!await confirm({ title: msg('confirms.deleteExpense.titles', {}, true), message: msg('confirms.deleteExpense.messages', {}, true), confirmText: msg('confirms.deleteExpense.confirmText', {}, true), danger: true })) return;
    try { await api.delete(`/api/trips/${trip.id}/expenses/${id}`); setExpenses(prev => prev.filter(e => e.id !== id)); showToast(msg('toasts.expenseDeleted', {}, true), 'success'); } catch { showToast('Failed to delete', 'error'); }
  };

  // A7: Export CSV
  const handleExport = () => {
    const getGroupNames = (e) => {
      if (!e.group_ids?.length) return 'All groups';
      return e.group_ids.map(gid => groups.find(g => g.id === gid)?.name || '').filter(Boolean).join('; ');
    };
    const header = 'Title,Amount,Paid By,Date,Split Between,Notes\n';
    const rows = expenses.map(e => `"${e.title}",${e.amount},"${getName(e.paid_by)}","${e.date || ''}","${getGroupNames(e)}","${(e.notes || '').replace(/"/g, '""')}"`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${trip?.name || 'expenses'}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast('Exported. Time for the audit.', 'success');
  };

  // S5/A9: Toggle group settled status
  const handleToggleSettle = async (groupId) => {
    if (!isAdmin) return;
    try {
      const res = await api.post(`/api/trips/${trip.id}/settle/${groupId}`);
      if (res.data) setSettledGroups(res.data.settled_groups || []);
    } catch { showToast('Failed to update', 'error'); }
  };
  const isGroupSettled = (groupId) => settledGroups.includes(String(groupId));

  const toggleGroup = (gid) => setForm(f => ({ ...f, group_ids: f.group_ids.includes(gid) ? f.group_ids.filter(x => x !== gid) : [...f.group_ids, gid] }));
  const toggleEditGroup = (gid) => setEditForm(f => ({ ...f, group_ids: f.group_ids.includes(gid) ? f.group_ids.filter(x => x !== gid) : [...f.group_ids, gid] }));
  const tabNames = ['All', 'My receipts', 'My group'];

  // C6: displayExpenses filters properly for all three tabs
  const displayExpenses = tab === 1 ? myExpenses : tab === 2 ? myGroupExpenses : expenses;

  // Shared expense row component
  const getUser = (id) => members.find(m => m.id === id || m.user_id === id);

  const ExpenseRow = ({ e }) => {
    const payer = getUser(e.paid_by);
    return (
    <div className="expense-row" style={{ cursor: (isAdmin || e.paid_by === user?.id || e.created_by === user?.id) ? 'pointer' : undefined }} onClick={() => openEdit(e)}>
      <div style={{ flexShrink: 0 }}>
        <Avatar user={payer} size="sm" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 500, fontSize: 14 }}>{e.title}</span>
          {e.category && <span style={{ fontSize: 12, color: 'var(--primary)', background: 'var(--primary-light)', padding: '1px 8px', borderRadius: 10 }}>{e.category}</span>}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{getName(e.paid_by)} &middot; {formatDate(e.date)}</div>
        {e.notes && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>{e.notes}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--warm)' }}>{formatMoney(e.amount)}</span>
        {(isAdmin || e.paid_by === user?.id || e.created_by === user?.id) && <button className="icon-btn" onClick={e2 => { e2.stopPropagation(); handleDelete(e.id); }} aria-label="Delete expense"><Trash size={14} color="var(--text-muted)" /></button>}
      </div>
    </div>
    );
  };

  return (
    <div className="page-expenses">
      {!isDesktop && <div className="topbar"><span className="topbar-title">Expenses</span><button className="btn-add" onClick={() => setShowAdd(true)}><Plus size={13} /> Add</button></div>}
      {isDesktop && <div className="desk-header"><div className="desk-header-title">Expenses</div><div style={{ display: 'flex', gap: 8 }}>{isAdmin && <button className="btn-add" style={{ background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }} onClick={handleExport}>Export CSV</button>}<button className="btn-add" onClick={() => setShowAdd(true)}><Plus size={13} /> Add expense</button></div></div>}

      <div style={{ padding: isDesktop ? '24px 32px' : '0 20px' }}>
        <div className="tab-bar mb-md">{tabNames.map((t, i) => <button key={i} className={`tab-bar-item ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>{t}</button>)}</div>

        {isDesktop ? (
          <div className="desk-two-col">
            <div className="desk-main-col">
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="data-table">
                  <thead><tr><th>Expense</th><th>Paid by</th><th>Date</th><th style={{ textAlign: 'right' }}>Amount</th><th></th></tr></thead>
                  <tbody>{displayExpenses.map(e => (
                    <tr key={e.id} style={{ cursor: (isAdmin || e.paid_by === user?.id || e.created_by === user?.id) ? 'pointer' : undefined }} onClick={() => openEdit(e)}>
                      <td><div className="flex items-center gap-md"><div className={`expense-icon ${e.has_receipt ? 'receipt' : 'manual'}`} style={{ width: 32, height: 32 }}>{e.has_receipt ? <Receipt size={14} /> : <Dollar size={14} />}</div><div>{e.title}{e.notes && <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>{e.notes.slice(0, 40)}</div>}</div></div></td>
                      <td style={{ color: 'var(--text-secondary)' }}>{getName(e.paid_by)}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{formatDate(e.date)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--warm)' }}>{formatMoney(e.amount)}</td>
                      <td onClick={e2 => e2.stopPropagation()}><div style={{ display: 'flex', gap: 4 }}>{e.has_receipt && <button onClick={() => setShowReceipt(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><Image size={14} color="var(--primary)" /></button>}{(isAdmin || e.paid_by === user?.id || e.created_by === user?.id) && <button onClick={() => handleDelete(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><Trash size={14} color="var(--text-muted)" /></button>}</div></td>
                    </tr>
                  ))}</tbody>
                </table>
                {!dataLoaded && expenses.length === 0 ? <div style={{ padding: 16 }}><SkeletonExpenseList count={4} /></div> : displayExpenses.length === 0 && <EmptyState type="expenses" title={msg('emptyStates.expenses.titles')} message={msg('emptyStates.expenses.messages')} />}
              </div>
            </div>
            <div className="desk-side-col">
              <div className="summary-card blue mb-md">
                <div className="summary-card-label">Trip total</div><div className="summary-card-value">{formatMoney(total)}</div>
                <div className="summary-card-meta">{expenses.length} expenses &middot; {groups.length} groups</div>
                <div className="summary-card-action" onClick={() => setShowSplits(true)}>Preview group splits</div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {tab === 0 && <div className="summary-card blue mb-md"><div className="summary-card-label">Trip total</div><div className="summary-card-value">{formatMoney(total)}</div><div className="summary-card-meta">{expenses.length} expenses across {groups.length} groups</div><div className="summary-card-action" onClick={() => setShowSplits(true)}>Preview group splits</div></div>}
            {tab === 1 && <div className="stat-grid mb-md"><div className="stat-card"><div className="stat-value">{formatMoney(myTotal)}</div><div className="stat-label">my total paid</div></div><div className="stat-card"><div className="stat-value">{myExpenses.length}</div><div className="stat-label">my receipts</div></div></div>}
            {tab === 2 && myGroup && <div className="summary-card teal mb-md"><div className="summary-card-label">{myGroup.name}</div><div className="summary-card-value" style={{ fontSize: 26 }}>{formatMoney(myGroupTotal)}</div><div className="summary-card-meta">Total paid by group &middot; {formatPct(myGroup.percentage)} share</div></div>}
            <div className="card" style={{ padding: '0 16px' }}>
              {!dataLoaded && expenses.length === 0 ? <SkeletonExpenseList count={4} /> : displayExpenses.length === 0 ? <EmptyState type="expenses" title={msg('emptyStates.expenses.titles')} message={msg('emptyStates.expenses.messages')} /> : displayExpenses.map(e => <ExpenseRow key={e.id} e={e} />)}
            </div>
          </>
        )}
      </div>

      {/* Add Expense Sheet */}
      {showAdd && (
        <Sheet onClose={() => { setShowAdd(false); setReceiptFile(null); }} title="Who's paying?">
          <div className="form-group"><label className="label">What was it for?</label><input className="form-input" placeholder={msg("placeholders.expenseTitle")} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus /></div>
          <div className="form-group"><label className="label">Amount</label><input className="form-input" type="number" step="0.01" inputMode="decimal" placeholder={msg("placeholders.expenseNotes")} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 140 }}><label className="label">Who paid?</label><select className="form-input" value={form.paid_by} onChange={e => setForm(f => ({ ...f, paid_by: e.target.value }))}>{members.map(m => <option key={m.id || m.user_id} value={m.id || m.user_id}>{m.name}</option>)}</select></div>
            <div className="form-group" style={{ flex: 1, minWidth: 140 }}><label className="label">Category</label><select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}><option value="">Select...</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          </div>
          <div className="form-group"><label className="label">Date</label><input className="form-input" type="date" min={trip?.start_date || ''} max={trip?.end_date || ''} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
          <div className="form-group"><label className="label">Split between</label><div className="pill-group">{groups.map(g => <button key={g.id} className={`pill ${form.group_ids.includes(g.id) ? 'active' : ''}`} onClick={() => toggleGroup(g.id)}>{g.name} ({formatPct(g.percentage)})</button>)}</div></div>
          <div className="form-group"><label className="label">Notes (optional)</label><input className="form-input" placeholder={msg("placeholders.expenseNotes")} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          <div className="form-group">
            <label className="label">Receipt photo</label>
            <input ref={receiptRef} type="file" accept="image/*" onChange={e => setReceiptFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
            <div className="upload-zone" style={{ cursor: 'pointer' }} onClick={() => receiptRef.current?.click()}>
              {receiptFile ? <div style={{ fontSize: 14, color: 'var(--sage)', fontWeight: 500 }}>{receiptFile.name} attached</div>
              : <><Receipt size={20} color="var(--text-muted)" /><div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', marginTop: 6 }}>Tap to attach the evidence</div></>}
            </div>
          </div>
          <LoadingButton loading={submitting} onClick={handleAdd}>Add expense</LoadingButton>
        </Sheet>
      )}

      {showEdit && (
        <Sheet onClose={() => setShowEdit(null)} title="Edit expense">
          <div className="form-group"><label className="label">What was it for?</label><input className="form-input" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div className="form-group"><label className="label">Amount</label><input className="form-input" type="number" step="0.01" inputMode="decimal" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} /></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 140 }}><label className="label">Who paid?</label><select className="form-input" value={editForm.paid_by} onChange={e => setEditForm(f => ({ ...f, paid_by: e.target.value }))}>{members.map(m => <option key={m.id || m.user_id} value={m.id || m.user_id}>{m.name}</option>)}</select></div>
            <div className="form-group" style={{ flex: 1, minWidth: 140 }}><label className="label">Category</label><select className="form-input" value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}><option value="">Select...</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          </div>
          <div className="form-group"><label className="label">Date</label><input className="form-input" type="date" min={trip?.start_date || ''} max={trip?.end_date || ''} value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} /></div>
          <div className="form-group"><label className="label">Split between</label><div className="pill-group">{groups.map(g => <button key={g.id} className={`pill ${editForm.group_ids.includes(g.id) ? 'active' : ''}`} onClick={() => toggleEditGroup(g.id)}>{g.name} ({formatPct(g.percentage)})</button>)}</div></div>
          <div className="form-group"><label className="label">Notes</label><input className="form-input" value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder={msg("placeholders.expenseNotes")} /></div>
          {showEdit.receipt_url && <div className="form-group"><label className="label">Receipt</label><div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setShowReceipt(showEdit)}><img src={showEdit.receipt_url} alt="Receipt" style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} /></div></div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <LoadingButton loading={submitting} onClick={handleSaveEdit} style={{ flex: 1 }}><Check size={14} /> Save changes</LoadingButton>
            {(isAdmin || showEdit.paid_by === user?.id || showEdit.created_by === user?.id) && <button className="btn btn-danger" style={{ flex: 0, width: 'auto', padding: '15px 18px' }} onClick={() => { handleDelete(showEdit.id); setShowEdit(null); }} aria-label="Delete expense"><Trash size={16} /></button>}
          </div>
        </Sheet>
      )}

      {/* S1: Group Splits with settlement instructions */}
      {showSplits && (
        <Sheet onClose={() => setShowSplits(false)} title={getTripStatus(trip) === 'completed' ? 'Final balances' : 'Group split preview'}>
          {getTripStatus(trip) !== 'completed' && <div style={{ padding: '12px 16px', background: 'var(--vote-bg)', borderRadius: 10, marginBottom: 16, fontSize: 13, color: 'var(--vote-text)' }}>These are estimates based on current expenses. Final balances are calculated when the trip is completed.</div>}
          {balances.map(b => (
            <div key={b.id} className="card" style={{ marginBottom: 10, opacity: isGroupSettled(b.id) ? 0.6 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 500, fontSize: 15 }}>{b.name}</div>
                {isAdmin && (
                  <button onClick={() => handleToggleSettle(b.id)} style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid', borderColor: isGroupSettled(b.id) ? 'var(--sage)' : 'var(--border)', background: isGroupSettled(b.id) ? 'var(--sage-light)' : 'var(--surface)', color: isGroupSettled(b.id) ? 'var(--sage)' : 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isGroupSettled(b.id) ? <><Check size={11} /> Settled</> : 'Mark settled'}
                  </button>
                )}
                {!isAdmin && isGroupSettled(b.id) && <span style={{ padding: '4px 12px', borderRadius: 8, background: 'var(--sage-light)', color: 'var(--sage)', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={11} /> Settled</span>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <div><div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Their share</div><div style={{ fontWeight: 500 }}>{formatMoney(b.owed)}</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Paid so far</div><div style={{ fontWeight: 500 }}>{formatMoney(b.paid)}</div></div>
                <div style={{ textAlign: 'right' }}><div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Balance</div><div style={{ fontWeight: 600, fontSize: 16, color: b.balance >= 0 ? 'var(--sage)' : 'var(--danger)' }}>{b.balance >= 0 ? '+' : ''}{formatMoney(b.balance)}</div></div>
              </div>
            </div>
          ))}
          {/* S1: Settlement transfers */}
          {settlements.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>{msg('settlements.headers')}</div>
              {settlements.map((s, i) => {
                const fromGroup = balances.find(b => b.name === s.from);
                const toGroup = balances.find(b => b.name === s.to);
                const transferSettled = fromGroup && toGroup && isGroupSettled(fromGroup.id) && isGroupSettled(toGroup.id);
                return (
                  <div key={i} style={{ padding: '12px 16px', background: transferSettled ? 'var(--sage-light)' : 'var(--surface-alt)', borderRadius: 10, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10, opacity: transferSettled ? 0.7 : 1 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, textDecoration: transferSettled ? 'line-through' : 'none' }}>{s.from}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{transferSettled ? 'paid' : 'pays'} {s.to}</div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: transferSettled ? 'var(--sage)' : 'var(--primary)' }}>
                      {transferSettled && <Check size={14} style={{ marginRight: 4 }} />}
                      {formatMoney(s.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {balances.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>No groups set up yet</div>}
        </Sheet>
      )}

      {/* C4: Receipt viewer */}
      {showReceipt && (
        <div className="sheet-backdrop" onClick={() => setShowReceipt(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '85vh' }}>
            <button onClick={() => setShowReceipt(null)} style={{ position: 'absolute', top: -16, right: -16, width: 36, height: 36, borderRadius: '50%', background: 'var(--text)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}><X size={18} color="#fff" /></button>
            <img src={showReceipt.receipt_url} alt="Receipt" style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 12, objectFit: 'contain' }} />
            <div style={{ textAlign: 'center', marginTop: 8, color: '#fff', fontSize: 13 }}>{showReceipt.title} &middot; {formatMoney(showReceipt.amount)}</div>
          </div>
        </div>
      )}

      <Toast message={toast?.msg} type={toast?.type} />
    </div>
  );
}