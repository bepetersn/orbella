# Data Preprocessing

This folder owns the lightweight preprocessing step for country data.

## Source of truth

- Canonical source: `data/world-countries.json`
- Generated runtime dataset: `data/generated/world-countries.render.json`

## Build the derived dataset

Run the generator after changing the source GeoJSON or the normalization rules:

```bash
node tools/data/generate-world-countries.mjs
```

The script keeps the geometry intact and adds normalized lookup fields that the browser app can use directly.

## Runtime data shape

See [runtime-data-shape.md](runtime-data-shape.md) for the exact generated feature collection shape used by the browser.