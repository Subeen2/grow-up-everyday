import { render, screen } from '@testing-library/react';
import { Celebration } from './Celebration';

describe('Celebration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a celebratory status message', () => {
    render(<Celebration onDone={() => {}} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('calls onDone once the duration elapses, and not before', () => {
    const onDone = vi.fn();
    render(<Celebration onDone={onDone} duration={1000} />);

    vi.advanceTimersByTime(999);
    expect(onDone).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onDone).toHaveBeenCalledOnce();
  });
});
