import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { 
  Home, Heart, Store, Shield, User, Bell, Settings as SettingsIcon
} from 'lucide-react';
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import FeedbackAutomation from '@/components/feedback/FeedbackAutomation';
import PointsTracker from '@/components/gamification/PointsTracker';

export default function Layout({ children, currentPageName }) {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          const user = await base44.auth.me();
          setCurrentUser(user);
          // Redirect new users to complete profile
          if (!user.profile_complete && currentPageName !== 'Profile') {
            navigate(createPageUrl('Profile'));
          }
        }
      } catch (e) {
        // Guest mode
      }
      setIsLoading(false);
    };
    fetchUser();
  }, [currentPageName]);

  // Fetch unread notifications count
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', currentUser?.id],
    queryFn: () => base44.entities.Notification.filter({ user_id: currentUser.id, is_read: false }),
    enabled: !!currentUser,
  });

  const unreadCount = notifications.length;

  const handleLogout = async () => {
    await base44.auth.logout(createPageUrl('Home'));
  };

  const handleLogin = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  // Pages that have their own header/navigation
  const standalonePages = [
    'Home', 'RestaurantDetail', 'Favorites', 'OwnerDashboard', 
    'OwnerAnalytics', 'CreateRestaurant', 'RestaurantSettings', 'AdminDashboard',
    'Inbox', 'Profile', 'MyReservations', 'MyLoyalty'
  ];

  if (standalonePages.includes(currentPageName)) {
    return (
      <div className="min-h-screen bg-slate-50">
        {children}
        
        {/* Bottom Navigation for Mobile */}
        {['Home', 'RestaurantDetail', 'Favorites'].includes(currentPageName) && (
          <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 md:hidden z-50">
            <div className="flex items-center justify-around py-2">
              <Link to={createPageUrl('Home')}>
                <button className={cn(
                  "flex flex-col items-center gap-1 px-4 py-2",
                  currentPageName === 'Home' ? "text-emerald-600" : "text-slate-500"
                )}>
                  <Home className="w-5 h-5" />
                  <span className="text-xs">Home</span>
                </button>
              </Link>
              
              {currentUser && (
                  <>
                    <Link to={createPageUrl('Favorites')}>
                      <button className={cn(
                        "flex flex-col items-center gap-1 px-4 py-2",
                        currentPageName === 'Favorites' ? "text-emerald-600" : "text-slate-500"
                      )}>
                        <Heart className="w-5 h-5" />
                        <span className="text-xs">Favorites</span>
                      </button>
                    </Link>
                    <Link to={createPageUrl('Inbox')}>
                      <button className={cn(
                        "flex flex-col items-center gap-1 px-4 py-2 relative",
                        currentPageName === 'Inbox' ? "text-emerald-600" : "text-slate-500"
                      )}>
                        <Bell className="w-5 h-5" />
                        {unreadCount > 0 && (
                          <span className="absolute top-1 right-2 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                            {unreadCount}
                          </span>
                        )}
                        <span className="text-xs">Inbox</span>
                      </button>
                    </Link>
                  </>
                )}
              
              {(currentUser?.user_type === 'owner' || currentUser?.role === 'admin') && (
                <Link to={createPageUrl('OwnerDashboard')}>
                  <button className="flex flex-col items-center gap-1 px-4 py-2 text-slate-500">
                    <Store className="w-5 h-5" />
                    <span className="text-xs">My Place</span>
                  </button>
                </Link>
              )}
              
              {currentUser?.role === 'admin' && (
                <Link to={createPageUrl('AdminDashboard')}>
                  <button className="flex flex-col items-center gap-1 px-4 py-2 text-slate-500">
                    <Shield className="w-5 h-5" />
                    <span className="text-xs">Admin</span>
                  </button>
                </Link>
              )}


            </div>
          </nav>
        )}
      </div>
    );
  }

  // Default layout for other pages
  return (
    <PointsTracker currentUser={currentUser}>
      <div className="min-h-screen bg-slate-50">
        <FeedbackAutomation />
        {children}
      </div>
    </PointsTracker>
  );
}