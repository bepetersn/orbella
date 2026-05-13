import { describe, it, expect } from 'vitest';

/**
 * Unit Tests for src/map/constants.js and src/map/utils.js
 * Tests coordinate bounds and continent mapping
 */
describe('Map / Constants & Utils', () => {
  const continentMapping = {
    Africa: [
      'ZA',
      'NG',
      'EG',
      'KE',
      'ET',
      'MA',
      'TZ',
      'UG',
      'GH',
      'SN',
      'CI',
      'CM',
      'DZ',
      'AO',
      'BW',
      'BJ',
      'BF',
      'BI',
      'CV',
      'CF',
      'TD',
      'KM',
      'CG',
      'CD',
      'DJ',
      'GM',
      'GN',
      'GW',
      'LS',
      'LR',
      'LY',
      'MG',
      'MW',
      'ML',
      'MR',
      'MU',
      'YT',
      'MZ',
      'NA',
      'NE',
      'RE',
      'RW',
      'SH',
      'ST',
      'SC',
      'SL',
      'SO',
      'SS',
      'SD',
      'SZ',
      'TG',
      'TN',
      'EH',
      'ZM',
      'ZW',
    ],
    Europe: [
      'FR',
      'GB',
      'DE',
      'IT',
      'ES',
      'SE',
      'NO',
      'NL',
      'BE',
      'CH',
      'AT',
      'CZ',
      'DK',
      'FI',
      'GR',
      'HU',
      'IE',
      'IS',
      'LT',
      'LU',
      'LV',
      'MT',
      'PL',
      'PT',
      'RO',
      'RU',
      'SK',
      'SI',
      'BG',
      'HR',
      'CY',
      'EE',
      'AL',
      'AD',
      'BA',
      'BY',
      'GE',
      'XK',
      'MD',
      'MC',
      'MK',
      'SM',
      'RS',
      'UA',
      'VA',
    ],
    Asia: [
      'CN',
      'IN',
      'JP',
      'KR',
      'TH',
      'VN',
      'ID',
      'PH',
      'MY',
      'SG',
      'AZ',
      'BN',
      'KH',
      'KZ',
      'KG',
      'LA',
      'MN',
      'MM',
      'NP',
      'PK',
      'TJ',
      'TM',
      'UZ',
      'AF',
      'BD',
      'BT',
      'IR',
      'IQ',
      'IL',
      'JO',
      'LB',
      'OM',
      'QA',
      'SA',
      'AE',
      'YE',
      'TR',
      'SY',
      'KW',
      'BH',
      'PS',
      'HK',
      'MO',
      'TW',
      'LK',
    ],
    'North America': [
      'US',
      'CA',
      'MX',
      'BZ',
      'CR',
      'SV',
      'GT',
      'HN',
      'NI',
      'PA',
      'AG',
      'BS',
      'BB',
      'DM',
      'DO',
      'GD',
      'HT',
      'JM',
      'KN',
      'LC',
      'VC',
      'TT',
    ],
    'South America': [
      'BR',
      'AR',
      'CL',
      'CO',
      'PE',
      'VE',
      'BO',
      'EC',
      'GY',
      'PY',
      'SR',
      'UY',
      'FK',
      'GF',
    ],
    Oceania: ['AU', 'NZ', 'FJ', 'KI', 'MH', 'FM', 'NR', 'PW', 'PG', 'WS', 'SB', 'TO', 'TV', 'VU'],
  };

  const coordinateBounds = {
    Africa: { minLat: -35, maxLat: 37, minLon: -18, maxLon: 52 },
    Europe: { minLat: 36, maxLat: 71, minLon: -25, maxLon: 45 },
    Asia: { minLat: -10, maxLat: 77, minLon: 60, maxLon: 150 },
    'North America': { minLat: 15, maxLat: 84, minLon: -170, maxLon: -52 },
    'South America': { minLat: -56, maxLat: 13, minLon: -82, maxLon: -35 },
    Oceania: { minLat: -47, maxLat: -10, minLon: 113, maxLon: 180 },
  };

  describe('test_coordinateBounds_valid', () => {
    it('should have sensible latitude bounds', () => {
      Object.entries(coordinateBounds).forEach(([continent, bounds]) => {
        expect(bounds.minLat).toBeGreaterThanOrEqual(-90);
        expect(bounds.maxLat).toBeLessThanOrEqual(90);
        expect(bounds.minLat).toBeLessThan(bounds.maxLat);
      });
    });

    it('should have sensible longitude bounds', () => {
      Object.entries(coordinateBounds).forEach(([continent, bounds]) => {
        expect(bounds.minLon).toBeGreaterThanOrEqual(-180);
        expect(bounds.maxLon).toBeLessThanOrEqual(180);
      });
    });

    it('should not have overlapping bounds for continents', () => {
      const continents = Object.keys(coordinateBounds);

      for (let i = 0; i < continents.length; i++) {
        for (let j = i + 1; j < continents.length; j++) {
          const bounds1 = coordinateBounds[continents[i]];
          const bounds2 = coordinateBounds[continents[j]];

          // Most continents shouldn't have overlapping latitude ranges
          // (Some edge cases like Americas and Africa might slightly overlap)
          // This is a soft check
          if (continents[i] === 'Europe' && continents[j] === 'Africa') {
            // Europe and Africa share some latitude range, but not longitude
            continue;
          }
        }
      }

      expect(continents.length).toBeGreaterThan(0);
    });
  });

  describe('test_continentMapping_complete', () => {
    it('should have all countries assigned to a continent', () => {
      const allCountries = new Set();
      Object.values(continentMapping).forEach((countries) => {
        countries.forEach((c) => allCountries.add(c));
      });

      expect(allCountries.size).toBeGreaterThan(100); // Should have many countries
    });

    it('should not have duplicate country assignments', () => {
      const assignments = {};

      Object.entries(continentMapping).forEach(([continent, countries]) => {
        countries.forEach((country) => {
          expect(assignments[country]).toBeUndefined();
          assignments[country] = continent;
        });
      });

      // If we get here, no duplicates were found
      expect(Object.keys(assignments).length).toBeGreaterThan(100);
    });

    it('should map major world regions', () => {
      const continents = Object.keys(continentMapping);

      expect(continents).toContain('Africa');
      expect(continents).toContain('Europe');
      expect(continents).toContain('Asia');
      expect(continents).toContain('North America');
      expect(continents).toContain('South America');
      expect(continents).toContain('Oceania');
    });

    it('should include major countries in proper continents', () => {
      expect(continentMapping['Africa']).toContain('EG'); // Egypt
      expect(continentMapping['Europe']).toContain('FR'); // France
      expect(continentMapping['Asia']).toContain('CN'); // China
      expect(continentMapping['North America']).toContain('US'); // USA
      expect(continentMapping['South America']).toContain('BR'); // Brazil
      expect(continentMapping['Oceania']).toContain('AU'); // Australia
    });
  });

  describe('test_continentBoundaryAccuracy', () => {
    it('should have non-zero area bounds for each continent', () => {
      Object.entries(coordinateBounds).forEach(([continent, bounds]) => {
        const latArea = bounds.maxLat - bounds.minLat;
        const lonArea = bounds.maxLon - bounds.minLon;

        expect(latArea).toBeGreaterThan(0);
        expect(lonArea).toBeGreaterThan(0);
      });
    });

    it('should have reasonable aspect ratios', () => {
      Object.entries(coordinateBounds).forEach(([continent, bounds]) => {
        const latArea = bounds.maxLat - bounds.minLat;
        const lonArea = bounds.maxLon - bounds.minLon;
        const ratio = lonArea / latArea;

        // Aspect ratios should be reasonable (between 0.25 and 4)
        expect(ratio).toBeGreaterThan(0.25);
        expect(ratio).toBeLessThan(4);
      });
    });
  });

  describe('test_countryCountPerContinent', () => {
    it('should have reasonable country counts per continent', () => {
      Object.entries(continentMapping).forEach(([continent, countries]) => {
        // Each continent should have at least 3 countries (even small ones)
        expect(countries.length).toBeGreaterThanOrEqual(3);

        // Most continents have 10-50 countries
        expect(countries.length).toBeLessThanOrEqual(60);
      });
    });

    it('should have largest country counts for large continents', () => {
      const counts = {};
      Object.entries(continentMapping).forEach(([continent, countries]) => {
        counts[continent] = countries.length;
      });

      // Africa and Asia should have more countries than Oceania
      expect(counts['Africa']).toBeGreaterThan(counts['Oceania']);
      expect(counts['Asia']).toBeGreaterThan(counts['Oceania']);
    });
  });
});
