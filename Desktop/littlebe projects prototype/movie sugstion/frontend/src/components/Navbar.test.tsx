import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import { Navbar } from './Navbar'

vi.mock('../auth', () => ({
  useAuth: () => ({ user: null, token: null, login: vi.fn(), register: vi.fn(), logout: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('../api', () => ({
  api: { search: vi.fn().mockResolvedValue({ results: [] }), watchlist: vi.fn().mockResolvedValue({ items: [] }) },
}))

function renderNav() {
  return render(
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>
        <Navbar />
      </I18nextProvider>
    </MemoryRouter>
  )
}

describe('Navbar', () => {
  it('renders brand and primary links', () => {
    renderNav()
    expect(screen.getByLabelText('CineMatch home')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getByLabelText('Search movies')).toBeInTheDocument()
  })

  it('has language switcher and sign-in', () => {
    renderNav()
    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })
})
