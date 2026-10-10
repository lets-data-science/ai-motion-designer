/** Derive contiguous scenes from durations; seek is clamped and boundaries advance. */
export function sceneAtTime(scenes, seconds) {
  if (!Array.isArray(scenes) || !scenes.length || !Number.isFinite(seconds))
    throw new Error("A finite playhead and at least one scene are required.");
  let start = 0;
  const time = Math.max(0, seconds);
  for (let index = 0; index < scenes.length; index++) {
    const duration = scenes[index].duration;
    if (!Number.isFinite(duration) || duration <= 0)
      throw new Error("Scene durations must be positive.");
    if (time < start + duration || index === scenes.length - 1)
      return { index, start, localTime: Math.min(duration, time - start) };
    start += duration;
  }
}
