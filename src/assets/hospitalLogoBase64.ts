const HOSPITAL_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10B981" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F59E0B" />
      <stop offset="100%" stop-color="#D97706" />
    </linearGradient>
  </defs>

  <!-- Outer Ring -->
  <circle cx="100" cy="100" r="96" fill="url(#emeraldGrad)" />
  <circle cx="100" cy="100" r="84" fill="#FFFFFF" stroke="#047857" stroke-width="2.5" />
  
  <!-- Inner Circle -->
  <circle cx="100" cy="100" r="56" fill="url(#emeraldGrad)" />

  <!-- Medical Cross Background -->
  <path d="M 88,68 L 112,68 L 112,88 L 132,88 L 132,112 L 112,112 L 112,132 L 88,132 L 88,112 L 68,112 L 68,88 L 88,88 Z" fill="#FFFFFF" opacity="0.25" />

  <!-- Rod of Asclepius -->
  <rect x="97" y="58" width="6" height="84" rx="3" fill="url(#goldGrad)" />
  <circle cx="100" cy="58" r="7" fill="url(#goldGrad)" />

  <!-- Snake Winding Around Rod -->
  <path d="M 94,130 C 112,122 112,110 100,102 C 88,94 88,82 106,74 C 108,72 106,66 100,66 C 94,66 94,70 96,72" 
        fill="none" stroke="url(#goldGrad)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="97" cy="67" r="3" fill="#F59E0B" />

  <!-- Text Arc Path Top (โรงพยาบาลสังขะ) -->
  <path id="textArcTop" d="M 28,100 A 72,72 0 1,1 172,100" fill="none" />
  <text font-family="'Prompt', 'Kanit', 'Sarabun', sans-serif" font-size="14.5" font-weight="800" fill="#047857">
    <textPath href="#textArcTop" startOffset="50%" text-anchor="middle">
      โรงพยาบาลสังขะ
    </textPath>
  </text>

  <!-- Text Arc Path Bottom (SANGKHA HOSPITAL) -->
  <path id="textArcBottom" d="M 172,100 A 72,72 0 0,1 28,100" fill="none" />
  <text font-family="'Prompt', 'Montserrat', sans-serif" font-size="10.5" font-weight="700" fill="#047857" letter-spacing="1">
    <textPath href="#textArcBottom" startOffset="50%" text-anchor="middle">
      SANGKHA HOSPITAL
    </textPath>
  </text>

  <!-- Side Stars -->
  <polygon points="32,100 34,95 38,95 35,92 36,87 32,90 28,87 29,92 26,95 30,95" fill="#F59E0B" />
  <polygon points="168,100 170,95 174,95 171,92 172,87 168,90 164,87 165,92 162,95 166,95" fill="#F59E0B" />
</svg>`;

export const DEFAULT_HOSPITAL_LOGO_BASE64 = `data:image/svg+xml;utf8,${encodeURIComponent(HOSPITAL_LOGO_SVG)}`;
