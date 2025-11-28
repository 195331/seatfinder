import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { 
  Home, Heart, Store, Shield, User, LogOut, Menu, X, ChevronRight
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export default function Layout({ children, currentPageName }) {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          const user = await base44.auth.me();
          setCurrentUser(user);
        }
      } catch (e) {
        // Guest mode
      }
      setIsLoading(false);
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    await base44.auth.logout(createPageUrl('Home'));
  };

  const handleLogin = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  // Pages that have their own header/navigation
  const standalonePages = [
    'Home', 'RestaurantDetail', 'Favorites', 'OwnerDashboard', 
    'OwnerAnalytics', 'CreateRestaurant', 'RestaurantSettings', 'AdminDashboard'
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
                <Link to={createPageUrl('Favorites')}>
                  <button className={cn(
                    "flex flex-col items-center gap-1 px-4 py-2",
                    currentPageName === 'Favorites' ? "text-emerald-600" : "text-slate-500"
                  )}>
                    <Heart className="w-5 h-5" />
                    <span className="text-xs">Favorites</span>
                  </button>
                </Link>
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

              {!currentUser ? (
                <button 
                  onClick={handleLogin}
                  className="flex flex-col items-center gap-1 px-4 py-2 text-slate-500"
                >
                  <User className="w-5 h-5" />
                  <span className="text-xs">Sign In</span>
                </button>
              ) : (
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <button className="flex flex-col items-center gap-1 px-4 py-2 text-slate-500">
                      <User className="w-5 h-5" />
                      <span className="text-xs">Account</span>
                    </button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="rounded-t-3xl">
                    <div className="py-4 space-y-4">
                      <div className="flex items-center gap-4 pb-4 border-b">
                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                          <span className="text-lg font-semibold text-emerald-700">
                            {currentUser.full_name?.[0] || currentUser.email?.[0]?.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold">{currentUser.full_name || 'User'}</p>
                          <p className="text-sm text-slate-500">{currentUser.email}</p>
                        </div>
                      </div>
                      
                      {currentUser.user_type !== 'owner' && currentUser.role !== 'admin' && (
                        <Link 
                          to={createPageUrl('CreateRestaurant')}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <button className="w-full flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl">
                            <div className="flex items-center gap-3">
                              <Store className="w-5 h-5 text-slate-600" />
                              <span>List Your Restaurant</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-400" />
                          </button>
                        </Link>
                      )}
                      
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 p-3 text-red-600 hover:bg-red-50 rounded-xl"
                      >
                        <LogOut className="w-5 h-5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </SheetContent>
                </Sheet>
              )}
            </div>
          </nav>
        )}
      </div>
    );
  }

  // Default layout for other pages
  return (
    <div className="min-h-screen bg-slate-50">
      {children}
    </div>
  );
}