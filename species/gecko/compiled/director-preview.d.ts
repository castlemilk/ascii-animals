import type { GeckoDirectorState, GeckoIndividualId } from './director.js';
import type { GeckoGrid } from './types.js';
export interface GeckoDirectorPreviewOptions {
    readonly cols?: number;
    readonly rows?: number;
    readonly neutral?: boolean;
    /** null is the full wall; a stable member ID gives a close view. */
    readonly focus?: GeckoIndividualId | null;
}
export declare function renderGeckoDirectorGrid(state: GeckoDirectorState, options?: GeckoDirectorPreviewOptions): GeckoGrid;
