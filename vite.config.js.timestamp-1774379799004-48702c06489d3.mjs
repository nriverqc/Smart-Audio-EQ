// vite.config.js
import { defineConfig } from "file:///D:/Smart%20Audio%20Pro%20%E2%80%93%20Browser%20Equalizer/node_modules/vite/dist/node/index.js";
import react from "file:///D:/Smart%20Audio%20Pro%20%E2%80%93%20Browser%20Equalizer/node_modules/@vitejs/plugin-react/dist/index.js";
import { viteStaticCopy } from "file:///D:/Smart%20Audio%20Pro%20%E2%80%93%20Browser%20Equalizer/node_modules/vite-plugin-static-copy/dist/index.js";
import { resolve } from "path";
var __vite_injected_original_dirname = "D:\\Smart Audio Pro \u2013 Browser Equalizer";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: "manifest.json", dest: "." },
        { src: "IconoEcualizador.png", dest: "." },
        { src: "premium_landing.html", dest: "." },
        { src: "_locales", dest: "." },
        { src: "flags", dest: "." }
      ]
    })
  ],
  base: "./",
  // CRUCIAL para extensiones: usa rutas relativas
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        popup: resolve(__vite_injected_original_dirname, "popup/index.html"),
        offscreen: resolve(__vite_injected_original_dirname, "offscreen.html"),
        background: resolve(__vite_injected_original_dirname, "background.js"),
        content: resolve(__vite_injected_original_dirname, "content.js")
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]"
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxTbWFydCBBdWRpbyBQcm8gXHUyMDEzIEJyb3dzZXIgRXF1YWxpemVyXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxTbWFydCBBdWRpbyBQcm8gXHUyMDEzIEJyb3dzZXIgRXF1YWxpemVyXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9TbWFydCUyMEF1ZGlvJTIwUHJvJTIwJUUyJTgwJTkzJTIwQnJvd3NlciUyMEVxdWFsaXplci92aXRlLmNvbmZpZy5qc1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnO1xyXG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xyXG5pbXBvcnQgeyB2aXRlU3RhdGljQ29weSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXN0YXRpYy1jb3B5JztcclxuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ3BhdGgnO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBwbHVnaW5zOiBbXHJcbiAgICByZWFjdCgpLFxyXG4gICAgdml0ZVN0YXRpY0NvcHkoe1xyXG4gICAgICB0YXJnZXRzOiBbXHJcbiAgICAgICAgeyBzcmM6ICdtYW5pZmVzdC5qc29uJywgZGVzdDogJy4nIH0sXHJcbiAgICAgICAgeyBzcmM6ICdJY29ub0VjdWFsaXphZG9yLnBuZycsIGRlc3Q6ICcuJyB9LFxyXG4gICAgICAgIHsgc3JjOiAncHJlbWl1bV9sYW5kaW5nLmh0bWwnLCBkZXN0OiAnLicgfSxcclxuICAgICAgICB7IHNyYzogJ19sb2NhbGVzJywgZGVzdDogJy4nIH0sXHJcbiAgICAgICAgeyBzcmM6ICdmbGFncycsIGRlc3Q6ICcuJyB9XHJcbiAgICAgIF1cclxuICAgIH0pXHJcbiAgXSxcclxuICBiYXNlOiAnLi8nLCAvLyBDUlVDSUFMIHBhcmEgZXh0ZW5zaW9uZXM6IHVzYSBydXRhcyByZWxhdGl2YXNcclxuICBidWlsZDoge1xyXG4gICAgb3V0RGlyOiAnZGlzdCcsXHJcbiAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgIGlucHV0OiB7XHJcbiAgICAgICAgcG9wdXA6IHJlc29sdmUoX19kaXJuYW1lLCAncG9wdXAvaW5kZXguaHRtbCcpLFxyXG4gICAgICAgIG9mZnNjcmVlbjogcmVzb2x2ZShfX2Rpcm5hbWUsICdvZmZzY3JlZW4uaHRtbCcpLFxyXG4gICAgICAgIGJhY2tncm91bmQ6IHJlc29sdmUoX19kaXJuYW1lLCAnYmFja2dyb3VuZC5qcycpLFxyXG4gICAgICAgIGNvbnRlbnQ6IHJlc29sdmUoX19kaXJuYW1lLCAnY29udGVudC5qcycpXHJcbiAgICAgIH0sXHJcbiAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIGVudHJ5RmlsZU5hbWVzOiAnW25hbWVdLmpzJyxcclxuICAgICAgICBjaHVua0ZpbGVOYW1lczogJ1tuYW1lXS5qcycsXHJcbiAgICAgICAgYXNzZXRGaWxlTmFtZXM6ICdbbmFtZV0uW2V4dF0nXHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcbn0pO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTBULFNBQVMsb0JBQW9CO0FBQ3ZWLE9BQU8sV0FBVztBQUNsQixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGVBQWU7QUFIeEIsSUFBTSxtQ0FBbUM7QUFLekMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sZUFBZTtBQUFBLE1BQ2IsU0FBUztBQUFBLFFBQ1AsRUFBRSxLQUFLLGlCQUFpQixNQUFNLElBQUk7QUFBQSxRQUNsQyxFQUFFLEtBQUssd0JBQXdCLE1BQU0sSUFBSTtBQUFBLFFBQ3pDLEVBQUUsS0FBSyx3QkFBd0IsTUFBTSxJQUFJO0FBQUEsUUFDekMsRUFBRSxLQUFLLFlBQVksTUFBTSxJQUFJO0FBQUEsUUFDN0IsRUFBRSxLQUFLLFNBQVMsTUFBTSxJQUFJO0FBQUEsTUFDNUI7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFDQSxNQUFNO0FBQUE7QUFBQSxFQUNOLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLGVBQWU7QUFBQSxNQUNiLE9BQU87QUFBQSxRQUNMLE9BQU8sUUFBUSxrQ0FBVyxrQkFBa0I7QUFBQSxRQUM1QyxXQUFXLFFBQVEsa0NBQVcsZ0JBQWdCO0FBQUEsUUFDOUMsWUFBWSxRQUFRLGtDQUFXLGVBQWU7QUFBQSxRQUM5QyxTQUFTLFFBQVEsa0NBQVcsWUFBWTtBQUFBLE1BQzFDO0FBQUEsTUFDQSxRQUFRO0FBQUEsUUFDTixnQkFBZ0I7QUFBQSxRQUNoQixnQkFBZ0I7QUFBQSxRQUNoQixnQkFBZ0I7QUFBQSxNQUNsQjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
