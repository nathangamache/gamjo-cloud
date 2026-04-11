import { useEffect, useState } from 'react';

export default function VerifyPage() {
  const [status, setStatus] = useState('verifying');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) { setStatus('error'); return; }

    // Use raw fetch, NOT api.get, to avoid 401 redirect loop
    fetch(`/api/auth/verify?token=${token}`, { credentials: 'include' })
      .then(res => {
        if (res.ok) {
          setStatus('success');
          // Small delay so the user sees "Success" then redirect
          setTimeout(() => { window.location.href = '/'; }, 800);
        } else {
          return res.json().then(data => {
            console.error('Verify failed:', data);
            setStatus('error');
          }).catch(() => setStatus('error'));
        }
      })
      .catch(err => {
        console.error('Verify error:', err);
        setStatus('error');
      });
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--primary)', marginBottom: 16 }}>GamJo</div>
        {status === 'verifying' && <div style={{ color: 'var(--text-secondary)' }}>Signing you in...</div>}
        {status === 'success' && <div style={{ color: 'var(--sage)', fontWeight: 500 }}>You're in! Redirecting...</div>}
        {status === 'error' && (
          <>
            <div style={{ color: 'var(--danger)', marginBottom: 12 }}>This link has expired or is invalid.</div>
            <a href="/" style={{ color: 'var(--primary)', fontWeight: 500 }}>Request a new login link</a>
          </>
        )}
      </div>
    </div>
  );
}