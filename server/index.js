const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const ACTIONS = require("./Actions");
const cors = require("cors");
const axios = require("axios");
const server = http.createServer(app);
require("dotenv").config();

const languageConfig = {
  python3: { engine: "python", version: "3" },
  java: { engine: "java", version: "openjdk11" },
  cpp: { engine: "cpp", version: "11" },
  nodejs: { engine: "nodejs", version: "16" },
  c: { engine: "c", version: "11" },
  ruby: { engine: "ruby", version: "3" },
  go: { engine: "go", version: "1.16" },
  scala: { engine: "scala", version: "2.13" },
  bash: { engine: "bash", version: "5" },
  sql: { engine: "sql", version: "latest" },
  pascal: { engine: "pascal", version: "3" },
  csharp: { engine: "csharp", version: "5" },
  php: { engine: "php", version: "7" },
  swift: { engine: "swift", version: "5" },
  rust: { engine: "rust", version: "1.50" },
  r: { engine: "r", version: "4.0" },
};

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const userSocketMap = {};
const getAllConnectedClients = (roomId) => {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        username: userSocketMap[socketId],
      };
    }
  );
};

io.on("connection", (socket) => {
  socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
    userSocketMap[socket.id] = username;
    socket.join(roomId);
    const clients = getAllConnectedClients(roomId);
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTIONS.JOINED, {
        clients,
        username,
        socketId: socket.id,
      });
    });
  });

  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
    socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        username: userSocketMap[socket.id],
      });
    });

    delete userSocketMap[socket.id];
    socket.leave();
  });
});

app.post("/compile", async (req, res) => {
  const { code, language } = req.body;
  
  const pistonLangConfig = languageConfig[language];
  if (!pistonLangConfig) {
    return res.status(400).json({ error: "Unsupported language" });
  }

  const payload = {
    language: pistonLangConfig.engine,
    version: pistonLangConfig.version,
    files: [
      {
        name: "code",
        content: code,
      },
    ],
  };

  try {
    const response = await axios.post("https://emkc.org/api/v2/piston/execute", payload);
    res.json(response.data.run.stdout.trim());
  } catch (error) {
    console.error("Error compiling code:", error);
    res.status(500).json({ error: "Failed to compile code" });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
