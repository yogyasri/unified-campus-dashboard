'use client';

import { HiOutlineMagnifyingGlass, HiOutlineBellAlert, HiOutlineChatBubbleLeftRight } from 'react-icons/hi2';

interface HeaderProps {
  studentName: string;
  onChatToggle: () => void;
  chatOpen: boolean;
  notificationCount: number;
  onNotificationsOpen: () => void;
}

export default function Header({ studentName, onChatToggle, chatOpen, notificationCount, onNotificationsOpen }: HeaderProps) {
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <header style={{
      height: 'var(--header-height)',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '1px solid var(--glass-border)',
      background: 'var(--bg-secondary)',
      flexShrink: 0,
    }}>
      {/* Left: Greeting */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 1 }}>
          {greeting}, {studentName.split(' ')[0]} 👋
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{dateStr}</p>
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Notification Badge */}
        <button className="btn-ghost" onClick={onNotificationsOpen} style={{
          position: 'relative', padding: 8, borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
        }}>
          <HiOutlineBellAlert size={20} />
          {notificationCount > 0 && (
            <span style={{
              position: 'absolute', top: 4, right: 4,
              width: 16, height: 16, borderRadius: '50%',
              background: 'var(--accent-red)',
              fontSize: 10, fontWeight: 700, color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'pulse 2s infinite',
            }}>
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </button>

        {/* Chat Toggle */}
        <button
          onClick={onChatToggle}
          className="btn-ghost"
          style={{
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', gap: 8,
            background: chatOpen ? 'rgba(139, 92, 246, 0.1)' : undefined,
            color: chatOpen ? 'var(--accent-purple)' : undefined,
            borderColor: chatOpen ? 'rgba(139, 92, 246, 0.3)' : undefined,
          }}
        >
          <HiOutlineChatBubbleLeftRight size={18} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>AI Assistant</span>
        </button>
      </div>
    </header>
  );
}
