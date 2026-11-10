// Shared look for every control ApplyW adds to the new-style page's filter bar (Hide
// Applied/Viewed, Language, Keywords). That page styles its chips entirely with hashed
// atomic-CSS class names that change on every LinkedIn build — a copied snapshot of them
// once went stale and left the toggles as bare native checkboxes — so nothing here depends
// on a LinkedIn class name.
export function styleNewStylePill(pill: HTMLButtonElement, isSelected: boolean): void {
  Object.assign(pill.style, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    height: '32px',
    marginRight: '8px',
    padding: '0 12px',
    font: 'inherit',
    fontSize: '14px',
    fontWeight: '600',
    lineHeight: '20px',
    whiteSpace: 'nowrap',
    borderRadius: '16px',
    cursor: 'pointer',
    color: 'inherit',
    // Neutral grey and a translucent fill rather than fixed colours: this bar renders on
    // both LinkedIn's light and dark themes and nothing here knows which one is active.
    // Selected state is carried by the heavier border and the fill together, so it still
    // reads if one of them is washed out by whatever is behind the bar.
    border: isSelected ? '1px solid currentColor' : '1px solid rgba(128, 128, 128, 0.6)',
    background: isSelected ? 'rgba(128, 128, 128, 0.25)' : 'transparent',
    boxShadow: isSelected ? 'inset 0 0 0 1px currentColor' : 'none'
  })
}

// The legacy page's caret comes from LinkedIn's own SVG sprite (#caret-small), which the
// new-style page doesn't ship, so the dropdown pills there draw their own.
export function createChevronIcon(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('width', '12')
  svg.setAttribute('height', '12')
  svg.setAttribute('viewBox', '0 0 12 12')
  const path = document.createElementNS(ns, 'path')
  path.setAttribute('d', 'M2 4.5 L6 8.5 L10 4.5')
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', 'currentColor')
  path.setAttribute('stroke-width', '1.6')
  svg.appendChild(path)
  return svg
}
