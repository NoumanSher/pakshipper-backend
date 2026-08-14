// ── DNS Override (centralized) ──────────────────────────────────────────────
// Fix Windows ISP DNS SRV query failure for MongoDB Atlas.
// This MUST run before any MongoDB connection is attempted.
// Kept in server.js as the single source of truth — do NOT duplicate in other modules.
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

import dotenv from "dotenv";
dotenv.config(); // Load environment variables first before other imports!

import express from "express";
import cors from "cors";
import path from "path";
import colors from "colors";
import { fileURLToPath } from "url";
import { connectToPlatformDB, getPlatformConnection, closePlatformConnection } from "./config/platformConnection.js";
import { closeAllConnections } from "./config/connectionPool.js";
import NodeCache from "node-cache";
import morgan from "morgan";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
// import client from "./config/redis/redisClient.js";
import connectedRoutes from "./routes/ConnectedRoutes.js";
import { mainServerRunnig } from "./controllers/testController.js";
import { stripeWebhook } from "./controllers/stripe/stripeController.js";
import { tenantResolver } from "./middlewares/tenantResolver.js";
import expressSession from "express-session";
import passport from "passport"; // assuming you're using ES Modules
import { globalErrorHandler } from "./middlewares/errorMiddleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const corsCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Ensure caching is origin-aware and force a refresh to clear old "www" vs "non-www" conflicts
app.use((req, res, next) => {
  res.header("Vary", "Origin");
  res.header("Cache-Control", "no-cache, no-store, must-revalidate");
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

// CORS origin validator function (Temporarily bypassed to allow all origins during development)
const corsOriginValidator = (origin, callback) => {
  return callback(null, true);
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

// Apply Tenant Resolver middleware
app.use(tenantResolver);

// Attach routes
connectedRoutes(app);

app.use("/", mainServerRunnig);

// Global Error Handling Middleware
app.use(globalErrorHandler);

// Create HTTP server and attach Socket.IO
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: corsOriginValidator, // Dynamic tenant origins
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
  socket.on("registerAdmin", (tenantId) => {
    if (tenantId) {
      socket.join(`${tenantId}:admins`);
      console.log(`🛡️ Admin registered for tenant ${tenantId}:`, socket.id);
    }
  });

  // User can register to receive personal order updates
  socket.on("registerUser", ({ tenantId, userId }) => {
    if (tenantId && userId) {
      socket.join(`${tenantId}:user_${userId}`);
      console.log(`👤 User registered to room ${tenantId}:user_${userId}:`, socket.id);
    }
  });

  // Public storefront visitors register for storefront updates (e.g. stock updates)
  socket.on("registerStorefront", (tenantId) => {
    if (tenantId) {
      socket.join(`${tenantId}:public`);
      console.log(`🛍️ Storefront visitor registered for tenant ${tenantId}:`, socket.id);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
  });
});

// Connect to the database and then start server
try {
  await connectToPlatformDB();

  // Temporary debug log to find registered tenant domains
  try {
    const platformConn = getPlatformConnection();
    const Tenant = platformConn.model("Tenant");
    const tenants = await Tenant.find({}).lean();
    console.log("🔍 [DEBUG] Current Tenants in DB:", JSON.stringify(tenants.map(t => ({ name: t.name, slug: t.slug, domains: t.domains })), null, 2));
  } catch (dbErr) {
    console.error("🔍 [DEBUG] Failed to log tenants:", dbErr);
  }

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

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
// Ensures MongoDB connections are properly closed on SIGINT (Ctrl+C) and
// SIGTERM (process manager / nodemon restart), preventing connection leaks.
let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) {
    console.log(`⚠️ Signal ${signal} received during active shutdown. Ignoring...`);
    return;
  }
  isShuttingDown = true;
  console.log(`\n⏳ Received ${signal}. Shutting down gracefully...`);

  // Force exit fallback timeout (10 seconds)
  const forceExitTimeout = setTimeout(() => {
    console.error("⚠️ Graceful shutdown timed out after 10s. Forcing exit...");
    process.exit(1);
  }, 10000);

  try {
    // 1. Stop accepting new HTTP connections
    await new Promise((resolve) => {
      httpServer.close((err) => {
        if (err && err.code !== "ERR_SERVER_NOT_RUNNING") {
          console.error("⚠️ Error closing HTTP server:", err.message);
        }
        resolve();
      });
    });

    // 2. Close all tenant MongoDB connections
    await closeAllConnections();

    // 3. Close Platform MongoDB connection
    await closePlatformConnection();

    clearTimeout(forceExitTimeout);
    console.log("✅ Graceful shutdown complete.");
    process.exit(0);
  } catch (err) {
    clearTimeout(forceExitTimeout);
    console.error("❌ Error during graceful shutdown:", err.message);
    process.exit(1);
  }
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Export app
export default app;
