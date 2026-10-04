declare module 'troika-three-text' {
  /** Configure before the first text request. */
  export function configureTextBuilder(config: { useWorker: boolean }): void;
}
