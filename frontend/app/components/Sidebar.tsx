'use client';

import { HiOutlineHome, HiOutlineBookOpen, HiOutlineBuildingStorefront, HiOutlineCalendarDays, HiOutlineAcademicCap, HiOutlineBellAlert, HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlineArrowRightOnRectangle } from 'react-icons/hi2';
import { useRouter } from 'next/navigation';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  studentName: string;
  studentMajor: string;
}

const navItems = [
  { id: 'home', label: 'Dashboard', icon: HiOutlineHome },
  { id: 'library', label: 'Library', icon: HiOutlineBookOpen },
  { id: 'cafeteria', label: 'Cafeteria', icon: HiOutlineBuildingStorefront },
  { id: 'events', label: 'Events', icon: HiOutlineCalendarDays },
  { id: 'academics', label: 'Academics', icon: HiOutlineAcademicCap },
  { id: 'notifications', label: 'Alerts', icon: HiOutlineBellAlert },
];

export default function Sidebar({ collapsed, onToggle, activeTab, onTabChange, studentName, studentMajor }: SidebarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} style={{
      height: '100vh',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--glass-border)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        padding: collapsed ? '20px 12px' : '20px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        borderBottom: '1px solid var(--glass-border)',
        minHeight: 'var(--header-height)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
        }}>
          <HiOutlineAcademicCap size={20} color="white" />
        </div>
        {!collapsed && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>Campus Hub</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Smart Dashboard</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: collapsed ? '16px 8px' : '16px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-link ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
            style={{ justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '12px' : '10px 14px' }}
            title={collapsed ? item.label : undefined}
          >
            <item.icon size={20} style={{ flexShrink: 0 }} />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* User Section */}
      <div style={{
        padding: collapsed ? '16px 8px' : '16px 12px',
        borderTop: '1px solid var(--glass-border)',
      }}>
        {!collapsed && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', marginBottom: 8,
            borderRadius: 'var(--radius-md)',
            background: 'var(--glass)',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0,
            }}>
              {studentName.charAt(0)}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{studentName}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{studentMajor}</div>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="sidebar-link"
          style={{ justifyContent: collapsed ? 'center' : 'flex-start', width: '100%', color: 'var(--accent-red)' }}
          title={collapsed ? 'Logout' : undefined}
        >
          <HiOutlineArrowRightOnRectangle size={20} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={onToggle}
        style={{
          position: 'absolute', right: -14, top: '50%', transform: 'translateY(-50%)',
          width: 28, height: 28, borderRadius: '50%',
          background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text-secondary)', zIndex: 10,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-purple)'; e.currentTarget.style.color = 'var(--accent-purple)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
      >
        {collapsed ? <HiOutlineChevronRight size={14} /> : <HiOutlineChevronLeft size={14} />}
      </button>
    </aside>
  );
}
