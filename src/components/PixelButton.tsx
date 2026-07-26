import { ButtonHTMLAttributes, ReactNode } from 'react';

interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function PixelButton({ children, className, ...rest }: PixelButtonProps) {
  return (
    <button className={['pixel-button', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </button>
  );
}
