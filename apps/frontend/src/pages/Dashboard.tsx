import React, { useState } from "react";
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
  matchId?: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, setUser } = useUser();
  const { createMatchAndShare, shareJoiningCode, joinMatch } = useWebSocketContext();
  const [topic, SetTopic] = useState<string>("BINARY_SEARCH");
  const [difficulty, SetDifficulty] = useState<string>("EASY");
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  const [joiningCode, setJoiningCode] = useState<string>("");
  const [joinCode, setJoinCode] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  if (!user) {
    navigate("/auth");
    return null;
  }

  const handleLogout = async () => {
    try {
      await firebaseSignOut(getAuth());
      setUser(null);
      navigate("/auth");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const winRate = Math.round((user.stats.wins / user.stats.totalMatches) * 100);

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


  // Match Service for backend API calls
  const createMatchOnBackend = async (matchId: string): Promise<CreateMatchResponse> => {
      try {
        const response = await apiClient.post(`/playground-dashboard/match-with-your-buddy?action=create`, {
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Include cookies
          body: JSON.stringify({
            matchId,
            userId: user.id,
            username: user.name,
            topic: [topic],
            Difficulty: [difficulty],
            timestamp: Date.now()
          })
        });
  
        if (!response) {
          throw new Error(`HTTP error! status: ${response}`);
        }
  
        const result = await response.data;
        console.log(result);
        return result;
        
      } catch (error) {
        console.error('Failed to create match:', error);
        throw error;
      }
    };

  // Create match using WebSocket approach
  const handleCreateCode = async () => {
    if (!topic || !difficulty) {
      alert("Please select both topic and difficulty");
      return;
    }

    if (!user?.id) {
      alert("User not authenticated");
      return;
    }
    
    setIsCreating(true);
    
    try {
      // Generate unique match ID
      const matchId = `match_${Date.now()}_${user.id}`;
      
      // First, join the match via WebSocket
      joinMatch(matchId);
      
      // Then create the match on backend and get joining code
      const result = await createMatchOnBackend(matchId);
      
      if (result.success && result.joiningCode) {
        // Share the joining code via WebSocket - this will trigger notifications
        shareJoiningCode(matchId, result.joiningCode);
        
        // Update local state
        setCurrentMatchId(matchId);
        setJoiningCode(result.joiningCode);
        
        console.log('Match created successfully:', {
          matchId,
          joiningCode: result.joiningCode,
          message: result.message
        });

        // Optional: Navigate to playground after a short delay
        setTimeout(() => {
          navigate("/playground", { 
            state: { 
              matchId,
              matchCode: result.joiningCode, 
              isCreator: true,
              topic,
              difficulty 
            } 
          });
        }, 2000); // Give time for WebSocket notifications
        
      } else {
        throw new Error(result.message || 'Failed to create match');
      }
      
    } catch (error: any) {
      console.error("Error creating match:", error);
      if (error.message?.includes('401') || error.message?.includes('Authentication')) {
        alert("Authentication failed. Please login again.");
        handleLogout();
      } else {
        alert(error.message || "Failed to create match. Please try again.");
      }
    } finally {
      setIsCreating(false);
    }
  };

  // Join match with code using WebSocket approach
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

    setIsJoining(true);
    
    try {
      // Generate match ID for joining (you might want to get this from backend)
      const matchId = `join_${Date.now()}_${user.id}`;
      
      // Join match via WebSocket first
      joinMatch(matchId);
      
      // Then join on backend
      const response = await apiClient.post(`/playground-dashboard/match-with-your-buddy?action=join&code=${joinCode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          matchId,
          userId: user.id,
          username: user.name,
          topic: [topic],
          Difficulty: [difficulty],
          joiningCode: joinCode
        })
      });
      
      if (response) {
        setCurrentMatchId(matchId);
        alert("Successfully joined the match!");
        
        // Navigate to playground
        navigate("/playground", { 
          state: { 
            matchId,
            matchCode: joinCode, 
            isCreator: false,
            topic,
            difficulty 
          } 
        });
      } else {
        throw new Error('Failed to join match');
      }
      
    } catch (error: any) {
      console.error("Error joining match:", error);
      if (error.message?.includes('401') || error.message?.includes('Authentication')) {
        alert("Authentication failed. Please login again.");
        handleLogout();
      } else {
        alert(error.message || "Failed to join match. Please try again.");
      }
    } finally {
      setIsJoining(false);
    }
  };

  const copyToClipboard = () => {
    if (joiningCode) {
      navigator.clipboard.writeText(joiningCode);
      alert("Code copied to clipboard!");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen relative"
    >
      <ParticleBackground />

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Header */}
        <motion.div
          className="flex justify-between items-center mb-8"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-4">
            <motion.img
              src={user.avatar}
              alt={user.name}
              className="w-16 h-16 rounded-full border-2 border-cyan-400"
              whileHover={{ scale: 1.1, rotate: 360 }}
              transition={{ duration: 0.5 }}
            />
            <div>
              <h1 className="text-2xl font-bold text-white">{user.name}</h1>
              <p className="text-cyan-400">Rank #{user.stats.rank}</p>
            </div>
          </div>

          <motion.button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-red-300 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <LogOut className="w-4 h-4" />
            Logout
          </motion.button>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {[
            {
              icon: Target,
              label: "Total Matches",
              value: user.stats.totalMatches,
              color: "from-blue-500 to-cyan-500",
            },
            {
              icon: Trophy,
              label: "Win Rate",
              value: `${winRate}%`,
              color: "from-green-500 to-emerald-500",
            },
            {
              icon: Clock,
              label: "Best Time",
              value: `${user.stats.bestTime}s`,
              color: "from-orange-500 to-red-500",
            },
          ].map((stat, index) => (
            <motion.div
              key={index}
              className="glass-effect rounded-xl p-6 tilt-effect hover:bg-white/20 transition-all duration-300"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              whileHover={{ y: -5 }}
            >
              <div
                className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-lg flex items-center justify-center mb-4`}
              >
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">
                {stat.value}
              </h3>
              <p className="text-gray-300 text-sm">{stat.label}</p>
            </motion.div>
          ))}

          {/* Match Configuration */}
          <motion.div
            className="glass-effect rounded-xl p-6 tilt-effect hover:bg-white/20 transition-all duration-300"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.9 }}
            whileHover={{ y: -5 }}
          >
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mb-4">
              <span className="text-white text-xl font-bold">👨‍💻</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Match Setup</h3>

            <div className="space-y-3">
              <select
                className="w-full p-2 bg-white/10 text-white rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={topic}
                onChange={(e) => SetTopic(e.target.value)}
              >
                {topics.map((topicOption) => (
                  <option
                    className="bg-gray-800 text-white"
                    key={topicOption}
                    value={topicOption}
                  >
                    {topicOption.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>

              <select
                className="w-full p-2 bg-white/10 text-white rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={difficulty}
                onChange={(e) => SetDifficulty(e.target.value)}
              >
                {difficulties.map((difficultyOption) => (
                  <option
                    className="bg-gray-800 text-white"
                    key={difficultyOption}
                    value={difficultyOption}
                  >
                    {difficultyOption}
                  </option>
                ))}
              </select>
            </div>
          </motion.div>
        </motion.div>

        {/* Create/Join Match Section */}
        <motion.div
          className="glass-effect rounded-xl p-6 mb-8"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <h2 className="text-xl font-bold mb-4 text-white">Private Match</h2>
          
          {/* Current Match Status */}
          {currentMatchId && (
            <div className="mb-4 p-3 bg-blue-500/20 rounded-lg border border-blue-400/30">
              <p className="text-blue-300 text-sm">
                Current Match: <span className="font-mono">{currentMatchId}</span>
              </p>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Create Match */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-cyan-400">Create Match</h3>
              <button
                onClick={handleCreateCode}
                disabled={isCreating || !user?.id}
                className={`w-full px-4 py-2 rounded-lg font-semibold text-white transition-all duration-300 ${
                  isCreating || !user?.id
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400'
                }`}
              >
                {isCreating ? "Creating Match..." : "Create Match Code"}
              </button>
              
              {joiningCode && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 bg-white/10 rounded-lg">
                    <span className="text-white font-mono text-lg flex-1">{joiningCode}</span>
                    <button
                      onClick={copyToClipboard}
                      className="p-2 text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-green-400 text-sm">
                    ✅ Match created! WebSocket notifications sent.
                  </p>
                </div>
              )}
            </div>

            {/* Join Match */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-purple-400">Join Match</h3>
              <input
                type="text"
                placeholder="Enter joining code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="w-full p-2 bg-white/10 text-white rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-400"
              />
              <button
                onClick={handleJoinCode}
                disabled={isJoining || !user?.id}
                className={`w-full px-4 py-2 rounded-lg font-semibold text-white transition-all duration-300 ${
                  isJoining || !user?.id
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400'
                }`}
              >
                {isJoining ? "Joining..." : "Join Match"}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Rank Progress */}
        <motion.div
          className="glass-effect rounded-xl p-6 mb-8"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.0 }}
        >
          <h2 className="text-xl font-bold mb-4 text-white">Rank Progress</h2>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm text-gray-300 mb-2">
                <span>Current Rank: #{user.stats.rank}</span>
                <span>Next: #{user.stats.rank - 1}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Recent Matches */}
        <motion.div
          className="glass-effect rounded-xl p-6 mb-8"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          <h2 className="text-xl font-bold mb-4 text-white">Recent Matches</h2>
          <div className="space-y-3">
            {[
              {
                opponent: "Alex Chen",
                result: "WIN",
                time: "2m 45s",
                xp: "+25",
              },
              {
                opponent: "Sarah Kim",
                result: "LOSS",
                time: "4m 12s",
                xp: "-10",
              },
              {
                opponent: "Mike Johnson",
                result: "WIN",
                time: "1m 58s",
                xp: "+30",
              },
            ].map((match, index) => (
              <motion.div
                key={index}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all duration-300"
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 1.4 + index * 0.1 }}
                whileHover={{ x: 5 }}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    match.result === 'WIN' ? 'bg-green-400' : 'bg-red-400'
                  }`}></div>
                  <div>
                    <p className="text-white font-medium">vs {match.opponent}</p>
                    <p className="text-gray-400 text-sm">{match.topic}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${
                    match.result === 'WIN' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {match.result}
                  </p>
                  <p className="text-gray-400 text-sm">{match.time}</p>
                </div>
                <div className={`px-2 py-1 rounded text-sm font-medium ${
                  match.result === 'WIN' 
                    ? 'bg-green-400/20 text-green-400' 
                    : 'bg-red-400/20 text-red-400'
                }`}>
                  {match.xp}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          className="glass-effect rounded-xl p-6"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.4 }}
        >
          <h2 className="text-xl font-bold mb-4 text-white">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.button
              onClick={() => navigate("/leaderboard")}
              className="flex items-center gap-3 p-4 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg text-white font-semibold hover:from-yellow-400 hover:to-orange-400 transition-all duration-300"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <Trophy className="w-5 h-5" />
              Leaderboard
            </motion.button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Dashboard;