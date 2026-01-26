// Presets definition
// Bands: 60, 170, 350, 1000, 3500, 10000

export const PRESETS = {
  // FREE
  'flat': [0, 0, 0, 0, 0, 0],
  'vocal': [-2, 2, 4, 3, 1, 0],     // Boost mids
  'guitar': [-1, 1, 3, 4, 2, 0],    // Boost high-mids
  'bass-light': [4, 2, 0, 0, 0, 0], // Gentle bass boost
  'custom': [0, 0, 0, 0, 0, 0],     // Custom user preset

  // PREMIUM
  'studio': [1, 2, -1, 2, 4, 2],    // "Perfect" curve
  'bass-pro': [8, 5, 1, 0, 0, 0],   // Heavy bass
  'gaming': [4, 2, -2, 3, 5, 4],    // Footsteps & explosions
  'cinema': [5, 3, 0, 1, 3, 5],     // V-shape (immersion)
  'edm': [6, 4, -1, 2, 4, 3],       // Punchy
  'podcast': [-2, 3, 5, 2, -1, -2], // Focus on voice
};

export const IS_PREMIUM_PRESET = (key) => {
  const free = ['flat', 'vocal', 'guitar', 'bass-light', 'custom'];
  return !free.includes(key);
};
