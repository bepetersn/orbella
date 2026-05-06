/**
 * @fileoverview SVG world-map rendering and interaction layer.
 *
 * `createWorldMap` initialises a D3-powered SVG map, fetches and normalises
 * GeoJSON country data, renders `<path>` elements for each country, and
 * exposes methods for marking round state (target / correct / wrong) and
 * animating zoom-to-country transitions.
 *
 * Exported as {@link window.worldMap}.
 */

import { getSvgDimensions, safeId } from './utils.js';
import { loadCountries } from './loader.js';
import { setRegionFilter } from './rendering.js';
import { resetRoundState, markTarget, markSolved, markWrong } from './state.js';
import { zoomToCountry, showLocationHalo } from './animations.js';

/**
 * Create and mount a world map into the SVG element matched by `selector`.
 *
 * @param {object}         options
 * @param {object}         options.d3                          D3 v7 library reference.
 * @param {string}         options.selector                    CSS selector for the `<svg>` element.
 * @param {number}         options.width                       Logical SVG width in pixels.
 * @param {number}         options.height                      Logical SVG height in pixels.
 * @param {string}         options.countriesGeoJsonUrl         URL of the GeoJSON data file.
 * @param {string}         [options.countryNameProperty]       GeoJSON property key for the display name.
 * @param {string}         [options.countryContinentProperty]  GeoJSON property key for the continent name.
 * @param {Map<string,string[]>} [options.countryContinentMemberships] Manual continent overrides keyed by lower-cased country name.
 * @returns {{ loadCountries: Function, resetRoundState: Function, markTarget: Function, markSolved: Function, markWrong: Function, zoomToCountry: Function, showLocationHalo: Function, setRegionFilter: Function, safeId: Function }}
 */
function createWorldMap({
  d3,
  selector,
  width,
  height,
  countriesGeoJsonUrl,
  countryNameProperty = "name",
  countryContinentProperty = "continent",
  countryContinentMemberships = new Map()
}) {
  const svg = d3.select(selector);
  const { actualWidth, actualHeight } = getSvgDimensions({ svg, width, height });
  const g = svg.append("g");
  const projection = d3.geoNaturalEarth1().scale(160).translate([actualWidth / 2, actualHeight / 2]);
  const path = d3.geoPath(projection);

  const ctx = {
    d3,
    svg,
    width,
    height,
    countriesGeoJsonUrl,
    countryNameProperty,
    countryContinentProperty,
    countryContinentMemberships,
    g,
    projection,
    path,
    activeContinentFilter: null,
    allCountriesData: [],
    renderFeatureByName: new Map(),
    geometryFilter: null,
    zoom: null
  };

  ctx.zoom = d3.zoom()
    .scaleExtent([1, 50])
    .on("zoom", (event) => {
      ctx.g.attr("transform", event.transform.toString());
    });

  svg.call(ctx.zoom);

  return {
    loadCountries: () => loadCountries(ctx),
    resetRoundState: () => resetRoundState(ctx),
    markTarget: (country) => markTarget(ctx, country),
    markSolved: (country) => markSolved(ctx, country),
    markWrong: (countryName) => markWrong(ctx, countryName),
    zoomToCountry: (country) => zoomToCountry(ctx, country),
    showLocationHalo: (country) => showLocationHalo(ctx, country),
    setRegionFilter: (regionName) => setRegionFilter(ctx, regionName),
    safeId
  };
}

export { createWorldMap };

// window shim — removed in Phase 5
window.worldMap = {
  createWorldMap
};
