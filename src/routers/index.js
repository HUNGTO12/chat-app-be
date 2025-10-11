const authRouter = require("./auth.routes");
const roomsRouter = require("./rooms.routes");
const messagesRouter = require("./messages.routes");
const usersRouter = require("./users.routes");
function Router(app) {
  app.use("/api/auth", authRouter); // Routes xử lý authentication
  app.use("/api/rooms", roomsRouter); // Routes xử lý phòng chat
  app.use("/api/messages", messagesRouter); // Routes xử lý tin nhắn
  app.use("/api/users", usersRouter); // Routes xử lý user (search, ...)
}
module.exports = Router;
