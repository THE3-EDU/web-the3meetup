import { useEffect, useRef, useState } from 'react';
import ImageCropModal from '../components/ImageCropModal';

/** 纯前端展示用：消息只存在本地 state，不请求后端、不连 WS */
interface LocalMessage {
  id: number;
  imageData: string; // base64 或 data URL，用于直接显示
  text_content: string;
}

export default function TouchLiveShowPage() {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [text, setText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 压缩图片（确保最大尺寸不超过 800x800，并压缩文件大小）
  const compressImage = async (file: File, maxWidth = 800, maxHeight = 800, quality = 0.85): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // 计算新尺寸（保持宽高比）
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = width * ratio;
            height = height * ratio;
          }
          
          // 创建 canvas 并绘制压缩后的图片
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('无法创建 canvas 上下文'));
            return;
          }
          
          // 使用高质量渲染
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          
          // 转换为 base64（JPEG 格式）
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          
          // 计算压缩后的大小（base64 数据大小约为实际文件大小的 4/3）
          const base64Size = compressedDataUrl.length;
          const estimatedFileSize = (base64Size * 3) / 4;
          const sizeInKB = (estimatedFileSize / 1024).toFixed(2);
          const sizeInMB = (estimatedFileSize / (1024 * 1024)).toFixed(2);
          
          console.log(`图片压缩完成 - 尺寸: ${width}x${height}px, 大小: ${sizeInKB} KB (${sizeInMB} MB)`);
          
          resolve(compressedDataUrl);
        };
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  };

  // 纯前端模拟发送：短暂延迟后把图片+文字加入列表并显示，无任何失败提示
  const handleSend = async () => {
    if ((!imageFile && !text.trim()) || isSending) {
      return;
    }
    setIsSending(true);
    try {
      // 模拟发送中的短暂延迟
      await new Promise((r) => setTimeout(r, 300));
      let imageDataUrl = '';
      if (imageFile) {
        imageDataUrl = await compressImage(imageFile, 800, 800, 0.85);
      }
      const newMsg: LocalMessage = {
        id: Date.now(),
        imageData: imageDataUrl,
        text_content: text.trim(),
      };
      setMessages((prev) => [...prev, newMsg]);
      setText('');
      setImageFile(null);
      setImagePreview('');
    } catch {
      // 纯展示页：出错也不弹窗，仅恢复按钮状态
    } finally {
      setIsSending(false);
    }
  };

  const handleCropComplete = (file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSendClick = () => {
    if (!text.trim() || !imageFile || isSending) {
      return;
    }
    handleSend();
  };

  const renderMessage = (msg: LocalMessage, idx: number) => {
    const hasImg = !!msg.imageData;
    const hasText = !!msg.text_content;
    const isEven = idx % 2 === 0;
    return (
      <div key={msg.id} className="flex items-center py-4 px-2 bg-[#DCFF92] border-b px-10 border-white border-5">
        {isEven ? (
          <>
            {hasImg && (
              <img
                src={msg.imageData}
                alt="图片"
                className="w-16 h-16 object-cover rounded-md mr-4 bg-gray-200"
                style={{ minWidth: 64 }}
              />
            )}
            {hasText && (
              <div className="text-lg text-black break-all flex-1">{msg.text_content}</div>
            )}
          </>
        ) : (
          <>
            {hasText && (
              <div className="text-lg text-black break-all flex-1 text-right">{msg.text_content}</div>
            )}
            {hasImg && (
              <img
                src={msg.imageData}
                alt="图片"
                className="w-16 h-16 object-cover rounded-md ml-4 bg-gray-200"
                style={{ minWidth: 64 }}
              />
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#DCFF92]">
      <div className="w-full flex items-center px-4 py-3 border-b bg-[#DCFF92]">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mr-2">
          <img src="/icons/logo.png" alt="logo" className="w-12 h-12 rounded-full" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-0 py-2" style={{ maxHeight: '70vh' }}>
        <div className="flex flex-col gap-0 justify-end">
          {messages.map((msg, idx) => renderMessage(msg, idx))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      {imagePreview && (
        <div className="flex justify-center items-center py-2 bg-white border-t">
          <img src={imagePreview} alt="预览" className="w-20 h-20 object-cover rounded" />
          <button
            className="ml-2 text-gray-400 hover:text-red-500 text-xl"
            onClick={() => { setImageFile(null); setImagePreview(''); }}
            title="移除图片"
          >
            ×
          </button>
        </div>
      )}
      <div className="w-full px-4 py-3 bg-[#DCFF92] border-t">
        {(!text || !imageFile) && (
          <div className="text-xs text-gray-600 mb-1 px-1 text-center">
            {!text && !imageFile && <div>请同时上传图片和输入文字<br/>Please upload both image and text</div>}
            {!text && imageFile && <div>请输入文字内容<br/>Please enter text content</div>}
            {text && !imageFile && <div>请上传图片<br/>Please upload an image</div>}
            {text && <div>仅限输入10个字 (Only 10 characters allowed.)</div>}
          </div>
        )}
        <div className="flex items-center">
          <div className="flex-1 flex items-center bg-white rounded-xl px-4 py-2">
            <input
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              maxLength={10}
              placeholder="仅限输入10个字 (Only 10 characters allowed.)"
              className="flex-1 bg-transparent outline-none text-lg text-black placeholder:text-xs placeholder:text-gray-400"
            />
            <button
              className="ml-2 w-8 h-8 flex items-center justify-center"
              onClick={() => setCropModalOpen(true)}
              title="选择图片" 
            >
              <img src="/icons/uploadImage.svg" alt="选择图片" className="w-7 h-7" />
            </button>
          </div>
          <button
            onClick={handleSendClick}
            disabled={isSending || !text.trim() || !imageFile}
            className={`ml-2 w-12 h-12 flex items-center justify-center rounded-xl transition-colors ${
              isSending || !text.trim() || !imageFile
                ? 'bg-gray-400 cursor-not-allowed opacity-50'
                : 'bg-black hover:bg-gray-800'
            }`}
            title={
              isSending
                ? '发送中...'
                : !text.trim() && !imageFile
                ? '请同时上传图片和输入文字'
                : !text.trim()
                ? '请输入文字内容'
                : !imageFile
                ? '请上传图片'
                : '发送'
            }
          >
            <img src="/icons/send.svg" alt="发送" className="w-7 h-7" />
          </button>
        </div>
      </div>
      <ImageCropModal
        open={cropModalOpen}
        onClose={() => setCropModalOpen(false)}
        onCropComplete={handleCropComplete}
      />
      <div className="text-xs text-gray-500 text-center py-2 select-none">
        Web2touch, Interactive Installations, Bridging People.<br />
        Released 2023/1/9, copyright ©THE3.STUDIO
      </div>
    </div>
  );
}

