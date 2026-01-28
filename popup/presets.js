// Presets definition
// FREE bands: [60, 170, 350, 1000, 3500, 10000]
// PREMIUM bands: [20, 40, 60, 100, 170, 250, 350, 500, 1000, 2000, 3500, 5000, 7000, 10000, 16000]

export const PRESETS = {
  // FREE - 6 bands
  'flat': [0, 0, 0, 0, 0, 0],
  'vocal': [-2, 2, 4, 3, 1, 0],     // Boost mids
  'guitar': [-1, 1, 3, 4, 2, 0],    // Boost high-mids
  'bass-light': [4, 2, 0, 0, 0, 0], // Gentle bass boost
  'custom': [0, 0, 0, 0, 0, 0],     // Custom user preset

  // PREMIUM - 15 bands (Expanded from free presets)
  'studio': [1, 1, 1, 2, -1, 0, 0, 2, 2, 1, 4, 3, 1, 2, 1],       // Perfect mastering curve
  'bass-pro': [8, 6, 5, 3, 1, 0, 0, 0, -1, -2, 0, 0, 0, 0, 0],    // Heavy bass with control
  'gaming': [3, 2, 4, 2, -2, 0, 1, 2, 3, 4, 5, 4, 2, 2, 1],        // Footsteps & explosions
  'cinema': [4, 3, 5, 2, 0, -1, 0, 1, 1, 2, 3, 4, 4, 5, 3],        // V-shape immersion
  'edm': [5, 4, 6, 3, -1, 0, 1, 2, 2, 3, 4, 3, 2, 1, 2],           // Punchy club sound
  'podcast': [-3, -2, 2, 5, 4, 2, 1, 0, -1, 0, -1, -2, -1, -2, -3], // Focus on voice (100Hz-3kHz)
};

export const IS_PREMIUM_PRESET = (key) => {
  const free = ['flat', 'vocal', 'guitar', 'bass-light', 'custom'];
  return !free.includes(key);
};
