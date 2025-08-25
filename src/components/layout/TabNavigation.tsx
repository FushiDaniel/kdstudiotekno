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
  Bell,
  Calendar,
  Menu,
  X
} from 'lucide-react';
import Dashboard from '@/components/dashboard/Dashboard';
import TaskView from '@/components/tasks/TaskView';
import AdminTaskView from '@/components/admin/AdminTaskView';
import AdminPaymentView from '@/components/admin/AdminPaymentView';
import ClockInView from '@/components/clockin/ClockInView';
import PaymentView from '@/components/payment/PaymentView';
import ProfileView from '@/components/profile/ProfileView';
import NotificationView from '@/components/notifications/NotificationView';
import DirectoryView from '@/components/directory/DirectoryView';
import PendingApprovalView from '@/components/auth/PendingApprovalView';
import Image from 'next/image';
import dynamic from 'next/dynamic';

const CalendarView = dynamic(() => import('@/components/calendar/CalendarView'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div></div>
});

interface Tab {
  id: string;
  label: string;
  icon: any;
  badge?: boolean;
}

export default function TabNavigation() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isProfileIncomplete] = useState(false); // This should check profile completeness

  // Define all tabs
  const allTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Inbox },
    { id: 'tasks', label: 'Tugasan', icon: ListChecks },
    { id: 'calendar', label: 'Kalendar', icon: Calendar },
    { id: 'clockin', label: 'Clock In', icon: Clock },
    { id: 'payment', label: 'Bayaran', icon: CreditCard },
    { id: 'directory', label: 'Direktori', icon: Users },
    { id: 'profile', label: 'Profil', icon: User, badge: isProfileIncomplete },
  ];

  // Filter tabs based on user type
  const tabs = allTabs.filter(tab => {
    if (tab.id === 'clockin') {
      // Only show clock in for PT (Part Time) and FT (Full Time) employees
      return user?.staffId?.startsWith('PT') || user?.staffId?.startsWith('FT');
    }
    return true;
  });

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'tasks':
        return (user?.isAdmin || user?.staffId?.startsWith('PT')) ? <AdminTaskView /> : <TaskView />;
      case 'calendar':
        return <CalendarView />;
      case 'clockin':
        return <ClockInView />;
      case 'payment':
        return user?.isAdmin ? <AdminPaymentView /> : <PaymentView />;
      case 'directory':
        return <DirectoryView />;
      case 'profile':
        return <ProfileView />;
      default:
        return <Dashboard />;
    }
  };

  // Check if user needs approval (not admin and not approved)
  if (user && !user.isAdmin && !user.isApproved) {
    return <PendingApprovalView />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header with Notification */}
      <div className="bg-white shadow-sm border-b fixed top-0 left-0 right-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              {/* Mobile Hamburger Menu */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden transition-all duration-200 ease-in-out hover:scale-110 hover:bg-gray-100"
                onClick={() => setShowMobileMenu(!showMobileMenu)}
              >
                <div className="relative">
                  {showMobileMenu ? (
                    <X className="h-5 w-5 transition-transform duration-200 ease-in-out rotate-90" />
                  ) : (
                    <Menu className="h-5 w-5 transition-transform duration-200 ease-in-out" />
                  )}
                </div>
              </Button>
              
              <div className="w-8 h-8 relative">
                <Image
                  src="/kdlogo.jpeg"
                  alt="KDStudio Logo"
                  width={32}
                  height={32}
                  className="rounded-lg object-cover"
                  priority
                />
              </div>
              <h1 className="text-xl font-semibold">KDstudio</h1>
            </div>
            
            {activeTab === 'dashboard' && (
              <div className="flex items-center space-x-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="relative transition-all duration-200 ease-in-out hover:scale-110 hover:bg-gray-100"
                  onClick={() => setShowNotifications(!showNotifications)}
                >
                  <Bell className={`h-5 w-5 transition-transform duration-200 ease-in-out ${
                    showNotifications ? 'rotate-12' : ''
                  }`} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content with Fade Animation */}
      <div className="flex-1 pt-16 md:pl-64 relative">
        <div className="animate-in fade-in duration-300 ease-in-out">
          {renderContent()}
        </div>
        
        {/* Notification Overlay with Slide Animation */}
        {showNotifications && (
          <div className="absolute top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300 ease-out">
            <NotificationView onClose={() => setShowNotifications(false)} />
          </div>
        )}
      </div>

      {/* Mobile Slide-out Menu with Enhanced Animations */}
      <div className={`md:hidden fixed inset-0 z-50 transition-opacity duration-300 ease-in-out ${
        showMobileMenu ? 'opacity-100 visible' : 'opacity-0 invisible'
      }`}>
        {/* Backdrop with Fade Animation */}
        <div 
          className={`fixed inset-0 bg-black transition-opacity duration-300 ease-in-out ${
            showMobileMenu ? 'bg-opacity-50' : 'bg-opacity-0'
          }`}
          onClick={() => setShowMobileMenu(false)}
        ></div>
        
        {/* Menu Panel with Slide Animation */}
        <div className={`fixed left-0 top-0 h-full w-64 bg-white shadow-xl transform transition-all duration-300 ease-in-out ${
          showMobileMenu ? 'translate-x-0' : '-translate-x-full'
        }`}>
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 relative">
                    <Image
                      src="/kdlogo.jpeg"
                      alt="KDStudio Logo"
                      width={32}
                      height={32}
                      className="rounded-lg object-cover"
                      priority
                    />
                  </div>
                  <h2 className="text-lg font-semibold">KDstudio</h2>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setShowMobileMenu(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            
            <div className="p-4 space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setShowMobileMenu(false);
                    }}
                    className={`w-full px-4 py-3 flex items-center space-x-3 text-left rounded-lg transition-all duration-200 ease-in-out transform hover:scale-105 relative ${
                      isActive 
                        ? 'bg-black text-white shadow-lg' 
                        : 'text-gray-900 hover:bg-gray-100 hover:shadow-md'
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
                className={`w-full px-4 py-3 flex items-center space-x-3 text-left rounded-lg transition-all duration-200 ease-in-out transform hover:translate-x-1 hover:shadow-md relative ${
                  isActive 
                    ? 'bg-black text-white shadow-lg scale-105' 
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
      `}</style>
    </div>
  );
}