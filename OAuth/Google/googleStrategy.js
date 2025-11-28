import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import userSchema from "../../models/user-schema.js";
import bcrypt from "bcrypt";

import jwt from "jsonwebtoken";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:7418/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const googleId = profile.id;
        const username = profile.displayName;
        let user = await userSchema.findOne({ googleId });
        if (!user) {
          // If not found by Google ID, check if user exists by email
          user = await userSchema.findOne({ email });

          if (user) {
            // Link existing user to Google account
            user.googleId = googleId;
            await user.save();
          } else {
            const hashedPassword = await bcrypt.hash(
              process.env.SECURE_PASSWORD ||
                "1234567890QWERTYUI!@#$%^&*@#$%^@#$%^T",
              10
            );

            // Create new user
            user = await userSchema.create({
              email,
              username,
              googleId,
              password: hashedPassword, // Replace with a secure value or auth-only strategy
            });
          }
        }
        // Generate token
        const token = jwt.sign(
          { id: user._id, email: user.email, role: user.role },
          process.env.SECRET_KEY,
          { expiresIn: "1h" }
        );
        return done(null, { user, token });
      } catch (error) {
        console.error("Google Strategy Error:", error);
        return done(error, null);
      }
    }
  )
);
passport.serializeUser((user, done) => {
  console.log(user.user._id);
  done(null, user.user._id); // save user ID in session
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await userSchema.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
export default passport;
