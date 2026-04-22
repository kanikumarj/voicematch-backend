'use strict';

// NEW: [Feature 3 — Dare Mode Data]

const DARES = [
  // VOICE (15 dares)
  { id: 1,  text: "Speak only in questions for the next minute!", category: "voice", duration: 60 },
  { id: 2,  text: "Talk like a news anchor reading breaking news", category: "voice", duration: 60 },
  { id: 3,  text: "Narrate everything you're doing like a nature documentary", category: "voice", duration: 60 },
  { id: 4,  text: "Speak as slowly as humanly possible", category: "voice", duration: 45 },
  { id: 5,  text: "Talk like a robot for 60 seconds", category: "voice", duration: 60 },
  { id: 6,  text: "Speak like you're reading a bedtime story to a child", category: "voice", duration: 45 },
  { id: 7,  text: "Do your best impression of a sports commentator", category: "voice", duration: 45 },
  { id: 8,  text: "Speak using only one-syllable words", category: "voice", duration: 45 },
  { id: 9,  text: "Talk like you're explaining something to an alien", category: "voice", duration: 45 },
  { id: 10, text: "Whisper everything you say for the next minute", category: "voice", duration: 60 },
  { id: 11, text: "Speak as fast as you possibly can", category: "voice", duration: 30 },
  { id: 12, text: "Talk like a pirate for 60 seconds", category: "voice", duration: 60 },
  { id: 13, text: "Use a different accent for 60 seconds", category: "voice", duration: 60 },
  { id: 14, text: "Speak like you're giving a TED talk", category: "voice", duration: 45 },
  { id: 15, text: "Add 'and that's a fact' after every sentence", category: "voice", duration: 60 },

  // CHALLENGE (15 dares)
  { id: 16, text: "Name 10 animals in 10 seconds!", category: "challenge", duration: 20 },
  { id: 17, text: "Say the alphabet backwards as fast as you can", category: "challenge", duration: 30 },
  { id: 18, text: "Count backward from 30 without stopping", category: "challenge", duration: 35 },
  { id: 19, text: "Name 5 movies that start with the letter S", category: "challenge", duration: 20 },
  { id: 20, text: "Say 3 things you can see, 2 you can hear, 1 you can smell", category: "challenge", duration: 30 },
  { id: 21, text: "Name a country for every letter of the alphabet (skip X, Z)", category: "challenge", duration: 60 },
  { id: 22, text: "List 7 fruits in 5 seconds", category: "challenge", duration: 10 },
  { id: 23, text: "Name 5 things in your room without looking", category: "challenge", duration: 15 },
  { id: 24, text: "Describe your personality in exactly 3 words", category: "challenge", duration: 20 },
  { id: 25, text: "Name 10 foods you love in 10 seconds", category: "challenge", duration: 15 },
  { id: 26, text: "Spell your full name backwards out loud", category: "challenge", duration: 20 },
  { id: 27, text: "Name 5 TV shows, 5 movies, and 5 songs in 30 seconds", category: "challenge", duration: 35 },
  { id: 28, text: "List every country you've been to or want to visit in 20 seconds", category: "challenge", duration: 25 },
  { id: 29, text: "Say 5 things that make you happy right now", category: "challenge", duration: 20 },
  { id: 30, text: "Name 3 things that happened today in 10 seconds", category: "challenge", duration: 15 },

  // FUNNY (15 dares)
  { id: 31, text: "Tell the worst joke you know right now", category: "funny", duration: 45 },
  { id: 32, text: "Make up a fake product and advertise it", category: "funny", duration: 45 },
  { id: 33, text: "Do your best villain laugh", category: "funny", duration: 20 },
  { id: 34, text: "Explain your job as if talking to a 5-year-old", category: "funny", duration: 45 },
  { id: 35, text: "Create a rap about your morning routine right now", category: "funny", duration: 45 },
  { id: 36, text: "Give a dramatic 30-second speech about your favorite food", category: "funny", duration: 35 },
  { id: 37, text: "Pretend you just won an Oscar — give your acceptance speech", category: "funny", duration: 45 },
  { id: 38, text: "Describe a potato as if it's the most beautiful thing in the world", category: "funny", duration: 30 },
  { id: 39, text: "Make up a ridiculous conspiracy theory right now", category: "funny", duration: 45 },
  { id: 40, text: "Pretend you're selling the other person something in the room", category: "funny", duration: 40 },
  { id: 41, text: "Speak as if everything is the most shocking thing ever", category: "funny", duration: 45 },
  { id: 42, text: "Pretend you're a famous chef describing a plain piece of bread", category: "funny", duration: 35 },
  { id: 43, text: "Do your best impression of a person waking up late for work", category: "funny", duration: 30 },
  { id: 44, text: "Make animal sounds for 15 seconds and explain why", category: "funny", duration: 25 },
  { id: 45, text: "Describe your day as if it was a movie trailer", category: "funny", duration: 40 },

  // DEEP (10 dares)
  { id: 46, text: "Share one thing you've never told a stranger before", category: "deep", duration: 60 },
  { id: 47, text: "Describe your perfect day in 30 seconds", category: "deep", duration: 35 },
  { id: 48, text: "What's one weird thing you genuinely believe in?", category: "deep", duration: 45 },
  { id: 49, text: "Give life advice to your 10-year-old self", category: "deep", duration: 45 },
  { id: 50, text: "Describe your biggest fear without naming it directly", category: "deep", duration: 45 },
  { id: 51, text: "What's one thing you wish more people knew about you?", category: "deep", duration: 45 },
  { id: 52, text: "Describe success in your own words — not society's", category: "deep", duration: 45 },
  { id: 53, text: "What would you do with one completely free day?", category: "deep", duration: 40 },
  { id: 54, text: "Say something kind that you've been meaning to say", category: "deep", duration: 30 },
  { id: 55, text: "What's one goal you haven't told anyone about?", category: "deep", duration: 45 },

  // WILD (5 dares)
  { id: 56, text: "Sing the first song that comes to your mind right now", category: "wild", duration: 45 },
  { id: 57, text: "Do your best impression of your favorite animal", category: "wild", duration: 25 },
  { id: 58, text: "Pretend you're being interviewed on national TV right now", category: "wild", duration: 45 },
  { id: 59, text: "Describe a color without ever saying its name", category: "wild", duration: 30 },
  { id: 60, text: "Speak only in movie quotes for 60 seconds", category: "wild", duration: 60 },
];

function getRandomDare(usedIds = []) {
  const available = DARES.filter(d => !usedIds.includes(d.id));
  if (available.length === 0) {
    // All used — reset with just last 5 excluded
    const last5 = usedIds.slice(-5);
    const reset = DARES.filter(d => !last5.includes(d.id));
    return reset[Math.floor(Math.random() * reset.length)];
  }
  return available[Math.floor(Math.random() * available.length)];
}

module.exports = { DARES, getRandomDare };
