import Home from './pages/Home';
import RestaurantDetail from './pages/RestaurantDetail';
import Favorites from './pages/Favorites';
import OwnerDashboard from './pages/OwnerDashboard';
import OwnerAnalytics from './pages/OwnerAnalytics';
import CreateRestaurant from './pages/CreateRestaurant';
import RestaurantSettings from './pages/RestaurantSettings';
import AdminDashboard from './pages/AdminDashboard';
import Inbox from './pages/Inbox';
import Profile from './pages/Profile';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "RestaurantDetail": RestaurantDetail,
    "Favorites": Favorites,
    "OwnerDashboard": OwnerDashboard,
    "OwnerAnalytics": OwnerAnalytics,
    "CreateRestaurant": CreateRestaurant,
    "RestaurantSettings": RestaurantSettings,
    "AdminDashboard": AdminDashboard,
    "Inbox": Inbox,
    "Profile": Profile,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};