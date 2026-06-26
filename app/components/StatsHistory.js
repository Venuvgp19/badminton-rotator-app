'use client';

import React, { useState } from 'react';
import { BarChart3, Settings, History, Volume2, VolumeX, Trophy } from 'lucide-react';

export default function StatsHistory({
  players,
  history,
  timer,
  settings,
  isAdmin,
  onUpdateSettings,
  onToggleVoice,
  onTestVoice,
  firebaseConfigText,
  onUpdateFirebaseConfig,
  onResetSession,
  onClearStatsOnly,
  t
}) {
  const [configInput, setConfigInput] = useState(firebaseConfigText || '');
  const isEs = t.beginner === 'Principiante';

  const calculateDisparity = () => {
    if (players.length === 0) return 0;
    const plays = players.map(p => p.gamesPlayed);
    const mean = plays.reduce((a, b) => a + b, 0) / plays.length;
    const variance = plays.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / plays.length;
    return Math.sqrt(variance);
  };

  const getDisparityColor = (stdDev) => {
    if (stdDev < 1.0) return 'var(--primary)'; // highly equitable
    if (stdDev < 1.8) return 'var(--warning)'; // moderate
    return 'var(--danger)'; // unequal
  };

  const getAverageWaitRounds = () => {
    if (players.length === 0) return 0;
    const totalWait = players.reduce((sum, p) => sum + p.waitRounds, 0);
    return (totalWait / players.length).toFixed(1);
  };

  const getAverageGamesPlayed = () => {
    if (players.length === 0) return 0;
    const totalGames = players.reduce((sum, p) => sum + p.gamesPlayed, 0);
    return (totalGames / players.length).toFixed(1);
  };

  const handleConfigSubmit = (e) => {
    e.preventDefault();
    onUpdateFirebaseConfig(configInput);
  };

  const getLeaderboard = () => {
    const list = players.map(p => {
      const wins = history.filter(log => {
        if (!log.winner || !log.players) return false;
        
        const sideA = (Array.isArray(log.players.sideA) 
          ? log.players.sideA 
          : Object.values(log.players.sideA || {})
        ).map(n => String(n || '').trim().toLowerCase());
        
        const sideB = (Array.isArray(log.players.sideB) 
          ? log.players.sideB 
          : Object.values(log.players.sideB || {})
        ).map(n => String(n || '').trim().toLowerCase());

        const pNameNormalized = p.name.trim().toLowerCase();

        if (log.winner === 'left') {
          return sideA.includes(pNameNormalized);
        }
        if (log.winner === 'right') {
          return sideB.includes(pNameNormalized);
        }
        return false;
      }).length;

      const played = history.filter(log => {
        if (!log.players) return false;
        
        const sideA = (Array.isArray(log.players.sideA) 
          ? log.players.sideA 
          : Object.values(log.players.sideA || {})
        ).map(n => String(n || '').trim().toLowerCase());
        
        const sideB = (Array.isArray(log.players.sideB) 
          ? log.players.sideB 
          : Object.values(log.players.sideB || {})
        ).map(n => String(n || '').trim().toLowerCase());

        const pNameNormalized = p.name.trim().toLowerCase();

        return sideA.includes(pNameNormalized) || sideB.includes(pNameNormalized);
      }).length;

      const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;

      return {
        ...p,
        wins,
        played,
        winRate
      };
    });

    return list.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.played !== a.played) return b.played - a.played;
      return a.name.localeCompare(b.name);
    });
  };

  const stdDev = calculateDisparity();

  return (
    <footer className={`app-footer-bar ${isAdmin ? 'admin-footer' : 'player-footer'}`} style={{ marginTop: 'auto' }}>
      {/* 1. Systems Settings Section */}
      {isAdmin && (
        <div className="footer-section settings-section">
          <h3><Settings size={16} /> {isEs ? 'Configuración del Sistema' : 'System Settings'}</h3>
          <div className="settings-grid">
            <div className="setting-item audio-controls-group">
              <label>{isEs ? 'Notificaciones de Voz' : 'Voice Notifications'}</label>
              <div className="flex-row">
                <button
                  className={`btn-icon-toggle ${settings.voiceEnabled ? 'active' : ''}`}
                  onClick={onToggleVoice}
                  title={isEs ? 'Activar alertas de voz' : 'Toggle voice alerts'}
                >
                  {settings.voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                <button
                  className="btn-action-small"
                  onClick={onTestVoice}
                  title={isEs ? 'Verificar volumen de voz' : 'Verify voice volume'}
                >
                  {isEs ? 'Probar Voz' : 'Test Voice'}
                </button>
              </div>
            </div>

            {/* Passphrase Input (Admin Only) */}
            {isAdmin && (
              <div className="setting-item">
                <label htmlFor="session-passphrase">{isEs ? 'Frase de Paso de Sesión (para Jugadores)' : 'Session Passphrase (for Players)'}</label>
                <input
                  type="text"
                  id="session-passphrase"
                  value={settings.passPhrase || 'BADMINTON2026'}
                  onChange={(e) => onUpdateSettings({ passPhrase: e.target.value })}
                  placeholder={isEs ? 'Frase de paso...' : 'Session passphrase...'}
                  style={{
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    color: 'var(--text-main)',
                    outline: 'none',
                    marginTop: '0.25rem',
                    fontSize: '0.85rem',
                    width: '100%'
                  }}
                />
              </div>
            )}

            {/* Firebase Configuration Textarea (Admin Only) */}
            {isAdmin && (
              <div className="setting-item firebase-config-item" style={{ marginTop: '0.5rem' }}>
                <label>{isEs ? 'Cadena de Conexión de Firebase (JSON)' : 'Firebase Connection String (JSON)'}</label>
                <form onSubmit={handleConfigSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <textarea
                    className="firebase-textarea"
                    placeholder='{"apiKey": "...", "projectId": "...", "databaseURL": "..."}'
                    value={configInput}
                    onChange={(e) => setConfigInput(e.target.value)}
                  />
                  <button type="submit" className="btn btn-secondary-outline btn-sm btn-full" style={{ padding: '0.25rem' }}>
                    {isEs ? 'Guardar y Conectar Sincronización' : 'Save & Connect Realtime Sync'}
                  </button>
                </form>
              </div>
            )}

            {/* Copy Shareable Session Link (Available if Firebase connection config is active) */}
            {firebaseConfigText && (
              <div className="setting-item firebase-config-item" style={{ marginTop: '0.5rem' }}>
                <label>{isEs ? 'Compartir Enlace de Sesión' : 'Share Session Link'}</label>
                <button
                  type="button"
                  className="btn btn-secondary-outline btn-full"
                  onClick={() => {
                    try {
                      const encodedConfig = btoa(firebaseConfigText);
                      const shareUrl = `${window.location.origin}/?config=${encodedConfig}`;
                      navigator.clipboard.writeText(shareUrl);
                      alert(isEs ? "¡Enlace de sesión compartida copiado al portapapeles! Comparte este enlace con los jugadores para que se conecten automáticamente a esta sesión." : "Shareable Session Link copied to clipboard! Share this link with players so they automatically connect to this session.");
                    } catch (e) {
                      alert((isEs ? "Error al generar enlace: " : "Failed to generate link: ") + e.message);
                    }
                  }}
                  style={{ padding: '0.45rem', fontSize: '0.85rem' }}
                >
                  🔗 {isEs ? 'Copiar Enlace de Sesión Compartida' : 'Copy Shared Session Link'}
                </button>
              </div>
            )}
             {/* Clear Stats Only (Admin Only) */}
             <div className="setting-item">
               <label>{isEs ? 'Limpiar Estadísticas' : 'Clear Stats Only'}</label>
               <button
                 type="button"
                 className="btn btn-danger-outline btn-full"
                 onClick={onClearStatsOnly}
                 style={{ padding: '0.45rem', fontSize: '0.85rem' }}
               >
                 🧹 {t.clearStatsBtn}
               </button>
             </div>
             {/* Reset Stats (Admin Only) */}
             <div className="setting-item">
               <label>{isEs ? 'Restablecer Todo' : 'Reset Leaderboard & History'}</label>
               <button
                 type="button"
                 className="btn btn-danger-outline btn-full"
                 onClick={onResetSession}
                 style={{ padding: '0.45rem', fontSize: '0.85rem' }}
               >
                 ⚠️ {isEs ? 'Restablecer Estadísticas' : 'Reset Session Statistics'}
               </button>
             </div>
          </div>
        </div>
      )}

      {/* 2. Leaderboard Section */}
      <div className="footer-section leaderboard-section">
        <h3><Trophy size={16} /> {t.leaderboardTitle.replace("🏆 ", "")}</h3>
        <div className="leaderboard-table-wrapper" style={{ maxHeight: '200px', overflowY: 'auto' }}>
          <table className="leaderboard-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.4rem 0.2rem', fontWeight: 600 }}>{isEs ? 'Rango' : 'Rank'}</th>
                <th style={{ padding: '0.4rem 0.2rem', fontWeight: 600 }}>{isEs ? 'Jugador' : 'Player'}</th>
                <th style={{ padding: '0.4rem 0.2rem', fontWeight: 600, textAlign: 'center' }}>{t.wins}</th>
                <th style={{ padding: '0.4rem 0.2rem', fontWeight: 600, textAlign: 'center' }}>{t.played}</th>
                <th style={{ padding: '0.4rem 0.2rem', fontWeight: 600, textAlign: 'right' }}>{t.winRate}</th>
              </tr>
            </thead>
            <tbody>
              {getLeaderboard().length > 0 ? (
                getLeaderboard().map((p, idx) => {
                  let rankEmoji = '';
                  if (idx === 0) rankEmoji = '🥇';
                  else if (idx === 1) rankEmoji = '🥈';
                  else if (idx === 2) rankEmoji = '🥉';
                  
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '0.45rem 0.2rem', fontWeight: 700 }}>
                        {rankEmoji ? rankEmoji : `${idx + 1}`}
                      </td>
                      <td style={{ padding: '0.45rem 0.2rem', display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{p.name}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t[p.skill.toLowerCase()] || p.skill}</span>
                      </td>
                      <td style={{ padding: '0.45rem 0.2rem', textAlign: 'center', fontWeight: 700, color: 'var(--secondary)' }}>
                        {p.wins}
                      </td>
                      <td style={{ padding: '0.45rem 0.2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {p.played}
                      </td>
                      <td style={{ padding: '0.45rem 0.2rem', textAlign: 'right', fontWeight: 600, color: p.winRate >= 50 ? 'var(--primary)' : 'var(--text-muted)' }}>
                        {p.winRate}%
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {isEs ? 'Ningún jugador registrado.' : 'No players registered.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Play Equity & Stats Section */}
      <div className="footer-section statistics-section">
        <h3><BarChart3 size={16} /> {isEs ? 'Métricas de Equidad de la Sesión' : 'Session Equity Metrics'}</h3>
        <div className="stats-overview">
          <div className="stat-card">
            <span className="stat-label">{t.gamesLogged}</span>
            <span className="stat-value">{history.length}</span>
          </div>
          <div className="stat-card" title="Average games played per registered player">
            <span className="stat-label">{t.avgGames}</span>
            <span className="stat-value">{getAverageGamesPlayed()}</span>
          </div>
          <div className="stat-card" title="Standard Deviation of play counts. Closer to 0 means higher fairness.">
            <span className="stat-label">{isEs ? 'Índice de Disparidad (Desv Est)' : 'Disparity Index (Std Dev)'}</span>
            <span className="stat-value" style={{ color: getDisparityColor(stdDev) }}>
              {stdDev.toFixed(2)}
            </span>
          </div>
          <div className="stat-card" title="Average waiting duration in terms of rotation rounds">
            <span className="stat-label">{t.avgWait}</span>
            <span className="stat-value">{getAverageWaitRounds()} {isEs ? 'rondas' : 'rds'}</span>
          </div>
        </div>
      </div>

      {/* 3. Session History Log Section */}
      <div className="footer-section history-section">
        <h3><History size={16} /> {t.historyTitle}</h3>
        <div className="match-history-log">
          {history.length > 0 ? (
            history.map((log, idx) => (
              <div key={idx} className={`log-item ${log.mode === 'smart-rotation' ? 'log-mode-smart' : 'log-mode-ladder'}`}>
                <div className="player-name-wrap">
                  <span className="log-names">
                    {t.courtLabel} {log.courtId}: {
                      (Array.isArray(log.players?.sideA) 
                        ? log.players.sideA 
                        : Object.values(log.players?.sideA || {})
                      ).join(' & ')
                    } vs {
                      (Array.isArray(log.players?.sideB) 
                        ? log.players.sideB 
                        : Object.values(log.players?.sideB || {})
                      ).join(' & ')
                    }
                  </span>
                  <span className="player-subtext">
                    {log.timestamp} | {log.mode === 'smart-rotation' ? (isEs ? 'Rotación Inteligente' : 'Smart Rot') : (isEs ? 'Partido de Escalera' : 'Ladder Match')}
                  </span>
                </div>
                <span className="log-result">
                  {log.winner ? (log.winner === 'left' ? t.sideAWins : t.sideBWins) : (isEs ? 'Empatado' : 'Tied')}
                </span>
              </div>
            ))
          ) : (
            <div className="empty-history-text">{isEs ? 'Ningún partido registrado aún en esta sesión.' : 'No matches logged yet this session.'}</div>
          )}
        </div>
      </div>
    </footer>
  );
}
