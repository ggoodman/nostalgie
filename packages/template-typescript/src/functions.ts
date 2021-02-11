import type { ServerFunctionContext } from 'nostalgie/functions';

const typesOfPain = [
  'Friction',
  'Tooling Fatigue',
  'Webpack Configs (long-live Webpack)',
  'Low-value Work',
  'Prop Drilling',
  'State Management',
];

/**
 * Get the type of pain developers are facing with existing tools.
 *
 * @param _ctx Request-specific context that includes auth information and more
 */
export async function getPainPoint(_ctx: ServerFunctionContext) {
  const idx = Math.floor(Math.random() * typesOfPain.length);

  // Note the shape of the return value here and compare that to where
  // we *use* the result of the hook call in the front-end! 🤯
  return {
    idx,
    painType: typesOfPain[idx],
  };
}
