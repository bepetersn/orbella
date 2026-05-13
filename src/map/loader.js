import {
  normalizeCountryFeature,
  isPlayableCountry,
  getCountryKey,
  isCountryInContinent,
} from './utils.js';
import { buildRenderableMapForContinent, applyContinentVisibilityFilter } from './rendering.js';
import { createContinentGeometryFilter } from './geometry.js';
import { safeId } from './utils.js';

// Load GeoJSON, normalize countries, and render paths
// ============================================================================

export async function loadCountries(ctx) {
  ctx.geometryFilter =
    createContinentGeometryFilter({
      d3: ctx.d3,
      path: ctx.path,
      projection: ctx.projection,
      isCountryInContinent,
      getCountryKey,
      excludedPolygonBounds:
        ctx.excludedPolygonBounds ?? window.gameConfig?.COUNTRY_EXCLUDED_POLYGON_BOUNDS,
    }) ?? null;

  const data = await ctx.d3.json(ctx.countriesGeoJsonUrl);
  const countriesData = data.features
    .map((feature) => normalizeCountryFeature(ctx, feature))
    .filter(isPlayableCountry);

  ctx.allCountriesData = countriesData;
  ctx.renderFeatureByName = buildRenderableMapForContinent(ctx, null);

  const countryNames = countriesData.map((country) => country.properties.name).sort();
  const countryByName = new Map(
    countriesData.map((country) => [country.properties.name.toLowerCase(), country])
  );

  ctx.g
    .selectAll('path')
    .data(countriesData)
    .enter()
    .append('path')
    .attr('d', ctx.path)
    .attr('class', 'country')
    .attr('id', (country) => safeId(country.properties.name));

  applyContinentVisibilityFilter(ctx);

  return { countriesData, countryNames, countryByName };
}
