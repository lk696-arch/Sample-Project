require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const chatRouter = require("./routes/chat");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// API Routes
app.use("/api/chat", chatRouter);

// Serve frontend for all other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Oshi AI server running at http://localhost:${PORT}`);
});
