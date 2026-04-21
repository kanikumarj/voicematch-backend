const adjectives = [
  'Silent', 'Purple', 'Cosmic', 'Neon', 'Shadow',
  'Golden', 'Mystic', 'Blazing', 'Electric', 'Lunar',
  'Calm', 'Wild', 'Swift', 'Bold', 'Gentle',
  'Fierce', 'Quiet', 'Bright', 'Dark', 'Vivid'
];

const nouns = [
  'Tiger', 'Fox', 'Eagle', 'Wolf', 'Panda',
  'Phoenix', 'Falcon', 'Lynx', 'Raven', 'Cobra',
  'Owl', 'Bear', 'Shark', 'Lion', 'Hawk',
  'Viper', 'Otter', 'Crane', 'Bison', 'Manta'
];

export const generateAnonymousName = () => {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj} ${noun}`;
};
