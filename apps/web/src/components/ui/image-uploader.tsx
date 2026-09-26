"use client";

import React, { useState, useRef } from "react";
import { Camera, Upload, X, Loader2, Image as ImageIcon, ShieldCheck } from "lucide-react";
import { uploadMediaFile } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  value: string[];
  onChange: (urls: string[]) => void;
  maxFiles?: number;
  label?: string;
  description?: string;
  enableCamera?: boolean;
  className?: string;
}

export function ImageUploader({
  value = [],
  onChange,
  maxFiles = 10,
  label = "Upload Photos",
  description = "Upload high-quality images as immutable evidence",
  enableCamera = true,
  className,
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMessage(null);

    const remainingSlots = maxFiles - value.length;
    if (remainingSlots <= 0) {
      setErrorMessage(`Maximum ${maxFiles} files reached.`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setIsUploading(true);

    try {
      const uploadedUrls: string[] = [];
      for (const file of filesToUpload) {
        // Validate max 15MB
        if (file.size > 15 * 1024 * 1024) {
          throw new Error(`File ${file.name} is too large (max 15MB)`);
        }
        const res = await uploadMediaFile(file);
        uploadedUrls.push(res.fileUrl);
      }
      onChange([...value, ...uploadedUrls]);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to upload media");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const handleRemove = (index: number) => {
    const updated = value.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
            {label}
          </label>
          {description && (
            <p className="text-xs text-stone-500 mt-0.5">{description}</p>
          )}
        </div>
        <span className="text-xs text-stone-400 font-medium">
          {value.length} / {maxFiles}
        </span>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/mp4,video/webm"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {enableCamera && (
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      )}

      {/* Upload action triggers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || value.length >= maxFiles}
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 bg-stone-50/70 hover:bg-stone-100/70 px-4 py-3 text-xs font-medium text-stone-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          ) : (
            <Upload className="w-4 h-4 text-stone-500" />
          )}
          <span>Choose from Gallery / Files</span>
        </button>

        {enableCamera && (
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isUploading || value.length >= maxFiles}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/50 px-4 py-3 text-xs font-medium text-emerald-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Camera className="w-4 h-4 text-emerald-600" />
            <span>Open Camera / Take Photo</span>
          </button>
        )}
      </div>

      {errorMessage && (
        <p className="text-xs text-rose-600 font-medium bg-rose-50 border border-rose-200 rounded-lg p-2">
          {errorMessage}
        </p>
      )}

      {/* Previews */}
      {value.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 pt-1">
          {value.map((url, idx) => (
            <div
              key={idx}
              className="group relative aspect-square rounded-xl overflow-hidden border border-stone-200 bg-stone-100 shadow-sm"
            >
              {url.endsWith(".mp4") || url.endsWith(".webm") ? (
                <video src={url} className="w-full h-full object-cover" />
              ) : (
                <img
                  src={url}
                  alt={`Evidence ${idx + 1}`}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="p-1.5 rounded-full bg-white/90 text-rose-600 hover:bg-white shadow transition-transform hover:scale-110"
                  title="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="absolute bottom-1 left-1 bg-black/60 backdrop-blur-xs text-white text-[10px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1">
                <ShieldCheck className="w-2.5 h-2.5 text-green-400" />
                <span>#{idx + 1}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
