import { Router } from 'express';
import { UserDashboardRoute } from './user-dashboard';
import { LeavePlaygroundRoute } from './leave-playgroung';
import { PlaygroundDashboardRoute } from './playground-dashboard';
import { PlaygroundRoute } from './playground';
import { WaitingRoomRoute } from './waiting-room';
import client from '@repo/db/client';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, cert } from 'firebase-admin/app';
import FirebaseMiddleware from '../middlewares/user';
import dotenv from 'dotenv';
dotenv.config();

export const router = Router();

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';

if (!privateKey) {
  throw new Error('FIREBASE_PRIVATE_KEY is not set or invalid.');
}

const admin = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_CLIENT_PROJECT_ID || '',
    privateKey,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
  }),
  projectId: process.env.FIREBASE_CLIENT_PROJECT_ID || '',
});

console.log('Private Key (first 50 chars):', process.env.FIREBASE_PRIVATE_KEY?.slice(0, 50));
console.log('Client Email:', process.env.FIREBASE_CLIENT_EMAIL);

/**
 * SYNC FIREBASE USER TO LOCAL DATABASE
 * */
router.post('/sync-user', async (req, res) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];

    if (!token) {
      res.status(401).json({ error: 'No token provided.' });
      return;
    }

    console.log('Received token:', token.substring(0, 50) + '...');

    // Verify the Firebase ID token
    const decoded = await getAuth().verifyIdToken(token);
    console.log('Decoded token:', decoded);

    // Set cookie with proper security settings
    res.cookie('fireBaseToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Use secure in production
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // More flexible for development
      // sameSite: "none",
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      path: '/', // Ensure cookie is available for all routes
    });

    const { uid, email } = decoded;
    const username = email?.split('@')[0]; // e.g. "john" from "john@example.com"

    // // Check if user already exists in database
    // let user = await client.user.findFirst({
    //   where: { firebaseUid: uid }
    // });

    // Check if user already exists in database by email or firebaseUid
    let user = await client.user.findFirst({
      where: {
        OR: [{ firebaseUid: uid }, { email: email }],
      },
    });

    if (!user) {
      // Create new user in database
      user = await client.user.create({
        data: {
          firebaseUid: uid,
          email: email || 'default@example.com',
          name: username || 'Anonymous',
          isverified: decoded.email_verified || false,
        },
      });
      console.log('Created new user:', user);
    } else {
      // Update existing user's verification status and firebaseUid if necessary
      user = await client.user.update({
        where: { id: user.id }, // Use the unique ID of the user
        data: {
          firebaseUid: uid, // Update firebaseUid if it doesn't match
          isverified: decoded.email_verified || false,
          name: username || user.name, // Update name if provided
        },
      });
      console.log('Updated existing user:', user);
    }

    console.log('Existing user:', user);

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        name: user.name,
        isverified: user.isverified,
      },
    });
  } catch (err) {
    console.error('Token verification failed:', err);
    res.status(401).json({
      error: 'Invalid token',
      details: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

router.get('/', (req, res) => {
  res.send('Hello World!');
});

// Apply middleware to protected routes
router.use('/user-dashboard/', FirebaseMiddleware, UserDashboardRoute);
router.use('/playground/', FirebaseMiddleware, PlaygroundRoute);
router.use('/playground-dashboard/', FirebaseMiddleware, PlaygroundDashboardRoute);
router.use('/playground-waiting-room/', FirebaseMiddleware, WaitingRoomRoute);
router.use('/leave-playground/', FirebaseMiddleware, LeavePlaygroundRoute);
