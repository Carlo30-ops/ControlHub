import React, { Suspense } from "react";
import { createHashRouter } from "react-router";
import { MainLayout } from "./components/layouts/MainLayout";
import { SkeletonDashboard } from "./components/ui/skeleton";
const Dashboard = React.lazy(() => import("./pages/Dashboard").then(m => ({ default: m.Dashboard })));
const Scanner = React.lazy(() => import("./pages/Scanner").then(m => ({ default: m.Scanner })));
const History = React.lazy(() => import("./pages/History").then(m => ({ default: m.History })));
const Settings = React.lazy(() => import("./pages/Settings").then(m => ({ default: m.Settings })));
const NotFound = React.lazy(() => import("./pages/NotFound").then(m => ({ default: m.NotFound })));
const Terapias = React.lazy(() => import("./pages/Terapias"));
const Reports = React.lazy(() => import("./pages/Reports").then(m => ({ default: m.Reports })));
const PDFTools = React.lazy(() => import("./pages/PDFTools"));

export const router = createHashRouter([
  {
    path: "/",
    Component: MainLayout,
    children: [
      { index: true, element: <Suspense fallback={<SkeletonDashboard />}><Dashboard /></Suspense> },
      { path: "dashboard", element: <Suspense fallback={<SkeletonDashboard />}><Dashboard /></Suspense> },
      { path: "scanner", element: <Suspense fallback={<SkeletonDashboard />}><Scanner /></Suspense> },
      { path: "reports", element: <Suspense fallback={<SkeletonDashboard />}><Reports /></Suspense> },
      { path: "history", element: <Suspense fallback={<SkeletonDashboard />}><History /></Suspense> },
      { path: "pdf-tools", element: <Suspense fallback={<SkeletonDashboard />}><PDFTools /></Suspense> },
      { path: "terapias", element: <Suspense fallback={<SkeletonDashboard />}><Terapias /></Suspense> },
      { path: "settings", element: <Suspense fallback={<SkeletonDashboard />}><Settings /></Suspense> },
      { path: "*", element: <Suspense fallback={<SkeletonDashboard />}><NotFound /></Suspense> },
    ],
  },
]);
