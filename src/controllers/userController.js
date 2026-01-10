const User = require("../models/User");
const bcrypt = require("bcryptjs");
const cloudinary = require("../config/cloudinary");
const { Readable } = require("stream");
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

    // Emit socket event để thông báo user đã cập nhật profile
    const io = req.app.get("io");
    if (io) {
      // Broadcast đến TẤT CẢ clients (trừ chính user này nếu muốn)
      io.emit("user-profile-updated", {
        userId: user._id.toString(),
        providerUid: user.providerUid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        email: user.email,
      });
      console.log("📢 Broadcasted user profile update:", user._id);
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        _id: user._id,
        displayName: user.displayName,
        photoURL: user.photoURL,
        email: user.email,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ THÊM: Lấy Socket ID của user
exports.getUserSocketId = async (req, res) => {
  try {
    const { userId } = req.params;

    // Lấy Map từ Socket.IO instance
    const io = req.app.get("io");
    if (!io) {
      return res.status(500).json({
        success: false,
        message: "Socket.IO not initialized",
      });
    }

    // Lấy userSocketMap từ memory
    const userSocketMap = req.app.get("userSocketMap");
    if (!userSocketMap) {
      return res.status(500).json({
        success: false,
        message: "User socket map not available",
      });
    }

    const socketId = userSocketMap.get(userId);

    if (!socketId) {
      return res.status(404).json({
        success: false,
        message: "Người dùng không online hoặc chưa kết nối socket",
      });
    }

    console.log(`✅ Socket ID for user ${userId}: ${socketId}`);

    res.json({
      success: true,
      data: { socketId },
    });
  } catch (error) {
    console.error("❌ Lỗi lấy Socket ID:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Upload ảnh đại diện
exports.uploadAvatar = async (req, res) => {
  try {
    // Kiểm tra có file không
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Không có file được upload",
      });
    }

    // Cấu hình upload lên Cloudinary
    const uploadOptions = {
      folder: "chat-app",
      resource_type: "image",
      transformation: [
        { width: 500, height: 500, crop: "limit" }, // Giới hạn kích thước
        { quality: "auto" }, // Tự động tối ưu chất lượng
      ],
    };

    // Xử lý callback sau khi upload
    const handleUploadComplete = (error, result) => {
      if (error) {
        console.error("Lỗi upload Cloudinary:", error);
        return res.status(500).json({
          success: false,
          message: "Lỗi khi upload ảnh lên Cloudinary",
          error: error.message,
        });
      }

      // Trả về URL của ảnh
      return res.json({
        success: true,
        data: { photoURL: result.secure_url },
        message: "Upload ảnh thành công",
      });
    };

    // Tạo upload stream
    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      handleUploadComplete
    );

    // Chuyển buffer thành stream và upload
    const bufferStream = new Readable();
    bufferStream.push(req.file.buffer);
    bufferStream.push(null); // Đánh dấu kết thúc stream
    bufferStream.pipe(uploadStream);
  } catch (error) {
    console.error("Lỗi upload ảnh:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ✅ THÊM: Lấy Socket ID của user
exports.getUserSocketId = async (req, res) => {
  try {
    const { userId } = req.params;
    const userSocketMap = req.app.get("userSocketMap");

    if (!userSocketMap) {
      return res.status(500).json({
        success: false,
        message: "Socket service chưa được khởi tạo",
      });
    }

    const socketId = userSocketMap.get(userId);

    if (!socketId) {
      return res.status(404).json({
        success: false,
        message: "Người dùng không online hoặc chưa kết nối socket",
      });
    }

    console.log(`✅ Socket ID for user ${userId}: ${socketId}`);
    res.json({ success: true, data: { socketId } });
  } catch (error) {
    console.error("❌ Lỗi lấy Socket ID:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
