import { coverFor } from '../engine/covers';
import { assetUrl } from '../engine/load';
import type { ReactNode } from 'react';

export function TitleCover({ selected, children }: { selected: string; children: ReactNode }) {
  const cover = coverFor(selected);
  return (
    <div className={`title-cover title-cover--${cover.id}`}>
      <picture>
        <source media="(max-width: 767px)" srcSet={assetUrl(cover.mobile)} />
        <img
          data-testid="title-cover"
          src={assetUrl(cover.desktop)}
          width={1920}
          height={1080}
          alt={cover.alt}
          fetchPriority="high"
        />
      </picture>
      <div className="title-cover-copy">
        <h1>母獅帝國</h1>
        <p className="latin-title">LIONESS EMPIRE</p>
      </div>
      {children}
    </div>
  );
}
