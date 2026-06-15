'use client';

import { useEffect, useState } from 'react';
import type { Toast } from '../context/ToastContext';
import { useToast } from '../context/ToastContext';
import { HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineInformationCircle, HiOutlineXMark } from 'react-icons/hi2';

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger slide-in
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const configs = {
    success: {
      icon: HiOutlineCheckCircle,
      color: 'var(--accent-green)',
      bg: 'rgba(34,197,94,0.12)',
      border: 'rgba(34,197,94,0.3)',
    },
    error: {
      icon: HiOutlineXCircle,
      color: 'var(--accent-red)',
      bg: 'rgba(239,68,68,0.12)',
      border: 'rgba(239,68,68,0.3)',
    },
    info: {
      icon: HiOutlineInformationCircle,
      color: 'var(--accent-blue)',
      bg: 'rgba(59,130,246,0.12)',
      border: 'rgba(59,130,246,0.3)',
    },
  };

  const cfg = configs[toast.type];
  const Icon = cfg.icon;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 12,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        minWidth: 280,
        maxWidth: 400,
        transform: visible ? 'translateX(0)' : 'translateX(120%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
        marginBottom: 8,
      }}
    >
      <Icon size={20} style={{ color: cfg.color, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
        {toast.message}
      </span>
      <button
        onClick={onDismiss}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          padding: 0,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <HiOutlineXMark size={16} />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column-reverse',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} style={{ pointerEvents: 'auto' }}>
          <ToastItem toast={toast} onDismiss={() => dismissToast(toast.id)} />
        </div>
      ))}
    </div>
  );
}
