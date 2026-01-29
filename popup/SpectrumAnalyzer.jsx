import React, { useEffect, useRef } from 'react';

export default function SpectrumAnalyzer() {
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
        // Request analyser from background (que lo envía al offscreen)
        const response = await chrome.runtime.sendMessage({
          type: 'GET_ANALYSER_DATA'
        }).catch(() => null);

        if (!response || !response.data || response.data.length === 0) {
          animationRef.current = requestAnimationFrame(draw);
          return;
        }

        const dataArray = Array.isArray(response.data) 
          ? new Uint8Array(response.data) 
          : new Uint8Array(0);
        
        // Clear canvas
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (dataArray.length === 0) {
          animationRef.current = requestAnimationFrame(draw);
          return;
        }

        // Draw spectrum bars
        const barWidth = (canvas.width / dataArray.length) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < dataArray.length; i++) {
          barHeight = (dataArray[i] / 255) * canvas.height;

          // Color gradient
          const hue = (i / dataArray.length) * 360;
          ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

          x += barWidth + 1;
        }

        animationRef.current = requestAnimationFrame(draw);
      } catch (error) {
        // Silenciar errores cuando EQ no está activo
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
