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

  // Join a match - this will create the match on backend if it doesn't exist
  const joinMatch = (matchId: string) => {
    if (!user?.id || !user?.name) {
      console.error('User not authenticated');
      return;
    }

    const message: WebSocketMessage = {
      type: 'PLAYER_JOINED',
      data: { 
        username: user.name,
        matchId 
      },
      timestamp: Date.now(),
      matchId,
      userId: user.id
    };
    sendMessage(message);
    console.log(`Joining match ${matchId} as ${user.name}`);
  };

  // Leave a match
  const leaveMatch = (matchId: string) => {
    if (!user?.id || !user?.name) {
      console.error('User not authenticated');
      return;
    }

    const message: WebSocketMessage = {
      type: 'PLAYER_LEFT',
      data: { 
        username: user.name,
        matchId 
      },
      timestamp: Date.now(),
      matchId,
      userId: user.id
    };
    sendMessage(message);
    console.log(`Leaving match ${matchId}`);
  };

  // Share joining code with other players in the match
  const shareJoiningCode = (matchId: string, joiningCode: string) => {
    if (!user?.id || !user?.name) {
      console.error('User not authenticated');
      return;
    }

    const message: WebSocketMessage = {
      type: 'CODE_SHARED',
      data: {
        joiningCode,
        username: user.name,
        matchId
      },
      timestamp: Date.now(),
      matchId,
      userId: user.id
    };
    sendMessage(message);
    console.log(`Sharing joining code ${joiningCode} in match ${matchId}`);
  };

  // Create or join a match with a specific code
  const createOrJoinMatch = (matchId: string, joiningCode?: string) => {
    // First join the match
    joinMatch(matchId);
    
    // If we have a joining code to share, share it after joining
    if (joiningCode) {
      // Small delay to ensure join message is processed first
      setTimeout(() => {
        shareJoiningCode(matchId, joiningCode);
      }, 100);
    }
  };

  // Helper to check if user is in a specific match based on last message
  const isUserInMatch = (matchId: string): boolean => {
    // You can enhance this based on your app's state management
    return lastMessage?.matchId === matchId && 
           (lastMessage?.type === 'MATCH_READY' || lastMessage?.type === 'PLAYER_JOINED');
  };

  const contextValue: WebSocketContextType = {
    socket,
    isConnected,
    lastMessage,
    sendMessage,
    joinMatch,
    leaveMatch,
    shareJoiningCode,
    createOrJoinMatch, // Renamed from createMatchAndShare
    isUserInMatch
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