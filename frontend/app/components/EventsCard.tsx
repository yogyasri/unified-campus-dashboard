'use client';

import { useEffect, useState, useCallback } from 'react';
import { HiOutlineCalendarDays, HiOutlineArrowPath, HiOutlineMapPin, HiOutlineClock, HiOutlineCheckCircle, HiOutlineUserPlus } from 'react-icons/hi2';
import { useToast } from '../context/ToastContext';

interface Event {
  id: number;
  title: string;
  date: string;
  time: string;
  end_time?: string;
  location: string;
  building?: string;
  category: string;
  current_attendees: number;
  max_attendees: number | null;
  organizer?: string;
  is_free?: number;
}

export default function EventsCard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [rsvpState, setRsvpState] = useState<Record<number, 'idle' | 'loading' | 'done'>>({});
  const { showToast } = useToast();

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [eventsRes, rsvpsRes] = await Promise.all([
        fetch('/api/events'),
        fetch('/api/events/my-rsvps')
      ]);
      if (!eventsRes.ok) throw new Error('Failed to fetch events');
      const data = await eventsRes.json();
      setEvents(data.events || []);
      
      if (rsvpsRes.ok) {
        const rsvpsData = await rsvpsRes.json();
        const rsvpIds: number[] = rsvpsData.rsvpIds || [];
        const initialRsvpState: Record<number, 'idle' | 'loading' | 'done'> = {};
        rsvpIds.forEach(id => {
          initialRsvpState[id] = 'done';
        });
        setRsvpState(initialRsvpState);
      }
      setLastUpdated(new Date());
      setError('');
    } catch {
      if (!silent) setError('Unable to connect to events');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRsvp = async (event: Event) => {
    if (rsvpState[event.id] === 'done') return;

    // Optimistic update
    setRsvpState((prev) => ({ ...prev, [event.id]: 'loading' }));
    setEvents((prev) => prev.map((e) => e.id === event.id ? { ...e, current_attendees: e.current_attendees + 1 } : e));

    try {
      const res = await fetch('/api/events/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id }),
      });
      const data = await res.json();
      if (data.success === false) {
        // Revert
        setEvents((prev) => prev.map((e) => e.id === event.id ? { ...e, current_attendees: e.current_attendees - 1 } : e));
        setRsvpState((prev) => ({ ...prev, [event.id]: 'idle' }));
        showToast(data.reason === 'Already RSVPed' ? 'You already RSVPed to this event.' : (data.reason || 'Could not RSVP.'), 'info');
      } else {
        setRsvpState((prev) => ({ ...prev, [event.id]: 'done' }));
        showToast(`✅ RSVPed to "${event.title}"!`, 'success');
      }
    } catch {
      // Revert on network error
      setEvents((prev) => prev.map((e) => e.id === event.id ? { ...e, current_attendees: e.current_attendees - 1 } : e));
      setRsvpState((prev) => ({ ...prev, [event.id]: 'idle' }));
      showToast('Network timeout. Could not save RSVP.', 'error');
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return { month: d.toLocaleDateString('en-US', { month: 'short' }), day: d.getDate() };
  };

  const getDaysUntil = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return `In ${diff} days`;
  };

  const categoryColors: Record<string, string> = {
    Technology: 'badge-purple',
    Career: 'badge-blue',
    Entertainment: 'badge-pink',
    Workshop: 'badge-teal',
    Academic: 'badge-amber',
    Sports: 'badge-green',
    Health: 'badge-green',
    Cultural: 'badge-amber',
    Competition: 'badge-red',
  };

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(59, 130, 246, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <HiOutlineCalendarDays size={20} style={{ color: 'var(--accent-blue)' }} />
          </div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Upcoming Events</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="live-indicator" />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `${events.length} events`}
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
          {[1, 2, 3].map(i => (
            <div key={i} style={{ display: 'flex', gap: 10 }}>
              <div className="skeleton" style={{ width: 48, height: 52, borderRadius: 12 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: 16, marginBottom: 6 }} />
                <div className="skeleton" style={{ height: 12, width: '60%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <p style={{ color: 'var(--accent-red)', fontSize: 13 }}>{error}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {events.slice(0, 4).map((event) => {
            const { month, day } = formatDate(event.date);
            const spotsLeft = event.max_attendees ? event.max_attendees - event.current_attendees : null;
            const state = rsvpState[event.id] || 'idle';
            return (
              <div key={event.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div className="date-badge">
                  <span className="month">{month}</span>
                  <span className="day">{day}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {event.title}
                  </div>
                  <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <HiOutlineClock size={12} /> {event.time}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <HiOutlineMapPin size={12} /> {event.location}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <span className={`badge ${categoryColors[event.category] || 'badge-blue'}`}>
                      {event.category}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--accent-teal)', fontWeight: 500 }}>
                      {getDaysUntil(event.date)}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {event.current_attendees} registered{spotsLeft !== null ? ` • ${spotsLeft > 0 ? `${spotsLeft} spots left` : 'Full'}` : ' • No limit'}
                    </span>
                    <button
                      onClick={() => {
                        if (state === 'done') {
                          showToast('You have already RSVPed to this event.', 'info');
                          return;
                        }
                        handleRsvp(event);
                      }}
                      disabled={state === 'loading'}
                      style={{
                        marginLeft: 'auto',
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                        fontSize: 11, fontWeight: 600, flexShrink: 0,
                        background: state === 'done' ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.15)',
                        color: state === 'done' ? 'var(--accent-green)' : 'var(--accent-blue)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {state === 'done' ? <><HiOutlineCheckCircle size={12} /> RSVPed</> : state === 'loading' ? '...' : <><HiOutlineUserPlus size={12} /> RSVP</>}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
