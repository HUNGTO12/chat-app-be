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
    // Client phải emit 'join-room' sau khi connect
    socket.on("join-room", (roomId) => {
      if (!roomId) return;
      socket.join(String(roomId));
      console.log(`📍 Socket ${socket.id} joined room ${roomId}`);
      socket.emit("joined-room", { roomId, socketId: socket.id });
    });
    // Thêm đoạn này để xử lý gửi tin nhắn real-time
    socket.on("send-message", (message) => {
      if (!message || !message.roomId) return;
      // Emit tới tất cả thành viên trong phòng (bao gồm cả người gửi)
      io.to(String(message.roomId)).emit("receive-message", message);
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

  return io;
}

module.exports = setupSocketIO;
