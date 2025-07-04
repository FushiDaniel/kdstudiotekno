'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/components/notifications/NotificationManager';
import { Button } from '@/components/ui/button';
import { 
  Inbox, 
  ListChecks, 
  Clock, 
  CreditCard, 
  User, 
  Users,
  Bell 
} from 'lucide-react';
import Dashboard from '@/components/dashboard/Dashboard';
import TaskView from '@/components/tasks/TaskView';
import AdminTaskView from '@/components/admin/AdminTaskView';
import ClockInView from '@/components/clockin/ClockInView';
import PaymentView from '@/components/payment/PaymentView';
import ProfileView from '@/components/profile/ProfileView';
import NotificationView from '@/components/notifications/NotificationView';
import DirectoryView from '@/components/directory/DirectoryView';
import Image from 'next/image';

export default function TabNavigation() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showNotifications, setShowNotifications] = useState(false);
  const [isProfileIncomplete] = useState(false); // This should check profile completeness

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Inbox },
    { id: 'tasks', label: 'Tugasan', icon: ListChecks },
    { id: 'clockin', label: 'Clock In', icon: Clock },
    { id: 'payment', label: 'Payment', icon: CreditCard },
    { id: 'directory', label: 'Directory', icon: Users },
    { id: 'profile', label: 'Profile', icon: User, badge: isProfileIncomplete },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'tasks':
        return user?.isAdmin ? <AdminTaskView /> : <TaskView />;
      case 'clockin':
        return <ClockInView />;
      case 'payment':
        return <PaymentView />;
      case 'directory':
        return <DirectoryView />;
      case 'profile':
        return <ProfileView />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header with Notification */}
      <div className="bg-white shadow-sm border-b fixed top-0 left-0 right-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 relative">
                <Image
                  src="/kdstudiologo.jpeg"
                  alt="KDStudio Logo"
                  width={32}
                  height={32}
                  className="rounded-lg object-cover"
                  priority
                />
              </div>
              <h1 className="text-xl font-semibold">KDStudio</h1>
            </div>
            
            {activeTab === 'dashboard' && (
              <div className="flex items-center space-x-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="relative"
                  onClick={() => setShowNotifications(!showNotifications)}
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 pt-16 pb-16 md:pb-0 md:pl-64 relative">
        {renderContent()}
        
        {/* Notification Overlay */}
        {showNotifications && (
          <div className="absolute top-4 right-4 z-50">
            <NotificationView onClose={() => setShowNotifications(false)} />
          </div>
        )}
      </div>

      {/* Bottom Tab Navigation - Mobile */}
      <div className="md:hidden bg-white border-t border-gray-200 fixed bottom-0 left-0 right-0 z-40">
        <div className="grid grid-cols-6 w-full">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center py-2 relative ${
                  isActive ? 'text-black' : 'text-gray-500'
                }`}
              >
                <Icon className="h-5 w-5 mb-1" />
                <span className="text-[10px] font-medium text-gray-900 truncate w-full text-center px-1">{tab.label}</span>
                {tab.badge && (
                  <span className="absolute top-1 right-1/4 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Side Tab Navigation - Desktop */}
      <div className="hidden md:block fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-4 space-y-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full px-4 py-3 flex items-center space-x-3 text-left rounded-lg transition-colors relative ${
                  isActive 
                    ? 'bg-black text-white' 
                    : 'text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{tab.label}</span>
                {tab.badge && (
                  <span className="ml-auto w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop Content Area */}
      <style jsx>{`
        @media (min-width: 768px) {
          .flex-1 {
            margin-left: 16rem;
          }
        }
        @media (max-width: 767px) {
          .flex-1 {
            margin-bottom: 60px;
          }
        }
      `}</style>
    </div>
  );
}