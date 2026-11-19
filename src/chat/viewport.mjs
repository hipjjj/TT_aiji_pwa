// Keyboard resizes the visual viewport, while the layout viewport often stays tall on iOS.
export function chatViewport({height,layoutHeight,baselineHeight,focused}) {
  const keyboard=focused&&Math.max(layoutHeight,baselineHeight)-height>120;
  return {keyboard,compact:keyboard||height<520};
}
