import passport from "passport";
import { Strategy as OpenIDConnectStrategy } from "passport-openidconnect";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

/**
 * Dynamically registers a LinkedIn OAuth strategy for a specific tenant.
 * Each tenant has its own LinkedIn OAuth credentials stored in their config.
 * 
 * We use a strategy name pattern: `linkedin-{tenantId}` to avoid collisions.
 */
export const createTenantLinkedInStrategy = (tenantId, linkedinConfig, tenantModels) => {
  const strategyName = `linkedin-${tenantId}`;

  // Unregister existing strategy for this tenant if it exists (refresh credentials)
  if (passport._strategies[strategyName]) {
    delete passport._strategies[strategyName];
  }

  passport.use(
    strategyName,
    new OpenIDConnectStrategy(
      {
        issuer: "https://www.linkedin.com/oauth",
        authorizationURL: "https://www.linkedin.com/oauth/v2/authorization",
        tokenURL: "https://www.linkedin.com/oauth/v2/accessToken",
        userInfoURL: "https://api.linkedin.com/v2/userinfo",
        clientID: linkedinConfig.apiKey,
        clientSecret: linkedinConfig.secretKey,
        callbackURL: linkedinConfig.callbackUrl || `http://localhost:7418/api/auth/linkedin/callback`,
        scope: ["openid", "profile", "email"],
        passReqToCallback: true,
      },
      async (req, issuer, profile, done) => {
        try {
          const User = tenantModels.User;
          const Role = tenantModels.Role;
          const email = profile.emails?.[0]?.value || profile.email;

          if (!email) {
            console.error("LinkedIn Strategy: no email returned in profile", profile);
            return done(new Error("No email returned from LinkedIn"), null);
          }

          const linkedinId = profile.id;
          const username =
            profile.displayName ||
            profile.name?.givenName + " " + profile.name?.familyName ||
            profile.given_name + " " + profile.family_name;

          let user = await User.findOne({ linkedinId }).populate("role");
          if (!user) {
            user = await User.findOne({ email }).populate("role");

            if (user) {
              user.linkedinId = linkedinId;
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
                linkedinId,
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
          console.error("LinkedIn Strategy Error:", error);
          return done(error, null);
        }
      }
    )
  );

  return strategyName;
};

export default passport;
