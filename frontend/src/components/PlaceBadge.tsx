import { TYPE_LINE } from '../config';
import type { PlaceType } from '../lib/types';
import { LineDot } from './Transit';

/** "● FOOD · CHINATOWN": small-caps signage label with the type's line color */
export function TypeTag({ type, children }: { type: PlaceType; children?: React.ReactNode }) {
  return (
    <span className="type-tag">
      <LineDot line={TYPE_LINE[type]} size={9} title={type} />
      <span>{type}</span>
      {children && (
        <>
          <span className="type-tag__sep">·</span>
          <span>{children}</span>
        </>
      )}
    </span>
  );
}
