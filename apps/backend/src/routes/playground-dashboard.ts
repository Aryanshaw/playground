import { Router } from "express";
import client from "@repo/db/client";
import FirebaseMiddleware from "../middlewares/user";
import wsServer from "../utils/WebSocketServer";
import { randomUUID } from "crypto";

export const JoiningcodeMap = new Map(); // code -> { creatorId, expiry, matchId?, createdAt }

export const PlaygroundDashboardRoute = Router();

// MOVE THE CLEANUP INTERVAL OUTSIDE THE ROUTE HANDLER
const cleanupInterval = setInterval(() => {
  const now = new Date();
  for (const [code, data] of JoiningcodeMap.entries()) {
    if (data.expiry < now) {
      JoiningcodeMap.delete(code);
      console.log(`Cleaned up expired code: ${code}`);
    }
  }
}, 10 * 60 * 1000);

PlaygroundDashboardRoute.post("/match-with-your-buddy", FirebaseMiddleware, async (req, res) => {
  console.log("=== ROUTE HANDLER STARTED ===");
  console.log("Request method:", req.method);
  console.log("Request query:", req.query);
  console.log("Request body:", req.body);

  try {
    const userId = req.userId;
    const name = req.userName;
    const { action } = req.query;
    const { Difficulty, topic } = req.body;

    console.log("=== PARSED REQUEST DATA ===");
    console.log("User ID:", userId);
    console.log("User Name:", name);
    console.log("Action:", action);
    console.log("Topic:", topic);
    console.log("Difficulty:", Difficulty);
    console.log("Topic[0]:", topic?.[0]);
    console.log("Difficulty[0]:", Difficulty?.[0]);

    // CASE 1: Player wants to create a joining code
    if (action === "create") {
      console.log("=== HANDLING CREATE ACTION ===");
      
      const joiningCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const matchId = randomUUID();


      JoiningcodeMap.set(joiningCode, {
        creatorId: userId,
        expiry: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes expiry
        createdAt: new Date(),
        Difficulty: Difficulty,
        Topic: topic,
        matchId
      });
      
      console.log("Created joining code:", joiningCode);
      console.log("JoiningcodeMap:", JoiningcodeMap);

      if(joiningCode){
        wsServer.handleCodeShared(userId || "", joiningCode, { username: name || "Anonymous", code: joiningCode })};      
      
      res.status(200).json({ 
        success: true,
        matchId, 
        joiningCode, 
        message: `Share ${joiningCode} with your buddy to join the match`
      });
      return;
    }

    // CASE 2: Player wants to join using a code
    else if (action === "join") {
      console.log("=== HANDLING JOIN ACTION ===");
      
      const { code } = req.query;

      if (!code) {
        console.log("❌ No joining code provided");
        res.status(400).json({
          success: false,
          message: "Joining code is required",
        });
        return;
      }

      // Check if code exists and is valid
      const codeData = JoiningcodeMap.get(code);

      if (!codeData) {
        console.log("❌ Invalid joining code:", code);
        res.status(404).json({
          success: false,
          message: "Invalid joining code",
        });
        return;
      }

      if (codeData.expiry < new Date()) {
        console.log("❌ Expired joining code:", code);
        JoiningcodeMap.delete(code);
        res.status(400).json({
          success: false,
          message: "This joining code has expired",
        });
        return;
      }

      // TEMPORARILY DISABLED FOR TESTING
      // if (codeData.creatorId === userId) {
      //   console.log("❌ User trying to join own game");
      //   return res.status(400).json({
      //     success: false,
      //     message: "You cannot join your own game",
      //   });
      // }
      
      console.log("⚠️  Allowing same user to join for testing purposes");

      // if (codeData.matchId) {
      //   console.log("❌ Game already in progress");
      //   res.status(400).json({
      //     success: false,
      //     message: "This game is already in progress",
      //   });
      //   return
      // }

      console.log("=== VALIDATING TOPIC AND DIFFICULTY ===");
      console.log("codeData info:", codeData.Difficulty, codeData.Topic);
      console.log("p2 info:", Difficulty, topic);

      if (codeData.Difficulty[0] !== Difficulty[0] || codeData.Topic[0] !== topic[0]) {
        console.log("❌ Topic/Difficulty mismatch");
        res.status(400).json({
          success: false,
          message: "Both players must have the same difficulty and topic to join the match"
        });
        return
      }

      const playerOneTeams = codeData.creatorId;
      const playerTwoTeams = userId;

      console.log("=== CREATING USERS IN DATABASE ===");
      console.log("playerOneTeams:", playerOneTeams);
      console.log("playerTwoTeams:", playerTwoTeams);

      // Create/update users
      await client.user.upsert({
        where: { id: codeData.creatorId },
        update: {},
        create: {
          id: codeData.creatorId,
          name: name || "Default Name",
          email: `${codeData.creatorId}@example.com`,
          firebaseUid: `firebase-${codeData.creatorId}`,
        },
      });

      await client.user.upsert({
        where: { id: userId },
        create: {
          id: userId,
          name: name || "Default Name",
          email: `${userId}@example.com`,
          firebaseUid: `firebase-${userId}`,
        },
        update: {}
      });

      console.log("=== CREATING TEAM ===");
      
      // Create team in db
      const team = await client.team.create({
        data: {
          playerOneId: playerOneTeams,
          playerTwoId: playerTwoTeams,
          joinCode: code as string,
          isPrivate: true,
        },
      });

      console.log("Team created - PL1:", team.playerOneId, "PL2:", team.playerTwoId);

      if (!topic || topic.length === 0 || !Difficulty || Difficulty.length === 0) {
        console.log("❌ Missing topic or difficulty");
        res.status(400).json({
          success: false,
          message: "Topic and difficulty are required",
        });
        return;
      }

      console.log("=== SEARCHING FOR QUESTION ===");

      console.log("Searching with topic:", topic[0], "difficulty:", Difficulty[0]);

      // THIS IS WHERE YOUR QUERY SHOULD HAPPEN
      let question = null;
      
      try {
        // Try exact match first
        question = await client.questionBank.findFirst({
          where: {
            tags: { hasSome: [topic[0]] },
            difficulty: Difficulty[0]
          },
        });

        console.log("Question query result:", question ? "FOUND" : "NOT FOUND");

        if (!question) {
          console.log("Trying with uppercase conversion...");
          question = await client.questionBank.findFirst({
            where: {
              tags: { hasSome: [topic[0].toUpperCase()] },
              difficulty: Difficulty[0].toUpperCase()
            },
          });
          console.log("Uppercase query result:", question ? "FOUND" : "NOT FOUND");
        }

        if (!question) {
          console.log("=== DIAGNOSTIC: No question found ===");
          
          // Check what's available
          const sampleQuestions = await client.questionBank.findMany({
            take: 5,
            select: { id: true, tags: true, difficulty: true }
          });
          
          console.log("Sample questions in database:", sampleQuestions);
          
          res.status(500).json({
            success: false,
            message: "No questions available for the given topic and difficulty",
            debug: {
              searchedTopic: topic[0],
              searchedDifficulty: Difficulty[0],
              availableQuestions: sampleQuestions.length
            }
          });
          return;
        }

        console.log("Found question:", question.id);

      } catch (dbError : any) {
        console.error("Database error:", dbError);
        res.status(500).json({
          success: false,
          message: "Database error occurred",
          error: dbError.message
        });
        return;
      }

      console.log("=== CREATING MATCH ===");
      
      // Create a match
      const match = await client.match.create({
        data: {
          id: codeData.matchId,
          teamId: team.id,
          questionId: question.id,
          status: "ACTIVE",
        },
      });

      console.log("Users matchId ->",match.id);
      

      res.cookie("matchId", match.id, {
        httpOnly: false,
        secure: false,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24,
      });

      // Update code data with match ID
      codeData.matchId = match.id;
      JoiningcodeMap.set(code, codeData);

      console.log("=== SENDING SOCKET EVENT ===");
      
      // Emit socket event to notify creator
      const io = req.app.get("io");
      io.to(`Hey! user-${codeData.creatorId}`).emit("matchCreated", {
        matchId: match.id,
        opponent: {
          id: userId,
          username: req.userName,
        },
        questionId: question.id,
      });

      console.log("=== JOIN SUCCESS ===");
      
      res.status(200).json({
        success: true,
        matchId: match.id,
        teamId: team.id,
        questionId: question.id,
        message: "Successfully joined the match!",
      });
      return;
    }

    // CASE 3: Check status of a code
    else if (action === "check") {
      console.log("=== HANDLING CHECK ACTION ===");
      
      const { code } = req.query;

      if (!code) {
        res.status(400).json({
          success: false,
          message: "Joining code is required",
        });
        return;
      }

      const codeData = JoiningcodeMap.get(code);

      if (!codeData) {
        res.status(404).json({
          success: false,
          message: "Invalid joining code",
        });
        return;
      }

      // If this user created the code, provide status
      if (codeData.creatorId === userId) {
        res.status(200).json({
          success: true,
          status: codeData.matchId ? "matched" : "waiting",
          matchId: codeData.matchId,
          expiresAt: codeData.expiry,
        })
        return;
      } else {
        res.status(403).json({
          success: false,
          message: "You don't have permission to check this code",
        });
        return;
      }
    }

    // Invalid action
    else {
      console.log("❌ Invalid action:", action);
      res.status(400).json({
        success: false,
        message: "Invalid action. Use 'create', 'join', or 'check'",
      });
      return;
    }

  } catch (error: any) {
    console.error("=== ROUTE HANDLER ERROR ===");
    console.error("Match with buddy error:", error?.message || error);
    console.error("Error stack:", error?.stack);
    
    res.status(500).json({
      success: false,
      error: error?.message || "Something went wrong",
    });
    return;
  }
});