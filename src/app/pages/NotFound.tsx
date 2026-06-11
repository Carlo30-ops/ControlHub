import { AlertCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { useNavigate } from "react-router";

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-6">
      <div className="w-24 h-24 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
        <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
      </div>
      <div className="text-center">
        <h1 className="text-6xl font-bold text-slate-900 dark:text-white mb-2">404</h1>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
          Página no encontrada
        </h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-md">
          La página que estás buscando no existe o ha sido movida.
        </p>
      </div>
      <Button onClick={() => navigate("/")} size="lg">
        Volver al Dashboard
      </Button>
    </div>
  );
}
