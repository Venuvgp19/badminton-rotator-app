'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, onValue, set, update } from 'firebase/database';

import { Activity, Users, BarChart3 } from 'lucide-react';
import SessionHeader from './components/SessionHeader';
import CourtGrid from './components/CourtGrid';
import QueueSidebar from './components/QueueSidebar';
import StatsHistory from './components/StatsHistory';
import AuthModal from './components/AuthModal';
import LanguageSelector from './components/LanguageSelector';
import { TRANSLATIONS } from './translations';




const DEFAULT_PLAYERS = [];

const REAL_WORLD_PLAYERS = [
  { id: "player_1", name: "Venu", phone: "8892137015", skill: "Advanced" },
  { id: "player_2", name: "Balakrishnan", phone: "4423430616", skill: "Pro" },
  { id: "player_3", name: "Narendra Thakur", phone: "4421129890", skill: "Advanced" },
  { id: "player_4", name: "Leo", phone: "4623082330", skill: "Pro" },
  { id: "player_5", name: "Carlos", phone: "4428784438", skill: "Pro" },
  { id: "player_6", name: "Preethish", phone: "4426799935", skill: "Pro" },
  { id: "player_7", name: "Fausto", phone: "4423225485", skill: "Pro" },
  { id: "player_8", name: "Titus", phone: "9962888580", skill: "Pro" },
  { id: "player_9", name: "Vikram", phone: "9677618019", skill: "Pro" },
  { id: "player_10", name: "Ranjith", phone: "4421198555", skill: "Pro" },
  { id: "player_11", name: "Gabriel", phone: "5545829366", skill: "Advanced" },
  { id: "player_12", name: "Manu", phone: "5543749624", skill: "Advanced" },
  { id: "player_13", name: "PappiReddy", phone: "4428766017", skill: "Advanced" },
  { id: "player_14", name: "Ivan", phone: "4423642546", skill: "Advanced" },
  { id: "player_15", name: "Tobias", phone: "4461381950", skill: "Advanced" },
  { id: "player_16", name: "Juan Degatu", phone: "4422266349", skill: "Advanced" },
  { id: "player_17", name: "Abdul", phone: "8438536485", skill: "Intermediate" },
  { id: "player_18", name: "Luis", phone: "5591998044", skill: "Intermediate" },
  { id: "player_19", name: "Carolina", phone: "5565770079", skill: "Intermediate" },
  { id: "player_20", name: "Prabhu", phone: "8056368204", skill: "Intermediate" },
  { id: "player_21", name: "Pavithra", phone: "9994819110", skill: "Intermediate" },
  { id: "player_22", name: "Aswin", phone: "7373392567", skill: "Intermediate" },
  { id: "player_23", name: "Harshada", phone: "4421472973", skill: "Intermediate" },
  { id: "player_24", name: "Andrea", phone: "4111157755", skill: "Beginner" },
  { id: "player_25", name: "Baltazar", phone: "4463257510", skill: "Beginner" },
  { id: "player_26", name: "Jose", phone: "1234567890", skill: "Beginner" },
  { id: "player_27", name: "Paulina", phone: "4613124632", skill: "Beginner" }
];

const normalizeCourts = (rawCourts) => {
  if (!Array.isArray(rawCourts)) return [];
  return rawCourts.map(court => ({
    ...court,
    players: {
      a1: court.players?.a1 || null,
      a2: court.players?.a2 || null,
      b1: court.players?.b1 || null,
      b2: court.players?.b2 || null,
    },
    gamesOnCourt: {
      a1: court.gamesOnCourt?.a1 || 0,
      a2: court.gamesOnCourt?.a2 || 0,
      b1: court.gamesOnCourt?.b1 || 0,
      b2: court.gamesOnCourt?.b2 || 0,
    },
    winner: court.winner || null
  }));
};

const getScheduledTimerState = () => {
  return { isScheduledActive: false, scheduledRemaining: 0 };
};

const isPlayerEligibleForSlot = (p, courtId, slotId, currentCourtPlayers, forceRelaxed = false, availableQueue = []) => {
  const getPartnerSlot = (slot) => {
    if (slot === 'a1') return 'a2';
    if (slot === 'a2') return 'a1';
    if (slot === 'b1') return 'b2';
    if (slot === 'b2') return 'b1';
    return null;
  };

  const partnerSlot = getPartnerSlot(slotId);
  const partner = currentCourtPlayers[partnerSlot];

  if (p.skill === 'Beginner') {
    // 1. Partner check (no 2 beginners together if other levels waiting)
    if (partner && partner.skill === 'Beginner') {
      const hasOtherLevels = availableQueue.some(pl => pl.skill !== 'Beginner' && pl.id !== p.id && pl.id !== partner.id);
      if (hasOtherLevels) return false;
    }

    // 2. Count check (max 2 beginners on court 2/3 if other levels waiting)
    const currentBegCount = Object.values(currentCourtPlayers).filter(x => x && x.skill === 'Beginner').length;
    if (currentBegCount >= 2) {
      const hasOtherLevels = availableQueue.some(pl => pl.skill !== 'Beginner' && pl.id !== p.id);
      if (hasOtherLevels) return false;
    }

    // 3. Court 1 restriction
    if (!forceRelaxed && courtId === 1) {
      return false;
    }
  }

  const currentProsCount = Object.values(currentCourtPlayers).filter(x => x && x.skill === 'Pro').length;

  if (!forceRelaxed) {
    // Strict rules
    if (p.skill === 'Pro') {
      if (courtId === 3) return false;
      if (currentProsCount >= 2) return false;
    }
  } else {
    // Relaxed rules (breaking rules to occupy court)
    if (p.skill === 'Pro') {
      if (currentProsCount >= 2) return false;
    }
  }

  return true;
};

