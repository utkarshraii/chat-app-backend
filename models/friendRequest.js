const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.ObjectId,
    ref: "User", //will allow us to populate this field
  },
  recipient: {
    type: mongoose.Schema.ObjectId,
    ref: "User", //will allow us to populate this field
  },
  createdAt: {
    type: Date,
    default: Date.now(),
  },
});

const FriendRequest = new mongoose.model("FriendRequest", requestSchema);
module.exports = FriendRequest;
