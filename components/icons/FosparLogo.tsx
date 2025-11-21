
import React from 'react';

export const FosparLogo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 60" fill="none" {...props}>
        {/* Geometric stylized 'F' construction */}
        
        {/* Main Green shape (Curved left side) */}
        <path d="M 20 60 L 50 60 L 50 35 L 80 35 L 80 10 L 20 10 C 5 10 0 20 0 35 C 0 50 5 60 20 60 Z" fill="#7CC142" stroke="none" />
        
        {/* Yellow Accents - Top Right Blocks */}
        {/* Top block */}
        <path d="M 85 10 L 115 10 L 105 30 L 75 30 Z" fill="#FFDD00" />
        
        {/* Bottom block offset */}
        <path d="M 75 35 L 105 35 L 95 55 L 65 55 Z" fill="#FFDD00" />

        {/* Text */}
        <text x="125" y="45" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="40" fill="#1d1d1b" style={{fontStyle: 'italic', letterSpacing: '-1px'}}>
            FOSPAR
        </text>
    </svg>
);
