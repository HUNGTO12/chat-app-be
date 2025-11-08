const express = require("express");
const authController = require("../controllers/authController");
const { authenticateToken } = require("../middleware/auth.middleware");
// Tạo router cho authentication
const router = express.Router();

// Đăng nhập bằng Facebook
router.post("/facebook", authController.loginWithFacebook);

// đăng nhập username + password
router.post("/login", authController.login);

// Đăng ký username + password
router.post("/register", authController.register);

// Refresh token
router.post("/refresh-token", authController.refreshToken);

// Logout
router.post("/logout", authController.logout);

// Route test để kiểm tra authentication

router.get("/profile", authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      displayName: req.user.displayName,
      email: req.user.email,
      avatar: req.user.photoURL,
    },
    message: "Thông tin user",
  });
});

// Export router để sử dụng trong server.js
module.exports = router;
