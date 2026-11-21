import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

if (!process.env.FOX_EMBER_BUILD_ROOT) throw new Error('Run this suite with: node species/fox/variants/ember/tests/run.mjs');
const privateModule = name => import(pathToFileURL(resolve(process.env.FOX_EMBER_BUILD_ROOT, `${name}.js`)));
export const emberModel = await privateModule('model');
export const emberDirector = await privateModule('director');
export const emberPreview = await privateModule('preview');
export const emberScene = await privateModule('director-render');
export const ember = await privateModule('index');
export const original = await import('../../../../../lib/public/fox.js');
export const originalModel = await import('../../../lib/model.js');
export const originalDirector = await import('../../../lib/director.js');
export const originalPreview = await import('../../../lib/preview.js');
export const originalScene = await import('../../../lib/director-render.js');
