import { createBrowserRouter } from "react-router";
import Dashboard from "./pages/Dashboard";
import DailyLog from "./pages/DailyLog";
import Summary from "./pages/Summary";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Dashboard,
  },
  {
    path: "/day/:date",
    Component: DailyLog,
  },
  {
    path: "/summary",
    Component: Summary,
  },
]);
