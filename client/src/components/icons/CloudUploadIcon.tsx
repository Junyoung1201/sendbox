interface IconProps {
    className?: string;
}

export default function CloudUploadIcon({ className }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4c-2.5 0-4.79 1.12-6.29 3.04C3.45 7.69 1.77 9.83 2.01 12.49c.23 2.47 2.16 4.47 4.63 4.8.32.04.63-.17.7-.48.07-.32-.17-.63-.48-.7-1.93-.26-3.45-1.82-3.63-3.75-.18-2.07 1.19-3.82 3.26-4.38C7.2 6.28 9.53 5 12 5c3.04 0 5.5 2.24 5.94 5.15.04.28.27.47.54.47h.69c1.93 0 3.5 1.57 3.5 3.5s-1.57 3.5-3.5 3.5H16c-.28 0-.5.22-.5.5s.22.5.5.5h3.17c2.48 0 4.5-2.02 4.5-4.5 0-2.34-1.79-4.27-4.07-4.48z" fill="currentColor"/>
            <path d="M13 19h-2v-4H9l3-4 3 4h-2z" fill="currentColor"/>
        </svg>
    );
}
