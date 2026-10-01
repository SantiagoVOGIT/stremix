import React, { createContext, useContext, useState } from 'react';

const TabsContext = createContext({
  value: '',
  onValueChange: () => {}
});

export const Tabs = ({ value, onValueChange, defaultValue, className = '', children, ...props }) => {
  const [internalValue, setInternalValue] = useState(defaultValue || '');
  const activeValue = value !== undefined ? value : internalValue;
  const setActiveValue = onValueChange || setInternalValue;

  return (
    <TabsContext.Provider value={{ value: activeValue, onValueChange: setActiveValue }}>
      <div className={`ui-tabs ${className}`} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

export const TabsList = ({ className = '', children, ...props }) => (
  <div className={`ui-tabs-list ${className}`} {...props}>
    {children}
  </div>
);

export const TabsTrigger = ({ value, className = '', children, disabled = false, ...props }) => {
  const { value: activeValue, onValueChange } = useContext(TabsContext);
  const isActive = activeValue === value;

  return (
    <button
      type="button"
      className={`ui-tabs-trigger ${isActive ? 'active' : ''} ${className}`}
      disabled={disabled}
      onClick={() => onValueChange(value)}
      {...props}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({ value, className = '', children, ...props }) => {
  const { value: activeValue } = useContext(TabsContext);
  if (activeValue !== value) return null;

  return (
    <div className={`ui-tabs-content ${className}`} {...props}>
      {children}
    </div>
  );
};
