import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HybridSlider } from './HybridSlider'

describe('HybridSlider', () => {
  it('shows current mix and debounces refetch', () => {
    vi.useFakeTimers()
    try {
      const onChange = vi.fn()
      const { rerender } = render(<HybridSlider value={0.5} onChange={onChange} />)
      expect(screen.getByText('50% content')).toBeInTheDocument()

      const slider = screen.getByLabelText('Hybrid mix: content versus collaborative')
      fireEvent.change(slider, { target: { value: '0.6' } })
      expect(screen.getByText('60% content')).toBeInTheDocument()
      // debounced: no call before 400ms
      vi.advanceTimersByTime(399)
      expect(onChange).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(onChange).toHaveBeenCalledWith(0.6)

      rerender(<HybridSlider value={0.6} onChange={onChange} />)
      expect(screen.getByText('60% content')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
