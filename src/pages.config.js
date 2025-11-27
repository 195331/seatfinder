import Home from './pages/Home';
import RestaurantDetail from './pages/RestaurantDetail';
import Favorites from './pages/Favorites';
import OwnerDashboard from './pages/OwnerDashboard';
import OwnerAnalytics from './pages/OwnerAnalytics';
import CreateRestaurant from './pages/CreateRestaurant';
import RestaurantSettings from './pages/RestaurantSettings';


export const PAGES = {
    "Home": Home,
    "RestaurantDetail": RestaurantDetail,
    "Favorites": Favorites,
    "OwnerDashboard": OwnerDashboard,
    "OwnerAnalytics": OwnerAnalytics,
    "CreateRestaurant": CreateRestaurant,
    "RestaurantSettings": RestaurantSettings,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
};