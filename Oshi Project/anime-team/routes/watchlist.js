const express = require("express");
const { authenticate } = require("./auth");

const router = express.Router();

// Shared team watchlist
const watchlist = [];

// GET /api/watchlist
router.get("/", (req, res) => {
  const sorted = [...watchlist].sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
  return res.status(200).json(sorted);
});

// POST /api/watchlist
router.post("/", authenticate, (req, res) => {
  const { title, genre, status, notes } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Anime title is required" });
  }

  const item = {
    id: Date.now().toString(),
    title,
    genre: genre || "",
    status: status || "Watching", // Watching | Completed | Plan to Watch
    notes: notes || "",
    addedBy: req.user.nickname,
    username: req.user.username,
    addedAt: new Date().toISOString(),
  };
  watchlist.push(item);
  return res.status(201).json(item);
});

// DELETE /api/watchlist/:id
router.delete("/:id", authenticate, (req, res) => {
  const index = watchlist.findIndex((w) => w.id === req.params.id && w.username === req.user.username);
  if (index === -1) {
    return res.status(404).json({ error: "Item not found or not authorized" });
  }
  watchlist.splice(index, 1);
  return res.status(200).json({ message: "Removed from watchlist" });
});

module.exports = router;
