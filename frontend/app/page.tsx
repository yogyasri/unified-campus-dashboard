'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LibraryCard from './components/LibraryCard';
import CafeteriaCard from './components/CafeteriaCard';
import EventsCard from './components/EventsCard';
import NotificationsPanel from './components/NotificationsPanel';
import ChatPanel from './components/ChatPanel';
import AcademicsPanel from './components/AcademicsPanel';
import LibraryPage from './components/LibraryPage';

interface Student {
  studentId: string;
  name: string;
  email: string;
  major: string;
  year: number;
}

export default function DashboardPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationCount, setNotificationCount] = useState(0);
  const router = useRouter();

  // Auto-open chat when external components dispatch a query
  useEffect(() => {
    const handler = () => setChatOpen(true);
    window.addEventListener('campus-chat-query', handler);
    return () => window.removeEventListener('campus-chat-query', handler);
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        setStudent(data.student);
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [router]);

  // Fetch real notification count (urgent + warning alerts)
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch('/api/notifications');
        if (!res.ok) return;
        const data = await res.json();
        const urgent = (data.announcements || []).filter(
          (a: { severity: string }) => a.severity === 'urgent' || a.severity === 'warning'
        ).length;
        setNotificationCount(urgent);
      } catch { /* silently ignore */ }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);


  if (loading || !student) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16, boxShadow: '0 8px 32px rgba(139, 92, 246, 0.3)',
          }}>
            <span style={{ fontSize: 24 }}>🏫</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading Campus Hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }} className="gradient-mesh">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        studentName={student.name}
        studentMajor={student.major}
      />

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header
          studentName={student.name}
          onChatToggle={() => setChatOpen(!chatOpen)}
          chatOpen={chatOpen}
          notificationCount={notificationCount}
          onNotificationsOpen={() => setActiveTab('notifications')}
        />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Dashboard Content */}
          <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
            {activeTab === 'home' ? (
              /* Dashboard Grid */
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: 20,
                maxWidth: 1200,
              }}>
                {/* Row 1: Main cards */}
                <div style={{ gridColumn: 'span 1' }}>
                  <EventsCard />
                </div>
                <div style={{ gridColumn: 'span 1' }}>
                  <CafeteriaCard />
                </div>

                {/* Row 2 */}
                <div style={{ gridColumn: 'span 1' }}>
                  <LibraryCard />
                </div>
                <div style={{ gridColumn: 'span 1' }}>
                  <NotificationsPanel />
                </div>
              </div>
            ) : activeTab === 'library' ? (
              <LibraryPage />
            ) : activeTab === 'cafeteria' ? (
              <div style={{ maxWidth: 1200 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                  🍽️ Cafeteria
                </h2>
                <CafeteriaCard />
              </div>
            ) : activeTab === 'events' ? (
              <div style={{ maxWidth: 1200 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                  🎉 Events
                </h2>
                <EventsCard />
              </div>
            ) : activeTab === 'academics' ? (
              <AcademicsPanel />
            ) : activeTab === 'notifications' ? (
              <div style={{ maxWidth: 1200 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                  🔔 Alerts & Notifications
                </h2>
                <NotificationsPanel />
              </div>
            ) : null}
          </main>

          {/* Chat Panel */}
          <div className={`chat-panel ${chatOpen ? '' : 'collapsed'}`}>
            {chatOpen && <ChatPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}
