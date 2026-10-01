import { svg, html } from "lit-html";

const icon = (paths, extra = "") => html`<svg class="ico ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const icons = {
  day: () => icon(svg`<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>`),
  week: () => icon(svg`<rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8 3v3M16 3v3M8 13.5h2M14 13.5h2M8 17h2"/>`),
  settings: () => icon(svg`<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>`),
  method: () => icon(svg`<path d="M5 4.5h9.5L19 9v10.5H5z"/><path d="M14 4.5V9h5M8.5 13h7M8.5 16.5h5"/>`),
  prev: () => icon(svg`<path d="M14.5 6l-6 6 6 6"/>`),
  next: () => icon(svg`<path d="M9.5 6l6 6-6 6"/>`),
  check: () => html`<svg class="ico-check" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>`,
  copy: () => icon(svg`<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>`),
  download: () => icon(svg`<path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14"/>`),
  upload: () => icon(svg`<path d="M12 16V5M7 9.5l5-5 5 5M5 19.5h14"/>`),
  edit: () => icon(svg`<path d="M4.5 19.5l1-4L15.8 5.2a2 2 0 0 1 2.9 0l.1.1a2 2 0 0 1 0 2.9L8.5 18.5z"/><path d="M13.5 7.5l3 3"/>`),
  trash: () => icon(svg`<path d="M4.5 7h15M9.5 7V5h5v2M6.5 7l1 12.5h9l1-12.5M10.5 11v5M13.5 11v5"/>`),
  plus: () => icon(svg`<path d="M12 5v14M5 12h14"/>`),
  close: () => icon(svg`<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>`),
  undo: () => icon(svg`<path d="M9 14.5L4.5 10 9 5.5"/><path d="M4.5 10H15a4.5 4.5 0 0 1 0 9h-3"/>`)
};
