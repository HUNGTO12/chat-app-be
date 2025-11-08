const express = require("express"); // Framework web cho Node.js
const cors = require("cors"); // Cho phép chia sẻ tài nguyên giữa các domain khác nhau
const http = require("http"); // HTTP server
const connectDB = require("./src/config/db"); // Hàm kết nối tới MongoDB
const Router = require("./src/routers/index"); // Import các routes API
const setupSocketIO = require("./src/socket/index"); // Hàm thiết lập Socket.IO
const setupCORS = require("./src/middleware/setupcors.middleware"); // Hàm thiết lập CORS và body parsers
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

// Thiết lập CORS và body parsers
setupCORS(app, allowedOrigins);

// Kết nối tới MongoDB
connectDB();

// Đăng ký các API Routes
Router(app);

// Khởi chạy server
server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🔌 Socket.IO is ready`);
});
