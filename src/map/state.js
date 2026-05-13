import { safeId } from './utils.js';

function getCountryDisplayName(countryOrName) {
  return (
    countryOrName?.properties?.displayName ??
    countryOrName?.properties?.name ??
    String(countryOrName ?? '') ??
    ''
  );
}

// Mark and reset country states (target, solved, wrong)
// ============================================================================

export function resetRoundState(ctx) {
  ctx.g.selectAll('.location-halo').remove();
  ctx.g
    .selectAll('.country')
    .interrupt()
    .style('fill', null)
    .style('stroke', null)
    .classed('target', false)
    .classed('correct', false)
    .classed('wrong', false);
}

export function markTarget(ctx, country) {
  ctx.g.select('#' + safeId(getCountryDisplayName(country))).classed('target', true);
}

export function markSolved(ctx, country) {
  ctx.g
    .select('#' + safeId(getCountryDisplayName(country)))
    .classed('target', false)
    .classed('correct', true);
}

export function markWrong(ctx, countryOrName) {
  const element = ctx.g.select('#' + safeId(getCountryDisplayName(countryOrName)));
  element
    .interrupt()
    .classed('wrong', true)
    .transition()
    .duration(800)
    .style('fill', 'var(--wrong-persist)')
    .style('stroke', 'var(--wrong-persist-str)');
}
