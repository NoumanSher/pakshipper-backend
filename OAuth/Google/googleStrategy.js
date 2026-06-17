import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

/**
 * Dynamically registers a Google OAuth strategy for a specific tenant.
 * Each tenant has its own Google OAuth credentials stored in their config.
 * 
 * We use a strategy name pattern: `google-{tenantId}` to avoid collisions.
 */
export const createTenantGoogleStrategy = (tenantId, googleConfig, tenantModels) => {
  const strategyName = `google-${tenantId}`;

  // Unregister existing strategy for this tenant if it exists (refresh credentials)
  if (passport._strategies[strategyName]) {
    delete passport._strategies[strategyName];
  }

  passport.use(
    strategyName,
    new GoogleStrategy(
      {
        clientID: googleConfig.clientId,
        clientSecret: googleConfig.clientSecret,
        // Use shared backend callback URL — tenant identification is handled
        // via the OAuth "state" parameter, not the callback URL itself.
        callbackURL: process.env.GOOGLE_CALLBACK_URL || `http://localhost:7418/api/auth/google/callback`,
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const User = tenantModels.User;
          const Role = tenantModels.Role;
          const email = profile.emails[0].value;
          const googleId = profile.id;
          const username = profile.displayName;

          let user = await User.findOne({ googleId }).populate("role");
          if (!user) {
            user = await User.findOne({ email }).populate("role");

            if (user) {
              user.googleId = googleId;
              await user.save();
            } else {
              const hashedPassword = await bcrypt.hash(
                process.env.SECURE_PASSWORD || "1234567890QWERTYUI!@#$%^&*@#$%^@#$%^T",
                10
              );

              // Get default customer role
              const customerRole = await Role.findOne({ name: "customer" });

              user = await User.create({
                email,
                username,
                googleId,
                password: hashedPassword,
                role: customerRole?._id,
              });
              user = await User.findById(user._id).populate("role");
            }
          }

          const token = jwt.sign(
            {
              id: user._id,
              email: user.email,
              role: user.role?.name || "customer",
              roleLevel: user.role?.level || 0,
            },
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

  return strategyName;
};

// Serialize/deserialize remain generic — they just store user ID in session
passport.serializeUser((data, done) => {
  const id = data?.user?._id || data?._id;
  done(null, id);
});

passport.deserializeUser(async (id, done) => {
  // Deserialization requires tenant context which isn't available here.
  // For session-less OAuth (session: false), this is fine as a no-op passthrough.
  done(null, { _id: id });
});

export default passport;
