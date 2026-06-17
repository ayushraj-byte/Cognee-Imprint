export default function ImprintLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 76 76" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="76" height="76" rx="18" fill="#1a0e07" />
      <rect x="3" y="3" width="70" height="70" rx="16" stroke="#CF8F6D" strokeWidth="1" fill="none" opacity="0.35" />
      <path d="M14 46 Q14 20 38 20 Q62 20 62 46" stroke="#CF8F6D" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.35" />
      <path d="M18 46 Q18 25 38 25 Q58 25 58 46" stroke="#CF8F6D" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.55" />
      <path d="M22 46 Q22 30 38 30 Q54 30 54 46" stroke="#CF8F6D" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.75" />
      <path d="M27 46 Q27 34 38 34 Q49 34 49 46" stroke="#CF8F6D" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.95" />
      <circle cx="38" cy="46" r="4.5" fill="#CF8F6D" />
      <circle cx="38" cy="46" r="2" fill="#1a0e07" />
      <line x1="38" y1="50" x2="24" y2="60" stroke="#CF8F6D" strokeWidth="1.2" opacity="0.45" />
      <line x1="38" y1="50" x2="38" y2="62" stroke="#CF8F6D" strokeWidth="1.2" opacity="0.45" />
      <line x1="38" y1="50" x2="52" y2="60" stroke="#CF8F6D" strokeWidth="1.2" opacity="0.45" />
      <circle cx="24" cy="60" r="2.5" fill="#CF8F6D" opacity="0.55" />
      <circle cx="38" cy="62" r="2.5" fill="#CF8F6D" opacity="0.45" />
      <circle cx="52" cy="60" r="2.5" fill="#CF8F6D" opacity="0.55" />
    </svg>
  );
}
