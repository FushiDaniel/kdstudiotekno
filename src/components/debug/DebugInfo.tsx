'use client';

import { useEffect, useState } from 'react';

export default function DebugInfo() {
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    setDebugInfo({
      userAgent: navigator.userAgent,
      url: window.location.href,
      localStorage: Object.keys(localStorage),
      timestamp: new Date().toISOString(),
      error: null
    });

    // Catch any unhandled errors
    const handleError = (error: ErrorEvent) => {
      setDebugInfo((prev: any) => ({
        ...prev,
        error: {
          message: error.message,
          filename: error.filename,
          lineno: error.lineno,
          colno: error.colno,
          stack: error.error?.stack
        }
      }));
    };

    window.addEventListener('error', handleError);
    
    return () => {
      window.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 bg-black text-white p-4 rounded-lg text-xs max-w-sm z-50 opacity-75">
      <div className="font-bold mb-2">Debug Info</div>
      <div>URL: {debugInfo.url}</div>
      <div>Time: {debugInfo.timestamp}</div>
      {debugInfo.error && (
        <div className="mt-2 text-red-300">
          <div className="font-bold">Error:</div>
          <div>{debugInfo.error.message}</div>
          <div>{debugInfo.error.filename}:{debugInfo.error.lineno}</div>
        </div>
      )}
    </div>
  );
}