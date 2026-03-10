const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const upload = require("../middleware/upload.middleware");

// GET /api/users - Lấy tất cả users
router.get("/", userController.getAllUsers);

// GET /api/users/search?q=keyword
router.get("/search", userController.searchUsers);

// ✅ Route này phải ĐẶT TRƯỚC /:id để tránh conflict
// GET /api/users/socket/:userId - Lấy Socket ID của user
router.get("/socket/:userId", userController.getUserSocketId);

// ✅ GET /api/users/online - Lấy danh sách users đang online
router.get("/online", userController.getOnlineUsers);

// ✅ POST /api/users/batch-status - Batch check status nhiều users
router.post("/batch-status", userController.getBatchUserStatus);

// POST /api/users/upload-avatar - Upload ảnh đại diện
router.post(
  "/upload-avatar",
  upload.single("avatar"),
  userController.uploadAvatar,
);

// Cập nhật người dùng
router.put("/:id", userController.updateUser);

// ✅ GET /api/users/:userId/status - Lấy status của 1 user cụ thể
router.get("/:userId/status", userController.getUserStatus);

module.exports = router;
