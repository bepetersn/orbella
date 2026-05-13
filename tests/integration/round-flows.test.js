/**
 * Integration Tests — End-to-End Round Flows
 *
 * Uses the real store modules (reducer, round, actions, query) to exercise
 * complete game round scenarios from start to finish.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

function makeCountry(name, aliases = [], flagEmoji = '🏳️') {
  return { properties: { name, displayName: name, aliases, flagEmoji } };
}

async function seedStore(target, extras = []) {
  const { dispatch } = await import('../../src/store/reducer.js');
  const { createCountryGuessLookup } = await import('../../src/store/lookup.js');
  const countries = [target, ...extras];
  const lookup = createCountryGuessLookup(countries, new Map());
  dispatch({
    type: 'loadCountries',
    countriesData: countries,
    countryNames: countries.map((c) => c.properties.name),
    countryByName: new Map(countries.map((c) => [c.properties.name.toLowerCase(), c])),
    countryByGuess: lookup.countryByGuess,
    countryByLooseGuess: lookup.countryByLooseGuess,
    countryLookupEntries: lookup.countryLookupEntries,
  });
  dispatch({ type: 'setTargetCountry', targetCountry: target });
}

beforeEach(() => {
  vi.resetModules();
});

describe('Integration / Round Flows (real)', () => {
  it('correct guess wins the round and outcome becomes "won"', async () => {
    const france = makeCountry('France');
    await seedStore(france);
    const { startRound, submitRoundGuess, getRoundState } =
      await import('../../src/store/round.js');

    startRound('France');
    expect(getRoundState().outcome).toBe('active');

    const result = submitRoundGuess('France');
    expect(result.status).toBe('correct');
    expect(getRoundState().outcome).toBe('won');
  });

  it('three wrong guesses exhaust the round and outcome becomes "missed"', async () => {
    const france = makeCountry('France');
    await seedStore(france, [makeCountry('Germany'), makeCountry('Spain'), makeCountry('Italy')]);
    const { startRound, submitRoundGuess, getRoundState } =
      await import('../../src/store/round.js');

    startRound('France');
    submitRoundGuess('Germany');
    submitRoundGuess('Spain');
    const result = submitRoundGuess('Italy');

    expect(result.status).toBe('missed');
    expect(result.remaining).toBe(0);
    expect(getRoundState().outcome).toBe('missed');
  });

  it('alias resolves to the correct country and wins the round', async () => {
    const usa = makeCountry('United States', ['USA', 'America']);
    await seedStore(usa);
    const { startRound, submitRoundGuess } = await import('../../src/store/round.js');

    startRound('United States');
    const result = submitRoundGuess('USA');
    expect(result.status).toBe('correct');
  });

  it('duplicate guess is rejected without incrementing the miss counter', async () => {
    const france = makeCountry('France');
    await seedStore(france, [makeCountry('Germany')]);
    const { startRound, submitRoundGuess, getRoundState } =
      await import('../../src/store/round.js');

    startRound('France');
    submitRoundGuess('Germany');
    const missesAfterFirst = getRoundState().missesUsed;
    const result = submitRoundGuess('Germany');

    expect(result.status).toBe('duplicate');
    expect(getRoundState().missesUsed).toBe(missesAfterFirst);
  });

  it('reveal locks the round and prevents further guesses', async () => {
    const france = makeCountry('France');
    await seedStore(france);
    const { startRound, revealRoundAnswer, submitRoundGuess } =
      await import('../../src/store/round.js');

    startRound('France');
    const revealResult = revealRoundAnswer();
    expect(revealResult.changed).toBe(true);
    expect(revealResult.outcome).toBe('revealed');

    const guessResult = submitRoundGuess('France');
    expect(guessResult.status).toBe('locked');
  });

  it('hint flow: flag → first-letter → letter-count, then exhausted', async () => {
    const france = makeCountry('France', [], '🇫🇷');
    await seedStore(france);
    const { startRound, requestRoundHint } = await import('../../src/store/round.js');

    startRound('France');

    const h1 = requestRoundHint();
    expect(h1.changed).toBe(true);
    expect(h1.hint.type).toBe('flag');

    const h2 = requestRoundHint();
    expect(h2.hint.type).toBe('first-letter');
    expect(h2.hint.value).toBe('F');

    const h3 = requestRoundHint();
    expect(h3.hint.type).toBe('letter-count');
    expect(h3.hint.value).toBe(6); // F-r-a-n-c-e

    const h4 = requestRoundHint();
    expect(h4.changed).toBe(false);
    expect(h4.hintsRemaining).toBe(0);
  });

  it('scores accumulate correctly across two sequential rounds', async () => {
    const france = makeCountry('France');
    const germany = makeCountry('Germany');
    await seedStore(france, [germany]);

    const reducerMod = await import('../../src/store/reducer.js');
    const { dispatch } = reducerMod;
    const { startRound, submitRoundGuess } = await import('../../src/store/round.js');
    const { incrementCorrect, incrementPlayed } = await import('../../src/store/actions.js');

    // Round 1 — correct
    startRound('France');
    submitRoundGuess('France');
    incrementCorrect();
    incrementPlayed();

    // Round 2 — wrong
    dispatch({ type: 'setTargetCountry', targetCountry: germany });
    startRound('Germany');
    submitRoundGuess('France'); // wrong guess (france resolves but isn't the target)
    submitRoundGuess('France'); // duplicate
    incrementPlayed();

    const state = reducerMod.getCurrentState();
    expect(state.numPlayed).toBe(2);
    expect(state.numCorrect).toBe(1);
  });

  it('continent filter reduces the suggestion pool', async () => {
    const { getSuggestedCountryNames } = await import('../../src/store/query.js');
    const { dispatch } = await import('../../src/store/reducer.js');
    const { createCountryGuessLookup } = await import('../../src/store/lookup.js');

    const france = makeCountry('France');
    france.properties.continent = 'Europe';
    const japan = makeCountry('Japan');
    japan.properties.continent = 'Asia';

    const countries = [france, japan];
    const lookup = createCountryGuessLookup(countries, new Map());
    dispatch({
      type: 'loadCountries',
      countriesData: countries,
      countryNames: countries.map((c) => c.properties.name),
      countryByName: new Map(countries.map((c) => [c.properties.name.toLowerCase(), c])),
      countryByGuess: lookup.countryByGuess,
      countryByLooseGuess: lookup.countryByLooseGuess,
      countryLookupEntries: lookup.countryLookupEntries,
    });
    dispatch({ type: 'setSelectedContinent', selectedContinent: 'Europe' });

    // Query 'fr' should match France but not Japan
    const suggestions = getSuggestedCountryNames('fr', 10);
    expect(suggestions).toContain('France');
    expect(suggestions).not.toContain('Japan');
  });

  it('new game resets scores to zero', async () => {
    const { incrementCorrect, incrementPlayed, resetScores } =
      await import('../../src/store/actions.js');
    const { getCurrentState } = await import('../../src/store/reducer.js');

    incrementCorrect();
    incrementPlayed();
    expect(getCurrentState().numCorrect).toBe(1);

    resetScores();
    expect(getCurrentState().numCorrect).toBe(0);
    expect(getCurrentState().numPlayed).toBe(0);
  });
});
