'use client';

import React, { useState } from 'react';
import { Users, SlidersHorizontal, Search, Coffee, Trash2, UserPlus, UserMinus } from 'lucide-react';

export default function QueueSidebar({
  players,
  isAdmin,
  currentUser,
  settings,
  onAddPlayer,
  onToggleRest,
  onRemovePlayer,
  onClearAll,
  onLoadPlayers,
  onClearStatsOnly,
  onDragStart,
  onDragEnd,
  selectedPlayerForMove,
  onSelectPlayerForMove,
  timer,
  timerActive,
  t
}) {
  const isEs = t.beginner === 'Principiante';
  const getPlayerTimeStrings = (player) => {
    let playTime = player.playTime || 0;
    let waitTime = player.waitTime || 0;
    const lastStatusChange = player.lastStatusChange || Date.now();

    if (timerActive && lastStatusChange) {
      const elapsed = Math.max(0, Math.floor((Date.now() - lastStatusChange) / 1000));
      if (player.status === 'playing') playTime += elapsed;
      if (player.status === 'waiting') waitTime += elapsed;
    }

    const formatTime = (totalSeconds) => {
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      return `${m}m ${s}s`;
    };

    return {
      playStr: formatTime(playTime),
      waitStr: formatTime(waitTime)
    };
  };
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'players'
  const [searchVal, setSearchVal] = useState('');
  const [skillFilter, setSkillFilter] = useState('all');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerPhone, setNewPlayerPhone] = useState('');
  const [newPlayerSkill, setNewPlayerSkill] = useState('Intermediate');

  const getWaitingPlayers = () => {
    const list = players.filter(p => p.status === 'waiting');
    // Calculate priority score (lowest plays first)
    list.forEach(p => {
      p._priorityScore = (p.gamesPlayed * 1000) - (p.waitRounds * 50) + (p.lastPlayedRound * 5);
    });
    // Sort
    return list.sort((a, b) => a._priorityScore - b._priorityScore);
  };

  const handleAddPlayerSubmit = (e) => {
    e.preventDefault();
    if (!newPlayerName.trim() || !newPlayerPhone.trim()) return;
    onAddPlayer(newPlayerName.trim(), newPlayerSkill, newPlayerPhone.trim());
    setNewPlayerName('');
    setNewPlayerPhone('');
  };

  const getFilteredPlayers = () => {
    let list = players.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchVal.toLowerCase());
      const matchesSkill = skillFilter === 'all' || p.skill === skillFilter;
      return matchesSearch && matchesSkill;
    });
    // Sort alphabetically
    return list.sort((a, b) => a.name.localeCompare(b.name));
  };

  const getStatusDotClass = (status) => {
    if (status === 'playing') return 'status-playing';
    if (status === 'resting') return 'status-resting';
    return 'status-waiting';
  };

  const waitingPlayers = getWaitingPlayers();
  const filteredPlayers = getFilteredPlayers();

  return (
    <aside className="workspace-section sidebar-section">
      {/* Tab Selectors */}
      <div className="sidebar-tabs">
        <button
          className={`tab-btn ${activeTab === 'queue' ? 'active' : ''}`}
          onClick={() => setActiveTab('queue')}
        >
          <Users size={14} /> {t.queueTab} ({waitingPlayers.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'players' ? 'active' : ''}`}
          onClick={() => setActiveTab('players')}
        >
          <SlidersHorizontal size={14} /> {t.allPlayersTab} ({players.length})
        </button>
      </div>

      {/* Tab 1: Wait Queue */}
      {activeTab === 'queue' && (
        <div className="tab-content active">
          <div className="queue-header-stats">
            {isAdmin ? t.dragPrompt : t.viewPrompt}
          </div>

          <div className="queue-list-container">
            {waitingPlayers.length > 0 ? (
              waitingPlayers.map((player, index) => {
                const skillClass = `skill-badge skill-${player.skill.toLowerCase()}`;
                const waitMins = player.waitRounds * (settings.playDuration + settings.changeoverDuration);
                const isCurrentUser = currentUser?.id === player.id;
                
                // Allow resting toggle if admin, OR if the player is this user
                const canToggleRest = isAdmin || isCurrentUser;

                const isSelected = selectedPlayerForMove === player.id;
                const finalItemClass = `player-list-item ${isAdmin ? 'draggable' : ''} ${isSelected ? 'selected-for-move' : ''}`;

                return (
                  <div
                    key={player.id}
                    className={finalItemClass}
                    draggable={isAdmin}
                    onDragStart={(e) => {
                      if (!isAdmin) return;
                      e.dataTransfer.setData('text/plain', player.id);
                      if (onDragStart) onDragStart(player.id);
                    }}
                    onDragEnd={onDragEnd}
                    onClick={() => isAdmin && onSelectPlayerForMove && onSelectPlayerForMove(player.id)}
                    style={{
                      borderLeft: isCurrentUser ? '3px solid var(--secondary)' : '',
                      background: isCurrentUser ? 'rgba(0, 229, 255, 0.04)' : '',
                      cursor: isAdmin ? 'pointer' : 'default'
                    }}
                  >
                    <div className="player-info-meta">
                      <div className="queue-badge" style={{ borderColor: isCurrentUser ? 'var(--secondary)' : '' }}>
                        {index + 1}
                      </div>
                      <div className="player-name-wrap">
                        <span className="player-name" style={{ fontWeight: isCurrentUser ? '800' : '600' }}>
                          {player.name} {isCurrentUser && `(${isEs ? 'Tú' : 'You'})`}
                        </span>
                        <span className="player-subtext">
                          {t.games}: {player.gamesPlayed} | {t.play}: {getPlayerTimeStrings(player).playStr} | {t.wait}: {getPlayerTimeStrings(player).waitStr} ({player.waitRounds} {isEs ? 'rondas' : 'rd'}) | {player.phone}{player.loginTime ? ` | ${isEs ? 'Entrada' : 'In'}: ${player.loginTime}` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="player-actions-wrap">
                      <span className={skillClass}>{t[player.skill.toLowerCase()] || player.skill}</span>
                      <button
                        className={`btn-toggle-rest ${player.status === 'resting' ? 'resting' : ''}`}
                        onClick={() => onToggleRest(player.id)}
                        disabled={!canToggleRest}
                        title={t.restTitle}
                      >
                        <Coffee size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-state">
                <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '38px', height: '38px', color: 'var(--text-muted)', opacity: 0.6, marginBottom: '0.25rem' }}>
                  {/* Cork Base */}
                  <path d="M 32 18 C 28 18 28 24 32 24 C 36 24 36 18 32 18 Z" fill="var(--secondary)" stroke="var(--secondary)" strokeWidth="1" />
                  {/* Feathers skirt */}
                  <path d="M 29 24 L 20 46 C 26 50 38 50 44 46 L 35 24" fill="rgba(255,255,255,0.02)" />
                  {/* Ribs */}
                  <line x1="32" y1="24" x2="32" y2="48" />
                  <line x1="30" y1="24" x2="26" y2="47" />
                  <line x1="34" y1="24" x2="38" y2="47" />
                  {/* Band */}
                  <path d="M 26 34 L 38 34" stroke="var(--danger)" strokeWidth="1.5" />
                </svg>
                <p>{t.noWaiting}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: All Players */}
      {activeTab === 'players' && (
        <div className="tab-content active">
          {/* Add Player (Organizer Only) */}
          {isAdmin && (
            <form className="add-player-form" onSubmit={handleAddPlayerSubmit}>
              <div className="input-row">
                <input
                  type="text"
                  placeholder={t.enterPlayerName}
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  required
                />
                <input
                  type="tel"
                  placeholder={t.enterMobile}
                  value={newPlayerPhone}
                  onChange={(e) => setNewPlayerPhone(e.target.value)}
                  pattern="[0-9]{10}"
                  style={{ marginTop: '0.25rem' }}
                  required
                />
                <select
                  value={newPlayerSkill}
                  onChange={(e) => setNewPlayerSkill(e.target.value)}
                  style={{ marginTop: '0.25rem' }}
                >
                  <option value="Beginner">{t.beginner}</option>
                  <option value="Intermediate">{t.intermediate}</option>
                  <option value="Advanced">{t.advanced}</option>
                  <option value="Pro">{t.proOption}</option>
                </select>
              </div>
              <button type="submit" className="btn btn-secondary btn-full" style={{ marginTop: '0.25rem' }}>
                <UserPlus size={14} /> {t.addPlayerBtn}
              </button>
            </form>
          )}

          {/* Bulk actions (Organizer Only) */}
          {isAdmin && (
            <div className="bulk-actions" style={{ display: 'flex', gap: '0.4rem' }}>
              <button className="btn btn-secondary-outline btn-sm btn-full" onClick={onLoadPlayers} style={{ padding: '0.35rem 0.2rem', fontSize: '0.72rem' }} title="Load checked-in club players">
                {t.loadPlayersBtn}
              </button>
              <button className="btn btn-danger-outline btn-sm btn-full" onClick={onClearStatsOnly} style={{ padding: '0.35rem 0.2rem', fontSize: '0.72rem' }} title="Reset matches played, history, and metrics to 0">
                🧹 {t.clearStatsBtn.replace(" Only", "")}
              </button>
              <button className="btn btn-danger-outline btn-sm btn-full" onClick={onClearAll} style={{ padding: '0.35rem 0.2rem', fontSize: '0.72rem' }} title="Remove all players from active list">
                🗑️ {isEs ? 'Limpiar Todo' : 'Clear All'}
              </button>
            </div>
          )}

          {/* Search Box */}
          <div className="search-filter-row">
            <div className="search-box">
              <Search size={14} />
              <input
                type="text"
                placeholder={t.searchPlaceholder}
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
              />
            </div>
            <select
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
            >
              <option value="all">{t.allSkills}</option>
              <option value="Pro">{t.pro}</option>
              <option value="Advanced">{t.advanced}</option>
              <option value="Intermediate">{t.intermediate}</option>
              <option value="Beginner">{t.beginner}</option>
            </select>
          </div>

          <div className="players-list-container">
            {filteredPlayers.length > 0 ? (
              filteredPlayers.map((player) => {
                const skillClass = `skill-badge skill-${player.skill.toLowerCase()}`;
                const isCurrentUser = currentUser?.id === player.id;
                const canToggleRest = isAdmin || isCurrentUser;
                const canDelete = isAdmin && !isCurrentUser;

                return (
                  <div
                    key={player.id}
                    className="player-list-item"
                    style={{
                      cursor: 'default',
                      borderLeft: isCurrentUser ? '3px solid var(--secondary)' : '',
                      background: isCurrentUser ? 'rgba(0, 229, 255, 0.04)' : ''
                    }}
                  >
                    <div className="player-info-meta">
                      <span className={`status-indicator ${getStatusDotClass(player.status)}`} />
                      <div className="player-name-wrap">
                        <span className="player-name" style={{ fontWeight: isCurrentUser ? '800' : '600' }}>
                          {player.name} {isCurrentUser && `(${isEs ? 'Tú' : 'You'})`}
                        </span>
                        <span className="player-subtext">
                          {t.games}: {player.gamesPlayed} | {t.play}: {getPlayerTimeStrings(player).playStr} | {t.wait}: {getPlayerTimeStrings(player).waitStr} | {t.status}: {t[player.status + "Status"] || player.status} | {player.phone}{player.loginTime ? ` | ${isEs ? 'Entrada' : 'In'}: ${player.loginTime}` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="player-actions-wrap">
                      <span className={skillClass}>{t[player.skill.toLowerCase()] || player.skill}</span>
                      <button
                        className={`btn-toggle-rest ${player.status === 'resting' ? 'resting' : ''}`}
                        onClick={() => onToggleRest(player.id)}
                        disabled={!canToggleRest}
                      >
                        <Coffee size={12} />
                      </button>
                      {isAdmin && (
                        <button
                          className="btn-action-small"
                          onClick={() => onRemovePlayer(player.id)}
                          disabled={!canDelete}
                          style={{ color: 'var(--danger)' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-state">
                <Search size={36} />
                <p>{t.noMatching}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
