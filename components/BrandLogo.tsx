import React from 'react';

/** Transparent vector mark shared with the favicon; works on either theme. */
export function BrandLogo({ size = 34 }: { size?: number }) {
  return <span className="brand-logo-frame" style={{ width: size, height: size }} aria-hidden="true">
    <img src="/brand/favicon.svg" width={size} height={size} alt="" draggable={false} />
  </span>;
}
