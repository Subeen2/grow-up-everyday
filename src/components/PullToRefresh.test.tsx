import { render, screen, fireEvent } from '@testing-library/react';
import { PullToRefresh } from './PullToRefresh';

describe('PullToRefresh', () => {
  it('shows a pull indicator while dragging down from the top', () => {
    render(
      <PullToRefresh onRefresh={() => {}}>
        <p>content</p>
      </PullToRefresh>
    );

    const wrapper = screen.getByText('content').parentElement!;
    fireEvent.touchStart(wrapper, { touches: [{ clientY: 0 }] });
    fireEvent.touchMove(wrapper, { touches: [{ clientY: 40 }] });

    expect(screen.getByText('⬇️ 당겨서 새로고침')).toBeInTheDocument();
  });

  it('switches the indicator label once pulled past the threshold', () => {
    render(
      <PullToRefresh onRefresh={() => {}} threshold={50}>
        <p>content</p>
      </PullToRefresh>
    );

    const wrapper = screen.getByText('content').parentElement!;
    fireEvent.touchStart(wrapper, { touches: [{ clientY: 0 }] });
    fireEvent.touchMove(wrapper, { touches: [{ clientY: 80 }] });

    expect(screen.getByText('⬆️ 놓으면 새로고침')).toBeInTheDocument();
  });

  it('calls onRefresh when pulled past the threshold and released', () => {
    const onRefresh = vi.fn();
    render(
      <PullToRefresh onRefresh={onRefresh} threshold={50}>
        <p>content</p>
      </PullToRefresh>
    );

    const wrapper = screen.getByText('content').parentElement!;
    fireEvent.touchStart(wrapper, { touches: [{ clientY: 0 }] });
    fireEvent.touchMove(wrapper, { touches: [{ clientY: 80 }] });
    fireEvent.touchEnd(wrapper);

    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('does not call onRefresh when released before reaching the threshold', () => {
    const onRefresh = vi.fn();
    render(
      <PullToRefresh onRefresh={onRefresh} threshold={50}>
        <p>content</p>
      </PullToRefresh>
    );

    const wrapper = screen.getByText('content').parentElement!;
    fireEvent.touchStart(wrapper, { touches: [{ clientY: 0 }] });
    fireEvent.touchMove(wrapper, { touches: [{ clientY: 20 }] });
    fireEvent.touchEnd(wrapper);

    expect(onRefresh).not.toHaveBeenCalled();
    expect(screen.queryByText('⬇️ 당겨서 새로고침')).not.toBeInTheDocument();
  });

  it('does not track the pull when the touch starts inside a text input, so cursor placement still works', () => {
    const onRefresh = vi.fn();
    render(
      <PullToRefresh onRefresh={onRefresh}>
        <input type="text" defaultValue="hello world" />
      </PullToRefresh>
    );

    const input = screen.getByRole('textbox');
    fireEvent.touchStart(input, { touches: [{ clientY: 0 }] });
    fireEvent.touchMove(input, { touches: [{ clientY: 40 }] });

    expect(screen.queryByText('⬇️ 당겨서 새로고침')).not.toBeInTheDocument();
    expect(screen.queryByText('⬆️ 놓으면 새로고침')).not.toBeInTheDocument();

    fireEvent.touchEnd(input);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('does not track the pull when the touch does not start at the top of the page', () => {
    Object.defineProperty(window, 'scrollY', { value: 100, configurable: true });

    render(
      <PullToRefresh onRefresh={() => {}}>
        <p>content</p>
      </PullToRefresh>
    );

    const wrapper = screen.getByText('content').parentElement!;
    fireEvent.touchStart(wrapper, { touches: [{ clientY: 0 }] });
    fireEvent.touchMove(wrapper, { touches: [{ clientY: 80 }] });

    expect(screen.queryByText('⬇️ 당겨서 새로고침')).not.toBeInTheDocument();

    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });
});
