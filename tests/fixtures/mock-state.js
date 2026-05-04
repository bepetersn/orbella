// Mock state snapshots for testing
export const initialState = {
  game: {
    outcome: 'active',
    round: 1,
    stats: {
      plays: 0,
      correct: 0,
      hintsUsed: 0
    }
  },
  current: {
    targetCountry: null,
    targetFeature: null,
    missesUsed: 0,
    hintsRemaining: 3,
    guesses: [],
    hints: [],
    selectedContinent: null
  }
};

export const roundInProgressState = {
  game: {
    outcome: 'active',
    round: 1,
    stats: {
      plays: 0,
      correct: 0,
      hintsUsed: 0
    }
  },
  current: {
    targetCountry: { id: 'FR', name: 'France' },
    targetFeature: { properties: { id: 'FR' } },
    missesUsed: 0,
    hintsRemaining: 3,
    guesses: [],
    hints: [],
    selectedContinent: null
  }
};

export const roundWithWrongGuessesState = {
  game: {
    outcome: 'active',
    round: 1,
    stats: {
      plays: 0,
      correct: 0,
      hintsUsed: 0
    }
  },
  current: {
    targetCountry: { id: 'FR', name: 'France' },
    targetFeature: { properties: { id: 'FR' } },
    missesUsed: 2,
    hintsRemaining: 1,
    guesses: ['Germany', 'Italy'],
    hints: ['Europe'],
    selectedContinent: null
  }
};

export const roundCompletedState = {
  game: {
    outcome: 'correct',
    round: 1,
    stats: {
      plays: 1,
      correct: 1,
      hintsUsed: 1
    }
  },
  current: {
    targetCountry: { id: 'FR', name: 'France' },
    targetFeature: { properties: { id: 'FR' } },
    missesUsed: 0,
    hintsRemaining: 3,
    guesses: ['France'],
    hints: ['Europe'],
    selectedContinent: null
  }
};

export const roundExhaustedState = {
  game: {
    outcome: 'exhausted',
    round: 1,
    stats: {
      plays: 1,
      correct: 0,
      hintsUsed: 0
    }
  },
  current: {
    targetCountry: { id: 'FR', name: 'France' },
    targetFeature: { properties: { id: 'FR' } },
    missesUsed: 3,
    hintsRemaining: 0,
    guesses: ['Germany', 'Italy', 'Spain'],
    hints: [],
    selectedContinent: null
  }
};

export const stateWithContinentFilter = {
  game: {
    outcome: 'active',
    round: 1,
    stats: {
      plays: 0,
      correct: 0,
      hintsUsed: 0
    }
  },
  current: {
    targetCountry: { id: 'FR', name: 'France' },
    targetFeature: { properties: { id: 'FR' } },
    missesUsed: 0,
    hintsRemaining: 3,
    guesses: [],
    hints: [],
    selectedContinent: 'Europe'
  }
};

export const createStateWithStats = (plays, correct, hintsUsed) => ({
  game: {
    outcome: 'active',
    round: plays + 1,
    stats: { plays, correct, hintsUsed }
  },
  current: {
    targetCountry: null,
    targetFeature: null,
    missesUsed: 0,
    hintsRemaining: 3,
    guesses: [],
    hints: [],
    selectedContinent: null
  }
});
