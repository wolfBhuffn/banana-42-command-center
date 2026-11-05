import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronRight, CircleHelp, Clock3, Command, Crosshair, DollarSign, History, LayoutDashboard, LogOut, Plus, Radio, ShieldCheck, Sparkles, Timer, Trash2, TrendingUp, Wallet, X } from 'lucide-react';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import {
  getGetDashboardSummaryQueryKey,
  getListShiftsQueryKey,
  useCreateManualShift,
  useDeleteShift,
  useEndShift,
  useGetDashboardSummary,
  useListShifts,
  useStartShift,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const appearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#c5ed4b',
    colorForeground: '#e9e7df',
    colorMutedForeground: '#999f9a',
    colorDanger: '#e66b66',
    colorBackground: '#191c22',
    colorInput: '#20242b',
    colorInputForeground: '#e9e7df',
    colorNeutral: '#e9e7df',
    fontFamily: "'Space Grotesk', sans-serif",
    borderRadius: '12px',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#191c22] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#30343b]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#e9e7df] font-semibold',
    headerSubtitle: 'text-[#a1a69f]',
    socialButtonsBlockButtonText: 'text-[#e9e7df]',
    formFieldLabel: 'text-[#d8d8cf]',
    footerActionLink: 'text-[#c5ed4b]',
    footerActionText: 'text-[#a1a69f]',
    dividerText: 'text-[#a1a69f]',
    identityPreviewEditButton: 'text-[#c5ed4b]',
    formFieldSuccessText: 'text-[#c5ed4b]',
    alertText: 'text-[#e9e7df]',
    logoBox: 'mb-3',
    logoImage: 'h-9',
    socialButtonsBlockButton: 'border border-[#353a42] bg-[#20242b] hover:bg-[#282d35]',
    formButtonPrimary: 'bg-[#c5ed4b] text-[#171a1f] hover:bg-[#d1f66c] shadow-none',
    formFieldInput: 'bg-[#20242b] border-[#353a42] text-[#e9e7df]',
    footerAction: 'border-t border-[#30343b]',
    dividerLine: 'bg-[#353a42]',
    alert: 'bg-[#2a2020] border-[#614140]',
    otpCodeFieldInput: 'bg-[#20242b] border-[#353a42] text-[#e9e7df]',
    formFieldRow: 'gap-2',
    main: 'gap-5',
  },
};

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(cents / 100);
}
function hours(value: number) {
  return `${value.toFixed(1)}h`;
}
function elapsed(seconds: number) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}
function durationLabel(seconds: number) {
  const total = Math.max(0, Math.floor(seconds / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}
function dateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}
function dateOnly(value: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(value));
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-3" data-testid="brand-banana42">
    <div className="relative grid h-10 w-10 place-items-center border border-lime-300/50 bg-lime-300/[.08] text-lime-300">
      <Command size={21} strokeWidth={2.2} />
      <span className="absolute -right-1 -top-1 h-2 w-2 bg-lime-300" />
    </div>
    {!compact && <div className="leading-none">
      <div className="font-mono text-[13px] font-medium tracking-[.12em] text-[#f0efe8]">BANANA<span className="text-lime-300">_42</span></div>
      <div className="mt-1.5 font-mono text-[9px] tracking-[.22em] text-[#747c7d]">WOLFX__XSABYTERS</div>
    </div>}
  </div>;
}

function Mark({ children }: { children: ReactNode }) {
  return <span className="mr-2 inline-flex h-7 w-7 items-center justify-center border border-[#383e42] bg-[#20242a] text-lime-300">{children}</span>;
}

