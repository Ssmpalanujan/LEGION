import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { setLang } from '../i18n'
import { useAuth } from '../auth'

const LINKS = [
  { to: '/', key: 'nav.home' },
  { to: '/movies', key: 'nav.movies' },
  { to: '/tamil', key: 'nav.tamil' },
  { to: '/sinhala', key: 'nav.sinhala' },
  { to: '/swipe', key: 'nav.swipe' },
  { to: '/night', key: 'nav.night' },
  { to: '/mylist', key: 'nav.mylist' },
]

export function Navbar() {
  const { t, i18n } = useTranslation()
  const nav = useNavigate()
  const { user, logout } = useAuth()
  const [q, setQ] = useState('')
  const [sugg, setSugg] = useState<string[]>([])
  const [menu, setMenu] = useState(false)
  const [avatar, setAvatar] = useState(false)
  const [notif, setNotif] = useState(0)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const qq = q.trim()
    if (!qq) {
      setSugg([])
      return
    }
    const timer = setTimeout(() => {
      void api
        .search(qq, 8)
        .then((d) => setSugg(d.results.map((m) => m.title)))
        .catch(() => {})
    }, 250)
    return () => clearTimeout(timer)
  }, [q])

  useEffect(() => {
    // unread = watchlist size as a lightweight badge until notifications land (Phase 13D)
    if (user) void api.watchlist().then((w) => setNotif(w.items.length)).catch(() => {})
  }, [user])

  return (
    <header className="nav">
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="nav-inner">
        <button className="hamburger" onClick={() => setMenu((v) => !v)} aria-label="Menu" aria-expanded={menu}>
          ☰
        </button>
        <button className="logo" onClick={() => nav('/')} aria-label="CineMatch home">
          <span className="logo-dot" aria-hidden="true" /> CINEMATCH
        </button>
        <nav className={`nav-links${menu ? ' open' : ''}`} aria-label="Primary">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? 'active' : '')} onClick={() => setMenu(false)}>
              {t(l.key)}
            </NavLink>
          ))}
        </nav>
        <div className="nav-right">
          <div className="nav-search" ref={box}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && q.trim()) {
                  setSugg([])
                  nav(`/search?q=${encodeURIComponent(q.trim())}`)
                }
              }}
              placeholder={t('nav.searchPh')}
              aria-label="Search movies"
              role="combobox"
              aria-expanded={sugg.length > 0}
            />
            {sugg.length > 0 && (
              <ul className="nav-suggest" role="listbox" aria-label="Suggestions">
                {sugg.map((s) => (
                  <li key={s} role="option" aria-selected="false">
                    <button
                      onClick={() => {
                        setQ('')
                        setSugg([])
                        nav(`/search?q=${encodeURIComponent(s)}`)
                      }}
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="lang-switch" role="group" aria-label="Language">
            {['en', 'ta', 'si'].map((c) => (
              <button key={c} className={i18n.language === c ? 'active' : ''} onClick={() => setLang(c)} aria-pressed={i18n.language === c}>
                {c === 'en' ? 'EN' : c === 'ta' ? 'தமிழ்' : 'සිංහල'}
              </button>
            ))}
          </div>
          <button className="bell" aria-label={`Notifications, ${notif} unread`} onClick={() => nav('/mylist')}>
            🔔{notif > 0 && <span className="badge">{notif}</span>}
          </button>
          {user ? (
            <div className="avatar-menu">
              <button className="avatar" onClick={() => setAvatar((v) => !v)} aria-label="Account menu" aria-expanded={avatar}>
                {user.email[0].toUpperCase()}
              </button>
              {avatar && (
                <div className="avatar-dropdown">
                  <button onClick={() => { setAvatar(false); nav('/profile') }}>{t('nav.profile')}</button>
                  <button onClick={() => { setAvatar(false); nav('/profile') }}>{t('nav.taste')}</button>
                  {user.is_admin && <button onClick={() => { setAvatar(false); nav('/admin') }}>{t('nav.admin')}</button>}
                  <button onClick={() => { logout(); setAvatar(false); nav('/') }}>{t('nav.logout')}</button>
                </div>
              )}
            </div>
          ) : (
            <button className="signin-btn" onClick={() => nav('/profile')}>{t('nav.login')}</button>
          )}
        </div>
      </div>
    </header>
  )
}

export function BottomTabs() {
  const { t } = useTranslation()
  const tabs = [
    { to: '/', label: t('nav.home'), icon: '⌂' },
    { to: '/search', label: 'Search', icon: '⌕' },
    { to: '/swipe', label: t('nav.swipe'), icon: '♥' },
    { to: '/mylist', label: t('nav.mylist'), icon: '▤' },
    { to: '/profile', label: t('nav.profile'), icon: '○' },
  ]
  return (
    <nav className="bottom-tabs" aria-label="Mobile">
      {tabs.map((b) => (
        <NavLink key={b.to} to={b.to} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="ticon" aria-hidden="true">{b.icon}</span>
          {b.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <nav aria-label="Footer">
          {['Account', 'Help Center', 'Terms', 'Privacy'].map((x) => (
            <button key={x}>{x}</button>
          ))}
        </nav>
        <span aria-hidden="true">● ○ ◉</span>
        <span className="attr">This product uses the TMDB API but is not endorsed or certified by TMDB.</span>
      </div>
    </footer>
  )
}
