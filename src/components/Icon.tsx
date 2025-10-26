// src/components/Icon.tsx
import React from 'react';
import { Text } from 'react-native';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  color = '#fff',
}) => {
  const icons: Record<string, string> = {
    menu: '☰',
    bluetooth: '⚡',
    activity: '📊',
    wind: '💨',
    user: '👤',
    info: 'ℹ️',
    shield: '🛡️',
    bell: '🔔',
    logout: '🚪',
    x: '✕',
    edit: '✎',
    radio: '📡',
    alert: '⚠️',
  };

  return (
    <Text style={{ fontSize: size * 0.7, color }}>{icons[name] || '•'}</Text>
  );
};