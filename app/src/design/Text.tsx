import { styled } from 'nostalgie/twind';

export const Text = styled('p', {
  variants: {
    size: {
      xl: 'text-gray-500 max-w-screen-lg text-lg sm:text-2xl sm:leading-10 font-medium mb-10',
    },
  },
  defaults: {
    size: 'xl',
  },
});
