(function () {
  const el = document.getElementById("today-banner");
  if (!el) return;

  const LUNCH_START_HOUR = 11;
  const LUNCH_END_HOUR = 14; // 2pm

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function render({ eyebrowClass, eyebrowText, title, meta, imageUrl, showPulse }) {
    const media = imageUrl
      ? `<img src="${imageUrl}" alt="" loading="lazy" />`
      : "";

    el.innerHTML = `
      ${media ? `<div class="today-banner-media">${media}</div>` : ""}
      <div class="today-banner-body">
        <p class="today-banner-eyebrow ${eyebrowClass}">
          ${showPulse ? `<span class="pulse-dot" aria-hidden="true"></span>` : ""}
          ${eyebrowText}
        </p>
        <p class="today-banner-title">${escapeHtml(title)}</p>
        ${meta ? `<p class="today-banner-meta">${meta}</p>` : ""}
      </div>
    `;
  }

  async function load() {
    const now = new Date();
    const dow = now.getDay();
    const hour = now.getHours() + now.getMinutes() / 60;
    const today = todayISO();

    const [menuRes, eventsRes] = await Promise.all([
      fetch("/api/menu").catch(() => null),
      fetch("/api/events").catch(() => null),
    ]);

    const menu = menuRes && menuRes.ok ? await menuRes.json() : [];
    const events = eventsRes && eventsRes.ok ? await eventsRes.json() : [];

    const isLunchWindow = hour >= LUNCH_START_HOUR && hour < LUNCH_END_HOUR;
    const lunchItem = menu
      .flatMap((category) => category.items)
      .find((item) => item.dayOfWeek === dow && item.isAvailable);
    const tonightsEvent = events.find((event) => event.eventDate === today);

    if (isLunchWindow && lunchItem) {
      render({
        eyebrowClass: "is-lunch",
        eyebrowText: "TODAY'S LUNCH SPECIAL",
        title: lunchItem.name,
        meta: `${escapeHtml(lunchItem.description || "")} &middot; $${lunchItem.price.toFixed(2)}`,
        imageUrl: lunchItem.imageUrl,
        showPulse: false,
      });
      return;
    }

    if (tonightsEvent) {
      const timeLabel = tonightsEvent.startTime ? ` · ${tonightsEvent.startTime}` : "";
      const coverLabel = tonightsEvent.coverCharge > 0 ? `$${tonightsEvent.coverCharge.toFixed(2)} cover` : "No cover";
      render({
        eyebrowClass: "is-live",
        eyebrowText: "LIVE TONIGHT",
        title: `${tonightsEvent.title}${timeLabel}`,
        meta: coverLabel,
        imageUrl: tonightsEvent.imageUrl,
        showPulse: true,
      });
      return;
    }

    if (lunchItem) {
      // Not lunchtime yet, but there is a special today — tease it.
      render({
        eyebrowClass: "is-lunch",
        eyebrowText: "TODAY'S LUNCH SPECIAL",
        title: `${lunchItem.name} · from ${LUNCH_START_HOUR}am`,
        meta: `$${lunchItem.price.toFixed(2)}`,
        imageUrl: lunchItem.imageUrl,
        showPulse: false,
      });
      return;
    }

    render({
      eyebrowClass: "is-quiet",
      eyebrowText: "NO EVENT TONIGHT",
      title: "No schedule, no cover, just good times",
      meta: "Pool, darts, and the jukebox are always on.",
      imageUrl: "/assets/no-event-night.jpg",
      showPulse: false,
    });
  }

  load();
})();
