
import React from 'react';

export const LogoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path className="text-primary-600 dark:text-primary-400" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        <path className="text-primary-500 dark:text-primary-300 opacity-70" d="M12 22v-5" />
        <path className="text-primary-500 dark:text-primary-300 opacity-70" d="M12 12L2 7" />
        <path className="text-primary-500 dark:text-primary-300 opacity-70" d="M12 12l10-5" />
    </svg>
);
