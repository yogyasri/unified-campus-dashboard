'use client';

import { useEffect, useState, useCallback } from 'react';
import { HiOutlineAcademicCap, HiOutlineArrowPath, HiOutlineClock, HiOutlineMapPin, HiOutlineChatBubbleLeftRight } from 'react-icons/hi2';
import CourseDetailModal from './CourseDetailModal';

interface Course {
  id: number;
  code: string;
  name: string;
  instructor: string;
  credits: number;
  schedule: string;
  location: string;
  building: string;
  department: string;
  grade: string | null;
  description: string;
}

interface AcademicsData {
  courses: Course[];
  schedule: Course[];
}

// Removed gradeColors as per requirement

const deptColors: Record<string, string> = {
  'Computer Science': 'var(--accent-purple)',
  'Mathematics': 'var(--accent-blue)',
  'Physics': 'var(--accent-teal)',
  'English': 'var(--accent-green)',
  'Business': 'var(--accent-amber)',
  'Psychology': 'var(--accent-pink)',
  'Art & Design': 'var(--accent-red)',
};

export default function AcademicsPanel() {
  const [data, setData] = useState<AcademicsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeView, setActiveView] = useState<'courses' | 'schedule'>('courses');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/academics');
      if (!res.ok) throw new Error('Failed to fetch');
      const result = await res.json();
      setData(result);
      setError('');
    } catch {
      setError('Unable to connect to academics server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const askAI = (courseCode: string) => {
    // Dispatch a custom event to trigger chat with a pre-filled query
    window.dispatchEvent(new CustomEvent('campus-chat-query', { detail: `Where is the exam policy for ${courseCode}?` }));
  };

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>🎓</span> Academics
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>Your enrolled courses and weekly schedule</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--glass)', borderRadius: 10, padding: 4, gap: 4 }}>
            {(['courses', 'schedule'] as const).map((view) => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                style={{
                  padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, textTransform: 'capitalize',
                  background: activeView === view ? 'var(--accent-purple)' : 'transparent',
                  color: activeView === view ? 'white' : 'var(--text-muted)',
                  transition: 'all 0.2s ease',
                }}
              >
                {view}
              </button>
            ))}
          </div>
          <button onClick={fetchData} className="btn-ghost" style={{ padding: 8, borderRadius: 8 }}>
            <HiOutlineArrowPath size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 16 }} />)}
        </div>
      ) : error ? (
        <div className="glass-card" style={{ padding: 32, textAlign: 'center', color: 'var(--accent-red)' }}>
          <p>{error}</p>
          <button onClick={fetchData} className="btn-primary" style={{ marginTop: 16 }}>Retry</button>
        </div>
      ) : data && (
        <>
          {activeView === 'courses' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {data.courses.map((course) => {
                const deptColor = deptColors[course.department] || 'var(--accent-purple)';
                return (
                  <div 
                    key={course.code} 
                    className="glass-card" 
                    style={{ padding: 20, cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
                    onClick={() => setSelectedCourse(course)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{
                          fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                          color: deptColor, marginBottom: 4,
                        }}>
                          {course.code} · {course.credits} cr
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>{course.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>👨‍🏫 {course.instructor}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                        <HiOutlineClock size={13} style={{ flexShrink: 0 }} />
                        {course.schedule}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                        <HiOutlineMapPin size={13} style={{ flexShrink: 0 }} />
                        {course.location}, {course.building}
                      </div>
                    </div>

                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 14 }}>
                      {course.description?.slice(0, 100)}...
                    </p>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        askAI(course.code);
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                        fontSize: 12, fontWeight: 600, width: '100%', justifyContent: 'center',
                        background: 'rgba(139,92,246,0.12)', color: 'var(--accent-purple)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <HiOutlineChatBubbleLeftRight size={14} /> Ask AI about {course.code}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {activeView === 'schedule' && (
            <div className="glass-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Weekly Schedule
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.schedule.map((c, i) => {
                  const deptColor = deptColors[c.department] || 'var(--accent-purple)';
                  return (
                    <div key={i} style={{
                      display: 'flex', gap: 14, alignItems: 'center',
                      padding: '12px 16px', borderRadius: 12, background: 'var(--glass)',
                      borderLeft: `3px solid ${deptColor}`,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{c.code} — {c.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, display: 'flex', gap: 12 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <HiOutlineClock size={12} /> {c.schedule}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <HiOutlineMapPin size={12} /> {c.location}
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>
                        {c.instructor}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
      
      <CourseDetailModal 
        course={selectedCourse} 
        onClose={() => setSelectedCourse(null)} 
      />
    </div>
  );
}
