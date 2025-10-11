const mongoose = require("mongoose");

// Định nghĩa schema cho Room (Phòng chat)
const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String, // Tên phòng chat
      required: true, // Bắt buộc
    },
    description: String, // Mô tả phòng chat (không bắt buộc)
    members: [
      {
        type: String, // Thay đổi từ ObjectId thành String để hỗ trợ cả _id và uid
      },
    ],
    createdBy: {
      type: String, // Thay đổi từ ObjectId thành String
      required: true,
    },
  },
  {
    timestamps: true, // Tự động thêm createdAt và updatedAt
  }
);

// Export model Room
module.exports = mongoose.model("Room", roomSchema);
