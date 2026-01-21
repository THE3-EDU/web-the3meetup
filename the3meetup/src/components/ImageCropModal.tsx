import { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';

interface ImageCropModalProps {
  open: boolean;
  onClose: () => void;
  onCropComplete: (file: File) => void;
}

interface CroppedAreaPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function ImageCropModal({ open, onClose, onCropComplete }: ImageCropModalProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CroppedAreaPixels | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onCropCompleteCb = useCallback((_: unknown, croppedAreaPixels: CroppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', () => reject(new Error('Failed to load image')));
      image.src = url;
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: CroppedAreaPixels): Promise<File> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2d context');
    
    // 计算输出尺寸，确保不超过 800x800，保持宽高比
    const outputSize = 800;
    let outputWidth = outputSize;
    let outputHeight = outputSize;
    
    // 如果裁剪区域不是正方形，保持宽高比
    if (pixelCrop.width !== pixelCrop.height) {
      const aspectRatio = pixelCrop.width / pixelCrop.height;
      if (aspectRatio > 1) {
        // 宽度更大
        outputWidth = outputSize;
        outputHeight = outputSize / aspectRatio;
      } else {
        // 高度更大
        outputWidth = outputSize * aspectRatio;
        outputHeight = outputSize;
      }
    }
    
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    
    // 使用高质量渲染
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      outputWidth,
      outputHeight
    );
    
    // 压缩质量降低到 0.85，减小文件大小
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'cropped-image.jpg', { type: 'image/jpeg' });
          console.log(`图片压缩完成，大小: ${(file.size / 1024).toFixed(2)} KB`);
          resolve(file);
        } else {
          reject(new Error('图片压缩失败'));
        }
      }, 'image/jpeg', 0.85); // 质量 85%，平衡质量和文件大小
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropSave = async () => {
    if (selectedImage && croppedAreaPixels) {
      try {
        const croppedFile = await getCroppedImg(selectedImage, croppedAreaPixels);
        onCropComplete(croppedFile);
        setSelectedImage(null);
        onClose();
      } catch {
        alert('裁剪失败');
      }
    }
  };

  const handleCropCancel = () => {
    setSelectedImage(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h3 className="text-lg font-semibold mb-4 text-center text-black">选择图片 (1:1)</h3>
        {!selectedImage ? (
          <div className="flex flex-col items-center justify-center min-h-64">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-8 py-3 bg-black text-white rounded-lg hover:bg-black transition-colors font-medium text-lg mb-4"
            >
              选择图片
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        ) : (
          <>
            <div className="relative h-96 mb-4">
              <Cropper
                image={selectedImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropCompleteCb}
                style={{
                  containerStyle: {
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#f0f0f0',
                  },
                }}
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                缩放: {Math.round(zoom * 100)}%
              </label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="flex justify-center space-x-4">
              <button
                onClick={handleCropCancel}
                className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCropSave}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                确认裁剪
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

