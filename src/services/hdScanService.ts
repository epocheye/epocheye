/**
 * HD Scan service — calls the EfficientSAM Python Lambda for
 * high-quality, on-demand segmentation masks.
 *
 * Premium-only feature. Returns full-resolution binary masks
 * as base64 PNGs with confidence scores and bounding boxes.
 */

import axios from 'axios';
import { SAM_LAMBDA_URL } from '@env';
import { fileToBase64 } from './geminiVisionService';

export interface HDScanMask {
  mask: string; // base64 PNG (alpha channel)
  score: number;
  area_fraction: number;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
}

export interface HDScanSuccess {
  success: true;
  masks: HDScanMask[];
  inferenceTimeMs: number;
}

export interface HDScanError {
  success: false;
  error: string;
}

export type HDScanResult = HDScanSuccess | HDScanError;

/**
 * Capture a photo, send it to the SAM Lambda, get back masks.
 *
 * @param photoPath - Local file path from VisionCamera's takePhoto()
 * @param authToken - JWT access token for Lambda auth
 * @param maxMasks  - Maximum number of masks to return (default 3)
 */
export async function performHDScan(
  photoPath: string,
  authToken: string,
  maxMasks = 3,
): Promise<HDScanResult> {
  if (!SAM_LAMBDA_URL) {
    return { success: false, error: 'HD Scan not configured' };
  }

  try {
    const base64 = await fileToBase64(photoPath);

    const resp = await axios.post(
      `${SAM_LAMBDA_URL}`,
      { image: base64, max_masks: maxMasks },
      {
        headers: { Authorization: `Bearer ${authToken}` },
        timeout: 60_000, // up to 60s for Lambda cold start + inference
      },
    );

    const body = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;

    return {
      success: true,
      masks: body.masks ?? [],
      inferenceTimeMs: body.inference_time_ms ?? 0,
    };
  } catch (err) {
    const message = axios.isAxiosError(err)
      ? err.response?.data?.error ?? 'HD Scan failed'
      : 'HD Scan failed';
    return { success: false, error: message };
  }
}
