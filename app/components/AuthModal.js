'use client';

import React, { useState } from 'react';
import { Phone, Lock, User, UserPlus } from 'lucide-react';

export default function AuthModal({ players, settings, onLogin, t }) {
  const [activeTab, setActiveTab] = useState('player'); // 'player' | 'organizer'
  const [password, setPassword] = useState('');
  const [playerPhone, setPlayerPhone] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerPhone, setNewPlayerPhone] = useState('');
  const [newPlayerSkill, setNewPlayerSkill] = useState('Intermediate');
  const [passphraseInput, setPassphraseInput] = useState('');
  const [error, setError] = useState('');

  // Formatting helper for beautiful on-screen numbers
  const formatPhoneNumber = (value) => {
    if (!value) return value;
    const phoneNumber = value.replace(/\D/g, ''); // strip non-digits
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  };

  const handleOrganizerSubmit = (e) => {
    e.preventDefault();
    if (password === 'Lvv!001Hcg') {
      onLogin('organizer', null);
      setError('');
    } else {
      setError(t.incorrectPassword);
    }
  };

  const handlePlayerPhoneSubmit = (e) => {
    e.preventDefault();

    const phoneInput = playerPhone.trim();
    if (phoneInput.length !== 10) {
      setError(t.full10Digit);
      return;
    }

    const matchedPlayer = players.find(p => p.phone.replace(/\D/g, '') === phoneInput);
    if (matchedPlayer) {
      onLogin('player', matchedPlayer);
      setError('');
    } else {
      setError(t.phoneNotFound);
    }
  };

  const handlePhoneInputChange = (e) => {
    const val = e.target.value.replace(/\D/g, ''); // digits only
    if (val.length <= 10) {
      setPlayerPhone(val);
      setError('');
    }
  };

  const handleNewPhoneInputChange = (e) => {
    const val = e.target.value.replace(/\D/g, ''); // digits only
    if (val.length <= 10) {
      setNewPlayerPhone(val);
      setError('');
    }
  };

  const handlePlayerCreateSubmit = (e) => {
    e.preventDefault();
    const correctPassphrase = (settings?.passPhrase || 'BADMINTON2026').trim().toUpperCase();
    if (passphraseInput.trim().toUpperCase() !== correctPassphrase) {
      setError(t.incorrectPassphrase);
      return;
    }

    const nameInput = newPlayerName.trim();
    const phoneInput = newPlayerPhone.trim();

    if (!nameInput) {
      setError(t.enterName);
      return;
    }
    if (!phoneInput) {
      setError(t.enterMobileError);
      return;
    }
    if (phoneInput.length !== 10) {
      setError(t.valid10Digit);
      return;
    }

    // Checks
    const phoneExists = players.some(p => p.phone.replace(/\D/g, '') === phoneInput);
    if (phoneExists) {
      setError(t.phoneExists);
      return;
    }
    const nameExists = players.some(p => p.name.toLowerCase() === nameInput.toLowerCase());
    if (nameExists) {
      setError(t.nameExists);
      return;
    }

    const mockNewPlayer = {
      id: 'player_' + Date.now(),
      name: nameInput,
      skill: newPlayerSkill,
      phone: phoneInput,
      status: 'waiting',
      gamesPlayed: 0,
      waitRounds: 0,
      lastPlayedRound: -1,
      partners: [],
      opponents: []
    };

    onLogin('player-new', mockNewPlayer);
    setError('');
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          {/* Logo Icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '0.75rem', boxShadow: 'var(--shadow-inset)' }}>
              <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: '42px', height: '42px', color: 'var(--secondary)' }}>
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
          </div>
          <h2>{t.title}</h2>
          <p>{t.authSubtitle}</p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab-btn ${activeTab === 'player' ? 'active' : ''}`}
            onClick={() => { setActiveTab('player'); setError(''); }}
          >
            {t.playerSignIn}
          </button>
          <button
            className={`auth-tab-btn ${activeTab === 'organizer' ? 'active' : ''}`}
            onClick={() => { setActiveTab('organizer'); setError(''); }}
          >
            {t.organizerAdmin}
          </button>
        </div>

        {error && <div className="auth-error-msg">{error}</div>}

        <div className="auth-body">
          {activeTab === 'organizer' ? (
            <form onSubmit={handleOrganizerSubmit} className="form-group">
              <label htmlFor="admin-password">{t.organizerPassword}</label>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input
                  type="password"
                  id="admin-password"
                  placeholder={t.organizerPasswordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: '0.75rem' }}>
                {t.verifyOrganizer}
              </button>
            </form>
          ) : (
            <div className="flex-col" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <form onSubmit={handlePlayerPhoneSubmit} className="form-group">
                <label htmlFor="player-phone">{t.signInMobile}</label>

                <div className="premium-phone-wrapper">
                  <div className="phone-country-code">
                    <span>🇲🇽</span>
                    <span>+52</span>
                  </div>
                  <div className="phone-divider"></div>
                  <input
                    type="tel"
                    id="player-phone"
                    placeholder="(555) 000-0000"
                    value={formatPhoneNumber(playerPhone)}
                    onChange={handlePhoneInputChange}
                    className="large-phone-input"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={playerPhone.length !== 10}
                  style={{
                    marginTop: '0.75rem',
                    boxShadow: playerPhone.length === 10 ? '0 4px 15px var(--secondary-glow)' : 'none',
                    backgroundColor: playerPhone.length === 10 ? 'var(--secondary)' : 'rgba(255,255,255,0.05)',
                    color: playerPhone.length === 10 ? 'var(--bg-primary)' : 'var(--text-muted)'
                  }}
                >
                  {t.signInBtn}
                </button>
                {players.some(p => p.phone.startsWith('98765432')) && (
                  <span className="player-subtext" style={{ fontSize: '0.7rem', marginTop: '0.5rem', textAlign: 'center', display: 'block' }}>
                    {t.mockPresets}(987) 654-3201 to (987) 654-3220
                  </span>
                )}
              </form>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.25rem 0' }} />

              <form onSubmit={handlePlayerCreateSubmit} className="form-group">
                <label>{t.registerNewPlayer}</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  
                  {/* Session Passphrase Input */}
                  <div className="input-with-icon">
                    <Lock size={18} className="input-icon" />
                    <input
                      type="password"
                      placeholder={t.enterPassphrase}
                      value={passphraseInput}
                      onChange={(e) => setPassphraseInput(e.target.value)}
                      required
                    />
                  </div>

                  <div className="input-with-icon">
                    <User size={18} className="input-icon" />
                    <input
                      type="text"
                      placeholder={t.namePlaceholder}
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="premium-phone-wrapper">
                    <div className="phone-country-code">
                      <span>🇲🇽</span>
                      <span>+52</span>
                    </div>
                    <div className="phone-divider"></div>
                    <input
                      type="tel"
                      placeholder="(555) 000-0000"
                      value={formatPhoneNumber(newPlayerPhone)}
                      onChange={handleNewPhoneInputChange}
                      className="large-phone-input"
                      required
                    />
                  </div>
                  <div className="input-with-icon">
                    <UserPlus size={18} className="input-icon" />
                    <select
                      value={newPlayerSkill}
                      onChange={(e) => setNewPlayerSkill(e.target.value)}
                      style={{ paddingLeft: '2.75rem' }}
                    >
                      <option value="Beginner">{t.beginner}</option>
                      <option value="Intermediate">{t.intermediate}</option>
                      <option value="Advanced">{t.advanced}</option>
                      <option value="Pro">{t.proOption}</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="btn btn-secondary-outline btn-full" style={{ marginTop: '1rem' }}>
                  {t.registerBtn}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
