import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Play, Clock, CheckCircle, XCircle, AlertCircle, Trophy, Users } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import apiClient from "../utils/axiosConfig"; 

const Playground: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('PYTHON');
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [problem, setProblem] = useState<any>(null);
  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<any>(null);

  // Language templates
  const codeTemplates = {
    PYTHON: `def solution():
    # Write your solution here
    pass

# Test your solution

if __name__ == "__main__":
    result = solution()
    print(result)`,
    JAVASCRIPT: `function solution() {
    // Write your solution here
    
}

// Test your solution
console.log(solution());`,
    CPP: `#include <iostream>
#include <vector>
using namespace std;

int main() {
    // Write your solution here
    
    return 0;
}`,
    JAVA: `public class Solution {
    public static void main(String[] args) {
        // Write your solution here
        
    }
}`,
    C: `#include <stdio.h>

int main() {
    // Write your solution here
    
    return 0;
}`
  };

  useEffect(() => {
    fetchMatchData();
  }, []);

  // useEffect(() => {
  //   if (match && match.timeLimit) {
  //     // Calculate time left based on match start time and time limit
  //     const matchStartTime = new Date(match.createdAt).getTime();
  //     const currentTime = new Date().getTime();
  //     const timeElapsed = Math.floor((currentTime - matchStartTime) / 1000);
  //     const remainingTime = Math.max(0, match.timeLimit - timeElapsed);
      
  //     setTimeLeft(remainingTime);
      
  //     if (remainingTime > 0) {
  //       const timer = setInterval(() => {
  //         setTimeLeft(prev => {
  //           if (prev <= 1) {
  //             clearInterval(timer);
  //             handleTimeUp();
  //             return 0;
  //           }
  //           return prev - 1;
  //         });
  //       }, 1000);

  //       return () => clearInterval(timer);
  //     } else {
  //       handleTimeUp();
  //     }
  //   }
  // }, [match]);

  useEffect(() => {
    // Set initial code template when language changes
    if (codeTemplates[language as keyof typeof codeTemplates] && !code) {
      setCode(codeTemplates[language as keyof typeof codeTemplates]);
    }
  }, [language]);

  const fetchMatchData = async () => {
    try {
      setLoading(true);
      const matchId = getCookie('matchId');
      
      console.log(matchId);
    
      if (!matchId) {
        setError('No active match found');
        return;
      }

      // Fetch match and question data
    const response = await apiClient.get(`/playground/playground/${matchId}`, // empty data
        { withCredentials: true } 
        );  
      if (response.data.success) {
        setMatch(response.data.match);
        setProblem(response.data.match.question);
        
        // Set initial code template
        if (codeTemplates[language as keyof typeof codeTemplates]) {
          setCode(codeTemplates[language as keyof typeof codeTemplates]);
        }
      } else {
        setError(response.data.message || 'Failed to fetch match data');
      }
    } catch (error: any) {
      console.error('Error fetching match data:', error);
      setError(error.response?.data?.message || 'Failed to load match data');
    } finally {
      setLoading(false);
    }
  };

  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return null;
  };

  const handleTimeUp = () => {
    alert('Time is up! Your current solution will be submitted automatically.');
    handleSubmit();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRunCode = async () => {
    if (!code.trim()) {
      alert('Please write some code first!');
      return;
    }

    setIsRunning(true);
    setTestResults([]);
    
    try {
      // For running code, we'll just show a preview with public test cases
      // This is a simulation - in real implementation, you might want to run against sample cases
      const publicTestCases = getPublicTestCases();
      
      setTimeout(() => {
        interface TestCase {
          input: string;
          output: string;
        }

        interface TestResult {
          testCase: number;
          input: string;
          expectedOutput: string;
          actualOutput: string;
          passed: boolean;
          time: number;
          memory: number;
        }

        const simulatedResults: TestResult[] = publicTestCases.map((testCase: TestCase, index: number) => ({
          testCase: index + 1,
          input: testCase.input,
          expectedOutput: testCase.output,
          actualOutput: testCase.output, // Simulated - would be actual execution result
          passed: true, // Simulated
          time: Math.random() * 100,
          memory: Math.random() * 1000
        }));
        
        setTestResults(simulatedResults);
        setIsRunning(false);
      }, 2000);
    } catch (error) {
      console.error('Error running code:', error);
      setIsRunning(false);
    }
  };

  const getPublicTestCases = () => {
    if (!problem || !problem.test_cases) return [];
    
    const testCases = problem.test_cases;
    
    // Handle different test case formats
    if (Array.isArray(testCases)) {
      return testCases.slice(0, 2); // Show first 2 as public
    } else if (testCases.public) {
      return testCases.public;
    } else if (testCases.testCases) {
      return testCases.testCases.slice(0, 2);
    }
    
    return [];
  };

  const handleSubmit = async () => {
    if (!code.trim()) {
      alert('Please write some code before submitting!');
      return;
    }

    setIsSubmitting(true);
    setSubmissionResult(null);
    
    try {
      const response = await apiClient.post('/playground/playground/', {
        answer: code,
        language: language
      }, {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log(code);
      console.log(language);

      if (response.data.success) {
        setSubmissionResult(response.data);
        
        // If match is complete, show results and navigate
        if (response.data.matchResult?.isComplete) {
          setTimeout(() => {
            navigate('/result', { 
              state: { 
                submissionResult: response.data,
                matchResult: response.data.matchResult 
              } 
            });
          }, 3000);
        }
      } else {
        setError(response.data.message || 'Submission failed');
      }
    } catch (error: any) {
      console.error('Error submitting code:', error);
      setError(error.response?.data?.message || 'Failed to submit code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    if (codeTemplates[newLanguage as keyof typeof codeTemplates]) {
      setCode(codeTemplates[newLanguage as keyof typeof codeTemplates]);
    }
  };

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full mx-auto mb-4"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <p className="text-white">Loading match data...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <motion.div
          className="text-center bg-red-900/20 border border-red-500 rounded-lg p-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Error</h2>
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors"
          >
            Back to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-screen flex flex-col bg-gray-900"
    >
      {/* Header */}
      <motion.div
        className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white">Code Battle</h1>
          {/* <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className={`font-mono text-lg ${timeLeft < 60 ? 'text-red-400' : 'text-cyan-400'}`}>
              {formatTime(timeLeft)}
            </span>
          </div> */}
          {match && (
            <div className="flex items-center gap-2 text-gray-300">
              <Users className="w-4 h-4" />
              <span className="text-sm">Match ID: {match.id.slice(0, 8)}..</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="px-3 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:border-cyan-400 outline-none"
            disabled={isSubmitting}
          >
            <option value="PYTHON">Python</option>
            <option value="JAVASCRIPT">JavaScript</option>
            <option value="CPP">C++</option>
            <option value="JAVA">Java</option>
            <option value="C">C</option>
          </select>
          
          <motion.button
            onClick={handleRunCode}
            disabled={isRunning || isSubmitting}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded transition-colors disabled:opacity-50"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Play className="w-4 h-4 inline mr-2" />
            {isRunning ? 'Running...' : 'Run'}
          </motion.button>
          
          <motion.button
            onClick={handleSubmit}
            disabled={isSubmitting || isRunning}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors disabled:opacity-50"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </motion.button>
        </div>
      </motion.div>

      <div className="flex-1 flex">
        {/* Problem Description */}
        <motion.div
          className="w-1/2 p-4 bg-gray-800 overflow-y-auto"
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={{ scrollbarWidth: 'thin' }}
        >
          <div className="space-y-4">
            {problem ? (
              <>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">{problem.title}</h2>
                  <div className="flex gap-2 mb-4">
                    <span className={`px-2 py-1 text-xs rounded text-white ${
                      problem.difficulty === 'Easy' ? 'bg-green-500' :
                      problem.difficulty === 'Medium' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}>
                      {problem.difficulty}
                    </span>
                    {problem.tags && problem.tags.map((tag: string, index: number) => (
                      <span key={index} className="px-2 py-1 bg-blue-500 text-xs rounded text-white">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="prose prose-invert max-w-none">
                  <div 
                    className="text-gray-300 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: problem.description }}
                  />
                </div>
                
                {problem.examples && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Examples:</h3>
                    {problem.examples.map((example: any, index: number) => (
                      <div key={index} className="bg-gray-700 p-3 rounded mb-2">
                        <div className="font-mono text-sm text-gray-300">
                          <div><strong>Input:</strong> {example.input}</div>
                          <div><strong>Output:</strong> {example.output}</div>
                          {example.explanation && (
                            <div><strong>Explanation:</strong> {example.explanation}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {Array.isArray(problem.constraints) && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Constraints:</h3>
                    <ul className="text-gray-300 text-sm space-y-1">
                      {problem.constraints.map((constraint: string, index: number) => (
                        <li key={index} className="font-mono">• {constraint}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {problem.expected_time_complexity && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Expected Complexity:</h3>
                    <div className="text-gray-300 text-sm space-y-1">
                      <div className="font-mono">Time: {problem.expected_time_complexity}</div>
                      {problem.expected_space_complexity && (
                        <div className="font-mono">Space: {problem.expected_space_complexity}</div>
                      )}
                    </div>
                  </div>
                )}
                <div>
                <h3 className="text-lg font-semibold text-white mb-2">Tips:</h3>
                    <div className="text-gray-300 text-sm space-y-1">
                      <div className="font-mono">Time: {problem.hints}</div>
                      {problem.expected_space_complexity && (
                        <div className="font-mono">Space: {problem.hints}</div>
                      )}
                    </div>
                </div>
              </>
            ) : (
              <div className="text-center text-gray-400">
                <p>Problem data not available</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Code Editor */}
        <motion.div
          className="w-1/2 flex flex-col"
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <div className="flex-1 border-b border-gray-700">
            <Editor
              height="60%"
              language={language.toLowerCase()}
              value={code}
              onChange={value => setCode(value || '')}
              theme="vs-dark"
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 16 },
                wordWrap: 'on',
                lineNumbers: 'on',
                folding: true,
                matchBrackets: 'always'
              }}
            />
          </div>
          
          {/* Test Results */}
          <div className="h-2/5 bg-gray-900 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">Results</h3>
              {submissionResult && (
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${submissionResult.execution.allPassed ? 'text-green-400' : 'text-yellow-400'}`}>
                    {submissionResult.execution.passRate} tests passed
                  </span>
                  {submissionResult.matchResult?.isComplete && (
                    <Trophy className="w-4 h-4 text-yellow-400" />
                  )}
                </div>
              )}
            </div>
            
            {isRunning && (
              <div className="flex items-center gap-2 text-yellow-400">
                <motion.div
                  className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                Running tests...
              </div>
            )}

            {isSubmitting && (
              <div className="flex items-center gap-2 text-cyan-400">
                <motion.div
                  className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                Submitting solution...
              </div>
            )}

            {submissionResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className={`p-3 rounded border-l-4 ${
                  submissionResult.execution.allPassed 
                    ? 'bg-green-900/30 border-green-500' 
                    : 'bg-yellow-900/30 border-yellow-500'
                }`}>
                  <div className="text-white font-semibold mb-2">
                    Submission Results
                  </div>
                  <div className="text-sm text-gray-300 space-y-1">
                    <div>Tests: {submissionResult.execution.passRate}</div>
                    <div>Avg Time: {submissionResult.execution.avgTime?.toFixed(3)}s</div>
                    <div>Avg Memory: {submissionResult.execution.avgMemory?.toFixed(2)} KB</div>
                  </div>
                </div>

                {submissionResult.matchResult?.isComplete && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500 rounded p-3"
                  >
                    <div className="flex items-center gap-2 text-white font-semibold mb-2">
                      <Trophy className="w-5 h-5" />
                      Match Complete!
                    </div>
                    {submissionResult.matchResult.winner && (
                      <div className="text-sm text-gray-300">
                        Winner: {submissionResult.matchResult.winner.username}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-2">
                      Redirecting to results in 3 seconds...
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
            
            {testResults.length > 0 && !submissionResult && (
              <div className="space-y-2">
                {testResults.map((result, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`p-3 rounded border-l-4 ${
                      result.passed 
                        ? 'bg-green-900/30 border-green-500' 
                        : 'bg-red-900/30 border-red-500'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {result.passed ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                      <span className={`font-semibold ${result.passed ? 'text-green-400' : 'text-red-400'}`}>
                        Test Case {result.testCase} {result.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    </div>
                    <div className="font-mono text-sm text-gray-300">
                      <div>Input: {result.input}</div>
                      <div>Output: {result.actualOutput}</div>
                      <div>Expected: {result.expectedOutput}</div>
                      {result.time && <div>Time: {result.time.toFixed(3)}s</div>}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Playground;