/**
 * Beamer Presenter - Configuration Module
 * Manages application settings and state
 */

export const CONFIG = {
  // Default settings
  defaults: {
    location: 'right',  // right, left, top, bottom
    split: 0.5,         // Split ratio
    scale: 2.0,         // Render scale multiplier (higher = sharper but more memory)
    showNextPreview: true,
    timerAutoStart: false,
  },

  // Session ID for window communication
  sessionId: crypto.randomUUID(),

  // Message types for postMessage
  messageTypes: {
    HELLO: 'HELLO',
    STATE: 'STATE',
    NAVIGATE: 'NAVIGATE',
    MODE: 'MODE',
    PDF_DATA: 'PDF_DATA',
    ERROR: 'ERROR',
    POINTER: 'POINTER',  // Laser pointer position
  },

  // Display modes
  displayModes: {
    NORMAL: 'normal',
    BLACK: 'black',
    WHITE: 'white',
  },

  // Keyboard shortcuts
  shortcuts: {
    next: ['Space', 'ArrowRight', 'PageDown'],
    prev: ['ArrowLeft', 'PageUp'],
    first: ['Home'],
    last: ['End'],
    fullscreen: ['KeyF'],
  },
};

/**
 * Application State
 */
export const AppState = {
  // PDF state
  pdfDoc: null,
  pdfData: null,  // ArrayBuffer for sharing
  pdfUrl: null,   // URL for sharing (if loaded via URL)
  totalPages: 0,
  currentPage: 1,

  // Settings
  location: CONFIG.defaults.location,
  split: CONFIG.defaults.split,
  scale: CONFIG.defaults.scale,
  showNextPreview: CONFIG.defaults.showNextPreview,

  // Display
  displayMode: CONFIG.displayModes.NORMAL,

  // Audience window
  audienceWindow: null,
  isAudienceConnected: false,

  // Timer
  timerState: 'stopped',  // stopped, running, paused
  timerStartTime: null,
  timerElapsed: 0,

  // Cache for rendered pages
  pageCache: new Map(),
};

/**
 * Get region coordinates based on location setting
 * @param {number} width - Full page width
 * @param {number} height - Full page height
 * @param {string} location - Notes location (right, left, top, bottom)
 * @param {number} split - Split ratio (0-1)
 * @returns {{ audience: {x, y, w, h}, notes: {x, y, w, h} }}
 */
export function getRegions(width, height, location = 'right', split = 0.5) {
  const regions = {
    audience: { x: 0, y: 0, w: 0, h: 0 },
    notes: { x: 0, y: 0, w: 0, h: 0 },
  };

  switch (location) {
    case 'right':
      // Audience on left, notes on right
      regions.audience = { x: 0, y: 0, w: width * split, h: height };
      regions.notes = { x: width * split, y: 0, w: width * (1 - split), h: height };
      break;
    case 'left':
      // Notes on left, audience on right
      regions.notes = { x: 0, y: 0, w: width * split, h: height };
      regions.audience = { x: width * split, y: 0, w: width * (1 - split), h: height };
      break;
    case 'top':
      // Notes on top, audience on bottom
      regions.notes = { x: 0, y: 0, w: width, h: height * split };
      regions.audience = { x: 0, y: height * split, w: width, h: height * (1 - split) };
      break;
    case 'bottom':
      // Audience on top, notes on bottom
      regions.audience = { x: 0, y: 0, w: width, h: height * split };
      regions.notes = { x: 0, y: height * split, w: width, h: height * (1 - split) };
      break;
  }

  return regions;
}
