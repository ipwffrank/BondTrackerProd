import React, { useState, useEffect, useRef } from 'react';

// ─── Animation phases ──────────────────────────────────────────────────────────
// Phase 0: transcript types in (0 – 2800ms)
// Phase 1: scanning / analyzing (2800 – 4400ms)
// Phase 2: extracted table fades in (4400 – 6200ms)
// Phase 3: import button pulses (6200 – 8400ms)
// Phase 4: pause before restart (8400 – 10200ms)
const PHASE_DURATIONS = [2800, 1600, 1800, 2200, 1800]; // ms per phase
const TOTAL = PHASE_DURATIONS.reduce((a, b) => a + b, 0); // 10200ms

const TRANSCRIPT_LINES = [
  { time: '09:14', sender: 'Meridian Capital', msg: 'can you show PRAXIS 5.25 28 two-way?' },
  { time: '09:14', sender: 'Meridian Capital', msg: 'looking for 10mm usd' },
  { time: '09:15', sender: 'You', msg: '100.12 / 100.22, good for 10mm each side' },
  { time: '09:16', sender: 'Meridian Capital', msg: 'done at 100.12, we buy 10mm' },
  { time: '09:31', sender: 'Vantage', msg: 'any interest in CANVEX 6.17 27?' },
  { time: '09:32', sender: 'Vantage', msg: 'we can sell 15mm at 100.125' },
  { time: '09:33', sender: 'You', msg: "let me check with desk" },
  { time: '09:45', sender: 'You', msg: 'sorry best bid 100/' },
  { time: '09:46', sender: 'Vantage', msg: 'pass please' },
];

const EXTRACTED_ROWS = [
  { client: 'Meridian Capital', bond: 'PRAXIS 5.25 2028', dir: 'BUY', dirColor: '#22c55e', price: '100.12', status: 'EXECUTED', statusColor: '#22c55e' },
  { client: 'Vantage', bond: 'CANVEX 6.17 2027', dir: 'SELL', dirColor: '#ef4444', price: '100.125', status: 'PASSED', statusColor: '#f97316' },
];

const KEYFRAMES = `
  @keyframes ait-fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes ait-scanLine {
    0%   { top: 0%; opacity: 1; }
    95%  { top: 100%; opacity: 1; }
    100% { top: 100%; opacity: 0; }
  }
  @keyframes ait-shimmer {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes ait-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(200,162,88,0.45); }
    50%       { box-shadow: 0 0 0 10px rgba(200,162,88,0); }
  }
  @keyframes ait-dot {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40%           { transform: scale(1);   opacity: 1;   }
  }
  @keyframes ait-rowIn {
    from { opacity: 0; transform: translateX(-8px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes ait-glow {
    0%, 100% { border-color: rgba(200,162,88,0.3); }
    50%       { border-color: rgba(200,162,88,0.7); }
  }
`;

// ─── Sub-components ────────────────────────────────────────────────────────────

