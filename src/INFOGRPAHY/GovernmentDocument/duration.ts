import config from "./document.config.json";

export const getGovernmentDocumentDuration = () => {
  const requestedDuration = (config as any).durationInFrames || 0;
  const instructions = (config as any).script?.instructions || [];
  
  let currentFrame = 24;
  let prevToWord = 0;

  for (let i = 0; i < instructions.length; i++) {
    const inst = instructions[i];
    const wordCount = Math.max(1, (inst.toWord - inst.fromWord) + 1);
    const speed = inst.speedMultiplier || 1.0;
    const computedDuration = Math.max(12, Math.round((wordCount * 12) / speed));

    let start = inst.startFrame ?? 0;
    let end = inst.endFrame ?? 0;

    if (start === 0 && end === 0) {
      if (i > 0) {
        const gap = inst.fromWord - prevToWord;
        currentFrame += gap > 20 ? 60 : 15;
      } else {
        currentFrame = Math.max(currentFrame, 24);
      }
      start = currentFrame;
      end = start + computedDuration;
      currentFrame = end;
      prevToWord = inst.toWord;
    } else if (start > 0 && (end === 0 || end <= start)) {
      end = start + computedDuration;
      currentFrame = end;
      prevToWord = inst.toWord;
    } else {
      currentFrame = end;
      prevToWord = inst.toWord;
    }
  }

  const minRequired = currentFrame + 60; // 12-frame post-read hold + 24-frame zoom-out + 24-frame final landscape hold
  if (requestedDuration > 0) {
    return Math.max(requestedDuration, minRequired);
  }
  return minRequired > 60 ? minRequired : 360;
};
