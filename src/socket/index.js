const { Server } = require("socket.io");

function setupSocketIO(server, app, allowedOrigins = []) {
  const allowAll =
    Array.isArray(allowedOrigins) && allowedOrigins.includes("*");

  const io = new Server(server, {
    cors: {
      origin: allowAll ? true : allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["polling", "websocket"],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // QUAN TRỌNG: Gán io lên app để controller có thể lấy
  if (app && typeof app.set === "function") {
    app.set("io", io);
  }

  io.on("connection", (socket) => {
    console.log(`✅ Socket connected: ${socket.id}`);

    // Client phải emit 'join-room' sau khi connect
    socket.on("join-room", (roomId) => {
      if (!roomId) return;
      socket.join(String(roomId));
      console.log(`📍 Socket ${socket.id} joined room ${roomId}`);
      socket.emit("joined-room", { roomId, socketId: socket.id });
    });

    socket.on("leave-room", (roomId) => {
      if (!roomId) return;
      socket.leave(String(roomId));
      console.log(`👋 Socket ${socket.id} left room ${roomId}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`❌ Socket disconnected: ${socket.id}, reason: ${reason}`);
    });

    socket.on("error", (error) => {
      console.error(`🚨 Socket error for ${socket.id}:`, error);
    });
  });

  console.log("🔌 Socket.IO initialized");
  return io;
}

module.exports = setupSocketIO;
