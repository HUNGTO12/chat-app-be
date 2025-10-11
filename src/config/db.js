const mongoose = require("mongoose"); // ODM để kết nối MongoDB
require("dotenv").config(); // Load biến môi trường từ file .env

// Hàm kết nối tới MongoDB
const connectDB = async () => {
  try {
    // Kết nối tới MongoDB sử dụng connection string từ biến môi trường
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Kết nối MongoDB thành công");
  } catch (error) {
    console.error("Kết nối MongoDB thất bại: ", error);
    process.exit(1); // Thoát ứng dụng nếu kết nối thất bại
  }
};

// Export hàm connectDB để sử dụng ở nơi khác
module.exports = connectDB;
