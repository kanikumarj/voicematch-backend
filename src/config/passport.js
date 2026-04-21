const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { findOrCreateGoogleUser } = require('../../modules/auth/auth.service');

passport.use(new GoogleStrategy({
  clientID     : process.env.GOOGLE_CLIENT_ID,
  clientSecret : process.env.GOOGLE_CLIENT_SECRET,
  callbackURL  : `${process.env.SERVER_URL}/api/auth/google/callback`
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
