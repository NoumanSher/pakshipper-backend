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
// import passport from "passport"; // assuming you're using ES Modules

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
dotenv.config(); // Load environment variables
const allowedOrigins = process.env.CORS_ORIGINS?.split(",") || [];

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

// app.use(passport.initialize());
// app.use(passport.session());
colors.enable();

// Serve static assets
app.use("/assets", express.static(path.join(__dirname, "assets")));
// app.use(cors());

// Only Allowed URLs
app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
}));
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

// Create HTTP server and attach Socket.IO
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "http://localhost:3001", // Replace with your actual frontend origins
    methods: ["GET", "POST"],
    credentials: true,
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

  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
  });
});

// Start server
const port = process.env.PORT || 3000;
httpServer.listen(port, () => {
  console.log(
    `🚀 Server running on port ${port}\n${`http://localhost:${port}/`}`.green
      .underline
  );
});

// Connect to the database
ConnectDataBase().catch((err) => {
  console.error("❌ Database connection failed:", err);
});

// Export app
export default app;