function Home() {
  const { isLoaded, isSignedIn } = useUser();
  if (isLoaded && isSignedIn) return <Redirect to="/dashboard" />;
  return <div className="min-h-[100dvh] overflow-hidden bg-[#101216] text-[#e9e7df]" data-testid="landing-page">
    <header className="relative z-10 mx-auto flex max-w-[1440px] items-center justify-between px-6 py-6 md:px-12">
      <Brand />
      <div className="flex items-center gap-5">
        <span className="hidden items-center gap-2 font-mono text-[10px] tracking-[.16em] text-[#818986] sm:flex" data-testid="status-system-online"><span className="h-1.5 w-1.5 rounded-full bg-lime-300" />SYSTEM ONLINE</span>
        <Link href="/sign-in" className="border border-[#373d3f] px-4 py-2.5 font-mono text-[10px] tracking-[.1em] text-[#d6d6ce] transition hover:border-lime-300/70 hover:text-lime-200" data-testid="link-sign-in">SIGN IN <ArrowRight className="ml-2 inline" size={13} /></Link>
      </div>
    </header>
    <main>
      <section className="terminal-grid relative mx-auto grid min-h-[690px] max-w-[1440px] items-center px-6 pb-20 pt-12 md:min-h-[720px] md:grid-cols-[1.15fr_.85fr] md:px-12 md:pb-28">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#101216] via-[#101216]/90 to-transparent" />
        <div className="relative z-[1] max-w-[720px] enter">
          <div className="mb-8 flex items-center gap-3 font-mono text-[10px] tracking-[.24em] text-lime-300" data-testid="text-product-identity"><span className="h-px w-8 bg-lime-300" />NEXUS / SOLO OPERATOR CONSOLE</div>
          <h1 className="max-w-[760px] text-[clamp(3.6rem,8.5vw,8rem)] font-semibold leading-[.87] tracking-[-.075em] text-[#efeee8]" data-testid="text-landing-headline">Your time.<br /><span className="text-lime-300">Your ledger.</span></h1>
          <p className="mt-8 max-w-[470px] text-lg leading-8 text-[#a4aaa5]" data-testid="text-landing-description">A private shift console for people who work for themselves. Start the clock, close the shift, know exactly what your time earned.</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/sign-up" className="inline-flex items-center gap-3 bg-lime-300 px-6 py-4 font-mono text-[11px] font-medium tracking-[.12em] text-[#171a1b] transition hover:bg-[#d3f475]" data-testid="link-create-account">OPEN YOUR CONSOLE <ArrowRight size={16} /></Link>
            <Link href="/sign-in" className="inline-flex items-center gap-3 border border-[#3a4041] px-6 py-4 font-mono text-[11px] tracking-[.12em] text-[#d0d2cc] transition hover:border-[#737c76]" data-testid="link-returning-user">RETURNING OPERATOR</Link>
          </div>
          <div className="mt-16 flex flex-wrap gap-x-8 gap-y-3 border-t border-[#2c3134] pt-5 font-mono text-[9px] tracking-[.13em] text-[#737b79]" data-testid="text-privacy-promise">
            <span className="flex items-center gap-2"><ShieldCheck size={13} className="text-lime-300" />PRIVATE BY DEFAULT</span>
            <span className="flex items-center gap-2"><Crosshair size={13} className="text-lime-300" />BUILT FOR ONE</span>
            <span className="flex items-center gap-2"><Clock3 size={13} className="text-lime-300" />NO LOST HOURS</span>
          </div>
        </div>
        <div className="relative z-[1] mt-16 flex justify-center md:mt-0 md:justify-end">
          <div className="scanline panel-edge relative w-full max-w-[440px] border border-[#3b4142] bg-[#191c20]/95 p-5 md:p-7">
            <div className="mb-7 flex items-center justify-between border-b border-[#34393b] pb-4">
              <div className="flex items-center gap-2 font-mono text-[10px] tracking-[.15em] text-[#a3aaa4]"><Radio size={14} className="text-lime-300" /> LIVE SHIFT MONITOR</div>
              <span className="font-mono text-[9px] text-[#737b76]">NXS // 01</span>
            </div>
            <div className="flex items-center gap-3"><span className="h-2 w-2 animate-pulse rounded-full bg-lime-300" /><span className="font-mono text-[10px] tracking-[.17em] text-lime-300">READY WHEN YOU ARE</span></div>
            <div className="mt-7 font-mono text-[clamp(3.3rem,8vw,5.2rem)] leading-none tracking-[-.06em] text-[#f1f0e9]" data-testid="text-demo-timer">00:00:00</div>
             <div className="mt-3 flex justify-between font-mono text-[9px] tracking-[.1em] text-[#7f8783]">
               <span>ELAPSED SESSION</span><span>PAY RATE <b className="text-[#e0ded5]">$20.00 / HR</b></span>
            </div>
            <div className="my-7 h-px bg-[#34393b]" />
            <div className="grid grid-cols-2 gap-4">
               <div className="border-l-2 border-lime-300/70 pl-3"><div className="font-mono text-[9px] tracking-[.12em] text-[#7f8783]">SAMPLE WEEK</div><div className="mt-2 text-2xl font-semibold tracking-tight" data-testid="text-demo-week-hours">24.5 <span className="text-sm font-normal text-[#929a95]">hrs</span></div></div>
               <div className="border-l-2 border-[#d5a750] pl-3"><div className="font-mono text-[9px] tracking-[.12em] text-[#7f8783]">SAMPLE EARNED</div><div className="mt-2 text-2xl font-semibold tracking-tight" data-testid="text-demo-week-pay">$490</div></div>
            </div>
            <div className="absolute -bottom-3 -right-3 -z-10 h-full w-full border border-lime-300/20" />
          </div>
        </div>
      </section>
      <section className="border-y border-[#2a2f32] bg-[#15181b]">
        <div className="mx-auto grid max-w-[1440px] gap-8 px-6 py-8 md:grid-cols-[1fr_2fr] md:items-center md:px-12">
          <div className="font-mono text-[10px] tracking-[.18em] text-lime-300" data-testid="text-value-strip">ONE OPERATOR. ONE SOURCE OF TRUTH.</div>
          <div className="grid gap-7 sm:grid-cols-3">
            {[['01 / TRACK', 'Start and end shifts in one tap.'], ['02 / RECORD', 'Add completed work without guesswork.'], ['03 / RECONCILE', 'See hours and pay at a glance.']].map(([title, copy]) => <div key={title} data-testid={`feature-${title.split(' ')[0].toLowerCase()}`}><div className="font-mono text-[10px] tracking-[.13em] text-[#e5e3d9]">{title}</div><p className="mt-2 text-sm text-[#8e9691]">{copy}</p></div>)}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-[1440px] px-6 py-24 md:px-12 md:py-32">
        <div className="grid gap-12 md:grid-cols-[.8fr_1.2fr]">
          <div><div className="font-mono text-[10px] tracking-[.2em] text-lime-300" data-testid="text-how-label">BUILT FOR THE SHIFT, NOT THE SPREADSHEET</div><h2 className="mt-6 max-w-md text-4xl font-medium leading-[1.08] tracking-[-.05em] text-[#edece4] md:text-6xl" data-testid="text-how-title">Keep your head in the work.</h2></div>
          <div className="space-y-0 border-t border-[#313639]">
            {[['01', 'Clock in with context', 'Set your hourly rate, leave a note, and get moving. The active shift stays visible until you close it.'], ['02', 'Close the loop', 'End your shift when you are done. BANANA_42 calculates duration and pay from the time you actually worked.'], ['03', 'Know where you stand', 'Review the week, your running totals, and every recorded shift in one private command center.']].map(([n, title, copy]) => <article key={n} className="grid gap-3 border-b border-[#313639] py-6 sm:grid-cols-[70px_1fr]" data-testid={`step-${n}`}><div className="font-mono text-xs text-lime-300">{n} /</div><div><h3 className="text-lg font-medium text-[#e8e6dd]" data-testid={`text-step-title-${n}`}>{title}</h3><p className="mt-2 max-w-lg text-sm leading-6 text-[#929a95]" data-testid={`text-step-copy-${n}`}>{copy}</p></div></article>)}
          </div>
        </div>
      </section>
      <section className="mx-6 mb-20 border border-[#383f40] bg-[#191d20] md:mx-12">
        <div className="flex flex-col gap-8 px-7 py-10 md:flex-row md:items-center md:justify-between md:px-12 md:py-12">
          <div><div className="font-mono text-[10px] tracking-[.2em] text-[#b2d94b]" data-testid="text-cta-kicker">READY TO MAKE YOUR HOURS COUNT?</div><h2 className="mt-3 text-3xl font-medium tracking-[-.04em] text-[#f0eee6] md:text-4xl" data-testid="text-cta-title">Open the console.</h2></div>
          <Link href="/sign-up" className="inline-flex items-center justify-center gap-3 self-start bg-lime-300 px-6 py-4 font-mono text-[11px] tracking-[.1em] text-[#171a1b] transition hover:bg-[#d3f475] md:self-auto" data-testid="link-final-sign-up">CREATE PRIVATE ACCOUNT <ArrowRight size={15} /></Link>
        </div>
      </section>
      <footer className="flex flex-col justify-between gap-3 border-t border-[#272c2e] px-6 py-6 font-mono text-[9px] tracking-[.13em] text-[#707875] md:flex-row md:px-12" data-testid="site-footer"><span>WOLFX__XSABYTERS / NEXUS</span><span>BANANA_42 COMMAND CENTER <span className="text-lime-300">— PRIVATE OPERATIONS</span></span></footer>
    </main>
  </div>;
}

function AuthFrame({ children }: { children: ReactNode }) {
  return <main className="terminal-grid flex min-h-[100dvh] items-center justify-center px-4 py-10" data-testid="auth-screen"><div className="w-full max-w-[500px]"><div className="mb-8 flex justify-center"><Brand /></div>{children}<div className="mt-7 text-center font-mono text-[9px] tracking-[.16em] text-[#727b77]" data-testid="text-auth-privacy">NEXUS PRIVATE ACCESS / ENCRYPTED SESSION</div></div></main>;
}
function SignInPage() {
  return <AuthFrame><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></AuthFrame>;
}
function SignUpPage() {
  return <AuthFrame><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></AuthFrame>;
}

function QueryInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  useEffect(() => {
    let prior: string | null | undefined;
    return addListener(({ user }) => {
      const id = user?.id ?? null;
      if (prior !== undefined && prior !== id) client.clear();
      prior = id;
    });
  }, [addListener, client]);
  return null;
}

