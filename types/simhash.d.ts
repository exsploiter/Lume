declare module 'simhash' {
  type Hasher = (tokens: string[]) => number[];
  function simhash(algorithm?: string): Hasher;
  export default simhash;
}
