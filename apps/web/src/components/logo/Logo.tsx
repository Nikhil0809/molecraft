'use client';

import React from 'react';

interface LogoProps {
  size?: number;
  interactive?: boolean;
  animated?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 40, interactive = true, animated = false }) => {
  return (
    <div 
      className="logo-container" 
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
          <linearGradient id="primaryTeal" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#2dd4bf" />
          </linearGradient>

          <linearGradient id="indigoPurple" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>

          <filter id="premiumGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComponentTransfer in="blur" result="brightBlur">
              <feFuncA type="linear" slope="0.5" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode in="brightBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <style>{`
          .lattice-structure {
            transform-origin: 50px 50px;
            transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .node-vertex {
            transition: transform 0.4s ease, fill 0.4s ease;
            transform-origin: 50px 50px;
          }
          
          ${interactive ? `
            .logo-container:hover .lattice-structure {
              transform: rotate(60deg);
            }
            .logo-container:hover .node-vertex {
              fill: #2dd4bf;
            }
          ` : ''}
        `}</style>

        <g className="lattice-structure">
          {/* Inner Geometric Lattice Ray Vectors */}
          <line x1="50" y1="15" x2="50" y2="50" stroke="url(#indigoPurple)" strokeWidth="1.5" strokeDasharray="2 2" />
          <line x1="15" y1="35" x2="50" y2="50" stroke="url(#indigoPurple)" strokeWidth="1.5" strokeDasharray="2 2" />
          <line x1="85" y1="35" x2="50" y2="50" stroke="url(#indigoPurple)" strokeWidth="1.5" strokeDasharray="2 2" />
          <line x1="15" y1="75" x2="50" y2="50" stroke="url(#indigoPurple)" strokeWidth="1.5" strokeDasharray="2 2" />
          <line x1="85" y1="75" x2="50" y2="50" stroke="url(#indigoPurple)" strokeWidth="1.5" strokeDasharray="2 2" />
          <line x1="50" y1="90" x2="50" y2="50" stroke="url(#indigoPurple)" strokeWidth="1.5" strokeDasharray="2 2" />

          {/* Outer Structural Perimeter Loop */}
          <polygon points="50,15 85,35 85,75 50,90 15,75 15,35" fill="none" stroke="url(#primaryTeal)" strokeWidth="2.5" filter="url(#premiumGlow)" />

          {/* Transparent Isometric Layer Planes */}
          <polygon points="50,50 85,35 85,75 50,90" fill="rgba(99, 102, 241, 0.06)" stroke="none" />
          <polygon points="15,35 50,50 50,90 15,75" fill="rgba(45, 212, 191, 0.03)" stroke="none" />

          {/* Outer Vertex Nodes */}
          <circle className="node-vertex" cx="50" cy="15" r="3.5" fill="#f8fafc" stroke="#2dd4bf" strokeWidth="1.5" />
          <circle className="node-vertex" cx="85" cy="35" r="3.5" fill="#f8fafc" stroke="#2dd4bf" strokeWidth="1.5" />
          <circle className="node-vertex" cx="85" cy="75" r="3.5" fill="#f8fafc" stroke="#2dd4bf" strokeWidth="1.5" />
          <circle className="node-vertex" cx="50" cy="90" r="3.5" fill="#f8fafc" stroke="#2dd4bf" strokeWidth="1.5" />
          <circle className="node-vertex" cx="15" cy="75" r="3.5" fill="#f8fafc" stroke="#2dd4bf" strokeWidth="1.5" />
          <circle className="node-vertex" cx="15" cy="35" r="3.5" fill="#f8fafc" stroke="#2dd4bf" strokeWidth="1.5" />

          {/* Central Atom Nucleus Anchor */}
          <circle cx="50" cy="50" r="5" fill="#ffffff" style={{ filter: 'drop-shadow(0px 0px 6px #2dd4bf)' }} />
        </g>
      </svg>
    </div>
  );
};
