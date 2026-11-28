import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, CameraOff, Mic, MicOff, Video } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { joinLiveLesson, portalError, useChangeLiveLessonMutation, useLiveLessonQuery } from '../store.js';
import { ClassroomMedia, emptyMedia, openMediaSession } from './ClassroomMedia.jsx';
import './live-room.css';

const stateMessages = {
  unavailable: 'Canlı dərs otağı hazırda əlçatan deyil.',
  scheduled: 'Dərs vaxtında bu otaqdan qoşula bilərsiniz.',
  waiting: 'Müəllimin dərsi başlamasını gözləyin.',
  starting: 'Müəllim dərs otağını açır…',
  live: 'Canlı dərs davam edir.',
  ending: 'Canlı dərs bağlanır…',
  ended: 'Canlı dərs bitdi.',
  cancelled: 'Bu dərs ləğv edilib.',
};

const closedStates = new Set(['cancelled', 'ended', 'ending', 'unavailable']);

function useDevicePreview(cameraId, enabled) {
  const video = useRef(null);
  const preview = useRef(null);
  const [failure, setFailure] = useState(false);
  const [devices, setDevices] = useState([]);
  const stopPreview = useCallback(() => {
    preview.current?.getTracks().forEach(track => track.stop());
    preview.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);

  useEffect(() => {
    const mediaDevices = navigator.mediaDevices;
    if (!enabled) return undefined;
    if (!mediaDevices?.getUserMedia) {
      setFailure(true);
      return undefined;
    }
    let active = true;
    setFailure(false);
    mediaDevices.getUserMedia({
      video: cameraId ? { deviceId: { exact: cameraId } } : true,
      audio: false,
    }).then(stream => {
      if (!active) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      preview.current = stream;
      if (video.current) video.current.srcObject = stream;
      return mediaDevices.enumerateDevices?.().then(list => {
        if (active) setDevices(list.filter(device => device.deviceId && device.label));
      }).catch(() => {});
    }).catch(() => {
      if (active) setFailure(true);
    });
    return () => {
      active = false;
      stopPreview();
    };
  }, [cameraId, enabled, stopPreview]);

  return { video, failure, devices, stopPreview };
}

function DeviceChoice({ label, kind, devices, value, onChange }) {
  const options = devices.filter(device => device.kind === kind);
  if (!options.length) return null;

  return (
    <label className="live-device">
      {label}
      <select value={value} onChange={event => onChange(event.target.value)}>
        <option value="">Standart cihaz</option>
        {options.map(device => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
      </select>
    </label>
  );
}

function Prejoin({ preview, micEnabled, cameraEnabled, cameraId, microphoneId, setCamera, setMic, setCameraId, setMicrophoneId }) {
  const CameraIcon = cameraEnabled ? Camera : CameraOff;
  const MicIcon = micEnabled ? Mic : MicOff;

  return (
    <section className="live-prejoin" aria-label="Kamera və mikrofon">
      <div className="live-preview">
        {cameraEnabled && !preview.failure ? (
          <video aria-label="Kamera görüntüsü" ref={preview.video} autoPlay muted playsInline />
        ) : <CameraOff size={40} aria-label="Kamera görüntüsü bağlıdır" />}
      </div>
      {preview.failure && cameraEnabled && <p role="status">Kamera açıla bilmədi. Cihaz icazələrini yoxlayın və ya kamerasız qoşulun.</p>}
      <div className="live-actions">
        <button type="button" className="btn secondary" aria-pressed={micEnabled} onClick={() => setMic(!micEnabled)}><MicIcon size={18} /> Mikrofon</button>
        <button type="button" className="btn secondary" aria-pressed={cameraEnabled} onClick={() => setCamera(!cameraEnabled)}><CameraIcon size={18} /> Kamera</button>
      </div>
      <div className="live-devices">
        <DeviceChoice label="Kamera" kind="videoinput" devices={preview.devices} value={cameraId} onChange={setCameraId} />
        <DeviceChoice label="Mikrofon" kind="audioinput" devices={preview.devices} value={microphoneId} onChange={setMicrophoneId} />
      </div>
    </section>
  );
}

function LiveRoom({ lessonId }) {
  const { data: lesson, error: loadError, refetch } = useLiveLessonQuery(lessonId, { pollingInterval: 4000 });
  const [changeLesson] = useChangeLiveLessonMutation();
  const connection = useRef(null);
  const attempt = useRef(null);
  const release = useRef(Promise.resolve());
  const [media, setMedia] = useState(emptyMedia);
  const [micEnabled, setMic] = useState(false);
  const [cameraEnabled, setCamera] = useState(false);
  const [microphoneId, setMicrophoneId] = useState('');
  const [cameraId, setCameraId] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const accessLost = [401, 403, 404].includes(loadError?.status);
  const connected = media.status === 'connected' || media.status === 'reconnecting';
  const showPreview = Boolean(lesson?.canPreview && !connected && !busy && !accessLost);
  const preview = useDevicePreview(cameraId, showPreview && cameraEnabled);

  const cleanup = useCallback(() => {
    attempt.current?.abort();
    attempt.current = null;
    const current = connection.current;
    connection.current = null;
    if (current) release.current = current.disconnect().catch(() => {});
  }, []);

  useEffect(() => cleanup, [cleanup]);
  useEffect(() => {
    if (!accessLost && !closedStates.has(lesson?.state)) return;
    cleanup();
    setMedia(emptyMedia);
    setBusy(false);
    setActionError('');
    setConfirmEnd(false);
  }, [accessLost, cleanup, lesson?.state]);

  async function connect() {
    if (attempt.current || connection.current) return;
    const active = new AbortController();
    attempt.current = active;
    setBusy(true);
    setActionError('');
    preview.stopPreview();

    try {
      await release.current;
      if (active.signal.aborted) return;
      if (lesson.canStart) await changeLesson({ id: lessonId, action: 'start' }).unwrap();
      if (active.signal.aborted) return;
      const { provider, credentials } = await joinLiveLesson(lessonId, active.signal);
      const controller = await openMediaSession(provider, state => {
        if (attempt.current === active) {
          setMedia(state);
          if (state.status === 'disconnected' || state.status === 'error') {
            cleanup();
            if (!state.ended) setActionError(state.error || 'Bağlantı kəsildi. Dərsə yenidən qoşula bilərsiniz.');
            void refetch();
          }
        }
      });
      if (attempt.current !== active) {
        await controller.disconnect();
        return;
      }
      connection.current = controller;

      try {
        await controller.connect(credentials, { micEnabled, cameraEnabled: cameraEnabled && !preview.failure, microphoneId, cameraId });
      } catch {
        throw new Error('Video bağlantısı qurulmadı. Cihaz icazələrini yoxlayın və yenidən cəhd edin.');
      }
    } catch (error) {
      if (attempt.current === active) {
        cleanup();
        setMedia(emptyMedia);
        setActionError(portalError(error, 'Canlı dərsə qoşulmaq mümkün olmadı.'));
      }
    } finally {
      if (!attempt.current || attempt.current === active) setBusy(false);
    }
  }

  function leave() {
    cleanup();
    setMedia(emptyMedia);
    setConfirmEnd(false);
  }

  async function end() {
    setBusy(true);
    setActionError('');
    try {
      await changeLesson({ id: lessonId, action: 'end' }).unwrap();
      leave();
    } catch (error) {
      setActionError(portalError(error, 'Dərsi bitirmək mümkün olmadı.'));
    } finally {
      setBusy(false);
    }
  }

  const canConnect = Boolean(lesson?.canStart || lesson?.canJoin);
  const sessionMessage = media.ended ? stateMessages.ended : lesson
    ? stateMessages[lesson.state] || stateMessages.unavailable
    : 'Dərs otağı yüklənir…';

  return (
    <main className="live-room">
      <header className="live-header">
        <Link to="/lessons" className="btn secondary"><ArrowLeft size={17} /> Dərslər</Link>
        <h1>{lesson?.title || 'Canlı dərs'}</h1>
        <Video size={22} aria-hidden="true" />
      </header>

      {loadError && (!lesson || accessLost) ? (
        <section className="live-lobby">
          <p role="alert">{portalError(loadError, 'Dərs otağını açmaq mümkün olmadı.')}</p>
          <button type="button" className="btn secondary" onClick={refetch}>Yenidən yoxla</button>
        </section>
      ) : (
        <section className={connected ? 'live-classroom' : 'live-lobby'}>
          <p className="live-status" role="status">{media.status === 'reconnecting' ? 'Bağlantı bərpa edilir…' : sessionMessage}</p>
          {showPreview && <Prejoin {...{ preview, micEnabled, cameraEnabled, cameraId, microphoneId, setCamera, setMic, setCameraId, setMicrophoneId }} />}
          {connected && <ClassroomMedia media={media} controller={connection.current} onError={setActionError} />}
          {actionError && <p className="form-error" role="alert">{actionError}</p>}
          {connected && media.error && !actionError && <p className="form-error" role="status">{media.error}</p>}
          {!connected && !media.ended && (canConnect || busy) && (
            <button type="button" className="btn primary" disabled={busy} onClick={connect}>
              <Video size={18} /> {busy ? 'Qoşulur…' : lesson.canStart ? 'Dərsi başlat' : 'Dərsə qoşul'}
            </button>
          )}
          {(connected || lesson?.canEnd) && (
            <div className="live-actions">
              {connected && <button type="button" className="btn secondary" disabled={busy} onClick={leave}>Otaqdan çıx</button>}
              {lesson?.canEnd && !confirmEnd && <button type="button" className="btn secondary danger-text" disabled={busy} onClick={() => setConfirmEnd(true)}>Dərsi hamı üçün bitir</button>}
              {lesson?.canEnd && confirmEnd && (
                <>
                  <button type="button" className="btn secondary" disabled={busy} onClick={() => setConfirmEnd(false)}>Geri</button>
                  <button type="button" className="btn primary" disabled={busy} onClick={end}>Dərsi bitir</button>
                </>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export function Component() {
  const { lessonId } = useParams();
  return <LiveRoom key={lessonId} lessonId={lessonId} />;
}
