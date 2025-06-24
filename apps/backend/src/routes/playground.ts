import { Router } from "express";
import client from "@repo/db/client";
import axios from "axios";
import FirebaseMiddleware from "../middlewares/user";

export const PlaygroundRoute = Router();

// Use environment variable for API key, fallback for development only
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || "";

// Helper function to get best submission for a user
function getBestSubmission(submissions: any[]) {
  if (submissions.length === 1) {
    return submissions[0];
  }

  // Priority: 1. Most tests passed, 2. Least execution time, 3. Least memory
  return submissions.reduce((best, current) => {
    // First priority: most tests passed
    if (current.passedTests > best.passedTests) {
      return current;
    } else if (current.passedTests < best.passedTests) {
      return best;
    }

    // Same tests passed, check execution time
    if (current.executionTime < best.executionTime) {
      return current;
    } else if (current.executionTime > best.executionTime) {
      return best;
    }

    // Same time, check memory usage
    if (current.memoryUsed < best.memoryUsed) {
      return current;
    }
    return best;
  });
}

// Comprehensive scoring function
function calculateUserScore(submission: any, question: any) {
  let score = 0;
  const weights = {
    correctness: 0.5,    // 50% weight for correctness
    efficiency: 0.3,     // 30% weight for time/space efficiency  
    completion: 0.2      // 20% weight for completion speed
  };

  // 1. Correctness Score (0-100)
  const correctnessScore = submission.totalTests > 0 ? 
    (submission.passedTests / submission.totalTests) * 100 : 0;

  // 2. Efficiency Score (0-100)
  let efficiencyScore = 50; // Base score
  
  // Time efficiency (compared to expected complexity)
  if (submission.executionTime && submission.executionTime > 0) {
    // Lower execution time = higher score
    const timeScore = Math.max(0, 50 - (submission.executionTime * 10));
    efficiencyScore += timeScore * 0.6;
  }

  // Memory efficiency
  if (submission.memoryUsed && submission.memoryUsed > 0) {
    // Lower memory usage = higher score
    const memoryScore = Math.max(0, 50 - (submission.memoryUsed / 1000));
    efficiencyScore += memoryScore * 0.4;
  }

  efficiencyScore = Math.min(100, efficiencyScore);

  // 3. Completion Score (based on submission time - you'll need to track this)
  const completionScore = 75; // Default score, can be calculated based on submission time

  // Calculate weighted final score
  score = (correctnessScore * weights.correctness) + 
          (efficiencyScore * weights.efficiency) + 
          (completionScore * weights.completion);

  return Math.round(score * 100) / 100; // Round to 2 decimal places
}

// Winner determination logic
async function determineMatchWinner(matchId: string) {
  try {
    // Get all solutions for this match
    const match = await client.match.findUnique({
      where: { id: matchId },
      include: {
        solutions: {
          include: {
            user: {
              select: { id: true, username: true, email: true }
            }
          }
        },
        question: true,
        team: true
      }
    });

    if (!match || !match.solutions || match.solutions.length === 0) {
      throw new Error('No solutions found for this match');
    }

    // Group solutions by user (in case multiple submissions per user)
    const userSubmissions: any = {};
    match.solutions.forEach((solution: any) => {
      const userId = solution.userId;
      if (!userSubmissions[userId]) {
        userSubmissions[userId] = {
          user: solution.user,
          submissions: []
        };
      }
      userSubmissions[userId].submissions.push(solution);
    });

    // Calculate scores for each user
    const userScores = Object.keys(userSubmissions).map(userId => {
      const userData = userSubmissions[userId];
      
      // Get best submission for this user
      const bestSubmission = getBestSubmission(userData.submissions);
      
      const score = calculateUserScore(bestSubmission, match.question);
      
      return {
        userId: userId,
        user: userData.user,
        bestSubmission: bestSubmission,
        score: score,
        metrics: {
          passedTests: bestSubmission.passedTests || 0,
          totalTests: bestSubmission.totalTests || 0,
          executionTime: bestSubmission.executionTime || 0,
          memoryUsed: bestSubmission.memoryUsed || 0,
          passRate: bestSubmission.totalTests > 0 ? 
            (bestSubmission.passedTests / bestSubmission.totalTests) * 100 : 0
        }
      };
    });

    // Sort users by score (highest first)
    userScores.sort((a, b) => b.score - a.score);

    // Determine winner and loser
    const winner = userScores[0];
    const loser = userScores.length > 1 ? userScores[userScores.length - 1] : null;

    // Check for tie
    const isTie = userScores.length > 1 && userScores[0].score === userScores[1].score;

    // Update match with winner information
    const matchResult = await client.match.update({
      where: { id: matchId },
      data: {
        status: 'COMPLETED',
        winnerId: isTie ? null : winner.userId,
        endTime: new Date()
      }
    });

    return {
      matchId: matchId,
      isTie: isTie,
      winner: winner,
      loser: loser,
      allParticipants: userScores,
      matchResult: matchResult
    };

  } catch (error) {
    console.error('Error determining match winner:', error);
    throw error;
  }
}

