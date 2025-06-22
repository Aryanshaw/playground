import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Trophy, Target, Clock, LogOut, Play, Copy } from "lucide-react";
import { useUser } from "../contexts/UserContext";
import ParticleBackground from "../components/ParticleBackground";
import { getAuth, signOut as firebaseSignOut } from "firebase/auth";
import axios from "axios";

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, setUser } = useUser();
  const [topic, SetTopic] = useState<string>("BINARY_SEARCH"); // Default value
  const [difficulty, SetDifficulty] = useState<string>("EASY"); // Default value
  const [joiningCode, setJoiningCode] = useState<string>("");
  const [joinCode, setJoinCode] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  if (!user) {
    navigate("/auth");
    return null;
  }

  const handleLogout = async () => {
    await firebaseSignOut(getAuth());
    setUser(null);
    navigate("/auth");
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
  const url = 'http://localhost:3000/v1';

  // Create match code
  const handleCreateCode = async () => {
    if (!topic || !difficulty) {
      alert("Please select both topic and difficulty");
      return;
    }
    
    setIsCreating(true);
    try {
      const response = await axios.post(
        `${url}/playground-dashboard/match-with-your-buddy?action=create`,
        {
          topic: [topic],
          Difficulty: [difficulty],
        },
        {
          withCredentials: true,
        }
      );
      
      console.log("Response from backend:", response.data);
      setJoiningCode(response.data.joiningCode);
      alert(`Match created! Share this code: ${response.data.joiningCode}`);
    } catch (error: any) {
      console.error("Error creating match:", error.response?.data || error.message);
      alert("Failed to create match. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  // Join match with code
  const handleJoinCode = async () => {
    if (!joinCode.trim()) {
      alert("Please enter a joining code");
      return;
    }

    if (!topic || !difficulty) {
      alert("Please select both topic and difficulty");
      return;
    }

    setIsJoining(true);
    try {
      const response = await axios.post(
        `${url}/playground-dashboard/match-with-your-buddy?action=join&code=${joinCode}`,
        {
          topic: [topic],
          Difficulty: [difficulty],
        },
        {
          withCredentials: true,
        }
      );
      
      console.log("Response from backend:", response.data);
      alert("Successfully joined the match!");
      // Navigate to game or handle success
    } catch (error: any) {
      console.error("Error joining match:", error.response?.data || error.message);
      alert(error.response?.data?.message || "Failed to join match. Please try again.");
    } finally {
      setIsJoining(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(joiningCode);
    alert("Code copied to clipboard!");
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Create Match */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-cyan-400">Create Match</h3>
              <button
                onClick={handleCreateCode}
                disabled={isCreating}
                className="w-full px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg text-white font-semibold hover:from-green-400 hover:to-emerald-400 transition-all duration-300 disabled:opacity-50"
              >
                {isCreating ? "Creating..." : "Create Match Code"}
              </button>
              
              {joiningCode && (
                <div className="flex items-center gap-2 p-3 bg-white/10 rounded-lg">
                  <span className="text-white font-mono text-lg flex-1">{joiningCode}</span>
                  <button
                    onClick={copyToClipboard}
                    className="p-2 text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
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
                disabled={isJoining}
                className="w-full px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white font-semibold hover:from-purple-400 hover:to-pink-400 transition-all duration-300 disabled:opacity-50"
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
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 1.4 + index * 0.1 }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${match.result === "WIN" ? "bg-green-500" : "bg-red-500"}`}
                  />
                  <span className="text-white">vs {match.opponent}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-300">{match.time}</span>
                  <span
                    className={`font-semibold ${match.result === "WIN" ? "text-green-400" : "text-red-400"}`}
                  >
                    {match.xp}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Public Match Button */}
        <motion.div
          className="text-center"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.6 }}
        >
          <motion.button
            onClick={() => navigate("/matching")}
            className="px-12 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full text-xl font-bold hover:from-cyan-400 hover:to-purple-500 transition-all duration-300 neon-border flex items-center gap-3 mx-auto"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Play className="w-6 h-6" />
            Find Public Match
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Dashboard;