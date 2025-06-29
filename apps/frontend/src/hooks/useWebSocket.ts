import { useState, useEffect, useRef, useCallback } from 'react';
import { WebSocketMessage } from '../types/websocket';

export const useWebSocket = (url: string, userId?: string) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const maxReconnectAttempts = 5;
  const isConnectingRef = useRef(false);

  const connect = useCallback(() => {
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current || socket?.readyState === WebSocket.OPEN) {
      return;
    }

    if (!userId) {
      console.warn('Cannot connect WebSocket without userId');
      return;
    }

    try {
      isConnectingRef.current = true;
      setConnectionStatus('connecting');
      
      const wsUrl = `${url}?userId=${userId}`;
      console.log(`Attempting to connect to WebSocket: ${wsUrl}`);
      
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        setIsConnected(true);
        setConnectionStatus('connected');
        setConnectionAttempts(0);
        setSocket(ws);
        isConnectingRef.current = false;
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('📨 WebSocket message received:', message);
          setLastMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log(`🔌 WebSocket disconnected: Code ${event.code}, Reason: ${event.reason}`);
        setIsConnected(false);
        setSocket(null);
        isConnectingRef.current = false;

        // Handle different close codes
        if (event.code === 1000) {
          // Normal closure
          setConnectionStatus('disconnected');
        } else {
          setConnectionStatus('error');
          
          // Attempt to reconnect if not a clean close and under max attempts
          if (connectionAttempts < maxReconnectAttempts) {
            const delay = Math.min(Math.pow(2, connectionAttempts) * 1000, 30000); // Cap at 30 seconds
            console.log(`🔄 Attempting to reconnect in ${delay}ms (attempt ${connectionAttempts + 1}/${maxReconnectAttempts})`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              setConnectionAttempts(prev => prev + 1);
              connect();
            }, delay);
          } else {
            console.error('❌ Max reconnection attempts reached');
          }
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setConnectionStatus('error');
        isConnectingRef.current = false;
      };

      // Store the socket reference immediately for cleanup
      setSocket(ws);

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
      isConnectingRef.current = false;
    }
  }, [url, userId, connectionAttempts]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
      console.log('📤 Sent WebSocket message:', message);
    } else {
      console.warn('⚠️ WebSocket is not connected. Message not sent:', message);
      console.warn(`Socket state: ${socket?.readyState}, Connected: ${isConnected}`);
    }
  }, [socket, isConnected]);

  const disconnect = useCallback(() => {
    console.log('🔄 Disconnecting WebSocket...');
    
    // Clear any pending reconnection attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    
    // Close the socket cleanly
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close(1000, 'Component unmounting');
    }
    
    // Reset state
    setSocket(null);
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setConnectionAttempts(0);
    isConnectingRef.current = false;
  }, [socket]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    console.log('🔄 Manual reconnect triggered');
    disconnect();
    setTimeout(() => {
      setConnectionAttempts(0);
      connect();
    }, 1000);
  }, [disconnect, connect]);

  // Connect when userId becomes available
  useEffect(() => {
    if (userId && !isConnected && connectionStatus !== 'connecting') {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [userId]); // Only depend on userId changes

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    socket,
    isConnected,
    lastMessage,
    sendMessage,
    connect,
    disconnect,
    reconnect,
    connectionAttempts,
    connectionStatus,
    maxReconnectAttempts
  };
};