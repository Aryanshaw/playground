import React, { createContext, useContext, ReactNode } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { WebSocketMessage, WebSocketContextType } from '../types/websocket';
import { useUser } from './UserContext';

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const { user } = useUser();
  const WS_URL = 'ws://localhost:8080';
    
  const { socket, isConnected, lastMessage, sendMessage } = useWebSocket(
    WS_URL,
    user?.id
  );

  // Helper functions for common actions
  const joinMatch = (matchId: string) => {
    const message: WebSocketMessage = {
      type: 'PLAYER_JOINED',
      data: { matchId, userId: user?.id, username: user?.name },
      timestamp: Date.now(),
      matchId,
      userId: user?.id
    };
    sendMessage(message);
  };

  const leaveMatch = (matchId: string) => {
    const message: WebSocketMessage = {
      type: 'PLAYER_LEFT',
      data: { matchId, userId: user?.id, username: user?.name },
      timestamp: Date.now(),
      matchId,
      userId: user?.id
    };
    sendMessage(message);
  };

  // Function to share joining code when match is created
  const shareJoiningCode = (matchId: string, joiningCode: string) => {
    const message: WebSocketMessage = {
      type: 'CODE_SHARED',
      data: {
        matchId,
        userId: user?.id,
        username: user?.name,
        joiningCode,
        timestamp: Date.now()
      },
      timestamp: Date.now(),
      matchId,
      userId: user?.id
    };
    sendMessage(message);
    console.log("Sharing joining code:", joiningCode);
  };

  // Function to create match and share joining code
  const createMatchAndShare = async (matchId: string) => {
    try {
      // Call your backend API to create match
      const response = await fetch('/api/create-match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ matchId, userId: user?.id })
      });
      
      const result = await response.json();
      
      if (result.success && result.joiningCode) {
        // Share the joining code via WebSocket
        shareJoiningCode(matchId, result.joiningCode);
        return result.joiningCode;
      }
      
      throw new Error(result.message || 'Failed to create match');
    } catch (error) {
      console.error('Error creating match:', error);
      throw error;
    }
  };

  const contextValue: WebSocketContextType = {
    socket,
    isConnected,
    lastMessage,
    sendMessage,
    joinMatch,
    leaveMatch,
    shareJoiningCode,
    createMatchAndShare,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};