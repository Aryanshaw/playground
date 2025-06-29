import { useState, useEffect, useRef, useCallback } from 'react';
import { WebSocketMessage } from '../types/websocket';

export const useWebSocket = (url: string, userId?: string) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (socket?.readyState === WebSocket.OPEN) return;

    try {
      const wsUrl = userId ? `${url}?userId=${userId}` : url;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        setConnectionAttempts(0);
        setSocket(ws);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('WebSocket message received:', message);
          setLastMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setSocket(null);

        // Attempt to reconnect if not a clean close and under max attempts
        if (event.code !== 1000 && connectionAttempts < maxReconnectAttempts) {
          const delay = Math.pow(2, connectionAttempts) * 1000; // Exponential backoff
          reconnectTimeoutRef.current = setTimeout(() => {
            setConnectionAttempts(prev => prev + 1);
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [url, userId, socket, connectionAttempts]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected. Message not sent:', message);
    }
  }, [socket]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (socket) {
      socket.close(1000, 'Component unmounting');
    }
  }, [socket]);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return {
    socket,
    isConnected,
    lastMessage,
    sendMessage,
    connect,
    disconnect,
    connectionAttempts
  };
};
