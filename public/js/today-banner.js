(function () {
  const el = document.getElementById("today-banner");
  if (!el) return;

  const LUNCH_START_HOUR = 11;

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function formatTime12h(hhmm) {
    const [hour, minute] = hhmm.split(":").map(Number);
    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
  }

  function render({ eyebrowClass, eyebrowText, title, meta, imageUrl, imageAvifUrl, showPulse }) {
    const img = `<img src="${imageUrl}" alt="" loading="lazy" />`;
    const media = imageUrl
      ? imageAvifUrl
        ? `<picture><source srcset="${imageAvifUrl}" type="image/avif">${img}</picture>`
        : img
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
    // Lunch-window and day-of-week logic live server-side in Central
    // Time (GET /api/specials) so this banner is correct no matter what
    // timezone the visitor's browser reports.
    const [specialsRes, eventsRes] = await Promise.all([
      fetch("/api/specials").catch(() => null),
      fetch("/api/events").catch(() => null),
    ]);

    const specialsData =
      specialsRes && specialsRes.ok
        ? await specialsRes.json()
        : { special: null, isLunchWindow: false, today: null };
    const events = eventsRes && eventsRes.ok ? await eventsRes.json() : [];

    const { special: lunchItem, isLunchWindow, today } = specialsData;
    const tonightsEvent = events.find((event) => event.eventDate === today);

    if (isLunchWindow && lunchItem) {
      render({
        eyebrowClass: "is-lunch",
        eyebrowText: "TODAY'S LUNCH SPECIAL",
        title: lunchItem.name,
        meta: `${escapeHtml(lunchItem.description || "")} &middot; $${lunchItem.price.toFixed(2)}`,
        imageUrl: lunchItem.imageUrl,
        showPulse: true,
      });
      return;
    }

    if (tonightsEvent) {
      const timeLabel = tonightsEvent.startTime ? ` · ${formatTime12h(tonightsEvent.startTime)}` : "";
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
      imageUrl: "/assets/png/pool_table.png",
      imageAvifUrl: "/assets/avif/pool_table.avif",
      showPulse: false,
    });
  }

  load();
})();
