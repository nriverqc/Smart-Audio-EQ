import React, { useEffect, useRef } from 'react';

export default function SpectrumAnalyzer({ targetTabId, isPremium }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = 300;
    canvas.height = 150;

    const draw = async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_ANALYSER_DATA',
          tabId: targetTabId
        }).catch(() => null);

        if (!response || !response.data || response.data.length === 0) {
          animationRef.current = requestAnimationFrame(draw);
          return;
        }

        const dataArray = Array.isArray(response.data) 
          ? new Uint8Array(response.data) 
          : new Uint8Array(0);
        
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (dataArray.length === 0) {
          animationRef.current = requestAnimationFrame(draw);
          return;
        }

        const barWidth = (canvas.width / dataArray.length) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < dataArray.length; i++) {
          barHeight = (dataArray[i] / 255) * canvas.height;

          if (isPremium) {
            const hue = (i / dataArray.length) * 360;
            ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
          } else {
            // Gray/Limited for free users
            ctx.fillStyle = `rgba(100, 100, 100, ${0.5 + (dataArray[i] / 510)})`;
          }
          
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }

        if (!isPremium) {
          ctx.fillStyle = "rgba(255, 215, 0, 0.7)";
          ctx.font = "bold 12px Arial";
          ctx.textAlign = "center";
          ctx.fillText("FREE VERSION - SPECTRUM LIMITED", canvas.width / 2, 20);
        }

        animationRef.current = requestAnimationFrame(draw);
      } catch (error) {
        animationRef.current = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div style={{ marginBottom: '10px', padding: '10px', background: '#1a1a1a', borderRadius: '4px' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: 'auto', borderRadius: '4px' }}
      />
      <p style={{ textAlign: 'center', fontSize: '11px', color: '#666', margin: '5px 0 0 0' }}>
        🎵 Spectrum Analyzer
      </p>
    </div>
  );
}