// Function to update user rankings based on match results
async function updateUserRankings(matchResult: any) {
  try {
    for (const participant of matchResult.allParticipants) {
      const isWinner = participant.userId === matchResult.winner?.userId;
      const isLoser = participant.userId === matchResult.loser?.userId;
      
      let pointsChange = 0;
      if (matchResult.isTie) {
        pointsChange = 5; // Tie points
      } else if (isWinner) {
        pointsChange = 10; // Winner points
      } else if (isLoser) {
        pointsChange = -2; // Small penalty for losing
      }

      // Update user's ranking/points in database
      try {
        await client.user.update({
          where: { id: participant.userId },
          data: {
            // Only update fields that exist in your schema
            // totalMatches: { increment: 1 },
            // wins: isWinner && !matchResult.isTie ? { increment: 1 } : undefined,
            // points: { increment: pointsChange }
          }
        });
      } catch (updateError) {
        console.error(`Error updating user ${participant.userId}:`, updateError);
        // Continue with other users even if one fails
      }
    }
  } catch (error) {
    console.error('Error updating user rankings:', error);
  }
}

// Function to handle match completion
async function handleMatchCompletion(matchId: string, currentUserId: string, submissionResult: any) {
  try {
    // Check if all participants have submitted
    const match = await client.match.findUnique({
      where: { id: matchId },
      include: {
        team: true,
        solutions: {
          select: {
            userId: true
          }
        }
      }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    const totalParticipants = [match.team?.playerOneId, match.team?.playerTwoId].filter(Boolean).length;
    const uniqueSubmitters = new Set(match.solutions.map((s: { userId: any; }) => s.userId));
    const submittedParticipants = uniqueSubmitters.size;

    console.log(`Match completion check: ${submittedParticipants}/${totalParticipants} participants submitted`);

    // If all participants have submitted, determine winner
    if (submittedParticipants >= totalParticipants) {
      const matchResult = await determineMatchWinner(matchId);
      
      // Update user rankings
      await updateUserRankings(matchResult);
      
      return matchResult;
    }
    return null; // Match not yet complete
  } catch (error) {
    console.error('Error handling match completion:', error);
    throw error;
  }
}

// Fixed waitForResult function with proper error handling
async function waitForResult(token: string, maxWaitTime = 30000): Promise<any> {
  const startTime = Date.now();
  const pollInterval = 1000; // Poll every second
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const response = await axios.get(
        `https://judge0-ce.p.rapidapi.com/submissions/${token}?base64_encoded=false`,
        {
          headers: {
            "X-RapidAPI-Key": RAPIDAPI_KEY,
            "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com"
          }
        }
      );
      
      const result = response.data;
      
      // Check if processing is complete (status.id > 2 means completed)
      if (result.status && result.status.id > 2) {
        return result;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (error: any) {
      console.error("Error checking submission status:", error?.message);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }
  
  throw new Error("Timeout waiting for Judge0 result");
}


// Fetch match and question data
PlaygroundRoute.get("/playground/:matchId", FirebaseMiddleware, async (req, res) => {
  try {
    const { matchId } = req.params;

    // Fetch match with question
    const match = await client.match.findUnique({
      where: { id: matchId },
      include: { question: true },
    });

    if (!match || !match.question) {
      res.status(404).json({
        success: false,
        message: "Match or question not found",
      });
      return;
    }
    res.status(200).json({
      success: true,
      match,
    });
  } catch (error: any) {
    console.error("Error fetching match data:", error.message || error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch match data",
    });
  }
});

// Main playground route with proper error handling
PlaygroundRoute.post("/playground", FirebaseMiddleware, async (req, res) => {
  try {
    const { answer, language } = req.body;
    const userId = req.userId || "";
    const MatchId = req.cookies.matchId;

    // Input validation
    if (!answer || !language) {
      res.status(400).json({ 
        success: false, 
        message: "Answer and language are required" 
      });
      return
    }

    if (!MatchId) {
      res.status(400).json({ 
        success: false, 
        message: "Match ID is required (missing from cookies)" 
      });
      return;
    }

    // Fetch match with question
    const match = await client.match.findUnique({
      where: { id: MatchId },
      include: { question: true }
    });

    if (!match || !match.question) {
      res.status(404).json({ 
        success: false, 
        message: "Match or question not found" 
      });
      return
    }

    // Parse test cases
    const testCaseWrapper = match.question.test_cases as any;
    console.log("testCase Wrapper: ", testCaseWrapper);
    
    let testCases = [];
    
    // Handle different test case formats
    if (Array.isArray(testCaseWrapper)) {
      testCases = testCaseWrapper;
    } else if (testCaseWrapper && typeof testCaseWrapper === 'object') {
      if (testCaseWrapper.testCases && Array.isArray(testCaseWrapper.testCases)) {
        testCases = testCaseWrapper.testCases;
      } else {
        // Combine hidden and public test cases
        const hiddenTests = testCaseWrapper.hidden || [];
        const publicTests = testCaseWrapper.public || [];
        testCases = [...publicTests, ...hiddenTests];
      }
    }
    
    // Normalize test case format
    testCases = testCases.map((test: any) => ({
      input: test.input || test.stdin || '',
      output: test.output || test.expected_output || test.stdout || ''
    }));
    
    if (!Array.isArray(testCases) || testCases.length === 0) {
      res.status(500).json({ 
        success: false, 
        message: "No valid test cases found" 
      });
      return;
    }
    
    console.log("Test cases to execute:", testCases);    
    
    const expectedTime = match.question.expected_time_complexity;
    const expectedSpace = match.question.expected_space_complexity;

    // Language mapping for Judge0
    const languageMap: Record<string, number> = {
      PYTHON: 71,
      CPP: 54,
      JAVASCRIPT: 63,
      JAVA: 62,
      C: 50
    };

    const languageId = languageMap[language.toUpperCase()];
    if (!languageId) {
      res.status(400).json({ 
        success: false, 
        message: "Unsupported language" 
      });
      return;
    }

    // Create solution record first
    const SubmitCode = await client.solution.create({
      data: {
        code: answer,
        language: language,
        match: { connect: { id: MatchId } },
        user: { connect: { id: userId } }
      }
    });

    let passedTests = 0;
    let totalTime = 0;
    let totalMemory = 0;
    let testResults = [];
    let allTokens = [];

    const sanitizedCode = answer.replace(/\r/g, '').replace(/^\s*\n/, '').trim();
    
    console.log("Sanitized code:", sanitizedCode);

    // Submit all test cases to Judge0
    for (let i = 0; i < testCases.length; i++) {
      const test = testCases[i];
      
      try {
        console.log(`Submitting test case ${i + 1}:`, {
          input: test.input,
          expectedOutput: test.output
        });

        // Submit the code and get a token
        const submissionResponse = await axios.post(
          "https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false",
          {
            source_code: sanitizedCode,
            language_id: languageId,
            stdin: test.input,
            expected_output: test.output
          },
          {
            headers: {
              "Content-Type": "application/json",
              "X-RapidAPI-Key": RAPIDAPI_KEY,
              "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com"
            }
          }
        );

        const token = submissionResponse.data.token;
        allTokens.push({ token, testCase: i + 1 });
        console.log(`Test case ${i + 1} submitted with token:`, token);

        // Wait for result using the improved waitForResult function
        const result = await waitForResult(token);

        console.log(`Test case ${i + 1} result:`, {
          status: result.status,
          stdout: result.stdout,
          stderr: result.stderr,
          time: result.time,
          memory: result.memory
        });

        testResults.push({
          testCase: i + 1,
          token: token,
          status: result.status,
          stdout: result.stdout,
          stderr: result.stderr,
          time: result.time,
          memory: result.memory,
          input: test.input,
          expectedOutput: test.output,
          actualOutput: result.stdout?.trim()
        });

        // Calculate metrics
        totalTime += parseFloat(result.time || "0");
        totalMemory += parseFloat(result.memory || "0");

        // Check if test passed
        const isCorrect = result.status?.id === 3 && 
                         result.stdout?.trim() === test.output?.trim();
        
        if (isCorrect) {
          passedTests++;
        }

        console.log(`Test case ${i + 1} ${isCorrect ? 'PASSED' : 'FAILED'}`);

      } catch (error: any) {
        console.error(`Error processing test case ${i + 1}:`, error);
        testResults.push({
          testCase: i + 1,
          token: null,
          status: { id: -1, description: "Error" },
          error: error.message || "Unknown error",
          input: test.input,
          expectedOutput: test.output
        });
      }
    }

    // Calculate average time and memory
    const avgTime = testCases.length > 0 ? totalTime / testCases.length : 0;
    const avgMemory = testCases.length > 0 ? totalMemory / testCases.length : 0;

    // Update solution record with performance data
    await client.solution.update({
      where: { id: SubmitCode.id },
      data: {
        executionTime: totalTime,
        memoryUsed: totalMemory,
        passedTests,
        totalTests: testCases.length
      }
    });

    const success = passedTests === testCases.length;

    // Check if match is complete and determine winner
    let matchCompletionResult = null;
    try {
      matchCompletionResult = await handleMatchCompletion(MatchId, userId, {
        passedTests,
        totalTests: testCases.length,
        executionTime: totalTime,
        memoryUsed: totalMemory
      });
    } catch (completionError) {
      console.error('Error handling match completion:', completionError);
      // Don't fail the main request if winner determination fails
    }

    // Enhanced response with match completion info
    const response: any = {
      success: true,
      message: "Code submitted and executed successfully",
      submission: {
        id: SubmitCode.id,
        code: answer,
        language: language,
        createdAt: SubmitCode.submittedAt
      },
      execution: {
        allPassed: success,
        passedTests,
        totalTests: testCases.length,
        passRate: `${passedTests}/${testCases.length}`,
        totalTime,
        avgTime,
        totalMemory,
        avgMemory,
        expectedTime,
        expectedSpace
      },
      tokens: allTokens,
      testResults: testResults,
      details: testResults.map(result => ({
        testCase: result.testCase,
        token: result.token,
        passed: result.status?.id === 3 && result.actualOutput === result.expectedOutput,
        status: result.status?.description || 'Unknown',
        input: result.input,
        expectedOutput: result.expectedOutput,
        actualOutput: result.actualOutput,
        time: result.time,
        memory: result.memory,
        error: result.stderr || result.error
      }))
    };

    // Add match completion info if available
    if (matchCompletionResult) {
      response.matchResult = {
        isComplete: true,
        isTie: matchCompletionResult.isTie,
        winner: matchCompletionResult.winner ? {
          userId: matchCompletionResult.winner.userId,
          username: matchCompletionResult.winner.user.username,
          score: matchCompletionResult.winner.score,
          metrics: matchCompletionResult.winner.metrics
        } : null,
        loser: matchCompletionResult.loser ? {
          userId: matchCompletionResult.loser.userId,
          username: matchCompletionResult.loser.user.username,
          score: matchCompletionResult.loser.score,
          metrics: matchCompletionResult.loser.metrics
        } : null,
        allParticipants: matchCompletionResult.allParticipants.map((p: any) => ({
          userId: p.userId,
          username: p.user.username,
          score: p.score,
          metrics: p.metrics,
          rank: matchCompletionResult.allParticipants.indexOf(p) + 1
        }))
      };
    } else {
      response.matchResult = {
        isComplete: false,
        message: "Waiting for other participants to submit their solutions"
      };
    }

    res.status(200).json(response);

  } catch (error: any) {
    console.error("Match with playground error:", error?.message || error);
    res.status(500).json({
      success: false,
      error: error?.message || "Something went wrong",
      details: error.stack || "No stack trace available"
    });
  }
});

// Helper routes
PlaygroundRoute.get("/detect-tab-change", async (req, res) => {
  res.json({
    "message": "this is from user playground detect-tab-change"
  });
});

PlaygroundRoute.post("/who-is-what", async (req, res) => {
  try {
    const GET_RESPONSE = await axios.get(
      "https://judge0-ce.p.rapidapi.com/submissions/2e979232-92fd-4012-97cf-3e9177257d10",
      {
        headers: {
          "X-RapidAPI-Key": RAPIDAPI_KEY,
          "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com"
        }
      }
    );
    
    res.json({
      success: true,
      data: GET_RESPONSE.data
    });
  } catch (error: any) {
    console.error("playground-winner-section error:", error?.message || error);
    res.status(400).json({ 
      success: false,
      error: error?.message || "Something went wrong." 
    });
  }
});