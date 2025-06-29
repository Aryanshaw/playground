import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, UserMinus, Trophy, AlertCircle, X, Copy, Share2 } from 'lucide-react';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { useUser } from '../contexts/UserContext';

interface Notification {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  icon: React.ReactNode;
  duration?: number;
  actionButton?: {
    label: string;
    onClick: () => void;
  };
}

export const WebSocketNotifications: React.FC = () => {
  const { lastMessage } = useWebSocketContext();
  const { user } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (notification: Omit<Notification, 'id'>) => {
    const id = Date.now().toString();
    const newNotification = { ...notification, id };
        
    setNotifications(prev => [...prev, newNotification]);

    // Auto remove after duration (default 5 seconds)
    setTimeout(() => {
      removeNotification(id);
    }, notification.duration || 10000);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addNotification({
        type: 'success',
        title: 'Copied!',
        message: 'Joining code copied to clipboard',
        icon: <Copy className="w-5 h-5" />,
        duration: 10000
      });
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  useEffect(() => {
    if (!lastMessage) return;

    const { type, data, userId: messageUserId } = lastMessage;
    
    // Don't show notifications for messages sent by current user
    if (messageUserId === user?.id) return;

    switch (type) {
      case 'PLAYER_JOINED':
        addNotification({
          type: 'success',
          title: 'Player Joined',
          message: `${data.username} joined the match`,
          icon: <Users className="w-5 h-5" />
        });
        break;

      case 'PLAYER_LEFT':
        addNotification({
          type: 'warning',
          title: 'Player Left',
          message: `${data.username} left the match`,
          icon: <UserMinus className="w-5 h-5" />
        });
        break;

      case 'CODE_SHARED':
        // Show joining code notification
        addNotification({
          type: 'info',
          title: 'Match Created!',
          message: `Use code: ${data.joiningCode} to join`,
          icon: <Share2 className="w-5 h-5" />,
          duration: 10000, // Keep longer for joining code
          actionButton: {
            label: 'Copy Code',
            onClick: () => copyToClipboard(data.joiningCode)
          }
        });
        break;

      case 'MATCH_COMPLETED':
        addNotification({
          type: 'success',
          title: 'Match Completed!',
          message: `🎉 ${data.winnerUsername} won the match!`,
          icon: <Trophy className="w-5 h-5" />,
          duration: 8000
        });
        break;

      case 'ERROR':
        addNotification({
          type: 'error',
          title: 'Error',
          message: data.message || 'Something went wrong',
          icon: <AlertCircle className="w-5 h-5" />
        });
        break;

      default:
        console.log('Unknown message type:', type);
    }
  }, [lastMessage, user?.id]);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      <AnimatePresence>
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 300, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 300, scale: 0.8 }}
            className={`
              relative max-w-sm p-4 rounded-lg shadow-lg border-l-4 
              ${notification.type === 'success' ? 'bg-green-50 border-green-500 text-green-800' : ''}
              ${notification.type === 'info' ? 'bg-blue-50 border-blue-500 text-blue-800' : ''}
              ${notification.type === 'warning' ? 'bg-yellow-50 border-yellow-500 text-yellow-800' : ''}
              ${notification.type === 'error' ? 'bg-red-50 border-red-500 text-red-800' : ''}
            `}
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                {notification.icon}
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm">
                  {notification.title}
                </h4>
                <p className="text-sm mt-1 break-words">
                  {notification.message}
                </p>
                
                {notification.actionButton && (
                  <button
                    onClick={notification.actionButton.onClick}
                    className={`
                      mt-2 px-3 py-1 text-xs font-medium rounded
                      ${notification.type === 'info' ? 'bg-blue-100 hover:bg-blue-200 text-blue-800' : ''}
                      ${notification.type === 'success' ? 'bg-green-100 hover:bg-green-200 text-green-800' : ''}
                      transition-colors duration-150
                    `}
                  >
                    {notification.actionButton.label}
                  </button>
                )}
              </div>
              
              <button
                onClick={() => removeNotification(notification.id)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};