import passport from "passport";
import { Strategy as OpenIDConnectStrategy } from "passport-openidconnect";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import userSchema from "../../models/user-schema.js";

passport.use(
  "linkedin",
  new OpenIDConnectStrategy(
    {
      issuer: "https://www.linkedin.com/oauth",
      authorizationURL: "https://www.linkedin.com/oauth/v2/authorization",
      tokenURL: "https://www.linkedin.com/oauth/v2/accessToken",
      userInfoURL: "https://api.linkedin.com/v2/userinfo",
      clientID: process.env.LINKEDIN_API_KEY,
      clientSecret: process.env.LINKEDIN_SECRET_KEY,
      callbackURL:
        process.env.LINKEDIN_CALLBACK_URL ||
        "http://localhost:7418/api/auth/linkedin/callback",
      scope: ["openid", "profile", "email"],
    },
    async (issuer, profile, done) => {
      console.log("LinkedIn Profile:", profile);
      try {
        const email = profile.emails?.[0]?.value || profile.email;

        if (!email) {
          console.error(
            "LinkedIn Strategy: no email returned in profile",
            profile
          );
          return done(new Error("No email returned from LinkedIn"), null);
        }

        const linkedinId = profile.id;
        const username =
          profile.displayName ||
          profile.name?.givenName + " " + profile.name?.familyName ||
          profile.given_name + " " + profile.family_name;

        let user = await userSchema.findOne({ linkedinId });

        if (!user) {
          user = await userSchema.findOne({ email });

          if (user) {
            user.linkedinId = linkedinId;
            await user.save();
          } else {
            const hashedPassword = await bcrypt.hash(
              process.env.SECURE_PASSWORD ||
                "1234567890QWERTYUI!@#$%^&*@#$%^@#$%^T",
              10
            );

            user = await userSchema.create({
              email,
              username,
              linkedinId,
              password: hashedPassword,
            });
          }
        }

        const token = jwt.sign(
          { id: user._id, email: user.email, role: user.role },
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

passport.serializeUser((user, done) => {
  try {
    const id = user?.user?._id || user?._id;
    if (id) console.log(id);
    done(null, id);
  } catch (err) {
    done(err, null);
  }
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
