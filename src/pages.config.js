/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AdminDashboard from './pages/AdminDashboard';
import CheckIn from './pages/CheckIn';
import ConfirmWaitlist from './pages/ConfirmWaitlist';
import CreateRestaurant from './pages/CreateRestaurant';
import Favorites from './pages/Favorites';
import ForgotPassword from './pages/ForgotPassword';
import Home from './pages/Home';
import Inbox from './pages/Inbox';
import KitchenView from './pages/KitchenView';
import Landing from './pages/Landing';
import MealPlanner from './pages/MealPlanner';
import MyLoyalty from './pages/MyLoyalty';
import MyReservations from './pages/MyReservations';
import OwnerAnalytics from './pages/OwnerAnalytics';
import OwnerDashboard from './pages/OwnerDashboard';
import Profile from './pages/Profile';
import RestaurantDetail from './pages/RestaurantDetail';
import RestaurantSettings from './pages/RestaurantSettings';
import ReviewSubmission from './pages/ReviewSubmission';
import Settings from './pages/Settings';
import UserProfile from './pages/UserProfile';
import RedeemReward from './pages/RedeemReward';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminDashboard": AdminDashboard,
    "CheckIn": CheckIn,
    "ConfirmWaitlist": ConfirmWaitlist,
    "CreateRestaurant": CreateRestaurant,
    "Favorites": Favorites,
    "ForgotPassword": ForgotPassword,
    "Home": Home,
    "Inbox": Inbox,
    "KitchenView": KitchenView,
    "Landing": Landing,
    "MealPlanner": MealPlanner,
    "MyLoyalty": MyLoyalty,
    "MyReservations": MyReservations,
    "OwnerAnalytics": OwnerAnalytics,
    "OwnerDashboard": OwnerDashboard,
    "Profile": Profile,
    "RestaurantDetail": RestaurantDetail,
    "RestaurantSettings": RestaurantSettings,
    "ReviewSubmission": ReviewSubmission,
    "Settings": Settings,
    "UserProfile": UserProfile,
    "RedeemReward": RedeemReward,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};