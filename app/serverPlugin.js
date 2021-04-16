/** @returns {import('../src/server/plugin').ServerPlugin} */
export function testPlugin() {
  return {
    name: 'test-plugin',
    renderHtml(ctx, doc) {
      console.log('renderHtml');
    },
  };
}
