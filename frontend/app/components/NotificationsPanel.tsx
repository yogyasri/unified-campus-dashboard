'use client';

import { useEffect, useState, useCallback } from 'react';
import { HiOutlineBellAlert, HiOutlineExclamationTriangle, HiOutlineInformationCircle, HiOutlineArrowPath, HiOutlineClock, HiOutlineBookmark, HiOutlineCheckCircle, HiOutlineXMark } from 'react-icons/hi2';
import { useToast } from '../context/ToastContext';

interface Announcement {
  id: number;
  title: string;
  message: string;
  severity: string;
  author: string;
  category: string;
}

interface Deadline {
  id: number;
  title: string;
  description: string;
  due_date: string;
  course_code: string | null;
  category: string;
}

export default function NotificationsPanel() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [bookmarkState, setBookmarkState] = useState<Record<number, 'idle' | 'loading' | 'done'>>({});
  const { showToast } = useToast();

  const [bookmarks, setBookmarks] = useState<Announcement[]>([]);
  const [activeView, setActiveView] = useState<'alerts' | 'bookmarks'>('alerts');

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [notifRes, bmRes] = await Promise.all([
        fetch('/api/notifications', { cache: 'no-store' }),
        fetch('/api/notifications/my-bookmarks', { cache: 'no-store' })
      ]);
      if (!notifRes.ok) throw new Error('Failed to fetch');
      const data = await notifRes.json();
      setAnnouncements(data.announcements || []);
      setDeadlines(data.deadlines || []);
      
      if (bmRes.ok) {
        const bmData = await bmRes.json();
        const bms = bmData.bookmarks || [];
        setBookmarks(bms);
        const initialBookmarkState: Record<number, 'idle' | 'loading' | 'done'> = {};
        bms.forEach((b: Announcement) => {
          initialBookmarkState[b.id] = 'done';
        });
        setBookmarkState(initialBookmarkState);
      }
      
      setLastUpdated(new Date());
      setError('');
    } catch {
      if (!silent) setError('Unable to connect');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleBookmark = async (ann: Announcement) => {
    if (bookmarkState[ann.id] === 'done') return;

    // Optimistic: flip icon immediately
    setBookmarkState((prev) => ({ ...prev, [ann.id]: 'done' }));

    try {
      const res = await fetch('/api/notifications/bookmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcementId: ann.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed');
      showToast(`🔖 "${ann.title}" bookmarked!`, 'success');
    } catch (err: any) {
      // Revert
      setBookmarkState((prev) => ({ ...prev, [ann.id]: 'idle' }));
      showToast(`Network timeout. Could not save bookmark.`, 'error');
    }
  };

  const handleRemoveBookmark = async (ann: Announcement) => {
    try {
      const res = await fetch('/api/notifications/bookmark/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcementId: ann.id }),
      });
      if (!res.ok) throw new Error('Failed to remove bookmark');
      setBookmarks(prev => prev.filter(b => b.id !== ann.id));
      setBookmarkState(prev => { const next = { ...prev }; delete next[ann.id]; return next; });
      showToast(`Bookmark removed for "${ann.title}"`, 'info');
    } catch {
      showToast('Could not remove bookmark', 'error');
    }
  };

  const getDaysUntil = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff <= 0) return 'Due today!';
    if (diff === 1) return '1 day left';
    return `${diff} days left`;
  };

  const severityConfig: Record<string, { icon: typeof HiOutlineInformationCircle; color: string; bg: string }> = {
    info: { icon: HiOutlineInformationCircle, color: 'var(--accent-blue)', bg: 'rgba(59,130,246,0.1)' },
    warning: { icon: HiOutlineExclamationTriangle, color: 'var(--accent-amber)', bg: 'rgba(245,158,11,0.1)' },
    urgent: { icon: HiOutlineBellAlert, color: 'var(--accent-red)', bg: 'rgba(239,68,68,0.1)' },
  };

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(239, 68, 68, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <HiOutlineBellAlert size={20} style={{ color: 'var(--accent-red)' }} />
          </div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Alerts & Deadlines</h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : `${announcements.length} alerts`}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--glass)', borderRadius: 10, padding: 4, gap: 4 }}>
            <button
              onClick={() => setActiveView('alerts')}
              style={{
                padding: '4px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                background: activeView === 'alerts' ? 'var(--accent-red)' : 'transparent',
                color: activeView === 'alerts' ? 'white' : 'var(--text-muted)',
                transition: 'all 0.2s ease',
              }}
            >
              Alerts
            </button>
            <button
              onClick={() => setActiveView('bookmarks')}
              style={{
                padding: '4px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                background: activeView === 'bookmarks' ? 'var(--accent-blue)' : 'transparent',
                color: activeView === 'bookmarks' ? 'white' : 'var(--text-muted)',
                transition: 'all 0.2s ease',
              }}
            >
              Bookmarks
            </button>
          </div>
          <button onClick={() => fetchData()} className="btn-ghost" style={{ padding: 6, borderRadius: 8 }}>
            <HiOutlineArrowPath size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 50, borderRadius: 10 }} />)}
        </div>
      ) : error ? (
        <p style={{ color: 'var(--accent-red)', fontSize: 13 }}>{error}</p>
      ) : (
        <>
          {activeView === 'alerts' ? (
            <>
              {/* Alerts */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {announcements.slice(0, 3).map((ann) => {
                  const config = severityConfig[ann.severity] || severityConfig.info;
                  const Icon = config.icon;
                  const bState = bookmarkState[ann.id] || 'idle';
                  return (
                    <div key={ann.id} style={{
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                      padding: '10px 12px', borderRadius: 10,
                      background: config.bg,
                      border: `1px solid ${config.color}20`,
                    }}>
                      <Icon size={18} style={{ color: config.color, flexShrink: 0, marginTop: 1 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{ann.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ann.message}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <div className={`live-indicator ${ann.severity === 'warning' ? 'warning' : ann.severity === 'urgent' ? 'urgent' : ''}`} style={{ marginTop: 4 }} />
                        <button
                          onClick={() => handleBookmark(ann)}
                          title={bState === 'done' ? 'Bookmarked!' : 'Bookmark this alert'}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                            color: bState === 'done' ? config.color : 'var(--text-muted)',
                            transition: 'all 0.2s ease',
                            transform: bState === 'done' ? 'scale(1.2)' : 'scale(1)',
                          }}
                        >
                          {bState === 'done'
                            ? <HiOutlineCheckCircle size={14} style={{ color: 'var(--accent-green)' }} />
                            : <HiOutlineBookmark size={14} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Deadlines */}
              {deadlines.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Upcoming Deadlines
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {deadlines.slice(0, 3).map((dl) => {
                      const daysLeft = Math.ceil((new Date(dl.due_date + 'T00:00:00').getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
                      const isUrgent = daysLeft <= 3;
                      return (
                        <div key={dl.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '8px 10px', borderRadius: 8, background: 'var(--glass)',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {dl.title}
                              {dl.course_code && <span className="badge badge-purple">{dl.course_code}</span>}
                            </div>
                          </div>
                          <span style={{
                            fontSize: 11, fontWeight: 600, flexShrink: 0, marginLeft: 8,
                            color: isUrgent ? 'var(--accent-red)' : 'var(--accent-teal)',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                            <HiOutlineClock size={12} />
                            {getDaysUntil(dl.due_date)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {bookmarks.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No bookmarks yet.
                </div>
              ) : (
                bookmarks.map((ann) => {
                  const config = severityConfig[ann.severity] || severityConfig.info;
                  const Icon = config.icon;
                  return (
                    <div key={ann.id} style={{
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                      padding: '10px 12px', borderRadius: 10,
                      background: 'var(--glass)',
                      border: '1px solid var(--glass-border)',
                    }}>
                      <Icon size={18} style={{ color: config.color, flexShrink: 0, marginTop: 1 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{ann.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {ann.message}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveBookmark(ann)}
                        title="Remove bookmark"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                          borderRadius: 6, color: 'var(--text-muted)', flexShrink: 0,
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-red)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        <HiOutlineXMark size={16} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
