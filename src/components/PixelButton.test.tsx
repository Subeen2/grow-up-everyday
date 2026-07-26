import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PixelButton } from './PixelButton';

describe('PixelButton', () => {
  it('renders children and responds to click', async () => {
    const handleClick = vi.fn();
    render(<PixelButton onClick={handleClick}>클릭</PixelButton>);
    await userEvent.click(screen.getByText('클릭'));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
