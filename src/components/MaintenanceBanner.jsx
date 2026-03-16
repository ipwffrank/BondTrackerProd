import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function MaintenanceBanner() {
  const [maintenance, setMaintenance] = useState(null);
  const [dismissed, setDismissed] = useState(new Set());

  useEffect(() => {
    // Listen for scheduled or in-progress maintenance
    const q = query(
      collection(db, 'maintenance'),
      where('status', 'in', ['scheduled', 'in-progress'])
    );

    const unsub = onSnapshot(q, snap => {
      const now = new Date();
      const upcoming = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(m => {
          const end = m.endTime?.toDate ? m.endTime.toDate() : new Date(m.endTime);
          return end > now; // only show if not yet ended
        })
        .sort((a, b) => {
          const aStart = a.startTime?.toDate ? a.startTime.toDate() : new Date(a.startTime);
          const bStart = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.startTime);
          return aStart - bStart;
        });

      setMaintenance(upcoming.length > 0 ? upcoming[0] : null);
    }, err => console.warn('Maintenance listener error:', err));

    return () => unsub();
  }, []);

  if (!maintenance || dismissed.has(maintenance.id)) return null;

  const start = maintenance.startTime?.toDate ? maintenance.startTime.toDate() : new Date(maintenance.startTime);
  const end = maintenance.endTime?.toDate ? maintenance.endTime.toDate() : new Date(maintenance.endTime);
  const now = new Date();
  const isActive = maintenance.status === 'in-progress' || (start <= now && end > now);

  const fmtOpts = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Singapore' };
  const startStr = start.toLocaleString('en-SG', fmtOpts);
  const endStr = end.toLocaleString('en-SG', fmtOpts);

  // Time until start
  const diffMs = start - now;
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const countdown = diffHrs > 0 ? `in ${diffHrs}h ${diffMins}m` : diffMins > 0 ? `in ${diffMins}m` : '';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      padding: '10px 20px',
      background: isActive
        ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
        : 'linear-gradient(135deg, #C8A258, #b8924a)',
      color: isActive ? '#fff' : '#0F2137',
      fontSize: '13px',
      fontWeight: 600,
      fontFamily: "'Outfit', sans-serif",
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    }}>
      <span>
        {isActive ? 'Maintenance in progress' : 'Scheduled maintenance'}: <strong>{maintenance.title}</strong>
        {' '}— {startStr} to {endStr} SGT
        {!isActive && countdown && <span style={{ opacity: 0.8 }}> ({countdown})</span>}
        {maintenance.affectedServices && maintenance.affectedServices !== 'All Services' && (
          <span style={{ opacity: 0.8 }}> · Affecting: {maintenance.affectedServices}</span>
        )}
      </span>
      <button
        onClick={() => setDismissed(prev => new Set([...prev, maintenance.id]))}
        style={{
          background: 'none',
          border: '1px solid',
          borderColor: isActive ? 'rgba(255,255,255,0.4)' : 'rgba(15,33,55,0.3)',
          borderRadius: '4px',
          color: 'inherit',
          cursor: 'pointer',
          padding: '2px 8px',
          fontSize: '12px',
          fontWeight: 500,
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
