/** Usage: npm run make-admin -- someone@example.com */
import mongoose from "mongoose";
import User from "../src/models/User.js";

const email = process.argv[2]?.toLowerCase();
if (!email || !process.env.MONGO_URI) {
  console.error("Usage: npm run make-admin -- someone@example.com   (MONGO_URI must be set)");
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);
const user = await User.findOneAndUpdate({ email }, { role: "admin" }, { new: true });
console.log(user ? `${user.email} (@${user.username}) is now an admin.` : `No account found for ${email}. Sign up first.`);
await mongoose.disconnect();
