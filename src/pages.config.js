import AdminDashboard from './pages/AdminDashboard';
import ConfirmWaitlist from './pages/ConfirmWaitlist';
import CreateRestaurant from './pages/CreateRestaurant';
import Favorites from './pages/Favorites';
import Home from './pages/Home';
import Inbox from './pages/Inbox';
import Landing from './pages/Landing';
import MyLoyalty from './pages/MyLoyalty';
import MyReservations from './pages/MyReservations';
import OwnerAnalytics from './pages/OwnerAnalytics';
import OwnerDashboard from './pages/OwnerDashboard';
import Profile from './pages/Profile';
import RestaurantDetail from './pages/RestaurantDetail';
import RestaurantSettings from './pages/RestaurantSettings';
import Settings from './pages/Settings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminDashboard": AdminDashboard,
    "ConfirmWaitlist": ConfirmWaitlist,
    "CreateRestaurant": CreateRestaurant,
    "Favorites": Favorites,
    "Home": Home,
    "Inbox": Inbox,
    "Landing": Landing,
    "MyLoyalty": MyLoyalty,
    "MyReservations": MyReservations,
    "OwnerAnalytics": OwnerAnalytics,
    "OwnerDashboard": OwnerDashboard,
    "Profile": Profile,
    "RestaurantDetail": RestaurantDetail,
    "RestaurantSettings": RestaurantSettings,
    "Settings": Settings,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};