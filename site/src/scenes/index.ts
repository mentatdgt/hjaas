// The scenes that exist, in menu order. The first is the one a plain address opens.
import type { SceneConfig } from '../engine/types';
import { build } from './build';

export const SCENES: readonly SceneConfig[] = [build];
