import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders the app title', () => {
    render(<App />);
    expect(screen.getByText('매일 영단어 앱')).toBeInTheDocument();
  });
});
