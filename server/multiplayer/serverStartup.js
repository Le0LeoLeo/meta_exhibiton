export async function startServersAtomically({
  startMultiplayer,
  startHttp,
}) {
  if (typeof startMultiplayer !== 'function' || typeof startHttp !== 'function') {
    throw new TypeError('startMultiplayer and startHttp must be functions');
  }

  let multiplayerServer = null;
  try {
    multiplayerServer = startMultiplayer();
    await multiplayerServer.ready;
    const httpServer = await startHttp();
    return { multiplayerServer, httpServer };
  } catch (error) {
    if (multiplayerServer?.close) {
      await multiplayerServer.close();
    }
    throw error;
  }
}
