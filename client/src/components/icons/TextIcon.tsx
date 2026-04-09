interface IconProps {
    className?: string;
}

export default function TextIcon({ className }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M4 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
    );
}
