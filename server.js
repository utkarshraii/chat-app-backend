const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });

const path = require("path");

const { Server } = require("socket.io");

process.on("uncaughtException", (err) => {
  console.log(err);
  console.log("UNCAUGHT Exception! Shutting down ...");
  process.exit(1); // Exit Code 1 indicates that a container shut down, either because of an application failure.
});

const app = require("./app");

const http = require("http");

const { promisify } = require("util");
const User = require("./models/user");
const OneToOneMessage = require("./models/OneToOneMessage");
const FriendRequest = require("./models/friendRequest");
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
  // console.log(JSON.stringify(socket.handshake.query));
  //console.log(socket);
  const user_id = socket.handshake.query["user_id"];

  const socket_id = socket.id;

  console.log(`user connected ${socket_id}`);

  if (Boolean(user_id)) {
    await User.findByIdAndUpdate(user_id, {
      socket_id,
      status: "Online",
    });
  }

  //We can write our socket event listeners here ...

  socket.on("friend_request", async (data) => {
    console.log(data.to);
    // data => {to,from}

    const to_user = await User.findById(data.to).select("socket-id");

    const from_user = await User.findById(data.from).select("socket-id");

    // TODO => create a friend request

    await FriendRequest.create({
      sender: data.from,
      recipient: data.to,
    });

    //emit event => "new_friend_request"

    io.to(to_user.socket_id).emit("new_friend_request", {
      //
      message: "New Friend Request Received",
    });
    // emit event => "request_sent"
    io.to(from_user.socket_id).emit("request_sent", {
      message: "Request sent successfully",
    });
  });
  socket.on("accept_request", async (data) => {
    console.log(data);
    // request_id (unique)
    const request_doc = await FriendRequest.findById(data.request_id);

    console.log(request_doc);

    const sender = await User.findById(request_doc.sender);

    const receiver = await User.findById(request_doc.recipient);

    sender.friends.push(request_doc.recipient);
    receiver.friends.push(request_doc.sender);

    await receiver.save({ new: true, validateModifiedOnly: true });
    await sender.save({ new: true, validateModifiedOnly: true });

    await FriendRequest.findByIdAndDelete(data.request_id);

    io.to(sender.socket_id).emit("request_accepted", {
      message: "Friend request accepted",
    });

    io.to(receiver.socket_id).emit("request_accepted", {
      message: "Friend request accepted",
    });
  });

  socket.on("get_direct_conversations", async ({ user_id }, callback) => {
    const existing_conversations = await OneToOneMessage.find({
      participants: { $all: [user_id] },
    }).populate("participants", "firstName lastName _id email status");

    console.log(existing_conversations);

    callback(existing_conversations);
  });

  socket.on("start_conversation", async (data) => {
    //data: {to,from}
    const { to, from } = data;
    //check if there is any conversation between these users or not
    const existing_conversation = await OneToOneMessage.find({
      participants: { $size: 2, $all: [to, from] },
    }).populate("participants", "firstName lastName _id email status");
    console.log(existing_conversation[0], "Existing conversation");

    // if no existing conversation
    if (existing_conversation.length === 0) {
      let new_chat = await OneToOneMessage.create({
        participants: [to, from],
      });

      new_chat = await OneToOneMessage.findById(new_chat._id).populate(
        "participants",
        "firstName lastName _id email status"
      );

      console.log(new_chat);
      socket.emit("start_chat", new_chat);
    }

    //there is existing conversation
    else {
      socket.emit("open_chat", existing_conversation[0]);
    }
  });

  //handle text and link messages
  socket.on("text_message", (data) => {
    console.log("Recieved message", data);

    // data: {to,from,text}

    //create a new conversation if it doesnt exist yet or add new message to the messages list

    //save changes to db

    //emit incoming_message -> to user whom the message was sent

    //emit outgoing_message -> from user
  });

  socket.on("file_message", (data) => {
    console.log("Recieved message", data);

    //data :{to,from,text,file}

    //get the file extension

    const fileExtension = path.extname(data.file.name);

    // generate a unique filename
    const fileName = `${Date.now()}_${Math.floor(
      Math.random() * 10000
    )}${fileExtension}`;

    //upload file to AWS s3

    //create a new conversation if it doesnt exist yet or add new message to the messages list

    //save changes to db

    //emit incoming_message -> to user whom the message was sent

    //emit outgoing_message -> from user
  });

  socket.on("end", async (data) => {
    //find user by _id and set status offline
    if (data.user_id) {
      await User.findByIdAndUpdate(data.user_id, { status: "Offline" });
    }
    //TODO => broadcast user disconnected
    console.log("closing connection");
    socket.disconnect(0);
  });
});
process.on("unhandledRejection", (err) => {
  console.log(err);
  console.log("UNHANDLED REJECTION! Shutting down ...");
  server.close(() => {
    process.exit(1); //  Exit Code 1 indicates that a container shut down, either because of an application failure.
  });
});
