// The scenes that exist, in menu order. The first is the one a plain address opens.
// Later: Film, Design, Travel. A scene is added by writing its config and listing it here.
import type { SceneConfig } from '../engine/types';
import { build } from './build';
import { grow } from './grow';

export const SCENES: readonly SceneConfig[] = [build, grow];
