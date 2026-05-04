// String transformation, object access, and dimension utilities
// ============================================================================

export function safeId(name) {
  return "c_" + name.replace(/[^a-zA-Z0-9]/g, "_");
}

export function getSvgDimensions(ctx) {
  const svgNode = ctx.svg.node();
  const bounds = svgNode.getBoundingClientRect();

  return {
    actualWidth: bounds.width || svgNode.clientWidth || ctx.width,
    actualHeight: bounds.height || svgNode.clientHeight || ctx.height
  };
}

// Feature normalization, validation, and country querying
// ============================================================================

const flagDisplayNames = typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
  ? new Intl.DisplayNames(["en"], { type: "region" })
  : null;

const isoCodeOverrides = new Map([
  ["czech republic", "CZ"],
  ["democratic republic of the congo", "CD"],
  ["east timor", "TL"],
  ["ivory coast", "CI"],
  ["myanmar", "MM"],
  ["palestine", "PS"],
  ["people s republic of china", "CN"],
  ["republic of the congo", "CG"],
  ["saint kitts and nevis", "KN"],
  ["saint lucia", "LC"],
  ["saint vincent and the grenadines", "VC"],
  ["the bahamas", "BS"],
  ["the gambia", "GM"],
  ["turkey", "TR"],
  ["united states of america", "US"],
  ["benin", "BJ"],
  ["burkina faso", "BF"],
  ["france", "FR"],
  ["germany", "DE"],
  ["russia", "RU"],
  ["serbia", "RS"],
  ["united kingdom", "GB"],
  ["vanuatu", "VU"],
  ["vietnam", "VN"],
  ["yemen", "YE"],
  ["zimbabwe", "ZW"]
]);

let regionNameToCodes = null;

function normalizeCountryLookupName(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/&/gu, " and ")
    .replace(/[’'`´]/gu, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function buildRegionNameToCodes() {
  if (regionNameToCodes) {
    return regionNameToCodes;
  }

  const lookup = new Map();

  if (flagDisplayNames) {
    for (let first = 65; first <= 90; first += 1) {
      for (let second = 65; second <= 90; second += 1) {
        const code = String.fromCharCode(first, second);
        const label = flagDisplayNames.of(code);
        if (!label) {
          continue;
        }

        const normalizedLabel = normalizeCountryLookupName(label);
        const existing = lookup.get(normalizedLabel) || [];
        lookup.set(normalizedLabel, [...existing, code]);
      }
    }
  }

  regionNameToCodes = lookup;
  return lookup;
}

function resolveIsoCode(countryName) {
  const normalizedName = normalizeCountryLookupName(countryName);

  if (!normalizedName) {
    return null;
  }

  const override = isoCodeOverrides.get(normalizedName);
  if (override) {
    return override;
  }

  const matches = buildRegionNameToCodes().get(normalizedName) || [];
  return matches.length === 1 ? matches[0] : null;
}

function flagEmojiFromCountryCode(countryCode) {
  const alpha2Code = String(countryCode ?? "").trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(alpha2Code)) {
    return null;
  }

  const firstRegionalIndicator = 0x1f1e6 + (alpha2Code.charCodeAt(0) - 65);
  const secondRegionalIndicator = 0x1f1e6 + (alpha2Code.charCodeAt(1) - 65);
  return String.fromCodePoint(firstRegionalIndicator, secondRegionalIndicator);
}

export function normalizeCountryFeature(ctx, feature) {
  const normalizedName = feature?.properties?.[ctx.countryNameProperty];
  const sourceContinent = feature?.properties?.[ctx.countryContinentProperty];
  const aliasNames = [...new Set(
    (feature?.properties?.NAME_ALIASES || [])
      .filter((aliasName) => typeof aliasName === "string")
      .map((aliasName) => aliasName.trim())
      .filter(Boolean)
  )];

  if (!normalizedName) {
    return feature;
  }

  const overrideKey = normalizedName.trim().toLowerCase();
  const configuredMemberships = ctx.countryContinentMemberships.get(overrideKey) || [];
  const normalizedMemberships = [...new Set([
    sourceContinent,
    ...configuredMemberships
  ].filter(Boolean))];
  const normalizedContinent = normalizedMemberships[0] || sourceContinent;
  const isoCode = resolveIsoCode(normalizedName);

  return {
    ...feature,
    properties: {
      ...feature.properties,
      name: normalizedName,
      displayName: normalizedName,
      aliases: aliasNames,
      synonyms: aliasNames,
      continent: normalizedContinent,
      continents: normalizedMemberships,
      isoCode,
      flagEmoji: flagEmojiFromCountryCode(isoCode),
      // `playable` flag: explicit property if present, otherwise infer from EXCLUDED
      playable: typeof feature.properties?.playable === "boolean"
        ? feature.properties.playable
        : !Boolean(feature.properties?.EXCLUDED)
    }
  };
}

export function isCountryInContinent(country, continentName) {
  if (!continentName) {
    return true;
  }

  const memberships = country?.properties?.continents;
  if (Array.isArray(memberships) && memberships.length > 0) {
    return memberships.includes(continentName);
  }

  return country?.properties?.continent === continentName;
}

export function isPlayableCountry(feature) {
  const { name } = feature.properties ?? {};
  return Boolean(name)
    && !feature.properties?.EXCLUDED;
}

export function getCountryKey(feature) {
  return String(feature?.properties?.name ?? "").trim().toLowerCase();
}

export function getRenderableFeature(ctx, feature) {
  const keyedFeature = ctx.renderFeatureByName.get(getCountryKey(feature));
  return keyedFeature || feature;
}

export { flagEmojiFromCountryCode, resolveIsoCode };
