import React from 'react';

interface ModalProps {
    onClose: () => void;
    children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ onClose, children }) => {
    return (
        <div 
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
            onClick={onClose}
        >
            <div 
                className="bg-gray-800 rounded-lg shadow-2xl"
                onClick={e => e.stopPropagation()} // Prevent click from bubbling to backdrop
            >
                {children}
            </div>
        </div>
    );
};