import { stylesheets } from './engine/paper';
import { mountSite } from './engine/site';
import { SCENES } from './scenes';

// The page is only a host. The site is self-contained and can be mounted on any route.
const host = document.getElementById('site');
// (WebKit runs this script before a stylesheet that is still on its way: see paper.ts.)
if (host) void stylesheets().then(() => mountSite(host, { scenes: SCENES, homeHref: './' }));
