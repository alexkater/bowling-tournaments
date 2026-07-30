export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 180 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <g transform="translate(2, 2)">
        <ellipse cx="16" cy="17" rx="10" ry="12" fill="#1a1a2e" />
        <circle cx="16" cy="9" r="4.5" fill="#e63946" />
        <line x1="16" y1="2" x2="16" y2="6.5" stroke="#e63946" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="14" y="27" width="4" height="5" rx="1.5" fill="#1a1a2e" />
      </g>
      <line x1="34" y1="26" x2="48" y2="14" stroke="#e63946" strokeWidth="2.5" strokeLinecap="round" />
      <text x="54" y="28" fontFamily="Inter, system-ui, sans-serif" fontWeight="800" fontSize="20" fill="#1a1a2e" letterSpacing="-0.5">STRIKE</text>
      <text x="128" y="28" fontFamily="Inter, system-ui, sans-serif" fontWeight="600" fontSize="20" fill="#64748b" letterSpacing="-0.5">MANAGER</text>
    </svg>
  )
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 34 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <ellipse cx="17" cy="17" rx="11" ry="13" fill="#1a1a2e" />
      <circle cx="17" cy="9" r="5" fill="#e63946" />
      <line x1="17" y1="1" x2="17" y2="6.5" stroke="#e63946" strokeWidth="3" strokeLinecap="round" />
      <rect x="14.5" y="28" width="5" height="6" rx="2" fill="#1a1a2e" />
      <line x1="30" y1="26" x2="8" y2="10" stroke="#e63946" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
