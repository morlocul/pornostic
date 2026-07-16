'use client';

// 365Scores logo CDN. The d_Competitors:default1.png fallback param makes the
// CDN itself serve a default image for unknown ids, so onError is a last resort.
const logoUrl = (compId: number) =>
  `https://imagecache.365scores.com/image/upload/f_png,w_68,h_68,c_limit,q_auto:eco,dpr_2,d_Competitors:default1.png/v3/Competitors/${compId}`;

export default function TeamLogo({ compId, name }: { compId: number | null; name: string }) {
  if (compId == null) return null;
  return (
    <img
      className="team-logo"
      src={logoUrl(compId)}
      alt=""
      title={name}
      loading="lazy"
      width={22}
      height={22}
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
}
