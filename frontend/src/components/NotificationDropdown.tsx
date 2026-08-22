import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../context/WebSocketContext';
import { Bell, Check, CheckCheck, CreditCard, FileText, Calendar, Sparkles, Inbox, Video } from 'lucide-react';
import type { PreJoinAppointmentInfo } from './PreJoinCallModal';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPreJoin?: (apt: PreJoinAppointmentInfo) => void;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ isOpen, onClose, onOpenPreJoin }) => {
  const navigate = useNavigate();
  const { notifications, markAsRead, markAllAsRead } = useWebSocket();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleNotificationClick = async (n: any) => {
    // Mark as read
    if (!n.read) {
      await markAsRead(n.id);
    }
    // Redirect / open based on type
    if (n.type === 'CALL_WAITING') {
      if (n.relatedEntityId && onOpenPreJoin) {
        onOpenPreJoin({
          id: n.relatedEntityId,
          callerName: n.title.includes('Doctor') ? 'Doctor' : 'Patient',
          isWaiting: true
        });
      } else {
        const role = localStorage.getItem('role');
        if (role === 'DOCTOR') {
          navigate('/doctor/appointments');
        } else {
          navigate('/patient/appointments');
        }
      }
    } else if (n.type === 'APPOINTMENT_BOOKED' || n.type === 'APPOINTMENT_CONFIRMED') {
      const role = localStorage.getItem('role');
      if (role === 'DOCTOR') {
        navigate('/doctor/appointments');
      } else {
        navigate('/patient/appointments');
      }
    } else if (n.type === 'PAYMENT_SUCCESS') {
      navigate('/patient/payments');
    } else if (n.type === 'PRESCRIPTION_UPLOADED') {
      navigate('/patient/appointments');
    }
    onClose();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'CALL_WAITING':
        return <Video className="w-5 h-5 text-blue-600 animate-pulse" />;
      case 'APPOINTMENT_BOOKED':
      case 'APPOINTMENT_CONFIRMED':
        return <Calendar className="w-5 h-5 text-blue-600" />;
      case 'PAYMENT_SUCCESS':
        return <CreditCard className="w-5 h-5 text-green-600" />;
      case 'PRESCRIPTION_UPLOADED':
        return <FileText className="w-5 h-5 text-purple-600" />;
      default:
        return <Bell className="w-5 h-5 text-slate-500" />;
    }
  };

  const getBgIcon = (type: string) => {
    switch (type) {
      case 'CALL_WAITING':
        return 'bg-blue-100 border-blue-200';
      case 'APPOINTMENT_BOOKED':
      case 'APPOINTMENT_CONFIRMED':
        return 'bg-blue-50 border-blue-100';
      case 'PAYMENT_SUCCESS':
        return 'bg-green-50 border-green-100';
      case 'PRESCRIPTION_UPLOADED':
        return 'bg-purple-50 border-purple-100';
      default:
        return 'bg-slate-50 border-slate-100';
    }
  };

  // Human-readable relative time helper
  const formatRelativeTime = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHrs = Math.floor(diffMins / 60);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHrs < 24) return `${diffHrs}h ago`;
      
      const diffDays = Math.floor(diffHrs / 24);
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
      return '';
    }
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 mt-2 w-96 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-100 py-3 z-50 overflow-hidden transform origin-top-right transition-all duration-200 scale-100 animate-in fade-in slide-in-from-top-2"
    >
      {/* Dropdown Header */}
      <div className="px-4 pb-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-blue-600 animate-pulse" />
          <h3 className="font-bold text-slate-800 text-base">Notifications</h3>
        </div>
        {notifications.some(n => !n.read) && (
          <button
            onClick={markAllAsRead}
            className="flex items-center text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-all"
          >
            <CheckCheck className="w-4 h-4 mr-1" />
            Mark all read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="max-h-[350px] overflow-y-auto divide-y divide-slate-50">
        {notifications.length === 0 ? (
          <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3 border border-slate-100">
              <Inbox className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500 font-medium text-sm">All caught up!</p>
            <p className="text-slate-400 text-xs mt-1">No notifications found.</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={`p-4 flex space-x-3 items-start cursor-pointer transition-all hover:bg-slate-50/80 ${
                !n.read ? 'bg-blue-50/30' : ''
              }`}
            >
              {/* Icon */}
              <div className={`p-2.5 rounded-xl border ${getBgIcon(n.type)} shrink-0 flex items-center justify-center shadow-sm`}>
                {getIcon(n.type)}
              </div>

              {/* Text Context */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <p className={`text-sm font-semibold truncate ${!n.read ? 'text-slate-900 font-bold' : 'text-slate-700'}`}>
                    {n.title}
                  </p>
                  {!n.read && (
                    <span className="w-2.5 h-2.5 bg-blue-600 rounded-full shrink-0 ml-2 mt-1.5 animate-pulse" />
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                  {n.message}
                </p>
                <div className="flex items-center justify-between mt-2.5">
                  <span className="text-[10px] font-medium text-slate-400">
                    {formatRelativeTime(n.createdAt)}
                  </span>
                  {!n.read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(n.id);
                      }}
                      className="text-[10px] font-bold text-slate-400 hover:text-blue-600 flex items-center bg-slate-50 hover:bg-blue-50 px-2 py-0.5 rounded transition-all"
                    >
                      <Check className="w-3 h-3 mr-0.5" />
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationDropdown;
