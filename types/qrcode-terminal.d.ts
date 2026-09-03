declare module 'qrcode-terminal' {
  interface Options {
    small?: boolean;
  }
  export function generate(input: string, options?: Options, callback?: (qrcode: string) => void): void;
  export function generate(input: string, callback?: (qrcode: string) => void): void;
}
