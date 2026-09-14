// Built-in themes for the OBS browser overlay and the OBS text source.
// Loaded as a classic script before wizard.js; exposes window.TrackCastThemes.
(function () {
  // Font keys shared with src/overlay/overlay.css (data-font) and the app stylesheet.
  const OVERLAY_FONTS = [
    { id: 'jakarta', label: 'Plus Jakarta Sans', title: "'Plus Jakarta Sans'", body: "'Inter'" },
    { id: 'inter', label: 'Inter', title: "'Inter'", body: "'Inter'" },
    { id: 'space-grotesk', label: 'Space Grotesk', title: "'Space Grotesk'", body: "'Space Grotesk'" },
    { id: 'anton', label: 'Anton', title: "'Anton'", body: "'Inter'" },
    { id: 'playfair', label: 'Playfair Display', title: "'Playfair Display'", body: "'Inter'" },
    { id: 'press-start', label: 'Press Start 2P', title: "'Press Start 2P'", body: "'Press Start 2P'" },
    { id: 'jetbrains-mono', label: 'JetBrains Mono', title: "'JetBrains Mono'", body: "'JetBrains Mono'" },
    { id: 'fredoka', label: 'Fredoka', title: "'Fredoka'", body: "'Fredoka'" },
    { id: 'system', label: 'System (Segoe UI)', title: "'Segoe UI'", body: "'Segoe UI'" },
  ];

  // Visual keys a theme sets. Layout, corner, animation, visible parts, labels and pause behavior stay untouched.
  const OVERLAY_THEME_KEYS = [
    'accent', 'accent2', 'surfaceColor', 'surfaceOpacity', 'textColor',
    'font', 'radius', 'border', 'effect', 'uppercaseTitle',
  ];

  const OVERLAY_THEMES = [
    {
      id: 'trackcast', name: 'TrackCast', vibe: 'Clean default',
      style: { accent: '#30e07a', accent2: '#2ec4ce', surfaceColor: '#0c100e', surfaceOpacity: 0.82, textColor: '#f4f7f5', font: 'jakarta', radius: 'rounded', border: 'subtle', effect: 'shadow', uppercaseTitle: false },
    },
    {
      id: 'midnight', name: 'Midnight', vibe: 'Calm and professional',
      style: { accent: '#6aa6ff', accent2: '#8f7bff', surfaceColor: '#0b1224', surfaceOpacity: 0.88, textColor: '#eef3ff', font: 'inter', radius: 'rounded', border: 'subtle', effect: 'shadow', uppercaseTitle: false },
    },
    {
      id: 'neon-arcade', name: 'Neon Arcade', vibe: 'Loud gamer energy',
      style: { accent: '#ff3ea5', accent2: '#28e7ff', surfaceColor: '#07060d', surfaceOpacity: 0.9, textColor: '#ffffff', font: 'space-grotesk', radius: 'rounded', border: 'gradient', effect: 'glow', uppercaseTitle: true },
    },
    {
      id: 'synthwave', name: 'Synthwave', vibe: 'Retro 80s sunset',
      style: { accent: '#ff5fa2', accent2: '#ff9e3d', surfaceColor: '#1a0b2e', surfaceOpacity: 0.9, textColor: '#fff2fb', font: 'anton', radius: 'rounded', border: 'gradient', effect: 'glow', uppercaseTitle: true },
    },
    {
      id: 'pixel', name: 'Pixel', vibe: 'Retro gaming',
      style: { accent: '#ffd23f', accent2: '#ff6b35', surfaceColor: '#141414', surfaceOpacity: 1, textColor: '#fffbea', font: 'press-start', radius: 'sharp', border: 'accent', effect: 'hard-shadow', uppercaseTitle: false },
    },
    {
      id: 'terminal', name: 'Terminal', vibe: 'Hacker at 3 a.m.',
      style: { accent: '#39ff7a', accent2: '#39ff7a', surfaceColor: '#020702', surfaceOpacity: 0.92, textColor: '#c8ffd8', font: 'jetbrains-mono', radius: 'sharp', border: 'accent', effect: 'glow', uppercaseTitle: false },
    },
    {
      id: 'hype', name: 'Hype', vibe: 'Sports and adrenaline',
      style: { accent: '#ff2d2d', accent2: '#ffffff', surfaceColor: '#0a0a0a', surfaceOpacity: 0.95, textColor: '#ffffff', font: 'anton', radius: 'sharp', border: 'none', effect: 'hard-shadow', uppercaseTitle: true },
    },
    {
      id: 'elegant', name: 'Elegant', vibe: 'Jazz club classy',
      style: { accent: '#8f6a1f', accent2: '#d9b45f', surfaceColor: '#fbf6ea', surfaceOpacity: 0.95, textColor: '#2a2116', font: 'playfair', radius: 'rounded', border: 'subtle', effect: 'shadow', uppercaseTitle: false },
    },
    {
      id: 'kawaii', name: 'Kawaii', vibe: 'Soft and cute',
      style: { accent: '#d63f86', accent2: '#9b7bff', surfaceColor: '#fff0f7', surfaceOpacity: 0.95, textColor: '#5a2a4a', font: 'fredoka', radius: 'pill', border: 'accent', effect: 'shadow', uppercaseTitle: false },
    },
    {
      id: 'lofi', name: 'Lo-fi', vibe: 'Chill study beats',
      style: { accent: '#e39a64', accent2: '#8fb996', surfaceColor: '#2b2420', surfaceOpacity: 0.9, textColor: '#f6e9dc', font: 'space-grotesk', radius: 'rounded', border: 'subtle', effect: 'shadow', uppercaseTitle: false },
    },
    {
      id: 'ocean', name: 'Ocean', vibe: 'Fresh and breezy',
      style: { accent: '#2de2c8', accent2: '#3aa0ff', surfaceColor: '#06212b', surfaceOpacity: 0.88, textColor: '#e8fbff', font: 'jakarta', radius: 'rounded', border: 'gradient', effect: 'shadow', uppercaseTitle: false },
    },
    {
      id: 'mono', name: 'Mono', vibe: 'Just the words',
      style: { accent: '#ffffff', accent2: '#ffffff', surfaceColor: '#000000', surfaceOpacity: 0, textColor: '#ffffff', font: 'inter', radius: 'rounded', border: 'none', effect: 'text-shadow', uppercaseTitle: false },
    },
  ];

  // Text source themes use fonts installed with Windows; OBS cannot load the app's bundled fonts.
  const TEXT_THEME_KEYS = [
    'face', 'bold', 'italic', 'uppercase', 'color', 'opacity', 'gradientColor',
    'outlineColor', 'outlineSize', 'backgroundColor', 'backgroundOpacity',
  ];

  const TEXT_THEMES = [
    {
      id: 'clean', name: 'Clean', vibe: 'Readable anywhere',
      style: { face: 'Segoe UI', bold: true, italic: false, uppercase: false, color: '#ffffff', opacity: 100, gradientColor: null, outlineColor: '#000000', outlineSize: 3, backgroundColor: '#000000', backgroundOpacity: 0 },
    },
    {
      id: 'neon', name: 'Neon', vibe: 'Cyan to magenta',
      style: { face: 'Bahnschrift', bold: true, italic: false, uppercase: false, color: '#28e7ff', opacity: 100, gradientColor: '#ff3ea5', outlineColor: '#2a0a3d', outlineSize: 4, backgroundColor: '#000000', backgroundOpacity: 0 },
    },
    {
      id: 'hype', name: 'Hype', vibe: 'Big and loud',
      style: { face: 'Impact', bold: false, italic: false, uppercase: true, color: '#ffffff', opacity: 100, gradientColor: null, outlineColor: '#d61f1f', outlineSize: 6, backgroundColor: '#000000', backgroundOpacity: 0 },
    },
    {
      id: 'terminal', name: 'Terminal', vibe: 'Green on black',
      style: { face: 'Consolas', bold: true, italic: false, uppercase: false, color: '#39ff7a', opacity: 100, gradientColor: null, outlineColor: null, outlineSize: 0, backgroundColor: '#000000', backgroundOpacity: 70 },
    },
    {
      id: 'elegant', name: 'Elegant', vibe: 'Serif italics',
      style: { face: 'Georgia', bold: false, italic: true, uppercase: false, color: '#fbf1dc', opacity: 100, gradientColor: null, outlineColor: null, outlineSize: 0, backgroundColor: '#000000', backgroundOpacity: 40 },
    },
    {
      id: 'gold', name: 'Gold', vibe: 'Heavy and shiny',
      style: { face: 'Arial Black', bold: false, italic: false, uppercase: false, color: '#ffd23f', opacity: 100, gradientColor: '#ff8a00', outlineColor: '#000000', outlineSize: 4, backgroundColor: '#000000', backgroundOpacity: 0 },
    },
    {
      id: 'kawaii', name: 'Kawaii', vibe: 'Pink with a white edge',
      style: { face: 'Segoe UI', bold: true, italic: false, uppercase: false, color: '#ff7eb6', opacity: 100, gradientColor: null, outlineColor: '#ffffff', outlineSize: 4, backgroundColor: '#000000', backgroundOpacity: 0 },
    },
    {
      id: 'subtle', name: 'Subtle', vibe: 'Quiet caption',
      style: { face: 'Segoe UI Semibold', bold: false, italic: false, uppercase: false, color: '#ffffff', opacity: 90, gradientColor: null, outlineColor: null, outlineSize: 0, backgroundColor: '#000000', backgroundOpacity: 50 },
    },
  ];

  // Windows fonts offered in the text theme editor.
  const TEXT_FACES = ['Segoe UI', 'Segoe UI Semibold', 'Bahnschrift', 'Arial', 'Arial Black', 'Impact', 'Consolas', 'Georgia', 'Verdana', 'Trebuchet MS', 'Comic Sans MS'];

  window.TrackCastThemes = Object.freeze({
    OVERLAY_FONTS,
    OVERLAY_THEME_KEYS,
    OVERLAY_THEMES,
    TEXT_THEME_KEYS,
    TEXT_THEMES,
    TEXT_FACES,
  });
})();
