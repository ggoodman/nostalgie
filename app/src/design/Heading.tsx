import { styled } from 'nostalgie/twind';

export const Heading = styled('h1', {
  variants: {
    size: {
      xl: 'text-4xl sm:text-6xl lg:text-7xl leading-none font-extrabold tracking-tight text-gray-900 mt-10 mb-8 sm:mt-14 sm:mb-10',
      lg: 'text-3xl sm:text-5xl lg:text-6xl leading-none font-extrabold tracking-tight text-gray-900 mb-8',
    },
  },
  defaults: {
    size: 'lg',
  },
});
