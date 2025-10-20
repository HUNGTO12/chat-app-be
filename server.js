const express = require("express"); // Framework web cho Node.js
const cors = require("cors"); // Cho phép chia sẻ tài nguyên giữa các domain khác nhau
const http = require("http"); // HTTP server
const connectDB = require("./src/config/db"); // Hàm kết nối tới MongoDB
const Router = require("./src/routers/index"); // Import các routes API
const setupSocketIO = require("./src/socket/index"); // Hàm thiết lập Socket.IO
require("dotenv").config(); // Load các biến môi trường từ file .env

// Khởi tạo ứng dụng Express
const app = express();
// Tạo HTTP server
const server = http.createServer(app);
// Port để chạy server, ưu tiên từ biến môi trường hoặc mặc định 5000
const PORT = process.env.PORT || 5000;

// Danh sách origins được phép
const allowedOrigins = ["*"].filter(Boolean); // Loại bỏ undefined

// Thiết lập Socket.IO
setupSocketIO(server, app, allowedOrigins);

// Cấu hình các Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Cho phép requests không có origin
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes("*")) {
        return callback(null, true);
      }

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.warn(`⚠️ CORS blocked origin: ${origin}`);
        callback(null, true); // Tạm thời cho phép, sau đó đổi thành callback(new Error('Not allowed by CORS'))
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
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

// Khởi chạy server
server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🔌 Socket.IO is ready`);
});
