import {
  ZOOM_DURATION_MS,
  ZOOM_PROPORTIONAL_SCALE_FACTOR,
  ZOOM_MAX_SCALE_DEFAULT,
  ZOOM_MAX_SCALE_SMALL_COUNTRY,
  SMALL_COUNTRY_AREA_THRESHOLD,
  ZOOM_VIEWPORT_PADDING_RATIO,
  HALO_SIZE_THRESHOLD,
  HALO_STROKE_COLOR,
  HALO_STROKE_WIDTH,
  HALO_DURATION_MS,
  HALO_RADIUS,
} from './constants.js';
import { getSvgDimensions, getRenderableFeature } from './utils.js';
import { getGeometryPolygonParts, createPolygonFeature } from './geometry.js';

// Calculate zoom frames and animate zoom to countries
// ============================================================================

export function getZoomFrameMetrics(ctx, country) {
  // 1. Get renderable country and compute fallback bounding box
  const renderableCountry = getRenderableFeature(ctx, country);
  const fallbackBounds = ctx.path.bounds(renderableCountry);
  const fallbackDx = fallbackBounds[1][0] - fallbackBounds[0][0];
  const fallbackDy = fallbackBounds[1][1] - fallbackBounds[0][1];
  const fallbackCenterX = (fallbackBounds[0][0] + fallbackBounds[1][0]) / 2;
  const fallbackCenterY = (fallbackBounds[0][1] + fallbackBounds[1][1]) / 2;

  // 2. Extract geometry polygon parts (handle simple vs multi-polygon countries)
  const geometryParts = getGeometryPolygonParts(renderableCountry);

  if (geometryParts.length < 2) {
    return {
      dx: fallbackDx,
      dy: fallbackDy,
      centerX: fallbackCenterX,
      centerY: fallbackCenterY,
    };
  }

  // 3. Compute bounding box for each polygon part, filtering invalid bounds
  const partBounds = geometryParts
    .map((polygonCoordinates) =>
      ctx.path.bounds(createPolygonFeature(renderableCountry.properties, polygonCoordinates))
    )
    .filter(
      (bounds) =>
        Number.isFinite(bounds?.[0]?.[0]) &&
        Number.isFinite(bounds?.[0]?.[1]) &&
        Number.isFinite(bounds?.[1]?.[0]) &&
        Number.isFinite(bounds?.[1]?.[1])
    )
    .map((bounds) => ({
      minX: bounds[0][0],
      minY: bounds[0][1],
      maxX: bounds[1][0],
      maxY: bounds[1][1],
      centerX: (bounds[0][0] + bounds[1][0]) / 2,
    }));

  if (partBounds.length < 2) {
    return {
      dx: fallbackDx,
      dy: fallbackDy,
      centerX: fallbackCenterX,
      centerY: fallbackCenterY,
    };
  }

  // 4. Compute projection metrics to handle world wrapping at date line
  const projectedEast = ctx.projection([180, 0]);
  const projectedWest = ctx.projection([-180, 0]);
  const projectedOrigin = ctx.projection([0, 0]);
  const projectedWorldWidth = Math.abs((projectedEast?.[0] ?? 0) - (projectedWest?.[0] ?? 0));

  if (!Number.isFinite(projectedWorldWidth) || projectedWorldWidth <= 0) {
    return {
      dx: fallbackDx,
      dy: fallbackDy,
      centerX: fallbackCenterX,
      centerY: fallbackCenterY,
    };
  }

  // 5. Determine shift options for wrapping parts across date line
  const mapCenterX = Number.isFinite(projectedOrigin?.[0]) ? projectedOrigin[0] : fallbackCenterX;
  const shiftOptions = [-projectedWorldWidth, 0, projectedWorldWidth];

  // 6. For each part, find optimal frame that minimizes total area
  //    6a. For each candidate anchor point
  //    6b. Find best shift for each part relative to anchor
  //    6c. Compute bounding box for shifted parts
  //    6d. Normalize center to viewport
  const candidateFrames = partBounds.map((anchor) => {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    partBounds.forEach((part) => {
      const bestShift = shiftOptions.reduce(
        (best, shift) => {
          const shiftedCenter = part.centerX + shift;
          const shiftedDistance = Math.abs(shiftedCenter - anchor.centerX);
          return shiftedDistance < best.distance ? { shift, distance: shiftedDistance } : best;
        },
        { shift: 0, distance: Number.POSITIVE_INFINITY }
      ).shift;

      minX = Math.min(minX, part.minX + bestShift);
      maxX = Math.max(maxX, part.maxX + bestShift);
      minY = Math.min(minY, part.minY);
      maxY = Math.max(maxY, part.maxY);
    });

    const rawCenterX = (minX + maxX) / 2;
    const normalizedCenterX =
      rawCenterX -
      Math.round((rawCenterX - mapCenterX) / projectedWorldWidth) * projectedWorldWidth;

    return {
      dx: maxX - minX,
      dy: maxY - minY,
      centerX: normalizedCenterX,
      centerY: (minY + maxY) / 2,
      area: (maxX - minX) * (maxY - minY),
    };
  });

  // 7. Select candidate frame with smallest area
  const bestFrame = candidateFrames.reduce((best, candidate) => {
    if (!best) {
      return candidate;
    }

    if (candidate.area < best.area) {
      return candidate;
    }

    return best;
  }, null);

  return (
    bestFrame || {
      dx: fallbackDx,
      dy: fallbackDy,
      centerX: fallbackCenterX,
      centerY: fallbackCenterY,
    }
  );
}

