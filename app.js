const express = require("express"); //web framework for Node.js

const morgan = require("morgan"); //HTTP request logger middleware for node.js

const rateLimit = require("express-rate-limit"); // add dynamic rate limiting authentication and more to any API in minutes

const helmet = require("helmet"); //secure your express app by setting various HTTP headers.

const mongosanitize = require("express-mongo-sanitize"); //middleware which sanitizes user-supplied data to prevent MongoDB Operator Injection

const bodyParser = require("body-parser");

const xss = require("xss"); // sanitize untrusted HTML with a configuration specified by a whitelist

const cors = require("cors");

const app = express();

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(mongosanitize());

//app.use(xss());

//
app.use(
  cors({
    origin: "*",
    methods: ["GET", "PATCH", "POST", "DELETE", "PUT"],
    credentials: true,
  })
);
app.use(express.json({ limit: "10kb" }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(helmet());

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

const limiter = rateLimit({
  max: 3000,
  windowMs: 60 * 60 * 1000, // in one hour
  message: "Too many request from this IP , please try again in an hour",
});

app.use("/chatty", limiter);

module.exports = app;
