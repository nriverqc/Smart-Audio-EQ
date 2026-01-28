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
        // Request analyser from offscreen document
        const response = await chrome.runtime.sendMessage({
          type: 'GET_ANALYSER_DATA'
        });

        if (!response || !response.data) {
          animationRef.current = requestAnimationFrame(draw);
          return;
        }

        const dataArray = new Uint8Array(response.data);
        
        // Clear canvas
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

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
        console.log('Spectrum analyzer inactive');
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
