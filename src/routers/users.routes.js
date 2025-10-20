const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

// GET /api/users - Lấy tất cả users
router.get("/", userController.getAllUsers);

// GET /api/users/search?q=keyword
router.get("/search", userController.searchUsers);

// Cập nhật người dùng
router.put("/:id", userController.updateUser);

module.exports = router;
