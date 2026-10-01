import React from 'react';

export const Input = React.forwardRef(({ className = '', type = 'text', ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={`ui-input ${className}`}
      {...props}
    />
  );
});

Input.displayName = 'Input';
