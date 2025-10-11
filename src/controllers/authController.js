const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");

// Xử lý đăng nhập bằng firebase
exports.login_firebase = async (req, res) => {
  try {
    // Lấy thông tin user từ request body
    const { displayName, email, photoURL, uid, providerId } = req.body;

    // Tìm user trong database theo uid
    let user = await User.findOne({ uid });

    if (!user) {
      // Nếu user chưa tồn tại, tạo mới
      user = new User({
        displayName,
        email,
        photoURL,
        uid,
        providerId,
      });
      await user.save(); // Lưu vào database
    } else {
      // Nếu user đã tồn tại, cập nhật thông tin
      user.displayName = displayName || user.displayName;
      user.photoURL = photoURL || user.photoURL;
      await user.save(); // Lưu thay đổi
    }

    // Trả về kết quả thành công
    res.json({
      success: true,
      data: user,
      message: "Đăng nhập thành công",
    });
  } catch (error) {
    console.error("Lỗi xác thực:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Xử lý đăng nhập bằng Facebook
exports.loginWithFacebook = async (req, res) => {
  try {
    const { accessToken, userID, email, name } = req.body;

    console.log("Facebook login request:", {
      accessToken: accessToken?.substring(0, 20) + "...",
      userID,
      email,
      name,
    });

    if (!accessToken || !userID) {
      return res.status(400).json({
        success: false,
        message: "Thiếu access token hoặc user ID",
      });
    }

    // Xác minh access token với Facebook API
    try {
      const fbResponse = await axios.get(
        `https://graph.facebook.com/me?access_token=${accessToken}&fields=id,name,email,picture`
      );

      const fbUser = fbResponse.data;
      console.log("Facebook API response:", fbUser);

      // Kiểm tra userID có khớp không (Firebase UID có thể khác Facebook ID)
      // Vì vậy ta chỉ cần xác minh token hợp lệ
      if (!fbUser.id) {
        return res.status(401).json({
          success: false,
          message: "Token Facebook không hợp lệ",
        });
      }

      // Tìm user trong database theo Facebook ID hoặc Firebase UID
      let user = await User.findOne({
        $or: [{ facebookId: fbUser.id }, { uid: userID }],
      });

      if (!user) {
        // Nếu user chưa tồn tại, tạo mới
        user = new User({
          facebookId: fbUser.id,
          displayName: fbUser.name || name,
          email: fbUser.email || email,
          photoURL: fbUser.picture?.data?.url,
          providerId: "facebook.com",
          uid: userID, // Firebase UID
        });
        await user.save();
        console.log("Created new user:", user._id);
      } else {
        // Cập nhật thông tin nếu có thay đổi
        user.facebookId = fbUser.id; // Đảm bảo facebookId được cập nhật
        user.displayName = fbUser.name || user.displayName;
        user.email = fbUser.email || user.email;
        user.photoURL = fbUser.picture?.data?.url || user.photoURL;
        await user.save();
        console.log("Updated existing user:", user._id);
      }

      // Tạo JWT token
      const token = jwt.sign(
        {
          userId: user._id,
          facebookId: user.facebookId,
        },
        process.env.JWT_SECRET || "your-secret-key",
        { expiresIn: "7d" }
      );

      res.json({
        success: true,
        token,
        user: {
          id: user._id,
          displayName: user.displayName,
          email: user.email,
          avatar: user.photoURL,
        },
        message: "Đăng nhập Facebook thành công",
      });
    } catch (fbError) {
      console.error(
        "Facebook API Error:",
        fbError.response?.data || fbError.message
      );
      return res.status(401).json({
        success: false,
        message:
          "Không thể xác minh với Facebook: " +
          (fbError.response?.data?.error?.message || fbError.message),
      });
    }
  } catch (error) {
    console.error("Facebook login error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Xử lý đăng nhập bằng username + password
exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng cung cấp tên đăng nhập và mật khẩu",
    });
  }

  try {
    // Tìm user theo username (cần select password để so sánh)
    const user = await User.findOne({ username }).select("+password");

    if (user && (await bcrypt.compare(password, user.password))) {
      // Loại bỏ password khỏi response
      const userResponse = { ...user._doc };
      delete userResponse.password;

      res.status(200).json({
        success: true,
        data: userResponse,
        message: "Đăng nhập thành công",
      });
    } else {
      res.status(401).json({
        success: false,
        message: "Sai tên đăng nhập hoặc mật khẩu",
      });
    }
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Xử lý đăng ký user
exports.register = async (req, res) => {
  const { username, password, confirmPassword, email, name } = req.body;
  try {
    // Kiểm tra nếu thiếu thông tin bắt buộc
    if (!username || !password || !email) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp đầy đủ thông tin bắt buộc",
      });
    }

    // Kiểm tra mật khẩu xác nhận
    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu xác nhận không khớp",
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu phải có ít nhất 6 ký tự",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Email không hợp lệ",
      });
    }

    // Validate username
    if (username.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Tên đăng nhập phải có ít nhất 3 ký tự",
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({
        success: false,
        message: "Tên đăng nhập chỉ được chứa chữ, số và dấu gạch dưới",
      });
    }

    // Kiểm tra xem username hoặc email đã tồn tại chưa
    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
    });

    if (existingUser) {
      if (existingUser.username === username) {
        return res.status(400).json({
          success: false,
          message: "Tên đăng nhập đã tồn tại",
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "Email đã được sử dụng",
        });
      }
    }

    // Hash password trước khi tạo user
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Tạo user mới với password đã được hash
    const newUser = new User({
      username,
      password: hashedPassword,
      displayName: name || username, // Sử dụng name hoặc username làm displayName
      email,
    });

    await newUser.save();

    // Tạo JWT token
    const token = jwt.sign(
      {
        userId: newUser._id,
        username: newUser.username,
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        name: newUser.displayName,
        displayName: newUser.displayName,
      },
      message: "Đăng ký thành công",
    });
  } catch (error) {
    console.error("Lỗi đăng ký:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
