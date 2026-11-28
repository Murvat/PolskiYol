import { useEffect, useRef } from 'react';
import { Camera, CameraOff, Mic, MicOff, MonitorUp } from 'lucide-react';

export const emptyMedia = {
  status: 'idle',
  participants: [],
  micEnabled: false,
  cameraEnabled: false,
  screenShare: { active: false },
};

const providers = {
  zoom: () => import('./providers/zoom.js').then(({ createZoomSession }) => createZoomSession),
};

export async function openMediaSession(provider, onChange) {
  if (!Object.hasOwn(providers, provider)) throw new Error('Video xidməti hazırda əlçatan deyil.');
  const createSession = await providers[provider]();
  return createSession({ onChange });
}

function ParticipantTile({ participant, controller }) {
  const target = useRef(null);
  const { id, name, cameraEnabled, muted, isSelf } = participant;

  useEffect(() => {
    if (!cameraEnabled || !controller || !target.current) return undefined;
    const container = target.current;
    void controller.attachVideo(id, container).catch(() => {});
    return () => {
      void controller.detachVideo(id, container).catch(() => {});
    };
  }, [cameraEnabled, controller, id]);

  return (
    <div className="live-tile">
      <div ref={target} className="live-tile-video" />
      {!cameraEnabled && <CameraOff className="live-tile-empty" size={32} aria-label="Kamera bağlıdır" />}
      <div className="live-tile-caption">
        <span>{name}{isSelf ? ' (siz)' : ''}</span>
        {muted && <MicOff size={16} aria-label="Mikrofon bağlıdır" />}
      </div>
    </div>
  );
}

export function ClassroomMedia({ media, controller, onError }) {
  const localShare = useRef(null);
  const remoteShare = useRef(null);
  const pending = useRef(false);
  const isSharing = Boolean(media.screenShare?.active);
  const sharerId = media.screenShare?.participantId;
  const self = media.participants.find(person => person.isSelf);
  const isLocalShare = isSharing && self?.id === sharerId;
  const showRemote = isSharing && Boolean(sharerId) && !isLocalShare;
  const CameraIcon = media.cameraEnabled ? Camera : CameraOff;
  const MicIcon = media.micEnabled ? Mic : MicOff;

  useEffect(() => {
    if (!showRemote || !controller || !remoteShare.current) return undefined;
    const canvas = remoteShare.current;
    void controller.attachScreenShare(sharerId, canvas).catch(() => {});
    return () => {
      void controller.detachScreenShare(canvas).catch(() => {});
    };
  }, [controller, sharerId, showRemote]);

  async function control(action) {
    if (!controller || pending.current) return;
    pending.current = true;
    onError('');
    try {
      await action(controller);
    } catch {
      onError('Media əməliyyatı mümkün olmadı. Cihazı və icazələri yoxlayın.');
    } finally {
      pending.current = false;
    }
  }

  return (
    <>
      <div className="live-share" hidden={!isSharing}>
        <video ref={localShare} muted playsInline hidden={!isLocalShare} aria-label="Paylaşdığınız ekran" />
        <canvas ref={remoteShare} hidden={!showRemote} aria-label="Paylaşılan ekran" />
      </div>
      <div className="live-grid" aria-label="Dərs iştirakçıları">
        {media.participants.map(participant => <ParticipantTile key={participant.id} participant={participant} controller={controller} />)}
      </div>
      <div className="live-actions">
        <button type="button" className="btn secondary" disabled={!controller} aria-pressed={media.micEnabled} onClick={() => control(session => session.setMicEnabled(!media.micEnabled))}>
          <MicIcon size={18} /> Mikrofon
        </button>
        <button type="button" className="btn secondary" disabled={!controller} aria-pressed={media.cameraEnabled} onClick={() => control(session => session.setCameraEnabled(!media.cameraEnabled))}>
          <CameraIcon size={18} /> Kamera
        </button>
        {navigator.mediaDevices?.getDisplayMedia && (
          <button type="button" className="btn secondary" disabled={!controller || (isSharing && !isLocalShare)} aria-pressed={isLocalShare} onClick={() => control(session => isLocalShare ? session.stopScreenShare() : session.startScreenShare(localShare.current))}>
            <MonitorUp size={18} /> {isLocalShare ? 'Paylaşımı dayandır' : 'Ekranı paylaş'}
          </button>
        )}
      </div>
    </>
  );
}
