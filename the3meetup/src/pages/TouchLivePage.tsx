import { useEffect, useRef, useState } from 'react';
import ImageCropModal from '../components/ImageCropModal';
import { getImageUrl } from '../lib/imageUrl';

interface UploadData {
  id: number;
  image_name: string;
  text_content: string;
  created_at: string;
}

export default function TouchLivePage() {
  const [messages, setMessages] = useState<UploadData[]>([]);
  const [text, setText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successImage, setSuccessImage] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 获取历史消息（通过 WebSocket 或 HTTP API）
  const fetchMessages = async () => {
    try {
      // 可以通过 HTTP API 获取，也可以等待 WebSocket 连接后请求
      // 暂时保留 HTTP API 方式，后续可以改为通过 WebSocket 请求
      const apiUrl = 'https://api.the3studio.cn';
      const url = apiUrl ? `${apiUrl}/api/uploads` : '/api/uploads';
      const res = await fetch(url);
      const result = await res.json();
      if (result.success) {
        setMessages(result.data.reverse());
      }
    } catch {
      // 静默处理错误
    }
  };

  // WebSocket连接
  useEffect(() => {
    fetchMessages();
    
    const connectWebSocket = () => {
        const wsUrl = 'wss://api.the3studio.cn';
        console.log('正在连接WebSocket:', wsUrl);
        
        try {
          const websocket = new WebSocket(wsUrl);
          
          websocket.onopen = () => {
            console.log('WebSocket连接成功');
            websocket.send(JSON.stringify({ type: 'identify', clientName: 'web' }));
            setWs(websocket);
          };
          
          websocket.onclose = (event) => {
            console.log('WebSocket连接关闭:', event.code, event.reason);
            setWs(null);
            if (event.code !== 1000) {
              console.log('尝试重新连接...');
              setTimeout(connectWebSocket, 3000);
            }
          };
          
          websocket.onerror = (error) => {
            console.error('WebSocket连接错误:', error);
          };
          
          websocket.onmessage = (event) => {
            try {
              console.log('收到WebSocket消息:', event.data);
              const msg = JSON.parse(event.data);
              
              if (msg.type === 'newUpload' && msg.data) {
                // 收到审核通过的新上传消息，添加到页面显示
                const newMessage = {
                  id: msg.data.id,
                  image_name: msg.data.image_name,
                  text_content: msg.data.text_content,
                  created_at: new Date().toISOString()
                };
                setMessages((prev) => {
                  const exists = prev.some(item => item.id === newMessage.id);
                  if (exists) {
                    return prev;
                  }
                  return [...prev, newMessage];
                });
              } else if (msg.type === 'deleteUpload' && msg.data) {
                setMessages((prev) => prev.filter(item => item.id !== msg.data.id));
              }
            } catch (error) {
              console.error('处理WebSocket消息失败:', error);
            }
          };
          
          return websocket;
        } catch (error) {
          console.error('创建WebSocket连接失败:', error);
          return null;
        }
      };
      
      const ws = connectWebSocket();
      
      return () => {
        if (ws) {
          ws.close(1000, '组件卸载');
        }
      };
  }, []);

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

  // 发送消息（通过 HTTPS API）
  const handleSend = async () => {
    if ((!imageFile && !text.trim()) || isSending) {
      return;
    }
    
    setIsSending(true);
    try {
      let imageData = null;
      
      // 如果有图片，先压缩再转换为 base64
      if (imageFile) {
        console.log(`开始压缩图片... 原始大小: ${(imageFile.size / 1024).toFixed(2)} KB`);
        imageData = await compressImage(imageFile, 800, 800, 0.85);
      }
      
      // 通过 HTTPS API 上传
      const apiUrl = 'https://api.the3studio.cn';
      const response = await fetch(`${apiUrl}/api/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageData ? {
            data: imageData,
            type: imageFile?.type || 'image/jpeg',
            name: imageFile?.name || 'image.jpg'
          } : null,
          textContent: text.trim()
        }),
      });

      const result = await response.json();

      if (result.success) {
        // 上传成功，显示提示
        alert('上传成功，等待审核');
        
        // 清空输入
        setText('');
        setImageFile(null);
        setImagePreview('');
        setIsSending(false);
      } else {
        // 上传失败
        alert(result.error || '上传失败，请稍后重试');
        setIsSending(false);
      }
      
    } catch (error) {
      console.error('发送失败:', error);
      alert('发送失败，请稍后重试');
      setIsSending(false);
    }
  };

  const handleCropComplete = (file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSendClick = () => {
    if (!text.trim() && !imageFile) {
      alert('请同时上传图片和输入文字');
      return;
    }
    if (!text.trim()) {
      alert('请输入文字内容');
      return;
    }
    if (!imageFile) {
      alert('请上传图片');
      return;
    }
    if (isSending) {
      return;
    }
    handleSend();
  };

  const renderMessage = (msg: UploadData, idx: number) => {
    const hasImg = !!msg.image_name;
    const hasText = !!msg.text_content;
    const isEven = idx % 2 === 0;
    return (
      <div key={msg.id} className="flex items-center py-4 px-2 bg-[#DCFF92] border-b px-10 border-white border-5">
        {isEven ? (
          <>
            {hasImg && (
              <img
                src={getImageUrl(msg.image_name)}
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
                src={getImageUrl(msg.image_name)}
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
      {successModalOpen && (
        <div 
          className="fixed inset-0 bg-[rgba(0,0,0,0.6)] flex items-center justify-center z-50"
          onClick={() => setSuccessModalOpen(false)}
        >
          <div className="rounded-lg p-8 max-w-md w-full mx-4 text-center">
            <img 
              src={successImage} 
              alt="上传成功" 
              className="w-48 h-48 object-cover rounded-lg mx-auto mb-4"
            />
            <p className="text-xl font-medium text-white mb-2">上传成功</p>
          </div>
        </div>
      )}
      <div className="text-xs text-gray-500 text-center py-2 select-none">
        Web2touch, Interactive Installations, Bridging People.<br />
        Released 2023/1/9, copyright ©THE3.STUDIO
      </div>
    </div>
  );
}

