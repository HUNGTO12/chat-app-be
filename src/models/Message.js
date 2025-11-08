const mongoose = require("mongoose");

// Định nghĩa schema cho Message (Tin nhắn)
const messageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId, // ID của người gửi tin nhắn
      ref: "User", // Tham chiếu tới model User
      required: true, // Bắt buộc
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId, // ID của phòng chat
      ref: "Room", // Tham chiếu tới model Room
      required: true, // Bắt buộc
    },
    text: {
      type: String, // Nội dung tin nhắn
      required: true, // Bắt buộc
    },
  },
  {
    timestamps: true, // Tự động thêm createdAt và updatedAt
  }
);

// Export model Message
module.exports = mongoose.model("Message", messageSchema);
