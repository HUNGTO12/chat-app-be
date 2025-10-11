const express = require("express"); // Framework web cho Node.js
const cors = require("cors"); // Cho phép chia sẻ tài nguyên giữa các domain khác nhau
const connectDB = require("./src/config/db"); // Hàm kết nối tới MongoDB
const Router = require("./src/routers/index"); // Import các routes API

require("dotenv").config(); // Load các biến môi trường từ file .env

// Khởi tạo ứng dụng Express
const app = express();
// Port để chạy server, ưu tiên từ biến môi trường hoặc mặc định 5000
const PORT = process.env.PORT || 5000;

// Cấu hình các Middleware
app.use(
  cors({
    origin: "*", // URL của frontend
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"], // Các phương thức được phép
    allowedHeaders: ["Content-Type", "Authorization"], // Các header được phép
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
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
