require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const authRouter = require("./routes/auth");
const postsRouter = require("./routes/posts");
const watchlistRouter = require("./routes/watchlist");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// API Routes
app.use("/api/auth", authRouter);
app.use("/api/posts", postsRouter);
app.use("/api/watchlist", watchlistRouter);

// Serve frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Anime Team server running at http://localhost:${PORT}`);
});

module.exports = app;
