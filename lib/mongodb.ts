// lib/mongodb.ts
import mongoose from "mongoose";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/memelytics";

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable");
}

if (typeof window === "undefined") {
  if (!global.mongoose) {
    global.mongoose = { conn: null, promise: null };
  }
}

const cached = typeof window === "undefined" ? global.mongoose : null;

async function dbConnect() {
  if (typeof window !== "undefined") {
    throw new Error(
      "MongoDB operations cannot be performed on the client side"
    );
  }

  if (cached.conn) {
    console.log("Using cached MongoDB connection");
    return cached.conn;
  }

  if (!cached.promise) {
    console.log("Establishing new MongoDB connection");
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((mongooseInstance) => {
        console.log("MongoDB connected successfully");
        return mongooseInstance;
      })
      .catch((err) => {
        console.error("MongoDB connection error:", err);
        cached.promise = null;
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default dbConnect;
