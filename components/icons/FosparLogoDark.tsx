import React from 'react';

export const FosparLogoDark: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60" fill="none" {...props}>
        {/* Main Shape - White */}
        <path d="M 20 60 L 50 60 L 50 35 L 80 35 L 80 10 L 20 10 C 5 10 0 20 0 35 C 0 50 5 60 20 60 Z" fill="#FFFFFF" />
        
        {/* Blocks - White */}
        <path d="M 85 10 L 115 10 L 105 30 L 75 30 Z" fill="#FFFFFF" />
        <path d="M 75 35 L 105 35 L 95 55 L 65 55 Z" fill="#FFFFFF" />

        {/* Text FOSPAR - White */}
        <text x="125" y="45" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="42" fill="#FFFFFF" style={{fontStyle: 'italic', letterSpacing: '-2px'}}>
            FOSPAR
        </text>
        <text x="225" y="25" fontFamily="Arial, sans-serif" fontWeight="400" fontSize="10" fill="#FFFFFF">
            TM
        </text>
    </svg>
);