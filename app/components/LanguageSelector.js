'use client';

import React from 'react';

export default function LanguageSelector({ lang, setLang }) {
  return (
    <div className="language-selector">
      <button
        className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
        onClick={() => setLang('en')}
        title="Switch to English"
      >
        <span>🇺🇸</span>
        <span>EN</span>
      </button>
      <button
        className={`lang-btn ${lang === 'es' ? 'active' : ''}`}
        onClick={() => setLang('es')}
        title="Cambiar a Español"
      >
        <span>🇪🇸</span>
        <span>ES</span>
      </button>
    </div>
  );
}
