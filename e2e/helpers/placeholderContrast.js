import { expect } from '@playwright/test';

const MINIMUM_TEXT_CONTRAST = 4.5;

function parseCssColor(value) {
  const match = value.match(/^rgba?\((.+)\)$/i);
  if (!match) throw new Error(`Unsupported computed CSS color: ${value}`);

  const components = match[1].split(/[\s,\/]+/).filter(Boolean);
  const channel = (component) => component.endsWith('%')
    ? Number.parseFloat(component) * 2.55
    : Number.parseFloat(component);
  const alpha = components[3]?.endsWith('%')
    ? Number.parseFloat(components[3]) / 100
    : Number.parseFloat(components[3] ?? '1');

  return {
    red: channel(components[0]),
    green: channel(components[1]),
    blue: channel(components[2]),
    alpha,
  };
}

function composite(foreground, background, opacity = 1) {
  const alpha = foreground.alpha * opacity;
  return {
    red: foreground.red * alpha + background.red * (1 - alpha),
    green: foreground.green * alpha + background.green * (1 - alpha),
    blue: foreground.blue * alpha + background.blue * (1 - alpha),
    alpha: 1,
  };
}

function relativeLuminance({ red, green, blue }) {
  const linearize = (channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
}

function contrastRatio(first, second) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export async function expectPlaceholderContrast(field, label) {
  const appearance = await field.evaluate((element) => {
    const fieldStyle = getComputedStyle(element);
    const placeholderStyle = getComputedStyle(element, '::placeholder');
    return {
      placeholderColor: placeholderStyle.color,
      placeholderOpacity: Number(placeholderStyle.opacity),
      backgroundColor: fieldStyle.backgroundColor,
      backgroundImage: fieldStyle.backgroundImage,
    };
  });

  const placeholder = parseCssColor(appearance.placeholderColor);
  const opacity = Number.isFinite(appearance.placeholderOpacity) ? appearance.placeholderOpacity : 1;
  const imageColors = appearance.backgroundImage === 'none'
    ? []
    : [...appearance.backgroundImage.matchAll(/rgba?\([^)]*\)/gi)].map(([color]) => color);
  const backgroundColors = imageColors.length > 0
    ? imageColors.map(parseCssColor)
    : [parseCssColor(appearance.backgroundColor)];
  const opaqueCanvas = { red: 255, green: 255, blue: 255, alpha: 1 };
  const measurements = backgroundColors.map((background) => {
    const opaqueBackground = background.alpha < 1 ? composite(background, opaqueCanvas) : background;
    const renderedPlaceholder = composite(placeholder, opaqueBackground, opacity);
    return {
      background: opaqueBackground,
      contrast: contrastRatio(renderedPlaceholder, opaqueBackground),
    };
  });
  const worstContrast = Math.min(...measurements.map(({ contrast }) => contrast));

  expect(
    worstContrast,
    `${label} placeholder should meet ${MINIMUM_TEXT_CONTRAST}:1 contrast at every computed background color; got ${worstContrast.toFixed(2)}:1 from ${JSON.stringify({ appearance, measurements })}`,
  ).toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
}
