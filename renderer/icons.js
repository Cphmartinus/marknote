/* Enkle SVG-ikoner (24x24, linjer i currentColor) */
(function () {
  const T = (x, y, s, t, w) => `<text x="${x}" y="${y}" font-size="${s}" font-weight="${w || 700}" fill="currentColor" stroke="none" font-family="Segoe UI,Arial,sans-serif">${t}</text>`;
  const badge = (t, c) => `<rect x="3.5" y="3" width="17" height="18" rx="2" stroke="${c}"/>` + T(5.2, 15.5, 7.5, t).replace('fill="currentColor"', `fill="${c}"`);
  const I = {
    new: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
    open: '<path d="M3 7h6l2 2h10v10H3z"/>',
    save: '<path d="M5 3h12l2 2v16H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
    saveas: '<path d="M5 3h12l2 2v7M5 3v18h8"/><path d="M8 3v6h8V3"/><path d="M15 21l1-4 5-5 2 2-5 5z"/>',
    undo: '<path d="M8 6L3 11l5 5"/><path d="M3 11h11a6 6 0 016 6v2"/>',
    redo: '<path d="M16 6l5 5-5 5"/><path d="M21 11H10a6 6 0 00-6 6v2"/>',
    chevup: '<path d="M6 15l6-6 6 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
    ul: '<circle cx="4.5" cy="6" r="1.3" fill="currentColor"/><circle cx="4.5" cy="12" r="1.3" fill="currentColor"/><circle cx="4.5" cy="18" r="1.3" fill="currentColor"/><path d="M9 6h12M9 12h12M9 18h12"/>',
    ol: T(2, 8, 7, '1') + T(2, 14, 7, '2') + T(2, 20, 7, '3') + '<path d="M9 6h12M9 12h12M9 18h12"/>',
    task: '<rect x="3" y="4" width="6" height="6" rx="1"/><path d="M4.3 7l1.3 1.3L8 5.7"/><rect x="3" y="14" width="6" height="6" rx="1"/><path d="M12 7h9M12 17h9"/>',
    indent: '<path d="M3 5h18M11 10h10M11 15h10M3 20h18M3 9l4 3-4 3z"/>',
    outdent: '<path d="M3 5h18M11 10h10M11 15h10M3 20h18M7 9l-4 3 4 3z"/>',
    quote: T(3, 22, 26, '”', 700),
    code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>',
    codeblock: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 9l-3 3 3 3M15 9l3 3-3 3"/>',
    table: '<rect x="3" y="4" width="18" height="16"/><path d="M3 9.5h18M3 15h18M9 4v16M15 4v16"/>',
    image: '<rect x="3" y="5" width="18" height="14"/><circle cx="8.5" cy="10" r="1.5"/><path d="M3 17l5-5 4 4 3-3 6 6"/>',
    link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
    footnote: T(3, 19, 16, 'a', 600) + T(14, 11, 10, '1', 700),
    comment: '<path d="M4 5h16v11H10l-4 4v-4H4z"/>',
    sigma: T(4, 20, 22, 'Σ', 600),
    sigma2: T(2, 18, 18, '$$', 700),
    hr: '<path d="M3 12h18M6 6h12M6 18h12" stroke-dasharray="2 2"/><path d="M3 12h18"/>',
    raw: T(1, 17, 13, '&lt;/&gt;', 700),
    split: '<rect x="3" y="4" width="18" height="16"/><path d="M12 4v16M5.5 8h4M5.5 12h4M14.5 8h4M14.5 12h4"/>',
    wysiwyg: '<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v4h4"/>' + T(7, 17, 9, 'Aa', 700),
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    pdf: badge('PDF', '#d13438'),
    docx: badge('DOC', '#2b579a'),
    html: badge('HTML', '#d6761a').replace('font-size="7.5"', 'font-size="6"'),
    md: badge('MD', '#555'),
    history: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    camera: '<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8 7l1.5-3h5L16 7"/>',
    find: '<circle cx="10" cy="10" r="6"/><path d="M15 15l6 6"/>',
    replace: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  };
  window.WDicon = (n) =>
    `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ''}</svg>`;
  document.querySelectorAll('i[data-i]').forEach((el) => (el.innerHTML = window.WDicon(el.dataset.i)));
})();
