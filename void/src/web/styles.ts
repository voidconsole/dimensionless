// src/web/styles.ts
// Injected once in the browser to make the RNW page feel like a native app:
// removes the browser's default focus outline entirely (no focus ring/border
// anywhere), and fixes cursor/tap/selection behavior.

const STYLE_ID = "void-web-styles";

const CSS = `
html, body {
  margin: 0;
  padding: 0;
  background: #060607;
  overscroll-behavior: none;
}
#root {
  min-height: 100%;
}
:focus,
:focus-visible {
  outline: none !important;
  box-shadow: none !important;
}
input,
textarea,
div,
[role="button"],
button {
  outline: none !important;
  box-shadow: none !important;
  -webkit-tap-highlight-color: transparent;
  -webkit-text-size-adjust: 100%;
}
input,
textarea {
  cursor: text;
}
[role="button"],
[tabindex="0"] {
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}
/* no visible focus ring — the app handles focus state inside its own UI */
::selection {
  background: rgba(155, 198, 255, 0.28);
  color: rgba(255, 255, 255, 0.95);
}
`;

export function injectWebStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}