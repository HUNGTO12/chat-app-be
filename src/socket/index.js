const { Server } = require("socket.io");
const { isValidObjectId } = require("mongoose");
const User = require("../models/User");

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
  const disconnectTimers = new Map(); // userId -> setTimeout ID

  // ✅ API để debug userSocketMap (chỉ dùng cho development)
  app.get("/api/debug/socket-users", (req, res) => {
    const users = Array.from(userSocketMap.entries()).map(
      ([userId, socketId]) => ({
        userId,
        socketId,
      }),
    );
    res.json({
      success: true,
      count: users.length,
      users,
    });
  });
  // Hàm xử lý kết nối Socket.IO
  io.on("connection", (socket) => {
    console.log("✅ User connected:", socket.id);

    // Lấy thông tin userId, displayName, photoURL từ query parameters
    const { userId, displayName, photoURL } = socket.handshake.query;

    const normalizedUserId = Array.isArray(userId) ? userId[0] : userId;
    // ✅ LOG để debug
    console.log("📝 Socket connection with user info:", {
      userId: normalizedUserId,
      displayName,
      photoURL,
    });
    socket.userId = normalizedUserId;
    socket.displayName = displayName || "Unknown User";
    socket.photoURL = photoURL || "";

    if (
      normalizedUserId &&
      normalizedUserId !== "undefined" &&
      normalizedUserId !== "" &&
      isValidObjectId(normalizedUserId)
    ) {
      // ✅ Cancel any pending disconnect timer for this user
      if (disconnectTimers.has(normalizedUserId)) {
        clearTimeout(disconnectTimers.get(normalizedUserId));
        disconnectTimers.delete(normalizedUserId);
        console.log(`⏱️ Cleared disconnect timer for user ${normalizedUserId}`);
      }

      const oldSocketId = userSocketMap.get(normalizedUserId);
      if (oldSocketId && oldSocketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(oldSocketId);
        if (oldSocket) {
          oldSocket.disconnect(true);
          console.log(
            `🔄 Disconnected old socket ${oldSocketId} for user ${normalizedUserId}`,
          );
        }
      }
      userSocketMap.set(normalizedUserId, socket.id);

      // ✅ Update database: set user online và thêm socketId (ASYNC/AWAIT)
      (async () => {
        try {
          const user = await User.findByIdAndUpdate(
            normalizedUserId,
            {
              isOnline: true,
              $addToSet: { socketIds: socket.id },
            },
            { new: true },
          ).select("_id displayName photoURL isOnline");

          if (user) {
            // ✅ Đợi một chút để đảm bảo database đã commit
            await new Promise((resolve) => setTimeout(resolve, 50));

            // ✅ Broadcast user:online event đến tất cả clients
            io.emit("user:online", {
              userId: user._id.toString(),
              displayName: user.displayName,
              photoURL: user.photoURL,
              isOnline: true,
            });
            console.log(
              `📢 Broadcasted user:online for ${normalizedUserId} (isOnline: ${user.isOnline})`,
            );
          }
        } catch (err) {
          console.error("❌ Error updating user online status:", err);
        }
      })();
    } else {
      console.warn(
        `⚠️ Socket ${socket.id} connected without valid Mongo userId: ${normalizedUserId}`,
      );
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
          Array.from(userSocketMap.entries()),
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
          `✅✅✅ Successfully emitted incoming-agora-call to socket ${recipientSocketId}`,
        );
        console.log(`📤 Recipient User ID: ${targetSocket.userId}`);
      } else {
        console.error(
          `❌ Target socket ${recipientSocketId} not found in io.sockets.sockets`,
        );
        console.log(
          "📋 Available sockets:",
          Array.from(io.sockets.sockets.keys()),
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

        // ✅ Delay 3 giây trước khi set offline (cho phép reconnect)
        const timerId = setTimeout(async () => {
          console.log(
            `⏱️ Checking offline status for user ${socket.userId} after 3s delay`,
          );

          try {
            // Remove socketId từ array
            const user = await User.findByIdAndUpdate(
              socket.userId,
              {
                $pull: { socketIds: socket.id },
              },
              { new: true },
            ).select("_id displayName photoURL socketIds");

            if (user) {
              // ✅ Chỉ set offline nếu không còn socketIds nào
              if (!user.socketIds || user.socketIds.length === 0) {
                const updatedUser = await User.findByIdAndUpdate(
                  socket.userId,
                  {
                    isOnline: false,
                    lastSeen: new Date(),
                  },
                  { new: true },
                ).select("_id displayName photoURL isOnline lastSeen");

                if (updatedUser) {
                  // ✅ Broadcast user:offline event
                  io.emit("user:offline", {
                    userId: updatedUser._id.toString(),
                    displayName: updatedUser.displayName,
                    photoURL: updatedUser.photoURL,
                    isOnline: false,
                    lastSeen: updatedUser.lastSeen,
                  });
                  console.log(
                    `📢 Broadcasted user:offline for ${socket.userId}`,
                  );
                }
              } else {
                console.log(
                  `✅ User ${socket.userId} still has ${user.socketIds.length} active connection(s)`,
                );
              }
            }

            // Remove timer from map
            disconnectTimers.delete(socket.userId);
          } catch (err) {
            console.error("❌ Error updating user offline status:", err);
          }
        }, 3000); // 3 giây delay

        // Store timer ID
        disconnectTimers.set(socket.userId, timerId);
        console.log(`⏱️ Set disconnect timer for user ${socket.userId}`);
      } else {
        console.log(
          `⚠️ Skip removing user ${socket.userId}, socketId mismatch`,
        );
      }
    });
  });

  app.set("io", io);
  return io;
}

module.exports = setupSocketIO;
