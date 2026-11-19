export default function HoofIcon({kind}:{kind:'cow'|'sheep'}) {
  const cow=kind==='cow';
  return <svg className={`brand-hoof brand-hoof-${kind}`} viewBox="0 0 48 56" role="img" aria-label={cow?'牛蹄剪影':'羊蹄剪影'} focusable="false" fill="currentColor">
    {cow?<>
      <path d="M21 9C12 5 5 16 5 30c0 11 5 18 14 18 3 0 4-2 4-5V15c0-3 0-5-2-6ZM27 9c9-4 16 7 16 21 0 11-5 18-14 18-3 0-4-2-4-5V15c0-3 0-5 2-6Z"/>
      <ellipse cx="12" cy="52" rx="4" ry="3"/><ellipse cx="36" cy="52" rx="4" ry="3"/>
    </>:<>
      <path d="M21 4C16 6 8 20 9 33c0 10 4 15 10 16 3 0 4-3 4-7V10c0-5-1-7-2-6ZM27 4c5 2 13 16 12 29 0 10-4 15-10 16-3 0-4-3-4-7V10c0-5 1-7 2-6Z"/>
      <path d="M12 50c-3 0-4 4-2 5 2 2 5-1 5-3l-3-2ZM36 50c3 0 4 4 2 5-2 2-5-1-5-3l3-2Z"/>
    </>}
  </svg>;
}
