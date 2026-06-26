'use client';

import React, { useState } from 'react';
import { Trash2, UserPlus, RotateCw } from 'lucide-react';

export default function CourtGrid({
  courts,
  isAdmin,
  timer,
  onLogWinner,
  onClearCourt,
  onAutoFillCourt,
  onRotateCourt,
  onDropPlayer,
  selectedPlayerForMove,
  onSlotClick,
  t
}) {
  const [dragOverSlot, setDragOverSlot] = useState(null); // 'courtId_slot' or null
  const isEs = t.beginner === 'Principiante';

  const handleDragOver = (e, courtId, slot) => {
    if (!isAdmin) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSlot(`${courtId}_${slot}`);
  };

  const handleDragLeave = () => {
    setDragOverSlot(null);
  };

  const handleDrop = (e, courtId, slot) => {
    if (!isAdmin) return;
    e.preventDefault();
    setDragOverSlot(null);
    const playerId = e.dataTransfer.getData('text/plain');
    if (playerId) {
      onDropPlayer(playerId, courtId, slot);
    }
  };

  const getCourtPlayerCount = (court) => {
    let count = 0;
    const playersObj = court?.players || {};
    for (let s in playersObj) {
      if (playersObj[s]) count++;
    }
    return count;
  };

  const getCourtTagClass = (courtId) => {
    if (courtId === 1) return 'tag-advanced';
    if (courtId === 2) return 'tag-intermediate';
    return 'tag-beginner';
  };

  const getCourtTagName = (courtId) => {
    if (courtId === 1) return `${t.advanced} / Pro`;
    if (courtId === 2) return `${t.intermediate} / ${isEs ? 'Mixto' : 'Mixed'}`;
    return `${t.intermediate} / ${t.beginner}`;
  };

  return (
    <section className="workspace-section courts-section">
      <div className="section-header">
        <h2>{t.activeCourtsHeader}</h2>
        <span className="court-utilization-badge">
          {t.utilizationLabel}: {courts.reduce((sum, c) => sum + getCourtPlayerCount(c), 0)}/12 {isEs ? 'Jugadores' : 'Players'}
        </span>
      </div>

      <div className="courts-grid">
        {courts.map((court) => {
          const pCount = getCourtPlayerCount(court);
          const isMatchActive = pCount === 4;
          const courtCardClass = `court-card ${isMatchActive ? 'active-match-glow' : ''}`;

          return (
            <div key={court.courtId} className={courtCardClass}>
              <div className="court-header">
                <span className="court-number">{t.courtLabel} {court.courtId}</span>
                <span className={`court-tag ${getCourtTagClass(court.courtId)}`}>
                  {getCourtTagName(court.courtId)}
                </span>
              </div>

              {/* Badminton Court Visual Rendering */}
              <div className="badminton-court-visual">
                {/* Court Top Half (Side A) */}
                <div className="court-half court-top">
                  {['a1', 'a2'].map((slot) => {
                    const player = court?.players?.[slot];
                    const slotKey = `${court.courtId}_${slot}`;
                    const isOver = dragOverSlot === slotKey;
                    const slotClass = `player-slot ${isOver ? 'drag-over' : ''}`;

                    const isSelected = selectedPlayerForMove && player?.id === selectedPlayerForMove;
                    const finalSlotClass = `${slotClass} ${isSelected ? 'selected-for-move' : ''}`;

                    return (
                      <div
                        key={slot}
                        className={finalSlotClass}
                        onDragOver={(e) => handleDragOver(e, court.courtId, slot)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, court.courtId, slot)}
                        onClick={() => isAdmin && onSlotClick && onSlotClick(court.courtId, slot, player)}
                        style={{ cursor: isAdmin ? 'pointer' : 'default' }}
                      >
                        {player ? (
                          <div className={`court-player-card ${player.skill.toLowerCase()}`}>
                            {court.gamesOnCourt && court.gamesOnCourt[slot] > 0 && (
                              <span className="game-count-indicator" style={{
                                position: 'absolute',
                                top: '4px',
                                right: '4px',
                                fontSize: '0.6rem',
                                fontWeight: '800',
                                background: 'rgba(0, 242, 254, 0.15)',
                                color: 'var(--secondary)',
                                border: '1px solid rgba(0, 242, 254, 0.3)',
                                borderRadius: '4px',
                                padding: '1px 4px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.3px',
                                lineHeight: '1'
                              }}>
                                {t.gameCountBadge || "Game"} {court.gamesOnCourt[slot]}/2
                              </span>
                            )}
                            <span className="court-player-name">{player.name}</span>
                            <span className="court-player-stats">
                              {player.gamesPlayed} {isEs ? 'pj' : 'gp'} | {t.wait}: {player.waitRounds}
                            </span>
                            <span className={`skill-badge skill-${player.skill.toLowerCase()}`} style={{ transform: 'scale(0.8)', marginTop: '2px' }}>
                              {t[player.skill.toLowerCase()] || player.skill}
                            </span>
                          </div>
                        ) : (
                          <span className="placeholder-player">{slot.toUpperCase()} {isEs ? 'Vacío' : 'Empty'}</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="court-net" />

                {/* Court Bottom Half (Side B) */}
                <div className="court-half court-bottom">
                  {['b1', 'b2'].map((slot) => {
                    const player = court?.players?.[slot];
                    const slotKey = `${court.courtId}_${slot}`;
                    const isOver = dragOverSlot === slotKey;
                    const slotClass = `player-slot ${isOver ? 'drag-over' : ''}`;

                    const isSelected = selectedPlayerForMove && player?.id === selectedPlayerForMove;
                    const finalSlotClass = `${slotClass} ${isSelected ? 'selected-for-move' : ''}`;

                    return (
                      <div
                        key={slot}
                        className={finalSlotClass}
                        onDragOver={(e) => handleDragOver(e, court.courtId, slot)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, court.courtId, slot)}
                        onClick={() => isAdmin && onSlotClick && onSlotClick(court.courtId, slot, player)}
                        style={{ cursor: isAdmin ? 'pointer' : 'default' }}
                      >
                        {player ? (
                          <div className={`court-player-card ${player.skill.toLowerCase()}`}>
                            {court.gamesOnCourt && court.gamesOnCourt[slot] > 0 && (
                              <span className="game-count-indicator" style={{
                                position: 'absolute',
                                top: '4px',
                                right: '4px',
                                fontSize: '0.6rem',
                                fontWeight: '800',
                                background: 'rgba(0, 242, 254, 0.15)',
                                color: 'var(--secondary)',
                                border: '1px solid rgba(0, 242, 254, 0.3)',
                                borderRadius: '4px',
                                padding: '1px 4px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.3px',
                                lineHeight: '1'
                              }}>
                                {t.gameCountBadge || "Game"} {court.gamesOnCourt[slot]}/2
                              </span>
                            )}
                            <span className="court-player-name">{player.name}</span>
                            <span className="court-player-stats">
                              {player.gamesPlayed} {isEs ? 'pj' : 'gp'} | {t.wait}: {player.waitRounds}
                            </span>
                            <span className={`skill-badge skill-${player.skill.toLowerCase()}`} style={{ transform: 'scale(0.8)', marginTop: '2px' }}>
                              {t[player.skill.toLowerCase()] || player.skill}
                            </span>
                          </div>
                        ) : (
                          <span className="placeholder-player">{slot.toUpperCase()} {isEs ? 'Vacío' : 'Empty'}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Next Up Section */}
              <div className="court-next-up-box">
                <span className="next-up-label">{t.nextUp}:</span>
                <span className="next-up-players">
                  {court.isActive ? (
                    court.nextUp && court.nextUp.length > 0 ? (
                      court.nextUp.map(p => p.name).join(', ')
                    ) : (
                      t.noWaiting
                    )
                  ) : (
                    <span className="inactive-badge">{t.inactive}</span>
                  )}
                </span>
              </div>

              {/* Match Logging Control Panel */}
              <div className="court-controls">
                <div className="score-input-container">
                  <button
                    className="btn-score btn-score-left"
                    style={{
                      backgroundColor: court.winner === 'left' ? 'rgba(0, 229, 255, 0.2)' : '',
                      borderColor: court.winner === 'left' ? 'var(--secondary)' : '',
                      borderWidth: court.winner === 'left' ? '1px' : '0px',
                      borderStyle: 'solid',
                      cursor: pCount >= 4 ? 'pointer' : 'default'
                    }}
                    onClick={() => onLogWinner(court.courtId, 'left')}
                    disabled={pCount < 4}
                  >
                    {t.sideAWins}
                  </button>
                  <div className="vs-text">VS</div>
                  <button
                    className="btn-score btn-score-right"
                    style={{
                      backgroundColor: court.winner === 'right' ? 'rgba(16, 185, 129, 0.2)' : '',
                      borderColor: court.winner === 'right' ? 'var(--primary)' : '',
                      borderWidth: court.winner === 'right' ? '1px' : '0px',
                      borderStyle: 'solid',
                      cursor: pCount >= 4 ? 'pointer' : 'default'
                    }}
                    onClick={() => onLogWinner(court.courtId, 'right')}
                    disabled={pCount < 4}
                  >
                    {t.sideBWins}
                  </button>
                </div>
                
                {isAdmin && (
                  <div className="manual-court-actions">
                    <button
                      className="btn-action-small"
                      onClick={() => onClearCourt(court.courtId)}
                      title="Send court players back to queue"
                    >
                      <Trash2 size={12} /> {isEs ? 'Limpiar' : 'Clear'}
                    </button>
                    <button
                      className="btn-action-small btn-action-rotate"
                      onClick={() => onRotateCourt(court.courtId)}
                      title="Rotate players: log stats, send back to queue, and load next waiting players"
                    >
                      <RotateCw size={12} /> {t.rotateBtn}
                    </button>
                    <button
                      className="btn-action-small"
                      onClick={() => onAutoFillCourt(court.courtId)}
                      title="Auto-fill empty court slots from queue"
                    >
                      <UserPlus size={12} /> {t.autoFill}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
