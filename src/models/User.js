const mongoose = require("mongoose");

// Định nghĩa schema cho User (Người dùng)
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String, // Tên đăng nhập của người dùng
      sparse: true, // Cho phép null nhưng vẫn unique nếu có
      unique: true, // Không được trùng lặp
      index: true,
    },
    email: {
      type: String, // Email của người dùng
      unique: true, // Không được trùng lặp
      index: true,
    },
    password: {
      type: String, // Mật khẩu của người dùng
      select: false, // Không trả về mật khẩu trong kết quả truy vấn
    },
    displayName: {
      type: String, // Tên hiển thị của người dùng
      required: [true, "Tên hiển thị là bắt buộc"],
    },
    photoURL: { type: String, default: null }, // URL ảnh đại diện (không bắt buộc)
    providerId: {
      type: String,
      default: "password",
      enum: ["password", "google.com", "facebook.com"],
    }, // Loại provider: password, google.com, facebook.com
    providerUid: {
      type: String, // UID từ Firebase/Facebook/Google
      sparse: true, // Cho phép null nhưng vẫn unique nếu có
      unique: true, // Không được trùng lặp
    },
    isActive: { type: Boolean, default: true }, // Trạng thái hoạt động của người dùng
    accessToken: [
      {
        type: String,
      },
    ], // Lưu access tokens
    refreshToken: [
      {
        type: String,
      },
    ], // Lưu refresh tokens
  },
  {
    timestamps: true, // Tự động thêm createdAt và updatedAt
  }
);
// Tạo index cho email và username để tăng hiệu suất truy vấn
userSchema.index({ username: 1, email: 1 });
userSchema.index({ providerUid: 1 });
// Export model User
module.exports = mongoose.model("User", userSchema);
