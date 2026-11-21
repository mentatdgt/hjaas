// The scenes that exist, in menu order. The first is the one a plain address opens.
// A scene is added by writing its config and listing it here. (Set Design took the place kept for Travel.)
import type { SceneConfig } from '../engine/types';
import { build } from './build';
import { design } from './design';
import { film } from './film';
import { grow } from './grow';
import { set } from './set';

export const SCENES: readonly SceneConfig[] = [build, grow, design, film, set];
