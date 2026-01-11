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
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["polling", "websocket"],
  });

  const userSocketMap = new Map(); // userId -> socketId

  io.on("connection", (socket) => {
    console.log("✅ User connected:", socket.id);

    // ✅ LƯU userId vào socket instance để tránh bị ghi đè
    const { userId, displayName, photoURL } = socket.handshake.query;
    socket.userId = userId;
    socket.displayName = displayName;
    socket.photoURL = photoURL;

    if (userId && userId !== "undefined" && userId !== "") {
      userSocketMap.set(userId, socket.id);
      console.log(`📝 Mapped userId ${userId} to socketId ${socket.id}`);
      console.log(`📊 Total connected users: ${userSocketMap.size}`);
      console.log(`👥 All users:`, Array.from(userSocketMap.keys()));
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
    socket.on("call-user-agora", ({ userToCall, channelName, roomId }) => {
      // ✅ SỬ DỤNG userId từ socket instance
      console.log("\n🔔 ========== VIDEO CALL REQUEST ==========");
      console.log(`📞 Caller User ID: ${socket.userId}`);
      console.log(`📞 Caller Socket ID: ${socket.id}`);
      console.log(`📞 Caller Name: ${socket.displayName}`);
      console.log(`📞 Recipient User ID: ${userToCall}`);
      console.log(`📞 Channel: ${channelName}`);
      console.log(`📞 Room ID: ${roomId}`);
      console.log(
        `📊 Available users in map:`,
        Array.from(userSocketMap.keys())
      );

      // Tìm socket ID của user nhận
      const recipientSocketId = userSocketMap.get(userToCall);

      if (!recipientSocketId) {
        console.error(`❌ User ${userToCall} not found or offline`);
        console.log(
          "🔍 UserSocketMap entries:",
          Array.from(userSocketMap.entries())
        );
        console.log("==========================================\n");
        socket.emit("call-failed", {
          message: "Người dùng không online hoặc không tìm thấy",
        });
        return;
      }

      console.log(`✅ Found recipient socket: ${recipientSocketId}`);

      // ✅ Gửi thông báo cuộc gọi với userId từ socket instance
      const callData = {
        from: socket.userId, // ✅ ĐÚNG - userId của socket hiện tại
        channelName,
        roomId,
        callerName: socket.displayName || "Unknown User",
        callerAvatar: socket.photoURL || "",
        callerId: socket.id, // ✅ THÊM callerId
      };

      // ✅ Emit đến specific socket
      const targetSocket = io.sockets.sockets.get(recipientSocketId);
      if (targetSocket) {
        console.log(`🎯 Target socket found: ${targetSocket.id}`);
        console.log(`🔌 Target socket connected: ${targetSocket.connected}`);
        targetSocket.emit("incoming-agora-call", callData);
        console.log(`✅ Direct emit to socket ${recipientSocketId} completed`);
      } else {
        console.error(
          `❌ Target socket ${recipientSocketId} not found in io.sockets.sockets`
        );
      }

      console.log(
        `📤 Emitted "incoming-agora-call" to socket ${recipientSocketId}`
      );
      console.log(`📦 Call data:`, callData);
      console.log("==========================================\n");
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

      // ✅ XÓA userId từ socket instance
      if (
        socket.userId &&
        socket.userId !== "undefined" &&
        socket.userId !== ""
      ) {
        userSocketMap.delete(socket.userId);
        console.log(`🗑️ Removed userId ${socket.userId} from map`);
        console.log(`📊 Remaining users: ${userSocketMap.size}`);
      }
    });
  });

  app.set("io", io);
  return io;
}

module.exports = setupSocketIO;
