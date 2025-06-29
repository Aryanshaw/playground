export interface WebSocketMessage {
    type: 'PLAYER_JOINED' | 'PLAYER_LEFT' | 'CODE_SHARED' | 'MATCH_COMPLETED' | 'MATCH_STATUS' | 'ERROR';
    data: any;
    timestamp: number;
    matchId?: string;
    userId?: string;
  }
  
  export interface PlayerJoinedData {
    playerId: string;
    username: string;
    matchId: string;
    totalPlayers: number;
  }
  
  export interface PlayerLeftData {
    playerId: string;
    username: string;
    matchId: string;
    remainingPlayers: number;
  }
  
  export interface CodeSharedData {
    playerId: string;
    username: string;
    joiningCode: string;
    timestamp: number;
    matchId: string;
  }
  
  export interface MatchCompletedData {
    winnerId: string;
    winnerUsername: string;
    completedAt: number;
    matchId: string;
    executionTime: number;
    passedTests: number;
    totalTests: number;
  }
  
  export interface WebSocketContextType {
    socket: WebSocket | null;
    isConnected: boolean;
    lastMessage: WebSocketMessage | null;
    sendMessage: (message: WebSocketMessage) => void;
    joinMatch: (matchId: string) => void;
    leaveMatch: (matchId: string) => void;
    // shareCode: (matchId: string, code: string, language: string) => void;
    shareJoiningCode: (matchId: string, code: string) => void;
    createMatchAndShare: (matchId: string) => void
  }
  