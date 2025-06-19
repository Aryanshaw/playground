import { Router } from "express";
import { UserDashboardRoute } from "./user-dashboard";
import { LeavePlaygroundRoute } from "./leave-playgroung";
import { PlaygroundDashboardRoute } from "./playground-dashboard";
import { PlaygroundRoute } from "./playground";
import { WaitingRoomRoute } from "./waiting-room";
import client from "@repo/db/client";
import { getAuth } from "firebase-admin/auth";
import { initializeApp, cert } from 'firebase-admin/app';

export const router = Router();

// Initialize Firebase Admin SDK (not client SDK)
// You need to use your service account key here
const admin = initializeApp({
  credential: cert({
    projectId: 'playground-50326',
    // Add your service account credentials here
    // You can download the service account key from Firebase Console
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || "",
  }),
  projectId: 'playground-50326',
});

/**
 * SYNC FIREBASE USER TO LOCAL DATABASE
 */
router.post("/sync-user", async (req, res) => {
  try {
    const token = req.headers.authorization?.split("Bearer ")[1];
    
    if (!token) {
      res.status(401).json({ error: "No token provided." });
    }

    console.log("Received token:", token);

    // Verify the Firebase ID token
    const decoded = await getAuth().verifyIdToken(token || "");
    console.log("Decoded token:", decoded);
    
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


router.use("/user-dashboard/",UserDashboardRoute)
router.use("/playground/",PlaygroundRoute)
router.use("/playground-dashboard/",PlaygroundDashboardRoute)
router.use("/playground-waiting-room/",WaitingRoomRoute)
router.use("/leave-playground/",LeavePlaygroundRoute)