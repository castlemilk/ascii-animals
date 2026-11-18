import {mountOwl} from '../species/owl/browser.js';
import type {OwlBrowserController,OwlBrowserOptions,OwlActionResult} from '../species/owl/browser.js';
import {getBrowserScheduler} from '../core/scheduler.js';
export {createOwl,resolveOwlOptions,makeOwlPoster,normalizeOwlPointer,OWL_DEFAULTS,OWL_LIMITS,OWL_VERSION} from '../species/owl/owl.js';
export {buildOwlGeometry} from '../species/owl/geometry.js';
export {renderOwlGrid,GLYPHS} from '../species/owl/preview.js';
export {createOwlDirector,resolveOwlDirectorOptions,makeOwlDirectorPoster,OWL_DIRECTOR_DEFAULTS,OWL_DIRECTOR_LIMITS} from '../species/owl/director.js';
export {renderOwlDirectorGrid,targetOwlActor,OWL_SCENE_GLYPHS} from '../species/owl/composition.js';
export type * from '../species/owl/director.js';
export type {OwlDirectorGrid,OwlActorRect} from '../species/owl/composition.js';
export type * from '../species/owl/types.js';
export type {OwlBrowserOptions,OwlBrowserStatus,OwlBrowserSnapshot,OwlBrowserGridOptions,OwlActionResult} from '../species/owl/browser.js';
/** A semantic DOM text artwork; its host is an element, not a canvas. */
export interface OwlArtwork extends OwlBrowserController {
 readonly species:'owl';readonly element:HTMLElement;readonly disposed:boolean;
 play():void;pause():void;restart():void;pulse():OwlActionResult;
}
/** SSR-safe import, explicit fixed-tick response and static reduced-motion alternatives.
 * The default scheduler is shared per owning window; explicitly supplied environment
 * frame functions remain authoritative. Disposal releases only this subscription.
 */
export function createOwlArtwork(element:HTMLElement,options:OwlBrowserOptions={}):OwlArtwork {
 if(!options||typeof options!=='object'||Array.isArray(options))throw new TypeError('Owl options must be an object');
 const view=(options.environment?.document??element?.ownerDocument)?.defaultView;
 if(!view)throw new TypeError('Owl requires an element with an owning browser document');
 const customFrames=options.environment?.requestFrame!==undefined||options.environment?.cancelFrame!==undefined;
 const controller=mountOwl(element,options.frameSource!==undefined||customFrames?options:{...options,frameSource:getBrowserScheduler(view)});
 return Object.freeze({...controller,species:'owl',element,
  get disposed(){return controller.getStatus().disposed;},
  play(){controller.setPaused(false);},pause(){controller.setPaused(true);},restart(){controller.reset();},pulse(){return controller.react();}
 });
}
