const Room = require("../models/Room");
const User = require("../models/User");

// Lấy danh sách phòng chat của một user
exports.getRooms = async (req, res) => {
  try {
    const { id } = req.params; // Lấy _id từ URL parameters

    // Tìm tất cả phòng mà user này là thành viên
    const rooms = await Room.find({ members: id })
      .sort({ updatedAt: -1 }) // Sắp xếp theo thời gian cập nhật mới nhất
      .select("-__v"); // Loại bỏ field __v

    res.json({
      success: true,
      data: rooms,
      count: rooms.length, // Số lượng phòng
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách phòng:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Lấy tất cả phòng chat
exports.getAllRooms = async (req, res) => {
  try {
    // Lấy tất cả phòng, sắp xếp theo thời gian cập nhật mới nhất
    const rooms = await Room.find({}).sort({ updatedAt: -1 }).select("-__v");

    res.json({
      success: true,
      data: rooms,
      count: rooms.length, // Số lượng phòng
    });
  } catch (error) {
    console.error("Lỗi khi lấy tất cả phòng:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Lấy thông tin phòng chat theo ID
exports.getRoomById = async (req, res) => {
  try {
    const { roomId } = req.params; // Lấy roomId từ URL parameters

    // Tìm phòng theo ID
    const room = await Room.findById(roomId).select("-__v");

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phòng chat",
      });
    }

    // Lấy thông tin chi tiết của các thành viên
    const membersDetails = await Promise.all(
      room.members.map(async (memberIdentifier) => {
        // Tìm user theo _id hoặc uid
        let user = await User.findById(memberIdentifier);
        if (!user) {
          user = await User.findOne({ uid: memberIdentifier });
        }
        return user
          ? {
              _id: user._id,
              uid: user.uid,
              username: user.username,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
            }
          : null;
      })
    );

    // Lọc bỏ các member không tìm thấy
    const validMembers = membersDetails.filter((member) => member !== null);

    res.json({
      success: true,
      data: {
        ...room.toObject(),
        membersDetails: validMembers,
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy thông tin phòng:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Tạo phòng chat mới
exports.createRoom = async (req, res) => {
  try {
    const { name, description, createdBy } = req.body; // Lấy dữ liệu từ request body

    // Kiểm tra các trường bắt buộc
    if (!name || !createdBy) {
      return res.status(400).json({
        success: false,
        message: "Tên phòng và người tạo là bắt buộc",
      });
    }

    // Kiểm tra xem user có tồn tại không (tìm bằng _id hoặc uid)
    let user =
      (await User.findById(createdBy)) ||
      (await User.findOne({ uid: createdBy }));
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    // Sử dụng _id thay vì uid để lưu vào room
    const userIdString = user._id.toString();

    // Tạo phòng mới - thêm cả _id và uid để đảm bảo tương thích
    const memberIdentifiers = [userIdString];
    if (user.uid && user.uid !== userIdString) {
      memberIdentifiers.push(user.uid);
    }

    const room = new Room({
      name,
      description,
      members: memberIdentifiers, // Thêm cả _id và uid
      createdBy: userIdString, // Sử dụng _id làm creator
    });

    await room.save(); // Lưu phòng vào database

    res.status(201).json({
      success: true,
      data: room,
      message: "Tạo phòng thành công",
    });
  } catch (error) {
    console.error("Lỗi khi tạo phòng:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Tham gia phòng chat (mở rộng: nhận userId hoặc email hoặc username)
exports.joinRoom = async (req, res) => {
  try {
    const { roomId } = req.params; // Lấy roomId từ URL
    const { userId, email, username, uid } = req.body; // Mở rộng đầu vào

    if (!userId && !email && !username && !uid) {
      return res.status(400).json({
        success: false,
        message: "Cần cung cấp userId hoặc email hoặc username hoặc uid",
      });
    }

    // Tìm user theo thứ tự ưu tiên: userId (_id) -> uid -> email -> username
    let user = null;
    if (userId) user = await User.findById(userId);
    else if (uid) user = await User.findOne({ uid });
    else if (email) user = await User.findOne({ email });
    else if (username) user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    // Tìm phòng chat
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phòng chat",
      });
    }

    // Sử dụng _id thay vì uid
    const userIdString = user._id.toString();

    // Kiểm tra xem user đã là thành viên chưa
    if (room.members.includes(userIdString)) {
      return res.status(400).json({
        success: false,
        message: "Người dùng đã là thành viên của phòng này",
      });
    }

    // Thêm user vào danh sách thành viên bằng _id
    room.members.push(userIdString);
    await room.save(); // Lưu thay đổi

    res.json({
      success: true,
      data: room,
      message: "Tham gia phòng thành công",
    });
  } catch (error) {
    console.error("Lỗi khi tham gia phòng:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Rời khỏi phòng chat
exports.leaveRoom = async (req, res) => {
  try {
    const { roomId } = req.params; // Lấy roomId từ URL
    const { userId } = req.body; // Lấy userId từ request body

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID là bắt buộc",
      });
    }

    // Tìm phòng chat
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phòng chat",
      });
    }

    // Loại bỏ user khỏi danh sách thành viên
    room.members = room.members.filter((member) => member !== userId);
    await room.save(); // Lưu thay đổi

    res.json({
      success: true,
      data: room,
      message: "Rời phòng thành công",
    });
  } catch (error) {
    console.error("Lỗi khi rời phòng:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Xóa phòng chat
exports.deleteRoom = async (req, res) => {
  try {
    const { roomId } = req.params; // Lấy roomId từ URL
    const { userId } = req.body; // Lấy userId từ request body

    // Tìm phòng chat
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phòng chat",
      });
    }

    // Chỉ người tạo phòng mới được xóa
    if (room.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        message: "Chỉ người tạo phòng mới có quyền xóa phòng này",
      });
    }

    // Xóa phòng khỏi database
    await Room.findByIdAndDelete(roomId);

    res.json({
      success: true,
      message: "Xóa phòng thành công",
    });
  } catch (error) {
    console.error("Lỗi khi xóa phòng:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
