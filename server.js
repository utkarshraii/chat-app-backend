const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });

const { Server } = require("socket.io");

process.on("uncaughtException", (err) => {
  console.log(err);
  console.log("UNCAUGHT Exception! Shutting down ...");
  process.exit(1); // Exit Code 1 indicates that a container shut down, either because of an application failure.
});

const app = require("./app");

const http = require("http");
const User = require("./models/user");
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const DB = process.env.DATABASE.replace(
  "<PASSWORD>",
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB, {
    // useNewUrlParser: true, // The underlying MongoDB driver has deprecated their current connection string parser. Because this is a major change, they added the useNewUrlParser flag to allow users to fall back to the old parser if they find a bug in the new parser.
    // useCreateIndex: true, // Again previously MongoDB used an ensureIndex function call to ensure that Indexes exist and, if they didn't, to create one. This too was deprecated in favour of createIndex . the useCreateIndex option ensures that you are using the new function calls.
    // useFindAndModify: false, // findAndModify is deprecated. Use findOneAndUpdate, findOneAndReplace or findOneAndDelete instead.
    // useUnifiedTopology: true, // Set to true to opt in to using the MongoDB driver's new connection management engine. You should set this option to true , except for the unlikely case that it prevents you from maintaining a stable connection.
  })
  .then((con) => {
    console.log("DB Connection successful");
  });

const port = process.env.PORT || 8000;

server.listen(port, () => {
  console.log(`App running on port ${port} ...`);
});

io.on("connection", async (socket) => {
  //console.log(socket);
  const user_id = socket.handshake.query["user_id"];

  const socket_id = socket.id;

  console.log(`user connected ${socket_id}`);

  if (user_id) {
    await User.findByIdAndUpdate(user_id, {
      socket_id,
    });
  }

  //We can write our socket event listeners here ...

  socket.on("friend_request", async (data) => {
    console.log(data.to);
    //{to: "694545"}

    const to = await User.findById(data.to);

    // TODO => create a friend request

    io.to(to.socket_id).emit("new_friend_request", {
      //
    });
  });
});
process.on("unhandledRejection", (err) => {
  console.log(err);
  console.log("UNHANDLED REJECTION! Shutting down ...");
  server.close(() => {
    process.exit(1); //  Exit Code 1 indicates that a container shut down, either because of an application failure.
  });
});
