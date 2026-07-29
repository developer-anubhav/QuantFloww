import { useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';

export const useSignalR = (
  onPriceUpdate: (data: any) => void,
  onBlockDeal?: (data: any) => void
) => {
  const [isConnected, setIsConnected] = useState(false);
  const priceCallbackRef = useRef(onPriceUpdate);
  const blockCallbackRef = useRef(onBlockDeal);

  // Keep references up to date without triggering reconnection
  useEffect(() => {
    priceCallbackRef.current = onPriceUpdate;
  }, [onPriceUpdate]);

  useEffect(() => {
    blockCallbackRef.current = onBlockDeal;
  }, [onBlockDeal]);

  useEffect(() => {
    const token = localStorage.getItem('token') || '';
    
    const hubUrl = import.meta.env.VITE_WS_BASE_URL || 'http://localhost:5280/hubs/marketdata';
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.None)
      .build();

    connection.on('ReceivePriceUpdate', (data) => {
      if (priceCallbackRef.current) {
        priceCallbackRef.current(data);
      }
    });

    connection.on('ReceiveBlockDeal', (data) => {
      if (blockCallbackRef.current) {
        blockCallbackRef.current(data);
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
  }, []);

  return isConnected;
};
