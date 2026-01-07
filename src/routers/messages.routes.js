const express = require("express");
const messageController = require("../controllers/messageController");

// Tạo router cho quản lý tin nhắn
const router = express.Router();

// GET /api/messages/room/:roomId/recent - Lấy tin nhắn gần đây của phòng
router.get("/room/:roomId/recent", messageController.getRecentMessages);

// POST /api/messages - Tạo tin nhắn mới
router.post("/", messageController.createMessage);

// DELETE /api/messages/:messageId - Xóa tin nhắn
router.delete("/:messageId", messageController.deleteMessage);

// Export router để sử dụng trong server.js
module.exports = router;
