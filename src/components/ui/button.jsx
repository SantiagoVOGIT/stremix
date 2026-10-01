import React from 'react';

export const Button = React.forwardRef(({ 
  as: Component = 'button',
  className = '', 
  variant = 'default', 
  size = 'default', 
  children, 
  disabled = false,
  type,
  ...props 
}, ref) => {
  const baseClass = 'ui-btn';
  const variantClass = `ui-btn-${variant}`;
  const sizeClass = `ui-btn-${size}`;

  const isButton = Component === 'button';

  return (
    <Component
      ref={ref}
      className={`${baseClass} ${variantClass} ${sizeClass} ${className}`}
      disabled={isButton ? disabled : undefined}
      aria-disabled={!isButton && disabled ? true : undefined}
      type={isButton ? (type || 'button') : undefined}
      {...props}
    >
      {children}
    </Component>
  );
});

Button.displayName = 'Button';
