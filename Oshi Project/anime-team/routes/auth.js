const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "anime-team-secret-key";

// In-memory user store
const users = [];

// Middleware: verify JWT token
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const token = authHeader.split(" ")[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  const { username, password, nickname } = req.body;

  if (!username || !password || !nickname) {
    return res.status(400).json({ error: "Username, password, and nickname are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  if (users.find((u) => u.username === username.toLowerCase())) {
    return res.status(409).json({ error: "Username already taken" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = {
    id: Date.now().toString(),
    username: username.toLowerCase(),
    nickname,
    password: hashedPassword,
    createdAt: new Date().toISOString(),
  };
  users.push(user);

  const token = jwt.sign({ id: user.id, username: user.username, nickname: user.nickname }, JWT_SECRET, { expiresIn: "7d" });
  return res.status(201).json({ token, nickname: user.nickname, username: user.username });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const user = users.find((u) => u.username === username.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  const token = jwt.sign({ id: user.id, username: user.username, nickname: user.nickname }, JWT_SECRET, { expiresIn: "7d" });
  return res.status(200).json({ token, nickname: user.nickname, username: user.username });
});

// GET /api/auth/me
router.get("/me", authenticate, (req, res) => {
  return res.status(200).json({ username: req.user.username, nickname: req.user.nickname });
});

module.exports = { router, authenticate };
