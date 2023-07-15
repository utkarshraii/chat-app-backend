const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");
const User = require("../models/user");
const crypto = require("crypto");
const filterObj = require("../utils/filterObj");
const { promisify } = require("util");

const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET);

//Register new user, these functions used as middleware
exports.register = async (req, res, next) => {
  const { firstName, lastName, email, password } = req.body;

  const filteredBody = filterObj(
    req.body,
    "firstName",
    "lastName",
    "password",
    "email"
  );

  // check if a verified user with given email exists or not
  const existing_user = await User.findOne({ email: email });

  if (existing_user && existing_user.verified) {
    res.status(400).json({
      status: "error",
      message: "already a user with existing email,please login",
    });
  } else if (existing_user) {
    await User.findOneAndUpdate({ email: email }, filteredBody, {
      new: true,
      validateModifiedOnly: true,
    });

    //generate OTP and send to the user's email
    req.userId = existing_user._id;
    next();
  } else {
    //if user record is not available in database
    const new_user = await User.create(filteredBody);

    //generate OTP and send to the user's email
    req.userId = new_user._id;
    next();
  }
};

//send OTP
exports.sendOTP = async (req, res, next) => {
  const { userId } = req;

  const new_otp = otpGenerator.generate(6, {
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });

  //set timer for OTP

  const otp_expiry_time = Date.now() + 10 * 60 * 1000; //10 mins after otp is sent and is calculated in ms

  await User.findByIdAndUpdate(userId, {
    otp: new_otp,
    otp_expiry_time,
  });

  // TODO send email

  res.status(200).json({
    status: "success",
    message: "OTP sent successfully",
  });
};

exports.verifyOTP = async (req, res, next) => {
  //verify OTP and update user record accordingly

  const { email, otp } = req.body;

  const user = await User.findOne({
    email,
    otp_expiry_time: { $gt: Date.now() },
  });

  if (!user) {
    res.status(400).json({
      status: "error",
      message: "Email is invalid or OTP expired",
    });
  }

  if (!(await user.correctOTP(otp, user.otp))) {
    res.status(400).json({
      status: "error",
      message: "otp is incorrect",
    });
  }

  //OTP is correct

  user.verified = true;
  user.otp = undefined;

  await user.save({ new: true, validateModifiedOnly: true });

  const token = signToken(user._id);

  res.status(200).json({
    status: "success",
    messgae: "OTP verified successfully",
    token,
  });
};

exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({
      status: "error",
      message: "Both email and password are  required",
    });
  }
  const userDoc = await User.findOne({ email: email }).select("+password");

  if (
    !userDoc ||
    !(await userDoc.correctPassword(password, userDoc.password))
  ) {
    res.status(400).json({
      status: "error",
      message: "Email or password is incorrect",
    });
  }

  const token = signToken(userDoc._id);

  res.status(200).json({
    status: "success",
    messgae: "Logged in successfully",
    token,
  });
};

exports.protect = async (req, res, next) => {
  //1) getting token (JWT) and check if it's there

  let token;

  // 'Bearer nverrejvopierjvoe' authorization token

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  } else {
    res.status(400).json({
      status: "error",
      message: "You are not logged in! Please log in to get access",
    });

    return;
  }

  //2) verify token

  const decoded = await promisify(jwt, verify)(token, process.env.JWT_SECRET);

  //3) check if user still exists

  const this_user = await User.findById(decoded.userId);

  if (!this_user) {
    res.status(400).json({
      status: "error",
      message: "user doesnot exist",
    });
  }

  //4) check if user changed their password after token was issued

  if (this_user.changedPasswordAfter(decoded.iat)) {
    res.status(400).json({
      status: "error",
      message: "updated password recently, please login again",
    });
  }

  req.user = this_user;
  next();
};

//TYpes of routes => Protected (Only logged in users can access these) & unprotected

exports.forgotPassword = async (req, res, next) => {
  // 1 ) Get user's email

  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    res.status(400).json({
      status: "error",
      message: "there is no user with given email address",
    });
    return;
  }

  // 2) Generate the random reset token

  const resetToken = user.correctPasswordResetToken();

  const resetURL = `https://chatty.com/auth/reset-password/?code=${resetToken}`;

  try {
    // TODO => SEND Email with reset URL

    res.status(200).json({
      status: "success",
      message: "Reset password link sent to email",
    });
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save({ validateBeforeSave: false });

    res.status(500).json({
      status: "error",
      message: "there was an error sending the email please try again later",
    });
  }
};
exports.resetPassword = async (req, res, next) => {
  //1) get the user based on token

  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  //2) if token has expired or submission is out of time window

  if (!user) {
    res.status(400).json({
      status: "error",
      message: "Token is invalid or expired",
    });

    return;
  }

  //3)update user's password and set resettoken and expiry to undefined

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();

  //4) login user and send new JWT

  //TODO => send an email informing about password change

  const token = signToken(user._id);

  res.status(200).json({
    status: "success",
    messgae: "Password reset successfully",
    token,
  });
};
