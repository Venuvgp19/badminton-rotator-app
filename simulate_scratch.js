// Simulation of Badminton Rotator App
// 23 players, 3 courts, 120 minutes session (8 rounds of 15 minutes each)

const NUM_PLAYERS = 23;
const NUM_COURTS = 3;
const GAME_DURATION = 10; // minutes
const SESSION_DURATION = 120; // minutes
const TOTAL_ROUNDS = SESSION_DURATION / GAME_DURATION; // 8 rounds

// Helper to calculate statistics
function calculateStats(players) {
  const games = players.map(p => p.gamesPlayed);
  const totalGames = games.reduce((sum, g) => sum + g, 0);
  const avgGames = totalGames / NUM_PLAYERS;
  
  // Standard Deviation (Disparity Index)
  const variance = games.reduce((sum, g) => sum + Math.pow(g - avgGames, 2), 0) / NUM_PLAYERS;
  const stdDev = Math.sqrt(variance);

  // Wait rounds
  const maxWait = Math.max(...players.map(p => p.maxWaitRounds));
  const avgWait = players.reduce((sum, p) => sum + p.totalWaitRounds, 0) / players.reduce((sum, p) => sum + p.waitCount, 0);

  return {
    players: players.map(p => ({
      id: p.id,
      name: p.name,
      games: p.gamesPlayed,
      maxWait: p.maxWaitRounds
    })),
    summary: {
      totalGames,
      avgGames: avgGames.toFixed(2),
      minGames: Math.min(...games),
      maxGames: Math.max(...games),
      stdDev: stdDev.toFixed(2),
      maxWaitRounds: maxWait,
      avgWaitRoundsInQueue: avgWait.toFixed(2)
    }
  };
}

// -----------------------------------------------------------------
// SIMULATION 1: Current Logic (All 4 Rotate)
// -----------------------------------------------------------------
function runAll4RotateSimulation() {
  // Initialize players
  let players = Array.from({ length: NUM_PLAYERS }, (_, i) => ({
    id: i + 1,
    name: `Player ${i + 1}`,
    gamesPlayed: 0,
    waitRounds: 0,
    lastPlayedRound: -1,
    status: 'waiting', // 'playing' or 'waiting'
    maxWaitRounds: 0,
    totalWaitRounds: 0,
    waitCount: 0
  }));

  let courts = Array.from({ length: NUM_COURTS }, (_, i) => ({
    courtId: i + 1,
    players: [] // Holds 4 player objects
  }));

  // Helper to update wait rounds for waiting players
  function incrementWaitRoundsForWaiting(round) {
    players.forEach(p => {
      if (p.status === 'waiting') {
        p.waitRounds++;
        p.maxWaitRounds = Math.max(p.maxWaitRounds, p.waitRounds);
      }
    });
  }

  // Helper to schedule a court
  function fillCourt(courtId, round) {
    let waiting = players.filter(p => p.status === 'waiting');
    
    // Priority score: (Games Played * 1000) - (Wait Rounds * 50) + (Last Played Round * 5)
    waiting.forEach(p => {
      p._priorityScore = (p.gamesPlayed * 1000) - (p.waitRounds * 50) + (p.lastPlayedRound * 5);
    });
    
    waiting.sort((a, b) => a._priorityScore - b._priorityScore);

    const selected = waiting.slice(0, 4);
    selected.forEach(p => {
      p.status = 'playing';
      // Record waiting stats when leaving queue
      if (p.waitRounds > 0) {
        p.totalWaitRounds += p.waitRounds;
        p.waitCount++;
      }
      p.waitRounds = 0;
    });

    return selected;
  }

  // Round 1 Setup (T=0)
  // Fill all 3 courts
  for (let c = 0; c < NUM_COURTS; c++) {
    courts[c].players = fillCourt(c + 1, 0);
  }

  // Simulate 8 rounds of play
  for (let round = 1; round <= TOTAL_ROUNDS; round++) {
    // 1. Play the game
    // 2. Increment games played for current court players
    courts.forEach(court => {
      court.players.forEach(p => {
        p.gamesPlayed++;
        p.lastPlayedRound = round;
        p.status = 'waiting';
      });
    });

    // 3. Increment wait rounds for players who were waiting during this round
    incrementWaitRoundsForWaiting(round);

    // 4. Rotate: Fill courts for the next round (if not the last round)
    if (round < TOTAL_ROUNDS) {
      courts.forEach(court => {
        court.players = fillCourt(court.courtId, round);
      });
    }
  }

  // Flush remaining waiting times
  players.forEach(p => {
    if (p.status === 'waiting' && p.waitRounds > 0) {
      p.totalWaitRounds += p.waitRounds;
      p.waitCount++;
    }
  });

  return calculateStats(players);
}