function Protected({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <div className="min-h-[100dvh] bg-[#101216] p-8" data-testid="loading-auth"><div className="mx-auto h-10 max-w-6xl animate-pulse bg-[#20242a]" /><div className="mx-auto mt-8 h-64 max-w-6xl animate-pulse bg-[#191c20]" /></div>;
  if (!isSignedIn) return <Redirect to="/" />;
  return <>{children}</>;
}

function useRefreshData() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    void client.invalidateQueries({ queryKey: getListShiftsQueryKey() });
  };
}

function Shell({ children, active }: { children: ReactNode; active: 'dashboard' | 'shifts' }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [mobileNav, setMobileNav] = useState(false);
  const email = user?.primaryEmailAddress?.emailAddress ?? 'OPERATOR';
  const name = user?.firstName || email.split('@')[0];
  return <div className="min-h-[100dvh] bg-[#101216] text-[#e9e7df]" data-testid="command-center-shell">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col border-r border-[#292e31] bg-[#131619] md:flex" data-testid="navigation-sidebar">
      <div className="flex h-[86px] items-center border-b border-[#292e31] px-6"><Brand /></div>
      <div className="px-5 pt-7"><div className="mb-3 font-mono text-[9px] tracking-[.2em] text-[#68716e]">COMMAND</div>
        <Link href="/dashboard" className={`mb-1 flex items-center gap-3 px-3 py-3 text-sm transition ${active === 'dashboard' ? 'bg-[#22272a] text-lime-300' : 'text-[#9ba29d] hover:bg-[#1b2022] hover:text-[#ebe9e0]'}`} data-testid="nav-dashboard"><LayoutDashboard size={16} />Overview{active === 'dashboard' && <span className="ml-auto h-1.5 w-1.5 bg-lime-300" />}</Link>
        <Link href="/shifts" className={`flex items-center gap-3 px-3 py-3 text-sm transition ${active === 'shifts' ? 'bg-[#22272a] text-lime-300' : 'text-[#9ba29d] hover:bg-[#1b2022] hover:text-[#ebe9e0]'}`} data-testid="nav-shifts"><History size={16} />Shift history{active === 'shifts' && <span className="ml-auto h-1.5 w-1.5 bg-lime-300" />}</Link>
      </div>
      <div className="mt-auto p-5">
        <div className="mb-4 border border-[#303638] bg-[#191d20] p-3" data-testid="status-private-account"><div className="flex items-center gap-2 font-mono text-[9px] tracking-[.1em] text-[#a8b1aa]"><ShieldCheck size={13} className="text-lime-300" />PRIVATE OPERATOR</div><div className="mt-2 truncate text-xs text-[#757e79]" data-testid="text-user-email">{email}</div></div>
        <button type="button" onClick={() => void signOut({ redirectUrl: basePath || '/' })} className="flex w-full items-center gap-3 px-3 py-3 text-left text-xs text-[#8f9792] transition hover:bg-[#1b2022] hover:text-[#efeee8]" data-testid="button-sign-out"><LogOut size={15} />Sign out</button>
        <div className="mt-5 border-t border-[#292e31] pt-4 font-mono text-[9px] tracking-[.1em] text-[#626b68]" data-testid="text-sidebar-version">NEXUS SYSTEMS / v1.0.42</div>
      </div>
    </aside>
    <div className="md:pl-[252px]">
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[#292e31] bg-[#101216]/95 px-5 backdrop-blur md:px-10" data-testid="top-navigation">
        <button onClick={() => setMobileNav(!mobileNav)} className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[.14em] text-lime-300 md:hidden" data-testid="button-mobile-menu"><Command size={16} /> MENU</button>
        <div className="hidden items-center gap-2 font-mono text-[10px] tracking-[.16em] text-[#89918c] md:flex" data-testid="breadcrumb-current"><span>WOLFX__XSABYTERS</span><ChevronRight size={12} /><span className="text-[#d1d3cb]">NEXUS</span><ChevronRight size={12} /><span className="text-lime-300">{active === 'dashboard' ? 'OVERVIEW' : 'SHIFT HISTORY'}</span></div>
        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block"><div className="text-xs font-medium text-[#dcdad1]" data-testid="text-user-name">{name}</div><div className="mt-1 font-mono text-[8px] tracking-[.13em] text-[#737c77]">SOLO OPERATOR</div></div>
          <div className="grid h-9 w-9 place-items-center border border-lime-300/40 bg-lime-300/[.08] font-mono text-xs text-lime-300" data-testid="avatar-operator">{name.slice(0, 1).toUpperCase()}</div>
          <button type="button" aria-label="Sign out" onClick={() => void signOut({ redirectUrl: basePath || '/' })} className="grid h-9 w-9 place-items-center border border-[#303639] text-[#9da39e] transition hover:border-[#8d9990] hover:text-[#ebe9e0] md:hidden" data-testid="button-sign-out-mobile"><LogOut size={15} /></button>
        </div>
      </header>
      {mobileNav && <div className="fixed inset-x-0 top-[72px] z-30 border-b border-[#31383a] bg-[#15191c] p-4 md:hidden" data-testid="mobile-navigation"><Link href="/dashboard" onClick={() => setMobileNav(false)} className="flex gap-3 px-3 py-3 text-sm text-[#e7e5dd]" data-testid="mobile-nav-dashboard"><LayoutDashboard size={16} />Overview</Link><Link href="/shifts" onClick={() => setMobileNav(false)} className="flex gap-3 px-3 py-3 text-sm text-[#e7e5dd]" data-testid="mobile-nav-shifts"><History size={16} />Shift history</Link></div>}
      <main className="mx-auto max-w-[1440px] px-5 py-8 md:px-10 md:py-10">{children}</main>
      <footer className="mx-5 flex flex-col justify-between gap-2 border-t border-[#252a2d] py-5 font-mono text-[8px] tracking-[.13em] text-[#626a67] md:mx-10 md:flex-row" data-testid="command-center-footer"><span>WOLFX__XSABYTERS / NEXUS</span><span>PERSONAL SHIFT & PAY LEDGER</span></footer>
    </div>
  </div>;
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end" data-testid="page-heading"><div><div className="mb-3 flex items-center gap-2 font-mono text-[9px] tracking-[.2em] text-lime-300" data-testid="text-page-eyebrow"><span className="h-px w-5 bg-lime-300" />{eyebrow}</div><h1 className="text-3xl font-medium tracking-[-.05em] text-[#efeee8] md:text-4xl" data-testid="text-page-title">{title}</h1><p className="mt-2 text-sm text-[#858e89]" data-testid="text-page-description">{description}</p></div><div className="flex items-center gap-2 self-start border border-[#303639] px-3 py-2 font-mono text-[9px] tracking-[.1em] text-[#89928c]" data-testid="status-private"><span className="h-1.5 w-1.5 rounded-full bg-lime-300" />PERSONAL / PRIVATE</div></div>;
}

function Metric({ label, value, sub, icon, accent = 'lime', testId }: { label: string; value: string; sub: string; icon: ReactNode; accent?: string; testId: string }) {
  return <div className="panel-edge relative border border-[#303639] bg-[#191d20] p-5" data-testid={`metric-${testId}`}><div className="flex items-center justify-between"><span className="font-mono text-[9px] tracking-[.16em] text-[#838b86]" data-testid={`label-${testId}`}>{label}</span><span className={accent === 'amber' ? 'text-[#d9ac5a]' : 'text-lime-300'}>{icon}</span></div><div className="mt-5 text-[32px] font-medium leading-none tracking-[-.05em] text-[#eeeDE6]" data-testid={`value-${testId}`}>{value}</div><div className="mt-3 text-[11px] text-[#767f7a]" data-testid={`detail-${testId}`}>{sub}</div></div>;
}

function ShiftItem({ shift, onDelete, deletable = false }: { shift: { id: number; startedAt: string; endedAt: string | null; durationSeconds: number; hourlyRateCents: number; notes: string | null }; onDelete?: (id: number) => void; deletable?: boolean }) {
  const pay = (shift.durationSeconds / 3600) * shift.hourlyRateCents;
  return <div className="grid gap-4 border-b border-[#2e3436] px-4 py-4 last:border-0 sm:grid-cols-[1fr_auto_auto] sm:items-center" data-testid={`row-shift-${shift.id}`}>
    <div className="flex items-start gap-3"><span className={`mt-1.5 h-2 w-2 shrink-0 ${shift.endedAt ? 'bg-[#7d9a43]' : 'animate-pulse bg-lime-300'}`} /><div><div className="text-sm font-medium text-[#dddcd4]" data-testid={`text-shift-date-${shift.id}`}>{dateOnly(shift.startedAt)}</div><div className="mt-1 text-[11px] text-[#7e8781]" data-testid={`text-shift-time-${shift.id}`}>{dateTime(shift.startedAt)}{shift.endedAt ? ` — ${dateTime(shift.endedAt)}` : ' — IN PROGRESS'}</div>{shift.notes && <div className="mt-2 max-w-lg text-xs text-[#929991]" data-testid={`text-shift-notes-${shift.id}`}>{shift.notes}</div>}</div></div>
    <div className="flex items-center justify-between gap-7 pl-5 sm:justify-end sm:pl-0"><div className="min-w-[68px]"><div className="font-mono text-[8px] tracking-[.12em] text-[#707975]">DURATION</div><div className="mt-1.5 text-sm text-[#deddd5]" data-testid={`text-shift-duration-${shift.id}`}>{durationLabel(shift.durationSeconds)}</div></div><div className="min-w-[76px] text-right"><div className="font-mono text-[8px] tracking-[.12em] text-[#707975]">EARNED</div><div className="mt-1.5 text-sm text-lime-200" data-testid={`text-shift-pay-${shift.id}`}>{money(pay)}</div></div></div>
    {deletable && onDelete && <button type="button" aria-label={`Delete shift ${shift.id}`} onClick={() => onDelete(shift.id)} className="absolute right-4 top-4 grid h-8 w-8 place-items-center text-[#727a76] transition hover:bg-[#392224] hover:text-[#f08b84] sm:static" data-testid={`button-delete-shift-${shift.id}`}><Trash2 size={15} /></button>}
  </div>;
}

function Dashboard() {
  const summaryQuery = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const data = summaryQuery.data;
  const start = useStartShift();
  const end = useEndShift();
  const refresh = useRefreshData();
  const [rate, setRate] = useState('20');
  const [notes, setNotes] = useState('');
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState('');
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const activeSeconds = data?.activeShift ? Math.max(0, Math.floor((now - new Date(data.activeShift.startedAt).getTime()) / 1000)) : 0;
  const currentWeek = useMemo(() => data?.recentShifts?.slice(0, 4) ?? [], [data?.recentShifts]);
  const beginShift = (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    start.mutate({ data: { hourlyRateCents: Math.round(Number(rate) * 100), notes: notes.trim() || undefined } }, {
      onSuccess: () => { setNotes(''); setMessage('Shift started. Your time is now being tracked.'); refresh(); },
      onError: () => setMessage('Unable to start your shift. Check your connection and try again.'),
    });
  };
  const finishShift = (id: number) => {
    setMessage('');
    end.mutate({ id }, {
      onSuccess: () => { setMessage('Shift closed and added to your history.'); refresh(); },
      onError: () => setMessage('Unable to end this shift. Please try again.'),
    });
  };
  return <Shell active="dashboard">
    <PageHeading eyebrow="NEXUS / OPERATIONS" title="Overview" description="Your hours, earnings, and live shift status." />
    {summaryQuery.isLoading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-testid="loading-dashboard"><div className="h-32 animate-pulse border border-[#303639] bg-[#191d20]" /><div className="h-32 animate-pulse border border-[#303639] bg-[#191d20]" /><div className="h-32 animate-pulse border border-[#303639] bg-[#191d20]" /><div className="h-32 animate-pulse border border-[#303639] bg-[#191d20]" /></div> :
    summaryQuery.isError ? <div className="border border-[#5a3b3b] bg-[#241b1c] p-6" data-testid="error-dashboard"><div className="flex items-center gap-2 text-sm text-[#efaca5]"><CircleHelp size={16} />Dashboard data could not be loaded.</div><button onClick={() => void summaryQuery.refetch()} className="mt-4 border border-[#74504e] px-4 py-2 font-mono text-[10px] text-[#f0c5bf]" data-testid="button-retry-dashboard">RETRY</button></div> :
    data && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="summary-metrics">
        <Metric label="THIS WEEK / HOURS" value={hours(data.weekHours)} sub="Hours logged this week" icon={<Clock3 size={16} />} testId="week-hours" />
        <Metric label="THIS WEEK / PAY" value={money(data.weekPayCents)} sub="At your recorded rates" icon={<Wallet size={16} />} accent="amber" testId="week-pay" />
        <Metric label="ALL TIME / HOURS" value={hours(data.totalHours)} sub="Across all recorded shifts" icon={<Activity size={16} />} testId="total-hours" />
        <Metric label="ALL TIME / PAY" value={money(data.totalPayCents)} sub="Total recorded earnings" icon={<TrendingUp size={16} />} accent="amber" testId="total-pay" />
      </div>
      {message && <div className="mt-4 border border-[#4b6035] bg-[#1b241a] px-4 py-3 text-xs text-[#cae793]" role="status" data-testid="status-dashboard-message">{message}</div>}
      <div className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <section className={`panel-edge relative overflow-hidden border ${data.activeShift ? 'border-lime-300/40 bg-[#1a211a]' : 'border-[#303639] bg-[#191d20]'}`} data-testid="active-shift-panel">
          <div className="flex flex-col justify-between gap-4 border-b border-[#343b36] px-5 py-4 sm:flex-row sm:items-center sm:px-7"><div className="flex items-center gap-3"><span className={`grid h-9 w-9 place-items-center border ${data.activeShift ? 'border-lime-300/40 bg-lime-300/10 text-lime-300' : 'border-[#3a4040] bg-[#212629] text-[#929992]'}`}><Timer size={17} /></span><div><h2 className="text-sm font-medium text-[#e8e7df]" data-testid="text-active-shift-title">Active shift</h2><p className="mt-1 text-[10px] text-[#7f8882]">{data.activeShift ? 'Clock is running. You are on the record.' : 'No shift is running right now.'}</p></div></div><div className="flex items-center gap-2 font-mono text-[9px] tracking-[.14em] text-[#7b8580]" data-testid="status-shift-session"><span className={`h-1.5 w-1.5 rounded-full ${data.activeShift ? 'animate-pulse bg-lime-300' : 'bg-[#626a67]'}`} />{data.activeShift ? 'LIVE SESSION' : 'STANDBY'}</div></div>
          {data.activeShift ? <div className="px-5 py-7 sm:px-7"><div className="font-mono text-[9px] tracking-[.16em] text-[#8d968f]">ELAPSED TIME</div><div className="mt-3 font-mono text-[clamp(3.2rem,7vw,5.3rem)] leading-none tracking-[-.06em] text-[#f0f1e8]" data-testid="text-active-elapsed">{elapsed(activeSeconds)}</div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#909991]"><span data-testid="text-active-start">Started {dateTime(data.activeShift.startedAt)}</span><span data-testid="text-active-rate">{money(data.activeShift.hourlyRateCents)} / hr</span></div>{data.activeShift.notes && <p className="mt-3 text-xs text-[#aab0a8]" data-testid="text-active-notes">{data.activeShift.notes}</p>}<button onClick={() => finishShift(data.activeShift!.id)} disabled={end.isPending} className="mt-7 inline-flex items-center gap-2 bg-lime-300 px-5 py-3 font-mono text-[10px] font-medium tracking-[.1em] text-[#171a1b] transition hover:bg-[#d4f378] disabled:opacity-50" data-testid="button-end-shift">{end.isPending ? 'CLOSING SHIFT…' : 'END SHIFT'}<ArrowDownRight size={15} /></button></div> :
          <form onSubmit={beginShift} className="grid gap-4 px-5 py-6 sm:grid-cols-[150px_1fr_auto] sm:items-end sm:px-7">
            <label className="block"><span className="mb-2 block font-mono text-[9px] tracking-[.12em] text-[#89918b]">HOURLY RATE</span><div className="relative"><DollarSign size={14} className="absolute left-3 top-3 text-[#858d87]" /><input type="number" min="0" step="0.01" required value={rate} onChange={e => setRate(e.target.value)} className="h-10 w-full border border-[#3a4041] bg-[#121619] pl-8 pr-3 font-mono text-sm text-[#e8e6dc] outline-none focus:border-lime-300/70" data-testid="input-hourly-rate" /></div></label>
            <label className="block"><span className="mb-2 block font-mono text-[9px] tracking-[.12em] text-[#89918b]">SHIFT NOTE <span className="text-[#555f5a]">/ OPTIONAL</span></span><input value={notes} maxLength={500} onChange={e => setNotes(e.target.value)} placeholder="What are you working on?" className="h-10 w-full border border-[#3a4041] bg-[#121619] px-3 text-sm text-[#e8e6dc] outline-none placeholder:text-[#626a66] focus:border-lime-300/70" data-testid="input-shift-notes" /></label>
            <button type="submit" disabled={start.isPending || !rate || Number(rate) < 0} className="inline-flex h-10 items-center justify-center gap-2 bg-lime-300 px-5 font-mono text-[10px] font-medium tracking-[.1em] text-[#171a1b] transition hover:bg-[#d4f378] disabled:opacity-50" data-testid="button-start-shift">{start.isPending ? 'STARTING…' : 'START SHIFT'}<ArrowUpRight size={15} /></button>
          </form>}
        </section>
        <section className="panel-edge border border-[#303639] bg-[#191d20] p-5 sm:p-6" data-testid="week-at-a-glance">
          <div className="flex items-center justify-between"><div className="font-mono text-[9px] tracking-[.17em] text-[#89918b]">WEEK AT A GLANCE</div><CalendarDays size={15} className="text-[#d4ab5b]" /></div>
          <div className="mt-7 flex items-end justify-between"><div><div className="font-mono text-[9px] tracking-[.12em] text-[#737c76]">HOURS LOGGED</div><div className="mt-2 text-3xl font-medium tracking-[-.05em] text-[#e9e8e0]" data-testid="text-week-hours-large">{hours(data.weekHours)}</div></div><div className="text-right"><div className="font-mono text-[9px] tracking-[.12em] text-[#737c76]">WEEKLY EARNINGS</div><div className="mt-2 text-xl font-medium tracking-[-.03em] text-lime-200" data-testid="text-week-pay-large">{money(data.weekPayCents)}</div></div></div>
          <div className="mt-6 h-1 overflow-hidden bg-[#303638]" data-testid="bar-week-hours"><div className="h-full bg-lime-300 transition-all" style={{ width: `${Math.min(100, (data.weekHours / 40) * 100)}%` }} /></div>
          <div className="mt-2 flex justify-between font-mono text-[8px] tracking-[.1em] text-[#67706b]" data-testid="text-week-goal"><span>0H</span><span>40H REFERENCE</span></div>
          <div className="mt-6 border-t border-[#303638] pt-4"><div className="flex items-center gap-2 text-[11px] text-[#949b94]"><Sparkles size={13} className="text-[#d4ab5b]" />Every completed shift adds to your running totals.</div></div>
        </section>
      </div>
      <section className="panel-edge mt-6 border border-[#303639] bg-[#191d20]" data-testid="recent-shifts-panel">
        <div className="flex items-center justify-between border-b border-[#303639] px-5 py-4 sm:px-6"><div><h2 className="text-sm font-medium text-[#e5e4dc]" data-testid="text-recent-shifts-title">Recent shifts</h2><p className="mt-1 text-[10px] text-[#7e8781]">Latest entries in your ledger</p></div><Link href="/shifts" className="inline-flex items-center gap-1 font-mono text-[9px] tracking-[.1em] text-lime-300 hover:text-lime-200" data-testid="link-view-all-shifts">VIEW ALL <ArrowRight size={13} /></Link></div>
        {currentWeek.length ? currentWeek.map(shift => <ShiftItem key={shift.id} shift={shift} />) : <div className="px-6 py-9 text-center" data-testid="empty-recent-shifts"><div className="mx-auto grid h-10 w-10 place-items-center border border-[#393f40] text-[#8a938d]"><History size={17} /></div><div className="mt-3 text-sm text-[#d2d1c9]">No shifts on the ledger yet.</div><p className="mt-1 text-xs text-[#78817c]">Start a shift above to make the first entry.</p></div>}
      </section>
      <div className="mt-5 flex items-start gap-2 text-[10px] leading-5 text-[#707a74]" data-testid="text-rate-disclaimer"><CircleHelp size={13} className="mt-0.5 shrink-0" />Pay is estimated from the hourly rate saved with each shift. Your actual pay may differ.</div>
    </>}
  </Shell>;
}

function ManualShiftForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const create = useCreateManualShift();
  const [error, setError] = useState('');
  const now = new Date();
  const toLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const startedDefault = new Date(now.getTime() - 60 * 60 * 1000);
  const [startedAt, setStartedAt] = useState(toLocal(startedDefault));
  const [endedAt, setEndedAt] = useState(toLocal(now));
  const [rate, setRate] = useState('20');
  const [notes, setNotes] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (new Date(endedAt) <= new Date(startedAt)) { setError('End time must be after the start time.'); return; }
    create.mutate({ data: { startedAt: new Date(startedAt).toISOString(), endedAt: new Date(endedAt).toISOString(), hourlyRateCents: Math.round(Number(rate) * 100), notes: notes.trim() || undefined } }, {
      onSuccess: () => { onCreated(); onClose(); },
      onError: () => setError('Could not save this shift. Check the details and try again.'),
    });
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#080a0c]/80 px-4 py-8 backdrop-blur-sm" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }} data-testid="modal-manual-shift">
    <section className="panel-edge w-full max-w-[560px] border border-[#414849] bg-[#181c1f]" role="dialog" aria-modal="true" aria-labelledby="manual-title">
      <div className="flex items-start justify-between border-b border-[#343a3c] px-5 py-5 sm:px-7"><div><div className="font-mono text-[9px] tracking-[.18em] text-lime-300">LEDGER ENTRY / MANUAL</div><h2 id="manual-title" className="mt-2 text-xl font-medium text-[#e9e7df]" data-testid="text-manual-modal-title">Add a completed shift</h2><p className="mt-1 text-xs text-[#818a84]">Record hours you have already worked.</p></div><button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center text-[#8b938d] hover:bg-[#282e30] hover:text-white" aria-label="Close manual shift form" data-testid="button-close-manual-shift"><X size={17} /></button></div>
      <form onSubmit={submit} className="space-y-4 px-5 py-6 sm:px-7">
        <div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block font-mono text-[9px] tracking-[.12em] text-[#929a94]">START TIME</span><input type="datetime-local" required value={startedAt} onChange={e => setStartedAt(e.target.value)} className="h-11 w-full border border-[#3b4242] bg-[#101417] px-3 text-xs text-[#e1dfd6] outline-none [color-scheme:dark] focus:border-lime-300/60" data-testid="input-manual-start" /></label>
          <label><span className="mb-2 block font-mono text-[9px] tracking-[.12em] text-[#929a94]">END TIME</span><input type="datetime-local" required value={endedAt} onChange={e => setEndedAt(e.target.value)} className="h-11 w-full border border-[#3b4242] bg-[#101417] px-3 text-xs text-[#e1dfd6] outline-none [color-scheme:dark] focus:border-lime-300/60" data-testid="input-manual-end" /></label></div>
        <label className="block"><span className="mb-2 block font-mono text-[9px] tracking-[.12em] text-[#929a94]">HOURLY RATE</span><div className="relative"><DollarSign size={14} className="absolute left-3 top-3.5 text-[#818a84]" /><input type="number" min="0" step="0.01" required value={rate} onChange={e => setRate(e.target.value)} className="h-11 w-full border border-[#3b4242] bg-[#101417] pl-8 pr-3 font-mono text-sm text-[#e1dfd6] outline-none focus:border-lime-300/60" data-testid="input-manual-rate" /></div></label>
        <label className="block"><span className="mb-2 block font-mono text-[9px] tracking-[.12em] text-[#929a94]">NOTES <span className="text-[#68716c]">/ OPTIONAL</span></span><textarea value={notes} maxLength={500} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Add a little context for future you." className="w-full resize-none border border-[#3b4242] bg-[#101417] px-3 py-3 text-sm text-[#e1dfd6] outline-none placeholder:text-[#626a66] focus:border-lime-300/60" data-testid="input-manual-notes" /></label>
        {error && <div className="border border-[#65403e] bg-[#2b1f20] px-3 py-2 text-xs text-[#f0a49e]" role="alert" data-testid="error-manual-shift">{error}</div>}
        <div className="flex flex-col-reverse gap-2 border-t border-[#303638] pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="border border-[#3b4242] px-5 py-3 font-mono text-[9px] tracking-[.1em] text-[#a7ada6] hover:bg-[#24292b]" data-testid="button-cancel-manual-shift">CANCEL</button><button type="submit" disabled={create.isPending || !rate || Number(rate) < 0} className="inline-flex items-center justify-center gap-2 bg-lime-300 px-5 py-3 font-mono text-[9px] font-medium tracking-[.1em] text-[#171a1b] hover:bg-[#d4f378] disabled:opacity-50" data-testid="button-save-manual-shift">{create.isPending ? 'SAVING…' : 'SAVE SHIFT'}<Check size={14} /></button></div>
      </form>
    </section>
  </div>;
}

function ShiftsPage() {
  const PAGE_SIZE = 30;
  const [offset, setOffset] = useState(0);
  const params = useMemo(() => ({ limit: PAGE_SIZE + 1, offset }), [offset]);
  const shiftsQuery = useListShifts(params, { query: { queryKey: getListShiftsQueryKey(params) } });
  const summaryQuery = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const remove = useDeleteShift();
  const refresh = useRefreshData();
  const [manualOpen, setManualOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const shifts = shiftsQuery.data ?? [];
  const visibleShifts = shifts.slice(0, PAGE_SIZE);
  const hasMore = shifts.length > PAGE_SIZE;
  const allTimeHours = summaryQuery.data ? hours(summaryQuery.data.totalHours) : summaryQuery.isLoading ? '—' : 'Unavailable';
  const allTimePay = summaryQuery.data ? money(summaryQuery.data.totalPayCents) : summaryQuery.isLoading ? '—' : 'Unavailable';
  const removeShift = (id: number) => {
    if (!window.confirm('Delete this shift from your ledger? This cannot be undone.')) return;
    setNotice('');
    remove.mutate({ id }, {
      onSuccess: () => { setNotice('Shift removed from your ledger.'); refresh(); },
      onError: () => setNotice('This shift could not be deleted. Please try again.'),
    });
  };
  return <Shell active="shifts">
    <PageHeading eyebrow="NEXUS / PERSONAL LEDGER" title="Shift history" description="Every recorded session, with hours and pay accounted for." />
    <div className="mb-6 grid gap-3 sm:grid-cols-3" data-testid="shift-history-summary">
      <Metric label="VISIBLE ENTRIES" value={String(visibleShifts.length).padStart(2, '0')} sub="On this page of your ledger" icon={<History size={16} />} testId="shift-count" />
      <Metric label="ALL-TIME HOURS" value={allTimeHours} sub="Across all recorded shifts" icon={<Clock3 size={16} />} testId="shift-hours" />
      <Metric label="ALL-TIME EARNED" value={allTimePay} sub="Calculated at each saved rate" icon={<Wallet size={16} />} accent="amber" testId="shift-pay" />
    </div>
    {notice && <div className="mb-4 border border-[#4b6035] bg-[#1b241a] px-4 py-3 text-xs text-[#cae793]" role="status" data-testid="status-shift-notice">{notice}</div>}
    <section className="panel-edge border border-[#303639] bg-[#191d20]" data-testid="shift-list-panel">
      <div className="flex flex-col justify-between gap-4 border-b border-[#303639] px-5 py-4 sm:flex-row sm:items-center sm:px-6"><div><div className="flex items-center gap-2"><h2 className="text-sm font-medium text-[#e6e4dc]" data-testid="text-ledger-title">Your ledger</h2><span className="border border-[#363d3f] px-2 py-1 font-mono text-[8px] text-[#8d9690]" data-testid="text-shift-count">{shifts.length} ENTRIES</span></div><p className="mt-1 text-[10px] text-[#7c857f]">Newest shifts appear first</p></div><button type="button" onClick={() => setManualOpen(true)} className="inline-flex items-center justify-center gap-2 bg-lime-300 px-4 py-3 font-mono text-[9px] font-medium tracking-[.1em] text-[#171a1b] transition hover:bg-[#d4f378]" data-testid="button-open-manual-shift"><Plus size={15} />ADD COMPLETED SHIFT</button></div>
      {shiftsQuery.isLoading ? <div className="space-y-0 px-5 py-2" data-testid="loading-shifts">{[0, 1, 2, 3].map(i => <div key={i} className="my-3 h-[62px] animate-pulse bg-[#22272a]" />)}</div> :
      shiftsQuery.isError ? <div className="px-5 py-12 text-center" data-testid="error-shifts"><p className="text-sm text-[#e3a39d]">Your shift history did not load.</p><button onClick={() => void shiftsQuery.refetch()} className="mt-4 border border-[#6b4846] px-4 py-2 font-mono text-[9px] text-[#e8b1aa]" data-testid="button-retry-shifts">TRY AGAIN</button></div> :
      visibleShifts.length ? visibleShifts.map(shift => <ShiftItem key={shift.id} shift={shift} deletable={!!shift.endedAt} onDelete={removeShift} />) :
      <div className="px-6 py-16 text-center" data-testid="empty-shift-history"><div className="mx-auto grid h-12 w-12 place-items-center border border-[#3a4142] bg-[#202527] text-[#a2aa9f]"><History size={20} /></div><h3 className="mt-4 text-base font-medium text-[#deddd5]" data-testid="text-empty-shifts-title">Your ledger is clear.</h3><p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#818a84]" data-testid="text-empty-shifts-copy">Add a completed shift or start tracking from the overview. Your hours and pay will build here.</p><button onClick={() => setManualOpen(true)} className="mt-5 inline-flex items-center gap-2 border border-[#505a4b] px-4 py-2.5 font-mono text-[9px] tracking-[.1em] text-lime-200 transition hover:bg-lime-300/10" data-testid="button-empty-add-shift"><Plus size={14} />ADD FIRST SHIFT</button></div>}
    </section>
    {(offset > 0 || hasMore) && <div className="mt-4 flex items-center justify-between gap-3" data-testid="shift-pagination">
      <button type="button" disabled={offset === 0 || shiftsQuery.isFetching} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} className="border border-[#3b4242] px-4 py-3 font-mono text-[9px] tracking-[.1em] text-[#b9beb7] transition hover:border-lime-300/60 hover:text-lime-200 disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-newer-shifts">NEWER SHIFTS</button>
      <span className="font-mono text-[9px] tracking-[.12em] text-[#7b847e]" data-testid="text-shift-page">PAGE {Math.floor(offset / PAGE_SIZE) + 1}</span>
      <button type="button" disabled={!hasMore || shiftsQuery.isFetching} onClick={() => setOffset(offset + PAGE_SIZE)} className="border border-[#3b4242] px-4 py-3 font-mono text-[9px] tracking-[.1em] text-[#b9beb7] transition hover:border-lime-300/60 hover:text-lime-200 disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-older-shifts">OLDER SHIFTS<ChevronRight size={13} className="ml-1 inline" /></button>
    </div>}
    {remove.isPending && <div className="mt-3 font-mono text-[9px] tracking-[.12em] text-[#9ca59e]" role="status" data-testid="status-deleting-shift">REMOVING ENTRY…</div>}
    <div className="mt-5 flex items-start gap-2 text-[10px] leading-5 text-[#707a74]" data-testid="text-history-rate-disclaimer"><CircleHelp size={13} className="mt-0.5 shrink-0" />Each entry preserves its own hourly rate. Deleting a shift also removes its contribution from your totals.</div>
    {manualOpen && <ManualShiftForm onClose={() => setManualOpen(false)} onCreated={() => { setOffset(0); setNotice('Completed shift added to your ledger.'); refresh(); }} />}
  </Shell>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function RouterContent() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={{ signIn: { start: { title: 'Welcome back, operator', subtitle: 'Sign in to your private console.' } }, signUp: { start: { title: 'Create your operator account', subtitle: 'Your hours stay yours.' } } }}
    routerPush={to => setLocation(stripBase(to))} routerReplace={to => setLocation(stripBase(to), { replace: true })}>
    <QueryClientProvider client={queryClient}>
      <QueryInvalidator />
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/dashboard"><Protected><Dashboard /></Protected></Route>
          <Route path="/shifts"><Protected><ShiftsPage /></Protected></Route>
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  return <TooltipProvider>
    <WouterRouter base={basePath}>
      <RouterContent />
    </WouterRouter>
    <Toaster />
  </TooltipProvider>;
}

export default App;
