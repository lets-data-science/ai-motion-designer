/** Escape text for HTML, then derive absolute times without trusting model offsets. */
export function escapeText(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
}
export function sequenceScenes(scenes) {
  let cursor = 0;
  return scenes.map((scene, index) => {
    if (
      !Number.isFinite(scene.duration) ||
      scene.duration < 2 ||
      scene.duration > 12
    )
      throw new Error("Each scene must last 2–12 seconds.");
    const timed = {
      ...scene,
      index,
      start: cursor,
      end: cursor + scene.duration,
    };
    cursor = timed.end;
    return timed;
  });
}
