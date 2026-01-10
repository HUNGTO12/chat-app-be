const Friend = require("../models/Friend");
const User = require("../models/User");

// Gửi lời mời kết bạn
exports.sendFriendRequest = async (req, res) => {
  try {
    const userId = req.user._id; // Lấy từ middleware auth
    const { friendId } = req.body;

    if (!friendId) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu friendId" });
    }

    // Kiểm tra không thể kết bạn với chính mình
    if (userId.toString() === friendId) {
      return res
        .status(400)
        .json({ success: false, message: "Không thể kết bạn với chính mình" });
    }

    // Kiểm tra user tồn tại
    const friendUser = await User.findById(friendId);
    if (!friendUser) {
      return res
        .status(404)
        .json({ success: false, message: "Người dùng không tồn tại" });
    }

    // Kiểm tra xem đã có quan hệ bạn bè chưa
    const existingFriend = await Friend.findOne({
      $or: [
        { userId, friendId },
        { userId: friendId, friendId: userId },
      ],
    });

    if (existingFriend) {
      if (existingFriend.status === "accepted") {
        return res
          .status(400)
          .json({ success: false, message: "Đã là bạn bè" });
      }
      if (existingFriend.status === "pending") {
        return res
          .status(400)
          .json({ success: false, message: "Lời mời đã được gửi trước đó" });
      }
      if (existingFriend.status === "blocked") {
        return res
          .status(400)
          .json({ success: false, message: "Không thể gửi lời mời kết bạn" });
      }
    }

    // Tạo lời mời kết bạn
    const friendRequest = await Friend.create({
      userId,
      friendId,
      status: "pending",
    });

    const populatedRequest = await Friend.findById(friendRequest._id)
      .populate("userId", "displayName photoURL email")
      .populate("friendId", "displayName photoURL email");

    res.status(201).json({
      success: true,
      data: populatedRequest,
      message: "Đã gửi lời mời kết bạn",
    });
  } catch (error) {
    console.error("Lỗi gửi lời mời kết bạn:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Chấp nhận lời mời kết bạn
exports.acceptFriendRequest = async (req, res) => {
  try {
    const userId = req.user._id;
    const { requestId } = req.params;

    // Tìm lời mời kết bạn
    const friendRequest = await Friend.findById(requestId);

    if (!friendRequest) {
      return res
        .status(404)
        .json({ success: false, message: "Lời mời không tồn tại" });
    }

    // Kiểm tra xem người dùng có phải là người nhận lời mời không
    if (friendRequest.friendId.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Không có quyền thực hiện" });
    }

    // Kiểm tra trạng thái
    if (friendRequest.status !== "pending") {
      return res
        .status(400)
        .json({ success: false, message: "Lời mời không hợp lệ" });
    }

    // Cập nhật trạng thái
    friendRequest.status = "accepted";
    await friendRequest.save();

    const populatedRequest = await Friend.findById(friendRequest._id)
      .populate("userId", "displayName photoURL email")
      .populate("friendId", "displayName photoURL email");

    res.json({
      success: true,
      data: populatedRequest,
      message: "Đã chấp nhận lời mời kết bạn",
    });
  } catch (error) {
    console.error("Lỗi chấp nhận lời mời:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Từ chối lời mời kết bạn
exports.rejectFriendRequest = async (req, res) => {
  try {
    const userId = req.user._id;
    const { requestId } = req.params;

    // Tìm và xóa lời mời kết bạn
    const friendRequest = await Friend.findById(requestId);

    if (!friendRequest) {
      return res
        .status(404)
        .json({ success: false, message: "Lời mời không tồn tại" });
    }

    // Kiểm tra xem người dùng có phải là người nhận lời mời không
    if (friendRequest.friendId.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Không có quyền thực hiện" });
    }

    await Friend.findByIdAndDelete(requestId);

    res.json({
      success: true,
      message: "Đã từ chối lời mời kết bạn",
    });
  } catch (error) {
    console.error("Lỗi từ chối lời mời:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Lấy danh sách bạn bè
exports.getFriends = async (req, res) => {
  try {
    const { userId } = req.params;

    // Tìm tất cả các quan hệ bạn bè đã được chấp nhận
    const friends = await Friend.find({
      $or: [
        { userId, status: "accepted" },
        { friendId: userId, status: "accepted" },
      ],
    })
      .populate("userId", "displayName photoURL email")
      .populate("friendId", "displayName photoURL email")
      .sort({ updatedAt: -1 });

    // Format lại dữ liệu để trả về thông tin của người bạn
    const friendsList = friends.map((friend) => {
      const isUserInitiator = friend.userId._id.toString() === userId;
      const friendDetails = isUserInitiator ? friend.friendId : friend.userId;

      return {
        _id: friend._id,
        userId: friend.userId._id,
        friendId: friend.friendId._id,
        status: friend.status,
        createdAt: friend.createdAt,
        friendDetails: {
          _id: friendDetails._id,
          displayName: friendDetails.displayName,
          photoURL: friendDetails.photoURL,
          email: friendDetails.email,
        },
      };
    });

    res.json({
      success: true,
      data: friendsList,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách bạn bè:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Lấy danh sách lời mời kết bạn đang chờ
exports.getPendingRequests = async (req, res) => {
  try {
    const { userId } = req.params;

    // Tìm các lời mời đang chờ mà user là người nhận
    const pendingRequests = await Friend.find({
      friendId: userId,
      status: "pending",
    })
      .populate("userId", "displayName photoURL email")
      .populate("friendId", "displayName photoURL email")
      .sort({ createdAt: -1 });

    // Format lại dữ liệu
    const requestsList = pendingRequests.map((request) => ({
      _id: request._id,
      userId: request.userId._id,
      friendId: request.friendId._id,
      status: request.status,
      createdAt: request.createdAt,
      friendDetails: {
        _id: request.userId._id,
        displayName: request.userId.displayName,
        photoURL: request.userId.photoURL,
        email: request.userId.email,
      },
    }));

    res.json({
      success: true,
      data: requestsList,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách lời mời:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Xóa bạn bè
exports.removeFriend = async (req, res) => {
  try {
    const userId = req.user._id;
    const { friendId } = req.params;

    // Tìm và xóa quan hệ bạn bè
    const friendship = await Friend.findOneAndDelete({
      $or: [
        { userId, friendId },
        { userId: friendId, friendId: userId },
      ],
    });

    if (!friendship) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy quan hệ bạn bè" });
    }

    res.json({
      success: true,
      message: "Đã xóa bạn bè",
    });
  } catch (error) {
    console.error("Lỗi xóa bạn bè:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
