import { useState, useRef, useEffect } from 'react';
import { Send, Mail } from '../components/Icons';
import { msg } from '../utils/helpers';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('email');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const inputRefs = useRef([]);

  const handleSendCode = async (e) => {
    if (e) e.preventDefault();
    if (!email.includes('@')) { setError('Please enter a valid email'); return; }
    setError('');
    setSending(true);
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
      });
      if (res.ok) {
        setStep('code');
        setCode(['', '', '', '', '', '']);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || 'Could not send code. Make sure you have an account.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setSending(false);
  };

  useEffect(() => {
    if (step === 'code') setTimeout(() => inputRefs.current[0]?.focus(), 100);
    if (step === 'manual') setTimeout(() => inputRefs.current[0]?.focus(), 200);
  }, [step]);

  const handleCodeChange = (idx, val) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...code];
    next[idx] = digit;
    setCode(next);
    setError('');
    if (digit && idx < 5) inputRefs.current[idx + 1]?.focus();
    if (digit && idx === 5) {
      const full = next.join('');
      if (full.length === 6) submitCode(full);
    }
  };

  const handleCodeKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) inputRefs.current[idx - 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      setCode(pasted.split(''));
      submitCode(pasted);
    }
  };

  const submitCode = async (codeStr) => {
    setError('');
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: codeStr }),
        credentials: 'include',
      });
      if (res.ok) {
        setStep('success');
        setTimeout(() => { window.location.href = '/'; }, 600);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || 'Invalid or expired code');
        setCode(['', '', '', '', '', '']);
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      }
    } catch { setError('Something went wrong. Try again.'); }
  };

  const codeInputStyle = {
    width: 44, height: 52, textAlign: 'center', fontSize: 22, fontWeight: 600,
    fontFamily: 'var(--font-sans)', border: '1.5px solid var(--border)',
    borderRadius: 10, background: 'var(--surface)', color: 'var(--text)',
    outline: 'none', caretColor: 'var(--primary)',
  };

  return (
    <div className="login-page">
      <div className="login-hero" style={{ display: 'none' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 48, fontWeight: 400, color: 'var(--primary)', letterSpacing: -1, marginBottom: 8 }}>GamJo</div>
        <div style={{ fontSize: 18, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>Plan the fun. Split the tab.<br />Where the family plans vacations and questionable decisions.</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Private. Invite-only. What happens up north stays up north.</div>
      </div>
      <div className="login-mobile-brand" style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 36, fontWeight: 400, color: 'var(--primary)', letterSpacing: -1 }}>GamJo</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{msg('login.taglines')}</div>
      </div>
      <div className="login-card">
        {step === 'email' && (
          <form onSubmit={handleSendCode}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400, marginBottom: 4 }}>Welcome back</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>Drop your email and we'll send you a secret code.</div>
            <div className="form-group">
              <label className="label">Email address</label>
              <input className="form-input" type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" autoFocus />
              {error && <div style={{ fontSize: 13, color: 'var(--danger)', marginTop: 4 }}>{error}</div>}
            </div>
            <button type="submit" className="btn btn-primary" disabled={sending}>
              {sending ? 'Carrier pigeon dispatched...' : <><Send size={15} /> Send login code</>}
            </button>
            <button type="button" className="btn btn-secondary" style={{ marginTop: 8, fontSize: 13 }} onClick={() => { setError(''); setStep('manual'); }}>
              I already have a code
            </button>
          </form>
        )}
        {step === 'code' && (
          <div>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><Mail size={22} color="var(--primary)" /></div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, marginBottom: 4, textAlign: 'center' }}>Punch in your digits</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24, textAlign: 'center' }}>Check your email. Code sent to <strong>{email}</strong><br /><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Not seeing it? Check your spam folder.</span></div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8 }} onPaste={handlePaste}>
              {code.map((digit, idx) => (
                <input key={idx} ref={el => inputRefs.current[idx] = el} type="text" inputMode="numeric" maxLength={1} value={digit}
                  onChange={e => handleCodeChange(idx, e.target.value)} onKeyDown={e => handleCodeKeyDown(idx, e)} onFocus={e => e.target.select()}
                  style={{ ...codeInputStyle, borderColor: digit ? 'var(--primary)' : error ? 'var(--danger)' : 'var(--border)' }} />
              ))}
            </div>
            {error && <div style={{ fontSize: 13, color: 'var(--danger)', textAlign: 'center', marginTop: 8, marginBottom: 8 }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 20 }}>
              <button className="btn btn-secondary" style={{ fontSize: 13, padding: '10px 16px' }} onClick={handleSendCode}>Resend code</button>
              <button className="btn btn-secondary" style={{ fontSize: 13, padding: '10px 16px' }} onClick={() => { setStep('email'); setError(''); }}>Different email</button>
            </div>
          </div>
        )}
        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 8, color: 'var(--sage)' }}>&#10003;</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--sage)' }}>You're in!</div>
          </div>
        )}
        {step === 'manual' && (
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, marginBottom: 4 }}>Enter your code</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>Enter the email you were invited with and the 6-digit code from your inbox.</div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="label">Email address</label>
              <input className="form-input" type="email" placeholder="your@email.com" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} autoComplete="email" autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8 }} onPaste={handlePaste}>
              {code.map((digit, idx) => (
                <input key={idx} ref={el => inputRefs.current[idx] = el} type="text" inputMode="numeric" maxLength={1} value={digit}
                  onChange={e => handleCodeChange(idx, e.target.value)} onKeyDown={e => handleCodeKeyDown(idx, e)} onFocus={e => e.target.select()}
                  style={{ ...codeInputStyle, borderColor: digit ? 'var(--primary)' : error ? 'var(--danger)' : 'var(--border)' }} />
              ))}
            </div>
            {error && <div style={{ fontSize: 13, color: 'var(--danger)', textAlign: 'center', marginTop: 8, marginBottom: 8 }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
              <button className="btn btn-secondary" style={{ fontSize: 13, padding: '10px 16px' }} onClick={() => { setStep('email'); setError(''); setCode(['', '', '', '', '', '']); }}>Back</button>
            </div>
          </div>
        )}
      </div>
      <style>{`@media (min-width: 768px) { .login-mobile-brand { display: none !important; } .login-hero { display: block !important; } .login-card { width: 400px; flex-shrink: 0; } }`}</style>
    </div>
  );
}