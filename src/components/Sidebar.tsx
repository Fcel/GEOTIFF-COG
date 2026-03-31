import React from 'react';
import {
  Info, BarChart3, LineChart, Calculator, Layers,
  Crosshair, Sun, Moon, X,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import FileUpload from './FileUpload';
import MetadataPanel from './MetadataPanel';
import StatsPanel from './StatsPanel';
import HistogramPanel from './HistogramPanel';
import BandMathPanel from './BandMathPanel';
import RenderPanel from './RenderPanel';
import PixelInspector from './PixelInspector';

type Tab = { id: 'info' | 'stats' | 'histogram' | 'bandmath' | 'layers'; icon: React.ComponentType<{ className?: string }>; label: string };

const TABS: Tab[] = [
  { id: 'info', icon: Info, label: 'Info' },
  { id: 'stats', icon: BarChart3, label: 'Stats' },
  { id: 'histogram', icon: LineChart, label: 'Histogram' },
  { id: 'bandmath', icon: Calculator, label: 'Band Math' },
  { id: 'layers', icon: Layers, label: 'Render' },
];

export default function Sidebar() {
  const store = useAppStore();
  const { activePanel, darkMode, showPixelInspector, metadata } = store;

  const toggleDark = () => {
    store.setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark', !darkMode);
  };

  return (
    <aside className="flex flex-col h-full bg-dark-800 border-r border-dark-600 w-80 flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-600">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-none">GeoTIFF Studio</h1>
            <p className="text-[10px] text-gray-500">Advanced Raster Viewer</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => store.setShowPixelInspector(!showPixelInspector)}
            title="Toggle pixel inspector"
            className={`p-1.5 rounded-lg transition-colors ${
              showPixelInspector
                ? 'bg-accent-500/20 text-accent-400'
                : 'text-gray-500 hover:text-gray-300 hover:bg-dark-700'
            }`}
          >
            <Crosshair className="w-4 h-4" />
          </button>
          <button
            onClick={toggleDark}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-dark-700 transition-colors"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {metadata && (
            <button
              onClick={() => store.reset()}
              title="Close file"
              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* File upload */}
      <div className="px-4 py-3 border-b border-dark-600">
        <FileUpload />
      </div>

      {/* Pixel inspector */}
      {showPixelInspector && (
        <div className="px-4 py-3 border-b border-dark-600 bg-dark-900/30">
          <div className="flex items-center gap-1.5 mb-2">
            <Crosshair className="w-3.5 h-3.5 text-accent-400" />
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Pixel Inspector</h3>
          </div>
          <PixelInspector />
        </div>
      )}

      {/* Tab navigation */}
      {metadata && (
        <>
          <div className="flex border-b border-dark-600 bg-dark-900/20">
            {TABS.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => store.setActivePanel(id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors relative ${
                  activePanel === id
                    ? 'text-accent-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {activePanel === id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-400 rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
            {activePanel === 'info' && <MetadataPanel />}
            {activePanel === 'stats' && <StatsPanel />}
            {activePanel === 'histogram' && <HistogramPanel />}
            {activePanel === 'bandmath' && <BandMathPanel />}
            {activePanel === 'layers' && <RenderPanel />}
          </div>
        </>
      )}

      {/* Footer */}
      <div className="px-4 py-3 border-t border-dark-600 flex items-center justify-between">
        <p className="text-[10px] text-gray-600">All processing runs in your browser</p>
        <a
          href="https://github.com/GeoTIFF/geotiff.js"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-gray-600 hover:text-accent-400 transition-colors"
        >
          geotiff.js
        </a>
      </div>
    </aside>
  );
}
