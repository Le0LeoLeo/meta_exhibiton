export async function startAfterInitialization({ initialize, startListeners }) {
  await initialize();
  return startListeners();
}