// -----------------------------------------------------------------
// SIMULATION 2: Staggered Pairs (2-in, 2-out)
// -----------------------------------------------------------------
function runStaggeredSimulation() {
  // Initialize players
  let players = Array.from({ length: NUM_PLAYERS }, (_, i) => ({
    id: i + 1,
    name: `Player ${i + 1}`,
    gamesPlayed: 0,
    waitRounds: 0,
    status: 'waiting',
    maxWaitRounds: 0,
    totalWaitRounds: 0,
    waitCount: 0
  }));

  // Courts hold players with tracking of consecutive games played on this court
  let courts = Array.from({ length: NUM_COURTS }, (_, i) => ({
    courtId: i + 1,
    slots: [] // Array of { player, gamesOnCourt: 0/1/2 }
  }));

  function getPriorityQueue() {
    let waiting = players.filter(p => p.status === 'waiting');
    waiting.forEach(p => {
      // Score based on games played and wait rounds
      p._priorityScore = (p.gamesPlayed * 1000) - (p.waitRounds * 50);
    });
    waiting.sort((a, b) => a._priorityScore - b._priorityScore);
    return waiting;
  }

  function incrementWaitRounds() {
    players.forEach(p => {
      if (p.status === 'waiting') {
        p.waitRounds++;
        p.maxWaitRounds = Math.max(p.maxWaitRounds, p.waitRounds);
      }
    });
  }

  // T=0: Initial setup. All 3 courts filled with 4 players.
  // Since we start synchronized, all 4 enter at the same time.
  // To stagger, we will set 2 players on each court to have gamesOnCourt = 1
  // and 2 players to have gamesOnCourt = 0. This simulates a mid-session staggered state
  // or a smart startup where 2 players are scheduled to rotate out after the first match.
  let queue = getPriorityQueue();
  for (let c = 0; c < NUM_COURTS; c++) {
    const courtPlayers = queue.splice(0, 4);
    courtPlayers.forEach((p, idx) => {
      p.status = 'playing';
      // Stagger: 2 players will stay for 1 more game, 2 players will leave after 1 game
      courts[c].slots.push({
        player: p,
        gamesOnCourt: idx < 2 ? 1 : 0 // idx 0 and 1 are already considered to have played 1 game
      });
    });
  }

  // Simulate 8 rounds
  for (let round = 1; round <= TOTAL_ROUNDS; round++) {
    // 1. Play the game
    // Increment gamesPlayed for everyone on court
    courts.forEach(court => {
      court.slots.forEach(slot => {
        slot.player.gamesPlayed++;
        slot.gamesOnCourt++;
      });
    });

    // 2. Increment wait rounds for waiting queue
    incrementWaitRounds();

    // 3. Staggered Rotation:
    if (round < TOTAL_ROUNDS) {
      courts.forEach(court => {
        // Find players who have finished 2 games
        const toRotateOut = court.slots.filter(s => s.gamesOnCourt >= 2);
        const toKeep = court.slots.filter(s => s.gamesOnCourt < 2);

        // Send rotating out back to queue
        toRotateOut.forEach(s => {
          s.player.status = 'waiting';
          s.player.waitRounds = 0;
        });

        // Fetch 2 new players from queue
        let q = getPriorityQueue();
        const incoming = q.slice(0, 2);
        incoming.forEach(p => {
          p.status = 'playing';
          if (p.waitRounds > 0) {
            p.totalWaitRounds += p.waitRounds;
            p.waitCount++;
          }
          p.waitRounds = 0;
        });

        // Rebuild slots
        court.slots = [
          ...toKeep,
          ...incoming.map(p => ({ player: p, gamesOnCourt: 0 }))
        ];
      });
    }
  }

  // Flush remaining waiting times
  players.forEach(p => {
    if (p.status === 'waiting' && p.waitRounds > 0) {
      p.totalWaitRounds += p.waitRounds;
      p.waitCount++;
    }
  });

  return calculateStats(players);
}

const all4Stats = runAll4RotateSimulation();
const staggeredStats = runStaggeredSimulation();

console.log("=== ALL 4 ROTATE SUMMARY ===");
console.log(JSON.stringify(all4Stats.summary, null, 2));
console.log("\n=== STAGGERED (2-IN 2-OUT) SUMMARY ===");
console.log(JSON.stringify(staggeredStats.summary, null, 2));

// Log player by player detail
console.log("\nPlayer Details (All 4 Rotate vs Staggered):");
for (let i = 0; i < NUM_PLAYERS; i++) {
  const p1 = all4Stats.players.find(p => p.id === i + 1);
  const p2 = staggeredStats.players.find(p => p.id === i + 1);
  console.log(`Player ${i+1}: All4Games=${p1.games} MaxWait1=${p1.maxWait} | StaggeredGames=${p2.games} MaxWait2=${p2.maxWait}`);
}
