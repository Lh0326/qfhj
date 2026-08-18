import { RouterProvider } from "react-router";
import { router } from "./routes.tsx";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "../context/LanguageContext";
import "../i18n";

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <RouterProvider router={router} />
      </LanguageProvider>
    </AuthProvider>
  );
}