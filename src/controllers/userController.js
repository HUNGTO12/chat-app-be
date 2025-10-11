const User = require("../models/User");

// Tìm kiếm user theo query q (email | username | displayName - không phân biệt hoa thường)
exports.searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu tham số q" });
    }

    const regex = new RegExp(q.trim(), "i");

    const users = await User.find(
      {
        $or: [{ email: regex }, { username: regex }, { displayName: regex }],
      },
      "uid email username displayName photoURL"
    )
      .limit(20)
      .sort({ updatedAt: -1 });

    res.json({ success: true, data: users });
  } catch (error) {
    console.error("Lỗi search user:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Lấy danh sách tất cả users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find(
      {},
      "_id uid email username displayName photoURL"
    )
      .limit(100)
      .sort({ updatedAt: -1 });

    res.json({ success: true, data: users });
  } catch (error) {
    console.error("Lỗi lấy danh sách users:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
