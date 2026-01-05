const Room = require("../models/Room");
const User = require("../models/User");
const mongoose = require("mongoose");

// Helper functions
const isValidObjectId = (id) =>
  mongoose.Types.ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id);

const findUser = async (identifier) => {
  if (isValidObjectId(identifier)) {
    const user = await User.findById(identifier);
    if (user) return user;
  }
  return await User.findOne({ uid: identifier });
};

const getUserDetails = (user) => ({
  _id: user._id,
  uid: user.uid,
  username: user.username,
  email: user.email,
  displayName: user.displayName,
  photoURL: user.photoURL,
});

const getMembersDetails = async (members) => {
  const details = await Promise.all(
    members.map(async (id) => {
      const user = await findUser(id);
      return user ? getUserDetails(user) : null;
    })
  );
  return details.filter(Boolean);
};

// Lấy danh sách phòng chat của một user
exports.getRooms = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await findUser(id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng" });
    }

    const userIdentifiers = [user._id.toString()];
    if (user.uid && user.uid !== user._id.toString()) {
      userIdentifiers.push(user.uid);
    }

    const rooms = await Room.find({ members: { $in: userIdentifiers } })
      .sort({ updatedAt: -1 })
      .select("-__v");

    const roomsWithMembers = await Promise.all(
      rooms.map(async (room) => ({
        ...room.toObject(),
        membersDetails: await getMembersDetails(room.members),
      }))
    );

    res.json({
      success: true,
      data: roomsWithMembers,
      count: roomsWithMembers.length,
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách phòng:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Lấy tất cả phòng chat
exports.getAllRooms = async (req, res) => {
  try {
    const rooms = await Room.find({}).sort({ updatedAt: -1 }).select("-__v");
    res.json({ success: true, data: rooms, count: rooms.length });
  } catch (error) {
    console.error("Lỗi khi lấy tất cả phòng:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Lấy thông tin phòng chat theo ID
exports.getRoomById = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findById(roomId).select("-__v");

    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phòng chat" });
    }

    const membersDetails = await getMembersDetails(room.members);

    res.json({
      success: true,
      data: { ...room.toObject(), membersDetails },
    });
  } catch (error) {
    console.error("Lỗi khi lấy thông tin phòng:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Tạo phòng chat mới
exports.createRoom = async (req, res) => {
  try {
    const { name, description, createdBy } = req.body;

    if (!name || !createdBy) {
      return res.status(400).json({
        success: false,
        message: "Tên phòng và người tạo là bắt buộc",
      });
    }

    const user = await findUser(createdBy);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng" });
    }

    const userIdString = user._id.toString();
    const memberIdentifiers = [userIdString];
    if (user.uid && user.uid !== userIdString) {
      memberIdentifiers.push(user.uid);
    }

    const room = new Room({
      name,
      description,
      members: memberIdentifiers,
      createdBy: userIdString,
    });

    await room.save();

    res
      .status(201)
      .json({ success: true, data: room, message: "Tạo phòng thành công" });
  } catch (error) {
    console.error("Lỗi khi tạo phòng:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Tham gia phòng chat
exports.joinRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, email, username, uid } = req.body;

    if (!userId && !email && !username && !uid) {
      return res.status(400).json({
        success: false,
        message: "Cần cung cấp userId hoặc email hoặc username hoặc uid",
      });
    }

    const user =
      (await findUser(userId || uid)) ||
      (await User.findOne({
        email: email || undefined,
        username: username || undefined,
      }));

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng" });
    }

    const room = await Room.findById(roomId);
    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phòng chat" });
    }

    const userIdString = user._id.toString();

    if (room.members.includes(userIdString)) {
      return res.status(400).json({
        success: false,
        message: "Người dùng đã là thành viên của phòng này",
      });
    }

    room.members.push(userIdString);
    await room.save();

    // ===== THÊM: Emit socket event để thông báo user được mời vào phòng =====
    const io = req.app.get("io");
    if (io) {
      const roomData = {
        _id: room._id,
        name: room.name,
        description: room.description,
        createdBy: room.createdBy,
      };

      console.log(
        `🔔 Emitting room-invitation to user ${userIdString}:`,
        roomData
      );
      io.emit("room-invitation", {
        userId: userIdString,
        room: roomData,
      });
    }

    res.json({
      success: true,
      data: room,
      message: "Tham gia phòng thành công",
    });
  } catch (error) {
    console.error("Lỗi khi tham gia phòng:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Rời khỏi phòng chat
exports.leaveRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "User ID là bắt buộc" });
    }

    const room = await Room.findById(roomId);
    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phòng chat" });
    }

    room.members = room.members.filter((member) => member !== userId);
    await room.save();

    res.json({ success: true, data: room, message: "Rời phòng thành công" });
  } catch (error) {
    console.error("Lỗi khi rời phòng:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Kick thành viên khỏi phòng chat
exports.kickMember = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, memberId } = req.body;

    if (!userId || !memberId) {
      return res
        .status(400)
        .json({ success: false, message: "User ID và Member ID là bắt buộc" });
    }

    const room = await Room.findById(roomId);
    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phòng chat" });
    }

    if (room.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        message: "Chỉ chủ phòng mới có quyền kick thành viên",
      });
    }

    if (userId === memberId) {
      return res
        .status(400)
        .json({ success: false, message: "Không thể kick chính mình" });
    }

    if (!room.members.includes(memberId)) {
      return res.status(404).json({
        success: false,
        message: "Thành viên không có trong phòng này",
      });
    }

    room.members = room.members.filter((member) => member !== memberId);
    await room.save();

    const membersDetails = await getMembersDetails(room.members);

    // ===== THÊM: Emit socket event để thông báo thành viên bị kick =====
    const io = req.app.get("io");
    if (io) {
      io.to(room._id.toString()).emit("member:kicked", {
        roomId: room._id.toString(),
        memberId,
      });
    }

    res.json({
      success: true,
      data: { ...room.toObject(), membersDetails },
      message: "Kick thành viên thành công",
    });
  } catch (error) {
    console.error("Lỗi khi kick thành viên:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Xóa phòng chat
exports.deleteRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body; // ID của người yêu cầu xóa phòng

    const room = await Room.findById(roomId);
    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phòng chat" });
    }
    // ✅ KIỂM TRA: So sánh userId với createdBy của phòng
    if (room.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        message: "Chỉ người tạo phòng mới có quyền xóa phòng này",
      });
    }
    // ✅ Emit socket event TRƯỚC KHI xóa để thông báo cho tất cả members
    const io = req.app.get("io");
    if (io) {
      io.to(roomId).emit("room:deleted", {
        roomId: roomId,
        roomName: room.name,
      });
      console.log(`🗑️ Room deleted event emitted for room: ${roomId}`);
    }
    // ✅ Nếu là chủ phòng, cho phép xóa
    await Room.findByIdAndDelete(roomId);

    res.json({ success: true, message: "Xóa phòng thành công" });
  } catch (error) {
    console.error("Lỗi khi xóa phòng:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
