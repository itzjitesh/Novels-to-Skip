import jwt from "jsonwebtoken";
import config from "../config.js";
import User from "../models/User.js";
import { forbidden, unauthorized } from "../utils/http.js";

export const COOKIE_NAME = "nts_token";

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

export function issueSession(res, user) {
  const token = jwt.sign({ sub: String(user._id) }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

export function clearSession(res) {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(COOKIE_NAME, opts);
}

/** Attaches req.user when a valid session cookie is present. Never rejects. */
export async function loadUser(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next();
  try {
    const { sub } = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(sub);
    if (user && !user.isBanned) req.user = user;
    else clearSession(res);
  } catch {
    clearSession(res);
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return next(unauthorized());
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== "admin") return next(forbidden("Admins only."));
  next();
}

export const isAdmin = (user) => user?.role === "admin";
