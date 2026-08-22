import React, { useState } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import NotificationDropdown from './NotificationDropdown';
import { Bell } from 'lucide-react';
import type { PreJoinAppointmentInfo } from './PreJoinCallModal';

interface NotificationBellProps {
  onOpenPreJoin?: (apt: PreJoinAppointmentInfo) => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ onOpenPreJoin }) => {
  const { unreadCount } = useWebSocket();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-all focus:outline-none border border-transparent hover:border-blue-100 shadow-sm hover:shadow cursor-pointer"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white animate-bounce shadow">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <NotificationDropdown 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        onOpenPreJoin={onOpenPreJoin}
      />
    </div>
  );
};

export default NotificationBell;
