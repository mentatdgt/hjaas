import { mountSite } from './engine/site';
import { SCENES } from './scenes';

// The page is only a host. The site is self-contained and can be mounted on any route.
const host = document.getElementById('site');
if (host) mountSite(host, { scenes: SCENES, homeHref: './' });
