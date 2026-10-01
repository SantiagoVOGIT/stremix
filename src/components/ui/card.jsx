import React from 'react';

export const Card = ({ className = '', children, ...props }) => (
  <div className={`ui-card ${className}`} {...props}>
    {children}
  </div>
);

export const CardHeader = ({ className = '', children, ...props }) => (
  <div className={`ui-card-header ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ className = '', children, ...props }) => (
  <h3 className={`ui-card-title ${className}`} {...props}>
    {children}
  </h3>
);

export const CardDescription = ({ className = '', children, ...props }) => (
  <p className={`ui-card-description ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent = ({ className = '', children, ...props }) => (
  <div className={`ui-card-content ${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ className = '', children, ...props }) => (
  <div className={`ui-card-footer ${className}`} {...props}>
    {children}
  </div>
);
