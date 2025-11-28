// import passport from "passport";
// import { Strategy as LinkedInStrategy } from "passport-linkedin-oauth2"; 
// import bcrypt from "bcrypt";

// import jwt from "jsonwebtoken";
// import userSchema from "../../models/user-schema.js";

// passport.use(
//   new LinkedInStrategy(
//     {
//       clientID: process.env.LINKEDIN_API_KEY,
//       clientSecret: process.env.LINKEDIN_SECRET_KEY,

//       callbackURL: "http://localhost:7418/api/auth/linkedin/callback",
//       scope: ["r_emailaddress", "r_liteprofile"],
//       state: true,
//     },
//     async (accessToken, refreshToken, profile, done) => {
//       console.log(profile);
//       try {
//         const email = profile.emails[0].value;
//         const linkedinId = profile.id;
//         const username = profile.displayName;
//         let user = await userSchema.findOne({ linkedinId });
//         if (!user) {
//           // If not found by Google ID, check if user exists by email
//           user = await userSchema.findOne({ email });

//           if (user) {
//             // Link existing user to Google account
//             user.linkedinId = linkedinId;
//             await user.save();
//           } else {
//             const hashedPassword = await bcrypt.hash(
//               process.env.SECURE_PASSWORD ||
//                 "1234567890QWERTYUI!@#$%^&*@#$%^@#$%^T",
//               10
//             );

//             // Create new user
//             user = await userSchema.create({
//               email,
//               username,
//               linkedinId,
//               password: hashedPassword, // Replace with a secure value or auth-only strategy
//             });
//           }
//         }
//         // Generate token
//         const token = jwt.sign(
//           { id: user._id, email: user.email, role: user.role },
//           process.env.SECRET_KEY,
//           { expiresIn: "1h" }
//         );
//         return done(null, { user, token });
//       } catch (error) {
//         console.error("Google Strategy Error:", error);
//         return done(error, null);
//       }
//     }
//   )
// );
// passport.serializeUser((user, done) => {
//   console.log(user.user._id);
//   done(null, user.user._id); // save user ID in session
// });

// passport.deserializeUser(async (id, done) => {
//   try {
//     const user = await userSchema.findById(id);
//     done(null, user);
//   } catch (err) {
//     done(err, null);
//   }
// });
// export default passport;
