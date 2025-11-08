const express = require("express"); // Framework web cho Node.js
const cors = require("cors"); // Cho phép chia sẻ tài nguyên giữa các domain khác nhau

const setupCORS = (app, allowedOrigins) => {
  // Cấu hình các Middleware
  app.use(
    cors({
      origin: (origin, callback) => {
        // Cho phép requests không có origin
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes("*")) {
          return callback(null, true);
        }

        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          console.warn(`⚠️ CORS blocked origin: ${origin}`);
          callback(null, true); // Tạm thời cho phép, sau đó đổi thành callback(new Error('Not allowed by CORS'))
        }
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    })
  );
  // Middleware để parse JSON data từ request body, giới hạn 10MB
  app.use(express.json({ limit: "10mb" }));
  // Middleware để parse URL-encoded data từ form, giới hạn 10MB
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
};
module.exports = setupCORS;
