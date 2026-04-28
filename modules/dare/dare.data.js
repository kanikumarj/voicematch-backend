'use strict';

// FIX: [Area 3] Complete Tamil/Thanglish dare data — 80 dares across 9 categories

const DARES = [

  // ============================================
  // CATEGORY: 🎵 MUSIC DIRECTORS
  // ============================================
  {
    id: 1,
    text: "ARR oda favourite song oru line paadunga! (Wrong notes ok, confidence matters 😂)",
    category: "music",
    icon: "🎵",
    duration: 45,
    hint: "Rehman sir approve pannuvaar!"
  },
  {
    id: 2,
    text: "Yuvan oda style la oru sad song create pannunga — 'Neeye en kaadhal, neeye en aayul...' type!",
    category: "music",
    icon: "🎵",
    duration: 45,
    hint: "Yuvan era begin!"
  },
  {
    id: 3,
    text: "Anirudh oda kuthu song mathiri 'Enjoy Enjaami' style la oru beat rap pannunga!",
    category: "music",
    icon: "🎵",
    duration: 40,
    hint: "Dhee dhee dhee!"
  },
  {
    id: 4,
    text: "Harris Jayaraj oda melody mathiri — eyes close panni 30 seconds hum pannunga!",
    category: "music",
    icon: "🎵",
    duration: 35,
    hint: "Jasmine flower..."
  },
  {
    id: 5,
    text: "Vijay Antony oda style la your name la oru song title create pannunga!",
    category: "music",
    icon: "🎵",
    duration: 30,
    hint: "Naan... [your name]!"
  },
  {
    id: 6,
    text: "D. Imman oda devotional style la 'VoiceMatch is the best app' nu paadunga!",
    category: "music",
    icon: "🎵",
    duration: 40,
    hint: "Endrume pugazh!"
  },
  {
    id: 7,
    text: "Ilaiyaraaja sir oda classic 80s melody style la oru dialogue paadunga!",
    category: "music",
    icon: "🎵",
    duration: 45,
    hint: "Isaignani vibes!"
  },
  {
    id: 8,
    text: "GV Prakash oda college anthem style la today's plans paadunga!",
    category: "music",
    icon: "🎵",
    duration: 40,
    hint: "College rock vibes!"
  },
  {
    id: 9,
    text: "Sid Sriram voice attempt pannunga — any melody, but with full emotion!",
    category: "music",
    icon: "🎵",
    duration: 45,
    hint: "Kannaana Kanney style!"
  },
  {
    id: 10,
    text: "Two different music directors — ARR vs Yuvan — oru line each sing pannunga!",
    category: "music",
    icon: "🎵",
    duration: 50,
    hint: "Epic battle begins!"
  },

  // ============================================
  // CATEGORY: 🎬 MOVIES
  // ============================================
  {
    id: 11,
    text: "Vijay sir oda 'Mersal' dialogue 'Inaiku naan doctor' — full emotion la sollunga!",
    category: "movies",
    icon: "🎬",
    duration: 30,
    hint: "Thalapathy mode on!"
  },
  {
    id: 12,
    text: "Rajinikanth style la oru coin toss pannunga — neenga illamal just sound effects!",
    category: "movies",
    icon: "🎬",
    duration: 25,
    hint: "Kabali style!"
  },
  {
    id: 13,
    text: "Vikram sir oda Kaithi character la — no words, only expressions describe pannunga!",
    category: "movies",
    icon: "🎬",
    duration: 35,
    hint: "Ghost oda intensity!"
  },
  {
    id: 14,
    text: "96 movie la Ram and Jaanu scene — oru character choose pannunga, dialogue sollunga!",
    category: "movies",
    icon: "🎬",
    duration: 45,
    hint: "Nostalgia hit aagum!"
  },
  {
    id: 15,
    text: "Suriya oda Jai Bhim la oru court argument scene dialogue improvise pannunga!",
    category: "movies",
    icon: "🎬",
    duration: 45,
    hint: "Justice for all!"
  },
  {
    id: 16,
    text: "Dhanush oda Asuran character la — oppressed anger feeling express pannunga, no violence!",
    category: "movies",
    icon: "🎬",
    duration: 40,
    hint: "Raw emotion time!"
  },
  {
    id: 17,
    text: "Karthik Subbaraj movie la hidden meaning explain pannunga — 'Iraivi' scene choice unggalukku!",
    category: "movies",
    icon: "🎬",
    duration: 50,
    hint: "Director's cut!"
  },
  {
    id: 18,
    text: "Soorarai Pottru la Maara character oda 'Naan oru naal' speech improvise pannunga!",
    category: "movies",
    icon: "🎬",
    duration: 45,
    hint: "Sky is not the limit!"
  },
  {
    id: 19,
    text: "Tamil movie villain la neenga — hero kikku solrating kudukkaama threats pannunga!",
    category: "movies",
    icon: "🎬",
    duration: 40,
    hint: "Best villain award!"
  },
  {
    id: 20,
    text: "Vinnaithaandi Varuvaayaa la Karthik oda 'Jessie' call scene improvise pannunga!",
    category: "movies",
    icon: "🎬",
    duration: 45,
    hint: "VTV feels incoming!"
  },

  // ============================================
  // CATEGORY: 🏏 CRICKET
  // ============================================
  {
    id: 21,
    text: "Dhoni's last over — ball by ball commentary pannunga, enna la enna score!",
    category: "cricket",
    icon: "🏏",
    duration: 50,
    hint: "Finish like a boss!"
  },
  {
    id: 22,
    text: "Virat Kohli celebration act pannunga — every six hit la different celebration!",
    category: "cricket",
    icon: "🏏",
    duration: 35,
    hint: "King Kohli energy!"
  },
  {
    id: 23,
    text: "IPL auction la neenga auctioneer — your own name bid pannunga, value sollunga!",
    category: "cricket",
    icon: "🏏",
    duration: 40,
    hint: "Sold for 20 crores!"
  },
  {
    id: 24,
    text: "Rohit Sharma la neenga — 'Hitman' style la pressure situation calm-a handle pannunga!",
    category: "cricket",
    icon: "🏏",
    duration: 35,
    hint: "Mumbai Indians captain!"
  },
  {
    id: 25,
    text: "India vs Pakistan match last over — 10 runs needed, ball by ball act pannunga!",
    category: "cricket",
    icon: "🏏",
    duration: 50,
    hint: "Heart attack match!"
  },
  {
    id: 26,
    text: "CSK fan or RCB fan — defend your team la 30 seconds speech pannunga!",
    category: "cricket",
    icon: "🏏",
    duration: 35,
    hint: "Yellove or RCBEE?"
  },
  {
    id: 27,
    text: "Ravindra Jadeja fielding — full slow motion describe pannunga the impossible catch!",
    category: "cricket",
    icon: "🏏",
    duration: 40,
    hint: "Sir Jadeja enters!"
  },
  {
    id: 28,
    text: "Cricket commentator la neenga — Ajay Jadeja style Tamil commentary pannunga!",
    category: "cricket",
    icon: "🏏",
    duration: 45,
    hint: "Enna koduma sir ithu!"
  },
  {
    id: 29,
    text: "World Cup 2011 final — Dhoni's winning six — as commentator express pannunga!",
    category: "cricket",
    icon: "🏏",
    duration: 40,
    hint: "India lift the cup!"
  },
  {
    id: 30,
    text: "Neenga team selector — India squad announce pannunga, reason sollunga each pick la!",
    category: "cricket",
    icon: "🏏",
    duration: 50,
    hint: "BCCI chairman vibes!"
  },

  // ============================================
  // CATEGORY: 🎌 ANIME
  // ============================================
  {
    id: 31,
    text: "Do Naruto's 'Believe it!' catchphrase and explain your ninja way in 30 seconds!",
    category: "anime",
    icon: "🍃",
    duration: 35,
    hint: "What is your nindo?"
  },
  {
    id: 32,
    text: "Explain the Nen system from Hunter x Hunter as if teaching someone for the first time!",
    category: "anime",
    icon: "⚡",
    duration: 45,
    hint: "Gon and Killua style!"
  },
  {
    id: 33,
    text: "Do your best Levi Ackerman impression — stoic, serious, cleaning reference allowed!",
    category: "anime",
    icon: "⚔️",
    duration: 30,
    hint: "Humanity's strongest soldier!"
  },
  {
    id: 34,
    text: "Goku powering up to Super Saiyan — do the sound and describe the transformation!",
    category: "anime",
    icon: "💫",
    duration: 25,
    hint: "It's over 9000!"
  },
  {
    id: 35,
    text: "You're Light Yagami — convince someone you're justice without revealing the Death Note!",
    category: "anime",
    icon: "📓",
    duration: 45,
    hint: "I am justice!"
  },
  {
    id: 36,
    text: "Explain Tanjiro's Water Breathing form as if you're actually performing it!",
    category: "anime",
    icon: "🌊",
    duration: 35,
    hint: "Constant Flux!"
  },
  {
    id: 37,
    text: "Be Gojo Sensei explaining Infinity to a student — include 'Throughout Heaven and Earth'!",
    category: "anime",
    icon: "♾️",
    duration: 40,
    hint: "The honored one!"
  },
  {
    id: 38,
    text: "Describe your favorite anime in 30 seconds as a movie trailer!",
    category: "anime",
    icon: "🎬",
    duration: 35,
    hint: "Make it epic!"
  },
  {
    id: 39,
    text: "One Piece — you just found the One Piece. What do you say to your crew?",
    category: "anime",
    icon: "🏴‍☠️",
    duration: 40,
    hint: "Pirate King speech!"
  },
  {
    id: 40,
    text: "You're Lelouch — give a Geass command to your call partner right now!",
    category: "anime",
    icon: "👁️",
    duration: 30,
    hint: "I, Lelouch vi Britannia, command you..."
  },

  // ============================================
  // CATEGORY: 📺 SERIES
  // ============================================
  {
    id: 41,
    text: "Breaking Bad la 'I am the one who knocks' — neenga Walter White!",
    category: "series",
    icon: "📺",
    duration: 30,
    hint: "Say my name!"
  },
  {
    id: 42,
    text: "Money Heist la Professor oda heist plan Tamil la explain pannunga!",
    category: "series",
    icon: "📺",
    duration: 50,
    hint: "Bella Ciao!"
  },
  {
    id: 43,
    text: "Squid Game la 456 la neenga — why you want to win explain pannunga!",
    category: "series",
    icon: "📺",
    duration: 40,
    hint: "Red light green light!"
  },
  {
    id: 44,
    text: "Game of Thrones la 'Winter is coming' — Tamil climate change la apply pannunga!",
    category: "series",
    icon: "📺",
    duration: 35,
    hint: "Stark words!"
  },
  {
    id: 45,
    text: "Panchayat series la Phulera village problems Tamil la translate pannunga!",
    category: "series",
    icon: "📺",
    duration: 45,
    hint: "Village life vibes!"
  },
  {
    id: 46,
    text: "Mirzapur la Kaleen bhaiya la neenga — anyone who disagrees kku response pannunga!",
    category: "series",
    icon: "📺",
    duration: 35,
    hint: "UP vibes!"
  },
  {
    id: 47,
    text: "Scam 1992 la Harshad Mehta oda confidence — neenga aana pitch pannunga!",
    category: "series",
    icon: "📺",
    duration: 45,
    hint: "Big bull energy!"
  },
  {
    id: 48,
    text: "The Office la Michael Scott la neenga — terrible motivational speech pannunga!",
    category: "series",
    icon: "📺",
    duration: 40,
    hint: "Dundler Mifflin!"
  },
  {
    id: 49,
    text: "Dark series la time travel explain pannunga — Tamil la simply!",
    category: "series",
    icon: "📺",
    duration: 50,
    hint: "Knoten vibes!"
  },
  {
    id: 50,
    text: "Friends la 'How you doin?' — Tamil slang la translate pannunga, use it!",
    category: "series",
    icon: "📺",
    duration: 25,
    hint: "Joey style!"
  },

  // ============================================
  // CATEGORY: 😄 THANGLISH FUNNY
  // ============================================
  {
    id: 51,
    text: "Auto uncle la neenga — customer bargain pannapo neenga how react pannuveenga!",
    category: "funny",
    icon: "😄",
    duration: 40,
    hint: "Meter podama pogalaam!"
  },
  {
    id: 52,
    text: "Amma kitta phone charge full aagala nu lie sollunga — convince pannunga!",
    category: "funny",
    icon: "😄",
    duration: 35,
    hint: "Excuse master!"
  },
  {
    id: 53,
    text: "Bus la window seat kedaikala — express your frustration without bad words!",
    category: "funny",
    icon: "😄",
    duration: 30,
    hint: "Window seat life!"
  },
  {
    id: 54,
    text: "Chennai summer la AC illama train journey — describe your experience!",
    category: "funny",
    icon: "😄",
    duration: 40,
    hint: "47 degree vibes!"
  },
  {
    id: 55,
    text: "Boss kitta salary hike kekkareenga — roleplay pannunga!",
    category: "funny",
    icon: "😄",
    duration: 45,
    hint: "Courage time!"
  },
  {
    id: 56,
    text: "Thenga biscuit mathiri oru boring thing la 30 seconds exciting-a describe pannunga!",
    category: "funny",
    icon: "😄",
    duration: 35,
    hint: "Marketing skills!"
  },
  {
    id: 57,
    text: "Tamil meme la neenga — 'Enna kodumai sir ithu' situation create pannunga!",
    category: "funny",
    icon: "😄",
    duration: 40,
    hint: "Meme lord!"
  },
  {
    id: 58,
    text: "Your worst traffic experience Chennai la — 30 seconds describe pannunga!",
    category: "funny",
    icon: "😄",
    duration: 35,
    hint: "Potholes and all!"
  },
  {
    id: 59,
    text: "Saravana stores sale la neenga — customer-a or salesman-a? Role pannunga!",
    category: "funny",
    icon: "😄",
    duration: 40,
    hint: "Offer ponga!"
  },
  {
    id: 60,
    text: "Filter coffee vs instant coffee — defend your choice la 30 seconds!",
    category: "funny",
    icon: "😄",
    duration: 35,
    hint: "Coffee wars!"
  },

  // ============================================
  // CATEGORY: 💭 DEEP (Tamil style)
  // ============================================
  {
    id: 61,
    text: "Unnoda life la oru turning point — friend-ku solvamaari sollunga!",
    category: "deep",
    icon: "💭",
    duration: 60,
    hint: "Real talk time!"
  },
  {
    id: 62,
    text: "Neenga school la dream-a think panna — ippo enna aageenga? Compare pannunga!",
    category: "deep",
    icon: "💭",
    duration: 50,
    hint: "Life happened!"
  },
  {
    id: 63,
    text: "Un life la oru regret — lesson aaa convert pannunga, sollunga!",
    category: "deep",
    icon: "💭",
    duration: 50,
    hint: "Growth mindset!"
  },
  {
    id: 64,
    text: "Kaalathu kaalathu endrum kadamai — what's YOUR duty in life? Sollunga!",
    category: "deep",
    icon: "💭",
    duration: 45,
    hint: "Purpose driven!"
  },
  {
    id: 65,
    text: "Neenga 80 years-la neenga aana — current self-ku enna advice solluveeenga?",
    category: "deep",
    icon: "💭",
    duration: 50,
    hint: "Wise elder vibes!"
  },
  {
    id: 66,
    text: "Life-la oru superpower irundha — enna choose pannuveenga, why?",
    category: "deep",
    icon: "💭",
    duration: 40,
    hint: "Be honest!"
  },
  {
    id: 67,
    text: "Yaarum illatha one hour kedaichaa — exact-a enna panuveenga sollunga!",
    category: "deep",
    icon: "💭",
    duration: 40,
    hint: "True self reveal!"
  },
  {
    id: 68,
    text: "Un life-la oru person — without them neenga different-a irundhuveeenga. Sollunga!",
    category: "deep",
    icon: "💭",
    duration: 50,
    hint: "Impact matters!"
  },

  // ============================================
  // CATEGORY: 🎯 CHALLENGES
  // ============================================
  {
    id: 69,
    text: "Tamil movie name la letter A dha start aaganum — 60 seconds la many as possible!",
    category: "challenge",
    icon: "🎯",
    duration: 65,
    hint: "Adhagappattathu?"
  },
  {
    id: 70,
    text: "ARR songs 10 title 15 seconds la sollunga — correct-a!",
    category: "challenge",
    icon: "🎯",
    duration: 20,
    hint: "Speed round!"
  },
  {
    id: 71,
    text: "IPL teams all 10 — jersey color describe pannunga without name sollaama!",
    category: "challenge",
    icon: "🎯",
    duration: 45,
    hint: "Cricket quiz!"
  },
  {
    id: 72,
    text: "Vijay movies title — 20 sollunga 30 seconds la — ONLY titles!",
    category: "challenge",
    icon: "🎯",
    duration: 35,
    hint: "Thalapathy fan test!"
  },
  {
    id: 73,
    text: "Anime character names 15 — 20 seconds la sollunga!",
    category: "challenge",
    icon: "🎯",
    duration: 25,
    hint: "Weeb speed test!"
  },
  {
    id: 74,
    text: "Tamil foods 20 — desserts only — 30 seconds la!",
    category: "challenge",
    icon: "🎯",
    duration: 35,
    hint: "Sweet tooth test!"
  },
  {
    id: 75,
    text: "Countries starting with 'I' — 60 seconds la how many?",
    category: "challenge",
    icon: "🎯",
    duration: 65,
    hint: "Geography master!"
  },
  {
    id: 76,
    text: "Tamil Nadu districts 20 — 45 seconds la!",
    category: "challenge",
    icon: "🎯",
    duration: 50,
    hint: "Local knowledge test!"
  },
  {
    id: 77,
    text: "Indian cricketers who scored 100+ ODI centuries — list pannunga!",
    category: "challenge",
    icon: "🎯",
    duration: 45,
    hint: "Cricket stats test!"
  },

  // ============================================
  // CATEGORY: 🌟 WILDCARD
  // ============================================
  {
    id: 78,
    text: "Konjam neram 'Enthiran' Chitti robot la neenga — act pannunga!",
    category: "wild",
    icon: "🌟",
    duration: 40,
    hint: "Rajini + Robot!"
  },
  {
    id: 79,
    text: "Oru Tamil wedding MC la neenga — announce pannunga this VoiceMatch call!",
    category: "wild",
    icon: "🌟",
    duration: 45,
    hint: "Kalyanam ah!"
  },
  {
    id: 80,
    text: "SunTV serial villain la neenga — evil laugh + monologue pannunga!",
    category: "wild",
    icon: "🌟",
    duration: 40,
    hint: "Mega serial vibes!"
  }
];

