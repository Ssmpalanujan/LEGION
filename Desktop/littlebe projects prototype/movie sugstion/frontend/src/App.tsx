import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth'
import { BottomTabs, Footer, Navbar } from './components/Navbar'
import { useTranslation } from 'react-i18next'

// Code-split routes per spec.
const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })))
const Movies = lazy(() => import('./pages/Movies').then((m) => ({ default: m.Movies })))
const LanguageShelf = lazy(() => import('./pages/Movies').then((m) => ({ default: m.LanguageShelf })))
const SearchPage = lazy(() => import('./pages/SearchPage').then((m) => ({ default: m.SearchPage })))
const Detail = lazy(() => import('./pages/Detail').then((m) => ({ default: m.Detail })))
const Swipe = lazy(() => import('./pages/Swipe').then((m) => ({ default: m.Swipe })))
const Night = lazy(() => import('./pages/Night').then((m) => ({ default: m.Night })))
const MyList = lazy(() => import('./pages/MyList').then((m) => ({ default: m.MyList })))
const Profile = lazy(() => import('./pages/Profile').then((m) => ({ default: m.Profile })))
const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })))

export function App() {
  const { t } = useTranslation()
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <Suspense fallback={<main className="wrap"><p className="tip">{t('common.loading')}</p></main>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/movies" element={<Movies />} />
            <Route path="/tamil" element={<LanguageShelf lang="ta" title={t('rows.tamilNew')} />} />
            <Route path="/sinhala" element={<LanguageShelf lang="si" title={t('rows.sinhala')} />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/movie/:id" element={<Detail />} />
            <Route path="/swipe" element={<Swipe />} />
            <Route path="/night" element={<Night />} />
            <Route path="/mylist" element={<MyList />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <Footer />
        <BottomTabs />
      </AuthProvider>
    </BrowserRouter>
  )
}
