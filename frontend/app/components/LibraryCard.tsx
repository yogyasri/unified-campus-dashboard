'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  HiOutlineBookOpen, HiOutlineArrowPath,
  HiOutlineCheckCircle, HiOutlineBookmark,
  HiOutlineMapPin,
} from 'react-icons/hi2';
import { useToast } from '../context/ToastContext';

interface LibraryStats {
  totalBooks: number;
  totalCopies: number;
  availableCopies: number;
  genres: string[];
  unavailableBooks: number;
}

interface Book {
  id: number;
  title: string;
  author: string;
  genre: string;
  available: number;
  total_copies: number;
  location: string;
}

interface LibraryData {
  stats: LibraryStats;
  recentArrivals: Book[];
  unavailableBooks: Book[];
}

export default function LibraryCard() {
  const [data, setData] = useState<LibraryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [holdState, setHoldState] = useState<Record<number, 'idle' | 'loading' | 'done'>>({});
  const { showToast } = useToast();

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [res, holdsRes] = await Promise.all([
        fetch('/api/library', { cache: 'no-store' }),
        fetch('/api/library/user-holds', { cache: 'no-store' })
      ]);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      
      let holdIds: number[] = [];
      if (holdsRes.ok) {
        const holdsData = await holdsRes.json();
        holdIds = holdsData.holdIds || [];
      }
      
      const initialHoldState: Record<number, 'idle' | 'loading' | 'done'> = {};
      holdIds.forEach(id => {
        initialHoldState[id] = 'done';
      });
      setHoldState(initialHoldState);
      
      setData(result);
      setLastUpdated(new Date());
      setError('');
    } catch (e: any) {
      if (!silent) setError(`Unable to connect to library: ${e.message}`);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleHold = async (book: Book) => {
    if (holdState[book.id] === 'done') return;
    setHoldState((prev) => ({ ...prev, [book.id]: 'loading' }));
    try {
      const res = await fetch('/api/library/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: book.id }),
      });
      const result = await res.json();
      if (!res.ok || result.error) throw new Error(result.error || 'Hold failed');
      setHoldState((prev) => ({ ...prev, [book.id]: 'done' }));
      showToast(`📚 Hold placed for "${book.title}"! You'll be notified when available.`, 'success');
    } catch {
      setHoldState((prev) => ({ ...prev, [book.id]: 'idle' }));
      showToast(`Network timeout. Could not place hold for "${book.title}".`, 'error');
    }
  };

  const stats = data?.stats;
  const availPercent = stats ? Math.round((stats.availableCopies / Math.max(stats.totalCopies, 1)) * 100) : 0;

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(139, 92, 246, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <HiOutlineBookOpen size={20} style={{ color: 'var(--accent-purple)' }} />
          </div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Library</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="live-indicator" />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {lastUpdated
                  ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'Live availability'}
              </span>
            </div>
          </div>
        </div>
        <button onClick={() => fetchData()} className="btn-ghost" style={{ padding: 6, borderRadius: 8 }}>
          <HiOutlineArrowPath size={16} />
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="skeleton" style={{ height: 60, borderRadius: 12 }} />
          <div className="skeleton" style={{ height: 20 }} />
          <div className="skeleton" style={{ height: 20 }} />
          <div className="skeleton" style={{ height: 20, width: '70%' }} />
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <p style={{ color: 'var(--accent-red)', fontSize: 13, marginBottom: 10 }}>{error}</p>
          <button onClick={() => fetchData()} className="btn-ghost" style={{ fontSize: 12, padding: '6px 14px', borderRadius: 20 }}>
            Retry
          </button>
        </div>
      ) : stats && (
        <>
          {/* Stats Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            {/* Circular progress */}
            <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
              <svg viewBox="0 0 36 36" style={{ width: 52, height: 52, transform: 'rotate(-90deg)' }}>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke="var(--accent-purple)" strokeWidth="3"
                  strokeDasharray={`${availPercent} ${100 - availPercent}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 0.6s ease' }}
                />
              </svg>
              <span style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
              }}>
                {availPercent}%
              </span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{stats.availableCopies}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>of {stats.totalCopies} copies available</div>
              <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 2 }}>
                {stats.unavailableBooks} title{stats.unavailableBooks !== 1 ? 's' : ''} checked out
              </div>
            </div>
          </div>

          {/* Checked Out — Place Hold */}
          {data!.unavailableBooks.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-red)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📕 Checked Out — Place a Hold</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                {data!.unavailableBooks.map((book) => {
                  const state = holdState[book.id] || 'idle';
                  return (
                    <div key={book.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 10px', borderRadius: 8,
                      background: 'rgba(239,68,68,0.06)',
                      border: '1px solid rgba(239,68,68,0.15)',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <HiOutlineMapPin size={10} /> {book.location}
                        </div>
                      </div>
                      <button
                        onClick={() => handleHold(book)}
                        disabled={state === 'loading'}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '3px 10px', borderRadius: 20, border: 'none',
                          cursor: state === 'done' ? 'default' : 'pointer',
                          fontSize: 11, fontWeight: 600, flexShrink: 0, marginLeft: 8,
                          background: state === 'done' ? 'rgba(34,197,94,0.15)' : 'rgba(139,92,246,0.15)',
                          color: state === 'done' ? 'var(--accent-green)' : 'var(--accent-purple)',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {state === 'done'
                          ? <><HiOutlineCheckCircle size={11} /> Held</>
                          : state === 'loading' ? '...'
                            : <><HiOutlineBookmark size={11} /> Hold</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Recent Arrivals */}
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Recent Arrivals
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(data!.recentArrivals || []).slice(0, 4).map((book) => (
              <div key={book.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '7px 10px', borderRadius: 8, background: 'var(--glass)',
              }}>
                <div style={{ overflow: 'hidden', flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{book.author}</div>
                </div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '2px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 600, flexShrink: 0, marginLeft: 8,
                  background: book.available > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  color: book.available > 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                }}>
                  {book.available > 0 ? `${book.available} avail` : 'Out'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
