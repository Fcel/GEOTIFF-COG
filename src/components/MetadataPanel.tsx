import React from 'react';
import { Layers, Map, Database, CheckCircle2, XCircle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1.5 border-b border-dark-600/50 last:border-0">
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-xs text-gray-200 text-right font-mono">{value}</span>
    </div>
  );
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatNumber(n: number, decimals = 4): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(decimals);
}

export default function MetadataPanel() {
  const { metadata } = useAppStore();
  if (!metadata) return null;

  const [west, south, east, north] = metadata.bbox ?? [0, 0, 0, 0];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* File Info */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Database className="w-3.5 h-3.5 text-accent-400" />
          <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">File</h3>
        </div>
        <div className="bg-dark-700/50 rounded-lg px-3 py-1">
          {metadata.fileName && <Row label="Name" value={metadata.fileName} />}
          <Row label="Size" value={formatBytes(metadata.fileSize)} />
          <Row label="Compression" value={metadata.compression ?? '—'} />
          <Row
            label="COG"
            value={
              metadata.isCOG ? (
                <span className="flex items-center gap-1 text-green-400">
                  <CheckCircle2 className="w-3 h-3" /> Yes
                </span>
              ) : (
                <span className="flex items-center gap-1 text-gray-500">
                  <XCircle className="w-3 h-3" /> No
                </span>
              )
            }
          />
        </div>
      </section>

      {/* Dimensions */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-3.5 h-3.5 text-accent-400" />
          <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Dimensions</h3>
        </div>
        <div className="bg-dark-700/50 rounded-lg px-3 py-1">
          <Row label="Width" value={`${metadata.width.toLocaleString()} px`} />
          <Row label="Height" value={`${metadata.height.toLocaleString()} px`} />
          <Row label="Bands" value={metadata.bandCount} />
          <Row label="Total pixels" value={(metadata.width * metadata.height).toLocaleString()} />
          <Row
            label="No-data value"
            value={metadata.noDataValue !== null && metadata.noDataValue !== undefined
              ? String(metadata.noDataValue)
              : '—'}
          />
        </div>
      </section>

      {/* Spatial extent */}
      {metadata.bbox && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Map className="w-3.5 h-3.5 text-accent-400" />
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Spatial Extent</h3>
          </div>
          <div className="bg-dark-700/50 rounded-lg px-3 py-1">
            <Row label="West" value={formatNumber(west)} />
            <Row label="South" value={formatNumber(south)} />
            <Row label="East" value={formatNumber(east)} />
            <Row label="North" value={formatNumber(north)} />
          </div>
          {/* Bbox visual */}
          <div className="mt-2 bg-dark-800 rounded-lg p-3 relative h-20">
            <div className="absolute inset-3 border border-accent-400/40 rounded flex items-center justify-center">
              <span className="text-[10px] text-gray-500">Extent</span>
            </div>
            <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] text-gray-500">{formatNumber(north, 2)}°N</span>
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-gray-500">{formatNumber(south, 2)}°S</span>
            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] text-gray-500">{formatNumber(west, 2)}°W</span>
            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-gray-500">{formatNumber(east, 2)}°E</span>
          </div>
        </section>
      )}
    </div>
  );
}