// FIX: [Area 3] Category metadata with colors
const CATEGORY_INFO = {
  music:     { label: '🎵 Music Directors', color: '#7C3AED' },
  movies:    { label: '🎬 Movies',          color: '#EF4444' },
  cricket:   { label: '🏏 Cricket',         color: '#10B981' },
  anime:     { label: '🎌 Anime',           color: '#F59E0B' },
  series:    { label: '📺 Series',          color: '#3B82F6' },
  funny:     { label: '😄 Thanglish Funny', color: '#EC4899' },
  deep:      { label: '💭 Deep Talk',       color: '#6366F1' },
  challenge: { label: '🎯 Challenge',       color: '#F97316' },
  wild:      { label: '🌟 Wildcard',        color: '#14B8A6' }
};

// FIX: [Area 3] Updated getRandomDare with category preference
function getRandomDare(usedIds = [], preferredCategory = null) {
  let pool = DARES.filter(d => !usedIds.includes(d.id));

  if (pool.length === 0) {
    // Reset — exclude only last 10
    const recent = usedIds.slice(-10);
    pool = DARES.filter(d => !recent.includes(d.id));
  }

  if (preferredCategory) {
    const categoryPool = pool.filter(d => d.category === preferredCategory);
    if (categoryPool.length > 0) pool = categoryPool;
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = { DARES, CATEGORY_INFO, getRandomDare };
