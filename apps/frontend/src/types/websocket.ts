// WebSocket Message Types
export type MessageType =
  | 'PLAYER_JOINED'
  | 'PLAYER_LEFT'
  | 'CODE_SHARED'
  | 'MATCH_COMPLETED'
  | 'MATCH_READY'
  | 'WAITING_FOR_PLAYERS'
  | 'ERROR';

// Base WebSocket Message Structure
export interface WebSocketMessage {
  type: MessageType;
  data: any;
  matchId?: string;
  timestamp?: number;
  userId?: string;
}

// Specific message data types for type safety
export interface PlayerJoinedData {
  username: string;
  matchId: string;
}

export interface PlayerLeftData {
  username: string;
  matchId: string;
}

export interface CodeSharedData {
  joiningCode: string;
  username: string;
  matchId: string;
  sharedBy?: string;
}

export interface MatchReadyData {
  matchId: string;
  totalPlayers: number;
  message: string;
}

export interface WaitingForPlayersData {
  matchId: string;
  totalPlayers: number;
  message: string;
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

export interface ErrorData {
  message: string;
  code?: string;
}

// Typed WebSocket Messages
export interface PlayerJoinedMessage extends WebSocketMessage {
  type: 'PLAYER_JOINED';
  data: PlayerJoinedData;
}

export interface PlayerLeftMessage extends WebSocketMessage {
  type: 'PLAYER_LEFT';
  data: PlayerLeftData;
}

export interface CodeSharedMessage extends WebSocketMessage {
  type: 'CODE_SHARED';
  data: CodeSharedData;
}

export interface MatchReadyMessage extends WebSocketMessage {
  type: 'MATCH_READY';
  data: MatchReadyData;
}

export interface WaitingForPlayersMessage extends WebSocketMessage {
  type: 'WAITING_FOR_PLAYERS';
  data: WaitingForPlayersData;
}

export interface MatchCompletedMessage extends WebSocketMessage {
  type: 'MATCH_COMPLETED';
  data: MatchCompletedData;
}

export interface ErrorMessage extends WebSocketMessage {
  type: 'ERROR';
  data: ErrorData;
}

// Union type for all possible messages
export type TypedWebSocketMessage = 
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | CodeSharedMessage
  | MatchReadyMessage
  | WaitingForPlayersMessage
  | MatchCompletedMessage
  | ErrorMessage;

// WebSocket Context Type
export interface WebSocketContextType {
  socket: WebSocket | null;
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: WebSocketMessage) => void;
  joinMatch: (matchId: string) => void;
  leaveMatch: (matchId: string) => void;
  shareJoiningCode: (matchId: string, joiningCode: string) => void;
  createOrJoinMatch: (matchId: string, joiningCode?: string) => void;
  isUserInMatch: (matchId: string) => boolean;
}

// Connection status types
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// Hook return type
export interface UseWebSocketReturn {
  socket: WebSocket | null;
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: WebSocketMessage) => void;
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
  connectionAttempts: number;
  connectionStatus: ConnectionStatus;
  maxReconnectAttempts: number;
}