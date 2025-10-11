const Message = require("../models/Message");
const Room = require("../models/Room");
const User = require("../models/User");

// Lấy tin nhắn của một phòng chat (có phân trang)
exports.getMessages = async (req, res) => {
  try {
    const { roomId } = req.params; // Lấy roomId từ URL
    const { page = 1, limit = 50 } = req.query; // Lấy tham số phân trang từ query string

    // Kiểm tra xem phòng có tồn tại không
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phòng chat",
      });
    }

    // Tính số tin nhắn cần bỏ qua để phân trang
    const skip = (page - 1) * limit;

    // Lấy tin nhắn của phòng
    const messages = await Message.find({ roomId })
      .sort({ createdAt: 1 }) // Sắp xếp từ cũ tới mới
      .skip(skip) // Bỏ qua số tin nhắn đã hiển thị ở trang trước
      .limit(parseInt(limit)) // Giới hạn số tin nhắn trả về
      .select("-__v"); // Loại bỏ field __v

    // Đếm tổng số tin nhắn
    const totalMessages = await Message.countDocuments({ roomId });

    res.json({
      success: true,
      data: messages,
      pagination: {
        currentPage: parseInt(page), // Trang hiện tại
        totalPages: Math.ceil(totalMessages / limit), // Tổng số trang
        totalMessages, // Tổng số tin nhắn
        hasMore: skip + messages.length < totalMessages, // Còn tin nhắn nữa không
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy tin nhắn:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Lấy tin nhắn gần đây của một phòng chat
exports.getRecentMessages = async (req, res) => {
  try {
    const { roomId } = req.params; // Lấy roomId từ URL
    const { limit = 20 } = req.query; // Giới hạn số tin nhắn, mặc định 20

    // Kiểm tra xem phòng có tồn tại không
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phòng chat",
      });
    }

    // Lấy tin nhắn mới nhất
    const messages = await Message.find({ roomId })
      .sort({ createdAt: -1 }) // Sắp xếp từ mới tới cũ
      .limit(parseInt(limit)) // Giới hạn số lượng
      .select("-__v"); // Loại bỏ field __v

    // Populate thông tin user cho mỗi tin nhắn
    const messagesWithUserInfo = await Promise.all(
      messages.map(async (message) => {
        // Tìm user theo uid hoặc _id
        let user = await User.findOne({ uid: message.uid });
        if (!user) {
          // Nếu không tìm thấy theo uid, thử tìm theo _id
          user = await User.findById(message.uid);
        }
        return {
          ...message.toObject(),
          // Sử dụng thông tin từ DB nếu có, không thì dùng thông tin trong message
          displayName: user?.displayName || message.displayName,
          photoURL: user?.photoURL || message.photoURL,
        };
      })
    );

    // Đảo ngược để hiển thị từ cũ tới mới
    messagesWithUserInfo.reverse();

    res.json({
      success: true,
      data: messagesWithUserInfo,
      count: messagesWithUserInfo.length, // Số lượng tin nhắn
    });
  } catch (error) {
    console.error("Lỗi khi lấy tin nhắn gần đây:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Tạo tin nhắn mới
exports.createMessage = async (req, res) => {
  try {
    const { text, roomId, uid, displayName, photoURL } = req.body; // Lấy dữ liệu từ request body

    // Kiểm tra các trường bắt buộc
    if (!text || !roomId || !uid) {
      return res.status(400).json({
        success: false,
        message: "Nội dung tin nhắn, ID phòng và UID người dùng là bắt buộc",
      });
    }

    // Kiểm tra xem phòng có tồn tại không
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phòng chat",
      });
    }

    // Tìm user theo uid hoặc _id
    let user = await User.findOne({ uid });
    if (!user) {
      // Nếu không tìm thấy theo uid, thử tìm theo _id
      user = await User.findById(uid);
    }
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    // Kiểm tra xem user có phải thành viên của phòng không (kiểm tra cả _id và uid)
    const userIdString = user._id.toString();
    const isUserMember =
      room.members.includes(userIdString) ||
      room.members.includes(uid) ||
      (user.uid && room.members.includes(user.uid));

    if (!isUserMember) {
      return res.status(403).json({
        success: false,
        message: "Người dùng không phải thành viên của phòng này",
      });
    }

    // Lấy thông tin user (đã fetch ở trên)
    const userDisplayName = displayName || user.displayName;
    const userPhotoURL = photoURL || user.photoURL;

    // Tạo tin nhắn mới
    const message = new Message({
      text,
      roomId,
      userId: user._id, // Thêm userId (ObjectId) - required field
      uid: user.uid || user._id.toString(), // Sử dụng uid của Firebase hoặc _id của user thường
      displayName: userDisplayName,
      photoURL: userPhotoURL,
    });

    await message.save(); // Lưu tin nhắn vào database

    // Cập nhật thời gian cập nhật của phòng
    room.updatedAt = new Date();
    await room.save();

    res.status(201).json({
      success: true,
      data: message,
      message: "Tạo tin nhắn thành công",
    });
  } catch (error) {
    console.error("Lỗi khi tạo tin nhắn:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Lấy tin nhắn theo ID
exports.getMessageById = async (req, res) => {
  try {
    const { messageId } = req.params; // Lấy messageId từ URL

    // Tìm tin nhắn theo ID
    const message = await Message.findById(messageId).select("-__v");

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tin nhắn",
      });
    }

    res.json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error("Lỗi khi lấy tin nhắn theo ID:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Cập nhật tin nhắn
exports.updateMessage = async (req, res) => {
  try {
    const { messageId } = req.params; // Lấy messageId từ URL
    const { text, uid } = req.body; // Lấy nội dung mới và uid từ request body

    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Nội dung tin nhắn là bắt buộc",
      });
    }

    // Tìm tin nhắn theo ID
    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tin nhắn",
      });
    }

    // Tìm user để so sánh ownership
    let user = await User.findOne({ uid });
    if (!user) {
      user = await User.findById(uid);
    }

    // Chỉ tác giả tin nhắn mới được cập nhật
    if (message.uid !== uid && message.uid !== user?._id?.toString()) {
      return res.status(403).json({
        success: false,
        message: "Chỉ tác giả tin nhắn mới có quyền cập nhật",
      });
    }

    // Cập nhật nội dung tin nhắn
    message.text = text;
    message.updatedAt = new Date();
    await message.save(); // Lưu thay đổi

    res.json({
      success: true,
      data: message,
      message: "Cập nhật tin nhắn thành công",
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật tin nhắn:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Xóa tin nhắn
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params; // Lấy messageId từ URL
    const { uid } = req.body; // Lấy uid từ request body

    // Tìm tin nhắn theo ID
    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tin nhắn",
      });
    }

    // Chỉ tác giả tin nhắn mới được xóa
    if (message.uid !== uid) {
      return res.status(403).json({
        success: false,
        message: "Chỉ tác giả tin nhắn mới có quyền xóa",
      });
    }

    // Xóa tin nhắn khỏi database
    await Message.findByIdAndDelete(messageId);

    res.json({
      success: true,
      message: "Xóa tin nhắn thành công",
    });
  } catch (error) {
    console.error("Lỗi khi xóa tin nhắn:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
