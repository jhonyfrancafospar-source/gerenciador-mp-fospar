
import React from 'react';
import { XMarkIcon } from './icons/XMarkIcon';

interface ImageViewerModalProps {
    src: string;
    onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ src, onClose }) => {
    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center p-4"
            onClick={onClose}
        >
            <div
                className="relative max-w-[90vw] max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <img src={src} alt="Visualização ampliada" className="w-auto h-auto max-w-full max-h-full object-contain rounded-lg" />
                <button
                    onClick={onClose}
                    className="absolute -top-4 -right-4 bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-full p-2 shadow-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                    aria-label="Fechar visualizador de imagem"
                >
                    <XMarkIcon className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
};
