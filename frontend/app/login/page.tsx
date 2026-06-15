'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiOutlineAcademicCap, HiOutlineEye, HiOutlineEyeSlash } from 'react-icons/hi2';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      router.push('/');
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
    setError('');
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16, boxShadow: '0 8px 32px rgba(139, 92, 246, 0.3)',
          }}>
            <HiOutlineAcademicCap size={32} color="white" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Campus Hub</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Sign in to your student dashboard</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Student Email
            </label>
            <input
              type="email"
              className="input-field"
              placeholder="alice@cs.iitr.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-field"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingRight: 42 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  padding: 4, display: 'flex',
                }}
              >
                {showPassword ? <HiOutlineEyeSlash size={18} /> : <HiOutlineEye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 16,
              color: 'var(--accent-red)', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', padding: '12px 20px' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Demo Accounts */}
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--glass-border)' }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Demo Accounts
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { email: 'alice@cs.iitr.in', name: 'Alice Chen', major: 'Computer Science' },
              { email: 'bob@ece.iitr.ac.in', name: 'Bob Martinez', major: 'Electronics' },
              { email: 'yogya@cs.iitr.in', name: 'Yogya', major: 'Computer Science' },
            ].map((demo) => (
              <button
                key={demo.email}
                onClick={() => fillDemo(demo.email)}
                className="btn-ghost"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left' }}
              >
                <span style={{ fontWeight: 600, fontSize: 13 }}>{demo.name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{demo.major}</span>
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
            Password for all: <code style={{ color: 'var(--accent-purple)', background: 'rgba(139,92,246,0.1)', padding: '1px 6px', borderRadius: 4 }}>password123</code>
          </p>
        </div>
      </div>
    </div>
  );
}
