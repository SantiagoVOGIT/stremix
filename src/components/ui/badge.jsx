import React from 'react';

export const Badge = ({ 
  className = '', 
  variant = 'default', 
  children, 
  ...props 
}) => {
  const baseClass = 'ui-badge';
  const variantClass = `ui-badge-${variant}`;

  return (
    <span className={`${baseClass} ${variantClass} ${className}`} {...props}>
      {children}
    </span>
  );
};
