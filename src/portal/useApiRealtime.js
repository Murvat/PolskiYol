import { HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import { useEffect, useRef } from 'react';
import { getAccessToken } from '../dotnetApi.js';

const events = [
  'MessageCreated', 'FeedPostCreated', 'FeedPostDeleted', 'MaterialCreated',
  'MaterialCoverUpdated', 'MaterialDeleted', 'TeacherAssignmentChanged',
];

export function useApiRealtime(enabled, conversationId, refresh) {
  const activeConversation = useRef(conversationId);
  const updateSubscription = useRef(null);
  useEffect(() => {
    activeConversation.current = conversationId;
    updateSubscription.current?.();
  }, [conversationId]);

  useEffect(() => {
    if (!enabled) return undefined;
    const connection = new HubConnectionBuilder()
      .withUrl('/hubs/messages', { accessTokenFactory: async () => await getAccessToken() || '' })
      .withAutomaticReconnect()
      .build();

    let cancelled = false;
    let joined;
    let retries = 0;
    let restartTimer;
    let refreshTimer;
    let subscription = Promise.resolve();

    function scheduleRefresh() {
      clearTimeout(refreshTimer);
      if (!cancelled) refreshTimer = setTimeout(() => void refresh().catch(() => {}), 100);
    }

    function synchronizeConversation() {
      subscription = subscription.then(async () => {
        if (cancelled || connection.state !== HubConnectionState.Connected) return;
        const desired = activeConversation.current;
        if (desired === joined) return;
        if (joined != null) {
          await connection.invoke('LeaveConversation', joined);
          joined = undefined;
        }
        if (desired != null) {
          await connection.invoke('JoinConversation', desired);
          joined = desired;
        }
      }).catch(scheduleRefresh);
      return subscription;
    }

    function onConnected() {
      joined = undefined;
      retries = 0;
      void synchronizeConversation();
      scheduleRefresh();
    }

    function retryLater() {
      if (cancelled) return;
      clearTimeout(restartTimer);
      restartTimer = setTimeout(start, Math.min(1000 * 2 ** retries++, 30000));
    }

    async function start() {
      try {
        await connection.start();
        if (!cancelled) onConnected();
      } catch {
        retryLater();
      }
    }

    for (const event of events) connection.on(event, scheduleRefresh);
    connection.onreconnecting(() => { joined = undefined; });
    connection.onreconnected(onConnected);
    connection.onclose(retryLater);
    updateSubscription.current = synchronizeConversation;
    void start();

    return () => {
      cancelled = true;
      updateSubscription.current = null;
      clearTimeout(restartTimer);
      clearTimeout(refreshTimer);
      void connection.stop();
    };
  }, [enabled, refresh]);
}
