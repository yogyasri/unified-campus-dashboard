'use client';

import { useState } from 'react';
import { HiOutlineMapPin } from 'react-icons/hi2';

interface Building {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  label: string;
}

const buildings: Building[] = [
  { id: 'science', name: 'Science Building', x: 40, y: 30, width: 80, height: 50, color: '#8b5cf6', label: 'SCI' },
  { id: 'tech', name: 'Tech Building', x: 160, y: 40, width: 70, height: 60, color: '#3b82f6', label: 'TECH' },
  { id: 'library', name: 'Main Library', x: 280, y: 25, width: 90, height: 45, color: '#14b8a6', label: 'LIB' },
  { id: 'student', name: 'Student Center', x: 100, y: 120, width: 85, height: 55, color: '#ec4899', label: 'STU' },
  { id: 'cafeteria', name: 'Dining Hall', x: 230, y: 110, width: 65, height: 45, color: '#f59e0b', label: 'CAFE' },
  { id: 'arts', name: 'Arts Center', x: 330, y: 100, width: 60, height: 50, color: '#ef4444', label: 'ART' },
  { id: 'sports', name: 'Sports Complex', x: 50, y: 200, width: 100, height: 40, color: '#22c55e', label: 'GYM' },
  { id: 'health', name: 'Health Building', x: 200, y: 195, width: 70, height: 40, color: '#06b6d4', label: 'HLTH' },
  { id: 'admin', name: 'Admin Building', x: 320, y: 185, width: 70, height: 45, color: '#a855f7', label: 'ADM' },
];

export default function CampusMap() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ name: string; x: number; y: number } | null>(null);

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(20, 184, 166, 0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <HiOutlineMapPin size={20} style={{ color: 'var(--accent-teal)' }} />
        </div>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Campus Map</h3>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Interactive overview</span>
        </div>
      </div>

      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: 'rgba(0,0,0,0.2)' }}>
        <svg viewBox="0 0 440 260" style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* Background paths / roads */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="440" height="260" fill="url(#grid)" />

          {/* Roads */}
          <line x1="0" y1="100" x2="440" y2="100" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <line x1="0" y1="180" x2="440" y2="180" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <line x1="140" y1="0" x2="140" y2="260" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          <line x1="310" y1="0" x2="310" y2="260" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />

          {/* Green areas */}
          <ellipse cx="220" cy="155" rx="30" ry="15" fill="rgba(34,197,94,0.08)" />
          <text x="220" y="158" textAnchor="middle" fontSize="7" fill="rgba(34,197,94,0.3)">Quad</text>

          {/* Buildings */}
          {buildings.map((b) => (
            <g key={b.id}
              onMouseEnter={() => { setHovered(b.id); setTooltip({ name: b.name, x: b.x + b.width / 2, y: b.y - 10 }); }}
              onMouseLeave={() => { setHovered(null); setTooltip(null); }}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={b.x} y={b.y} width={b.width} height={b.height}
                rx="6" ry="6"
                fill={hovered === b.id ? b.color + '40' : b.color + '20'}
                stroke={b.color}
                strokeWidth={hovered === b.id ? 2 : 1}
                style={{ transition: 'all 0.2s ease' }}
              />
              <text
                x={b.x + b.width / 2} y={b.y + b.height / 2 + 4}
                textAnchor="middle" fontSize="10" fontWeight="700"
                fill={b.color}
                style={{ pointerEvents: 'none' }}
              >
                {b.label}
              </text>
            </g>
          ))}

          {/* Tooltip */}
          {tooltip && (
            <g>
              <rect
                x={tooltip.x - 50} y={tooltip.y - 18}
                width="100" height="20" rx="6"
                fill="rgba(0,0,0,0.8)"
              />
              <text
                x={tooltip.x} y={tooltip.y - 5}
                textAnchor="middle" fontSize="9" fontWeight="600" fill="white"
              >
                {tooltip.name}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
