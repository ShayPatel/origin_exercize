import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AguiTicketWidget } from '@/components/agui/AguiTicketWidget'

const mockData = {
  name: 'React Conference 2026',
  event_date: '2026-12-01T10:00:00Z',
  registration_id: 'abc123-def456-ghi789',
  event_id: 'evt-001',
  user_id: 'alice@example.com',
}

describe('AguiTicketWidget', () => {
  it('renders the event name', () => {
    render(<AguiTicketWidget data={mockData} />)
    expect(screen.getByText('React Conference 2026')).toBeInTheDocument()
  })

  it('renders the Confirmed Entry badge', () => {
    render(<AguiTicketWidget data={mockData} />)
    expect(screen.getByText('Confirmed Entry')).toBeInTheDocument()
  })

  it('renders the registration ID prefix', () => {
    render(<AguiTicketWidget data={mockData} />)
    expect(screen.getByText(/ID: abc123/)).toBeInTheDocument()
  })

  it('renders the Unregister button', () => {
    render(<AguiTicketWidget data={mockData} />)
    expect(screen.getByRole('button', { name: /unregister/i })).toBeInTheDocument()
  })

  it('calls onUnregister with prefill text when Unregister is clicked', () => {
    const onUnregister = vi.fn()
    render(<AguiTicketWidget data={mockData} onUnregister={onUnregister} />)
    fireEvent.click(screen.getByRole('button', { name: /unregister/i }))
    expect(onUnregister).toHaveBeenCalledWith(
      expect.stringContaining('alice@example.com')
    )
  })

  it('renders a formatted event date', () => {
    render(<AguiTicketWidget data={mockData} />)
    // The date span contains the localeDateString — look for the <span> sibling of the Calendar icon
    const dateSpans = screen.getAllByText(/12\/1\/2026|Dec.*2026|2026.*Dec/)
    expect(dateSpans.length).toBeGreaterThan(0)
  })
})
