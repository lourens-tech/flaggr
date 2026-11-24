import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { duration, easing, prefersReducedMotion } from '../../theme/motion';

type Props = Omit<TextProps, 'children'> & {
  // A number, or an already-formatted string such as "8 285", "R250" or
  // "1,386 FC". For strings, the first whole number inside is animated and
  // the surrounding text is kept as-is.
  value: number | string;
  style?: StyleProp<TextStyle>;
  duration?: number;
  // Also animate strings with one or two decimals ("32.4 pts"). Off by
  // default so admin stat cards keep showing money amounts as-is.
  allowDecimals?: boolean;
};

interface Parsed {
  prefix: string;
  suffix: string;
  target: number;
  // Digits after the decimal point (0 for whole numbers).
  decimals: number;
  // Thousands separator used by the original string ('' = none, null = use
  // the device locale, for plain numbers).
  separator: string | null;
}

// Only plain whole numbers animate — decimals, ranges or anything we can't
// round-trip exactly are shown as-is.
function parse(value: number | string, allowDecimals = false): Parsed | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && Number.isInteger(value) ? { prefix: '', suffix: '', target: value, decimals: 0, separator: null } : null;
  }
  const match = /\d[\d\s,  ]*\d|\d/.exec(value);
  if (!match) return null;
  const run = match[0];
  let rest = value.slice(match.index + run.length);
  const whole = parseInt(run.replace(/\D/g, ''), 10);
  if (!Number.isFinite(whole)) return null;
  let decimals = 0;
  let target = whole;
  const frac = allowDecimals ? /^\.(\d{1,2})(?!\d)/.exec(rest) : null;
  if (frac) {
    decimals = frac[1].length;
    target = Number(`${whole}.${frac[1]}`);
    rest = rest.slice(frac[0].length);
  } else if (/^[.]\d/.test(rest)) {
    return null;
  }
  return { prefix: value.slice(0, match.index), suffix: rest, target, decimals, separator: /\D/.exec(run)?.[0] ?? '' };
}

function group(n: number, separator: string) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

function format(p: Parsed, n: number, original: number | string) {
  const factor = 10 ** p.decimals;
  const rounded = Math.round(n * factor) / factor;
  if (rounded === p.target) return typeof original === 'number' ? original.toLocaleString() : original;
  const whole = Math.floor(rounded);
  const digits = p.separator === null ? whole.toLocaleString() : group(whole, p.separator);
  const fraction = p.decimals ? `.${rounded.toFixed(p.decimals).split('.')[1]}` : '';
  return `${p.prefix}${digits}${fraction}${p.suffix}`;
}

// Number that rolls up to its value on first show, and from the old value to
// the new one when it changes (e.g. the Flagrr Cash balance after a scan).
export function CountUpText({ value, style, duration: ms = duration.count, allowDecimals = false, ...rest }: Props) {
  const parsed = parse(value, allowDecimals);
  const animated = useRef(new Animated.Value(0)).current;
  const lastTarget = useRef<number | null>(null);
  const [display, setDisplay] = useState<string>(() =>
    parsed && !prefersReducedMotion() ? format(parsed, 0, value) : String(typeof value === 'number' ? value.toLocaleString() : value),
  );

  const target = parsed?.target ?? null;

  useEffect(() => {
    if (!parsed || target === null) {
      setDisplay(typeof value === 'number' ? value.toLocaleString() : value);
      return;
    }
    if (prefersReducedMotion() || target === lastTarget.current) {
      lastTarget.current = target;
      setDisplay(format(parsed, target, value));
      return;
    }
    const from = lastTarget.current ?? 0;
    lastTarget.current = target;
    animated.setValue(from);
    const id = animated.addListener(({ value: v }) => setDisplay(format(parsed, v, value)));
    const anim = Animated.timing(animated, {
      toValue: target,
      duration: ms,
      easing: easing.out,
      // Drives a text value through a JS listener, so the native driver can't
      // be used here.
      useNativeDriver: false,
    });
    anim.start(() => setDisplay(format(parsed, target, value)));
    return () => {
      anim.stop();
      animated.removeListener(id);
    };
    // `parsed` is derived from `value`; re-run only when the value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, target, ms, animated]);

  return (
    <Text style={[style, { fontVariant: ['tabular-nums'] }]} {...rest}>
      {display}
    </Text>
  );
}
