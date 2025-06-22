// this will take user's token and store the user id 
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

declare global {
    namespace Express {
        interface Request {
            userId?: string;
            userName?: string;
        }
    }
}

interface DecodedToken {
  id: string;
  name: string;
}

function Middleware(req: Request, res: Response, next: NextFunction) {
  // Fetch the token from cookies
  const userToken = req.cookies?.access_token; // Assuming the token is saved as 'access_token'

  if (!userToken) {
    res.status(401).json({ message: "Access token is missing or invalid" });
    return;
  }

  console.log("Extracted Token from Cookie:", userToken);

  try {
    const JwtSecret = process.env.JWT_SECRET || "Secret"; // Use environment variable or fallback
    const decoded = jwt.verify(userToken, JwtSecret) as DecodedToken; // Verify the token
    req.userId = decoded.id; // Attach user ID to the request object
    req.userName = decoded.name; // Attach user name to the request object
    console.log(`UserId: ${req.userId}, UserName: ${req.userName}`);
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(403).json({ message: "Invalid or expired token" });
    return;
  }
}

export default Middleware;