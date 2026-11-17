interface VehicleAmountParts {
  prefix: string;
  groups: string[];
  suffix: string;
}

/** Presentation boundaries only: concatenating the parts reproduces the formatter verbatim. */
export const splitVehicleAmount = ({
  formatted,
  locale,
}: {
  formatted: string;
  locale: string;
}): VehicleAmountParts => {
  const characters = Array.from(formatted);
  const digit = /\p{Nd}/u;
  const first = characters.findIndex((character) => digit.test(character));
  if (first === -1) return { prefix: formatted, groups: [], suffix: '' };
  let last = characters.length - 1;
  while (!digit.test(characters[last]!)) last--;
  let separator: string;
  try {
    separator =
      new Intl.NumberFormat(locale).formatToParts(1_234_567.89).find((part) => part.type === 'group')?.value ?? '';
  } catch {
    return { prefix: formatted, groups: [], suffix: '' };
  }
  let prefix = characters.slice(0, first).join('');
  let suffix = characters.slice(last + 1).join('');
  const numeric = characters.slice(first, last + 1).join('');
  const groups = (separator ? numeric.split(separator) : [numeric]).map((part, index) =>
    index ? separator + part : part,
  );
  // Keep sign/bidi/accounting marks with their numeric group, not on an orphan line.
  const affixOnly = /^[\s\u061c\u200e\u200f()+\-\u2212]*$/u;
  if (affixOnly.test(prefix)) {
    groups[0] = prefix + groups[0];
    prefix = '';
  }
  if (affixOnly.test(suffix)) {
    groups[groups.length - 1] += suffix;
    suffix = '';
  }
  return { prefix, groups, suffix };
};
