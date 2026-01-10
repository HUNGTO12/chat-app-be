const mongoose = require("mongoose");

// Định nghĩa schema cho Friend (Bạn bè)
const friendSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId, // ID của người dùng gửi lời mời
      ref: "User",
      required: true,
      index: true,
    },
    friendId: {
      type: mongoose.Schema.Types.ObjectId, // ID của người nhận lời mời
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "blocked"], // Trạng thái: chờ, chấp nhận, chặn
      default: "pending",
      index: true,
    },
  },
  {
    timestamps: true, // Tự động thêm createdAt và updatedAt
  }
);

// Index để tránh trùng lặp quan hệ bạn bè
friendSchema.index({ userId: 1, friendId: 1 }, { unique: true });

// Index để tìm kiếm nhanh
friendSchema.index({ userId: 1, status: 1 });
friendSchema.index({ friendId: 1, status: 1 });

module.exports = mongoose.model("Friend", friendSchema);
