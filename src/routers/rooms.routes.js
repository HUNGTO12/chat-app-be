const express = require("express");
const roomController = require("../controllers/roomController");

// Tạo router cho quản lý phòng chat
const router = express.Router();

// GET /api/rooms/user/:id - Lấy danh sách phòng của một user
router.get("/user/:id", roomController.getRooms);

// GET /api/rooms/:roomId - Lấy thông tin phòng theo ID
router.get("/:roomId", roomController.getRoomById);

// POST /api/rooms - Tạo phòng chat mới
router.post("/", roomController.createRoom);

// POST /api/rooms/:roomId/join - Tham gia phòng chat
router.post("/:roomId/join", roomController.joinRoom);

// Export router để sử dụng trong server.js
module.exports = router;
