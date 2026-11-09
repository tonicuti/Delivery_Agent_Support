import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppShell from "@/components/AppShell.jsx";
import Assistant from "@/views/Assistant.jsx";
import Insights from "@/views/Insights.jsx";
import OrderCase from "@/views/OrderCase.jsx";
import Orders from "@/views/Orders.jsx";
import Worklist from "@/views/Worklist.jsx";

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.getElementById("main")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/worklist" replace />} />
        <Route path="/worklist" element={<Worklist />} />
        <Route path="/worklist/shifts" element={<Worklist tab="shifts" />} />
        <Route path="/worklist/shifts/:shiftId" element={<Worklist tab="shifts" />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/orders/:orderId" element={<OrderCase />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="*" element={<Navigate to="/worklist" replace />} />
      </Route>
    </Routes>
  );
}
