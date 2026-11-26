const env = process.env;

const isProd = env.NODE_ENV === "production";
const isTest = env.NODE_ENV === "test";

function required(name, fallbackForDev) {
  const value = env[name];
  if (value) return value;
  if (!isProd && fallbackForDev !== undefined) return fallbackForDev;
  throw new Error(`Missing required environment variable: ${name}`);
}

const config = {
  isProd,
  isTest,
  port: Number(env.PORT) || 5000,
  mongoUri: required("MONGO_URI", "mongodb://127.0.0.1:27017/novels-to-skip"),
  jwtSecret: required("JWT_SECRET", "dev-only-secret-change-me"),
  jwtExpiresIn: env.JWT_EXPIRES_IN || "7d",
  clientUrl: env.CLIENT_URL || "http://localhost:5173",
  siteUrl: (env.SITE_URL || env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, ""),
  // Emails in this list become admins automatically when they sign up.
  adminEmails: (env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  // When false (default), summaries written by non-admins wait for admin approval.
  autoPublishUserPosts: env.AUTO_PUBLISH_USER_POSTS === "true",
  anthropicApiKey: env.ANTHROPIC_API_KEY || "",
  aiModel: env.AI_MODEL || "claude-sonnet-5-5",
};

export default config;
