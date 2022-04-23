import { styled } from 'nostalgie/twind';

const round = (num: number) =>
  num
    .toFixed(7)
    .replace(/(\.[0-9]+?)0+$/, '$1')
    .replace(/\.0$/, '');
const rem = (px: number) => `${round(px / 16)}rem`;
const em = (px: number, base: number) => `${round(px / base)}em`;

export const H1 = styled('h1', {
  base: {
    fontSize: em(36, 16),
    marginTop: '0',
    marginBottom: em(32, 36),
    lineHeight: round(40 / 36),
    '&': 'text-gray-900 font-extrabold',
  },
});

export const H2 = styled('h2', {
  base: {
    fontSize: em(24, 16),
    marginTop: em(48, 24),
    marginBottom: em(24, 24),
    lineHeight: round(32 / 24),
    '& + *': {
      marginTop: '0',
    },
    '&': 'text-gray-900 font-bold',
  },
});

export const H3 = styled('h3', {
  base: {
    fontSize: em(20, 16),
    marginTop: em(32, 20),
    marginBottom: em(12, 20),
    lineHeight: round(32 / 20),
    '& + *': {
      marginTop: '0',
    },
    '&': 'text-gray-900 font-semibold',
  },
});

export const H4 = styled('h4', {
  base: {
    marginTop: em(24, 16),
    marginBottom: em(8, 16),
    lineHeight: round(24 / 16),
    '& + *': {
      marginTop: '0',
    },
    '&': 'text-gray-900 font-semibold',
  },
});
