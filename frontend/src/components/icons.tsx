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

/** Two people: the team. */
export const TeamIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="9" cy="8" r="3.25" />
    <path d="M3 20c0-3.300 2.700-6 6-6s6 2.700 6 6" />
    <path d="M16 5.200a3 3 0 0 1 0 5.600" />
    <path d="M18 14.300c1.800.800 3 2.700 3 5.700" />
  </Icon>
);

/** Arrow leaving a box: the link opens another site. */
export const ExternalIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M14 4h6v6" />
    <path d="M20 4l-9 9" />
    <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Icon>
);

/** Loudspeaker: read aloud. */
export const SpeakerIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    <path d="M15.5 9a4 4 0 0 1 0 6" />
    <path d="M18 6.500a7.500 7.500 0 0 1 0 11" />
  </Icon>
);

/** Square: stop. */
export const StopIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </Icon>
);

/** Telephone handset. */
export const PhoneIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 3.500h3.500l1.800 4.500-2.300 1.400a11 11 0 0 0 6.600 6.600l1.400-2.300 4.500 1.800V19a1.500 1.500 0 0 1-1.500 1.500A16.500 16.500 0 0 1 3.500 5 1.500 1.500 0 0 1 5 3.500z" />
  </Icon>
);

/** Speech bubble: a message. */
export const MessageIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 5h16v11H9l-5 4z" />
    <path d="M8 9.500h8M8 12.500h5" />
  </Icon>
);

/** Two chain links: a web link. */
export const LinkIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1" />
  </Icon>
);

/** Folded map: places and outlines. */
export const MapIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 6.500l6-2.500 6 2.500 6-2.500v13.500l-6 2.500-6-2.500-6 2.500z" />
    <path d="M9 4v13.500M15 6.500V20" />
  </Icon>
);

/** Down chevron: opens a question. */
export const ChevronDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);
