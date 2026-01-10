const { Server } = require("socket.io");

function setupSocketIO(server, app, allowedOrigins = []) {
  const allowAll =
    Array.isArray(allowedOrigins) && allowedOrigins.includes("*");

  const io = new Server(server, {
    cors: {
      origin: allowAll ? true : allowedOrigins,
      methods: ["GET", "POST", "PUT", "DELETE"],
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

    // ==================== CHAT EVENTS ====================
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

    // ==================== VIDEO CALL EVENTS ====================

    // 📞 Gửi lời mời video call
    socket.on("call-user", ({ userToCall, signalData, from, roomId }) => {
      console.log(`📞 [VIDEO CALL] Call from ${from} to ${userToCall}`);
      console.log(`   Signal:`, signalData);
      console.log(`   Room ID:`, roomId);

      // Emit đến người nhận (sử dụng socket ID)
      io.to(userToCall).emit("incoming-call", {
        signal: signalData,
        from,
        roomId,
        callerName: socket.handshake.query?.displayName || "Unknown",
        callerAvatar: socket.handshake.query?.photoURL || "",
      });

      console.log(`✅ Sent incoming-call to ${userToCall}`);
    });

    // ✅ Chấp nhận video call
    socket.on("accept-call", ({ signal, to }) => {
      console.log(`✅ [VIDEO CALL] Call accepted from ${socket.id} to ${to}`);
      io.to(to).emit("call-accepted", signal);
    });

    // ❌ Từ chối video call
    socket.on("reject-call", ({ to }) => {
      console.log(`❌ [VIDEO CALL] Call rejected by ${socket.id}`);
      io.to(to).emit("call-rejected");
    });

    // 📴 Kết thúc video call
    socket.on("end-call", ({ to }) => {
      console.log(`📴 [VIDEO CALL] Call ended by ${socket.id}`);
      io.to(to).emit("call-ended");
    });

    // 🧊 Gửi ICE candidate
    socket.on("ice-candidate", ({ candidate, to }) => {
      console.log(`🧊 [VIDEO CALL] ICE candidate from ${socket.id} to ${to}`);
      io.to(to).emit("ice-candidate", { candidate, from: socket.id });
    });

    // ==================== DISCONNECT ====================
    socket.on("disconnect", (reason) => {
      console.log(`❌ Socket disconnected: ${socket.id}, reason: ${reason}`);
    });
  });

  return io;
}

module.exports = setupSocketIO;
