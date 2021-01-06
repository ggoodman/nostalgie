declare global {
  module '*.ico' {
    const value: string;
    export default value;
  }

  module '*.png' {
    const value: string;
    export default value;
  }
}
