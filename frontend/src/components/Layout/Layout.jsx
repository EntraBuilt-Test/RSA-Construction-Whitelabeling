import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import logoImg from '../../logo/logoo2.png';
import { moduleApi } from '../../api';
import ChatWidget from '../common/ChatWidget.jsx';

// Main navigation, rendered as a left sidebar. Additional modules can be added
// later by adding one more entry here plus a route in App.jsx - nothing else
// about the layout needs to change.
function useTabs(t) {
  return [
    { to: '/dashboard', label: t('nav.dashboard'), short: 'DB' },
    { to: '/billing', label: t('nav.billing'), short: 'BI' },
    { to: '/materials', label: t('nav.materials'), short: 'MA' },
    { to: '/labour', label: t('nav.labour'), short: 'LB' },
    { to: '/voucher', label: t('nav.voucher'), short: 'VO' },
    { to: '/stock', label: t('nav.stock'), short: 'ST' },
    { to: '/reports', label: t('nav.reports'), short: 'RE' },
  ];
}

const COLLAPSE_STORAGE_KEY = 'rsa-sidebar-collapsed';
const LOGO_CLICKS_TO_UNLOCK = 5;
const LOGO_CLICK_WINDOW_MS = 1500;

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const collapseBtnRef = useRef(null);
  const tabs = useTabs(t);

  // Tabs created later in the Superadmin Portal. Fetched separately from -
  // and appended after - the seven built-in tabs above, so a failed fetch
  // here never breaks the tabs that already worked before this existed.
  const [customTabs, setCustomTabs] = useState([]);
  useEffect(() => {
    moduleApi
      .list()
      .then((res) => {
        const custom = (res.data || [])
          .filter((m) => !m.isSystem && m.isActive)
          .sort((a, b) => a.order - b.order)
          .map((m) => ({
            to: m.path,
            label: m.label,
            short: m.short || m.icon || m.label.slice(0, 2).toUpperCase(),
          }));
        setCustomTabs(custom);
      })
      .catch(() => {
        /* Superadmin-created tabs are additive - if this fails, the built-in
           tabs above are unaffected. */
      });
  }, []);
  const allTabs = [...tabs, ...customTabs];

  // The collapse/expand toggle is a desktop convenience; the mobile drawer
  // (< 860px) always shows full labels regardless of the saved preference,
  // since a phone screen has no room saved by icon-only rows anyway.
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 860px)').matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)');
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
    return () => (mq.removeEventListener ? mq.removeEventListener('change', onChange) : mq.removeListener(onChange));
  }, []);
  const effectiveCollapsed = collapsed && !isMobile;

  const setCollapsedPersist = (next) => {
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* localStorage unavailable (private mode etc.) - collapse still works for this session */
    }
  };

  // Ctrl+B (or Cmd+B on Mac) toggles the sidebar from anywhere on the page,
  // matching the shortcut convention used by most IDE/editor sidebars.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (isMobile) return; // no collapse behavior to toggle on mobile
      const key = e.key?.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'b') {
        e.preventDefault();
        setCollapsedPersist(!collapsed);
        // Keep focus predictable after a keyboard-driven toggle.
        collapseBtnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [collapsed, isMobile]);

  // Hidden Superadmin entrance: 5 clicks on the brand/logo within 1.5s opens
  // /superadmin. Only wired up at all for isSuperAdmin users - for everyone
  // else the clicks are silently ignored, so the feature isn't discoverable.
  const logoClickCount = useRef(0);
  const logoClickTimer = useRef(null);
  const handleLogoClick = () => {
    if (!user?.isSuperAdmin) return;
    logoClickCount.current += 1;
    if (logoClickTimer.current) clearTimeout(logoClickTimer.current);
    if (logoClickCount.current >= LOGO_CLICKS_TO_UNLOCK) {
      logoClickCount.current = 0;
      navigate('/superadmin');
      return;
    }
    logoClickTimer.current = setTimeout(() => {
      logoClickCount.current = 0;
    }, LOGO_CLICK_WINDOW_MS);
  };
  useEffect(() => {
    return () => {
      if (logoClickTimer.current) clearTimeout(logoClickTimer.current);
    };
  }, []);

  return (
    <div className="app-shell">
      <header className="mobile-topbar no-print">
        <button className="hamburger-btn" onClick={() => setSidebarOpen((o) => !o)} aria-label="Menu">
          <span />
          <span />
          <span />
        </button>
        <span className="mobile-brand">{t('app.title')}</span>
      </header>

      {sidebarOpen && <div className="sidebar-backdrop no-print" onClick={() => setSidebarOpen(false)} />}

      <div className="app-body">
        <aside className={`app-sidebar no-print${sidebarOpen ? ' open' : ''}${effectiveCollapsed ? ' collapsed' : ''}`}>
          <div className="sidebar-top-row">
            <div className="brand" onClick={handleLogoClick} style={{ cursor: user?.isSuperAdmin ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', alignItems: effectiveCollapsed ? 'center' : 'flex-start', gap: '4px' }}>
              <div style={{ width: effectiveCollapsed ? '40px' : '55px', height: effectiveCollapsed ? '18px' : '25px', overflow: 'hidden', position: 'relative' }}>
                <img 
                  src={logoImg} 
                  alt="Name Logo" 
                  style={{ 
                    width: effectiveCollapsed ? '40px' : '55px', 
                    height: 'auto', 
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    filter: 'invert(1) hue-rotate(180deg)' 
                  }} 
                />
              </div>
              {!effectiveCollapsed && (
                <>
                  <div style={{ fontSize: '6.5px', fontWeight: 'bold', letterSpacing: '1.2px', textTransform: 'uppercase', color: '#fff', opacity: 0.8, lineHeight: 1.2, margin: '2px 0 4px' }}>
                    CONSTRUCTION &amp; BUILDING MATERIALS
                  </div>
                  <span className="brand-title" style={{ fontSize: '13px', fontWeight: '700', marginTop: '4px' }}>{t('app.title')}</span>
                  <span className="brand-sub">{t('app.subtitle')}</span>
                </>
              )}
            </div>
            {!isMobile && (
              <button
                ref={collapseBtnRef}
                type="button"
                className="collapse-toggle-btn"
                onClick={() => setCollapsedPersist(!collapsed)}
                aria-expanded={!effectiveCollapsed}
                aria-label={effectiveCollapsed ? t('common.expandSidebar') : t('common.collapseSidebar')}
                title={`${effectiveCollapsed ? t('common.expandSidebar') : t('common.collapseSidebar')} (Ctrl+B)`}
              >
                {effectiveCollapsed ? '»' : '«'}
              </button>
            )}
          </div>

          <nav className="tab-nav">
            {allTabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) => `tab-link${isActive ? ' active' : ''}`}
                onClick={() => setSidebarOpen(false)}
                title={effectiveCollapsed ? tab.label : undefined}
              >
                {effectiveCollapsed ? tab.short : tab.label}
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-controls">
              <button
                className="btn btn-ghost btn-sm theme-toggle"
                onClick={toggleTheme}
                title={t('common.theme')}
              >
                {effectiveCollapsed ? (theme === 'light' ? '☀' : '☽') : theme === 'light' ? t('common.dark') : t('common.light')}
              </button>
              {!effectiveCollapsed && (
                <select
                  className="lang-select"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  title={t('common.language')}
                >
                  <option value="en">English</option>
                  <option value="ta">தமிழ்</option>
                </select>
              )}
            </div>
            <div className="user-menu">
              {!effectiveCollapsed && <span>{user?.name}</span>}
              <button className="btn btn-ghost btn-sm" onClick={logout} title={t('nav.logout')}>
                {effectiveCollapsed ? '⏻' : t('nav.logout')}
              </button>
            </div>
          </div>
        </aside>

        <main className="app-content">
          <Outlet />
        </main>
      </div>

      <ChatWidget />
    </div>
  );
}
