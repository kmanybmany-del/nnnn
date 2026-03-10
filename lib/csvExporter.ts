// ============================================================
// lib/csvExporter.ts — Enhanced CSV Export with Data Merging
// Implements the Mahwous scheduling guide:
// - Multi-Platform (Heikal A): One row per DateTime with all platforms
// - Single-Platform (Heikal B): One row per DateTime+Platform combination
// - Data validation and URL checking
// - UTF-8 with BOM encoding
// ============================================================

import type { ScheduledItem, PlatformContent } from './smartScheduler';

export interface ExportOptions {
  format: 'multi-platform' | 'single-platform';
  validateUrls?: boolean;
  includeHistory?: boolean;
  timezone?: string; // e.g., 'UTC+3' for Riyadh
}

// ── Data Validation ───────────────────────────────────────────────────────────

function isValidUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed === '' || trimmed === 'nan') return false;
  try {
    new URL(trimmed);
    // Check file extension
    const ext = trimmed.split('.').pop()?.toLowerCase() || '';
    const validExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov'];
    return validExts.includes(ext);
  } catch {
    return false;
  }
}

function validateMediaUrls(items: ScheduledItem[]): { valid: number; invalid: number } {
  let validCount = 0;
  let invalidCount = 0;

  for (const item of items) {
    for (const [_, content] of Object.entries(item.platforms || {})) {
      if (content?.imageUrl && !isValidUrl(content.imageUrl)) {
        invalidCount++;
      } else if (content?.imageUrl) {
        validCount++;
      }

      if (content?.videoUrl && !isValidUrl(content.videoUrl)) {
        invalidCount++;
      } else if (content?.videoUrl) {
        validCount++;
      }
    }
  }

  return { valid: validCount, invalid: invalidCount };
}

// ── Multi-Platform Export (Heikal A) ──────────────────────────────────────────

function exportMultiPlatform(items: ScheduledItem[]): string {
  // Group by Date + Time to create merged rows
  const grouped = new Map<string, ScheduledItem>();

  for (const item of items) {
    const key = `${item.scheduledDate}|${item.scheduledTime}`;
    if (!grouped.has(key)) {
      grouped.set(key, { ...item, platforms: {} });
    }
    const existing = grouped.get(key)!;
    existing.platforms = { ...existing.platforms, ...item.platforms };
  }

  // Build CSV headers
  const platforms = [
    'instagram',
    'tiktok',
    'snapchat',
    'youtube',
    'twitter',
    'facebook',
    'linkedin',
    'telegram',
    'whatsapp',
    'pinterest',
    'haraj',
  ];

  const headers = [
    'Date',
    'Time',
    'Perfume_Name',
    'Brand',
    'Product_URL',
    'Status',
    ...platforms.flatMap(p => [
      `${p}_Post`,
      `${p}_Image`,
      `${p}_Video`,
      `${p}_ContentType`,
    ]),
  ];

  // Build rows
  const rows: string[] = [];
  for (const item of grouped.values()) {
    const platformCells: string[] = [];

    for (const platform of platforms) {
      const content = item.platforms[platform as keyof typeof item.platforms];
      platformCells.push(
        `"${(content?.caption || '').replace(/"/g, '""')}"`,
        content?.imageUrl || '',
        content?.videoUrl || '',
        content?.contentType || ''
      );
    }

    rows.push(
      [
        item.scheduledDate,
        item.scheduledTime,
        item.perfumeName,
        item.perfumeBrand,
        item.productUrl,
        item.status,
        ...platformCells,
      ]
        .map(cell => (typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell))
        .join(',')
    );
  }

  // Combine with BOM
  const BOM = '\uFEFF';
  return BOM + [headers.join(','), ...rows].join('\n');
}

// ── Single-Platform Export (Heikal B) ─────────────────────────────────────────

function exportSinglePlatform(items: ScheduledItem[]): string {
  const rows: string[] = [];

  for (const item of items) {
    for (const [platformId, content] of Object.entries(item.platforms || {})) {
      if (!content?.caption || content.caption.trim() === '') continue;

      rows.push(
        [
          item.scheduledDate,
          item.scheduledTime,
          platformId,
          item.perfumeName,
          item.perfumeBrand,
          item.productUrl,
          item.status,
          `"${content.caption.replace(/"/g, '""')}"`,
          content.imageUrl || '',
          content.videoUrl || '',
          content.contentType || '',
        ]
          .map(cell => (typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell))
          .join(',')
      );
    }
  }

  const headers = [
    'Date',
    'Time',
    'Platform',
    'Perfume_Name',
    'Brand',
    'Product_URL',
    'Status',
    'Post',
    'Image',
    'Video',
    'ContentType',
  ];

  const BOM = '\uFEFF';
  return BOM + [headers.join(','), ...rows].join('\n');
}

// ── Main Export Function ──────────────────────────────────────────────────────

export function exportScheduleAsCSV(
  items: ScheduledItem[],
  options: ExportOptions = { format: 'multi-platform' }
): { csv: string; filename: string; validation: { valid: number; invalid: number } } {
  // Filter empty items
  const filtered = items.filter(item => {
    const hasContent = Object.values(item.platforms || {}).some(
      p => p?.caption && p.caption.trim() !== ''
    );
    return hasContent;
  });

  // Validate URLs if requested
  const validation = options.validateUrls ? validateMediaUrls(filtered) : { valid: 0, invalid: 0 };

  // Generate CSV based on format
  let csv: string;
  if (options.format === 'single-platform') {
    csv = exportSinglePlatform(filtered);
  } else {
    csv = exportMultiPlatform(filtered);
  }

  // Generate filename
  const timestamp = new Date().toISOString().split('T')[0];
  const formatSuffix = options.format === 'single-platform' ? 'single' : 'multi';
  const filename = `mahwous-schedule-${formatSuffix}-${timestamp}.csv`;

  return { csv, filename, validation };
}

// ── Browser Download Helper ───────────────────────────────────────────────────

export function downloadCSV(
  items: ScheduledItem[],
  options: ExportOptions = { format: 'multi-platform' }
): void {
  if (typeof window === 'undefined') {
    console.error('downloadCSV can only be called in browser environment');
    return;
  }

  const { csv, filename } = exportScheduleAsCSV(items, options);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Node.js Export Helper ─────────────────────────────────────────────────────

export function exportToFile(
  items: ScheduledItem[],
  outputPath: string,
  options: ExportOptions = { format: 'multi-platform' }
): boolean {
  try {
    const { csv } = exportScheduleAsCSV(items, options);
    const fs = require('fs');
    fs.writeFileSync(outputPath, csv, 'utf-8');
    return true;
  } catch (error) {
    console.error('Error exporting to file:', error);
    return false;
  }
}
