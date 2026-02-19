const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

// ================= GENERATE ACCESS TOKEN =================

const generateAccessToken = (user) => {

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

};

// ================= GENERATE REFRESH TOKEN =================

const generateRefreshToken = (user) => {

  return jwt.sign(
    {
      id: user.id,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: "30d" }
  );

};

// ================= EMAIL VERIFICATION TOKEN =================

const generateEmailVerificationToken = (email) => {

  return jwt.sign(
    { email },
    JWT_SECRET,
    { expiresIn: "1d" }
  );

};

// ================= VERIFY TOKEN =================

const verifyToken = (token) => {

  try {
    return jwt.verify(token, JWT_SECRET);
  }
  catch {
    return null;
  }

};

// ================= AUTHENTICATE =================

const authenticate = (req, res, next) => {

  try {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: "No authorization header"
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        error: "Token missing"
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    console.log("Decoded token:", decoded);

    // IMPORTANT
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name
    };

    next();

  }
  catch (err) {

    console.error("Auth error:", err.message);

    return res.status(401).json({
      error: "Invalid token"
    });

  }

};

// ================= ADMIN CHECK =================

const requireAdmin = (req, res, next) => {

  if (!req.user) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  if (
    req.user.role !== "admin" &&
    req.user.role !== "superadmin"
  ) {
    return res.status(403).json({
      error: "Admin access required"
    });
  }

  next();

};

module.exports = {

  generateAccessToken,
  generateRefreshToken,
  generateEmailVerificationToken,
  verifyToken,
  authenticate,
  requireAdmin

};
