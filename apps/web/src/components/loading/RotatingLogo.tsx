'use client';

import React from 'react';

interface RotatingLogoProps {
  size?: number;
  clockwise?: boolean;
  baseDuration?: number;
}

export const RotatingLogo: React.FC<RotatingLogoProps> = ({ 
  size = 44, 
  clockwise = true,
  baseDuration = 24 
}) => {
  const direction = clockwise ? 'normal' : 'reverse';

  return (
    <div 
      className="rotating-logo-wrapper" 
      style={{ 
        width: size, 
        height: size, 
        display: 'grid', 
        placeItems: 'center',
        position: 'relative'
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="rotTeal" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#2dd4bf" />
          </linearGradient>

          <linearGradient id="rotIndigo" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>

          <filter id="ambientGlow" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComponentTransfer in="blur" result="dimGlow">
              <feFuncA type="linear" slope="0.45" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode in="dimGlow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <style>{`
          .rot-master-group {
            transform-origin: 50px 50px;
            animation: slowStructuralOrbit ${baseDuration}s linear infinite ${direction};
          }
          .rot-vector-line {
            animation: vectorBreathe 4s ease-in-out infinite;
          }
          .v-delay { animation-delay: 2s; }
          .rot-facet-right {
            animation: facetShimmerRight 6s ease-in-out infinite;
          }
          .rot-facet-left {
            animation: facetShimmerLeft 6s ease-in-out infinite;
          }
          .rot-node {
            animation: nodePulse 3s ease-in-out infinite;
          }
          @keyframes slowStructuralOrbit {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes vectorBreathe {
            0%, 100% { stroke-width: 1.25px; opacity: 0.4; }
            50% { stroke-width: 1.75px; opacity: 0.8; }
          }
          @keyframes facetShimmerRight {
            0%, 100% { fill: rgba(99, 102, 241, 0.04); }
            50% { fill: rgba(99, 102, 241, 0.09); }
          }
          @keyframes facetShimmerLeft {
            0%, 100% { fill: rgba(45, 212, 191, 0.02); }
            50% { fill: rgba(45, 212, 191, 0.06); }
          }
          @keyframes nodePulse {
            0%, 100% { transform: scale(1); transform-origin: 50px 50px; }
            50% { transform: scale(1.05); transform-origin: 50px 50px; }
          }
        `}</style>

        <g className="rot-master-group">
          <line className="rot-vector-line" x1="50" y1="15" x2="50" y2="50" stroke="url(#rotIndigo)" strokeDasharray="2 2" />
          <line className="rot-vector-line v-delay" x1="15" y1="35" x2="50" y2="50" stroke="url(#rotIndigo)" strokeDasharray="2 2" />
          <line className="rot-vector-line" x1="85" y1="35" x2="50" y2="50" stroke="url(#rotIndigo)" strokeDasharray="2 2" />
          <line className="rot-vector-line v-delay" x1="15" y1="75" x2="50" y2="50" stroke="url(#rotIndigo)" strokeDasharray="2 2" />
          <line className="rot-vector-line" x1="85" y1="75" x2="50" y2="50" stroke="url(#rotIndigo)" strokeDasharray="2 2" />
          <line className="rot-vector-line v-delay" x1="50" y1="90" x2="50" y2="50" stroke="url(#rotIndigo)" strokeDasharray="2 2" />

          <polygon points="50,15 85,35 85,75 50,90 15,75 15,35" fill="none" stroke="url(#rotTeal)" strokeWidth="2.5" filter="url(#ambientGlow)" />

          <polygon className="rot-facet-right" points="50,50 85,35 85,75 50,90" stroke="none" />
          <polygon className="rot-facet-left" points="15,35 50,50 50,90 15,75" stroke="none" />

          <g className="rot-node">
            <circle cx="50" cy="15" r="3.5" fill="#f8fafc" stroke="#2dd4bf" strokeWidth="1.5" />
            <circle cx="85" cy="35" r="3.5" fill="#f8fafc" stroke="#2dd4bf" strokeWidth="1.5" />
            <circle cx="85" cy="75" r="3.5" fill="#f8fafc" stroke="#2dd4bf" strokeWidth="1.5" />
            <circle cx="50" cy="90" r="3.5" fill="#f8fafc" stroke="#2dd4bf" strokeWidth="1.5" />
            <circle cx="15" cy="75" r="3.5" fill="#f8fafc" stroke="#2dd4bf" strokeWidth="1.5" />
            <circle cx="15" cy="35" r="3.5" fill="#f8fafc" stroke="#2dd4bf" strokeWidth="1.5" />
          </g>

          <circle cx="50" cy="50" r="5" fill="#ffffff" style={{ filter: 'drop-shadow(0px 0px 6px #2dd4bf)' }} />
        </g>
      </svg>
    </div>
  );
};