const getActiveCourtsForPool = (activePool, allowedCount) => {
  if (allowedCount <= 0) return [];
  if (allowedCount >= 3) return [1, 2, 3];

  const numBeginners = activePool.filter(p => p.skill === 'Beginner').length;
  const numPros = activePool.filter(p => p.skill === 'Pro').length;

  if (allowedCount === 1) {
    // 1 court allowed: Prioritize Court 3 if we have Beginners, Court 1 if we have Pros, otherwise Court 2
    if (numBeginners > 0) return [3];
    if (numPros > 0) return [1];
    return [2];
  }

  if (allowedCount === 2) {
    // 2 courts allowed:
    // If we have Beginners and Pros, activate Court 3 (for Beginners) and Court 1 (for Pros)
    if (numBeginners > 0 && numPros > 0) return [1, 3];
    // If we have Beginners but no Pros, activate Court 2 and Court 3
    if (numBeginners > 0) return [2, 3];
    // If we have Pros but no Beginners, activate Court 1 and Court 2
    if (numPros > 0) return [1, 2];
    // Otherwise default to Court 1 and Court 2
    return [1, 2];
  }

  return [];
};

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [lang, setLang] = useState('en');
  const t = TRANSLATIONS[lang];

  const accumulateAllPlayersTimes = (currentPlayers, isTimerActive) => {
    return currentPlayers.map(p => {
      let playTime = p.playTime || 0;
      let waitTime = p.waitTime || 0;
      const lastStatusChange = p.lastStatusChange || Date.now();
      
      if (isTimerActive && lastStatusChange) {
        const elapsed = Math.floor((Date.now() - lastStatusChange) / 1000);
        if (p.status === 'playing') playTime += elapsed;
        if (p.status === 'waiting') waitTime += elapsed;
      }
      
      return {
        ...p,
        playTime,
        waitTime,
        lastStatusChange: Date.now()
      };
    });
  };

  // Authentication State
  const [auth, setAuth] = useState({ role: null, player: null }); // role: 'organizer' | 'player' | null

  // Session Core State
  const [players, setPlayers] = useState([]);
  const [courts, setCourts] = useState([
    { courtId: 1, players: { a1: null, a2: null, b1: null, b2: null }, gamesOnCourt: { a1: 0, a2: 0, b1: 0, b2: 0 }, winner: null },
    { courtId: 2, players: { a1: null, a2: null, b1: null, b2: null }, gamesOnCourt: { a1: 0, a2: 0, b1: 0, b2: 0 }, winner: null },
    { courtId: 3, players: { a1: null, a2: null, b1: null, b2: null }, gamesOnCourt: { a1: 0, a2: 0, b1: 0, b2: 0 }, winner: null }
  ]);
  const [history, setHistory] = useState([]);
  const [timer, setTimer] = useState({ round: 0, timeRemaining: 120 * 60, isActive: false, phase: 'play', startedAt: null });
  const [timeRemainingDisplay, setTimeRemainingDisplay] = useState(120 * 60);
  const [settings, setSettings] = useState({
    playDuration: 120,
    changeoverDuration: 2,
    rotationMode: 'smart-rotation',
    rotationStrategy: 'all-4-rotate',
    voiceEnabled: true,
    volume: 0.8,
    autoScheduleEnabled: true,
    passPhrase: 'BADMINTON2026'
  });

  // Firebase Config State
  const [firebaseConfigText, setFirebaseConfigText] = useState('');
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);

  // Mobile navigation state
  const [activeMobileTab, setActiveMobileTab] = useState('courts'); // 'courts' | 'queue' | 'stats'
  // Mobile tap-to-move state
  const [selectedPlayerForMove, setSelectedPlayerForMove] = useState(null); // playerId or null

  // Sound References
  const warningSoundRef = useRef(null);
  const endSoundRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const firebaseDbRef = useRef(null);
  const isOrganizerRef = useRef(false);
  const autoRotatingCourtsRef = useRef({});
  const courtsRef = useRef(courts);
  useEffect(() => {
    courtsRef.current = courts;
  }, [courts]);

  const playersRef = useRef(players);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  const historyRef = useRef(history);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const timerRef = useRef(timer);
  useEffect(() => {
    timerRef.current = timer;
  }, [timer]);

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Maintain organizer role reference for interval closure access
  useEffect(() => {
    isOrganizerRef.current = auth.role === 'organizer';
  }, [auth.role]);


  // Audio speech announcements helper
  const speak = useCallback((text) => {
    if (!settings.voiceEnabled || typeof window === 'undefined') return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.volume = settings.volume;
      utterance.rate = 1.05;
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => v.lang.includes('en-US') || v.lang.includes('en-GB'));
      if (preferred) utterance.voice = preferred;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Speech Synthesis Error:", e);
    }
  }, [settings.voiceEnabled, settings.volume]);

  // Initialize and load Local Storage on mount
  useEffect(() => {
    // Check for Firebase config in URL query params
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlConfig = urlParams.get('config');
      if (urlConfig) {
        try {
          const decoded = atob(urlConfig);
          const parsed = JSON.parse(decoded);
          if (parsed.apiKey && parsed.databaseURL) {
            localStorage.setItem('badminton_firebase_config', decoded);
            // Clean URL query parameter so it looks clean
            window.history.replaceState({}, document.title, window.location.pathname);
            window.location.reload();
            return;
          }
        } catch (e) {
          console.error("Failed to parse Firebase config from URL:", e);
        }
      }
    }

    setMounted(true);
    
    // Clean up legacy localStorage auth if any exists
    if (localStorage.getItem('badminton_auth')) {
      localStorage.removeItem('badminton_auth');
    }

    // Load local auth
    const storedAuth = sessionStorage.getItem('badminton_auth');
    if (storedAuth) {
      try {
        const parsed = JSON.parse(storedAuth);
        if (parsed && parsed.role) {
          setAuth({ role: parsed.role, player: parsed.player || null });
        } else {
          setAuth({ role: null, player: null });
        }
      } catch (e) {
        setAuth({ role: null, player: null });
      }
    } else {
      setAuth({ role: null, player: null });
    }

    // Clear any legacy test configs to ensure desktop and mobile use the same single source of truth
    const rawStoredFbConfig = localStorage.getItem('badminton_firebase_config');
    if (rawStoredFbConfig) {
      try {
        const parsed = JSON.parse(rawStoredFbConfig);
        // If it's a legacy project, clear it!
        if (parsed.projectId !== 'badminton-app-83d9d') {
          localStorage.removeItem('badminton_firebase_config');
        }
      } catch (e) {
        localStorage.removeItem('badminton_firebase_config');
      }
    }

    // Load local firebase config
    const storedFbConfig = localStorage.getItem('badminton_firebase_config');
    let activeFbConfig = storedFbConfig;
    if (storedFbConfig) {
      setFirebaseConfigText(storedFbConfig);
    } else {
      // Check environment variables
      const envConfigStr = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
      if (envConfigStr) {
        try {
          JSON.parse(envConfigStr);
          setFirebaseConfigText(envConfigStr);
          activeFbConfig = envConfigStr;
        } catch (e) {
          console.error("Invalid JSON in NEXT_PUBLIC_FIREBASE_CONFIG:", e);
        }
      } else {
        const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
        const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
        if (apiKey && databaseURL) {
          const constructedConfig = {
            apiKey,
            databaseURL,
            authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
          };
          const constructedStr = JSON.stringify(constructedConfig);
          setFirebaseConfigText(constructedStr);
          activeFbConfig = constructedStr;
        } else {
          // Default fallback Firebase config (connected automatically)
          const defaultFbConfig = {
            apiKey: "AIzaSyCrswaU2J8nH2DSrFWl0QKEwM0hvraZaKk",
            authDomain: "badminton-app-83d9d.firebaseapp.com",
            databaseURL: "https://badminton-app-83d9d-default-rtdb.firebaseio.com",
            projectId: "badminton-app-83d9d",
            storageBucket: "badminton-app-83d9d.firebasestorage.app",
            messagingSenderId: "603332903363",
            appId: "1:603332903363:web:46e01af5ddf8d1d1563d76",
            measurementId: "G-GH1Y486CY2"
          };
          const defaultStr = JSON.stringify(defaultFbConfig);
          setFirebaseConfigText(defaultStr);
          activeFbConfig = defaultStr;
        }
      }
    }

    // Load local backup state (if not using Firebase)
    const backupState = localStorage.getItem('badminton_offline_state');
    if (backupState && !activeFbConfig) {
      try {
        const data = JSON.parse(backupState);
        if (data.players && data.players.length > 0) {
          setPlayers(data.players);
        } else {
          setPlayers(DEFAULT_PLAYERS.map(p => ({
            ...p,
            loginTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          })));
        }
        if (data.courts) setCourts(normalizeCourts(data.courts));
        if (data.history) setHistory(data.history);
        
        // Force 2 hours play duration for the session timer
        const loadedSettings = { ...data.settings, playDuration: 120 };
        setSettings(loadedSettings);

        const loadedTimer = {
          ...data.timer,
          timeRemaining: data.timer?.timeRemaining ?? (120 * 60),
          startedAt: data.timer?.startedAt ?? null
        };
        setTimer(loadedTimer);
      } catch (e) {
        console.error("Error loading offline backup state:", e);
        setPlayers(DEFAULT_PLAYERS);
      }
    } else {
      setPlayers(DEFAULT_PLAYERS.map(p => ({
        ...p,
        loginTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      })));
    }

    // Server-side fallback session fetch (only if Firebase is not connected)
    if (!activeFbConfig) {
      fetch('/api/session')
        .then(res => res.json())
        .then(data => {
          if (data && data.players && data.players.length > 0) {
            setPlayers(data.players);
            if (data.courts) setCourts(normalizeCourts(data.courts));
            if (data.history) setHistory(data.history);
            if (data.settings) setSettings({ ...data.settings, playDuration: 120 });
            if (data.timer) {
              setTimer({
                ...data.timer,
                timeRemaining: data.timer.timeRemaining ?? (120 * 60),
                startedAt: data.timer.startedAt ?? null
              });
            }
          }
        })
        .catch(err => console.error("Initial server session fetch failed:", err));
    }

    // Create audio elements
    warningSoundRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/911/911-84.wav');
    endSoundRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav');
  }, []);

  // Sync state to Firebase or Local Storage on state updates
  const syncState = useCallback((newPlayers, newCourts, newTimer, newHistory, newSettings) => {
    const data = {
      players: newPlayers || players,
      courts: newCourts || courts,
      timer: newTimer || timer,
      history: newHistory || history,
      settings: newSettings || settings
    };

    if (isFirebaseConnected && firebaseDbRef.current) {
      // Allow any client to write state updates to keep devices in sync
      const sanitizedData = JSON.parse(JSON.stringify(data));
      set(ref(firebaseDbRef.current, 'session_state'), sanitizedData)
        .catch(err => {
          console.error("Firebase write failed (falling back to offline/Redis):", err);
          setIsFirebaseConnected(false);
          // Save locally
          localStorage.setItem('badminton_offline_state', JSON.stringify(data));
        });

      // Always sync to server fallback in background so HTTP polling clients stay synchronized
      fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).catch(err2 => console.error("Server session background sync failed:", err2));
    } else {
      // Save locally
      localStorage.setItem('badminton_offline_state', JSON.stringify(data));
      // Save to server fallback session so other devices can fetch it
      fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).catch(err => console.error("Server session sync failed:", err));
    }
  }, [players, courts, timer, history, settings, isFirebaseConnected]);

  // Ensure courts are empty and all players are back in queue if the timer is inactive
  useEffect(() => {
    if (!mounted) return;
    if (!timer.isActive) {
      const hasPlayingPlayers = players.some(p => p.status === 'playing');
      const hasCourtPlayers = courts.some(c => Object.values(c.players).some(Boolean));
      if (hasPlayingPlayers || hasCourtPlayers) {
        const updatedPlayers = players.map(p => {
          if (p.status === 'playing') {
            return {
              ...p,
              status: 'waiting',
              lastStatusChange: Date.now()
            };
          }
          return p;
        });
        const updatedCourts = courts.map(c => ({
          ...c,
          players: { a1: null, a2: null, b1: null, b2: null },
          winner: null
        }));
        setPlayers(updatedPlayers);
        playersRef.current = updatedPlayers;
        setCourts(updatedCourts);
        courtsRef.current = updatedCourts;
        if (auth.role === 'organizer') {
          syncState(updatedPlayers, updatedCourts, timer, history, settings);
        }
      }
    }
  }, [timer.isActive, players, courts, auth.role, syncState, history, settings, mounted]);

  // Connect/Initialize Firebase if config changes
  useEffect(() => {
    if (!mounted || !firebaseConfigText) {
      setIsFirebaseConnected(false);
      return;
    }

    try {
      const config = JSON.parse(firebaseConfigText);
      // Validate structure
      if (!config.apiKey || !config.databaseURL) {
        throw new Error('Missing apiKey or databaseURL');
      }

      // Initialize Firebase app if not exists
      const app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
      const db = getDatabase(app);
      firebaseDbRef.current = db;
      setIsFirebaseConnected(true);

      // Listen for updates
      const stateRef = ref(db, 'session_state');
      const unsubscribe = onValue(stateRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          // Force 2 hours play duration
          const updatedSettings = {
            ...data.settings,
            playDuration: 120
          };
          const updatedTimer = {
            ...data.timer,
            timeRemaining: data.timer?.timeRemaining ?? (120 * 60),
            startedAt: data.timer?.startedAt ?? null
          };

          // If this client is a Player, sync ALL states from firebase
          // If this client is an Organizer, only sync players/courts/settings/history (to prevent timer conflicts)
          if (!isOrganizerRef.current) {
            setPlayers(data.players || []);
            setCourts(normalizeCourts(data.courts));
            setTimer(updatedTimer);
            setHistory(data.history || []);
            setSettings(updatedSettings);
          } else {
            // Organizer reconciles details
            setPlayers(data.players || []);
            setCourts(normalizeCourts(data.courts));
            setHistory(data.history || []);
            setSettings(updatedSettings);
            
            // Only update timer state if not active to avoid clashing with tick loop,
            // but accept pauses (isActive === false) or resets (round === 0)
            setTimer(prev => {
              if (!updatedTimer.isActive || updatedTimer.round === 0) {
                return updatedTimer;
              }
              if (prev.isActive) {
                return {
                  ...updatedTimer,
                  isActive: prev.isActive,
                  timeRemaining: prev.timeRemaining,
                  startedAt: prev.startedAt
                };
              }
              return updatedTimer;
            });
          }
        } else {
          // Firebase database is empty!
          // Check if we are organizer to write default state to Firebase
          const currentAuth = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('badminton_auth') || '{}') : {};
          if (currentAuth.role === 'organizer') {
            const initialData = {
              players: DEFAULT_PLAYERS.map(p => ({
                ...p,
                loginTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              })),
              courts: [
                { courtId: 1, players: { a1: null, a2: null, b1: null, b2: null }, gamesOnCourt: { a1: 0, a2: 0, b1: 0, b2: 0 }, winner: null },
                { courtId: 2, players: { a1: null, a2: null, b1: null, b2: null }, gamesOnCourt: { a1: 0, a2: 0, b1: 0, b2: 0 }, winner: null },
                { courtId: 3, players: { a1: null, a2: null, b1: null, b2: null }, gamesOnCourt: { a1: 0, a2: 0, b1: 0, b2: 0 }, winner: null }
              ],
              timer: { round: 0, timeRemaining: 120 * 60, isActive: false, phase: 'play' },
              history: [],
              settings: {
                playDuration: 120,
                changeoverDuration: 2,
                rotationMode: 'smart-rotation',
                rotationStrategy: 'all-4-rotate',
                voiceEnabled: true,
                volume: 0.8,
                autoScheduleEnabled: true,
                passPhrase: 'BADMINTON2026'
              }
            };
            set(ref(db, 'session_state'), initialData)
              .catch(err => {
                console.error("Firebase initial seed failed (Permission Denied):", err);
                setIsFirebaseConnected(false);
                setPlayers(initialData.players);
                setCourts(initialData.courts);
                setTimer(initialData.timer);
                setHistory(initialData.history);
                setSettings(initialData.settings);
              });
          } else {
            // If we are a pool or guest, fallback to DEFAULT_PLAYERS locally
            setPlayers(DEFAULT_PLAYERS.map(p => ({
              ...p,
              loginTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            })));
          }
        }
      }, (error) => {
        console.error("Firebase subscription failed (Permission Denied):", error);
        setIsFirebaseConnected(false);
      });

      return () => unsubscribe();
    } catch (e) {
      console.error("Firebase config parsing error:", e);
      setIsFirebaseConnected(false);
    }
  }, [mounted, firebaseConfigText]);

  // Poll server session state periodically if Firebase is NOT connected
  useEffect(() => {
    if (!mounted || isFirebaseConnected) return;

    const interval = setInterval(() => {
      fetch('/api/session')
        .then(res => res.json())
        .then(data => {
          if (data && typeof data === 'object') {
            // Reconcile and merge server state with local states
            // Force 2 hours play duration
            const updatedSettings = {
              ...data.settings,
              playDuration: 120
            };
            const updatedTimer = {
              ...data.timer,
              timeRemaining: data.timer?.timeRemaining ?? (120 * 60),
              startedAt: data.timer?.startedAt ?? null
            };

            // Update states
            setPlayers(data.players || []);
            if (data.courts) setCourts(normalizeCourts(data.courts));
            setHistory(data.history || []);
            setSettings(updatedSettings);

            // Reconcile timer ticks
            if (!isOrganizerRef.current) {
              setTimer(updatedTimer);
            } else {
              setTimer(prev => {
                if (!updatedTimer.isActive || updatedTimer.round === 0) {
                  return updatedTimer;
                }
                if (prev.isActive) {
                  return {
                    ...updatedTimer,
                    isActive: prev.isActive,
                    timeRemaining: prev.timeRemaining,
                    startedAt: prev.startedAt
                  };
                }
                return updatedTimer;
              });
            }
          }
        })
        .catch(err => console.error("Periodic server session sync failed:", err));
    }, 4000); // Poll every 4 seconds for responsiveness

    return () => clearInterval(interval);
  }, [mounted, isFirebaseConnected]);

  // Session Timer Countdown Ticking Effect (using absolute timestamps)
  useEffect(() => {
    if (!mounted) return;

    const updateDisplay = () => {
      const { isScheduledActive, scheduledRemaining } = getScheduledTimerState();
      if (isScheduledActive) {
        setTimeRemainingDisplay(scheduledRemaining);
      } else if (timer.isActive && timer.startedAt) {
        const elapsed = Math.max(0, Math.floor((Date.now() - timer.startedAt) / 1000));
        const rem = Math.max(0, timer.timeRemaining - elapsed);
        setTimeRemainingDisplay(rem);
        
        if (rem <= 0 && isOrganizerRef.current) {
          // Timer finished! Update database to stop timer
          const finishedTimer = { ...timer, isActive: false, timeRemaining: 0, startedAt: null };
          
          const updatedPlayers = playersRef.current.map(p => {
            if (p.status === 'playing') {
              let playTime = p.playTime || 0;
              let waitTime = p.waitTime || 0;
              const lastStatusChange = p.lastStatusChange || Date.now();
              if (lastStatusChange) {
                const elapsed = Math.floor((Date.now() - lastStatusChange) / 1000);
                playTime += elapsed;
              }
              return {
                ...p,
                status: 'waiting',
                playTime,
                waitTime,
                lastStatusChange: Date.now()
              };
            }
            return p;
          });
          const updatedCourts = courtsRef.current.map(c => ({
            ...c,
            players: { a1: null, a2: null, b1: null, b2: null },
            winner: null
          }));

          setPlayers(updatedPlayers);
          playersRef.current = updatedPlayers;
          setCourts(updatedCourts);
          courtsRef.current = updatedCourts;
          setTimer(finishedTimer);
          timerRef.current = finishedTimer;

          syncState(updatedPlayers, updatedCourts, finishedTimer, history, settings);
          speak("Session time is up!");
        }
      } else {
        setTimeRemainingDisplay(timer.timeRemaining);
      }
    };

    updateDisplay();
    const interval = setInterval(updateDisplay, 1000);
    return () => clearInterval(interval);
  }, [timer, history, settings, syncState, speak, mounted]);


  // --- ACTIONS HANDLERS ---

  const handleLogin = (role, playerObj) => {
    let updatedAuth = { role, player: playerObj };
    if (role === 'organizer') {
      isOrganizerRef.current = true;
      // Initialize Firebase with DEFAULT_PLAYERS if empty, or sync current state
      syncState(players.length > 0 ? players : DEFAULT_PLAYERS, courts, timer, history, settings);
    } else if (role === 'player-new') {
      // Create new player profile
      const newP = {
        ...playerObj,
        loginTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      const updatedPlayers = [...players, newP];
      setPlayers(updatedPlayers);
      updatedAuth = { role: 'player', player: newP };
      syncState(updatedPlayers, courts, timer, history, settings);
    } else if (role === 'player') {
      // Record check-in/login time for existing player
      const updatedPlayers = players.map(p => {
        if (p.id === playerObj.id) {
          return {
            ...p,
            loginTime: p.loginTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
        }
        return p;
      });
      setPlayers(updatedPlayers);
      const updatedPlayer = updatedPlayers.find(p => p.id === playerObj.id);
      updatedAuth = { role: 'player', player: updatedPlayer };
      syncState(updatedPlayers, courts, timer, history, settings);
    }
    
    // Save auth locally
    setAuth(updatedAuth);
    sessionStorage.setItem('badminton_auth', JSON.stringify(updatedAuth));
    speak(`Logged in as ${role === 'organizer' ? 'Organizer' : updatedAuth.player.name}`);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('badminton_auth');
    setAuth({ role: null, player: null });
    speak("Logged out.");
  };

  const handleToggleTimer = () => {
    if (auth.role !== 'organizer') return;
    
    const { isScheduledActive } = getScheduledTimerState();
    const isCurrentlyActive = timer.isActive || isScheduledActive;
    const updatedPlayers = accumulateAllPlayersTimes(players, isCurrentlyActive);
    
    let updatedTimer;
    if (timer.isActive) {
      const elapsed = Math.floor((Date.now() - (timer.startedAt || Date.now())) / 1000);
      const nextRemaining = Math.max(0, timer.timeRemaining - elapsed);
      updatedTimer = {
        ...timer,
        isActive: false,
        timeRemaining: nextRemaining,
        startedAt: null
      };
    } else {
      updatedTimer = {
        ...timer,
        isActive: true,
        startedAt: Date.now()
      };
    }

    let nextPlayers = updatedPlayers;
    let nextCourts = courts;

    if (updatedTimer.isActive) {
      // Transitioning from inactive to active -> Allocate courts to players who are in the queue!
      const activePool = nextPlayers.filter(p => p.status !== 'resting');
      const totalCheckedIn = activePool.length;
      
      let allowedCount = 0;
      if (totalCheckedIn >= 12) allowedCount = 3;
      else if (totalCheckedIn >= 8) allowedCount = 2;
      else if (totalCheckedIn >= 4) allowedCount = 1;

      const activeCourtsList = getActiveCourtsForPool(activePool, allowedCount);
      if (activeCourtsList.length > 0) {
        nextCourts = courts.map(c => {
          if (!activeCourtsList.includes(c.courtId)) {
            // Keep inactive courts empty
            return { ...c, players: { a1: null, a2: null, b1: null, b2: null }, winner: null };
          }
          
          const hasPlayers = Object.values(c.players).some(Boolean);
          if (hasPlayers) {
            return c; // Keep existing players
          }

          // Populate this empty active court!
          // This is the start of the play -> Bypass all matchmaking/compatibility/court skill constraints!
          let waiting = nextPlayers.filter(p => p.status === 'waiting');
          waiting.forEach(p => {
            p._priorityScore = (p.gamesPlayed * 1000) - (p.waitRounds * 50) + (p.lastPlayedRound * 5);
          });
          waiting.sort((a, b) => a._priorityScore - b._priorityScore);

          if (waiting.length >= 4) {
            const toPlace = waiting.slice(0, 4);
            const placeIds = toPlace.map(x => x.id);

            nextPlayers = nextPlayers.map(p => {
              if (placeIds.includes(p.id)) {
                let playTime = p.playTime || 0;
                let waitTime = p.waitTime || 0;
                const lastStatusChange = p.lastStatusChange || Date.now();
                if (lastStatusChange) {
                  const elapsed = Math.floor((Date.now() - lastStatusChange) / 1000);
                  waitTime += elapsed;
                }
                return {
                  ...p,
                  status: 'playing',
                  playTime,
                  waitTime,
                  lastStatusChange: Date.now()
                };
              }
              return p;
            });

            return {
              ...c,
              players: {
                a1: toPlace[0] || null,
                b1: toPlace[1] || null,
                a2: toPlace[2] || null,
                b2: toPlace[3] || null
              },
              gamesOnCourt: { a1: 0, a2: 0, b1: 0, b2: 0 },
              winner: null
            };
          }

          return c;
        });
      }
    } else {
      // Transitioning from active to inactive -> Put all players in queue and clear courts!
      nextPlayers = updatedPlayers.map(p => {
        if (p.status === 'playing') {
          let playTime = p.playTime || 0;
          let waitTime = p.waitTime || 0;
          const lastStatusChange = p.lastStatusChange || Date.now();
          if (lastStatusChange) {
            const elapsed = Math.floor((Date.now() - lastStatusChange) / 1000);
            playTime += elapsed;
          }
          return {
            ...p,
            status: 'waiting',
            playTime,
            waitTime,
            lastStatusChange: Date.now()
          };
        }
        return p;
      });
      nextCourts = courts.map(c => ({
        ...c,
        players: { a1: null, a2: null, b1: null, b2: null },
        winner: null
      }));
    }

    setPlayers(nextPlayers);
    setTimer(updatedTimer);
    setCourts(nextCourts);
    syncState(nextPlayers, nextCourts, updatedTimer, history, settings);
  };

  const handleResetSession = () => {
    if (auth.role !== 'organizer') return;
    if (confirm("Reset the session? This clears play count and match history.")) {
      const resetPlayers = players.map(p => ({
        ...p,
        gamesPlayed: 0,
        waitRounds: 0,
        lastPlayedRound: -1,
        status: 'waiting',
        partners: [],
        opponents: [],
        playTime: 0,
        waitTime: 0,
        lastStatusChange: Date.now()
      }));
      const resetCourts = courts.map(c => ({
        ...c,
        players: { a1: null, a2: null, b1: null, b2: null },
        gamesOnCourt: { a1: 0, a2: 0, b1: 0, b2: 0 },
        winner: null
      }));
      
      const resetTimer = { round: 0, timeRemaining: settings.playDuration * 60, isActive: false, phase: 'play', startedAt: null };
      
      setPlayers(resetPlayers);
      playersRef.current = resetPlayers;
      setCourts(resetCourts);
      courtsRef.current = resetCourts;
      setHistory([]);
      historyRef.current = [];
      setTimer(resetTimer);
      timerRef.current = resetTimer;
      
      syncState(resetPlayers, resetCourts, resetTimer, [], settings);
      speak("Session reset complete.");
    }
  };

  const handleClearStatsOnly = () => {
    if (auth.role !== 'organizer') return;
    if (confirm(t.clearStatsConfirm)) {
      const resetPlayers = players.map(p => ({
        ...p,
        gamesPlayed: 0,
        waitRounds: 0,
        lastPlayedRound: -1,
        partners: [],
        opponents: [],
        playTime: 0,
        waitTime: 0,
        lastStatusChange: Date.now()
      }));
      
      setPlayers(resetPlayers);
      playersRef.current = resetPlayers;
      setHistory([]);
      historyRef.current = [];
      
      syncState(resetPlayers, courts, timer, [], settings);
      speak("Statistics cleared.");
    }
  };

  const handleUpdateSettings = (updatedFields) => {
    if (auth.role !== 'organizer') return;
    const updatedSettings = { ...settings, ...updatedFields };
    setSettings(updatedSettings);
    
    // Reset timer countdown if duration changes and timer hasn't started yet
    let updatedTimer = { ...timer };
    if (updatedFields.playDuration && !timer.isActive) {
      const isTimerInProgress = timer.timeRemaining > 0 && timer.timeRemaining < 120 * 60;
      if (!isTimerInProgress) {
        updatedTimer.timeRemaining = updatedFields.playDuration * 60;
        setTimer(updatedTimer);
      }
    }

    syncState(players, courts, updatedTimer, history, updatedSettings);
  };

  const handleToggleVoice = () => {
    const updated = { ...settings, voiceEnabled: !settings.voiceEnabled };
    setSettings(updated);
    if (!isFirebaseConnected) {
      localStorage.setItem('badminton_offline_state', JSON.stringify({ players, courts, timer, history, settings: updated }));
    }
  };

  const handleTestVoice = () => {
    endSoundRef.current.play().catch(() => {});
    setTimeout(() => {
      speak("Attention. Voice announcements are active.");
    }, 500);
  };

  const handleLogWinner = (courtId, winningSide) => {
    const updatedCourts = courts.map(c => {
      if (c.courtId === courtId) {
        const nextWinner = c.winner === winningSide ? null : winningSide;
        
        // Write update directly to specific court winner path in Firebase if connected
        if (isFirebaseConnected && firebaseDbRef.current) {
          const courtIdx = courts.findIndex(x => x.courtId === courtId);
          if (courtIdx !== -1) {
            set(ref(firebaseDbRef.current, `session_state/courts/${courtIdx}/winner`), nextWinner)
              .catch(err => {
                console.error("Firebase winner log failed:", err);
                setIsFirebaseConnected(false);
              });
          }
        }
        
        return { ...c, winner: nextWinner };
      }
      return c;
    });
    setCourts(updatedCourts);
    
    // Sync the winner update to the database (Firebase or Vercel Redis fallback) immediately
    syncState(players, updatedCourts, timer, history, settings);

    // Schedule auto-rotation on the client that logged the winner
    const targetCourt = updatedCourts.find(c => c.courtId === courtId);
    if (targetCourt) {
      const { a1, a2, b1, b2 } = targetCourt.players;
      const isFull = !!(a1 && a2 && b1 && b2);
      const hasWinner = targetCourt.winner === 'left' || targetCourt.winner === 'right';

      if (isFull && hasWinner) {
        setTimeout(() => {
          // Double check under current local state that the court still has a winner
          // to prevent double execution if the winner was cleared or changed in the meantime
          const freshCourt = courtsRef.current.find(c => c.courtId === courtId);
          if (freshCourt && freshCourt.players.a1 && freshCourt.players.a2 && freshCourt.players.b1 && freshCourt.players.b2 && (freshCourt.winner === 'left' || freshCourt.winner === 'right')) {
            handleRotateCourt(courtId);
          }
        }, 2000);
      }
    }
  };

  const handleClearCourt = (courtId) => {
    if (auth.role !== 'organizer') return;
    
    const targetCourt = courts.find(c => c.courtId === courtId);
    if (!targetCourt) return;

    const clearedPlayerIds = [];
    for (let slot in targetCourt.players) {
      if (targetCourt.players[slot]) clearedPlayerIds.push(targetCourt.players[slot].id);
    }

    const { isScheduledActive } = getScheduledTimerState();
    const isTimerRunning = timer.isActive || isScheduledActive;
    const updatedPlayers = players.map(p => {
      if (clearedPlayerIds.includes(p.id)) {
        let playTime = p.playTime || 0;
        let waitTime = p.waitTime || 0;
        const lastStatusChange = p.lastStatusChange || Date.now();
        if (isTimerRunning && lastStatusChange) {
          const elapsed = Math.floor((Date.now() - lastStatusChange) / 1000);
          if (p.status === 'playing') playTime += elapsed;
          if (p.status === 'waiting') waitTime += elapsed;
        }
        return { 
          ...p, 
          status: 'waiting', 
          waitRounds: 0,
          playTime,
          waitTime,
          lastStatusChange: Date.now()
        };
      }
      return p;
    });

    const updatedCourts = courts.map(c => {
      if (c.courtId === courtId) {
        return { ...c, players: { a1: null, a2: null, b1: null, b2: null }, winner: null };
      }
      return c;
    });

    setPlayers(updatedPlayers);
    setCourts(updatedCourts);
    syncState(updatedPlayers, updatedCourts, timer, history, settings);
  };

  const handleAutoFillCourt = (courtId) => {
    if (auth.role !== 'organizer') return;

    const { isScheduledActive } = getScheduledTimerState();
    const isTimerRunning = isScheduledActive || timer.isActive;
    if (!isTimerRunning) {
      alert(lang === 'es' ? "El temporizador de la sesión no está en ejecución. Solo puede auto-llenar canchas cuando el temporizador esté activo." : "The session timer is not running. You can only auto-fill courts when the timer is active.");
      return;
    }
    const c = courts.find(x => x.courtId === courtId);
    if (!c) return;

    const emptySlots = [];
    for (let slot in c.players) {
      if (!c.players[slot]) emptySlots.push(slot);
    }
    if (emptySlots.length === 0) return;

    let queue = players.filter(p => p.status === 'waiting');
    if (queue.length === 0) return;

    queue.forEach(p => {
      p._priorityScore = (p.gamesPlayed * 1000) - (p.waitRounds * 50);
    });
    queue.sort((a, b) => a._priorityScore - b._priorityScore);

    const currentCourtPlayers = { ...c.players };
    const toPlace = [];
    for (const slotId of emptySlots) {
      let foundIdx = -1;
      
      // Pass 1: Try strict constraints
      for (let i = 0; i < queue.length; i++) {
        if (isPlayerEligibleForSlot(queue[i], courtId, slotId, currentCourtPlayers, false, queue)) {
          foundIdx = i;
          break;
        }
      }
      
      // Pass 2: Try relaxed constraints
      if (foundIdx === -1) {
        for (let i = 0; i < queue.length; i++) {
          if (isPlayerEligibleForSlot(queue[i], courtId, slotId, currentCourtPlayers, true, queue)) {
            foundIdx = i;
            break;
          }
        }
      }

      if (foundIdx !== -1) {
        const p = queue[foundIdx];
        toPlace.push(p);
        currentCourtPlayers[slotId] = p;
        queue.splice(foundIdx, 1);
      }
    }

    const placeIds = toPlace.map(x => x.id);

    const updatedPlayers = players.map(p => {
      if (placeIds.includes(p.id)) {
        let playTime = p.playTime || 0;
        let waitTime = p.waitTime || 0;
        const lastStatusChange = p.lastStatusChange || Date.now();
        if (isTimerRunning && lastStatusChange) {
          const elapsed = Math.floor((Date.now() - lastStatusChange) / 1000);
          if (p.status === 'playing') playTime += elapsed;
          if (p.status === 'waiting') waitTime += elapsed;
        }
        return { 
          ...p, 
          status: 'playing',
          playTime,
          waitTime,
          lastStatusChange: Date.now()
        };
      }
      return p;
    });

    const updatedCourts = courts.map(ct => {
      if (ct.courtId === courtId) {
        const nextGamesOnCourt = { ...(ct.gamesOnCourt || { a1: 0, a2: 0, b1: 0, b2: 0 }) };
        emptySlots.forEach(slot => {
          nextGamesOnCourt[slot] = 0;
        });
        return { ...ct, players: currentCourtPlayers, gamesOnCourt: nextGamesOnCourt };
      }
      return ct;
    });

    setPlayers(updatedPlayers);
    setCourts(updatedCourts);
    syncState(updatedPlayers, updatedCourts, timer, history, settings);
  };

  const handleRotateCourt = useCallback((courtId) => {
    const { isScheduledActive } = getScheduledTimerState();
    const isTimerRunning = isScheduledActive || timer.isActive;
    if (!isTimerRunning) {
      alert(lang === 'es' ? "El temporizador de la sesión no está en ejecución. Solo puede rotar canchas cuando el temporizador esté activo." : "The session timer is not running. You can only rotate courts when the timer is active.");
      return;
    }

    const targetCourt = courtsRef.current.find(c => c.courtId === courtId);
    if (!targetCourt) return;

    const cp = targetCourt.players;
    const currentGamesOnCourt = { ...(targetCourt.gamesOnCourt || { a1: 0, a2: 0, b1: 0, b2: 0 }) };

    // Increment game counts for anyone currently on the court
    for (let s in cp) {
      if (cp[s]) {
        currentGamesOnCourt[s] = (currentGamesOnCourt[s] || 0) + 1;
      } else {
        currentGamesOnCourt[s] = 0;
      }
    }

    // Determine slots to clear based on the rotation strategy
    const slotsToClear = [];
    if (settingsRef.current.rotationStrategy === 'staggered-2-in-2-out') {
      // Stagger Bootstrap: if all active slots are exactly at 1 game, rotate out 2 players early
      const isBootstrap = Object.values(cp).every(Boolean) && Object.values(currentGamesOnCourt).every(val => val === 1);
      if (isBootstrap) {
        slotsToClear.push('a1', 'a2');
      } else {
        for (let s in currentGamesOnCourt) {
          if (currentGamesOnCourt[s] >= 2) {
            slotsToClear.push(s);
          }
        }
      }
    } else {
      // Default: Rotate everyone
      slotsToClear.push('a1', 'b1', 'a2', 'b2');
    }

    const rotatingPlayerIds = [];
    slotsToClear.forEach(s => {
      if (cp[s]) rotatingPlayerIds.push(cp[s].id);
    });

    // 1. Log histories of current matches
    const newLogs = [];
    if (cp.a1 && cp.a2 && cp.b1 && cp.b2) {
      let winnerText = "No score logged";
      if (targetCourt.winner === 'left') {
        winnerText = `${cp.a1.name} & ${cp.a2.name} won`;
      } else if (targetCourt.winner === 'right') {
        winnerText = `${cp.b1.name} & ${cp.b2.name} won`;
      }

      newLogs.unshift({
        round: timer.round,
        courtId: courtId,
        players: {
          sideA: [cp.a1.name, cp.a2.name],
          sideB: [cp.b1.name, cp.b2.name]
        },
        winner: targetCourt.winner,
        winnerText: winnerText,
        mode: settings.rotationMode,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }

    // 2. Increment stats for players rotating out of this court
    let copyPlayers = playersRef.current.map(p => {
      if (rotatingPlayerIds.includes(p.id)) {
        let mySlot = null;
        for (let s in cp) {
          if (cp[s] && cp[s].id === p.id) {
            mySlot = s;
            break;
          }
        }

        const mySide = (mySlot === 'a1' || mySlot === 'a2') ? 'A' : 'B';
        const partner = (mySide === 'A')
          ? (mySlot === 'a1' ? cp.a2 : cp.a1)
          : (mySlot === 'b1' ? cp.b2 : cp.b1);
        const opps = (mySide === 'A') 
          ? [cp.b1, cp.b2]
          : [cp.a1, cp.a2];

        const nextPartners = [...(p.partners || [])];
        const nextOpponents = [...(p.opponents || [])];

        if (partner && !nextPartners.includes(partner.id)) nextPartners.push(partner.id);
        opps.forEach(o => {
          if (o && !nextOpponents.includes(o.id)) nextOpponents.push(o.id);
        });

        let playTime = p.playTime || 0;
        let waitTime = p.waitTime || 0;
        const lastStatusChange = p.lastStatusChange || Date.now();
        if (isTimerRunning && lastStatusChange) {
          const elapsed = Math.floor((Date.now() - lastStatusChange) / 1000);
          if (p.status === 'playing') playTime += elapsed;
          if (p.status === 'waiting') waitTime += elapsed;
        }

        return {
          ...p,
          gamesPlayed: p.gamesPlayed + 1,
          lastPlayedRound: timer.round,
          status: 'waiting',
          waitRounds: 0,
          partners: nextPartners,
          opponents: nextOpponents,
          playTime,
          waitTime,
          lastStatusChange: Date.now()
        };
      }
      return p;
    });

    // 3. Setup temporary local courts state with staying players
    const currentCourtPlayers = {};
    const nextGamesOnCourt = { ...currentGamesOnCourt };
    const slotKeys = ['a1', 'b1', 'a2', 'b2'];
    for (let s of slotKeys) {
      if (slotsToClear.includes(s)) {
        currentCourtPlayers[s] = null;
        nextGamesOnCourt[s] = 0;
      } else {
        currentCourtPlayers[s] = cp[s];
      }
    }

    let nextCourts = courtsRef.current.map(c => {
      if (c.courtId === courtId) {
        return {
          ...c,
          players: currentCourtPlayers,
          gamesOnCourt: nextGamesOnCourt,
          winner: null
        };
      }
      return c;
    });

    // 4. Find and sort the waiting queue to select players to put on this court.
    let waiting = copyPlayers.filter(p => p.status === 'waiting');
    
    waiting.forEach(p => {
      p._priorityScore = (p.gamesPlayed * 1000) - (p.waitRounds * 50) + (p.lastPlayedRound * 5);
    });
    waiting.sort((a, b) => a._priorityScore - b._priorityScore);

    const toPlace = [];

    // Pass 1: Try strict constraints
    for (const slotId of slotKeys) {
      if (currentCourtPlayers[slotId]) continue; // Skip staying players
      let foundIdx = -1;
      for (let i = 0; i < waiting.length; i++) {
        const p = waiting[i];
        if (isPlayerEligibleForSlot(p, courtId, slotId, currentCourtPlayers, false, waiting)) {
          foundIdx = i;
          break;
        }
      }
      if (foundIdx !== -1) {
        const p = waiting[foundIdx];
        toPlace.push(p);
        currentCourtPlayers[slotId] = p;
        waiting.splice(foundIdx, 1);
      }
    }

    // Pass 2: Try relaxed constraints
    for (const slotId of slotKeys) {
      if (currentCourtPlayers[slotId]) continue; // Skip staying players
      let foundIdx = -1;
      for (let i = 0; i < waiting.length; i++) {
        const p = waiting[i];
        if (isPlayerEligibleForSlot(p, courtId, slotId, currentCourtPlayers, true, waiting)) {
          foundIdx = i;
          break;
        }
      }
      if (foundIdx !== -1) {
        const p = waiting[foundIdx];
        toPlace.push(p);
        currentCourtPlayers[slotId] = p;
        waiting.splice(foundIdx, 1);
      }
    }

    // Sort toPlace to ensure Beginners are split into opposite teams if 4 players are selected
    if (toPlace.length === 4) {
      const skillWeights = { 'Pro': 4, 'Advanced': 3, 'Intermediate': 2, 'Beginner': 1 };
      toPlace.sort((a, b) => skillWeights[b.skill] - skillWeights[a.skill]);
      currentCourtPlayers.a1 = toPlace[0] || null;
      currentCourtPlayers.b1 = toPlace[1] || null;
      currentCourtPlayers.a2 = toPlace[2] || null;
      currentCourtPlayers.b2 = toPlace[3] || null;
    }
    const placeIds = toPlace.map(x => x.id);

    // 5. Update status of the new players to 'playing'
    // And for players who are still waiting (were not selected AND did not just rotate out), increment waitRounds!
    const { isScheduledActive: isaRotate } = getScheduledTimerState();
    const isTimerRunningRotate = timer.isActive || isaRotate;
    copyPlayers = copyPlayers.map(p => {
      if (placeIds.includes(p.id)) {
        let playTime = p.playTime || 0;
        let waitTime = p.waitTime || 0;
        const lastStatusChange = p.lastStatusChange || Date.now();
        if (isTimerRunningRotate && lastStatusChange) {
          const elapsed = Math.floor((Date.now() - lastStatusChange) / 1000);
          if (p.status === 'playing') playTime += elapsed;
          if (p.status === 'waiting') waitTime += elapsed;
        }
        return { 
          ...p, 
          status: 'playing',
          playTime,
          waitTime,
          lastStatusChange: Date.now()
        };
      } else if (p.status === 'waiting' && !rotatingPlayerIds.includes(p.id)) {
        return { ...p, waitRounds: p.waitRounds + 1 };
      }
      return p;
    });

    // 6. Place them in the court slots
    nextCourts = nextCourts.map(c => {
      if (c.courtId === courtId) {
        return {
          ...c,
          players: currentCourtPlayers
        };
      }
      return c;
    });

    const updatedHistory = [...newLogs, ...historyRef.current];

    setPlayers(copyPlayers);
    setCourts(nextCourts);
    setHistory(updatedHistory);

    syncState(copyPlayers, nextCourts, timerRef.current, updatedHistory, settingsRef.current);

    const loadedNames = toPlace.map(p => p.name).join(', ');
    speak(`Court ${courtId} rotated. Loaded ${loadedNames || 'no one'}.`);
  }, [auth.role, history, timer, syncState, settings, speak]);



  // Monitor and adjust court assignments based on active player capacity and timer state
  useEffect(() => {
    if (!mounted) return;
    // Only the organizer client manages the automatic scaling and court fills
    if (auth.role !== 'organizer') return;

    // Calculate active player pool (players that are not resting)
    const activePool = players.filter(p => p.status !== 'resting');
    const totalCheckedIn = activePool.length;

    const { isScheduledActive } = getScheduledTimerState();
    const isTimerRunning = isScheduledActive || timer.isActive;

    let allowedCount = 0;
    if (isTimerRunning) {
      if (totalCheckedIn >= 12) allowedCount = 3;
      else if (totalCheckedIn >= 8) allowedCount = 2;
      else if (totalCheckedIn >= 4) allowedCount = 1;
    }

    const activeCourtsList = getActiveCourtsForPool(activePool, allowedCount);

    // 1. Clear any court that is currently inactive
    let nextCourts = [...courts];
    let nextPlayers = [...players];
    let stateChanged = false;

    nextCourts = courts.map(c => {
      if (!activeCourtsList.includes(c.courtId)) {
        const hasPlayers = Object.values(c.players).some(Boolean);
        if (hasPlayers) {
          stateChanged = true;
          // Send players on this deactivated court back to queue
          const idsToClear = Object.values(c.players).filter(Boolean).map(p => p.id);
          const { isScheduledActive: isaCap } = getScheduledTimerState();
          const isTimerRunningCap = timer.isActive || isaCap;
          nextPlayers = nextPlayers.map(p => {
            if (idsToClear.includes(p.id)) {
              let playTime = p.playTime || 0;
              let waitTime = p.waitTime || 0;
              const lastStatusChange = p.lastStatusChange || Date.now();
              if (isTimerRunningCap && lastStatusChange) {
                const elapsed = Math.floor((Date.now() - lastStatusChange) / 1000);
                if (p.status === 'playing') playTime += elapsed;
                if (p.status === 'waiting') waitTime += elapsed;
              }
              return { 
                ...p, 
                status: 'waiting', 
                waitRounds: 0,
                playTime,
                waitTime,
                lastStatusChange: Date.now()
              };
            }
            return p;
          });
          return { ...c, players: { a1: null, a2: null, b1: null, b2: null }, winner: null };
        }
      }
      return c;
    });

    if (stateChanged) {
      setPlayers(nextPlayers);
      setCourts(nextCourts);
      syncState(nextPlayers, nextCourts, timer, history, settings);
      speak("Adjusted active courts based on checked-in players count.");
      return; // return to let the state update propagate
    }

    // 2. Auto-populate empty active courts if timer is active
    if (isTimerRunning && activeCourtsList.length > 0) {
      const emptyActiveCourts = nextCourts.filter(c => {
        if (!activeCourtsList.includes(c.courtId)) return false;
        const pCount = Object.values(c.players).filter(Boolean).length;
        return pCount === 0;
      });

      if (emptyActiveCourts.length > 0) {
        const waiting = nextPlayers.filter(p => p.status === 'waiting');
        if (waiting.length > 0) {
          // Process courts in order of appearance
          for (let ec of emptyActiveCourts) {
            const courtId = ec.courtId;
            let eligible = waiting;
            if (courtId === 1) {
              eligible = eligible.filter(p => p.skill !== 'Beginner');
            } else if (courtId === 3) {
              eligible = eligible.filter(p => p.skill !== 'Pro');
            }

            // Only fill if we have at least 4 eligible waiting players to form a match
            if (eligible.length >= 4) {
              handleRotateCourt(courtId);
              break; // Do one at a time to allow react state updates to propagate
            }
          }
        }
      }
    }
  }, [mounted, auth.role, timer.isActive, players, courts, getActiveCourtsForPool, handleRotateCourt, syncState, history, settings]);

  const handleAddPlayer = (name, skill, phone) => {
    if (players.some(p => p.name.toLowerCase() === name.trim().toLowerCase())) {
      alert("A player with this name already exists.");
      return;
    }
    if (players.some(p => p.phone === phone.trim())) {
      alert("A player with this mobile number already exists.");
      return;
    }

    const newP = {
      id: 'player_' + Date.now(),
      name: name.trim(),
      skill: skill,
      phone: phone.trim(),
      status: 'waiting',
      gamesPlayed: 0,
      waitRounds: 0,
      lastPlayedRound: -1,
      partners: [],
      opponents: [],
      loginTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      playTime: 0,
      waitTime: 0,
      lastStatusChange: Date.now()
    };

    const updatedPlayers = [...players, newP];
    setPlayers(updatedPlayers);
    syncState(updatedPlayers, courts, timer, history, settings);
    speak(`${name} added.`);
  };

  const handleToggleRest = (playerId) => {
    // A player can only toggle their own rest, or admin toggles
    const isCurrentUser = auth.player?.id === playerId;
    if (auth.role !== 'organizer' && !isCurrentUser) return;

    const player = players.find(p => p.id === playerId);
    if (!player) return;

    let updatedCourts = [...courts];
    if (player.status === 'playing') {
      // Remove from courts
      updatedCourts = courts.map(c => {
        const copy = { ...c.players };
        let modified = false;
        for (let s in copy) {
          if (copy[s] && copy[s].id === playerId) {
            copy[s] = null;
            modified = true;
          }
        }
        return modified ? { ...c, players: copy } : c;
      });
    }

    const { isScheduledActive: isaRest } = getScheduledTimerState();
    const isTimerRunningRest = timer.isActive || isaRest;
    const updatedPlayers = players.map(p => {
      if (p.id === playerId) {
        const nextStatus = p.status === 'resting' ? 'waiting' : 'resting';
        let playTime = p.playTime || 0;
        let waitTime = p.waitTime || 0;
        const lastStatusChange = p.lastStatusChange || Date.now();
        if (isTimerRunningRest && lastStatusChange) {
          const elapsed = Math.floor((Date.now() - lastStatusChange) / 1000);
          if (p.status === 'playing') playTime += elapsed;
          if (p.status === 'waiting') waitTime += elapsed;
        }
        return { 
          ...p, 
          status: nextStatus, 
          waitRounds: 0,
          playTime,
          waitTime,
          lastStatusChange: Date.now()
        };
      }
      return p;
    });

    setPlayers(updatedPlayers);
    setCourts(updatedCourts);
    syncState(updatedPlayers, updatedCourts, timer, history, settings);
  };

  const handleRemovePlayer = (playerId) => {
    if (auth.role !== 'organizer') return;
    
    // Clear court if player is on court
    const updatedCourts = courts.map(c => {
      const copy = { ...c.players };
      let modified = false;
      for (let s in copy) {
        if (copy[s] && copy[s].id === playerId) {
          copy[s] = null;
          modified = true;
        }
      }
      return modified ? { ...c, players: copy } : c;
    });

    const updatedPlayers = players.filter(p => p.id !== playerId);
    
    setPlayers(updatedPlayers);
    setCourts(updatedCourts);
    syncState(updatedPlayers, updatedCourts, timer, history, settings);
  };

  const handleDropPlayer = (playerId, courtId, slotId) => {
    if (auth.role !== 'organizer') return;

    const { isScheduledActive } = getScheduledTimerState();
    const isTimerRunning = isScheduledActive || timer.isActive;
    if (!isTimerRunning) {
      alert(lang === 'es' ? "El temporizador de la sesión no está en ejecución. Solo puede asignar jugadores cuando el temporizador esté activo." : "The session timer is not running. You can only assign players to courts when the timer is active.");
      return;
    }

    const player = players.find(p => p.id === playerId);
    if (!player) return;

    // Apply strict court eligibility constraints for manual assignments
    if (courtId === 1 && player.skill === 'Beginner') {
      alert("Constraint Violation: Beginners can only play in Court 2 or Court 3!");
      return;
    }
    if (courtId === 3 && player.skill === 'Pro') {
      const hasAccompanying = players.some(p => p.status === 'waiting' && (p.skill === 'Intermediate' || p.skill === 'Advanced'));
      if (hasAccompanying) {
        alert("Constraint Violation: Pro players can only play in Court 1 or 2!");
        return;
      }
    }

    // Validate Max 2 Pros on Court 1 or Court 2
    if ((courtId === 1 || courtId === 2) && player.skill === 'Pro') {
      const targetCourt = courts.find(c => c.courtId === courtId);
      if (targetCourt) {
        let currentProsCount = 0;
        for (let slot in targetCourt.players) {
          const slotPlayer = targetCourt.players[slot];
          if (slotPlayer && slotPlayer.skill === 'Pro') {
            if (slot !== slotId && slotPlayer.id !== playerId) {
              currentProsCount++;
            }
          }
        }
        if (currentProsCount >= 2) {
          alert("Constraint Violation: Court 1 and Court 2 can have at most 2 Pro players!");
          return;
        }
      }
    }

    // Validate Max 2 Beginners on Court 2 or Court 3
    if ((courtId === 2 || courtId === 3) && player.skill === 'Beginner') {
      const targetCourt = courts.find(c => c.courtId === courtId);
      if (targetCourt) {
        let currentBegCount = 0;
        for (let slot in targetCourt.players) {
          const slotPlayer = targetCourt.players[slot];
          if (slotPlayer && slotPlayer.skill === 'Beginner') {
            if (slot !== slotId && slotPlayer.id !== playerId) {
              currentBegCount++;
            }
          }
        }
        if (currentBegCount >= 2) {
          const hasOtherLevels = players.some(pl => pl.status === 'waiting' && pl.skill !== 'Beginner');
          if (hasOtherLevels) {
            alert(`Constraint Violation: Court ${courtId} can have at most 2 Beginner players!`);
            return;
          }
        }
      }
    }

    // Validate No 2 Beginners Together (Partner constraint) on Court 2 and Court 3
    if ((courtId === 2 || courtId === 3) && player.skill === 'Beginner') {
      const targetCourt = courts.find(c => c.courtId === courtId);
      if (targetCourt) {
        const getPartnerSlot = (slot) => {
          if (slot === 'a1') return 'a2';
          if (slot === 'a2') return 'a1';
          if (slot === 'b1') return 'b2';
          if (slot === 'b2') return 'b1';
          return null;
        };
        const partnerSlot = getPartnerSlot(slotId);
        const partner = targetCourt.players[partnerSlot];
        if (partner && partner.skill === 'Beginner' && partner.id !== playerId) {
          const hasOtherLevels = players.some(pl => pl.status === 'waiting' && pl.skill !== 'Beginner');
          if (hasOtherLevels) {
            alert("Constraint Violation: No 2 Beginners can play together in a team!");
            return;
          }
        }
      }
    }

    // 1. Remove player from any current court
    let cleanedCourts = courts.map(c => {
      const copy = { ...c.players };
      const nextGamesOnCourt = { ...(c.gamesOnCourt || { a1: 0, a2: 0, b1: 0, b2: 0 }) };
      let changed = false;
      for (let s in copy) {
        if (copy[s] && copy[s].id === playerId) {
          copy[s] = null;
          nextGamesOnCourt[s] = 0;
          changed = true;
        }
      }
      return changed ? { ...c, players: copy, gamesOnCourt: nextGamesOnCourt } : c;
    });

    // 2. Identify player currently in slot to send back to queue
    let displacedPlayerId = null;
    const targetCourt = cleanedCourts.find(c => c.courtId === courtId);
    if (targetCourt && targetCourt.players[slotId]) {
      displacedPlayerId = targetCourt.players[slotId].id;
    }

    // 3. Put player in slot
    const updatedCourts = cleanedCourts.map(c => {
      if (c.courtId === courtId) {
        const copy = { ...c.players };
        copy[slotId] = player;
        const nextGamesOnCourt = { ...(c.gamesOnCourt || { a1: 0, a2: 0, b1: 0, b2: 0 }) };
        nextGamesOnCourt[slotId] = 0;
        return { ...c, players: copy, gamesOnCourt: nextGamesOnCourt };
      }
      return c;
    });

    // 4. Update player status
    const { isScheduledActive: isaDrop } = getScheduledTimerState();
    const isTimerRunningDrop = timer.isActive || isaDrop;
    const updatedPlayers = players.map(p => {
      if (p.id === playerId) {
        let playTime = p.playTime || 0;
        let waitTime = p.waitTime || 0;
        const lastStatusChange = p.lastStatusChange || Date.now();
        if (isTimerRunningDrop && lastStatusChange) {
          const elapsed = Math.floor((Date.now() - lastStatusChange) / 1000);
          if (p.status === 'playing') playTime += elapsed;
          if (p.status === 'waiting') waitTime += elapsed;
        }
        return { 
          ...p, 
          status: 'playing',
          playTime,
          waitTime,
          lastStatusChange: Date.now()
        };
      }
      if (p.id === displacedPlayerId) {
        let playTime = p.playTime || 0;
        let waitTime = p.waitTime || 0;
        const lastStatusChange = p.lastStatusChange || Date.now();
        if (isTimerRunningDrop && lastStatusChange) {
          const elapsed = Math.floor((Date.now() - lastStatusChange) / 1000);
          if (p.status === 'playing') playTime += elapsed;
          if (p.status === 'waiting') waitTime += elapsed;
        }
        return { 
          ...p, 
          status: 'waiting', 
          waitRounds: 0,
          playTime,
          waitTime,
          lastStatusChange: Date.now()
        };
      }
      return p;
    });

    setPlayers(updatedPlayers);
    setCourts(updatedCourts);
    syncState(updatedPlayers, updatedCourts, timer, history, settings);
    speak(`${player.name} moved to court ${courtId}.`);
  };



  const handleClearAll = () => {
    if (auth.role !== 'organizer') return;
    if (confirm("Remove all players from this session?")) {
      const resetCourts = courts.map(c => ({
        ...c,
        players: { a1: null, a2: null, b1: null, b2: null },
        gamesOnCourt: { a1: 0, a2: 0, b1: 0, b2: 0 },
        winner: null
      }));
      const resetTimer = { round: 0, timeRemaining: settings.playDuration * 60, isActive: false, phase: 'play', startedAt: null };
      
      setPlayers([]);
      playersRef.current = [];
      setCourts(resetCourts);
      courtsRef.current = resetCourts;
      setHistory([]);
      historyRef.current = [];
      setTimer(resetTimer);
      timerRef.current = resetTimer;

      syncState([], resetCourts, resetTimer, [], settings);
      speak("Cleared all players.");
    }
  };

  const handleLoadPlayers = () => {
    if (auth.role !== 'organizer') return;
    if (confirm("Load all 27 club players? This will reset active players to the club list.")) {
      const loadedPlayers = REAL_WORLD_PLAYERS.map(p => ({
        ...p,
        gamesPlayed: 0,
        waitRounds: 0,
        lastPlayedRound: -1,
        status: 'waiting',
        partners: [],
        opponents: [],
        playTime: 0,
        waitTime: 0,
        lastStatusChange: Date.now(),
        loginTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }));
      
      const resetCourts = courts.map(c => ({
        ...c,
        players: { a1: null, a2: null, b1: null, b2: null },
        gamesOnCourt: { a1: 0, a2: 0, b1: 0, b2: 0 },
        winner: null
      }));
      
      const resetTimer = { round: 0, timeRemaining: settings.playDuration * 60, isActive: false, phase: 'play', startedAt: null };

      setPlayers(loadedPlayers);
      playersRef.current = loadedPlayers;
      setCourts(resetCourts);
      courtsRef.current = resetCourts;
      setHistory([]);
      historyRef.current = [];
      setTimer(resetTimer);
      timerRef.current = resetTimer;

      syncState(loadedPlayers, resetCourts, resetTimer, [], settings);
      speak("Loaded all 27 club players.");
    }
  };

  const handleUpdateFirebaseConfig = (configStr) => {
    if (auth.role !== 'organizer') return;
    if (!configStr.trim()) {
      localStorage.removeItem('badminton_firebase_config');
      setFirebaseConfigText('');
      setIsFirebaseConnected(false);
      alert("Firebase connection cleared. App running in offline local mode.");
      return;
    }

    try {
      const parsed = JSON.parse(configStr);
      if (!parsed.apiKey || !parsed.databaseURL) {
        alert("Invalid Firebase config. Missing apiKey or databaseURL");
        return;
      }
      localStorage.setItem('badminton_firebase_config', configStr);
      setFirebaseConfigText(configStr);
      alert("Firebase credentials saved. Restarting connections...");
    } catch (e) {
      alert("Could not parse JSON configuration block. Double check keys and commas.");
    }
  };

  // --- ROTATION ALGORITHMS ---

  function handleForceRotate() {
    if (auth.role !== 'organizer') return;
    
    const { isScheduledActive } = getScheduledTimerState();
    const isTimerRunning = isScheduledActive || timer.isActive;
    if (!isTimerRunning) {
      alert(lang === 'es' ? "El temporizador de la sesión no está en ejecución. Solo puede realizar la rotación cuando el temporizador esté activo." : "The session timer is not running. You can only perform rotation when the timer is active.");
      return;
    }

    // Increment round count
    const nextRound = timer.round + 1;

    // Calculate active player pool and active courts based on capacity rules
    const activePool = players.filter(p => p.status !== 'resting');
    const totalCheckedIn = activePool.length;

    let allowedCount = 0;
    if (totalCheckedIn >= 12) allowedCount = 3;
    else if (totalCheckedIn >= 8) allowedCount = 2;
    else if (totalCheckedIn >= 4) allowedCount = 1;

    const activeCourtsList = getActiveCourtsForPool(activePool, allowedCount);

    // 1. Log histories of current matches
    const newLogs = [];
    const updatedCourts = courts.map(court => {
      const cp = court.players || {};
      if (cp.a1 && cp.a2 && cp.b1 && cp.b2) {
        let winnerText = "No score logged";
        if (court.winner === 'left') {
          winnerText = `${cp.a1.name} & ${cp.a2.name} won`;
        } else if (court.winner === 'right') {
          winnerText = `${cp.b1.name} & ${cp.b2.name} won`;
        }

        newLogs.unshift({
          round: timer.round + 1,
          courtId: court.courtId,
          players: {
            sideA: [cp.a1.name, cp.a2.name],
            sideB: [cp.b1.name, cp.b2.name]
          },
          winner: court.winner,
          winnerText: winnerText,
          mode: settings.rotationMode,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      }
      return court;
    });

    const updatedHistory = [...newLogs, ...history];
    setHistory(updatedHistory);

    // 2. Increment play statistics for players on court
    let playingIds = [];
    courts.forEach(c => {
      for (let s in c.players) {
        if (c.players[s]) playingIds.push(c.players[s].id);
      }
    });

    // Temp copy of players updated metrics
    let copyPlayers = players.map(p => {
      if (playingIds.includes(p.id)) {
        // Find court details
        let myCourt = null;
        let mySlot = null;
        courts.forEach(c => {
          for (let s in c.players) {
            if (c.players[s] && c.players[s].id === p.id) {
              myCourt = c;
              mySlot = s;
            }
          }
        });

        const mySide = (mySlot === 'a1' || mySlot === 'a2') ? 'A' : 'B';
        const partner = (mySide === 'A')
          ? (mySlot === 'a1' ? myCourt.players.a2 : myCourt.players.a1)
          : (mySlot === 'b1' ? myCourt.players.b2 : myCourt.players.b1);
        const opps = (mySide === 'A') 
          ? [myCourt.players.b1, myCourt.players.b2]
          : [myCourt.players.a1, myCourt.players.a2];

        const nextPartners = [...(p.partners || [])];
        const nextOpponents = [...(p.opponents || [])];

        if (partner && !nextPartners.includes(partner.id)) nextPartners.push(partner.id);
        opps.forEach(o => {
          if (o && !nextOpponents.includes(o.id)) nextOpponents.push(o.id);
        });

        return {
          ...p,
          gamesPlayed: p.gamesPlayed + 1,
          lastPlayedRound: nextRound,
          status: 'waiting',
          waitRounds: 0,
          partners: nextPartners,
          opponents: nextOpponents
        };
      } else if (p.status === 'waiting') {
        return { ...p, waitRounds: p.waitRounds + 1 };
      }
      return p;
    });

    // 3. Execute scheduling rotations based on Mode
    let nextCourts = courts.map(c => ({
      ...c,
      players: { a1: null, a2: null, b1: null, b2: null },
      gamesOnCourt: { a1: 0, a2: 0, b1: 0, b2: 0 },
      winner: null
    }));

    if (settings.rotationMode === 'smart-rotation') {
      // --- SMART ROTATION SCHEDULE WITH SKILL CONSTRAINTS ---
      let waiting = copyPlayers.filter(p => p.status === 'waiting');
      
      waiting.forEach(p => {
        p._priorityScore = (p.gamesPlayed * 1000) - (p.waitRounds * 50) + (p.lastPlayedRound * 5);
      });
      waiting.sort((a, b) => a._priorityScore - b._priorityScore);

      // Court 1 Assignment (non-Beginner only, max 2 Pros)
      const c1Assigns = [];
      if (activeCourtsList.includes(1)) {
        for (let i = 0; i < waiting.length; i++) {
          const p = waiting[i];
          if (p.skill === 'Beginner') continue;
          if (c1Assigns.length >= 4) continue;

          if (p.skill === 'Pro') {
            const proCount = c1Assigns.filter(x => x.skill === 'Pro').length;
            if (proCount < 2) {
              c1Assigns.push(p);
            }
          } else {
            c1Assigns.push(p);
          }
        }
      }
      let remaining = waiting.filter(p => !c1Assigns.map(x => x.id).includes(p.id));

      // Court 2 Assignment (max 2 Beginners, max 2 Pros)
      const c2Assigns = [];
      if (activeCourtsList.includes(2)) {
        let begCount = 0;
        for (let i = 0; i < remaining.length; i++) {
          const p = remaining[i];
          if (c2Assigns.length >= 4) continue;

          if (p.skill === 'Beginner') {
            if (begCount < 2) {
              c2Assigns.push(p);
              begCount++;
            }
          } else if (p.skill === 'Pro') {
            const proCount = c2Assigns.filter(x => x.skill === 'Pro').length;
            if (proCount < 2) {
              c2Assigns.push(p);
            }
          } else {
            c2Assigns.push(p);
          }
        }
      }
      remaining = remaining.filter(p => !c2Assigns.map(x => x.id).includes(p.id));

      // Court 3 Assignment (non-Pro only if there are accompanying players, max 2 Beginners)
      const c3Assigns = [];
      if (activeCourtsList.includes(3)) {
        let begCount = 0;
        const hasAccompanying = remaining.some(p => p.skill === 'Advanced' || p.skill === 'Intermediate');
        for (let i = 0; i < remaining.length; i++) {
          const p = remaining[i];
          if (p.skill === 'Pro' && hasAccompanying) continue;
          if (c3Assigns.length >= 4) continue;

          if (p.skill === 'Beginner') {
            if (begCount < 2) {
              c3Assigns.push(p);
              begCount++;
            }
          } else {
            c3Assigns.push(p);
          }
        }
      }

      const selected = [...c1Assigns, ...c2Assigns, ...c3Assigns];
      const selectedIds = selected.map(x => x.id);

      // Set status to playing
      const { isScheduledActive: isaForceSmart } = getScheduledTimerState();
      const isTimerRunningForceSmart = timer.isActive || isaForceSmart;
      copyPlayers = copyPlayers.map(p => {
        if (selectedIds.includes(p.id)) {
          let playTime = p.playTime || 0;
          let waitTime = p.waitTime || 0;
          const lastStatusChange = p.lastStatusChange || Date.now();
          if (isTimerRunningForceSmart && lastStatusChange) {
            const elapsed = Math.floor((Date.now() - lastStatusChange) / 1000);
            if (p.status === 'playing') playTime += elapsed;
            if (p.status === 'waiting') waitTime += elapsed;
          }
          return { 
            ...p, 
            status: 'playing',
            playTime,
            waitTime,
            lastStatusChange: Date.now()
          };
        }
        return p;
      });

      const applyPool = (cId, pool) => {
        const ctRef = nextCourts.find(x => x.courtId === cId);
        if (pool.length === 4) {
          const skillWeights = { 'Pro': 4, 'Advanced': 3, 'Intermediate': 2, 'Beginner': 1 };
          pool.sort((a, b) => skillWeights[b.skill] - skillWeights[a.skill]);
          ctRef.players.a1 = pool[0];
          ctRef.players.a2 = pool[3];
          ctRef.players.b1 = pool[1];
          ctRef.players.b2 = pool[2];
        } else {
          if (pool[0]) ctRef.players.a1 = pool[0];
          if (pool[1]) ctRef.players.b1 = pool[1];
          if (pool[2]) ctRef.players.a2 = pool[2];
          if (pool[3]) ctRef.players.b2 = pool[3];
        }
      };

      applyPool(1, c1Assigns);
      applyPool(2, c2Assigns);
      applyPool(3, c3Assigns);
    } else {
      // --- CHALLENGE LADDER MODE ---
      const court1 = courts.find(c => c.courtId === 1);
      const court2 = courts.find(c => c.courtId === 2);
      const court3 = courts.find(c => c.courtId === 3);

      const getPairs = (court) => {
        const p = court?.players || {};
        if (!p.a1 || !p.a2 || !p.b1 || !p.b2) return null;
        return { left: [p.a1, p.a2], right: [p.b1, p.b2] };
      };

      const c1Pairs = getPairs(court1);
      const c2Pairs = getPairs(court2);
      const c3Pairs = getPairs(court3);

      let c1W = null, c1L = null;
      let c2W = null, c2L = null;
      let c3W = null, c3L = null;

      if (c1Pairs) {
        const side = court1.winner || 'left';
        c1W = c1Pairs[side];
        c1L = c1Pairs[side === 'left' ? 'right' : 'left'];
      }
      if (c2Pairs) {
        const side = court2.winner || 'left';
        c2W = c2Pairs[side];
        c2L = c2Pairs[side === 'left' ? 'right' : 'left'];
      }
      if (c3Pairs) {
        const side = court3.winner || 'left';
        c3W = c3Pairs[side];
        c3L = c3Pairs[side === 'left' ? 'right' : 'left'];
      }

      // New assignments with strict routing constraints
      const court1Assigns = [];
      const court2Assigns = [];
      const court3Assigns = [];

      const pushEligible = (player, targetCourtId) => {
        if (!player) return;
        if (!activeCourtsList.includes(targetCourtId)) {
          return;
        }
        if (player.skill === 'Beginner') {
          if (targetCourtId === 1) {
            if (activeCourtsList.includes(2)) {
              court2Assigns.push(player); // Beginner stays in Court 2 instead of promoting to Court 1
            } else {
              court3Assigns.push(player);
            }
          } else if (targetCourtId === 2) {
            court2Assigns.push(player);
          } else {
            court3Assigns.push(player);
          }
        } else if (player.skill === 'Pro') {
          if (targetCourtId === 3) {
            if (activeCourtsList.includes(2)) {
              court2Assigns.push(player); // Pro stays in Court 2 instead of demoting to Court 3
            }
          } else {
            if (targetCourtId === 1) court1Assigns.push(player);
            else court2Assigns.push(player);
          }
        } else {
          if (targetCourtId === 1) court1Assigns.push(player);
          else if (targetCourtId === 2) court2Assigns.push(player);
          else court3Assigns.push(player);
        }
      };

      if (c1W) c1W.forEach(p => pushEligible(p, 1));
      if (c2W) c2W.forEach(p => pushEligible(p, 1));

      if (c1L) c1L.forEach(p => pushEligible(p, 2));
      if (c3W) c3W.forEach(p => pushEligible(p, 2));

      if (c2L) c2L.forEach(p => pushEligible(p, 3));
      if (c3L) c3L.forEach(p => pushEligible(p, 3));

      // Balance Pros between Court 1 and Court 2 (no Pros allowed in Court 3)
      const allAssignedPros = [
        ...court1Assigns.filter(p => p.skill === 'Pro'),
        ...court2Assigns.filter(p => p.skill === 'Pro'),
        ...court3Assigns.filter(p => p.skill === 'Pro')
      ];

      const nonProsC1 = court1Assigns.filter(p => p.skill !== 'Pro');
      const nonProsC2 = court2Assigns.filter(p => p.skill !== 'Pro');
      const nonProsC3 = court3Assigns.filter(p => p.skill !== 'Pro');

      const balancedProsC1 = [];
      const balancedProsC2 = [];
      const overflowWaitingPros = [];

      allAssignedPros.forEach(p => {
        if (balancedProsC1.length < 2) {
          balancedProsC1.push(p);
        } else if (balancedProsC2.length < 2) {
          balancedProsC2.push(p);
        } else {
          overflowWaitingPros.push(p);
        }
      });

      // Mark overflow pros as waiting
      overflowWaitingPros.forEach(p => {
        p.status = 'waiting';
      });

      const cleanC1Assigns = [...balancedProsC1, ...nonProsC1];

      // Balance Beginners between Court 3 and Court 2 (no Beginners allowed in Court 1)
      const allAssignedBeginners = [
        ...court1Assigns.filter(p => p.skill === 'Beginner'),
        ...court2Assigns.filter(p => p.skill === 'Beginner'),
        ...court3Assigns.filter(p => p.skill === 'Beginner')
      ];

      const balancedBeginnersC3 = [];
      const balancedBeginnersC2 = [];
      const overflowWaitingBeginners = [];

      allAssignedBeginners.forEach(p => {
        if (activeCourtsList.includes(3) && balancedBeginnersC3.length < 2) {
          balancedBeginnersC3.push(p);
        } else if (activeCourtsList.includes(2) && balancedBeginnersC2.length < 2) {
          balancedBeginnersC2.push(p);
        } else {
          overflowWaitingBeginners.push(p);
        }
      });

      // Mark overflow beginners as waiting
      overflowWaitingBeginners.forEach(p => {
        p.status = 'waiting';
      });

      const othersC2 = court2Assigns.filter(p => p.skill !== 'Pro' && p.skill !== 'Beginner');
      const cleanC2Assigns = [...balancedProsC2, ...balancedBeginnersC2, ...othersC2];

      const othersC3 = court3Assigns.filter(p => p.skill !== 'Pro' && p.skill !== 'Beginner');
      const cleanC3Assigns = [...balancedBeginnersC3, ...othersC3];

      // Handle any potential overflow (>4 players redirected to a court)
      const finalizeCourtAssigns = (assigns) => {
        if (assigns.length <= 4) return assigns;
        const overflow = assigns.slice(4);
        overflow.forEach(p => {
          p.status = 'waiting';
        });
        return assigns.slice(0, 4);
      };

      const finalC1 = finalizeCourtAssigns(cleanC1Assigns);
      const finalC2 = finalizeCourtAssigns(cleanC2Assigns);
      const finalC3 = finalizeCourtAssigns(cleanC3Assigns);

      // Remaining slots to pull from wait queue
      const c1ToFill = 4 - finalC1.length;
      const c2ToFill = 4 - finalC2.length;
      const c3ToFill = 4 - finalC3.length;

      // Queue pull helper (pulls from updated copyPlayers waiting list, respecting constraints)
      const pullFromQueueForCourt = (courtId, count, currentCourtPlayers) => {
        if (count <= 0) return [];
        let waiting = copyPlayers.filter(p => p.status === 'waiting');
        
        waiting.forEach(p => {
          p._priorityScore = (p.gamesPlayed * 1000) - (p.waitRounds * 50) + (p.lastPlayedRound * 5);
        });
        waiting.sort((a, b) => a._priorityScore - b._priorityScore);

        const currentCourtMap = {
          a1: currentCourtPlayers[0] || null,
          a2: currentCourtPlayers[1] || null,
          b1: currentCourtPlayers[2] || null,
          b2: currentCourtPlayers[3] || null
        };
        const emptySlots = [];
        if (!currentCourtMap.a1) emptySlots.push('a1');
        if (!currentCourtMap.b1) emptySlots.push('b1');
        if (!currentCourtMap.a2) emptySlots.push('a2');
        if (!currentCourtMap.b2) emptySlots.push('b2');

        const selected = [];

        // Pass 1: Try strict constraints
        for (const slotId of emptySlots) {
          if (selected.length >= count) break;
          let foundIdx = -1;
          for (let i = 0; i < waiting.length; i++) {
            if (isPlayerEligibleForSlot(waiting[i], courtId, slotId, currentCourtMap, false, waiting)) {
              foundIdx = i;
              break;
            }
          }
          if (foundIdx !== -1) {
            const p = waiting[foundIdx];
            selected.push(p);
            currentCourtMap[slotId] = p;
            waiting.splice(foundIdx, 1);
          }
        }

        // Pass 2: Try relaxed constraints
        for (const slotId of emptySlots) {
          if (selected.length >= count) break;
          if (currentCourtMap[slotId]) continue;
          let foundIdx = -1;
          for (let i = 0; i < waiting.length; i++) {
            if (isPlayerEligibleForSlot(waiting[i], courtId, slotId, currentCourtMap, true, waiting)) {
              foundIdx = i;
              break;
            }
          }
          if (foundIdx !== -1) {
            const p = waiting[foundIdx];
            selected.push(p);
            currentCourtMap[slotId] = p;
            waiting.splice(foundIdx, 1);
          }
        }

        const selectedIds = selected.map(x => x.id);
        const { isScheduledActive: isaPull } = getScheduledTimerState();
        const isTimerRunningPull = timer.isActive || isaPull;
        copyPlayers = copyPlayers.map(p => {
          if (selectedIds.includes(p.id)) {
            let playTime = p.playTime || 0;
            let waitTime = p.waitTime || 0;
            const lastStatusChange = p.lastStatusChange || Date.now();
            if (isTimerRunningPull && lastStatusChange) {
              const elapsed = Math.floor((Date.now() - lastStatusChange) / 1000);
              if (p.status === 'playing') playTime += elapsed;
              if (p.status === 'waiting') waitTime += elapsed;
            }
            return { 
              ...p, 
              status: 'playing',
              playTime,
              waitTime,
              lastStatusChange: Date.now()
            };
          }
          return p;
        });
        return selected;
      };

      if (activeCourtsList.includes(1) && c1ToFill > 0) finalC1.push(...pullFromQueueForCourt(1, c1ToFill, finalC1));
      if (activeCourtsList.includes(2) && c2ToFill > 0) finalC2.push(...pullFromQueueForCourt(2, c2ToFill, finalC2));
      if (activeCourtsList.includes(3) && c3ToFill > 0) finalC3.push(...pullFromQueueForCourt(3, c3ToFill, finalC3));

      // Put players in slots and update status
      const assignIds = [...finalC1, ...finalC2, ...finalC3].map(x => x.id);
      const { isScheduledActive: isaForceLadder } = getScheduledTimerState();
      const isTimerRunningForceLadder = timer.isActive || isaForceLadder;
      copyPlayers = copyPlayers.map(p => {
        if (assignIds.includes(p.id)) {
          let playTime = p.playTime || 0;
          let waitTime = p.waitTime || 0;
          const lastStatusChange = p.lastStatusChange || Date.now();
          if (isTimerRunningForceLadder && lastStatusChange) {
            const elapsed = Math.floor((Date.now() - lastStatusChange) / 1000);
            if (p.status === 'playing') playTime += elapsed;
            if (p.status === 'waiting') waitTime += elapsed;
          }
          return { 
            ...p, 
            status: 'playing',
            playTime,
            waitTime,
            lastStatusChange: Date.now()
          };
        }
        return p;
      });

      const applyToCourt = (cId, pool) => {
        if (!activeCourtsList.includes(cId)) return;
        const target = nextCourts.find(c => c.courtId === cId);
        if (pool.length === 4) {
          const skillWeights = { 'Pro': 4, 'Advanced': 3, 'Intermediate': 2, 'Beginner': 1 };
          const sortedPool = [...pool].sort((a, b) => skillWeights[b.skill] - skillWeights[a.skill]);
          target.players.a1 = sortedPool[0];
          target.players.b1 = sortedPool[1];
          target.players.a2 = sortedPool[2];
          target.players.b2 = sortedPool[3];
        } else {
          if (pool[0]) target.players.a1 = pool[0];
          if (pool[1]) target.players.a2 = pool[1];
          if (pool[2]) target.players.b1 = pool[2];
          if (pool[3]) target.players.b2 = pool[3];
        }
      };

      applyToCourt(1, finalC1);
      applyToCourt(2, finalC2);
      applyToCourt(3, finalC3);
    }

    // Reset timer
    const updatedTimer = {
      round: nextRound,
      timeRemaining: settings.playDuration * 60,
      isActive: true,
      phase: 'play'
    };

    setPlayers(copyPlayers);
    setCourts(nextCourts);
    setTimer(updatedTimer);

    syncState(copyPlayers, nextCourts, updatedTimer, updatedHistory, settings);
    speak(`Round ${nextRound} started. Good luck players!`);
  };

  // Hydration safety check
  if (!mounted) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0e17', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-muted)', fontFamily: 'sans-serif', fontSize: '1.25rem' }}>Loading Badminton Rotator...</div>
      </div>
    );
  }

  // Auth Guard
  if (!auth.role) {
    return (
      <>
        <LanguageSelector lang={lang} setLang={setLang} />
        <AuthModal players={players} settings={settings} onLogin={handleLogin} t={t} />
      </>
    );
  }

  const isAdmin = auth.role === 'organizer';

  const handleSelectPlayerForMove = (playerId) => {
    if (auth.role !== 'organizer') return;
    setSelectedPlayerForMove(prev => prev === playerId ? null : playerId);
  };

  const handleCourtSlotClick = (courtId, slotId, occupiedPlayer) => {
    if (auth.role !== 'organizer') return;

    if (selectedPlayerForMove) {
      // Place selected player into the slot
      handleDropPlayer(selectedPlayerForMove, courtId, slotId);
      setSelectedPlayerForMove(null);
    } else if (occupiedPlayer) {
      // Select the occupied player to move them elsewhere
      setSelectedPlayerForMove(occupiedPlayer.id);
    }
  };

  const { isScheduledActive, scheduledRemaining } = getScheduledTimerState();
  const isTimerRunning = isScheduledActive || timer.isActive;

  const activePool = players.filter(p => p.status !== 'resting');
  const totalCheckedIn = activePool.length;
  let allowedCount = 0;
  if (totalCheckedIn >= 12) allowedCount = 3;
  else if (totalCheckedIn >= 8) allowedCount = 2;
  else if (totalCheckedIn >= 4) allowedCount = 1;
  const activeCourtsList = getActiveCourtsForPool(activePool, allowedCount);

  // Helper to determine next up players for a court
  const getNextUpPlayersForCourt = (courtId) => {
    if (!activeCourtsList.includes(courtId)) return [];

    let waiting = players.filter(p => p.status === 'waiting');
    waiting.forEach(p => {
      p._priorityScore = (p.gamesPlayed * 1000) - (p.waitRounds * 50) + (p.lastPlayedRound * 5);
    });
    waiting.sort((a, b) => a._priorityScore - b._priorityScore);

    const toPlace = [];
    const currentCourtPlayers = { a1: null, a2: null, b1: null, b2: null };

    // If the court is occupied and rotation strategy is staggered, find staying players
    const targetCourt = courts.find(c => c.courtId === courtId);
    if (targetCourt && settings.rotationStrategy === 'staggered-2-in-2-out') {
      const cp = targetCourt.players || {};
      const games = targetCourt.gamesOnCourt || { a1: 0, a2: 0, b1: 0, b2: 0 };
      
      // Simulate incrementing game counts to see who rotates out
      const simulatedGames = {};
      for (let s in cp) {
        if (cp[s]) {
          simulatedGames[s] = (games[s] || 0) + 1;
        } else {
          simulatedGames[s] = 0;
        }
      }
      
      const isBootstrap = Object.values(cp).every(Boolean) && Object.values(simulatedGames).every(val => val === 1);
      const slotsToClear = [];
      if (isBootstrap) {
        slotsToClear.push('a1', 'a2');
      } else {
        for (let s in simulatedGames) {
          if (simulatedGames[s] >= 2) {
            slotsToClear.push(s);
          }
        }
      }
      
      for (let s in cp) {
        if (cp[s] && !slotsToClear.includes(s)) {
          currentCourtPlayers[s] = cp[s];
        }
      }
    }

    const slotKeys = ['a1', 'b1', 'a2', 'b2'];

    // Pass 1: Try strict constraints
    for (const slotId of slotKeys) {
      if (currentCourtPlayers[slotId]) continue;
      let foundIdx = -1;
      for (let i = 0; i < waiting.length; i++) {
        const p = waiting[i];
        if (isPlayerEligibleForSlot(p, courtId, slotId, currentCourtPlayers, false, waiting)) {
          foundIdx = i;
          break;
        }
      }
      if (foundIdx !== -1) {
        const p = waiting[foundIdx];
        toPlace.push(p);
        currentCourtPlayers[slotId] = p;
        waiting.splice(foundIdx, 1);
      }
    }

    // Pass 2: Try relaxed constraints
    for (const slotId of slotKeys) {
      if (currentCourtPlayers[slotId]) continue;
      let foundIdx = -1;
      for (let i = 0; i < waiting.length; i++) {
        const p = waiting[i];
        if (isPlayerEligibleForSlot(p, courtId, slotId, currentCourtPlayers, true, waiting)) {
          foundIdx = i;
          break;
        }
      }
      if (foundIdx !== -1) {
        const p = waiting[foundIdx];
        toPlace.push(p);
        currentCourtPlayers[slotId] = p;
        waiting.splice(foundIdx, 1);
      }
    }

    // If 4 players are selected, we sort toPlace by skill weight to match actual team split
    if (toPlace.length === 4) {
      const skillWeights = { 'Pro': 4, 'Advanced': 3, 'Intermediate': 2, 'Beginner': 1 };
      toPlace.sort((a, b) => skillWeights[b.skill] - skillWeights[a.skill]);
    }

    return toPlace;
  };

  const courtsWithNextUp = courts.map(c => {
    const nextUp = getNextUpPlayersForCourt(c.courtId);
    const playerCount = Object.values(c.players || {}).filter(Boolean).length;
    const isStaggered = settings.rotationStrategy === 'staggered-2-in-2-out';
    return {
      ...c,
      isActive: activeCourtsList.includes(c.courtId),
      nextUp: (isStaggered && playerCount > 0) ? nextUp.slice(0, 2) : nextUp
    };
  });

  return (
    <div className={`app-container mobile-view-${activeMobileTab}`}>
      <LanguageSelector lang={lang} setLang={setLang} />
      {/* Session Controls & Timer Header */}
      <SessionHeader
        timer={{
          ...timer,
          isActive: isTimerRunning,
          timeRemaining: timeRemainingDisplay
        }}
        settings={settings}
        isAdmin={isAdmin}
        currentUser={auth.player}
        onLogout={handleLogout}
        onToggleTimer={handleToggleTimer}
        onForceRotate={handleForceRotate}
        onResetSession={handleResetSession}
        onUpdateSettings={handleUpdateSettings}
        onToggleVoice={handleToggleVoice}
        onTestVoice={handleTestVoice}
        activePlayerCount={players.filter(p => p.status === 'playing').length}
        t={t}
      />

      {/* Main Workspace Layout */}
      <main className="app-workspace">
        {/* Left Side: Courts Display */}
        <CourtGrid
          courts={courtsWithNextUp}
          isAdmin={isAdmin}
          timer={timer}
          onLogWinner={handleLogWinner}
          onClearCourt={handleClearCourt}
          onAutoFillCourt={handleAutoFillCourt}
          onRotateCourt={handleRotateCourt}
          onDropPlayer={handleDropPlayer}
          selectedPlayerForMove={selectedPlayerForMove}
          onSlotClick={handleCourtSlotClick}
          t={t}
        />

        {/* Right Side: Waiting Queue */}
        <QueueSidebar
          players={players}
          isAdmin={isAdmin}
          currentUser={auth.player}
          settings={settings}
          onAddPlayer={handleAddPlayer}
          onToggleRest={handleToggleRest}
          onRemovePlayer={handleRemovePlayer}
          onClearAll={handleClearAll}
          onLoadPlayers={handleLoadPlayers}
          onClearStatsOnly={handleClearStatsOnly}
          onDragStart={null}
          onDragEnd={null}
          selectedPlayerForMove={selectedPlayerForMove}
          onSelectPlayerForMove={handleSelectPlayerForMove}
          timer={timer}
          timerActive={timer.isActive || getScheduledTimerState().isScheduledActive}
          t={t}
        />
      </main>

      {/* Analytics, Logs & System Settings Footer */}
      <StatsHistory
        players={players}
        history={history}
        timer={timer}
        settings={settings}
        isAdmin={isAdmin}
        onUpdateSettings={handleUpdateSettings}
        onToggleVoice={handleToggleVoice}
        onTestVoice={handleTestVoice}
        firebaseConfigText={firebaseConfigText}
        onUpdateFirebaseConfig={handleUpdateFirebaseConfig}
        onResetSession={handleResetSession}
        onClearStatsOnly={handleClearStatsOnly}
        t={t}
      />

      {/* Sticky Bottom Navigation Bar for Mobile Viewports */}
      <div className="mobile-nav-bar">
        <button
          className={`mobile-nav-btn ${activeMobileTab === 'courts' ? 'active' : ''}`}
          onClick={() => setActiveMobileTab('courts')}
        >
          <Activity size={18} />
          <span>Courts</span>
        </button>
        <button
          className={`mobile-nav-btn ${activeMobileTab === 'queue' ? 'active' : ''}`}
          onClick={() => setActiveMobileTab('queue')}
        >
          <Users size={18} />
          <span>Queue ({players.filter(p => p.status === 'waiting').length})</span>
        </button>
        <button
          className={`mobile-nav-btn ${activeMobileTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveMobileTab('stats')}
        >
          <BarChart3 size={18} />
          <span>Stats & Settings</span>
        </button>
      </div>
    </div>
  );
}
