// Mock country data for testing
export const mockCountries = [
  {
    id: 'FR',
    name: 'France',
    aliases: ['French Republic'],
    continent: 'Europe',
    capital: 'Paris',
    population: 67970000,
    geometry: { type: 'Polygon', coordinates: [[[-5, 41], [8, 51], [-5, 41]]] }
  },
  {
    id: 'GB',
    name: 'United Kingdom',
    aliases: ['UK', 'Britain'],
    continent: 'Europe',
    capital: 'London',
    population: 67220000,
    geometry: { type: 'Polygon', coordinates: [[[-7, 50], [2, 59], [-7, 50]]] }
  },
  {
    id: 'US',
    name: 'United States',
    aliases: ['USA', 'America'],
    continent: 'North America',
    capital: 'Washington, D.C.',
    population: 331900000,
    geometry: { type: 'Polygon', coordinates: [[[-125, 25], [-66, 49], [-125, 25]]] }
  },
  {
    id: 'CI',
    name: 'Côte d\'Ivoire',
    aliases: ['Cote d\'Ivoire', 'Ivory Coast'],
    continent: 'Africa',
    capital: 'Yamoussoukro',
    population: 26378000,
    geometry: { type: 'Polygon', coordinates: [[[-8, 4], [3, 11], [-8, 4]]] }
  },
  {
    id: 'CR',
    name: 'Costa Rica',
    aliases: [],
    continent: 'North America',
    capital: 'San José',
    population: 5180000,
    geometry: { type: 'Polygon', coordinates: [[[-86, 8], [-82, 11], [-86, 8]]] }
  },
  {
    id: 'NL',
    name: 'Netherlands',
    aliases: ['The Netherlands', 'Holland'],
    continent: 'Europe',
    capital: 'Amsterdam',
    population: 17620000,
    geometry: { type: 'Polygon', coordinates: [[[3, 50], [7, 54], [3, 50]]] }
  }
];

export const createMockCountryLookup = () => {
  const lookup = {};
  mockCountries.forEach(country => {
    // Add canonical name - keep all words including single letters for main lookup
    const normalizedName = country.name.toLowerCase().trim()
      .replace(/[''`´]/g, ' ')  // Replace apostrophes with spaces
      .replace(/\s+/g, ' ');    // Normalize spaces
    lookup[normalizedName] = { id: country.id, country: country.name };
    
    // Add aliases
    if (country.aliases) {
      country.aliases.forEach(alias => {
        const normalizedAlias = alias.toLowerCase().trim()
          .replace(/[''`´]/g, ' ')  // Replace apostrophes with spaces
          .replace(/\s+/g, ' ');    // Normalize spaces
        lookup[normalizedAlias] = { id: country.id, country: country.name };
      });
    }
  });
  return lookup;
};

export const getCountryById = (id) => {
  return mockCountries.find(c => c.id === id);
};

export const getCountriesByContinent = (continent) => {
  return mockCountries.filter(c => c.continent === continent);
};
