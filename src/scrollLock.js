let lockCount = 0;
let previousStyles = null;

export function lockPageScroll() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  let released = false;
  const { body, documentElement } = document;

  if (lockCount === 0) {
    const scrollbarWidth = Math.max(0, window.innerWidth - documentElement.clientWidth);
    previousStyles = {
      htmlOverflow: documentElement.style.overflow,
      htmlOverscrollBehavior: documentElement.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyOverscrollBehavior: body.style.overscrollBehavior,
      bodyPaddingRight: body.style.paddingRight,
    };

    documentElement.style.overflow = "hidden";
    documentElement.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
  }

  lockCount += 1;

  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount > 0 || !previousStyles) return;

    documentElement.style.overflow = previousStyles.htmlOverflow;
    documentElement.style.overscrollBehavior = previousStyles.htmlOverscrollBehavior;
    body.style.overflow = previousStyles.bodyOverflow;
    body.style.overscrollBehavior = previousStyles.bodyOverscrollBehavior;
    body.style.paddingRight = previousStyles.bodyPaddingRight;
    previousStyles = null;
  };
}
