'use client';

import React from 'react';
import { Activity, RotateCcw, LogOut, Shuffle } from 'lucide-react';

export default function SessionHeader({
  timer,
  settings,
  isAdmin,
  currentUser,
  onLogout,
  onToggleTimer,
  onForceRotate,
  onResetSession,
  onUpdateSettings,
  onToggleVoice,
  onTestVoice,
  activePlayerCount,
  t
}) {
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <header className="app-header">
      {/* Logo */}
      <div className="logo-area">
        <div className="logo-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.4rem' }}>
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: '28px', height: '28px', color: 'var(--secondary)' }}>
            <line x1="16" y1="48" x2="38" y2="26" />
            <circle cx="45" cy="19" r="10" fill="rgba(0, 242, 254, 0.05)" />
            <line x1="13" y1="51" x2="18" y2="46" stroke="var(--primary)" strokeWidth="4" />
            <path d="M 37 19 L 53 19 M 45 11 L 45 27 M 40 14 L 50 24 M 40 24 L 50 14" strokeWidth="1" opacity="0.5" />
            <line x1="48" y1="48" x2="26" y2="26" />
            <circle cx="19" cy="19" r="10" fill="rgba(0, 242, 254, 0.05)" />
            <line x1="51" y1="51" x2="46" y2="46" stroke="var(--primary)" strokeWidth="4" />
            <path d="M 11 19 L 27 19 M 19 11 L 19 27 M 14 14 L 24 24 M 14 24 L 24 14" strokeWidth="1" opacity="0.5" />
            <path d="M 32 30 C 30 30 30 33 32 33 C 34 33 34 30 32 30 Z" fill="var(--primary)" stroke="var(--primary)" strokeWidth="1" />
            <path d="M 30 33 L 26 44 C 29 46 35 46 38 44 L 34 33" stroke="var(--text-main)" strokeWidth="2" fill="rgba(255,255,255,0.05)" />
          </svg>
        </div>
        <div>
          <h1>{t.title} <span className="badge-pro">PRO</span></h1>
          <p className="subtitle">{t.subtitle}</p>
        </div>
      </div>

      {/* Timer & Controls */}
      <div className="session-controls">
        {/* Mode Selector - Edit mode for Admin, Display only for Player */}
        <div className="control-group">
          <label><Shuffle size={12} /> {t.modeLabel}</label>
          {!isAdmin ? (
            <span className="mode-badge-value" style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-main)', display: 'flex', alignItems: 'center', minHeight: '38px' }}>
              {settings.rotationMode === 'smart-rotation' ? t.modeSmart : t.modeLadder}
            </span>
          ) : (
            <select
              value={settings.rotationMode}
              onChange={(e) => onUpdateSettings({ rotationMode: e.target.value })}
            >
              <option value="smart-rotation">{t.modeSmart}</option>
              <option value="challenge-ladder">{t.modeLadder}</option>
            </select>
          )}
        </div>

        {/* Session Timer Display */}
        <div className="timer-display-container" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.35rem 0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.timerLabel}</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'monospace', color: timer.isActive ? 'var(--secondary)' : 'var(--text-muted)' }}>
              {formatTime(timer.timeRemaining)}
            </span>
          </div>
          {isAdmin && (
            <button
              className="btn"
              onClick={onToggleTimer}
              style={{
                padding: '0.35rem 0.7rem',
                fontSize: '0.75rem',
                height: 'fit-content',
                background: timer.isActive ? 'rgba(239, 68, 68, 0.2)' : 'var(--secondary)',
                color: timer.isActive ? 'rgb(239, 68, 68)' : 'var(--bg-primary)',
                border: timer.isActive ? '1px solid rgb(239, 68, 68)' : 'none',
                boxShadow: timer.isActive ? 'none' : '0 2px 8px var(--secondary-glow)',
                cursor: 'pointer'
              }}
            >
              {timer.isActive ? t.pauseBtn : t.startBtn}
            </button>
          )}
        </div>

        {/* Action Buttons - Organizer Only */}
        <div className="header-actions">
          {isAdmin && (
            <>
              <button
                className="btn btn-primary"
                onClick={onForceRotate}
                title="Rotate all courts: populate courts with next waiting players"
                style={{ background: 'var(--secondary)', color: 'var(--bg-primary)', boxShadow: '0 4px 15px var(--secondary-glow)' }}
              >
                <Shuffle size={16} />
                <span>{t.rotateAllBtn}</span>
              </button>
              
              <button
                className="btn btn-danger-outline"
                onClick={onResetSession}
                title="Reset Session Stats"
              >
                <RotateCcw size={16} />
                <span>{t.resetSession}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* User Session Widget */}
      <div className="user-status-widget">
        <span className={`user-status-dot ${isAdmin ? 'status-dot-admin' : 'status-dot-player'}`} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="user-status-role">
            {isAdmin ? (t.organizerAdmin || "Organizer (Admin)") : currentUser?.name}
          </span>
          <span className="player-subtext" style={{ fontSize: '0.65rem' }}>
            {isAdmin ? (t.fullControls || "Full Controls") : `${t.playerProfile} (${t[currentUser?.skill?.toLowerCase()] || currentUser?.skill})`}
          </span>
        </div>
        <button
          className="btn-icon-toggle"
          onClick={onLogout}
          title={t.logoutTitle}
          style={{ marginLeft: '0.5rem', width: '30px', height: '30px' }}
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  );
}
