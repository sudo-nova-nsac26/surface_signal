import type { SVGProps } from "react";

/**
 * Small inline icon set. Icons are decorative: they always sit next to a
 * written label, so they are hidden from screen readers.
 */
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1.5em"
      height="1.5em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

type IconProps = SVGProps<SVGSVGElement>;

export const AccessibilityIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="4.5" r="1.75" />
    <path d="M4.5 8.5c2.4.9 4.9 1.3 7.5 1.3s5.100-.4 7.500-1.300" />
    <path d="M12 9.800v5.200" />
    <path d="M12 15l-3.500 6" />
    <path d="M12 15l3.500 6" />
  </Icon>
);

export const WaterIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 8c1.500-1.500 3-1.500 4.500 0s3 1.500 4.500 0 3-1.500 4.500 0 3 1.500 4.500 0" />
    <path d="M3 13c1.500-1.500 3-1.500 4.500 0s3 1.500 4.500 0 3-1.500 4.500 0 3 1.500 4.500 0" />
    <path d="M3 18c1.500-1.500 3-1.500 4.500 0s3 1.500 4.500 0 3-1.500 4.500 0 3 1.500 4.500 0" />
  </Icon>
);

export const PlantIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 21v-9" />
    <path d="M12 12c0-4 2.500-7 7-7 0 4.500-2.500 7-7 7z" />
    <path d="M12 15c0-3-2-5.500-6-5.500 0 3.500 2 5.500 6 5.500z" />
  </Icon>
);

export const HillIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.500 19.500l6.500-11 4 6.500 2.500-3.500 6 8z" />
  </Icon>
);

export const SatelliteIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="9" y="9" width="6" height="6" rx="1" transform="rotate(45 12 12)" />
    <path d="M6.500 6.500l-3 3 3 3 3-3z" />
    <path d="M17.500 11.500l-3 3 3 3 3-3z" transform="translate(0 0)" />
    <path d="M5 17a4 4 0 0 0 4 4" />
  </Icon>
);

export const CompareIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M12 3v18" />
    <path d="M8 10l-2 2 2 2" />
    <path d="M16 10l2 2-2 2" />
  </Icon>
);

export const PaintIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3s6 6.200 6 11a6 6 0 0 1-12 0c0-4.800 6-11 6-11z" />
  </Icon>
);

export const ArrowRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </Icon>
);

export const InfoIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6" />
    <path d="M12 7.500v.010" />
  </Icon>
);

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </Icon>
);

/** Translate symbol, the same one the team site uses for its language button. */
export const LanguagesIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m5 8 6 6" />
    <path d="m4 14 6-6 2-3" />
    <path d="M2 5h12" />
    <path d="M7 2h1" />
    <path d="m22 22-5-10-5 10" />
    <path d="M14 18h6" />
  </Icon>
);
