export const APP_NAME = "Natillera";
export const RAFFLE_FIXED_AMOUNT = 5000;
export const LUNCH_FIXED_AMOUNT = 5000;
export const CONTRIBUTION_LATE_RATE = 0.02;
export const LOAN_MONTHLY_RATE = 0.05;
export const DEFAULT_CONTRIBUTION_DUE_DAY = 10;
export const ADMIN_COOKIE_NAME = "natillera_admin_session";
export const UPCOMING_ALERT_WINDOW_DAYS = 7;
export const SETTLEMENT_ALERT_WINDOW_DAYS = 30;
export const DEV_ADMIN_USERNAME = "admin";
export const DEV_ADMIN_PASSWORD = "Familia123";
export const DEV_SESSION_SECRET = "natillera-dev-secret-change-me";

export const ADMIN_NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/participants", label: "Participantes" },
  { href: "/admin/contributions", label: "Aportes" },
  { href: "/admin/raffles", label: "Polla" },
  { href: "/admin/lunches", label: "Almuerzos" },
  { href: "/admin/covenas", label: "Viaje Coveñas" },
  { href: "/admin/loans", label: "Préstamos" },
  { href: "/admin/cash", label: "Caja" },
  { href: "/admin/settlement", label: "Liquidación" },
  { href: "/admin/settings", label: "Configuración" },
] as const;

export const MONTH_OPTIONS = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
] as const;
