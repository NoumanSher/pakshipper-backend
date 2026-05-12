import express from "express";
import cors from "cors";
import path from "path";
import colors from "colors";
import { fileURLToPath } from "url";
import ConnectDataBase from "./config/connection.js"; // MongoDB connection
import dotenv from "dotenv";
import morgan from "morgan";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
// import client from "./config/redis/redisClient.js";
import connectedRoutes from "./routes/ConnectedRoutes.js";
import { mainServerRunnig } from "./controllers/testController.js";
import { stripeWebhook } from "./controllers/stripe/stripeController.js";
import expressSession from "express-session";
import passport from "passport"; // assuming you're using ES Modules
import { globalErrorHandler } from "./middlewares/errorMiddleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
dotenv.config(); // Load environment variables
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean)
  : [];

console.log("✅ Allowed CORS Origins:", allowedOrigins);

// Ensure caching is origin-aware to prevent CORS mismatches
app.use((req, res, next) => {
  res.header("Vary", "Origin");
  next();
});

app.use(
  expressSession({
    secret: process.env.SESSION_SECRET || "keyboard cat", // use a strong secret in production
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // set to true if using HTTPS in production
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());
colors.enable();

// Serve static assets
app.use("/assets", express.static(path.join(__dirname, "assets")));
// app.use(cors());

// CORS origin validator function
const corsOriginValidator = (origin, callback) => {
  // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
  if (!origin) return callback(null, true);

  // Normalize origin by removing trailing slash
  const normalizedOrigin = origin.replace(/\/$/, "");

  if (allowedOrigins.includes(normalizedOrigin)) {
    return callback(null, true);
  }
  console.warn(`🚫 CORS blocked origin: ${origin}`);
  return callback(new Error(`CORS policy: Origin '${origin}' is not allowed.`));
};

// Only Allowed URLs
app.use(
  cors({
    origin: corsOriginValidator,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    credentials: true,
  })
);

// Handle preflight OPTIONS requests for all routes
app.options("*", cors({ origin: corsOriginValidator, credentials: true }));
// ✅ Raw body parser for Stripe webhook
app.post(
  "/api/order/webhook/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhook
);
app.use(express.json());
app.use(morgan("dev"));

// Attach routes
connectedRoutes(app);

app.use("/", mainServerRunnig);

// Global Error Handling Middleware
app.use(globalErrorHandler);

// Create HTTP server and attach Socket.IO
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins, // Replace with your actual frontend origins
    methods: ["GET", "POST"],
    // credentials: true,
  },
  transports: ["websocket", "polling"],
});

// Store io instance in app so it's accessible in controllers
app.set("io", io);

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("🟢 New client connected:", socket.id);

  // Admin can register to receive order events
  socket.on("registerAdmin", () => {
    socket.join("admins");
    console.log("🛡️ Admin registered:", socket.id);
  });

  // User can register to receive personal order updates
  socket.on("registerUser", (userId) => {
    if (userId) {
      socket.join(`user_${userId}`);
      console.log(`👤 User registered to room user_${userId}:`, socket.id);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
  });
});

// Connect to the database and then start server
try {
  await ConnectDataBase();

  const port = process.env.PORT || 3000;
  httpServer.listen(port, () => {
    console.log(
      `🚀 Server running on port ${port}\n${`http://localhost:${port}/`}`.green
        .underline
    );
  });
} catch (err) {
  console.error("❌ Server failed to start due to DB connection error:".red.bold, err);
  process.exit(1); // Exit if DB connection fails
}

// Export app
export default app;
