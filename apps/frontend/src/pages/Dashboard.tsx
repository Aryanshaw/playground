import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Trophy, Target, Clock, LogOut, Play, Copy } from "lucide-react";
import { useUser } from "../contexts/UserContext";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import ParticleBackground from "../components/ParticleBackground";
import { getAuth, signOut as firebaseSignOut } from "firebase/auth";
import apiClient from "../utils/axiosConfig";

interface CreateMatchResponse {
  success: boolean;
  joiningCode: string;
  message: string;
  matchId: string;
}

interface JoinMatchResponse {
  success: boolean;
  message: string;
  matchId: string;
  matchDetails?: any;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, setUser } = useUser();
  const { joinMatch, shareJoiningCode, lastMessage, isConnected } = useWebSocketContext();
  const [topic, SetTopic] = useState<string>("BINARY_SEARCH");
  const [difficulty, SetDifficulty] = useState<string>("EASY");
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  const [joiningCode, setJoiningCode] = useState<string>("");
  const [joinCode, setJoinCode] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [matchStatus, setMatchStatus] = useState<string>("");

  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

  // Listen for WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      switch (lastMessage.type) {
        case 'MATCH_READY':
          setMatchStatus("Match is ready! Both players connected.");
          console.log('Match ready:', lastMessage.data);
          break;
        case 'WAITING_FOR_PLAYERS':
          setMatchStatus("Waiting for another player to join...");
          console.log('Waiting for players:', lastMessage.data);
          break;
        case 'CODE_SHARED':
          console.log('Code shared in match:', lastMessage.data);
          break;
        case 'PLAYER_JOINED':
          setMatchStatus("Player joined the match!");
          navigate("/playground")
          console.log('Player joined:', lastMessage.data);
          break;
        case 'ERROR':
          console.error('WebSocket error:', lastMessage.data.message);
          setMatchStatus(`Error: ${lastMessage.data.message}`);
          break;
      }
    }
    console.log(lastMessage?.data);
  }, [lastMessage]);

  const handleLogout = async () => {
    try {
      await firebaseSignOut(getAuth());
      setUser(null);
      navigate("/auth");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const winRate = user.stats.totalMatches > 0 
    ? Math.round((user.stats.wins / user.stats.totalMatches) * 100) 
    : 0;

  const topics = [
    "BINARY_SEARCH",
    "ARRAY",
    "HASHING",
    "TWO_POINTERS",
    "SLIDING_WINDOW",
    "HEAP",
    "DYNAMIC_PROGRAMMING",
    "GREEDY",
    "BACKTRACKING",
    "TREE",
    "GRAPH",
    "LINKED_LIST",
    "STACK",
    "QUEUE",
    "STRING",
    "SORTING",
    "SEARCHING",
  ];
  
  const difficulties = ["EASY", "MEDIUM", "HARD"];

  // Create match on backend and get joining code
  const createMatchOnBackend = async (): Promise<CreateMatchResponse> => {
    try {
      const response = await apiClient.post('/playground-dashboard/match-with-your-buddy?action=create', {
        userId: user.id,
        username: user.name,
        topic: [topic],
        Difficulty: [difficulty],
        timestamp: Date.now()
      });

      console.log('Backend response:', response.data);
      console.log('Response structure:', {
        success: response.data.success,
        joiningCode: response.data.joiningCode,
        matchId: response.data.matchId,
        message: response.data.message,
        allKeys: Object.keys(response.data)
      });
      
      // Handle different possible response formats
      const responseData = response.data;
      
      // Sometimes the server might return success as a string or different format
      const isSuccess = responseData.success === true || responseData.success === 'true' || 
                       responseData.status === 'success' || response.status === 200;
      
      if (!isSuccess && responseData.success === false) {
        throw new Error(responseData.message || 'Failed to create match');
      }
      
      // Try different possible field names that the server might use
      const matchId = responseData.matchId || responseData.match_id || responseData.id || responseData.gameId;
      const joiningCode = responseData.joiningCode || responseData.joining_code || responseData.code || responseData.gameCode;
      
      // Create a normalized response
      const normalizedResponse: CreateMatchResponse = {
        success: true,
        matchId: matchId,
        joiningCode: joiningCode,
        message: responseData.message || 'Match created successfully'
      };
      
      console.log('Normalized response:', normalizedResponse);
      
      return normalizedResponse;
      
    } catch (error: any) {
      console.error('Failed to create match on backend:', error);
      
      // Handle specific error cases
      if (error.response?.status === 401) {
        throw new Error('Authentication failed. Please login again.');
      } else if (error.response?.status === 400) {
        throw new Error(error.response.data?.message || 'Invalid request data');
      } else if (error.response?.status >= 500) {
        throw new Error('Server error. Please try again later.');
      }
      
      throw new Error(error.response?.data?.message || 'Failed to create match on backend');
    }
  };

  // Join match on backend with joining code
  const joinMatchOnBackend = async (code: string): Promise<JoinMatchResponse> => {
    try {
      const response = await apiClient.post(`/playground-dashboard/match-with-your-buddy?action=join&code=${code}`, {
        userId: user.id,
        username: user.name,
        topic: [topic],
        Difficulty: [difficulty],
        // Remove joiningCode from request body since it's already in URL
        timestamp: Date.now()
      });

      console.log('Join match response:', response.data);
      console.log('Join response structure:', {
        success: response.data.success,
        matchId: response.data.matchId,
        message: response.data.message,
        allKeys: Object.keys(response.data)
      });
      
      // Handle different possible response formats
      const responseData = response.data;
      
      // Sometimes the server might return success as a string or different format
      const isSuccess = responseData.success === true || responseData.success === 'true' || 
                       responseData.status === 'success' || response.status === 200;
      
      if (!isSuccess && responseData.success === false) {
        throw new Error(responseData.message || 'Failed to join match');
      }
      
      // Try different possible field names that the server might use
      const matchId = responseData.matchId || responseData.match_id || responseData.id || responseData.gameId;
      
      // Create a normalized response
      const normalizedResponse: JoinMatchResponse = {
        success: true,
        matchId: matchId,
        message: responseData.message || 'Successfully joined match',
        matchDetails: responseData.matchDetails || responseData.details
      };
      
      console.log('Normalized join response:', normalizedResponse);
      
      return normalizedResponse;
      
    } catch (error: any) {
      console.error('Failed to join match on backend:', error);
      
      // Handle specific error cases
      if (error.response?.status === 401) {
        throw new Error('Authentication failed. Please login again.');
      } else if (error.response?.status === 400) {
        throw new Error(error.response.data?.message || 'Invalid joining code or match not found');
      } else if (error.response?.status === 404) {
        throw new Error('Match not found. Please check the joining code.');
      } else if (error.response?.status >= 500) {
        throw new Error('Server error. Please try again later.');
      }
      
      throw new Error(error.response?.data?.message || 'Failed to join match on backend');
    }
  };

  // Create a new match
  const handleCreateCode = async () => {
    if (!topic || !difficulty) {
      alert("Please select both topic and difficulty");
      return;
    }

    if (!user?.id) {
      alert("User not authenticated");
      return;
    }

    if (!isConnected) {
      alert("WebSocket not connected. Please wait and try again.");
      return;
    }
    
    setIsCreating(true);
    setMatchStatus("Creating match...");
    
    try {
      // Step 1: Create match on backend and get matchId + joiningCode
      const result = await createMatchOnBackend();
      
      console.log('Create match result:', result);
      
      // Validate the response more carefully
      if (!result.joiningCode && !result.matchId) {
        console.error('Server response missing both joiningCode and matchId:', result);
        throw new Error('Server did not return match details. Please try again.');
      }
      
      if (!result.joiningCode) {
        console.error('Server response missing joiningCode:', result);
        throw new Error('Server did not return joining code. Please try again.');
      }
      
      if (!result.matchId) {
        console.error('Server response missing matchId:', result);
        throw new Error('Server did not return match ID. Please try again.');
      }

      // Step 2: Join the WebSocket room using the matchId from backend
      console.log(`Joining WebSocket match: ${result.matchId}`);
      joinMatch(result.matchId);
      
      // Step 3: Share the joining code via WebSocket (so other players can see it)
      setTimeout(() => {
        shareJoiningCode(result.matchId, result.joiningCode);
      }, 500); // Small delay to ensure join is processed first
      
      // Step 4: Update local state
      setCurrentMatchId(result.matchId);
      setJoiningCode(result.joiningCode);
      setMatchStatus("Match created! Waiting for another player...");
      
      console.log('Match created successfully:', {
        matchId: result.matchId,
        joiningCode: result.joiningCode
      });

    } catch (error: any) {
      console.error("Error creating match:", error);
      setMatchStatus("Failed to create match");
      
      if (error.message?.includes('Authentication')) {
        alert("Authentication failed. Please login again.");
        handleLogout();
      } else {
        alert(error.message || "Failed to create match. Please try again.");
      }
    } finally {
      setIsCreating(false);
    }
  };

  // Join an existing match with code
  const handleJoinCode = async () => {
    if (!joinCode.trim()) {
      alert("Please enter a joining code");
      return;
    }

    if (!topic || !difficulty) {
      alert("Please select both topic and difficulty");
      return;
    }

    if (!user?.id) {
      alert("User not authenticated");
      return;
    }

    if (!isConnected) {
      alert("WebSocket not connected. Please wait and try again.");
      return;
    }

    setIsJoining(true);
    setMatchStatus("Joining match...");
    
    try {
      // Step 1: Join match on backend with the joining code
      const result = await joinMatchOnBackend(joinCode.trim().toUpperCase());
      
      console.log('Join match result:', result);
      
      if (!result.matchId) {
        console.error('Server response missing matchId:', result);
        throw new Error('Server did not return match ID. Please try again.');
      }

      // Step 2: Join the WebSocket room using the matchId from backend
      console.log(`Joining WebSocket match: ${result.matchId}`);
      joinMatch(result.matchId);
      
      // Step 3: Update local state
      setCurrentMatchId(result.matchId);
      setMatchStatus("Successfully joined match!");
      
      console.log('Successfully joined match:', {
        matchId: result.matchId,
        joiningCode: joinCode
      });

      // Step 4: Navigate to playground (can be immediate since we're joining existing match)
      setTimeout(() => {
        navigate("/playground", { 
          state: { 
            matchId: result.matchId,
            matchCode: joinCode.trim().toUpperCase(), 
            isCreator: false,
            topic,
            difficulty 
          } 
        });
      }, 1000);
      
    } catch (error: any) {
      console.error("Error joining match:", error);
      setMatchStatus("Failed to join match");
      
      if (error.message?.includes('Authentication')) {
        alert("Authentication failed. Please login again.");
        handleLogout();
      } else {
        alert(error.message || "Failed to join match. Please try again.");
      }
    } finally {
      setIsJoining(false);
    }
  };

  // Navigate to playground when match is ready
  const handleEnterPlayground = () => {
    if (currentMatchId && joiningCode) {
      navigate("/playground", { 
        state: { 
          matchId: currentMatchId,
          matchCode: joiningCode, 
          isCreator: true,
          topic,
          difficulty 
        } 
      });
    }
  };

  const copyToClipboard = async () => {
    if (joiningCode) {
      try {
        await navigator.clipboard.writeText(joiningCode);
        alert("Code copied to clipboard!");
      } catch (error) {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = joiningCode;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert("Code copied to clipboard!");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      <ParticleBackground />
      
      {/* Header */}
      <div className="relative z-10 flex justify-between items-center p-6">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center space-x-4"
        >
          <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
            {user.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{user.name}</h2>
            <p className="text-gray-300 text-sm">Ready to code!</p>
          </div>
        </motion.div>

        <motion.button
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={handleLogout}
          className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </motion.button>
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20"
          >
            <div className="flex items-center space-x-3">
              <Trophy className="text-yellow-400" size={24} />
              <div>
                <p className="text-gray-300">Win Rate</p>
                <p className="text-2xl font-bold text-white">{winRate}%</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20"
          >
            <div className="flex items-center space-x-3">
              <Target className="text-green-400" size={24} />
              <div>
                <p className="text-gray-300">Total Matches</p>
                <p className="text-2xl font-bold text-white">{user.stats.totalMatches}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20"
          >
            <div className="flex items-center space-x-3">
              <Clock className="text-blue-400" size={24} />
              <div>
                <p className="text-gray-300">Avg Time</p>
                <p className="text-2xl font-bold text-white">{user.stats.averageTime}s</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Match Configuration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 mb-8"
        >
          <h3 className="text-xl font-bold text-white mb-6">Configure Match</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-gray-300 mb-2">Topic</label>
              <select
                value={topic}
                onChange={(e) => SetTopic(e.target.value)}
                className="w-full p-3 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                {topics.map((t) => (
                  <option key={t} value={t} className="bg-gray-800">
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-300 mb-2">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => SetDifficulty(e.target.value)}
                className="w-full p-3 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                {difficulties.map((d) => (
                  <option key={d} value={d} className="bg-gray-800">
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </motion.div>

        {/* WebSocket Status */}
        {matchStatus && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-500/20 backdrop-blur-sm rounded-lg p-4 border border-blue-500/30 mb-6"
          >
            <p className="text-blue-200 text-center">{matchStatus}</p>
            <div className="text-center mt-2">
              <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></span>
              <span className="text-gray-300 ml-2 text-sm">
                WebSocket {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </motion.div>
        )}

        {/* Match Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create Match */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20"
          >
            <h3 className="text-xl font-bold text-white mb-4">Create Match</h3>
            
            <motion.button
              onClick={handleCreateCode}
              disabled={isCreating || !isConnected}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Play size={20} />
              <span>{isCreating ? 'Creating...' : 'Create Match'}</span>
            </motion.button>

            {joiningCode && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 bg-green-500/20 rounded-lg border border-green-500/30"
              >
                <p className="text-green-200 text-sm mb-2">Your joining code:</p>
                <div className="flex items-center space-x-2">
                  <code className="flex-1 bg-black/30 px-3 py-2 rounded text-green-300 font-mono">
                    {joiningCode}
                  </code>
                  <button
                    onClick={copyToClipboard}
                    className="bg-green-600 hover:bg-green-700 p-2 rounded transition-colors"
                  >
                    <Copy size={16} />
                  </button>
                </div>
                {lastMessage?.type === 'MATCH_READY' && (
                  <button
                    onClick={handleEnterPlayground}
                    className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors"
                  >
                    Enter Playground
                  </button>
                )}
              </motion.div>
            )}
          </motion.div>

          {/* Join Match */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20"
          >
            <h3 className="text-xl font-bold text-white mb-4">Join Match</h3>
            
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter joining code"
              className="w-full p-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 mb-4"
            />

            <motion.button
              onClick={handleJoinCode}
              disabled={isJoining || !joinCode.trim() || !isConnected}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Target size={20} />
              <span>{isJoining ? 'Joining...' : 'Join Match'}</span>
            </motion.button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;