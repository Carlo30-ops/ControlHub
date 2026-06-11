import { createHashRouter } from "react-router";
import { MainLayout } from "./components/layouts/MainLayout";
import { Dashboard } from "./pages/Dashboard";
import { Scanner } from "./pages/Scanner";
import { Reports } from "./pages/Reports";
import { History } from "./pages/History";
import { Settings } from "./pages/Settings";
import { NotFound } from "./pages/NotFound";
import PDFTools from "./pages/PDFTools";
import Terapias from "./pages/Terapias";

export const router = createHashRouter([
  {
    path: "/",
    Component: MainLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: "dashboard", Component: Dashboard },
      { path: "scanner", Component: Scanner },
      { path: "reports", Component: Reports },
      { path: "history", Component: History },
      { path: "pdf-tools", Component: PDFTools },
      { path: "terapias", Component: Terapias },
      { path: "settings", Component: Settings },
      { path: "*", Component: NotFound },
    ],
  },
]);
