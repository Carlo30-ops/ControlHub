import { RouterProvider } from "react-router";
import { router } from "./routes";
import { ThemeProvider } from "./contexts/ThemeContext";
import { DataProvider } from "./contexts/DataContext";
import { Toaster } from "./components/ui/sonner";

export default function App() {
  return (
    <DataProvider>
      <ThemeProvider>
        <RouterProvider router={router} />
        <Toaster position="top-right" richColors />
      </ThemeProvider>
    </DataProvider>
  );
}
