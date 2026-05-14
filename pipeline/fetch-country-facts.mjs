/**
 * @fileoverview One-time fetch script to pull country facts from the REST
 * Countries API (https://restcountries.com) and write a static supplement
 * file used by generate-world-countries.mjs.
 *
 * Run this script manually whenever the supplement data needs to be refreshed:
 *
 *   node pipeline/fetch-country-facts.mjs
 *
 * Output: pipeline/data/country-facts-supplement.json
 * Key:    ISO 3166-1 alpha-2 code (e.g. "FR", "US")
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(scriptDir, 'data', 'country-facts-supplement.json');

const FIELDS = 'cca2,name,capital,area,population,languages,currencies,subregion';
const API_URL = `https://restcountries.com/v3.1/all?fields=${FIELDS}`;

async function main() {
  console.log(`Fetching from ${API_URL} …`);
  const res = await fetch(API_URL);

  if (!res.ok) {
    throw new Error(`REST Countries API returned HTTP ${res.status}: ${res.statusText}`);
  }

  const countries = await res.json();

  if (!Array.isArray(countries)) {
    throw new Error('Unexpected response shape from REST Countries API');
  }

  const supplement = {};

  for (const country of countries) {
    const code = country.cca2?.trim().toUpperCase();
    if (!code || !/^[A-Z]{2}$/.test(code)) {
      continue;
    }

    // Capital: take the first entry from the capitals array if present.
    const capitalArr = Array.isArray(country.capital) ? country.capital : [];
    const capital = capitalArr.length > 0 ? capitalArr[0] : null;

    // Languages: values of the languages object, sorted for determinism.
    const languageMap =
      country.languages && typeof country.languages === 'object' ? country.languages : {};
    const languages = Object.values(languageMap).sort();

    // Currencies: collect { name, symbol } for each currency code.
    const currencyMap =
      country.currencies && typeof country.currencies === 'object' ? country.currencies : {};
    const currencies = Object.entries(currencyMap).map(([code2, info]) => ({
      code: code2,
      name: info?.name ?? null,
      symbol: info?.symbol ?? null,
    }));

    // Area rounded to nearest km² (source is already km²).
    const area = typeof country.area === 'number' ? Math.round(country.area) : null;

    // Population as integer.
    const population =
      typeof country.population === 'number' ? Math.round(country.population) : null;

    // Sub-region (more specific than continent).
    const subregion =
      typeof country.subregion === 'string' && country.subregion.trim()
        ? country.subregion.trim()
        : null;

    supplement[code] = {
      capital,
      languages,
      currencies,
      area,
      population,
      subregion,
    };
  }

  const sorted = Object.fromEntries(
    Object.entries(supplement).sort(([a], [b]) => a.localeCompare(b))
  );

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(sorted, null, 2));

  console.log(
    `Wrote facts for ${Object.keys(sorted).length} countries to ${path.relative(scriptDir, outputPath)}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
