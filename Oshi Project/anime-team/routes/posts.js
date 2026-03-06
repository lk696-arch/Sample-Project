const express = require("express");
const { authenticate } = require("./auth");

const router = express.Router();

// In-memory stores
const posts = [];
const comments = {};

// GET /api/posts
router.get("/", (req, res) => {
  const sorted = [...posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const result = sorted.map((p) => ({
    ...p,
    comments: comments[p.id] || [],
    commentCount: (comments[p.id] || []).length,
  }));
  return res.status(200).json(result);
});

// POST /api/posts
router.post("/", authenticate, (req, res) => {
  const { title, content, anime } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: "Title and content are required" });
  }

  const post = {
    id: Date.now().toString(),
    title,
    content,
    anime: anime || "",
    author: req.user.nickname,
    username: req.user.username,
    createdAt: new Date().toISOString(),
  };
  posts.push(post);
  comments[post.id] = [];

  return res.status(201).json(post);
});

// DELETE /api/posts/:id
router.delete("/:id", authenticate, (req, res) => {
  const index = posts.findIndex((p) => p.id === req.params.id && p.username === req.user.username);
  if (index === -1) {
    return res.status(404).json({ error: "Post not found or not authorized" });
  }
  posts.splice(index, 1);
  delete comments[req.params.id];
  return res.status(200).json({ message: "Post deleted" });
});

// GET /api/posts/:id/comments
router.get("/:id/comments", (req, res) => {
  return res.status(200).json(comments[req.params.id] || []);
});

// POST /api/posts/:id/comments
router.post("/:id/comments", authenticate, (req, res) => {
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ error: "Comment content is required" });
  }
  if (!comments[req.params.id]) {
    return res.status(404).json({ error: "Post not found" });
  }

  const comment = {
    id: Date.now().toString(),
    content,
    author: req.user.nickname,
    username: req.user.username,
    createdAt: new Date().toISOString(),
  };
  comments[req.params.id].push(comment);
  return res.status(201).json(comment);
});

module.exports = router;
