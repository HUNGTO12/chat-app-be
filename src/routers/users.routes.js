const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const upload = require("../middleware/upload.middleware");

// GET /api/users - Lấy tất cả users
router.get("/", userController.getAllUsers);

// GET /api/users/search?q=keyword
router.get("/search", userController.searchUsers);

// POST /api/users/upload-avatar - Upload ảnh đại diện
router.post("/upload-avatar", upload.single("avatar"), userController.uploadAvatar);

// Cập nhật người dùng
router.put("/:id", userController.updateUser);

module.exports = router;
