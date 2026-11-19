import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/spectral/latin-400.css';
import './scene.css';
import { PLATE, loadLoopFrames, loadRoom, setAssetBase } from './assets';
import { Caption } from './caption';
import { shower } from './finale';
import { flags } from './flags';
import { ContactForm } from './form';
import { playIntro, type IntroMode } from './intro';
import { Logo } from './logo';
import { onReducedMotionChange, reducedMotion } from './motion';
import { Hunt, SPOTS } from './mushrooms';
import { Pan } from './pan';
import { RachelPlayer } from './player';
import { Rachel } from './rachel';
import { loadReaction, type Reaction } from './reaction';
import { gentleSchedule, hammerSchedule, seeded, type Step } from './schedule';
import { loadProgress, saveProgress } from './state';

export interface Scene1Options {
  /** Folder holding the scene's assets. Defaults to `<site base>/assets/scene1/`. */
  assetBase?: string;
  /** Where the logo links to. Without it the logo is not a link. */
  homeHref?: string;
}

export interface Scene1 {
  destroy(): void;
}

const TOTAL = SPOTS.length;
const HINT_AFTER_S = 60;

// TODO(copy): every word on the page is a placeholder until the real copy arrives. They are all here,
// except the form's (form.ts) and the count itself, "3 of 10 found" (caption.ts).
const COPY = {
  name: 'Hui Jie',
  tagline: 'TODO(copy): what Hui Jie does, in one line',
  picture: 'Hui Jie at work. Ten mushrooms are hidden in the room.',
  prompt: `Find the ${TOTAL} hidden mushrooms`,
  prize: `Find all ${TOTAL} to reach Hui Jie`,
  done: `You found all ${TOTAL}`,
};

/**
 * Mounts scene 1 (the contracting scene) into `host`: a paper page with the room as one framed picture.
 * Everything the scene needs lives under `.hj-scene`: markup, styles, state and assets. It takes its
 * width from the host element and is as tall as its content, so the host page scrolls if it has to.
 */
