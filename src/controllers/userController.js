const User = require("../models/User");
const bcrypt = require("bcryptjs");

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

exports.updateUser = async (req, res) => {
  try {
    const { password, displayName, photoURL, email } = req.body;
    const updateFields = { displayName, photoURL, email };

    if (password) {
      // Hash password nếu có cập nhật
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.password = hashedPassword;
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateFields, {
      new: true,
    }).select("-password -refreshToken");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
