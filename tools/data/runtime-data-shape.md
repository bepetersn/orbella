# Runtime Country Dataset Shape

The browser consumes a generated GeoJSON FeatureCollection derived from `data/world-countries.json`.

## Top-level object

- `type`: always `FeatureCollection`
- `schema`: `worldle-lite-country-render-v1`
- `generatedAt`: ISO timestamp for the last generation run
- `source`: relative path to the canonical input file
- `features`: array of country features

## Feature shape

Each feature keeps the original GeoJSON geometry and original source properties, and adds a small runtime-friendly metadata layer.

### Required fields

- `type`: always `Feature`
- `properties`: object
- `geometry`: `Polygon` or `MultiPolygon`

### Preserved source properties

The generator passes through the original Natural Earth fields from the source dataset, including fields like `CONTINENT`, `NAME_EN`, and any other metadata already present in the source file.

### Derived runtime properties

- `name`: canonical display name used by the app
- `displayName`: same as `name`, for UI and lookups
- `aliases`: alternate accepted names, if any
- `synonyms`: same list as `aliases`, for compatibility with the existing input pipeline
- `continent`: primary continent label
- `continents`: unique list of continent memberships
- `flagCode`: resolved ISO-3166 alpha-2 code, when available
- `flagEmoji`: unicode flag emoji derived from `flagCode`, when possible
- `geometryBounds`: `[minLon, minLat, maxLon, maxLat]` derived from the geometry
- `geometryCenter`: `[lon, lat]` midpoint of `geometryBounds`
- `geometryPointCount`: total coordinate points found in the geometry
- `geometryRingCount`: number of rings across polygons and multipolygons

## Consumer expectations

- The game can continue to treat this as GeoJSON-like data.
- The geometry stays untouched, so map rendering can read the same polygon coordinates.
- The derived metadata lets the browser skip expensive normalization on startup.