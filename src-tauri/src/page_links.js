// T4 Notes: runs inside every HTML page opened in a tab (the asset frame).
// A page can't leave its frame: a website would be refused by the frame's
// rules and leave an error where the page was. So its links are handed to
// the app instead: websites, mail and phone links to the default browser,
// files on this machine to a new tab. Jumps within the page stay here.
(() => {
  if (window.top === window || location.hostname !== "asset.localhost") return;
  const send = (href) => window.parent.postMessage({ t4Link: href }, "*");
  const handOff = (raw) => {
    let url;
    try {
      url = new URL(raw, location.href);
    } catch {
      return false;
    }
    if (url.host === "asset.localhost") {
      // The same page with a new #place is the page's own business.
      if (url.pathname === location.pathname && url.search === location.search) return false;
      send(url.href);
      return true;
    }
    if (/^(https?|mailto|tel):$/.test(url.protocol)) {
      send(url.href);
      return true;
    }
    return false;
  };
  // Bubbling on the window, so a page's own handler runs first and can claim the click.
  window.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    const a = e.target instanceof Element && e.target.closest("a[href]");
    if (a && handOff(a.href)) e.preventDefault();
  });
  window.addEventListener("auxclick", (e) => {
    if (e.defaultPrevented || e.button !== 1) return;
    const a = e.target instanceof Element && e.target.closest("a[href]");
    if (a && handOff(a.href)) e.preventDefault();
  });
  const open = window.open;
  window.open = function (u, ...rest) {
    if (u != null && handOff(String(u))) return null;
    return open.call(window, u, ...rest);
  };
})();
