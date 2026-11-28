const empty = {
  status: 'idle', participants: [], micEnabled: false, cameraEnabled: false, screenShare: { active: false },
};

let sdkTeardown = Promise.resolve();

function checked(result) {
  // Zoom reports some rejected operations as resolved failure objects.
  if (result && typeof result === 'object' && 'type' in result && !(result instanceof Element)) {
    throw new Error('Zoom media operation failed.');
  }
  return result;
}

export function createZoomSession({ onChange }) {
  let current;
  let snapshot = empty;

  function update(changes) {
    snapshot = { ...snapshot, ...changes };
    onChange(snapshot);
  }

  function refresh(session, changes = {}) {
    if (current !== session || !session.stream) return;
    const self = session.client.getCurrentUserInfo();
    const users = session.client.getAllUser();
    const sharingUser = session.sharingUser;
    update({
      ...changes,
      participants: users.map((user) => ({
        id: String(user.userId),
        name: user.displayName,
        cameraEnabled: Boolean(user.bVideoOn),
        isSelf: user.userId === self?.userId,
        muted: !user.audio || Boolean(user.muted) || (user.userId === self?.userId && Boolean(session.speakerOnly)),
      })),
      micEnabled: Boolean(self?.audio && !self.muted && !session.speakerOnly),
      cameraEnabled: Boolean(self?.bVideoOn),
      screenShare: sharingUser ? { active: true, participantId: String(sharingUser) } : { active: false },
    });
  }

  async function dispose(session) {
    const { sdk, client, listeners } = session;
    if (!client) return;
    for (const [event, listener] of listeners) client.off(event, listener);
    try {
      if (client.getSessionInfo()?.isInMeeting) await client.leave();
    } finally {
      clearSharePreview(session);
      for (const { wrapper } of session.videos.values()) wrapper?.remove();
      sdk.destroyClient();
    }
  }

  function disconnect(changes = {}) {
    const session = current;
    if (!session) return sdkTeardown;
    current = undefined;
    snapshot = empty;
    sdkTeardown = session.connecting.catch(() => {}).then(() => dispose(session));
    update({ status: 'disconnected', ...changes });
    return sdkTeardown;
  }

  function listen(session) {
    const watchRoster = () => refresh(session);
    const watchConnection = ({ state, reason }) => {
      if (!session.stream || current !== session) return;
      if (state === 'Reconnecting') update({ status: 'reconnecting' });
      if (state === 'Connected') refresh(session, { status: 'connected' });
      if (state === 'Closed' || state === 'Fail') {
        const ended = reason === 'ended by host';
        disconnect({ ended, error: state === 'Fail' ? 'Video bağlantısı kəsildi.' : undefined }).catch(() => {});
      }
    };
    const watchSharing = ({ state, userId }) => {
      if (state === 'Active') session.sharingUser = userId;
      else if (session.sharingUser === userId) session.sharingUser = undefined;
      refresh(session);
    };
    const watchSharingStopped = () => {
      clearSharePreview(session);
      session.sharingUser = session.stream.getActiveShareUserId() || undefined;
      refresh(session);
    };
    session.listeners = [
      ['user-added', watchRoster], ['user-updated', watchRoster], ['user-removed', watchRoster],
      ['peer-video-state-change', watchRoster], ['connection-change', watchConnection],
      ['active-share-change', watchSharing], ['passively-stop-share', watchSharingStopped],
    ];
    for (const [event, listener] of session.listeners) session.client.on(event, listener);
  }

  async function setMicEnabled(enabled) {
    const session = current;
    if (!session?.stream) return;
    const { client, stream, settings } = session;
    if (enabled && session.speakerOnly) {
      checked(await stream.stopAudio());
      session.speakerOnly = false;
    }
    if (enabled && !client.getCurrentUserInfo()?.audio) {
      checked(await stream.startAudio({ microphoneId: settings.microphoneId || undefined }));
    } else if (enabled) {
      checked(await stream.unmuteAudio());
    } else if (client.getCurrentUserInfo()?.audio) {
      checked(await stream.muteAudio());
    }
    refresh(session);
  }

  async function setCameraEnabled(enabled) {
    const session = current;
    if (!session?.stream) return;
    const { stream, settings } = session;
    if (enabled && !stream.isCapturingVideo()) {
      checked(await stream.startVideo({ cameraId: settings.cameraId || undefined }));
    } else if (!enabled && stream.isCapturingVideo()) {
      checked(await stream.stopVideo());
    }
    refresh(session);
  }

  function connect(credentials, settings = {}) {
    if (current) return current.connecting;
    const session = { settings, listeners: [], videos: new Map(), shareQueue: Promise.resolve() };
    current = session;
    snapshot = empty;
    session.connecting = (async () => {
      await sdkTeardown.catch(() => {});
      const { default: sdk, VideoQuality } = await import('@zoom/videosdk');
      if (current !== session) return;
      session.sdk = sdk;
      session.videoQuality = VideoQuality.Video_360P;
      session.client = sdk.createClient();
      checked(await session.client.init('en-US', 'Global', {
        leaveOnPageUnload: true,
        enforceMultipleVideos: { disableRenderLimits: true },
      }));
      if (current !== session) return;
      listen(session);
      checked(await session.client.join(credentials.roomKey, credentials.token, credentials.displayName, credentials.passcode));
      if (current !== session) return;
      session.stream = session.client.getMediaStream();
      session.sharingUser = session.stream.getActiveShareUserId() || undefined;
      const media = await Promise.allSettled([
        session.stream.startAudio({
          mute: !settings.micEnabled, microphoneId: settings.microphoneId || undefined,
        }).then(checked),
        settings.cameraEnabled ? setCameraEnabled(true) : undefined,
      ]);
      if (media[0].status === 'rejected' && current === session) {
        try {
          checked(await session.stream.startAudio({ speakerOnly: true }));
          session.speakerOnly = true;
        } catch {
          // Let the user stay in the room and retry audio after checking permissions.
        }
      }
      const denied = media.some((result) => result.status === 'rejected');
      refresh(session, {
        status: 'connected',
        error: denied ? 'Kamera və ya mikrofonu açmaq mümkün olmadı.' : undefined,
      });
    })().catch((error) => {
      if (current === session) {
        disconnect({ status: 'error', error: 'Video otağına qoşulmaq mümkün olmadı.' }).catch(() => {});
      }
      throw error;
    });
    update({ status: 'connecting' });
    return session.connecting;
  }

  async function attachVideo(participantId, container) {
    const session = current;
    if (!session?.stream || !container) return;
    const id = Number(participantId);
    const entry = { id };
    session.videos.set(container, entry);
    try {
      const player = checked(await session.stream.attachVideo(id, session.videoQuality));
      if (current === session && session.videos.get(container) === entry) {
        const wrapper = document.createElement('video-player-container');
        const size = { display: 'block', width: '100%', height: '100%' };
        Object.assign(wrapper.style, size);
        Object.assign(player.style, size);
        entry.player = player;
        entry.wrapper = wrapper;
        wrapper.append(player);
        container.append(wrapper);
      } else if (current === session) {
        await session.stream.detachVideo(id, player);
      }
    } catch (error) {
      if (session.videos.get(container) === entry) session.videos.delete(container);
      entry.wrapper?.remove();
      throw error;
    }
  }

  async function detachVideo(participantId, container) {
    const session = current;
    const entry = session?.videos.get(container);
    if (!entry || entry.id !== Number(participantId)) return;
    session.videos.delete(container);
    if (entry.player) {
      entry.wrapper.remove();
      await session.stream.detachVideo(entry.id, entry.player);
    }
  }

  function clearSharePreview(session) {
    session.shareCanvas?.remove();
    if (session.hiddenShareVideo) session.hiddenShareVideo.style.removeProperty('display');
    session.shareCanvas = undefined;
    session.hiddenShareVideo = undefined;
  }

  async function startScreenShare(target) {
    const session = current;
    if (!session?.stream || !target) return;
    let preview = target;
    if (!session.stream.isStartShareScreenWithVideoElement() && target.tagName === 'VIDEO') {
      session.shareCanvas = document.createElement('canvas');
      target.after(session.shareCanvas);
      session.hiddenShareVideo = target;
      target.style.display = 'none';
      preview = session.shareCanvas;
    }
    try {
      checked(await session.stream.startShareScreen(preview));
      session.sharingUser = session.client.getCurrentUserInfo()?.userId;
      refresh(session);
    } catch (error) {
      clearSharePreview(session);
      throw error;
    }
  }

  async function stopScreenShare() {
    const session = current;
    if (!session?.stream) return;
    checked(await session.stream.stopShareScreen());
    clearSharePreview(session);
    session.sharingUser = session.stream.getActiveShareUserId() || undefined;
    refresh(session);
  }

  function attachScreenShare(participantId, canvas) {
    const session = current;
    if (!session?.stream || !canvas) return Promise.resolve();
    session.shareQueue = session.shareQueue.catch(() => {}).then(async () => {
      if (current !== session) return;
      checked(await session.stream.startShareView(canvas, Number(participantId)));
      session.remoteShareCanvas = canvas;
    });
    return session.shareQueue;
  }

  function detachScreenShare(canvas) {
    const session = current;
    if (!session?.stream) return Promise.resolve();
    session.shareQueue = session.shareQueue.catch(() => {}).then(async () => {
      if (current !== session || !session.remoteShareCanvas || session.remoteShareCanvas !== canvas) return;
      checked(await session.stream.stopShareView());
      session.remoteShareCanvas = undefined;
    });
    return session.shareQueue;
  }

  return {
    connect, disconnect, setMicEnabled, setCameraEnabled, attachVideo, detachVideo,
    startScreenShare, stopScreenShare, attachScreenShare, detachScreenShare,
  };
}
