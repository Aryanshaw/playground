import { Router } from "express";
import { UserDashboardRoute } from "./user-dashboard";
import { LeavePlaygroundRoute } from "./leave-playgroung";
import { PlaygroundDashboardRoute } from "./playground-dashboard";
import { PlaygroundRoute } from "./playground";
import { WaitingRoomRoute } from "./waiting-room";
import client from "@repo/db/client";
import { getAuth } from "firebase-admin/auth";
import { initializeApp, cert } from 'firebase-admin/app';
import FirebaseMiddleware from "../middlewares/user"; // Import the fixed middleware

export const router = Router();

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDOvssLSk8XHEMW\nxZ3FtIkHbFRKqHpk+9ry8Ev1tFMzn67xHxL+5445+XyPqyybDGWsSB1RJubSAGFQ\n/F43v5nNk8SzTnZMnwo5kV2h06PLMfZq6bXzxBHVRaqEdHNginVUDDgBRRYe55pr\nvTFoe7thyDE8pIMMkEUHORrGPQfbrg8QRvhAYLfgERUNjx5VADOZY4Pu9m6BC0kl\n37w7Dgjmurkiq9nw7QY95vmifJ/S3UCpqf5HKZIkmqFxuJ9bnO6PqlG6q8BQn6E/\nQUb6H/nJxlS9rHxGUiUFJeF6OcJXZ4+edE9IdlVHZSO+V+Vk00UP193VDnmwfXCB\n/bwl9oJ7AgMBAAECggEAEPJaumYw7XgHl8pDEH2n7c/XaPc+cSCj5d4Em/NYDpc8\nQ8+EQxi/88ibiTtCwMLXYrPWk1xY90XItFa7cl5mQQ+nw/ref5FZyTY9MpKijnld\n9Y2KuJyNyamYPJs/Cd7Pl0AZJyF+mrHpWoN7lVDvHyjFwG7Lvy/kOJ9Zrn46MquA\nHj8a4iPvfrPf0QWImO0y63mTphhPEyWkOnWIYMKkz50P5RUx/v+LXwd2md/xrJoY\ngcwNM8sfTovnad0jzDnZPaikoIPyKHLj4vKWrSM75qM7Z99vQxo9oRyWUVqyk5wP\nq4Oh7mhi03ZdAt6FKMN7M2pd0dKrXeqpOP43tWyDQQKBgQDr9WxuacURb2QYhXBX\npIkfFT85OdEFHtg19mm90hrxv1lEmBIBuzoHC4wFEvTYfRwsJGF2548nJ1n6sS7f\n3KlrhYxR1LnEFkHfjuWpnoaNJIk5b3eFCSQnc0Zx6W/3MjS0JZufkaP73SmhV9WN\n96vEOA2LdeszlzcxgqgjzNzsWQKBgQDgTiq8GiSgZ78qbY9arqn7g1sKfCdDGGVt\niJYSsmJWJA0I7j4CtVcBjVXr60l30j0eoOV0gniH4jju6X6c7c/8rWMVw5tROY3G\nv31G1Iz8F3XQPqGoximSSGEVT4xq9sC2IZOdIIEWUxxqg7IvbkR6muiSODp49z9s\nwyAwSaY68wKBgF7EDc12e2haNXhHt2vrsAqkzOSd3N3SmoFpuuQ6ywmGkUKkVK8P\nU+nacFzlVSLRdIwh/Gb17x+JhXDS0oGkLQL6+vUum4EuczxnNsPd4Co1n0tLAlSS\n7EtP194OJCLCrjof1JXMt3CDTaH4FdPTwc+nt4DoVhM9SzR+RitCrwPZAoGBAI6a\n46yHanXYv773vMZIeaWAE6eM22Fa51FGHzNv2fkuHmNpJF+Qbup7sv60rhbRwS3x\n2S/Dq2Gov82VAXw/7ZWVnoM9w0dWsf6Dy9/2TlQPjkWBLEIjClcIUUC9PGbczhR9\nMF4bRjatTEmjxOtGzZ6tUeN0gChb+STqwVIx4M9lAoGBAMQ9W1MaPHTZRFogmUkR\nNGCuZ82lYBk8MZAq0uE++QC2d4njVclMYxiaIPzazzOb/QJ7Zpr3tH7ctMbMsVI3\nzeo+QiOSoA92LdVYjMTrCl1kaKkLnvWB0vTpHSy1EHb/zzW7OXqmSBgUqaIbCACM\nq3kAlVxyOWFX3w6Il9kBL4xd\n-----END PRIVATE KEY-----\n";

if (!privateKey) {
  throw new Error("FIREBASE_PRIVATE_KEY is not set or invalid.");
}

const admin = initializeApp({
  credential: cert({
    projectId: 'playground-50326',
    privateKey,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@playground-50326.iam.gserviceaccount.com",
  }),
  projectId: 'playground-50326',
});

console.log("Private Key (first 50 chars):", process.env.FIREBASE_PRIVATE_KEY?.slice(0, 50));
console.log("Client Email:", process.env.FIREBASE_CLIENT_EMAIL);

/**
 * SYNC FIREBASE USER TO LOCAL DATABASE
 */
router.post("/sync-user", async (req, res) => {
  try {
    const token = req.headers.authorization?.split("Bearer ")[1];
    
    if (!token) {
      res.status(401).json({ error: "No token provided." });
      return;
    }

    console.log("Received token:", token.substring(0, 50) + "...");

    // Verify the Firebase ID token
    const decoded = await getAuth().verifyIdToken(token);
    console.log("Decoded token:", decoded);

    // Set cookie with proper security settings
    res.cookie("fireBaseToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Use secure in production
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax", // More flexible for development
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      path: "/" // Ensure cookie is available for all routes
    });
    
    const { uid, email } = decoded;
    const username = email?.split('@')[0]; // e.g. "john" from "john@example.com"

    // Check if user already exists in database
    let user = await client.user.findFirst({
      where: { firebaseUid: uid }
    });

    if (!user) {
      // Create new user in database
      user = await client.user.create({
        data: {
          firebaseUid: uid,
          email: email || "default@example.com",
          name: username || "Anonymous",
          isverified: decoded.email_verified || false,
        },
      });
      console.log("Created new user:", user);
    } else {
      // Update existing user's verification status
      user = await client.user.update({
        where: { firebaseUid: uid },
        data: {
          isverified: decoded.email_verified || false,
          name: username || user.name, // Update name if provided
        },
      });
      console.log("Updated existing user:", user);
    }

    res.status(200).json({ 
      success: true,
      user: {
        id: user.id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        name: user.name,
        isverified: user.isverified,
      }
    });
    
  } catch (err) {
    console.error("Token verification failed:", err);
    res.status(401).json({ 
      error: "Invalid token",
      details: err instanceof Error ? err.message : "Unknown error"
    });
  }
});

// Apply middleware to protected routes
router.use("/user-dashboard/", FirebaseMiddleware, UserDashboardRoute);
router.use("/playground/", FirebaseMiddleware, PlaygroundRoute);
router.use("/playground-dashboard/", FirebaseMiddleware, PlaygroundDashboardRoute);
router.use("/playground-waiting-room/", FirebaseMiddleware, WaitingRoomRoute);
router.use("/leave-playground/", FirebaseMiddleware, LeavePlaygroundRoute);