export function zoomToCountry(ctx, country) {
  const { actualWidth, actualHeight } = getSvgDimensions(ctx);
  const { dx, dy, centerX, centerY } = getZoomFrameMetrics(ctx, country);

  const maxScaleLimit =
    dx * dy < SMALL_COUNTRY_AREA_THRESHOLD ? ZOOM_MAX_SCALE_SMALL_COUNTRY : ZOOM_MAX_SCALE_DEFAULT;
  const normalizedSpan = Math.max(dx / actualWidth, dy / actualHeight);
  const proportionalScale =
    ZOOM_PROPORTIONAL_SCALE_FACTOR / (normalizedSpan + ZOOM_VIEWPORT_PADDING_RATIO);
  const scale = Math.max(1, Math.min(maxScaleLimit, proportionalScale));

  const translateX = actualWidth / 2 - scale * centerX;
  const translateY = actualHeight / 2 - scale * centerY;

  ctx.svg
    .transition()
    .duration(ZOOM_DURATION_MS)
    .call(ctx.zoom.transform, ctx.d3.zoomIdentity.translate(translateX, translateY).scale(scale));
}

export function showLocationHalo(ctx, country) {
  const renderableCountry = getRenderableFeature(ctx, country);
  const bounds = ctx.path.bounds(renderableCountry);
  const dx = bounds[1][0] - bounds[0][0];
  const dy = bounds[1][1] - bounds[0][1];

  if (dx < HALO_SIZE_THRESHOLD || dy < HALO_SIZE_THRESHOLD) {
    const centroid = ctx.path.centroid(renderableCountry);
    const transform = ctx.d3.zoomTransform(ctx.svg.node());
    const k = transform.k;

    const halo = ctx.g
      .append('circle')
      .attr('class', 'location-halo')
      .attr('cx', centroid[0])
      .attr('cy', centroid[1])
      .attr('r', 0)
      .style('stroke', HALO_STROKE_COLOR)
      .style('stroke-width', HALO_STROKE_WIDTH / k)
      .style('opacity', 1);

    halo
      .transition()
      .duration(HALO_DURATION_MS)
      .ease(ctx.d3.easeCircleOut)
      .attr('r', HALO_RADIUS / k)
      .style('opacity', 0)
      .remove();
  }
}
