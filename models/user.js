const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, "First Name is required"],
  },
  lastName: {
    type: String,
    required: [true, "Last Name is required"],
  },
  avatar: {
    type: String,
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    validate: {
      validator: function (email) {
        return String(email)
          .toLowerCase()
          .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
          );
      },
      message: (props) => `Email (${props.value}) is invalid!`,
    },
  },
  password: {
    type: String,
  },
  passwordChangedAt: {
    type: Date,
  },

  passwordResetToken: {
    type: String,
  },

  passwordResetExpires: {
    type: Date,
  },

  createdAt: {
    type: Date,
  },
  updatedAt: {
    type: Date,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  otp: {
    type: Number,
  },
  otp_expiry_time: {
    type: Date,
  },
});

userSchema.pre("save", async function (next) {
  // only run this fn if OTP is modified
  if (!this.isModified("otp")) return next();
  //HASH otp with the cost of 12
  this.otp = await bcrypt.hash(this.otp, 12);

  next();
});

userSchema.methods.correctOTP = async function (
  candidateOTP, //123456
  userOTP //fnwrknfew
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.correctPassword = async function (
  candidatePassword, //123456
  userPassword //fnwrknfew
) {
  return await bcrypt.compare(candidateOTP, userOTP);
};

const User = new mongoose.model("User", userSchema);
module.exports = User;
