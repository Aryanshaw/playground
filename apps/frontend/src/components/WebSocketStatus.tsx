import React from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff } from 'lucide-react';
import { useWebSocketContext } from '../contexts/WebSocketContext';

export const WebSocketStatus: React.FC = () => {
  const { isConnected } = useWebSocketContext();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`fixed bottom-4 left-4 flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium ${
        isConnected 
          ? 'bg-green-900/80 text-green-100 border border-green-500/50' 
          : 'bg-red-900/80 text-red-100 border border-red-500/50'
      } backdrop-blur-sm`}
    >
      {isConnected ? (
        <>
          <Wifi className="w-4 h-4" />
          <span>Connected</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          <span>Disconnected</span>
        </>
      )}
    </motion.div>
  );
};
