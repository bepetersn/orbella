import { getCountryKey, getRenderableFeature, isCountryInContinent } from './utils.js';

// Build renderable maps and apply visibility filters
// ============================================================================

export function buildRenderableMapForContinent(ctx, continentName) {
  const allCountriesData = Array.isArray(ctx.allCountriesData) ? ctx.allCountriesData : [];

  if (!ctx.geometryFilter) {
    return new Map(allCountriesData.map((country) => [getCountryKey(country), country]));
  }

  return ctx.geometryFilter.buildRenderableMapForContinent(allCountriesData, continentName);
}

export function applyContinentVisibilityFilter(ctx) {
  ctx.g
    .selectAll('.country')
    .attr('d', (country) => ctx.path(getRenderableFeature(ctx, country)))
    .style('display', (country) => {
      if (!ctx.activeContinentFilter) {
        return null;
      }

      return isCountryInContinent(country, ctx.activeContinentFilter) ? null : 'none';
    });
}

export function setRegionFilter(ctx, regionName) {
  ctx.activeContinentFilter = regionName ? String(regionName).trim() : null;
  ctx.renderFeatureByName = buildRenderableMapForContinent(ctx, ctx.activeContinentFilter);
  applyContinentVisibilityFilter(ctx);
}
