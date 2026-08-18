import { createBrowserRouter } from "react-router";
import Layout from "./components/Layout";
import Profile from "./pages/Profile";
import TCMDiagnosis from "./pages/TCMDiagnosis";
import WizardDiagnosis from "./pages/WizardDiagnosis";
import TCMKnowledge from "./pages/TCMKnowledge";
import TCMConstitution from "./pages/TCMConstitution";
import SkinDetection from "./pages/SkinDetection";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ForgotPassword from "./pages/ForgotPassword";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/register",
    Component: Register,
  },
  {
    path: "/forgot-password",
    Component: ForgotPassword,
  },
  {
    path: "/",
    Component: Layout,
    children: [
      {
        index: true,
        Component: Profile,
      },
      {
        path: "dashboard",
        Component: Dashboard,
      },
      {
        path: "qfhj",
        Component: TCMDiagnosis,
      },
      {
        path: "wizard-diagnosis",
        Component: WizardDiagnosis,
      },
      {
        path: "tcm-knowledge",
        Component: TCMKnowledge,
      },
      {
        path: "tcm-graph",
        Component: TCMConstitution,
      },
      {
        path: "skin-detection",
        Component: SkinDetection,
      },
    ],
  },
]);
