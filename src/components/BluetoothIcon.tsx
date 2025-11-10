import React from 'react';
import Svg, { Circle, G, Line, Polygon, Polyline, Defs, LinearGradient, Stop } from 'react-native-svg';
import { TouchableOpacity, StyleSheet } from 'react-native';

interface BluetoothIconProps {
  isActive: boolean;
  size?: number;
  onPress?: () => void;
}

const BluetoothIcon: React.FC<BluetoothIconProps> = ({ 
  isActive, 
  size = 48, 
  onPress 
}) => {
  const IconComponent = (
    <Svg 
      width={size} 
      height={size} 
      viewBox="0 0 48 48" 
      fill="none"
    >
      {isActive ? (
        <>
          {/* Active state with gradient */}
          <Defs>
            <LinearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#42A5F5" stopOpacity="1" />
              <Stop offset="100%" stopColor="#1E88E5" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          
          {/* Outer glow */}
          <Circle cx="24" cy="24" r="23" fill="#2196F3" opacity="0.2"/>
          
          {/* Main circle with gradient */}
          <Circle cx="24" cy="24" r="20" fill="url(#blueGradient)"/>
          
          {/* Bluetooth symbol */}
          <G transform="translate(24, 24)">
            {/* Center vertical line */}
            <Line x1="0" y1="-10" x2="0" y2="10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            
            {/* Upper triangle */}
            <Polygon points="0,-10 6,-5 0,0" fill="white"/>
            <Polyline points="0,-10 6,-5 0,0" stroke="white" strokeWidth="1.5" strokeLinejoin="miter" fill="none"/>
            
            {/* Lower triangle */}
            <Polygon points="0,0 6,5 0,10" fill="white"/>
            <Polyline points="0,0 6,5 0,10" stroke="white" strokeWidth="1.5" strokeLinejoin="miter" fill="none"/>
            
            {/* Left crossing lines */}
            <Line x1="-5" y1="-5" x2="0" y2="0" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <Line x1="-5" y1="5" x2="0" y2="0" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </G>
        </>
      ) : (
        <>
          {/* Inactive state */}
          <Circle cx="24" cy="24" r="23" fill="#BDBDBD" opacity="0.2"/>
          
          {/* Main circle */}
          <Circle cx="24" cy="24" r="20" fill="#9E9E9E"/>
          
          {/* Bluetooth symbol */}
          <G transform="translate(24, 24)">
            {/* Center vertical line */}
            <Line x1="0" y1="-10" x2="0" y2="10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            
            {/* Upper triangle */}
            <Polygon points="0,-10 6,-5 0,0" fill="white"/>
            <Polyline points="0,-10 6,-5 0,0" stroke="white" strokeWidth="1.5" strokeLinejoin="miter" fill="none"/>
            
            {/* Lower triangle */}
            <Polygon points="0,0 6,5 0,10" fill="white"/>
            <Polyline points="0,0 6,5 0,10" stroke="white" strokeWidth="1.5" strokeLinejoin="miter" fill="none"/>
            
            {/* Left crossing lines */}
            <Line x1="-5" y1="-5" x2="0" y2="0" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <Line x1="-5" y1="5" x2="0" y2="0" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </G>
        </>
      )}
    </Svg>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {IconComponent}
      </TouchableOpacity>
    );
  }

  return IconComponent;
};

export default BluetoothIcon;