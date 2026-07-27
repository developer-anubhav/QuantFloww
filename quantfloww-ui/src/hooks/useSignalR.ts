import { useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';

export const useSignalR = (onPriceUpdate: (data: any) => void) => {
  const [isConnected, setIsConnected] = useState(false);
  const callbackRef = useRef(onPriceUpdate);

  // Keep the callback reference up to date without triggering reconnection
  useEffect(() => {
    callbackRef.current = onPriceUpdate;
  }, [onPriceUpdate]);

  useEffect(() => {
    const token = localStorage.getItem('token') || '';
    
    const connection = new signalR.HubConnectionBuilder()
      .withUrl('http://localhost:5280/hubs/marketdata', {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.None)
      .build();

    connection.on('ReceivePriceUpdate', (data) => {
      if (callbackRef.current) {
        callbackRef.current(data);
      }
    });

    connection.start()
      .then(() => {
        setIsConnected(true);
        console.log('SignalR Live feed connected.');
      })
      .catch((err) => {
        console.error('SignalR Hub Connection Error: ', err);
      });

    return () => {
      connection.stop()
        .then(() => console.log('SignalR Live feed disconnected.'))
        .catch(err => console.error('Error disconnecting SignalR: ', err));
    };
  }, []); // Empty dependency array ensures connection is established only once on mount

  return isConnected;
};
