import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  ChartColumn, ListChecks, Menu, MessageSquare, Moon, Package, Search, ShieldAlert, Sun, TriangleAlert,
} from "lucide-react";
import Automation from "@/components/Automation.jsx";
import { Button } from "@/components/ui/button.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.jsx";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet.jsx";
import { useMeta, useRole, useWords } from "@/context.jsx";
import { cn } from "@/lib/utils.js";

const NAV = [
  { to: "/worklist", label: "Worklist", icon: ListChecks },
  { to: "/orders", label: "Orders", icon: Package },
  { to: "/assistant", label: "Chat", icon: MessageSquare },
  { to: "/insights", label: "Insights", icon: ChartColumn },
];

function Brand() {
  return (
    <div className="flex items-center gap-3 px-2">
      <span className="flex size-10 items-center justify-center rounded-xl bg-brand text-white">
        <ShieldAlert className="size-6" aria-hidden="true" />
      </span>
      <div className="leading-tight">
        <p className="text-base font-bold text-sidebar-foreground">Delivery Risk</p>
        <p className="text-xs text-sidebar-muted">Spot late deliveries early</p>
      </div>
    </div>
  );
}

function NavItems({ onNavigate }) {
  return (
    <nav className="grid gap-1" aria-label="Primary">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} onClick={onNavigate}
                 className={({ isActive }) => cn(
                   "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
                   isActive
                     ? "bg-sidebar-accent text-sidebar-accent-foreground"
                     : "text-sidebar-muted hover:bg-muted hover:text-sidebar-foreground")}>
          <Icon className="size-5" aria-hidden="true" />{label}
        </NavLink>
      ))}
    </nav>
  );
}

function RolePicker() {
  const { role, setRole } = useRole();
  const { roles } = useMeta();
  const words = useWords();
  return (
    <div className="grid gap-1.5 px-2">
      <label htmlFor="role-select" className="text-xs text-sidebar-muted">I am working as</label>
      <Select value={role} onValueChange={setRole}>
        <SelectTrigger id="role-select" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{roles.map((r) => <SelectItem key={r} value={r}>{words.role(r)}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function Sidebar({ onNavigate }) {
  return (
    <div className="flex h-full flex-col gap-6 border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground">
      <Brand />
      <NavItems onNavigate={onNavigate} />
      <div className="mt-auto grid gap-3">
        <RolePicker />
        <p className="px-2 text-[11px] leading-snug text-sidebar-muted">Suggestions only. You make the call.</p>
      </div>
    </div>
  );
}

function ThemeMenu() {
  const { setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon-sm" aria-label="Change appearance">
          <Sun className="dark:hidden" aria-hidden="true" /><Moon className="hidden dark:block" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {[["light", "Light"], ["dark", "Dark"], ["system", "Same as my device"]].map(([id, name]) => <DropdownMenuItem key={id} onClick={() => setTheme(id)}>{name}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function OrderSearch() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  function submit(event) {
    event.preventDefault();
    const text = value.trim();
    if (!text) return;
    const id = text.match(/(\d{3,})$/)?.[1];
    navigate(id ? `/orders/${Number(id)}` : `/orders?q=${encodeURIComponent(text)}`);
    setValue("");
  }
  return (
    <form onSubmit={submit} role="search" className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Find an order, for example 1002" aria-label="Find an order" className="pl-8" />
    </form>
  );
}

export default function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-screen lg:block"><Sidebar /></aside>
      <div className="flex min-w-0 flex-col">
        <div role="note" className="flex items-start gap-2 border-b border-risk-med bg-risk-med-bg px-4 py-1.5 text-xs text-risk-med-fg lg:px-6">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span><strong>Demo version.</strong> The percentages are estimates built from practice data, not confirmed predictions. Always check before you act.</span>
        </div>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-card/95 px-4 backdrop-blur lg:px-6">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon-sm" className="lg:hidden" aria-label="Open navigation"><Menu aria-hidden="true" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-sidebar-border bg-sidebar p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SheetDescription className="sr-only">Pages of the delivery risk console</SheetDescription>
              <Sidebar onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Sheet>
          <OrderSearch />
          <div className="ml-auto flex items-center gap-2"><Automation /><ThemeMenu /></div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto grid w-full max-w-[1500px] content-start gap-4 px-4 py-5 lg:px-6"><Outlet /></main>
      </div>
    </div>
  );
}
