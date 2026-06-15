'use client';

import { HiOutlineXMark, HiOutlineMapPin, HiOutlineClock, HiOutlineAcademicCap, HiOutlineUserGroup, HiOutlineChatBubbleLeftRight } from 'react-icons/hi2';

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
  exam_policy?: string;
  max_enrollment?: number;
  spotsRemaining?: number;
}

interface CourseDetailModalProps {
  course: Course | null;
  onClose: () => void;
}

export default function CourseDetailModal({ course, onClose }: CourseDetailModalProps) {
  if (!course) return null;

  const askAI = (courseCode: string) => {
    window.dispatchEvent(new CustomEvent('campus-chat-query', { detail: `Tell me about ${courseCode}` }));
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20
    }} onClick={onClose}>
      <div className="glass-card" style={{
        width: '100%', maxWidth: 500, padding: 0, overflow: 'hidden',
        animation: 'slideIn 0.2s ease-out forwards'
      }} onClick={e => e.stopPropagation()}>
        
        <div style={{ 
          background: 'var(--glass)', borderBottom: '1px solid var(--glass-border)',
          padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-purple)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {course.code}
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: '4px 0 0 0' }}>{course.name}</h2>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-primary)'
          }}>
            <HiOutlineXMark size={20} />
          </button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20, maxHeight: '70vh', overflowY: 'auto' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ padding: 8, background: 'rgba(139,92,246,0.1)', borderRadius: 8, color: 'var(--accent-purple)' }}>
                <HiOutlineAcademicCap size={20} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Instructor</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{course.instructor}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ padding: 8, background: 'rgba(59,130,246,0.1)', borderRadius: 8, color: 'var(--accent-blue)' }}>
                <HiOutlineClock size={20} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Schedule</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{course.schedule}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ padding: 8, background: 'rgba(245,158,11,0.1)', borderRadius: 8, color: 'var(--accent-amber)' }}>
                <HiOutlineMapPin size={20} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Location</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{course.location}, {course.building}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ padding: 8, background: 'rgba(16,185,129,0.1)', borderRadius: 8, color: 'var(--accent-green)' }}>
                <HiOutlineUserGroup size={20} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Department</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{course.department}</div>
              </div>
            </div>
          </div>

          <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid var(--glass-border)' }}>
            <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Description</h4>
            <p style={{ fontSize: 13, lineHeight: 1.6 }}>{course.description}</p>
          </div>

          <button
            onClick={() => askAI(course.code)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 600, width: '100%', justifyContent: 'center',
              background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.15))', 
              color: 'var(--accent-purple)', borderTop: '1px solid rgba(139,92,246,0.2)',
              transition: 'all 0.2s ease',
            }}
          >
            <HiOutlineChatBubbleLeftRight size={18} /> Ask AI about syllabus, exams, or homework
          </button>
        </div>
      </div>
    </div>
  );
}
