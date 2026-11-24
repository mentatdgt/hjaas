// Shared by the early image preload and the scene router. Keep the rooms in step with src/scenes/.
(() => {
  const rooms = Object.freeze({ build: 'scene1', grow: 'scene2', design: 'scene3', film: 'scene4', set: 'scene5' });

  window.hjaasRoom = (fragment) => {
    let id;
    try {
      id = decodeURIComponent(fragment.replace(/^#/, ''));
    } catch {
      id = 'build';
    }
    if (!Object.hasOwn(rooms, id)) id = 'build';
    return { id, folder: rooms[id] };
  };

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.type = 'image/webp';
  link.setAttribute('fetchpriority', 'high');
  link.href = './assets/' + window.hjaasRoom(window.location.hash).folder + '/room.webp';
  document.head.appendChild(link);
})();
