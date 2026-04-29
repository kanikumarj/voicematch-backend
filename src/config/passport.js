const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { findOrCreateGoogleUser } = require('../../modules/auth/auth.service');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'missing_client_id';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'missing_client_secret';

if (GOOGLE_CLIENT_ID === 'missing_client_id') {
  console.warn('⚠️ WARNING: GOOGLE_CLIENT_ID is missing. Google OAuth will not work.');
}

passport.use(new GoogleStrategy({
  clientID     : GOOGLE_CLIENT_ID,
  clientSecret : GOOGLE_CLIENT_SECRET,
  callbackURL  : '/api/auth/google/callback',
  proxy        : true
},
async (accessToken, refreshToken, profile, done) => {
  try {
    const user = await findOrCreateGoogleUser({
      googleId   : profile.id,
      email      : profile.emails && profile.emails[0] ? profile.emails[0].value : null,
      displayName: profile.displayName,
      avatar     : profile.photos && profile.photos[0] ? profile.photos[0].value : null
    });
    done(null, user);
  } catch (err) {
    done(err, null);
  }
}));

module.exports = passport;
