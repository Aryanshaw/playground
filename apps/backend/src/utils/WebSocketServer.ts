import WebSocket, { WebSocketServer as WSS, RawData } from 'ws';
import { IncomingMessage } from 'http';

type MessageType =
  | 'PLAYER_JOINED'
  | 'PLAYER_LEFT'
  | 'CODE_SHARED'
  | 'MATCH_COMPLETED'
  | 'MATCH_READY'
  | 'WAITING_FOR_PLAYERS'
  | 'ERROR';

interface WSMessage {
  type: MessageType;
  data: any;
  matchId?: string;
  timestamp?: number;
  userId?: string;
}

interface WinnerData {
  userId: string;
  username: string;
  executionTime: number;
  passedTests: number;
  totalTests: number;
}

class WebSocketServer {
  private wss: WSS;
  private clients: Map<string, WebSocket>;
  private matches: Map<string, { players: Map<string, { username: string }>, joiningCode?: string }>;

  constructor(port = 8080) {
    this.wss = new WSS({
      port,
      verifyClient: (info, done) => this.verifyClient(info.req, done)
    });

    this.clients = new Map();
    this.matches = new Map();

    this.wss.on('connection', this.handleConnection.bind(this));
    console.log(`WebSocket server running on port ${port}`);
  }

  private verifyClient(req: IncomingMessage, done: (result: boolean, code?: number, name?: string) => void): void {
    try {
      const url = new URL(req.url || '', 'http://localhost');
      const userId = url.searchParams.get('userId');
      done(!!userId);
    } catch (error) {
      console.error('Client verification failed:', error);
      done(false);
    }
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const url = new URL(req.url || '', 'http://localhost');
    const userId = url.searchParams.get('userId');

    if (!userId) return;

    console.log(`User ${userId} connected`);
    this.clients.set(userId, ws);

    ws.on('message', (data: RawData) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        message.userId = userId;
        this.handleMessage(userId, message);
      } catch (error) {
        console.error('Failed to parse message:', error);
        this.sendToClient(userId, {
          type: 'ERROR',
          data: { message: 'Invalid message format' },
          timestamp: Date.now(),
          userId
        });
      }
    });

    ws.on('close', () => {
      console.log(`User ${userId} disconnected`);
      this.handleDisconnection(userId);
    });

    ws.on('error', (error: Error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
    });
  }

  private handleMessage(userId: string, message: WSMessage): void {
    console.log(`📩 Incoming message from ${userId}:`, message);

    const { type, data, matchId } = message;

    switch (type) {
      case 'PLAYER_JOINED':
        this.handlePlayerJoined(userId, matchId!, data);
        break;
      case 'PLAYER_LEFT':
        this.handlePlayerLeft(userId, matchId!, data);
        break;
      case 'CODE_SHARED':
        this.handleCodeShared(userId, matchId!, data);
        break;
      default:
        console.log(`Unknown message type: ${type}`);
    }
  }

  private handlePlayerJoined(userId: string, matchId: string, data: any): void {
    if (!this.matches.has(matchId)) {
      // Initialize the match with an empty map
      this.matches.set(matchId, { players: new Map() });
    }
  
    const match = this.matches.get(matchId)!;
    match.players.set(userId, { username: data.username });
    
    const totalPlayers = match.players.size;
    
    // Only notify about successful connection if there are 2 or more players
    if (totalPlayers >= 2) {
      // Broadcast to all players that match is ready
      this.broadcastToMatch(matchId, {
        type: 'MATCH_READY',
        data: {
          matchId,
          totalPlayers,
          message: 'Match is ready! Both players connected.'
        },
        timestamp: Date.now(),
        userId
      });
      
      // Also send individual player joined notifications to others
      this.broadcastToMatch(matchId, {
        type: 'PLAYER_JOINED',
        data: {
          playerId: userId,
          username: data.username,
          matchId,
          totalPlayers
        },
        timestamp: Date.now(),
        userId
      }, userId); // Exclude the sender
    } else {
      // Send waiting message to the lone player
      this.sendToClient(userId, {
        type: 'WAITING_FOR_PLAYERS',
        data: {
          matchId,
          totalPlayers,
          message: 'Waiting for another player to join...'
        },
        timestamp: Date.now(),
        userId
      });
    }
  }

  private handlePlayerLeft(userId: string, matchId: string, data: any): void {
    const match = this.matches.get(matchId);
    if (!match) return;

    const username = match.players.get(userId)?.username || data.username || 'Unknown';
    match.players.delete(userId);

    if (match.players.size === 0) {
      this.matches.delete(matchId);
      console.log(`Match ${matchId} deleted - no players remaining`);
    } else if (match.players.size === 1) {
      // Only one player left, notify them they're waiting
      const remainingPlayerId = Array.from(match.players.keys())[0];
      this.sendToClient(remainingPlayerId, {
        type: 'WAITING_FOR_PLAYERS',
        data: {
          matchId,
          totalPlayers: 1,
          message: 'Other player left. Waiting for a new player to join...'
        },
        timestamp: Date.now(),
        userId
      });
      
      // Also send player left notification
      this.sendToClient(remainingPlayerId, {
        type: 'PLAYER_LEFT',
        data: {
          playerId: userId,
          username,
          matchId,
          remainingPlayers: match.players.size
        },
        timestamp: Date.now(),
        userId
      });
    } else {
      // Multiple players remaining, broadcast to all
      this.broadcastToMatch(matchId, {
        type: 'PLAYER_LEFT',
        data: {
          playerId: userId,
          username,
          matchId,
          remainingPlayers: match.players.size
        },
        timestamp: Date.now(),
        userId
      });
    }
  }

  public handleCodeShared(userId: string, matchId: string, data: any): void {
    const match = this.matches.get(matchId);
    if (!match) {
      console.error(`Match ${matchId} not found`);
      return;
    }
  
    // Store/update the joining code
    match.joiningCode = data.joiningCode;
    
    console.log(`Storing joining code for match ${matchId}:`, data.joiningCode);
    
    // Only broadcast if there are at least 2 players
    if (match.players.size >= 2) {
      this.broadcastToMatch(matchId, {
        type: 'CODE_SHARED',
        data: {
          playerId: userId,
          username: data.username,
          joiningCode: data.joiningCode,
          matchId,
          sharedBy: data.username
        },
        timestamp: Date.now(),
        userId
      });
      
      console.log(`📤 Code shared with ${match.players.size} players in match ${matchId}`);
    } else {
      // Send a message to the lone player that code sharing requires another player
      this.sendToClient(userId, {
        type: 'ERROR',
        data: { 
          message: 'Cannot share code - waiting for another player to join the match.',
          code: 'INSUFFICIENT_PLAYERS'
        },
        timestamp: Date.now(),
        userId
      });
      
      console.log(`⚠️ Code sharing attempted but only ${match.players.size} player(s) in match ${matchId}`);
    }
  }

  private handleDisconnection(userId: string): void {
    for (const [matchId, match] of this.matches.entries()) {
      if (match.players.has(userId)) {
        const username = match.players.get(userId)?.username || 'Unknown';
        match.players.delete(userId);
        
        console.log(`🚪 Player ${userId} disconnected from match ${matchId}`);

        if (match.players.size === 0) {
          this.matches.delete(matchId);
          console.log(`Match ${matchId} deleted - no players remaining`);
        } else if (match.players.size === 1) {
          // Notify the remaining player they're now waiting
          const remainingPlayerId = Array.from(match.players.keys())[0];
          this.sendToClient(remainingPlayerId, {
            type: 'WAITING_FOR_PLAYERS',
            data: {
              matchId,
              totalPlayers: 1,
              message: 'Other player disconnected. Waiting for a new player to join...'
            },
            timestamp: Date.now(),
            userId
          });
          
          // Also send disconnect notification
          this.sendToClient(remainingPlayerId, {
            type: 'PLAYER_LEFT',
            data: {
              playerId: userId,
              username,
              matchId,
              remainingPlayers: match.players.size
            },
            timestamp: Date.now(),
            userId
          });
        } else {
          // Multiple players remaining
          this.broadcastToMatch(matchId, {
            type: 'PLAYER_LEFT',
            data: {
              playerId: userId,
              username,
              matchId,
              remainingPlayers: match.players.size
            },
            timestamp: Date.now(),
            userId
          });
        }
      }
    }

    this.clients.delete(userId);
  }

  public notifyMatchCompleted(matchId: string, winnerData: WinnerData): void {
    const match = this.matches.get(matchId);
    if (!match || match.players.size < 2) {
      console.log(`Cannot complete match ${matchId} - insufficient players`);
      return;
    }

    this.broadcastToMatch(matchId, {
      type: 'MATCH_COMPLETED',
      data: {
        winnerId: winnerData.userId,
        winnerUsername: winnerData.username,
        completedAt: Date.now(),
        matchId,
        executionTime: winnerData.executionTime,
        passedTests: winnerData.passedTests,
        totalTests: winnerData.totalTests
      },
      timestamp: Date.now(),
      userId: winnerData.userId
    });
  }

  private broadcastToMatch(matchId: string, message: WSMessage, excludeUserId: string | null = null): void {
    const match = this.matches.get(matchId);
    if (!match) return;

    for (const playerId of match.players.keys()) {
      if (playerId !== excludeUserId) {
        this.sendToClient(playerId, message);
        console.log(`📤 Sending to ${playerId}:`, message);
      }
    }
  }

  private sendToClient(userId: string, message: WSMessage): void {
    const ws = this.clients.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // Helper method to get match info
  public getMatchInfo(matchId: string) {
    return this.matches.get(matchId);
  }
}

const wsServer = new WebSocketServer(8080);
export default wsServer;