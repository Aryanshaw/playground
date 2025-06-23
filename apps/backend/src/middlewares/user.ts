import { Request, Response, NextFunction } from "express";
import { getAuth } from "firebase-admin/auth";

declare global {
    namespace Express {
        interface Request {
            userId?: string;
            userName?: string;
            firebaseUid?: string;
        }
    }
}

async function FirebaseMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
        // Try to get token from cookies first, then from Authorization header
        let token = req.cookies?.fireBaseToken;
        
        if (!token) {
            // Fallback to Authorization header
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.split('Bearer ')[1];
            }
        }

        if (!token) {
            res.status(401).json({ message: "Access token is missing" });
            return;
        }

        console.log("Extracted Token:", token.substring(0, 50) + "...");

        // Verify Firebase ID token
        const decodedToken = await getAuth().verifyIdToken(token);
        
        // Extract user information from Firebase token
        req.firebaseUid = decodedToken.uid;
        req.userId = decodedToken.uid; // or use your database user ID
        req.userName = decodedToken.name || decodedToken.email?.split('@')[0] || 'Unknown';

        console.log(`Firebase UID: ${req.firebaseUid}, UserName: ${req.userName}`);
        
        next();
    } catch (error) {
        console.error("Firebase token verification error:", error);
        res.status(403).json({ 
            message: "Invalid or expired token",
            error: error instanceof Error ? error.message : "Unknown error"
        });
        return;
    }
}

export default FirebaseMiddleware;  