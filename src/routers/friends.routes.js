const express = require("express");
const router = express.Router();
const friendController = require("../controllers/friendController");
const { authenticateToken } = require("../middleware/auth.middleware");

// Tất cả routes đều yêu cầu authentication
router.use(authenticateToken);

// POST /api/friends/request - Gửi lời mời kết bạn
router.post("/request", friendController.sendFriendRequest);

// POST /api/friends/accept/:requestId - Chấp nhận lời mời kết bạn
router.post("/accept/:requestId", friendController.acceptFriendRequest);

// POST /api/friends/reject/:requestId - Từ chối lời mời kết bạn
router.post("/reject/:requestId", friendController.rejectFriendRequest);

// GET /api/friends/:userId - Lấy danh sách bạn bè
router.get("/:userId", friendController.getFriends);

// GET /api/friends/pending/:userId - Lấy danh sách lời mời đang chờ
router.get("/pending/:userId", friendController.getPendingRequests);

// DELETE /api/friends/:friendId - Xóa bạn bè
router.delete("/:friendId", friendController.removeFriend);

module.exports = router;
