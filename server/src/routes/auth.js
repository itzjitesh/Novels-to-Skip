import { Router } from "express";
import rateLimit from "express-rate-limit";
import config from "../config.js";
import User from "../models/User.js";
import { clearSession, issueSession } from "../middleware/auth.js";
import { asyncHandler, badRequest, conflict, forbidden } from "../utils/http.js";
import { loginSchema, registerSchema } from "../validation.js";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isTest ? 1000 : 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." },
});

router.post(
  "/register",
  authLimiter,
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const [emailTaken, usernameTaken] = await Promise.all([
      User.exists({ email: data.email }),
      User.exists({ username: data.username }),
    ]);
    if (emailTaken) throw conflict("An account with this email already exists. Try logging in.");
    if (usernameTaken) throw badRequest("That username is taken.", { username: "Already taken" });

    const role = config.adminEmails.includes(data.email) ? "admin" : "user";
    const user = await User.create({ ...data, role });
    issueSession(res, user);
    res.status(201).json({ user: user.toPrivate() });
  })
);

router.post(
  "/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await User.findOne({ email }).select("+password");
    // Same message for unknown email and wrong password, so emails can't be probed.
    if (!user || !(await user.checkPassword(password))) {
      throw badRequest("Email or password is incorrect.");
    }
    if (user.isBanned) throw forbidden("This account has been suspended.");
    issueSession(res, user);
    res.json({ user: user.toPrivate() });
  })
);

router.post("/logout", (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.get("/me", (req, res) => {
  res.json({ user: req.user ? req.user.toPrivate() : null });
});

export default router;
