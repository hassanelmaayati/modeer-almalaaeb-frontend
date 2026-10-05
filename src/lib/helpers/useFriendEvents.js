import { useEffect, useRef } from 'react';
import { listen } from '../../services/websocketService';
import { friendEvent } from './live';

export default function useFriendEvents(onEvent) {
  const handler = useRef(onEvent);

  useEffect(() => { handler.current = onEvent; });

  useEffect(() => listen((event) => {
    if (friendEvent(event)) handler.current();
  }), []);
}