function TranscriptPanel({ phase }) {
  // Lines appear one by one during phase 0; stay visible after
  const visible = phase >= 0;
  const lineDelay = 2800 / TRANSCRIPT_LINES.length; // spread across phase 0

  return (
    <div style={{
      background: 'rgba(10,25,41,0.95)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '10px',
      overflow: 'hidden',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.4s',
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '9px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0,
      }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />
        <span style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: '10px',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.35)',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
        }}>
          Bloomberg IB Chat
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, padding: '12px', overflowY: 'hidden', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {TRANSCRIPT_LINES.map((line, i) => {
          const isYou = line.sender === 'You';
          const delayMs = phase === 0 ? i * (lineDelay * 0.9) : 0;
          return (
            <div
              key={i}
              style={{
                animation: visible ? `ait-fadeIn 0.35s ease ${delayMs}ms both` : 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: isYou ? 'flex-end' : 'flex-start',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 5,
                marginBottom: 2,
                flexDirection: isYou ? 'row-reverse' : 'row',
              }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '9px',
                  color: 'rgba(200,162,88,0.55)',
                }}>{line.time}</span>
                <span style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: '9px',
                  fontWeight: 600,
                  color: isYou ? 'rgba(200,162,88,0.7)' : 'rgba(255,255,255,0.45)',
                }}>{line.sender}</span>
              </div>
              <div style={{
                background: isYou ? 'rgba(200,162,88,0.12)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${isYou ? 'rgba(200,162,88,0.2)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: isYou ? '8px 2px 8px 8px' : '2px 8px 8px 8px',
                padding: '5px 9px',
                maxWidth: '88%',
              }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px',
                  color: isYou ? 'rgba(240,237,232,0.75)' : 'rgba(240,237,232,0.55)',
                  lineHeight: 1.5,
                }}>{line.msg}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScanOverlay({ phase }) {
  // Renders during phase 1
  if (phase !== 1) return null;
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      borderRadius: '10px',
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: 10,
      background: 'rgba(10,25,41,0.55)',
      backdropFilter: 'blur(1px)',
    }}>
      {/* Moving scan line */}
      <div style={{
        position: 'absolute',
        left: 0,
        right: 0,
        height: '2px',
        background: 'linear-gradient(90deg, transparent 0%, #C8A258 30%, #E8C878 50%, #C8A258 70%, transparent 100%)',
        boxShadow: '0 0 12px 4px rgba(200,162,88,0.4)',
        animation: 'ait-scanLine 1.2s ease-in-out forwards',
        top: 0,
      }} />
      {/* Shimmer highlight bands */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, transparent 0%, rgba(200,162,88,0.04) 50%, transparent 100%)',
        backgroundSize: '100% 200%',
        animation: 'ait-shimmer 1.2s linear infinite',
      }} />
      {/* Centered analyzing label */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        animation: 'ait-fadeIn 0.3s ease both',
      }}>
        <div style={{
          background: 'rgba(10,25,41,0.92)',
          border: '1px solid rgba(200,162,88,0.35)',
          borderRadius: '8px',
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          {/* Animated dots */}
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#C8A258',
              animation: `ait-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
          <span style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: '11px',
            fontWeight: 600,
            color: '#C8A258',
            letterSpacing: '0.05em',
          }}>Analyzing transcript…</span>
        </div>
      </div>
    </div>
  );
}

function ExtractedPanel({ phase }) {
  const visible = phase >= 2;
  return (
    <div style={{
      background: 'rgba(10,25,41,0.95)',
      border: `1px solid ${phase === 3 ? 'rgba(200,162,88,0.5)' : 'rgba(200,162,88,0.2)'}`,
      borderRadius: '10px',
      overflow: 'hidden',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.5s ease, border-color 0.4s ease',
      animation: phase === 3 ? 'ait-glow 1.4s ease infinite' : 'none',
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(200,162,88,0.08)',
        borderBottom: '1px solid rgba(200,162,88,0.15)',
        padding: '9px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0,
      }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
        <span style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: '10px',
          fontWeight: 600,
          color: '#C8A258',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
        }}>
          AI-Extracted Activities
        </span>
        <span style={{
          marginLeft: 'auto',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '9px',
          color: 'rgba(200,162,88,0.5)',
        }}>2 found</span>
      </div>

      {/* Column headers */}
      <div style={{
        padding: '7px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'grid',
        gridTemplateColumns: '1fr 1.4fr 60px 70px 80px',
        gap: 4,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.4s ease 0.2s',
      }}>
        {['CLIENT', 'BOND', 'DIR', 'PRICE', 'STATUS'].map(h => (
          <span key={h} style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: '8px',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.25)',
            letterSpacing: '0.06em',
          }}>{h}</span>
        ))}
      </div>

      {/* Rows */}
      <div style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {EXTRACTED_ROWS.map((row, i) => (
          <div
            key={i}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '7px',
              padding: '9px 10px',
              display: 'grid',
              gridTemplateColumns: '1fr 1.4fr 60px 70px 80px',
              gap: 4,
              alignItems: 'center',
              animation: visible ? `ait-rowIn 0.4s ease ${0.15 + i * 0.25}s both` : 'none',
              opacity: visible ? undefined : 0,
            }}
          >
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '11px', fontWeight: 600, color: '#F0EDE8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.client}
            </span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', color: 'rgba(240,237,232,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.bond}
            </span>
            <span style={{
              padding: '2px 6px',
              borderRadius: '20px',
              fontSize: '8px',
              fontWeight: 700,
              background: `${row.dirColor}18`,
              color: row.dirColor,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}>{row.dir}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'rgba(240,237,232,0.65)', paddingLeft: 2 }}>
              {row.bid ? `${row.bid} / ${row.offer}` : `@ ${row.price}`}
            </span>
            <span style={{
              padding: '2px 6px',
              borderRadius: '20px',
              fontSize: '8px',
              fontWeight: 700,
              background: `${row.statusColor}18`,
              color: row.statusColor,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}>{row.status}</span>
          </div>
        ))}
      </div>

      {/* Import button */}
      <div style={{
        padding: '10px 14px',
        borderTop: '1px solid rgba(200,162,88,0.12)',
        flexShrink: 0,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.4s ease 0.7s',
      }}>
        <button style={{
          width: '100%',
          padding: '9px',
          background: phase === 3 ? '#C8A258' : 'rgba(200,162,88,0.15)',
          border: '1px solid rgba(200,162,88,0.4)',
          borderRadius: '6px',
          color: phase === 3 ? '#0F2137' : '#C8A258',
          fontFamily: "'Outfit', sans-serif",
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.04em',
          cursor: 'pointer',
          transition: 'background 0.5s ease, color 0.5s ease',
          animation: phase === 3 ? 'ait-pulse 1.3s ease infinite' : 'none',
        }}>
          Import to Activity Log
        </button>
      </div>
    </div>
  );
}

// ─── Arrow connector ───────────────────────────────────────────────────────────
function ArrowConnector({ phase }) {
  const lit = phase >= 1;
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      flexShrink: 0,
      width: 40,
    }}>
      <div style={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        border: `1px solid ${lit ? 'rgba(200,162,88,0.6)' : 'rgba(255,255,255,0.1)'}`,
        background: lit ? 'rgba(200,162,88,0.12)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.5s ease',
      }}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5h6M6 3l2 2-2 2" stroke={lit ? '#C8A258' : 'rgba(255,255,255,0.2)'} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

// ─── Phase label strip ────────────────────────────────────────────────────────
const PHASE_LABELS = [
  { num: '01', label: 'Chat transcript' },
  { num: '02', label: 'AI analyzes' },
  { num: '03', label: 'Structured data' },
  { num: '04', label: 'One-click import' },
];

function PhaseStrip({ phase }) {
  // Map animation phase (0–3) to display step
  const activeStep = Math.min(phase, 3);
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      gap: 0,
      marginBottom: 16,
    }}>
      {PHASE_LABELS.map((p, i) => {
        const done = i < activeStep;
        const active = i === activeStep;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '0 10px',
            }}>
              <div style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                border: `1px solid ${active ? '#C8A258' : done ? 'rgba(200,162,88,0.5)' : 'rgba(255,255,255,0.12)'}`,
                background: active ? 'rgba(200,162,88,0.18)' : done ? 'rgba(200,162,88,0.08)' : 'transparent',
                color: active ? '#C8A258' : done ? 'rgba(200,162,88,0.6)' : 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '8px',
                fontWeight: 700,
                transition: 'all 0.4s ease',
              }}>{p.num}</div>
              <span style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: '9px',
                fontWeight: active ? 600 : 400,
                color: active ? '#C8A258' : done ? 'rgba(200,162,88,0.5)' : 'rgba(255,255,255,0.2)',
                whiteSpace: 'nowrap',
                transition: 'all 0.4s ease',
              }}>{p.label}</span>
            </div>
            {i < PHASE_LABELS.length - 1 && (
              <div style={{
                width: 20,
                height: 1,
                background: i < activeStep ? 'rgba(200,162,88,0.4)' : 'rgba(255,255,255,0.08)',
                marginBottom: 14,
                transition: 'background 0.4s ease',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function AITranscriptAnimation() {
  const [phase, setPhase] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    let phaseIndex = 0;
    let elapsed = 0;

    function tick() {
      elapsed += PHASE_DURATIONS[phaseIndex];
      phaseIndex++;
      if (phaseIndex >= PHASE_DURATIONS.length) {
        // Restart
        phaseIndex = 0;
        elapsed = 0;
        setPhase(0);
        timerRef.current = setTimeout(tick, PHASE_DURATIONS[0]);
      } else {
        setPhase(phaseIndex);
        timerRef.current = setTimeout(tick, PHASE_DURATIONS[phaseIndex]);
      }
    }

    timerRef.current = setTimeout(tick, PHASE_DURATIONS[0]);
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={{
        background: 'rgba(8,20,36,0.7)',
        border: '1px solid rgba(200,162,88,0.15)',
        borderRadius: '14px',
        padding: '20px',
        maxWidth: '720px',
        margin: '0 auto',
        fontFamily: "'Outfit', sans-serif",
      }}>
        {/* Phase progress strip */}
        <PhaseStrip phase={phase} />

        {/* Main visual area */}
        <div style={{
          display: 'flex',
          gap: 10,
          alignItems: 'stretch',
          minHeight: 280,
        }}
          className="ait-main-row"
        >
          {/* Left: transcript panel (relative for scan overlay) */}
          <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
            <TranscriptPanel phase={phase} />
            <ScanOverlay phase={phase} />
          </div>

          {/* Arrow */}
          <ArrowConnector phase={phase} />

          {/* Right: extracted data panel */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <ExtractedPanel phase={phase} />
          </div>
        </div>

        {/* Caption */}
        <p style={{
          textAlign: 'center',
          marginTop: 14,
          marginBottom: 0,
          fontFamily: "'Outfit', sans-serif",
          fontSize: '11px',
          fontWeight: 300,
          color: 'rgba(240,237,232,0.35)',
          letterSpacing: '0.02em',
        }}>
          Supports Bloomberg IB · Symphony · Email · Call notes
        </p>
      </div>

      {/* Responsive stacking */}
      <style>{`
        @media (max-width: 540px) {
          .ait-main-row {
            flex-direction: column !important;
          }
        }
      `}</style>
    </>
  );
}
