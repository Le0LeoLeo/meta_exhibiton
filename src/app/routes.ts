import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import Home from "./pages/Home";
import VirtualGallery from "./pages/VirtualGallery";
import Exhibitions from "./pages/Exhibitions";
import Solutions from "./pages/Solutions";
import Resources from "./pages/Resources";
import Support from "./pages/Support";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import VirtualGalleryCreate from "./pages/VirtualGalleryCreate";
import MyExhibitions from "./pages/MyExhibitions";
import { RequireAuth } from "./auth";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Home },

      // 公開頁
      { path: "solutions", Component: Solutions },
      { path: "resources", Component: Resources },
      { path: "support", Component: Support },
      { path: "login", Component: Login },
      { path: "register", Component: Register },

      // 需要登入的頁
      {
        Component: RequireAuth,
        children: [
          { path: "virtual-gallery", Component: VirtualGallery },
          { path: "virtual-gallery/my-exhibitions", Component: MyExhibitions },
          { path: "virtual-gallery/create", Component: VirtualGalleryCreate },
          { path: "exhibitions", Component: Exhibitions },
          { path: "profile", Component: Profile },
        ],
      },
    ],
  },
]);
