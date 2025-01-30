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
  python3: { 
    engine: "python", 
    version: "3.10",
    extension: "py",
    template: code => code
  },
  java: { 
    engine: "java", 
    version: "15.0.2",  // Updated Java version
    extension: "java",
    template: code => `
public class Main {
    public static void main(String[] args) {
        ${code}
    }
}`
  },
  cpp: { 
    engine: "c++", // Changed from cpp to c++
    version: "10.2.0",
    extension: "cpp",
    template: code => `
#include <iostream>
using namespace std;

int main() {
    ${code}
    return 0;
}`
  },
  nodejs: { 
    engine: "node", // Changed from nodejs to node
    version: "15.8.0",
    extension: "js",
    template: code => code
  },
  c: { 
    engine: "c",
    version: "10.2.0",
    extension: "c",
    template: code => `
#include <stdio.h>

int main() {
    ${code}
    return 0;
}`
  },
  ruby: { 
    engine: "ruby",
    version: "3.0.0",
    extension: "rb",
    template: code => code
  },
  go: { 
    engine: "go",
    version: "1.16.2",
    extension: "go",
    template: code => `
package main

import "fmt"

func main() {
    ${code}
}`
  },
  swift: { 
    engine: "swift",
    version: "5.3.3",
    extension: "swift",
    template: code => code
  },
  rust: { 
    engine: "rust",
    version: "1.50.0",
    extension: "rs",
    template: code => `
fn main() {
    ${code}
}`
  },
  csharp: { 
    engine: "c#", // Changed from csharp to c#
    version: "5.0.201",
    extension: "cs",
    template: code => `
using System;

class Program {
    static void Main() {
        ${code}
    }
}`
  }
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

const preprocessCode = (code, language) => {
  const config = languageConfig[language];
  if (!config) return code;
  return config.template(code);
};

app.post("/compile", async (req, res) => {
  const { code, language } = req.body;
  
  const pistonLangConfig = languageConfig[language];
  if (!pistonLangConfig) {
    return res.status(400).json({ error: "Unsupported language" });
  }

  const processedCode = preprocessCode(code, language);
  
  const payload = {
    language: pistonLangConfig.engine,
    version: pistonLangConfig.version,
    files: [
      {
        name: `main.${pistonLangConfig.extension}`,
        content: processedCode,
      },
    ],
  };

  try {
    console.log("Sending code to Piston:", payload);
    const response = await axios.post("https://emkc.org/api/v2/piston/execute", payload);
    console.log("Piston response:", response.data);
    
    let output = '';
    
    // Combine stdout and stderr if both exist
    if (response.data.run.stdout) {
      output += response.data.run.stdout;
    }
    
    if (response.data.run.stderr) {
      output = output ? `${output}\nError:\n${response.data.run.stderr}` : response.data.run.stderr;
    }
    
    // Remove any surrounding quotes if they exist
    if (output.startsWith('"') && output.endsWith('"')) {
      output = output.slice(1, -1);
    }
    
    // Replace literal '\n' with actual newlines
    output = output.replace(/\\n/g, '\n');
    
    // Trim any extra whitespace
    output = output.trim();
    
    console.log("Processed output:", output);
    res.json(output);
  } catch (error) {
    console.error("Compilation error:", error.response?.data || error.message);
    res.status(500).json({ 
      error: error.response?.data?.message || "Failed to compile code"
    });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));