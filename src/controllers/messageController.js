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
      .populate({ path: "userId", select: "providerUid displayName photoURL" })
      .sort({ createdAt: 1 }) // Sắp xếp từ cũ tới mới
      .skip(skip) // Bỏ qua số tin nhắn đã hiển thị ở trang trước
      .limit(parseInt(limit)) // Giới hạn số tin nhắn trả về
      .select("-__v"); // Loại bỏ field __v

    // Map tin nhắn với thông tin user đã populate
    const messagesWithUserInfo = messages.map((message) => {
      const messageObj = message.toObject();
      const user = messageObj.userId;

      return {
        _id: messageObj._id,
        text: messageObj.text,
        roomId: messageObj.roomId,
        userId: user?._id,
        displayName: user?.displayName || "Unknown User",
        photoURL: user?.photoURL || "",
        createdAt: messageObj.createdAt,
        updatedAt: messageObj.updatedAt,
      };
    });

    // Đếm tổng số tin nhắn
    const totalMessages = await Message.countDocuments({ roomId });

    res.json({
      success: true,
      data: messagesWithUserInfo,
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
      .populate({
        path: "userId",
        select: "displayName photoURL providerUid",
      })
      .sort({ createdAt: -1 }) // Sắp xếp từ mới tới cũ
      .limit(parseInt(limit)) // Giới hạn số lượng
      .select("-__v"); // Loại bỏ field __v

    // Map tin nhắn với thông tin user đã populate
    const messagesWithUserInfo = messages.map((message) => {
      const messageObj = message.toObject();
      const user = messageObj.userId;

      return {
        _id: messageObj._id,
        text: messageObj.text,
        roomId: messageObj.roomId,
        userId: user?._id,
        displayName: user?.displayName || "Unknown User",
        photoURL: user?.photoURL || "",
        createdAt: messageObj.createdAt,
        updatedAt: messageObj.updatedAt,
      };
    });

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
    const { text, roomId, providerUid, displayName, photoURL } = req.body; // Lấy dữ liệu từ request body

    // Kiểm tra các trường bắt buộc
    if (!text || !roomId || !providerUid) {
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

    // Tìm user theo _id hoặc providerUid
    // providerUid có thể là MongoDB _id hoặc Firebase UID
    let user = await User.findById(providerUid);
    if (!user) {
      // Nếu không tìm thấy theo _id, thử tìm theo providerUid
      user = await User.findOne({ providerUid: providerUid });
    }
    if (!user) {
      console.log("❌ User not found with providerUid:", providerUid);
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    console.log("✅ Found user:", user._id, user.displayName);

    // Kiểm tra xem user có phải thành viên của phòng không (kiểm tra cả _id và uid)
    const userIdString = user._id.toString();
    console.log("🔍 Checking membership:");
    console.log("  - User ID:", userIdString);
    console.log("  - Room members:", room.members);
    console.log("  - Provider UID:", providerUid);

    const isUserMember =
      room.members.includes(userIdString) ||
      room.members.includes(providerUid) ||
      (user.providerUid && room.members.includes(user.providerUid));

    console.log("  - Is member?", isUserMember);

    if (!isUserMember) {
      return res.status(403).json({
        success: false,
        message: "Người dùng không phải thành viên của phòng này",
      });
    }

    // Tạo tin nhắn mới - CHỈ lưu text, roomId và userId
    const message = new Message({
      text,
      roomId,
      userId: user._id, // Chỉ lưu userId để reference
    });

    await message.save(); // Lưu tin nhắn vào database

    // Cập nhật thời gian cập nhật của phòng
    room.updatedAt = new Date();
    await room.save();

    // Emit Socket.IO event để gửi tin nhắn real-time đến TẤT CẢ users trong room
    const io = req.app.get("io");
    console.log("🔍 IO instance exists?", !!io);

    if (io) {
      const messageData = {
        id: message._id.toString(),
        text: message.text,
        displayName: user.displayName,
        photoURL: user.photoURL,
        createdAt: message.createdAt,
        providerUid: user.providerUid || user._id.toString(),
        roomId: message.roomId.toString(),
      };

      console.log("📤 Emitting to room:", String(roomId));
      console.log("📤 Message data:", JSON.stringify(messageData, null, 2));

      // Emit đến TẤT CẢ users trong room (bao gồm cả người gửi)
      io.to(String(roomId)).emit("receive-message", messageData);

      console.log("✅ Message emitted successfully");
    } else {
      console.error("❌ Socket.IO instance not found, message not broadcasted");
    }

    res.status(201).json({
      success: true,
      data: {
        _id: message._id.toString(),
        text: message.text,
        roomId: message.roomId.toString(),
        userId: message.userId.toString(),
        displayName: user.displayName,
        photoURL: user.photoURL,
        providerUid: user.providerUid || user._id.toString(),
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      },
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
    const { messageId } = req.params;
    const { uid } = req.body;

    console.log("🗑️ Delete message request:", { messageId, uid });

    // Tìm tin nhắn theo ID
    const message = await Message.findById(messageId);

    if (!message) {
      console.log("❌ Message not found:", messageId);
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tin nhắn",
      });
    }

    console.log("🔍 Message found:", {
      messageId,
      messageUserId: message.userId,
      requestUid: uid,
    });

    // ✅ Tìm user theo nhiều cách
    let user = await User.findOne({
      $or: [{ uid: uid }, { _id: uid }, { providerUid: uid }],
    });

    if (!user) {
      console.log("❌ User not found with uid:", uid);
      return res.status(403).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    console.log("👤 User found:", {
      userId: user._id,
      uid: user.uid,
      providerUid: user.providerUid,
    });

    // ✅ So sánh với nhiều identifier
    const isOwner =
      message.userId.toString() === user._id.toString() ||
      (user.uid && message.userId.toString() === user.uid) ||
      (user.providerUid && message.userId.toString() === user.providerUid);

    console.log("🔐 Ownership check:", {
      isOwner,
      messageUserId: message.userId.toString(),
      userMongoId: user._id.toString(),
      userUid: user.uid,
      userProviderUid: user.providerUid,
    });

    if (!isOwner) {
      console.log("❌ Permission denied");
      return res.status(403).json({
        success: false,
        message: "Chỉ tác giả tin nhắn mới có quyền xóa",
      });
    }

    const roomId = message.roomId.toString();

    // Xóa tin nhắn khỏi database
    await Message.findByIdAndDelete(messageId);
    console.log("✅ Message deleted from database:", messageId);

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      console.log("📡 Emitting message:deleted event");
      io.to(roomId).emit("message:deleted", {
        messageId: messageId.toString(),
        roomId,
      });
      console.log(`✅ Message deleted event emitted`);
    } else {
      console.error("❌ IO instance not found!");
    }

    res.json({
      success: true,
      message: "Xóa tin nhắn thành công",
    });
  } catch (error) {
    console.error("❌ Lỗi khi xóa tin nhắn:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