export function mountScene1(host: HTMLElement, options: Scene1Options = {}): Scene1 {
  if (options.assetBase) setAssetBase(options.assetBase);

  const root = document.createElement('div');
  root.className = 'hj-scene is-pre';
  root.innerHTML = `
    <div class="hj-page">
      <header class="hj-masthead">
        <div class="hj-logo-slot"></div>
        <div class="hj-ident">
          <h1 class="hj-name">${COPY.name}</h1>
          <p class="hj-tagline">${COPY.tagline}</p>
        </div>
      </header>
      <figure class="hj-frame" role="group" aria-label="${COPY.picture}">
        <div class="hj-window">
          <div class="hj-viewport">
            <div class="hj-plate">
              <img class="hj-room" alt="" draggable="false" width="${PLATE.w}" height="${PLATE.h}" />
            </div>
          </div>
        </div>
      </figure>
      <div class="hj-caption">
        <div class="hj-controls"></div>
      </div>
    </div>
    <div class="hj-fly" aria-hidden="true"></div>
  `;
  host.append(root);

  const q = <T extends HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
  const page = q<HTMLDivElement>('.hj-page');
  const viewport = q<HTMLDivElement>('.hj-viewport');
  const plate = q<HTMLDivElement>('.hj-plate');
  const room = q<HTMLImageElement>('.hj-room');
  const logoSlot = q<HTMLDivElement>('.hj-logo-slot');
  const captionRow = q<HTMLDivElement>('.hj-caption');
  const flyLayer = q<HTMLDivElement>('.hj-fly');

  let destroyed = false;
  let rachel: Rachel | undefined;
  let player: RachelPlayer | undefined;
  let reaction: Reaction | undefined;
  const cleanup: Array<() => void> = [];
  let debug: Record<string, unknown> | undefined;

  const progress = loadProgress();
  const found = new Set(progress.found.filter((id) => SPOTS.some((spot) => spot.id === id)));
  if (flags.found !== undefined) {
    found.clear();
    for (const spot of SPOTS.slice(0, Math.max(0, Math.min(TOTAL, flags.found)))) found.add(spot.id);
  }
  const save = (): void => {
    if (flags.found !== undefined) return; // a QA preset is never written back
    saveProgress({ ...progress, found: [...found] });
  };

  // QA: with ?debug, every frame that arrives late is logged (start time and length, in ms).
  const jank: Array<[number, number]> = [];
  const longTasks: Array<[number, number]> = [];
  if (flags.debug) {
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) longTasks.push([Math.round(entry.startTime), Math.round(entry.duration)]);
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      // Long-task timing is Chromium-only; the frame log below still works everywhere.
    }
    let last = performance.now();
    const watch = (now: number): void => {
      if (now - last > 25) jank.push([Math.round(last), Math.round(now - last)]);
      last = now;
      if (!destroyed) requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  }

  const rnd = flags.seed === undefined ? Math.random : seeded(flags.seed);
  const rhythm = (): Iterator<Step> => (reducedMotion() ? gentleSchedule(rnd) : hammerSchedule(rnd));

  const caption = new Caption(TOTAL, found.size);
  captionRow.prepend(caption.el);
  // A returning visitor who already found them all goes straight to the button.
  if (found.size === TOTAL) caption.unlock(false, COPY.done);
  // A new visitor is told what to look for; one who has started, what the hunt is for.
  else caption.say(found.size === 0 ? COPY.prompt : COPY.prize);

  const pan = new Pan(viewport, plate, progress.panned, () => {
    progress.panned = true;
    save();
  });
  cleanup.push(() => pan.destroy());

  const layout = new ResizeObserver(() => {
    // One plate pixel in CSS pixels. Only changes on resize, never during animation.
    plate.style.setProperty('--u', `${plate.clientWidth / PLATE.w}px`);
    rachel?.resize();
    pan.layout();
  });
  layout.observe(plate);
  layout.observe(viewport);

  // The hint: after a minute with no find, one unfound mushroom wiggles once, and only once per visit.
  // Time only counts while the tab is visible.
  let quietSeconds = 0;
  let hunt: Hunt | undefined;
  const hintAfter = flags.hintSeconds ?? HINT_AFTER_S;
  let settled = false; // the intro has finished
  const hintClock = window.setInterval(() => {
    if (document.hidden || !settled || !hunt || hunt.remaining === 0) return;
    quietSeconds++;
    if (quietSeconds >= hintAfter) {
      window.clearInterval(hintClock);
      hunt.hint();
    }
  }, 1000);
  cleanup.push(() => window.clearInterval(hintClock));

  let reacting: Promise<void> = Promise.resolve();
  const react = (): Promise<void> => {
    if (!player || !reaction) return Promise.resolve();
    if (player.reacting) return reacting; // already reacting: the find counts, the reaction carries on
    reacting = player.react(reducedMotion() ? reaction.still : reaction.steps);
    return reacting;
  };

  const form = new ContactForm(root, caption.action);
  // A click with detail 0 came from the keyboard: keyboard actions open at once, with no entrance.
  caption.action.addEventListener('click', (event) => form.open(event.detail === 0));

  // 10/10: one last reaction, a short shower of mushrooms, and the caption becomes the way to reach Hui Jie.
  const celebrate = (): void => {
    progress.unlocked = true;
    save();
    const calm = reducedMotion();
    if (!calm) window.setTimeout(() => shower(flyLayer, viewport.getBoundingClientRect()), 160);
    window.setTimeout(
      () => {
        caption.unlock(true, COPY.done);
        // Keyboard and screen-reader users land on the prize.
        window.setTimeout(() => caption.action.focus({ preventScroll: true }), calm ? 0 : 600);
      },
      calm ? 400 : 1250,
    );
  };

  void (async () => {
    const [roomImage, frames, logo] = await Promise.all([loadRoom(), loadLoopFrames(), Logo.create(options.homeHref)]);
    if (destroyed) return;
    room.src = roomImage.src;
    await room.decode().catch(() => {});
    rachel = new Rachel(frames);
    const theRachel = rachel;

    hunt = await Hunt.create({
      plate,
      flyLayer,
      found,
      target: () => caption.targetRect(),
      onFind: (spot) => {
        quietSeconds = 0;
        found.add(spot.id);
        save();
        const busy = player?.reacting ?? false;
        const done = react();
        // The last find always gets its own reaction, even if she was still busy with the one before.
        if (found.size === TOTAL && busy) void done.then(() => react());
      },
      onLand: () => {
        const first = caption.current === 0;
        const next = Math.min(TOTAL, caption.current + 1);
        caption.land(next, first && next < TOTAL ? COPY.prize : '');
        // The prompt has done its job: from the first find on, the caption says what the hunt is for.
        if (next < TOTAL) caption.say(COPY.prize);
        else celebrate();
      },
    });
    if (destroyed) return;

    plate.append(rachel.shadow, hunt.el, rachel.el);
    // The logo keeps its own proportions; the page reserves exactly that space for it.
    page.style.setProperty('--logo-ratio', logo.el.style.aspectRatio);
    logoSlot.append(logo.el);
    rachel.resize();
    logo.prepare();
    logo.startIdle();
    cleanup.push(() => logo.stop());

    player = new RachelPlayer(rachel, rhythm());
    const thePlayer = player;
    cleanup.push(onReducedMotionChange(() => thePlayer.setLoop(rhythm())));

    // Nothing runs while the tab is hidden; she picks up on the same pose when it comes back.
    let working = false;
    const onVisibility = (): void => {
      if (!working) return;
      if (document.hidden) thePlayer.stop();
      else thePlayer.start();
    };
    document.addEventListener('visibilitychange', onVisibility);
    cleanup.push(() => document.removeEventListener('visibilitychange', onVisibility));

    if (flags.debug) {
      const poses: Array<[string, number]> = [];
      player.onPose = (pose, at) => poses.push([pose, Math.round(at)]);
      debug = { player, rachel, poses, hunt, caption, logo, jank, longTasks, marks: { introStart: 0, introEnd: 0 }, ready: false };
      (window as unknown as { __hj: unknown }).__hj = debug;
    }

    const introMode: IntroMode =
      flags.intro === 'off'
        ? 'off'
        : reducedMotion()
          ? 'reduced'
          : (flags.intro ?? (progress.seenIntro ? 'quick' : 'full'));

    // While nothing is on screen yet: lay the contact sheet out once (with its real font), so that
    // opening it later never costs a frame of Rachel's hammering.
    await document.fonts?.ready;
    form.prepare();
    // Let the setup above reach the screen before any motion starts.
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    if (destroyed) return;
    if (debug) (debug.marks as Record<string, number>).introStart = Math.round(performance.now());
    await playIntro(introMode, {
      root,
      plate,
      room,
      roomPixels: roomImage.pixels,
      rachel: theRachel.el,
      shadow: theRachel.shadow,
      mushrooms: hunt.el,
      caption: caption.el,
      seed: flags.seed,
      onRachel: () => {
        working = true;
        if (!document.hidden) thePlayer.start();
      },
    });
    if (destroyed) return;
    if (debug) (debug.marks as Record<string, number>).introEnd = Math.round(performance.now());
    settled = true;
    pan.showHint(captionRow);
    if (!progress.seenIntro) {
      progress.seenIntro = true;
      save();
    }

    // The reaction frames are not needed for the first seconds, so they load once the intro is over
    // and nothing else is competing for the frame.
    // (A visitor who has already found everything never sees a reaction, so nothing is fetched for them.)
    if (hunt.remaining > 0) {
      try {
        reaction = await loadReaction(theRachel);
      } catch (error) {
        console.warn('[hjaas] reaction frames unavailable; finds still count', error);
      }
    }
    if (debug) debug.ready = true;
  })();

  return {
    destroy() {
      destroyed = true;
      player?.stop();
      cleanup.forEach((fn) => fn());
      layout.disconnect();
      root.remove();
    },
  };
}
