import { mountScene1 } from './scene1';

// The page is only a host. Scene 1 is self-contained and can be mounted on any route.
const host = document.getElementById('scene-1');
if (host) mountScene1(host);
