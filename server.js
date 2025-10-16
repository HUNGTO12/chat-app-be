const express = require("express"); // Framework web cho Node.js
const cors = require("cors"); // Cho phép chia sẻ tài nguyên giữa các domain khác nhau
const http = require("http"); // HTTP server
const { Server } = require("socket.io"); // Socket.IO
const connectDB = require("./src/config/db"); // Hàm kết nối tới MongoDB
const Router = require("./src/routers/index"); // Import các routes API

require("dotenv").config(); // Load các biến môi trường từ file .env

// Khởi tạo ứng dụng Express
const app = express();
// Tạo HTTP server
const server = http.createServer(app);
// Port để chạy server, ưu tiên từ biến môi trường hoặc mặc định 5000
const PORT = process.env.PORT || 5000;

// Cấu hình Socket.IO với CORS
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "https://chat-app-fe-three.vercel.app"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Cấu hình các Middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "https://chat-app-fe-three.vercel.app"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"], // Các phương thức được phép
    allowedHeaders: ["Content-Type", "Authorization"], // Các header được phép
    credentials: true,
  })
);
// Middleware để parse JSON data từ request body, giới hạn 10MB
app.use(express.json({ limit: "10mb" }));
// Middleware để parse URL-encoded data từ form, giới hạn 10MB
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Kết nối tới MongoDB
connectDB();

// Đăng ký các API Routes
Router(app);

// Socket.IO event handlers
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join room
  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room: ${roomId}`);
  });

  // Leave room
  socket.on("leave-room", (roomId) => {
    socket.leave(roomId);
    console.log(`Socket ${socket.id} left room: ${roomId}`);
  });

  // Send message
  socket.on("send-message", (message) => {
    console.log("New message:", message);
    // Broadcast tin nhắn đến tất cả clients trong room (trừ người gửi)
    socket.to(message.roomId).emit("receive-message", message);
  });

  // User typing
  socket.on("typing", ({ roomId, displayName }) => {
    socket.to(roomId).emit("user-typing", { displayName });
  });

  // Stop typing
  socket.on("stop-typing", ({ roomId }) => {
    socket.to(roomId).emit("user-stop-typing");
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Make io accessible to routes
app.set("io", io);

// Khởi chạy server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Socket.IO is ready`);
});
