import React from 'react';

export const CurveIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v17a1 1 0 001 1h17" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 18c4 0 6.5-2 8.5-7s4.5-7 8.5-7" />
    </svg>
);
