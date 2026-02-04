const { Server } = require("socket.io");

function setupSocketIO(server, app, allowedOrigins = []) {
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes("*")) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          console.warn(`⚠️ CORS blocked origin: ${origin}`);
          callback(null, true);
        }
      },
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true,
    },
    transports: ["polling", "websocket"],
  });

  const userSocketMap = new Map(); // userId -> socketId

  // ✅ API để debug userSocketMap (chỉ dùng cho development)
  app.get("/api/debug/socket-users", (req, res) => {
    const users = Array.from(userSocketMap.entries()).map(
      ([userId, socketId]) => ({
        userId,
        socketId,
      })
    );
    res.json({
      success: true,
      count: users.length,
      users,
    });
  });

  io.on("connection", (socket) => {
    console.log("✅ User connected:", socket.id);

    // ✅ LƯU userId vào socket instance để tránh bị ghi đè
    const { userId, displayName, photoURL } = socket.handshake.query;
    // ✅ LOG để debug
    console.log("📝 Socket connection with user info:", {
      userId,
      displayName,
      photoURL,
    });
    socket.userId = userId;
    socket.displayName = displayName || "Unknown User";
    socket.photoURL = photoURL || "";

    if (userId && userId !== "undefined" && userId !== "") {
      const oldSocketId = userSocketMap.get(userId);
      if (oldSocketId && oldSocketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(oldSocketId);
        if (oldSocket) {
          oldSocket.disconnect(true);
          console.log(
            `🔄 Disconnected old socket ${oldSocketId} for user ${userId}`
          );
        }
      }
      userSocketMap.set(userId, socket.id);
    } else {
      console.warn(`⚠️ Socket ${socket.id} connected without valid userId`);
    }

    // ==================== JOIN ROOM ====================
    socket.on("join-room", (roomId) => {
      socket.join(roomId);
      console.log(`📍 User ${socket.id} joined room: ${roomId}`);
      socket.to(roomId).emit("joined-room", { socketId: socket.id, roomId });
    });

    // ==================== LEAVE ROOM ====================
    socket.on("leave-room", (roomId) => {
      socket.leave(roomId);
      console.log(`📤 User ${socket.id} left room: ${roomId}`);
    });

    // ==================== VIDEO CALL EVENTS ====================
    socket.on("initiate-agora-call", ({ to, channelName, roomId }) => {
      // Tìm socket ID của user nhận
      const recipientSocketId = userSocketMap.get(to);

      if (!recipientSocketId) {
        console.error(`❌ User ${to} not found in userSocketMap`);
        console.log(
          "📋 Current userSocketMap:",
          Array.from(userSocketMap.entries())
        );
        socket.emit("call-failed", {
          message: "Người dùng không online hoặc không tìm thấy",
        });
        return;
      }

      console.log(`✅ Found recipient socket: ${recipientSocketId}`);

      // ✅ Gửi thông báo cuộc gọi với userId từ socket instance
      const callData = {
        from: socket.userId,
        channelName,
        roomId,
        callerName: socket.displayName || "Unknown User",
        callerAvatar: socket.photoURL || "",
        callerId: socket.id,
      };

      console.log("📦 Call data to send:", JSON.stringify(callData, null, 2));

      // ✅ Emit đến specific socket
      const targetSocket = io.sockets.sockets.get(recipientSocketId);
      if (targetSocket) {
        targetSocket.emit("incoming-agora-call", callData);
        console.log(
          `✅✅✅ Successfully emitted incoming-agora-call to socket ${recipientSocketId}`
        );
        console.log(`📤 Recipient User ID: ${targetSocket.userId}`);
      } else {
        console.error(
          `❌ Target socket ${recipientSocketId} not found in io.sockets.sockets`
        );
        console.log(
          "📋 Available sockets:",
          Array.from(io.sockets.sockets.keys())
        );
        socket.emit("call-failed", {
          message: "Không thể kết nối đến người nhận",
        });
      }
    });

    socket.on("accept-agora-call", ({ to, channelName }) => {
      const recipientSocketId = userSocketMap.get(to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("call-accepted", { channelName });
        console.log(`✅ Call accepted, notified ${recipientSocketId}`);
      }
    });

    socket.on("reject-agora-call", ({ to }) => {
      const recipientSocketId = userSocketMap.get(to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("call-rejected");
        console.log(`❌ Call rejected, notified ${recipientSocketId}`);
      }
    });

    socket.on("end-agora-call", ({ to }) => {
      const recipientSocketId = userSocketMap.get(to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("call-ended");
        console.log(`🔴 Call ended, notified ${recipientSocketId}`);
      }
    });

    // ==================== DISCONNECT ====================
    socket.on("disconnect", () => {
      console.log("❌ User disconnected:", socket.id);

      if (socket.userId && userSocketMap.get(socket.userId) === socket.id) {
        userSocketMap.delete(socket.userId);
        console.log(`🗑️ Removed user ${socket.userId} from map`);
      } else {
        console.log(
          `⚠️ Skip removing user ${socket.userId}, socketId mismatch`
        );
      }
    });
  });

  app.set("io", io);
  return io;
}

module.exports = setupSocketIO;
