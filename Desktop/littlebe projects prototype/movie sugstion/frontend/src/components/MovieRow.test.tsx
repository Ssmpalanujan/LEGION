import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { Movie } from '../api'
import { MovieRow } from './MovieRow'

vi.mock('./MovieCard', () => ({
  MovieCard: ({ movie }: { movie: Movie }) => <div>{movie.title}</div>,
  ContinueCard: ({ movie }: { movie: Movie }) => <div>{movie.title}</div>,
}))

const movies: Movie[] = [
  { id: 1, title: 'Alpha (2000)', year: '2000' },
  { id: 2, title: 'Beta (2001)', year: '2001' },
]

describe('MovieRow', () => {
  it('renders title and cards, scrolls with arrows and keyboard', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <MovieRow title="Trending Movies" movies={movies} />
      </MemoryRouter>
    )
    expect(screen.getByText('Trending Movies')).toBeInTheDocument()
    expect(screen.getByText('Alpha (2000)')).toBeInTheDocument()
    const region = screen.getByRole('region', { name: 'Trending Movies carousel' })
    const scrollBy = vi.fn()
    Object.defineProperty(region, 'scrollBy', { value: scrollBy, configurable: true })
    await user.click(screen.getByLabelText('Scroll Trending Movies right'))
    expect(scrollBy).toHaveBeenCalled()
    region.focus()
    await user.keyboard('{ArrowLeft}')
    expect(scrollBy).toHaveBeenCalledTimes(2)
  })

  it('shows skeletons while loading', () => {
    render(
      <MemoryRouter>
        <MovieRow title="Loading row" movies={[]} loading />
      </MemoryRouter>
    )
    expect(screen.getByTestId('movie-row')).toBeInTheDocument()
  })
})
