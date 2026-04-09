import { Home } from '../components/Icons';

export default function NotFoundPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 40, background: 'var(--bg)' }}>
      <div style={{ fontSize: 80, fontWeight: 200, color: 'var(--primary)', fontFamily: 'var(--font-serif)', lineHeight: 1 }}>404</div>
      <div style={{ fontSize: 16, color: 'var(--text-secondary)', marginTop: 8, marginBottom: 24 }}>This page doesn't exist</div>
      <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 10, background: 'var(--primary)', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}><Home size={16} /> Go home</a>
    </div>
  );
}